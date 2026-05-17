import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const leads = await db.lead.findMany({
    where: {
      deletedAt: null,
      state: { in: ["replied", "converted"] },
      messages: { some: { direction: "inbound" } },
    },
    orderBy: { lastTouchedAt: "desc" },
    include: {
      campaign: { select: { name: true } },
      messages: {
        orderBy: { sentAt: "asc" },
        select: { id: true, direction: true, subject: true, body: true, sentAt: true },
      },
    },
  });

  return NextResponse.json(leads);
}
