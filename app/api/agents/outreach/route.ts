import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { leadId } = await req.json();
  // TODO: enqueue outreach job via BullMQ
  return NextResponse.json({ ok: true, leadId });
}
