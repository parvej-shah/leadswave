import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { inboxGraph } from "@/agents/inbox/graph";
import { Resend } from "resend";

type EmailPayload = {
  from: string;
  to: string | string[];
  subject: string;
  email_id?: string;
  message_id?: string;
  textBody?: string;
  htmlBody?: string;
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
  const textCandidates = [email.text, email.textBody];
  for (const candidate of textCandidates) {
    const normalized = candidate?.trim();
    if (normalized) return normalized;
  }

  const htmlCandidates = [email.html, email.htmlBody];
  for (const candidate of htmlCandidates) {
    const normalized = candidate?.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    if (normalized) return normalized;
  }

  return "";
}

function stripQuotedReply(raw: string): string {
  const text = raw.replace(/\r/g, "").trim();
  if (!text) return "";

  const lines = text.split("\n");
  const cleaned: string[] = [];

  for (const line of lines) {
    const t = line.trim();

    // Stop at common reply-header markers (gmail/outlook/apple mail, etc.)
    if (
      /^on .+wrote:$/i.test(t) ||
      /^from:\s/i.test(t) ||
      /^sent:\s/i.test(t) ||
      /^subject:\s/i.test(t) ||
      /^to:\s/i.test(t) ||
      /^-+\s*forwarded message\s*-+$/i.test(t) ||
      /^<.+>\s*লিখেছেন:$/i.test(t)
    ) {
      break;
    }

    // Skip quoted lines from previous thread.
    if (t.startsWith(">")) continue;
    cleaned.push(line);
  }

  return cleaned.join("\n").replace(/\n{3,}/g, "\n\n").trim();
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
  let body = extractBody(email);
  const inReplyTo = email.headers?.["in-reply-to"] ?? email.headers?.["In-Reply-To"] ?? null;

  if (!fromEmail) {
    return NextResponse.json({ error: "Missing from address" }, { status: 400 });
  }

  // Single-tenant MVP: pick the most complete settings row (prefer one with resendApiKey)
  const settings = await db.settings.findFirst({
    where: { resendApiKey: { not: null } },
  }) ?? await db.settings.findFirst();

  // Resend receiving webhooks may include metadata only.
  // If body is empty, fetch the full receiving-email record via Resend API.
  if (!body && settings?.resendApiKey) {
    const receivingId = email.email_id || (raw.data as { email_id?: string } | undefined)?.email_id;
    if (receivingId) {
      try {
        const resend = new Resend(settings.resendApiKey);
        const { data, error } = await resend.emails.receiving.get(receivingId);
        if (!error && data) {
          body = extractBody({
            ...email,
            text: data.text ?? email.text,
            html: data.html ?? email.html,
            headers: data.headers ?? email.headers,
          });
        }
      } catch (err) {
        console.error("[inbound] Failed to fetch full receiving email:", err);
      }
    }
  }

  body = stripQuotedReply(body);
  console.log(`[inbound] from=${fromEmail} subject="${subject}" in-reply-to=${inReplyTo} bodyLen=${body.length}`);

  // Find the lead by email
  const lead = await db.lead.findFirst({
    where: { email: { equals: fromEmail, mode: "insensitive" }, deletedAt: null },
    orderBy: { lastTouchedAt: "desc" },
  });

  if (!lead) {
    console.log(`[inbound] No lead found for ${fromEmail} — ignoring`);
    return NextResponse.json({ ok: true, skipped: true });
  }

  if (!settings) {
    console.error("[inbound] No settings found — cannot classify");
    return NextResponse.json({ ok: true, classified: false });
  }

  if (!body) {
    console.warn(`[inbound] Empty body for lead ${lead.id}; skipping save/classification to avoid false state updates`);
    return NextResponse.json({ ok: true, classified: false, leadId: lead.id, reason: "empty_body" });
  }

  // Save inbound message only when we have meaningful content.
  await db.message.create({
    data: {
      leadId: lead.id,
      direction: "inbound",
      subject,
      body,
    },
  });

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
