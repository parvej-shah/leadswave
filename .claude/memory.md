# memory.md — continuity log

Short, living state for AI sessions. **Active issues and live decisions only.** When an
item is resolved, delete it (don't archive here). For deep historical context see
`.agents.project.context.md` and `.agents.project.Roadmap.md`. For deferred-but-tracked
work see `TODO.md`.

Format: one bullet per item, newest on top. Convert relative dates to absolute.

---

## Live decisions

- **Maps scout searches Gemini-suggested hotspot areas per city.** New wizard/scout-page
  step: `suggest-areas` route → user picks areas → stored in `Campaign.selectedAreas`
  (Json, city → string[], added via `prisma db push`). `maps_search.ts` geocodes each area
  (skips hallucinated names >40km from city centre), searches 4km radius, budget 100/area
  (Places pagination max), **no per-city lead cap** — API calls bounded by 3 variants/area.
  Cities without areas use the old quadrant grid, budget raised 60→300. (2026-07-12)

- **Rich text: reusable editor + viewer; signature appended at send-time.**
  `components/rich-text-editor.tsx` (Tiptap v3, `immediatelyRender:false` for SSR) +
  `components/rich-text-viewer.tsx` are the shared surfaces. HTML sanitized at the WRITE
  boundary server-side (`lib/html/sanitize.ts`) — viewer does a client allowlist pass as
  defense-in-depth. `Message.bodyHtml` is ADDITIVE. Signature
  lives in `Settings.signatureHtml`/`signatureText` (the sender's NAME now goes in the
  signature, not a separate field) and is appended once via `lib/email/signature.ts`
  (`buildOutboundEmail`) on REPLIES + FOLLOW-UPS. The signature is PERMANENT — openers get
  it too, but via `appendOpenerSignature` (plain text + `stripUrls`, no HTML part) so the
  opener invariant (no links in msg #1) holds; threaded into the graph as
  `OutreachState.signatureText/Html`. STORAGE: `Message.body`/`bodyHtml` now store the
  SIGNED text (so the thread shows exactly what was sent); every AI thread-context builder
  strips it back with `stripSignature` (`lib/html/plain.ts`, cuts at `SIGNATURE_DELIMITER`
  "\n--\n") — applied in cron follow-ups + inbox warm/classify/draft. `stripUrls` is also in
  `plain.ts` (pure, client-safe) so the Settings signature PREVIEW (`SignaturePreview`,
  shows full vs opener-plain side by side) matches the server exactly. Decision (2026-06-21):
  opener KEEPS stripping links (website URL only shows on replies/follow-ups). Only
  replies/follow-ups store `bodyHtml`. The lead-detail opener
  composer stays a plain Textarea (opener body is deliberately plain). WhatsApp uses the
  editor but sends `getText()` plain (URL can't carry
  HTML). DB columns added via `prisma db push` (migration history had drifted — do NOT
  `migrate reset`, it would wipe the Supabase data). (2026-06-21)
- **Outreach language = country→language map, not a Bangla boolean.**
  `agents/outreach/lib/locale.ts` (`resolveLanguage`) maps `campaign.country` → language;
  local language for non-English-fluent markets (Japan/Portugal/Spain/Brazil/France/…),
  English default (incl. Germany/Netherlands/Nordics/India). Core set: English, Bangla,
  Japanese, German, Portuguese, Spanish, French — extensible (one line). Both email +
  WhatsApp use it. WhatsApp AI-down fallback curates Bangla+English only; others → English.
  (2026-06-20)
- **Email opener brought up to the WhatsApp quality bar.** `buildEmailOpenerPrompt` now has
  a voice anchor, ~70-word cap, a real subject-line spec, and a GOOD/BAD few-shot; email
  now also gets `location` (lead.address). `resolveOffer.angle` reworded off the word
  "Pitch" (cross-channel: email/WhatsApp/follow-ups all benefit). (2026-06-20)
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
