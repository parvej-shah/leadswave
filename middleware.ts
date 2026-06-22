import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

function hasSessionCookie(req: NextRequest): boolean {
  // Auth.js v5 cookie names (with and without secure prefix), plus legacy next-auth names.
  return [
    "__Secure-authjs.session-token",
    "authjs.session-token",
    "__Secure-next-auth.session-token",
    "next-auth.session-token",
  ].some((name) => Boolean(req.cookies.get(name)?.value));
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (pathname === "/login") {
    return NextResponse.next();
  }

  if (!hasSessionCookie(req)) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|offline|icon\\.png|apple-icon\\.png|icon-192\\.png|icon-512\\.png|icon-maskable-192\\.png|icon-maskable-512\\.png|api/auth|api/webhooks|api/telegram/webhook|api/cron).*)",
  ],
};
