import { db } from "@/lib/db";
import { decryptSecret } from "@/lib/crypto";
import { sendViaSmtpTransport, type SmtpInboxConfig } from "./smtp";
import { buildUnsubscribeUrl } from "./unsubscribe";
import { resend } from "./client";
import { getSystemSettings } from "@/lib/settings";

export type OutboundSendParams = {
  orgId: string;
  campaignId?: string;
  leadId?: string;
  to: string;
  subject: string;
  html?: string | null;
  text: string;
  headers?: Record<string, string>;
  /** If true, ignore inbox rotation and use Resend directly (for invites/system emails). */
  isSystemEmail?: boolean;
};

export type OutboundSendResult = {
  success: boolean;
  messageId?: string;
  inboxId?: string;
  fromEmail?: string;
  error?: string;
  suppressed?: boolean;
  quotaExhausted?: boolean;
};

/**
 * Check if the current UTC day is different from the inbox's last reset date.
 */
function isNewCalendarDay(lastResetAt: Date): boolean {
  const now = new Date();
  return (
    now.getUTCFullYear() !== lastResetAt.getUTCFullYear() ||
    now.getUTCMonth() !== lastResetAt.getUTCMonth() ||
    now.getUTCDate() !== lastResetAt.getUTCDate()
  );
}

/**
 * Centralized email sending function with round-robin multi-inbox SMTP rotation,
 * quota enforcement, automatic daily reset, and CAN-SPAM headers.
 */
