/**
 * Backfill engagement for tweets missing it + refresh tweets older than 1 hour.
 * Efficient: only fetches what's needed.
 */
import Database from "better-sqlite3";
import path from "path";

const DB_PATH = path.join(import.meta.dirname, "..", "data", "sentiment.db");
const API_KEY = process.env.TWITTER_API_KEY;

if (!API_KEY) { console.error("Set TWITTER_API_KEY"); process.exit(1); }

function extractTweetId(url: string): string | null {
  try {
    const normalized = url.startsWith("http") ? url : `https://${url}`;
    const match = new URL(normalized).pathname.match(/\/status(?:es)?\/(\d+)/);
    return match ? match[1] : null;
  } catch { return null; }
}

async function main() {
  const db = new Database(DB_PATH);

  // Get tweets that either have no engagement OR were fetched > 1 hour ago (refresh)
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const tweets = db.prepare(
    `SELECT id, url FROM posts WHERE source_type = 'twitter'
     AND (engagement_fetched_at IS NULL OR (engagement_fetched_at < ? AND likes IS NULL))`
  ).all(oneHourAgo) as { id: string; url: string }[];

  console.log(`[Backfill] ${tweets.length} tweets need engagement (missing or stale)`);

  if (tweets.length === 0) {
    console.log("[Backfill] Nothing to do!");
    db.close();
    return;
  }

  const now = new Date().toISOString();
  const fetchable: { id: string; tweetId: string }[] = [];
  let skipped = 0;

  for (const t of tweets) {
    const tweetId = extractTweetId(t.url);
    if (tweetId) {
      fetchable.push({ id: t.id, tweetId });
    } else {
      db.prepare(`UPDATE posts SET engagement_fetched_at = ? WHERE id = ?`).run(now, t.id);
      skipped++;
    }
  }

  console.log(`[Backfill] ${fetchable.length} fetchable, ${skipped} skipped`);

  const updateStmt = db.prepare(
    `UPDATE posts SET likes = ?, retweets = ?, replies = ?, views = ?, quotes = ?, bookmarks = ?, engagement_fetched_at = ? WHERE id = ?`
  );
  const failStmt = db.prepare(`UPDATE posts SET engagement_fetched_at = ? WHERE id = ?`);

  let fetched = 0;
  let failed = 0;

  for (let i = 0; i < fetchable.length; i += 100) {
    const batch = fetchable.slice(i, i + 100);
    const batchNum = Math.floor(i / 100) + 1;
    const totalBatches = Math.ceil(fetchable.length / 100);
    console.log(`[Backfill] Batch ${batchNum}/${totalBatches} (${batch.length} tweets)`);

    try {
      const ids = batch.map(b => b.tweetId).join(",");
      const resp = await fetch(
        `https://api.twitterapi.io/twitter/tweets?tweet_ids=${ids}`,
        { headers: { "X-API-Key": API_KEY, "Content-Type": "application/json" } }
      );
      if (!resp.ok) throw new Error(`API: ${resp.status} ${await resp.text()}`);
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
      console.log(`[Backfill] Batch ${batchNum}: ${tweetMap.size} found`);
    } catch (err) {
      console.error(`[Backfill] Batch ${batchNum} failed:`, err);
      for (const { id } of batch) failStmt.run(now, id);
      failed += batch.length;
    }
  }

  // Stats
  const over5k = (db.prepare(`SELECT COUNT(*) as c FROM posts WHERE source_type = 'twitter' AND views >= 5000`).get() as { c: number }).c;
  const withEng = (db.prepare(`SELECT COUNT(*) as c FROM posts WHERE engagement_fetched_at IS NOT NULL`).get() as { c: number }).c;

  const topNew = db.prepare(
    `SELECT author, likes, retweets, views FROM posts WHERE source_type = 'twitter' AND likes IS NOT NULL ORDER BY likes DESC LIMIT 15`
  ).all() as { author: string; likes: number; retweets: number; views: number }[];

  console.log(`\n[Backfill] Done. Fetched: ${fetched}, Skipped: ${skipped}, Failed: ${failed}`);
  console.log(`Tweets with 5k+ views: ${over5k}`);
  console.log(`Posts with engagement: ${withEng}`);
  console.log(`\nTop 15 by likes:`);
  for (const t of topNew) {
    console.log(`  @${(t.author || "?").replace(/^@/, "")}: ${t.likes} likes, ${t.retweets} RTs, ${t.views} views`);
  }

  db.close();
}

main().catch(console.error);
