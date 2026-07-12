import { NextRequest, NextResponse } from "next/server";
import { requireOrg, tenantErrorResponse } from "@/lib/tenant";
import { db } from "@/lib/db";

export async function GET(_req: NextRequest, ctx: RouteContext<"/api/campaigns/[id]/leads">) {
  let org;
  try {
    org = await requireOrg();
  } catch (e) {
    return tenantErrorResponse(e);
  }

  const { id } = await ctx.params;

  const campaign = await db.campaign.findFirst({ where: { id, orgId: org.orgId, deletedAt: null }, select: { id: true } });
  if (!campaign) return NextResponse.json({ error: "Campaign not found" }, { status: 404 });

  const leads = await db.lead.findMany({
    where: { campaignId: id, deletedAt: null },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { messages: true } } },
  });

  return NextResponse.json(leads);
}
