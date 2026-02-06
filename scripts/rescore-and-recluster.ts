import Database from "better-sqlite3";
import path from "path";

const DB_PATH = path.join(import.meta.dirname, "..", "data", "sentiment.db");

async function main() {
  const db = new Database(DB_PATH);

  // Step 1: Wipe importance_score and take for all tweets
  const wiped = db.prepare(
    `UPDATE posts SET importance_score = 0, take = NULL WHERE source_type = 'twitter'`
  ).run();
  console.log(`[Rescore] Wiped scores and takes for ${wiped.changes} tweets`);

  // Stats before
  const totalTweets = (db.prepare(`SELECT COUNT(*) as c FROM posts WHERE source_type = 'twitter'`).get() as { c: number }).c;
  const withEngagement = (db.prepare(`SELECT COUNT(*) as c FROM posts WHERE source_type = 'twitter' AND likes IS NOT NULL`).get() as { c: number }).c;
  const over5kViews = (db.prepare(`SELECT COUNT(*) as c FROM posts WHERE source_type = 'twitter' AND views >= 5000`).get() as { c: number }).c;
  console.log(`[Rescore] ${totalTweets} total tweets, ${withEngagement} with engagement, ${over5kViews} with 5k+ views`);

  db.close();

  // Step 2: Now trigger the cron which will re-score, re-take, re-cluster
  // We call the cron endpoint which handles the full pipeline
  const cronUrl = `http://localhost:3008/api/cron?secret=${process.env.CRON_SECRET || "opus-v-oai-cron-secret-change-me"}`;
  console.log(`[Rescore] Triggering cron at ${cronUrl}...`);

  const response = await fetch(cronUrl, { method: "POST" });
  const result = await response.json();
  console.log(`[Rescore] Cron result:`, JSON.stringify(result, null, 2));
}

main().catch(console.error);
