"use client";

import TrendIndicator from "./TrendIndicator";
import type { Metric } from "@/lib/types";

function ScoreBar({
  positive,
  neutral,
  negative,
}: {
  positive: number;
  neutral: number;
  negative: number;
}) {
  const total = positive + neutral + negative || 1;
  const pPct = Math.round((positive / total) * 100);
  const nPct = Math.round((negative / total) * 100);
  const neuPct = 100 - pPct - nPct;

  return (
    <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-white/10">
      <div className="bg-green-500 transition-all" style={{ width: `${pPct}%` }} />
      <div className="bg-white/20 transition-all" style={{ width: `${neuPct}%` }} />
      <div className="bg-red-500 transition-all" style={{ width: `${nPct}%` }} />
    </div>
  );
}

function MetricCard({
  label,
  logo,
  invertLogo,
  metric,
  vibe,
}: {
  label: string;
  logo: string;
  invertLogo?: boolean;
  metric: Metric | null;
  vibe: string | null;
}) {
  const total = metric ? (metric.positive_count + metric.negative_count + metric.neutral_count) || 1 : 1;
  const positivePct = metric ? Math.round((metric.positive_count / total) * 100) : 0;
  const negativePct = metric ? Math.round((metric.negative_count / total) * 100) : 0;

  return (
    <div className="flex-1 rounded-xl border border-white/10 bg-white/5 p-5">
      <div className="mb-3 flex items-center gap-3">
        <img
          src={logo}
          alt={label}
          className={`h-5 w-5 ${invertLogo ? "brightness-0 invert" : ""}`}
        />
        <span className="text-sm font-semibold text-white">{label}</span>
        {metric && <TrendIndicator trend={metric.trend} />}
      </div>

      {metric ? (
        <>
          {/* Vibe label — the headline metric */}
          {vibe && (
            <p className="mb-3 text-lg font-medium text-white/90">{vibe}</p>
          )}

          <ScoreBar
            positive={metric.positive_count}
            neutral={metric.neutral_count}
            negative={metric.negative_count}
          />

          <div className="mt-3 flex gap-4 text-xs text-white/50">
            <span>
              <span className="font-semibold text-green-400">{positivePct}%</span> positive
            </span>
            <span>
              <span className="font-semibold text-red-400">{negativePct}%</span> negative
            </span>
            <span className="ml-auto text-white/30">{metric.total_posts} sources</span>
          </div>
        </>
      ) : (
        <div className="shimmer-bg h-20 rounded-lg opacity-20" />
      )}
    </div>
  );
}

export default function MetricsPanel({
  claude,
  openai,
  claudeVibe,
  openaiVibe,
}: {
  claude: Metric | null;
  openai: Metric | null;
  claudeVibe: string | null;
  openaiVibe: string | null;
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row">
      <MetricCard label="Claude" logo="/logos/claude.svg" metric={claude} vibe={claudeVibe} />
      <MetricCard label="OpenAI" logo="/logos/openai.svg" invertLogo metric={openai} vibe={openaiVibe} />
    </div>
  );
}
