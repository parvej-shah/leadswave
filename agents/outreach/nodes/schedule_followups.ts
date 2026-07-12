import { db } from "@/lib/db";
import { OutreachState } from "../graph";
import { logActivity } from "@/lib/activity";

// Job types in step order; caps the sequence at 3 follow-ups.
const FOLLOWUP_TYPES = ["followup_2", "followup_3", "followup_4"] as const;
const DEFAULT_OFFSETS = [3];
const MIN_GAP_DAYS = 2;

export async function scheduleFollowupsNode(state: OutreachState): Promise<Partial<OutreachState>> {
  const now = new Date();

  // Per-campaign cadence (Campaign.followupOffsets = days after the opener).
  // Loaded here rather than from graph state because this node is also called
  // standalone from the manual-send route with a partial state.
  const lead = await db.lead.findUnique({
    where: { id: state.leadId },
    select: { orgId: true, companyName: true, campaign: { select: { followupOffsets: true } } },
  });

  // Sanitize: ascending, min 2-day gaps, max 3 steps — silent bad data must
  // never produce a burst of same-day follow-ups.
  const raw = lead?.campaign.followupOffsets?.length ? lead.campaign.followupOffsets : DEFAULT_OFFSETS;
  const offsets: number[] = [];
  for (const d of [...raw].sort((a, b) => a - b)) {
    if (!Number.isFinite(d) || d < MIN_GAP_DAYS) continue;
    if (offsets.length > 0 && d - offsets[offsets.length - 1] < MIN_GAP_DAYS) continue;
    offsets.push(Math.round(d));
    if (offsets.length >= FOLLOWUP_TYPES.length) break;
  }
  if (offsets.length === 0) offsets.push(...DEFAULT_OFFSETS);

  await db.job.createMany({
    data: offsets.map((days, i) => {
      const scheduledAt = new Date(now);
      scheduledAt.setDate(scheduledAt.getDate() + days);
      return {
        leadId: state.leadId,
        type: FOLLOWUP_TYPES[i],
        scheduledAt,
        status: "pending",
      };
    }),
  });

  if (lead) {
    await logActivity({
      orgId: lead.orgId,
      type: "followup_queued",
      leadId: state.leadId,
      summary: `Queued ${offsets.length} follow-up${offsets.length === 1 ? "" : "s"} for ${lead.companyName} (day${offsets.length === 1 ? "" : "s"} ${offsets.join(", ")})`,
    });
  }

  return {};
}
