import React from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { Badge, Button, Card, CardHeader, EmptyState, Icon, KPI } from "@/components/ui";
import { RunFollowupsButton } from "./run-followups-button";
import { DashboardPeriodSwitcher } from "./dashboard-period-switcher";
import { FollowupQueue } from "./followup-queue";

type Period = "24h" | "7d" | "30d" | "ytd";

function periodWindow(period: Period): Date {
  const now = new Date();
  switch (period) {
    case "24h":
      return new Date(now.getTime() - 24 * 60 * 60 * 1000);
    case "7d":
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    case "30d":
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    case "ytd":
      return new Date(now.getFullYear(), 0, 1);
  }
}

// Returns array of `days` buckets (oldest→newest), each = count of rows where
// createdAt falls in that UTC day. Used for sparklines.
async function sparkBuckets(
  table: "message" | "lead",
  days: number,
  where?: Record<string, unknown>
): Promise<number[]> {
  const buckets: number[] = [];
  const now = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const dayStart = new Date(now);
    dayStart.setUTCHours(0, 0, 0, 0);
    dayStart.setUTCDate(dayStart.getUTCDate() - i);
    const dayEnd = new Date(dayStart);
    dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);

    const count =
      table === "message"
        ? await db.message.count({
            where: { ...where, sentAt: { gte: dayStart, lt: dayEnd } },
          })
        : await db.lead.count({
            where: { ...where, createdAt: { gte: dayStart, lt: dayEnd } },
          });
    buckets.push(count);
  }
  return buckets;
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const orgId = session.orgId;
  if (!orgId) redirect("/login");

  const { period: rawPeriod } = await searchParams;
  const period: Period =
    rawPeriod === "24h" || rawPeriod === "30d" || rawPeriod === "ytd"
      ? rawPeriod
      : "7d";
  const since = periodWindow(period);

  // Core counts — period-scoped
  const [
    totalLeads,
    totalEmailsSent,
    meetingsBooked,
    totalReplies,
    hotLeads,
    campaigns,
    // Spark buckets (always 7 days for KPI sparklines)
    sentSpark,
    replySpark,
    hotSpark,
    meetingSpark,
    leadSpark,
    // Needs-attention
    todayMeetings,
    scoutsNeedingReview,
  ] = await Promise.all([
    db.lead.count({ where: { orgId, deletedAt: null, createdAt: { gte: since } } }),
    db.message.count({ where: { direction: "outbound", sentAt: { gte: since }, lead: { orgId } } }),
    db.lead.count({ where: { orgId, state: "meeting_booked", deletedAt: null, lastTouchedAt: { gte: since } } }),
    db.message.count({ where: { direction: "inbound", sentAt: { gte: since }, lead: { orgId } } }),
    db.lead.count({ where: { orgId, state: "replied", deletedAt: null } }),
    db.campaign.findMany({
      where: { orgId, deletedAt: null },
      include: { leads: { include: { messages: true } } },
      orderBy: { createdAt: "desc" },
    }),
    sparkBuckets("message", 7, { direction: "outbound", lead: { orgId } }),
    sparkBuckets("message", 7, { direction: "inbound", lead: { orgId } }),
    // hot replies: inbound messages from replied leads — approximate via lead.state
    (async () => {
      const buckets: number[] = [];
      const now = new Date();
      for (let i = 6; i >= 0; i--) {
        const dayStart = new Date(now);
        dayStart.setUTCHours(0, 0, 0, 0);
        dayStart.setUTCDate(dayStart.getUTCDate() - i);
        const dayEnd = new Date(dayStart);
        dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);
        const c = await db.lead.count({ where: { orgId, state: "replied", deletedAt: null, lastTouchedAt: { gte: dayStart, lt: dayEnd } } });
        buckets.push(c);
      }
      return buckets;
    })(),
    (async () => {
      const buckets: number[] = [];
      const now = new Date();
      for (let i = 6; i >= 0; i--) {
        const dayStart = new Date(now);
        dayStart.setUTCHours(0, 0, 0, 0);
        dayStart.setUTCDate(dayStart.getUTCDate() - i);
        const dayEnd = new Date(dayStart);
        dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);
        const c = await db.lead.count({ where: { orgId, state: "meeting_booked", deletedAt: null, lastTouchedAt: { gte: dayStart, lt: dayEnd } } });
        buckets.push(c);
      }
      return buckets;
    })(),
    sparkBuckets("lead", 7, { orgId, deletedAt: null }),
    // Today's meetings (CalendarEvent starting today)
    db.calendarEvent.count({
      where: {
        lead: { orgId },
        startTime: {
          gte: new Date(new Date().setUTCHours(0, 0, 0, 0)),
          lt: new Date(new Date().setUTCHours(23, 59, 59, 999)),
        },
      },
    }),
    // Scouts needing review: leads in "discovered" state not yet contacted
    db.lead.count({
      where: { orgId, state: "discovered", deletedAt: null },
    }),
  ]);

  // Trust surfaces: real activity events + deliverability health
  const dayStart = new Date(new Date().setUTCHours(0, 0, 0, 0));
  const [events, bouncedCount, complainedCount, suppressedCount, sentToday, orgSettings] =
    await Promise.all([
      db.activityEvent.findMany({
        where: { orgId },
        orderBy: { createdAt: "desc" },
        take: 12,
      }),
      db.message.count({ where: { deliveryStatus: "bounced", lead: { orgId } } }),
      db.message.count({ where: { deliveryStatus: "complained", lead: { orgId } } }),
      db.suppression.count({ where: { orgId } }),
      db.message.count({ where: { direction: "outbound", sentAt: { gte: dayStart }, lead: { orgId } } }),
      db.settings.findUnique({ where: { orgId }, select: { dailySendLimit: true, fromEmail: true } }),
    ]);
  // Fresh org (no campaigns, no sending config): guide instead of blank charts.
  if (campaigns.length === 0 && !orgSettings?.fromEmail) redirect("/onboarding");

  const dailyLimit = orgSettings?.dailySendLimit ?? 100;
  const allOutbound = await db.message.count({ where: { direction: "outbound", lead: { orgId } } });
  const bounceRate = allOutbound > 0 ? ((bouncedCount / allOutbound) * 100).toFixed(1) : "0.0";

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

  // Activity — group by Today / Yesterday / Earlier
  const recentActivity = campaigns
    .flatMap((c) => c.leads.map((l) => ({ ...l, campaignName: c.name })))
    .filter((l) => ["replied", "meeting_booked", "contacted"].includes(l.state))
    .sort((a, b) => (b.lastTouchedAt?.getTime() ?? 0) - (a.lastTouchedAt?.getTime() ?? 0))
    .slice(0, 10);

  const kpis: Array<Parameters<typeof KPI>[0]> = [
    {
      label: "Total Leads",
      value: totalLeads,
      valueColor: "var(--fg-1)",
      spark: leadSpark,
      sparkColor: "var(--fg-3)",
    },
    {
      label: "Emails Sent",
      value: totalEmailsSent,
      valueColor: "var(--fg-1)",
      spark: sentSpark,
      sparkColor: "var(--fg-3)",
    },
    {
      label: "Reply Rate",
      value: `${replyRate}%`,
      valueColor: "var(--success)",
      spark: replySpark,
      sparkColor: "var(--success)",
    },
    {
      label: "Hot Leads",
      value: hotLeads,
      valueColor: "var(--hot)",
      spark: hotSpark,
      sparkColor: "var(--hot)",
    },
    {
      label: "Meetings",
      value: meetingsBooked,
      valueColor: "var(--info)",
      spark: meetingSpark,
      sparkColor: "var(--info)",
    },
  ];

  // Needs-attention items — only show non-zero ones
  const attentionItems: AttentionItem[] = [
    ...(hotLeads > 0
      ? [
          {
            kind: "hot" as const,
            title: `${hotLeads} HOT repl${hotLeads === 1 ? "y" : "ies"} waiting`,
            subtitle: "Reply to maintain momentum",
            actionLabel: "Triage now",
            href: "/inbox",
          },
        ]
      : []),
    ...(todayMeetings > 0
      ? [
          {
            kind: "meeting" as const,
            title: `${todayMeetings} meeting${todayMeetings === 1 ? "" : "s"} today`,
            subtitle: "Calendar events scheduled",
            actionLabel: "View calendar",
            href: "/settings?tab=calendar",
          },
        ]
      : []),
    ...(scoutsNeedingReview > 0
      ? [
          {
            kind: "scout" as const,
            title: `${scoutsNeedingReview} leads pending review`,
            subtitle: "Discovered leads not yet contacted",
            actionLabel: "Review",
            href: "/leads",
          },
        ]
      : []),
  ].slice(0, 3);

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="ds-h1 m-0 mb-1.5">Dashboard</h1>
          <p className="font-mono text-[12px] text-fg-4 m-0 flex items-center gap-2">
            <span className="w-[5px] h-[5px] rounded-full bg-success ds-pulse shrink-0" />
            <span>
              Live · {activeCount} active campaign{activeCount === 1 ? "" : "s"}
            </span>
          </p>
        </div>
        <div className="flex items-center flex-wrap gap-2.5">
          <DashboardPeriodSwitcher />
          <RunFollowupsButton />
          <Link href="/campaigns/new">
            <Button iconStart="plus">New Campaign</Button>
          </Link>
        </div>
      </div>

      {/* Needs attention */}
      {attentionItems.length > 0 && <NeedsAttention items={attentionItems} />}

      {/* KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {kpis.map((k) => (
          <KPI key={k.label} {...k} />
        ))}
      </div>

      {/* Body grid */}
      <div className="grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] gap-4">
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
            <>
            <table className="hidden md:table w-full border-collapse">
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

            {/* Campaign health — mobile cards (below md) */}
            <div className="md:hidden flex flex-col gap-2.5 p-3">
              {campaignStats.slice(0, 6).map((c) => {
                const rate = c.sent > 0 ? (c.replies / c.sent) * 100 : 0;
                const isHealthy = rate > 10;
                return (
                  <Link
                    key={c.id}
                    href={`/campaigns/${c.id}`}
                    className="bg-[oklch(0.12_0_0)] border border-border rounded-lg p-3 flex flex-col gap-2.5 hover:border-border-strong transition-colors duration-150"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="w-[5px] h-[5px] rounded-full shrink-0"
                        style={{ background: c.status === "active" ? "var(--success)" : "var(--fg-5)" }}
                      />
                      <span className="font-mono text-[13px] text-fg-1 truncate flex-1">{c.name}</span>
                      <Icon name="chevron" size={12} className="text-fg-5 shrink-0" />
                    </div>
                    <div className="grid grid-cols-4 gap-2">
                      <MobileStat label="Sent" value={String(c.sent)} />
                      <MobileStat
                        label="Reply"
                        value={`${rate.toFixed(0)}%`}
                        color={isHealthy ? "var(--success)" : undefined}
                      />
                      <MobileStat label="Hot" value={c.hot > 0 ? String(c.hot) : "—"} color={c.hot > 0 ? "var(--hot)" : undefined} />
                      <MobileStat label="Mtgs" value={c.meetings > 0 ? String(c.meetings) : "—"} color={c.meetings > 0 ? "var(--info)" : undefined} />
                    </div>
                  </Link>
                );
              })}
            </div>
            </>
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
          {events.length > 0 ? (
            <EventStream events={events} />
          ) : recentActivity.length === 0 ? (
            <div className="p-5">
              <EmptyState>No activity yet.</EmptyState>
            </div>
          ) : (
            <ActivityStream items={recentActivity} />
          )}
        </Card>
      </div>

      {/* Trust row: what sends next + how healthy sending is */}
      <div className="grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] gap-4">
        <FollowupQueue />
        <Card>
          <CardHeader>Deliverability</CardHeader>
          <div className="p-5 grid grid-cols-2 gap-4">
            <DeliverabilityStat
              label="Sends today"
              value={`${sentToday} / ${dailyLimit}`}
              tone={sentToday >= dailyLimit ? "warn" : "ok"}
            />
            <DeliverabilityStat
              label="Bounce rate"
              value={`${bounceRate}%`}
              tone={Number(bounceRate) > 5 ? "warn" : "ok"}
            />
            <DeliverabilityStat
              label="Complaints"
              value={String(complainedCount)}
              tone={complainedCount > 0 ? "warn" : "ok"}
            />
            <DeliverabilityStat label="Suppressed" value={String(suppressedCount)} tone="neutral" />
          </div>
          <p className="font-mono text-[10px] text-fg-5 m-0 px-5 pb-4">
            Suppressed addresses are never contacted again. Daily caps and send throttling
            protect your sender reputation.
          </p>
        </Card>
      </div>
    </div>
  );
}

function DeliverabilityStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "ok" | "warn" | "neutral";
}) {
  const color = tone === "warn" ? "var(--hot)" : tone === "ok" ? "var(--success)" : "var(--fg-2)";
  return (
    <div>
      <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-fg-4 m-0 mb-1">{label}</p>
      <p className="font-mono text-[18px] m-0" style={{ color }}>{value}</p>
    </div>
  );
}

const EVENT_DOT: Record<string, string> = {
  reply_hot: "var(--hot)",
  meeting_booked: "var(--info)",
  bounced: "var(--hot)",
  suppressed: "var(--hot)",
  reply_cold: "var(--fg-5)",
  scouted: "var(--success)",
};

function EventStream({
  events,
}: {
  events: { id: string; type: string; summary: string; createdAt: Date }[];
}) {
  let lastGroup = "";
  const rows: React.ReactElement[] = [];
  for (const ev of events) {
    const group = activityGroup(ev.createdAt);
    if (group !== lastGroup) {
      lastGroup = group;
      rows.push(
        <div
          key={`g-${group}`}
          className="px-5 pt-2.5 pb-1 font-mono text-[9px] uppercase tracking-[0.10em] text-fg-5"
        >
          {group}
        </div>
      );
    }
    rows.push(
      <div key={ev.id} className="flex items-start gap-3 px-5 py-2 hover:bg-[oklch(0.115_0_0)] transition-colors duration-150">
        <span
          className="w-1.5 h-1.5 rounded-full mt-[7px] shrink-0"
          style={{ background: EVENT_DOT[ev.type] ?? "var(--fg-4)" }}
        />
        <div className="flex-1 min-w-0">
          <p className="font-sans text-[13px] text-fg-3 m-0 leading-[1.4]">{ev.summary}</p>
          <p className="font-mono text-[10px] text-fg-5 m-0 mt-0.5 tracking-[0.04em]">
            {relativeTime(ev.createdAt)}
          </p>
        </div>
      </div>
    );
  }
  return <div className="py-1">{rows}</div>;
}

