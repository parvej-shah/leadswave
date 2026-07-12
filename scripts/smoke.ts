import { db } from "../lib/db";

/**
 * Regression net for the multi-tenancy refactor. Run after every batch:
 *   npx tsx scripts/smoke.ts            — DB shape + row counts only
 *   BASE_URL=http://localhost:3000 npx tsx scripts/smoke.ts — also hits routes
 * Set CRON_SECRET (and SEND_DISABLED=true on the server) for the cron probe.
 */
async function main() {
  const counts: Record<string, number> = {
    campaigns: await db.campaign.count(),
    leads: await db.lead.count(),
    messages: await db.message.count(),
    jobs: await db.job.count(),
    settings: await db.settings.count(),
    suppressions: await db.suppression.count(),
    calendarEvents: await db.calendarEvent.count(),
    pendingConfirmations: await db.pendingConfirmation.count(),
  };
  console.log("[smoke] row counts:", JSON.stringify(counts));

  const settings = await db.settings.findFirst({ select: { id: true, userId: true } });
  console.log("[smoke] settings row:", settings ? `ok (id=${settings.id})` : "MISSING");

  const base = process.env.BASE_URL;
  if (!base) {
    console.log("[smoke] BASE_URL not set — skipping route probes. Done.");
    return;
  }

  // Unauthenticated: campaigns API must reject, not leak.
  const campaignsRes = await fetch(`${base}/api/campaigns`);
  const campaignsOk = campaignsRes.status === 401 || campaignsRes.status === 403 || campaignsRes.status === 307;
  console.log(`[smoke] GET /api/campaigns (no session): ${campaignsRes.status} ${campaignsOk ? "ok" : "UNEXPECTED — should reject"}`);

  // Cron probe (needs CRON_SECRET; server should run with SEND_DISABLED=true).
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const cronRes = await fetch(`${base}/api/cron/process-jobs`, {
      headers: { authorization: `Bearer ${secret}` },
    });
    const body = await cronRes.text();
    console.log(`[smoke] GET /api/cron/process-jobs: ${cronRes.status} ${body.slice(0, 200)}`);
  } else {
    console.log("[smoke] CRON_SECRET not set — skipping cron probe.");
  }

  console.log("[smoke] done.");
}

main()
  .catch((e) => {
    console.error("[smoke] FAILED:", e?.message ?? e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
