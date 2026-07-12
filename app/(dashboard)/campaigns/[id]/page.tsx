"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  Avatar,
  Badge,
  Button,
  CategoryBadge,
  DataCard,
  DataCardActions,
  DataCardMeta,
  DataCardTitle,
  FilterChip,
  Icon,
  Input,
  StateBadge,
  type LeadState,
} from "@/components/ui";
import { WhatsAppButton } from "@/components/whatsapp-button";

type Lead = {
  id: string;
  companyName: string;
  email: string | null;
  emailStatus: string | null;
  hasContactForm: boolean | null;
  facebookUrl: string | null;
  website: string | null;
  phone: string | null;
  address: string | null;
  state: string;
  category: string | null;
  rating: number | null;
  createdAt: string;
  lastTouchedAt: string | null;
  _count: { messages: number };
};

type Campaign = {
  id: string;
  name: string;
  businessType: string | null;
  country: string | null;
  status: string;
  autoSend: boolean;
  createdAt: string;
  selectedCities: string[];
  selectedAreas: Record<string, string[]> | null;
};

type CampaignStats = {
  totalLeads: number;
  withEmail: number;
  contactedLeads: number;
  totalSent: number;
  delivered: number;
  opened: number;
  bounced: number;
  complained: number;
  totalReplies: number;
  repliedLeads: number;
  convertedLeads: number;
};

const STATE_KEYS: LeadState[] = [
  "discovered",
  "contacted",
  "replied",
  "converted",
  "unsubscribed",
  "bounced",
];

type SortKey = "company" | "state" | "msgs" | "lastTouched";
type SortDir = "asc" | "desc";

function relativeTime(iso: string | null): string {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  const mo = Math.floor(d / 30);
  return `${mo}mo ago`;
}

function truncateUrl(href: string): string {
  let s = href.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "");
  if (s.length > 26) s = s.slice(0, 24) + "…";
  return s;
}


