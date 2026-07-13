const SEARCH_TEXT_URL = "https://places.googleapis.com/v1/places:searchText";

const FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.websiteUri",
  "places.formattedAddress",
  "places.internationalPhoneNumber",
  "places.rating",
  "places.googleMapsUri",
  "places.location",
  "nextPageToken",
].join(",");

export type PlaceLite = {
  placeId: string;
  name: string;
  website: string | null;
  address: string | null;
  phone: string | null;
  rating: number | null;
  mapsUrl: string | null;
  lat: number | null;
  lng: number | null;
};

type RawPlace = {
  id?: string;
  displayName?: { text?: string };
  websiteUri?: string;
  formattedAddress?: string;
  internationalPhoneNumber?: string;
  rating?: number;
  googleMapsUri?: string;
  location?: { latitude?: number; longitude?: number };
};

function toPlaceLite(p: RawPlace): PlaceLite | null {
  if (!p.id) return null;
  return {
    placeId: p.id,
    name: p.displayName?.text ?? p.id,
    website: p.websiteUri ?? null,
    address: p.formattedAddress ?? null,
    phone: p.internationalPhoneNumber ?? null,
    rating: typeof p.rating === "number" ? p.rating : null,
    mapsUrl: p.googleMapsUri ?? null,
    lat: typeof p.location?.latitude === "number" ? p.location.latitude : null,
    lng: typeof p.location?.longitude === "number" ? p.location.longitude : null,
  };
}

export async function searchPlaces(opts: {
  apiKey: string;
  textQuery: string;
  maxResults?: number;
  pageToken?: string;
}): Promise<{ places: PlaceLite[]; nextPageToken?: string }> {
  const pageSize = Math.min(opts.maxResults ?? 20, 20);

  const res = await fetch(SEARCH_TEXT_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": opts.apiKey,
      "X-Goog-FieldMask": FIELD_MASK,
    },
    body: JSON.stringify({
      textQuery: opts.textQuery,
      pageSize,
      ...(opts.pageToken ? { pageToken: opts.pageToken } : {}),
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Places searchText failed (${res.status}): ${detail.slice(0, 300)}`);
  }

  const data = (await res.json()) as { places?: RawPlace[]; nextPageToken?: string };
  const places = (data.places ?? [])
    .map(toPlaceLite)
    .filter((p): p is PlaceLite => p !== null);

  return { places, nextPageToken: data.nextPageToken };
}

/**
 * Search every page up to `maxResults` total, deduped by placeId.
 * Caps at 5 pages (100 results) to bound API cost.
 */
export async function searchAllPlaces(opts: {
  apiKey: string;
  textQuery: string;
  maxResults?: number;
}): Promise<PlaceLite[]> {
  const cap = Math.min(opts.maxResults ?? 60, 100);
  const seen = new Map<string, PlaceLite>();
  let pageToken: string | undefined;

  for (let page = 0; page < 5; page++) {
    const { places, nextPageToken } = await searchPlaces({
      apiKey: opts.apiKey,
      textQuery: opts.textQuery,
      maxResults: 20,
      pageToken,
    });
    for (const p of places) {
      if (!seen.has(p.placeId)) seen.set(p.placeId, p);
      if (seen.size >= cap) return Array.from(seen.values());
    }
    if (!nextPageToken) break;
    pageToken = nextPageToken;
  }

  return Array.from(seen.values());
}

/**
 * Search near a lat/lng point within a radius using locationBias.
 * Used for grid/quadrant searches to cover dense cities more thoroughly.
 */
export async function searchAllPlacesNearby(opts: {
  apiKey: string;
  textQuery: string;
  lat: number;
  lng: number;
  radiusMeters: number;
  maxResults?: number;
}): Promise<PlaceLite[]> {
  const cap = Math.min(opts.maxResults ?? 20, 100);
  const seen = new Map<string, PlaceLite>();
  let pageToken: string | undefined;

  for (let page = 0; page < 5; page++) {
    const pageSize = Math.min(20, cap - seen.size);
    const res = await fetch(SEARCH_TEXT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": opts.apiKey,
        "X-Goog-FieldMask": FIELD_MASK,
      },
      body: JSON.stringify({
        textQuery: opts.textQuery,
        pageSize,
        locationBias: {
          circle: {
            center: { latitude: opts.lat, longitude: opts.lng },
            radius: opts.radiusMeters,
          },
        },
        ...(pageToken ? { pageToken } : {}),
      }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(`Places nearby search failed (${res.status}): ${detail.slice(0, 300)}`);
    }

    const data = (await res.json()) as { places?: RawPlace[]; nextPageToken?: string };
    for (const raw of data.places ?? []) {
      const p = toPlaceLite(raw);
      if (p && !seen.has(p.placeId)) seen.set(p.placeId, p);
      if (seen.size >= cap) return Array.from(seen.values());
    }
    if (!data.nextPageToken) break;
    pageToken = data.nextPageToken;
  }

  return Array.from(seen.values());
}
