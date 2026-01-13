import { HARD_EXCLUSION_PATTERNS, SIZE_DEPENDENT_RULES, GTM_SALES_CONTEXT } from "./rules";

interface PrefilterResult {
    shouldExclude: boolean;
    reason: string | null;
    code?: string;
}

export function prefilterLead(
    title: string,
    normalizedTitle: string,
    sizeBucket: string
): PrefilterResult {
    // 1. Check hard exclusions (always apply)
    for (const { pattern, reason, code } of HARD_EXCLUSION_PATTERNS) {
        if (pattern.test(normalizedTitle)) {
            // Exception: CFO/Finance Head at Startup often acts as COO/Approver
            if (sizeBucket === 'startup' && /\b(cfo|chief financial officer|head of finance|vp finance|finance director|director of finance|head of fp&a|finance lead)\b/i.test(normalizedTitle)) {
                continue;
            }
            return { shouldExclude: true, reason, code };
        }
    }

    // 2. Check size-dependent rules
    for (const rule of SIZE_DEPENDENT_RULES) {
        if (rule.excludeAt.includes(sizeBucket)) {
            if (rule.pattern.test(normalizedTitle)) {
                // Exception: if title has GTM/Sales context, don't exclude
                // e.g., "President of Sales", "President GTM"
                if (GTM_SALES_CONTEXT.test(normalizedTitle)) {
                    continue; // Don't exclude
                }
                return { shouldExclude: true, reason: rule.reason, code: "SIZE_MISMATCH" };
            }
        }
    }

    return { shouldExclude: false, reason: null };
}