export default function CampaignDetailPage() {
  const { id } = useParams<{ id: string }>();

  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [stateFilter, setStateFilter] = useState<"all" | LeadState>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({ key: "lastTouched", dir: "desc" });
  const [enriching, setEnriching] = useState(false);
  const [enrichResult, setEnrichResult] = useState<{
    emailsFound: number;
    channelsFound?: number;
    total: number;
    error?: string;
  } | null>(null);
  const [togglingAutoSend, setTogglingAutoSend] = useState(false);
  const [stats, setStats] = useState<CampaignStats | null>(null);

  const refreshLeads = useCallback(() => {
    return fetch(`/api/campaigns/${id}/leads`)
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setLeads(data); });
  }, [id]);

  useEffect(() => {
    Promise.all([
      fetch(`/api/campaigns/${id}`).then((r) => r.json()),
      fetch(`/api/campaigns/${id}/leads`).then((r) => r.json()),
      fetch(`/api/campaigns/${id}/stats`).then((r) => r.json()),
    ])
      .then(([campaignData, leadsData, statsData]) => {
        if (campaignData.error) throw new Error(campaignData.error);
        setCampaign(campaignData);
        setLeads(Array.isArray(leadsData) ? leadsData : []);
        if (!statsData.error) setStats(statsData);
      })
      .catch((e: Error) => setLoadError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  const refreshStats = useCallback(() => {
    return fetch(`/api/campaigns/${id}/stats`)
      .then((r) => r.json())
      .then((data) => { if (!data.error) setStats(data); });
  }, [id]);

  // Poll for lead updates while auto-send is active
  useEffect(() => {
    if (!campaign?.autoSend) return;
    const interval = setInterval(() => { refreshLeads(); refreshStats(); }, 15_000);
    return () => clearInterval(interval);
  }, [campaign?.autoSend, refreshLeads, refreshStats]);

  const filtered = useMemo(() => {
    const list = leads.filter((l) => {
      if (stateFilter !== "all" && l.state !== stateFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        if (
          !l.companyName?.toLowerCase().includes(q) &&
          !l.email?.toLowerCase().includes(q) &&
          !l.website?.toLowerCase().includes(q)
        )
          return false;
      }
      return true;
    });
    return [...list].sort((a, b) => {
      let av: string | number = "";
      let bv: string | number = "";
      switch (sort.key) {
        case "company":
          av = a.companyName ?? "";
          bv = b.companyName ?? "";
          break;
        case "state":
          av = a.state;
          bv = b.state;
          break;
        case "msgs":
          av = a._count.messages;
          bv = b._count.messages;
          break;
        case "lastTouched":
          av = new Date(a.lastTouchedAt ?? a.createdAt).getTime();
          bv = new Date(b.lastTouchedAt ?? b.createdAt).getTime();
          break;
      }
      if (av < bv) return sort.dir === "asc" ? -1 : 1;
      if (av > bv) return sort.dir === "asc" ? 1 : -1;
      return 0;
    });
  }, [leads, stateFilter, searchQuery, sort]);

  async function handleReEnrich() {
    setEnriching(true);
    setEnrichResult(null);
    try {
      const res = await fetch("/api/leads/re-enrich", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaignId: id }),
      });
      // A crashed route can return an empty body; don't let res.json() throw an
      // opaque "Unexpected end of JSON input" — surface a useful message instead.
      const data = await res.json().catch(() => ({
        error: `Request failed (${res.status} ${res.statusText})`,
      }));
      setEnrichResult(data);
      // Reload leads to show newly found emails
      const leadsData = await fetch(`/api/campaigns/${id}/leads`).then((r) => r.json());
      setLeads(Array.isArray(leadsData) ? leadsData : []);
    } finally {
      setEnriching(false);
    }
  }

  async function handleToggleAutoSend() {
    if (!campaign) return;
    setTogglingAutoSend(true);
    try {
      const res = await fetch(`/api/campaigns/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ autoSend: !campaign.autoSend }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setCampaign(data);
    } finally {
      setTogglingAutoSend(false);
    }
  }

  function toggleSort(key: SortKey) {
    setSort((s) =>
      s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "desc" }
    );
  }

  const gridCols = "2fr 1fr 90px 72px 96px 80px";

  if (loadError) {
    return (
      <p className="font-mono text-[12px] text-hot border border-hot-border bg-hot-bg rounded-md px-3 py-2 inline-block">
        {loadError}
      </p>
    );
  }

  if (loading) {
    return <p className="font-mono text-[13px] text-fg-4">Loading…</p>;
  }

  if (!campaign) return null;

  const statusVariant: Record<string, "success" | "neutral"> = {
    active: "success",
    paused: "neutral",
    completed: "neutral",
  };

  const stateCounts = leads.reduce<Record<string, number>>((acc, l) => {
    acc[l.state] = (acc[l.state] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="flex flex-col gap-3.5">
      {/* Header */}
      <div>
        <Link
          href="/campaigns"
          className="font-mono text-[11px] text-fg-4 hover:text-fg-2 inline-flex items-center gap-1.5 mb-2 transition-colors duration-150"
        >
          ← Campaigns
        </Link>
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5 mb-1">
              <h1 className="ds-h1 m-0">{campaign.name}</h1>
              <Badge variant={statusVariant[campaign.status] ?? "neutral"} size="sm">
                {campaign.status}
              </Badge>
            </div>
            <p className="font-mono text-[12px] text-fg-4 m-0">
              {campaign.businessType && <>{campaign.businessType}</>}
              {campaign.businessType && campaign.country && <> · </>}
              {campaign.country && <>{campaign.country}</>}
              {(campaign.businessType || campaign.country) && (
                <> · <span className="text-fg-2">{leads.length}</span> leads</>
              )}
              {!campaign.businessType && !campaign.country && (
                <><span className="text-fg-2">{leads.length}</span> leads</>
              )}
            </p>
            {campaign.selectedCities?.length > 0 && (
              <div className="flex flex-col gap-1 mt-1.5">
                {campaign.selectedCities.map((city) => {
                  const areas = campaign.selectedAreas?.[city] ?? [];
                  return (
                    <div key={city} className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded-full border border-border bg-surface font-mono text-[10px] text-fg-3">
                        {city}
                      </span>
                      {areas.length > 0 ? (
                        <span className="font-mono text-[10px] text-fg-5">
                          {areas.join(" · ")}
                        </span>
                      ) : (
                        <span className="font-mono text-[10px] text-fg-5 italic">city-wide</span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          <div className="flex items-center flex-wrap gap-2 lg:shrink-0">
            <button
              type="button"
              onClick={handleToggleAutoSend}
              disabled={togglingAutoSend || campaign.status !== "active"}
              className={[
                "flex items-center gap-2 px-3 py-1.5 rounded-lg border font-mono text-[11px] uppercase tracking-wider transition-all duration-200 cursor-pointer",
                campaign.autoSend
                  ? "bg-amber-bg border-amber-border text-amber"
                  : "bg-surface border-border text-fg-4 hover:border-border-strong hover:text-fg-2",
                (togglingAutoSend || campaign.status !== "active") ? "opacity-50 cursor-not-allowed" : "",
              ].join(" ")}
              title={campaign.status !== "active" ? "Campaign must be active to enable auto-send" : ""}
            >
              <span
                className={[
                  "inline-block w-2 h-2 rounded-full transition-colors duration-200",
                  campaign.autoSend ? "bg-amber animate-pulse" : "bg-fg-5",
                ].join(" ")}
              />
              {togglingAutoSend ? "Updating…" : campaign.autoSend ? "Auto Send ON" : "Auto Send OFF"}
            </button>
            {enrichResult && (
              <span className={`font-mono text-[11px] ${enrichResult.error ? "text-hot" : "text-fg-3"}`}>
                {enrichResult.error
                  ? enrichResult.error
                  : enrichResult.emailsFound === 0
                  ? "No new emails found"
                  : `+${enrichResult.emailsFound} email${enrichResult.emailsFound === 1 ? "" : "s"} found`}
                {!enrichResult.error && (enrichResult.channelsFound ?? 0) > 0 &&
                  ` · +${enrichResult.channelsFound} channel${enrichResult.channelsFound === 1 ? "" : "s"}`}
              </span>
            )}
            <Button
              size="sm"
              variant="secondary"
              iconStart="inbox"
              onClick={handleReEnrich}
              disabled={enriching}
            >
              {enriching ? "Finding emails…" : "Find Emails (Step 2)"}
            </Button>
            <Link href={`/campaigns/${id}/scout`}>
              <Button size="sm" variant="secondary" iconStart="refresh">
                Re-scout
              </Button>
            </Link>
            <Link href={`/campaigns/${id}/edit`}>
              <Button size="sm" variant="ghost" iconStart="pencil">
                Edit
              </Button>
            </Link>
            <Input
              placeholder="Search leads…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {(searchQuery || stateFilter !== "all") && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearchQuery("");
                  setStateFilter("all");
                }}
              >
                Clear
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Campaign stats */}
      {stats && stats.totalLeads > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-1.5">
          <StatTile label="Leads" value={stats.totalLeads} sub={`${stats.withEmail} with email`} />
          <StatTile
            label="Contacted"
            value={stats.contactedLeads}
            sub={stats.totalLeads > 0 ? `${pct(stats.contactedLeads, stats.withEmail || stats.totalLeads)}% of reachable` : undefined}
          />
          <StatTile
            label="Delivered"
            value={stats.delivered}
            sub={stats.totalSent > 0 ? `${pct(stats.delivered, stats.totalSent)}% of sent` : undefined}
            color="success"
          />
          <StatTile
            label="Opened"
            value={stats.opened}
            sub={stats.delivered > 0 ? `${pct(stats.opened, stats.delivered)}% open rate` : undefined}
            color="info"
          />
          <StatTile
            label="Replied"
            value={stats.repliedLeads}
            sub={stats.contactedLeads > 0 ? `${pct(stats.repliedLeads, stats.contactedLeads)}% reply rate` : undefined}
            color="amber"
          />
          <StatTile
            label="Bounced"
            value={stats.bounced + stats.complained}
            sub={
              stats.totalSent > 0
                ? `${pct(stats.bounced + stats.complained, stats.totalSent)}% bounce rate`
                : undefined
            }
            color={stats.bounced + stats.complained > 0 ? "hot" : undefined}
          />
        </div>
      )}

      {/* Stat pills */}
      <div className="flex items-center gap-2 flex-wrap">
        {STATE_KEYS.map((s) => {
          const count = stateCounts[s] ?? 0;
          if (count === 0) return null;
          return (
            <button
              key={s}
              type="button"
              onClick={() => setStateFilter(stateFilter === s ? "all" : s)}
              className={[
                "flex items-center gap-1.5 px-2.5 py-1 rounded-full border font-mono text-[10px] uppercase tracking-wider transition-colors duration-150 cursor-pointer",
                stateFilter === s
                  ? "bg-amber-bg border-amber-border text-amber"
                  : "bg-surface border-border text-fg-4 hover:border-border-strong hover:text-fg-2",
              ].join(" ")}
            >
              <span>{s}</span>
              <span className={stateFilter === s ? "text-amber" : "text-fg-2"}>{count}</span>
            </button>
          );
        })}
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="bg-surface border border-border rounded-xl px-6 py-10 text-center">
          <p className="font-mono text-[13px] text-fg-4 m-0">
            {leads.length === 0 ? "No leads yet — run the scout to find some." : "No leads match your filters."}
          </p>
        </div>
      ) : (
        <>
          {/* Table — desktop / tablet (md+) */}
          <div className="hidden md:block bg-surface border border-border rounded-xl overflow-hidden">
            {/* Table header */}
            <div
              className="grid border-b border-border bg-[oklch(0.13_0_0)]"
              style={{ gridTemplateColumns: gridCols }}
            >
              <SortHeader label="Company" sortKey="company" sort={sort} onClick={toggleSort} />
              <SortHeader label="Contact" />
              <SortHeader label="State" sortKey="state" sort={sort} onClick={toggleSort} />
              <SortHeader label="Msgs" sortKey="msgs" sort={sort} onClick={toggleSort} alignRight />
              <SortHeader label="Last touched" sortKey="lastTouched" sort={sort} onClick={toggleSort} />
              <SortHeader label="" />
            </div>

            {filtered.map((lead, idx) => (
              <LeadRow key={lead.id} lead={lead} idx={idx} gridCols={gridCols} campaignId={id} />
            ))}
          </div>

          {/* Cards — mobile (below md) */}
          <div className="md:hidden flex flex-col gap-2.5">
            {filtered.map((lead) => (
              <LeadCard key={lead.id} lead={lead} campaignId={id} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// Mobile card variant of LeadRow.
function LeadCard({ lead, campaignId }: { lead: Lead; campaignId: string }) {
  const msgs = lead._count.messages;
  const contact =
    lead.email ||
    lead.phone ||
    (lead.hasContactForm && lead.website ? "contact form" : null) ||
    (lead.facebookUrl ? "facebook" : null) ||
    (lead.website ? truncateUrl(lead.website) : null);

  return (
    <DataCard>
      <DataCardTitle trailing={<StateBadge state={lead.state} />}>
        <div className="flex items-center gap-2.5 min-w-0">
          <Avatar name={lead.companyName} size={26} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 min-w-0">
              <Link
                href={`/campaigns/${campaignId}/leads/${lead.id}`}
                className="font-sans text-[14px] text-fg-1 hover:text-amber font-medium tracking-[-0.01em] truncate transition-colors duration-150"
              >
                {lead.companyName}
              </Link>
              <CategoryBadge category={lead.category} size="sm" />
            </div>
            {contact && (
              <p className="font-mono text-[11px] text-fg-4 m-0 mt-0.5 truncate">{contact}</p>
            )}
          </div>
        </div>
      </DataCardTitle>

      <DataCardMeta>
        <span style={{ color: msgs > 0 ? "var(--amber)" : undefined }}>{msgs} msgs</span>
        <span className="text-fg-5">·</span>
        <span>{relativeTime(lead.lastTouchedAt)}</span>
        {lead.website && (
          <>
            <span className="text-fg-5">·</span>
            <a
              href={lead.website}
              target="_blank"
              rel="noopener noreferrer"
              className="text-info hover:text-fg-1 truncate"
            >
              {truncateUrl(lead.website)}
            </a>
          </>
        )}
      </DataCardMeta>

      <DataCardActions>
        {!lead.email && lead.phone && (
          <WhatsAppButton leadId={lead.id} phone={lead.phone} companyName={lead.companyName} />
        )}
        <span className="flex-1" />
        <Link href={`/campaigns/${campaignId}/leads/${lead.id}`}>
          <Button size="sm" variant="ghost">
            View →
          </Button>
        </Link>
      </DataCardActions>
    </DataCard>
  );
}

function LeadRow({
  lead,
  idx,
  gridCols,
  campaignId,
}: {
  lead: Lead;
  idx: number;
  gridCols: string;
  campaignId: string;
}) {
  const msgs = lead._count.messages;

  return (
    <div
      className="grid border-b border-border-soft last:border-b-0 group hover:bg-[oklch(0.12_0_0)] transition-colors duration-100"
      style={{
        gridTemplateColumns: gridCols,
        background: idx % 2 === 0 ? "var(--surface)" : "oklch(0.135 0 0)",
      }}
    >
      {/* Company */}
      <div className="px-3 py-[10px] flex items-center gap-2.5 min-w-0">
        <Avatar name={lead.companyName} size={22} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 min-w-0">
            <Link
              href={`/campaigns/${campaignId}/leads/${lead.id}`}
              className="font-sans text-[13px] text-fg-1 hover:text-amber font-medium tracking-[-0.01em] truncate transition-colors duration-150"
            >
              {lead.companyName}
            </Link>
            <CategoryBadge category={lead.category} size="sm" />
          </div>
          {lead.address && (
            <p className="font-mono text-[10.5px] text-fg-5 m-0 mt-px truncate">{lead.address}</p>
          )}
        </div>
      </div>

      {/* Contact */}
      <div className="px-3 py-[10px] flex flex-col justify-center gap-0.5 min-w-0">
        {lead.email ? (
          <p className="font-mono text-[10.5px] text-fg-3 m-0 truncate" title={lead.email}>
            {lead.email}
            {lead.emailStatus === "verified" && (
              <span className="text-success" title="Email verified"> ✓</span>
            )}
            {lead.emailStatus === "catch_all" && (
              <span className="text-amber" title="Catch-all domain — medium confidence"> ~</span>
            )}
          </p>
        ) : lead.phone ? (
          <div className="font-mono text-[10.5px] text-fg-4 flex items-center gap-1.5">
            <span>{lead.phone}</span>
            <WhatsAppButton
              leadId={lead.id}
              phone={lead.phone}
              companyName={lead.companyName}
              className="font-mono text-[10.5px] text-success hover:underline bg-transparent border-0 cursor-pointer p-0"
            />
          </div>
        ) : lead.hasContactForm && lead.website ? (
          <span className="font-mono text-[10.5px] text-info">contact form</span>
        ) : lead.facebookUrl ? (
          <a
            href={lead.facebookUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="font-mono text-[10.5px] text-info hover:underline"
          >
            facebook ↗
          </a>
        ) : (
          <span className="font-mono text-[11px] text-fg-5">—</span>
        )}
        {lead.website && (
          <a
            href={lead.website}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="font-mono text-[10.5px] text-info hover:text-fg-1 transition-colors truncate flex items-center gap-1 min-w-0"
            title={lead.website}
          >
            <span className="truncate">{truncateUrl(lead.website)}</span>
            <Icon name="arrow" size={9} className="shrink-0" />
          </a>
        )}
      </div>

      {/* State */}
      <div className="px-3 py-[10px] flex items-center">
        <StateBadge state={lead.state} />
      </div>

      {/* Messages */}
      <div
        className="px-3 py-[10px] flex items-center justify-end font-mono text-[12px] tabular-nums"
        style={{ color: msgs > 0 ? "var(--amber)" : "var(--fg-5)" }}
      >
        {msgs}
      </div>

      {/* Last touched */}
      <div className="px-3 py-[10px] font-mono text-[11px] text-fg-4 flex items-center">
        {relativeTime(lead.lastTouchedAt)}
      </div>

      {/* Action */}
      <div className="px-3 py-[10px] flex items-center justify-end opacity-0 group-hover:opacity-100 transition-opacity duration-100">
        <Link href={`/campaigns/${campaignId}/leads/${lead.id}`}>
          <Button size="sm" variant="ghost">
            View
          </Button>
        </Link>
      </div>
    </div>
  );
}

function pct(num: number, den: number): string {
  if (den === 0) return "0";
  return Math.round((num / den) * 100).toString();
}

function StatTile({
  label,
  value,
  sub,
  color,
}: {
  label: string;
  value: number;
  sub?: string;
  color?: "success" | "info" | "amber" | "hot";
}) {
  const colorMap: Record<string, string> = {
    success: "text-success",
    info: "text-info",
    amber: "text-amber",
    hot: "text-hot",
  };
  const valueColor = color ? colorMap[color] : "text-fg-1";

  return (
    <div className="bg-surface border border-border rounded-lg px-3 py-2 flex items-center justify-between gap-2">
      <span className="font-mono text-[10px] uppercase tracking-[0.06em] text-fg-4">{label}</span>
      <span className="flex items-baseline gap-1.5">
        <span className={`font-sans text-[15px] font-semibold tracking-tight leading-none ${valueColor}`}>
          {value}
        </span>
        {sub && (
          <span className="font-mono text-[9.5px] text-fg-5 whitespace-nowrap">{sub}</span>
        )}
      </span>
    </div>
  );
}

function SortHeader({
  label,
  sortKey,
  sort,
  onClick,
  alignRight,
}: {
  label: string;
  sortKey?: SortKey;
  sort?: { key: SortKey; dir: SortDir };
  onClick?: (key: SortKey) => void;
  alignRight?: boolean;
}) {
  if (!sortKey || !onClick) {
    return (
      <div
        className={[
          "px-3 py-2.5 font-mono text-[10px] uppercase tracking-[0.08em] text-fg-4 flex items-center",
          alignRight ? "justify-end" : "",
        ].join(" ")}
      >
        {label}
      </div>
    );
  }
  const isActive = sort?.key === sortKey;
  return (
    <button
      type="button"
      onClick={() => onClick(sortKey)}
      className={[
        "px-3 py-2.5 bg-transparent border-0 cursor-pointer font-mono text-[10px] uppercase tracking-[0.08em] flex items-center gap-1 transition-colors duration-150",
        isActive ? "text-fg-1" : "text-fg-4 hover:text-fg-3",
        alignRight ? "justify-end" : "justify-start",
      ].join(" ")}
    >
      <span>{label}</span>
      <span className={isActive ? "opacity-100" : "opacity-40"}>
        <Icon name={isActive && sort?.dir === "asc" ? "arrowUp" : "arrowDown"} size={10} />
      </span>
    </button>
  );
}
