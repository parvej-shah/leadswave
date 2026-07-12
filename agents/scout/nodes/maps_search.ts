import { searchAllPlaces, searchAllPlacesNearby, PlaceLite } from "@/lib/places/client";
import { MapsScoutState, MapsLead } from "../maps-graph";
import { matchOfferKey } from "@/agents/outreach/lib/offer";

// Approximate degree offset for a ~10km quadrant radius from city centre.
// 0.09° ≈ 10km in latitude; longitude varies by latitude but 0.11° is close enough globally.
const QUADRANT_OFFSETS = [
  { lat: +0.09, lng: +0.11 }, // NE
  { lat: +0.09, lng: -0.11 }, // NW
  { lat: -0.09, lng: +0.11 }, // SE
  { lat: -0.09, lng: -0.11 }, // SW
];

// Geocode any place query to lat/lng using the Places API text search (first result's geometry).
async function geocodePlace(apiKey: string, textQuery: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": "places.location",
      },
      body: JSON.stringify({ textQuery, pageSize: 1 }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { places?: Array<{ location?: { latitude?: number; longitude?: number } }> };
    const loc = data.places?.[0]?.location;
    if (!loc?.latitude || !loc?.longitude) return null;
    return { lat: loc.latitude, lng: loc.longitude };
  } catch {
    return null;
  }
}

function geocodeCity(apiKey: string, city: string, country: string) {
  return geocodePlace(apiKey, `${city}, ${country}`);
}

function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

// A geocoded "area" further than this from the city centre is treated as a hallucinated
// or wrong-city name and skipped (large metros can legitimately span ~30-40km).
const MAX_AREA_DISTANCE_KM = 40;
const AREA_RADIUS_METERS = 4000;
// Cap query variants per area to bound API-call fan-out (leads are uncapped, calls are not).
const MAX_VARIANTS_PER_AREA = 3;

