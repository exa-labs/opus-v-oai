/**
 * Standalone discovery script — floods Exa with diverse queries to find ~500+ NEW tweets.
 * After discovery: stores in DB, fetches engagement via TwitterAPI.io.
 * Usage: npx tsx scripts/flood-discover.ts
 */
import Exa from "exa-js";
import { neon } from "@neondatabase/serverless";
import crypto from "crypto";

const sql = neon(process.env.DATABASE_URL!);
const EXA_KEY = process.env.EXA_API_KEY!;
const TWITTER_KEY = process.env.TWITTER_API_KEY;

if (!EXA_KEY) { console.error("Set EXA_API_KEY"); process.exit(1); }

const exa = new Exa(EXA_KEY);

const TODAY = "2026-02-06T00:00:00.000Z";
const YESTERDAY = "2026-02-05T00:00:00.000Z";
const TWO_DAYS = "2026-02-04T00:00:00.000Z";

interface SearchQuery {
  query: string;
  numResults: number;
  category?: string;
  includeDomains?: string[];
  startPublishedDate?: string;
}

interface Citation {
  url: string;
  title: string;
  snippet: string;
  publishedDate?: string;
  author?: string;
}

async function runSearch(sq: SearchQuery): Promise<Citation[]> {
  try {
    const params: Record<string, unknown> = {
      numResults: sq.numResults,
      text: true,
      type: "auto" as const,
      startPublishedDate: sq.startPublishedDate || YESTERDAY,
    };
    if (sq.category) params.category = sq.category;
    if (sq.includeDomains) params.includeDomains = sq.includeDomains;

    const response = await exa.searchAndContents(
      sq.query,
      params as Parameters<typeof exa.searchAndContents>[1]
    );

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (response.results || []).map((r: any) => ({
      url: r.url,
      title: r.title || "",
      snippet: (r.text || "").slice(0, 500),
      publishedDate: r.publishedDate,
      author: r.author,
    }));
  } catch (err) {
    console.error(`[Exa] Failed: "${sq.query}":`, err);
    return [];
  }
}

const JUNK = [
  "composio.dev", "toolify.ai", "theresanaiforthat.com", "aimodels.fyi",
  "gptstore.ai", "opentools.ai", "aiparabellum.com", "marktechpost.com",
  "analyticsinsight.net", "decrypt.co", "yahoo.com/lifestyle", "medium.com/@",
  "aiskill.market", "claudefa.st", "datacamp.com", "geeksforgeeks.org", "zapier.com/blog",
];

function isJunk(url: string): boolean {
  const l = url.toLowerCase();
  return JUNK.some(p => l.includes(p));
}

function hashUrl(url: string): string {
  return crypto.createHash("sha256").update(url.toLowerCase().trim()).digest("hex").slice(0, 16);
}

function classifySourceType(url: string): string {
  const l = url.toLowerCase();
  if (l.includes("twitter.com") || l.includes("x.com")) return "twitter";
  if (l.includes("reddit.com")) return "reddit";
  if (l.includes("news.ycombinator.com")) return "forum";
  if (l.includes("techcrunch") || l.includes("theverge") || l.includes("arstechnica")) return "news";
  return "blog";
}

function classifySubject(title: string, snippet: string): string {
  const t = `${title} ${snippet}`.toLowerCase();
  const hasClaude = /claude|anthropic|opus\s*4\.6/i.test(t);
  const hasOpenai = /openai|codex|gpt|chatgpt|o3|o4/i.test(t);
  if (hasClaude && hasOpenai) return "both";
  if (hasClaude) return "claude";
  if (hasOpenai) return "openai";
  return "both";
}

function extractTweetId(url: string): string | null {
  try {
    const normalized = url.startsWith("http") ? url : `https://${url}`;
    const match = new URL(normalized).pathname.match(/\/status(?:es)?\/(\d+)/);
    return match ? match[1] : null;
  } catch { return null; }
}

