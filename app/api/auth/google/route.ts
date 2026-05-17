// This route is no longer needed — Google Calendar access is granted automatically
// during sign-in via NextAuth (see lib/auth.ts for the scopes).
// Kept as a stub to avoid 404s from any bookmarks.
import { NextResponse } from "next/server";
export async function GET() {
  return NextResponse.redirect(new URL("/settings", process.env.NEXT_PUBLIC_APP_URL!));
}
