import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { Sidebar, type SidebarCampaign } from "./sidebar";
import { MobileTabBar } from "./mobile-tab-bar";
import { MobileTopBar } from "./mobile-top-bar";
import { CommandPalette } from "./command-palette";
import { Toaster } from "@/components/ui/toaster";
import { NavigationLoader } from "@/components/navigation-loader";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const orgId = session.orgId;
  if (!orgId) redirect("/login");

  const [campaignsRaw, inboxHotCount] = await Promise.all([
    db.campaign.findMany({
      where: { orgId, deletedAt: null },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: {
        leads: { where: { state: "replied" }, select: { id: true } },
      },
    }),
    db.lead.count({ where: { orgId, state: "replied", deletedAt: null } }),
  ]);

  const campaigns: SidebarCampaign[] = campaignsRaw.map((c) => ({
    id: c.id,
    name: c.name,
    status: c.status,
    hot: c.leads.length,
  }));

  return (
    <Toaster>
      <NavigationLoader />
      <div className="flex min-h-screen bg-canvas">
      <Sidebar
        userEmail={session.user.email ?? ""}
        userName={session.user.name ?? ""}
        campaigns={campaigns}
        inboxHotCount={inboxHotCount}
      />
      <div className="flex-1 flex flex-col min-w-0">
        <MobileTopBar
          userEmail={session.user.email ?? ""}
          userName={session.user.name ?? ""}
        />
        <main className="flex-1 p-4 md:p-6 pb-20 lg:pb-6 overflow-auto min-w-0">
          {children}
        </main>
      </div>
      <MobileTabBar inboxHotCount={inboxHotCount} />
      <CommandPalette campaigns={campaigns.map((c) => ({ id: c.id, name: c.name }))} />
    </div>
    </Toaster>
  );
}
