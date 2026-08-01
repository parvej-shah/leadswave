export type CampaignOfferLike = {
  key: string;
  label?: string | null;
  matchSignal?: string | null;
  offerText: string;
  angle?: string | null;
  order?: number | null;
};

export type OfferCampaign = {
  offerText: string;
  websiteOffer?: string | null;
  crmOffer?: string | null;
  offers?: CampaignOfferLike[] | null;
};

export type ResolvedOffer = {
  offer: string;
  angle: string;
  label?: string;
};

// Legacy fixed-track angles — used only when a campaign has no CampaignOffer
// rows (pre-migration) for the two historical categories.
const LEGACY_ANGLES: Record<string, string> = {
  website_proposal:
    "This business has NO website — do not assume they have one online. What we can help with is building them a professional website that brings in more customers. (Background for a soft mention only, not a pitch.)",
  crm:
    "This business already has a website. What we can help with is a CRM to organize and convert more of the leads they already get. (Background for a soft mention only, not a pitch.)",
};

/**
 * Pick the right pitch for a lead. `category` holds a CampaignOffer key —
 * user-defined per campaign. Resolution order:
 * 1. campaign offer whose key matches the lead's category
 * 2. campaign's "always" offer
 * 3. legacy two-track columns (websiteOffer/crmOffer) for the historical keys
 * 4. the campaign-wide offerText
 */
export function resolveOffer(
  category: string | null | undefined,
  campaign: OfferCampaign,
): ResolvedOffer {
  const offers = (campaign.offers ?? [])
    .slice()
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  if (category) {
    const matched = offers.find((o) => o.key === category);
    if (matched?.offerText?.trim()) {
      return {
        offer: matched.offerText.trim(),
        angle: matched.angle?.trim() ?? "",
        label: matched.label ?? matched.key,
      };
    }
  }

  const always = offers.find((o) => (o.matchSignal ?? "always") === "always");
  if (always?.offerText?.trim()) {
    return {
      offer: always.offerText.trim(),
      angle: always.angle?.trim() ?? "",
      label: always.label ?? always.key,
    };
  }

  // Legacy fallbacks (campaigns without CampaignOffer rows)
  if (category === "website_proposal") {
    return {
      offer: campaign.websiteOffer?.trim() || campaign.offerText,
      angle: LEGACY_ANGLES.website_proposal,
    };
  }
  if (category === "crm") {
    return {
      offer: campaign.crmOffer?.trim() || campaign.offerText,
      angle: LEGACY_ANGLES.crm,
    };
  }
  return { offer: campaign.offerText, angle: "" };
}

export type LeadFacts = {
  hasWebsite: boolean;
  hasPhone?: boolean;
  rating?: number | null;
  hasMapsListing?: boolean;
};

/**
 * Assign an offer key to a scouted lead by evaluating each offer's matchSignal
 * (in order) against lead facts. Falls back to the legacy website-based split
 * when the campaign has no offers.
 */
export function matchOfferKey(
  facts: LeadFacts,
  offers: CampaignOfferLike[] | null | undefined,
): string {
  const sorted = (offers ?? []).slice().sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  for (const o of sorted) {
    const signal = o.matchSignal ?? "always";
    const hasPhone = !!facts.hasPhone;
    const rating = facts.rating ?? null;
    const hasMaps = !!facts.hasMapsListing;

    if (
      signal === "always" ||
      (signal === "has_website" && facts.hasWebsite) ||
      (signal === "no_website" && !facts.hasWebsite) ||
      (signal === "has_phone" && hasPhone) ||
      (signal === "no_phone" && !hasPhone) ||
      (signal === "low_rating" && rating !== null && rating < 4.0) ||
      (signal === "no_rating" && rating === null) ||
      (signal === "no_maps_listing" && !hasMaps)
    ) {
      return o.key;
    }
  }
  return facts.hasWebsite ? "crm" : "website_proposal";
}
