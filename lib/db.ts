import { neon } from "@neondatabase/serverless";
import type { Post, CronRun, Metric, Subject, FeedFilter, Trend } from "./types";

const sql = neon(process.env.DATABASE_URL!);

let _initialized = false;

async function ensureSchema() {
  if (_initialized) return;
  await sql`
    CREATE TABLE IF NOT EXISTS posts (
      id TEXT PRIMARY KEY,
      url TEXT NOT NULL UNIQUE,
      title TEXT,
      snippet TEXT,
      source_type TEXT NOT NULL,
      subject TEXT NOT NULL,
      sentiment TEXT NOT NULL DEFAULT 'neutral',
      sentiment_score INTEGER,
      published_at TEXT,
      discovered_at TEXT NOT NULL,
      cron_run_id TEXT NOT NULL,
      author TEXT,
      importance_score INTEGER DEFAULT 0,
      take TEXT,
      image_url TEXT,
      likes INTEGER,
      retweets INTEGER,
      replies INTEGER,
      views INTEGER,
      quotes INTEGER,
      bookmarks INTEGER,
      engagement_fetched_at TEXT
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS cron_runs (
      id TEXT PRIMARY KEY,
      started_at TEXT NOT NULL,
      completed_at TEXT,
      posts_found INTEGER DEFAULT 0,
      posts_new INTEGER DEFAULT 0,
      summary TEXT,
      claude_score INTEGER,
      openai_score INTEGER,
      status TEXT DEFAULT 'running'
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS metrics (
      id SERIAL PRIMARY KEY,
      subject TEXT NOT NULL,
      computed_at TEXT NOT NULL,
      total_posts INTEGER,
      positive_count INTEGER,
      negative_count INTEGER,
      neutral_count INTEGER,
      sentiment_score INTEGER,
      trend TEXT
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_posts_subject ON posts(subject)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_posts_sentiment ON posts(sentiment)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_posts_discovered ON posts(discovered_at)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_posts_cron_run ON posts(cron_run_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_metrics_subject ON metrics(subject)`;
  _initialized = true;
}

// ─── Cron Runs ───

export async function createCronRun(id: string): Promise<CronRun> {
  await ensureSchema();
  const now = new Date().toISOString();
  await sql`INSERT INTO cron_runs (id, started_at, status) VALUES (${id}, ${now}, 'running')`;
  return { id, started_at: now, completed_at: null, posts_found: 0, posts_new: 0, summary: null, claude_score: null, openai_score: null, status: "running" };
}

export async function completeCronRun(
  id: string,
  data: {
    posts_found: number;
    posts_new: number;
    summary: string;
    claude_score: number;
    openai_score: number;
  }
) {
  await ensureSchema();
  const now = new Date().toISOString();
  await sql`UPDATE cron_runs SET completed_at = ${now}, posts_found = ${data.posts_found}, posts_new = ${data.posts_new}, summary = ${data.summary}, claude_score = ${data.claude_score}, openai_score = ${data.openai_score}, status = 'completed' WHERE id = ${id}`;
}

export async function failCronRun(id: string) {
  await ensureSchema();
  const now = new Date().toISOString();
  await sql`UPDATE cron_runs SET completed_at = ${now}, status = 'failed' WHERE id = ${id}`;
}

export async function getLatestCompletedRun(): Promise<CronRun | null> {
  await ensureSchema();
  const rows = await sql`SELECT * FROM cron_runs WHERE status = 'completed' ORDER BY completed_at DESC LIMIT 1`;
  return (rows[0] as CronRun) || null;
}

export async function getLatestRun(): Promise<CronRun | null> {
  await ensureSchema();
  const rows = await sql`SELECT * FROM cron_runs ORDER BY started_at DESC LIMIT 1`;
  return (rows[0] as CronRun) || null;
}

// ─── Posts ───

export async function insertPost(post: Omit<Post, "sentiment" | "sentiment_score" | "importance_score"> & { sentiment?: string; sentiment_score?: number }): Promise<boolean> {
  await ensureSchema();
  try {
    await sql`INSERT INTO posts (id, url, title, snippet, source_type, subject, sentiment, sentiment_score, published_at, discovered_at, cron_run_id, author)
       VALUES (${post.id}, ${post.url}, ${post.title}, ${post.snippet}, ${post.source_type}, ${post.subject}, ${post.sentiment || "neutral"}, ${post.sentiment_score ?? null}, ${post.published_at}, ${post.discovered_at}, ${post.cron_run_id}, ${post.author})
       ON CONFLICT (id) DO NOTHING`;
    return true;
  } catch {
    return false;
  }
}

