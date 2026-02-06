import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import {
  createCronRun,
  completeCronRun,
  failCronRun,
  insertPost,
  getUnscoredTweets,
  getTweetsWithoutTakes,
  getTopTweetsWithTakes,
  getRecentTweets,
  getAllTweetsForSummary,
  getTweetsWithoutEngagement,
  updatePostImageUrl,
} from "@/lib/db";
import { discoverPosts } from "@/lib/exa-research";
import { analyzeAndCluster } from "@/lib/cluster";
import { scoreTweets, generateTakes } from "@/lib/score-tweets";
import { hashUrl, classifySourceType, classifySubject, truncate } from "@/lib/utils";
import { fetchEngagement } from "@/lib/twitter-engagement";
import OpenAI from "openai";

let openai: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!openai) openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
  return openai;
}

export const maxDuration = 300; // 5 min timeout for serverless

export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-cron-secret") || req.nextUrl.searchParams.get("secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const runId = uuidv4();
  console.log(`[Cron] Starting run ${runId}`);

  try {
    await createCronRun(runId);

    // 1. Discover sources via Exa
    const { allCitations, totalSearched } = await discoverPosts();
    console.log(`[Cron] ${allCitations.length} unique citations from ${totalSearched} raw results`);

    // 2. Store all citations in DB
    let newCount = 0;
    const now = new Date().toISOString();

    for (const citation of allCitations) {
      const urlHash = hashUrl(citation.url);
      const title = citation.title || "";
      const snippet = truncate(citation.snippet, 500);
      const sourceType = classifySourceType(citation.url);
      const subject = classifySubject(title, snippet || "");

      const inserted = await insertPost({
        id: urlHash,
        url: citation.url,
        title,
        snippet,
        source_type: sourceType,
        subject,
        discovered_at: now,
        cron_run_id: runId,
        published_at: citation.publishedDate || null,
        author: citation.author || null,
      });

      if (inserted) {
        newCount++;
        if (citation.image) {
          await updatePostImageUrl(urlHash, citation.image);
        }
      }
    }

    console.log(`[Cron] ${newCount} new posts stored (${allCitations.length - newCount} already existed)`);

    // 2.5. Fetch engagement metrics from TwitterAPI.io (before scoring)
    const tweetsNeedingEngagement = await getTweetsWithoutEngagement(500);
    if (tweetsNeedingEngagement.length > 0) {
      console.log(`[Cron] Fetching engagement for ${tweetsNeedingEngagement.length} tweets...`);
      const engResult = await fetchEngagement(tweetsNeedingEngagement);
      console.log(`[Cron] Engagement: ${engResult.fetched} fetched, ${engResult.skipped} skipped, ${engResult.failed} failed`);
    }

    // 3. Score unscored tweets (incremental — only new ones)
    const unscoredTweets = await getUnscoredTweets(1000);
    if (unscoredTweets.length > 0) {
      console.log(`[Cron] Scoring ${unscoredTweets.length} unscored tweets...`);
      await scoreTweets(unscoredTweets);
    }

    // 4. Generate takes for scored tweets that don't have one (incremental)
    const tweetsNeedingTakes = await getTweetsWithoutTakes(500);
    if (tweetsNeedingTakes.length > 0) {
      console.log(`[Cron] Generating takes for ${tweetsNeedingTakes.length} tweets...`);
      await generateTakes(tweetsNeedingTakes);
    }

    // 5. Build clustering input from tweets with takes + non-tweet articles
    const topTweets = await getTopTweetsWithTakes(200);
    const tweetSources = topTweets.map(t => ({
      url: t.url,
      author: (t.author || "").replace(/^@+/, ""),
      domain: extractDomain(t.url),
      take: t.take,
      imageUrl: (t as any).image_url || undefined,
    }));

    const nonTweetCitations = allCitations.filter(c => {
      const url = c.url.toLowerCase();
      return !url.includes("twitter.com") && !url.includes("x.com");
    });

    console.log(`[Cron] Clustering ${tweetSources.length} tweets (with takes) + ${nonTweetCitations.length} articles`);

    // 6. Cluster using takes (no filter step needed)
    const analysis = await analyzeAndCluster(tweetSources, nonTweetCitations);

    // 7. Pre-compute bias + summary (cached for instant page loads)
    console.log("[Cron] Pre-computing bias classifications...");
    const displayedTweets = await getRecentTweets(30);
    const biasItems: { id: string; text: string }[] = [];
    analysis.clusters.forEach((c, i) => {
      biasItems.push({ id: `cluster-${i}`, text: `${c.headline}. ${c.subheadline}` });
    });
    displayedTweets.forEach((t) => {
      biasItems.push({ id: `tweet-${t.id}`, text: `${t.author || ""}: ${t.snippet || ""}` });
    });

    let cachedBias: { items: { id: string; bias: string }[]; summary: { claude: number; openai: number; neutral: number } } = { items: [], summary: { claude: 0, openai: 0, neutral: 0 } };
    let cachedSummary: string | null = null;

    const client = getOpenAI();

    // Bias classification
    try {
      const biasItemList = biasItems.map((item, i) => `[${i}] ${item.text.slice(0, 300)}`).join("\n\n");
      const biasResponse = await client.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `You classify tech content about Claude Opus 4.6 / Anthropic vs OpenAI Codex 5.3:
- "claude": Favors Claude Opus 4.6, Anthropic, Claude Code.
- "openai": Favors OpenAI Codex 5.3, GPT, ChatGPT.
- "neutral": Stating facts without taking sides, comparing both equally.
Return valid JSON.`,
          },
          {
            role: "user",
            content: `Classify each item:\n\n${biasItemList}\n\nReturn JSON: {"results": [{"index": 0, "bias": "claude"}, ...]}`,
          },
        ],
        temperature: 0.1,
        max_tokens: 2000,
        response_format: { type: "json_object" },
      });

      const biasText = biasResponse.choices[0].message.content || "{}";
      const biasParsed = JSON.parse(biasText);
      const biasResults: { index: number; bias: string }[] = biasParsed.results || [];

      let claudeCount = 0, openaiCount = 0, neutralCount = 0;
      const biasItemsOut: { id: string; bias: string }[] = [];
      for (const { index, bias } of biasResults) {
        if (index >= 0 && index < biasItems.length) {
          const validBias = bias === "claude" || bias === "openai" ? bias : "neutral";
          biasItemsOut.push({ id: biasItems[index].id, bias: validBias });
          if (validBias === "claude") claudeCount++;
          else if (validBias === "openai") openaiCount++;
          else neutralCount++;
        }
      }
      cachedBias = { items: biasItemsOut, summary: { claude: claudeCount, openai: openaiCount, neutral: neutralCount } };
      console.log(`[Cron] Bias: ${claudeCount} claude, ${openaiCount} openai, ${neutralCount} neutral`);
    } catch (err) {
      console.error("[Cron] Bias computation failed:", err);
    }

    // Overall summary
    console.log("[Cron] Generating overall summary...");
    try {
      const allTweets = await getAllTweetsForSummary();
      const claudeTweets = allTweets.filter(t => t.subject === "claude" || t.subject === "both");
      const openaiTweets = allTweets.filter(t => t.subject === "openai" || t.subject === "both");
      const tweetList = allTweets.slice(0, 300).map((t) =>
        `@${(t.author || "unknown").replace(/^@+/, "")} [${t.subject}]: ${(t.snippet || "").slice(0, 200)}`
      ).join("\n");

      const summaryResponse = await client.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "You write crisp, editorial-quality summaries of tech community sentiment. You're specific about what people think and why. No filler, no hedging. Write like a senior editor at The Information.",
          },
          {
            role: "user",
            content: `We've analyzed ${allTweets.length} tweets about Claude Opus 4.6 / Anthropic (${claudeTweets.length} mentions) and OpenAI Codex 5.3 (${openaiTweets.length} mentions) from the past 24 hours.\n\nHere are the top ${Math.min(300, allTweets.length)} tweets by importance:\n\n${tweetList}\n\nWrite a 2-3 sentence summary of the OVERALL impression from the engineering community right now. What's the vibe? Who's winning hearts and minds? What are the key tensions or surprises?\n\nBe specific — reference actual trends, tools, or sentiments you see in the data. Don't be generic.\nReturn JSON: {"summary": "your 2-3 sentence summary here"}`,
          },
        ],
        temperature: 0.3,
        max_tokens: 500,
        response_format: { type: "json_object" },
      });

      const summaryText = summaryResponse.choices[0].message.content || "{}";
      const summaryParsed = JSON.parse(summaryText);
      cachedSummary = summaryParsed.summary || null;
      console.log("[Cron] Summary generated.");
    } catch (err) {
      console.error("[Cron] Summary generation failed:", err);
    }

    // 8. Store results with cached bias + summary
    const summaryData = {
      clusters: analysis.clusters,
      totalAnalyzed: totalSearched,
      totalKept: analysis.totalKept,
      generatedAt: new Date().toISOString(),
      cachedBias,
      cachedSummary,
    };

    await completeCronRun(runId, {
      posts_found: totalSearched,
      posts_new: newCount,
      summary: JSON.stringify(summaryData),
      claude_score: 0,
      openai_score: 0,
    });

    console.log(`[Cron] Run ${runId} completed. ${analysis.clusters.length} clusters from ${analysis.totalKept} sources.`);

    return NextResponse.json({
      success: true,
      runId,
      totalSearched,
      uniqueCitations: allCitations.length,
      postsNew: newCount,
      takesGenerated: tweetsNeedingTakes.length,
      clustersCreated: analysis.clusters.length,
      sourcesUsed: analysis.totalKept,
    });
  } catch (error) {
    console.error(`[Cron] Run ${runId} failed:`, error);
    await failCronRun(runId);
    return NextResponse.json(
      { error: "Cron run failed", details: String(error) },
      { status: 500 }
    );
  }
}

function extractDomain(url: string): string {
  try {
    const normalized = url.startsWith("http") ? url : `https://${url}`;
    return new URL(normalized).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}
