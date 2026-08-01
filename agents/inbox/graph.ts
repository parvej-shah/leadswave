import { StateGraph, Annotation } from "@langchain/langgraph";
import { loadContextNode } from "./nodes/load_context";
import { classifyNode } from "./nodes/classify";
import { hotNode } from "./nodes/hot";
import { warmNode } from "./nodes/warm";
import { coldNode } from "./nodes/cold";
import { snoozeNode } from "./nodes/snooze";
import { bounceNode } from "./nodes/bounce";

export type Classification = "hot" | "warm" | "cold" | "ooo" | "bounce";

export type InboundEmail = {
  from: string;
  subject: string;
  body: string;
  inReplyTo: string | null;
};

type Lead = {
  id: string;
  orgId: string;
  companyName: string;
  email: string | null;
  state: string;
  category?: string | null;
};

type Message = {
  id: string;
  direction: string;
  subject: string | null;
  body: string;
};

import type { CampaignOfferLike } from "../outreach/lib/offer";

type Campaign = {
  id: string;
  name: string;
  offerText: string;
  websiteOffer?: string | null;
  crmOffer?: string | null;
  offers?: CampaignOfferLike[] | null;
};

export type LeadSignals = {
  budget_mentioned?: boolean;
  timeline_mentioned?: string | null;
  competitor_mentioned?: string | null;
  objection?: string | null;
  contact_name?: string | null;
};

const InboxAnnotation = Annotation.Root({
  leadId: Annotation<string>(),
  inboundEmail: Annotation<InboundEmail>(),
  anthropicApiKey: Annotation<string>(),
  telegramChatId: Annotation<string>(),
  notifyHotOnly: Annotation<boolean>(),
  lead: Annotation<Lead>(),
  campaign: Annotation<Campaign>(),
  priorMessages: Annotation<Message[], Message[]>({
    value: (_prev, next) => next,
    default: () => [],
  }),
  classification: Annotation<Classification, Classification>({
    value: (_prev, next) => next,
    default: () => "cold" as Classification,
  }),
  signals: Annotation<LeadSignals, LeadSignals>({
    value: (_prev, next) => next,
    default: () => ({}),
  }),
  draftReply: Annotation<string | null, string | null>({
    value: (_prev, next) => next,
    default: () => null,
  }),
});

export type InboxState = typeof InboxAnnotation.State;

function routeNode(state: InboxState): string {
  return state.classification;
}

const graph = new StateGraph(InboxAnnotation)
  .addNode("load_context", loadContextNode)
  .addNode("classify", classifyNode)
  .addNode("hot", hotNode)
  .addNode("warm", warmNode)
  .addNode("cold", coldNode)
  .addNode("snooze", snoozeNode)
  .addNode("bounce", bounceNode)
  .addEdge("__start__", "load_context")
  .addEdge("load_context", "classify")
  .addConditionalEdges("classify", routeNode, {
    hot: "hot",
    warm: "warm",
    cold: "cold",
    ooo: "snooze",
    bounce: "bounce",
  })
  .addEdge("hot", "__end__")
  .addEdge("warm", "__end__")
  .addEdge("cold", "__end__")
  .addEdge("snooze", "__end__")
  .addEdge("bounce", "__end__");

export const inboxGraph = graph.compile();
