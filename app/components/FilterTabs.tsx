"use client";

import type { FeedFilter } from "@/lib/types";

const tabs: { value: FeedFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "claude", label: "Claude" },
  { value: "openai", label: "OpenAI" },
  { value: "polarized", label: "Most Polarized" },
];

export default function FilterTabs({
  active,
  onChange,
}: {
  active: FeedFilter;
  onChange: (filter: FeedFilter) => void;
}) {
  return (
    <div className="inline-flex rounded-lg border border-white/10 bg-white/5 p-1">
      {tabs.map((tab) => (
        <button
          key={tab.value}
          onClick={() => onChange(tab.value)}
          className={`rounded-md px-4 py-1.5 text-sm font-medium transition-all ${
            active === tab.value
              ? "bg-white/15 text-white"
              : "text-white/50 hover:text-white/80"
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
