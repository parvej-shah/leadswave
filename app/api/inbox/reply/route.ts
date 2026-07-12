import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { Resend } from "resend";
import { getSystemSettings } from "@/lib/settings";
import { requireOrg, tenantErrorResponse } from "@/lib/tenant";
import { buildOutboundEmail } from "@/lib/email/signature";
import { sendsDisabled, dryRunSend } from "@/lib/email/guard";

export async function POST(req: NextRequest) {
  let ctx;
  try {
    ctx = await requireOrg();
  } catch (e) {
    return tenantErrorResponse(e);
  }

  const { leadId, body, bodyHtml } = await req.json();
  if (!leadId || !body?.trim())
    return NextResponse.json({ error: "leadId and body required" }, { status: 400 });

  const [lead, settings] = await Promise.all([
    db.lead.findFirst({ where: { id: leadId, orgId: ctx.orgId } }),
    getSystemSettings(ctx.orgId),
  ]);

  if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  if (!lead.email) return NextResponse.json({ error: "Lead has no email" }, { status: 400 });
  if (!settings?.resendApiKey)
    return NextResponse.json({ error: "Resend API key not configured" }, { status: 400 });
  if (!settings?.fromEmail)
    return NextResponse.json({ error: "From email not configured" }, { status: 400 });

  // Find original outbound subject for Re: threading
  const firstOutbound = await db.message.findFirst({
    where: { leadId, direction: "outbound" },
    orderBy: { sentAt: "asc" },
    select: { subject: true },
  });
  const subject = firstOutbound?.subject ? `Re: ${firstOutbound.subject}` : "Re: Follow-up";

  const resend = new Resend(settings.resendApiKey);
  const from = settings.fromName
    ? `${settings.fromName} <${settings.fromEmail}>`
    : settings.fromEmail;

  const outbound = buildOutboundEmail({
    bodyHtml,
    bodyText: body,
    signatureHtml: settings.signatureHtml,
    signatureText: settings.signatureText,
  });

  const { data: sendData, error } = sendsDisabled()
    ? dryRunSend(lead.email, subject)
    : await resend.emails.send({
        from,
        to: lead.email,
        subject,
        html: outbound.html,
        text: outbound.text,
      });

  if (error) return NextResponse.json({ error: error.message ?? "Send failed" }, { status: 502 });

  await db.message.create({
    data: {
      leadId,
      direction: "outbound",
      subject,
      body: outbound.bodyText,
      bodyHtml: outbound.bodyHtml,
      resendId: sendData?.id ?? null,
      deliveryStatus: "sent",
    },
  });

  await db.lead.update({
    where: { id: leadId },
    data: { state: "converted", lastTouchedAt: new Date() },
  });

  return NextResponse.json({ ok: true });
}
