import OpenAI from "openai";

let openai: OpenAI | null = null;

function getOpenAI(): OpenAI {
  if (!openai) {
    openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
  }
  return openai;
}

export interface Source {
  url: string;
  title: string;
  snippet: string;
  author: string;
  domain: string;
  imageUrl?: string;
}

export interface Cluster {
  headline: string;
  subheadline: string;
  sources: Source[];
  imageUrl?: string;
}

export interface AnalysisResult {
  clusters: Cluster[];
  totalAnalyzed: number;
  totalKept: number;
}

function extractDomain(url: string): string {
  try {
    const normalized = url.startsWith("http") ? url : `https://${url}`;
    return new URL(normalized).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

/**
 * Cluster sources using pre-generated takes (short distillations).
 * No filter step needed — takes ARE the filter (only scored 6+ tweets get takes).
 */
async function clusterFromTakes(
  sources: { url: string; author: string; domain: string; take: string; imageUrl?: string }[],
  articles: Source[],
): Promise<Cluster[]> {
  const client = getOpenAI();

  // Build the source list: takes (dense, ~20 tokens each) + articles (with snippets)
  const allSources: Source[] = [];

  for (const s of sources) {
    allSources.push({
      url: s.url,
      title: s.take,  // take IS the title for clustering
      snippet: "",     // no need for snippet — take has the info
      author: s.author,
      domain: s.domain,
      imageUrl: s.imageUrl,
    });
  }

  for (const a of articles) {
    allSources.push(a);
  }

  const sourceList = allSources
    .map((s, i) => {
      const handle = `@${(s.author || "unknown").replace(/^@+/, "")}`;
      if (s.snippet) {
        return `[${i}] ${s.domain} | ${handle}\n${s.title}\n${s.snippet.slice(0, 200)}`;
      }
      return `[${i}] ${s.domain} | ${handle}\n${s.title}`;
    })
    .join("\n\n");

  const targetClusters = Math.max(10, Math.min(15, Math.floor(allSources.length / 6)));

  const prompt = `You have ${allSources.length} curated sources (indices 0 through ${allSources.length - 1}) about Claude and OpenAI from the last 24 hours. Cluster ALL of them into ${targetClusters} distinct headlines.

We care about Claude (Opus, Sonnet, Haiku, Claude Code, Anthropic) and OpenAI (GPT, Codex, ChatGPT, o-series) — any recent models, products, or developer tools.

ASSIGNMENT RULE (MOST IMPORTANT): You MUST assign ALL ${allSources.length} sources. Every index from 0 to ${allSources.length - 1} must appear in exactly one cluster's source_indices array. I will verify programmatically.

For each cluster, output:
1. "headline" — 8-16 words. Must contain a SPECIFIC claim, opinion, or finding. Use real @handles when available. An engineer should learn something just from reading the headline.
2. "subheadline" — 2-3 sentences with real substance from the actual sources. Reference specific people, tools, benchmarks, or findings.
3. "source_indices" — Array of source indices for this cluster.

PRIORITIZE these angles:
1. CONTRARIAN / SURPRISING — unexpected results, disagreements with consensus
2. FIRST-HAND EXPERIENCE — someone actually used the tool and reports results
3. HEAD-TO-HEAD — concrete Claude vs OpenAI comparisons on specific tasks
4. NOTABLE OPINIONS — well-known engineers taking clear stances
5. CONCRETE CAPABILITIES — specific new things the models can do, with evidence

BANNED patterns (instant fail):
- "Game-Changer", "Turning Point", "New Era", "Reshaping the Landscape"
- "A Competitive Showdown/Battle/Race"
- "Enhances/Empowers/Boosts/Showcases/Demonstrates/Highlights"
- "Enhanced/Advanced Capabilities"
- Any headline that could apply to literally any product launch

Headlines should pass this test: could an engineer read JUST the headline and learn something specific and new?

RULES:
- ${targetClusters} clusters. ALL ${allSources.length} sources assigned.
- Average ${Math.round(allSources.length / targetClusters)} sources per cluster. Group related topics aggressively.
- Order by most interesting first.
- Mix Claude and OpenAI coverage.

Sources:

${sourceList}

Return JSON: {"clusters": [{"headline": "...", "subheadline": "...", "source_indices": [0, 3, 7, ...]}]}`;

  try {
    const response = await client.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are a sharp tech editor writing for Hacker News readers about Claude vs OpenAI. Style rules:
- NEVER use: "game-changer", "turning point", "landscape", "empowers", "showcases", "demonstrates", "highlights", "positions", "marks a significant", "fierce competition", "enhancing capabilities"
- Write like a developer talking to developers, not a press release
- Lead with the SPECIFIC thing that happened
- In subheadlines, say what SPECIFIC PEOPLE found, not what "is noted"
- Every claim must trace to source data. Never fabricate.
Return valid JSON.`,
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.3,
      max_tokens: 12000,
      response_format: { type: "json_object" },
    });

    const text = response.choices[0].message.content || "{}";
    const parsed = JSON.parse(text);
    const rawClusters: { headline: string; subheadline: string; source_indices: number[] }[] =
      parsed.clusters || [];

    // Track assigned indices and redistribute unassigned
    const assignedIndices = new Set<number>();
    for (const rc of rawClusters) {
      for (const idx of rc.source_indices) {
        if (idx >= 0 && idx < allSources.length) assignedIndices.add(idx);
      }
    }

    const unassigned: number[] = [];
    for (let i = 0; i < allSources.length; i++) {
      if (!assignedIndices.has(i)) unassigned.push(i);
    }

    if (unassigned.length > 0 && rawClusters.length > 0) {
      console.log(`[Cluster] ${unassigned.length} sources unassigned, redistributing...`);
      const avgSize = Math.ceil(allSources.length / rawClusters.length);
      for (const idx of unassigned) {
        const src = allSources[idx];
        const srcText = `${src.title} ${src.snippet}`.toLowerCase();
        let bestCluster = 0;
        let bestScore = -1;
        for (let ci = 0; ci < rawClusters.length; ci++) {
          const clusterText = `${rawClusters[ci].headline} ${rawClusters[ci].subheadline}`.toLowerCase();
          const words = clusterText.split(/\s+/).filter(w => w.length > 3);
          let score = words.filter(w => srcText.includes(w)).length;
          // Penalize oversized clusters to spread sources evenly
          const currentSize = rawClusters[ci].source_indices.length;
          if (currentSize > avgSize * 2) score -= 3;
          else if (currentSize > avgSize) score -= 1;
          if (score > bestScore) {
            bestScore = score;
            bestCluster = ci;
          }
        }
        rawClusters[bestCluster].source_indices.push(idx);
      }
    }

    return rawClusters.map((rc) => {
      const clusterSources = rc.source_indices
        .filter((idx) => idx >= 0 && idx < allSources.length)
        .map((idx) => allSources[idx]);
      // Pick the first source with an image as the cluster hero
      const heroSource = clusterSources.find((s) => s.imageUrl);
      return {
        headline: rc.headline,
        subheadline: rc.subheadline,
        sources: clusterSources,
        imageUrl: heroSource?.imageUrl,
      };
    }).filter((c) => c.sources.length > 0);
  } catch (err) {
    console.error("[Cluster] Clustering failed:", err);
    return [{
      headline: "Today's Coverage of Claude vs OpenAI",
      subheadline: "All sources from the latest scan.",
      sources: allSources.slice(0, 50),
    }];
  }
}

/**
 * Full pipeline: takes-based clustering. No filter step — takes ARE the filter.
 */
export async function analyzeAndCluster(
  tweetsWithTakes: { url: string; author: string; domain: string; take: string; imageUrl?: string }[],
  articleCitations: { url: string; title?: string; snippet?: string; author?: string; image?: string }[],
): Promise<AnalysisResult> {
  const totalInput = tweetsWithTakes.length + articleCitations.length;
  console.log(`[Analysis] Starting with ${tweetsWithTakes.length} tweets (with takes) + ${articleCitations.length} articles...`);

  // Build article Source objects
  const articles: Source[] = articleCitations.map((c) => ({
    url: c.url,
    title: c.title || "Untitled",
    snippet: c.snippet || "",
    author: c.author || "",
    domain: extractDomain(c.url),
    imageUrl: c.image,
  }));

  // Cap for clustering
  const tweetsCapped = tweetsWithTakes.slice(0, 200);
  const articlesCapped = articles.slice(0, 50);

  console.log(`[Analysis] Clustering ${tweetsCapped.length} tweets + ${articlesCapped.length} articles...`);
  const clusters = await clusterFromTakes(tweetsCapped, articlesCapped);
  console.log(`[Analysis] Created ${clusters.length} clusters`);

  return {
    clusters,
    totalAnalyzed: totalInput,
    totalKept: tweetsCapped.length + articlesCapped.length,
  };
}
