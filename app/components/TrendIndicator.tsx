"use client";

import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import type { Trend } from "@/lib/types";

const config: Record<Trend, { icon: React.ElementType; color: string; label: string }> = {
  up: { icon: TrendingUp, color: "text-green-500", label: "Trending up" },
  down: { icon: TrendingDown, color: "text-red-500", label: "Trending down" },
  stable: { icon: Minus, color: "text-gray-400", label: "Stable" },
};

export default function TrendIndicator({ trend }: { trend: Trend }) {
  const c = config[trend];
  const Icon = c.icon;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium ${c.color}`} title={c.label}>
      <Icon size={14} />
    </span>
  );
}
