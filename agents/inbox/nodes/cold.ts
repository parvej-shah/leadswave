import { db } from "@/lib/db";
import { InboxState } from "../graph";

export async function coldNode(state: InboxState): Promise<Partial<InboxState>> {
  await db.lead.update({
    where: { id: state.leadId },
    data: { state: "unsubscribed", lastTouchedAt: new Date() },
  });

  await db.job.updateMany({
    where: { leadId: state.leadId, status: "pending" },
    data: { status: "cancelled" },
  });

  if (state.lead.email) {
    await db.suppression.upsert({
      where: { email: state.lead.email },
      update: {},
      create: { email: state.lead.email, reason: "unsubscribed" },
    });
  }

  return {};
}
