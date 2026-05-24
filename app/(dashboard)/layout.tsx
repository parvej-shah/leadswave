import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import LogoutButton from "./logout-button";
import SidebarNav from "./sidebar-nav";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <div className="flex min-h-screen" style={{ background: "oklch(0.09 0 0)" }}>
      <aside
        className="w-56 shrink-0 flex flex-col p-4 gap-2"
        style={{ borderRight: "1px solid oklch(0.18 0 0)", background: "oklch(0.10 0 0)" }}
      >
        <div className="px-2 py-1.5 mb-2">
          <span
            className="font-semibold text-sm"
            style={{ color: "oklch(0.88 0 0)", fontFamily: "'DM Mono', monospace" }}
          >
            LeadsWave
          </span>
        </div>
        <SidebarNav />
        <div
          className="mt-auto pt-2"
          style={{ borderTop: "1px solid oklch(0.18 0 0)" }}
        >
          <p
            className="text-xs px-2 mb-2 truncate"
            style={{ color: "oklch(0.40 0 0)", fontFamily: "'DM Mono', monospace" }}
          >
            {session.user.email}
          </p>
          <LogoutButton />
        </div>
      </aside>
      <main className="flex-1 p-6 overflow-auto">{children}</main>
    </div>
  );
}
