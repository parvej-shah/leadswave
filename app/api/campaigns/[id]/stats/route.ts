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
        select: { direction: true, deliveryStatus: true, sentAt: true },
      })
    : [];

  const totalLeads = leads.length;
  const withEmail = leads.filter((l) => l.email).length;

  const outbound = messages.filter((m) => m.direction === "outbound");
  const inbound = messages.filter((m) => m.direction === "inbound");

  const totalSent = outbound.length;
  const delivered = outbound.filter((m) =>
    ["delivered", "opened", "clicked"].includes(m.deliveryStatus ?? "")
  ).length;
  const opened = outbound.filter((m) =>
    ["opened", "clicked"].includes(m.deliveryStatus ?? "")
  ).length;
  const clicked = outbound.filter((m) => m.deliveryStatus === "clicked").length;
  const bounced = outbound.filter((m) => m.deliveryStatus === "bounced").length;
  const complained = outbound.filter((m) => m.deliveryStatus === "complained").length;

  const replied = leads.filter((l) => l.state === "replied" || l.state === "converted").length;
  const converted = leads.filter((l) => l.state === "converted").length;

  const contactedLeads = leads.filter(
    (l) => l.state !== "discovered"
  ).length;

  // Daily activity time-series for the past 30 days
  const now = new Date();
  const dailyActivity: { date: string; label: string; sent: number; opens: number; clicks: number; replies: number }[] = [];

  for (let i = 29; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split("T")[0];
    const monthDay = d.toLocaleDateString("en-US", { month: "short", day: "2-digit" });

    const sentCount = outbound.filter((m) => m.sentAt.toISOString().startsWith(dateStr)).length;
    const opensCount = outbound.filter(
      (m) => ["opened", "clicked"].includes(m.deliveryStatus ?? "") && m.sentAt.toISOString().startsWith(dateStr)
    ).length;
    const clicksCount = outbound.filter(
      (m) => m.deliveryStatus === "clicked" && m.sentAt.toISOString().startsWith(dateStr)
    ).length;
    const repliesCount = inbound.filter((m) => m.sentAt.toISOString().startsWith(dateStr)).length;

    dailyActivity.push({
      date: dateStr,
      label: monthDay,
      sent: sentCount,
      opens: opensCount,
      clicks: clicksCount,
      replies: repliesCount,
    });
  }

  return NextResponse.json({
    totalLeads,
    withEmail,
    contactedLeads,
    totalSent,
    delivered,
    opened,
    clicked,
    bounced,
    complained,
    totalReplies: inbound.length,
    repliedLeads: replied,
    convertedLeads: converted,
    opportunitiesCount: replied,
    opportunitiesValue: (campaign as Record<string, unknown>).opportunitiesValue as number ?? 0,
    conversionsCount: converted,
    conversionsValue: (campaign as Record<string, unknown>).conversionsValue as number ?? 0,
    dailyActivity,
  });
}
