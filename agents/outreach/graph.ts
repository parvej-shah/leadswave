import { StateGraph, Annotation } from "@langchain/langgraph";
import { loadContextNode } from "./nodes/load_context";
import { personalizeNode } from "./nodes/personalize";
import { sendNode } from "./nodes/send";
import { scheduleFollowupsNode } from "./nodes/schedule_followups";

type Lead = {
  id: string;
  companyName: string;
  email: string | null;
  website: string | null;
  description: string | null;
  category: string | null;
  state: string;
};

type Campaign = {
  id: string;
  name: string;
  offerText: string;
  websiteOffer: string | null;
  crmOffer: string | null;
};

type EmailDraft = {
  subject: string;
  body: string;
};

const OutreachAnnotation = Annotation.Root({
  leadId: Annotation<string>(),
  resendApiKey: Annotation<string>(),
  firecrawlApiKey: Annotation<string>(),
  anthropicApiKey: Annotation<string>(),
  fromEmail: Annotation<string>(),
  fromName: Annotation<string>(),
  lead: Annotation<Lead>(),
  campaign: Annotation<Campaign>(),
  websiteSummary: Annotation<string, string>({
    value: (_prev, next) => next,
    default: () => "",
  }),
  emailDraft: Annotation<EmailDraft>(),
  sent: Annotation<boolean, boolean>({
    value: (_prev, next) => next,
    default: () => false,
  }),
});

export type OutreachState = typeof OutreachAnnotation.State;

const graph = new StateGraph(OutreachAnnotation)
  .addNode("load_context", loadContextNode)
  .addNode("personalize", personalizeNode)
  .addNode("send", sendNode)
  .addNode("schedule_followups", scheduleFollowupsNode)
  .addEdge("__start__", "load_context")
  .addEdge("load_context", "personalize")
  .addEdge("personalize", "send")
  .addEdge("send", "schedule_followups")
  .addEdge("schedule_followups", "__end__");

export const outreachGraph = graph.compile();
