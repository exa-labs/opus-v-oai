import Exa from "exa-js";
import type { ExaCitation } from "./types";

let exa: Exa | null = null;

function getExa(): Exa {
  if (!exa) {
    exa = new Exa(process.env.EXA_API_KEY!);
  }
  return exa;
}

function getTodayStart(): string {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
}

function getYesterdayStart(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 1);
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
}

interface SearchQuery {
  query: string;
  numResults: number;
  category?: string;
  includeDomains?: string[];
  startPublishedDate?: string;
}

async function runSearch(sq: SearchQuery): Promise<ExaCitation[]> {
  const client = getExa();

  const params: Record<string, unknown> = {
    numResults: sq.numResults,
    text: true,
    type: "auto" as const,
    startPublishedDate: sq.startPublishedDate || getYesterdayStart(),
  };

  if (sq.category) {
    params.category = sq.category;
  }

  if (sq.includeDomains && sq.includeDomains.length > 0) {
    params.includeDomains = sq.includeDomains;
  }

  try {
    const response = await client.searchAndContents(
      sq.query,
      params as Parameters<typeof client.searchAndContents>[1]
    );

    if (!response.results || response.results.length === 0) {
      return [];
    }

    return response.results.map((r: any) => ({
      url: r.url,
      title: r.title || "",
      snippet: r.text?.slice(0, 500) || "",
      publishedDate: r.publishedDate,
      author: r.author,
      image: r.image || undefined,
    }));
  } catch (err) {
    console.error(`[Exa] Failed for "${sq.query}":`, err);
    return [];
  }
}

async function runParallelSearches(searches: SearchQuery[]): Promise<ExaCitation[]> {
  const results = await Promise.all(searches.map(runSearch));
  return results.flat();
}

// Junk domains to filter
const EXCLUDED_URL_PATTERNS = [
  "composio.dev",
  "toolify.ai",
  "theresanaiforthat.com",
  "aimodels.fyi",
  "gptstore.ai",
  "opentools.ai",
  "aiparabellum.com",
  "marktechpost.com",
  "analyticsinsight.net",
  "decrypt.co",
  "yahoo.com/lifestyle",
  "medium.com/@",
  "aiskill.market",
  "claudefa.st",
  "datacamp.com",
  "geeksforgeeks.org",
  "zapier.com/blog",
];

function isJunkUrl(url: string): boolean {
  const lower = url.toLowerCase();
  return EXCLUDED_URL_PATTERNS.some((p) => lower.includes(p));
}

/**
 * Discover 1000+ sources about Claude/Anthropic vs OpenAI.
 * Heavy Twitter focus, plus Reddit, HN, and quality news/blogs.
 * Returns raw citations — filtering happens downstream via LLM.
 */
