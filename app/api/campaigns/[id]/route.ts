import { NextRequest, NextResponse } from "next/server";
import { requireOrg, tenantErrorResponse } from "@/lib/tenant";
import { db } from "@/lib/db";
import { parseSelectedAreas, SelectedAreas } from "@/agents/scout/lib/areas";

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
  const { name, query, location, offerText, websiteOffer, crmOffer, status, businessType, country, autoSend, selectedCities, selectedAreas } = body as {
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
  } = {};

  if (typeof name === "string") data.name = name.trim();
  if (typeof query === "string") data.query = query.trim();
  if (typeof location === "string") data.location = location.trim();
  if (typeof offerText === "string") data.offerText = offerText.trim();
  if (typeof websiteOffer === "string") data.websiteOffer = websiteOffer.trim();
  if (typeof crmOffer === "string") data.crmOffer = crmOffer.trim();
  if (typeof businessType === "string") data.businessType = businessType.trim();
  if (typeof country === "string") data.country = country.trim();
  if (typeof status === "string" && ["active", "paused", "completed"].includes(status)) {
    data.status = status;
  }
  if (typeof autoSend === "boolean") data.autoSend = autoSend;
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

  const campaign = await db.campaign.update({
    where: { id },
    data,
  });

  return NextResponse.json(campaign);
}
