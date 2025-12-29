-- =============================================================================
-- PERSONA RANKER - COMPLETE IDEMPOTENT SCHEMA
-- Safe to run multiple times - will not fail or duplicate anything
-- =============================================================================

-- 1. Create ENUMs (idempotent using DO blocks)
DO $$ BEGIN
    CREATE TYPE company_size AS ENUM ('startup', 'smb', 'mid_market', 'enterprise');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE role_classification AS ENUM ('decision_maker', 'champion', 'irrelevant');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE job_status AS ENUM ('pending', 'running', 'completed', 'failed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2. Companies table
CREATE TABLE IF NOT EXISTS companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  domain TEXT,
  canonical_key TEXT NOT NULL,
  employee_range TEXT,
  size_bucket company_size,
  industry TEXT,
  scraped_summary TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add unique constraint if not exists (check first)
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'companies_canonical_key_key'
    ) THEN
        ALTER TABLE companies ADD CONSTRAINT companies_canonical_key_key UNIQUE (canonical_key);
    END IF;
END $$;

-- 3. Prompt versions table (must come before ranking_jobs for FK)
CREATE TABLE IF NOT EXISTS prompt_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version INTEGER NOT NULL,
  prompt_text TEXT NOT NULL,
  is_active BOOLEAN DEFAULT FALSE,
  relevance_precision FLOAT,
  relevance_recall FLOAT,
  relevance_f1 FLOAT,
  ranking_ndcg_at_3 FLOAT,
  composite_score FLOAT,
  parent_version_id UUID REFERENCES prompt_versions(id),
  gradient_summary TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Ranking jobs table
CREATE TABLE IF NOT EXISTS ranking_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  status job_status DEFAULT 'pending',
  prompt_version_id UUID,
  total_companies INTEGER DEFAULT 0,
  processed_companies INTEGER DEFAULT 0,
  total_leads INTEGER DEFAULT 0,
  processed_leads INTEGER DEFAULT 0,
  trigger_batch_id TEXT,
  use_company_scout BOOLEAN DEFAULT FALSE,
  top_n_per_company INTEGER DEFAULT 3,
  preferred_model TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  error TEXT
);

-- Add preferred_model column if it doesn't exist
ALTER TABLE ranking_jobs ADD COLUMN IF NOT EXISTS preferred_model TEXT;

-- Add partial completion tracking columns (for rate limit exhaustion handling)
ALTER TABLE ranking_jobs ADD COLUMN IF NOT EXISTS partial_completion BOOLEAN DEFAULT FALSE;
ALTER TABLE ranking_jobs ADD COLUMN IF NOT EXISTS skipped_leads_count INTEGER DEFAULT 0;
ALTER TABLE ranking_jobs ADD COLUMN IF NOT EXISTS rate_limit_error TEXT;

-- Add FK constraint if not exists (check first)
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_ranking_jobs_prompt_version'
    ) THEN
        ALTER TABLE ranking_jobs ADD CONSTRAINT fk_ranking_jobs_prompt_version 
        FOREIGN KEY (prompt_version_id) REFERENCES prompt_versions(id);
    END IF;
END $$;

-- 5. Leads table
CREATE TABLE IF NOT EXISTS leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  first_name TEXT,
  last_name TEXT,
  title TEXT NOT NULL,
  linkedin_url TEXT,
  raw_json JSONB,
  title_normalized TEXT,
  is_relevant BOOLEAN,
  relevance_score INTEGER CHECK (relevance_score >= 0 AND relevance_score <= 100),
  rank_within_company INTEGER,
  role_type role_classification,
  reasoning TEXT,
  rubric_scores JSONB,
  flags TEXT[],
  excluded_by_gate BOOLEAN DEFAULT FALSE,
  exclusion_reason TEXT,
  ranked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  scout_data JSONB
);

-- Add full_name generated column if not exists
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'leads' AND column_name = 'full_name'
    ) THEN
        ALTER TABLE leads ADD COLUMN full_name TEXT GENERATED ALWAYS AS (
            TRIM(COALESCE(first_name, '') || ' ' || COALESCE(last_name, ''))
        ) STORED;
    END IF;
END $$;

-- Add scout_data column if not exists
ALTER TABLE leads ADD COLUMN IF NOT EXISTS scout_data JSONB;

