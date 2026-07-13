import { db } from "@/lib/db";

/**
 * Pick-or-create a BusinessType for an org by name. Returns null for blank
 * input. Upserts on the [orgId, name] unique so the same spelling always maps
 * to one row — this is what lets the coverage map roll every "Dentists"
 * campaign into a single picture regardless of how many locations it spans.
 */
export async function resolveBusinessType(orgId: string, name: string | null | undefined) {
  const trimmed = (name ?? "").trim();
  if (!trimmed) return null;
  return db.businessType.upsert({
    where: { orgId_name: { orgId, name: trimmed } },
    update: {},
    create: { orgId, name: trimmed },
  });
}

/**
 * Offer inheritance: a campaign's own offerText wins; if blank, fall back to
 * the business type's defaultOffer, then the org-level settings offer.
 */
export function resolveOfferText(opts: {
  campaignOffer?: string | null;
  typeDefaultOffer?: string | null;
  settingsOffer?: string | null;
}): string {
  return (
    opts.campaignOffer?.trim() ||
    opts.typeDefaultOffer?.trim() ||
    opts.settingsOffer?.trim() ||
    ""
  );
}
