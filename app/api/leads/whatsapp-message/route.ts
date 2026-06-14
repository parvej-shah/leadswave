import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { generateText } from "@/lib/gemini";
import { getSystemSettings } from "@/lib/settings";
import { resolveOffer } from "@/agents/outreach/lib/offer";
import FirecrawlApp from "@mendable/firecrawl-js";

async function getUserId() {
  const session = await auth();
  return session?.user?.id ?? null;
}

function fallbackMessage(
  companyName: string,
  category: string | null,
  offer: string,
  country: string,
): string {
  const shortOffer = offer.trim()
    ? offer.length > 160
      ? `${offer.slice(0, 157)}…`
      : offer
    : "";

  if (/bangladesh/i.test(country)) {
    const pitch =
      shortOffer ||
      (category === "website_proposal"
        ? "আমরা লোকাল ব্যবসার জন্য প্রফেশনাল ওয়েবসাইট বানাই, যা আরও বেশি কাস্টমার এনে দেয়।"
        : "আমরা আপনার ব্যবসার লিডগুলো গুছিয়ে রেখে আরও বেশি কাস্টমারে রূপান্তর করতে সাহায্য করি।");
    return `হ্যালো ${companyName} টিম! ${pitch} এ নিয়ে এক মিনিট কথা বলা যাবে কি?`;
  }

  const pitch =
    shortOffer ||
    (category === "website_proposal"
      ? "We build professional websites for local businesses that bring in more customers."
      : "We help businesses like yours organize and convert more of the leads you're already getting.");
  return `Hi ${companyName} team! ${pitch} Would you be open to a quick chat?`;
}

export async function POST(req: NextRequest) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { leadId } = await req.json();
  if (!leadId) return NextResponse.json({ error: "leadId required" }, { status: 400 });

  const [lead, settings] = await Promise.all([
    db.lead.findUnique({ where: { id: leadId }, include: { campaign: true } }),
    getSystemSettings(),
  ]);
  if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  if (!lead.phone) return NextResponse.json({ error: "Lead has no phone number" }, { status: 400 });

  const { offer, angle } = resolveOffer(lead.category, lead.campaign);
  const country = lead.campaign.country ?? "";

  // Same recipient context the email personalizer gets: live website content
  // when available, stored description otherwise.
  let websiteSummary = lead.description ?? "";
  if (lead.website && settings.firecrawlApiKey) {
    try {
      const app = new FirecrawlApp({ apiKey: settings.firecrawlApiKey });
      const scraped = await app.scrape(lead.website, { formats: ["markdown"] });
      const md = (scraped as { markdown?: string }).markdown ?? "";
      if (md) websiteSummary = md.slice(0, 3000);
    } catch {
      // fall back to stored description
    }
  }

  const prompt = `You are writing a WhatsApp message on behalf of ${settings.fromName || "our team"} for first-touch outreach to a local business.

About the recipient business:
${websiteSummary || `Company: ${lead.companyName}`}
${lead.address ? `Location: ${lead.address}` : ""}
${angle ? `\nPitch angle: ${angle}\n` : ""}
Our offer:
${offer || "(use the pitch angle above)"}

Write the WhatsApp message. Rules:
- WhatsApp tone: warm, casual-professional, like texting a busy business owner — not a formal email.
- Open with one specific observation about their business (from the info above) so it clearly isn't spam.
- One or two sentences on what we offer and the concrete benefit for them specifically.
- End with a low-pressure question they can answer in one word.
- 3-5 short sentences, max ~75 words. No markdown, no placeholders like [name], at most one emoji.
${
  /bangladesh/i.test(country)
    ? "- Write the entire message in natural, conversational Bangla (Bengali script), as a Bangladeshi business owner would text — not a stiff translation."
    : "- Write in English."
}
Return the message text only.`;

  try {
    const message = (await generateText(prompt)).trim();
    return NextResponse.json({ message, phone: lead.phone, generated: true });
  } catch (err) {
    // AI unavailable — return an offer-aware template plus the reason so the
    // UI can tell the user why the message is generic.
    const reason = err instanceof Error ? err.message : "AI generation failed";
    return NextResponse.json({
      message: fallbackMessage(lead.companyName, lead.category, offer, country),
      phone: lead.phone,
      generated: false,
      reason,
    });
  }
}
