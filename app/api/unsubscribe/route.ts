import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyUnsubscribeToken } from "@/lib/email/unsubscribe";

export async function POST(req: NextRequest) {
  const url = new URL(req.url);
  let token = url.searchParams.get("token");

  // Also check JSON body if token was sent via POST
  if (!token) {
    try {
      const body = await req.json();
      token = body.token;
    } catch {
      // ignore
    }
  }

  if (!token) {
    return NextResponse.json({ error: "Missing unsubscribe token" }, { status: 400 });
  }

  const payload = verifyUnsubscribeToken(token);
  if (!payload) {
    return NextResponse.json({ error: "Invalid or expired unsubscribe token" }, { status: 400 });
  }

  const normalizedEmail = payload.email.toLowerCase().trim();

  // Upsert into suppression list
  await db.suppression.upsert({
    where: {
      orgId_email: {
        orgId: payload.orgId,
        email: normalizedEmail,
      },
    },
    create: {
      orgId: payload.orgId,
      email: normalizedEmail,
      reason: "unsubscribed",
    },
    update: {
      reason: "unsubscribed",
    },
  });

  return NextResponse.json({
    success: true,
    message: `Successfully unsubscribed ${normalizedEmail}`,
  });
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const token = url.searchParams.get("token");

  if (!token) {
    return NextResponse.json({ error: "Missing token" }, { status: 400 });
  }

  const payload = verifyUnsubscribeToken(token);
  if (!payload) {
    return NextResponse.json({ error: "Invalid or expired token" }, { status: 400 });
  }

  const normalizedEmail = payload.email.toLowerCase().trim();

  await db.suppression.upsert({
    where: {
      orgId_email: {
        orgId: payload.orgId,
        email: normalizedEmail,
      },
    },
    create: {
      orgId: payload.orgId,
      email: normalizedEmail,
      reason: "unsubscribed",
    },
    update: {
      reason: "unsubscribed",
    },
  });

  return NextResponse.json({
    success: true,
    email: normalizedEmail,
  });
}
