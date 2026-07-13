import { db } from "../lib/db";
import { encryptSecret } from "../lib/crypto";

/**
 * One-shot: populate the owner's Settings API key fields from process.env,
 * encrypted the same way app/api/settings/route.ts PUT does. Idempotent —
 * only overwrites fields that have a non-empty env value.
 */
const OWNER_EMAIL = "parvejshahlabib007@gmail.com";

const ENV_TO_FIELD: Record<string, string> = {
  RESEND_API_KEY: "resendApiKey",
  FIRECRAWL_API_KEY: "firecrawlApiKey",
  ANTHROPIC_API_KEY: "anthropicApiKey",
  EMAIL_VERIFIER_API_KEY: "emailVerifierApiKey",
  ENRICHMENT_API_KEY: "enrichmentApiKey",
  APIFY_API_KEY: "apifyApiKey",
  GOOGLE_MAPS_API_KEY: "googleMapsApiKey",
};

async function main() {
  const user = await db.user.findUnique({ where: { email: OWNER_EMAIL } });
  if (!user) throw new Error(`No user found for ${OWNER_EMAIL}`);

  const membership = await db.membership.findFirst({ where: { userId: user.id } });
  if (!membership) throw new Error(`No membership/org found for ${OWNER_EMAIL}`);

  const data: Record<string, string> = {};
  for (const [envKey, field] of Object.entries(ENV_TO_FIELD)) {
    const value = process.env[envKey];
    if (value && value.trim() !== "") {
      data[field] = encryptSecret(value)!;
    }
  }

  if (Object.keys(data).length === 0) {
    console.log("[seed] No non-empty API keys found in env — nothing to do");
    return;
  }

  const settings = await db.settings.upsert({
    where: { orgId: membership.orgId },
    update: data,
    create: { orgId: membership.orgId, userId: user.id, ...data },
  });

  console.log("[seed] Seeded fields:", Object.keys(data).join(", "));
  console.log("[seed] Settings id:", settings.id, "orgId:", settings.orgId);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
