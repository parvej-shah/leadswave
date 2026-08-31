import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { decryptSecret } from "@/lib/crypto";
import { isEmailAllowed } from "@/lib/allowlist";

export type OrgContext = {
  userId: string;
  orgId: string;
  role: string; // owner | admin | member
};

export class TenantError extends Error {
  constructor(
    public status: 401 | 403,
    message: string,
  ) {
    super(message);
  }
}

/**
 * Resolve the caller's org context from the session. Throws TenantError(401)
 * when there is no session or the token has no org (pre-tenancy JWT that the
 * auth self-heal couldn't hydrate). Route handlers catch this via
 * `tenantErrorResponse` or let Next's error boundary 500 — prefer the former.
 */
export async function requireOrg(): Promise<OrgContext> {
  const session = await auth();
  if (!session?.user?.id || !session.orgId) {
    throw new TenantError(401, "Unauthorized");
  }
  // Private platform: the final server-side gate. Even a validly-signed session
  // is refused if its identity is not on the allowlist.
  if (!isEmailAllowed(session.user.email)) {
    throw new TenantError(403, "Forbidden");
  }
  return { userId: session.user.id, orgId: session.orgId, role: session.role || "member" };
}

const ROLE_RANK: Record<string, number> = { member: 0, admin: 1, owner: 2 };

/** Throws TenantError(403) unless ctx.role meets the minimum. */
export function requireRole(ctx: OrgContext, min: "member" | "admin" | "owner"): void {
  if ((ROLE_RANK[ctx.role] ?? -1) < ROLE_RANK[min]) {
    throw new TenantError(403, "Forbidden");
  }
}

/** Map a TenantError to a JSON response; rethrows anything else. */
export function tenantErrorResponse(e: unknown): Response {
  if (e instanceof TenantError) {
    return Response.json({ error: e.message }, { status: e.status });
  }
  throw e;
}

/**
 * The Google refresh token that powers calendar booking for an org: the org
 * owner's. Used by cron/webhook/agent paths that have no session.
 */
export async function getOrgOwnerGoogleToken(
  orgId: string,
): Promise<{ refreshToken: string | null; userId: string } | null> {
  const owner = await db.membership.findFirst({
    where: { orgId, role: "owner" },
    orderBy: { createdAt: "asc" },
    include: { user: { select: { id: true, googleRefreshToken: true } } },
  });
  if (!owner) return null;
  return { refreshToken: decryptSecret(owner.user.googleRefreshToken), userId: owner.user.id };
}
