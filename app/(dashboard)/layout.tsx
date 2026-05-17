import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import LogoutButton from "./logout-button";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <div className="flex min-h-screen">
      <aside className="w-56 border-r bg-muted/40 p-4 flex flex-col gap-2">
        <div className="px-2 py-1.5 mb-2">
          <span className="font-semibold text-sm">LeadsWave</span>
        </div>
        <nav className="flex flex-col gap-1 text-sm flex-1">
          <a href="/" className="px-2 py-1.5 rounded hover:bg-muted">Dashboard</a>
          <a href="/campaigns" className="px-2 py-1.5 rounded hover:bg-muted">Campaigns</a>
          <a href="/leads" className="px-2 py-1.5 rounded hover:bg-muted">Leads</a>
          <a href="/inbox" className="px-2 py-1.5 rounded hover:bg-muted">Inbox</a>
          <a href="/settings" className="px-2 py-1.5 rounded hover:bg-muted">Settings</a>
        </nav>
        <div className="mt-auto pt-2 border-t">
          <p className="text-xs text-muted-foreground px-2 mb-2 truncate">
            {session.user.email}
          </p>
          <LogoutButton />
        </div>
      </aside>
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
