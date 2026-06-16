# Inbox — purpose

**Job:** classify inbound replies and act — notify on hot leads, draft on warm, suppress on
cold, snooze on OOO, flag on bounce, and book meetings.

**Code:** `agents/inbox/` (LangGraph): `load_context → classify → route → {hot | warm |
cold | snooze | bounce}`.

**Triggered by:** Resend inbound webhook → `app/api/webhooks/email/...`. Real-time, not
queued. Reply drafting/sending also via `app/api/inbox/draft` and `app/api/inbox/reply`.

**Inputs:** inbound email `{ from, subject, body, inReplyTo }`, matched to a lead by sender.

**Classification:** `hot` | `warm` | `cold` | `ooo` | `bounce`.

**Actions by class:**
- `hot` → Telegram ping + lead → `replied_hot`; meeting flow can create `CalendarEvent`.
- `warm` → draft a reply; send only if `Settings.autoSendReplies` is on, else await human.
- `cold` → suppress + terminal.
- `ooo` → snooze; sequence resumes later.
- `bounce` → flag email bad + suppress.

**Meeting booking:** Google Calendar via `lib/calendar/client.ts` (OAuth refresh token).
`PendingConfirmation` tracks proposed-but-unconfirmed slots; `CalendarEvent` is the booked
record.

**Supporting libs:** `lib/ai/client.ts` / `lib/gemini.ts`, `lib/calendar/client.ts`,
`lib/telegram/client.ts`, `lib/email/client.ts`, `lib/db.ts`.
