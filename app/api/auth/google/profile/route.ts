import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isEmailAllowed } from "@/lib/allowlist";
import { getOrgOwnerGoogleToken } from "@/lib/tenant";
import { getSystemSettings } from "@/lib/settings";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id || !session.orgId || !isEmailAllowed(session.user.email)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Token now lives on the org owner's User row; legacy Settings token kept as fallback.
  const [ownerToken, settings] = await Promise.all([
    getOrgOwnerGoogleToken(session.orgId),
    getSystemSettings(session.orgId),
  ]);

  if (!ownerToken?.refreshToken && !settings.googleRefreshToken) {
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
