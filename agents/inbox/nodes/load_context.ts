import { db } from "@/lib/db";
import { InboxState } from "../graph";

export async function loadContextNode(state: InboxState): Promise<Partial<InboxState>> {
  const lead = await db.lead.findUnique({
    where: { id: state.leadId },
    include: {
      campaign: {
        include: {
          offers: { orderBy: { order: "asc" } },
        },
      },
      messages: {
        orderBy: { sentAt: "asc" },
        select: { id: true, direction: true, subject: true, body: true },
      },
    },
  });

  if (!lead) throw new Error(`Lead not found: ${state.leadId}`);

  return {
    lead: {
      id: lead.id,
      orgId: lead.orgId,
      companyName: lead.companyName,
      email: lead.email,
      state: lead.state,
      category: lead.category,
    },
    campaign: {
      id: lead.campaign.id,
      name: lead.campaign.name,
      offerText: lead.campaign.offerText,
      websiteOffer: lead.campaign.websiteOffer,
      crmOffer: lead.campaign.crmOffer,
      offers: lead.campaign.offers,
    },
    priorMessages: lead.messages,
  };
}
