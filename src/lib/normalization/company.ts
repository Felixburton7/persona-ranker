export function generateCanonicalKey(name: string, domain?: string): string {
    // Prefer domain if available (more stable)
    if (domain) {
        return domain
            .toLowerCase()
            .replace(/^(www\.|https?:\/\/)/, "")
            .replace(/\/$/, "")
            .trim();
    }

    // Fallback: normalize company name
    if (!name) return "";

    return name
        .toLowerCase()
        .replace(/[^\w\s]/g, "")  // Remove punctuation
        .replace(/\s+/g, " ")      // Collapse whitespace
        .trim();
}
