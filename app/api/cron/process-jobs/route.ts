import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { Resend } from "resend";
import { generateText } from "@/lib/gemini";
import { resolveOffer } from "@/agents/outreach/lib/offer";

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

  const settings = await db.settings.findFirst({
    where: { resendApiKey: { not: null }, fromEmail: { not: null } },
  });

  if (!settings?.resendApiKey || !settings?.fromEmail) {
    return NextResponse.json({ error: "No sending credentials configured" }, { status: 500 });
  }

  const resend = new Resend(settings.resendApiKey);
  const from = settings.fromName
    ? `${settings.fromName} <${settings.fromEmail}>`
    : settings.fromEmail;

  const perCampaignCap = settings.perCampaignDailyLimit ?? 50;
  const throttleMs = (settings.sendThrottleSeconds ?? 30) * 1000;

  // Count outbound messages sent today, grouped by campaign
  const dayStart = new Date(now);
  dayStart.setUTCHours(0, 0, 0, 0);
  const todayCountRows = await db.message.groupBy({
    by: ["leadId"],
    where: { direction: "outbound", sentAt: { gte: dayStart } },
    _count: true,
  });
  // Build campaignId → sends-today map
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

  let processed = 0;
  let failed = 0;
  let lastSentAt = 0;

  for (const job of jobs) {
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

    // Build a short contextual follow-up via AI
    const priorContext = lead.messages
      .filter((m) => m.direction === "outbound")
      .map((m) => m.body)
      .join("\n\n---\n\n");

    const { offer, angle } = resolveOffer(lead.category, lead.campaign);

    const prompt = `You are following up on a cold outreach email (follow-up #${followupNum}).
Company: ${lead.companyName}
${angle ? `Pitch angle: ${angle}\n` : ""}Offer: ${offer}
Prior outbound emails:
${priorContext}

Write a very short follow-up (1-2 sentences max). Be direct, friendly, and add a tiny new angle or insight rather than just bumping the thread.
Return plain text only — no greeting, no sign-off.`;

    let body: string;
    try {
      body = (await generateText(prompt)).trim();
    } catch {
      body = `Just wanted to follow up on my previous message about ${offer.slice(0, 60)}. Would love to connect for a quick call.`;
    }

    const fullBody = `${body}\n\n— ${settings.fromName || "The team"}`;

    try {
      const { error } = await resend.emails.send({
        from,
        to: lead.email,
        subject,
        text: fullBody,
      });

      if (error) throw new Error(error.message);

      await Promise.all([
        db.message.create({
          data: { leadId: lead.id, direction: "outbound", subject, body: fullBody },
        }),
        db.lead.update({
          where: { id: lead.id },
          data: { state: "contacted", lastTouchedAt: new Date() },
        }),
        db.job.update({ where: { id: job.id }, data: { status: "done" } }),
      ]);

      lastSentAt = Date.now();
      campaignSentToday.set(lead.campaignId, (campaignSentToday.get(lead.campaignId) ?? 0) + 1);
      processed++;
    } catch (err) {
      console.error(`[cron] Failed to send follow-up for lead ${lead.id}:`, err);
      await db.job.update({ where: { id: job.id }, data: { status: "failed" } });
      failed++;
    }
  }

  return NextResponse.json({ ok: true, processed, failed, total: jobs.length });
}

// Allow GET for easy manual triggering from browser during dev
export async function GET(req: NextRequest) {
  return POST(req);
}
