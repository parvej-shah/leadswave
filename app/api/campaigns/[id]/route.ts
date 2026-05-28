import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

async function getUserId() {
  const session = await auth();
  return session?.user?.id ?? null;
}

export async function GET(_req: NextRequest, ctx: RouteContext<"/api/campaigns/[id]">) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const campaign = await db.campaign.findFirst({
    where: { id, deletedAt: null },
  });

  if (!campaign) return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  return NextResponse.json(campaign);
}

export async function PATCH(req: NextRequest, ctx: RouteContext<"/api/campaigns/[id]">) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const body = await req.json();
  const { name, query, location, offerText, websiteOffer, crmOffer, status } = body as {
    name?: string;
    query?: string;
    location?: string;
    offerText?: string;
    websiteOffer?: string;
    crmOffer?: string;
    status?: string;
  };

  const existing = await db.campaign.findFirst({
    where: { id, deletedAt: null },
    select: { id: true },
  });
  if (!existing) return NextResponse.json({ error: "Campaign not found" }, { status: 404 });

  const data: {
    name?: string;
    query?: string;
    location?: string;
    offerText?: string;
    websiteOffer?: string;
    crmOffer?: string;
    status?: string;
  } = {};

  if (typeof name === "string") data.name = name.trim();
  if (typeof query === "string") data.query = query.trim();
  if (typeof location === "string") data.location = location.trim();
  if (typeof offerText === "string") data.offerText = offerText.trim();
  if (typeof websiteOffer === "string") data.websiteOffer = websiteOffer.trim();
  if (typeof crmOffer === "string") data.crmOffer = crmOffer.trim();
  if (typeof status === "string" && ["active", "paused", "completed"].includes(status)) {
    data.status = status;
  }

  if ((data.name !== undefined && !data.name) || (data.query !== undefined && !data.query) || (data.location !== undefined && !data.location)) {
    return NextResponse.json(
      { error: "name, query, and location cannot be empty" },
      { status: 400 }
    );
  }

  const campaign = await db.campaign.update({
    where: { id },
    data,
  });

  return NextResponse.json(campaign);
}
