import { db } from "@/lib/db";
import { reservePlacesCall, QuotaExceededError } from "./quota";

/**
 * Geocode any place query to lat/lng using the Places API text search
 * (location-only field mask = cheapest SKU, first result's geometry).
 */
export async function geocodePlace(
  apiKey: string,
  textQuery: string,
): Promise<{ lat: number; lng: number } | null> {
  // Outside the try: a tripped circuit breaker must propagate, not be swallowed
  // into a `null` that callers mistake for "this place wasn't found" and loop past.
  await reservePlacesCall();
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
    const data = (await res.json()) as {
      places?: Array<{ location?: { latitude?: number; longitude?: number } }>;
    };
    const loc = data.places?.[0]?.location;
    if (!loc?.latitude || !loc?.longitude) return null;
    return { lat: loc.latitude, lng: loc.longitude };
  } catch (e) {
    if (e instanceof QuotaExceededError) throw e;
    return null;
  }
}

/**
 * GeoCache-backed geocode: each query string hits the Places API exactly once
 * ever; later callers read the cached coordinates.
 */
export async function geocodeCached(
  apiKey: string,
  textQuery: string,
): Promise<{ lat: number; lng: number } | null> {
  const query = textQuery.trim().toLowerCase();
  if (!query) return null;

  const cached = await db.geoCache.findUnique({ where: { query } });
  if (cached) return { lat: cached.lat, lng: cached.lng };

  const result = await geocodePlace(apiKey, textQuery);
  if (!result) return null;

  // Concurrent geocodes of the same query can race — the unique constraint
  // makes the second insert a no-op.
  await db.geoCache
    .create({ data: { query, lat: result.lat, lng: result.lng } })
    .catch(() => {});
  return result;
}

export function haversineKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}
