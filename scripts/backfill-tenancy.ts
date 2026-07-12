import { db } from "../lib/db";

/**
 * One-shot tenancy backfill (Stage A1). Idempotent — safe to re-run.
 *
 * Creates the default Organization + owner User (parvejshahlabib007@gmail.com)
 * and attaches ALL existing campaigns/leads/suppressions plus the canonical
 * Settings row to that org. The 5 stale duplicate Settings rows (created by
 * the old auth updateMany/create fallback) are left with orgId NULL and get
 * cleaned up in A9 after verification.
 */
const OWNER_EMAIL = "parvejshahlabib007@gmail.com";

async function main() {
  // Canonical settings row = the one the app's findFirst() has been reading
  // (oldest by cuid). All rows carry the same refresh token via the old
  // updateMany, so token freshness is equal across them.
  const canonical = await db.settings.findFirst({ orderBy: { id: "asc" } });
  if (!canonical) throw new Error("No settings row found — nothing to backfill");

  const org =
    (await db.organization.findFirst({ where: { name: "XpeedLab" } })) ??
    (await db.organization.create({ data: { name: "XpeedLab" } }));
  console.log("[backfill] org:", org.id);

  const user = await db.user.upsert({
    where: { email: OWNER_EMAIL },
    update: { googleRefreshToken: canonical.googleRefreshToken },
    create: {
      email: OWNER_EMAIL,
      name: canonical.fromName,
      googleRefreshToken: canonical.googleRefreshToken,
    },
  });
  console.log("[backfill] user:", user.id);

  await db.membership.upsert({
    where: { userId_orgId: { userId: user.id, orgId: org.id } },
    update: { role: "owner" },
    create: { userId: user.id, orgId: org.id, role: "owner" },
  });

  // Raw SQL: orgId is non-nullable in the Prisma schema post-A9, but this
  // script must stay runnable against a half-migrated database.
  const campaigns = await db.$executeRawUnsafe(
    `UPDATE "Campaign" SET "orgId" = $1 WHERE "orgId" IS NULL`, org.id);
  const leads = await db.$executeRawUnsafe(
    `UPDATE "Lead" SET "orgId" = $1 WHERE "orgId" IS NULL`, org.id);
  const suppressions = await db.$executeRawUnsafe(
    `UPDATE "Suppression" SET "orgId" = $1 WHERE "orgId" IS NULL`, org.id);
  await db.$executeRawUnsafe(
    `UPDATE "Settings" SET "orgId" = $1 WHERE id = $2 AND "orgId" IS NULL`, org.id, canonical.id);
  console.log(`[backfill] scoped — campaigns: ${campaigns}, leads: ${leads}, suppressions: ${suppressions}`);
  console.log("[backfill] done.");
}

main()
  .catch((e) => {
    console.error("[backfill] FAILED:", e?.message ?? e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
