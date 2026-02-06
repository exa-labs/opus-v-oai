"use client";

import { ExternalLink } from "lucide-react";
import Image from "next/image";
import type { Post } from "@/lib/types";
import type { Bias } from "./ClientPage";
import { formatRelativeTime } from "@/lib/cron-utils-client";

const BIAS_BORDER: Record<Bias, string> = {
  claude: "border-l-[#DA7756]",
  openai: "border-l-[#9ca3af]",
  neutral: "border-l-[#e5e7eb]",
};

function TweetCard({ tweet, bias }: { tweet: Post; bias?: Bias }) {
  const url = tweet.url.startsWith("http") ? tweet.url : `https://${tweet.url}`;
  const borderClass = bias ? BIAS_BORDER[bias] : "border-l-transparent";

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={`group block border-b border-exa-gray-200 border-l-[3px] ${borderClass} px-4 py-3.5 transition-colors last:border-b-0 hover:bg-exa-gray-200`}
    >
      <div className="mb-1.5 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Image src="/logos/x-white.svg" alt="X" width={11} height={11} className="opacity-40" />
          <span className="text-xs font-medium text-exa-black">
            {tweet.author || "unknown"}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] text-exa-gray-500">
            {formatRelativeTime(tweet.discovered_at)}
          </span>
          <ExternalLink size={10} className="text-transparent transition-colors group-hover:text-exa-gray-400" />
        </div>
      </div>
      <p className="text-[13px] leading-snug text-exa-gray-700 line-clamp-3">
        {tweet.snippet}
      </p>
    </a>
  );
}

export default function TweetSidebar({
  tweets,
  biasMap,
}: {
  tweets: Post[];
  biasMap: Record<string, Bias>;
}) {
  if (tweets.length === 0) return null;

  return (
    <div className="flex max-h-[calc(100vh-2rem)] flex-col rounded-lg border border-exa-gray-300 bg-exa-gray-100">
      <div className="border-b border-exa-gray-300 px-4 py-3">
        <div className="flex items-center gap-1.5">
          <Image src="/logos/x-white.svg" alt="X" width={13} height={13} className="opacity-60" />
          <h3 className="text-xs font-semibold uppercase tracking-wider text-exa-gray-600">
            Top Voices
          </h3>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        {tweets.map((tweet) => (
          <TweetCard
            key={tweet.id}
            tweet={tweet}
            bias={biasMap[`tweet-${tweet.id}`]}
          />
        ))}
      </div>
    </div>
  );
}
