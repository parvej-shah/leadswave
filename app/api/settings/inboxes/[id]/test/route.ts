import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireOrg, tenantErrorResponse } from "@/lib/tenant";
import { decryptSecret } from "@/lib/crypto";
import { sendViaSmtpTransport, type SmtpInboxConfig } from "@/lib/email/smtp";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const ctx = await requireOrg();
    const { id } = await params;

    const user = await db.user.findUnique({
      where: { id: ctx.userId },
      select: { email: true, name: true },
    });

    if (!user?.email) {
      return NextResponse.json({ error: "User email not found" }, { status: 400 });
    }

    const inbox = await db.senderInbox.findFirst({
      where: { id, orgId: ctx.orgId },
    });

    if (!inbox) {
      return NextResponse.json({ error: "Inbox not found" }, { status: 404 });
    }

    const plainPass = decryptSecret(inbox.smtpPassEncrypted);
    if (!plainPass) {
      return NextResponse.json(
        { error: "Could not decrypt inbox password" },
        { status: 500 },
      );
    }

    const inboxConfig: SmtpInboxConfig = {
      id: inbox.id,
      fromEmail: inbox.fromEmail,
      fromName: inbox.fromName,
      replyToEmail: inbox.replyToEmail,
      smtpHost: inbox.smtpHost,
      smtpPort: inbox.smtpPort,
      smtpUser: inbox.smtpUser,
      smtpPassPlain: plainPass,
      smtpSecure: inbox.smtpSecure,
    };

    const subject = `[Test Email] Verified SMTP from ${inbox.fromEmail}`;
    const text = `Hello ${user.name || "there"},\n\nThis is a test email sent from LeadsWave via ${inbox.fromEmail} (${inbox.smtpHost}:${inbox.smtpPort}).\n\nYour SMTP configuration is active and working properly.\n\n— LeadsWave Autopilot`;
    const html = `
      <div style="font-family: sans-serif; max-width: 600px; padding: 20px; border: 1px solid #eaeaea; border-radius: 8px;">
        <h2 style="color: #0f172a; margin-top: 0;">SMTP Test Successful 🎉</h2>
        <p style="color: #334155; line-height: 1.5;">Hello <strong>${user.name || "there"}</strong>,</p>
        <p style="color: #334155; line-height: 1.5;">This is a test email sent from LeadsWave via <strong>${inbox.fromEmail}</strong> (${inbox.smtpHost}:${inbox.smtpPort}).</p>
        <p style="color: #10b981; font-weight: bold;">Your SMTP connection is fully operational.</p>
        <hr style="border: 0; border-top: 1px solid #eaeaea; margin: 20px 0;" />
        <p style="color: #64748b; font-size: 12px; margin-bottom: 0;">LeadsWave Cold Outreach Engine</p>
      </div>
    `;

    const result = await sendViaSmtpTransport(inboxConfig, {
      to: user.email,
      subject,
      text,
      html,
    });

    return NextResponse.json({
      success: true,
      message: `Test email sent successfully to ${user.email}`,
      messageId: result.messageId,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to send test email" },
      { status: 500 },
    );
  }
}
