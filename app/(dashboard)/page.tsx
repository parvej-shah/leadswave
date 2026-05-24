import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { Badge, Button, Card, CardHeader, EmptyState, Icon, KPI } from "@/components/ui";
import { RunFollowupsButton } from "./run-followups-button";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const [totalLeads, totalEmailsSent, meetingsBooked, totalReplies, campaigns] = await Promise.all([
    db.lead.count({ where: { deletedAt: null } }),
    db.message.count({ where: { direction: "outbound" } }),
    db.lead.count({ where: { state: "meeting_booked" } }),
    db.message.count({ where: { direction: "inbound" } }),
    db.campaign.findMany({
      where: { deletedAt: null },
      include: { leads: { include: { messages: true } } },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const hotLeads = await db.lead.count({ where: { state: "replied" } });
  const replyRate =
    totalEmailsSent > 0 ? ((totalReplies / totalEmailsSent) * 100).toFixed(1) : "0.0";

  const campaignStats = campaigns.map((c) => {
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
    return { id: c.id, name: c.name, status: c.status, sent, replies, hot, meetings };
  });
  const activeCount = campaignStats.filter((c) => c.status === "active").length;

  const recentActivity = campaigns
    .flatMap((c) => c.leads.map((l) => ({ ...l, campaignName: c.name })))
    .filter((l) => ["replied", "meeting_booked", "contacted"].includes(l.state))
    .sort((a, b) => (b.lastTouchedAt?.getTime() ?? 0) - (a.lastTouchedAt?.getTime() ?? 0))
    .slice(0, 8);

  const kpis: Array<Parameters<typeof KPI>[0]> = [
    { label: "Total Leads", value: totalLeads, valueColor: "var(--fg-1)" },
    { label: "Emails Sent", value: totalEmailsSent, valueColor: "var(--fg-1)" },
    { label: "Reply Rate", value: `${replyRate}%`, valueColor: "var(--success)" },
    { label: "Hot Leads", value: hotLeads, valueColor: "var(--hot)" },
    { label: "Meetings", value: meetingsBooked, valueColor: "var(--info)" },
  ];

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="ds-h1 m-0 mb-1.5">Dashboard</h1>
          <p className="font-mono text-[12px] text-fg-4 m-0 flex items-center gap-2">
            <span className="w-[5px] h-[5px] rounded-full bg-success ds-pulse shrink-0" />
            <span>
              Live · {activeCount} active campaign{activeCount === 1 ? "" : "s"}
            </span>
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <RunFollowupsButton />
          <Link href="/campaigns/new">
            <Button iconStart="plus">New Campaign</Button>
          </Link>
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-5 gap-3">
        {kpis.map((k) => (
          <KPI key={k.label} {...k} />
        ))}
      </div>

      {/* Body grid */}
      <div className="grid grid-cols-[1.6fr_1fr] gap-4">
        {/* Campaign Health */}
        <Card>
          <CardHeader
            action={
              <div className="flex items-center gap-2.5">
                <span className="font-mono text-[10px] text-fg-4 tracking-[0.08em] uppercase">
                  {activeCount} ACTIVE
                </span>
                <Link href="/campaigns">
                  <Button variant="ghost" size="sm" iconEnd="arrow">
                    View all
                  </Button>
                </Link>
              </div>
            }
          >
            Campaign Health
          </CardHeader>
          {campaignStats.length === 0 ? (
            <div className="p-5">
              <EmptyState action={{ label: "Launch your first campaign →", href: "/campaigns/new" }}>
                No campaigns yet.
              </EmptyState>
            </div>
          ) : (
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-border">
                  {["Campaign", "Sent", "Reply %", "Hot", "Meetings", ""].map((h) => (
                    <th
                      key={h}
                      className="px-5 py-2.5 text-left font-mono text-[10px] uppercase tracking-[0.08em] text-fg-4 font-normal"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {campaignStats.slice(0, 6).map((c) => {
                  const rate = c.sent > 0 ? (c.replies / c.sent) * 100 : 0;
                  const isHealthy = rate > 10;
                  return (
                    <tr key={c.id} className="border-b border-border-soft last:border-b-0">
                      <td className="px-5 py-3">
                        <Link
                          href={`/campaigns/${c.id}`}
                          className="flex items-center gap-2.5 group"
                        >
                          <span
                            className="w-[5px] h-[5px] rounded-full shrink-0"
                            style={{
                              background:
                                c.status === "active" ? "var(--success)" : "var(--fg-5)",
                            }}
                          />
                          <span className="font-mono text-[13px] text-fg-1 group-hover:text-amber transition-colors duration-150">
                            {c.name}
                          </span>
                        </Link>
                      </td>
                      <td className="px-5 py-3 font-mono text-[13px] text-fg-3 tabular-nums">
                        {c.sent}
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <span
                            className="font-mono text-[13px] tabular-nums min-w-[36px]"
                            style={{
                              color: isHealthy ? "var(--success)" : "var(--fg-2)",
                            }}
                          >
                            {rate.toFixed(1)}%
                          </span>
                          <div className="w-12 h-1 bg-[oklch(0.18_0_0)] rounded-sm overflow-hidden">
                            <div
                              className="h-full"
                              style={{
                                width: `${Math.min(rate * 4, 100)}%`,
                                background: isHealthy ? "var(--success)" : "var(--amber)",
                              }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        {c.hot > 0 ? (
                          <Badge variant="hot">{c.hot}</Badge>
                        ) : (
                          <span className="text-fg-5">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        {c.meetings > 0 ? (
                          <Badge variant="info">{c.meetings}</Badge>
                        ) : (
                          <span className="text-fg-5">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-right">
                        <Icon name="chevron" size={12} className="text-fg-5 inline" />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </Card>

        {/* Activity */}
        <Card>
          <CardHeader
            action={
              <span className="flex items-center gap-1.5 font-mono text-[10px] text-success tracking-[0.08em] uppercase">
                <span className="w-[5px] h-[5px] rounded-full bg-success ds-pulse" />
                LIVE
              </span>
            }
          >
            Activity
          </CardHeader>
          {recentActivity.length === 0 ? (
            <div className="p-5">
              <EmptyState>No activity yet.</EmptyState>
            </div>
          ) : (
            <div>
              {recentActivity.map((lead) => {
                const cfg =
                  lead.state === "replied"
                    ? { dot: "var(--hot)" }
                    : lead.state === "meeting_booked"
                    ? { dot: "var(--info)" }
                    : { dot: "var(--fg-4)" };
                return (
                  <div
                    key={lead.id}
                    className="flex items-start gap-3 px-5 py-2 hover:bg-[oklch(0.115_0_0)] transition-colors duration-150"
                  >
                    <span
                      className="w-1.5 h-1.5 rounded-full mt-[7px] shrink-0"
                      style={{ background: cfg.dot }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-sans text-[13px] text-fg-3 m-0 leading-[1.4]">
                        {lead.state === "replied" && (
                          <>
                            Hot reply from{" "}
                            <strong className="text-fg-1 font-medium">
                              {lead.companyName}
                            </strong>
                          </>
                        )}
                        {lead.state === "meeting_booked" && (
                          <>
                            Meeting booked with{" "}
                            <strong className="text-fg-1 font-medium">
                              {lead.companyName}
                            </strong>
                          </>
                        )}
                        {lead.state === "contacted" && (
                          <>
                            Emailed{" "}
                            <strong className="text-fg-2 font-medium">
                              {lead.companyName}
                            </strong>
                          </>
                        )}
                      </p>
                      <p className="font-mono text-[10px] text-fg-5 m-0 mt-0.5 tracking-[0.04em]">
                        {lead.lastTouchedAt
                          ? relativeTime(lead.lastTouchedAt)
                          : ""}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function relativeTime(date: Date): string {
  const diff = Date.now() - new Date(date).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}
