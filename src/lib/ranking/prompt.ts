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
      return `${shortId}. ID: ${shortId} | ${c.full_name} | ${c.title}`;
    })
    .join("\n");

  const sizeRules = getSizeRules(company.size_bucket);

  const prompt = `# Lead Qualification for B2B Sales Outbound

You are scoring leads for Throxy, a company that books meetings for B2B sales teams selling into traditional industries (manufacturing, healthcare, education).

## Company Context
- **Company:** ${company.name}
- **Size:** ${company.size_bucket ? company.size_bucket.toUpperCase() : "UNKNOWN"} (${company.employee_range})
- **Industry:** ${company.industry || "Unknown"}
${scrapedSummary ? `- **Company Intel:** ${scrapedSummary}` : ""}

## Candidates to Rank
${candidateList}

## Scoring Rules for ${company.size_bucket ? company.size_bucket.toUpperCase() : "THIS"} Companies

${sizeRules}

## Who NOT to Contact

### Hard Exclusions (ALWAYS mark irrelevant, score 0)
| Role | Reason |
|------|--------|
| CEO / President (Mid-Market & Enterprise) | Too far removed from outbound execution |
| CFO / Finance | Wrong department (unless Startup Finance Head) |
| HR / Legal / Compliance | Administrative function |
| Customer Success / Support | Post-sale focus |
| Board / Investors | Non-operational |
| Interns / Students | No purchasing power |

### Soft Exclusions (Deprioritize or Mark Irrelevant)
| Role | Context |
|------|---------|
| CTO / Engineering | Irrelevant (unless explicitly "GTM Systems" or at <50 employees) |
| Product Management | Internal product focus |
| Marketing | Focuses on inbound/brand, rarely buys outbound tools |
| BDRs / SDRs | End users; usually not decision makers |
| Account Executives | Focused on closing, not infrastructure |

## Qualification Signals (Context for Scoring)
**Note: Only use these signals if explicitly present in scraped summary / input. Otherwise ignore.**

### Positive Signals (Increase Score)
- Recently raised funding (Budget available)
- Actively hiring SDRs/BDRs (Investing in outbound)
- Sells into enterprise or mid-market buyers
- Long sales cycles (3+ months)
- Lead was recently promoted
- Company posting about "pipeline problems" or "scaling sales"
- Small or no existing SDR team
- Previous company used outsourced outbound

### Negative Signals (Decrease Score)
- Sells to SMB or consumers (B2C)
- Product-led growth (PLG) company
- Large, established SDR team (20+)
- Company in layoffs or cost-cutting mode
- No online presence or outdated website

## Role Classifications
- **decision_maker**: Can approve purchase of sales tools (primary target)
- **champion**: Can advocate internally, useful for multi-threading (secondary)
- **irrelevant**: Wrong department, seniority, or role for this company size

## Output Format

Return a JSON object with a "results" array. Include exactly one object per provided candidate. Do not omit any candidates.

{
  "results": [
    {
      "id": 1,
      "is_relevant": true,
      "role_type": "decision_maker",
      "rank_within_company": 1,
      "score": 92,
      "rubric": {
        "department_fit": 5,
        "seniority_fit": 4,
        "size_fit": 5
      },
      "reasoning": "VP Sales at SMB - primary decision maker for sales tools",
      "flags": []
    }
  ]
}

**Important:**
- Set rank_within_company to 1, 2, 3... for relevant leads (1 = best)
- Set rank_within_company to null for irrelevant leads
- Score 0-100 is for tiebreaking (90-100 = perfect fit, 0 = irrelevant)
- Return one object per candidate, including irrelevant ones

Return ONLY the JSON object, no markdown, no explanation.`;

  return { prompt, idMap };
}

function getSizeRules(sizeBucket: string): string {
  if (!sizeBucket) return "";

  const rules: Record<string, string> = {
    startup: `### Startup (1-50 employees)
At early-stage companies, founders are operationally involved in sales and make fast purchasing decisions.

**Primary Targets (Rank 1-5):**
1. Founder / Co-Founder (Priority 5/5)
2. CEO / President (Priority 5/5)
3. Owner / Co-Owner (Priority 5/5)
4. Managing Director (Priority 4/5)
5. Head of Sales (Priority 4/5)

**Buying trigger:** "I don't have time to do outbound myself anymore."

**Note:** Founders and CPUs are the decision makers here.`,

    smb: `### SMB (51-200 employees)
Sales leadership exists but lacks resources to build sophisticated outbound infrastructure.

**Primary Targets (Rank 1-7):**
1. VP of Sales (Priority 5/5)
2. Head of Sales (Priority 5/5)
3. Sales Director (Priority 5/5)
4. Director of Sales Development (Priority 5/5)
5. CRO (Chief Revenue Officer) (Priority 4/5)
6. Head of Revenue Operations (Priority 4/5)
7. VP of Growth (Priority 4/5)

**Buying trigger:** "My team can't keep up with our growth goals."`,

    mid_market: `### Mid-Market (201-1,000 employees)
Established sales organizations struggling with pipeline quality and BDR productivity. Multiple stakeholders involved in decisions.

**Primary Targets (Rank 1-7):**
1. VP of Sales Development (Priority 5/5)
2. VP of Sales (Priority 5/5)
3. Head of Sales Development (Priority 5/5)
4. Director of Sales Development (Priority 5/5)
5. CRO (Chief Revenue Officer) (Priority 4/5)
6. VP of Revenue Operations (Priority 4/5)
7. VP of GTM (Priority 4/5)

**Champions (for multi-threading):** Sales Managers, BDR Managers, RevOps Managers

**Buying trigger:** "We need to improve outbound efficiency and pipeline predictability."`,

    enterprise: `### Enterprise (1,000+ employees)
Complex buying processes. CEOs are too far removed—target VP and Director level leaders who own the function.

**Primary Targets (Rank 1-7):**
1. VP of Sales Development (Priority 5/5)
2. VP of Inside Sales (Priority 5/5)
3. Head of Sales Development (Priority 5/5)
4. CRO (Chief Revenue Officer) (Priority 4/5)
5. VP of Revenue Operations (Priority 4/5)
6. Director of Sales Development (Priority 4/5)
7. VP of Field Sales (Priority 4/5)

**Champions (essential):** BDR Managers, Directors of Sales Operations, RevOps Managers

**Buying trigger:** "We need to hit aggressive growth targets with better outbound execution."`,
  };

  return rules[sizeBucket] || rules.smb;
}
