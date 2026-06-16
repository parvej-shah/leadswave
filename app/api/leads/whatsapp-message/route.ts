import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { generateText } from "@/lib/gemini";
import { getSystemSettings } from "@/lib/settings";
import { resolveOffer } from "@/agents/outreach/lib/offer";
import { loadWebsiteSummary } from "@/agents/outreach/lib/context";
import { buildWhatsAppOpenerPrompt } from "@/agents/outreach/lib/opener";

async function getUserId() {
  const session = await auth();
  return session?.user?.id ?? null;
}

// AI-unavailable fallback. Still an OPENER, not a pitch: a soft observation +
// a low-pressure question, never an offer or a "let's chat" CTA. See
// .claude/features/outreach/rules.md.
function fallbackMessage(companyName: string, category: string | null, country: string): string {
  if (/bangladesh/i.test(country)) {
    const q =
      category === "website_proposal"
        ? "এখন নতুন কাস্টমাররা আপনাদের কীভাবে খুঁজে পান — বেশিরভাগ রেফারেন্সে, নাকি অনলাইনে?"
        : "এখন কাস্টমারদের ইনকোয়ারিগুলো কীভাবে রাখেন — কোনো সিস্টেমে, নাকি বেশিরভাগ খাতা/হোয়াটসঅ্যাপে?";
    return `হ্যালো ${companyName} টিম! ${q}`;
  }

  const q =
    category === "website_proposal"
      ? "Out of curiosity, how do new customers usually find you right now — mostly referrals, or online?"
      : "Out of curiosity, how does your team track customer inquiries right now — a system, or mostly calls and WhatsApp?";
  return `Hi ${companyName} team! ${q}`;
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
  const websiteSummary = await loadWebsiteSummary({
    website: lead.website,
    description: lead.description,
    firecrawlApiKey: settings.firecrawlApiKey,
  });

  const prompt = buildWhatsAppOpenerPrompt(
    {
      fromName: settings.fromName,
      companyName: lead.companyName,
      websiteSummary,
      location: lead.address,
      angle,
      offer,
    },
    { bangla: /bangladesh/i.test(country) },
  );

  try {
    const message = (await generateText(prompt)).trim();
    return NextResponse.json({ message, phone: lead.phone, generated: true });
  } catch (err) {
    // AI unavailable — return an opener-style template plus the reason so the
    // UI can tell the user why the message is generic.
    const reason = err instanceof Error ? err.message : "AI generation failed";
    return NextResponse.json({
      message: fallbackMessage(lead.companyName, lead.category, country),
      phone: lead.phone,
      generated: false,
      reason,
    });
  }
}
