"use client";

import { useState } from "react";
import HeroHeader from "./HeroHeader";
import ClusterCard from "./ClusterCard";
import TweetSidebar from "./TweetSidebar";
import BiasBar from "./BiasBar";
import SectionTabs from "./SectionTabs";
import HeadToHead from "./HeadToHead";
import UseCases from "./UseCases";
import type { Section } from "./SectionTabs";
import type { Cluster } from "@/lib/cluster";
import type { Post, CronRun } from "@/lib/types";
import Image from "next/image";

export type Bias = "claude" | "openai" | "neutral";

export default function ClientPage({
  clusters,
  totalAnalyzed,
  totalKept,
  lastUpdated,
  tweets,
  lastRun,
  cachedBiasMap,
  cachedBiasSummary,
  cachedOverallSummary,
  headToHead,
  claudeUseCases,
  openaiUseCases,
}: {
  clusters: Cluster[];
  totalAnalyzed: number;
  totalKept: number;
  lastUpdated: string | null;
  tweets: Post[];
  lastRun: CronRun | null;
  cachedBiasMap: Record<string, string>;
  cachedBiasSummary: { claude: number; openai: number; neutral: number } | null;
  cachedOverallSummary: string | null;
  headToHead: Post[];
  claudeUseCases: Post[];
  openaiUseCases: Post[];
}) {
  const biasMap = cachedBiasMap as Record<string, Bias>;
  const biasSummary = cachedBiasSummary;
  const overallSummary = cachedOverallSummary;

  const [activeSection, setActiveSection] = useState<Section>("headlines");

  const leadCluster = clusters[0] || null;
  const secondaryCluster = clusters.length > 1 ? clusters.slice(1, 3) : [];
  const restClusters = clusters.slice(3);

  return (
    <div className="min-h-screen bg-[#0a0a0f]">
      <HeroHeader totalAnalyzed={totalAnalyzed} lastUpdated={lastUpdated} />

      {/* Overall sentiment summary + bias bar */}
      {(overallSummary || biasSummary) && (
        <div className="border-b border-exa-gray-200">
          <div className="mx-auto max-w-7xl px-6 py-5 lg:px-8">
            {overallSummary && (() => {
              const firstDot = overallSummary.indexOf(". ");
              const firstSentence = firstDot > -1 ? overallSummary.slice(0, firstDot + 1) : overallSummary;
              const rest = firstDot > -1 ? overallSummary.slice(firstDot + 2) : "";
              return (
                <div className="mb-4 text-center font-arizona leading-relaxed">
                  <p className="text-lg font-semibold text-exa-black sm:text-xl">
                    {firstSentence}
                  </p>
                  {rest && (
                    <p className="mt-2 text-base text-exa-gray-600">
                      {rest}
                    </p>
                  )}
                </div>
              );
            })()}
            {biasSummary && (biasSummary.claude + biasSummary.openai + biasSummary.neutral) > 0 && (
              <BiasBar summary={biasSummary} />
            )}
          </div>
        </div>
      )}

      <main className="mx-auto max-w-7xl px-6 py-8 lg:px-8">
        {clusters.length > 0 || headToHead.length > 0 ? (
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
            {/* Main content */}
            <div className="lg:col-span-8">
              <SectionTabs active={activeSection} onChange={setActiveSection} />

              {/* Head to Head */}
              {activeSection === "headtohead" && (
                <HeadToHead tweets={headToHead} />
              )}

              {/* Use Cases */}
              {activeSection === "usecases" && (
                <UseCases claudeTweets={claudeUseCases} openaiTweets={openaiUseCases} />
              )}

              {/* Headlines */}
              {activeSection === "headlines" && (
                <div>
                  <div className="mb-6">
                    <h2 className="font-arizona text-2xl font-medium text-exa-black">Top Headlines</h2>
                    <p className="mt-1 text-sm text-exa-gray-500">
                      AI-generated headlines clustered from {totalKept} individual sources and distilled takes
                    </p>
                  </div>
                  {/* Lead story */}
                  {leadCluster && (
                    <div className="mb-6">
                      <ClusterCard cluster={leadCluster} isLead bias={biasMap["cluster-0"]} />
                    </div>
                  )}

                  {/* Secondary stories */}
                  {secondaryCluster.length > 0 && (
                    <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
                      {secondaryCluster.map((cluster, i) => (
                        <ClusterCard key={i} cluster={cluster} isSecondary bias={biasMap[`cluster-${i + 1}`]} />
                      ))}
                    </div>
                  )}

                  {/* Remaining stories */}
                  {restClusters.length > 0 && (
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      {restClusters.map((cluster, i) => (
                        <ClusterCard key={i} cluster={cluster} bias={biasMap[`cluster-${i + 3}`]} />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Sidebar — tweets */}
            <div className="lg:col-span-4">
              <div className="lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)]">
                <TweetSidebar tweets={tweets} biasMap={biasMap} />
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-lg border border-exa-gray-300 bg-exa-gray-100 p-16 text-center">
            <p className="mb-2 text-sm text-exa-gray-600">No analysis yet</p>
            <p className="text-xs text-exa-gray-500">
              Run{" "}
              <code className="rounded bg-exa-gray-300 px-1.5 py-0.5 text-xs">
                npm run trigger-cron
              </code>{" "}
              to start discovering sources.
            </p>
          </div>
        )}

        {/* Footer */}
        <div className="mt-16 flex items-center justify-center gap-2 border-t border-exa-gray-200 pt-8 text-xs text-exa-gray-500">
          <span>Powered by</span>
          <a
            href="https://exa.ai"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 transition-colors hover:text-exa-blue"
          >
            <Image
              src="/logos/exa-logomark-blue.svg"
              alt="Exa"
              width={14}
              height={14}
            />
            <span className="font-medium text-exa-blue">Exa</span>
          </a>
        </div>
      </main>
    </div>
  );
}
