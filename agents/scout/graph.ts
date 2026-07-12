import { StateGraph, Annotation } from "@langchain/langgraph";
import { searchNode } from "./nodes/search";
import { scrapeNode } from "./nodes/scrape";
import { dedupeNode } from "./nodes/dedupe";
import { saveNode } from "./nodes/save";

export type ExtractedLead = {
  companyName: string;
  email: string | null;
  website?: string;
  description?: string;
  hasContactForm?: boolean;
  facebookUrl?: string | null;
};

export type RawResult = {
  url: string;
  snippet: string;
  title: string;
};

const ScoutAnnotation = Annotation.Root({
  query: Annotation<string>(),
  location: Annotation<string>(),
  campaignId: Annotation<string>(),
  orgId: Annotation<string>(),
  firecrawlApiKey: Annotation<string>(),
  anthropicApiKey: Annotation<string>(),
  rawResults: Annotation<RawResult[], RawResult[]>({
    value: (_prev, next) => next,
    default: () => [],
  }),
  leads: Annotation<ExtractedLead[], ExtractedLead[]>({
    value: (_prev, next) => next,
    default: () => [],
  }),
  savedCount: Annotation<number, number>({
    value: (_prev, next) => next,
    default: () => 0,
  }),
});

export type ScoutState = typeof ScoutAnnotation.State;

const graph = new StateGraph(ScoutAnnotation)
  .addNode("search", searchNode)
  .addNode("scrape", scrapeNode)
  .addNode("dedupe", dedupeNode)
  .addNode("save", saveNode)
  .addEdge("__start__", "search")
  .addEdge("search", "scrape")
  .addEdge("scrape", "dedupe")
  .addEdge("dedupe", "save")
  .addEdge("save", "__end__");

export const scoutGraph = graph.compile();
