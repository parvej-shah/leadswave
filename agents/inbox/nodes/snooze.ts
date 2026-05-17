import { db } from "@/lib/db";
import { InboxState } from "../graph";

export async function snoozeNode(state: InboxState): Promise<Partial<InboxState>> {
  await db.job.updateMany({
    where: { leadId: state.leadId, status: "pending" },
    data: { status: "cancelled" },
  });

  const reEntryDate = new Date();
  reEntryDate.setDate(reEntryDate.getDate() + 60);

  await db.job.create({
    data: {
      leadId: state.leadId,
      type: "re_entry",
      scheduledAt: reEntryDate,
      status: "pending",
    },
  });

  return {};
}
