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
    select: { id: true },
  });
  if (!campaign) return NextResponse.json({ error: "Campaign not found" }, { status: 404 });

  const leads = await db.lead.findMany({
    where: { campaignId: id, deletedAt: null },
    select: { id: true, email: true, state: true },
  });

  const leadIds = leads.map((l) => l.id);

  const messages = leadIds.length
    ? await db.message.findMany({
        where: { leadId: { in: leadIds } },
        select: { direction: true, deliveryStatus: true },
      })
    : [];

  const totalLeads = leads.length;
  const withEmail = leads.filter((l) => l.email).length;

  const outbound = messages.filter((m) => m.direction === "outbound");
  const inbound = messages.filter((m) => m.direction === "inbound");

  const totalSent = outbound.length;
  const delivered = outbound.filter((m) => m.deliveryStatus === "delivered" || m.deliveryStatus === "opened").length;
  const opened = outbound.filter((m) => m.deliveryStatus === "opened").length;
  const bounced = outbound.filter((m) => m.deliveryStatus === "bounced").length;
  const complained = outbound.filter((m) => m.deliveryStatus === "complained").length;

  const replied = leads.filter((l) => l.state === "replied" || l.state === "converted").length;
  const converted = leads.filter((l) => l.state === "converted").length;

  const contactedLeads = leads.filter(
    (l) => l.state !== "discovered"
  ).length;

  return NextResponse.json({
    totalLeads,
    withEmail,
    contactedLeads,
    totalSent,
    delivered,
    opened,
    bounced,
    complained,
    totalReplies: inbound.length,
    repliedLeads: replied,
    convertedLeads: converted,
  });
}