-- 6. AI calls table
CREATE TABLE IF NOT EXISTS ai_calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES ranking_jobs(id),
  company_id UUID REFERENCES companies(id),
  call_type TEXT CHECK (call_type IN ('ranking', 'ranking_batch', 'enrichment', 'optimization', 'gradient', 'system_init', 'skipped_rate_limit', 'company_completion')),
  model TEXT NOT NULL,
  input_tokens INTEGER,
  output_tokens INTEGER,
  latency_ms INTEGER,
  estimated_cost_usd DECIMAL(10, 6),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Optimization runs table
CREATE TABLE IF NOT EXISTS optimization_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  status job_status DEFAULT 'pending',
  max_iterations INTEGER DEFAULT 5,
  iterations_completed INTEGER DEFAULT 0,
  best_prompt_id UUID REFERENCES prompt_versions(id),
  improvement_history JSONB,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add created_at column to optimization_runs if it doesn't exist (for existing tables)
ALTER TABLE optimization_runs ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE optimization_runs ADD COLUMN IF NOT EXISTS error_message TEXT;

-- 8. API Keys table
CREATE TABLE IF NOT EXISTS api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL,
  model_name TEXT NOT NULL,
  api_key TEXT NOT NULL,
  base_url TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  display_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add unique constraint for api_keys if not exists (check first)
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'api_keys_provider_model_name_key'
    ) THEN
        ALTER TABLE api_keys ADD CONSTRAINT api_keys_provider_model_name_key UNIQUE (provider, model_name);
    END IF;
END $$;

-- 9. Create indexes (idempotent)
CREATE INDEX IF NOT EXISTS idx_leads_company_id ON leads(company_id);
CREATE INDEX IF NOT EXISTS idx_leads_is_relevant ON leads(is_relevant) WHERE is_relevant = TRUE;
CREATE INDEX IF NOT EXISTS idx_ai_calls_job_id ON ai_calls(job_id);
CREATE INDEX IF NOT EXISTS idx_companies_canonical_key ON companies(canonical_key);
CREATE INDEX IF NOT EXISTS idx_api_keys_active ON api_keys(is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_api_keys_provider ON api_keys(provider);

-- 10. Enable Realtime for ranking_jobs (idempotent - catch error if already added)
-- 10. Enable Realtime (idempotent - catch error if already added)
DO $$ BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE ranking_jobs;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE leads;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE ai_calls;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 10.1 Set replica identity to FULL for realtime tables (to ensure full row updates)
ALTER TABLE ranking_jobs REPLICA IDENTITY FULL;
ALTER TABLE leads REPLICA IDENTITY FULL;
ALTER TABLE companies REPLICA IDENTITY FULL;
ALTER TABLE ai_calls REPLICA IDENTITY FULL;

-- 11. Functions (CREATE OR REPLACE is already idempotent)
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

CREATE OR REPLACE FUNCTION update_api_keys_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 12. Triggers (drop first to avoid duplicates)
DROP TRIGGER IF EXISTS trigger_update_api_keys_updated_at ON api_keys;
CREATE TRIGGER trigger_update_api_keys_updated_at
  BEFORE UPDATE ON api_keys
  FOR EACH ROW
  EXECUTE FUNCTION update_api_keys_updated_at();

-- 13. Comments
COMMENT ON TABLE api_keys IS 'Stores user-provided API keys for different LLM providers and models';
COMMENT ON COLUMN ranking_jobs.preferred_model IS 'User-selected model for this ranking job (NULL = auto-select)';

-- Done!
SELECT 'Schema created/updated successfully! ✓' AS status;
-- Migration to add missing call_type values to ai_calls check constraint
-- This adds: 'system_init', 'skipped_rate_limit', 'company_completion'

-- Drop the existing constraint
ALTER TABLE ai_calls DROP CONSTRAINT IF EXISTS ai_calls_call_type_check;

-- Add the updated constraint with all call types
ALTER TABLE ai_calls ADD CONSTRAINT ai_calls_call_type_check 
  CHECK (call_type IN ('ranking', 'ranking_batch', 'enrichment', 'optimization', 'gradient', 'system_init', 'skipped_rate_limit', 'company_completion', 'gemini_api_failed'));

-- Verify the constraint is applied
SELECT 'Constraint updated successfully! ✓' AS status;
