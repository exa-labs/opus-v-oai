"use client";

import { useMemo } from "react";
import type { SummaryOutput } from "@/lib/summary";

const sentimentColor: Record<string, string> = {
  positive: "text-green-400",
  negative: "text-red-400",
  neutral: "text-white/50",
};

const subjectLabel: Record<string, string> = {
  claude: "on Claude",
  openai: "on OpenAI",
  both: "on both",
};

export default function SentimentBanner({
  summary,
}: {
  summary: string | null;
}) {
  const data: SummaryOutput | null = useMemo(() => {
    if (!summary) return null;
    try {
      return JSON.parse(summary);
    } catch {
      return null;
    }
  }, [summary]);

  if (!data) {
    return (
      <div className="rounded-2xl bg-white/5 border border-white/8 p-8 text-white">
        <h2 className="font-arizona mb-2 text-2xl font-medium tracking-tight">
          Waiting for first scan
        </h2>
        <p className="text-sm text-white/50">
          Run{" "}
          <code className="rounded bg-white/10 px-1.5 py-0.5 text-xs">
            npm run trigger-cron
          </code>{" "}
          to start tracking sentiment.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-white/8 bg-white/[0.03]">
      {/* Headline section */}
      <div className="relative px-8 pt-8 pb-6">
        <div className="absolute -right-20 -top-20 h-60 w-60 rounded-full bg-exa-blue/10 blur-[80px]" />
        <div className="absolute -bottom-10 left-1/3 h-40 w-40 rounded-full bg-exa-blue-light/5 blur-[60px]" />

        <div className="relative z-10">
          <h2 className="font-arizona mb-2 text-3xl font-medium tracking-tight text-white">
            {data.headline}
          </h2>
          <p className="text-sm text-white/60 leading-relaxed">{data.subtext}</p>
        </div>
      </div>

      {/* Takes section — the real quotes / opinions */}
      {data.takes && data.takes.length > 0 && (
        <div className="border-t border-white/8 px-8 py-6">
          <h3 className="mb-4 text-xs font-semibold uppercase tracking-wider text-white/30">
            What people are saying
          </h3>
          <div className="space-y-4">
            {data.takes.map((take, i) => (
              <div key={i} className="flex gap-3">
                {/* Sentiment indicator line */}
                <div className={`mt-1 h-4 w-0.5 flex-shrink-0 rounded-full ${
                  take.sentiment === "positive" ? "bg-green-500" :
                  take.sentiment === "negative" ? "bg-red-500" :
                  "bg-white/20"
                }`} />
                <div className="min-w-0">
                  <p className="text-sm leading-relaxed text-white/80">
                    &ldquo;{take.text}&rdquo;
                  </p>
                  <p className="mt-1 text-xs text-white/30">
                    {take.source}
                    <span className={`ml-2 ${sentimentColor[take.sentiment]}`}>
                      {subjectLabel[take.subject] || ""}
                    </span>
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
