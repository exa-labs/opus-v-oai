import { createHash } from "crypto";
import type { SourceType, Subject } from "./types";

/**
 * SHA-256 hash of a URL for dedup
 */
export function hashUrl(url: string): string {
  return createHash("sha256").update(url.toLowerCase().trim()).digest("hex");
}

/**
 * Classify source type from URL hostname
 */
export function classifySourceType(url: string): SourceType {
  try {
    // Exa sometimes returns URLs without protocol (e.g. "x.com/...")
    const normalizedUrl = url.startsWith("http") ? url : `https://${url}`;
    const hostname = new URL(normalizedUrl).hostname.toLowerCase();

    if (
      hostname.includes("twitter.com") ||
      hostname.includes("x.com") ||
      hostname.includes("nitter")
    ) {
      return "twitter";
    }

    if (hostname.includes("reddit.com") || hostname.includes("old.reddit.com")) {
      return "reddit";
    }

    if (
      hostname.includes("news.ycombinator.com") ||
      hostname.includes("lobste.rs")
    ) {
      return "forum";
    }

    if (
      hostname.includes("community.openai.com") ||
      hostname.includes("community.anthropic.com") ||
      hostname.includes("discourse") ||
      hostname.includes("forum")
    ) {
      return "forum";
    }

    if (
      hostname.includes("techcrunch.com") ||
      hostname.includes("theverge.com") ||
      hostname.includes("arstechnica.com") ||
      hostname.includes("reuters.com") ||
      hostname.includes("bloomberg.com") ||
      hostname.includes("cnbc.com") ||
      hostname.includes("bbc.") ||
      hostname.includes("nytimes.com") ||
      hostname.includes("washingtonpost.com") ||
      hostname.includes("wired.com") ||
      hostname.includes("cnn.com") ||
      hostname.includes("zdnet.com") ||
      hostname.includes("venturebeat.com") ||
      hostname.includes("semafor.com") ||
      hostname.includes("9to5mac.com") ||
      hostname.includes("9to5google.com") ||
      hostname.includes("engadget.com") ||
      hostname.includes("tomsguide.com") ||
      hostname.includes("businessinsider.com") ||
      hostname.includes("fortune.com") ||
      hostname.includes("theinformation.com")
    ) {
      return "news";
    }

    return "blog";
  } catch {
    return "blog";
  }
}

/**
 * Extract a clean, readable domain name from a URL.
 * "https://www.techcrunch.com/2025/..." → "techcrunch.com"
 * "https://x.com/karpathy/..." → "x.com"
 */
export function extractDomain(url: string): string {
  try {
    const normalizedUrl = url.startsWith("http") ? url : `https://${url}`;
    const hostname = new URL(normalizedUrl).hostname.toLowerCase();
    return hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

/**
 * Classify subject (claude / openai / both) via keyword matching
 */
export function classifySubject(title: string, snippet: string): Subject {
  const text = `${title} ${snippet}`.toLowerCase();

  const claudeKeywords = [
    "claude",
    "anthropic",
    "sonnet",
    "opus",
    "haiku",
    "constitutional ai",
    "claude code",
  ];
  const openaiKeywords = [
    "openai",
    "chatgpt",
    "gpt-4",
    "gpt-5",
    "gpt4",
    "gpt5",
    "gpt-4.1",
    "dall-e",
    "dalle",
    "sora",
    "sam altman",
    "o1",
    "o3",
    "o4",
    "codex",
  ];

  const hasClaude = claudeKeywords.some((kw) => text.includes(kw));
  const hasOpenai = openaiKeywords.some((kw) => text.includes(kw));

  if (hasClaude && hasOpenai) return "both";
  if (hasClaude) return "claude";
  if (hasOpenai) return "openai";

  // Default: try to infer from context
  return "both";
}

/**
 * Truncate text to max length
 */
export function truncate(text: string | undefined | null, maxLength: number): string {
  if (!text) return "";
  return text.length > maxLength ? text.slice(0, maxLength) + "..." : text;
}

/**
 * Format ISO date to relative time string
 */
export function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/**
 * Format date for display
 */
export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
