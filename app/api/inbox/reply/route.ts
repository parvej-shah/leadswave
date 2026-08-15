import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSystemSettings } from "@/lib/settings";
import { requireOrg, tenantErrorResponse } from "@/lib/tenant";
import { buildOutboundEmail } from "@/lib/email/signature";
import { sendsDisabled, dryRunSend } from "@/lib/email/guard";
import { sendOutboundEmail } from "@/lib/email/send";

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

  // Find original outbound subject for Re: threading
  const firstOutbound = await db.message.findFirst({
    where: { leadId, direction: "outbound" },
    orderBy: { sentAt: "asc" },
    select: { subject: true },
  });
  const subject = firstOutbound?.subject ? `Re: ${firstOutbound.subject}` : "Re: Follow-up";

  const outbound = buildOutboundEmail({
    bodyHtml,
    bodyText: body,
    signatureHtml: settings.signatureHtml,
    signatureText: settings.signatureText,
  });

  const result = sendsDisabled()
    ? { success: true, messageId: "dry-run" }
    : await sendOutboundEmail({
        orgId: ctx.orgId,
        campaignId: lead.campaignId,
        leadId: lead.id,
        to: lead.email,
        subject,
        html: outbound.html,
        text: outbound.text,
      });

  if (!result.success) {
    return NextResponse.json({ error: result.error ?? "Send failed" }, { status: 502 });
  }

  await db.lead.update({
    where: { id: leadId },
    data: { state: "converted", lastTouchedAt: new Date() },
  });

  return NextResponse.json({ ok: true });
}
