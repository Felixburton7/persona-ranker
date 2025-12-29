-- Migration to add missing call_type values to ai_calls check constraint
-- This adds: 'system_init', 'skipped_rate_limit', 'company_completion'

-- Drop the existing constraint
ALTER TABLE ai_calls DROP CONSTRAINT IF EXISTS ai_calls_call_type_check;

-- Add the updated constraint with all call types
ALTER TABLE ai_calls ADD CONSTRAINT ai_calls_call_type_check 
  CHECK (call_type IN ('ranking', 'ranking_batch', 'enrichment', 'optimization', 'gradient', 'system_init', 'skipped_rate_limit', 'company_completion'));

-- Verify the constraint is applied
SELECT 'Constraint updated successfully! ✓' AS status;
