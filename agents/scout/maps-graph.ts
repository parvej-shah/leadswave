import { StateGraph, Annotation } from "@langchain/langgraph";
import { PlaceLite } from "@/lib/places/client";
import { mapsSearchNode } from "./nodes/maps_search";
import { mapsFilterNode } from "./nodes/maps_filter";
import { mapsScoreNode } from "./nodes/maps_score";
import { mapsDedupeNode } from "./nodes/maps_dedupe";
import { mapsSaveNode } from "./nodes/maps_save";

export type LeadCategory = "website_proposal" | "crm";

export type MapsLead = {
  companyName: string;
  website: string | null;
  email: string | null;
  emailSource?: string | null; // scraped | web_search | guessed | enriched
  emailStatus?: string | null; // verified | catch_all | unverified | invalid
  hasContactForm?: boolean | null;
  facebookUrl?: string | null;
  description: string | null;
  category: LeadCategory;
  address: string | null;
  phone: string | null;
  rating: number | null;
  mapsUrl: string | null;
  placeId: string;
  score: number; // 0-100 quality score computed after enrichment
};

const MapsScoutAnnotation = Annotation.Root({
  businessType: Annotation<string>(),
  country: Annotation<string>(),
  selectedCities: Annotation<string[]>(),
  // Hotspot areas per city ({ [city]: string[] }); cities without areas use the quadrant fallback
  selectedAreas: Annotation<Record<string, string[]>, Record<string, string[]>>({
    value: (_prev, next) => next,
    default: () => ({}),
  }),
  campaignId: Annotation<string>(),
  googleMapsApiKey: Annotation<string>(),
  firecrawlApiKey: Annotation<string>(),
  // Quadrant-fallback budget for cities without selected areas
  maxPerCity: Annotation<number, number>({
    value: (_prev, next) => next,
    default: () => 300,
  }),
  // Per-hotspot-area budget; 100 = Places API pagination ceiling per query. No per-city cap.
  maxPerArea: Annotation<number, number>({
    value: (_prev, next) => next,
    default: () => 100,
  }),
  places: Annotation<PlaceLite[], PlaceLite[]>({
    value: (_prev, next) => next,
    default: () => [],
  }),
  leads: Annotation<MapsLead[], MapsLead[]>({
    value: (_prev, next) => next,
    default: () => [],
  }),
  savedCount: Annotation<number, number>({
    value: (_prev, next) => next,
    default: () => 0,
  }),
});

export type MapsScoutState = typeof MapsScoutAnnotation.State;

// Step 1: collect leads from Google Maps (no Firecrawl enrichment — that's Step 2)
const graph = new StateGraph(MapsScoutAnnotation)
  .addNode("mapsSearch", mapsSearchNode)
  .addNode("filter", mapsFilterNode)
  .addNode("score", mapsScoreNode)
  .addNode("dedupe", mapsDedupeNode)
  .addNode("save", mapsSaveNode)
  .addEdge("__start__", "mapsSearch")
  .addEdge("mapsSearch", "filter")
  .addEdge("filter", "score")
  .addEdge("score", "dedupe")
  .addEdge("dedupe", "save")
  .addEdge("save", "__end__");

export const mapsScoutGraph = graph.compile();

// Preview graph — same pipeline but stops before saving. Use to show leads for user review.
const previewGraph = new StateGraph(MapsScoutAnnotation)
  .addNode("mapsSearch", mapsSearchNode)
  .addNode("filter", mapsFilterNode)
  .addNode("score", mapsScoreNode)
  .addNode("dedupe", mapsDedupeNode)
  .addEdge("__start__", "mapsSearch")
  .addEdge("mapsSearch", "filter")
  .addEdge("filter", "score")
  .addEdge("score", "dedupe")
  .addEdge("dedupe", "__end__");

export const mapsScoutPreviewGraph = previewGraph.compile();
