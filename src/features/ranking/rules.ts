
export interface PrefilterRule {
    pattern: RegExp;
    reason: string;
    code: string;
}

export interface SizeRule {
    pattern: RegExp;
    excludeAt: string[];
    reason: string;
}

// GTM/Sales context that allows otherwise-excluded titles
export const GTM_SALES_CONTEXT = /\b(sales|revenue|growth|gtm|go[-\s]?to[-\s]?market|commercial|business development|biz\s?dev)\b/i;

export const HARD_EXCLUSION_PATTERNS: PrefilterRule[] = [
    { pattern: /\b(hr|human resources|talent acquisition|recruiter|recruiting|people operations)\b/i, reason: "HR/Recruiting", code: "HR" },
    { pattern: /\b(finance|accounting|accountant|fp&a|controller|bookkeeper|payroll)\b/i, reason: "Finance/Accounting", code: "FINANCE" },
    { pattern: /\b(legal|compliance|counsel|attorney|lawyer|paralegal)\b/i, reason: "Legal", code: "LEGAL" },
    { pattern: /\b(customer (support|success|service)|cs manager|support (engineer|specialist))\b/i, reason: "Customer Support", code: "CS" },
    { pattern: /\b(investor|board member|board of directors|advisory board|angel investor)\b/i, reason: "Investor/Board", code: "BOARD" },
    { pattern: /\b(intern|student|trainee|apprentice|co-op)\b/i, reason: "Intern/Student", code: "INTERN" },
];

export const SIZE_DEPENDENT_RULES: SizeRule[] = [
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
