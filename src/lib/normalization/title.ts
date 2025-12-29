const TITLE_SYNONYMS: Record<string, string> = {
    "svp": "senior vice president",
    "evp": "executive vice president",
    "vp": "vice president",
    "cro": "chief revenue officer",
    "coo": "chief operating officer",
    "cfo": "chief financial officer",
    "cto": "chief technology officer",
    "ceo": "chief executive officer",
    "cmo": "chief marketing officer",
    "sdr": "sales development representative",
    "bdr": "business development representative",
    "ae": "account executive",
    "revops": "revenue operations",
    "gtm": "go to market",
    "md": "managing director",
};

const NOISE_PATTERNS = [
    /\s*\|.*$/,                    // Everything after |
    /\s*@.*$/,                     // Everything after @
    /\s*-\s*[A-Z]{2,}$/,          // Location suffixes like "- EMEA"
    /\(.*?\)/g,                    // Parenthetical content
    /[,;]/g,                       // Commas and semicolons
    /\s+/g,                        // Multiple spaces
];

export function normalizeTitle(title: string): string {
    if (!title) return "";

    let normalized = title.toLowerCase().trim();

    // Remove noise
    for (const pattern of NOISE_PATTERNS) {
        normalized = normalized.replace(pattern, " ");
    }

    // Expand acronyms
    for (const [abbrev, full] of Object.entries(TITLE_SYNONYMS)) {
        const regex = new RegExp(`\\b${abbrev}\\b`, "gi");
        normalized = normalized.replace(regex, full);
    }

    return normalized.trim().replace(/\s+/g, " ");
}
