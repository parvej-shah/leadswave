export type CampaignTemplateOffer = {
  key: string;
  label: string;
  matchSignal: string;
  offerText: string;
  angle: string;
  order: number;
};

export type CampaignTemplate = {
  id: string;
  name: string;
  description: string;
  offerText: string;
  country: string;
  offers: CampaignTemplateOffer[];
};

export const CAMPAIGN_TEMPLATES: CampaignTemplate[] = [
  {
    id: "speed-to-lead",
    name: "Speed-to-Lead + AI Voice (US Home Services)",
    description:
      "Pitch AI voice agents and missed-call text-back to home service businesses. Best for: pest control, HVAC, pressure washing, plumbing.",
    offerText:
      "Speed-to-lead automation, missed-call text-back, and AI voice agents to capture every inquiry.",
    country: "USA",
    offers: [
      {
        key: "no_phone",
        label: "No Phone Listed",
        matchSignal: "no_phone",
        offerText:
          "We set up a dedicated tracking number and AI receptionist so every call is captured and responded to automatically.",
        angle: JSON.stringify({
          pain: "No listed phone — missing inbound calls entirely",
          hook: "They have no tracked number on their listing",
          avoid: "Don't mention AI explicitly, don't mention pricing",
        }),
        order: 0,
      },
      {
        key: "speed_default",
        label: "General Speed-to-Lead",
        matchSignal: "always",
        offerText:
          "We install an AI voice agent and missed-call text-back so you never lose a job to voicemail again.",
        angle: JSON.stringify({
          pain: "78% of home service jobs go to whoever responds first — most shops miss evening calls",
          hook: "Observe their response time or Google reviews mentioning slow callbacks",
          avoid: "Don't lead with pricing or ROI numbers",
        }),
        order: 1,
      },
    ],
  },
  {
    id: "crm-ghl",
    name: "CRM + GoHighLevel Automation (US Home Services)",
    description:
      "Pitch CRM setup and GoHighLevel automation for businesses with existing websites.",
    offerText:
      "Complete CRM setup and GoHighLevel automation to capture and nurture every lead.",
    country: "USA",
    offers: [
      {
        key: "crm_website",
        label: "Has Website — CRM Integration",
        matchSignal: "has_website",
        offerText:
          "We connect your existing website to GoHighLevel so every inquiry is auto-followed-up and no lead slips through.",
        angle: JSON.stringify({
          pain: "Leads from their site go unmanaged — no follow-up system",
          hook: "They have a website but it isn't connected to any CRM or automation",
          avoid: "Don't say GoHighLevel unless they ask — just say 'CRM'",
        }),
        order: 0,
      },
      {
        key: "crm_default",
        label: "General CRM",
        matchSignal: "always",
        offerText:
          "We set up a central CRM to track every customer inquiry and automate your marketing follow-up.",
        angle: JSON.stringify({
          pain: "Customer follow-up is ad-hoc — done over text or forgotten",
          hook: "Ask how they currently track who called last month",
          avoid: "Don't pitch software features, pitch outcomes",
        }),
        order: 1,
      },
    ],
  },
  {
    id: "back-office",
    name: "Back-Office Automation (Accountants / Lawyers)",
    description:
      "Pitch document and workflow automation to professional services firms.",
    offerText:
      "Back-office and document automation that saves 10+ hours per week on manual admin.",
    country: "USA",
    offers: [
      {
        key: "doc_automation",
        label: "Document Automation",
        matchSignal: "always",
        offerText:
          "We automate document intake, data extraction, and filing so your staff focuses on judgment work, not data entry.",
        angle: JSON.stringify({
          pain: "40-60% of professional services back-office is repetitive document work",
          hook: "What's the most repetitive document task their staff handles?",
          avoid: "Don't mention AI or ML explicitly — say 'automation'",
        }),
        order: 0,
      },
    ],
  },
];
