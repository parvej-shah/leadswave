import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireOrg, tenantErrorResponse } from "@/lib/tenant";

export async function DELETE() {
  let ctx;
  try {
    ctx = await requireOrg();
  } catch (e) {
    return tenantErrorResponse(e);
  }

  // Clear the caller's own User token + this org's legacy Settings token only.
  await Promise.all([
    db.user.update({ where: { id: ctx.userId }, data: { googleRefreshToken: null } }),
    db.settings.updateMany({
      where: { orgId: ctx.orgId },
      data: { googleRefreshToken: null },
    }),
  ]);

  return NextResponse.json({ ok: true });
}
