import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

async function getUserId() {
  const session = await auth();
  return session?.user?.id ?? null;
}

export async function GET(req: NextRequest) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const campaignId = searchParams.get("campaignId");

  const leads = await db.lead.findMany({
    where: {
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
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  await db.lead.update({ where: { id }, data: { deletedAt: new Date() } });
  return NextResponse.json({ ok: true });
}

export async function PATCH(req: NextRequest) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const { id, companyName, email, website, state } = body;

    if (!id) {
      return NextResponse.json({ error: "Lead ID is required" }, { status: 400 });
    }

    const updated = await db.lead.update({
      where: { id },
      data: {
        ...(companyName !== undefined ? { companyName } : {}),
        ...(email !== undefined ? { email: email ? email.trim() : null } : {}),
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

