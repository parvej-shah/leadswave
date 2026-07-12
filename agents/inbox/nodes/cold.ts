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
    // Scoped find-or-create instead of upsert-by-email: works before AND after
    // the Suppression unique constraint moves from global email to [orgId, email].
    const email = state.lead.email.toLowerCase();
    const existing = await db.suppression.findFirst({
      where: { orgId: state.lead.orgId, email },
    });
    if (!existing) {
      await db.suppression.create({
        data: { orgId: state.lead.orgId, email, reason: "unsubscribed" },
      });
    }
  }

  return {};
}
