import { db } from "@/lib/db";

export type ActivityType =
  | "scouted"
  | "imported"
  | "opener_sent"
  | "followup_sent"
  | "followup_queued"
  | "reply_hot"
  | "reply_warm"
  | "reply_cold"
  | "bounced"
  | "suppressed"
  | "meeting_booked"
  | "error";

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

/**
 * Log an actionable failure for the dashboard's "Needs fixing" strip.
 * `fix` is an in-app href that resolves the problem (e.g. "/settings?tab=keys").
 * `key` dedupes: if the same key was logged in the last 24h, skip — cron reruns
 * must not flood the feed with the same broken-config error.
 */
export async function logError(
  orgId: string | null | undefined,
  summary: string,
  fix?: string,
  key?: string,
): Promise<void> {
  if (!orgId) return;
  try {
    if (key) {
      const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const existing = await db.activityEvent.findFirst({
        where: {
          orgId,
          type: "error",
          createdAt: { gte: dayAgo },
          meta: { path: ["key"], equals: key },
        },
        select: { id: true },
      });
      if (existing) return;
    }
    await logActivity({
      orgId,
      type: "error",
      summary,
      meta: { ...(fix ? { fix } : {}), ...(key ? { key } : {}) },
    });
  } catch (e) {
    console.error("[activity] failed to log error:", e);
  }
}