// Synonym map: keys are lowercased substrings to match against businessType.
// Values are the search query variants to run per city — more variants = more leads found.
const QUERY_SYNONYMS: Array<{ match: string[]; variants: string[] }> = [
  // Legal
  { match: ["law firm", "lawyer", "attorney", "legal", "barrister", "solicitor", "advocate"], variants: ["law firm", "legal services", "attorney office", "barrister chambers", "solicitor", "advocate office"] },
  // Medical & pharmacy
  { match: ["pharmacy", "chemist", "drug store", "dispensary", "medical shop", "drugstore"], variants: ["pharmacy", "chemist", "drug store", "dispensary", "medical store"] },
  { match: ["clinic", "hospital", "medical center", "doctor", "physician", "polyclinic"], variants: ["clinic", "hospital", "medical center", "doctor office", "polyclinic"] },
  { match: ["dentist", "dental", "orthodontist"], variants: ["dental clinic", "dentist", "orthodontist", "dental surgery"] },
  { match: ["optician", "optometrist", "eye care", "optical"], variants: ["optician", "optometrist", "optical shop", "eye clinic"] },
  // Marketing & advertising
  { match: ["marketing", "advertising", "digital agency", "seo", "creative agency", "media agency", "pr agency", "branding"], variants: ["marketing agency", "advertising agency", "digital marketing agency", "SEO agency", "creative agency", "branding agency"] },
  // Accounting & finance
  { match: ["accountant", "accounting", "cpa", "tax", "audit", "bookkeep", "chartered accountant", "ca firm"], variants: ["accounting firm", "chartered accountant", "tax consultant", "CPA firm", "audit firm", "bookkeeping service"] },
  { match: ["financial advisor", "wealth management", "investment", "stock broker", "financial planner"], variants: ["financial advisor", "wealth management firm", "investment company", "stock broker", "financial planning"] },
  { match: ["bank", "credit union", "microfinance", "ngo bank"], variants: ["bank", "credit union", "microfinance institution"] },
  // IT & software
  { match: ["software", "it company", "it firm", "tech company", "web design", "app development", "mobile app"], variants: ["software company", "IT services company", "web design agency", "app development company", "technology firm"] },
  { match: ["cybersecurity", "it security", "network security"], variants: ["cybersecurity firm", "IT security company", "network security"] },
  { match: ["data center", "cloud", "hosting"], variants: ["data center", "cloud services", "web hosting company"] },
  // Real estate
  { match: ["real estate", "property", "realtor", "estate agent", "property dealer", "housing"], variants: ["real estate agency", "property dealer", "estate agent", "housing company", "property management"] },
  // Food & beverage
  { match: ["restaurant", "cafe", "food", "diner", "bistro", "eatery"], variants: ["restaurant", "cafe", "diner", "eatery", "food court"] },
  { match: ["bakery", "patisserie", "bread", "pastry"], variants: ["bakery", "patisserie", "cake shop", "bread shop"] },
  { match: ["bar", "pub", "brewery", "nightclub", "lounge"], variants: ["bar", "pub", "brewery", "nightclub", "cocktail lounge"] },
  // Hospitality
  { match: ["hotel", "motel", "lodging", "accommodation", "resort", "guesthouse"], variants: ["hotel", "motel", "guesthouse", "inn", "resort", "accommodation"] },
  // Health & wellness
  { match: ["gym", "fitness", "crossfit", "weightlifting"], variants: ["gym", "fitness center", "CrossFit", "sports club", "health club"] },
  { match: ["yoga", "pilates", "meditation", "wellness"], variants: ["yoga studio", "pilates studio", "meditation center", "wellness center"] },
  { match: ["physiotherapy", "physical therapy", "rehab", "chiropractor"], variants: ["physiotherapy clinic", "physical therapy", "rehabilitation center", "chiropractor"] },
  // Beauty
  { match: ["salon", "beauty parlor", "hair salon", "hair studio"], variants: ["hair salon", "beauty parlor", "hair studio", "blow dry bar"] },
  { match: ["spa", "massage", "wellness spa", "nail"], variants: ["spa", "massage center", "nail salon", "day spa"] },
  { match: ["barber", "barbershop", "men's grooming"], variants: ["barbershop", "barber", "men's grooming salon"] },
  // Education
  { match: ["school", "primary school", "secondary school", "high school"], variants: ["school", "primary school", "secondary school", "high school"] },
  { match: ["college", "university", "higher education"], variants: ["college", "university", "higher education institution"] },
  { match: ["coaching", "tutor", "tutoring", "coaching center", "academy"], variants: ["coaching center", "tutoring center", "academy", "learning center"] },
  { match: ["kindergarten", "preschool", "daycare", "nursery"], variants: ["kindergarten", "preschool", "daycare center", "nursery"] },
  // Construction & trade
  { match: ["plumber", "plumbing"], variants: ["plumber", "plumbing company", "plumbing services"] },
  { match: ["electrician", "electrical"], variants: ["electrician", "electrical contractor", "electrical services"] },
  { match: ["contractor", "construction", "builder", "renovation", "remodeling"], variants: ["construction company", "general contractor", "builder", "renovation company"] },
  { match: ["architect", "architecture", "interior design"], variants: ["architecture firm", "architect", "interior design studio"] },
  // Automotive
  { match: ["car dealer", "auto dealer", "car showroom", "automobile"], variants: ["car dealership", "auto dealer", "car showroom", "automobile dealer"] },
  { match: ["auto repair", "car repair", "mechanic", "garage", "car service"], variants: ["auto repair shop", "car mechanic", "car service center", "auto garage"] },
  // Logistics & transport
  { match: ["logistics", "freight", "courier", "shipping", "transport"], variants: ["logistics company", "freight company", "courier service", "shipping company"] },
  { match: ["moving company", "removal", "relocation"], variants: ["moving company", "removal service", "relocation company"] },
  // Retail
  { match: ["retail store", "shop", "boutique", "outlet", "ecommerce", "e-commerce"], variants: ["retail store", "boutique", "outlet store", "shop"] },
  { match: ["supermarket", "grocery", "convenience store"], variants: ["supermarket", "grocery store", "convenience store"] },
  { match: ["clothing store", "apparel", "fashion"], variants: ["clothing store", "fashion boutique", "apparel store"] },
  // Travel & tourism
  { match: ["travel", "tour", "tourism", "travel agent", "tour operator"], variants: ["travel agency", "tour operator", "travel consultant", "tourism company"] },
  // Insurance
  { match: ["insurance", "insurer", "underwriter"], variants: ["insurance agency", "insurance broker", "insurance company", "insurance office"] },
  // Cleaning
  { match: ["cleaning", "janitorial", "maid service", "housekeeping"], variants: ["cleaning company", "janitorial service", "commercial cleaning", "maid service"] },
  // Security
  { match: ["security company", "security guard", "security services", "surveillance"], variants: ["security company", "security services", "guard service", "surveillance company"] },
  // Printing & media
  { match: ["printing", "print shop", "signage", "graphic design"], variants: ["printing company", "print shop", "signage company", "graphic design studio"] },
  // HR & recruitment
  { match: ["recruitment", "staffing", "hr agency", "headhunter", "manpower"], variants: ["recruitment agency", "staffing company", "HR consultancy", "manpower agency"] },
  // Consulting
  { match: ["consulting", "management consulting", "business consultant", "strategy"], variants: ["management consulting firm", "business consultancy", "strategy consulting", "consulting company"] },
  // NGO & nonprofit
  { match: ["ngo", "nonprofit", "charity", "foundation", "social enterprise"], variants: ["NGO", "nonprofit organization", "charity", "foundation"] },
  // Event & entertainment
  { match: ["event", "event planner", "event management", "wedding planner"], variants: ["event management company", "event planner", "wedding planner", "event organizer"] },
  { match: ["photography", "photographer", "photo studio", "videography"], variants: ["photography studio", "photographer", "videography company"] },
];

