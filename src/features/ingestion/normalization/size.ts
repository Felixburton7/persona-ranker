export type SizeBucket = "startup" | "smb" | "mid_market" | "enterprise";

const SIZE_MAPPINGS: Record<string, SizeBucket> = {
    // Startup (1-50)
    "1-10": "startup",
    "2-10": "startup",
    "11-50": "startup",
    "1-50": "startup",
    "1-20": "startup",

    // SMB (51-200)
    "51-200": "smb",
    "11-200": "smb", // Broad range fallback
    "50-200": "smb",

    // Mid-Market (201-1000)
    "201-500": "mid_market",
    "501-1000": "mid_market",
    "201-1000": "mid_market",
    "200-500": "mid_market",
    "500+": "mid_market", // Ambiguous, but often mid-market start

    // Enterprise (1000+)
    "1001-5000": "enterprise",
    "5001-10000": "enterprise",
    "10001+": "enterprise",
    "1000+": "enterprise",
    "10000+": "enterprise",
    "5000+": "enterprise",
};

export function normalizeSizeBucket(employeeRange: string): SizeBucket | null {
    if (!employeeRange) return null;

    // 1. Aggressive cleanup: lower case, replace en-dashes, remove spaces
    const cleaned = employeeRange
        .toLowerCase()
        .replace(/–/g, "-")  // En-dash to hyphen
        .replace(/—/g, "-")  // Em-dash to hyphen
        .replace(/\s+/g, "") // Remove all spaces
        .trim();

    // 2. Direct lookup
    if (SIZE_MAPPINGS[cleaned]) return SIZE_MAPPINGS[cleaned];

    return null;
}
