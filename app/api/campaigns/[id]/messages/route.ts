import { NextRequest, NextResponse } from "next/server";
import { requireOrg, tenantErrorResponse } from "@/lib/tenant";
import { db } from "@/lib/db";

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  let org;
  try {
    org = await requireOrg();
  } catch (e) {
    return tenantErrorResponse(e);
  }

  const { id } = await ctx.params;

  const campaign = await db.campaign.findFirst({
    where: { id, orgId: org.orgId, deletedAt: null },
    select: { id: true, name: true },
  });
  if (!campaign) {
    return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  }

  const leads = await db.lead.findMany({
    where: { campaignId: id, deletedAt: null },
    select: { id: true },
  });

  const leadIds = leads.map((l) => l.id);
  if (leadIds.length === 0) {
    return NextResponse.json({ messages: [] });
  }

  const messages = await db.message.findMany({
    where: { leadId: { in: leadIds } },
    include: {
      lead: {
        select: {
          id: true,
          companyName: true,
          email: true,
          phone: true,
          website: true,
          state: true,
          category: true,
        },
      },
      senderInbox: {
        select: {
          fromEmail: true,
          fromName: true,
        },
      },
    },
    orderBy: { sentAt: "desc" },
  });

  return NextResponse.json({ messages });
}
