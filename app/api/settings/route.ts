import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSystemSettings } from "@/lib/settings";
import { requireOrg, requireRole, tenantErrorResponse } from "@/lib/tenant";
import { sanitizeRichText, htmlToPlainText } from "@/lib/html/sanitize";
import { encryptSecret, maskSecret, isMaskedSecret } from "@/lib/crypto";

// Columns holding secrets: masked on GET, encrypted at rest on PUT.
// googleClientId stays readable — it's public in OAuth flows and the UI needs it.
const SECRET_FIELDS = [
  "resendApiKey", "firecrawlApiKey", "anthropicApiKey", "emailVerifierApiKey",
  "enrichmentApiKey", "apifyApiKey", "googleMapsApiKey", "googleClientSecret",
  "googleRefreshToken", "ghlApiKey",
] as const;

export async function GET() {
  let ctx;
  try {
    ctx = await requireOrg();
  } catch (e) {
    return tenantErrorResponse(e);
  }

  const settings = await getSystemSettings(ctx.orgId);
  const masked: Record<string, unknown> = { ...settings };
  for (const key of SECRET_FIELDS) {
    masked[key] = maskSecret(settings[key] as string | null);
  }
  // Gemini keys are process-env only (round-robin pool, not per-org) — expose
  // configured status so the UI can show it without a settable field.
  masked.geminiConfigured = Boolean(
    process.env.GEMINI_API_KEYS?.trim() || process.env.GEMINI_API_KEY?.trim()
  );
  return NextResponse.json(masked);
}

export async function PUT(request: NextRequest) {
  let ctx;
  try {
    ctx = await requireOrg();
    requireRole(ctx, "admin"); // settings (incl. API keys) are admin+ only
  } catch (e) {
    return tenantErrorResponse(e);
  }

  const body = await request.json();
  const allowed = [
    "offerText", "fromEmail", "fromName", "signatureHtml", "telegramChatId",
    "resendApiKey", "firecrawlApiKey", "anthropicApiKey", "emailVerifierApiKey",
    "enrichmentProvider", "enrichmentApiKey", "apifyApiKey", "googleMapsApiKey",
    "calendarId", "dailySendLimit", "perCampaignDailyLimit", "sendThrottleSeconds",
    "autoSendReplies", "googleClientId", "googleClientSecret", "googleRefreshToken",
    "notifyHotOnly", "notifyEmailDigest", "ghlApiKey", "ghlLocationId", "ghlPipelineId",
  ] as const;

  const data: Record<string, any> = {};
  for (const key of allowed) {
    if (key in body) data[key] = body[key];
  }

  // Secret handling: a masked value means "unchanged" (the GET response echoes
  // masks back on full-form saves) — drop it. Anything else gets encrypted.
  for (const key of SECRET_FIELDS) {
    if (!(key in data)) continue;
    if (isMaskedSecret(data[key])) {
      delete data[key];
    } else if (typeof data[key] === "string" && data[key] !== "") {
      data[key] = encryptSecret(data[key]);
    }
  }

  // Signature is user-authored HTML — sanitize at this write boundary and derive
  // the plain-text fallback so the client viewer can trust stored HTML.
  if ("signatureHtml" in data) {
    const clean = sanitizeRichText(data.signatureHtml);
    data.signatureHtml = clean;
    data.signatureText = htmlToPlainText(clean);
  }

  const settings = await db.settings.upsert({
    where: { orgId: ctx.orgId },
    update: data,
    create: { orgId: ctx.orgId, userId: ctx.userId, ...data },
  });

  return NextResponse.json(settings);
}
