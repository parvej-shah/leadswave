import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { inboxGraph } from "@/agents/inbox/graph";

type EmailPayload = {
  from: string;
  to: string | string[];
  subject: string;
  text?: string;
  html?: string;
  headers?: Record<string, string>;
};

// Resend webhook wraps inbound emails: { type: "email.received", data: { from, subject, ... } }
type ResendWebhookPayload = {
  type?: string;
  data?: EmailPayload;
} & Partial<EmailPayload>;

function extractEmail(addr: string): string {
  const m = addr.match(/<([^>]+)>/);
  return (m ? m[1] : addr).toLowerCase().trim();
}

function extractBody(email: EmailPayload): string {
  if (email.text) return email.text.trim();
  if (email.html) return email.html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  return "";
}

export async function POST(req: NextRequest) {
  let raw: ResendWebhookPayload;
  try {
    raw = await req.json() as ResendWebhookPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Resend webhook format: { type: "email.received", data: { from, subject, ... } }
  // Fallback: direct format { from, subject, ... } used in manual curl tests
  const email: EmailPayload = (raw.data ?? raw) as EmailPayload;

  const fromEmail = extractEmail(email.from ?? "");
  const subject = email.subject ?? "";
  const body = extractBody(email);
  const inReplyTo = email.headers?.["in-reply-to"] ?? email.headers?.["In-Reply-To"] ?? null;

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

  // Single-tenant MVP: pick the most complete settings row (prefer one with resendApiKey)
  const settings = await db.settings.findFirst({
    where: { resendApiKey: { not: null } },
  }) ?? await db.settings.findFirst();

  if (!settings) {
    console.error("[inbound] No settings found — cannot classify");
    return NextResponse.json({ ok: true, classified: false });
  }

  try {
    await inboxGraph.invoke({
      leadId: lead.id,
      inboundEmail: { from: fromEmail, subject, body, inReplyTo },
      anthropicApiKey: settings.anthropicApiKey ?? "",
      telegramChatId: settings.telegramChatId ?? "",
    });
    console.log(`[inbound] Inbox agent completed for lead ${lead.id}`);
  } catch (err) {
    console.error("[inbound] Inbox agent error:", err);
    return NextResponse.json({ ok: true, classified: false, error: String(err) });
  }

  return NextResponse.json({ ok: true, classified: true, leadId: lead.id });
}
