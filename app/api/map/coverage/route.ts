import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireOrg, tenantErrorResponse } from "@/lib/tenant";
import { getSystemSettings } from "@/lib/settings";
import { geocodeCached, haversineKm } from "@/lib/places/geocode";

const AREA_RADIUS_M = 4000;

type CoverageLead = {
  id: string;
  lat: number;
  lng: number;
  state: string;
  category: string | null;
  campaignId: string;
  companyName: string;
};

type CoverageArea = {
  label: string;
  city: string;
  lat: number;
  lng: number;
  radiusM: number;
  leadCount: number;
  campaignId: string;
  campaignName: string;
};

export async function GET(req: NextRequest) {
  let ctx;
  try {
    ctx = await requireOrg();
  } catch (e) {
    return tenantErrorResponse(e);
  }

  const { searchParams } = new URL(req.url);
  const businessTypeId = searchParams.get("businessTypeId") || undefined;
  // legacy string fallback for any caller still sending ?businessType=
  const businessType = searchParams.get("businessType") || undefined;
  const campaignId = searchParams.get("campaignId") || undefined;

  const campaigns = await db.campaign.findMany({
    where: {
      orgId: ctx.orgId,
      deletedAt: null,
      ...(campaignId ? { id: campaignId } : {}),
      ...(businessTypeId ? { businessTypeId } : businessType ? { businessType } : {}),
    },
    select: {
      id: true,
      name: true,
      businessType: true,
      selectedAreas: true,
    },
  });
  const campaignIds = campaigns.map((c) => c.id);

  const leadRows = campaignIds.length
    ? await db.lead.findMany({
        where: {
          orgId: ctx.orgId,
          deletedAt: null,
          campaignId: { in: campaignIds },
          latitude: { not: null },
          longitude: { not: null },
        },
        select: {
          id: true,
          latitude: true,
          longitude: true,
          state: true,
          category: true,
          campaignId: true,
          companyName: true,
        },
      })
    : [];

  const leads: CoverageLead[] = leadRows.map((l) => ({
    id: l.id,
    lat: l.latitude!,
    lng: l.longitude!,
    state: l.state,
    category: l.category,
    campaignId: l.campaignId,
    companyName: l.companyName,
  }));

  // Area circles: geocode each campaign's selectedAreas (GeoCache means each
  // area string only ever hits the Places API once), then approximate lead
  // count per area via haversine over the already-fetched lead set.
  const areas: CoverageArea[] = [];
  const settings = await getSystemSettings(ctx.orgId);
  if (settings.googleMapsApiKey) {
    for (const c of campaigns) {
      const selected = (c.selectedAreas ?? {}) as Record<string, string[]>;
      const campaignLeads = leads.filter((l) => l.campaignId === c.id);
      for (const [city, areaNames] of Object.entries(selected)) {
        for (const areaName of areaNames) {
          const query = `${areaName}, ${city}`;
          const loc = await geocodeCached(settings.googleMapsApiKey, query);
          if (!loc) continue;
          const leadCount = campaignLeads.filter(
            (l) => haversineKm(loc, { lat: l.lat, lng: l.lng }) <= AREA_RADIUS_M / 1000,
          ).length;
          areas.push({
            label: areaName,
            city,
            lat: loc.lat,
            lng: loc.lng,
            radiusM: AREA_RADIUS_M,
            leadCount,
            campaignId: c.id,
            campaignName: c.name,
          });
        }
      }
    }
  }

  const allCampaigns = await db.campaign.findMany({
    where: { orgId: ctx.orgId, deletedAt: null },
    select: { id: true, name: true, businessTypeId: true },
  });
  // Only surface types that actually have at least one campaign, so the filter
  // never lists a stale/empty type.
  const usedTypeIds = new Set(
    allCampaigns.map((c) => c.businessTypeId).filter((b): b is string => !!b),
  );
  const businessTypes = usedTypeIds.size
    ? await db.businessType.findMany({
        where: { orgId: ctx.orgId, id: { in: Array.from(usedTypeIds) } },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      })
    : [];

  const contactedStates = new Set(["contacted", "replied", "converted", "meeting_booked"]);
  const repliedStates = new Set(["replied", "converted", "meeting_booked"]);
  const contacted = leads.filter((l) => contactedStates.has(l.state)).length;
  const replied = leads.filter((l) => repliedStates.has(l.state)).length;
  const areasPlanned = areas.length;
  const areasCovered = areas.filter((a) => a.leadCount > 0).length;

  return NextResponse.json({
    leads,
    areas,
    filters: {
      businessTypes, // { id, name }[]
      campaigns: allCampaigns.map((c) => ({ id: c.id, name: c.name, businessTypeId: c.businessTypeId })),
    },
    stats: {
      leadsMapped: leads.length,
      contactedPct: leads.length ? Math.round((contacted / leads.length) * 100) : 0,
      replied,
      areasCovered,
      areasPlanned,
    },
  });
}