export async function sendOutboundEmail(
  params: OutboundSendParams,
): Promise<OutboundSendResult> {
  const normalizedEmail = params.to.toLowerCase().trim();

  // 1. Check suppression list
  const suppressed = await db.suppression.findUnique({
    where: {
      orgId_email: {
        orgId: params.orgId,
        email: normalizedEmail,
      },
    },
  });

  if (suppressed) {
    console.warn(`[sendOutboundEmail] Blocked send to suppressed email: ${normalizedEmail} (reason: ${suppressed.reason})`);
    return {
      success: false,
      suppressed: true,
      error: `Email address is on the suppression list (${suppressed.reason})`,
    };
  }

  // If system email, bypass inbox rotation
  if (params.isSystemEmail) {
    try {
      const settings = await getSystemSettings(params.orgId);
      const from = settings.fromEmail
        ? `${settings.fromName || "LeadsWave"} <${settings.fromEmail}>`
        : "LeadsWave <notifications@getminions.ai>";

      const res = await resend.emails.send({
        from,
        to: normalizedEmail,
        subject: params.subject,
        text: params.text,
        html: params.html || undefined,
      });

      return {
        success: true,
        messageId: res.data?.id,
        fromEmail: settings.fromEmail || "notifications@getminions.ai",
      };
    } catch (err: any) {
      return {
        success: false,
        error: err?.message || "Failed to send system email",
      };
    }
  }

  // 2. Query all sender inboxes for this org
  const inboxes = await db.senderInbox.findMany({
    where: {
      orgId: params.orgId,
      isActive: true,
    },
    orderBy: {
      createdAt: "asc",
    },
  });

  // 3. Reset daily counters for inboxes that entered a new calendar day
  const updatedInboxes = await Promise.all(
    inboxes.map(async (inbox) => {
      if (isNewCalendarDay(inbox.lastResetAt)) {
        return db.senderInbox.update({
          where: { id: inbox.id },
          data: {
            sentToday: 0,
            lastResetAt: new Date(),
          },
        });
      }
      return inbox;
    }),
  );

  // Filter inboxes with remaining capacity
  const eligibleInboxes = updatedInboxes.filter(
    (inbox) => inbox.sentToday < inbox.dailyLimit,
  );

  let selectedInbox = null;

  // If campaign has a preferred inbox, check if it's available and has quota
  if (params.campaignId) {
    const campaign = await db.campaign.findUnique({
      where: { id: params.campaignId },
      select: { senderInboxId: true },
    });

    if (campaign?.senderInboxId) {
      selectedInbox = eligibleInboxes.find(
        (inbox) => inbox.id === campaign.senderInboxId,
      );
    }
  }

  // Otherwise pick the inbox with the most remaining quota (least utilized)
  if (!selectedInbox && eligibleInboxes.length > 0) {
    selectedInbox = [...eligibleInboxes].sort(
      (a, b) => (b.dailyLimit - b.sentToday) - (a.dailyLimit - a.sentToday),
    )[0];
  }

  // 4. Send via selected SMTP inbox if available
  if (selectedInbox) {
    const plainPass = decryptSecret(selectedInbox.smtpPassEncrypted);
    if (!plainPass) {
      console.error(`[sendOutboundEmail] Could not decrypt password for inbox ${selectedInbox.fromEmail}`);
      return {
        success: false,
        error: `Decryption failed for inbox ${selectedInbox.fromEmail}. Please update inbox credentials in Settings.`,
      };
    }

    const inboxConfig: SmtpInboxConfig = {
      id: selectedInbox.id,
      fromEmail: selectedInbox.fromEmail,
      fromName: selectedInbox.fromName,
      replyToEmail: selectedInbox.replyToEmail,
      smtpHost: selectedInbox.smtpHost,
      smtpPort: selectedInbox.smtpPort,
      smtpUser: selectedInbox.smtpUser,
      smtpPassPlain: plainPass,
      smtpSecure: selectedInbox.smtpSecure,
    };

    // Generate CAN-SPAM compliant unsubscribe header & footer link
    const unsubUrl = buildUnsubscribeUrl({
      orgId: params.orgId,
      leadId: params.leadId,
      email: normalizedEmail,
    });

    const headers: Record<string, string> = {
      "List-Unsubscribe": `<${unsubUrl}>, <mailto:${selectedInbox.fromEmail}?subject=unsubscribe>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      ...params.headers,
    };

    try {
      const result = await sendViaSmtpTransport(inboxConfig, {
        to: normalizedEmail,
        subject: params.subject,
        text: params.text,
        html: params.html || undefined,
        headers,
      });

      // Increment sentToday count
      await db.senderInbox.update({
        where: { id: selectedInbox.id },
        data: {
          sentToday: { increment: 1 },
        },
      });

      // If leadId provided, record message & update lead
      if (params.leadId) {
        await db.message.create({
          data: {
            leadId: params.leadId,
            direction: "outbound",
            senderInboxId: selectedInbox.id,
            subject: params.subject,
            body: params.text,
            bodyHtml: params.html || null,
            deliveryStatus: "sent",
          },
        });

        await db.lead.update({
          where: { id: params.leadId },
          data: {
            lastTouchedAt: new Date(),
            state: "contacted",
          },
        });
      }

      return {
        success: true,
        messageId: result.messageId,
        inboxId: selectedInbox.id,
        fromEmail: selectedInbox.fromEmail,
      };
    } catch (smtpErr: any) {
      console.error(`[sendOutboundEmail] SMTP send failed on ${selectedInbox.fromEmail}:`, smtpErr?.message || smtpErr);
      return {
        success: false,
        error: `SMTP error on ${selectedInbox.fromEmail}: ${smtpErr?.message || "Failed to send email"}`,
      };
    }
  }

  // 5. Fallback to Resend if no inboxes configured or all maxed out
  const settings = await getSystemSettings(params.orgId);
  if (settings.resendApiKey || process.env.RESEND_API_KEY) {
    if (inboxes.length > 0 && eligibleInboxes.length === 0) {
      console.warn(`[sendOutboundEmail] All ${inboxes.length} sender inboxes have reached their daily limit.`);
      return {
        success: false,
        quotaExhausted: true,
        error: "All sender inboxes have reached their daily send limit. Sending paused until tomorrow.",
      };
    }

    try {
      const from = settings.fromEmail
        ? `${settings.fromName || "Minions.AI"} <${settings.fromEmail}>`
        : "Minions.AI <hello@withminions.com>";

      const res = await resend.emails.send({
        from,
        to: normalizedEmail,
        subject: params.subject,
        text: params.text,
        html: params.html || undefined,
      });

      if (params.leadId) {
        await db.message.create({
          data: {
            leadId: params.leadId,
            direction: "outbound",
            resendId: res.data?.id,
            subject: params.subject,
            body: params.text,
            bodyHtml: params.html || null,
            deliveryStatus: "sent",
          },
        });

        await db.lead.update({
          where: { id: params.leadId },
          data: {
            lastTouchedAt: new Date(),
            state: "contacted",
          },
        });
      }

      return {
        success: true,
        messageId: res.data?.id,
        fromEmail: settings.fromEmail || "hello@withminions.com",
      };
    } catch (resendErr: any) {
      return {
        success: false,
        error: resendErr?.message || "Failed to send via Resend fallback",
      };
    }
  }

  return {
    success: false,
    error: "No active sender inboxes configured. Please add an inbox in Settings -> Sender Inboxes.",
  };
}
