"use client";

import { ExternalLink } from "lucide-react";
import Image from "next/image";
import type { Post } from "@/lib/types";

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

function ComparisonCard({ tweet, rank }: { tweet: Post; rank: number }) {
  const url = tweet.url.startsWith("http") ? tweet.url : `https://${tweet.url}`;
  const handle = (tweet.author || "unknown").replace(/^@/, "");

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="group block rounded-lg border border-exa-gray-300 bg-exa-gray-100 p-5 transition-all hover:border-exa-gray-400 hover:shadow-card"
    >
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Image src="/logos/x-white.svg" alt="X" width={12} height={12} className="opacity-50" />
          <span className="text-sm font-semibold text-exa-black">@{handle}</span>
        </div>
        <ExternalLink size={12} className="text-transparent transition-colors group-hover:text-exa-gray-500" />
      </div>
      <p className="mb-3 text-sm leading-relaxed text-exa-gray-700 line-clamp-4">
        {tweet.snippet}
      </p>
      <div className="flex items-center gap-4 text-xs text-exa-gray-500">
        {tweet.likes != null && tweet.likes > 0 && (
          <span>{formatCount(tweet.likes)} likes</span>
        )}
        {tweet.views != null && tweet.views > 0 && (
          <span>{formatCount(tweet.views)} views</span>
        )}
      </div>
    </a>
  );
}

export default function HeadToHead({ tweets }: { tweets: Post[] }) {
  if (tweets.length === 0) {
    return (
      <div className="rounded-lg border border-exa-gray-300 bg-exa-gray-100 p-12 text-center">
        <p className="text-sm text-exa-gray-500">No head-to-head comparisons found yet.</p>
      </div>
    );
  }

  const lead = tweets[0];
  const rest = tweets.slice(1);

  return (
    <div>
      <div className="mb-6">
        <div className="mb-1 flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <Image src="/logos/claude.svg" alt="Claude" width={18} height={18} />
            <span className="text-sm font-semibold" style={{ color: "#DA7756" }}>Opus 4.6</span>
          </div>
          <span className="text-sm text-exa-gray-500">vs</span>
          <div className="flex items-center gap-1.5">
            <Image src="/logos/openai-white.svg" alt="OpenAI" width={18} height={18} />
            <span className="text-sm font-semibold text-exa-gray-600">Codex 5.3</span>
          </div>
        </div>
        <p className="text-sm text-exa-gray-500">
          Engineers comparing both models on the same tasks
        </p>
      </div>

      {/* Lead comparison — full width */}
      <ComparisonCard tweet={lead} rank={1} />

      {/* Grid of remaining */}
      {rest.length > 0 && (
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {rest.map((tweet, i) => (
            <ComparisonCard key={tweet.id} tweet={tweet} rank={i + 2} />
          ))}
        </div>
      )}
    </div>
  );
}
