-- API Keys Management Table
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

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_api_keys_active ON api_keys(is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_api_keys_provider ON api_keys(provider);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_api_keys_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
CREATE TRIGGER trigger_update_api_keys_updated_at
  BEFORE UPDATE ON api_keys
  FOR EACH ROW
  EXECUTE FUNCTION update_api_keys_updated_at();

COMMENT ON TABLE api_keys IS 'Stores user-provided API keys for different LLM providers and models';
