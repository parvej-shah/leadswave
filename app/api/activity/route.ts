import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireOrg, tenantErrorResponse } from "@/lib/tenant";

const PAGE_SIZE = 30;

export async function GET(req: NextRequest) {
  let ctx;
  try {
    ctx = await requireOrg();
  } catch (e) {
    return tenantErrorResponse(e);
  }

  const cursor = req.nextUrl.searchParams.get("cursor");
  const after = req.nextUrl.searchParams.get("after");

  // Live-poll mode: only events newer than the given id (cheap "anything new?"
  // check for the dashboard refresher).
  if (after) {
    const anchor = await db.activityEvent.findFirst({
      where: { id: after, orgId: ctx.orgId },
      select: { createdAt: true },
    });
    const fresh = await db.activityEvent.findMany({
      where: {
        orgId: ctx.orgId,
        ...(anchor ? { createdAt: { gt: anchor.createdAt } } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: PAGE_SIZE,
      select: { id: true, type: true, summary: true, createdAt: true },
    });
    return NextResponse.json({ events: anchor ? fresh : [], latestId: fresh[0]?.id ?? after });
  }

  const events = await db.activityEvent.findMany({
    where: { orgId: ctx.orgId },
    orderBy: { createdAt: "desc" },
    take: PAGE_SIZE + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });

  const hasMore = events.length > PAGE_SIZE;
  const page = hasMore ? events.slice(0, PAGE_SIZE) : events;

  return NextResponse.json({
    events: page,
    nextCursor: hasMore ? page[page.length - 1].id : null,
  });
}
