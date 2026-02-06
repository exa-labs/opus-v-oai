"use client";

import type { Sentiment } from "@/lib/types";

const config: Record<Sentiment, { label: string; bg: string; text: string }> = {
  positive: { label: "Positive", bg: "bg-green-500/15", text: "text-green-400" },
  negative: { label: "Negative", bg: "bg-red-500/15", text: "text-red-400" },
  neutral: { label: "Neutral", bg: "bg-white/8", text: "text-white/50" },
};

export default function SentimentBadge({
  sentiment,
  score,
}: {
  sentiment: Sentiment;
  score?: number | null;
}) {
  const c = config[sentiment];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${c.bg} ${c.text}`}
    >
      {c.label}
      {score != null && (
        <span className="opacity-70">
          {score > 0 ? "+" : ""}
          {score}
        </span>
      )}
    </span>
  );
}
