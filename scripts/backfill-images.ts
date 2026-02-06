/**
 * Backfill image_url for existing posts using Exa's getContents API.
 * Fetches images for posts that don't have one yet.
 */
import Exa from "exa-js";
import Database from "better-sqlite3";
import path from "path";

const DB_PATH = path.join(import.meta.dirname, "..", "data", "sentiment.db");
const EXA_KEY = process.env.EXA_API_KEY!;

if (!EXA_KEY) { console.error("Set EXA_API_KEY"); process.exit(1); }

const exa = new Exa(EXA_KEY);

async function main() {
  const db = new Database(DB_PATH);

  // Ensure column exists
  try { db.exec(`ALTER TABLE posts ADD COLUMN image_url TEXT`); } catch { /* exists */ }

  // Get non-twitter posts without images (articles are most likely to have good images)
  const posts = db.prepare(
    `SELECT id, url FROM posts
     WHERE image_url IS NULL
     AND source_type != 'twitter'
     ORDER BY likes DESC, importance_score DESC
     LIMIT 200`
  ).all() as { id: string; url: string }[];

  console.log(`[Images] ${posts.length} posts need images`);

  if (posts.length === 0) {
    console.log("[Images] Nothing to do");
    db.close();
    return;
  }

  const updateStmt = db.prepare(`UPDATE posts SET image_url = ? WHERE id = ?`);

  // Batch by 100 URLs for Exa getContents
  const BATCH = 100;
  let found = 0;

  for (let i = 0; i < posts.length; i += BATCH) {
    const batch = posts.slice(i, i + BATCH);
    const batchNum = Math.floor(i / BATCH) + 1;
    console.log(`[Images] Batch ${batchNum}/${Math.ceil(posts.length / BATCH)} (${batch.length} URLs)`);

    try {
      const urls = batch.map(p => p.url);
      const response = await exa.getContents(urls, { text: false } as any);

      const urlToImage = new Map<string, string>();
      for (const r of (response.results || []) as any[]) {
        if (r.image && r.url) {
          urlToImage.set(r.url.toLowerCase().trim(), r.image);
        }
      }

      for (const post of batch) {
        const img = urlToImage.get(post.url.toLowerCase().trim());
        if (img) {
          updateStmt.run(img, post.id);
          found++;
        }
      }
    } catch (err) {
      console.error(`[Images] Batch ${batchNum} failed:`, err);
    }
  }

  console.log(`[Images] Done. Found images for ${found}/${posts.length} posts.`);

  // Stats
  const withImages = (db.prepare("SELECT COUNT(*) as c FROM posts WHERE image_url IS NOT NULL").get() as { c: number }).c;
  const total = (db.prepare("SELECT COUNT(*) as c FROM posts").get() as { c: number }).c;
  console.log(`[Images] DB: ${withImages}/${total} posts have images.`);

  db.close();
}

main().catch(console.error);
