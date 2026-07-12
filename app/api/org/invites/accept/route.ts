import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

/**
 * Accept an invite as the logged-in user. The invite email must match the
 * session's Google account email (case-insensitive). Sets defaultOrgId so the
 * next token refresh/login binds to the joined org.
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { token } = (await req.json()) as { token?: string };
  if (!token) return NextResponse.json({ error: "token required" }, { status: 400 });

  const invite = await db.invite.findUnique({ where: { token }, include: { org: true } });
  if (!invite || invite.acceptedAt || invite.expiresAt < new Date()) {
    return NextResponse.json({ error: "Invite is invalid or expired" }, { status: 410 });
  }
  if (invite.email.toLowerCase() !== session.user.email.toLowerCase()) {
    return NextResponse.json(
      { error: `This invite was sent to ${invite.email}. Sign in with that Google account to accept.` },
      { status: 403 },
    );
  }

  const user = await db.user.findUnique({ where: { email: session.user.email.toLowerCase() } });
  if (!user) return NextResponse.json({ error: "User not provisioned — sign in again" }, { status: 409 });

  const existing = await db.membership.findUnique({
    where: { userId_orgId: { userId: user.id, orgId: invite.orgId } },
  });

  await db.$transaction(async (tx) => {
    if (!existing) {
      await tx.membership.create({
        data: { userId: user.id, orgId: invite.orgId, role: invite.role },
      });
    }
    await tx.invite.update({ where: { id: invite.id }, data: { acceptedAt: new Date() } });
    await tx.user.update({ where: { id: user.id }, data: { defaultOrgId: invite.orgId } });
  });

  return NextResponse.json({
    ok: true,
    orgName: invite.org.name,
    // The live JWT still points at the previous org; a fresh sign-in rebinds
    // via defaultOrgId. The UI directs the user accordingly.
    requiresRelogin: true,
  });
}