export async function updatePostSentiment(id: string, sentiment: string, score: number) {
  await ensureSchema();
  await sql`UPDATE posts SET sentiment = ${sentiment}, sentiment_score = ${score} WHERE id = ${id}`;
}

export async function getPostsByRunId(runId: string): Promise<Post[]> {
  await ensureSchema();
  return await sql`SELECT * FROM posts WHERE cron_run_id = ${runId} ORDER BY discovered_at DESC` as Post[];
}

export async function getFeedPosts(
  filter: FeedFilter = "all",
  limit: number = 50,
  offset: number = 0,
  since?: string
): Promise<Post[]> {
  await ensureSchema();
  if (filter === "claude" && since) {
    return await sql`SELECT * FROM posts WHERE (subject = 'claude' OR subject = 'both') AND discovered_at > ${since} ORDER BY discovered_at DESC LIMIT ${limit} OFFSET ${offset}` as Post[];
  } else if (filter === "claude") {
    return await sql`SELECT * FROM posts WHERE (subject = 'claude' OR subject = 'both') ORDER BY discovered_at DESC LIMIT ${limit} OFFSET ${offset}` as Post[];
  } else if (filter === "openai" && since) {
    return await sql`SELECT * FROM posts WHERE (subject = 'openai' OR subject = 'both') AND discovered_at > ${since} ORDER BY discovered_at DESC LIMIT ${limit} OFFSET ${offset}` as Post[];
  } else if (filter === "openai") {
    return await sql`SELECT * FROM posts WHERE (subject = 'openai' OR subject = 'both') ORDER BY discovered_at DESC LIMIT ${limit} OFFSET ${offset}` as Post[];
  } else if (filter === "polarized" && since) {
    return await sql`SELECT * FROM posts WHERE (sentiment_score < -50 OR sentiment_score > 50) AND discovered_at > ${since} ORDER BY ABS(sentiment_score) DESC LIMIT ${limit} OFFSET ${offset}` as Post[];
  } else if (filter === "polarized") {
    return await sql`SELECT * FROM posts WHERE (sentiment_score < -50 OR sentiment_score > 50) ORDER BY ABS(sentiment_score) DESC LIMIT ${limit} OFFSET ${offset}` as Post[];
  } else if (since) {
    return await sql`SELECT * FROM posts WHERE discovered_at > ${since} ORDER BY discovered_at DESC LIMIT ${limit} OFFSET ${offset}` as Post[];
  }
  return await sql`SELECT * FROM posts ORDER BY discovered_at DESC LIMIT ${limit} OFFSET ${offset}` as Post[];
}

export async function getTotalPosts(filter: FeedFilter = "all"): Promise<number> {
  await ensureSchema();
  let rows;
  if (filter === "claude") {
    rows = await sql`SELECT COUNT(*) as count FROM posts WHERE (subject = 'claude' OR subject = 'both')`;
  } else if (filter === "openai") {
    rows = await sql`SELECT COUNT(*) as count FROM posts WHERE (subject = 'openai' OR subject = 'both')`;
  } else if (filter === "polarized") {
    rows = await sql`SELECT COUNT(*) as count FROM posts WHERE (sentiment_score < -50 OR sentiment_score > 50)`;
  } else {
    rows = await sql`SELECT COUNT(*) as count FROM posts`;
  }
  return Number(rows[0]?.count ?? 0);
}

// ─── Metrics ───

export async function computeAndStoreMetrics(subject: Subject): Promise<Metric> {
  await ensureSchema();
  const statsRows = await sql`
    SELECT
      COUNT(*) as total_posts,
      SUM(CASE WHEN sentiment = 'positive' THEN 1 ELSE 0 END) as positive_count,
      SUM(CASE WHEN sentiment = 'negative' THEN 1 ELSE 0 END) as negative_count,
      SUM(CASE WHEN sentiment = 'neutral' THEN 1 ELSE 0 END) as neutral_count,
      ROUND(AVG(sentiment_score)) as sentiment_score
    FROM posts
    WHERE subject = ${subject} OR subject = 'both'
  `;
  const stats = statsRows[0] as { total_posts: number; positive_count: number; negative_count: number; neutral_count: number; sentiment_score: number };

  const prevRows = await sql`SELECT sentiment_score FROM metrics WHERE subject = ${subject} ORDER BY computed_at DESC LIMIT 1`;
  const prevMetric = prevRows[0] as { sentiment_score: number } | undefined;

  let trend: Trend = "stable";
  if (prevMetric) {
    const diff = (stats.sentiment_score || 0) - prevMetric.sentiment_score;
    if (diff > 5) trend = "up";
    else if (diff < -5) trend = "down";
  }

  const now = new Date().toISOString();
  const result = await sql`INSERT INTO metrics (subject, computed_at, total_posts, positive_count, negative_count, neutral_count, sentiment_score, trend)
     VALUES (${subject}, ${now}, ${stats.total_posts}, ${stats.positive_count}, ${stats.negative_count}, ${stats.neutral_count}, ${stats.sentiment_score || 0}, ${trend}) RETURNING id`;

  return {
    id: Number(result[0].id),
    subject,
    computed_at: now,
    total_posts: Number(stats.total_posts),
    positive_count: Number(stats.positive_count),
    negative_count: Number(stats.negative_count),
    neutral_count: Number(stats.neutral_count),
    sentiment_score: Number(stats.sentiment_score) || 0,
    trend,
  };
}

