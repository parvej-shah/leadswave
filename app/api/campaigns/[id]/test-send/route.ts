import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getSystemSettings } from "@/lib/settings";
import { requireOrg, tenantErrorResponse } from "@/lib/tenant";
import { loadContextNode } from "@/agents/outreach/nodes/load_context";
import { personalizeNode } from "@/agents/outreach/nodes/personalize";
import { sendsDisabled, dryRunSend } from "@/lib/email/guard";

/**
 * Test mode: draft the opener exactly as the autopilot would for a real lead
 * in this campaign, but send it to YOUR OWN inbox with a [TEST] prefix.
 * No Message/Lead writes, no suppression/limit accounting — pure preview.
 */
export async function POST(_req: NextRequest, ctx: RouteContext<"/api/campaigns/[id]/test-send">) {
  let org;
  try {
    org = await requireOrg();
  } catch (e) {
    return tenantErrorResponse(e);
  }
  const session = await auth();
  const myEmail = session?.user?.email;
  if (!myEmail) return NextResponse.json({ error: "No session email" }, { status: 400 });

  const { id } = await ctx.params;
  const [campaign, settings] = await Promise.all([
    db.campaign.findFirst({ where: { id, orgId: org.orgId, deletedAt: null } }),
    getSystemSettings(org.orgId),
  ]);
  if (!campaign) return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  if (!settings.resendApiKey || !settings.fromEmail)
    return NextResponse.json({ error: "Sending credentials not configured" }, { status: 400 });

  // Draft against a real lead so the personalization is representative.
  const sampleLead = await db.lead.findFirst({
    where: { campaignId: id, orgId: org.orgId, deletedAt: null },
    orderBy: { score: "desc" },
  });
  if (!sampleLead)
    return NextResponse.json({ error: "Scout some leads first — test mode drafts against a real lead" }, { status: 400 });

  try {
    const baseState = {
      leadId: sampleLead.id,
      resendApiKey: settings.resendApiKey,
      firecrawlApiKey: settings.firecrawlApiKey ?? "",
      anthropicApiKey: settings.anthropicApiKey ?? "",
      fromEmail: settings.fromEmail,
      fromName: settings.fromName ?? "",
      signatureText: settings.signatureText ?? "",
      signatureHtml: settings.signatureHtml ?? "",
      lead: null as never,
      campaign: null as never,
      websiteSummary: "",
      emailDraft: null as never,
      sent: false,
    };
    const withContext = { ...baseState, ...(await loadContextNode(baseState)) };
    const withDraft = { ...withContext, ...(await personalizeNode(withContext)) };

    const subject = `[TEST] ${withDraft.emailDraft.subject}`;
    const body = `This is what "${sampleLead.companyName}" would receive as the opener:\n\n---\n\n${withDraft.emailDraft.body}`;

    if (sendsDisabled()) {
      dryRunSend(myEmail, subject);
    } else {
      const resend = new Resend(settings.resendApiKey);
      const from = settings.fromName ? `${settings.fromName} <${settings.fromEmail}>` : settings.fromEmail;
      const { error } = await resend.emails.send({ from, to: myEmail, subject, text: body });
      if (error) throw new Error(error.message ?? "Send failed");
    }

    return NextResponse.json({ ok: true, sentTo: myEmail, sampleCompany: sampleLead.companyName });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Test send failed" },
      { status: 502 },
    );
  }
}
