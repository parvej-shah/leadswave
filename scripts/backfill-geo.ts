/**
 * One-time backfill: fetch coordinates for existing leads that have a placeId
 * but no latitude (scouted before places.location was in the field mask).
 *
 * Uses GET place details with fieldMask "location" — the location-only SKU,
 * effectively free at this volume. Idempotent: re-running only touches leads
 * still missing coordinates (deleted/expired places stay null and are logged).
 *
 * Run: npx tsx scripts/backfill-geo.ts [--dry-run]
 */
import { config } from "dotenv";
config({ path: ".env.local" }); // SETTINGS_ENCRYPTION_KEY lives here
config();
import { db } from "../lib/db";
import { getSystemSettings } from "../lib/settings";

const BATCH = 5;
const BATCH_DELAY_MS = 600;

async function fetchLocation(
  apiKey: string,
  placeId: string,
): Promise<{ lat: number; lng: number } | null> {
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(
      `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`,
      { headers: { "X-Goog-Api-Key": apiKey, "X-Goog-FieldMask": "location" } },
    );
    if (res.status === 429) {
      // Back off and retry — quota is per-minute, a short pause clears it.
      await new Promise((r) => setTimeout(r, 4000 * (attempt + 1)));
      continue;
    }
    if (!res.ok) return null;
    const data = (await res.json()) as { location?: { latitude?: number; longitude?: number } };
    if (typeof data.location?.latitude !== "number" || typeof data.location?.longitude !== "number")
      return null;
    return { lat: data.location.latitude, lng: data.location.longitude };
  }
  return null;
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");

  const leads = await db.lead.findMany({
    where: { placeId: { not: null }, latitude: null },
    select: { id: true, placeId: true, companyName: true, orgId: true },
    orderBy: { createdAt: "asc" },
  });
  console.log(`${leads.length} lead(s) need coordinates${dryRun ? " (dry run)" : ""}`);
  if (leads.length === 0) return;

  // Resolve each org's Maps key once (decrypted, env fallback for default org).
  const orgIds = Array.from(new Set(leads.map((l) => l.orgId)));
  const keys = new Map<string, string>();
  for (const orgId of orgIds) {
    const settings = await getSystemSettings(orgId);
    if (settings.googleMapsApiKey) keys.set(orgId, settings.googleMapsApiKey);
    else console.warn(`org ${orgId}: no Google Maps API key — its leads will be skipped`);
  }

  let done = 0;
  let failed = 0;
  let skipped = 0;

  for (let i = 0; i < leads.length; i += BATCH) {
    const batch = leads.slice(i, i + BATCH);
    await Promise.all(
      batch.map(async (lead) => {
        const apiKey = keys.get(lead.orgId);
        if (!apiKey) {
          skipped++;
          return;
        }
        const loc = await fetchLocation(apiKey, lead.placeId!);
        if (!loc) {
          failed++;
          console.warn(`  ✗ ${lead.companyName} (${lead.placeId}) — no location (place gone?)`);
          return;
        }
        if (!dryRun) {
          await db.lead.update({
            where: { id: lead.id },
            data: { latitude: loc.lat, longitude: loc.lng },
          });
        }
        done++;
      }),
    );
    console.log(`  ${Math.min(i + BATCH, leads.length)}/${leads.length} processed…`);
    if (i + BATCH < leads.length) await new Promise((r) => setTimeout(r, BATCH_DELAY_MS));
  }

  console.log(`Done: ${done} geocoded, ${failed} failed, ${skipped} skipped (no key).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
