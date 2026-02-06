import Exa from "exa-js";
import type { ChatSearchResult } from "./types";

let exa: Exa | null = null;

function getExa(): Exa {
  if (!exa) {
    exa = new Exa(process.env.EXA_API_KEY!);
  }
  return exa;
}

/**
 * Fast Exa search for the chatbot.
 * Scoped to AI/ML topics for relevance.
 */
export async function searchExa(
  query: string,
  numResults: number = 10
): Promise<ChatSearchResult[]> {
  const client = getExa();

  const response = await client.searchAndContents(query, {
    numResults: Math.min(20, Math.max(3, numResults)),
    text: true,
    type: "auto",
    startPublishedDate: getStartDate(336), // 2 weeks
  });

  if (!response.results || response.results.length === 0) {
    return [];
  }

  return response.results.map((r) => ({
    title: r.title || "",
    url: r.url,
    text: r.text?.slice(0, 1500),
    publishedDate: r.publishedDate,
    author: r.author,
  }));
}

/**
 * Run multiple searches in parallel
 */
export async function searchMultiple(
  searches: { query: string; numResults?: number }[]
): Promise<{ query: string; results: ChatSearchResult[] }[]> {
  const promises = searches.map(({ query, numResults = 10 }) =>
    searchExa(query, numResults)
      .then((results) => ({ query, results }))
      .catch((err) => {
        console.error(`[Exa Search] Failed for "${query}":`, err.message);
        return { query, results: [] as ChatSearchResult[] };
      })
  );

  return Promise.all(promises);
}

function getStartDate(maxAgeHours: number): string {
  return new Date(Date.now() - maxAgeHours * 60 * 60 * 1000).toISOString();
}
