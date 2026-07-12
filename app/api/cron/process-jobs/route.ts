import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { Resend } from "resend";
import { generateText } from "@/lib/gemini";
import { resolveOffer } from "@/agents/outreach/lib/offer";
import { buildFollowupPrompt } from "@/agents/outreach/lib/opener";
import { buildOutboundEmail } from "@/lib/email/signature";
import { stripSignature } from "@/lib/html/plain";
import { sendTelegramMessage } from "@/lib/telegram";
import { sendsDisabled, dryRunSend } from "@/lib/email/guard";
import { getSystemSettings } from "@/lib/settings";

// Opener-spirited fallbacks when AI is unavailable. Distinct per step so a
// lead's sequence isn't three identical strings. No pitch / no CTA.
const FOLLOWUP_FALLBACK: Record<number, string> = {
  2: "Wanted to add one thought — happy to share what's worked for similar businesses if it's useful.",
  3: "No worries if now isn't the right time — out of curiosity, is this something on your radar at all right now?",
  4: "I'll leave it here so I'm not cluttering your inbox. If it's ever worth a look down the line, just reply to this.",
};

// Protect with a shared secret so only Vercel Cron (or your own trigger) can hit this
function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true; // dev: no secret configured, allow all
  const auth = req.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

const FOLLOWUP_NUMBER: Record<string, number> = {
  followup_2: 2,
  followup_3: 3,
  followup_4: 4,
};

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();

  const jobs = await db.job.findMany({
    where: {
      status: "pending",
      scheduledAt: { lte: now },
      type: { in: ["followup_2", "followup_3", "followup_4"] },
    },
    include: {
      lead: {
        include: {
          campaign: true,
          messages: {
            orderBy: { sentAt: "asc" },
            select: { subject: true, body: true, direction: true, sentAt: true },
          },
        },
      },
    },
    take: 50, // process at most 50 per invocation to stay within timeout
  });

  if (jobs.length === 0) {
    return NextResponse.json({ ok: true, processed: 0, failed: 0, total: 0 });
  }

  // Multi-tenant: group jobs by org so every credential, limit, suppression
  // list, and notification stays inside its own tenant.
  const jobsByOrg = new Map<string, typeof jobs>();
  for (const job of jobs) {
    const orgId = job.lead.orgId;
    if (!orgId) continue; // pre-backfill rows: never send with someone else's keys
    const list = jobsByOrg.get(orgId) ?? [];
    list.push(job);
    jobsByOrg.set(orgId, list);
  }

  const dayStart = new Date(now);
  dayStart.setUTCHours(0, 0, 0, 0);

  let processed = 0;
  let failed = 0;

  for (const [orgId, orgJobs] of jobsByOrg) {
    const settings = await getSystemSettings(orgId);
    if (!settings.resendApiKey || !settings.fromEmail) {
      console.log(`[cron] org ${orgId}: no sending credentials — ${orgJobs.length} job(s) left pending`);
      continue;
    }

    const resend = new Resend(settings.resendApiKey);
    const from = settings.fromName
      ? `${settings.fromName} <${settings.fromEmail}>`
      : settings.fromEmail;

    const dailyCap = settings.dailySendLimit ?? 100;
    const perCampaignCap = settings.perCampaignDailyLimit ?? 50;
    const throttleMs = (settings.sendThrottleSeconds ?? 30) * 1000;

    // Org-wide + per-campaign sends today
    let orgSentToday = await db.message.count({
      where: { direction: "outbound", sentAt: { gte: dayStart }, lead: { orgId } },
    });
    const todayCountRows = await db.message.groupBy({
      by: ["leadId"],
      where: { direction: "outbound", sentAt: { gte: dayStart }, lead: { orgId } },
      _count: true,
    });
    const leadIds = todayCountRows.map((r) => r.leadId);
    const leadsForCount = leadIds.length
      ? await db.lead.findMany({ where: { id: { in: leadIds } }, select: { id: true, campaignId: true } })
      : [];
    const campaignSentToday = new Map<string, number>();
    for (const row of todayCountRows) {
      const lead = leadsForCount.find((l) => l.id === row.leadId);
      if (!lead) continue;
      campaignSentToday.set(lead.campaignId, (campaignSentToday.get(lead.campaignId) ?? 0) + row._count);
    }

    let orgProcessed = 0;
    let orgFailed = 0;
    let lastSentAt = 0;

    for (const job of orgJobs) {
      const lead = job.lead;

      // Skip leads that have replied or been suppressed
      if (
        ["replied", "converted", "meeting_booked", "unsubscribed", "bounced", "cold"].includes(
          lead.state,
        )
      ) {
        await db.job.update({ where: { id: job.id }, data: { status: "cancelled" } });
        continue;
      }

      if (!lead.email) {
        await db.job.update({ where: { id: job.id }, data: { status: "cancelled" } });
        continue;
      }

      // Suppression is terminal — a suppressed address is never contacted
      // again, even when the lead's state hasn't caught up (e.g. bounce
      // webhook raced this run). Previously this path relied on lead.state
      // alone, which let suppressed addresses through.
      const suppressed = await db.suppression.findFirst({
        where: { orgId, email: lead.email.toLowerCase() },
        select: { id: true },
      });
      if (suppressed) {
        await db.job.update({ where: { id: job.id }, data: { status: "cancelled" } });
        continue;
      }

      // Org daily cap
      if (orgSentToday >= dailyCap) break;

      // Per-campaign daily cap
      const campaignSent = campaignSentToday.get(lead.campaignId) ?? 0;
      if (campaignSent >= perCampaignCap) continue;

      // Throttle: enforce minimum gap between sends
      if (throttleMs > 0 && lastSentAt > 0) {
        const elapsed = Date.now() - lastSentAt;
        if (elapsed < throttleMs) {
          await new Promise((r) => setTimeout(r, throttleMs - elapsed));
        }
      }

      const followupNum = FOLLOWUP_NUMBER[job.type] ?? 2;
      const firstSubject =
        lead.messages.find((m) => m.direction === "outbound")?.subject ?? "our outreach";
      const subject = `Re: ${firstSubject}`;

      // Build a short contextual follow-up via AI. Stored bodies now include the
      // signature (so threads show what was sent) — strip it back off here so the
      // model isn't fed boilerplate as if it were message content.
      const priorContext = lead.messages
        .filter((m) => m.direction === "outbound")
        .map((m) => stripSignature(m.body))
        .join("\n\n---\n\n");

      const { offer, angle } = resolveOffer(lead.category, lead.campaign);

      const prompt = buildFollowupPrompt({
        followupNumber: followupNum,
        companyName: lead.companyName,
        angle,
        offer,
        priorOutbound: priorContext,
      });

      let body: string;
      try {
        body = (await generateText(prompt)).trim();
      } catch {
        body = FOLLOWUP_FALLBACK[followupNum] ?? FOLLOWUP_FALLBACK[2];
      }

      // Append the operator's signature (its name line replaces the old
      // "— fromName" sign-off). Multipart HTML+text; we persist the SIGNED text
      // (`outbound.bodyText`) + rendered HTML so the thread shows what was sent.
      // The AI prior-context above strips signatures back off (stripSignature).
      const outbound = buildOutboundEmail({
        bodyText: body,
        signatureHtml: settings.signatureHtml,
        signatureText: settings.signatureText
          || (settings.fromName ? `— ${settings.fromName}` : ""),
      });

      try {
        const { data: sendData, error } = sendsDisabled()
          ? dryRunSend(lead.email, subject)
          : await resend.emails.send({
              from,
              to: lead.email,
              subject,
              html: outbound.html,
              text: outbound.text,
            });

        if (error) throw new Error(error.message);

        await Promise.all([
          db.message.create({
            data: { leadId: lead.id, direction: "outbound", subject, body: outbound.bodyText, bodyHtml: outbound.bodyHtml, resendId: sendData?.id ?? null, deliveryStatus: "sent" },
          }),
          db.lead.update({
            where: { id: lead.id },
            data: { state: "contacted", lastTouchedAt: new Date() },
          }),
          db.job.update({ where: { id: job.id }, data: { status: "done" } }),
        ]);

        lastSentAt = Date.now();
        orgSentToday++;
        campaignSentToday.set(lead.campaignId, (campaignSentToday.get(lead.campaignId) ?? 0) + 1);
        orgProcessed++;
        processed++;
      } catch (err) {
        console.error(`[cron] Failed to send follow-up for lead ${lead.id}:`, err);
        await db.job.update({ where: { id: job.id }, data: { status: "failed" } });
        orgFailed++;
        failed++;
      }
    }

    if (settings.telegramChatId && (orgProcessed > 0 || orgFailed > 0)) {
      const lines = [
        `🔁 <b>Follow-Up Summary</b>`,
        `Sent: ${orgProcessed} | Failed: ${orgFailed} | Total jobs: ${orgJobs.length}`,
      ];
      await sendTelegramMessage(settings.telegramChatId, lines.join("\n")).catch(() => {});
    }
  }

  return NextResponse.json({ ok: true, processed, failed, total: jobs.length });
}

// Allow GET for easy manual triggering from browser during dev
export async function GET(req: NextRequest) {
  return POST(req);
}
