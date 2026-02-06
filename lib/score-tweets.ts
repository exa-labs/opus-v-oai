import OpenAI from "openai";
import type { Post } from "./types";
import { updateImportanceScore, updatePostTake } from "./db";
import { getNotableInfo, getNotableHandlesForPrompt } from "./notable-accounts";
import { formatEngagementForPrompt } from "./twitter-engagement";

let openai: OpenAI | null = null;

function getOpenAI(): OpenAI {
  if (!openai) {
    openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
  }
  return openai;
}

const BATCH_SIZE = 30; // Smaller batches = more context per tweet = better scoring

/**
 * Score tweets by importance/substance using GPT-4o-mini + notable account boosting.
 * Scores 1-10 get stored in the DB. Higher = more important.
 *
 * Two-pass approach:
 *   Pass 1: Score all tweets in batches (gpt-4o-mini, fast)
 *   Pass 2: Re-score the top candidates with gpt-4o (slower, smarter)
 */
export async function scoreTweets(tweets: Post[]): Promise<void> {
  if (tweets.length === 0) return;

  const client = getOpenAI();
  const notableList = getNotableHandlesForPrompt();

  console.log(`[Score] Starting scoring of ${tweets.length} tweets...`);

  // ── PASS 1: Score all tweets with gpt-4o-mini ──
  for (let i = 0; i < tweets.length; i += BATCH_SIZE) {
    const batch = tweets.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(tweets.length / BATCH_SIZE);
    console.log(`[Score] Pass 1 — Batch ${batchNum}/${totalBatches} (${batch.length} tweets)`);

    const tweetList = batch
      .map((t, j) => {
        const handle = `@${(t.author || "unknown").replace(/^@/, "")}`;
        const engagement = formatEngagementForPrompt(t);
        const engTag = engagement ? ` (${engagement})` : "";
        return `[${j}] ${handle}${engTag}: ${t.snippet?.slice(0, 350) || "No content"}`;
      })
      .join("\n\n");

    const prompt = `You are curating a feed for senior software engineers tracking the Claude Opus 4.6 vs OpenAI Codex 5.3 releases. We care specifically about these versions — not older models unless they're direct comparisons.

Score each tweet 1-10 on how VALUABLE it would be in that feed. Think: "Would a principal engineer at a top tech company find this worth reading?"

SCORING CRITERIA:

9-10 ESSENTIAL (would lead a newsletter):
- Specific benchmark results with numbers ("Opus 4.6 scores 72.1% on SWE-bench Full")
- First-hand experience from a recognized engineer ("I spent 3 hours with Codex and here's what I found...")
- Breaking news or feature announcements from insiders
- Viral-quality hot take with real substance and specifics
- Detailed technical comparison with evidence

7-8 VALUABLE (worth including):
- Substantive technical opinion with specific claims ("Claude Code handles multi-file refactors better because...")
- Real workflow comparisons with details
- Interesting counterpoint or contrarian take backed by reasoning
- Specific feature analysis ("The sandbox environment in Codex means X for CI pipelines")

5-6 FILLER (generic but on topic):
- "This is amazing/impressive" with no specifics
- Generic praise or criticism without detail
- Retweet of news with brief comment
- Basic comparison without evidence

3-4 LOW VALUE:
- "Wow cool" / emoji-only reactions
- Promotional or marketing tone
- Vague AI hype with no substance
- Asking questions without adding context

1-2 NOISE:
- Completely off-topic
- Spam, bots, crypto shills
- Just linking to announcement with zero added value

IMPORTANT: Be HARSH. Most tweets should score 3-6. Only truly substantive content gets 7+. We want to surface the BEST content, not everything.

ENGAGEMENT CONTEXT:
Some tweets include engagement metrics (likes, RTs, views). High engagement means the community found this tweet resonant — use it as a signal:
- 50k+ likes from a notable account = almost certainly newsworthy (7+)
- 10k+ likes = community validation, bump +1-2 even if text seems generic
- 1k-10k likes = mild signal, consider alongside text quality
- <100 likes = score purely on text quality
- Never let engagement override terrible content — a viral "lol" is still a 3

KNOWN NOTABLE ACCOUNTS (ICs with large audiences — their opinions carry more weight):
${notableList}

Here are ${batch.length} tweets:

${tweetList}

Return JSON: {"scores": [{"index": 0, "score": 7}, {"index": 1, "score": 3}, ...]}
Include every tweet index. Be discriminating.`;

    try {
      const response = await client.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "You are a ruthless content curator for a senior engineering audience. Most tweets are noise. You score 1-10 with a harsh curve: median should be around 4-5. Only genuinely substantive, specific, informative content gets 7+. Return valid JSON.",
          },
          { role: "user", content: prompt },
        ],
        temperature: 0.1,
        max_tokens: 2000,
        response_format: { type: "json_object" },
      });

      const text = response.choices[0].message.content || "{}";
      const parsed = JSON.parse(text);
      const scores: { index: number; score: number }[] = parsed.scores || [];

      let scored = 0;
      for (const { index, score } of scores) {
        if (index >= 0 && index < batch.length && score >= 1 && score <= 10) {
          const tweet = batch[index];
          const notable = tweet.author ? getNotableInfo(tweet.author) : null;
          const finalScore = notable
            ? Math.min(10, score + notable.boost)
            : score;
          updateImportanceScore(tweet.id, finalScore);
          scored++;
        }
      }
      console.log(`[Score] Scored ${scored}/${batch.length} tweets in batch ${batchNum}`);
    } catch (err) {
      console.error(`[Score] Batch ${batchNum} failed:`, err);
      for (const tweet of batch) {
        const notable = tweet.author ? getNotableInfo(tweet.author) : null;
        updateImportanceScore(tweet.id, notable ? 5 + notable.boost : 5);
      }
    }
  }

  console.log(`[Score] Pass 1 complete.`);
}

