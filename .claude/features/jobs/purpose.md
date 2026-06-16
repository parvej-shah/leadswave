# Jobs / scheduling — purpose

**Job:** drive all time-based work (follow-up sends, daily digest) on a schedule.

**The live mechanism is Vercel cron, not a worker daemon.** `vercel.json`:
- `/api/cron/process-jobs` — daily `0 0 * * *`. Drains due `Job` rows: sends the next
  follow-up for each lead whose `scheduledAt` has passed, enforces send limits/throttle,
  advances lead state, marks jobs done/failed.
- `/api/cron/digest` — daily `0 8 * * *`. Sends the daily pipeline summary to Telegram when
  `Settings.notifyEmailDigest` is on.

**`Job` model:** `{ leadId, type (followup_2|3|4), scheduledAt, status
(pending|done|cancelled|failed) }`. Outreach creates these rows; cron drains them.

**Note:** `lib/queue/client.ts` (BullMQ) and `workers/` exist but are dormant. Don't treat
them as the active path. `app/api/run-followups` is a manual/trigger counterpart to the
cron drain.
