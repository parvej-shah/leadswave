import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { inboxGraph } from "@/agents/inbox/graph";

type ResendInboundPayload = {
  from: string;
  to: string[];
  subject: string;
  text?: string;
  html?: string;
  headers?: Record<string, string>;
};

function extractEmail(addr: string): string {
  const m = addr.match(/<([^>]+)>/);
  return (m ? m[1] : addr).toLowerCase().trim();
}

function extractBody(payload: ResendInboundPayload): string {
  if (payload.text) return payload.text.trim();
  if (payload.html) return payload.html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  return "";
}

export async function POST(req: NextRequest) {
  let payload: ResendInboundPayload;
  try {
    payload = await req.json() as ResendInboundPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const fromEmail = extractEmail(payload.from ?? "");
  const subject = payload.subject ?? "";
  const body = extractBody(payload);
  const inReplyTo = payload.headers?.["in-reply-to"] ?? payload.headers?.["In-Reply-To"] ?? null;

  if (!fromEmail) {
    return NextResponse.json({ error: "Missing from address" }, { status: 400 });
  }

  console.log(`[inbound] from=${fromEmail} subject="${subject}" in-reply-to=${inReplyTo}`);

  // Find the lead by email
  const lead = await db.lead.findFirst({
    where: { email: fromEmail, deletedAt: null },
    orderBy: { lastTouchedAt: "desc" },
  });

  if (!lead) {
    console.log(`[inbound] No lead found for ${fromEmail} — ignoring`);
    return NextResponse.json({ ok: true, skipped: true });
  }

  // Save inbound message
  await db.message.create({
    data: {
      leadId: lead.id,
      direction: "inbound",
      subject,
      body,
    },
  });

  // Load settings for this lead's campaign owner
  // Settings are keyed by userId — we find via campaign (which is owned by the user)
  // Since this is a single-tenant MVP, fetch the first settings row with an anthropic key
  const settings = await db.settings.findFirst({
    where: { anthropicApiKey: { not: null } },
  });

  if (!settings) {
    console.error("[inbound] No settings with Anthropic key found — cannot classify");
    return NextResponse.json({ ok: true, classified: false });
  }

  try {
    await inboxGraph.invoke({
      leadId: lead.id,
      inboundEmail: { from: fromEmail, subject, body, inReplyTo },
      anthropicApiKey: settings.anthropicApiKey!,
      telegramChatId: settings.telegramChatId ?? "",
    });
    console.log(`[inbound] Inbox agent completed for lead ${lead.id}`);
  } catch (err) {
    console.error("[inbound] Inbox agent error:", err);
    return NextResponse.json({ ok: true, classified: false, error: String(err) });
  }

  return NextResponse.json({ ok: true, classified: true, leadId: lead.id });
}
