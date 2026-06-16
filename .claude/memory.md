# memory.md — continuity log

Short, living state for AI sessions. **Active issues and live decisions only.** When an
item is resolved, delete it (don't archive here). For deep historical context see
`.agents.project.context.md` and `.agents.project.Roadmap.md`. For deferred-but-tracked
work see `TODO.md`.

Format: one bullet per item, newest on top. Convert relative dates to absolute.

---

## Live decisions

- **First-touch = soft opener, not pitch (deliverability).** Email + WhatsApp message #1 is
  an observation + soft "what we do" + low-pressure question; NO link/CTA/pricing. Rules
  centralized in `agents/outreach/lib/opener.ts`; context in `agents/outreach/lib/context.ts`.
  Driven by WhatsApp spam-ban + email-spam concern. (2026-06-17)
- **Email follow-ups vary per step + stay opener-spirited.** `buildFollowupPrompt`
  (opener.ts) frames #2/#3/#4 distinctly and forbids reusing prior wording; per-step
  fallbacks in `process-jobs`. No renewed pitch / CTA. (2026-06-17)
- **WhatsApp anti-ban rules captured** in `.claude/features/whatsapp/`. App only DRAFTS
  WhatsApp (no send/throttle in code); volume ramp (10→25→50/day), save-contact-first,
  30–60s gaps, dedicated SIM, API past 50/day are operating rules for the sender. (2026-06-17)
- **Scheduler is Vercel cron, not BullMQ.** `lib/queue/client.ts` exists but is dormant;
  the daily `/api/cron/process-jobs` run is what actually sends follow-ups. (2026-06-17)
- **Two LLM providers coexist** — Anthropic (LangChain) and Gemini. Pick deliberately per
  task; don't assume one. (2026-06-17)
- **Email enrichment/verification layered in** — Hunter → Apify fallback, plus a verify
  step (`lib/email/enrich.ts`, `lib/email/verify.ts`). Provider chosen via
  `Settings.enrichmentProvider`. (commit 6760c5d)

## Open / unresolved (see TODO.md for full list)

- New-Campaign live "scouted leads preview" — needs SSE vs polling decision before build.
- Inbox lead-context side panel — blocked on a signals backend (NLP pass over inbound).
- Composer calendar-link / signature buttons — blocked on where calendar links come from
  + a `signature` field (Settings/User).

## Watch-outs

- `.agents.project.context.md` has drifted from the live code. See "Known drift" in
  `invariants.md` before trusting it.