// ─── NeedsAttention ───────────────────────────────────────────────────────────

type AttentionKind = "hot" | "meeting" | "scout";
type AttentionItem = {
  kind: AttentionKind;
  title: string;
  subtitle: string;
  actionLabel: string;
  href: string;
};

const ATTENTION_CFG: Record<
  AttentionKind,
  { color: string; bg: string; border: string; icon: string; tag: string }
> = {
  hot: {
    color: "var(--hot)",
    bg: "var(--hot-tinted-surface)",
    border: "var(--hot-border)",
    icon: "🔥",
    tag: "HOT",
  },
  meeting: {
    color: "var(--info)",
    bg: "var(--info-tinted-surface)",
    border: "var(--info-border)",
    icon: "📅",
    tag: "MEETING",
  },
  scout: {
    color: "var(--amber)",
    bg: "var(--amber-tinted-surface)",
    border: "var(--amber-border)",
    icon: "✦",
    tag: "REVIEW",
  },
};

function NeedsAttention({ items }: { items: AttentionItem[] }) {
  return (
    <div className="bg-surface border border-border rounded-xl overflow-hidden">
      {/* Header bar */}
      <div className="flex items-center gap-2.5 px-[18px] py-2.5 border-b border-border bg-[oklch(0.115_0_0)]">
        <Icon name="pulse" size={13} className="text-amber shrink-0" />
        <span className="font-mono text-[11px] text-fg-2 uppercase tracking-[0.10em] font-semibold">
          Needs your attention
        </span>
        <span className="ml-auto font-mono text-[10px] text-fg-4">
          {items.length} item{items.length === 1 ? "" : "s"}
        </span>
      </div>

      {/* Tiles grid */}
      <div
        className="grid grid-cols-1 sm:[grid-template-columns:var(--attention-cols)]"
        style={{ ["--attention-cols" as string]: `repeat(${items.length}, 1fr)` }}
      >
        {items.map((item, i) => {
          const cfg = ATTENTION_CFG[item.kind];
          return (
            <div
              key={item.kind}
              className="flex flex-col gap-2.5 p-5 border-b border-border-soft last:border-b-0 sm:border-b-0"
              style={{
                borderRight: i < items.length - 1 ? "1px solid var(--border-soft)" : "none",
              }}
            >
              {/* Icon + tag */}
              <div className="flex items-center gap-2.5">
                <span
                  className="w-7 h-7 rounded-md flex items-center justify-center text-sm shrink-0"
                  style={{
                    background: cfg.bg,
                    border: `1px solid ${cfg.border}`,
                    color: cfg.color,
                  }}
                >
                  {cfg.icon}
                </span>
                <span
                  className="font-mono text-[10px] uppercase tracking-[0.10em] font-semibold"
                  style={{ color: cfg.color }}
                >
                  {cfg.tag}
                </span>
              </div>

              {/* Text */}
              <div>
                <p className="font-sans text-[14px] text-fg-1 m-0 mb-[3px] font-medium leading-[1.35] tracking-[-0.01em]">
                  {item.title}
                </p>
                <p className="font-mono text-[11px] text-fg-4 m-0 leading-[1.5]">
                  {item.subtitle}
                </p>
              </div>

              {/* Action link */}
              <Link
                href={item.href}
                className="mt-auto font-mono text-[11px] inline-flex items-center gap-1 transition-opacity duration-150 hover:opacity-80"
                style={{ color: cfg.color }}
              >
                {item.actionLabel}
                <Icon name="arrow" size={11} />
              </Link>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── ActivityStream ───────────────────────────────────────────────────────────

type ActivityLead = {
  id: string;
  state: string;
  companyName: string;
  lastTouchedAt: Date | null;
};

function activityGroup(date: Date | null): string {
  if (!date) return "Earlier";
  const now = new Date();
  const d = new Date(date);
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yestStart = new Date(todayStart.getTime() - 86400000);
  if (d >= todayStart) return "Today";
  if (d >= yestStart) return "Yesterday";
  return "Earlier";
}

function ActivityStream({ items }: { items: ActivityLead[] }) {
  let lastGroup = "";
  const rows: React.ReactElement[] = [];

  for (const lead of items) {
    const group = activityGroup(lead.lastTouchedAt);
    if (group !== lastGroup) {
      lastGroup = group;
      rows.push(
        <div
          key={`g-${group}`}
          className="px-5 pt-2.5 pb-1 font-mono text-[9px] uppercase tracking-[0.10em] text-fg-5"
        >
          {group}
        </div>
      );
    }

    const dotColor =
      lead.state === "replied"
        ? "var(--hot)"
        : lead.state === "meeting_booked"
        ? "var(--info)"
        : "var(--fg-4)";

    rows.push(
      <div
        key={lead.id}
        className="flex items-start gap-3 px-5 py-2 hover:bg-[oklch(0.115_0_0)] transition-colors duration-150"
      >
        <span
          className="w-1.5 h-1.5 rounded-full mt-[7px] shrink-0"
          style={{ background: dotColor }}
        />
        <div className="flex-1 min-w-0">
          <p className="font-sans text-[13px] text-fg-3 m-0 leading-[1.4]">
            {lead.state === "replied" && (
              <>
                Hot reply from{" "}
                <strong className="text-fg-1 font-medium">{lead.companyName}</strong>
              </>
            )}
            {lead.state === "meeting_booked" && (
              <>
                Meeting booked with{" "}
                <strong className="text-fg-1 font-medium">{lead.companyName}</strong>
              </>
            )}
            {lead.state === "contacted" && (
              <>
                Emailed{" "}
                <strong className="text-fg-2 font-medium">{lead.companyName}</strong>
              </>
            )}
          </p>
          <p className="font-mono text-[10px] text-fg-5 m-0 mt-0.5 tracking-[0.04em]">
            {lead.lastTouchedAt ? relativeTime(lead.lastTouchedAt) : ""}
          </p>
        </div>
      </div>
    );
  }

  return <div>{rows}</div>;
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

function MobileStat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="font-mono text-[9px] uppercase tracking-[0.08em] text-fg-5">{label}</span>
      <span className="font-mono text-[14px] tabular-nums" style={{ color: color ?? "var(--fg-2)" }}>
        {value}
      </span>
    </div>
  );
}
