"use client";

export type Section = "headlines" | "headtohead" | "usecases";

const TABS: { id: Section; label: string }[] = [
  { id: "headlines", label: "Headlines" },
  { id: "headtohead", label: "Head to Head" },
  { id: "usecases", label: "Top Use Cases" },
];

export default function SectionTabs({
  active,
  onChange,
}: {
  active: Section;
  onChange: (section: Section) => void;
}) {
  return (
    <div className="mb-6 flex gap-1 rounded-lg border border-exa-gray-300 bg-exa-gray-100 p-1">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-all ${
            active === tab.id
              ? "bg-exa-gray-300 text-exa-black shadow-button-sm"
              : "text-exa-gray-500 hover:text-exa-gray-700"
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
