import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getSystemSettings } from "@/lib/settings";
import { requireOrg, tenantErrorResponse } from "@/lib/tenant";
import { loadContextNode } from "@/agents/outreach/nodes/load_context";
import { personalizeNode } from "@/agents/outreach/nodes/personalize";
import { sendsDisabled, dryRunSend } from "@/lib/email/guard";
import { replaceMergeTags } from "@/lib/email/template-tags";
import { buildOutboundEmail } from "@/lib/email/signature";

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

  const leadData = {
    companyname: sampleLead?.companyName || "Acme Pest Control",
    firstname: sampleLead?.companyName?.split(" ")[0] || "John",
    website: sampleLead?.website || "acmepest.com",
    category: sampleLead?.category || campaign.businessType || "Pest Control",
  };

  try {
    let rawSubject: string;
    let rawBody: string;

    if (customSubject && customBody) {
      rawSubject = `[TEST Step ${stepNum}${variantLabel}] ` + customSubject;
      rawBody = customBody;
    } else {
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
        rawSubject = `[TEST] ${withDraft.emailDraft.subject}`;
        rawBody = withDraft.emailDraft.body;
      } else {
        rawSubject = `[TEST] ${campaign.name} Outreach Preview`;
        rawBody = `Hi {{firstname}},\n\nThis is a test email preview for {{companyname}} ({{category}}).`;
      }
    }

    // Perform tag replacements across subject and body
    const finalSubject = replaceMergeTags(rawSubject, leadData);
    const parsedBody = replaceMergeTags(rawBody, leadData);

    // Build outbound email with system signature deduplication
    const outbound = buildOutboundEmail({
      bodyText: parsedBody,
      signatureHtml: settings.signatureHtml,
      signatureText: settings.signatureText || (settings.fromName ? `— ${settings.fromName}` : ""),
    });

    if (sendsDisabled()) {
      dryRunSend(targetEmail, finalSubject);
    } else {
      const resend = new Resend(settings.resendApiKey);
      const from = settings.fromName ? `${settings.fromName} <${settings.fromEmail}>` : settings.fromEmail;
      const { error } = await resend.emails.send({
        from,
        to: targetEmail,
        replyTo: settings.replyToEmail || undefined,
        subject: finalSubject,
        html: outbound.html,
        text: outbound.text,
      });
      if (error) throw new Error(error.message ?? "Send failed");
    }

    return NextResponse.json({
      ok: true,
      sentTo: targetEmail,
      sampleCompany: leadData.companyname,
      subject: finalSubject,
      bodyHtml: outbound.html,
      bodyText: outbound.text,
      fromEmail: settings.fromEmail,
      fromName: settings.fromName ?? "",
    });
  } catch (err: any) {
    console.error("[test-send] Error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Test send failed" },
      { status: 502 }
    );
  }
}
