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
import { logActivity, logError } from "@/lib/activity";
import { replaceMergeTags } from "@/lib/email/template-tags";
import { scheduleFollowupsNode } from "@/agents/outreach/nodes/schedule_followups";

/** 2-second gap between Resend API calls — stays well under the 10 req/sec Pro
 *  limit and avoids 429s on Free (1 req/sec) plans. */
const RESEND_PACE_MS = 2_000;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Max opener emails sent per campaign per cron tick.
 *  3 per tick × 6 ticks/hour = 18/hour → 130 leads drain in ~7 hours within
 *  one business day window. Anti-spam, anti-rate-limit safe. */
const OPENERS_PER_CAMPAIGN_PER_TICK = 3;

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

function getTimeInTimezone(date: Date, timeZone: string = "America/New_York") {
  try {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    const parts = formatter.formatToParts(date);
    const partMap = Object.fromEntries(parts.map((p) => [p.type, p.value]));

    const dayMap: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };
    const isoDay = dayMap[partMap.weekday] ?? 1;
    const localTime = `${partMap.hour}:${partMap.minute}`;
    return { isoDay, localTime };
  } catch {
    const isoDay = date.getUTCDay() === 0 ? 7 : date.getUTCDay();
    const localTime = `${String(date.getUTCHours()).padStart(2, "0")}:${String(date.getUTCMinutes()).padStart(2, "0")}`;
    return { isoDay, localTime };
  }
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

  // ─────────────────────────────────────────────────────────────────────────
  // SECTION 1: Automatic opener dispatch for active campaigns
  // Runs first so new leads start receiving emails without manual intervention.
  // Only touches leads with state="discovered" — already-contacted leads are
  // never re-sent an opener.
  // ─────────────────────────────────────────────────────────────────────────
  const activeCampaignsForOpeners = await db.campaign.findMany({
    where: { status: "active", autoSend: true, deletedAt: null },
    include: { offers: true },
  });

  let totalOpenersSent = 0;

  for (const campaign of activeCampaignsForOpeners) {
    const { isoDay, localTime } = getTimeInTimezone(now, campaign.timezone ?? "America/New_York");

    // Respect send window — skip this campaign if outside hours or excluded day
    if (campaign.sendDays?.length && !campaign.sendDays.includes(isoDay)) continue;
    if (
      campaign.sendWindowStart &&
      campaign.sendWindowEnd &&
      (localTime < campaign.sendWindowStart || localTime >= campaign.sendWindowEnd)
    ) continue;

    const settings = await getSystemSettings(campaign.orgId);
    if (!settings.resendApiKey || !settings.fromEmail) continue;

    const resend = new Resend(settings.resendApiKey);
    const from = settings.fromName
      ? `${settings.fromName} <${settings.fromEmail}>`
      : settings.fromEmail;

    const dayStart = new Date(now);
    dayStart.setUTCHours(0, 0, 0, 0);

    const dailyCap = settings.dailySendLimit ?? 100;
    const perCampaignCap = settings.perCampaignDailyLimit ?? 50;

    const orgSentTodayCount = await db.message.count({
      where: { direction: "outbound", sentAt: { gte: dayStart }, lead: { orgId: campaign.orgId } },
    });
    if (orgSentTodayCount >= dailyCap) continue;

    const campaignSentTodayCount = await db.message.count({
      where: { direction: "outbound", sentAt: { gte: dayStart }, lead: { campaignId: campaign.id } },
    });
    if (campaignSentTodayCount >= perCampaignCap) continue;

    // Fetch up to OPENERS_PER_CAMPAIGN_PER_TICK leads not yet contacted
    // (state = "discovered" guarantees no prior opener was sent)
    const pendingLeads = await db.lead.findMany({
      where: {
        campaignId: campaign.id,
        orgId: campaign.orgId,
        deletedAt: null,
        state: "discovered",
        email: { not: null },
      },
      take: OPENERS_PER_CAMPAIGN_PER_TICK,
      orderBy: { createdAt: "asc" },
    });

    if (pendingLeads.length === 0) continue;

    // Pick the Step 1 template from campaign.sequenceSteps if configured
    const rawSteps = campaign.sequenceSteps as any[];
    const step1 = rawSteps?.find((s: any) => s.step === 1);
    const enabledVariants = step1?.variants?.filter((v: any) => v.enabled) || [];

    const defaultSubject = "{{firstname}}, quick question about {{companyname}}";
    const defaultBody =
      `Hi {{firstname}},\n\nNoticed {{companyname}} serves customers across ${campaign.location || "your area"}.\n\nDo you have an automated system that follows up with missed calls or after-hours inquiries?\n\nWe help local service businesses book more appointments with an AI voice & text agent. Happy to show you a 2-minute demo if it's relevant.\n\nBest,\nXpeedLab Team`;

    let campaignOpenersSent = 0;

    for (const lead of pendingLeads) {
      if (!lead.email) continue;

      const variant =
        enabledVariants.length > 0
          ? enabledVariants[campaignOpenersSent % enabledVariants.length]
          : { subject: defaultSubject, body: defaultBody };

      const leadData = {
        firstname: lead.companyName.split(" ")[0] || "there",
        companyname: lead.companyName,
        website: lead.website || "",
        category: lead.category || campaign.businessType || "Services",
      };

      const finalSubject = replaceMergeTags(variant.subject || defaultSubject, leadData);
      const parsedBody = replaceMergeTags(variant.body || defaultBody, leadData);

      const outbound = buildOutboundEmail({
        bodyText: parsedBody,
        signatureHtml: settings.signatureHtml,
        signatureText: settings.signatureText || (settings.fromName ? `— ${settings.fromName}` : ""),
      });

      try {
        const { data: sendData, error } = sendsDisabled()
          ? dryRunSend(lead.email, finalSubject)
          : await resend.emails.send({
              from,
              to: lead.email,
              replyTo: settings.replyToEmail || undefined,
              subject: finalSubject,
              html: outbound.html,
              text: outbound.text,
            });

        if (error) {
          console.error(`[cron/opener] Failed ${lead.email}:`, error.message);
          continue;
        }

        await Promise.all([
          db.message.create({
            data: {
              leadId: lead.id,
              direction: "outbound",
              subject: finalSubject,
              body: outbound.bodyText,
              bodyHtml: outbound.bodyHtml,
              resendId: sendData?.id ?? null,
              deliveryStatus: "sent",
            },
          }),
          db.lead.update({
            where: { id: lead.id },
            data: { state: "contacted", lastTouchedAt: new Date() },
          }),
        ]);

        // Schedule follow-ups (+3d, +5d) for this lead
        await scheduleFollowupsNode({ leadId: lead.id } as any);

        await logActivity({
          orgId: campaign.orgId,
          type: "opener_sent",
          leadId: lead.id,
          campaignId: campaign.id,
          summary: `Auto-sent opener to ${lead.companyName} (${lead.email})`,
        });

        campaignOpenersSent++;
        totalOpenersSent++;

        // Pace between sends — 2 seconds keeps us well inside Resend rate limits
        if (campaignOpenersSent < pendingLeads.length) {
          await sleep(RESEND_PACE_MS);
        }
      } catch (e: any) {
        console.error(`[cron/opener] Exception for lead ${lead.id}:`, e);
      }
    }

    if (campaignOpenersSent > 0 && settings.telegramChatId) {
      const remaining = await db.lead.count({
        where: { campaignId: campaign.id, orgId: campaign.orgId, deletedAt: null, state: "discovered", email: { not: null } },
      });
      await sendTelegramMessage(
        settings.telegramChatId,
        `📧 <b>Auto-sent ${campaignOpenersSent} opener${campaignOpenersSent === 1 ? "" : "s"}</b> for "${campaign.name}"\n${remaining} leads remaining in queue.`,
      ).catch(() => {});
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // SECTION 2: Follow-up jobs (followup_2 / followup_3 / followup_4)
  // ─────────────────────────────────────────────────────────────────────────
  const jobs = await db.job.findMany({
    where: {
      status: "pending",
      scheduledAt: { lte: now },
      type: { in: ["followup_2", "followup_3", "followup_4"] },
    },
    include: {
      lead: {
        include: {
          campaign: { include: { offers: true } },
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
      await logError(
        orgId,
        `${orgJobs.length} follow-up(s) waiting — sending credentials are missing`,
        "/settings?tab=keys",
        "missing-send-creds",
      );
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
      const campaign = lead.campaign;

      // Send window check: evaluate in target campaign timezone
      const targetTz = (campaign as any)?.timezone || "America/New_York";
      const { isoDay, localTime } = getTimeInTimezone(now, targetTz);

      if (campaign?.sendDays?.length && !campaign.sendDays.includes(isoDay)) {
        continue;
      }
      if (campaign?.sendWindowStart && campaign?.sendWindowEnd) {
        if (localTime < campaign.sendWindowStart || localTime >= campaign.sendWindowEnd) {
          continue;
        }
      }

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
        await logActivity({
          orgId,
          type: "suppressed",
          leadId: lead.id,
          summary: `Follow-up to ${lead.companyName} cancelled — address is suppressed`,
        });
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
      let finalSubject = subject;

      // Check if campaign has custom sequenceSteps defined from SequenceBuilderPro
      const rawSteps = (campaign as any)?.sequenceSteps;
      const sequenceSteps = Array.isArray(rawSteps) ? rawSteps : null;
      const matchedStep = sequenceSteps?.find((s: any) => s.step === followupNum);
      const enabledVariants = matchedStep?.variants?.filter((v: any) => v.enabled);

      if (job.overrideBody?.trim()) {
        // User previewed and edited this follow-up — send their words verbatim.
        body = job.overrideBody.trim();
      } else if (enabledVariants && enabledVariants.length > 0) {
        // Use variant configured in SequenceBuilderPro with template tag replacements
        const variant = enabledVariants[lead.id.length % enabledVariants.length];
        finalSubject = (variant.subject || subject)
          .replace(/{{firstname}}/gi, lead.companyName)
          .replace(/{{companyname}}/gi, lead.companyName);

        body = (variant.body || "")
          .replace(/{{firstname}}/gi, lead.companyName)
          .replace(/{{companyname}}/gi, lead.companyName)
          .replace(/{{website}}/gi, lead.website || "")
          .replace(/{{category}}/gi, lead.category || "");
      } else {
        try {
          body = (await generateText(prompt)).trim();
        } catch {
          body = FOLLOWUP_FALLBACK[followupNum] ?? FOLLOWUP_FALLBACK[2];
        }
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
          ? dryRunSend(lead.email, finalSubject)
          : await resend.emails.send({
              from,
              to: lead.email,
              replyTo: settings.replyToEmail || undefined,
              subject: finalSubject,
              html: outbound.html,
              text: outbound.text,
            });

        if (error) throw new Error(error.message);

        await Promise.all([
          db.message.create({
            data: { leadId: lead.id, direction: "outbound", subject: finalSubject, body: outbound.bodyText, bodyHtml: outbound.bodyHtml, resendId: sendData?.id ?? null, deliveryStatus: "sent" },
          }),
          db.lead.update({
            where: { id: lead.id },
            data: { state: "contacted", lastTouchedAt: new Date() },
          }),
          db.job.update({ where: { id: job.id }, data: { status: "done" } }),
        ]);

        await logActivity({
          orgId,
          type: "followup_sent",
          leadId: lead.id,
          campaignId: lead.campaignId,
          summary: `Sent follow-up #${followupNum} to ${lead.companyName}`,
        });

        // Pace between follow-up sends too
        await sleep(RESEND_PACE_MS);

        lastSentAt = Date.now();
        orgSentToday++;
        campaignSentToday.set(lead.campaignId, (campaignSentToday.get(lead.campaignId) ?? 0) + 1);
        orgProcessed++;
        processed++;
      } catch (err) {
        console.error(`[cron] Failed to send follow-up for lead ${lead.id}:`, err);
        await db.job.update({ where: { id: job.id }, data: { status: "failed" } });
        await logError(
          orgId,
          `Follow-up to ${lead.companyName} failed to send`,
          "/leads",
          `send-failed:${lead.id}`,
        );
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

    // Auto-pause evaluation for active campaigns in this org (Phase 2-B)
    const activeCampaigns = await db.campaign.findMany({
      where: { orgId, status: "active", autoPauseEnabled: true, deletedAt: null },
      select: { id: true, name: true },
    });

    for (const campaign of activeCampaigns) {
      const totalSent = await db.message.count({
        where: { lead: { campaignId: campaign.id, orgId }, direction: "outbound" },
      });
      if (totalSent >= 50) {
        const totalReplied = await db.message.count({
          where: { lead: { campaignId: campaign.id, orgId }, direction: "inbound" },
        });
        const replyRate = totalReplied / totalSent;
        if (replyRate < 0.02) {
          await db.campaign.update({
            where: { id: campaign.id },
            data: { status: "paused" },
          });
          await logActivity({
            orgId,
            type: "low_engagement",
            campaignId: campaign.id,
            summary: `Campaign "${campaign.name}" auto-paused — ${totalSent} sends, ${totalReplied} replies (<2%)`,
          });
          if (settings.telegramChatId) {
            await sendTelegramMessage(
              settings.telegramChatId,
              `⏸️ <b>Campaign auto-paused:</b> ${campaign.name}\n${totalSent} sends, ${totalReplied} replies — engagement fell below 2% threshold.`,
            ).catch(() => {});
          }
        }
      }
    }
  }

  return NextResponse.json({
    ok: true,
    openersSent: totalOpenersSent,
    processed,
    failed,
    total: jobs.length,
  });
}

// Allow GET for easy manual triggering from browser during dev
export async function GET(req: NextRequest) {
  return POST(req);
}
