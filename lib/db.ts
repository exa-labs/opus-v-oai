import Database from "better-sqlite3";
import path from "path";
import type { Post, CronRun, Metric, Subject, FeedFilter, Trend } from "./types";

const DB_PATH = path.join(process.cwd(), "data", "sentiment.db");

let _db: Database.Database | null = null;

function getDb(): Database.Database {
  if (!_db) {
    _db = new Database(DB_PATH);
    _db.pragma("journal_mode = WAL");
    _db.pragma("foreign_keys = ON");
    initSchema(_db);
  }
  return _db;
}

function initSchema(db: Database.Database) {
  db.exec(`
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
      author TEXT
    );

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
    );

    CREATE TABLE IF NOT EXISTS metrics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      subject TEXT NOT NULL,
      computed_at TEXT NOT NULL,
      total_posts INTEGER,
      positive_count INTEGER,
      negative_count INTEGER,
      neutral_count INTEGER,
      sentiment_score INTEGER,
      trend TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_posts_subject ON posts(subject);
    CREATE INDEX IF NOT EXISTS idx_posts_sentiment ON posts(sentiment);
    CREATE INDEX IF NOT EXISTS idx_posts_discovered ON posts(discovered_at);
    CREATE INDEX IF NOT EXISTS idx_posts_cron_run ON posts(cron_run_id);
    CREATE INDEX IF NOT EXISTS idx_metrics_subject ON metrics(subject);
  `);

  // Migration: add importance_score column
  try {
    db.exec(`ALTER TABLE posts ADD COLUMN importance_score INTEGER DEFAULT 0`);
  } catch {
    // Column already exists
  }

  // Migration: add take column (1-sentence distillation, generated once)
  try {
    db.exec(`ALTER TABLE posts ADD COLUMN take TEXT`);
  } catch {
    // Column already exists
  }

  // Migration: add image_url column
  try {
    db.exec(`ALTER TABLE posts ADD COLUMN image_url TEXT`);
  } catch {
    // Column already exists
  }

  // Migration: add engagement columns (from TwitterAPI.io)
  const engagementColumns = [
    { name: "likes", type: "INTEGER" },
    { name: "retweets", type: "INTEGER" },
    { name: "replies", type: "INTEGER" },
    { name: "views", type: "INTEGER" },
    { name: "quotes", type: "INTEGER" },
    { name: "bookmarks", type: "INTEGER" },
    { name: "engagement_fetched_at", type: "TEXT" },
  ];
  for (const col of engagementColumns) {
    try {
      db.exec(`ALTER TABLE posts ADD COLUMN ${col.name} ${col.type}`);
    } catch {
      // Column already exists
    }
  }
}

// ─── Cron Runs ───

