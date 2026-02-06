import OpenAI from "openai";
import type { Post } from "./types";

let openai: OpenAI | null = null;

function getOpenAI(): OpenAI {
  if (!openai) {
    openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
  }
  return openai;
}

export interface SummaryOutput {
  headline: string;
  subtext: string;
  claude_vibe: string;   // e.g. "Engineers love it", "Mixed reactions", "Under fire"
  openai_vibe: string;   // same style
  takes: {
    text: string;        // The actual quote or paraphrased take
    source: string;      // "Twitter engineer", "Reddit r/LocalLLaMA", "HN thread"
    sentiment: "positive" | "negative" | "neutral";
    subject: "claude" | "openai" | "both";
  }[];
}

export async function generateSummary(posts: Post[]): Promise<string> {
  if (posts.length === 0) {
    return JSON.stringify({
      headline: "Waiting for first scan",
      subtext: "Run a cron scan to start tracking sentiment.",
      claude_vibe: "No data yet",
      openai_vibe: "No data yet",
      takes: [],
    });
  }

  const client = getOpenAI();

  const claudePosts = posts.filter((p) => p.subject === "claude" || p.subject === "both");
  const openaiPosts = posts.filter((p) => p.subject === "openai" || p.subject === "both");
  const positivePosts = posts.filter((p) => p.sentiment === "positive");
  const negativePosts = posts.filter((p) => p.sentiment === "negative");

  // Feed the model maximum context — titles, snippets, sentiment, source type
  const postsContext = posts
    .slice(0, 80)
    .map(
      (p, i) =>
        `[${i + 1}] ${p.source_type} | ${p.subject} | ${p.sentiment} (${p.sentiment_score})
Title: ${p.title || "Untitled"}
Snippet: ${p.snippet?.slice(0, 200) || ""}`
    )
    .join("\n\n");

  const prompt = `You are analyzing ${posts.length} posts about Claude/Anthropic (especially Opus 4.6) vs OpenAI (especially Codex) from the last 24 hours.

Stats: ${claudePosts.length} about Claude, ${openaiPosts.length} about OpenAI. ${positivePosts.length} positive, ${negativePosts.length} negative.

Here are the posts:

${postsContext}

Return a JSON object with EXACTLY this structure:
{
  "headline": "A punchy 5-10 word editorial headline that captures the main narrative. Think Bloomberg meets tech Twitter. Examples: 'Engineers Split on Opus 4.6 vs Codex', 'Opus 4.6 Has Devs Switching Back to Claude'",
  "subtext": "One sentence, max 25 words — the key takeaway an engineer would want to know",
  "claude_vibe": "3-5 word summary of how people feel about Claude right now (e.g. 'Devs are impressed', 'Hype but unproven', 'Best coding model yet')",
  "openai_vibe": "3-5 word summary of how people feel about OpenAI right now (e.g. 'Codex underwhelms so far', 'Playing catch-up', 'Strong but pricey')",
  "takes": [
    {
      "text": "An actual take from the posts — pull real quotes or closely paraphrase specific opinions engineers are expressing. Not generic. Should feel like reading someone's tweet or reddit comment.",
      "source": "Where this came from — be specific: 'Twitter engineer', 'Reddit r/ChatGPT', 'HN commenter', 'Tech blogger' etc.",
      "sentiment": "positive",
      "subject": "claude"
    },
    {
      "text": "Another real take — mix positive and negative, Claude and OpenAI",
      "source": "Twitter developer",
      "sentiment": "negative",
      "subject": "openai"
    },
    {
      "text": "A third take — pick the most interesting/spicy/insightful ones",
      "source": "Reddit r/artificial",
      "sentiment": "positive",
      "subject": "both"
    },
    {
      "text": "A fourth take if there's good material",
      "source": "HN commenter",
      "sentiment": "negative",
      "subject": "claude"
    },
    {
      "text": "A fifth take — aim for 5-6 total, covering both sides",
      "source": "Twitter ML researcher",
      "sentiment": "positive",
      "subject": "openai"
    }
  ]
}

CRITICAL RULES:
- The takes MUST be drawn from actual post content — reference real titles, real opinions, real benchmarks mentioned in the posts.
- Don't make up generic takes like "AI is advancing fast". Pull SPECIFIC reactions: model names, feature names, comparison results.
- The vibe labels should be what you'd tell a friend if they asked "so what do people think about Opus 4.6?"
- Aim for 5-6 takes covering a MIX of Claude takes, OpenAI takes, and comparison takes.
- Include both positive AND negative takes for both sides.
Return ONLY valid JSON, nothing else.`;

  try {
    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You are a sharp tech analyst writing for engineers. You pull real quotes and specific takes from source material. Your tone is informed, direct, and opinionated — like the best tech Twitter accounts. Return only valid JSON.",
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.7,
      max_tokens: 1500,
      response_format: { type: "json_object" },
    });

    const text = response.choices[0].message.content || "{}";
    JSON.parse(text); // Validate
    return text;
  } catch (error) {
    console.error("[Summary] Generation failed:", error);
    return JSON.stringify({
      headline: "Analysis in progress",
      subtext: "Summary generation encountered an error.",
      claude_vibe: "Pending",
      openai_vibe: "Pending",
      takes: [],
    });
  }
}
