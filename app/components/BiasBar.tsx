"use client";

import Image from "next/image";

export default function BiasBar({
  summary,
}: {
  summary: { claude: number; openai: number; neutral: number };
}) {
  const total = summary.claude + summary.openai + summary.neutral;
  if (total === 0) return null;

  const claudePct = Math.round((summary.claude / total) * 100);
  const openaiPct = Math.round((summary.openai / total) * 100);
  const neutralPct = 100 - claudePct - openaiPct;

  return (
    <div>
      <div className="flex items-center justify-center gap-6">
        {/* Claude side */}
        <div className="flex items-center gap-2">
          <Image src="/logos/claude.svg" alt="Claude" width={16} height={16} />
          <span className="text-sm font-semibold" style={{ color: "#DA7756" }}>
            {claudePct}%
          </span>
        </div>

        {/* Bar */}
        <div className="flex h-3 w-64 overflow-hidden rounded-full sm:w-80">
          {claudePct > 0 && (
            <div
              className="transition-all duration-700"
              style={{ width: `${claudePct}%`, backgroundColor: "#DA7756" }}
            />
          )}
          {neutralPct > 0 && (
            <div
              className="transition-all duration-700"
              style={{ width: `${neutralPct}%`, backgroundColor: "#3f3f4a" }}
            />
          )}
          {openaiPct > 0 && (
            <div
              className="transition-all duration-700"
              style={{ width: `${openaiPct}%`, backgroundColor: "#9ca3af" }}
            />
          )}
        </div>

        {/* OpenAI side */}
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-exa-gray-500">
            {openaiPct}%
          </span>
          <Image src="/logos/openai-white.svg" alt="OpenAI" width={16} height={16} />
        </div>
      </div>

      {/* Labels */}
      <div className="mt-1.5 flex items-center justify-center">
        <span className="text-[11px] text-exa-gray-500">
          {total} displayed items &middot; {neutralPct}% neutral
        </span>
      </div>
    </div>
  );
}
