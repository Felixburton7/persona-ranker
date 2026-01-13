# Best Practices for Maintainable Scalable Architectures
## (React, Next.js, Supabase, TypeScript)

This guide outlines industry standards to move from a "rushed MVP" to a high-quality, maintainable production codebase.

---

## 1. Core Principles (The "Clean Code" Basics)
*   **Single Responsibility Principle (SRP):** Each file, function, and component should do *one* thing well.
    *   *Bad:* A Table component that fetches data, formats dates, calculates scores, *and* renders HTML.
    *   *Good:* A `LeadsTable` that only renders. A `useLeads` hook that fetches. A `formatDate` utility.
*   **DRY (Don't Repeat Yourself):** Extract repeated logic into utilities or hooks.
*   **Separation of Concerns:** Keep Business Logic (how things work) separate from UI (how things look).

## 2. React & Next.js 15+ Best Practices
*   **Server Components by Default:** Minimize client-side JavaScript. Fetch data in Server Components; pass it down to Client Components only for interactivity (onClick, useState).
*   **Component Atomicity:**
    *   Break components down. If a component is > 150 lines, it's likely too big.
    *   Directory structure: `src/components/feature-name/` keeps related sub-components together.
*   **Custom Hooks for Logic:**
    *   Never write complex `useEffect` or data transformation logic inside the JSX component. Move it to a custom hook (e.g., `useLeadRanking`).
*   **Zod for Validation:** Validate *all* inputs (API requests, form data) using Zod schemas.

## 3. TypeScript Standards
*   **No `any`:** `any` defeats the purpose of TypeScript. Use strict typing.
*   **Shared Types:** Define core domain types (like `Lead`, `Company`) in a central `src/types` folder. Do not define types inside components.
*   **Discriminated Unions:** Use them for state management (e.g., `type State = { status: 'loading' } | { status: 'success', data: Data }`).

## 4. Error Handling
*   **Custom Error Types:** Create typed errors for different failure modes (`ValidationError`, `NotFoundError`, `DatabaseError`).
    *   Located in: `core/errors.ts`
*   **Standardized API Responses:** Use consistent response helpers (`success()`, `error()`) and wrap handlers with `withErrorHandler()`.
    *   Located in: `core/api-response.ts`
*   **Error Codes:** Return machine-readable error codes (`VALIDATION_ERROR`, `NOT_FOUND`) alongside human messages.

## 5. Service Layer Architecture
*   **Decouple Database from Business Logic:** Never call `supabase.from('...')` directly in components or hooks.
*   **Service Functions:** Create typed service functions in `services/`:
    *   `getLeadsByJobId(jobId)` - Returns typed `Lead[]`
    *   `updateLeadRanking(leadId, data)` - Updates with validation
*   **Benefits:**
    *   Easy to test (mock the service, not Supabase)
    *   Single source of truth for data access patterns
    *   Changes to DB schema only require updates in one place

## 6. Supabase & Database
*   **Type Generation:** Always auto-generate TypeScript types from your Supabase schema.
*   **Row Level Security (RLS):** Never trust the client. Security lives in database policies.
*   **Error Wrapping:** Wrap Supabase errors in custom `DatabaseError` for consistent handling.

## 7. CSS / Tailwind
*   **Utility First, but Semantic:** Use `shadcn/ui` components for consistency.
*   **Avoid "Magic Values":** Don't use arbitrary pixels (e.g., `w-[367px]`). Use standard Tailwind spacing.
*   **ClassName Utility:** Use `clsx` or `tailwind-merge` to cleanly combine classes.

## 8. Project "Hygiene"
*   **No Dead Code:** Delete commented-out code immediately. Git history is for remembering old code.
*   **Consistent Logging:** Replace scattered `console.log` with a centralized approach.
*   **Standardized Formatting:** Rely on Prettier and ESLint to enforce style.

---

## Project Structure

```
src/
├── app/                        # Next.js App Router
│   ├── api/                   # API routes
│   │   ├── export/
│   │   ├── optimization/
│   │   ├── prompts/
│   │   ├── settings/
│   │   └── upload/
│   ├── contact/
│   ├── docs/
│   ├── optimization/
│   └── page.tsx
│
├── components/                 # UI Components
│   ├── ui/                    # Primitives (button, input, icons)
│   ├── leads/                 # Lead feature components
│   ├── optimization/          # Optimization feature components
│   ├── scout/                 # Scout feature components
│   ├── upload/                # Upload feature components
│   ├── leads-table.tsx
│   ├── ranking-progress.tsx
│   └── upload-form.tsx
│
├── hooks/                      # Custom React Hooks
│   ├── index.ts               # Re-exports
│   ├── leads/
│   │   └── useLeads.ts
│   └── ranking/
│       ├── useJobProgress.ts
│       ├── useRealtimeCost.ts
│       └── useRunningCommentary.ts
│
├── types/                      # TypeScript Definitions
│   ├── index.ts               # Re-exports
│   ├── leads.ts               # Lead, RoleType, RubricScores
│   ├── jobs.ts                # JobProgress, RankingJob
│   ├── optimization.ts        # OptimizationRun, PromptVersion
│   ├── ranking.ts             # LLMResult, LLMResponse
│   └── ai.ts                  # SessionKeys
│
├── core/                       # App Infrastructure (plumbing)
│   ├── db/
│   │   └── client.ts          # Supabase client
│   ├── errors.ts              # Custom error types
│   ├── api-response.ts        # API response helpers
│   ├── leads-styling.ts       # UI styling utilities
│   └── utils.ts               # Pure utilities (cn, etc)
│
├── config/                     # Static Configuration
│   └── constants.ts           # Models, settings
│
├── services/                   # Data Access Layer (DB operations)
│   ├── index.ts               # Re-exports
│   ├── leads.ts
│   ├── jobs.ts
│   ├── companies.ts
│   └── api-keys.ts
│
├── features/                   # Business Logic by Domain
│   ├── ranking/               # Lead ranking
│   │   ├── prefilter.ts
│   │   ├── prompt.ts
│   │   ├── rules.ts
│   │   └── utils.ts
│   ├── ingestion/             # CSV processing
│   │   ├── index.ts
│   │   └── normalization/
│   │       ├── company.ts
│   │       ├── size.ts
│   │       └── title.ts
│   ├── optimization/          # Prompt optimization
│   │   ├── eval-set.ts
│   │   ├── gradient.ts
│   │   └── metrics.ts
│   ├── scout/                 # Company scouting
│   │   └── index.ts
│   └── ai/                    # AI client & providers
│       └── client.ts
│
└── jobs/                       # Background Tasks (Trigger.dev)
    ├── rank-company.ts
    ├── company-scout.ts
    └── optimize-prompt.ts
```

---

## Folder Purpose Quick Reference

| Folder | Purpose | Mental Model |
|--------|---------|--------------|
| `app/` | Pages and API routes | "What URLs exist?" |
| `components/` | React components | "What can I see?" |
| `hooks/` | Custom React hooks | "What state logic can I reuse?" |
| `types/` | TypeScript definitions | "What are the data shapes?" |
| `core/` | Infrastructure plumbing | "Things the app needs to run" |
| `config/` | Static settings | "What can I configure?" |
| `services/` | Database operations | "How do I talk to the DB?" |
| `features/` | Business logic | "What does the app do?" |
| `jobs/` | Background tasks | "What runs asynchronously?" |

---

## Import Patterns

```typescript
// Types
import { Lead, JobProgress } from '@/types';

// Services  
import { getLeadsByJobId, sortLeads } from '@/services';

// Hooks
import { useLeads, useJobProgress } from '@/hooks';

// UI Components
import { Button, Card } from '@/components/ui/button';
import { GeminiIcon, GroqIcon } from '@/components/ui/icons';

// Core Infrastructure
import { ValidationError, DatabaseError } from '@/core/errors';
import { success, error, withErrorHandler } from '@/core/api-response';
import { supabase } from '@/core/db/client';

// Config
import { SUPPORTED_MODELS } from '@/config/constants';

// Features
import { prefilterLead } from '@/features/ranking/prefilter';
import { completionWithRetry } from '@/features/ai/client';
```
