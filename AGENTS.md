# AGENTS.md

## Toolchain

- **Package manager**: pnpm (locked to `11.10.0` via `mise.toml`)
- **Lint/format**: Biome, not ESLint/Prettier — `pnpm lint` (`biome check`), `pnpm format` (`biome format --write`)
- **No conventional test framework** — tests are scripts run with `tsx` or `node --experimental-strip-types`

## Commands

```bash
pnpm dev                 # Next.js dev server
pnpm build               # production build
pnpm lint                # Biome check
pnpm format              # Biome format --write
pnpm test:qa-local       # run Puppeteer QA collection against a live site
pnpm test:qa-db          # run DB save test (script not yet implemented)
```

## Running test-puppeteer.ts

The test harness `scripts/test-puppeteer.ts` must be run with **`node --experimental-strip-types`**, NOT `tsx`:

```bash
node --experimental-strip-types scripts/test-puppeteer.ts <url> [output-dir]
```

**Why**: tsx/esbuild injects `__name` assignments into serialized functions, which breaks Puppeteer's `page.evaluate`. The file uses `.ts` import extensions and `@ts-expect-error` annotations intentionally for Node strip-types mode.

## Architecture

```
app/                  # Next.js App Router (currently minimal placeholder)
lib/
  ai/                 # OpenRouter provider, QA prompt, AI tool definitions
  browser/index.ts    # Chromium download/caching (Vercel + fallback URL)
  puppeteer/          # Core QA engine
    automation.ts     # collectQaData() — opens site, collects DOM data + screenshots
    breakpoints.ts    # 18 responsive breakpoints (desktop, ipad, mobile)
    example.sh        # Original bash reference (uses agent-browser CLI), not run directly
  db/                 # Drizzle ORM + PostgreSQL (schema currently empty)
components/ui/        # shadcn/ui components
scripts/
  postinstall.mjs     # Creates public/chromium-pack.tar on install (non-critical)
  test-puppeteer.ts   # CLI harness for collectQaData
```

## Chromium / Puppeteer notes

- Uses `puppeteer-core` + `@sparticuz/chromium-min` (serverless-safe, Vercel-compatible)
- `postinstall` creates `public/chromium-pack.tar` from the chromium package. Failure is non-fatal.
- In production (Vercel), chromium is fetched from `/<project-url>/chromium-pack.tar`; locally it falls back to a GitHub URL. See `lib/browser/index.ts`.
- The `example.sh` file is a historical reference only — it uses the `agent-browser` CLI, not Puppeteer. The Puppeteer port is in `automation.ts`.

## Database

- PostgreSQL via Neon (connection string in `.env`)
- Drizzle ORM with `drizzle-kit` for migrations
- Config: `drizzle.config.ts` — schema at `lib/db/schema.ts`, migrations at `lib/db/migrations/`

## Styling

- Tailwind CSS v4 + shadcn/ui (base-rhea style, neutral color, CSS variables)
- Fonts: Inter (--font-sans), Geist, Geist Mono

## Path aliases

- `@/*` → project root (`./*`)
- `@types` → `./lib/types.ts`
