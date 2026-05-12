import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  // TODO: verify Resend webhook signature, invoke inbox agent
  const body = await req.json();
  return NextResponse.json({ ok: true, received: true });
}
