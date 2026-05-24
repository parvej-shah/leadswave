// Mock data — shared across screens
window.LW = window.LW || {};

LW.campaigns = [
  { id: "c1", name: "BD Law Firms Q2", query: "boutique law firms", location: "New York, NY", status: "active", createdAt: "2025-04-12", leads: 142, sent: 128, replies: 14, hot: 5, meetings: 2 },
  { id: "c2", name: "Series-A SaaS Founders", query: "post-seed SaaS founders", location: "San Francisco, CA", status: "active", createdAt: "2025-05-02", leads: 87, sent: 71, replies: 11, hot: 4, meetings: 3 },
  { id: "c3", name: "Marketing Agencies — EU", query: "digital marketing agencies", location: "Berlin · Amsterdam · London", status: "paused", createdAt: "2025-03-21", leads: 211, sent: 211, replies: 19, hot: 3, meetings: 1 },
  { id: "c4", name: "Healthcare Operations", query: "outpatient clinic ops", location: "Chicago · Boston", status: "completed", createdAt: "2025-02-08", leads: 54, sent: 54, replies: 6, hot: 0, meetings: 0 },
];

LW.leads = [
  { id: "l1", company: "Acme Robotics", email: "jenna@acme.io", website: "acme.io", state: "replied", campaign: "BD Law Firms Q2", msgs: 4, lastTouched: "12m ago" },
  { id: "l2", company: "Northwind Logistics", email: "sales@northwind.co", website: "northwind.co", state: "converted", campaign: "Series-A SaaS Founders", msgs: 6, lastTouched: "1h ago" },
  { id: "l3", company: "Pinion Labs", email: "hi@pinion.co", website: "pinion.co", state: "contacted", campaign: "BD Law Firms Q2", msgs: 1, lastTouched: "3h ago" },
  { id: "l4", company: "Kestrel.io", email: null, website: "kestrel.io", state: "discovered", campaign: "Series-A SaaS Founders", msgs: 0, lastTouched: "5h ago" },
  { id: "l5", company: "Beacon HQ", email: "marc@beaconhq.com", website: "beaconhq.com", state: "replied", campaign: "Marketing Agencies — EU", msgs: 3, lastTouched: "6h ago" },
  { id: "l6", company: "Lumen Studio", email: "team@lumen.studio", website: "lumen.studio", state: "contacted", campaign: "Marketing Agencies — EU", msgs: 2, lastTouched: "8h ago" },
  { id: "l7", company: "Drift & Loom", email: "ada@driftloom.com", website: "driftloom.com", state: "bounced", campaign: "BD Law Firms Q2", msgs: 1, lastTouched: "10h ago" },
  { id: "l8", company: "Parallax Health", email: "ceo@parallax.health", website: "parallax.health", state: "discovered", campaign: "Healthcare Operations", msgs: 0, lastTouched: "1d ago" },
  { id: "l9", company: "Stonewall Legal", email: "intake@stonewall.law", website: "stonewall.law", state: "unsubscribed", campaign: "BD Law Firms Q2", msgs: 2, lastTouched: "2d ago" },
  { id: "l10", company: "Vector Foundry", email: "hi@vectorfoundry.io", website: "vectorfoundry.io", state: "contacted", campaign: "Series-A SaaS Founders", msgs: 1, lastTouched: "2d ago" },
];

