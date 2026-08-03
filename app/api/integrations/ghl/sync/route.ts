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

  const body = await req.json().catch(() => ({}));
  const { leadId } = body as { leadId?: string };

  if (!leadId) {
    return NextResponse.json({ error: "leadId is required" }, { status: 400 });
  }

  const settings = await db.settings.findUnique({
    where: { orgId: ctx.orgId },
  });

  if (!settings?.ghlApiKey || !settings?.ghlLocationId) {
    return NextResponse.json(
      { skipped: true, reason: "GHL credentials not configured in settings" },
      { status: 200 },
    );
  }

  const lead = await db.lead.findFirst({
    where: { id: leadId, orgId: ctx.orgId, deletedAt: null },
  });

  if (!lead) {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  }

  try {
    // 1. Search for existing GHL contact by email
    const searchRes = await fetch(
      `https://rest.gohighlevel.com/v1/contacts/lookup?email=${encodeURIComponent(lead.email ?? "")}`,
      {
        headers: {
          Authorization: `Bearer ${settings.ghlApiKey}`,
        },
      },
    );

    let contactId: string | null = null;
    if (searchRes.ok) {
      const searchData = await searchRes.json();
      contactId = searchData.contacts?.[0]?.id ?? null;
    }

    // 2. Create contact if not existing
    if (!contactId) {
      const createRes = await fetch("https://rest.gohighlevel.com/v1/contacts/", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${settings.ghlApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          locationId: settings.ghlLocationId,
          email: lead.email,
          phone: lead.phone,
          name: lead.companyName,
          companyName: lead.companyName,
          address1: lead.address,
        }),
      });

      if (!createRes.ok) {
        const errText = await createRes.text();
        throw new Error(`GHL contact creation failed: ${createRes.status} ${errText}`);
      }

      const createData = await createRes.json();
      contactId = createData.contact?.id ?? createData.id;
    }

    // 3. Create opportunity if pipelineId is configured
    if (settings.ghlPipelineId && contactId) {
      await fetch("https://rest.gohighlevel.com/v1/pipelines/opportunities", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${settings.ghlApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          pipelineId: settings.ghlPipelineId,
          locationId: settings.ghlLocationId,
          name: `${lead.companyName} — LeadsWave`,
          contactId,
          status: "open",
        }),
      });
    }

    await logActivity({
      orgId: ctx.orgId,
      type: "meeting_booked",
      leadId: lead.id,
      summary: `Synced booked lead ${lead.companyName} to GoHighLevel CRM`,
    });

    return NextResponse.json({ ok: true, contactId });
  } catch (err) {
    console.error("[ghl-sync] Error syncing lead to GHL:", err);
    await logActivity({
      orgId: ctx.orgId,
      type: "ghl_sync_failed",
      leadId: lead.id,
      summary: `GHL CRM sync failed for ${lead.companyName}`,
      meta: { error: err instanceof Error ? err.message : String(err) },
    });
    return NextResponse.json(
      { error: "GHL sync failed", detail: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
