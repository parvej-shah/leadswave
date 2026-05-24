import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { Sidebar, type SidebarCampaign } from "./sidebar";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const [campaignsRaw, inboxHotCount] = await Promise.all([
    db.campaign.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: {
        leads: { where: { state: "replied" }, select: { id: true } },
      },
    }),
    db.lead.count({ where: { state: "replied", deletedAt: null } }),
  ]);

  const campaigns: SidebarCampaign[] = campaignsRaw.map((c) => ({
    id: c.id,
    name: c.name,
    status: c.status,
    hot: c.leads.length,
  }));

  return (
    <div className="flex min-h-screen bg-canvas">
      <Sidebar
        userEmail={session.user.email ?? ""}
        userName={session.user.name ?? ""}
        campaigns={campaigns}
        inboxHotCount={inboxHotCount}
      />
      <main className="flex-1 p-6 overflow-auto min-w-0">{children}</main>
    </div>
  );
}
