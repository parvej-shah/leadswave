import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { inboxGraph } from "@/agents/inbox/graph";
import { getSystemSettings } from "@/lib/settings";
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

  // Find the lead by sender email. The match is necessarily global (Resend has
  // no org concept), so when the same prospect exists in several orgs we
  // disambiguate by the webhook's `to` address against each org's fromEmail,
  // falling back to the most recently touched lead.
  const candidates = await db.lead.findMany({
    where: { email: { equals: fromEmail, mode: "insensitive" }, deletedAt: null },
    orderBy: { lastTouchedAt: "desc" },
  });

  if (candidates.length === 0) {
    console.log(`[inbound] No lead found for ${fromEmail} — ignoring`);
    return NextResponse.json({ ok: true, skipped: true });
  }

  let lead = candidates[0];
  const distinctOrgs = new Set(candidates.map((l) => l.orgId));
  if (distinctOrgs.size > 1) {
    const toAddresses = (Array.isArray(email.to) ? email.to : [email.to ?? ""])
      .map((a) => extractEmail(a ?? ""))
      .filter(Boolean);
    const orgSettings = await db.settings.findMany({
      where: { orgId: { in: [...distinctOrgs] as string[] }, fromEmail: { not: null } },
      select: { orgId: true, fromEmail: true },
    });
    const matchedOrg = orgSettings.find(
      (s) => s.fromEmail && toAddresses.includes(s.fromEmail.toLowerCase()),
    )?.orgId;
    if (matchedOrg) {
      lead = candidates.find((l) => l.orgId === matchedOrg) ?? lead;
    } else {
      console.warn(
        `[inbound] Ambiguous sender ${fromEmail} across ${distinctOrgs.size} orgs; using most recently touched lead ${lead.id}`,
      );
    }
  }

  const settings = await getSystemSettings(lead.orgId!);

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
  console.log(`[inbound] from=${fromEmail} subject="${subject}" in-reply-to=${inReplyTo} bodyLen=${body.length} org=${lead.orgId}`);

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
      notifyHotOnly: settings.notifyHotOnly ?? false,
    });
    console.log(`[inbound] Inbox agent completed for lead ${lead.id}`);

    // Send a copy of the reply to xpeedlab@gmail.com so it lands in your Gmail inbox as well
    if (settings.resendApiKey && settings.fromEmail) {
      try {
        const resend = new Resend(settings.resendApiKey);
        const from = settings.fromName ? `${settings.fromName} <${settings.fromEmail}>` : settings.fromEmail;
        const forwardTo = "xpeedlab@gmail.com";
        const appUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";

        await resend.emails.send({
          from,
          to: forwardTo,
          subject: `[Lead Reply] ${lead.companyName}: ${subject}`,
          html: `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background: #0f172a; color: #f8fafc;">
              <h2 style="color: #38bdf8; margin-top: 0; font-size: 20px;">📬 New Lead Reply Received</h2>
              <div style="margin-bottom: 16px; font-size: 14px; color: #94a3b8;">
                <p style="margin: 4px 0;"><strong style="color: #f1f5f9;">Lead:</strong> ${lead.companyName}</p>
                <p style="margin: 4px 0;"><strong style="color: #f1f5f9;">From:</strong> ${fromEmail}</p>
                <p style="margin: 4px 0;"><strong style="color: #f1f5f9;">Subject:</strong> ${subject}</p>
              </div>
              <div style="background: #1e293b; padding: 16px; border-radius: 8px; border-left: 4px solid #38bdf8; white-space: pre-wrap; font-size: 14px; line-height: 1.6; color: #e2e8f0; margin-bottom: 20px;">${body}</div>
              <a href="${appUrl}/inbox" style="display: inline-block; background: #2563eb; color: #ffffff; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-weight: 600; font-size: 14px;">Open in LeadsWave Inbox &rarr;</a>
            </div>
          `,
          text: `New Lead Reply from ${lead.companyName} (${fromEmail}):\n\nSubject: ${subject}\n\n${body}\n\nView in LeadsWave Inbox: ${appUrl}/inbox`,
        });
        console.log(`[inbound] Sent email copy of reply to ${forwardTo}`);
      } catch (fwdErr) {
        console.error("[inbound] Failed to send forward copy:", fwdErr);
      }
    }
  } catch (err) {
    console.error("[inbound] Inbox agent error:", err);
    return NextResponse.json({ ok: true, classified: false, error: String(err) });
  }

  return NextResponse.json({ ok: true, classified: true, leadId: lead.id });
}
