import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSystemSettings } from "@/lib/settings";
import { requireOrg, tenantErrorResponse } from "@/lib/tenant";
import { parseSelectedAreas } from "@/agents/scout/lib/areas";
import { normalizeOffers, type OfferInput } from "@/lib/offers";

export async function GET() {
  let ctx;
  try {
    ctx = await requireOrg();
  } catch (e) {
    return tenantErrorResponse(e);
  }

  const campaigns = await db.campaign.findMany({
    where: { orgId: ctx.orgId, deletedAt: null },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { leads: true } } },
  });

  return NextResponse.json(campaigns);
}

export async function POST(req: NextRequest) {
  let ctx;
  try {
    ctx = await requireOrg();
  } catch (e) {
    return tenantErrorResponse(e);
  }

  const body = await req.json();
  const {
    name,
    query,
    location,
    offerText,
    businessType,
    country,
    selectedCities,
    selectedAreas,
    websiteOffer,
    crmOffer,
    offers,
    scoutDepth,
  } = body as {
    name?: string;
    query?: string;
    location?: string;
    offerText?: string;
    businessType?: string;
    country?: string;
    selectedCities?: string[];
    selectedAreas?: Record<string, string[]>;
    websiteOffer?: string;
    crmOffer?: string;
    offers?: OfferInput[];
    scoutDepth?: string;
  };

  const cities = Array.isArray(selectedCities) ? selectedCities.filter((c) => typeof c === "string" && c.trim()) : [];
  const parsedAreas = parseSelectedAreas(selectedAreas);
  const areas = Object.fromEntries(Object.entries(parsedAreas).filter(([city]) => cities.includes(city)));
  const resolvedQuery = (businessType || query || "").trim();
  const resolvedLocation = (location || cities.join(", ") || country || "").trim();

  if (!name || !resolvedQuery || !resolvedLocation) {
    return NextResponse.json(
      { error: "name, business type, and at least one location are required" },
      { status: 400 }
    );
  }

  const settings = await getSystemSettings(ctx.orgId);
  const normalizedOffers = normalizeOffers(offers, { websiteOffer, crmOffer });

  const campaign = await db.campaign.create({
    data: {
      orgId: ctx.orgId,
      name,
      query: resolvedQuery,
      location: resolvedLocation,
      offerText: offerText || settings?.offerText || "",
      businessType: businessType || null,
      country: country || null,
      selectedCities: cities,
      selectedAreas: Object.keys(areas).length > 0 ? areas : undefined,
      websiteOffer: websiteOffer || null,
      crmOffer: crmOffer || null,
      status: "active",
      ...(["light", "normal", "deep"].includes(scoutDepth ?? "") ? { scoutDepth } : {}),
      ...(normalizedOffers.length > 0 ? { offers: { create: normalizedOffers } } : {}),
    },
    include: { offers: true },
  });

  return NextResponse.json(campaign, { status: 201 });
}
