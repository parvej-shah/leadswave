import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireOrg, tenantErrorResponse } from "@/lib/tenant";

export async function GET() {
  let ctx;
  try {
    ctx = await requireOrg();
  } catch (e) {
    return tenantErrorResponse(e);
  }

  const members = await db.membership.findMany({
    where: { orgId: ctx.orgId },
    orderBy: { createdAt: "asc" },
    include: { user: { select: { id: true, email: true, name: true, image: true } } },
  });

  return NextResponse.json(
    members.map((m) => ({
      membershipId: m.id,
      userId: m.user.id,
      email: m.user.email,
      name: m.user.name,
      image: m.user.image,
      role: m.role,
      joinedAt: m.createdAt,
      isSelf: m.user.id === ctx.userId,
    })),
  );
}
