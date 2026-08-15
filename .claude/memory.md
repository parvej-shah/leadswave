# memory.md — continuity log

Short, living state for AI sessions. **Active issues and live decisions only.** When an
item is resolved, delete it (don't archive here). For deep historical context see
`.agents.project.context.md` and `.agents.project.Roadmap.md`. For deferred-but-tracked
work see `TODO.md`.

Format: one bullet per item, newest on top. Convert relative dates to absolute.

---

## Live decisions

- **Multi-Inbox SMTP & CAN-SPAM Unsubscribe Engine shipped & armed.** (2026-08-15)
  - **Live Mailboxes Connected**: `hello@withminions.com` and `contact@withminions.com` (Google Workspace on `smtp.gmail.com:465` SSL) authenticated and active in LeadsWave with daily limits of 30/day each.
  - **TrulyInbox Warmup Active**: Both inboxes connected with Setup Score 100/100, running progressive ramp-up (5→30 emails/day, 25-30% reply rate).
  - **Live Delivery Verified**: Live outbound emails verified to `xpeedlab@gmail.com` with 100% SPF/DKIM/DMARC alignment.
  - **Prisma `SenderInbox`**: Added `SenderInbox` model (`id`, `orgId`, `fromEmail`, `fromName`, `smtpHost`, `smtpPort`, `smtpUser`, `smtpPassEncrypted`, `dailyLimit`, `sentToday`, `lastResetAt`, `isActive`) with relations to `Organization`, `Campaign`, `Message`. Pushed via `prisma db push`.
  - **SMTP Transport & Centralized Sender**: `lib/email/smtp.ts` (Nodemailer transporter pool caching) and `lib/email/send.ts` (`sendOutboundEmail`). Intelligent round-robin quota rotation across active inboxes; daily quota auto-reset at calendar midnight UTC; suppression list pre-check.
  - **Settings UI**: `app/(dashboard)/settings/sender-inboxes-panel.tsx` added under "Sender Inboxes" tab in `/settings`. Includes Google Workspace / MS365 presets, live daily progress bars (`sentToday / dailyLimit`), and test email sender.
  - **CAN-SPAM Compliance**: `lib/email/unsubscribe.ts` (HMAC token generation/verification), `app/unsubscribe/page.tsx` (public landing page), `app/api/unsubscribe/route.ts` (one-click & standard suppression), and automatic `List-Unsubscribe` headers.
  - **Send paths updated**: `send-openers`, `process-jobs` (openers + follow-ups), `inbox/reply`, and outreach graph `sendNode` now route through `sendOutboundEmail`.

- **UX polish + Coverage Map shipped on top of Stage A/B.** (2026-07-13)
  - **Toast/undo system**: `components/ui/toaster.tsx` (`<Toaster>` context +
    `useToast()`, stacked bottom-right queue, tw-animate-css enter/exit). Mounted in
    the dashboard layout. Undo wired for: lead delete (`PATCH /api/leads
    {action:"restore"}`, clears `deletedAt`), follow-up skip (`PATCH
    /api/jobs/[id] {action:"unskip"}`, cancelled→pending, rejects if
    `scheduledAt` is already past — cron would otherwise fire it immediately),
    inbox archive (local-only, trivial undo).
  - **Optimistic UI with rollback**: leads remove/send, inbox reply/archive,
    followup-queue skip all snapshot→apply→request→rollback-on-`!res.ok`, paired
    with toast feedback (success or error).
  - **Skeletons**: `components/ui/skeleton.tsx` (`<Skeleton>`, `<SkeletonRows n>`)
    replaces ad-hoc `ds-pulse` loaders; `app/(dashboard)/loading.tsx` added
    (server-nav fallback).
  - **"Needs fixing" error surface**: `ActivityType` gained `"error"`;
    `logError(orgId, summary, fix?, key?)` in `lib/activity.ts` dedupes by
    `meta.key` within 24h so cron reruns don't spam the feed. Emitters: missing
    send creds (process-jobs, auto-send), per-lead send failures, calendar
    booking failures (hot.ts + telegram confirm flow), spam complaints (status
    webhook). Dashboard renders a red strip (`needs-fixing.tsx`) above
    Needs-Attention with dismiss (client-side only) + Fix→ links.
  - **Live-ish dashboard**: `GET /api/activity?after=<id>` returns only newer
    events; `live-refresher.tsx` polls every 15s while the tab is visible, calls
    `router.refresh()` on new activity and dispatches a `leadswave:live-refresh`
    window event that `FollowupQueue` also listens to. No SSE — stays
    serverless-friendly.
  - **Coverage map** (owner's idea): `places.location` added to the Places
    FIELD_MASK (`lib/places/client.ts`); `Lead.latitude/longitude Float?`
    columns; scout pipeline (`maps_search.ts` → `maps-graph.ts` → `maps_save.ts`
    + scout/save route) now carries lat/lng end to end. Backfilled all 613
    pre-existing leads via `scripts/backfill-geo.ts` (Places GET location-only
    SKU) — 573/574 geocodable leads succeeded (1 place gone from Places; 39
    leads never had a placeId, e.g. imports). Watch out: the Places
    `GetPlaceRequest` quota is 600/min — the script batches at 5 concurrent with
    a 600ms gap and retries 429s with backoff; don't raise concurrency without
    also raising the delay.
    `app/api/map/coverage/route.ts` returns geocoded leads + area circles
    (`Campaign.selectedAreas` geocoded via new `GeoCache` model — each area
    string hits Places exactly once ever, via `lib/places/geocode.ts`
    `geocodeCached`) + stats. UI: `components/coverage-map.tsx` (Leaflet +
    leaflet.heat, CARTO dark-matter tiles, zoom-gated pins ≥11, area circles
    solid=covered/dashed=planned), loaded client-only via
    `app/(dashboard)/map/coverage-map-client.tsx` (`next/dynamic`, `ssr:false`).
    Both a dedicated `/map` page and a per-campaign mini-map (`compact` prop) on
    the campaign detail page, per owner's explicit "both" decision. Nav: `G M`,
    sidebar + command palette; deliberately dropped from the mobile bottom tab
    bar (6 tabs was too cramped) — desktop/tablet only via sidebar there.
- **Stage B (UX) shipped on top of tenancy.** (2026-07-13)
  - **User-defined offers**: `CampaignOffer` {key,label,matchSignal,offerText,angle,order};
    `Lead.category` = offer KEY (legacy "crm"/"website_proposal" preserved as seeded keys).
    `resolveOffer` matches key → "always" offer → legacy columns → offerText;
    `matchOfferKey` assigns keys at scout time; **enrichment branches on
    `lead.website` directly**, never on category name. UI: `components/offers-editor.tsx`
    in wizard + edit page; leads-page filter + CategoryBadge are dynamic.
  - **Trust pack**: `ActivityEvent` (org-scoped feed; emitters in scout save, opener send,
    schedule_followups, cron follow-ups, inbox hot/warm/cold/bounce, booking);
    dashboard shows real event stream + Deliverability card + `FollowupQueue`
    (preview/skip/edit pending Jobs; `Job.overrideBody` sent verbatim by cron).
  - **SSE scout preview**: `/api/agents/scout/preview/stream` (LangGraph streamMode
    "updates" → SSE frames; wizard consumes via fetch-reader, falls back to the
    non-streaming endpoint). Resolves the parked SSE-vs-polling decision: SSE.
  - **Presets**: `Campaign.scoutDepth` (light/normal/deep → `lib/scout-depth.ts` budgets;
    safety constants stay code-only) + `Campaign.followupOffsets` (editable cadence,
    sanitized in schedule_followups: min 2-day gaps, max 3 steps, default [3]).
  - **Onboarding**: `/onboarding` checklist (6 steps); dashboard redirects fresh orgs
    (0 campaigns + no fromEmail). Test mode: POST `/api/campaigns/[id]/test-send`
    drafts the real opener and emails it to the signed-in user with [TEST] prefix.
- **Multi-tenancy shipped (Stage A of SaaS plan).** New models: User/Organization/Membership/
  Invite; `orgId` (NOT NULL) on Campaign/Lead/Settings/Suppression; Suppression unique is now
  `[orgId, email]` (global email unique dropped). All data backfilled to org "XpeedLab" owned by
  parvejshahlabib007@gmail.com; 5 stale duplicate Settings rows deleted (old auth bug created
  them). KEY FACT: NextAuth token.sub is NOT stable here — User is keyed by EMAIL, googleSub =
  account.providerAccountId. Session carries orgId+role via jwt self-heal; seam is
  `lib/tenant.ts` (requireOrg/requireRole, explicit orgId filters — no $extends middleware).
  Cron/webhooks derive org from records (job→lead→orgId etc.). API keys now AES-256-GCM
  encrypted at rest (`lib/crypto.ts`, SETTINGS_ENCRYPTION_KEY in .env.local — MUST also be set
  in Vercel, plus CRON_SECRET + TELEGRAM_WEBHOOK_SECRET). Settings GET masks secrets; PUT
  ignores masked echoes. Telegram /start now needs a connect code
  (POST /api/settings/telegram-connect); owner's existing chat binding preserved.
  `SEND_DISABLED=true` = global dry-run. process-jobs now checks Suppression before sending
  (was a real gap) and enforces per-org dailySendLimit. Fixed invariants drift: keys were
  plaintext before this. Team tab in Settings; invites at /invite/[token], User.defaultOrgId
  picks the active org. (2026-07-12)
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

- Inbox lead-context side panel — blocked on a signals backend (NLP pass over inbound).
- Composer calendar-link / signature buttons — blocked on where calendar links come from
  + a `signature` field (Settings/User).

## Watch-outs

- `.agents.project.context.md` has drifted from the live code. See "Known drift" in
  `invariants.md` before trusting it.
