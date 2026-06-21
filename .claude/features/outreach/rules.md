# Outreach — rules

- **Check `Suppression` before every send.** A suppressed/bounced address is never emailed.
- Never exceed send caps: `dailySendLimit`, `perCampaignDailyLimit`, `sendThrottleSeconds`
  (from `Settings`, enforced in cron). Outreach must not bypass the cron limit path.
- Don't change the [0,3,7,12] cadence or the number of follow-ups without approval — it's a
  documented business rule in `invariants.md`.
- Keep emails short (the design intent is a 3-sentence Day-0). Don't balloon token limits.
- Every outbound email must be persisted as a `Message` so the inbox can reconstruct the
  thread and the dashboard KPIs stay accurate.
- Personalization must use real scraped signal; never fabricate facts about the company.

## Deliverability — first touch is an OPENER, not a pitch

First-touch email AND WhatsApp are openers, to avoid spam filters / WhatsApp's
report-driven flagging. The rules live in **one place**: `agents/outreach/lib/opener.ts`
(`buildEmailOpenerPrompt`, `buildWhatsAppOpenerPrompt`). Don't inline a competing prompt.
- Message #1 may contain: one specific observation about the recipient + ONE soft sentence
  on what we help with + one low-pressure question.
- Message #1 must NOT contain: links/URLs, "book a call"/meeting CTAs, pricing, hype, or a
  full pitch. The pitch happens after they reply (inbox warm/hot draft nodes).
- Recipient context loads via the shared `agents/outreach/lib/context.ts`
  (`loadWebsiteSummary`) — both channels must use it so context can't drift.
- Language is resolved from `campaign.country` via the shared
  `agents/outreach/lib/locale.ts` (`resolveLanguage`) — local language for
  non-English-fluent markets (Japan→Japanese, Portugal→Portuguese, etc.), English
  default (incl. high-English-fluency markets like Germany/Netherlands/Nordics/India).
  Both channels MUST use it; don't reintroduce a per-channel `bangla` boolean.
- **Structural variety is mandatory — same shape across leads IS the spam signal.** Good
  tone is not enough; if every email shares one subject pattern + one body skeleton + the
  same stock phrases, filters (and humans) cluster them instantly. `opener.ts` rotates the
  subject style and body opening per-lead (deterministic, seeded by company name via
  `seedIndex`) and bans recurring phrases (`BANNED_PHRASES`: "quick question about X",
  "nothing slips through the cracks", "you guys", "came across", "out of curiosity", …).
  The few-shot is a TONE reference only — never a copyable template. Don't reintroduce a
  single fixed example or a fixed "quick question about <company>" subject.
- AI-unavailable fallbacks must also be openers (observation + question), never a pitch.
- **The signature is PERMANENT — it goes on every email, including first-touch openers.**
  But the opener path keeps it deliverability-safe: openers send TEXT-ONLY (no HTML part)
  and the signature is appended via `appendOpenerSignature` (`lib/email/signature.ts`),
  which renders it as plain text AND STRIPS URLS (the opener invariant still forbids links
  in message #1 — `stripUrls` removes them while keeping name/title/contact lines).
  REPLIES + FOLLOW-UPS use `buildOutboundEmail` instead: multipart HTML+text with the full
  signature (links allowed — the lead has engaged). STORAGE: `Message.body`/`bodyHtml` store
  the SIGNED text (the thread shows exactly what was sent). Anything that feeds a stored body
  back into an AI prompt MUST call `stripSignature` (`lib/html/plain.ts`) first — already
  done in cron follow-ups and inbox warm/classify/draft — so boilerplate isn't treated as
  message content. The signature's name line replaces the old "— fromName" sign-off.
- Follow-up bodies must vary wording run-to-run — near-identical messages are a spam signal.
  Follow-ups are AI-generated per-lead via `buildFollowupPrompt` (in `opener.ts`), which
  frames #2/#3/#4 differently (new idea → light question → graceful break-up) and forbids
  repeating prior wording. Fallbacks are distinct per step. They stay opener-spirited (a
  soft nudge), NOT a renewed pitch or a "book a call" CTA.
- Scheduling = create `Job` rows; do not call BullMQ. Cron is the drain.
