import { NextRequest, NextResponse } from "next/server";
import { requireOrg, tenantErrorResponse } from "@/lib/tenant";
import { db } from "@/lib/db";
import { getSystemSettings } from "@/lib/settings";
import { Resend } from "resend";
import { replaceMergeTags } from "@/lib/email/template-tags";
import { buildOutboundEmail } from "@/lib/email/signature";
import { sendsDisabled, dryRunSend } from "@/lib/email/guard";
import { logActivity } from "@/lib/activity";
import { scheduleFollowupsNode } from "@/agents/outreach/nodes/schedule_followups";

/** 2 seconds between sends — safe for Resend Free (1 req/s) and Pro (10 req/s). */
const RESEND_PACE_MS = 2_000;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  let org;
  try {
    org = await requireOrg();
  } catch (e) {
    return tenantErrorResponse(e);
  }

  const { id } = await ctx.params;
  const reqBody = await req.json().catch(() => ({}));
  const batchSize = Math.min(Math.max(Number(reqBody.limit) || 10, 1), 50);

  const [campaign, settings] = await Promise.all([
    db.campaign.findFirst({
      where: { id, orgId: org.orgId, deletedAt: null },
      include: { offers: true },
    }),
    getSystemSettings(org.orgId),
  ]);

  if (!campaign) return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  if (!settings.resendApiKey || !settings.fromEmail) {
    return NextResponse.json(
      { error: "Sending credentials not configured (Resend API key & From Email required)" },
      { status: 400 }
    );
  }

  // Find discovered leads with email addresses that haven't been contacted yet
  const pendingLeads = await db.lead.findMany({
    where: { campaignId: id, orgId: org.orgId, deletedAt: null, state: "discovered", email: { not: null } },
    take: batchSize,
    orderBy: { createdAt: "asc" },
  });

  if (pendingLeads.length === 0) {
    return NextResponse.json({
      message: "No pending discovered leads with email addresses in queue",
      sentCount: 0,
      totalPending: 0,
    });
  }

  // Determine sequence step 1 template from campaign.sequenceSteps or fallback
  const rawSteps = campaign.sequenceSteps as any[];
  const step1 = rawSteps?.find((s: any) => s.step === 1);
  const enabledVariants = step1?.variants?.filter((v: any) => v.enabled) || [];

  const defaultSubject = "{{firstname}}, missed call text-back for {{companyname}}?";
  const defaultBody = `Hi {{firstname}},\n\nNoticed {{companyname}} provides services across ${campaign.location || "your area"}.\n\nWhen customers call after-hours, do you have an automated text-back system that engages them in 30 seconds?\n\nWe built an AI voice & text response agent that books appointments into your calendar automatically. Open to a 2-minute video demo?\n\nBest regards,\nXpeedLab Team`;

  const resend = new Resend(settings.resendApiKey);
  const from = settings.fromName ? `${settings.fromName} <${settings.fromEmail}>` : settings.fromEmail;

  let sentCount = 0;

  for (const lead of pendingLeads) {
    if (!lead.email) continue;

    // Pick variant
    const variant = enabledVariants.length > 0
      ? enabledVariants[sentCount % enabledVariants.length]
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
            subject: finalSubject,
            html: outbound.html,
            text: outbound.text,
          });

      if (error) {
        console.error(`[send-openers] Failed to send to ${lead.email}:`, error.message);
        continue;
      }

      // Record message & update lead state to contacted
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

      // Automatically schedule follow-up jobs (e.g. followup_2 at +3 days, followup_3 at +5 days)
      await scheduleFollowupsNode({
        leadId: lead.id,
      } as any);

      sentCount++;

      // Pace between sends — 2 seconds stays inside Resend rate limits on all plans.
      // A 10-email batch takes ~20s total, which is expected. A loading state
      // should be shown in the UI while this request is in flight.
      if (sentCount < pendingLeads.length) {
        await sleep(RESEND_PACE_MS);
      }
    } catch (e: any) {
      console.error(`[send-openers] Exception sending to ${lead.email}:`, e);
    }
  }

  await logActivity({
    orgId: org.orgId,
    type: "opener_sent",
    summary: `Sent outreach openers to ${sentCount} leads in campaign ${campaign.name}`,
    campaignId: id,
  });

  // Calculate remaining pending leads in campaign
  const remainingPending = await db.lead.count({
    where: { campaignId: id, orgId: org.orgId, deletedAt: null, state: "discovered", email: { not: null } },
  });

  return NextResponse.json({
    ok: true,
    sentCount,
    remainingPending,
    message: `Successfully processed outreach for ${sentCount} lead${sentCount === 1 ? "" : "s"}. ${remainingPending} pending in queue.`,
  });
}
