import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getSystemSettings } from "@/lib/settings";
import { loadContextNode } from "@/agents/outreach/nodes/load_context";
import { personalizeNode } from "@/agents/outreach/nodes/personalize";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { leadId } = (await req.json()) as { leadId?: string };
  if (!leadId) return NextResponse.json({ error: "leadId required" }, { status: 400 });

  const [lead, settings] = await Promise.all([
    db.lead.findUnique({ where: { id: leadId } }),
    getSystemSettings(),
  ]);

  if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  if (!lead.email) return NextResponse.json({ error: "Lead has no email address" }, { status: 400 });
  if (!settings?.resendApiKey)
    return NextResponse.json({ error: "Resend API key not configured in settings" }, { status: 400 });
  if (!settings?.fromEmail)
    return NextResponse.json({ error: "From email not configured in settings" }, { status: 400 });

  try {
    const baseState = {
      leadId,
      resendApiKey: settings.resendApiKey,
      firecrawlApiKey: settings.firecrawlApiKey ?? "",
      anthropicApiKey: settings.anthropicApiKey ?? "",
      fromEmail: settings.fromEmail,
      fromName: settings.fromName ?? "",
      lead: null as never,
      campaign: null as never,
      websiteSummary: "",
      emailDraft: null as never,
      sent: false,
    };

    const withContext = { ...baseState, ...(await loadContextNode(baseState)) };
    const withDraft = { ...withContext, ...(await personalizeNode(withContext)) };

    return NextResponse.json({ subject: withDraft.emailDraft.subject, body: withDraft.emailDraft.body });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
