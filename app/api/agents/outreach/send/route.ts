import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getSystemSettings } from "@/lib/settings";
import { Resend } from "resend";
import { scheduleFollowupsNode } from "@/agents/outreach/nodes/schedule_followups";
import { verifyEmailAddress } from "@/lib/email/verify";
import { appendOpenerSignature } from "@/lib/email/signature";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { leadId, subject, body } = (await req.json()) as {
    leadId?: string;
    subject?: string;
    body?: string;
  };

  if (!leadId) return NextResponse.json({ error: "leadId required" }, { status: 400 });
  if (!subject?.trim()) return NextResponse.json({ error: "subject required" }, { status: 400 });
  if (!body?.trim()) return NextResponse.json({ error: "body required" }, { status: 400 });

  const [lead, settings] = await Promise.all([
    db.lead.findUnique({ where: { id: leadId }, include: { campaign: true } }),
    getSystemSettings(),
  ]);

  if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  if (!lead.email) return NextResponse.json({ error: "Lead has no email address" }, { status: 400 });
  if (lead.emailStatus === "invalid")
    return NextResponse.json(
      { error: "Lead email failed verification — sending would bounce and hurt your sender reputation" },
      { status: 400 },
    );

  // Lazily verify never-checked emails before the first send: a hard bounce
  // costs more sender reputation than the one verification credit.
  if (settings.emailVerifierApiKey && lead.emailStatus !== "verified" && lead.emailStatus !== "catch_all") {
    const verdict = await verifyEmailAddress(lead.email, settings.emailVerifierApiKey);
    if (verdict !== "unknown") {
      await db.lead.update({
        where: { id: leadId },
        data: {
          emailStatus: verdict,
          emailVerifiedAt: verdict === "invalid" ? null : new Date(),
        },
      });
    }
    if (verdict === "invalid")
      return NextResponse.json(
        { error: "Lead email failed verification — sending would bounce and hurt your sender reputation" },
        { status: 400 },
      );
  }

  if (!settings?.resendApiKey)
    return NextResponse.json({ error: "Resend API key not configured in settings" }, { status: 400 });
  if (!settings?.fromEmail)
    return NextResponse.json({ error: "From email not configured in settings" }, { status: 400 });

  try {
    const resend = new Resend(settings.resendApiKey);
    const from = settings.fromName
      ? `${settings.fromName} <${settings.fromEmail}>`
      : settings.fromEmail;

    // First-touch opener: permanent signature, plain text, links stripped. Send
    // AND store the signed text so the thread shows what was received; the AI
    // follow-up prior-context strips the signature off (stripSignature).
    const sentText = appendOpenerSignature(body, settings.signatureText, settings.signatureHtml);

    const { error } = await resend.emails.send({ from, to: lead.email, subject, text: sentText });
    if (error) throw new Error(`Resend error: ${error.message ?? JSON.stringify(error)}`);

    await db.message.create({
      data: { leadId, direction: "outbound", subject, body: sentText },
    });

    await db.lead.update({
      where: { id: leadId },
      data: { state: "contacted", lastTouchedAt: new Date() },
    });

    // Schedule follow-ups using the same node as the full outreach graph
    await scheduleFollowupsNode({
      leadId,
      resendApiKey: settings.resendApiKey,
      firecrawlApiKey: settings.firecrawlApiKey ?? "",
      anthropicApiKey: settings.anthropicApiKey ?? "",
      fromEmail: settings.fromEmail,
      fromName: settings.fromName ?? "",
      signatureText: settings.signatureText ?? "",
      signatureHtml: settings.signatureHtml ?? "",
      lead: lead as never,
      campaign: lead.campaign as never,
      websiteSummary: "",
      emailDraft: { subject, body },
      sent: true,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
