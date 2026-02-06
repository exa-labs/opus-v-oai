import Database from "better-sqlite3";
import path from "path";

const DB_PATH = path.join(import.meta.dirname, "..", "data", "sentiment.db");
const BATCH_SIZE = 100;
const API_KEY = process.env.TWITTER_API_KEY;

if (!API_KEY) {
  console.error("Set TWITTER_API_KEY in environment");
  process.exit(1);
}

function extractTweetId(url: string): string | null {
  try {
    const normalized = url.startsWith("http") ? url : `https://${url}`;
    const urlObj = new URL(normalized);
    const match = urlObj.pathname.match(/\/status(?:es)?\/(\d+)/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

async function main() {
  const db = new Database(DB_PATH);

  // Add engagement columns if missing
  for (const col of ["likes", "retweets", "replies", "views", "quotes", "bookmarks", "engagement_fetched_at"]) {
    try { db.exec(`ALTER TABLE posts ADD COLUMN ${col} ${col === "engagement_fetched_at" ? "TEXT" : "INTEGER"}`); } catch { /* exists */ }
  }

  const tweets = db.prepare(
    `SELECT id, url FROM posts WHERE source_type = 'twitter' AND engagement_fetched_at IS NULL`
  ).all() as { id: string; url: string }[];

  console.log(`[Backfill] ${tweets.length} tweets need engagement data`);

  // Extract IDs
  const fetchable: { id: string; tweetId: string }[] = [];
  let skipped = 0;
  const now = new Date().toISOString();

  for (const t of tweets) {
    const tweetId = extractTweetId(t.url);
    if (tweetId) {
      fetchable.push({ id: t.id, tweetId });
    } else {
      db.prepare(`UPDATE posts SET engagement_fetched_at = ? WHERE id = ?`).run(now, t.id);
      skipped++;
    }
  }

  console.log(`[Backfill] ${fetchable.length} fetchable, ${skipped} skipped (no tweet ID)`);

  let fetched = 0;
  let failed = 0;

  const updateStmt = db.prepare(
    `UPDATE posts SET likes = ?, retweets = ?, replies = ?, views = ?, quotes = ?, bookmarks = ?, engagement_fetched_at = ? WHERE id = ?`
  );
  const failStmt = db.prepare(`UPDATE posts SET engagement_fetched_at = ? WHERE id = ?`);

  for (let i = 0; i < fetchable.length; i += BATCH_SIZE) {
    const batch = fetchable.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(fetchable.length / BATCH_SIZE);

    console.log(`[Backfill] Batch ${batchNum}/${totalBatches} (${batch.length} tweets)`);

    try {
      const ids = batch.map(b => b.tweetId).join(",");
      const response = await fetch(
        `https://api.twitterapi.io/twitter/tweets?tweet_ids=${ids}`,
        { headers: { "X-API-Key": API_KEY, "Content-Type": "application/json" } }
      );

      if (!response.ok) {
        throw new Error(`API responded ${response.status}: ${await response.text()}`);
      }

      const data = await response.json();
      const tweetMap = new Map<string, any>();
      for (const t of data.tweets || []) {
        tweetMap.set(t.id, t);
      }

      for (const { id, tweetId } of batch) {
        const t = tweetMap.get(tweetId);
        if (t) {
          updateStmt.run(
            t.likeCount || 0, t.retweetCount || 0, t.replyCount || 0,
            t.viewCount || 0, t.quoteCount || 0, t.bookmarkCount || 0,
            now, id
          );
          fetched++;
        } else {
          failStmt.run(now, id);
          skipped++;
        }
      }

      console.log(`[Backfill] Batch ${batchNum}: ${tweetMap.size} found from API`);
    } catch (err) {
      console.error(`[Backfill] Batch ${batchNum} failed:`, err);
      for (const { id } of batch) {
        failStmt.run(now, id);
      }
      failed += batch.length;
    }
  }

  // Stats
  const topTweets = db.prepare(
    `SELECT author, likes, retweets, views FROM posts WHERE source_type = 'twitter' AND likes IS NOT NULL ORDER BY likes DESC LIMIT 10`
  ).all() as { author: string; likes: number; retweets: number; views: number }[];

  console.log(`\n[Backfill] Done. Fetched: ${fetched}, Skipped: ${skipped}, Failed: ${failed}`);
  console.log(`\nTop 10 by likes:`);
  for (const t of topTweets) {
    console.log(`  @${(t.author || "?").replace(/^@/, "")}: ${t.likes} likes, ${t.retweets} RTs, ${t.views} views`);
  }

  const over5k = db.prepare(`SELECT COUNT(*) as c FROM posts WHERE source_type = 'twitter' AND views >= 5000`).get() as { c: number };
  const under5k = db.prepare(`SELECT COUNT(*) as c FROM posts WHERE source_type = 'twitter' AND views IS NOT NULL AND views < 5000`).get() as { c: number };
  console.log(`\nViews breakdown: ${over5k.c} tweets >= 5k views, ${under5k.c} tweets < 5k views`);

  db.close();
}

main();
