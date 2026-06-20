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
        "This business has NO website — do not assume they have one online. What we can help with is building them a professional website that brings in more customers. (Background for a soft mention only, not a pitch.)",
    };
  }
  if (category === "crm") {
    return {
      offer: campaign.crmOffer?.trim() || campaign.offerText,
      angle:
        "This business already has a website. What we can help with is a CRM to organize and convert more of the leads they already get. (Background for a soft mention only, not a pitch.)",
    };
  }
  return { offer: campaign.offerText, angle: "" };
}
