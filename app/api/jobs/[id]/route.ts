import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireOrg, tenantErrorResponse } from "@/lib/tenant";

/**
 * PATCH a pending follow-up before it sends:
 *   { action: "skip" }                — cancel it
 *   { action: "edit", body: string }  — send this exact text instead of the AI draft
 *   { action: "reset" }               — clear the override, back to AI drafting
 */
export async function PATCH(req: NextRequest, ctx: RouteContext<"/api/jobs/[id]">) {
  let org;
  try {
    org = await requireOrg();
  } catch (e) {
    return tenantErrorResponse(e);
  }

  const { id } = await ctx.params;
  const { action, body } = (await req.json()) as { action?: string; body?: string };

  const job = await db.job.findFirst({
    where: { id, status: "pending", lead: { orgId: org.orgId } },
  });
  if (!job) return NextResponse.json({ error: "Pending job not found" }, { status: 404 });

  if (action === "skip") {
    await db.job.update({ where: { id }, data: { status: "cancelled" } });
    return NextResponse.json({ ok: true, status: "cancelled" });
  }

  if (action === "edit") {
    if (!body?.trim()) return NextResponse.json({ error: "body required" }, { status: 400 });
    await db.job.update({ where: { id }, data: { overrideBody: body.trim() } });
    return NextResponse.json({ ok: true, overridden: true });
  }

  if (action === "reset") {
    await db.job.update({ where: { id }, data: { overrideBody: null } });
    return NextResponse.json({ ok: true, overridden: false });
  }

  return NextResponse.json({ error: "action must be skip, edit, or reset" }, { status: 400 });
}
