import { db } from "@/lib/db";
import { InboxState } from "../graph";

export async function bounceNode(state: InboxState): Promise<Partial<InboxState>> {
  await db.lead.update({
    where: { id: state.leadId },
    data: { state: "bounced", lastTouchedAt: new Date() },
  });

  await db.job.updateMany({
    where: { leadId: state.leadId, status: "pending" },
    data: { status: "cancelled" },
  });

  if (state.lead.email) {
    await db.suppression.upsert({
      where: { email: state.lead.email },
      update: { reason: "bounced" },
      create: { email: state.lead.email, reason: "bounced" },
    });
  }

  return {};
}
