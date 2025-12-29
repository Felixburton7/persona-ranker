export type SizeBucket = "startup" | "smb" | "mid_market" | "enterprise";

const SIZE_MAPPINGS: Record<string, SizeBucket> = {
    // Startup (1-50)
    "1-10": "startup",
    "2-10": "startup",
    "11-50": "startup",

    // SMB (51-200)
    "51-200": "smb",

    // Mid-Market (201-1000)
    "201-500": "mid_market",
    "501-1000": "mid_market",

    // Enterprise (1000+)
    "1001-5000": "enterprise",
    "5001-10000": "enterprise",
    "10001+": "enterprise",
    "1000+": "enterprise",
    "10000+": "enterprise",
};

export function normalizeSizeBucket(employeeRange: string): SizeBucket | null {
    if (!employeeRange) return null;
    const cleaned = employeeRange.trim();
    // Try exact match
    if (SIZE_MAPPINGS[cleaned]) return SIZE_MAPPINGS[cleaned];

    // Try without spaces in range (e.g. "11 - 50" -> "11-50")
    const noSpaces = cleaned.replace(/\s+/g, "");
    if (SIZE_MAPPINGS[noSpaces]) return SIZE_MAPPINGS[noSpaces];

    return null;
}
