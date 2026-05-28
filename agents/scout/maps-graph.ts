import { StateGraph, Annotation } from "@langchain/langgraph";
import { PlaceLite } from "@/lib/places/client";
import { mapsSearchNode } from "./nodes/maps_search";
import { mapsEnrichNode } from "./nodes/maps_enrich";
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
    default: () => 20,
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
  .addNode("dedupe", mapsDedupeNode)
  .addNode("save", mapsSaveNode)
  .addEdge("__start__", "mapsSearch")
  .addEdge("mapsSearch", "enrich")
  .addEdge("enrich", "dedupe")
  .addEdge("dedupe", "save")
  .addEdge("save", "__end__");

export const mapsScoutGraph = graph.compile();
