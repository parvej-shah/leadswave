import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSystemSettings } from "@/lib/settings";
import { outreachGraph } from "@/agents/outreach/graph";
import { sendTelegramMessage, escapeHtml } from "@/lib/telegram";

const COOLDOWN_MS = 120_000; // 2 minutes between sends
const MAX_PER_RUN = 4; // max leads processed per campaign per cron invocation

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  const auth = req.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const settings = await getSystemSettings();
  if (!settings.resendApiKey || !settings.fromEmail) {
    return NextResponse.json({ error: "No sending credentials configured" }, { status: 500 });
  }

  const campaigns = await db.campaign.findMany({
    where: { autoSend: true, status: "active", deletedAt: null },
  });

  if (campaigns.length === 0) {
    return NextResponse.json({ ok: true, processed: 0, campaigns: 0 });
  }

  const now = new Date();
  const dayStart = new Date(now);
  dayStart.setUTCHours(0, 0, 0, 0);

  // Global daily send count
  const globalSentToday = await db.message.count({
    where: { direction: "outbound", sentAt: { gte: dayStart } },
  });

  const dailyCap = settings.dailySendLimit ?? 100;
  if (globalSentToday >= dailyCap) {
    return NextResponse.json({ ok: true, processed: 0, reason: "daily_limit_reached" });
  }

  let globalBudget = dailyCap - globalSentToday;
  let totalProcessed = 0;
  let totalFailed = 0;
  const campaignResults: { campaignId: string; sent: number; remaining: number }[] = [];

  for (const campaign of campaigns) {
    if (globalBudget <= 0) break;

    // Per-campaign daily count
    const campaignSentToday = await db.message.count({
      where: {
        direction: "outbound",
        sentAt: { gte: dayStart },
        lead: { campaignId: campaign.id },
      },
    });

    const perCampaignCap = settings.perCampaignDailyLimit ?? 50;
    if (campaignSentToday >= perCampaignCap) {
      campaignResults.push({ campaignId: campaign.id, sent: 0, remaining: -1 });
      continue;
    }

    const campaignBudget = Math.min(
      perCampaignCap - campaignSentToday,
      globalBudget,
      MAX_PER_RUN,
    );

    // Find suppressed emails to exclude
    const suppressedEmails = await db.suppression.findMany({ select: { email: true } });
    const suppressedSet = new Set(suppressedEmails.map((s) => s.email.toLowerCase()));

    // Find eligible leads: discovered, has email, not invalid, no outbound messages yet
    const eligibleLeads = await db.lead.findMany({
      where: {
        campaignId: campaign.id,
        deletedAt: null,
        state: "discovered",
        email: { not: null },
        emailStatus: { not: "invalid" },
        messages: { none: { direction: "outbound" } },
      },
      take: campaignBudget + 10, // fetch a few extra in case some are suppressed
      orderBy: { createdAt: "asc" },
    });

    // Filter out suppressed
    const sendableLeads = eligibleLeads
      .filter((l) => l.email && !suppressedSet.has(l.email.toLowerCase()))
      .slice(0, campaignBudget);

    if (sendableLeads.length === 0) {
      // Check if there are ANY remaining eligible leads at all
      const anyRemaining = await db.lead.count({
        where: {
          campaignId: campaign.id,
          deletedAt: null,
          state: "discovered",
          email: { not: null },
          emailStatus: { not: "invalid" },
          messages: { none: { direction: "outbound" } },
        },
      });

      if (anyRemaining === 0) {
        await db.campaign.update({
          where: { id: campaign.id },
          data: { autoSend: false },
        });
      }

      campaignResults.push({ campaignId: campaign.id, sent: 0, remaining: anyRemaining });
      continue;
    }

    let sentThisRun = 0;

    for (let i = 0; i < sendableLeads.length; i++) {
      const lead = sendableLeads[i];

      // Cooldown between sends (skip before the first one)
      if (i > 0) {
        await new Promise((r) => setTimeout(r, COOLDOWN_MS));
      }

      try {
        await outreachGraph.invoke({
          leadId: lead.id,
          resendApiKey: settings.resendApiKey,
          firecrawlApiKey: settings.firecrawlApiKey ?? "",
          anthropicApiKey: settings.anthropicApiKey ?? "",
          fromEmail: settings.fromEmail,
          fromName: settings.fromName ?? "",
          signatureText: settings.signatureText ?? "",
          signatureHtml: settings.signatureHtml ?? "",
        });

        sentThisRun++;
        globalBudget--;
        totalProcessed++;
        console.log(`[auto-send] Sent opener to lead ${lead.id} (${lead.companyName})`);
      } catch (err) {
        console.error(`[auto-send] Failed for lead ${lead.id}:`, err);
        totalFailed++;
      }
    }

    // Check if more leads remain after this batch
    const remaining = await db.lead.count({
      where: {
        campaignId: campaign.id,
        deletedAt: null,
        state: "discovered",
        email: { not: null },
        emailStatus: { not: "invalid" },
        messages: { none: { direction: "outbound" } },
      },
    });

    if (remaining === 0) {
      await db.campaign.update({
        where: { id: campaign.id },
        data: { autoSend: false },
      });
    }

    campaignResults.push({ campaignId: campaign.id, sent: sentThisRun, remaining });
  }

  if (settings.telegramChatId && (totalProcessed > 0 || totalFailed > 0)) {
    const lines = [
      `📤 <b>Auto-Send Summary</b>`,
      `Sent: ${totalProcessed} | Failed: ${totalFailed}`,
      ...campaignResults.map((c) => {
        const camp = campaigns.find((ca) => ca.id === c.campaignId);
        const name = camp ? escapeHtml(camp.name) : c.campaignId;
        return `• ${name}: ${c.sent} sent, ${c.remaining >= 0 ? `${c.remaining} remaining` : "daily cap reached"}`;
      }),
    ];
    await sendTelegramMessage(settings.telegramChatId, lines.join("\n")).catch(() => {});
  }

  return NextResponse.json({
    ok: true,
    processed: totalProcessed,
    failed: totalFailed,
    campaigns: campaignResults,
  });
}

export async function GET(req: NextRequest) {
  return POST(req);
}
