
interface PrefilterResult {
    shouldExclude: boolean;
    reason: string | null;
    code?: string;
}

// Hard exclusions - ALWAYS wrong at any company size (mostly)
// Hard exclusions - ALWAYS wrong at any company size (mostly)
const HARD_EXCLUSION_PATTERNS = [
    { pattern: /\b(hr|human resources|talent acquisition|recruiter|recruiting|people operations)\b/i, reason: "HR/Recruiting", code: "HR" },
    { pattern: /\b(finance|accounting|accountant|fp&a|controller|bookkeeper|payroll)\b/i, reason: "Finance/Accounting", code: "FINANCE" },
    { pattern: /\b(legal|compliance|counsel|attorney|lawyer|paralegal)\b/i, reason: "Legal", code: "LEGAL" },
    { pattern: /\b(customer (support|success|service)|cs manager|support (engineer|specialist))\b/i, reason: "Customer Support", code: "CS" },
    { pattern: /\b(investor|board member|board of directors|advisory board|angel investor)\b/i, reason: "Investor/Board", code: "BOARD" },
    { pattern: /\b(intern|student|trainee|apprentice|co-op)\b/i, reason: "Intern/Student", code: "INTERN" },
];

// GTM/Sales context that allows otherwise-excluded titles
const GTM_SALES_CONTEXT = /\b(sales|revenue|growth|gtm|go[-\s]?to[-\s]?market|commercial|business development|biz\s?dev)\b/i;

// Size-dependent rules
interface SizeRule {
    pattern: RegExp;
    excludeAt: string[];  // Size buckets where this is excluded
    reason: string;
}

const SIZE_DEPENDENT_RULES: SizeRule[] = [
    {
        pattern: /\b(ceo|chief executive)\b/i,
        excludeAt: ["mid_market", "enterprise"],  // NOT excluded at startup/smb
        reason: "CEO too removed at larger companies",
    },
    {
        pattern: /\bpresident\b/i,
        excludeAt: ["mid_market", "enterprise"],
        reason: "President too removed (unless GTM/Sales context)",
    },
    {
        pattern: /\b(founder|co-founder)\b/i,
        excludeAt: ["enterprise"],  // Still relevant at mid_market sometimes
        reason: "Founder too removed at enterprise",
    },
];

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
