import { NextResponse } from "next/server";
import OpenAI from "openai";
import { getAllTweetsForSummary } from "@/lib/db";

export const maxDuration = 60;

let openai: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!openai) openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
  return openai;
}

export async function GET() {
  try {
    const tweets = await getAllTweetsForSummary();

    if (tweets.length === 0) {
      return NextResponse.json({ summary: null });
    }

    // Build a condensed view of ALL tweets for the model
    // Group by subject to give context
    const claudeTweets = tweets.filter(t => t.subject === "claude" || t.subject === "both");
    const openaiTweets = tweets.filter(t => t.subject === "openai" || t.subject === "both");

    // Take top tweets by importance (already sorted), give generous context
    const tweetList = tweets.slice(0, 300).map((t, i) =>
      `@${(t.author || "unknown").replace(/^@+/, "")} [${t.subject}]: ${(t.snippet || "").slice(0, 200)}`
    ).join("\n");

    const client = getOpenAI();

    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You write crisp, editorial-quality summaries of tech community sentiment. You're specific about what people think and why. No filler, no hedging. Write like a senior editor at The Information.",
        },
        {
          role: "user",
          content: `We've analyzed ${tweets.length} tweets about Claude Opus 4.6 / Anthropic (${claudeTweets.length} mentions) and OpenAI Codex 5.3 (${openaiTweets.length} mentions) from the past 24 hours.

Here are the top ${Math.min(300, tweets.length)} tweets by importance:

${tweetList}

Write a 2-3 sentence summary of the OVERALL impression from the engineering community right now. What's the vibe? Who's winning hearts and minds? What are the key tensions or surprises?

Be specific — reference actual trends, tools, or sentiments you see in the data. Don't be generic.
Return JSON: {"summary": "your 2-3 sentence summary here"}`,
        },
      ],
      temperature: 0.3,
      max_tokens: 500,
      response_format: { type: "json_object" },
    });

    const text = response.choices[0].message.content || "{}";
    const parsed = JSON.parse(text);

    return NextResponse.json({
      summary: parsed.summary || null,
      tweetCount: tweets.length,
      claudeMentions: claudeTweets.length,
      openaiMentions: openaiTweets.length,
    });
  } catch (error) {
    console.error("[Summary] Generation failed:", error);
    return NextResponse.json({ summary: null }, { status: 500 });
  }
}
