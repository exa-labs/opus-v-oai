import { getLatestCompletedRun, getRecentTweets, getTotalSourcesAnalyzed, getHeadToHeadTweets, getUseCaseTweets, getImageUrlsForUrls } from "@/lib/db";
import ClientPage from "./components/ClientPage";
import type { Cluster } from "@/lib/cluster";
import type { Post } from "@/lib/types";

export const dynamic = "force-dynamic";

interface SummaryData {
  clusters: Cluster[];
  totalAnalyzed: number;
  totalKept: number;
  generatedAt: string;
  cachedBias?: {
    items: { id: string; bias: string }[];
    summary: { claude: number; openai: number; neutral: number };
  };
  cachedSummary?: string | null;
}

export default function Home() {
  const latestRun = getLatestCompletedRun();
  const tweets = getRecentTweets(30);
  const totalSources = getTotalSourcesAnalyzed();
  const headToHead = getHeadToHeadTweets(12);
  const claudeUseCases = getUseCaseTweets("claude", 8);
  const openaiUseCases = getUseCaseTweets("openai", 8);

  let summaryData: SummaryData | null = null;
  if (latestRun?.summary) {
    try {
      summaryData = JSON.parse(latestRun.summary);
    } catch {
      // ignore
    }
  }

  // Build bias map from cached data
  const biasMap: Record<string, string> = {};
  if (summaryData?.cachedBias?.items) {
    for (const item of summaryData.cachedBias.items) {
      biasMap[item.id] = item.bias;
    }
  }

  // Hydrate cluster images from DB (cached clusters may not have imageUrl yet)
  const clusters = summaryData?.clusters || [];
  if (clusters.length > 0) {
    const allSourceUrls = clusters.flatMap(c => c.sources.map(s => s.url));
    const imageMap = getImageUrlsForUrls(allSourceUrls);
    for (const cluster of clusters) {
      if (!cluster.imageUrl) {
        const sourceWithImage = cluster.sources.find(s => imageMap.has(s.url));
        if (sourceWithImage) {
          cluster.imageUrl = imageMap.get(sourceWithImage.url);
        }
      }
    }
  }

  return (
    <ClientPage
      clusters={clusters}
      totalAnalyzed={totalSources}
      totalKept={summaryData?.totalKept || 0}
      lastUpdated={latestRun?.completed_at || null}
      tweets={tweets}
      lastRun={latestRun}
      cachedBiasMap={biasMap}
      cachedBiasSummary={summaryData?.cachedBias?.summary || null}
      cachedOverallSummary={summaryData?.cachedSummary || null}
      headToHead={headToHead}
      claudeUseCases={claudeUseCases}
      openaiUseCases={openaiUseCases}
    />
  );
}