/**
 * Generate 1-sentence "takes" for scored tweets that don't have one yet.
 * A take is a ~15-word distillation of the tweet's key claim/opinion.
 * These get stored permanently and used for clustering instead of raw snippets.
 */
const TAKE_BATCH_SIZE = 40;

export async function generateTakes(tweets: Post[]): Promise<void> {
  if (tweets.length === 0) return;

  const client = getOpenAI();
  console.log(`[Takes] Generating takes for ${tweets.length} tweets...`);

  for (let i = 0; i < tweets.length; i += TAKE_BATCH_SIZE) {
    const batch = tweets.slice(i, i + TAKE_BATCH_SIZE);
    const batchNum = Math.floor(i / TAKE_BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(tweets.length / TAKE_BATCH_SIZE);
    console.log(`[Takes] Batch ${batchNum}/${totalBatches} (${batch.length} tweets)`);

    const tweetList = batch
      .map((t, j) => {
        const handle = `@${(t.author || "unknown").replace(/^@/, "")}`;
        const engagement = formatEngagementForPrompt(t);
        const engTag = engagement ? ` (${engagement})` : "";
        return `[${j}] ${handle}${engTag}: ${t.snippet?.slice(0, 400) || "No content"}`;
      })
      .join("\n\n");

    try {
      const response = await client.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `You distill tweets into single-sentence "takes" for a clustering pipeline. Each take should be ~10-20 words capturing the KEY claim, opinion, or finding. Format: "@handle: [their specific claim]". Focus specifically on Claude Opus 4.6 and OpenAI Codex 5.3 — flag if a tweet is about older models or unrelated. Return valid JSON.`,
          },
          {
            role: "user",
            content: `Distill each tweet into a single-sentence take. Capture the SPECIFIC claim or opinion — not a vague summary.

Good takes:
- "@antirez: Claude Code's multi-agent approach hurts overall performance"
- "@VictorTaelin: Codex 5.3 is faster and more accurate but Opus 4.6 is more compelling to use"
- "@bytes032: Codex outperformed Opus in smart contract security on TerminalBench"
- "@scaling01: Opus 4.6 achieves 427x speedup in kernel optimization benchmarks"

Bad takes (too vague):
- "@someone: Impressive AI model"
- "@someone: Good comparison of the models"

If a tweet is about older models (not Opus 4.6 or Codex 5.3) or is off-topic, set take to null.

Tweets:

${tweetList}

Return JSON: {"takes": [{"index": 0, "take": "..."}, {"index": 1, "take": null}, ...]}`,
          },
        ],
        temperature: 0.1,
        max_tokens: 3000,
        response_format: { type: "json_object" },
      });

      const text = response.choices[0].message.content || "{}";
      const parsed = JSON.parse(text);
      const takes: { index: number; take: string | null }[] = parsed.takes || [];

      let generated = 0;
      for (const { index, take } of takes) {
        if (index >= 0 && index < batch.length && take) {
          updatePostTake(batch[index].id, take);
          generated++;
        }
      }
      console.log(`[Takes] Generated ${generated}/${batch.length} takes in batch ${batchNum}`);
    } catch (err) {
      console.error(`[Takes] Batch ${batchNum} failed:`, err);
    }
  }

  console.log(`[Takes] Take generation complete.`);
}
