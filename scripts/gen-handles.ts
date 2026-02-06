import OpenAI from "openai";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

async function run() {
  const response = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{
      role: "system",
      content: "You are an expert on the tech Twitter ecosystem. Return valid JSON only."
    }, {
      role: "user",
      content: `List 220+ notable tech/AI Twitter handles that an engineer following AI model releases would recognize. Include their EXACT current Twitter/X handle (case-sensitive, no @ prefix) and real name.

Categories to cover (aim for at least 20 per category):
1. AI lab leaders & executives (OpenAI, Anthropic, Google DeepMind, Meta AI, Mistral, Cohere, xAI)
2. AI researchers & scientists (top ML/AI academics and industry researchers)
3. Tech CEOs and founders (dev tools, AI startups, major tech companies)
4. Notable software engineers and open source developers
5. Tech VCs and investors who tweet about AI
6. Tech journalists & publications covering AI
7. AI company official accounts
8. Developer tool & platform accounts
9. AI influencers/commentators with large followings
10. Coding/AI YouTubers and content creators on Twitter

For each, assign a tier:
- tier 1: Massive figure, everyone knows them (Sam Altman, Elon Musk, Andrej Karpathy level)
- tier 2: Well-known in tech circles (50k+ followers, respected voice)
- tier 3: Notable but niche (known in specific communities)

IMPORTANT: Only include handles you are CERTAIN are correct. Do not guess.

Return JSON: {"accounts": [{"handle": "sama", "name": "Sam Altman", "tier": 1, "category": "ai-leader"}, ...]}`
    }],
    temperature: 0.3,
    max_tokens: 10000,
    response_format: { type: "json_object" },
  });

  console.log(response.choices[0].message.content);
}

run();
