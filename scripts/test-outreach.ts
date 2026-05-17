import { outreachGraph } from "../agents/outreach/graph";

async function main() {
  const result = await outreachGraph.invoke({
    leadId: "cmp5rhdcm0001oq14xxq2ztm0",
    resendApiKey: "re_LPEPR3Qn_DKNWsfred42ergwK9oHAfvoV",
    firecrawlApiKey: "fc-4f73a3b856f542d792abf5e0a35b874a",
    anthropicApiKey: "",
    fromEmail: "onboarding@resend.dev",
    fromName: "Parvej",
  });
  console.log("sent:", result.sent);
  console.log("subject:", result.emailDraft?.subject);
  console.log("body:\n", result.emailDraft?.body);
}
main().catch(e => { console.error(e.message); process.exit(1); });
