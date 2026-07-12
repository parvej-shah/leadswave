import { db } from "../lib/db";
import { encryptSecret } from "../lib/crypto";

/**
 * One-shot migration: encrypt existing plaintext secrets in Settings + User.
 * Idempotent — encryptSecret skips values already carrying the enc:v1: prefix.
 * Requires SETTINGS_ENCRYPTION_KEY in the environment.
 */
const SETTINGS_SECRET_FIELDS = [
  "resendApiKey", "firecrawlApiKey", "anthropicApiKey", "emailVerifierApiKey",
  "enrichmentApiKey", "apifyApiKey", "googleMapsApiKey", "googleClientSecret",
  "googleRefreshToken",
] as const;

async function main() {
  if (!process.env.SETTINGS_ENCRYPTION_KEY) {
    throw new Error("SETTINGS_ENCRYPTION_KEY not set — aborting (nothing would be encrypted)");
  }

  const settingsRows = await db.settings.findMany();
  let settingsUpdated = 0;
  for (const row of settingsRows) {
    const data: Record<string, string> = {};
    for (const field of SETTINGS_SECRET_FIELDS) {
      const value = row[field];
      if (value && !value.startsWith("enc:v1:")) {
        data[field] = encryptSecret(value)!;
      }
    }
    if (Object.keys(data).length > 0) {
      await db.settings.update({ where: { id: row.id }, data });
      settingsUpdated++;
    }
  }

  const users = await db.user.findMany({ where: { googleRefreshToken: { not: null } } });
  let usersUpdated = 0;
  for (const user of users) {
    if (user.googleRefreshToken && !user.googleRefreshToken.startsWith("enc:v1:")) {
      await db.user.update({
        where: { id: user.id },
        data: { googleRefreshToken: encryptSecret(user.googleRefreshToken)! },
      });
      usersUpdated++;
    }
  }

  console.log(`[encrypt-settings] settings rows updated: ${settingsUpdated}/${settingsRows.length}, users updated: ${usersUpdated}`);
}

main()
  .catch((e) => {
    console.error("[encrypt-settings] FAILED:", e?.message ?? e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
