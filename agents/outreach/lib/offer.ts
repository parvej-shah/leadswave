export type OfferCampaign = {
  offerText: string;
  websiteOffer?: string | null;
  crmOffer?: string | null;
};

export type ResolvedOffer = {
  offer: string;
  angle: string;
};

/**
 * Pick the right pitch for a lead based on its category:
 * - website_proposal (no website) → sell a website build
 * - crm (has website) → sell CRM
 * Falls back to the campaign's general offerText when a track-specific offer is unset.
 */
export function resolveOffer(
  category: string | null | undefined,
  campaign: OfferCampaign,
): ResolvedOffer {
  if (category === "website_proposal") {
    return {
      offer: campaign.websiteOffer?.trim() || campaign.offerText,
      angle:
        "This business has NO website. Pitch building them a professional website that brings in more customers — do not assume they already have one online.",
    };
  }
  if (category === "crm") {
    return {
      offer: campaign.crmOffer?.trim() || campaign.offerText,
      angle:
        "This business already has a website. Pitch our CRM to help them organize and convert more of the leads they're already getting.",
    };
  }
  return { offer: campaign.offerText, angle: "" };
}
