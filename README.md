# Crypto Trading Journal

Single-user crypto trading journal for Delta Exchange traders with:

- daily PnL calendar plus weekly rollups,
- trade behavior analytics and risk heuristics,
- AI-assisted crypto market pulse,
- read-only Delta Exchange sync prepared for REST + WebSocket.

## Stack

- Frontend: React + TypeScript + Vite
- Backend: Express + TypeScript
- Database: Postgres via Prisma for deployment
- AI: OpenAI Responses API with deterministic fallback

## Quick Start

1. Install Node.js 20+.
2. Install dependencies:

```bash
npm install
```

3. Copy env file and fill credentials as needed:

```bash
copy .env.example .env
```

4. Set `DATABASE_URL` and initialize Prisma:

```bash
npm run prisma:generate
npm run prisma:push
```

5. Start the app:

```bash
npm run dev
```

Frontend runs on `http://localhost:5173` and the API on `http://localhost:8787`.

## Deploying To Vercel

1. Push the repo to GitHub.
2. Create a hosted Postgres database.
   Recommended: Neon via the Vercel Marketplace.
3. In Vercel, import the GitHub repo as a new project.
4. Add these environment variables in Vercel:
   - `DATABASE_URL`
   - `DIRECT_URL`
   - `DELTA_API_KEY`
   - `DELTA_API_SECRET`
   - `DELTA_BASE_URL`
   - `DELTA_WS_URL`
   - `OPENAI_API_KEY`
   - `OPENAI_MODEL`
5. Run Prisma against the production database:

```bash
npx prisma generate
npx prisma db push
```

6. Deploy.

Notes:
- This app now assumes Postgres for production hosting.
- For Neon, use the pooled connection string in `DATABASE_URL` and the direct connection string in `DIRECT_URL`.
- Delta WebSocket live streaming is disabled in serverless environments such as Vercel.
- Real-time sync on Vercel should use the REST sync endpoint rather than a long-lived socket worker.

## Environment Variables

- `DATABASE_URL`: pooled Postgres connection string
- `DIRECT_URL`: direct Postgres connection string for Prisma CLI / schema operations
- `DELTA_API_KEY`: Delta Exchange read-only API key
- `DELTA_API_SECRET`: Delta Exchange API secret
- `DELTA_BASE_URL`: defaults to `https://api.india.delta.exchange`
- `DELTA_WS_URL`: defaults to `wss://socket.india.delta.exchange`
- `OPENAI_API_KEY`: optional, enables AI-generated market pulse
- `OPENAI_MODEL`: optional, defaults to `gpt-4.1-mini`

## Notes

- If Delta credentials are missing, the backend seeds deterministic demo trades so the UI remains usable.
- If OpenAI or news fetches are unavailable, the market pulse falls back to deterministic headline scoring.
- Delta endpoints and payload shapes can vary; the sync layer is written to be easy to adapt if your specific account responses differ.