export async function discoverPosts(): Promise<{
  allCitations: ExaCitation[];
  totalSearched: number;
}> {
  console.log("[Exa] Starting large-scale discovery...");

  const twitterDomains = ["twitter.com", "x.com"];
  const redditDomains = ["reddit.com", "old.reddit.com"];
  const hnDomains = ["news.ycombinator.com"];
  const yesterday = getYesterdayStart();
  const today = getTodayStart();

  // ── MASSIVE tweet discovery ──
  // Goal: 800+ tweets about Claude and OpenAI
  const tweetSearches: SearchQuery[] = [
    // Claude / Anthropic tweets — many angles
    { query: "Claude Opus model", numResults: 30, category: "tweet", startPublishedDate: yesterday },
    { query: "Claude Sonnet impressions", numResults: 30, category: "tweet", startPublishedDate: yesterday },
    { query: "Claude coding benchmark performance", numResults: 25, category: "tweet", startPublishedDate: yesterday },
    { query: "Claude vs GPT comparison", numResults: 25, category: "tweet", startPublishedDate: yesterday },
    { query: "Claude Code agentic", numResults: 25, category: "tweet", startPublishedDate: yesterday },
    { query: "Anthropic Claude new model today", numResults: 25, category: "tweet", startPublishedDate: yesterday },
    { query: "Claude best model ever", numResults: 20, category: "tweet", startPublishedDate: yesterday },
    { query: "Claude disappointing mid overrated", numResults: 20, category: "tweet", startPublishedDate: yesterday },
    { query: "Claude upgrade experience developer", numResults: 20, category: "tweet", startPublishedDate: yesterday },
    { query: "Anthropic Claude benchmark SWE-bench", numResults: 20, category: "tweet", startPublishedDate: yesterday },
    { query: "Claude coding agent terminal", numResults: 20, category: "tweet", startPublishedDate: yesterday },
    { query: "Claude reasoning thinking model", numResults: 15, category: "tweet", startPublishedDate: yesterday },
    { query: "Anthropic Claude beats OpenAI", numResults: 15, category: "tweet", startPublishedDate: yesterday },
    { query: "Claude Code review first impressions engineer", numResults: 15, category: "tweet", startPublishedDate: yesterday },

    // OpenAI / Codex / GPT tweets — many angles
    { query: "OpenAI Codex release agent", numResults: 30, category: "tweet", startPublishedDate: yesterday },
    { query: "Codex coding agent cloud", numResults: 25, category: "tweet", startPublishedDate: yesterday },
    { query: "OpenAI Codex impressions review", numResults: 25, category: "tweet", startPublishedDate: yesterday },
    { query: "Codex vs Claude Code comparison", numResults: 25, category: "tweet", startPublishedDate: yesterday },
    { query: "OpenAI Codex benchmark performance", numResults: 20, category: "tweet", startPublishedDate: yesterday },
    { query: "GPT o3 o4-mini model", numResults: 20, category: "tweet", startPublishedDate: yesterday },
    { query: "OpenAI Codex disappointing underwhelming", numResults: 20, category: "tweet", startPublishedDate: yesterday },
    { query: "OpenAI Codex amazing impressive", numResults: 20, category: "tweet", startPublishedDate: yesterday },
    { query: "Codex agent sandbox environment coding", numResults: 15, category: "tweet", startPublishedDate: yesterday },
    { query: "OpenAI developer tools API launch", numResults: 15, category: "tweet", startPublishedDate: yesterday },
    { query: "Sam Altman Codex announcement", numResults: 15, category: "tweet", startPublishedDate: yesterday },

    // Head-to-head / comparison tweets
    { query: "Claude vs Codex which is better", numResults: 25, category: "tweet", startPublishedDate: yesterday },
    { query: "Claude vs ChatGPT coding", numResults: 20, category: "tweet", startPublishedDate: yesterday },
    { query: "Claude Code vs Cursor vs Copilot", numResults: 20, category: "tweet", startPublishedDate: yesterday },
    { query: "Anthropic vs OpenAI AI models", numResults: 15, category: "tweet", startPublishedDate: yesterday },
    { query: "best AI coding model right now", numResults: 15, category: "tweet", startPublishedDate: yesterday },

    // Twitter domain backup (catches what category=tweet misses)
    { query: "Claude Opus Anthropic", numResults: 20, includeDomains: twitterDomains, startPublishedDate: yesterday },
    { query: "Codex OpenAI agent", numResults: 20, includeDomains: twitterDomains, startPublishedDate: yesterday },
    { query: "Claude Code developer", numResults: 15, includeDomains: twitterDomains, startPublishedDate: yesterday },
    { query: "AI coding model comparison today", numResults: 15, includeDomains: twitterDomains, startPublishedDate: yesterday },
  ];

  // ── Reddit discussion threads ──
  const redditSearches: SearchQuery[] = [
    { query: "Claude Opus review impressions", numResults: 20, includeDomains: redditDomains, startPublishedDate: yesterday },
    { query: "OpenAI Codex review impressions agent", numResults: 20, includeDomains: redditDomains, startPublishedDate: yesterday },
    { query: "Claude Code vs Cursor vs Copilot", numResults: 15, includeDomains: redditDomains, startPublishedDate: yesterday },
    { query: "Codex vs Claude Code comparison", numResults: 15, includeDomains: redditDomains, startPublishedDate: yesterday },
    { query: "best AI coding model 2025", numResults: 10, includeDomains: redditDomains, startPublishedDate: yesterday },
    { query: "Anthropic OpenAI announcement today", numResults: 10, includeDomains: redditDomains, startPublishedDate: yesterday },
  ];

  // ── Hacker News ──
  const hnSearches: SearchQuery[] = [
    { query: "Claude Opus Anthropic", numResults: 15, includeDomains: hnDomains, startPublishedDate: yesterday },
    { query: "OpenAI Codex agent coding", numResults: 15, includeDomains: hnDomains, startPublishedDate: yesterday },
  ];

  // ── Quality web articles ──
  const webSearches: SearchQuery[] = [
    { query: "Claude Opus release review technical analysis", numResults: 15, startPublishedDate: yesterday },
    { query: "OpenAI Codex launch review hands-on developer", numResults: 15, startPublishedDate: yesterday },
    { query: "Anthropic Claude Code developer tools launch", numResults: 10, startPublishedDate: yesterday },
    { query: "Claude vs OpenAI comparison benchmark analysis", numResults: 10, startPublishedDate: yesterday },
  ];

  // Run all in parallel batches
  const [tweets, reddit, hn, web] = await Promise.all([
    runParallelSearches(tweetSearches),
    runParallelSearches(redditSearches),
    runParallelSearches(hnSearches),
    runParallelSearches(webSearches),
  ]);

  const totalSearched = tweets.length + reddit.length + hn.length + web.length;
  const allRaw = [...tweets, ...reddit, ...hn, ...web];

  // Deduplicate by URL
  const seen = new Set<string>();
  const deduped: ExaCitation[] = [];
  for (const c of allRaw) {
    const key = c.url.toLowerCase().trim();
    if (!seen.has(key) && !isJunkUrl(c.url)) {
      seen.add(key);
      deduped.push(c);
    }
  }

  const junkCount = allRaw.length - deduped.length - (allRaw.length - seen.size - (allRaw.length - deduped.length));
  console.log(`[Exa] Raw: ${totalSearched} results. After dedup + junk filter: ${deduped.length} unique citations.`);

  return { allCitations: deduped, totalSearched };
}
