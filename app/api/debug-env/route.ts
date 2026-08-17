import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    AUTH_SECRET_LEN: process.env.AUTH_SECRET?.length || 0,
    GOOGLE_CLIENT_ID_LEN: process.env.GOOGLE_CLIENT_ID?.length || 0,
    GOOGLE_CLIENT_SECRET_LEN: process.env.GOOGLE_CLIENT_SECRET?.length || 0,
    GOOGLE_CLIENT_SECRET_LAST_CHAR: process.env.GOOGLE_CLIENT_SECRET?.slice(-1),
    NEXTAUTH_URL: process.env.NEXTAUTH_URL || null,
    AUTH_URL: process.env.AUTH_URL || null,
    NODE_ENV: process.env.NODE_ENV,
  });
}
