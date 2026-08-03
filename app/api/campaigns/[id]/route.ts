import { NextRequest, NextResponse } from "next/server";
import { requireOrg, tenantErrorResponse } from "@/lib/tenant";
import { db } from "@/lib/db";
import { parseSelectedAreas, SelectedAreas } from "@/agents/scout/lib/areas";
import { normalizeOffers, type OfferInput } from "@/lib/offers";
import { resolveBusinessType } from "@/lib/business-types";

export async function GET(_req: NextRequest, ctx: RouteContext<"/api/campaigns/[id]">) {
  let org;
  try {
    org = await requireOrg();
  } catch (e) {
    return tenantErrorResponse(e);
  }

  const { id } = await ctx.params;
  const campaign = await db.campaign.findFirst({
    where: { id, orgId: org.orgId, deletedAt: null },
    include: { offers: { orderBy: { order: "asc" } } },
  });

  if (!campaign) return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  return NextResponse.json(campaign);
}

export async function PATCH(req: NextRequest, ctx: RouteContext<"/api/campaigns/[id]">) {
  let org;
  try {
    org = await requireOrg();
  } catch (e) {
    return tenantErrorResponse(e);
  }

  const { id } = await ctx.params;
  const body = await req.json();
  const { name, query, location, offerText, websiteOffer, crmOffer, status, businessType, country, autoSend, selectedCities, selectedAreas, offers, scoutDepth, followupOffsets, sendDays, sendWindowStart, sendWindowEnd, timezone, sequenceSteps } = body as {
    name?: string;
    query?: string;
    location?: string;
    offerText?: string;
    websiteOffer?: string;
    crmOffer?: string;
    status?: string;
    businessType?: string;
    country?: string;
    autoSend?: boolean;
    selectedCities?: string[];
    selectedAreas?: Record<string, string[]>;
    offers?: OfferInput[];
    scoutDepth?: string;
    followupOffsets?: number[];
    sendDays?: number[];
    sendWindowStart?: string;
    sendWindowEnd?: string;
    timezone?: string;
    sequenceSteps?: unknown;
  };

  const existing = await db.campaign.findFirst({
    where: { id, orgId: org.orgId, deletedAt: null },
    select: { id: true },
  });
  if (!existing) return NextResponse.json({ error: "Campaign not found" }, { status: 404 });

  const data: {
    name?: string;
    query?: string;
    location?: string;
    offerText?: string;
    websiteOffer?: string;
    crmOffer?: string;
    status?: string;
    businessType?: string;
    country?: string;
    autoSend?: boolean;
    selectedCities?: string[];
    selectedAreas?: SelectedAreas;
    scoutDepth?: string;
    followupOffsets?: number[];
    sendDays?: number[];
    sendWindowStart?: string;
    sendWindowEnd?: string;
    timezone?: string;
    sequenceSteps?: any;
    businessTypeId?: string | null;
  } = {};

  if (typeof name === "string") data.name = name.trim();
  if (typeof query === "string") data.query = query.trim();
  if (typeof location === "string") data.location = location.trim();
  if (typeof offerText === "string") data.offerText = offerText.trim();
  if (typeof websiteOffer === "string") data.websiteOffer = websiteOffer.trim();
  if (typeof crmOffer === "string") data.crmOffer = crmOffer.trim();
  if (typeof businessType === "string") {
    data.businessType = businessType.trim();
    const type = await resolveBusinessType(org.orgId, businessType);
    data.businessTypeId = type?.id ?? null;
  }
  if (typeof country === "string") data.country = country.trim();
  if (typeof status === "string" && ["active", "paused", "completed"].includes(status)) {
    data.status = status;
  }
  if (typeof autoSend === "boolean") data.autoSend = autoSend;
  if (typeof scoutDepth === "string" && ["light", "normal", "deep"].includes(scoutDepth)) {
    data.scoutDepth = scoutDepth;
  }
  if (typeof timezone === "string") data.timezone = timezone.trim();
  if (sequenceSteps !== undefined) data.sequenceSteps = sequenceSteps;
  if (Array.isArray(followupOffsets)) {
    // Sanitized again at schedule time; basic bounds here (1-30 days, max 3 steps)
    data.followupOffsets = followupOffsets
      .filter((n) => Number.isFinite(n) && n >= 2 && n <= 30)
      .map((n) => Math.round(n))
      .slice(0, 3);
  }
  if (Array.isArray(sendDays)) {
    data.sendDays = sendDays.filter((n) => Number.isInteger(n) && n >= 1 && n <= 7);
  }
  if (typeof sendWindowStart === "string" && /^\d{2}:\d{2}$/.test(sendWindowStart)) {
    data.sendWindowStart = sendWindowStart;
  }
  if (typeof sendWindowEnd === "string" && /^\d{2}:\d{2}$/.test(sendWindowEnd)) {
    data.sendWindowEnd = sendWindowEnd;
  }
  if (Array.isArray(selectedCities)) {
    data.selectedCities = selectedCities.filter((c) => typeof c === "string" && c.trim());
  }
  if (selectedAreas !== undefined) data.selectedAreas = parseSelectedAreas(selectedAreas);

  if ((data.name !== undefined && !data.name) || (data.query !== undefined && !data.query) || (data.location !== undefined && !data.location)) {
    return NextResponse.json(
      { error: "name, query, and location cannot be empty" },
      { status: 400 }
    );
  }

  // Offers: full replacement when the client sends the array. Lead.category
  // keeps pointing at offer keys; unchanged keys keep routing.
  if (Array.isArray(offers)) {
    const normalized = normalizeOffers(offers, {});
    await db.$transaction([
      db.campaignOffer.deleteMany({ where: { campaignId: id } }),
      ...(normalized.length
        ? [db.campaignOffer.createMany({ data: normalized.map((o) => ({ ...o, campaignId: id })) })]
        : []),
    ]);
  }

  const campaign = await db.campaign.update({
    where: { id },
    data,
    include: { offers: { orderBy: { order: "asc" } } },
  });

  return NextResponse.json(campaign);
}
