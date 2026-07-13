import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { Button, EmptyState } from "@/components/ui";
import { type CampaignRowData } from "./campaign-row";
import { CampaignGroup, type CampaignGroupData } from "./campaign-group";
import { StatusFilter, type StatusFilter as StatusFilterValue } from "./status-filter";

const VALID_STATUSES = new Set<StatusFilterValue>(["all", "active", "paused", "completed"]);

export default async function CampaignsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const orgId = session.orgId;
  if (!orgId) redirect("/login");

  const params = await searchParams;
  const filter: StatusFilterValue = VALID_STATUSES.has(params.status as StatusFilterValue)
    ? (params.status as StatusFilterValue)
    : "all";

  const campaigns = await db.campaign.findMany({
    where: {
      orgId,
      deletedAt: null,
      ...(filter !== "all" ? { status: filter } : {}),
    },
    include: {
      leads: { include: { messages: true } },
      businessTypeRef: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  type Row = CampaignRowData & { typeId: string | null; typeName: string };
  const rows: Row[] = campaigns.map((c) => {
    let sent = 0,
      replies = 0,
      hot = 0,
      meetings = 0;
    c.leads.forEach((l) => {
      sent += l.messages.filter((m) => m.direction === "outbound").length;
      replies += l.messages.filter((m) => m.direction === "inbound").length;
      if (l.state === "replied") hot++;
      if (l.state === "meeting_booked") meetings++;
    });
    return {
      id: c.id,
      name: c.name,
      query: c.query,
      location: c.location,
      status: c.status,
      leads: c.leads.length,
      sent,
      replies,
      hot,
      meetings,
      createdAt: c.createdAt.toISOString(),
      typeId: c.businessTypeRef?.id ?? null,
      typeName: c.businessTypeRef?.name ?? c.businessType ?? "Uncategorized",
    };
  });

  // Group by business type; typed groups first (alpha), untyped last.
  const groupMap = new Map<string, CampaignGroupData>();
  for (const r of rows) {
    const key = r.typeId ?? "__none__";
    let g = groupMap.get(key);
    if (!g) {
      g = { typeId: r.typeId, typeName: r.typeName, campaigns: [], leads: 0 };
      groupMap.set(key, g);
    }
    g.campaigns.push(r);
    g.leads += r.leads;
  }
  const groups = Array.from(groupMap.values()).sort((a, b) => {
    if (!a.typeId) return 1;
    if (!b.typeId) return -1;
    return a.typeName.localeCompare(b.typeName);
  });

  // Totals computed across the filtered view
  const totals = rows.reduce(
    (acc, r) => {
      acc.leads += r.leads;
      acc.sent += r.sent;
      acc.replies += r.replies;
      return acc;
    },
    { leads: 0, sent: 0, replies: 0 }
  );

  const activeCount = rows.filter((c) => c.status === "active").length;

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="ds-h1 m-0 mb-1">Campaigns</h1>
          <p className="font-mono text-[12px] text-fg-4 m-0">
            {activeCount} active · scouting{" "}
            <span className="text-fg-2">{totals.leads}</span> leads ·{" "}
            <span className="text-success">{totals.replies}</span> replies
          </p>
        </div>
        <div className="flex items-center flex-wrap gap-2">
          <StatusFilter current={filter} />
          <Link href="/business-types">
            <Button variant="secondary" iconStart="layers">Business types</Button>
          </Link>
          <Link href="/campaigns/new">
            <Button iconStart="plus">New Campaign</Button>
          </Link>
        </div>
      </div>

      {/* Rows */}
      {rows.length === 0 ? (
        <EmptyState
          action={{ label: "Launch your first campaign →", href: "/campaigns/new" }}
        >
          {filter === "all"
            ? "No campaigns yet."
            : `No ${filter} campaigns.`}
        </EmptyState>
      ) : (
        <div className="flex flex-col gap-6">
          {groups.map((g) => (
            <CampaignGroup key={g.typeId ?? "__none__"} group={g} />
          ))}
        </div>
      )}
    </div>
  );
}
