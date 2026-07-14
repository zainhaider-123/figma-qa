# AGENTS.md

## Toolchain

- **Package manager**: pnpm (locked to `11.10.0` via `mise.toml`)
- **Lint/format**: Biome, not ESLint/Prettier — `pnpm lint` (`biome check`), `pnpm format` (`biome format --write`)
- **No conventional test framework** — tests are scripts run with `tsx` or `node --experimental-strip-types`
- **Next.js 16**, React 19, Tailwind v4, shadcn/ui (base-rhea, neutral). Strict TS, `noEmit`.

## Commands

```bash
pnpm dev          # Next.js dev server. NOTE: tees output to nextjs-debug.log (gitignored): NEXT_DEBUG=1 next dev 2>&1 | tee nextjs-debug.log
pnpm build        # production build
pnpm lint         # Biome check
pnpm format       # Biome format --write
pnpm test:qa-local # run Puppeteer QA collection via tsx (see "Running test-puppeteer.ts")
```

## Database migrations (no npm scripts)

There is **no** `db:generate` / `db:migrate` / `db:push` script in `package.json`, and `lib/db/migrations/` does not exist yet. Drizzle Kit is a devDependency only. Run it directly:

```bash
pnpm exec drizzle-kit generate   # create SQL migrations from lib/db/schema.ts (writes lib/db/migrations/)
pnpm exec drizzle-kit migrate    # apply them (needs DATABASE_URL)
```

Config: `drizzle.config.ts` (PostgreSQL dialect, `out: ./lib/db/migrations`, schema `./lib/db/schema.ts`).

## Environment (no `.env.example`; `.env*` is gitignored)

Required for local dev (copy into `.env`):

- `DATABASE_URL` — Neon PostgreSQL connection string (used by `lib/db/drizzle.ts`, `drizzle.config.ts`)
- `OPENROUTER_API_KEY` — AI provider key (`lib/ai/provider.ts`)
- `BETTER_AUTH_SECRET` — better-auth secret
- `BETTER_AUTH_URL` — app base URL, e.g. `http://localhost:3000`
- `FIGMA_CLIENT_ID` / `FIGMA_CLIENT_SECRET` — Figma OAuth app credentials (`lib/auth.ts` genericOAuth provider)
- `BLOB_READ_WRITE_TOKEN` — Vercel Blob token for storing screenshots (`lib/puppeteer/save-to-db.ts` uses `put`; auto-set on Vercel)

`VERCEL_URL` and `VERCEL_PROJECT_PRODUCTION_URL` are Vercel runtime vars (not local setup) — used by `lib/browser.ts` and `lib/figma/index.ts` to build absolute URLs.

## Running test-puppeteer.ts

The harness is wired two ways and both work:

- `pnpm test:qa-local` → runs `tsx scripts/test-puppeteer.ts`
- Direct invocation → the harness header recommends `node --experimental-strip-types scripts/test-puppeteer.ts <url> [output-dir]` (defaults to `https://example.com` if no URL)

**Why tsx is a problem in general**: esbuild injects `__name` assignments into serialized functions, which breaks Puppeteer's `page.evaluate`. `lib/puppeteer/automation.ts` works around this by polyfilling `window.__name` via `page.evaluateOnNewDocument`, so tsx works here. If you write a *new* harness that calls `page.evaluate` with closures, run it with `node --experimental-strip-types` instead of tsx. The file uses `.ts` import extensions and `@ts-expect-error` annotations intentionally for Node strip-types mode.

## Architecture

