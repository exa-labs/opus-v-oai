import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

export const maxDuration = 60;

let openai: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!openai) openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
  return openai;
}

export type Bias = "claude" | "openai" | "neutral";

export interface BiasResult {
  items: { id: string; bias: Bias }[];
  summary: { claude: number; openai: number; neutral: number };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const items: { id: string; text: string }[] = body.items || [];

    if (items.length === 0) {
      return NextResponse.json({ items: [], summary: { claude: 0, openai: 0, neutral: 0 } });
    }

    const client = getOpenAI();

    const itemList = items
      .map((item, i) => `[${i}] ${item.text.slice(0, 300)}`)
      .join("\n\n");

    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You classify tech content about Claude/Anthropic vs OpenAI into three categories:
- "claude": Favors Claude, Anthropic, Claude Code. Praises Claude's performance, features, or team. Says Claude is better.
- "openai": Favors OpenAI, GPT, Codex, ChatGPT. Praises OpenAI's performance, features, or team. Says OpenAI is better.
- "neutral": Stating facts without taking sides, comparing both equally, or discussing the broader landscape.

Be precise. If content mentions BOTH but clearly favors one side, classify it as that side.
If it's genuinely balanced or just reporting facts, it's neutral.
Return valid JSON.`,
        },
        {
          role: "user",
          content: `Classify each item as "claude", "openai", or "neutral":

${itemList}

Return JSON: {"results": [{"index": 0, "bias": "claude"}, {"index": 1, "bias": "neutral"}, ...]}`,
        },
      ],
      temperature: 0.1,
      max_tokens: 2000,
      response_format: { type: "json_object" },
    });

    const text = response.choices[0].message.content || "{}";
    const parsed = JSON.parse(text);
    const results: { index: number; bias: Bias }[] = parsed.results || [];

    const biasItems: { id: string; bias: Bias }[] = [];
    let claudeCount = 0;
    let openaiCount = 0;
    let neutralCount = 0;

    for (const { index, bias } of results) {
      if (index >= 0 && index < items.length) {
        const validBias: Bias = bias === "claude" || bias === "openai" ? bias : "neutral";
        biasItems.push({ id: items[index].id, bias: validBias });
        if (validBias === "claude") claudeCount++;
        else if (validBias === "openai") openaiCount++;
        else neutralCount++;
      }
    }

    // Fill in any missing items as neutral
    for (const item of items) {
      if (!biasItems.find(b => b.id === item.id)) {
        biasItems.push({ id: item.id, bias: "neutral" });
        neutralCount++;
      }
    }

    return NextResponse.json({
      items: biasItems,
      summary: { claude: claudeCount, openai: openaiCount, neutral: neutralCount },
    });
  } catch (error) {
    console.error("[Bias] Classification failed:", error);
    return NextResponse.json(
      { items: [], summary: { claude: 0, openai: 0, neutral: 0 } },
      { status: 500 }
    );
  }
}
