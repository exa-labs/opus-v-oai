import type { Post } from "./types";
import { updatePostEngagement, markEngagementFailed, updatePostImageUrl } from "./db";

const BATCH_SIZE = 100;

// ─── Types ───

interface TwitterApiTweet {
  id: string;
  likeCount: number;
  retweetCount: number;
  replyCount: number;
  quoteCount: number;
  viewCount: number;
  bookmarkCount: number;
  media?: { media_url_https?: string; type?: string }[];
  extendedEntities?: { media?: { media_url_https?: string; type?: string }[] };
}

interface TwitterApiResponse {
  tweets: TwitterApiTweet[];
  status?: string;
}

// ─── URL Parsing ───

export function extractTweetId(url: string): string | null {
  try {
    const normalized = url.startsWith("http") ? url : `https://${url}`;
    const urlObj = new URL(normalized);
    const hostname = urlObj.hostname.toLowerCase();

    if (!hostname.includes("twitter.com") && !hostname.includes("x.com")) {
      return null;
    }

    const match = urlObj.pathname.match(/\/status(?:es)?\/(\d+)/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

// ─── API Call ───

async function fetchEngagementBatch(
  tweetIds: string[]
): Promise<Map<string, TwitterApiTweet>> {
  const apiKey = process.env.TWITTER_API_KEY;
  if (!apiKey) throw new Error("TWITTER_API_KEY not set");

  const response = await fetch(
    `https://api.twitterapi.io/twitter/tweets?tweet_ids=${tweetIds.join(",")}`,
    {
      method: "GET",
      headers: {
        "X-API-Key": apiKey,
        "Content-Type": "application/json",
      },
    }
  );

  if (!response.ok) {
    throw new Error(`TwitterAPI.io responded ${response.status}: ${await response.text()}`);
  }

  const data: TwitterApiResponse = await response.json();
  const map = new Map<string, TwitterApiTweet>();
  for (const tweet of data.tweets || []) {
    map.set(tweet.id, tweet);
  }
  return map;
}

// ─── Formatting ───

function formatCount(n: number | null | undefined): string {
  if (n == null || n === 0) return "0";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

export function formatEngagementForPrompt(post: Post): string {
  if (post.likes == null && post.views == null) return "";

  const parts: string[] = [];
  if (post.likes && post.likes > 0) parts.push(`${formatCount(post.likes)} likes`);
  if (post.retweets && post.retweets > 0) parts.push(`${formatCount(post.retweets)} RTs`);
  if (post.views && post.views > 0) parts.push(`${formatCount(post.views)} views`);

  return parts.length > 0 ? parts.join(", ") : "";
}

// ─── Main Orchestrator ───

export async function fetchEngagement(
  tweets: Post[]
): Promise<{ fetched: number; skipped: number; failed: number }> {
  if (tweets.length === 0) return { fetched: 0, skipped: 0, failed: 0 };

  if (!process.env.TWITTER_API_KEY) {
    console.warn("[Engagement] TWITTER_API_KEY not set, skipping");
    return { fetched: 0, skipped: tweets.length, failed: 0 };
  }

  // Extract tweet IDs from URLs
  const fetchable: { post: Post; tweetId: string }[] = [];
  let skipped = 0;

  for (const post of tweets) {
    const tweetId = extractTweetId(post.url);
    if (tweetId) {
      fetchable.push({ post, tweetId });
    } else {
      markEngagementFailed(post.id);
      skipped++;
    }
  }

  console.log(`[Engagement] ${fetchable.length} tweets to fetch, ${skipped} skipped (no tweet ID)`);

  let fetched = 0;
  let failed = 0;

  for (let i = 0; i < fetchable.length; i += BATCH_SIZE) {
    const batch = fetchable.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(fetchable.length / BATCH_SIZE);
    console.log(`[Engagement] Batch ${batchNum}/${totalBatches} (${batch.length} tweets)`);

    try {
      const tweetIds = batch.map((b) => b.tweetId);
      const results = await fetchEngagementBatch(tweetIds);

      for (const { post, tweetId } of batch) {
        const data = results.get(tweetId);
        if (data) {
          updatePostEngagement(post.id, {
            likes: data.likeCount || 0,
            retweets: data.retweetCount || 0,
            replies: data.replyCount || 0,
            views: data.viewCount || 0,
            quotes: data.quoteCount || 0,
            bookmarks: data.bookmarkCount || 0,
          });
          // Extract image from media if available
          const media = data.media || data.extendedEntities?.media;
          if (media && media.length > 0) {
            const imageMedia = media.find(m => m.type === "photo" || m.media_url_https);
            if (imageMedia?.media_url_https) {
              updatePostImageUrl(post.id, imageMedia.media_url_https);
            }
          }
          fetched++;
        } else {
          markEngagementFailed(post.id);
          skipped++;
        }
      }
    } catch (err) {
      console.error(`[Engagement] Batch ${batchNum} failed:`, err);
      for (const { post } of batch) {
        markEngagementFailed(post.id);
      }
      failed += batch.length;
    }
  }

  console.log(`[Engagement] Done. Fetched: ${fetched}, Skipped: ${skipped}, Failed: ${failed}`);
  return { fetched, skipped, failed };
}
