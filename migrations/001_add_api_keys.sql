-- Migration: Add API Keys table and preferred_model column
-- Run this against your Supabase database

-- 1. Add preferred_model column to ranking_jobs (if not exists)
ALTER TABLE ranking_jobs 
ADD COLUMN IF NOT EXISTS preferred_model TEXT;

COMMENT ON COLUMN ranking_jobs.preferred_model IS 'User-selected model for this ranking job (NULL = auto-select)';

-- 2. Create API Keys table
CREATE TABLE IF NOT EXISTS api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL,                  -- e.g., "groq", "openai", "custom"
  model_name TEXT NOT NULL,                -- e.g., "llama-3.3-70b-versatile"
  api_key TEXT NOT NULL,                   -- Encrypted API key
  base_url TEXT,                           -- Optional custom base URL
  is_active BOOLEAN DEFAULT TRUE,
  display_name TEXT,                       -- User-friendly name
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(provider, model_name)
);

-- 3. Create indexes (IF NOT EXISTS not supported for indexes, so use DO block)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_api_keys_active') THEN
    CREATE INDEX idx_api_keys_active ON api_keys(is_active) WHERE is_active = TRUE;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_api_keys_provider') THEN
    CREATE INDEX idx_api_keys_provider ON api_keys(provider);
  END IF;
END$$;

-- 4. Create updated_at trigger function (if not exists)
CREATE OR REPLACE FUNCTION update_api_keys_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 5. Create trigger (drop first if exists to avoid duplicates)
DROP TRIGGER IF EXISTS trigger_update_api_keys_updated_at ON api_keys;
CREATE TRIGGER trigger_update_api_keys_updated_at
  BEFORE UPDATE ON api_keys
  FOR EACH ROW
  EXECUTE FUNCTION update_api_keys_updated_at();

-- 6. Add comment
COMMENT ON TABLE api_keys IS 'Stores user-provided API keys for different LLM providers and models';

-- Done!
SELECT 'Migration complete: API Keys table created, preferred_model column added' AS status;
