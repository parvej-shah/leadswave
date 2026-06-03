import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getSystemSettings } from "@/lib/settings";
import { Resend } from "resend";
import { scheduleFollowupsNode } from "@/agents/outreach/nodes/schedule_followups";

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
  if (!settings?.resendApiKey)
    return NextResponse.json({ error: "Resend API key not configured in settings" }, { status: 400 });
  if (!settings?.fromEmail)
    return NextResponse.json({ error: "From email not configured in settings" }, { status: 400 });

  try {
    const resend = new Resend(settings.resendApiKey);
    const from = settings.fromName
      ? `${settings.fromName} <${settings.fromEmail}>`
      : settings.fromEmail;

    const { error } = await resend.emails.send({ from, to: lead.email, subject, text: body });
    if (error) throw new Error(`Resend error: ${error.message ?? JSON.stringify(error)}`);

    await db.message.create({
      data: { leadId, direction: "outbound", subject, body },
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
