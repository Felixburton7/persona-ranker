import { Lead } from "@/types/leads"

export function getRoleBadgeStyles(role: string): string {
    const colors: Record<string, string> = {
        influencer: "text-amber-700 ring-amber-600/20",
        irrelevant: "text-gray-600 ring-gray-500/10",
        gatekeeper: "text-orange-700 ring-orange-600/20",
        user: "text-indigo-700 ring-indigo-700/10",
        skipped: "bg-red-50 text-red-700 ring-red-600/20",
        decision_maker: "text-purple-700", // Special handling in component usually, but keeping simple
        champion: "bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-700/10"
    }

    const defaultStyle = "text-gray-600 ring-gray-500/10"
    return colors[role as keyof typeof colors] || defaultStyle
}

export function getScoreColor(score: number): string {
    if (score > 80) return "text-green-600"
    if (score > 50) return "text-yellow-600"
    return "text-gray-400"
}
