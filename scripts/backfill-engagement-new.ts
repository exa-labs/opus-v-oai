/**
 * Backfill engagement for tweets missing it + refresh tweets older than 1 hour.
 * Efficient: only fetches what's needed.
 * Usage: npx tsx scripts/backfill-engagement-new.ts
 */
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);
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
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const tweets = await sql`SELECT id, url FROM posts WHERE source_type = 'twitter'
     AND (engagement_fetched_at IS NULL OR (engagement_fetched_at < ${oneHourAgo} AND likes IS NULL))` as { id: string; url: string }[];

  console.log(`[Backfill] ${tweets.length} tweets need engagement (missing or stale)`);

  if (tweets.length === 0) {
    console.log("[Backfill] Nothing to do!");
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
      await sql`UPDATE posts SET engagement_fetched_at = ${now} WHERE id = ${t.id}`;
      skipped++;
    }
  }

  console.log(`[Backfill] ${fetchable.length} fetchable, ${skipped} skipped`);

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
        { headers: { "X-API-Key": API_KEY!, "Content-Type": "application/json" } }
      );
      if (!resp.ok) throw new Error(`API: ${resp.status} ${await resp.text()}`);
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
      console.log(`[Backfill] Batch ${batchNum}: ${tweetMap.size} found`);
    } catch (err) {
      console.error(`[Backfill] Batch ${batchNum} failed:`, err);
      for (const { id } of batch) await sql`UPDATE posts SET engagement_fetched_at = ${now} WHERE id = ${id}`;
      failed += batch.length;
    }
  }

  // Stats
  const [over5k] = await sql`SELECT COUNT(*) as c FROM posts WHERE source_type = 'twitter' AND views >= 5000` as { c: number }[];
  const [withEng] = await sql`SELECT COUNT(*) as c FROM posts WHERE engagement_fetched_at IS NOT NULL` as { c: number }[];
  const topNew = await sql`SELECT author, likes, retweets, views FROM posts WHERE source_type = 'twitter' AND likes IS NOT NULL ORDER BY likes DESC LIMIT 15` as { author: string; likes: number; retweets: number; views: number }[];

  console.log(`\n[Backfill] Done. Fetched: ${fetched}, Skipped: ${skipped}, Failed: ${failed}`);
  console.log(`Tweets with 5k+ views: ${over5k.c}`);
  console.log(`Posts with engagement: ${withEng.c}`);
  console.log(`\nTop 15 by likes:`);
  for (const t of topNew) {
    console.log(`  @${(t.author || "?").replace(/^@/, "")}: ${t.likes} likes, ${t.retweets} RTs, ${t.views} views`);
  }
}

main().catch(console.error);
