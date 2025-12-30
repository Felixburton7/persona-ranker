# Throxy Persona Ranker

> **Live Demo:** [persona-ranker-five.vercel.app](https://persona-ranker-five.vercel.app)  
> **Documentation:** [persona-ranker-five.vercel.app/docs](https://persona-ranker-five.vercel.app/docs)

**Persona Ranker** is an intelligent system for ranking B2B sales leads against an Ideal Customer Profile (ICP). It automates the decision-making process of a human researcher, deciding who is a "Decision Maker," "Champion," or "Irrelevant" contact based on their title and company size.

It is built to be **high-precision** (using LLMs for reasoning) but **cost-effective** (using deterministic pre-filters to reduce token usage).

![Next.js](https://img.shields.io/badge/Next.js-black?style=for-the-badge&logo=next.js&logoColor=white) ![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white) ![Trigger.dev](https://img.shields.io/badge/Trigger.dev-4F46E5?style=for-the-badge&logo=trigger.dev&logoColor=white)

---

## 📂 Project Structure Guide

This project is organized to separate **business logic** (how we rank) from **orchestration** (running the jobs) and **presentation** (showing not tell).

### 1. The Brain: Ranking Logic (`src/lib/ranking`)
This directory contains the core intelligence of the system.
- **`src/lib/ranking/prefilter.ts`**: **The Guardrails.** A deterministic rule engine that runs *before* any LLM call.
  - **Role:** Filters out obvious mismatches (e.g., Interns, HR, Support) using Regex.
  - **Size Awareness:** Applies logic like "Exclude CEOs at Enterprise companies" but "Keep CEOs at Startups."
  - **Benefit:** Saves ~40% of LLM costs by removing clear non-fits immediately.
- **`src/lib/ranking/prompt.ts`**: **The Context Builder.** Dynamically constructs the prompt sent to the LLM.
  - **Dynamic Rubrics:** Injects different scoring instructions based on company size (e.g., "Prioritize Founders" for Startups vs. "Prioritize VPs" for Enterprise).
  - **Safety:** Maps candidates to short integer IDs (1, 2, 3...) to preventing the LLM from hallucinating UUIDs.
  - **Token Efficiency:** Formats data to be concise.

### 2. The Muscle: Orchestration (`src/trigger`)
We use [Trigger.dev](https://trigger.dev) for durable, long-running background jobs that won't timeout like serverless functions.
- **`src/trigger/rank-company.ts`**: **The Worker.** The main workflow that orchestrates the pipeline:
  1. Validates & Normalizes inputs.
  2. Runs the `prefilter` to drop leads.
  3. Batches remaining leads and generates the `prompt`.
  4. Calls the LLM (Gemini/Groq) to rank the batch.
  5. Saves results to Supabase.
- **`src/trigger/optimize-prompt.ts`**: **The Improver.** An autonomous agent that runs the ranking against a "Golden Set" (`eval_set.csv`) to measure accuracy and iteratively improve the system's prompts.
- **`src/trigger/company-scout.ts`**: **The Scout.** Fetches external data to enrich company profiles before ranking.

### 3. The Face: User Interface (`src/app`)
A Next.js App Router application.
- **`src/app/page.tsx`**: Main upload and dashboard view.
- **`src/app/optimization/page.tsx`**: Interface for the prompt optimization agent.
- **`src/lib/ai/client.ts`**: Centralized configuration for AI models (Gemini, Groq) with failover/retry logic.

---

## ⚡ The Ranking Pipeline

How a lead travels from CSV to Ranked Result:

```mermaid
flowchart TD
    A[Raw CSV Lead] -->|Normalize Title| B(Cleaned Lead)
    B --> C{Prefilter Check}
    C -->|Match Exclude Rule| D[Discard (Irrelevant)]
    C -->|Pass| E[Candidate Pool]
    E --> F[Prompt Builder]
    F -->|Inject Company Size Rules| G[LLM Input]
    G --> H[LLM Ranking Model]
    H --> I[Structured JSON Output]
    I --> J[(Supabase DB)]
```

---

## 🚀 Quick Start

1. **Clone & Install**
   ```bash
   git clone [repo]
   cd persona-ranker
   npm install
   ```

2. **Environment Setup**
   Copy the example env file and fill in your keys (Supabase, Trigger.dev, Gemini/Groq).
   ```bash
   cp .env.example .env.local
   ```

3. **Run Locally**
   Start the dev server.
   ```bash
   npm run dev
   ```

4. **Trigger Development**
   In a separate terminal, forward the Trigger.dev worker to your local machine.
   ```bash
   npx trigger.dev@latest dev
   ```

---

## 🏗️ Architecture Decisions

1.  **Company-Centric Ranking**: We rank leads in the context of their *Company*. A "VP of Sales" means something very different at a 10-person startup vs. a 10,000-person corporation. The system handles this distinction natively.
2.  **Hybrid Filtering**: We don't send everyone to the LLM. The `prefilter.ts` layer acts as a cheap, fast sieve, ensuring we only spend money / compute on leads that are at least plausible.
3.  **Durable Execution**: Ranking 1,000 leads takes time. Trigger.dev ensures that if the API hangs or the process takes 5 minutes, it doesn't crash the UI or timeout the request.

For a deeper dive into the methodology, check out the **[Architecture Docs](https://persona-ranker-five.vercel.app/docs)**.
