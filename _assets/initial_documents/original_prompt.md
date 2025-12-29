Please build. # 🚀 Throxy Persona Ranker: Final Architecture (v2.0)

## Executive Summary

This document provides the **complete, production-grade architecture** for the Throxy technical challenge. All known issues from prior drafts have been fixed.

**Core Philosophy:** We're building an **Async Agent System**, not a simple API route. Every bonus is designed-in from the start.

---

## ⚠️ Fixed Issues (from prior drafts)

| Issue | Fix Applied |
|-------|-------------|
| Trigger.dev version mismatch | Standardized on **v3** (`@trigger.dev/sdk/v3`) |
| Real-time progress wrong hook | Using **Supabase Realtime** on `ranking_jobs` table |
| Over-claiming eval stats | Phrased as "based on inspection" with computed counts |
| Hardcoded pricing constants | Track tokens/latency only; cost is "estimated" |
| Prefilter vs "rank ALL" wording | Prompt says "Return one object per provided candidate" |
| Score-only ranking instability | LLM outputs explicit `rank_within_company` |
| Per-lead DB writes in loops | **Batch upserts** instead of row-by-row |
| Provider inconsistency | Standardized on **Groq** with `llama-3.3-70b-versatile` |
| `response_format` array mismatch | Using `{ results: [...] }` object wrapper |
| CTO/Engineering blanket exclusion | **Size-aware**: allow CTO at startups |
| CEO/President too blunt | Exception for GTM/Sales/Revenue titles |
| Company keying underspecified | Added `canonical_key` for deduplication |
| Brittle JSON parsing | Robust extraction with fallback + wrapper schema |

---

## 0. Ground Truth Analysis: Eval Set Insights

Based on inspection of `eval_set.csv`, patterns suggest the ground truth is more nuanced than a naive reading of the persona spec:

### Observed Patterns (from manual inspection)

