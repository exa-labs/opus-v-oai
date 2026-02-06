# Opus 4.6 vs Codex — What Engineers Are Saying

Real-time sentiment analysis dashboard tracking engineer reactions to Claude Opus 4.6 and OpenAI Codex. Powered by Exa Search.

## Tech Stack

- **Framework**: Next.js 16 + TypeScript
- **Database**: Neon PostgreSQL (serverless)
- **Search**: Exa API (content discovery + chat)
- **AI**: OpenAI GPT-4o-mini (sentiment, clustering, bias), Gemini 2.5 Flash via OpenRouter (chat)
- **UI**: React 19 + Tailwind CSS 4
- **Engagement**: TwitterAPI.io (optional)

## Local Setup

```bash
npm install
cp .env.example .env
```

Edit `.env` with your credentials:

```bash
DATABASE_URL=postgresql://...@ep-xxx.us-east-2.aws.neon.tech/neondb?sslmode=require
EXA_API_KEY=your-exa-key
OPENAI_API_KEY=sk-...
CRON_SECRET=some-random-secret
# Optional:
OPEN_ROUTER_KEY=sk-or-...    # For chat (Gemini 2.5 Flash)
TWITTER_API_KEY=...           # For engagement metrics
```

Run the dev server:

```bash
npm run dev
```

Open http://localhost:3000.

## Seeding Data

Trigger the cron pipeline to discover, score, and cluster content:

```bash
npm run trigger-cron
# or: curl -X POST "http://localhost:3000/api/cron?secret=YOUR_CRON_SECRET"
```

## Scripts

| Script | Purpose |
|--------|---------|
| `npx tsx scripts/trigger-cron.ts` | Trigger full cron pipeline |
| `npx tsx scripts/flood-discover.ts` | Mass Exa discovery (40+ queries) |
| `npx tsx scripts/flood-unique.ts` | Targeted discovery (use cases, demos) |
| `npx tsx scripts/backfill-engagement.ts` | Backfill Twitter engagement |
| `npx tsx scripts/backfill-engagement-new.ts` | Refresh stale engagement |
| `npx tsx scripts/backfill-images.ts` | Backfill article images via Exa |
| `npx tsx scripts/rescore-and-recluster.ts` | Wipe scores and re-cluster |
| `npx tsx scripts/gen-handles.ts` | Generate notable Twitter handles list |

## Docker

```bash
cp .env.example .env
# Edit .env with your Neon DATABASE_URL and API keys
docker compose up --build
```

Open http://localhost:3000.

## API Routes

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/cron` | POST | Full pipeline: discover → score → cluster |
| `/api/feed` | GET | Post feed with filters |
| `/api/chat` | POST | Streaming chatbot with Exa search |
| `/api/bias` | POST | Claude vs OpenAI bias classification |
| `/api/summary` | GET | Overall sentiment summary |
| `/api/metrics` | GET | Sentiment metrics |
| `/api/monitor` | GET | Cron health check |
