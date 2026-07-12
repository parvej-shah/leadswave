import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireOrg, requireRole, tenantErrorResponse } from "@/lib/tenant";

const VALID_ROLES = new Set(["owner", "admin", "member"]);

/** Guard: an org must always keep at least one owner. */
async function isLastOwner(orgId: string, membershipId: string): Promise<boolean> {
  const target = await db.membership.findFirst({ where: { id: membershipId, orgId } });
  if (!target || target.role !== "owner") return false;
  const ownerCount = await db.membership.count({ where: { orgId, role: "owner" } });
  return ownerCount <= 1;
}

export async function PATCH(req: NextRequest, ctx: RouteContext<"/api/org/members/[id]">) {
  let org;
  try {
    org = await requireOrg();
    requireRole(org, "owner"); // only owners change roles
  } catch (e) {
    return tenantErrorResponse(e);
  }

  const { id } = await ctx.params;
  const { role } = (await req.json()) as { role?: string };
  if (!role || !VALID_ROLES.has(role)) {
    return NextResponse.json({ error: "role must be owner, admin, or member" }, { status: 400 });
  }

  const membership = await db.membership.findFirst({ where: { id, orgId: org.orgId } });
  if (!membership) return NextResponse.json({ error: "Member not found" }, { status: 404 });

  if (role !== "owner" && (await isLastOwner(org.orgId, id))) {
    return NextResponse.json({ error: "Cannot demote the last owner" }, { status: 400 });
  }

  const updated = await db.membership.update({ where: { id }, data: { role } });
  return NextResponse.json({ ok: true, role: updated.role });
}

export async function DELETE(_req: NextRequest, ctx: RouteContext<"/api/org/members/[id]">) {
  let org;
  try {
    org = await requireOrg();
    requireRole(org, "owner");
  } catch (e) {
    return tenantErrorResponse(e);
  }

  const { id } = await ctx.params;
  const membership = await db.membership.findFirst({ where: { id, orgId: org.orgId } });
  if (!membership) return NextResponse.json({ error: "Member not found" }, { status: 404 });

  if (await isLastOwner(org.orgId, id)) {
    return NextResponse.json({ error: "Cannot remove the last owner" }, { status: 400 });
  }

  await db.membership.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