```
app/
  api/
    chat/route.ts        # MAIN AI ENDPOINT — POST, session-gated. streamText + 3 tools, merges a progress SSE stream
    auth/[...all]/       # better-auth API route handler
    analyze-image/route.ts # session-gated proxy for private Vercel Blob images (used by AI tools to expose screenshots)
  globals.css            # Tailwind v4 + CSS variables
  layout.tsx             # Root layout (fonts, metadata)
  page.tsx               # Home page
lib/
  ai/
    provider.ts          # OpenRouter AI SDK provider (qaModel; free-tier model, expect rate limits)
    prompts.ts            # QA system prompt (note: filename is prompts.ts, not "promts")
    tools/
      get-frame.ts        # AI tool — fetch Figma frame data (requires linked Figma account)
      get-live-site.ts    # AI tool — collect live site DOM data + 18 responsive breakpoints via Puppeteer
      generate-pdf.ts     # AI tool — generate QA report PDF
  auth.ts                 # better-auth server config: Drizzle adapter + Figma genericOAuth plugin
  auth-client.ts          # better-auth client instance
  browser.ts              # Chromium download/caching (Vercel + fallback URL)
  progress.ts             # emitProgress()/setProgressWriter() — global singleton bridging tool progress to the chat SSE stream
  db/
    drizzle.ts            # Drizzle ORM connection (node-postgres Pool, Neon)
    schema.ts             # Schema definitions
    migrations/            # Drizzle migrations (does NOT exist yet — see "Database migrations")
  figma/
    index.ts              # Figma REST API client + blob image proxying (NOT MCP)
    get-frame.ts          # Fetch Figma frame via REST API using the user's OAuth access token (stored in the account table)
    save-to-db.ts         # Persist Figma design data to PostgreSQL
  pdfGenerator/
    index.ts               # PDF report generation from QA findings
  puppeteer/
    automation.ts          # collectQaData() — opens site, collects DOM data + screenshots (port of example.sh)
    breakpoints.ts         # 18 responsive breakpoints (11 desktop, 3 ipad, 4 mobile)
    index.ts               # Puppeteer module exports + collectAndSave()
    save-to-db.ts          # Persist Puppeteer QA data to PostgreSQL + Vercel Blob
    example.sh             # Historical bash reference (uses agent-browser CLI), not run directly
  types.ts                 # Shared TypeScript type definitions
  utils.ts                 # Shared utility functions (cn(), etc.)
components/
  ui/                      # shadcn/ui primitives (button, ...)
  chat-panel.tsx            # chat UI
  process-timeline.tsx     # progress display
  auth-button.tsx           # sign-in / account linking
scripts/
  postinstall.mjs          # Creates public/chromium-pack.tar on install (non-critical)
  test-puppeteer.ts        # CLI harness for collectQaData
```

## Request flow (how the pieces fit)

1. Client posts messages to `app/api/chat/route.ts`, which requires a better-auth session.
2. The route runs AI SDK `streamText` with `qaPrompt` + `qaModel` (OpenRouter) and three tools: `get-frame`, `get-live-site`, `generate-pdf`. Stops after 10 tool steps.
3. `get-frame` calls the **Figma REST API** with the user's OAuth access token (read from the `account` table) — requires the user to have linked a Figma account via the genericOAuth provider. No server-side Figma API key.
4. `get-live-site` runs Puppeteer (`collectAndSave`), stores screenshots in Vercel Blob (private) and QA data in Postgres, then rewrites screenshot URLs through the authenticated `/api/analyze-image` proxy.
5. Tool progress is surfaced to the client via `lib/progress.ts` (a module-global writer set per-request), merged into the UI message stream.

## Chromium / Puppeteer notes

- Uses `puppeteer-core` + `@sparticuz/chromium-min` (serverless-safe, Vercel-compatible)
- `postinstall` creates `public/chromium-pack.tar` from the chromium package. Failure is non-fatal (`process.exit(0)`).
- In production (Vercel), chromium is fetched from `https://$VERCEL_PROJECT_PRODUCTION_URL/chromium-pack.tar`; locally it falls back to a GitHub URL. See `lib/browser.ts`.
- `example.sh` is a historical reference only — it uses the `agent-browser` CLI, not Puppeteer. The Puppeteer port is in `automation.ts`.

## Database

- PostgreSQL via Neon (connection string in `.env` as `DATABASE_URL`)
- Tables (`lib/db/schema.ts`):
  - better-auth: `user`, `session`, `account`, `verification`
  - QA data: `siteQaRuns` (live-site collection), `figmaQaRuns` (Figma frame), `siteQaBreakpoints` (per-breakpoint, FK → `siteQaRuns`, stores `screenshotBlobUrl`)
- Screenshots are stored in Vercel Blob (private access) and proxied through `/api/analyze-image`.

## Styling

- Tailwind CSS v4 + shadcn/ui (base-rhea style, neutral color, CSS variables)
- Fonts: Inter (--font-sans), Geist, Geist Mono

## Path aliases

- `@/*` → project root (`./*`)
- `@types` → `./lib/types.ts` (used as `import type { ... } from "@types"` in e.g. `breakpoints.ts`)
