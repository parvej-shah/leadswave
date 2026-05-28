import { searchAllPlaces, PlaceLite } from "@/lib/places/client";
import { MapsScoutState, MapsLead } from "../maps-graph";

export async function mapsSearchNode(state: MapsScoutState): Promise<Partial<MapsScoutState>> {
  const byPlaceId = new Map<string, PlaceLite>();

  for (const city of state.selectedCities) {
    const textQuery = `${state.businessType} in ${city}, ${state.country}`;
    try {
      const found = await searchAllPlaces({
        apiKey: state.googleMapsApiKey,
        textQuery,
        maxResults: state.maxPerCity,
      });
      for (const p of found) {
        if (!byPlaceId.has(p.placeId)) byPlaceId.set(p.placeId, p);
      }
    } catch (err) {
      console.warn(`[maps-scout] search failed for "${textQuery}":`, err instanceof Error ? err.message : err);
    }
  }

  const places = Array.from(byPlaceId.values());

  const leads: MapsLead[] = places.map((p) => ({
    companyName: p.name,
    website: p.website,
    email: null,
    description: null,
    category: p.website ? "crm" : "website_proposal",
    address: p.address,
    phone: p.phone,
    rating: p.rating,
    mapsUrl: p.mapsUrl,
    placeId: p.placeId,
  }));

  return { places, leads };
}
