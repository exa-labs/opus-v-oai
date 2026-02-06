/**
 * Dev helper: trigger the cron endpoint locally
 * Usage: npm run trigger-cron
 */

const CRON_SECRET = process.env.CRON_SECRET || "opus-v-oai-cron-secret-change-me";
const BASE_URL = process.env.BASE_URL || "http://localhost:3000";

async function main() {
  console.log(`Triggering cron at ${BASE_URL}/api/cron ...`);
  console.log("This may take 1-3 minutes.\n");

  const start = Date.now();

  try {
    const res = await fetch(`${BASE_URL}/api/cron?secret=${CRON_SECRET}`, {
      method: "POST",
    });

    const data = await res.json();
    const elapsed = ((Date.now() - start) / 1000).toFixed(1);

    if (res.ok) {
      console.log(`\nCron completed in ${elapsed}s`);
      console.log(`  Posts found: ${data.posts_found}`);
      console.log(`  New posts: ${data.posts_new}`);
      console.log(`  Claude score: ${data.claude_score}`);
      console.log(`  OpenAI score: ${data.openai_score}`);
      console.log(`  Run ID: ${data.runId}`);
    } else {
      console.error(`\nCron failed (${res.status}):`, data);
    }
  } catch (err) {
    console.error("Failed to reach server:", err);
    console.log("\nMake sure the dev server is running: npm run dev");
  }
}

main();
