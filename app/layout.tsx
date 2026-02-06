import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Opus 4.6 vs Codex — What Engineers Are Saying",
  description:
    "Real-time analysis of engineer reactions to Claude Opus 4.6 and OpenAI Codex. Powered by Exa.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-[#0a0a0f] font-diatype antialiased">
        {children}
      </body>
    </html>
  );
}
