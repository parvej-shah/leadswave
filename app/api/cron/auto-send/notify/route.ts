import { NextRequest, NextResponse } from "next/server";
import { sendTelegramMessage } from "@/lib/telegram";

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  const auth = req.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { chatId, message } = (await req.json()) as { chatId: string; message: string };
  if (!chatId || !message) {
    return NextResponse.json({ error: "chatId and message required" }, { status: 400 });
  }

  await sendTelegramMessage(chatId, message).catch(() => {});
  return NextResponse.json({ ok: true });
}
