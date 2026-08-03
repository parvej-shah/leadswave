import { NextRequest, NextResponse } from "next/server";
import { requireOrg, tenantErrorResponse } from "@/lib/tenant";
import { db } from "@/lib/db";

export interface OfferStat {
  key: string;
  label: string;
  leadsSent: number;
  replies: number;
  replyRate: number;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  let ctx;
  try {
    ctx = await requireOrg();
  } catch (e) {
    return tenantErrorResponse(e);
  }

  const { id: campaignId } = await params;

  const campaign = await db.campaign.findFirst({
    where: { id: campaignId, orgId: ctx.orgId, deletedAt: null },
    include: {
      offers: { orderBy: { order: "asc" } },
    },
  });

  if (!campaign) {
    return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  }

  if (!campaign.offers || campaign.offers.length === 0) {
    return NextResponse.json([]);
  }

  const leads = await db.lead.findMany({
    where: { campaignId, orgId: ctx.orgId, deletedAt: null },
    select: { id: true, category: true, state: true },
  });

  const repliedLeadIds = new Set(
    (
      await db.message.findMany({
        where: {
          lead: { campaignId, orgId: ctx.orgId },
          direction: "inbound",
        },
        select: { leadId: true },
        distinct: ["leadId"],
      })
    ).map((m) => m.leadId),
  );

  const statsMap: Record<string, { leadsSent: number; replies: number }> = {};
  for (const offer of campaign.offers) {
    statsMap[offer.key] = { leadsSent: 0, replies: 0 };
  }

  for (const lead of leads) {
    const key = lead.category;
    if (key && statsMap[key]) {
      if (lead.state !== "discovered") {
        statsMap[key].leadsSent++;
      }
      if (repliedLeadIds.has(lead.id)) {
        statsMap[key].replies++;
      }
    }
  }

  const result: OfferStat[] = campaign.offers.map((offer) => {
    const s = statsMap[offer.key] ?? { leadsSent: 0, replies: 0 };
    const replyRate = s.leadsSent > 0 ? (s.replies / s.leadsSent) * 100 : 0;
    return {
      key: offer.key,
      label: offer.label || offer.key,
      leadsSent: s.leadsSent,
      replies: s.replies,
      replyRate: Math.round(replyRate * 10) / 10,
    };
  });

  return NextResponse.json(result);
}
