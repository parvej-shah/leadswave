# Invariants — rules the agent must NEVER override

These are global, load-bearing facts and constraints for LeadsWave (a.k.a. "LeadGen
Autopilot"). They outrank any local "this looks cleaner" instinct. If a change would
violate one of these, **stop and ask** — do not refactor around it.

> Verified against the live tree on 2026-06-17. Where this file and
> `.agents.project.context.md` disagree, **this file wins** — that doc is the original
> design and has drifted (see "Known drift" below).

---

## Platform & framework

- **Next.js 16** (`next@16.2.6`), React 19, App Router. This is NOT the Next.js in your
  training data — read `node_modules/next/dist/docs/` before writing framework code and
  heed deprecation notices. (See `AGENTS.md`.)
- TypeScript everywhere. Path alias `@/` → repo root.
- Tailwind v4 + shadcn. UI design system lives in `LeadsWave Design System/`.

## Auth (do not "modernize" to something else)

- Auth is **NextAuth v5 beta** (`next-auth@5.0.0-beta`) with the **Google** provider only
  (`lib/auth.ts`). It is NOT Supabase Auth — ignore the context doc on this point.
- Google OAuth carries Calendar scopes; the refresh token is what powers calendar booking.
  Do not strip calendar scopes from the provider config.

## Data layer

- **Prisma** (`prisma/schema.prisma`) over Postgres. Single client via `lib/db.ts`
  (re-exported at `lib/db/client.ts`). Never instantiate `new PrismaClient()` ad hoc.
- Live models: `Campaign`, `Lead`, `Message`, `Job`, `Settings`, `CalendarEvent`,
  `Suppression`, `PendingConfirmation`. (`CalendarEvent` and `PendingConfirmation` are
  NOT in the old context doc.)
- State/status are **free-form strings**, not Prisma enums. Lead lifecycle states and
  Job/Campaign statuses are documented in `features/*/purpose.md`. Don't convert to enums
  without a migration plan and explicit approval.
- `Suppression.email` is unique and terminal: a suppressed address is **never** contacted
  again. Any send path must check suppression first.

## Scheduling / background work

- There is **no separate worker process**. `workers/` is empty. `lib/queue/client.ts`
  (BullMQ) exists but is **not** the live scheduler.
- The live scheduler is **Vercel cron** (`vercel.json`):
  - `/api/cron/process-jobs` daily `0 0 * * *` — sends due follow-ups, enforces limits.
  - `/api/cron/digest` daily `0 8 * * *` — daily Telegram summary.
- Do not reintroduce a BullMQ worker daemon as the primary path without explicit approval.
  See `features/jobs/`.

## AI providers

- Two LLM providers are in play: **Anthropic via LangChain** (`@langchain/anthropic`,
  `lib/ai/client.ts`) and **Google Gemini** (`@google/generative-ai`, `lib/gemini.ts`).
  Do not collapse one into the other or assume "the LLM" means only Claude.
- Default to the latest, most capable Claude models for new Claude work.
- Agents are **LangGraph** graphs (`@langchain/langgraph`) under `agents/<name>/`.

## Sending limits & outreach safety (business-critical)

- This is **not** a mass-blast tool. Hard caps live in `Settings`, enforced in
  `/api/cron/process-jobs`:
  - `dailySendLimit` (default 100), `perCampaignDailyLimit` (default 50),
    `sendThrottleSeconds` (default 30).
- `autoSendReplies` defaults **false** — warm/drafted replies require human approval
  unless the user has explicitly toggled auto-send. Never default this to true.
- Follow-up sequence is days **[0, 3, 7, 12]** then sequence_complete. Don't change cadence
  silently.

## Secrets & config

- Secrets live in `.env.local` (never committed) and per-user API keys live encrypted in
  `Settings` (resend/firecrawl/anthropic/enrichment/apify/googleMaps keys). Never log,
  echo, or commit any key. Never hardcode a key in source.

## Doc / memory discipline (anti-refactoring guards)

- **Never delete a doc without an explicit instruction.** Never replace docs with aliases.
- **Never auto-deduplicate** docs or merge files because they "overlap."
- `.agents.project.context.md` and `.agents.project.Roadmap.md` are kept as historical
  design context. Do not rewrite or prune them as part of unrelated work.
- If a structural change improves tidiness but reduces usability/findability → **stop and
  ask** rather than proceed.
- Keep `memory.md` short: active issues and live decisions only, not an archive.

## Known drift (live code vs. old context doc)

The old `.agents.project.context.md` predates the current code. Trust the code + this file:
- Supabase Auth → **NextAuth + Google**.
- BullMQ worker process → **Vercel cron**.
- Claude-only → **Claude + Gemini**.
- Schema has grown: `CalendarEvent`, `PendingConfirmation`, enrichment/verify fields on
  `Settings`, Google Maps / Places scouting path.
