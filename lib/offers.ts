export type OfferInput = {
  key?: string;
  label?: string;
  matchSignal?: string;
  offerText?: string;
  angle?: string;
};

export type NormalizedOffer = {
  key: string;
  label: string;
  matchSignal: string;
  offerText: string;
  angle: string | null;
  order: number;
};

const VALID_SIGNALS = new Set(["has_website", "no_website", "always"]);

export function slugifyOfferKey(label: string): string {
  return (
    label
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 40) || "offer"
  );
}

/**
 * Validate + normalize user-submitted offers for a campaign. Falls back to
 * seeding from the legacy two-track fields when no offers array is sent
 * (older clients / the CSV-import path).
 */
export function normalizeOffers(
  offers: OfferInput[] | undefined,
  legacy: { websiteOffer?: string | null; crmOffer?: string | null },
): NormalizedOffer[] {
  if (Array.isArray(offers)) {
    const seen = new Set<string>();
    const out: NormalizedOffer[] = [];
    for (const [i, o] of offers.entries()) {
      const label = o.label?.trim();
      const offerText = o.offerText?.trim();
      if (!label || !offerText) continue;
      let key = (o.key?.trim() || slugifyOfferKey(label)).slice(0, 40);
      while (seen.has(key)) key = `${key}_${i}`;
      seen.add(key);
      out.push({
        key,
        label,
        matchSignal: VALID_SIGNALS.has(o.matchSignal ?? "") ? (o.matchSignal as string) : "always",
        offerText,
        angle: o.angle?.trim() || null,
        order: i,
      });
    }
    return out;
  }

  // Legacy clients: map the two fixed tracks onto offers (same keys the
  // backfill used, so lead categories keep resolving).
  const out: NormalizedOffer[] = [];
  if (legacy.websiteOffer?.trim()) {
    out.push({
      key: "website_proposal",
      label: "Website",
      matchSignal: "no_website",
      offerText: legacy.websiteOffer.trim(),
      angle: null,
      order: 0,
    });
  }
  if (legacy.crmOffer?.trim()) {
    out.push({
      key: "crm",
      label: "CRM",
      matchSignal: "has_website",
      offerText: legacy.crmOffer.trim(),
      angle: null,
      order: 1,
    });
  }
  return out;
}
