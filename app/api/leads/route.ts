import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireOrg, tenantErrorResponse } from "@/lib/tenant";

export async function GET(req: NextRequest) {
  let ctx;
  try {
    ctx = await requireOrg();
  } catch (e) {
    return tenantErrorResponse(e);
  }

  const { searchParams } = new URL(req.url);
  const campaignId = searchParams.get("campaignId");

  const leads = await db.lead.findMany({
    where: {
      orgId: ctx.orgId,
      deletedAt: null,
      ...(campaignId ? { campaignId } : {}),
    },
    orderBy: { createdAt: "desc" },
    include: {
      campaign: { select: { name: true } },
      _count: { select: { messages: true } },
    },
  });

  return NextResponse.json(leads);
}

export async function DELETE(req: NextRequest) {
  let ctx;
  try {
    ctx = await requireOrg();
  } catch (e) {
    return tenantErrorResponse(e);
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const { count } = await db.lead.updateMany({
    where: { id, orgId: ctx.orgId },
    data: { deletedAt: new Date() },
  });
  if (count === 0) return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}

export async function PATCH(req: NextRequest) {
  let ctx;
  try {
    ctx = await requireOrg();
  } catch (e) {
    return tenantErrorResponse(e);
  }

  try {
    const body = await req.json();
    const { id, action, companyName, email, website, state } = body;

    if (!id) {
      return NextResponse.json({ error: "Lead ID is required" }, { status: 400 });
    }

    // Undo for the soft delete in DELETE above.
    if (action === "restore") {
      const { count } = await db.lead.updateMany({
        where: { id, orgId: ctx.orgId },
        data: { deletedAt: null },
      });
      if (count === 0) return NextResponse.json({ error: "Lead not found" }, { status: 404 });
      return NextResponse.json({ ok: true, restored: true });
    }

    const current = await db.lead.findFirst({
      where: { id, orgId: ctx.orgId },
      select: { email: true },
    });
    if (!current) return NextResponse.json({ error: "Lead not found" }, { status: 404 });

    // A manually changed email invalidates stored verification — otherwise a
    // stale "invalid" status keeps blocking sends to the corrected address.
    const newEmail = email !== undefined ? (email ? (email as string).trim() : null) : undefined;
    const emailChanged = newEmail !== undefined && newEmail !== (current.email ?? null);

    const updated = await db.lead.update({
      where: { id },
      data: {
        ...(companyName !== undefined ? { companyName } : {}),
        ...(newEmail !== undefined ? { email: newEmail } : {}),
        ...(emailChanged
          ? {
              emailSource: newEmail ? "manual" : null,
              emailStatus: null,
              emailVerifiedAt: null,
            }
          : {}),
        ...(website !== undefined ? { website: website ? website.trim() : null } : {}),
        ...(state !== undefined ? { state } : {}),
      },
      include: {
        campaign: { select: { name: true } },
        _count: { select: { messages: true } },
      },
    });

    return NextResponse.json(updated);
  } catch (error: any) {
    console.error("Failed to update lead:", error);
    return NextResponse.json({ error: error.message || "Failed to update lead" }, { status: 500 });
  }
}
