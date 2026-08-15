import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireOrg, requireRole, tenantErrorResponse } from "@/lib/tenant";
import { encryptSecret, maskSecret, isMaskedSecret } from "@/lib/crypto";
import { verifySmtpConnection, type SmtpInboxConfig } from "@/lib/email/smtp";

export async function GET(req: NextRequest) {
  try {
    const ctx = await requireOrg();
    const inboxes = await db.senderInbox.findMany({
      where: { orgId: ctx.orgId },
      orderBy: { createdAt: "asc" },
    });

    const sanitized = inboxes.map((inbox) => ({
      id: inbox.id,
      name: inbox.name,
      fromEmail: inbox.fromEmail,
      fromName: inbox.fromName,
      replyToEmail: inbox.replyToEmail,
      smtpHost: inbox.smtpHost,
      smtpPort: inbox.smtpPort,
      smtpUser: inbox.smtpUser,
      smtpSecure: inbox.smtpSecure,
      isActive: inbox.isActive,
      dailyLimit: inbox.dailyLimit,
      sentToday: inbox.sentToday,
      warmupStatus: inbox.warmupStatus,
      createdAt: inbox.createdAt,
      updatedAt: inbox.updatedAt,
      smtpPasswordMasked: maskSecret(inbox.smtpPassEncrypted),
    }));

    return NextResponse.json({ inboxes: sanitized });
  } catch (err) {
    return tenantErrorResponse(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const ctx = await requireOrg();
    requireRole(ctx, "admin");

    const body = await req.json();
    const {
      name,
      fromEmail,
      fromName,
      replyToEmail,
      smtpHost,
      smtpPort,
      smtpUser,
      smtpPassword,
      smtpSecure,
      dailyLimit,
    } = body;

    if (!fromEmail || !smtpHost || !smtpPort || !smtpUser || !smtpPassword) {
      return NextResponse.json(
        { error: "Missing required SMTP connection parameters" },
        { status: 400 },
      );
    }

    const portNum = Number(smtpPort) || 465;
    const limitNum = Number(dailyLimit) || 30;

    // 1. Verify SMTP connection before saving
    const testConfig: SmtpInboxConfig = {
      id: "temp-verify",
      fromEmail,
      fromName: fromName || name || "Outreach",
      replyToEmail,
      smtpHost,
      smtpPort: portNum,
      smtpUser,
      smtpPassPlain: smtpPassword,
      smtpSecure: smtpSecure ?? (portNum === 465),
    };

    const verifyResult = await verifySmtpConnection(testConfig);
    if (!verifyResult.ok) {
      return NextResponse.json(
        { error: `SMTP verification failed: ${verifyResult.error}` },
        { status: 400 },
      );
    }

    // 2. Encrypt password and save
    const encryptedPassword = encryptSecret(smtpPassword);
    if (!encryptedPassword) {
      return NextResponse.json(
        { error: "Failed to encrypt password" },
        { status: 500 },
      );
    }

    const inbox = await db.senderInbox.create({
      data: {
        orgId: ctx.orgId,
        name: name || fromEmail,
        fromEmail: fromEmail.toLowerCase().trim(),
        fromName: fromName || name || "Outreach",
        replyToEmail: replyToEmail ? replyToEmail.toLowerCase().trim() : null,
        smtpHost,
        smtpPort: portNum,
        smtpUser,
        smtpPassEncrypted: encryptedPassword,
        smtpSecure: smtpSecure ?? (portNum === 465),
        dailyLimit: limitNum,
        sentToday: 0,
        isActive: true,
      },
    });

    return NextResponse.json({
      success: true,
      inbox: {
        id: inbox.id,
        name: inbox.name,
        fromEmail: inbox.fromEmail,
        fromName: inbox.fromName,
        dailyLimit: inbox.dailyLimit,
        sentToday: inbox.sentToday,
        isActive: inbox.isActive,
      },
    });
  } catch (err: any) {
    if (err.code === "P2002") {
      return NextResponse.json(
        { error: "An inbox with this email address already exists in your organization" },
        { status: 409 },
      );
    }
    return tenantErrorResponse(err);
  }
}