function getQueryVariants(businessType: string): string[] {
  const lower = businessType.toLowerCase();
  for (const { match, variants } of QUERY_SYNONYMS) {
    if (match.some((m) => lower.includes(m))) return variants;
  }
  // Generic fallback: original + "company" + "services" variants
  return [businessType, `${businessType} company`, `${businessType} services`];
}

// Search a city's selected hotspot areas: geocode each area, reject hallucinated/out-of-city
// names, then mine each valid area up to maxPerArea. Returns false when no area geocoded so
// the caller can fall back to the quadrant grid.
async function searchCityByAreas(opts: {
  state: MapsScoutState;
  city: string;
  areas: string[];
  centre: { lat: number; lng: number };
  variants: string[];
  byPlaceId: Map<string, PlaceLite>;
}): Promise<boolean> {
  const { state, city, areas, centre, variants, byPlaceId } = opts;
  const areaVariants = variants.slice(0, MAX_VARIANTS_PER_AREA);
  let anyAreaCovered = false;

  for (const area of areas) {
    const areaCentre = await geocodePlace(state.googleMapsApiKey, `${area}, ${city}, ${state.country}`);
    if (!areaCentre) {
      console.warn(`[maps-scout] area "${area}" (${city}) failed geocoding, skipping`);
      continue;
    }
    if (haversineKm(centre, areaCentre) > MAX_AREA_DISTANCE_KM) {
      console.warn(`[maps-scout] area "${area}" geocoded outside ${city}, skipping`);
      continue;
    }
    anyAreaCovered = true;

    let areaCount = 0;
    for (const variant of areaVariants) {
      if (areaCount >= state.maxPerArea) break;
      try {
        const found = await searchAllPlacesNearby({
          apiKey: state.googleMapsApiKey,
          textQuery: variant,
          lat: areaCentre.lat,
          lng: areaCentre.lng,
          radiusMeters: AREA_RADIUS_METERS,
          maxResults: state.maxPerArea - areaCount,
        });
        for (const p of found) {
          if (!byPlaceId.has(p.placeId)) {
            byPlaceId.set(p.placeId, p);
            areaCount++;
          }
        }
      } catch (err) {
        console.warn(`[maps-scout] area search failed for "${variant}" in ${area}, ${city}:`, err instanceof Error ? err.message : err);
      }
    }
  }

  return anyAreaCovered;
}

export async function mapsSearchNode(state: MapsScoutState): Promise<Partial<MapsScoutState>> {
  const byPlaceId = new Map<string, PlaceLite>();
  const variants = getQueryVariants(state.businessType);
  // Quadrant-fallback budget: variants × 4 quadrants each, capped at maxPerCity total per city
  const perQuery = Math.ceil(state.maxPerCity / (variants.length * QUADRANT_OFFSETS.length));

  for (const city of state.selectedCities) {
    // Geocode city centre — anchor for area sanity checks and quadrant offsets
    const centre = await geocodeCity(state.googleMapsApiKey, city, state.country);

    const areas = state.selectedAreas?.[city] ?? [];
    if (areas.length > 0 && centre) {
      const covered = await searchCityByAreas({ state, city, areas, centre, variants, byPlaceId });
      if (covered) continue;
      console.warn(`[maps-scout] no areas geocoded for ${city}, falling back to quadrant search`);
    }

    for (const variant of variants) {
      if (centre) {
        // Grid search: 4 quadrants around city centre for dense coverage
        for (const offset of QUADRANT_OFFSETS) {
          try {
            const found = await searchAllPlacesNearby({
              apiKey: state.googleMapsApiKey,
              textQuery: variant,
              lat: centre.lat + offset.lat,
              lng: centre.lng + offset.lng,
              radiusMeters: 12000,
              maxResults: perQuery,
            });
            for (const p of found) {
              if (!byPlaceId.has(p.placeId)) byPlaceId.set(p.placeId, p);
            }
          } catch (err) {
            console.warn(`[maps-scout] quadrant search failed for "${variant}" near ${city}:`, err instanceof Error ? err.message : err);
          }
        }
      } else {
        // Fallback: plain text search if geocoding fails
        const textQuery = `${variant} in ${city}, ${state.country}`;
        try {
          const found = await searchAllPlaces({
            apiKey: state.googleMapsApiKey,
            textQuery,
            maxResults: Math.ceil(state.maxPerCity / variants.length),
          });
          for (const p of found) {
            if (!byPlaceId.has(p.placeId)) byPlaceId.set(p.placeId, p);
          }
        } catch (err) {
          console.warn(`[maps-scout] text search failed for "${textQuery}":`, err instanceof Error ? err.message : err);
        }
      }
    }
  }

  const places = Array.from(byPlaceId.values());

  const leads: MapsLead[] = places.map((p) => ({
    companyName: p.name,
    website: p.website,
    email: null,
    description: null,
    category: matchOfferKey({ hasWebsite: !!p.website }, state.offers),
    address: p.address,
    phone: p.phone,
    rating: p.rating,
    mapsUrl: p.mapsUrl,
    placeId: p.placeId,
    score: 0,
  }));

  return { places, leads };
}
