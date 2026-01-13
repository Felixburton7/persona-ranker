import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "lead.ranker | AI-Native Lead Intelligence",
  description: "Persona Ranker, Technical Challenge. Turn lead lists into ranked intelligence with our multi-agent AI system.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        {/* Background Grids - 40px square grid with very low opacity */}
        <div className="fixed inset-0 z-0 pointer-events-none opacity-[0.03]"
          style={{
            backgroundImage: `linear-gradient(#000 1px, transparent 1px), linear-gradient(90deg, #000 1px, transparent 1px)`,
            backgroundSize: '40px 40px'
          }}
        ></div>
        <div className="relative z-10">
          {children}
        </div>
      </body>
    </html>
  );
}
