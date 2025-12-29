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

## Architecture

### Core Pattern: Async Agent with Trigger.dev v3

1. User uploads CSV → Next.js parses → Supabase
2. `batchTrigger("rank-company")` for each company
3. Per-company: normalize → scout (optional) → LLM rank → batch persist
4. Frontend subscribes via **Supabase Realtime** for progress

### LLM Provider

Using **Groq** with **intelligent multi-model selection**:

- **Large companies (100+ leads)**: `openai/gpt-oss-120b` (120B params)
- **Medium-large (50-100)**: `llama-3.3-70b-versatile` (70B params)
- **Medium (20-50)**: `qwen/qwen3-32b` (32B params)
- **Small (<20)**: `llama-3.1-8b-instant` (8B params, ultra-fast)

**Automatic fallback chain**: If a model hits rate limits (429) or payload size limits (413), the system automatically rotates through 8 different models to ensure completion.

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
