/**
 * Standalone discovery script — floods Exa with diverse queries to find ~500+ NEW tweets.
 * Guided by Latent Space intel. Does NOT trigger full cron.
 * After discovery: stores in DB, fetches engagement via TwitterAPI.io, re-scores, re-takes, re-clusters.
 */
import Exa from "exa-js";
import Database from "better-sqlite3";
import path from "path";
import crypto from "crypto";

const DB_PATH = path.join(import.meta.dirname, "..", "data", "sentiment.db");
const EXA_KEY = process.env.EXA_API_KEY!;
const TWITTER_KEY = process.env.TWITTER_API_KEY;

if (!EXA_KEY) { console.error("Set EXA_API_KEY"); process.exit(1); }

const exa = new Exa(EXA_KEY);

// Today Feb 6 2026
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

async function main() {
  const db = new Database(DB_PATH);

  // Ensure engagement columns exist
  for (const col of ["likes", "retweets", "replies", "views", "quotes", "bookmarks", "engagement_fetched_at"]) {
    try { db.exec(`ALTER TABLE posts ADD COLUMN ${col} ${col === "engagement_fetched_at" ? "TEXT" : "INTEGER"}`); } catch { /* exists */ }
  }

  const existingUrls = new Set(
    (db.prepare("SELECT url FROM posts").all() as { url: string }[]).map(r => r.url.toLowerCase().trim())
  );
  console.log(`[Flood] ${existingUrls.size} existing URLs in DB`);

  // ─── DIVERSE QUERIES ───
  // Guided by Latent Space intel: specific people, tools, benchmarks, controversies
  const twitterDomains = ["twitter.com", "x.com"];

  const searches: SearchQuery[] = [
    // TODAY Feb 6 — fresh tweets
    { query: "Claude Opus 4.6", numResults: 30, category: "tweet", startPublishedDate: TODAY },
    { query: "OpenAI Codex", numResults: 30, category: "tweet", startPublishedDate: TODAY },
    { query: "Claude Code", numResults: 25, category: "tweet", startPublishedDate: TODAY },
    { query: "Codex vs Claude coding", numResults: 25, category: "tweet", startPublishedDate: TODAY },
    { query: "best AI coding model", numResults: 20, category: "tweet", startPublishedDate: TODAY },
    { query: "Anthropic OpenAI", numResults: 20, category: "tweet", startPublishedDate: TODAY },

    // Specific people from Latent Space (find THEIR tweets)
    { query: "karpathy Claude Opus Codex", numResults: 15, includeDomains: twitterDomains, startPublishedDate: YESTERDAY },
    { query: "geohot Claude Opus tinygrad", numResults: 10, includeDomains: twitterDomains, startPublishedDate: YESTERDAY },
    { query: "fchollet Claude Opus ARC-AGI", numResults: 10, includeDomains: twitterDomains, startPublishedDate: YESTERDAY },
    { query: "swyx Claude Opus Codex AI", numResults: 10, includeDomains: twitterDomains, startPublishedDate: YESTERDAY },
    { query: "sama OpenAI Codex launch", numResults: 15, includeDomains: twitterDomains, startPublishedDate: YESTERDAY },
    { query: "Greg Brockman Codex OpenAI", numResults: 10, includeDomains: twitterDomains, startPublishedDate: YESTERDAY },

    // Specific benchmarks and technical topics
    { query: "SWE-bench Opus 4.6 score", numResults: 15, category: "tweet", startPublishedDate: YESTERDAY },
    { query: "TerminalBench Codex Opus comparison", numResults: 15, category: "tweet", startPublishedDate: YESTERDAY },
    { query: "ARC-AGI Claude Opus benchmark", numResults: 10, category: "tweet", startPublishedDate: YESTERDAY },
    { query: "GPQA Diamond Opus 4.6", numResults: 10, category: "tweet", startPublishedDate: YESTERDAY },

    // Tools and IDE comparisons (from Latent Space)
    { query: "Cursor Claude Opus Codex coding IDE", numResults: 20, category: "tweet", startPublishedDate: YESTERDAY },
    { query: "Windsurf AI coding model", numResults: 15, category: "tweet", startPublishedDate: YESTERDAY },
    { query: "Copilot Codex agent GitHub", numResults: 15, category: "tweet", startPublishedDate: YESTERDAY },
    { query: "Cline Claude Code Opus comparison", numResults: 10, category: "tweet", startPublishedDate: YESTERDAY },
    { query: "Replit Agent AI coding", numResults: 10, category: "tweet", startPublishedDate: YESTERDAY },

    // Contrarian/surprising angles from Latent Space
    { query: "Claude Code 4% GitHub commits", numResults: 15, category: "tweet", startPublishedDate: YESTERDAY },
    { query: "Claude Max pricing $100 vs Codex $20", numResults: 15, category: "tweet", startPublishedDate: YESTERDAY },
    { query: "Opus 4.6 disappointing overrated mid", numResults: 15, category: "tweet", startPublishedDate: YESTERDAY },
    { query: "Codex disappointing overrated slow", numResults: 15, category: "tweet", startPublishedDate: YESTERDAY },
    { query: "AI coding replacing developers jobs", numResults: 15, category: "tweet", startPublishedDate: YESTERDAY },
    { query: "benchmark gaming sandbagging AI models", numResults: 10, category: "tweet", startPublishedDate: YESTERDAY },

    // Specific technical claims
    { query: "Opus 1M token context window", numResults: 15, category: "tweet", startPublishedDate: YESTERDAY },
    { query: "Codex cloud sandbox environment agent", numResults: 15, category: "tweet", startPublishedDate: YESTERDAY },
    { query: "Claude Code multi-agent agentic coding", numResults: 15, category: "tweet", startPublishedDate: YESTERDAY },
    { query: "GPT-5.3 Codex GB200 NVIDIA inference", numResults: 10, category: "tweet", startPublishedDate: YESTERDAY },

    // Hot debates
    { query: "Anthropic safety alignment vs OpenAI", numResults: 15, category: "tweet", startPublishedDate: YESTERDAY },
    { query: "Claude Code ransomware jailbreak security", numResults: 10, category: "tweet", startPublishedDate: YESTERDAY },
    { query: "Gemini 3 Pro pulled system prompt", numResults: 10, category: "tweet", startPublishedDate: YESTERDAY },

    // Broader AI coding discourse
    { query: "AI pair programming 2026 developer experience", numResults: 15, category: "tweet", startPublishedDate: YESTERDAY },
    { query: "vibe coding Claude Codex ship software", numResults: 15, category: "tweet", startPublishedDate: YESTERDAY },
    { query: "agentic coding autonomous software engineer", numResults: 15, category: "tweet", startPublishedDate: YESTERDAY },

    // Domain-filtered backup (different from category=tweet)
    { query: "Opus 4.6 experience review engineer", numResults: 20, includeDomains: twitterDomains, startPublishedDate: YESTERDAY },
    { query: "Codex experience review developer", numResults: 20, includeDomains: twitterDomains, startPublishedDate: YESTERDAY },
    { query: "Claude Anthropic announcement today", numResults: 15, includeDomains: twitterDomains, startPublishedDate: TODAY },
    { query: "OpenAI Codex announcement today", numResults: 15, includeDomains: twitterDomains, startPublishedDate: TODAY },

    // Wider time window for things we might have missed
    { query: "Claude Opus 4.6 review hands-on", numResults: 20, category: "tweet", startPublishedDate: TWO_DAYS },
    { query: "OpenAI Codex hands-on first impressions", numResults: 20, category: "tweet", startPublishedDate: TWO_DAYS },

    // Web articles (non-twitter)
    { query: "Claude Opus 4.6 review analysis February 2026", numResults: 10, startPublishedDate: YESTERDAY },
    { query: "OpenAI Codex 5.3 review analysis February 2026", numResults: 10, startPublishedDate: YESTERDAY },
    { query: "Claude Code vs Codex developer comparison", numResults: 10, startPublishedDate: YESTERDAY },
  ];

  console.log(`[Flood] Running ${searches.length} Exa queries in parallel...`);

  // Run in batches of 15 to avoid rate limits
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

  // Dedup against existing DB + within results
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

  // Store in DB
  const insertStmt = db.prepare(
    `INSERT OR IGNORE INTO posts (id, url, title, snippet, source_type, subject, sentiment, discovered_at, cron_run_id, author, published_at)
     VALUES (?, ?, ?, ?, ?, ?, 'neutral', ?, 'flood-discover', ?, ?)`
  );

  const now = new Date().toISOString();
  let inserted = 0;
  for (const c of newCitations) {
    const id = hashUrl(c.url);
    const sourceType = classifySourceType(c.url);
    const subject = classifySubject(c.title, c.snippet);
    try {
      insertStmt.run(id, c.url, c.title, c.snippet.slice(0, 500), sourceType, subject, now, c.author || null, c.publishedDate || null);
      inserted++;
    } catch { /* dup */ }
  }

  console.log(`[Flood] ${inserted} new posts stored`);

  // Count new tweets for engagement fetch
  const newTweets = db.prepare(
    `SELECT id, url FROM posts WHERE source_type = 'twitter' AND engagement_fetched_at IS NULL`
  ).all() as { id: string; url: string }[];

  console.log(`[Flood] ${newTweets.length} tweets need engagement data`);

  // Fetch engagement if we have the key
  if (TWITTER_KEY && newTweets.length > 0) {
    console.log(`[Flood] Fetching engagement from TwitterAPI.io...`);

    const updateStmt = db.prepare(
      `UPDATE posts SET likes = ?, retweets = ?, replies = ?, views = ?, quotes = ?, bookmarks = ?, engagement_fetched_at = ? WHERE id = ?`
    );
    const failStmt = db.prepare(`UPDATE posts SET engagement_fetched_at = ? WHERE id = ?`);

    let fetched = 0;
    let skipped = 0;

    // Extract tweet IDs
    const fetchable: { id: string; tweetId: string }[] = [];
    for (const t of newTweets) {
      try {
        const normalized = t.url.startsWith("http") ? t.url : `https://${t.url}`;
        const match = new URL(normalized).pathname.match(/\/status(?:es)?\/(\d+)/);
        if (match) {
          fetchable.push({ id: t.id, tweetId: match[1] });
        } else {
          failStmt.run(now, t.id);
          skipped++;
        }
      } catch {
        failStmt.run(now, t.id);
        skipped++;
      }
    }

    // Batch fetch
    for (let i = 0; i < fetchable.length; i += 100) {
      const batch = fetchable.slice(i, i + 100);
      const batchNum = Math.floor(i / 100) + 1;
      const totalBatches = Math.ceil(fetchable.length / 100);
      console.log(`[Engagement] Batch ${batchNum}/${totalBatches} (${batch.length} tweets)`);

      try {
        const ids = batch.map(b => b.tweetId).join(",");
        const resp = await fetch(
          `https://api.twitterapi.io/twitter/tweets?tweet_ids=${ids}`,
          { headers: { "X-API-Key": TWITTER_KEY, "Content-Type": "application/json" } }
        );
        if (!resp.ok) throw new Error(`API: ${resp.status}`);
        const data = await resp.json();
        const tweetMap = new Map<string, any>();
        for (const t of data.tweets || []) tweetMap.set(t.id, t);

        for (const { id, tweetId } of batch) {
          const t = tweetMap.get(tweetId);
          if (t) {
            updateStmt.run(t.likeCount || 0, t.retweetCount || 0, t.replyCount || 0, t.viewCount || 0, t.quoteCount || 0, t.bookmarkCount || 0, now, id);
            fetched++;
          } else {
            failStmt.run(now, id);
            skipped++;
          }
        }
      } catch (err) {
        console.error(`[Engagement] Batch ${batchNum} failed:`, err);
        for (const { id } of batch) failStmt.run(now, id);
      }
    }

    console.log(`[Engagement] Done. Fetched: ${fetched}, Skipped: ${skipped}`);
  }

  // Final stats
  const totalPosts = (db.prepare("SELECT COUNT(*) as c FROM posts").get() as { c: number }).c;
  const totalTweets = (db.prepare("SELECT COUNT(*) as c FROM posts WHERE source_type = 'twitter'").get() as { c: number }).c;
  const over5k = (db.prepare("SELECT COUNT(*) as c FROM posts WHERE source_type = 'twitter' AND views >= 5000").get() as { c: number }).c;
  const withEngagement = (db.prepare("SELECT COUNT(*) as c FROM posts WHERE engagement_fetched_at IS NOT NULL").get() as { c: number }).c;

  console.log(`\n[Flood] Final DB stats:`);
  console.log(`  Total posts: ${totalPosts}`);
  console.log(`  Total tweets: ${totalTweets}`);
  console.log(`  Tweets with 5k+ views: ${over5k}`);
  console.log(`  Posts with engagement data: ${withEngagement}`);

  // Show top new finds
  const topNew = db.prepare(
    `SELECT author, likes, views, snippet FROM posts WHERE cron_run_id = 'flood-discover' AND source_type = 'twitter' AND likes IS NOT NULL ORDER BY likes DESC LIMIT 15`
  ).all() as { author: string; likes: number; views: number; snippet: string }[];

  if (topNew.length > 0) {
    console.log(`\nTop new finds by likes:`);
    for (const t of topNew) {
      console.log(`  @${(t.author || "?").replace(/^@/, "")}: ${t.likes} likes, ${t.views} views — ${(t.snippet || "").slice(0, 80)}...`);
    }
  }

  db.close();
  console.log(`\n[Flood] Done! Run the cron to re-score, re-take, and re-cluster.`);
}

main().catch(console.error);
