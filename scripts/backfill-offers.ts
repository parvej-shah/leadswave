import { db } from "../lib/db";

/**
 * One-shot (idempotent): seed CampaignOffer rows from the legacy
 * websiteOffer/crmOffer columns. Keys reuse the legacy Lead.category literals
 * so existing leads keep routing without a rewrite.
 */
const WEBSITE_ANGLE =
  "This business has NO website — do not assume they have one online. What we can help with is building them a professional website that brings in more customers. (Background for a soft mention only, not a pitch.)";
const CRM_ANGLE =
  "This business already has a website. What we can help with is a CRM to organize and convert more of the leads they already get. (Background for a soft mention only, not a pitch.)";

async function main() {
  const campaigns = await db.campaign.findMany({
    include: { offers: { select: { key: true } } },
  });

  let seeded = 0;
  for (const c of campaigns) {
    const existing = new Set(c.offers.map((o) => o.key));
    const rows = [
      {
        key: "website_proposal",
        label: "Website",
        matchSignal: "no_website",
        offerText: c.websiteOffer?.trim() || c.offerText,
        angle: WEBSITE_ANGLE,
        order: 0,
      },
      {
        key: "crm",
        label: "CRM",
        matchSignal: "has_website",
        offerText: c.crmOffer?.trim() || c.offerText,
        angle: CRM_ANGLE,
        order: 1,
      },
    ].filter((r) => !existing.has(r.key) && r.offerText);

    if (rows.length) {
      await db.campaignOffer.createMany({
        data: rows.map((r) => ({ ...r, campaignId: c.id })),
      });
      seeded += rows.length;
    }
  }
  console.log(`[backfill-offers] campaigns: ${campaigns.length}, offers seeded: ${seeded}`);
}

main()
  .catch((e) => {
    console.error("[backfill-offers] FAILED:", e?.message ?? e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
