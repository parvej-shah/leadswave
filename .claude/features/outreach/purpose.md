# Outreach — purpose

**Job:** send a personalized Day-0 cold email to a ready lead, then schedule the follow-up
sequence.

**Code:** `agents/outreach/` (LangGraph): `load_context → personalize → send →
schedule_followups`. Offer assembly in `agents/outreach/lib/offer.ts`.

**Triggered by:** `app/api/agents/outreach/route.ts` (lead becomes outreach-ready).

**Inputs:** `{ leadId }`.

**What it does:**
- Loads lead + campaign offer context.
- Personalizes a short cold email (LLM) using the company's scraped description + offer.
- Sends via Resend (`lib/email/client.ts`), records a `Message` (direction `outbound`).
- Transitions lead to `contacted_1`.
- Creates `Job` rows for the follow-up sequence (days 3, 7, 12).

**Sequence cadence:** days **[0, 3, 7, 12]** → then `sequence_complete`. Day 3/7/12 bodies
are templated; Day 0 is AI-personalized.

**Supporting libs:** `lib/ai/client.ts` / `lib/gemini.ts`, `lib/email/client.ts`,
`lib/db.ts`. Scheduling is via DB `Job` rows drained by cron (see `features/jobs/`).
