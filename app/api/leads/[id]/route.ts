import { NextRequest, NextResponse } from "next/server";
import { requireOrg, tenantErrorResponse } from "@/lib/tenant";
import { db } from "@/lib/db";

export async function GET(_req: NextRequest, ctx: RouteContext<"/api/leads/[id]">) {
  let org;
  try {
    org = await requireOrg();
  } catch (e) {
    return tenantErrorResponse(e);
  }

  const { id } = await ctx.params;

  const lead = await db.lead.findFirst({
    where: { id, orgId: org.orgId, deletedAt: null },
    include: {
      campaign: { select: { id: true, name: true } },
      messages: { orderBy: { sentAt: "asc" } },
    },
  });

  if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  return NextResponse.json(lead);
}
