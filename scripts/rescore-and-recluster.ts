/**
 * Wipe importance_score and takes, then trigger cron for re-scoring and re-clustering.
 * Usage: npx tsx scripts/rescore-and-recluster.ts
 */
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

async function main() {
  // Step 1: Wipe importance_score and take for all tweets
  await sql`UPDATE posts SET importance_score = 0, take = NULL WHERE source_type = 'twitter'`;

  const [totalTweets] = await sql`SELECT COUNT(*) as c FROM posts WHERE source_type = 'twitter'` as { c: number }[];
  const [withEngagement] = await sql`SELECT COUNT(*) as c FROM posts WHERE source_type = 'twitter' AND likes IS NOT NULL` as { c: number }[];
  const [over5kViews] = await sql`SELECT COUNT(*) as c FROM posts WHERE source_type = 'twitter' AND views >= 5000` as { c: number }[];
  console.log(`[Rescore] ${totalTweets.c} total tweets, ${withEngagement.c} with engagement, ${over5kViews.c} with 5k+ views`);

  // Step 2: Trigger cron for re-scoring and re-clustering
  const cronUrl = `http://localhost:3000/api/cron?secret=${process.env.CRON_SECRET || "local-dev-secret"}`;
  console.log(`[Rescore] Triggering cron at ${cronUrl}...`);

  const response = await fetch(cronUrl, { method: "POST" });
  const result = await response.json();
  console.log(`[Rescore] Cron result:`, JSON.stringify(result, null, 2));
}

main().catch(console.error);
