"use client";

import { ExternalLink } from "lucide-react";
import Image from "next/image";
import type { Post } from "@/lib/types";

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

function UseCaseCard({ tweet }: { tweet: Post }) {
  const url = tweet.url.startsWith("http") ? tweet.url : `https://${tweet.url}`;
  const handle = (tweet.author || "unknown").replace(/^@/, "");

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="group block rounded-lg border border-exa-gray-300 bg-exa-gray-100 p-4 transition-all hover:border-exa-gray-400 hover:shadow-card"
    >
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Image src="/logos/x-white.svg" alt="X" width={11} height={11} className="opacity-50" />
          <span className="text-xs font-semibold text-exa-black">@{handle}</span>
        </div>
        <ExternalLink size={11} className="text-transparent transition-colors group-hover:text-exa-gray-500" />
      </div>
      <p className="mb-2 text-[13px] leading-snug text-exa-gray-700 line-clamp-3">
        {tweet.snippet}
      </p>
      <div className="flex items-center gap-3 text-[11px] text-exa-gray-500">
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

function UseCaseColumn({
  label,
  icon,
  color,
  tweets,
}: {
  label: string;
  icon: string;
  color: string;
  tweets: Post[];
}) {
  return (
    <div>
      <div className="mb-4 flex items-center gap-2">
        <Image src={icon} alt={label} width={20} height={20} />
        <h3 className="text-sm font-semibold" style={{ color }}>
          {label}
        </h3>
      </div>
      <div className="space-y-3">
        {tweets.map((tweet) => (
          <UseCaseCard key={tweet.id} tweet={tweet} />
        ))}
      </div>
    </div>
  );
}

export default function UseCases({
  claudeTweets,
  openaiTweets,
}: {
  claudeTweets: Post[];
  openaiTweets: Post[];
}) {
  if (claudeTweets.length === 0 && openaiTweets.length === 0) {
    return (
      <div className="rounded-lg border border-exa-gray-300 bg-exa-gray-100 p-12 text-center">
        <p className="text-sm text-exa-gray-500">No use cases found yet.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <p className="text-sm text-exa-gray-500">
          What developers are building and shipping with each model
        </p>
      </div>
      <div className="grid grid-cols-1 gap-8 sm:grid-cols-2">
        <UseCaseColumn
          label="Built with Claude"
          icon="/logos/claude.svg"
          color="#DA7756"
          tweets={claudeTweets}
        />
        <UseCaseColumn
          label="Built with Codex"
          icon="/logos/openai-white.svg"
          color="#a1a1aa"
          tweets={openaiTweets}
        />
      </div>
    </div>
  );
}
