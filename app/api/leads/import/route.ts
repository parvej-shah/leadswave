import { NextRequest, NextResponse } from "next/server";
import { requireOrg, tenantErrorResponse } from "@/lib/tenant";
import { db } from "@/lib/db";
import { logActivity } from "@/lib/activity";
import { parseCSV, rowsToLeads } from "@/lib/csv";

type ImportLead = {
  companyName?: string;
  email?: string;
  website?: string;
  description?: string;
};

// Existing (non-deleted) lead emails for a campaign — used by the import wizard
// to flag duplicate rows in the preview before the user commits the import.
export async function GET(req: NextRequest) {
  let ctx;
  try {
    ctx = await requireOrg();
  } catch (e) {
    return tenantErrorResponse(e);
  }

  const campaignId = new URL(req.url).searchParams.get("campaignId");
  if (!campaignId) return NextResponse.json({ error: "campaignId required" }, { status: 400 });

  const existing = await db.lead.findMany({
    where: { campaignId, orgId: ctx.orgId, deletedAt: null, email: { not: null } },
    select: { email: true },
  });
  return NextResponse.json({ emails: existing.map((e) => e.email!.toLowerCase()) });
}

export async function POST(req: NextRequest) {
  let ctx;
  try {
    ctx = await requireOrg();
  } catch (e) {
    return tenantErrorResponse(e);
  }

  const body = await req.json();
  const { campaignId, csvText, leads: editedLeads } = body as {
    campaignId: string;
    csvText?: string;
    leads?: ImportLead[]; // pre-edited rows from the preview (source of truth)
  };

  if (!campaignId) return NextResponse.json({ error: "campaignId required" }, { status: 400 });

  const campaign = await db.campaign.findFirst({
    where: { id: campaignId, orgId: ctx.orgId, deletedAt: null },
  });
  if (!campaign) return NextResponse.json({ error: "Campaign not found" }, { status: 404 });

  // Source rows: prefer the edited preview rows; otherwise parse the CSV text.
  let candidates: ImportLead[];
  if (Array.isArray(editedLeads)) {
    candidates = editedLeads;
  } else {
    if (!csvText?.trim()) return NextResponse.json({ error: "csvText or leads required" }, { status: 400 });
    const { headers, rows } = parseCSV(csvText);
    if (rows.length === 0) return NextResponse.json({ error: "No data rows found in CSV" }, { status: 400 });
    candidates = rowsToLeads(headers, rows);
  }

  // Normalise + require companyName or email.
  const normalized = candidates
    .map((l) => ({
      companyName: l.companyName?.trim() || "",
      email: l.email?.trim() || "",
      website: l.website?.trim() || "",
      description: l.description?.trim() || "",
    }))
    .filter((l) => l.companyName || l.email);

  if (normalized.length === 0) {
    return NextResponse.json(
      { error: "No usable rows found — ensure rows have a company name and/or email" },
      { status: 400 }
    );
  }

  const total = normalized.length;

  // Dedupe by email: imported leads have a null placeId, so the
  // @@unique([campaignId, placeId]) constraint + skipDuplicates never fire for
  // them. Drop rows whose email already exists in the campaign, and collapse
  // duplicate emails within this batch.
  const existing = await db.lead.findMany({
    where: { campaignId, orgId: ctx.orgId, deletedAt: null, email: { not: null } },
    select: { email: true },
  });
  const seen = new Set(existing.map((e) => e.email!.toLowerCase()));

  const toInsert = normalized.filter((l) => {
    if (!l.email) return true; // no email → nothing to dedupe against
    const key = l.email.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  if (toInsert.length === 0) {
    return NextResponse.json({ imported: 0, total });
  }

  const result = await db.lead.createMany({
    data: toInsert.map((l) => ({
      campaignId,
      orgId: ctx.orgId,
      companyName: l.companyName || l.email || "Unknown",
      email: l.email || null,
      emailSource: l.email ? "imported" : null,
      website: l.website || null,
      description: l.description || null,
      state: "discovered",
    })),
    skipDuplicates: true,
  });

  await logActivity({
    orgId: ctx.orgId,
    type: "imported",
    summary: `Imported ${result.count} lead${result.count === 1 ? "" : "s"} to ${campaign.name}`,
    campaignId,
  });

  return NextResponse.json({ imported: result.count, total });
}