export function createCronRun(id: string): CronRun {
  const db = getDb();
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO cron_runs (id, started_at, status) VALUES (?, ?, 'running')`
  ).run(id, now);
  return { id, started_at: now, completed_at: null, posts_found: 0, posts_new: 0, summary: null, claude_score: null, openai_score: null, status: "running" };
}

export function completeCronRun(
  id: string,
  data: {
    posts_found: number;
    posts_new: number;
    summary: string;
    claude_score: number;
    openai_score: number;
  }
) {
  const db = getDb();
  db.prepare(
    `UPDATE cron_runs SET completed_at = ?, posts_found = ?, posts_new = ?, summary = ?, claude_score = ?, openai_score = ?, status = 'completed' WHERE id = ?`
  ).run(
    new Date().toISOString(),
    data.posts_found,
    data.posts_new,
    data.summary,
    data.claude_score,
    data.openai_score,
    id
  );
}

export function failCronRun(id: string) {
  const db = getDb();
  db.prepare(
    `UPDATE cron_runs SET completed_at = ?, status = 'failed' WHERE id = ?`
  ).run(new Date().toISOString(), id);
}

export function getLatestCompletedRun(): CronRun | null {
  const db = getDb();
  return db.prepare(
    `SELECT * FROM cron_runs WHERE status = 'completed' ORDER BY completed_at DESC LIMIT 1`
  ).get() as CronRun | null;
}

export function getLatestRun(): CronRun | null {
  const db = getDb();
  return db.prepare(
    `SELECT * FROM cron_runs ORDER BY started_at DESC LIMIT 1`
  ).get() as CronRun | null;
}

// ─── Posts ───

export function insertPost(post: Omit<Post, "sentiment" | "sentiment_score" | "importance_score"> & { sentiment?: string; sentiment_score?: number }): boolean {
  const db = getDb();
  try {
    db.prepare(
      `INSERT OR IGNORE INTO posts (id, url, title, snippet, source_type, subject, sentiment, sentiment_score, published_at, discovered_at, cron_run_id, author)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      post.id,
      post.url,
      post.title,
      post.snippet,
      post.source_type,
      post.subject,
      post.sentiment || "neutral",
      post.sentiment_score ?? null,
      post.published_at,
      post.discovered_at,
      post.cron_run_id,
      post.author
    );
    return true;
  } catch {
    return false; // Duplicate
  }
}

export function updatePostSentiment(id: string, sentiment: string, score: number) {
  const db = getDb();
  db.prepare(
    `UPDATE posts SET sentiment = ?, sentiment_score = ? WHERE id = ?`
  ).run(sentiment, score, id);
}

export function getPostsByRunId(runId: string): Post[] {
  const db = getDb();
  return db.prepare(
    `SELECT * FROM posts WHERE cron_run_id = ? ORDER BY discovered_at DESC`
  ).all(runId) as Post[];
}

export function getFeedPosts(
  filter: FeedFilter = "all",
  limit: number = 50,
  offset: number = 0,
  since?: string
): Post[] {
  const db = getDb();
  let query = `SELECT * FROM posts`;
  const conditions: string[] = [];
  const params: (string | number)[] = [];

  if (filter === "claude") {
    conditions.push(`(subject = 'claude' OR subject = 'both')`);
  } else if (filter === "openai") {
    conditions.push(`(subject = 'openai' OR subject = 'both')`);
  } else if (filter === "polarized") {
    conditions.push(`(sentiment_score < -50 OR sentiment_score > 50)`);
  }

  if (since) {
    conditions.push(`discovered_at > ?`);
    params.push(since);
  }

  if (conditions.length > 0) {
    query += ` WHERE ${conditions.join(" AND ")}`;
  }

  if (filter === "polarized") {
    query += ` ORDER BY ABS(sentiment_score) DESC`;
  } else {
    query += ` ORDER BY discovered_at DESC`;
  }

  query += ` LIMIT ? OFFSET ?`;
  params.push(limit, offset);

  return db.prepare(query).all(...params) as Post[];
}

export function getTotalPosts(filter: FeedFilter = "all"): number {
  const db = getDb();
  let query = `SELECT COUNT(*) as count FROM posts`;

  if (filter === "claude") {
    query += ` WHERE (subject = 'claude' OR subject = 'both')`;
  } else if (filter === "openai") {
    query += ` WHERE (subject = 'openai' OR subject = 'both')`;
  } else if (filter === "polarized") {
    query += ` WHERE (sentiment_score < -50 OR sentiment_score > 50)`;
  }

  const result = db.prepare(query).get() as { count: number };
  return result.count;
}

// ─── Metrics ───

