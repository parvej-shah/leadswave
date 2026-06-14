"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  Avatar,
  Badge,
  Button,
  CategoryBadge,
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
  createdAt: string;
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
  } | null>(null);

  useEffect(() => {
    Promise.all([
      fetch(`/api/campaigns/${id}`).then((r) => r.json()),
      fetch(`/api/campaigns/${id}/leads`).then((r) => r.json()),
    ])
      .then(([campaignData, leadsData]) => {
        if (campaignData.error) throw new Error(campaignData.error);
        setCampaign(campaignData);
        setLeads(Array.isArray(leadsData) ? leadsData : []);
      })
      .catch((e: Error) => setLoadError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

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
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div>
        <Link
          href="/campaigns"
          className="font-mono text-[11px] text-fg-4 hover:text-fg-2 inline-flex items-center gap-1.5 mb-3 transition-colors duration-150"
        >
          ← Campaigns
        </Link>
        <div className="flex items-start justify-between gap-4">
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
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {enrichResult && (
              <span className="font-mono text-[11px] text-fg-3">
                {enrichResult.emailsFound === 0
                  ? "No new emails found"
                  : `+${enrichResult.emailsFound} email${enrichResult.emailsFound === 1 ? "" : "s"} found`}
                {(enrichResult.channelsFound ?? 0) > 0 &&
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
          </div>
        </div>
      </div>

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

      {/* Filters */}
      <div className="flex items-center gap-2">
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

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="bg-surface border border-border rounded-xl px-6 py-10 text-center">
          <p className="font-mono text-[13px] text-fg-4 m-0">
            {leads.length === 0 ? "No leads yet — run the scout to find some." : "No leads match your filters."}
          </p>
        </div>
      ) : (
        <div className="bg-surface border border-border rounded-xl overflow-hidden">
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
      )}
    </div>
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
