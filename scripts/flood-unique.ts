/**
 * Targeted discovery for unique use cases, wild demos, head-to-head competitions.
 * Looking for the interesting stuff, not generic "model is good" tweets.
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
const TODAY = "2026-02-06T00:00:00.000Z";
const YESTERDAY = "2026-02-05T00:00:00.000Z";
const THREE_DAYS = "2026-02-03T00:00:00.000Z";

interface SearchQuery {
  query: string;
  numResults: number;
  category?: string;
  includeDomains?: string[];
  startPublishedDate?: string;
}

interface Citation { url: string; title: string; snippet: string; publishedDate?: string; author?: string; }

async function runSearch(sq: SearchQuery): Promise<Citation[]> {
  try {
    const params: Record<string, unknown> = {
      numResults: sq.numResults, text: true, type: "auto" as const,
      startPublishedDate: sq.startPublishedDate || YESTERDAY,
    };
    if (sq.category) params.category = sq.category;
    if (sq.includeDomains) params.includeDomains = sq.includeDomains;
    const response = await exa.searchAndContents(sq.query, params as Parameters<typeof exa.searchAndContents>[1]);
    return (response.results || []).map((r: any) => ({
      url: r.url, title: r.title || "", snippet: (r.text || "").slice(0, 500),
      publishedDate: r.publishedDate, author: r.author,
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
function isJunk(url: string): boolean { return JUNK.some(p => url.toLowerCase().includes(p)); }
function hashUrl(url: string): string { return crypto.createHash("sha256").update(url.toLowerCase().trim()).digest("hex").slice(0, 16); }
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
  const db = new Database(DB_PATH);
  for (const col of ["likes", "retweets", "replies", "views", "quotes", "bookmarks", "engagement_fetched_at"]) {
    try { db.exec(`ALTER TABLE posts ADD COLUMN ${col} ${col === "engagement_fetched_at" ? "TEXT" : "INTEGER"}`); } catch { /* exists */ }
  }

  const existingUrls = new Set(
    (db.prepare("SELECT url FROM posts").all() as { url: string }[]).map(r => r.url.toLowerCase().trim())
  );
  console.log(`[Flood] ${existingUrls.size} existing URLs in DB`);

  const tw = ["twitter.com", "x.com"];

  const searches: SearchQuery[] = [
    // ── WILD USE CASES / DEMOS ──
    { query: "Claude built C compiler from scratch autonomous", numResults: 20, category: "tweet", startPublishedDate: THREE_DAYS },
    { query: "C compiler Claude Code 100K lines Linux boots", numResults: 15, category: "tweet", startPublishedDate: THREE_DAYS },
    { query: "Claude Code built entire app from scratch", numResults: 20, category: "tweet", startPublishedDate: YESTERDAY },
    { query: "Codex built entire project autonomously demo", numResults: 20, category: "tweet", startPublishedDate: YESTERDAY },
    { query: "Claude Code shipped production code real project", numResults: 15, category: "tweet", startPublishedDate: YESTERDAY },
    { query: "vibe coding Claude shipped app one prompt", numResults: 15, category: "tweet", startPublishedDate: YESTERDAY },
    { query: "built this with Claude Code in one hour", numResults: 15, category: "tweet", startPublishedDate: YESTERDAY },
    { query: "Codex one shot prompt built entire feature", numResults: 15, category: "tweet", startPublishedDate: YESTERDAY },
    { query: "Claude Code refactored massive codebase", numResults: 15, category: "tweet", startPublishedDate: YESTERDAY },

    // ── HEAD-TO-HEAD COMPETITIONS ──
    { query: "gave same prompt to Claude and Codex results", numResults: 20, category: "tweet", startPublishedDate: YESTERDAY },
    { query: "Claude vs Codex same task head to head comparison", numResults: 20, category: "tweet", startPublishedDate: YESTERDAY },
    { query: "tested Claude and GPT on the same problem", numResults: 15, category: "tweet", startPublishedDate: YESTERDAY },
    { query: "Claude Code vs Codex side by side which won", numResults: 15, category: "tweet", startPublishedDate: YESTERDAY },
    { query: "ran both Claude and ChatGPT on my codebase", numResults: 15, category: "tweet", startPublishedDate: THREE_DAYS },
    { query: "Opus vs GPT coding challenge results", numResults: 15, category: "tweet", startPublishedDate: THREE_DAYS },

    // ── SPECIFIC TECHNICAL FEATS ──
    { query: "Claude 4% GitHub commits AI writing code", numResults: 15, category: "tweet", startPublishedDate: YESTERDAY },
    { query: "Claude Code multi-agent parallel tasks", numResults: 15, category: "tweet", startPublishedDate: YESTERDAY },
    { query: "Codex sandbox cloud environment autonomous", numResults: 15, category: "tweet", startPublishedDate: YESTERDAY },
    { query: "Opus 1M token context window entire codebase", numResults: 15, category: "tweet", startPublishedDate: YESTERDAY },
    { query: "Claude Code catches own mistakes self-correcting", numResults: 10, category: "tweet", startPublishedDate: YESTERDAY },
    { query: "Codex ran tests fixed bugs automatically", numResults: 10, category: "tweet", startPublishedDate: YESTERDAY },

    // ── SURPRISING / CONTRARIAN ──
    { query: "switched from Claude to Codex or Codex to Claude why", numResults: 15, category: "tweet", startPublishedDate: THREE_DAYS },
    { query: "Claude Code broke my project disaster", numResults: 10, category: "tweet", startPublishedDate: THREE_DAYS },
    { query: "Codex failed badly couldn't complete task", numResults: 10, category: "tweet", startPublishedDate: THREE_DAYS },
    { query: "AI coding overrated still need humans", numResults: 10, category: "tweet", startPublishedDate: YESTERDAY },
    { query: "Claude ransomware security vulnerability jailbreak", numResults: 10, category: "tweet", startPublishedDate: THREE_DAYS },
    { query: "Gemini 3 Pro pulled recalled broken", numResults: 10, category: "tweet", startPublishedDate: THREE_DAYS },

    // ── PRICING / BUSINESS ANGLE ──
    { query: "Claude Max $100 month worth it vs Codex $20", numResults: 15, category: "tweet", startPublishedDate: THREE_DAYS },
    { query: "Claude Pro Codex Pro pricing comparison value", numResults: 10, category: "tweet", startPublishedDate: THREE_DAYS },
    { query: "paying for AI coding tools ROI productivity", numResults: 10, category: "tweet", startPublishedDate: YESTERDAY },

    // ── DEVELOPER WORKFLOW / REAL STORIES ──
    { query: "my workflow with Claude Code daily driver", numResults: 15, includeDomains: tw, startPublishedDate: THREE_DAYS },
    { query: "replaced Copilot with Claude Code experience", numResults: 15, includeDomains: tw, startPublishedDate: THREE_DAYS },
    { query: "using Codex in production real codebase", numResults: 15, includeDomains: tw, startPublishedDate: THREE_DAYS },
    { query: "Cursor Windsurf Claude Codex which IDE agent", numResults: 15, includeDomains: tw, startPublishedDate: YESTERDAY },

    // ── TODAY Feb 6 fresh ──
    { query: "Claude Opus Codex today experience", numResults: 20, category: "tweet", startPublishedDate: TODAY },
    { query: "AI coding model shipped built demo today", numResults: 15, category: "tweet", startPublishedDate: TODAY },

    // ── WEB ARTICLES about unique use cases ──
    { query: "Claude Code C compiler autonomous programming", numResults: 10, startPublishedDate: THREE_DAYS },
    { query: "Codex vs Claude Code head to head developer comparison", numResults: 10, startPublishedDate: THREE_DAYS },
    { query: "wild AI coding demos Claude Codex built from scratch", numResults: 10, startPublishedDate: YESTERDAY },
  ];

  console.log(`[Flood] Running ${searches.length} targeted queries...`);

  const allResults: Citation[] = [];
  const BATCH = 15;
  for (let i = 0; i < searches.length; i += BATCH) {
    const batch = searches.slice(i, i + BATCH);
    const batchNum = Math.floor(i / BATCH) + 1;
    console.log(`[Flood] Search batch ${batchNum}/${Math.ceil(searches.length / BATCH)} (${batch.length} queries)`);
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

  console.log(`[Flood] ${newCitations.length} genuinely new citations`);

  const insertStmt = db.prepare(
    `INSERT OR IGNORE INTO posts (id, url, title, snippet, source_type, subject, sentiment, discovered_at, cron_run_id, author, published_at)
     VALUES (?, ?, ?, ?, ?, ?, 'neutral', ?, 'flood-unique', ?, ?)`
  );
  const now = new Date().toISOString();
  let inserted = 0;
  for (const c of newCitations) {
    const id = hashUrl(c.url);
    try {
      insertStmt.run(id, c.url, c.title, c.snippet.slice(0, 500), classifySourceType(c.url), classifySubject(c.title, c.snippet), now, c.author || null, c.publishedDate || null);
      inserted++;
    } catch { /* dup */ }
  }
  console.log(`[Flood] ${inserted} new posts stored`);

  // Fetch engagement for new tweets
  const newTweets = db.prepare(
    `SELECT id, url FROM posts WHERE source_type = 'twitter' AND likes IS NULL AND engagement_fetched_at IS NULL`
  ).all() as { id: string; url: string }[];

  console.log(`[Flood] ${newTweets.length} tweets need engagement`);

  if (TWITTER_KEY && newTweets.length > 0) {
    const updateStmt = db.prepare(
      `UPDATE posts SET likes = ?, retweets = ?, replies = ?, views = ?, quotes = ?, bookmarks = ?, engagement_fetched_at = ? WHERE id = ?`
    );
    const failStmt = db.prepare(`UPDATE posts SET engagement_fetched_at = ? WHERE id = ?`);
    let fetched = 0, skipped = 0;

    const fetchable: { id: string; tweetId: string }[] = [];
    for (const t of newTweets) {
      const tid = extractTweetId(t.url);
      if (tid) fetchable.push({ id: t.id, tweetId: tid });
      else { failStmt.run(now, t.id); skipped++; }
    }

    for (let i = 0; i < fetchable.length; i += 100) {
      const batch = fetchable.slice(i, i + 100);
      const bn = Math.floor(i / 100) + 1;
      console.log(`[Engagement] Batch ${bn}/${Math.ceil(fetchable.length / 100)} (${batch.length})`);
      try {
        const resp = await fetch(
          `https://api.twitterapi.io/twitter/tweets?tweet_ids=${batch.map(b => b.tweetId).join(",")}`,
          { headers: { "X-API-Key": TWITTER_KEY, "Content-Type": "application/json" } }
        );
        if (!resp.ok) throw new Error(`API: ${resp.status}`);
        const data = await resp.json();
        const map = new Map<string, any>();
        for (const t of data.tweets || []) map.set(t.id, t);
        for (const { id, tweetId } of batch) {
          const t = map.get(tweetId);
          if (t) { updateStmt.run(t.likeCount||0, t.retweetCount||0, t.replyCount||0, t.viewCount||0, t.quoteCount||0, t.bookmarkCount||0, now, id); fetched++; }
          else { failStmt.run(now, id); skipped++; }
        }
      } catch (err) {
        console.error(`[Engagement] Batch ${bn} failed:`, err);
        for (const { id } of batch) failStmt.run(now, id);
      }
    }
    console.log(`[Engagement] Fetched: ${fetched}, Skipped: ${skipped}`);
  }

  // Final stats
  const totalPosts = (db.prepare("SELECT COUNT(*) as c FROM posts").get() as { c: number }).c;
  const totalTweets = (db.prepare("SELECT COUNT(*) as c FROM posts WHERE source_type = 'twitter'").get() as { c: number }).c;
  const over5k = (db.prepare("SELECT COUNT(*) as c FROM posts WHERE source_type = 'twitter' AND views >= 5000").get() as { c: number }).c;

  console.log(`\n[Flood] Final: ${totalPosts} posts, ${totalTweets} tweets, ${over5k} with 5k+ views`);

  const topNew = db.prepare(
    `SELECT author, likes, views, snippet FROM posts WHERE cron_run_id = 'flood-unique' AND source_type = 'twitter' AND likes IS NOT NULL ORDER BY likes DESC LIMIT 20`
  ).all() as { author: string; likes: number; views: number; snippet: string }[];
  if (topNew.length > 0) {
    console.log(`\nTop new unique finds:`);
    for (const t of topNew) {
      console.log(`  @${(t.author||"?").replace(/^@/,"")}: ${t.likes} likes, ${t.views} views — ${(t.snippet||"").slice(0,100)}...`);
    }
  }

  db.close();
}

main().catch(console.error);