LW.inboxThreads = [
  {
    id: "l1", company: "Acme Robotics", email: "jenna@acme.io", state: "replied", classify: "hot",
    campaign: "BD Law Firms Q2", lastTouched: "12m ago", isFresh: true,
    snippet: "Yeah, interested. What's the pricing look like?",
    messages: [
      { id: "m1", direction: "outbound", subject: "Quick question on outbound", body: "Hi Jenna,\n\nSaw your post about scaling outbound at Acme. We help solo founders run AI-led outreach without the spreadsheet sprawl. Open to a 15-min walkthrough next week?\n\n— Daniel", sentAt: "2d ago" },
      { id: "m2", direction: "inbound", subject: "Re: Quick question on outbound", body: "Yeah, interested. What's the pricing look like? Also — do you handle Google Calendar bookings directly?", sentAt: "12m ago" },
    ],
    aiDraft: "Thanks Jenna — happy to walk through pricing. We start at $49/mo per seat, with usage-based scout credits on top. And yes, meetings book directly into Google Calendar; you confirm in one click.\n\nHere's a link to my calendar: cal.com/daniel/leadswave\n\n— Daniel",
  },
  {
    id: "l2", company: "Northwind Logistics", email: "sales@northwind.co", state: "converted", classify: "hot",
    campaign: "Series-A SaaS Founders", lastTouched: "1h ago", isFresh: false,
    snippet: "Booked Thursday 3pm — confirmed.",
    messages: [
      { id: "m1", direction: "outbound", body: "Hi team — would love to learn about how Northwind handles outbound today.", sentAt: "3d ago" },
      { id: "m2", direction: "inbound", body: "Sounds useful. What times work this week?", sentAt: "2d ago" },
      { id: "m3", direction: "outbound", body: "How about Thursday 3pm ET? Sending an invite now.", sentAt: "1d ago" },
      { id: "m4", direction: "inbound", body: "Booked Thursday 3pm — confirmed.", sentAt: "1h ago" },
    ],
    aiDraft: "",
  },
  {
    id: "l5", company: "Beacon HQ", email: "marc@beaconhq.com", state: "replied", classify: "warm",
    campaign: "Marketing Agencies — EU", lastTouched: "6h ago", isFresh: false,
    snippet: "Not right now — circle back in Q3 maybe.",
    messages: [
      { id: "m1", direction: "outbound", body: "Hi Marc, noticed Beacon ranks for some tough mid-funnel queries…", sentAt: "4d ago" },
      { id: "m2", direction: "inbound", body: "Not right now — circle back in Q3 maybe.", sentAt: "6h ago" },
    ],
    aiDraft: "Totally understood, Marc. I'll ping you in early August. In the meantime here's a 2-min loom on how we'd think about Beacon's vertical: loom.com/share/xxxx\n\n— Daniel",
  },
  {
    id: "l3", company: "Pinion Labs", email: "hi@pinion.co", state: "contacted", classify: "warm",
    campaign: "BD Law Firms Q2", lastTouched: "3h ago", isFresh: false,
    snippet: "Got it — sending to our ops lead.",
    messages: [
      { id: "m1", direction: "outbound", body: "Hi Pinion team, briefly: AI-led outbound for boutique law firms…", sentAt: "5d ago" },
      { id: "m2", direction: "inbound", body: "Got it — sending to our ops lead.", sentAt: "3h ago" },
    ],
    aiDraft: "",
  },
];

LW.activity = [
  { kind: "hot", company: "Acme Robotics", at: "12m ago" },
  { kind: "meeting", company: "Northwind Logistics", at: "1h ago" },
  { kind: "sent", company: "Pinion Labs", at: "3h ago" },
  { kind: "hot", company: "Beacon HQ", at: "6h ago" },
  { kind: "sent", company: "Lumen Studio", at: "8h ago" },
];

LW.kpis = [
  { label: "Total Leads", value: "1,284", spark: [82, 94, 88, 110, 102, 124, 142], deltaPill: "12.4%", deltaColor: "var(--success)", color: "var(--fg-1)" },
  { label: "Emails Sent", value: "918",   spark: [76, 88, 82, 102, 95, 110, 128], deltaPill: "6.1%",  deltaColor: "var(--success)", color: "var(--fg-1)" },
  { label: "Reply Rate",  value: "12.4%", spark: [9.1, 8.4, 10.2, 9.8, 11.5, 11.8, 12.4], deltaPill: "2.6 pt", deltaColor: "var(--success)", color: "var(--success)" },
  { label: "Hot Leads",   value: "17",    spark: [2, 4, 3, 7, 6, 12, 17], deltaPill: "4 today", deltaColor: "var(--hot)", color: "var(--hot)" },
  { label: "Meetings",    value: "6",     spark: [0, 1, 1, 3, 3, 5, 6], delta: "THIS WEEK", deltaColor: "var(--fg-4)", color: "var(--info)" },
];

LW.activityV2 = [
  { kind: "hot",     company: "Acme Robotics",       at: "12m ago", group: "Today" },
  { kind: "meeting", company: "Northwind Logistics", at: "1h ago",  group: "Today" },
  { kind: "sent",    company: "Pinion Labs",         at: "3h ago",  group: "Today" },
  { kind: "open",    company: "Lumen Studio",        at: "5h ago",  group: "Today" },
  { kind: "hot",     company: "Beacon HQ",           at: "Yesterday · 4:12pm", group: "Yesterday" },
  { kind: "scout",   company: "24",                  at: "Yesterday · 9:02am", group: "Yesterday" },
];

LW.scoutedLeadsPreview = [
  { company: "Coopman & Reyes", website: "coopmanreyes.law", contact: "Patricia Reyes" },
  { company: "Hartwell Group", website: "hartwellgroup.com", contact: "Daniel Hartwell" },
  { company: "Mercer & Vaughn", website: "mercervaughn.law", contact: "Lila Mercer" },
  { company: "Astoria Counsel", website: "astoriacounsel.com", contact: "Tom Astoria" },
  { company: "Ridgeview Legal", website: "ridgeviewlegal.com", contact: "—" },
];
