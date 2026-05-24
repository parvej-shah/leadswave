import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getSystemSettings } from "@/lib/settings";

async function getUserId() {
  const session = await auth();
  return session?.user?.id ?? null;
}

export async function GET() {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const campaigns = await db.campaign.findMany({
    where: { deletedAt: null },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { leads: true } } },
  });

  return NextResponse.json(campaigns);
}

export async function POST(req: NextRequest) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { name, query, location, offerText } = body;

  if (!name || !query || !location) {
    return NextResponse.json({ error: "name, query, and location are required" }, { status: 400 });
  }

  const settings = await getSystemSettings();

  const campaign = await db.campaign.create({
    data: {
      name,
      query,
      location,
      offerText: offerText || settings?.offerText || "",
      status: "active",
    },
  });

  return NextResponse.json(campaign, { status: 201 });
}