export async function getLatestMetrics(subject: Subject): Promise<Metric | null> {
  await ensureSchema();
  const rows = await sql`SELECT * FROM metrics WHERE subject = ${subject} ORDER BY computed_at DESC LIMIT 1`;
  return (rows[0] as Metric) || null;
}

export async function getNewPostsCount(runId: string): Promise<number> {
  await ensureSchema();
  const rows = await sql`SELECT COUNT(*) as count FROM posts WHERE cron_run_id = ${runId}`;
  return Number(rows[0]?.count ?? 0);
}

export async function getRecentTweets(limit: number = 25): Promise<Post[]> {
  await ensureSchema();
  return await sql`SELECT * FROM posts WHERE source_type = 'twitter' AND snippet IS NOT NULL AND snippet != ''
     AND (views IS NULL OR views >= 5000 OR likes >= 200)
     AND LOWER(author) NOT IN ('claudeai', 'anthropicai', 'openai', 'openaidevs', 'chatgpt', 'openaieng', 'cursor_ai', 'code', 'github', 'googledeepmind', 'googleai')
     ORDER BY COALESCE(likes, 0) DESC, importance_score DESC LIMIT ${limit}` as Post[];
}

export async function getUnscoredTweets(limit: number = 200): Promise<Post[]> {
  await ensureSchema();
  return await sql`SELECT * FROM posts WHERE source_type = 'twitter' AND snippet IS NOT NULL AND snippet != '' AND (importance_score IS NULL OR importance_score = 0) ORDER BY discovered_at DESC LIMIT ${limit}` as Post[];
}

export async function updateImportanceScore(id: string, score: number) {
  await ensureSchema();
  await sql`UPDATE posts SET importance_score = ${score} WHERE id = ${id}`;
}

export async function getTweetsWithoutTakes(limit: number = 500): Promise<Post[]> {
  await ensureSchema();
  return await sql`SELECT * FROM posts WHERE source_type = 'twitter' AND snippet IS NOT NULL AND snippet != '' AND importance_score >= 6 AND take IS NULL AND (views IS NULL OR views >= 5000) ORDER BY importance_score DESC LIMIT ${limit}` as Post[];
}

export async function updatePostTake(id: string, take: string) {
  await ensureSchema();
  await sql`UPDATE posts SET take = ${take} WHERE id = ${id}`;
}

export async function getTopTweetsWithTakes(limit: number = 200): Promise<(Post & { take: string })[]> {
  await ensureSchema();
  return await sql`SELECT * FROM posts WHERE source_type = 'twitter' AND take IS NOT NULL AND (views IS NULL OR views >= 5000 OR likes >= 200) ORDER BY COALESCE(likes, 0) DESC, importance_score DESC LIMIT ${limit}` as (Post & { take: string })[];
}

export async function getAllTweetsForSummary(): Promise<{ author: string; snippet: string; subject: string }[]> {
  await ensureSchema();
  return await sql`SELECT author, snippet, subject FROM posts WHERE source_type = 'twitter' AND snippet IS NOT NULL AND snippet != '' ORDER BY importance_score DESC, discovered_at DESC` as { author: string; snippet: string; subject: string }[];
}

export async function getTotalSourcesAnalyzed(): Promise<number> {
  await ensureSchema();
  const rows = await sql`SELECT COUNT(*) as total FROM posts`;
  return Number(rows[0]?.total ?? 0);
}

// ─── Images ───

