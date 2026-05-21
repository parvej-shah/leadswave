// One-shot test: run outreach agent for a given leadId
// Usage: node --env-file=.env.local scripts/test-outreach.mjs <leadId>
import { createRequire } from "module";
const require = createRequire(import.meta.url);

const leadId = process.argv[2];
if (!leadId) { console.error("Usage: node scripts/test-outreach.mjs <leadId>"); process.exit(1); }

// Resolve compiled output — run via ts-node or tsx
const { outreachGraph } = await import("../agents/outreach/graph.js").catch(() => {
  console.error("Import failed — run with: npx tsx scripts/test-outreach.mjs <leadId>");
  process.exit(1);
});

const { PrismaClient } = require("@prisma/client");
const db = new PrismaClient();

const [lead, settings] = await Promise.all([
  db.lead.findUnique({ where: { id: leadId } }),
  db.settings.findFirst({ where: { resendApiKey: { not: null } } }),
]);

if (!lead) { console.error("Lead not found"); process.exit(1); }
if (!settings?.resendApiKey || !settings?.fromEmail) { console.error("Missing settings"); process.exit(1); }

console.log(`\n→ Running outreach for: ${lead.companyName} <${lead.email}>`);
console.log(`  From: ${settings.fromName} <${settings.fromEmail}>\n`);

const result = await outreachGraph.invoke({
  leadId,
  resendApiKey: settings.resendApiKey,
  firecrawlApiKey: settings.firecrawlApiKey ?? "",
  anthropicApiKey: settings.anthropicApiKey ?? "",
  fromEmail: settings.fromEmail,
  fromName: settings.fromName ?? "",
});

console.log("✅ Done");
console.log("  Subject:", result.emailDraft?.subject);
console.log("  Sent:", result.sent);

await db.$disconnect();
