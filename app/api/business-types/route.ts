import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireOrg, tenantErrorResponse } from "@/lib/tenant";

// Existing business-type names for the org — powers the wizard/edit datalist so
// the same type keeps one spelling (and therefore one coverage-map grouping).
export async function GET() {
  let ctx;
  try {
    ctx = await requireOrg();
  } catch (e) {
    return tenantErrorResponse(e);
  }

  const types = await db.businessType.findMany({
    where: { orgId: ctx.orgId },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  return NextResponse.json(types);
}

// Update a business type's shared default offer (org-scoped).
export async function PATCH(req: NextRequest) {
  let ctx;
  try {
    ctx = await requireOrg();
  } catch (e) {
    return tenantErrorResponse(e);
  }

  const body = await req.json();
  const { id, defaultOffer } = body as { id?: string; defaultOffer?: string };
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  const result = await db.businessType.updateMany({
    where: { id, orgId: ctx.orgId },
    data: { defaultOffer: typeof defaultOffer === "string" ? defaultOffer.trim() || null : null },
  });
  if (result.count === 0) {
    return NextResponse.json({ error: "Business type not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
