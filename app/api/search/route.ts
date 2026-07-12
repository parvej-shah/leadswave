import { NextRequest, NextResponse } from "next/server";
import { requireOrg, tenantErrorResponse } from "@/lib/tenant";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  let ctx;
  try {
    ctx = await requireOrg();
  } catch (e) {
    return tenantErrorResponse(e);
  }

  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return NextResponse.json({ leads: [] });

  const leads = await db.lead.findMany({
    where: {
      orgId: ctx.orgId,
      OR: [
        { companyName: { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } },
      ],
    },
    select: { id: true, companyName: true, email: true, state: true },
    orderBy: { lastTouchedAt: "desc" },
    take: 8,
  });

  return NextResponse.json({ leads });
}
