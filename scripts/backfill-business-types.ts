/**
 * One-time backfill: normalize the free-text Campaign.businessType column into
 * BusinessType rows and link each campaign via businessTypeId.
 *
 * For each org, reads distinct non-null businessType strings, upserts a
 * BusinessType per distinct value, and sets each campaign's businessTypeId.
 * Campaigns with a null businessType stay unlinked. Idempotent — re-running
 * only touches campaigns still missing businessTypeId.
 *
 * Run: npx tsx scripts/backfill-business-types.ts [--dry-run]
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config();
import { db } from "../lib/db";

const dryRun = process.argv.includes("--dry-run");

async function main() {
  const campaigns = await db.campaign.findMany({
    where: { businessType: { not: null }, businessTypeId: null, deletedAt: null },
    select: { id: true, orgId: true, businessType: true },
  });

  if (campaigns.length === 0) {
    console.log("Nothing to backfill — every campaign with a businessType is already linked.");
    return;
  }

  // Group distinct (orgId, businessType) so each type is upserted once.
  const typeKey = (orgId: string, name: string) => `${orgId}::${name}`;
  const typeCache = new Map<string, string>(); // key -> businessTypeId
  let created = 0;
  let linked = 0;

  for (const c of campaigns) {
    const name = c.businessType!.trim();
    if (!name) continue;
    const key = typeKey(c.orgId, name);

    let typeId = typeCache.get(key);
    if (!typeId) {
      if (dryRun) {
        typeId = `dry-${key}`;
        console.log(`[dry] would upsert BusinessType (org=${c.orgId}) "${name}"`);
      } else {
        const type = await db.businessType.upsert({
          where: { orgId_name: { orgId: c.orgId, name } },
          update: {},
          create: { orgId: c.orgId, name },
        });
        typeId = type.id;
        created++;
      }
      typeCache.set(key, typeId);
    }

    if (dryRun) {
      console.log(`[dry] would link campaign ${c.id} -> "${name}"`);
    } else {
      await db.campaign.update({ where: { id: c.id }, data: { businessTypeId: typeId } });
      linked++;
    }
  }

  console.log(
    dryRun
      ? `Dry run: ${typeCache.size} distinct types across ${campaigns.length} campaigns.`
      : `Done. Upserted ${created} BusinessType rows, linked ${linked} campaigns.`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
