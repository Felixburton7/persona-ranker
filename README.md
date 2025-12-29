# Throxy Persona Ranker

Live Demo: [Vercel URL]

## Quick Start

```bash
git clone [repo]
cd throxy-ranker
pnpm install
cp .env.example .env.local
# Add: SUPABASE_URL, SUPABASE_KEY, GROQ_API_KEY, GROQ_MODEL, TRIGGER_SECRET_KEY
pnpm db:push
pnpm db:seed  # Load leads.csv
pnpm dev
```

## How It Was Built

Given a list of contacts at companies, we needed to find the best people to reach out to. Here's how we built it.

### The Problem

When you have hundreds or thousands of leads across dozens of companies, manually identifying the right decision-makers is impossible. We needed an AI system that could:
- Understand company context (size, industry, structure)
- Rank contacts by buying intent and decision-making authority
- Handle edge cases (startups vs enterprises, GTM roles, etc.)
- Provide real-time progress as it processes thousands of leads
- Continuously improve its ranking accuracy

### The Architecture

We built an **async agent system** using Trigger.dev v3 for background processing, Next.js for the frontend, and Supabase for data persistence and real-time updates.

**The Flow:**
1. **CSV Upload** → Next.js parses and normalizes company data
2. **Company Grouping** → Leads are grouped by canonical company key (domain-based deduplication)
3. **Batch Triggering** → Each company gets its own async task via `batchTrigger("rank-company")`
4. **Per-Company Processing** → Normalize titles → Pre-filter exclusions → LLM ranking → Batch persist
5. **Real-Time Updates** → Frontend subscribes to Supabase Realtime for live progress

### Key Technical Decisions

#### 1. Company-Batched Ranking

Instead of ranking leads individually, we rank all leads **within a company together**. This enables the LLM to make relative comparisons ("VP Sales is more relevant than SDR Manager") and output explicit ranks. The prompt uses short numeric IDs (1, 2, 3...) instead of UUIDs to prevent LLM hallucination, then we map them back to real database IDs.

#### 2. Size-Aware Pre-Filtering

Before hitting the LLM, we apply deterministic rules based on company size:
- **Hard exclusions** (all sizes): HR, Finance, Legal, Customer Support, Investors, Interns
- **Size-dependent rules**: CEOs are excluded at mid-market+ companies (too removed), but relevant at startups
- **GTM exceptions**: "President GTM" or "VP Sales" bypass size restrictions

This reduces LLM costs and improves accuracy by filtering obvious non-buyers upfront.

#### 3. Batch Processing with Rate Limit Handling

Leads are processed in batches of 15 to stay within context limits. If a model hits rate limits (429), the system automatically falls back to alternative models. Each batch is saved immediately so partial progress isn't lost.

#### 4. Supabase Realtime (Not Trigger Run IDs)

We use Supabase Realtime subscriptions to track progress, not Trigger.dev run IDs. This gives us:
- Live updates as leads are ranked
- Real-time cost tracking
- Progress bars that update smoothly
- Better UX than polling

#### 5. Object Wrapper Schema

LLM responses use `{ results: [...] }` wrapper to ensure JSON mode compatibility across providers (Gemini, Groq, OpenAI).

### The LLM Strategy

**Default**: Gemini Flash 2.5 for high-quality, cost-effective ranking
**Fallback**: Groq with model rotation (llama-3.3-70b for large companies, llama-3.1-8b-instant for speed)

The system automatically selects models based on:
- Company size (larger = more capable model)
- Rate limit status
- User preferences (can override via API keys)

### Company Scout Feature

After ranking completes, an optional "Company Scout" task:
1. Scrapes the company website (using Cheerio)
2. Generates a company summary using LLM
3. Creates personalized email drafts for top-ranked leads

This demonstrates how ranking results can feed into downstream sales workflows.

### Automatic Prompt Optimization

We implemented **Textual Gradient Descent** (inspired by ProTeGi/APO):
1. **Evaluate** → Run current prompt on 50+ test leads with ground truth ranks
2. **Analyze** → Identify false positives, false negatives, ranking mismatches
3. **Generate Gradient** → LLM analyzes error patterns and suggests improvements
4. **Apply Edits** → LLM rewrites prompt instructions to fix specific failures
5. **Iterate** → Repeat until metrics (F1, NDCG@3) converge

The optimization UI shows live progress, gradient analysis, and prompt diffs between versions.

### Database Schema

- **Companies**: Normalized with canonical keys (domain-based)
- **Leads**: Full contact info + ranking results (score, rank, reasoning)
- **Ranking Jobs**: Tracks batch progress (companies/leads processed)
- **AI Calls**: Usage tracking (tokens, cost, latency) for every LLM call
- **Prompt Versions**: Version history for optimization runs

### Real-Time Progress Tracking

The frontend uses custom React hooks (`useJobProgress`, `useRealtimeCost`) that subscribe to Supabase Realtime channels. As leads are ranked, the UI updates:
- Progress bars (companies and leads)
- Cost ticker (cumulative API costs)
- Live commentary (what the system is doing)
- Sortable table (ranks update as they're assigned)

### What Makes It Work

1. **Relative ranking within companies** → LLMs excel at comparison tasks
2. **Deterministic pre-filtering** → Reduces noise and costs
3. **Batch processing** → Handles large datasets without timeouts
4. **Graceful degradation** → Rate limit fallbacks ensure completion
5. **Real-time feedback** → Users see progress, not spinners

## Architecture

### Core Pattern: Async Agent with Trigger.dev v3

1. User uploads CSV → Next.js parses → Supabase
2. `batchTrigger("rank-company")` for each company
3. Per-company: normalize → scout (optional) → LLM rank → batch persist
4. Frontend subscribes via **Supabase Realtime** for progress

### LLM Provider

The system defaults to **Gemini Flash** for high-quality, cost-effective ranking. It also supports **Groq** for ultra-fast processing with a variety of models:

- **Large companies (100+ leads)**: `llama-3.3-70b-versatile` or `openai/gpt-oss-120b` (if available via Groq)
- **Small companies (<20)**: `llama-3.1-8b-instant` (ultra-fast)

**Automatic fallback chain**: If the primary model hits rate limits (429) or payload size limits (413), the system can rotate through available models to ensure completion.

Test model availability: `node test-models.mjs`

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
- ✅ Multi-thread Coverage
# persona-ranker
# persona-ranker
