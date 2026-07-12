import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireOrg, tenantErrorResponse } from "@/lib/tenant";

/** Scheduled follow-up queue: every pending job in this org, soonest first. */
export async function GET() {
  let ctx;
  try {
    ctx = await requireOrg();
  } catch (e) {
    return tenantErrorResponse(e);
  }

  const jobs = await db.job.findMany({
    where: { status: "pending", lead: { orgId: ctx.orgId, deletedAt: null } },
    orderBy: { scheduledAt: "asc" },
    take: 100,
    include: {
      lead: {
        select: {
          id: true,
          companyName: true,
          email: true,
          state: true,
          campaign: { select: { id: true, name: true } },
        },
      },
    },
  });

  return NextResponse.json(
    jobs.map((j) => ({
      id: j.id,
      type: j.type,
      scheduledAt: j.scheduledAt,
      hasOverride: !!j.overrideBody,
      overrideBody: j.overrideBody,
      lead: j.lead,
    })),
  );
}