export function computeAndStoreMetrics(subject: Subject): Metric {
  const db = getDb();

  const stats = db.prepare(`
    SELECT
      COUNT(*) as total_posts,
      SUM(CASE WHEN sentiment = 'positive' THEN 1 ELSE 0 END) as positive_count,
      SUM(CASE WHEN sentiment = 'negative' THEN 1 ELSE 0 END) as negative_count,
      SUM(CASE WHEN sentiment = 'neutral' THEN 1 ELSE 0 END) as neutral_count,
      ROUND(AVG(sentiment_score)) as sentiment_score
    FROM posts
    WHERE subject = ? OR subject = 'both'
  `).get(subject) as {
    total_posts: number;
    positive_count: number;
    negative_count: number;
    neutral_count: number;
    sentiment_score: number;
  };

  // Compute trend vs previous metric
  const prevMetric = db.prepare(
    `SELECT sentiment_score FROM metrics WHERE subject = ? ORDER BY computed_at DESC LIMIT 1`
  ).get(subject) as { sentiment_score: number } | undefined;

  let trend: Trend = "stable";
  if (prevMetric) {
    const diff = stats.sentiment_score - prevMetric.sentiment_score;
    if (diff > 5) trend = "up";
    else if (diff < -5) trend = "down";
  }

  const now = new Date().toISOString();
  const result = db.prepare(
    `INSERT INTO metrics (subject, computed_at, total_posts, positive_count, negative_count, neutral_count, sentiment_score, trend)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    subject,
    now,
    stats.total_posts,
    stats.positive_count,
    stats.negative_count,
    stats.neutral_count,
    stats.sentiment_score || 0,
    trend
  );

  return {
    id: result.lastInsertRowid as number,
    subject,
    computed_at: now,
    total_posts: stats.total_posts,
    positive_count: stats.positive_count,
    negative_count: stats.negative_count,
    neutral_count: stats.neutral_count,
    sentiment_score: stats.sentiment_score || 0,
    trend,
  };
}

export function getLatestMetrics(subject: Subject): Metric | null {
  const db = getDb();
  return db.prepare(
    `SELECT * FROM metrics WHERE subject = ? ORDER BY computed_at DESC LIMIT 1`
  ).get(subject) as Metric | null;
}

export function getNewPostsCount(runId: string): number {
  const db = getDb();
  const result = db.prepare(
    `SELECT COUNT(*) as count FROM posts WHERE cron_run_id = ?`
  ).get(runId) as { count: number };
  return result.count;
}

export function getRecentTweets(limit: number = 25): Post[] {
  const db = getDb();
  return db.prepare(
    `SELECT * FROM posts WHERE source_type = 'twitter' AND snippet IS NOT NULL AND snippet != ''
     AND (views >= 5000 OR likes >= 200)
     AND LOWER(author) NOT IN ('claudeai', 'anthropicai', 'openai', 'openaidevs', 'chatgpt', 'openaieng', 'cursor_ai', 'code', 'github', 'googledeepmind', 'googleai')
     ORDER BY likes DESC, importance_score DESC LIMIT ?`
  ).all(limit) as Post[];
}

export function getUnscoredTweets(limit: number = 200): Post[] {
  const db = getDb();
  return db.prepare(
    `SELECT * FROM posts WHERE source_type = 'twitter' AND snippet IS NOT NULL AND snippet != '' AND (importance_score IS NULL OR importance_score = 0) ORDER BY discovered_at DESC LIMIT ?`
  ).all(limit) as Post[];
}

export function updateImportanceScore(id: string, score: number) {
  const db = getDb();
  db.prepare(`UPDATE posts SET importance_score = ? WHERE id = ?`).run(score, id);
}

export function getTweetsWithoutTakes(limit: number = 500): Post[] {
  const db = getDb();
  return db.prepare(
    `SELECT * FROM posts WHERE source_type = 'twitter' AND snippet IS NOT NULL AND snippet != '' AND importance_score >= 6 AND take IS NULL AND (views IS NULL OR views >= 5000) ORDER BY importance_score DESC LIMIT ?`
  ).all(limit) as Post[];
}

export function updatePostTake(id: string, take: string) {
  const db = getDb();
  db.prepare(`UPDATE posts SET take = ? WHERE id = ?`).run(take, id);
}

export function getTopTweetsWithTakes(limit: number = 200): (Post & { take: string })[] {
  const db = getDb();
  return db.prepare(
    `SELECT * FROM posts WHERE source_type = 'twitter' AND take IS NOT NULL AND (views >= 5000 OR likes >= 200) ORDER BY likes DESC, importance_score DESC LIMIT ?`
  ).all(limit) as (Post & { take: string })[];
}

export function getAllTweetsForSummary(): { author: string; snippet: string; subject: string }[] {
  const db = getDb();
  return db.prepare(
    `SELECT author, snippet, subject FROM posts WHERE source_type = 'twitter' AND snippet IS NOT NULL AND snippet != '' ORDER BY importance_score DESC, discovered_at DESC`
  ).all() as { author: string; snippet: string; subject: string }[];
}

export function getTotalSourcesAnalyzed(): number {
  const db = getDb();
  const result = db.prepare(
    `SELECT COUNT(*) as total FROM posts`
  ).get() as { total: number };
  return result.total;
}

// ─── Images ───

export function updatePostImageUrl(id: string, imageUrl: string) {
  const db = getDb();
  db.prepare(`UPDATE posts SET image_url = ? WHERE id = ?`).run(imageUrl, id);
}

export function getImageUrlsForUrls(urls: string[]): Map<string, string> {
  const db = getDb();
  if (urls.length === 0) return new Map();
  const placeholders = urls.map(() => "?").join(",");
  const rows = db.prepare(
    `SELECT url, image_url FROM posts WHERE url IN (${placeholders}) AND image_url IS NOT NULL AND image_url != ''`
  ).all(...urls) as { url: string; image_url: string }[];
  const map = new Map<string, string>();
  for (const row of rows) map.set(row.url, row.image_url);
  return map;
}

// ─── Head-to-Head & Use Cases ───

export function getHeadToHeadTweets(limit: number = 12): Post[] {
  const db = getDb();
  return db.prepare(
    `SELECT * FROM posts
     WHERE source_type = 'twitter'
     AND snippet IS NOT NULL AND snippet != ''
     AND subject = 'both'
     AND (likes >= 40 OR views >= 3000)
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
     ORDER BY likes DESC
     LIMIT ?`
  ).all(limit) as Post[];
}

export function getUseCaseTweets(subject: 'claude' | 'openai', limit: number = 8): Post[] {
  const db = getDb();
  return db.prepare(
    `SELECT * FROM posts
     WHERE source_type = 'twitter'
     AND snippet IS NOT NULL AND snippet != ''
     AND subject = ?
     AND (likes >= 50 OR views >= 5000)
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
     ORDER BY likes DESC
     LIMIT ?`
  ).all(subject, limit) as Post[];
}

// ─── Engagement ───

export function getTweetsWithoutEngagement(limit: number = 500): Post[] {
  const db = getDb();
  return db.prepare(
    `SELECT * FROM posts WHERE source_type = 'twitter' AND engagement_fetched_at IS NULL ORDER BY discovered_at DESC LIMIT ?`
  ).all(limit) as Post[];
}

export function updatePostEngagement(
  id: string,
  engagement: { likes: number; retweets: number; replies: number; views: number; quotes: number; bookmarks: number }
) {
  const db = getDb();
  db.prepare(
    `UPDATE posts SET likes = ?, retweets = ?, replies = ?, views = ?, quotes = ?, bookmarks = ?, engagement_fetched_at = ? WHERE id = ?`
  ).run(
    engagement.likes, engagement.retweets, engagement.replies,
    engagement.views, engagement.quotes, engagement.bookmarks,
    new Date().toISOString(), id
  );
}

export function markEngagementFailed(id: string) {
  const db = getDb();
  db.prepare(
    `UPDATE posts SET engagement_fetched_at = ? WHERE id = ?`
  ).run(new Date().toISOString(), id);
}
