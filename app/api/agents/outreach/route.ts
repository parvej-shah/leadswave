import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { outreachGraph } from "@/agents/outreach/graph";
import { getSystemSettings } from "@/lib/settings";
import { requireOrg, tenantErrorResponse } from "@/lib/tenant";

export async function POST(req: NextRequest) {
  let ctx;
  try {
    ctx = await requireOrg();
  } catch (e) {
    return tenantErrorResponse(e);
  }

  const { leadId } = await req.json();
  if (!leadId) return NextResponse.json({ error: "leadId required" }, { status: 400 });

  const [lead, settings] = await Promise.all([
    db.lead.findFirst({ where: { id: leadId, orgId: ctx.orgId } }),
    getSystemSettings(ctx.orgId),
  ]);


  if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  if (!lead.email) return NextResponse.json({ error: "Lead has no email address" }, { status: 400 });
  if (!settings?.resendApiKey)
    return NextResponse.json({ error: "Resend API key not configured in settings" }, { status: 400 });
  if (!settings?.fromEmail)
    return NextResponse.json({ error: "From email not configured in settings" }, { status: 400 });

  try {
    const result = await outreachGraph.invoke({
      leadId,
      resendApiKey: settings.resendApiKey,
      firecrawlApiKey: settings.firecrawlApiKey ?? "",
      anthropicApiKey: settings.anthropicApiKey ?? "",
      fromEmail: settings.fromEmail,
      fromName: settings.fromName ?? "",
      signatureText: settings.signatureText ?? "",
      signatureHtml: settings.signatureHtml ?? "",
    });
    return NextResponse.json({ ok: true, sent: result.sent, subject: result.emailDraft?.subject });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
