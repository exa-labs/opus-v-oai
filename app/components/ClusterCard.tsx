"use client";

import { useState } from "react";
import { ChevronDown, ExternalLink } from "lucide-react";
import Image from "next/image";
import type { Cluster, Source } from "@/lib/cluster";
import type { Bias } from "./ClientPage";

const BIAS_COLORS: Record<Bias, string> = {
  claude: "#DA7756",   // Anthropic orange
  openai: "#9ca3af",   // light gray
  neutral: "#d1d5db",  // lighter gray
};

const BIAS_BORDER: Record<Bias, string> = {
  claude: "border-l-[#DA7756]",
  openai: "border-l-[#9ca3af]",
  neutral: "border-l-[#d1d5db]",
};

const BIAS_LABEL: Record<Bias, string> = {
  claude: "Favors Claude",
  openai: "Favors OpenAI",
  neutral: "Neutral",
};

function BiasIndicator({ bias }: { bias?: Bias }) {
  if (!bias) return null;
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium"
      style={{
        backgroundColor: `${BIAS_COLORS[bias]}18`,
        color: bias === "neutral" ? "#6b7280" : BIAS_COLORS[bias],
      }}
    >
      {bias === "claude" && <Image src="/logos/claude.svg" alt="" width={10} height={10} />}
      {bias === "openai" && <Image src="/logos/openai-white.svg" alt="" width={10} height={10} />}
      {BIAS_LABEL[bias]}
    </span>
  );
}

function SourceRow({ source }: { source: Source }) {
  return (
    <a
      href={source.url.startsWith("http") ? source.url : `https://${source.url}`}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-exa-gray-200"
    >
      {/* X favicon for tweets, bullet for others */}
      {source.domain.includes("x.com") || source.domain.includes("twitter.com") ? (
        <Image src="/logos/x-white.svg" alt="X" width={12} height={12} className="mt-1.5 flex-shrink-0 opacity-50" />
      ) : (
        <div className="mt-2 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-exa-gray-400" />
      )}
      <div className="min-w-0 flex-1">
        <div className="mb-0.5 flex items-center gap-2">
          <span className="text-xs text-exa-gray-500">{source.domain}</span>
          {source.author && (
            <>
              <span className="text-exa-gray-400">&middot;</span>
              <span className="text-xs text-exa-gray-500">{source.author}</span>
            </>
          )}
          <ExternalLink size={10} className="ml-auto flex-shrink-0 text-transparent transition-colors group-hover:text-exa-gray-400" />
        </div>
        <p className="text-sm leading-snug text-exa-gray-700 group-hover:text-exa-black">
          {source.title}
        </p>
        {source.snippet && (
          <p className="mt-1 line-clamp-1 text-xs text-exa-gray-500">
            {source.snippet.slice(0, 120)}
          </p>
        )}
      </div>
    </a>
  );
}

export default function ClusterCard({
  cluster,
  isLead = false,
  isSecondary = false,
  bias,
}: {
  cluster: Cluster;
  isLead?: boolean;
  isSecondary?: boolean;
  bias?: Bias;
}) {
  const [open, setOpen] = useState(false);

  const borderClass = bias ? BIAS_BORDER[bias] : "border-l-transparent";

  const heroImage = cluster.imageUrl;

  return (
    <div className={`overflow-hidden rounded-lg border border-exa-gray-300 border-l-[3px] ${borderClass} bg-exa-gray-100 transition-shadow hover:shadow-card ${isLead ? "shadow-card" : ""}`}>
      {/* Hero image for lead cluster only */}
      {heroImage && isLead && (
        <div className="relative h-48 w-full overflow-hidden bg-exa-gray-200 sm:h-56">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={heroImage}
            alt=""
            className="h-full w-full object-cover"
            loading="lazy"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#18181e] via-transparent to-transparent" />
        </div>
      )}
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-start gap-4 px-5 py-4 text-left"
      >
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex items-center gap-2">
            <BiasIndicator bias={bias} />
            <span className="text-[11px] text-exa-gray-400">
              {cluster.sources.length} source{cluster.sources.length !== 1 ? "s" : ""}
            </span>
          </div>
          <h2 className={`mb-1.5 font-medium leading-snug text-exa-black ${
            isLead
              ? "font-arizona text-2xl sm:text-3xl"
              : isSecondary
                ? "font-arizona text-lg sm:text-xl"
                : "text-[15px]"
          }`}>
            {cluster.headline}
          </h2>
          <p className={`leading-relaxed text-exa-gray-600 ${
            isLead
              ? "text-base"
              : isSecondary
                ? "text-sm"
                : "text-[13px]"
          }`}>
            {cluster.subheadline}
          </p>
        </div>
        <div className="flex flex-shrink-0 items-center pt-1">
          <ChevronDown
            size={16}
            className={`text-exa-gray-400 transition-transform duration-200 ${
              open ? "rotate-180" : ""
            }`}
          />
        </div>
      </button>

      {open && (
        <div className="border-t border-exa-gray-200 px-3 py-2">
          <div className="space-y-0.5">
            {cluster.sources.map((source, i) => (
              <SourceRow key={i} source={source} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
