// Selected hotspot areas per city: { [city]: ["Area 1", "Area 2", ...] }
export type SelectedAreas = Record<string, string[]>;

// Parse the Campaign.selectedAreas Json column (or a request-body override) into a
// clean SelectedAreas map. Anything malformed is dropped; null/undefined → {}.
export function parseSelectedAreas(value: unknown): SelectedAreas {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out: SelectedAreas = {};
  for (const [city, areas] of Object.entries(value as Record<string, unknown>)) {
    if (!city.trim() || !Array.isArray(areas)) continue;
    const clean = areas
      .filter((a): a is string => typeof a === "string")
      .map((a) => a.trim())
      .filter(Boolean);
    if (clean.length > 0) out[city.trim()] = clean;
  }
  return out;
}
