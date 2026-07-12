import { NextResponse } from "next/server";
import { requireOrg, tenantErrorResponse } from "@/lib/tenant";
import { db } from "@/lib/db";

export async function GET() {
  let ctx;
  try {
    ctx = await requireOrg();
  } catch (e) {
    return tenantErrorResponse(e);
  }

  const leads = await db.lead.findMany({
    where: {
      orgId: ctx.orgId,
      deletedAt: null,
      messages: { some: { direction: "inbound" } },
    },
    orderBy: { lastTouchedAt: "desc" },
    include: {
      campaign: { select: { name: true } },
      messages: {
        orderBy: { sentAt: "asc" },
        select: { id: true, direction: true, subject: true, body: true, bodyHtml: true, sentAt: true },
      },
    },
  });

  return NextResponse.json(leads);
}
