import OpenAI from "openai";
import type { SentimentResult, Sentiment } from "./types";

let openai: OpenAI | null = null;

function getOpenAI(): OpenAI {
  if (!openai) {
    openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
  }
  return openai;
}

interface PostForClassification {
  url_hash: string;
  title: string;
  snippet: string;
  source_type: string;
  subject: string;
}

const BATCH_SIZE = 25;

async function classifyBatch(
  posts: PostForClassification[]
): Promise<SentimentResult[]> {
  const client = getOpenAI();

  const postsList = posts
    .map(
      (p, i) =>
        `[${i}] Subject: ${p.subject} | Source: ${p.source_type}
  Title: ${p.title}
  Snippet: ${p.snippet?.slice(0, 250) || "N/A"}`
    )
    .join("\n\n");

  const prompt = `You are classifying sentiment from the perspective of a technical engineer evaluating AI model capabilities.

These posts are about Claude/Anthropic and OpenAI products — specifically model quality, coding ability, developer tools, and real-world performance.

For each post, determine:
1. sentiment: "positive", "negative", or "neutral"
2. sentiment_score: integer from -100 (devastatingly negative) to +100 (ecstatically positive)

Classification guide for TECHNICAL AI discourse:
- POSITIVE: "this model is cracked", great benchmarks, impressive demos, good developer experience, praise for capabilities, excitement about features, "it just works", favorable comparisons
- NEGATIVE: hallucinations, regressions, bad API experience, "it's worse than before", unfavorable benchmarks, frustration with quality, criticism of capabilities, "doesn't work for my use case"
- NEUTRAL: factual announcements without opinion, balanced comparisons, release notes, pricing info without judgment

Important:
- Engineer slang is opinionated: "cracked", "goated", "insane" = very positive. "mid", "cope", "it's over" = negative.
- Most engineers have opinions. Don't default to neutral — that's for genuinely balanced/factual content only.
- Score intensity: A tweet saying "opus 4.6 is the best model ever" is +85. "it's pretty good" is +30. "absolute garbage" is -80.

Here are ${posts.length} posts:

${postsList}

Return a JSON object: {"results": [{"index": <number>, "sentiment": "positive"|"negative"|"neutral", "sentiment_score": <-100 to 100>}]}`;

  try {
    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You classify sentiment in technical AI discussions from an engineer's perspective. You understand developer slang and internet culture. Be decisive — most content is opinionated. Return valid JSON.",
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.2,
      max_tokens: 2000,
      response_format: { type: "json_object" },
    });

    const content = response.choices[0].message.content || "{}";
    const parsed = JSON.parse(content);
    const items: { index: number; sentiment: string; sentiment_score: number }[] =
      parsed.results || parsed.classifications || [];

    console.log(`[Sentiment] Batch returned ${items.length} classifications`);

    const resultMap = new Map<number, { sentiment: Sentiment; score: number }>();
    for (const item of items) {
      const sent = (["positive", "negative", "neutral"].includes(item.sentiment)
        ? item.sentiment
        : "neutral") as Sentiment;
      resultMap.set(item.index, {
        sentiment: sent,
        score: Math.max(-100, Math.min(100, item.sentiment_score || 0)),
      });
    }

    return posts.map((p, i) => {
      const r = resultMap.get(i);
      return {
        url_hash: p.url_hash,
        sentiment: r?.sentiment || ("neutral" as Sentiment),
        sentiment_score: r?.score || 0,
      };
    });
  } catch (error) {
    console.error("[Sentiment] Batch classification failed:", error);
    return posts.map((p) => ({
      url_hash: p.url_hash,
      sentiment: "neutral" as Sentiment,
      sentiment_score: 0,
    }));
  }
}

export async function batchClassifySentiment(
  posts: PostForClassification[]
): Promise<SentimentResult[]> {
  if (posts.length === 0) return [];

  const results: SentimentResult[] = [];

  for (let i = 0; i < posts.length; i += BATCH_SIZE) {
    const chunk = posts.slice(i, i + BATCH_SIZE);
    console.log(`[Sentiment] Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(posts.length / BATCH_SIZE)} (${chunk.length} posts)`);
    const batchResults = await classifyBatch(chunk);
    results.push(...batchResults);
  }

  const positiveCount = results.filter((r) => r.sentiment === "positive").length;
  const negativeCount = results.filter((r) => r.sentiment === "negative").length;
  const neutralCount = results.filter((r) => r.sentiment === "neutral").length;
  console.log(`[Sentiment] Total: ${positiveCount} positive, ${negativeCount} negative, ${neutralCount} neutral`);

  return results;
}