export async function updatePostImageUrl(id: string, imageUrl: string) {
  await ensureSchema();
  await sql`UPDATE posts SET image_url = ${imageUrl} WHERE id = ${id}`;
}

export async function getImageUrlsForUrls(urls: string[]): Promise<Map<string, string>> {
  await ensureSchema();
  if (urls.length === 0) return new Map();
  const rows = await sql`SELECT url, image_url FROM posts WHERE url = ANY(${urls}) AND image_url IS NOT NULL AND image_url != ''` as { url: string; image_url: string }[];
  const map = new Map<string, string>();
  for (const row of rows) map.set(row.url, row.image_url);
  return map;
}

// ─── Head-to-Head & Use Cases ───

export async function getHeadToHeadTweets(limit: number = 12): Promise<Post[]> {
  await ensureSchema();
  return await sql`SELECT * FROM posts
     WHERE source_type = 'twitter'
     AND snippet IS NOT NULL AND snippet != ''
     AND subject = 'both'
     AND (likes IS NULL OR likes >= 40 OR views IS NULL OR views >= 3000)
     AND (
       LOWER(snippet) LIKE '%vs%'
       OR LOWER(snippet) LIKE '%compar%'
       OR LOWER(snippet) LIKE '%switch%'
       OR LOWER(snippet) LIKE '%tried both%'
       OR LOWER(snippet) LIKE '%tested%'
       OR LOWER(snippet) LIKE '%same prompt%'
       OR LOWER(snippet) LIKE '%head to head%'
       OR LOWER(snippet) LIKE '%better than%'
       OR LOWER(snippet) LIKE '%outperform%'
       OR LOWER(snippet) LIKE '%benchmark%'
     )
     ORDER BY COALESCE(likes, 0) DESC
     LIMIT ${limit}` as Post[];
}

export async function getUseCaseTweets(subject: 'claude' | 'openai', limit: number = 8): Promise<Post[]> {
  await ensureSchema();
  return await sql`SELECT * FROM posts
     WHERE source_type = 'twitter'
     AND snippet IS NOT NULL AND snippet != ''
     AND subject = ${subject}
     AND (likes IS NULL OR likes >= 50 OR views IS NULL OR views >= 5000)
     AND (
       LOWER(snippet) LIKE '%built%'
       OR LOWER(snippet) LIKE '%shipped%'
       OR LOWER(snippet) LIKE '%created%'
       OR LOWER(snippet) LIKE '%compiler%'
       OR LOWER(snippet) LIKE '%workflow%'
       OR LOWER(snippet) LIKE '%from scratch%'
       OR LOWER(snippet) LIKE '%autonomous%'
       OR LOWER(snippet) LIKE '%project%'
       OR LOWER(snippet) LIKE '%my app%'
       OR LOWER(snippet) LIKE '%made a%'
       OR LOWER(snippet) LIKE '%i used%'
       OR LOWER(snippet) LIKE '%just built%'
       OR LOWER(snippet) LIKE '%minutes%'
     )
     AND LOWER(author) NOT IN (
       'claudeai', 'anthropicai', 'openai', 'openaidevs', 'chatgpt', 'openaieng',
       'openai', 'sama', 'gaborcselle', 'gdb', 'maboroshi',
       'cursor_ai', 'code', 'github', 'googledeepmind', 'googleai',
       'supabase', 'vibecodeapp', 'amanrsanger'
     )
     ORDER BY COALESCE(likes, 0) DESC
     LIMIT ${limit}` as Post[];
}

// ─── Engagement───

export async function getTweetsWithoutEngagement(limit: number = 500): Promise<Post[]> {
  await ensureSchema();
  return await sql`SELECT * FROM posts WHERE source_type = 'twitter' AND engagement_fetched_at IS NULL ORDER BY discovered_at DESC LIMIT ${limit}` as Post[];
}

export async function updatePostEngagement(
  id: string,
  engagement: { likes: number; retweets: number; replies: number; views: number; quotes: number; bookmarks: number }
) {
  await ensureSchema();
  const now = new Date().toISOString();
  await sql`UPDATE posts SET likes = ${engagement.likes}, retweets = ${engagement.retweets}, replies = ${engagement.replies}, views = ${engagement.views}, quotes = ${engagement.quotes}, bookmarks = ${engagement.bookmarks}, engagement_fetched_at = ${now} WHERE id = ${id}`;
}

export async function markEngagementFailed(id: string) {
  await ensureSchema();
  const now = new Date().toISOString();
  await sql`UPDATE posts SET engagement_fetched_at = ${now} WHERE id = ${id}`;
}
