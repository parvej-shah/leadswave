import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";

export type SmtpInboxConfig = {
  id: string;
  fromEmail: string;
  fromName: string;
  replyToEmail?: string | null;
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPassPlain: string;
  smtpSecure?: boolean;
};

// Global cache for Nodemailer transporters by inbox ID
const transporterCache = new Map<string, Transporter>();

export function getOrCreateTransporter(inbox: SmtpInboxConfig): Transporter {
  const cacheKey = `${inbox.id}:${inbox.smtpHost}:${inbox.smtpPort}:${inbox.smtpUser}:${inbox.smtpPassPlain}`;
  let transporter = transporterCache.get(cacheKey);

  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: inbox.smtpHost,
      port: inbox.smtpPort,
      secure: inbox.smtpSecure ?? (inbox.smtpPort === 465), // true for 465, false for 587
      auth: {
        user: inbox.smtpUser,
        pass: inbox.smtpPassPlain,
      },
      pool: true,
      maxConnections: 3,
      maxMessages: 50,
      connectionTimeout: 15000,
      greetingTimeout: 15000,
      socketTimeout: 30000,
    });

    transporterCache.set(cacheKey, transporter);
  }

  return transporter;
}

/**
 * Verify SMTP connection and credentials for a given inbox.
 */
export async function verifySmtpConnection(inbox: SmtpInboxConfig): Promise<{
  ok: boolean;
  error?: string;
}> {
  try {
    const transporter = nodemailer.createTransport({
      host: inbox.smtpHost,
      port: inbox.smtpPort,
      secure: inbox.smtpSecure ?? (inbox.smtpPort === 465),
      auth: {
        user: inbox.smtpUser,
        pass: inbox.smtpPassPlain,
      },
      connectionTimeout: 10000,
    });

    await transporter.verify();
    return { ok: true };
  } catch (err: any) {
    console.error(`[smtp] Verification failed for ${inbox.fromEmail}:`, err?.message || err);
    return {
      ok: false,
      error: err?.message || "Failed to verify SMTP credentials",
    };
  }
}

/**
 * Send an email directly via SMTP transporter.
 */
export async function sendViaSmtpTransport(
  inbox: SmtpInboxConfig,
  mailOptions: {
    to: string;
    subject: string;
    text: string;
    html?: string;
    headers?: Record<string, string>;
  },
): Promise<{
  messageId: string;
}> {
  const transporter = getOrCreateTransporter(inbox);

  const formattedFrom = inbox.fromName
    ? `"${inbox.fromName.replace(/"/g, "")}" <${inbox.fromEmail}>`
    : inbox.fromEmail;

  const result = await transporter.sendMail({
    from: formattedFrom,
    to: mailOptions.to,
    replyTo: inbox.replyToEmail || inbox.fromEmail,
    subject: mailOptions.subject,
    text: mailOptions.text,
    html: mailOptions.html,
    headers: mailOptions.headers,
  });

  return {
    messageId: result.messageId,
  };
}
