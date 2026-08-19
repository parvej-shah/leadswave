"use client";

import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  Avatar,
  Badge,
  Button,
  DataCard,
  DataCardTitle,
  Icon,
  Input,
  Select,
  StateBadge,
  type LeadState,
} from "@/components/ui";
import { AnalyticsView } from "@/components/campaigns/analytics-view";
import { SequenceBuilderPro, type SequenceStep } from "@/components/campaigns/sequence-builder-pro";
import { WhatsAppButton } from "@/components/whatsapp-button";
import { CoverageMapClient } from "../../map/coverage-map-client";

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
  offerText?: string;
  timezone?: string;
  status: string;
  autoSend: boolean;
  scoutDepth: string;
  followupOffsets: number[];
  sendDays?: number[];
  sendWindowStart?: string;
  sendWindowEnd?: string;
  opportunitiesValue?: number;
  conversionsValue?: number;
  sequenceSteps?: SequenceStep[];
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
  clicked?: number;
  bounced: number;
  complained: number;
  totalReplies: number;
  repliedLeads: number;
  convertedLeads: number;
  opportunitiesCount?: number;
  opportunitiesValue?: number;
  conversionsCount?: number;
  conversionsValue?: number;
  dailyActivity?: { date: string; label: string; sent: number; opens: number; clicks?: number; replies: number }[];
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

