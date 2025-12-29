/**
 * Ranking Prompt Builder
 * 
 * Uses short numeric IDs (1, 2, 3...) instead of UUIDs to prevent LLM hallucination.
 * The caller must maintain a mapping to convert back to real IDs.
 */

export interface CandidateInput {
  id: string;        // Real UUID
  full_name: string;
  title: string;
}

export interface PromptResult {
  prompt: string;
  idMap: Map<number, string>;  // shortId -> realId
}

/**
 * Builds ranking prompt with short numeric IDs
 * Returns both the prompt and a map to convert short IDs back to real UUIDs
 */
export function buildRankingPrompt(
  company: { name: string; size_bucket: string; employee_range: string; industry?: string },
  candidates: CandidateInput[],
  scrapedSummary?: string
): PromptResult {
  // Create ID mapping: 1-indexed short ID -> real UUID
  const idMap = new Map<number, string>();

  const candidateList = candidates
    .map((c, i) => {
      const shortId = i + 1; // 1-indexed
      idMap.set(shortId, c.id);
      return `${shortId}. ${c.full_name} | ${c.title}`;
    })
    .join("\n");

  const sizeContext = getSizeContext(company.size_bucket);

  const prompt = `# Lead Qualification for B2B Sales Outbound

You are scoring leads for Throxy, a company that books meetings for B2B sales teams.

## Company Context
- **Company:** ${company.name}
- **Size:** ${company.size_bucket ? company.size_bucket.toUpperCase() : "UNKNOWN"} (${company.employee_range})
- **Industry:** ${company.industry || "Unknown"}
${scrapedSummary ? `- **Intel:** ${scrapedSummary}` : ""}

## Candidates (${candidates.length} total)
${candidateList}

${sizeContext}

## Hard Exclusions (ALWAYS irrelevant, score 0)
- HR / Recruiting / People Operations
- Finance / Accounting / FP&A
- Legal / Compliance
- Customer Support / Customer Success
- Investors / Board Members / Advisors
- Interns / Students

## Output Format

Return a JSON object with a "results" array containing EXACTLY ${candidates.length} objects (one per candidate).

{
  "results": [
    {
      "id": 1,
      "is_relevant": true,
      "role_type": "decision_maker",
      "score": 92,
      "reasoning": "VP Sales at SMB - primary decision maker"
    },
    {
      "id": 2,
      "is_relevant": false,
      "role_type": "irrelevant",
      "score": 0,
      "reasoning": "HR role - excluded"
    }
  ]
}

**Rules:**
- id: Use the candidate NUMBER (1, 2, 3...) NOT a UUID
- role_type: "decision_maker" | "champion" | "irrelevant"
- score: 0-100 (90-100=top priority decision maker, 50-89=champion, 0=irrelevant)
- reasoning: Brief explanation of the score
- You MUST return exactly ${candidates.length} results
- DO NOT assign ranks - ranks will be computed automatically based on scores

Return ONLY JSON. No markdown, no explanation.`;

  return { prompt, idMap };
}

function getSizeContext(sizeBucket: string): string {
  if (!sizeBucket) return "";

  const rules: Record<string, string> = {
    startup: `## Startup Rules (1-50 employees)
**Founders ARE the sales team. They make fast decisions.**

Top Priority (rank 1-2): Founder/CEO, President, Owner
Secondary (rank 3-4): VP Sales, CRO, Head of Growth  
Champion (rank 5+): Sales Manager, SDR/BDR`,

    smb: `## SMB Rules (51-200 employees)
**Dedicated sales leadership exists. Founders delegate.**

Top Priority (rank 1-3): VP Sales, Sales Director, CRO
Secondary (rank 4-6): RevOps, CEO/Founder, Growth Lead
Champion (rank 7+): SDR, BDR, Sales Manager`,

    mid_market: `## Mid-Market Rules (201-1000 employees)
**Established sales org. Multi-threading essential.**

Top Priority (rank 1-3): VP Sales Dev, Head of SDR, Sales Director
Secondary (rank 4-6): Sales Ops, RevOps Manager
Champion (rank 7+): BDR Manager, SDR Manager

**Exclude: CEO/President (too removed, unless GTM title)**`,

    enterprise: `## Enterprise Rules (1000+ employees)
**Complex buying. CEOs will never see your email.**

Top Priority (rank 1-3): VP Sales Dev, VP Inside Sales, Director SDR
Secondary (rank 4-6): Sales Ops Director, RevOps Director
Champion (rank 7+): BDR Manager

**Exclude: CEO, President, Founder, Board Members**`,
  };

  return rules[sizeBucket] || rules.smb;
}
