export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <aside className="w-56 border-r bg-muted/40 p-4 flex flex-col gap-2">
        <nav className="flex flex-col gap-1 text-sm">
          <a href="/" className="font-semibold px-2 py-1.5 rounded hover:bg-muted">Dashboard</a>
          <a href="/campaigns" className="px-2 py-1.5 rounded hover:bg-muted">Campaigns</a>
          <a href="/leads" className="px-2 py-1.5 rounded hover:bg-muted">Leads</a>
          <a href="/inbox" className="px-2 py-1.5 rounded hover:bg-muted">Inbox</a>
          <a href="/settings" className="px-2 py-1.5 rounded hover:bg-muted">Settings</a>
        </nav>
      </aside>
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
