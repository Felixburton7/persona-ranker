# Throxy Persona Ranker

> **"The autonomous AI agent that ranks your sales leads so you don't have to."**

![Next.js](https://img.shields.io/badge/Next.js-black?style=for-the-badge&logo=next.js&logoColor=white) 
![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white) 
![Trigger.dev](https://img.shields.io/badge/Trigger.dev-4F46E5?style=for-the-badge&logo=trigger.dev&logoColor=white) 
![Gemini](https://img.shields.io/badge/Gemini-8E75B2?style=for-the-badge&logo=googlebard&logoColor=white)

---

## 🚀 Live Demo & Docs

- **Live Application:** [persona-ranker-five.vercel.app](https://persona-ranker-five.vercel.app)
- **Architecture Docs:** [persona-ranker-five.vercel.app/docs](https://persona-ranker-five.vercel.app/docs)

---

## 📖 About The Project

Persona Ranker is a high-performance system designed to solve the "Lead Qualification" problem at scale. Instead of relying on manual review or simple keyword matching, it uses **Large Language Models (LLMs)** to reason about a prospect's fit for your product.

It ingests CSVs, normalizes company data, gathers web intelligence, and forces a **comparative ranking** of employees within each company to identify the true decision-makers.

### ✨ Key Features
- **Company-Centric Ranking**: Ranks leads *within* the context of their company organization.
- **Deterministic Pre-Filtering**: "Hard" gates for obviously bad leads (Interns, HR, Legal) to save costs.
- **Scout Agent**: Autonomously scrapes company websites for signals (funding, hiring, GTM strategy).
- **Auto-Optimizing Prompts**: The system self-improves its ranking prompts using the ProTeGi algorithm.
- **Real-Time UI**: Watch the agents work live via Supabase Realtime.

---

## 🏗️ Clean Architecture

This project follows a strict separation of concerns, ensuring scalable and maintainable code. The logical flow moves from **Infrastructure (Trigger.dev)** -> **Domain Logic (Lib)** -> **Presentation (Next.js)**.

```mermaid
graph TD
    UI[Presentation Layer (src/app)] --> Domain[Domain Layer (src/lib)]
    Jobs[Infrastructure Layer (src/trigger)] --> Domain
    Domain --> DB[(Supabase)]
    Domain --> AI[LLM Providers]
```

### Folder Structure Explained

| Layer | Directory | Responsibility |
|-------|-----------|----------------|
| **Presentation** | `src/app/` | **Next.js 15 App Router**. Handles UI state, Realtime subscriptions, and user interaction. Strictly for display logic. |
| **Infrastructure** | `src/trigger/` | **Orchestration**. Contains the "Agents" that run in the background (long-running jobs). They leverage the Domain layer to execute tasks. |
| **Domain** | `src/lib/` | **Core Business Logic**. Pure functions and services. <br>• `ranking/`: The brain of the comparison logic.<br>• `normalization/`: Data cleaning rules.<br>• `optimization/`: Prompt improvement algorithms.<br>• `scout/`: Intelligence gathering services. |
| **Data** | `schema.sql` | **Persistence**. Postgres schema defining the relational structure of Companies, Leads, and Rank Runs. |

This structure ensures that the **ranking logic** (`src/lib/ranking`) is decoupled from the **execution method** (`src/trigger` or API route), making it easy to test and iterate.

---

## 🧩 How It Works

1. **Ingestion**: Upload a CSV. The system deduplicates companies using a canonical key.
2. **Pre-filtering**: A fast, cheap rules-engine filters out 30-50% of irrelevant leads (e.g., "Intern at EnterpriseCompany").
3. **Scouting**: The **Scout Agent** visits company websites to gather context (Size, Industry, Recent News).
4. **Ranking**: The **Ranking Agent** (Gemini/Groq) compares remaining leads *head-to-head* to determine the best "Champion" and "Decision Maker".
5. **Optimization**: (Optional) The **Optimization Agent** critiques the ranking results against a ground-truth set and rewrites the prompt to improve accuracy.

---

## 🛠️ Quick Start

### Prerequisites
- Node.js 18+
- Supabase Project
- Trigger.dev Account
- Google Gemini or Groq API Key

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/Felixburton7/persona-ranker.git
cd persona-ranker

# 2. Install dependencies
npm install

# 3. Environment Setup
cp .env.example .env.local
# Fill in:
# - NEXT_PUBLIC_SUPABASE_URL & ANON_KEY
# - SUPABASE_SERVICE_ROLE_KEY
# - TRIGGER_SECRET_KEY
# - GEMINI_API_KEY (or GROQ_API_KEY)

# 4. Run Development Server
npm run dev

# 5. Start Trigger.dev CLI (in separate terminal)
npx trigger.dev@latest dev
```

---

## ⚡ Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Database**: Supabase (PostgreSQL) + Realtime
- **Orchestration**: Trigger.dev v3
- **AI Models**: Google Gemini 1.5 Flash (Default) / Groq Llama 3
- **Styling**: TailwindCSS + ShadCN/UI
- **Language**: TypeScript (Strict)

---

## ⚖️ Tradeoffs & Decisions

| Decision | Rationale |
|----------|-----------|
| **Forced Ranking** | We force the LLM to rank 1, 2, 3 instead of giving scores (8/10). This prevents score inflation and forces trade-offs. |
| **Background Jobs** | Vercel functions timeout after 60s. Ranking 1000 leads takes minutes. We use **Trigger.dev** for durable, long-running execution. |
| **Batch Updates** | To handle high throughput, we upsert data to Supabase in batches rather than row-by-row, reducing network overhead by 10x. |

---

*Built for the [High-Signal.io](https://high-signal.io) Technical Challenge.*
