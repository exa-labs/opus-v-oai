/**
 * Backfill image_url for existing posts using Exa's getContents API.
 * Fetches images for posts that don't have one yet.
 * Usage: npx tsx scripts/backfill-images.ts
 */
import Exa from "exa-js";
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);
const EXA_KEY = process.env.EXA_API_KEY!;

if (!EXA_KEY) { console.error("Set EXA_API_KEY"); process.exit(1); }

const exa = new Exa(EXA_KEY);

async function main() {
  const posts = await sql`SELECT id, url FROM posts
     WHERE image_url IS NULL
     AND source_type != 'twitter'
     ORDER BY likes DESC NULLS LAST, importance_score DESC NULLS LAST
     LIMIT 200` as { id: string; url: string }[];

  console.log(`[Images] ${posts.length} posts need images`);

  if (posts.length === 0) {
    console.log("[Images] Nothing to do");
    return;
  }

  const BATCH = 100;
  let found = 0;

  for (let i = 0; i < posts.length; i += BATCH) {
    const batch = posts.slice(i, i + BATCH);
    const batchNum = Math.floor(i / BATCH) + 1;
    console.log(`[Images] Batch ${batchNum}/${Math.ceil(posts.length / BATCH)} (${batch.length} URLs)`);

    try {
      const urls = batch.map(p => p.url);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const response = await exa.getContents(urls, { text: false } as any);

      const urlToImage = new Map<string, string>();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const r of (response.results || []) as any[]) {
        if (r.image && r.url) {
          urlToImage.set(r.url.toLowerCase().trim(), r.image);
        }
      }

      for (const post of batch) {
        const img = urlToImage.get(post.url.toLowerCase().trim());
        if (img) {
          await sql`UPDATE posts SET image_url = ${img} WHERE id = ${post.id}`;
          found++;
        }
      }
    } catch (err) {
      console.error(`[Images] Batch ${batchNum} failed:`, err);
    }
  }

  console.log(`[Images] Done. Found images for ${found}/${posts.length} posts.`);

  const [withImages] = await sql`SELECT COUNT(*) as c FROM posts WHERE image_url IS NOT NULL` as { c: number }[];
  const [total] = await sql`SELECT COUNT(*) as c FROM posts` as { c: number }[];
  console.log(`[Images] DB: ${withImages.c}/${total.c} posts have images.`);
}

main().catch(console.error);
