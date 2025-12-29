# Rate Limit Exhaustion Handling

## Overview
The system now gracefully handles the scenario where all 7 AI models are exhausted due to rate limits, allowing for **partial completion** instead of complete failure.

## What Changed

### 1. **Trigger Task (`rank-company.ts`)**
- **Detection**: The batch processing loop now detects when the "All models exhausted" error occurs
- **Partial Completion**: Instead of failing completely, the task:
  - Continues processing remaining batches (but skips them)
  - Tracks how many leads couldn't be processed (`failedLeadsCount`)
  - Stores the rate limit error message
  - Updates the job with partial completion metadata
  - Increments progress counters so totals still add up correctly

### 2. **Database Schema (`schema.sql`)**
Added three new columns to `ranking_jobs` table:
- `partial_completion` (BOOLEAN) - Flag indicating if job completed partially
- `skipped_leads_count` (INTEGER) - Number of leads that couldn't be processed
- `rate_limit_error` (TEXT) - The actual error message from the rate limit

### 3. **Frontend Hook (`useJobProgress.ts`)**
Updated the `JobProgress` interface to include the new fields so the UI can access them.

### 4. **UI Component (`ranking-progress.tsx`)**
- **Changed Label**: "Model Reasoning" → "What's Happening" (more descriptive)
- **Partial Completion Warning**: When a job completes with skipped leads, shows an amber warning banner that:
  - Clearly states how many leads were successfully processed vs skipped
  - Explains the rate limit issue
  - Suggests next steps (wait for reset or upgrade API tier)

## How It Works

### Before (Old Behavior)
```
Batch 1: ✓ Success
Batch 2: ✓ Success
Batch 3: ✗ All models exhausted
→ ENTIRE JOB FAILS
→ User sees error, loses all progress
```

### After (New Behavior)
```
Batch 1: ✓ Success (30 leads ranked)
Batch 2: ✓ Success (30 leads ranked)
Batch 3: ✗ Rate limit detected
→ Mark remaining batches as skipped (45 leads)
→ Update job: partial_completion=true, skipped_leads_count=45
→ Complete job with 60 leads successfully ranked
→ User sees amber warning with clear explanation
```

## User Experience

When rate limits are hit, users will see:

```
⚠️ Partial Completion - Rate Limit Reached

60 of 105 leads were successfully ranked. 45 leads could not be 
processed because all AI models reached their rate limits.

The results shown are complete for the leads that were processed. 
You can try again later when rate limits reset, or upgrade your 
API tier.
```

## Technical Details

### Error Detection
The system detects rate limit exhaustion by checking:
1. Error message contains "models exhausted"
2. OR status code 429 (rate limit) after max retry attempts

### Data Integrity
- Successfully processed leads are saved to the database
- Skipped leads remain unranked (no partial/incorrect data)
- Progress counters are updated correctly (processed + skipped = total)
- Job status transitions to "completed" (not "failed")

### Return Values
The task now returns different status values:
- `"success"` - All leads processed successfully
- `"partial"` - Some leads processed, some skipped due to rate limits
- `"failed"` - Fatal error occurred

## Benefits

1. **No Data Loss**: Users keep the results that were successfully processed
2. **Clear Communication**: Amber warning explains exactly what happened
3. **Actionable**: Users know they can retry later or upgrade
4. **Better UX**: Progress bar shows accurate completion percentage
5. **Debugging**: Rate limit error is stored for analysis
