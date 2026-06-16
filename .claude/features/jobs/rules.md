# Jobs / scheduling — rules

- **Cron is the single source of truth for sends.** All limit/throttle enforcement
  (`dailySendLimit`, `perCampaignDailyLimit`, `sendThrottleSeconds`) lives in the
  `process-jobs` path. Don't add a parallel send path that bypasses it.
- Don't reintroduce a BullMQ worker daemon as the primary scheduler without explicit
  approval (see `invariants.md`). If queue work is genuinely needed, propose it first.
- A job run must be idempotent and safe to re-trigger: re-running `process-jobs` must not
  double-send. Guard on `Job.status` and lead state.
- Suppressed leads are skipped, not sent — even if a pending `Job` exists.
- Cancelled campaigns/leads must cancel their pending jobs, not leave them to fire.
- Keep cron handlers fast and bounded (Vercel time limits); batch sensibly.
