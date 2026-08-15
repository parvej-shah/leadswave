import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireOrg, requireRole, tenantErrorResponse } from "@/lib/tenant";
import { encryptSecret, isMaskedSecret } from "@/lib/crypto";
import { verifySmtpConnection, type SmtpInboxConfig } from "@/lib/email/smtp";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const ctx = await requireOrg();
    requireRole(ctx, "admin");
    const { id } = await params;

    const existing = await db.senderInbox.findFirst({
      where: { id, orgId: ctx.orgId },
    });

    if (!existing) {
      return NextResponse.json({ error: "Inbox not found" }, { status: 404 });
    }

    const body = await req.json();
    const updateData: any = {};

    if (typeof body.name === "string") updateData.name = body.name;
    if (typeof body.fromName === "string") updateData.fromName = body.fromName;
    if (typeof body.replyToEmail !== "undefined") updateData.replyToEmail = body.replyToEmail || null;
    if (typeof body.dailyLimit === "number") updateData.dailyLimit = body.dailyLimit;
    if (typeof body.isActive === "boolean") updateData.isActive = body.isActive;
    if (typeof body.warmupStatus === "string") updateData.warmupStatus = body.warmupStatus;
    if (typeof body.smtpHost === "string") updateData.smtpHost = body.smtpHost;
    if (typeof body.smtpPort === "number") updateData.smtpPort = body.smtpPort;
    if (typeof body.smtpUser === "string") updateData.smtpUser = body.smtpUser;
    if (typeof body.smtpSecure === "boolean") updateData.smtpSecure = body.smtpSecure;

    // If new password provided (and not a mask)
    if (body.smtpPassword && !isMaskedSecret(body.smtpPassword)) {
      const testConfig: SmtpInboxConfig = {
        id: existing.id,
        fromEmail: existing.fromEmail,
        fromName: updateData.fromName || existing.fromName,
        smtpHost: updateData.smtpHost || existing.smtpHost,
        smtpPort: updateData.smtpPort || existing.smtpPort,
        smtpUser: updateData.smtpUser || existing.smtpUser,
        smtpPassPlain: body.smtpPassword,
        smtpSecure: updateData.smtpSecure ?? existing.smtpSecure,
      };

      const verifyResult = await verifySmtpConnection(testConfig);
      if (!verifyResult.ok) {
        return NextResponse.json(
          { error: `SMTP verification failed with new password: ${verifyResult.error}` },
          { status: 400 },
        );
      }

      updateData.smtpPassEncrypted = encryptSecret(body.smtpPassword);
    }

    const updated = await db.senderInbox.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ success: true, inbox: updated });
  } catch (err) {
    return tenantErrorResponse(err);
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const ctx = await requireOrg();
    requireRole(ctx, "admin");
    const { id } = await params;

    const existing = await db.senderInbox.findFirst({
      where: { id, orgId: ctx.orgId },
    });

    if (!existing) {
      return NextResponse.json({ error: "Inbox not found" }, { status: 404 });
    }

    await db.senderInbox.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    return tenantErrorResponse(err);
  }
}
