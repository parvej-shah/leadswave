import { db } from "@/lib/db";

export type ActivityType =
  | "scouted"
  | "opener_sent"
  | "followup_sent"
  | "followup_queued"
  | "reply_hot"
  | "reply_warm"
  | "reply_cold"
  | "bounced"
  | "suppressed"
  | "meeting_booked";

/**
 * Append to the org's activity feed. Fire-and-forget by design: the feed is a
 * trust surface, never a reason for a send/classify path to fail.
 */
export async function logActivity(event: {
  orgId: string | null | undefined;
  type: ActivityType;
  summary: string;
  leadId?: string;
  campaignId?: string;
  meta?: Record<string, unknown>;
}): Promise<void> {
  if (!event.orgId) return;
  try {
    await db.activityEvent.create({
      data: {
        orgId: event.orgId,
        type: event.type,
        summary: event.summary,
        leadId: event.leadId ?? null,
        campaignId: event.campaignId ?? null,
        meta: event.meta as never,
      },
    });
  } catch (e) {
    console.error("[activity] failed to log:", e);
  }
}