export default function CampaignDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

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
  const [togglingStatus, setTogglingStatus] = useState(false);
  const [stats, setStats] = useState<CampaignStats | null>(null);

  type TabName = "analytics" | "leads" | "sequences" | "schedule" | "options" | "subsequences";
  const [activeTab, setActiveTab] = useState<TabName>("analytics");

  const [editSendDays, setEditSendDays] = useState<number[] | null>(null);
  const [editWindowStart, setEditWindowStart] = useState<string | null>(null);
  const [editWindowEnd, setEditWindowEnd] = useState<string | null>(null);
  const [editTimezone, setEditTimezone] = useState<string | null>(null);
  const [savingWindow, setSavingWindow] = useState(false);
  const [windowError, setWindowError] = useState<string | null>(null);

  // Manual Lead Addition Modal State
  const [showManualLeadModal, setShowManualLeadModal] = useState(false);
  const [manualLeadForm, setManualLeadForm] = useState({
    companyName: "",
    email: "",
    phone: "",
    website: "",
    category: "",
    address: "",
  });
  const [savingManualLead, setSavingManualLead] = useState(false);
  const [manualLeadError, setManualLeadError] = useState<string | null>(null);

  const [addLeadsOpen, setAddLeadsOpen] = useState(false);
  const [moreOptionsOpen, setMoreOptionsOpen] = useState(false);
  const addLeadsRef = useRef<HTMLDivElement>(null);
  const moreOptionsRef = useRef<HTMLDivElement>(null);

  const fetchJson = useCallback(async (url: string) => {
    try {
      const res = await fetch(url);
      if (!res.ok) {
        const text = await res.text();
        try {
          const json = JSON.parse(text);
          return { error: json.error || `Server error (${res.status})` };
        } catch {
          return { error: `Failed to load (${res.status} ${res.statusText})` };
        }
      }
      return res.json();
    } catch (e: any) {
      return { error: e.message || "Network error" };
    }
  }, []);

  const refreshLeads = useCallback(() => {
    return fetchJson(`/api/campaigns/${id}/leads`).then((data) => {
      if (Array.isArray(data)) setLeads(data);
    });
  }, [id, fetchJson]);

  const refreshStats = useCallback(() => {
    return fetchJson(`/api/campaigns/${id}/stats`).then((data) => {
      if (data && !data.error) setStats(data);
    });
  }, [id, fetchJson]);

  useEffect(() => {
    Promise.all([
      fetchJson(`/api/campaigns/${id}`),
      fetchJson(`/api/campaigns/${id}/leads`),
      fetchJson(`/api/campaigns/${id}/stats`),
    ])
      .then(([campaignData, leadsData, statsData]) => {
        if (campaignData.error) throw new Error(campaignData.error);
        setCampaign(campaignData);
        setLeads(Array.isArray(leadsData) ? leadsData : []);
        if (statsData && !statsData.error) setStats(statsData);
      })
      .catch((e: Error) => setLoadError(e.message))
      .finally(() => setLoading(false));
  }, [id, fetchJson]);

  // Click outside listener for dropdowns
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (addLeadsRef.current && !addLeadsRef.current.contains(e.target as Node)) {
        setAddLeadsOpen(false);
      }
      if (moreOptionsRef.current && !moreOptionsRef.current.contains(e.target as Node)) {
        setMoreOptionsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Poll for lead updates while auto-send is active
  useEffect(() => {
    if (!campaign?.autoSend) return;
    const interval = setInterval(() => { refreshLeads(); refreshStats(); }, 15_000);
    return () => clearInterval(interval);
  }, [campaign?.autoSend, refreshLeads, refreshStats]);

  const filteredLeads = useMemo(() => {
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

  const [runningOutreach, setRunningOutreach] = useState(false);

  async function handleRunOutreach() {
    if (!campaign) return;
    setRunningOutreach(true);
    try {
      const res = await fetch(`/api/campaigns/${id}/send-openers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limit: 10 }),
      });
      const data = await res.json();
      if (data.ok) {
        await Promise.all([refreshLeads(), refreshStats()]);
      }
    } finally {
      setRunningOutreach(false);
    }
  }

  async function handleToggleStatus() {
    if (!campaign) return;
    setTogglingStatus(true);
    const nextStatus = campaign.status === "active" ? "paused" : "active";
    try {
      const res = await fetch(`/api/campaigns/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      const data = await res.json();
      if (!data.error) setCampaign(data);
    } finally {
      setTogglingStatus(false);
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
      if (!data.error) setCampaign(data);
    } finally {
      setTogglingAutoSend(false);
    }
  }

  async function handleReEnrich() {
    setEnriching(true);
    setEnrichResult(null);
    try {
      const res = await fetch("/api/leads/re-enrich", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaignId: id }),
      });
      const data = await res.json().catch(() => ({
        error: `Request failed (${res.status} ${res.statusText})`,
      }));
      setEnrichResult(data);
      refreshLeads();
    } finally {
      setEnriching(false);
    }
  }

  async function handleCreateManualLead() {
    if (!manualLeadForm.companyName.trim() && !manualLeadForm.email.trim()) {
      setManualLeadError("Company name or contact email is required");
      return;
    }
    setManualLeadError(null);
    setSavingManualLead(true);
    try {
      const res = await fetch("/api/leads/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campaignId: id,
          companyName: manualLeadForm.companyName,
          email: manualLeadForm.email,
          phone: manualLeadForm.phone,
          website: manualLeadForm.website,
          category: manualLeadForm.category || campaign?.businessType || "",
          address: manualLeadForm.address,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setManualLeadError(data.error || "Failed to add lead");
      } else {
        setShowManualLeadModal(false);
        setManualLeadForm({ companyName: "", email: "", phone: "", website: "", category: "", address: "" });
        refreshLeads();
        refreshStats();
      }
    } catch (e: any) {
      setManualLeadError(e.message || "Network error");
    } finally {
      setSavingManualLead(false);
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

  const stateCounts = leads.reduce<Record<string, number>>((acc, l) => {
    acc[l.state] = (acc[l.state] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="flex flex-col gap-4">
      {/* ── TOP HEADER & ACTION BAR ── */}
      <div className="flex flex-col gap-3 border-b border-[#1E2433] pb-4">
        {/* Top utility row */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link
              href="/campaigns"
              className="w-7 h-7 rounded-lg border border-[#1E2433] bg-[#0E121B] flex items-center justify-center text-fg-4 hover:text-fg-1 hover:border-[#2D364D] transition-colors"
            >
              ‹
            </Link>
            <h1 className="font-sans text-[18px] font-bold text-fg-1 m-0 tracking-tight">{campaign.name}</h1>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {/* New experience toggle */}
            <div className="flex items-center gap-2 font-mono text-[11px] text-[#8A94A6]">
              <span>Use New Experience</span>
              <div className="w-8 h-4 rounded-full bg-[#0066FF] p-0.5 cursor-pointer">
                <div className="w-3 h-3 rounded-full bg-white translate-x-4 transition-transform" />
              </div>
            </div>

            {/* Credit badge */}
            <div className="flex items-center gap-1 px-2.5 py-1 rounded-full border border-[#1E2433] bg-[#0E121B] font-mono text-[11px] text-amber">
              <span>⚡</span>
              <span className="font-bold">2</span>
              <span className="text-[#566175]">⌄</span>
            </div>

            {/* Primary Blue CTA: Get Leads */}
            <div className="relative" ref={addLeadsRef}>
              <button
                type="button"
                disabled={campaign.status === "completed"}
                onClick={() => setAddLeadsOpen((o) => !o)}
                className="bg-[#0066FF] hover:bg-[#0052CC] text-white font-mono text-[12px] font-semibold px-4 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
              >
                <span>Get Leads</span>
                <span className="text-[10px]">⌄</span>
              </button>

              {addLeadsOpen && (
                <div className="absolute right-0 top-full mt-1 w-52 bg-[#12161F] border border-[#1E2433] rounded-lg shadow-xl z-30 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => {
                      setAddLeadsOpen(false);
                      setShowManualLeadModal(true);
                    }}
                    className="w-full text-left flex items-center gap-2.5 px-3 py-2.5 font-mono text-[12px] text-fg-2 hover:bg-[#1E2433] transition-colors cursor-pointer"
                  >
                    <span className="text-[14px]">➕</span> Add Lead Manually
                  </button>
                  <Link
                    href={`/campaigns/${id}/scout`}
                    className="flex items-center gap-2.5 px-3 py-2.5 font-mono text-[12px] text-fg-2 hover:bg-[#1E2433] transition-colors"
                    onClick={() => setAddLeadsOpen(false)}
                  >
                    <Icon name="map" size={14} /> Scout Google Maps
                  </Link>
                  <Link
                    href={`/campaigns/${id}/import`}
                    className="flex items-center gap-2.5 px-3 py-2.5 font-mono text-[12px] text-fg-2 hover:bg-[#1E2433] transition-colors"
                    onClick={() => setAddLeadsOpen(false)}
                  >
                    <Icon name="upload" size={14} /> Upload CSV / Excel
                  </Link>
                </div>
              )}
            </div>

            {/* Account Switcher */}
            <div className="px-3 py-1 rounded-lg border border-[#1E2433] bg-[#0E121B] font-mono text-[11px] text-fg-3 flex items-center gap-1 cursor-pointer">
              <span>Brain Station 23...</span>
              <span className="text-[#566175]">⌄</span>
            </div>
          </div>
        </div>

        {/* Action Row: Pause/Resume campaign + Tab Navigation */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
          {/* Main 6-Tab Bar */}
          <div className="flex items-center gap-1 overflow-x-auto">
            {(
              [
                { id: "analytics", label: "Analytics" },
                { id: "leads", label: "Leads" },
                { id: "sequences", label: "Sequences" },
                { id: "schedule", label: "Schedule" },
                { id: "options", label: "Options" },
                { id: "subsequences", label: "Subsequences" },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={[
                  "font-mono text-[13px] px-3.5 py-2 rounded-lg transition-colors whitespace-nowrap cursor-pointer",
                  activeTab === tab.id
                    ? "bg-[#1E2433] text-[#3385FF] font-medium"
                    : "text-[#8A94A6] hover:text-fg-2 hover:bg-[#12161F]",
                ].join(" ")}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Campaign Action buttons: Pause/Resume + Options dropdown */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleToggleStatus}
              disabled={togglingStatus}
              className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg border border-[#1E2433] bg-[#0E121B] font-mono text-[12px] text-fg-2 hover:border-[#2D364D] transition-colors cursor-pointer"
            >
              <span>{campaign.status === "active" ? "⏸ Pause campaign" : "▶ Resume campaign"}</span>
            </button>

            {/* Options menu ... */}
            <div className="relative" ref={moreOptionsRef}>
              <button
                type="button"
                onClick={() => setMoreOptionsOpen((o) => !o)}
                className="w-8 h-8 rounded-lg border border-[#1E2433] bg-[#0E121B] text-fg-3 hover:text-fg-1 flex items-center justify-center font-mono cursor-pointer"
              >
                •••
              </button>
              {moreOptionsOpen && (
                <div className="absolute right-0 top-full mt-1 w-48 bg-[#12161F] border border-[#1E2433] rounded-lg shadow-xl z-30 overflow-hidden font-mono text-[12px]">
                  <Link
                    href={`/campaigns/${id}/edit`}
                    className="block px-3 py-2 text-fg-2 hover:bg-[#1E2433]"
                    onClick={() => setMoreOptionsOpen(false)}
                  >
                    Edit Campaign
                  </Link>
                  <button
                    type="button"
                    onClick={() => {
                      setMoreOptionsOpen(false);
                      handleReEnrich();
                    }}
                    className="w-full text-left px-3 py-2 text-fg-2 hover:bg-[#1E2433]"
                  >
                    Re-enrich Leads
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      if (!confirm("Are you sure you want to delete this campaign?")) return;
                      await fetch(`/api/campaigns/${id}`, { method: "DELETE" });
                      router.push("/campaigns");
                    }}
                    className="w-full text-left px-3 py-2 text-red-400 hover:bg-[#1E2433]"
                  >
                    Delete Campaign
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── TAB CONTENT ── */}

      {/* 1. ANALYTICS TAB */}
      {activeTab === "analytics" && (
        <AnalyticsView
          status={campaign.status}
          stats={stats}
          campaignId={id}
          leads={leads}
          onOpenSettings={() => setActiveTab("options")}
          onRunOutreach={handleRunOutreach}
          runningOutreach={runningOutreach}
        />
      )}

      {/* 2. SEQUENCES TAB (2-Column Editor) */}
      {activeTab === "sequences" && (
        <SequenceBuilderPro
          initialSteps={campaign.sequenceSteps ?? undefined}
          campaignId={id}
          campaignName={campaign.name}
          businessType={campaign.businessType ?? ""}
          offerText={campaign.offerText ?? ""}
          onSave={async (steps) => {
            const res = await fetch(`/api/campaigns/${id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ sequenceSteps: steps }),
            });
            const data = await res.json();
            if (!data.error) setCampaign(data);
          }}
        />
      )}

      {/* 3. SCHEDULE TAB */}
      {activeTab === "schedule" && (
        <div className="bg-[#12161F] border border-[#1E2433] rounded-xl p-5 flex flex-col gap-5 max-w-xl">
          <div>
            <h3 className="font-mono text-[14px] font-semibold text-fg-1 m-0">Send Window & Timezone</h3>
            <p className="font-mono text-[11px] text-[#8A94A6] m-0 mt-1">
              Specify the target timezone, days, and time boundaries when automated outreach emails send.
            </p>
          </div>

          {/* Timezone Select */}
          <div className="flex flex-col gap-1.5">
            <label className="font-mono text-[11px] text-[#8A94A6]">Campaign Target Timezone:</label>
            <select
              value={editTimezone ?? (campaign as any).timezone ?? "America/New_York"}
              onChange={(e) => setEditTimezone(e.target.value)}
              className="bg-[#0E121B] border border-[#1E2433] rounded-lg px-3 py-2 font-mono text-[12px] text-fg-1 focus:outline-none focus:border-[#0066FF]"
            >
              <option value="America/New_York">America/New_York (US Eastern ET)</option>
              <option value="America/Chicago">America/Chicago (US Central CT)</option>
              <option value="America/Denver">America/Denver (US Mountain MT)</option>
              <option value="America/Los_Angeles">America/Los_Angeles (US Pacific PT)</option>
              <option value="Europe/London">Europe/London (UK / GMT)</option>
              <option value="Asia/Dhaka">Asia/Dhaka (Bangladesh BST)</option>
              <option value="UTC">UTC (Coordinated Universal Time)</option>
            </select>
          </div>

          {/* Day Toggles */}
          <div className="flex flex-col gap-1.5">
            <label className="font-mono text-[11px] text-[#8A94A6]">Active Send Days:</label>
            <div className="flex gap-2 flex-wrap">
              {[
                { label: "Mon", day: 1 },
                { label: "Tue", day: 2 },
                { label: "Wed", day: 3 },
                { label: "Thu", day: 4 },
                { label: "Fri", day: 5 },
                { label: "Sat", day: 6 },
                { label: "Sun", day: 7 },
              ].map(({ label, day }) => {
                const currentDays = editSendDays ?? campaign.sendDays ?? [1, 2, 3, 4, 5];
                const active = currentDays.includes(day);
                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => {
                      const next = active
                        ? currentDays.filter((d) => d !== day)
                        : [...currentDays, day].sort();
                      setEditSendDays(next);
                    }}
                    className={[
                      "font-mono text-[11px] px-3 py-1.5 rounded-lg border transition-colors cursor-pointer",
                      active
                        ? "bg-[#0066FF] border-[#0066FF] text-white font-semibold"
                        : "bg-[#0E121B] border-[#1E2433] text-[#8A94A6] hover:border-[#2D364D]",
                    ].join(" ")}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Time range */}
          <div className="flex flex-col gap-1.5">
            <label className="font-mono text-[11px] text-[#8A94A6]">Daily Allowed Time Window:</label>
            <div className="flex items-center gap-3">
              <Input
                type="time"
                value={editWindowStart ?? campaign.sendWindowStart ?? "09:00"}
                onChange={(e) => setEditWindowStart(e.target.value)}
                className="w-36 bg-[#0E121B] border-[#1E2433]"
              />
              <span className="font-mono text-[11px] text-[#8A94A6]">to</span>
              <Input
                type="time"
                value={editWindowEnd ?? campaign.sendWindowEnd ?? "17:00"}
                onChange={(e) => setEditWindowEnd(e.target.value)}
                className="w-36 bg-[#0E121B] border-[#1E2433]"
              />
              <Button
                type="button"
                disabled={savingWindow}
                onClick={async () => {
                  const days = editSendDays ?? campaign.sendDays ?? [1, 2, 3, 4, 5];
                  const start = editWindowStart ?? campaign.sendWindowStart ?? "09:00";
                  const end = editWindowEnd ?? campaign.sendWindowEnd ?? "17:00";
                  const tz = editTimezone ?? (campaign as any).timezone ?? "America/New_York";
                  if (start >= end) {
                    setWindowError("End time must be after start time");
                    return;
                  }
                  setWindowError(null);
                  setSavingWindow(true);
                  try {
                    const res = await fetch(`/api/campaigns/${id}`, {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ sendDays: days, sendWindowStart: start, sendWindowEnd: end, timezone: tz }),
                    });
                    const data = await res.json();
                    if (data.error) setWindowError(data.error);
                    else setCampaign(data);
                  } finally {
                    setSavingWindow(false);
                  }
                }}
              >
                {savingWindow ? "Saving…" : "Save schedule"}
              </Button>
            </div>
          </div>
          {windowError && <p className="font-mono text-[11px] text-red-400 m-0">{windowError}</p>}
        </div>
      )}

      {/* 4. OPTIONS TAB */}
      {activeTab === "options" && (
        <div className="bg-[#12161F] border border-[#1E2433] rounded-xl p-5 flex flex-col gap-4 max-w-xl">
          <h3 className="font-mono text-[14px] font-semibold text-fg-1 m-0">Campaign Options</h3>

          {/* Auto-send toggle */}
          <div className="flex items-center justify-between border-b border-[#1E2433] pb-4">
            <div>
              <p className="font-mono text-[13px] text-fg-1 font-medium m-0">Auto Send Outreach</p>
              <p className="font-mono text-[11px] text-[#8A94A6] m-0 mt-0.5">
                Automatically send openers as new leads are scouted or imported
              </p>
            </div>
            <button
              type="button"
              onClick={handleToggleAutoSend}
              disabled={togglingAutoSend || campaign.status !== "active"}
              className={[
                "w-10 h-5 rounded-full p-0.5 transition-colors cursor-pointer",
                campaign.autoSend ? "bg-[#0066FF]" : "bg-[#1E2433]",
              ].join(" ")}
            >
              <div
                className={[
                  "w-4 h-4 rounded-full bg-white transition-transform",
                  campaign.autoSend ? "translate-x-5" : "translate-x-0",
                ].join(" ")}
              />
            </button>
          </div>

          {/* Scout depth */}
          <div className="flex items-center justify-between border-b border-[#1E2433] pb-4">
            <div>
              <p className="font-mono text-[13px] text-fg-1 font-medium m-0">Scouting Depth</p>
              <p className="font-mono text-[11px] text-[#8A94A6] m-0 mt-0.5">
                Places search budget per city
              </p>
            </div>
            <Select
              value={campaign.scoutDepth ?? "normal"}
              onChange={async (e) => {
                const val = e.target.value;
                const res = await fetch(`/api/campaigns/${id}`, {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ scoutDepth: val }),
                });
                const data = await res.json();
                if (!data.error) setCampaign(data);
              }}
              className="w-36 bg-[#0E121B] text-[12px]"
            >
              <option value="light">Light</option>
              <option value="normal">Normal</option>
              <option value="deep">Deep</option>
            </Select>
          </div>

          <Link href={`/campaigns/${id}/edit`}>
            <Button type="button" variant="secondary" size="sm" iconStart="pencil">
              Advanced campaign settings
            </Button>
          </Link>
        </div>
      )}

      {/* 5. SUBSEQUENCES TAB */}
      {activeTab === "subsequences" && (
        <div className="bg-[#12161F] border border-[#1E2433] rounded-xl p-8 text-center flex flex-col items-center justify-center min-h-[300px]">
          <span className="text-3xl mb-2">🌿</span>
          <h3 className="font-mono text-[15px] font-semibold text-fg-1 m-0">Subsequences & Branch Triggers</h3>
          <p className="font-mono text-[12px] text-[#8A94A6] max-w-md m-0 mt-2">
            Create trigger-based email sub-sequences for specific lead actions or reply classifications.
          </p>
        </div>
      )}

      {/* 6. LEADS TAB */}
      {activeTab === "leads" && (
        <div className="flex flex-col gap-3.5">
          {/* Controls Bar: Search, Filters & Add Lead CTA */}
          <div className="flex items-center justify-between gap-3 flex-wrap bg-[#12161F] border border-[#1E2433] rounded-xl p-3">
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
                      "flex items-center gap-1.5 px-2.5 py-1 rounded-full font-mono text-[10px] uppercase tracking-wider transition-colors cursor-pointer",
                      stateFilter === s
                        ? "bg-[#0066FF]/20 text-[#3385FF] border border-[#0066FF]/40"
                        : "bg-[#0E121B] border border-[#1E2433] text-[#8A94A6] hover:text-fg-2",
                    ].join(" ")}
                  >
                    <span>{s}</span>
                    <span className="font-semibold">{count}</span>
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => setShowManualLeadModal(true)}
                className="bg-[#0066FF] hover:bg-[#0052CC] text-white font-mono text-[11px] font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <span>➕</span> Add Lead
              </button>

              <Input
                placeholder="Search leads…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-44 bg-[#0E121B] text-[12px]"
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

          {/* Coverage Map */}
          <CoverageMapClient campaignId={id} compact />

          {/* Leads Table */}
          {filteredLeads.length === 0 ? (
            <div className="bg-[#12161F] border border-[#1E2433] rounded-xl px-6 py-10 text-center">
              <p className="font-mono text-[13px] text-[#8A94A6] m-0 mb-3">
                {leads.length === 0 ? "No leads yet — add a lead manually, run the scout, or upload a CSV." : "No leads match your filters."}
              </p>
              {leads.length === 0 && (
                <button
                  type="button"
                  onClick={() => setShowManualLeadModal(true)}
                  className="bg-[#0066FF] hover:bg-[#0052CC] text-white font-mono text-[12px] font-semibold px-4 py-2 rounded-lg inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <span>➕</span> Add First Lead Manually
                </button>
              )}
            </div>
          ) : (
            <div className="bg-[#12161F] border border-[#1E2433] rounded-xl overflow-hidden">
              <div
                className="grid border-b border-[#1E2433] bg-[#0E121B] px-4 py-2.5 font-mono text-[11px] text-[#8A94A6] uppercase tracking-wider"
                style={{ gridTemplateColumns: gridCols }}
              >
                <div onClick={() => toggleSort("company")} className="cursor-pointer">Company</div>
                <div>Contact</div>
                <div onClick={() => toggleSort("state")} className="cursor-pointer">State</div>
                <div onClick={() => toggleSort("msgs")} className="cursor-pointer text-right">Msgs</div>
                <div onClick={() => toggleSort("lastTouched")} className="cursor-pointer">Last Touched</div>
                <div />
              </div>

              {filteredLeads.map((lead) => (
                <div
                  key={lead.id}
                  className="grid px-4 py-3 border-b border-[#1E2433] last:border-b-0 items-center text-[12px] font-mono hover:bg-[#1E2433]/40 transition-colors"
                  style={{ gridTemplateColumns: gridCols }}
                >
                  <div className="flex items-center gap-2.5 min-w-0 pr-2">
                    <Avatar name={lead.companyName} size={24} />
                    <Link href={`/campaigns/${id}/leads/${lead.id}`} className="text-fg-1 hover:text-[#3385FF] font-medium truncate">
                      {lead.companyName}
                    </Link>
                  </div>
                  <div className="text-fg-3 truncate flex items-center gap-1.5 min-w-0 pr-2">
                    <span className="truncate">{lead.email || lead.phone || "—"}</span>
                    {lead.phone && (
                      <WhatsAppButton
                        leadId={lead.id}
                        phone={lead.phone}
                        companyName={lead.companyName}
                        label="💬 WA"
                        className="font-mono text-[10px] text-[#10B981] hover:underline px-1.5 py-0.5 rounded bg-[#10B981]/10 border border-[#10B981]/30 cursor-pointer shrink-0"
                      />
                    )}
                  </div>
                  <div>
                    <StateBadge state={lead.state as LeadState} />
                  </div>
                  <div className="text-right text-[#8A94A6]">{lead._count.messages}</div>
                  <div className="text-[#8A94A6]">{relativeTime(lead.lastTouchedAt)}</div>
                  <div className="flex justify-end">
                    <Link href={`/campaigns/${id}/leads/${lead.id}`}>
                      <Button variant="ghost" size="sm">View</Button>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Manual Lead Addition Modal */}
      {showManualLeadModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-[#12161F] border border-[#1E2433] rounded-xl p-5 max-w-md w-full flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-[#1E2433] pb-3">
              <div className="flex items-center gap-2">
                <span className="text-xl">➕</span>
                <h3 className="font-mono text-[14px] font-semibold text-fg-1 m-0">Add Lead Manually</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowManualLeadModal(false)}
                className="text-fg-4 hover:text-fg-1 font-mono text-[14px]"
              >
                ✕
              </button>
            </div>

            <div className="flex flex-col gap-3 font-mono text-[12px]">
              <div>
                <label className="text-[#8A94A6] mb-1 block">Company / Business Name *</label>
                <Input
                  value={manualLeadForm.companyName}
                  onChange={(e) => setManualLeadForm({ ...manualLeadForm, companyName: e.target.value })}
                  placeholder="e.g. Apex Pest Control"
                  className="bg-[#0E121B] border-[#1E2433]"
                />
              </div>

              <div>
                <label className="text-[#8A94A6] mb-1 block">Contact Email Address</label>
                <Input
                  type="email"
                  value={manualLeadForm.email}
                  onChange={(e) => setManualLeadForm({ ...manualLeadForm, email: e.target.value })}
                  placeholder="e.g. owner@apexpest.com"
                  className="bg-[#0E121B] border-[#1E2433]"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[#8A94A6] mb-1 block">Phone Number</label>
                  <Input
                    value={manualLeadForm.phone}
                    onChange={(e) => setManualLeadForm({ ...manualLeadForm, phone: e.target.value })}
                    placeholder="+1 555-0199"
                    className="bg-[#0E121B] border-[#1E2433]"
                  />
                </div>
                <div>
                  <label className="text-[#8A94A6] mb-1 block">Category / Niche</label>
                  <Input
                    value={manualLeadForm.category}
                    onChange={(e) => setManualLeadForm({ ...manualLeadForm, category: e.target.value })}
                    placeholder={campaign.businessType || "Pest Control"}
                    className="bg-[#0E121B] border-[#1E2433]"
                  />
                </div>
              </div>

              <div>
                <label className="text-[#8A94A6] mb-1 block">Website URL</label>
                <Input
                  value={manualLeadForm.website}
                  onChange={(e) => setManualLeadForm({ ...manualLeadForm, website: e.target.value })}
                  placeholder="https://apexpest.com"
                  className="bg-[#0E121B] border-[#1E2433]"
                />
              </div>

              <div>
                <label className="text-[#8A94A6] mb-1 block">Address / Location</label>
                <Input
                  value={manualLeadForm.address}
                  onChange={(e) => setManualLeadForm({ ...manualLeadForm, address: e.target.value })}
                  placeholder="Miami, FL"
                  className="bg-[#0E121B] border-[#1E2433]"
                />
              </div>

              {manualLeadError && <p className="font-mono text-[11px] text-red-400 m-0">{manualLeadError}</p>}

              <button
                type="button"
                onClick={handleCreateManualLead}
                disabled={savingManualLead}
                className="w-full bg-[#0066FF] hover:bg-[#0052CC] text-white py-2 rounded-lg font-mono font-semibold transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 mt-1"
              >
                {savingManualLead ? "Saving lead to database..." : "➕ Add Lead to Campaign"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
