import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSystemSettings } from "@/lib/settings";
import { outreachGraph } from "@/agents/outreach/graph";
import { sendTelegramMessage, escapeHtml } from "@/lib/telegram";
import { logError } from "@/lib/activity";

const MAX_PER_RUN = 1; // one lead per invocation — the GH Actions workflow loops with spacing

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

  const campaigns = await db.campaign.findMany({
    where: { autoSend: true, status: "active", deletedAt: null },
  });

  if (campaigns.length === 0) {
    return NextResponse.json({ ok: true, processed: 0, campaigns: 0 });
  }

  // Multi-tenant: every limit, credential, and suppression list is per-org.
  const byOrg = new Map<string, typeof campaigns>();
  for (const c of campaigns) {
    if (!c.orgId) continue; // pre-backfill rows are skipped, never sent with someone else's keys
    const list = byOrg.get(c.orgId) ?? [];
    list.push(c);
    byOrg.set(c.orgId, list);
  }

  const now = new Date();
  const dayStart = new Date(now);
  dayStart.setUTCHours(0, 0, 0, 0);

  let totalProcessed = 0;
  let totalFailed = 0;
  const campaignResults: { campaignId: string; sent: number; remaining: number }[] = [];
  // The GH Actions workflow aggregates batches and posts one combined Telegram
  // message via /notify using this field. With multiple orgs it only covers the
  // first org that sent — acceptable while auto-send is effectively single-org;
  // revisit when a second org enables autoSend.
  let firstTelegramChatId: string | null = null;

  for (const [orgId, orgCampaigns] of byOrg) {
    const settings = await getSystemSettings(orgId);
    if (!settings.resendApiKey || !settings.fromEmail) {
      console.log(`[auto-send] org ${orgId}: no sending credentials — skipped`);
      await logError(
        orgId,
        "Auto-send skipped — sending credentials are missing",
        "/settings?tab=keys",
        "missing-send-creds",
      );
      continue;
    }

    // Per-org daily send count
    const orgSentToday = await db.message.count({
      where: { direction: "outbound", sentAt: { gte: dayStart }, lead: { orgId } },
    });

    const dailyCap = settings.dailySendLimit ?? 100;
    if (orgSentToday >= dailyCap) {
      console.log(`[auto-send] org ${orgId}: daily limit reached`);
      continue;
    }

    let orgBudget = dailyCap - orgSentToday;
    let orgProcessed = 0;
    let orgFailed = 0;
    if (!firstTelegramChatId && settings.telegramChatId) firstTelegramChatId = settings.telegramChatId;

    // Per-org suppression set
    const suppressedEmails = await db.suppression.findMany({
      where: { orgId },
      select: { email: true },
    });
    const suppressedSet = new Set(suppressedEmails.map((s) => s.email.toLowerCase()));

    for (const campaign of orgCampaigns) {
      if (orgBudget <= 0) break;

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
        orgBudget,
        MAX_PER_RUN,
      );

      // Find eligible leads: discovered, has email, not invalid, no outbound messages yet
      const eligibleWhere = {
        campaignId: campaign.id,
        deletedAt: null,
        state: "discovered",
        email: { not: null },
        emailStatus: { not: "invalid" },
        messages: { none: { direction: "outbound" } },
      } as const;

      const eligibleLeads = await db.lead.findMany({
        where: eligibleWhere,
        take: campaignBudget + 10, // fetch a few extra in case some are suppressed
        orderBy: { createdAt: "asc" },
      });

      const sendableLeads = eligibleLeads
        .filter((l) => l.email && !suppressedSet.has(l.email.toLowerCase()))
        .slice(0, campaignBudget);

      if (sendableLeads.length === 0) {
        const anyRemaining = await db.lead.count({ where: eligibleWhere });
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

      for (const lead of sendableLeads) {
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
          orgBudget--;
          orgProcessed++;
          totalProcessed++;
          console.log(`[auto-send] Sent opener to lead ${lead.id} (${lead.companyName})`);
        } catch (err) {
          console.error(`[auto-send] Failed for lead ${lead.id}:`, err);
          orgFailed++;
          totalFailed++;
        }
      }

      const remaining = await db.lead.count({ where: eligibleWhere });
      if (remaining === 0) {
        await db.campaign.update({
          where: { id: campaign.id },
          data: { autoSend: false },
        });
      }

      campaignResults.push({ campaignId: campaign.id, sent: sentThisRun, remaining });
    }

    // Per-org Telegram summary (each org only ever sees its own campaigns)
    const silent = req.nextUrl.searchParams.get("silent") === "true";
    if (!silent && settings.telegramChatId && (orgProcessed > 0 || orgFailed > 0)) {
      const orgCampaignIds = new Set(orgCampaigns.map((c) => c.id));
      const lines = [
        `📤 <b>Auto-Send Summary</b>`,
        `Sent: ${orgProcessed} | Failed: ${orgFailed}`,
        ...campaignResults
          .filter((c) => orgCampaignIds.has(c.campaignId))
          .map((c) => {
            const camp = orgCampaigns.find((ca) => ca.id === c.campaignId);
            const name = camp ? escapeHtml(camp.name) : c.campaignId;
            return `• ${name}: ${c.sent} sent, ${c.remaining >= 0 ? `${c.remaining} remaining` : "daily cap reached"}`;
          }),
      ];
      await sendTelegramMessage(settings.telegramChatId, lines.join("\n")).catch(() => {});
    }
  }

  return NextResponse.json({
    ok: true,
    processed: totalProcessed,
    failed: totalFailed,
    campaigns: campaignResults,
    telegramChatId: firstTelegramChatId,
  });
}

export async function GET(req: NextRequest) {
  return POST(req);
}
