import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { db } from "@/lib/db";
import { requireOrg, requireRole, tenantErrorResponse } from "@/lib/tenant";

/**
 * Generate a one-time Telegram connect code for this org. The user sends
 * `/start <code>` to the bot (or taps the deep link) and the webhook binds
 * that chat to this org's Settings row, then clears the code.
 */
export async function POST() {
  let ctx;
  try {
    ctx = await requireOrg();
    requireRole(ctx, "admin");
  } catch (e) {
    return tenantErrorResponse(e);
  }

  const code = randomBytes(6).toString("hex"); // 12 chars, URL/Telegram safe

  await db.settings.upsert({
    where: { orgId: ctx.orgId },
    update: { telegramConnectCode: code },
    create: { orgId: ctx.orgId, userId: ctx.userId, telegramConnectCode: code },
  });

  const botName = process.env.TELEGRAM_BOT_NAME; // without @
  return NextResponse.json({
    code,
    deepLink: botName ? `https://t.me/${botName}?start=${code}` : null,
  });
}
