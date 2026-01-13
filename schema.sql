-- =============================================================================
-- PERSONA RANKER - SCHEMA DEFINITION
-- Run this script to recreate the entire database schema from scratch.
-- ideally on a fresh database or after clearing public schema.
-- =============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Enums
DO $$ BEGIN
    CREATE TYPE company_size AS ENUM ('startup', 'smb', 'mid_market', 'enterprise');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE role_classification AS ENUM ('decision_maker', 'champion', 'irrelevant');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE job_status AS ENUM ('pending', 'running', 'completed', 'failed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- 2. Tables
-- Allows to scrappe the company data like industry, size once and store it here, rather than refetching for every lead in the copmany. 
CREATE TABLE IF NOT EXISTS companies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    domain TEXT,
    canonical_key TEXT NOT NULL UNIQUE,
    employee_range TEXT,
    size_bucket company_size,
    industry TEXT,
    scraped_summary TEXT,
    gradient_text TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Treated prompts like code versions on github where you store all versions and iteratively improve. Which each metric directly stored. This allows the agent to request 
-- The previously best prompt aswell. 
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
    gradient_text TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ranking_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    status job_status DEFAULT 'pending',
    prompt_version_id UUID REFERENCES prompt_versions(id),
    total_companies INTEGER DEFAULT 0,
    processed_companies INTEGER DEFAULT 0,
    total_leads INTEGER DEFAULT 0,
    processed_leads INTEGER DEFAULT 0,
    trigger_batch_id TEXT,
    use_company_scout BOOLEAN DEFAULT FALSE,
    top_n_per_company INTEGER DEFAULT 3,
    preferred_model TEXT,
    partial_completion BOOLEAN DEFAULT FALSE,
    skipped_leads_count INTEGER DEFAULT 0,
    rate_limit_error TEXT,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    error TEXT
);

-- I decided to go with a relevance score between 0 and 100, and also rank_within_company as opposed to gloabl rank. I used an enum for role type. 
-- Rubric scores are stored as JSONB, as the rubric is dynamic and can change over time. 
-- I use a postgres Generated column for full name as this allows for consistency and ease of use. 

CREATE TABLE IF NOT EXISTS leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    first_name TEXT,
    last_name TEXT,
    full_name TEXT GENERATED ALWAYS AS (TRIM(COALESCE(first_name, '') || ' ' || COALESCE(last_name, ''))) STORED,
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
    scout_data JSONB,
    ranked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- This is just for token tracking use, and also it records which model is used. 
CREATE TABLE IF NOT EXISTS ai_calls (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID REFERENCES ranking_jobs(id),
    company_id UUID REFERENCES companies(id),
    call_type TEXT CHECK (call_type IN ('ranking', 'ranking_batch', 'enrichment', 'optimization', 'gradient', 'system_init', 'skipped_rate_limit', 'company_completion', 'gemini_api_failed', 'eval_progress')),
    model TEXT NOT NULL,
    input_tokens INTEGER,
    output_tokens INTEGER,
    latency_ms INTEGER,
    estimated_cost_usd DECIMAL(10, 6),
    created_at TIMESTAMPTZ DEFAULT NOW()
);
-- I treated the prompts like 
-- Job status is used to manage UI state. 
CREATE TABLE IF NOT EXISTS optimization_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    status job_status DEFAULT 'pending',
    max_iterations INTEGER DEFAULT 5,
    iterations_completed INTEGER DEFAULT 0,
    best_prompt_id UUID REFERENCES prompt_versions(id),
    improvement_history JSONB,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    error_message TEXT,
    trigger_run_id TEXT
);

CREATE TABLE IF NOT EXISTS api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider TEXT NOT NULL,
    model_name TEXT NOT NULL,
    api_key TEXT NOT NULL,
    base_url TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    display_name TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(provider, model_name)
);


-- 3. Indexes

CREATE INDEX IF NOT EXISTS idx_leads_company_id ON leads(company_id);
CREATE INDEX IF NOT EXISTS idx_leads_is_relevant ON leads(is_relevant) WHERE is_relevant = TRUE;
CREATE INDEX IF NOT EXISTS idx_ai_calls_job_id ON ai_calls(job_id);
CREATE INDEX IF NOT EXISTS idx_companies_canonical_key ON companies(canonical_key);
CREATE INDEX IF NOT EXISTS idx_api_keys_active ON api_keys(is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_api_keys_provider ON api_keys(provider);


-- 4. Publication / Realtime

DO $$ BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE ranking_jobs;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE leads;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE ai_calls;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE ranking_jobs REPLICA IDENTITY FULL;
ALTER TABLE leads REPLICA IDENTITY FULL;
ALTER TABLE companies REPLICA IDENTITY FULL;
ALTER TABLE ai_calls REPLICA IDENTITY FULL;


-- 5. Functions & Triggers

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

DROP TRIGGER IF EXISTS trigger_update_api_keys_updated_at ON api_keys;
CREATE TRIGGER trigger_update_api_keys_updated_at
  BEFORE UPDATE ON api_keys
  FOR EACH ROW
  EXECUTE FUNCTION update_api_keys_updated_at();

-- Done
SELECT 'Schema initialized successfully!' AS status;


-- Migration: Multi-Tenant Optimization
-- Adds session_key to optimization_runs and prompt_versions to allow user isolation

-- 1. Add session_key to optimization_runs
ALTER TABLE optimization_runs 
ADD COLUMN IF NOT EXISTS session_key TEXT;

CREATE INDEX IF NOT EXISTS idx_optimization_runs_session_key 
ON optimization_runs(session_key);

-- 2. Add session_key to prompt_versions
ALTER TABLE prompt_versions 
ADD COLUMN IF NOT EXISTS session_key TEXT;

CREATE INDEX IF NOT EXISTS idx_prompt_versions_session_key 
ON prompt_versions(session_key);

-- 3. (Optional) Backfill existing data with a default session key if needed
-- UPDATE optimization_runs SET session_key = 'legacy' WHERE session_key IS NULL;
-- UPDATE prompt_versions SET session_key = 'legacy' WHERE session_key IS NULL;
