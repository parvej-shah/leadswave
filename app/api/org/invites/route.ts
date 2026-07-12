import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireOrg, requireRole, tenantErrorResponse } from "@/lib/tenant";

const INVITE_TTL_DAYS = 7;
const VALID_ROLES = new Set(["admin", "member"]); // owners are promoted, not invited

export async function GET() {
  let ctx;
  try {
    ctx = await requireOrg();
    requireRole(ctx, "admin");
  } catch (e) {
    return tenantErrorResponse(e);
  }

  const invites = await db.invite.findMany({
    where: { orgId: ctx.orgId, acceptedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
    select: { id: true, email: true, role: true, token: true, expiresAt: true, createdAt: true },
  });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  return NextResponse.json(
    invites.map((i) => ({ ...i, link: `${appUrl}/invite/${i.token}` })),
  );
}

export async function POST(req: NextRequest) {
  let ctx;
  try {
    ctx = await requireOrg();
    requireRole(ctx, "admin");
  } catch (e) {
    return tenantErrorResponse(e);
  }

  const { email, role } = (await req.json()) as { email?: string; role?: string };
  const normalized = email?.trim().toLowerCase();
  if (!normalized || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(normalized)) {
    return NextResponse.json({ error: "Valid email required" }, { status: 400 });
  }
  const inviteRole = role && VALID_ROLES.has(role) ? role : "member";

  // Already a member?
  const existingUser = await db.user.findUnique({
    where: { email: normalized },
    include: { memberships: { where: { orgId: ctx.orgId } } },
  });
  if (existingUser?.memberships.length) {
    return NextResponse.json({ error: "Already a member of this organization" }, { status: 409 });
  }

  // Refresh any pending invite for the same address instead of stacking them.
  await db.invite.deleteMany({ where: { orgId: ctx.orgId, email: normalized, acceptedAt: null } });

  const invite = await db.invite.create({
    data: {
      orgId: ctx.orgId,
      email: normalized,
      role: inviteRole,
      invitedById: ctx.userId,
      expiresAt: new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000),
    },
  });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  return NextResponse.json(
    {
      id: invite.id,
      email: invite.email,
      role: invite.role,
      expiresAt: invite.expiresAt,
      link: `${appUrl}/invite/${invite.token}`,
    },
    { status: 201 },
  );
}

export async function DELETE(req: NextRequest) {
  let ctx;
  try {
    ctx = await requireOrg();
    requireRole(ctx, "admin");
  } catch (e) {
    return tenantErrorResponse(e);
  }

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const { count } = await db.invite.deleteMany({ where: { id, orgId: ctx.orgId, acceptedAt: null } });
  if (count === 0) return NextResponse.json({ error: "Invite not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
