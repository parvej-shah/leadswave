import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(_req: NextRequest, ctx: RouteContext<"/api/campaigns/[id]/leads">) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;

  const campaign = await db.campaign.findFirst({ where: { id, deletedAt: null }, select: { id: true } });
  if (!campaign) return NextResponse.json({ error: "Campaign not found" }, { status: 404 });

  const leads = await db.lead.findMany({
    where: { campaignId: id, deletedAt: null },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { messages: true } } },
  });

  return NextResponse.json(leads);
}
