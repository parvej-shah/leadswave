import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { campaignId, query, location } = await req.json();
  // TODO: enqueue scout job via BullMQ
  return NextResponse.json({ ok: true, campaignId, query, location });
}
