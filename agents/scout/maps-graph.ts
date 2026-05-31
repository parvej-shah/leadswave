import { StateGraph, Annotation } from "@langchain/langgraph";
import { PlaceLite } from "@/lib/places/client";
import { mapsSearchNode } from "./nodes/maps_search";
import { mapsEnrichNode } from "./nodes/maps_enrich";
import { mapsFilterNode } from "./nodes/maps_filter";
import { mapsScoreNode } from "./nodes/maps_score";
import { mapsDedupeNode } from "./nodes/maps_dedupe";
import { mapsSaveNode } from "./nodes/maps_save";

export type LeadCategory = "website_proposal" | "crm";

export type MapsLead = {
  companyName: string;
  website: string | null;
  email: string | null;
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
  campaignId: Annotation<string>(),
  googleMapsApiKey: Annotation<string>(),
  firecrawlApiKey: Annotation<string>(),
  maxPerCity: Annotation<number, number>({
    value: (_prev, next) => next,
    default: () => 60,
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

const graph = new StateGraph(MapsScoutAnnotation)
  .addNode("mapsSearch", mapsSearchNode)
  .addNode("enrich", mapsEnrichNode)
  .addNode("filter", mapsFilterNode)
  .addNode("score", mapsScoreNode)
  .addNode("dedupe", mapsDedupeNode)
  .addNode("save", mapsSaveNode)
  .addEdge("__start__", "mapsSearch")
  .addEdge("mapsSearch", "enrich")
  .addEdge("enrich", "filter")
  .addEdge("filter", "score")
  .addEdge("score", "dedupe")
  .addEdge("dedupe", "save")
  .addEdge("save", "__end__");

export const mapsScoutGraph = graph.compile();

// Preview graph — same pipeline but stops before saving. Use to show leads for user review.
const previewGraph = new StateGraph(MapsScoutAnnotation)
  .addNode("mapsSearch", mapsSearchNode)
  .addNode("enrich", mapsEnrichNode)
  .addNode("filter", mapsFilterNode)
  .addNode("score", mapsScoreNode)
  .addNode("dedupe", mapsDedupeNode)
  .addEdge("__start__", "mapsSearch")
  .addEdge("mapsSearch", "enrich")
  .addEdge("enrich", "filter")
  .addEdge("filter", "score")
  .addEdge("score", "dedupe")
  .addEdge("dedupe", "__end__");

export const mapsScoutPreviewGraph = previewGraph.compile();