| Company | Size Range | Top Ranked Roles | Key Insight |
|---------|------------|------------------|-------------|
| Poka Labs | 2-10 | CEO (#1), Founder (#2) | Founders top priority at tiny startups |
| Profit Labs | 11-50 | Head of Sales (#1), CEO (#2) | Sales leader can outrank CEO |
| Toolbx | 51-200 | Sr. Dir Growth (#1), CEO (#2), SDR (#5-6) | SDRs ARE ranked at SMB |
| Ben | 51-200 | Sales Leader (#1), VP Marketing (#2) | Marketing VP highly valued |
| Showpad | 501-1000 | VP Biz Dev (#1), President GTM (#2) | CEO marked irrelevant |

### Implications for Deterministic Gate

The pre-filter must be **narrow** — only exclude what's ALWAYS wrong:

**Hard Exclusions (all sizes):**
- HR / Talent Acquisition / Recruiting
- Finance / Accounting / FP&A (but not CFO at tiny startups)
- Legal / Compliance
- Customer Support / Customer Success
- Investors / Advisors / Board Members
- Interns / Students

**Size-Dependent (NOT hard exclusions — handled by LLM):**
- CTO/Engineering → Might be relevant at startups, irrelevant at enterprise
- CEO/President → Top priority at startups, exclude at mid-market+ UNLESS title contains GTM/Sales/Revenue

---

## 1. Infrastructure: Async Agent Pattern

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         SYSTEM ARCHITECTURE                              │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│   ┌──────────┐     ┌──────────────┐     ┌─────────────────────────┐     │
│   │  Next.js │────▶│ Trigger.dev  │────▶│   Supabase (Postgres)   │     │
│   │    UI    │◀────│   v3 Tasks   │◀────│                         │     │
│   └──────────┘     └──────────────┘     └─────────────────────────┘     │
│        │                                          │                      │
│        │                                          │                      │
│        └────────── Supabase Realtime ─────────────┘                      │
│                    (ranking_jobs table)                                  │
│                                                                          │
│   LLM Provider: Groq (llama-3.3-70b-versatile)                          │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### Why This Pattern?

- **Trigger.dev v3**: Prevents Vercel 10-60s timeouts, durable execution
- **Supabase Realtime**: Subscribe to `ranking_jobs` progress updates (NOT Trigger hooks with wrong IDs)
- **Groq**: Fast inference, consistent with existing codebase

---

## 2. Environment Configuration

```bash
# .env.local (NEVER commit this file)

# Database
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_KEY=your-service-key

# LLM Provider (Groq)
GROQ_API_KEY=your-groq-key-here
GROQ_MODEL=llama-3.3-70b-versatile

# Trigger.dev
TRIGGER_SECRET_KEY=your-trigger-key
```

**Security (non-negotiable):**
- Never hardcode API keys in code or docs
- If a key is ever pasted into chat/logs: **revoke + rotate immediately**
- Keys only in env vars, loaded at runtime

---

## 3. Database Schema (Supabase)

```sql
-- Enums
CREATE TYPE company_size AS ENUM ('startup', 'smb', 'mid_market', 'enterprise');
CREATE TYPE role_classification AS ENUM ('decision_maker', 'champion', 'irrelevant');
CREATE TYPE job_status AS ENUM ('pending', 'running', 'completed', 'failed');

-- Companies (with canonical_key for deduplication)
CREATE TABLE companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  domain TEXT,
  canonical_key TEXT NOT NULL,           -- For deduplication (lowercase domain or normalized name)
  employee_range TEXT,                   -- Raw from CSV: "10001+", "11-50", etc.
  size_bucket company_size,              -- Normalized enum
  industry TEXT,
  scraped_summary TEXT,                  -- From Company Scout (optional)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(canonical_key)                  -- Prevent duplicate companies
);

-- Leads
CREATE TABLE leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  
  -- Raw data from CSV
  first_name TEXT,
  last_name TEXT,
  full_name TEXT GENERATED ALWAYS AS (
    TRIM(COALESCE(first_name, '') || ' ' || COALESCE(last_name, ''))
  ) STORED,
  title TEXT NOT NULL,
  linkedin_url TEXT,
  raw_json JSONB,                        -- Preserve original row
  
  -- Normalized fields
  title_normalized TEXT,                 -- Cleaned for matching
  
  -- Ranking outputs (NULL until ranked)
  is_relevant BOOLEAN,
  relevance_score INTEGER CHECK (relevance_score >= 0 AND relevance_score <= 100),
  rank_within_company INTEGER,           -- Explicit rank from LLM
  role_type role_classification,
  reasoning TEXT,
  rubric_scores JSONB,                   -- {department_fit, seniority_fit, size_fit}
  flags TEXT[],
  
  -- Pre-filter output
  excluded_by_gate BOOLEAN DEFAULT FALSE,
  exclusion_reason TEXT,
  
  ranked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Job tracking (for Supabase Realtime progress)
CREATE TABLE ranking_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  status job_status DEFAULT 'pending',
  prompt_version_id UUID REFERENCES prompt_versions(id),
  
  -- Progress tracking (Supabase Realtime subscribes to these)
  total_companies INTEGER DEFAULT 0,
  processed_companies INTEGER DEFAULT 0,
  total_leads INTEGER DEFAULT 0,
  processed_leads INTEGER DEFAULT 0,
  
  -- Trigger.dev run tracking
  trigger_batch_id TEXT,                 -- From batchTrigger response
  
  -- Options
  use_company_scout BOOLEAN DEFAULT FALSE,
  top_n_per_company INTEGER DEFAULT 3,
  
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  error TEXT
);

-- Enable Realtime for ranking_jobs
ALTER PUBLICATION supabase_realtime ADD TABLE ranking_jobs;

-- Usage tracking (tokens/latency - cost is estimated)
CREATE TABLE ai_calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES ranking_jobs(id),
  company_id UUID REFERENCES companies(id),
  
  call_type TEXT CHECK (call_type IN ('ranking', 'enrichment', 'optimization', 'gradient')),
  model TEXT NOT NULL,                   -- e.g., "llama-3.3-70b-versatile"
  input_tokens INTEGER,
  output_tokens INTEGER,
  latency_ms INTEGER,
  -- Note: cost_usd is estimated, not authoritative
  estimated_cost_usd DECIMAL(10, 6),
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Prompt optimization
CREATE TABLE prompt_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version INTEGER NOT NULL,
  prompt_text TEXT NOT NULL,
  is_active BOOLEAN DEFAULT FALSE,
  
  -- Metrics from eval set
  relevance_precision FLOAT,
  relevance_recall FLOAT,
  relevance_f1 FLOAT,
  ranking_ndcg_at_3 FLOAT,
  composite_score FLOAT,
  
  -- Gradient that led to this version
  parent_version_id UUID REFERENCES prompt_versions(id),
  gradient_summary TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE optimization_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  status job_status DEFAULT 'pending',
  max_iterations INTEGER DEFAULT 5,
  iterations_completed INTEGER DEFAULT 0,
  
  best_prompt_id UUID REFERENCES prompt_versions(id),
  improvement_history JSONB,
  
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX idx_leads_company_id ON leads(company_id);
CREATE INDEX idx_leads_is_relevant ON leads(is_relevant) WHERE is_relevant = TRUE;
CREATE INDEX idx_ai_calls_job_id ON ai_calls(job_id);
CREATE INDEX idx_companies_canonical_key ON companies(canonical_key);

-- Batch progress update function
CREATE OR REPLACE FUNCTION increment_job_progress(
  p_job_id UUID,
  p_companies INTEGER DEFAULT 0,
  p_leads INTEGER DEFAULT 0
) RETURNS VOID AS $$
BEGIN
  UPDATE ranking_jobs 
  SET 
    processed_companies = processed_companies + p_companies,
    processed_leads = processed_leads + p_leads
  WHERE id = p_job_id;
END;
$$ LANGUAGE plpgsql;
```

---

## 4. Unified LLM Client (Groq)

```typescript
// lib/ai/client.ts

import OpenAI from "openai";

// Single LLM client - Groq only
export const llm = new OpenAI({
  apiKey: process.env.GROQ_API_KEY!,
  baseURL: "https://api.groq.com/openai/v1",
});

export const LLM_MODEL = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";

// Output schema: always use object wrapper for response_format compatibility
export interface RankingResponse {
  results: LeadScore[];
}

export interface LeadScore {
  id: string;
  is_relevant: boolean;
  role_type: "decision_maker" | "champion" | "irrelevant";
  rank_within_company: number | null;  // Explicit rank, not derived from score
  score: number;                        // 0-100 for tiebreaking / UI display
  rubric: {
    department_fit: number;
    seniority_fit: number;
    size_fit: number;
  };
  reasoning: string;
  flags: string[];
}

// Robust JSON extraction (handles wrapper objects, markdown, etc.)
export function extractJsonResponse<T>(text: string): T {
  // Try direct parse first
  try {
    return JSON.parse(text);
  } catch {}
  
  // Try to find JSON object
  const objectMatch = text.match(/\{[\s\S]*\}/);
  if (objectMatch) {
    try {
      return JSON.parse(objectMatch[0]);
    } catch {}
  }
  
  // Try to find JSON array (legacy support)
  const arrayMatch = text.match(/\[[\s\S]*\]/);
  if (arrayMatch) {
    try {
      return { results: JSON.parse(arrayMatch[0]) } as T;
    } catch {}
  }
  
  throw new Error(`Failed to parse JSON from response: ${text.slice(0, 200)}`);
}

// Estimated cost (not authoritative - for tracking only)
export function estimateCost(model: string, inputTokens: number, outputTokens: number): number {
  // Groq pricing is very low / sometimes free tier
  // This is for tracking purposes only
  const PRICING: Record<string, { input: number; output: number }> = {
    "llama-3.3-70b-versatile": { input: 0.00059, output: 0.00079 }, // per 1K tokens, approximate
    "default": { input: 0.001, output: 0.002 },
  };
  
  const prices = PRICING[model] || PRICING.default;
  return (inputTokens / 1000 * prices.input) + (outputTokens / 1000 * prices.output);
}
```

---

## 5. CSV Normalization

### 5.1 Company Canonical Key (for deduplication)

```typescript
// lib/normalization/company.ts

export function generateCanonicalKey(name: string, domain?: string): string {
  // Prefer domain if available (more stable)
  if (domain) {
    return domain
      .toLowerCase()
      .replace(/^(www\.|https?:\/\/)/, "")
      .replace(/\/$/, "")
      .trim();
  }
  
  // Fallback: normalize company name
  return name
    .toLowerCase()
    .replace(/[^\w\s]/g, "")  // Remove punctuation
    .replace(/\s+/g, " ")      // Collapse whitespace
    .trim();
}
```

### 5.2 Size Bucket Mapping

```typescript
// lib/normalization/size.ts

type SizeBucket = "startup" | "smb" | "mid_market" | "enterprise";

const SIZE_MAPPINGS: Record<string, SizeBucket> = {
  // Startup (1-50)
  "1-10": "startup",
  "2-10": "startup",
  "11-50": "startup",
  
  // SMB (51-200)
  "51-200": "smb",
  
  // Mid-Market (201-1000)
  "201-500": "mid_market",
  "501-1000": "mid_market",
  
  // Enterprise (1000+)
  "1001-5000": "enterprise",
  "5001-10000": "enterprise",
  "10001+": "enterprise",
  "1000+": "enterprise",
  "10000+": "enterprise",
};

export function normalizeSizeBucket(employeeRange: string): SizeBucket | null {
  if (!employeeRange) return null;
  const cleaned = employeeRange.trim();
  return SIZE_MAPPINGS[cleaned] || null;
}
```

### 5.3 Title Normalization

```typescript
// lib/normalization/title.ts

const TITLE_SYNONYMS: Record<string, string> = {
  "svp": "senior vice president",
  "evp": "executive vice president",
  "vp": "vice president",
  "cro": "chief revenue officer",
  "coo": "chief operating officer",
  "cfo": "chief financial officer",
  "cto": "chief technology officer",
  "ceo": "chief executive officer",
  "cmo": "chief marketing officer",
  "sdr": "sales development representative",
  "bdr": "business development representative",
  "ae": "account executive",
  "revops": "revenue operations",
  "gtm": "go to market",
  "md": "managing director",
};

const NOISE_PATTERNS = [
  /\s*\|.*$/,                    // Everything after |
  /\s*@.*$/,                     // Everything after @
  /\s*-\s*[A-Z]{2,}$/,          // Location suffixes like "- EMEA"
  /\(.*?\)/g,                    // Parenthetical content
  /[,;]/g,                       // Commas and semicolons
  /\s+/g,                        // Multiple spaces
];

export function normalizeTitle(title: string): string {
  if (!title) return "";
  
  let normalized = title.toLowerCase().trim();
  
  // Remove noise
  for (const pattern of NOISE_PATTERNS) {
    normalized = normalized.replace(pattern, " ");
  }
  
  // Expand acronyms
  for (const [abbrev, full] of Object.entries(TITLE_SYNONYMS)) {
    const regex = new RegExp(`\\b${abbrev}\\b`, "gi");
    normalized = normalized.replace(regex, full);
  }
  
  return normalized.trim().replace(/\s+/g, " ");
}
```

---

## 6. Deterministic Pre-Filter (Size-Aware)

```typescript
// lib/ranking/prefilter.ts

interface PrefilterResult {
  shouldExclude: boolean;
  reason: string | null;
}

// Hard exclusions - ALWAYS wrong at any company size
const HARD_EXCLUSION_PATTERNS = [
  { pattern: /\b(hr|human resources|talent acquisition|recruiter|recruiting|people operations)\b/i, reason: "HR/Recruiting" },
  { pattern: /\b(finance|accounting|accountant|fp&a|controller|bookkeeper|payroll)\b/i, reason: "Finance/Accounting" },
  { pattern: /\b(legal|compliance|counsel|attorney|lawyer|paralegal)\b/i, reason: "Legal" },
  { pattern: /\b(customer (support|success|service)|cs manager|support (engineer|specialist))\b/i, reason: "Customer Support" },
  { pattern: /\b(investor|board member|board of directors|advisory board|angel investor)\b/i, reason: "Investor/Board" },
  { pattern: /\b(intern|student|trainee|apprentice|co-op)\b/i, reason: "Intern/Student" },
];

// GTM/Sales context that allows otherwise-excluded titles
const GTM_SALES_CONTEXT = /\b(sales|revenue|growth|gtm|go.to.market|commercial|business development|biz dev)\b/i;

// Size-dependent rules
interface SizeRule {
  pattern: RegExp;
  excludeAt: string[];  // Size buckets where this is excluded
  reason: string;
}

const SIZE_DEPENDENT_RULES: SizeRule[] = [
  {
    pattern: /\b(ceo|chief executive)\b/i,
    excludeAt: ["mid_market", "enterprise"],  // NOT excluded at startup/smb
    reason: "CEO too removed at larger companies",
  },
  {
    pattern: /\bpresident\b/i,
    excludeAt: ["mid_market", "enterprise"],
    reason: "President too removed (unless GTM/Sales context)",
  },
  {
    pattern: /\bfounder|co-founder\b/i,
    excludeAt: ["enterprise"],  // Still relevant at mid_market sometimes
    reason: "Founder too removed at enterprise",
  },
];

export function prefilterLead(
  title: string,
  normalizedTitle: string,
  sizeBucket: string
): PrefilterResult {
  // 1. Check hard exclusions (always apply)
  for (const { pattern, reason } of HARD_EXCLUSION_PATTERNS) {
    if (pattern.test(title) || pattern.test(normalizedTitle)) {
      return { shouldExclude: true, reason };
    }
  }
  
  // 2. Check size-dependent rules
  for (const rule of SIZE_DEPENDENT_RULES) {
    if (rule.excludeAt.includes(sizeBucket)) {
      if (rule.pattern.test(normalizedTitle)) {
        // Exception: if title has GTM/Sales context, don't exclude
        // e.g., "President of Sales", "President GTM"
        if (GTM_SALES_CONTEXT.test(normalizedTitle)) {
          continue; // Don't exclude
        }
        return { shouldExclude: true, reason: rule.reason };
      }
    }
  }
  
  return { shouldExclude: false, reason: null };
}
```

---

## 7. The Ranking Prompt (with Object Wrapper Schema)

```typescript
// lib/ranking/prompt.ts

export function buildRankingPrompt(
  company: { name: string; size_bucket: string; employee_range: string; industry?: string },
  candidates: Array<{ id: string; full_name: string; title: string }>,
  scrapedSummary?: string
): string {
  const sizeRules = getSizeRules(company.size_bucket);
  
  const candidateList = candidates
    .map((c, i) => `${i + 1}. ID: ${c.id} | ${c.full_name} | ${c.title}`)
    .join("\n");

  return `# Lead Qualification for B2B Sales Outbound

You are scoring leads for Throxy, a company that books meetings for B2B sales teams selling into traditional industries (manufacturing, healthcare, education).

## Company Context
- **Company:** ${company.name}
- **Size:** ${company.size_bucket.toUpperCase()} (${company.employee_range})
- **Industry:** ${company.industry || "Unknown"}
${scrapedSummary ? `- **Company Intel:** ${scrapedSummary}` : ""}

## Candidates to Rank
${candidateList}

## Scoring Rules for ${company.size_bucket.toUpperCase()} Companies

${sizeRules}

## Hard Exclusions (ALWAYS mark irrelevant, score 0)
- HR / Talent Acquisition / Recruiting
- Finance / Accounting / FP&A
- Legal / Compliance
- Customer Support / Customer Success
- Investors / Board Members / Advisors
- Interns / Students

## Role Classifications
- **decision_maker**: Can approve purchase of sales tools (primary target)
- **champion**: Can advocate internally, useful for multi-threading (secondary)
- **irrelevant**: Wrong department, seniority, or role for this company size

## Output Format

Return a JSON object with a "results" array. Include exactly one object per provided candidate. Do not omit any candidates.

{
  "results": [
    {
      "id": "uuid-here",
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
}

function getSizeRules(sizeBucket: string): string {
  const rules: Record<string, string> = {
    startup: `### Startup (1-50 employees)
At startups, founders ARE the sales team. They make fast decisions.

**Top Priorities (Rank 1-3, Score 90-100):**
1. Founder / Co-Founder
2. CEO / President  
3. Owner / Managing Director
4. Head of Sales / Head of Growth

**Secondary (Rank 4+, Score 70-89):**
- Head of Business Development
- Head of Operations (if involved in sales)
- CTO (if company is very small, <10)

**Note:** CEOs and Founders are decision-makers at this size, unlike larger companies.`,

    smb: `### SMB (51-200 employees)
Dedicated sales leadership exists but resources are stretched.

**Top Priorities (Rank 1-3, Score 90-100):**
1. VP of Sales / Head of Sales
2. Sales Director
3. Director of Sales Development
4. CRO (Chief Revenue Officer)

**Secondary (Rank 4-6, Score 70-89):**
- Head of Revenue Operations
- VP of Growth / Head of Growth
- CEO / Founder (they delegate but can approve)

**Champions (Rank 7+, Score 50-69):**
- SDRs / BDRs (can advocate internally)
- Sales Managers

**Note:** Founders/CEOs are secondary — they delegate sales tool decisions.`,

    mid_market: `### Mid-Market (201-1000 employees)
Established sales org with dedicated SDR function. Multi-threading is essential.

**Decision Makers (Rank 1-4, Score 85-100):**
1. VP of Sales Development
2. VP of Sales / Head of Sales
3. Director of Sales Development
4. Head of SDR/BDR Team

**Champions (Rank 5-8, Score 60-75):**
- Sales Managers
- BDR/SDR Managers
- Revenue Operations Managers

**Deprioritize (Score 30-50):**
- CEOs / Presidents (unless "President of Sales/GTM")
- Individual SDRs/BDRs — limited influence

**Mark Irrelevant:**
- CEO / President without GTM context — too removed`,

    enterprise: `### Enterprise (1000+ employees)
Complex buying processes. CEOs will never see your email.

**Decision Makers (Rank 1-4, Score 85-100):**
1. VP of Sales Development
2. VP of Inside Sales
3. Head of Sales Development
4. Director of SDR/BDR

**Essential Champions (Rank 5-8, Score 60-75):**
- BDR Managers
- Directors of Sales Operations
- Revenue Operations Directors

**Mark Irrelevant (Score 0):**
- CEO / President / Founder — too removed, will ignore
- Board Members / Advisors — not operational
- General VPs without sales development focus

**Note:** Multi-threading through champions is ESSENTIAL.`,
  };

  return rules[sizeBucket] || rules.smb;
}
```

---

## 8. Trigger.dev Task (v3, with Batch Writes)

```typescript
// trigger/rank-company.ts

import { task, metadata } from "@trigger.dev/sdk/v3";
import { createClient } from "@supabase/supabase-js";
import { llm, LLM_MODEL, extractJsonResponse, estimateCost, RankingResponse } from "../lib/ai/client";
import { buildRankingPrompt } from "../lib/ranking/prompt";
import { prefilterLead } from "../lib/ranking/prefilter";
import { normalizeTitle } from "../lib/normalization/title";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

interface RankCompanyPayload {
  jobId: string;
  companyId: string;
  useCompanyScout?: boolean;
}

export const rankCompanyTask = task({
  id: "rank-company",
  maxDuration: 120,
  retry: {
    maxAttempts: 3,
    minTimeoutInMs: 1000,
    maxTimeoutInMs: 10000,
  },
  
  run: async (payload: RankCompanyPayload) => {
    const { jobId, companyId, useCompanyScout } = payload;
    const startTime = Date.now();
    
    // 1. Fetch company and leads
    const { data: company, error: companyError } = await supabase
      .from("companies")
      .select("*")
      .eq("id", companyId)
      .single();
      
    if (companyError || !company) {
      throw new Error(`Company ${companyId} not found`);
    }

    const { data: leads, error: leadsError } = await supabase
      .from("leads")
      .select("*")
      .eq("company_id", companyId);
    
    if (leadsError || !leads?.length) {
      throw new Error(`No leads found for company ${companyId}`);
    }

    metadata.set("company", company.name);
    metadata.set("totalLeads", leads.length);
    
    // 2. Company Scout (Optional)
    let scrapedSummary: string | undefined;
    if (useCompanyScout && company.domain) {
      try {
        scrapedSummary = await scrapeCompanyWebsite(company.domain);
        await supabase
          .from("companies")
          .update({ scraped_summary: scrapedSummary })
          .eq("id", companyId);
      } catch (e) {
        console.warn(`Scout failed for ${company.domain}`);
      }
    }
    
    // 3. Normalize and pre-filter leads (collect for batch write)
    const candidates: typeof leads = [];
    const excludedUpdates: Array<{
      id: string;
      excluded_by_gate: boolean;
      exclusion_reason: string;
      is_relevant: boolean;
      role_type: string;
      relevance_score: number;
      reasoning: string;
      ranked_at: string;
    }> = [];
    
    for (const lead of leads) {
      const normalizedTitle = normalizeTitle(lead.title);
      const filterResult = prefilterLead(
        lead.title,
        normalizedTitle,
        company.size_bucket
      );
      
      if (filterResult.shouldExclude) {
        excludedUpdates.push({
          id: lead.id,
          excluded_by_gate: true,
          exclusion_reason: filterResult.reason!,
          is_relevant: false,
          role_type: "irrelevant",
          relevance_score: 0,
          reasoning: `Excluded by deterministic filter: ${filterResult.reason}`,
          ranked_at: new Date().toISOString(),
        });
      } else {
        candidates.push({ ...lead, title_normalized: normalizedTitle });
      }
    }
    
    // 4. Batch write excluded leads (single operation)
    if (excludedUpdates.length > 0) {
      await supabase
        .from("leads")
        .upsert(excludedUpdates, { onConflict: "id" });
    }
    
    metadata.set("excludedByGate", excludedUpdates.length);
    metadata.set("candidatesForLLM", candidates.length);
    
    // 5. If no candidates after filtering, we're done
    if (candidates.length === 0) {
      await supabase.rpc("increment_job_progress", {
        p_job_id: jobId,
        p_companies: 1,
        p_leads: leads.length,
      });
      return {
        companyId,
        companyName: company.name,
        leadsRanked: leads.length,
        excludedByGate: excludedUpdates.length,
        rankedByLLM: 0,
      };
    }
    
    // 6. Build prompt and call LLM
    const prompt = buildRankingPrompt(
      company,
      candidates.map(c => ({ id: c.id, full_name: c.full_name, title: c.title })),
      scrapedSummary
    );
    
    const llmStart = Date.now();
    const response = await llm.chat.completions.create({
      model: LLM_MODEL,
      messages: [{ role: "user", content: prompt }],
      temperature: 0,
      response_format: { type: "json_object" },
    });
    const llmLatency = Date.now() - llmStart;
    
    // 7. Log AI call
    const inputTokens = response.usage?.prompt_tokens || 0;
    const outputTokens = response.usage?.completion_tokens || 0;
    
    await supabase.from("ai_calls").insert({
      job_id: jobId,
      company_id: companyId,
      call_type: "ranking",
      model: LLM_MODEL,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      estimated_cost_usd: estimateCost(LLM_MODEL, inputTokens, outputTokens),
      latency_ms: llmLatency,
    });
    
    // 8. Parse response (robust extraction)
    const responseText = response.choices[0]?.message?.content || "";
    let rankingResult: RankingResponse;
    
    try {
      rankingResult = extractJsonResponse<RankingResponse>(responseText);
    } catch (e) {
      console.error("Failed to parse LLM response:", responseText.slice(0, 500));
      throw new Error("Invalid LLM response format");
    }
    
    // 9. Batch write ranked leads
    const rankedUpdates = rankingResult.results.map(score => ({
      id: score.id,
      is_relevant: score.is_relevant,
      role_type: score.role_type,
      relevance_score: score.score,
      rank_within_company: score.rank_within_company,
      reasoning: score.reasoning,
      rubric_scores: score.rubric,
      flags: score.flags || [],
      ranked_at: new Date().toISOString(),
    }));
    
    await supabase
      .from("leads")
      .upsert(rankedUpdates, { onConflict: "id" });
    
    // 10. Update job progress
    await supabase.rpc("increment_job_progress", {
      p_job_id: jobId,
      p_companies: 1,
      p_leads: leads.length,
    });
    
    const relevantCount = rankingResult.results.filter(r => r.is_relevant).length;
    
    metadata.set("relevantCount", relevantCount);
    metadata.set("llmLatencyMs", llmLatency);
    
    return {
      companyId,
      companyName: company.name,
      leadsRanked: leads.length,
      excludedByGate: excludedUpdates.length,
      rankedByLLM: candidates.length,
      relevantCount,
    };
  },
});

async function scrapeCompanyWebsite(domain: string): Promise<string> {
  const response = await fetch(`https://${domain}`, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; ThroxyScraper/1.0)" },
    signal: AbortSignal.timeout(5000),
  });
  
  const html = await response.text();
  const metaMatch = html.match(/<meta[^>]*name="description"[^>]*content="([^"]*)"/) ||
                    html.match(/<meta[^>]*content="([^"]*)"[^>]*name="description"/);
  
  return metaMatch ? metaMatch[1].slice(0, 500) : "";
}
```

---

## 9. Real-Time Progress (Supabase Realtime)

```typescript
// hooks/useJobProgress.ts

"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface JobProgress {
  id: string;
  status: string;
  total_companies: number;
  processed_companies: number;
  total_leads: number;
  processed_leads: number;
}

export function useJobProgress(jobId: string | null) {
  const [progress, setProgress] = useState<JobProgress | null>(null);

  useEffect(() => {
    if (!jobId) return;

    // Initial fetch
    supabase
      .from("ranking_jobs")
      .select("*")
      .eq("id", jobId)
      .single()
      .then(({ data }) => {
        if (data) setProgress(data);
      });

    // Subscribe to realtime updates
    const channel = supabase
      .channel(`job-${jobId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "ranking_jobs",
          filter: `id=eq.${jobId}`,
        },
        (payload) => {
          setProgress(payload.new as JobProgress);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [jobId]);

  return progress;
}
```

```tsx
// components/ranking-progress.tsx

"use client";

import { useJobProgress } from "@/hooks/useJobProgress";
import { Progress } from "@/components/ui/progress";

export function RankingProgress({ jobId }: { jobId: string }) {
  const progress = useJobProgress(jobId);

  if (!progress || progress.status !== "running") return null;

  const percent = progress.total_companies > 0
    ? (progress.processed_companies / progress.total_companies) * 100
    : 0;

  return (
    <div className="p-4 border rounded-lg space-y-2">
      <div className="flex justify-between text-sm">
        <span>Ranking in progress...</span>
        <span>
          {progress.processed_companies} / {progress.total_companies} companies
        </span>
      </div>
      <Progress value={percent} />
      <p className="text-xs text-muted-foreground">
        {progress.processed_leads} / {progress.total_leads} leads processed
      </p>
    </div>
  );
}
```

---

## 10. Prompt Optimization (ProTeGi/APO)

```typescript
// lib/optimization/metrics.ts

export interface EvalLead {
  id: string;
  fullName: string;
  title: string;
  company: string;
  employeeRange: string;
  groundTruthRank: number | null; // null = irrelevant
}

export interface Metrics {
  precision: number;
  recall: number;
  f1: number;
  ndcgAt3: number;
  composite: number;
  falsePositives: EvalLead[];
  falseNegatives: EvalLead[];
}

export function computeMetrics(
  predictions: Map<string, { is_relevant: boolean; rank: number | null }>,
  groundTruth: EvalLead[]
): Metrics {
  let tp = 0, fp = 0, fn = 0;
  const falsePositives: EvalLead[] = [];
  const falseNegatives: EvalLead[] = [];
  
  for (const truth of groundTruth) {
    const pred = predictions.get(truth.id);
    if (!pred) continue;
    
    const actualRelevant = truth.groundTruthRank !== null;
    const predictedRelevant = pred.is_relevant;
    
    if (predictedRelevant && actualRelevant) tp++;
    else if (predictedRelevant && !actualRelevant) {
      fp++;
      falsePositives.push(truth);
    }
    else if (!predictedRelevant && actualRelevant) {
      fn++;
      falseNegatives.push(truth);
    }
  }
  
  const precision = tp / (tp + fp) || 0;
  const recall = tp / (tp + fn) || 0;
  const f1 = 2 * precision * recall / (precision + recall) || 0;
  
  const ndcgAt3 = computeAverageNDCG(predictions, groundTruth, 3);
  const composite = 0.6 * f1 + 0.4 * ndcgAt3;
  
  return { precision, recall, f1, ndcgAt3, composite, falsePositives, falseNegatives };
}

function computeAverageNDCG(
  predictions: Map<string, { is_relevant: boolean; rank: number | null }>,
  groundTruth: EvalLead[],
  k: number
): number {
  // Group by company
  const byCompany = new Map<string, EvalLead[]>();
  for (const lead of groundTruth) {
    const list = byCompany.get(lead.company) || [];
    list.push(lead);
    byCompany.set(lead.company, list);
  }
  
  let totalNdcg = 0;
  let count = 0;
  
  for (const [, leads] of byCompany) {
    const rankedLeads = leads.filter(l => l.groundTruthRank !== null);
    if (rankedLeads.length === 0) continue;
    
    // Get predictions sorted by rank
    const preds = leads
      .map(l => ({ lead: l, pred: predictions.get(l.id) }))
      .filter(x => x.pred?.is_relevant && x.pred.rank !== null)
      .sort((a, b) => a.pred!.rank! - b.pred!.rank!);
    
    const maxRank = Math.max(...rankedLeads.map(l => l.groundTruthRank!));
    const relevanceOf = (lead: EvalLead) =>
      lead.groundTruthRank !== null ? maxRank - lead.groundTruthRank + 1 : 0;
    
    let dcg = 0;
    for (let i = 0; i < Math.min(k, preds.length); i++) {
      dcg += relevanceOf(preds[i].lead) / Math.log2(i + 2);
    }
    
    const idealOrder = leads.map(l => relevanceOf(l)).sort((a, b) => b - a);
    let idcg = 0;
    for (let i = 0; i < Math.min(k, idealOrder.length); i++) {
      idcg += idealOrder[i] / Math.log2(i + 2);
    }
    
    if (idcg > 0) {
      totalNdcg += dcg / idcg;
      count++;
    }
  }
  
  return count > 0 ? totalNdcg / count : 0;
}
```

---

## 11. File Structure

```
src/
├── app/
│   ├── page.tsx                    # Main dashboard
│   ├── layout.tsx
│   ├── api/
│   │   ├── upload/route.ts         # CSV upload endpoint
│   │   ├── jobs/[id]/route.ts      # Job status
│   │   └── export/route.ts         # CSV export
│   └── optimization/
│       └── page.tsx                # Prompt optimization UI
├── components/
│   ├── leads-table.tsx             # TanStack Table with sorting
│   ├── upload-form.tsx             # CSV upload UI
│   ├── ranking-progress.tsx        # Supabase Realtime progress
│   ├── cost-stats.tsx              # Usage tracking display
│   └── export-dialog.tsx           # Export top N dialog
├── hooks/
│   └── useJobProgress.ts           # Supabase Realtime hook
├── lib/
│   ├── ai/
│   │   └── client.ts               # Groq client + utilities
│   ├── db/
│   │   ├── client.ts               # Supabase client
│   │   └── queries.ts              # Data fetching
│   ├── ranking/
│   │   ├── prompt.ts               # Prompt templates
│   │   └── prefilter.ts            # Deterministic gate
│   ├── normalization/
│   │   ├── company.ts              # Canonical key
│   │   ├── size.ts                 # Size bucket mapping
│   │   └── title.ts                # Title cleanup
│   └── optimization/
│       ├── metrics.ts              # F1, NDCG calculations
│       └── gradient.ts             # Text gradient generation
└── trigger/
    ├── rank-company.ts             # Per-company ranking task
    └── optimize-prompt.ts          # Optimization task
```

---

## 12. Bonus Features Summary

| Bonus | Status | Implementation |
|-------|--------|----------------|
| 🟢 Track cost per AI call | ✅ | `ai_calls` table with tokens/latency, estimated cost |
| 🟢 Sortable table by rank | ✅ | TanStack Table with column sorting |
| 🟢 Export top N per company | ✅ | `ExportDialog` with CSV download |
| 🟡 CSV upload UI | ✅ | `UploadForm` component |
| 🟡 Real-time progress | ✅ | **Supabase Realtime** on `ranking_jobs` |
| 🔴 Auto prompt optimization | ✅ | ProTeGi/APO with text gradients |
| ❓ Multi-thread Coverage | ✅ | Company-level "campaign readiness" |

---

## 13. Execution Checklist

- [ ] Set up Supabase project, run schema (including Realtime publication)
- [ ] Configure Trigger.dev v3 project
- [ ] Set environment variables (GROQ_API_KEY, GROQ_MODEL, etc.)
- [ ] Implement CSV parsing with canonical_key generation
- [ ] Build size-aware deterministic pre-filter
- [ ] Create ranking prompt with object wrapper schema
- [ ] Implement `rank-company` task with batch writes
- [ ] Build frontend with Supabase Realtime progress
- [ ] Add usage tracking (tokens/latency, estimated cost)
- [ ] Implement CSV export
- [ ] (If time) Run prompt optimization on eval set
- [ ] Deploy to Vercel
- [ ] Test full flow end-to-end
- [ ] Write README with decisions

---

## 14. README Template

```markdown
# Throxy Persona Ranker

Live Demo: [Vercel URL]

## Quick Start

\`\`\`bash
git clone [repo]
cd throxy-ranker
pnpm install
cp .env.example .env.local
# Add: SUPABASE_URL, SUPABASE_KEY, GROQ_API_KEY, GROQ_MODEL, TRIGGER_SECRET_KEY
pnpm db:push
pnpm db:seed  # Load leads.csv
pnpm dev
\`\`\`

## Architecture

### Core Pattern: Async Agent with Trigger.dev v3

1. User uploads CSV → Next.js parses → Supabase
2. `batchTrigger("rank-company")` for each company
3. Per-company: normalize → scout (optional) → LLM rank → batch persist
4. Frontend subscribes via **Supabase Realtime** for progress

### LLM Provider

Using **Groq** with `llama-3.3-70b-versatile` for fast inference.

### Key Design Decisions

1. **Company-batched ranking** — Enables relative comparison; LLM outputs explicit ranks
2. **Size-aware deterministic gate** — Only hard-exclude HR/Finance/Legal; CTO allowed at startups
3. **Object wrapper schema** — `{ results: [...] }` for response_format compatibility
4. **Batch DB writes** — Upserts instead of per-lead updates
5. **Supabase Realtime** — Correct hook for progress (not Trigger run IDs)

### Eval Set Insights

Based on inspection of `eval_set.csv`:
- SDRs ARE ranked (#5-6) at SMB companies
- Marketing VPs can be #2 priority
- CEOs marked irrelevant at Mid-Market+
- "President GTM" is relevant (GTM context exception)

## Bonuses Completed

- ✅ Usage tracking (tokens/latency, estimated cost)
- ✅ Sortable table (rank, score, company, role)
- ✅ Export top N per company to CSV
- ✅ CSV upload with ranking UI
- ✅ Real-time progress (Supabase Realtime)
- ✅ Automatic prompt optimization (ProTeGi/APO)
- ✅ Multi-thread coverage score
\`\`\`
```Also. 🚫 Before doing read this. ) upsert(..., { onConflict: "id" }) won’t update unless id is unique

In Postgres, ON CONFLICT(id) requires a unique constraint or primary key on id. You have id as the primary key, so that part is fine — but Supabase upsert semantics can still bite you:

You’re “upserting” partial objects (only some columns). That’s OK, but make sure you’re not unintentionally overwriting fields with null/undefined defaults.

In particular: title_normalized for candidates is never persisted unless you write it. Right now you only store it in-memory for filtering/prompting.

Fix: include title_normalized in a batch update, or compute it in DB (generated column), or accept it as derived-only and remove it from schema.

3) Groq response_format: { type: "json_object" } compatibility

Your wrapper schema { results: [...] } is correct, but Groq’s OpenAI-compatible endpoint doesn’t always guarantee strict JSON the way OpenAI “JSON mode” does (provider-dependent).

Fix (best):

Keep response_format: { type: "json_object" }

Add hard prompt constraints (“Return ONLY JSON. No markdown.” already there)

Add a validation step after parsing:

Array.isArray(results)

each id exists in candidate set

ranks are unique/contiguous for relevant leads

score bounds 0–100
If validation fails → retry once with a “You returned invalid JSON / invalid schema; fix” repair prompt.

4) Realtime publication requires correct project config

ALTER PUBLICATION supabase_realtime ADD TABLE ranking_jobs; works only if:

you’re on a Postgres version / Supabase plan where this is allowed

RLS and replication settings permit it

Fix: Ensure:

RLS policy for reading ranking_jobs exists for the client (anon key), or your realtime subscription will silently receive nothing.

Or fetch progress server-side and push to client (but you already committed to realtime).

⚠️ Strong recommendations (not blockers, but worth fixing)
A) Deterministic exclusions: CFO caveat

You wrote “Finance… but not CFO at tiny startups” in prose, but your hard exclusion patterns include finance/accounting and don’t special-case CFO.

Fix: add:

If startup and title matches \bCFO|chief financial officer\b, don’t auto-exclude (send to LLM), or explicitly include CFO as “secondary decision maker” at startups.

B) normalizeSizeBucket() should lower-case and trim

Your size mapping uses exact strings and won’t match variants like " 11-50 " or "11–50" (en dash), or "1 - 10".

Fix: normalise aggressively: trim, replace en-dash with hyphen, remove spaces.

C) Ranking prompt: “rank all candidates” + “rank_within_company null for irrelevant”

Good, but add explicit rule:

ranks must be unique and start at 1

if two leads tie, break using seniority / owning outbound / sales dev closeness

D) Company canonical_key unique constraint can fail ingestion

If you upload multiple CSVs with overlapping companies, UNIQUE(canonical_key) will throw unless you “upsert companies by canonical_key”.

Fix: ingestion flow should:

upsert companies on canonical_key

then insert leads with returned company_id

E) Realtime progress: status transitions

Your UI shows progress only if status === "running", but your worker never sets status to running/completed in the shown task.

Fix: in the batch trigger orchestration:

set job.status = running when tasks start

set completed when processed_companies == total_companies (or on “batch complete” callback)