import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getSystemSettings } from "@/lib/settings";
import { parseSelectedAreas } from "@/agents/scout/lib/areas";

async function getUserId() {
  const session = await auth();
  return session?.user?.id ?? null;
}

export async function GET() {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const campaigns = await db.campaign.findMany({
    where: { deletedAt: null },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { leads: true } } },
  });

  return NextResponse.json(campaigns);
}

export async function POST(req: NextRequest) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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

  const settings = await getSystemSettings();

  const campaign = await db.campaign.create({
    data: {
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
    },
  });

  return NextResponse.json(campaign, { status: 201 });
}
