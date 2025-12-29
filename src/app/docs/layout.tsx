import { Metadata } from "next";

export const metadata: Metadata = {
    title: "Documentation | lead.ranker",
    description: "Deep dive into the autonomous multi-agent architecture powering lead.ranker's AI-native lead intelligence system.",
};

export default function DocsLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return children;
}
