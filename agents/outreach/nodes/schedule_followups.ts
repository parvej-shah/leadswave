import { db } from "@/lib/db";
import { OutreachState } from "../graph";

const FOLLOWUP_DELAYS_DAYS = [3, 7, 12] as const;
const FOLLOWUP_TYPES = ["followup_2", "followup_3", "followup_4"] as const;

export async function scheduleFollowupsNode(state: OutreachState): Promise<Partial<OutreachState>> {
  const now = new Date();

  await db.job.createMany({
    data: FOLLOWUP_DELAYS_DAYS.map((days, i) => {
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

  return {};
}
