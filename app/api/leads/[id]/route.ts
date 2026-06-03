import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(_req: NextRequest, ctx: RouteContext<"/api/leads/[id]">) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;

  const lead = await db.lead.findFirst({
    where: { id, deletedAt: null },
    include: {
      campaign: { select: { id: true, name: true } },
      messages: { orderBy: { sentAt: "asc" } },
    },
  });

  if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  return NextResponse.json(lead);
}
