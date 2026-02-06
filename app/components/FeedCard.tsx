"use client";

import type { Post } from "@/lib/types";
import { formatRelativeTime } from "@/lib/cron-utils-client";
import { ExternalLink } from "lucide-react";

function extractDomain(url: string): string {
  try {
    const normalized = url.startsWith("http") ? url : `https://${url}`;
    return new URL(normalized).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

const sentimentBorder: Record<string, string> = {
  positive: "border-l-green-500/60",
  negative: "border-l-red-500/60",
  neutral: "border-l-white/10",
};

const sentimentDot: Record<string, string> = {
  positive: "bg-green-500",
  negative: "bg-red-500",
  neutral: "bg-white/30",
};

export default function FeedCard({ post }: { post: Post }) {
  const domain = extractDomain(post.url);
  const border = sentimentBorder[post.sentiment] || sentimentBorder.neutral;
  const dot = sentimentDot[post.sentiment] || sentimentDot.neutral;

  return (
    <div
      onClick={() => {
        const url = post.url.startsWith("http") ? post.url : `https://${post.url}`;
        window.open(url, "_blank", "noopener,noreferrer");
      }}
      className={`group cursor-pointer rounded-lg border border-white/6 border-l-2 ${border} bg-white/[0.03] px-5 py-4 transition-all hover:bg-white/[0.06] active:scale-[0.995]`}
    >
      {/* Top: domain + time */}
      <div className="mb-2 flex items-center gap-2 text-xs text-white/35">
        <div className={`h-1.5 w-1.5 rounded-full ${dot}`} />
        <span className="font-medium text-white/50">{domain}</span>
        {post.author && (
          <>
            <span className="text-white/20">/</span>
            <span>{post.author}</span>
          </>
        )}
        <span className="ml-auto flex items-center gap-1">
          {post.published_at
            ? formatRelativeTime(post.published_at)
            : formatRelativeTime(post.discovered_at)}
          <ExternalLink size={10} className="opacity-0 transition-opacity group-hover:opacity-100" />
        </span>
      </div>

      {/* Title */}
      {post.title && (
        <h3 className="mb-1 text-sm font-medium leading-snug text-white/90 group-hover:text-white">
          {post.title}
        </h3>
      )}

      {/* Snippet */}
      {post.snippet && (
        <p className="line-clamp-2 text-sm leading-relaxed text-white/40">
          {post.snippet}
        </p>
      )}
    </div>
  );
}
