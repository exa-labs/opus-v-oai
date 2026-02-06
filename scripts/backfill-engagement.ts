/**
 * Backfill engagement data for tweets missing it (initial population).
 * Usage: npx tsx scripts/backfill-engagement.ts
 */
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);
const BATCH_SIZE = 100;
const API_KEY = process.env.TWITTER_API_KEY;

if (!API_KEY) {
  console.error("Set TWITTER_API_KEY in environment");
  process.exit(1);
}

function extractTweetId(url: string): string | null {
  try {
    const normalized = url.startsWith("http") ? url : `https://${url}`;
    const match = new URL(normalized).pathname.match(/\/status(?:es)?\/(\d+)/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

async function main() {
  const tweets = await sql`SELECT id, url FROM posts WHERE source_type = 'twitter' AND engagement_fetched_at IS NULL` as { id: string; url: string }[];

  console.log(`[Backfill] ${tweets.length} tweets need engagement data`);

  const fetchable: { id: string; tweetId: string }[] = [];
  let skipped = 0;
  const now = new Date().toISOString();

  for (const t of tweets) {
    const tweetId = extractTweetId(t.url);
    if (tweetId) {
      fetchable.push({ id: t.id, tweetId });
    } else {
      await sql`UPDATE posts SET engagement_fetched_at = ${now} WHERE id = ${t.id}`;
      skipped++;
    }
  }

  console.log(`[Backfill] ${fetchable.length} fetchable, ${skipped} skipped (no tweet ID)`);

  let fetched = 0;
  let failed = 0;

  for (let i = 0; i < fetchable.length; i += BATCH_SIZE) {
    const batch = fetchable.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(fetchable.length / BATCH_SIZE);

    console.log(`[Backfill] Batch ${batchNum}/${totalBatches} (${batch.length} tweets)`);

    try {
      const ids = batch.map(b => b.tweetId).join(",");
      const response = await fetch(
        `https://api.twitterapi.io/twitter/tweets?tweet_ids=${ids}`,
        { headers: { "X-API-Key": API_KEY!, "Content-Type": "application/json" } }
      );

      if (!response.ok) {
        throw new Error(`API responded ${response.status}: ${await response.text()}`);
      }

      const data = await response.json();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const tweetMap = new Map<string, any>();
      for (const t of data.tweets || []) {
        tweetMap.set(t.id, t);
      }

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

      console.log(`[Backfill] Batch ${batchNum}: ${tweetMap.size} found from API`);
    } catch (err) {
      console.error(`[Backfill] Batch ${batchNum} failed:`, err);
      for (const { id } of batch) {
        await sql`UPDATE posts SET engagement_fetched_at = ${now} WHERE id = ${id}`;
      }
      failed += batch.length;
    }
  }

  // Stats
  const topTweets = await sql`SELECT author, likes, retweets, views FROM posts WHERE source_type = 'twitter' AND likes IS NOT NULL ORDER BY likes DESC LIMIT 10` as { author: string; likes: number; retweets: number; views: number }[];

  console.log(`\n[Backfill] Done. Fetched: ${fetched}, Skipped: ${skipped}, Failed: ${failed}`);
  console.log(`\nTop 10 by likes:`);
  for (const t of topTweets) {
    console.log(`  @${(t.author || "?").replace(/^@/, "")}: ${t.likes} likes, ${t.retweets} RTs, ${t.views} views`);
  }

  const [over5k] = await sql`SELECT COUNT(*) as c FROM posts WHERE source_type = 'twitter' AND views >= 5000` as { c: number }[];
  const [under5k] = await sql`SELECT COUNT(*) as c FROM posts WHERE source_type = 'twitter' AND views IS NOT NULL AND views < 5000` as { c: number }[];
  console.log(`\nViews breakdown: ${over5k.c} tweets >= 5k views, ${under5k.c} tweets < 5k views`);
}

main();
