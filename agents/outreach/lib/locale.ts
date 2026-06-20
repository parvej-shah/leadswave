/**
 * Country → write-language for outreach copy.
 *
 * Decision (see .claude/features/outreach/rules.md): write the LOCAL language only
 * for non-English-fluent markets. High-English-fluency markets (Germany, Netherlands,
 * the Nordics, India, UAE, Singapore…) intentionally map to English — they are simply
 * absent from the table, since unmapped → English. Adding a market is one line here;
 * this is the single source of truth so the two channels can't drift.
 */

/** Target write-language for outreach copy. English is the default/fallback. */
export type OutreachLanguage =
  | "English"
  | "Bangla"
  | "Japanese"
  | "German"
  | "Portuguese"
  | "Spanish"
  | "French";

/** Lowercased free-text Campaign.country → language. Unmapped countries → English. */
const COUNTRY_LANGUAGE: Record<string, OutreachLanguage> = {
  bangladesh: "Bangla",
  japan: "Japanese",
  portugal: "Portuguese",
  brazil: "Portuguese",
  spain: "Spanish",
  mexico: "Spanish",
  argentina: "Spanish",
  colombia: "Spanish",
  chile: "Spanish",
  france: "French",
  // English-fluent markets are intentionally omitted (→ English): germany, netherlands,
  // sweden, norway, denmark, india, uae, singapore, etc. Add aliases ("usa"/"united states")
  // here if real data shows free-text variants.
};

export function resolveLanguage(country?: string | null): OutreachLanguage {
  const key = (country ?? "").trim().toLowerCase();
  return COUNTRY_LANGUAGE[key] ?? "English";
}
