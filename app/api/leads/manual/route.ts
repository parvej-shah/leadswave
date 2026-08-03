import { NextRequest, NextResponse } from "next/server";
import { requireOrg, tenantErrorResponse } from "@/lib/tenant";
import { db } from "@/lib/db";
import { logActivity } from "@/lib/activity";

export async function POST(req: NextRequest) {
  let ctx;
  try {
    ctx = await requireOrg();
  } catch (e) {
    return tenantErrorResponse(e);
  }

  const body = await req.json();
  const {
    campaignId,
    companyName,
    email,
    phone,
    website,
    address,
    category,
    description,
  } = (body ?? {}) as {
    campaignId?: string;
    companyName?: string;
    email?: string;
    phone?: string;
    website?: string;
    address?: string;
    category?: string;
    description?: string;
  };

  if (!campaignId) {
    return NextResponse.json({ error: "campaignId is required" }, { status: 400 });
  }

  const cleanCompany = companyName?.trim() || email?.trim() || "";
  if (!cleanCompany) {
    return NextResponse.json({ error: "Company name or email is required" }, { status: 400 });
  }

  const campaign = await db.campaign.findFirst({
    where: { id: campaignId, orgId: ctx.orgId, deletedAt: null },
    select: { id: true, name: true },
  });
  if (!campaign) {
    return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  }

  // Dedupe check if email is provided
  if (email?.trim()) {
    const cleanEmail = email.trim().toLowerCase();
    const existing = await db.lead.findFirst({
      where: { campaignId, orgId: ctx.orgId, deletedAt: null, email: { equals: cleanEmail, mode: "insensitive" } },
      select: { id: true },
    });
    if (existing) {
      return NextResponse.json({ error: `Lead with email '${cleanEmail}' already exists in this campaign` }, { status: 409 });
    }
  }

  const lead = await db.lead.create({
    data: {
      campaignId,
      orgId: ctx.orgId,
      companyName: cleanCompany,
      email: email?.trim() || null,
      emailSource: email?.trim() ? "manual" : null,
      phone: phone?.trim() || null,
      website: website?.trim() || null,
      address: address?.trim() || null,
      category: category?.trim() || null,
      description: description?.trim() || null,
      state: "discovered",
    },
  });

  await logActivity({
    orgId: ctx.orgId,
    type: "imported",
    summary: `Manually added lead ${lead.companyName} to campaign ${campaign.name}`,
    campaignId,
    leadId: lead.id,
  });

  return NextResponse.json(lead, { status: 201 });
}
