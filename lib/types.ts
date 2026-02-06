// ─── Database row types ───

export interface Post {
  id: string;
  url: string;
  title: string | null;
  snippet: string | null;
  source_type: SourceType;
  subject: Subject;
  sentiment: Sentiment;
  sentiment_score: number | null;
  published_at: string | null;
  discovered_at: string;
  cron_run_id: string;
  author: string | null;
  importance_score: number | null;
  likes: number | null;
  retweets: number | null;
  replies: number | null;
  views: number | null;
  quotes: number | null;
  bookmarks: number | null;
  engagement_fetched_at: string | null;
  image_url: string | null;
}

export interface CronRun {
  id: string;
  started_at: string;
  completed_at: string | null;
  posts_found: number;
  posts_new: number;
  summary: string | null;
  claude_score: number | null;
  openai_score: number | null;
  status: "running" | "completed" | "failed";
}

export interface Metric {
  id: number;
  subject: Subject;
  computed_at: string;
  total_posts: number;
  positive_count: number;
  negative_count: number;
  neutral_count: number;
  sentiment_score: number;
  trend: Trend;
}

// ─── Enums ───

export type SourceType = "twitter" | "reddit" | "forum" | "blog" | "news";
export type Subject = "claude" | "openai" | "both";
export type Sentiment = "positive" | "negative" | "neutral";
export type Trend = "up" | "down" | "stable";

// ─── API response types ───

export interface FeedResponse {
  posts: Post[];
  total: number;
  hasMore: boolean;
}

export interface MetricsResponse {
  claude: Metric | null;
  openai: Metric | null;
  lastRun: CronRun | null;
}

export interface MonitorResponse {
  lastRunAt: string | null;
  intervalHours: number;
  lastRun: CronRun | null;
  status: "active" | "never_run";
}

// ─── Exa Research types ───

export interface ExaCitation {
  url: string;
  title: string;
  snippet?: string;
  publishedDate?: string;
  author?: string;
  image?: string;
}

export interface ExaResearchResult {
  citations: ExaCitation[];
  taskId: string;
}

// ─── Sentiment classification ───

export interface SentimentResult {
  url_hash: string;
  sentiment: Sentiment;
  sentiment_score: number;
}

export interface BatchSentimentResponse {
  results: SentimentResult[];
}

// ─── Chat types ───

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ChatSearchResult {
  title: string;
  url: string;
  text?: string;
  publishedDate?: string;
  author?: string;
}

// ─── Filter types ───

export type FeedFilter = "all" | "claude" | "openai" | "polarized";
