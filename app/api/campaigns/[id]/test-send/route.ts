import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getSystemSettings } from "@/lib/settings";
import { requireOrg, tenantErrorResponse } from "@/lib/tenant";
import { loadContextNode } from "@/agents/outreach/nodes/load_context";
import { personalizeNode } from "@/agents/outreach/nodes/personalize";
import { sendsDisabled, dryRunSend } from "@/lib/email/guard";

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  let org;
  try {
    org = await requireOrg();
  } catch (e) {
    return tenantErrorResponse(e);
  }
  const session = await auth();

  const reqBody = await req.json().catch(() => ({}));
  const {
    testEmail: customTestEmail,
    subject: customSubject,
    body: customBody,
    stepNum = 1,
    variantLabel = "A",
  } = (reqBody ?? {}) as {
    testEmail?: string;
    subject?: string;
    body?: string;
    stepNum?: number;
    variantLabel?: string;
  };

  const targetEmail = customTestEmail?.trim() || session?.user?.email;
  if (!targetEmail) {
    return NextResponse.json({ error: "No target test email address provided or in session" }, { status: 400 });
  }

  const { id } = await ctx.params;
  const [campaign, settings] = await Promise.all([
    db.campaign.findFirst({ where: { id, orgId: org.orgId, deletedAt: null } }),
    getSystemSettings(org.orgId),
  ]);
  if (!campaign) return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  if (!settings.resendApiKey || !settings.fromEmail) {
    return NextResponse.json({ error: "Sending credentials not configured (Resend API key & From Email required)" }, { status: 400 });
  }

  // Find a sample lead for personalization context if available
  const sampleLead = await db.lead.findFirst({
    where: { campaignId: id, orgId: org.orgId, deletedAt: null },
    orderBy: { createdAt: "desc" },
  });

  const companyName = sampleLead?.companyName || "Acme Pest Control";
  const contactName = companyName.split(" ")[0] || "John";
  const website = sampleLead?.website || "acmepest.com";
  const category = sampleLead?.category || campaign.businessType || "Pest Control";

  try {
    let finalSubject: string;
    let finalBody: string;

    if (customSubject && customBody) {
      // Use provided custom subject and body from Sequence Editor
      finalSubject = `[TEST Step ${stepNum}${variantLabel}] ` + customSubject
        .replace(/{{firstname}}/gi, contactName)
        .replace(/{{companyname}}/gi, companyName)
        .replace(/{{website}}/gi, website)
        .replace(/{{category}}/gi, category);

      finalBody = customBody
        .replace(/{{firstname}}/gi, contactName)
        .replace(/{{companyname}}/gi, companyName)
        .replace(/{{website}}/gi, website)
        .replace(/{{category}}/gi, category);
    } else {
      // Autopilot draft fallback against real or sample lead
      if (sampleLead) {
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
        finalSubject = `[TEST] ${withDraft.emailDraft.subject}`;
        finalBody = withDraft.emailDraft.body;
      } else {
        finalSubject = `[TEST] ${campaign.name} Outreach Preview`;
        finalBody = `Hi ${contactName},\n\nThis is a test email preview for ${companyName} (${category}).`;
      }
    }

    if (sendsDisabled()) {
      dryRunSend(targetEmail, finalSubject);
    } else {
      const resend = new Resend(settings.resendApiKey);
      const from = settings.fromName ? `${settings.fromName} <${settings.fromEmail}>` : settings.fromEmail;
      const { error } = await resend.emails.send({
        from,
        to: targetEmail,
        subject: finalSubject,
        text: finalBody,
      });
      if (error) throw new Error(error.message ?? "Send failed");
    }

    return NextResponse.json({
      ok: true,
      sentTo: targetEmail,
      sampleCompany: companyName,
      subject: finalSubject,
    });
  } catch (err: any) {
    console.error("[test-send] Error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Test send failed" },
      { status: 502 }
    );
  }
}
