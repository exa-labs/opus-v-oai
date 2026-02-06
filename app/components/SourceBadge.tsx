"use client";

import type { SourceType } from "@/lib/types";
import { Twitter, Globe, MessageSquare, Newspaper, BookOpen } from "lucide-react";

const config: Record<SourceType, { icon: React.ElementType; label: string; color: string }> = {
  twitter: { icon: Twitter, label: "Twitter", color: "text-sky-500" },
  reddit: { icon: MessageSquare, label: "Reddit", color: "text-orange-500" },
  forum: { icon: MessageSquare, label: "Forum", color: "text-violet-500" },
  blog: { icon: BookOpen, label: "Blog", color: "text-emerald-600" },
  news: { icon: Newspaper, label: "News", color: "text-blue-600" },
};

export default function SourceBadge({ sourceType }: { sourceType: SourceType }) {
  const c = config[sourceType];
  const Icon = c.icon;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium ${c.color}`}>
      <Icon size={12} />
      {c.label}
    </span>
  );
}