async function main() {
  const existingRows = await sql`SELECT url FROM posts` as { url: string }[];
  const existingUrls = new Set(existingRows.map(r => r.url.toLowerCase().trim()));
  console.log(`[Flood] ${existingUrls.size} existing URLs in DB`);

  const twitterDomains = ["twitter.com", "x.com"];

  const searches: SearchQuery[] = [
    { query: "Claude Opus 4.6", numResults: 30, category: "tweet", startPublishedDate: TODAY },
    { query: "OpenAI Codex", numResults: 30, category: "tweet", startPublishedDate: TODAY },
    { query: "Claude Code", numResults: 25, category: "tweet", startPublishedDate: TODAY },
    { query: "Codex vs Claude coding", numResults: 25, category: "tweet", startPublishedDate: TODAY },
    { query: "best AI coding model", numResults: 20, category: "tweet", startPublishedDate: TODAY },
    { query: "Anthropic OpenAI", numResults: 20, category: "tweet", startPublishedDate: TODAY },
    { query: "karpathy Claude Opus Codex", numResults: 15, includeDomains: twitterDomains, startPublishedDate: YESTERDAY },
    { query: "geohot Claude Opus tinygrad", numResults: 10, includeDomains: twitterDomains, startPublishedDate: YESTERDAY },
    { query: "fchollet Claude Opus ARC-AGI", numResults: 10, includeDomains: twitterDomains, startPublishedDate: YESTERDAY },
    { query: "swyx Claude Opus Codex AI", numResults: 10, includeDomains: twitterDomains, startPublishedDate: YESTERDAY },
    { query: "sama OpenAI Codex launch", numResults: 15, includeDomains: twitterDomains, startPublishedDate: YESTERDAY },
    { query: "Greg Brockman Codex OpenAI", numResults: 10, includeDomains: twitterDomains, startPublishedDate: YESTERDAY },
    { query: "SWE-bench Opus 4.6 score", numResults: 15, category: "tweet", startPublishedDate: YESTERDAY },
    { query: "TerminalBench Codex Opus comparison", numResults: 15, category: "tweet", startPublishedDate: YESTERDAY },
    { query: "ARC-AGI Claude Opus benchmark", numResults: 10, category: "tweet", startPublishedDate: YESTERDAY },
    { query: "GPQA Diamond Opus 4.6", numResults: 10, category: "tweet", startPublishedDate: YESTERDAY },
    { query: "Cursor Claude Opus Codex coding IDE", numResults: 20, category: "tweet", startPublishedDate: YESTERDAY },
    { query: "Windsurf AI coding model", numResults: 15, category: "tweet", startPublishedDate: YESTERDAY },
    { query: "Copilot Codex agent GitHub", numResults: 15, category: "tweet", startPublishedDate: YESTERDAY },
    { query: "Cline Claude Code Opus comparison", numResults: 10, category: "tweet", startPublishedDate: YESTERDAY },
    { query: "Replit Agent AI coding", numResults: 10, category: "tweet", startPublishedDate: YESTERDAY },
    { query: "Claude Code 4% GitHub commits", numResults: 15, category: "tweet", startPublishedDate: YESTERDAY },
    { query: "Claude Max pricing $100 vs Codex $20", numResults: 15, category: "tweet", startPublishedDate: YESTERDAY },
    { query: "Opus 4.6 disappointing overrated mid", numResults: 15, category: "tweet", startPublishedDate: YESTERDAY },
    { query: "Codex disappointing overrated slow", numResults: 15, category: "tweet", startPublishedDate: YESTERDAY },
    { query: "AI coding replacing developers jobs", numResults: 15, category: "tweet", startPublishedDate: YESTERDAY },
    { query: "benchmark gaming sandbagging AI models", numResults: 10, category: "tweet", startPublishedDate: YESTERDAY },
    { query: "Opus 1M token context window", numResults: 15, category: "tweet", startPublishedDate: YESTERDAY },
    { query: "Codex cloud sandbox environment agent", numResults: 15, category: "tweet", startPublishedDate: YESTERDAY },
    { query: "Claude Code multi-agent agentic coding", numResults: 15, category: "tweet", startPublishedDate: YESTERDAY },
    { query: "GPT-5.3 Codex GB200 NVIDIA inference", numResults: 10, category: "tweet", startPublishedDate: YESTERDAY },
    { query: "Anthropic safety alignment vs OpenAI", numResults: 15, category: "tweet", startPublishedDate: YESTERDAY },
    { query: "Claude Code ransomware jailbreak security", numResults: 10, category: "tweet", startPublishedDate: YESTERDAY },
    { query: "Gemini 3 Pro pulled system prompt", numResults: 10, category: "tweet", startPublishedDate: YESTERDAY },
    { query: "AI pair programming 2026 developer experience", numResults: 15, category: "tweet", startPublishedDate: YESTERDAY },
    { query: "vibe coding Claude Codex ship software", numResults: 15, category: "tweet", startPublishedDate: YESTERDAY },
    { query: "agentic coding autonomous software engineer", numResults: 15, category: "tweet", startPublishedDate: YESTERDAY },
    { query: "Opus 4.6 experience review engineer", numResults: 20, includeDomains: twitterDomains, startPublishedDate: YESTERDAY },
    { query: "Codex experience review developer", numResults: 20, includeDomains: twitterDomains, startPublishedDate: YESTERDAY },
    { query: "Claude Anthropic announcement today", numResults: 15, includeDomains: twitterDomains, startPublishedDate: TODAY },
    { query: "OpenAI Codex announcement today", numResults: 15, includeDomains: twitterDomains, startPublishedDate: TODAY },
    { query: "Claude Opus 4.6 review hands-on", numResults: 20, category: "tweet", startPublishedDate: TWO_DAYS },
    { query: "OpenAI Codex hands-on first impressions", numResults: 20, category: "tweet", startPublishedDate: TWO_DAYS },
    { query: "Claude Opus 4.6 review analysis February 2026", numResults: 10, startPublishedDate: YESTERDAY },
    { query: "OpenAI Codex 5.3 review analysis February 2026", numResults: 10, startPublishedDate: YESTERDAY },
    { query: "Claude Code vs Codex developer comparison", numResults: 10, startPublishedDate: YESTERDAY },
  ];

  console.log(`[Flood] Running ${searches.length} Exa queries in parallel...`);

  const allResults: Citation[] = [];
  const BATCH = 15;
  for (let i = 0; i < searches.length; i += BATCH) {
    const batch = searches.slice(i, i + BATCH);
    const batchNum = Math.floor(i / BATCH) + 1;
    const totalBatches = Math.ceil(searches.length / BATCH);
    console.log(`[Flood] Search batch ${batchNum}/${totalBatches} (${batch.length} queries)`);
    const results = await Promise.all(batch.map(runSearch));
    allResults.push(...results.flat());
  }

  console.log(`[Flood] ${allResults.length} raw results`);

  const seen = new Set<string>();
  const newCitations: Citation[] = [];
  for (const c of allResults) {
    const key = c.url.toLowerCase().trim();
    if (!seen.has(key) && !existingUrls.has(key) && !isJunk(c.url)) {
      seen.add(key);
      newCitations.push(c);
    }
  }

  console.log(`[Flood] ${newCitations.length} genuinely new citations (after dedup against DB)`);

  const now = new Date().toISOString();
  let inserted = 0;
  for (const c of newCitations) {
    const id = hashUrl(c.url);
    const sourceType = classifySourceType(c.url);
    const subject = classifySubject(c.title, c.snippet);
    try {
      await sql`INSERT INTO posts (id, url, title, snippet, source_type, subject, sentiment, discovered_at, cron_run_id, author, published_at)
         VALUES (${id}, ${c.url}, ${c.title}, ${c.snippet.slice(0, 500)}, ${sourceType}, ${subject}, 'neutral', ${now}, 'flood-discover', ${c.author || null}, ${c.publishedDate || null})
         ON CONFLICT (id) DO NOTHING`;
      inserted++;
    } catch { /* dup */ }
  }

  console.log(`[Flood] ${inserted} new posts stored`);

  // Fetch engagement for new tweets
  const newTweets = await sql`SELECT id, url FROM posts WHERE source_type = 'twitter' AND engagement_fetched_at IS NULL` as { id: string; url: string }[];
  console.log(`[Flood] ${newTweets.length} tweets need engagement data`);

  if (TWITTER_KEY && newTweets.length > 0) {
    console.log(`[Flood] Fetching engagement from TwitterAPI.io...`);

    let fetched = 0;
    let skipped = 0;

    const fetchable: { id: string; tweetId: string }[] = [];
    for (const t of newTweets) {
      const tid = extractTweetId(t.url);
      if (tid) {
        fetchable.push({ id: t.id, tweetId: tid });
      } else {
        await sql`UPDATE posts SET engagement_fetched_at = ${now} WHERE id = ${t.id}`;
        skipped++;
      }
    }

    for (let i = 0; i < fetchable.length; i += 100) {
      const batch = fetchable.slice(i, i + 100);
      const batchNum = Math.floor(i / 100) + 1;
      const totalBatches = Math.ceil(fetchable.length / 100);
      console.log(`[Engagement] Batch ${batchNum}/${totalBatches} (${batch.length} tweets)`);

      try {
        const ids = batch.map(b => b.tweetId).join(",");
        const resp = await fetch(
          `https://api.twitterapi.io/twitter/tweets?tweet_ids=${ids}`,
          { headers: { "X-API-Key": TWITTER_KEY!, "Content-Type": "application/json" } }
        );
        if (!resp.ok) throw new Error(`API: ${resp.status}`);
        const data = await resp.json();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const tweetMap = new Map<string, any>();
        for (const t of data.tweets || []) tweetMap.set(t.id, t);

        for (const { id, tweetId } of batch) {
          const t = tweetMap.get(tweetId);
          if (t) {
            await sql`UPDATE posts SET likes = ${t.likeCount || 0}, retweets = ${t.retweetCount || 0}, replies = ${t.replyCount || 0}, views = ${t.viewCount || 0}, quotes = ${t.quoteCount || 0}, bookmarks = ${t.bookmarkCount || 0}, engagement_fetched_at = ${now} WHERE id = ${id}`;
            fetched++;
          } else {
            await sql`UPDATE posts SET engagement_fetched_at = ${now} WHERE id = ${id}`;
            skipped++;
          }
        }
      } catch (err) {
        console.error(`[Engagement] Batch ${batchNum} failed:`, err);
        for (const { id } of batch) await sql`UPDATE posts SET engagement_fetched_at = ${now} WHERE id = ${id}`;
      }
    }

    console.log(`[Engagement] Done. Fetched: ${fetched}, Skipped: ${skipped}`);
  }

  // Final stats
  const [totalPosts] = await sql`SELECT COUNT(*) as c FROM posts` as { c: number }[];
  const [totalTweets] = await sql`SELECT COUNT(*) as c FROM posts WHERE source_type = 'twitter'` as { c: number }[];
  const [over5k] = await sql`SELECT COUNT(*) as c FROM posts WHERE source_type = 'twitter' AND views >= 5000` as { c: number }[];
  const [withEngagement] = await sql`SELECT COUNT(*) as c FROM posts WHERE engagement_fetched_at IS NOT NULL` as { c: number }[];

  console.log(`\n[Flood] Final DB stats:`);
  console.log(`  Total posts: ${totalPosts.c}`);
  console.log(`  Total tweets: ${totalTweets.c}`);
  console.log(`  Tweets with 5k+ views: ${over5k.c}`);
  console.log(`  Posts with engagement data: ${withEngagement.c}`);

  const topNew = await sql`SELECT author, likes, views, snippet FROM posts WHERE cron_run_id = 'flood-discover' AND source_type = 'twitter' AND likes IS NOT NULL ORDER BY likes DESC LIMIT 15` as { author: string; likes: number; views: number; snippet: string }[];

  if (topNew.length > 0) {
    console.log(`\nTop new finds by likes:`);
    for (const t of topNew) {
      console.log(`  @${(t.author || "?").replace(/^@/, "")}: ${t.likes} likes, ${t.views} views — ${(t.snippet || "").slice(0, 80)}...`);
    }
  }

  console.log(`\n[Flood] Done! Run the cron to re-score, re-take, and re-cluster.`);
}

main().catch(console.error);
