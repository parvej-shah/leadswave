import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const settings = await db.settings.findFirst({
    select: { googleRefreshToken: true, googleClientId: true, googleClientSecret: true },
  });

  if (!settings?.googleRefreshToken) {
    return NextResponse.json({ connected: false });
  }

  // Return profile from the session (populated by Google OAuth)
  return NextResponse.json({
    connected: true,
    name: session.user.name ?? null,
    email: session.user.email ?? null,
    image: session.user.image ?? null,
  });
}
