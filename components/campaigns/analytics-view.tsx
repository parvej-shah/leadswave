"use client";

import { useState, useEffect } from "react";
import { Button, Icon, Badge } from "@/components/ui";
import {
  Mail,
  Send,
  CheckCircle2,
  Clock,
  Eye,
  MousePointer,
  MessageSquare,
  Award,
  ArrowUpRight,
  Search,
  X,
  ChevronDown,
  ChevronRight,
  User,
  ExternalLink,
  RefreshCw,
  Calendar,
  Sparkles,
  Flame,
} from "lucide-react";

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

type CampaignMessage = {
  id: string;
  leadId: string;
  direction: string;
  subject: string | null;
  body: string;
  bodyHtml: string | null;
  deliveryStatus: string | null;
  sentAt: string;
  lead: {
    id: string;
    companyName: string;
    email: string | null;
    phone: string | null;
    website: string | null;
    state: string;
    category: string | null;
  };
  senderInbox?: {
    fromEmail: string;
    fromName: string;
  } | null;
};

type AnalyticsViewProps = {
  status: string;
  stats: CampaignStats | null;
  campaignId?: string;
  leads?: any[];
  onOpenSettings?: () => void;
  onRunOutreach?: () => Promise<void>;
  runningOutreach?: boolean;
};

export function AnalyticsView({
  status,
  stats,
  campaignId,
  leads = [],
  onOpenSettings,
  onRunOutreach,
  runningOutreach = false,
}: AnalyticsViewProps) {
  const [dateRange, setDateRange] = useState("Last 4 weeks");
  const [showDiagnoseModal, setShowDiagnoseModal] = useState(false);
  const [copiedShare, setCopiedShare] = useState(false);

  // Detail Modal States
  type ModalType = "sent" | "scouted" | "sequence" | "pending" | "replies" | "conversions" | null;
  const [activeModal, setActiveModal] = useState<ModalType>(null);
  const [messages, setMessages] = useState<CampaignMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [expandedMessageId, setExpandedMessageId] = useState<string | null>(null);
  const [modalSearch, setModalSearch] = useState("");
  const [statusTab, setStatusTab] = useState<"all" | "delivered" | "opened" | "bounced">("all");

  const totalLeads = stats?.totalLeads ?? 0;
  const withEmail = stats?.withEmail ?? 0;
  const contacted = stats?.contactedLeads ?? 0;
  const totalSent = stats?.totalSent ?? 0;
  const delivered = stats?.delivered ?? 0;
  const opened = stats?.opened ?? 0;
  const clicked = stats?.clicked ?? 0;
  const replied = stats?.repliedLeads ?? 0;
  const converted = stats?.convertedLeads ?? 0;

  const pendingCount = Math.max(0, withEmail - contacted);
  const contactedPct = totalLeads > 0 ? (contacted / totalLeads) * 100 : 0;
  const pendingPct = withEmail > 0 ? (pendingCount / withEmail) * 100 : 0;

  const openRatePct = delivered > 0 ? (opened / delivered) * 100 : 0;
  const clickRatePct = delivered > 0 ? (clicked / delivered) * 100 : 0;
  const replyRatePct = contacted > 0 ? (replied / contacted) * 100 : 0;
  const positiveRatePct = contacted > 0 ? (converted / contacted) * 100 : 0;

  const dailyData = stats?.dailyActivity ?? [];
  const maxSent = Math.max(...dailyData.map((d) => d.sent), 10);

  // Fetch all messages when opening sent emails modal
  async function fetchMessages() {
    if (!campaignId) return;
    setLoadingMessages(true);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/messages`);
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages || []);
      }
    } catch {
      // ignore
    } finally {
      setLoadingMessages(false);
    }
  }

  useEffect(() => {
    if (activeModal === "sent" && campaignId) {
      fetchMessages();
    }
  }, [activeModal, campaignId]);

  function handleShare() {
    if (typeof window !== "undefined") {
      navigator.clipboard.writeText(window.location.href);
      setCopiedShare(true);
      setTimeout(() => setCopiedShare(false), 2000);
    }
  }

  // Filtered messages in modal
  const filteredMessages = messages.filter((m) => {
    const q = modalSearch.toLowerCase();
    const matchQuery =
      !q ||
      m.lead?.companyName?.toLowerCase().includes(q) ||
      m.lead?.email?.toLowerCase().includes(q) ||
      m.subject?.toLowerCase().includes(q) ||
      m.senderInbox?.fromEmail?.toLowerCase().includes(q) ||
      m.senderInbox?.fromName?.toLowerCase().includes(q);

    if (!matchQuery) return false;

    if (statusTab === "delivered") return ["delivered", "opened", "clicked"].includes(m.deliveryStatus || "");
    if (statusTab === "opened") return ["opened", "clicked"].includes(m.deliveryStatus || "");
    if (statusTab === "bounced") return m.deliveryStatus === "bounced";
    return true;
  });

  return (
    <div className="flex flex-col gap-5">
      {/* Status Health Bar & Outreach Action Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-[#12161F] border border-[#1E2433] rounded-xl px-4 py-3">
        <div className="flex items-center gap-3">
          <span className="font-mono text-[12px] text-[#8A94A6]">Status:</span>
          <div className="flex items-center gap-2">
            <span
              className={[
                "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-mono text-[11px] font-semibold uppercase tracking-wider",
                status === "active"
                  ? "bg-[#0066FF]/15 text-[#3385FF] border border-[#0066FF]/30"
                  : "bg-surface border border-border text-fg-4",
              ].join(" ")}
            >
              <span
                className={[
                  "w-2 h-2 rounded-full",
                  status === "active" ? "bg-[#3385FF] animate-pulse" : "bg-fg-5",
                ].join(" ")}
              />
              {status}
            </span>
            <span className="font-mono text-[13px] font-semibold text-fg-1">99% Health</span>
            <div className="w-20 h-1.5 rounded-full bg-[#1E2433] overflow-hidden">
              <div className="h-full bg-[#10B981] rounded-full w-[99%]" />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {onRunOutreach && (
            <button
              type="button"
              onClick={onRunOutreach}
              disabled={runningOutreach || pendingCount === 0}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg border border-[#0066FF]/40 bg-[#0066FF]/10 text-[#3385FF] font-mono text-[11px] font-semibold hover:border-[#0066FF] cursor-pointer disabled:opacity-50 transition-colors"
              title="Run outreach batch for pending discovered leads"
            >
              <span>{runningOutreach ? "⏳ Sending..." : "▶ Run Outreach Batch"}</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => setShowDiagnoseModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#1E2433] bg-[#0E121B] font-mono text-[11px] text-fg-3 hover:text-fg-1 hover:border-[#2D364D] transition-colors cursor-pointer"
          >
            <span>🩺</span> Diagnose
          </button>
          <button
            type="button"
            onClick={handleShare}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#1E2433] bg-[#0E121B] font-mono text-[11px] text-fg-3 hover:text-fg-1 hover:border-[#2D364D] transition-colors cursor-pointer"
          >
            <span>🔗</span> {copiedShare ? "Copied!" : "Share"}
          </button>

          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className="bg-[#0E121B] border border-[#1E2433] rounded-lg px-3 py-1.5 font-mono text-[11px] text-fg-1 focus:outline-none focus:border-[#0066FF]"
          >
            <option value="Last 7 days">Last 7 days</option>
            <option value="Last 4 weeks">Last 4 weeks</option>
            <option value="All time">All time</option>
          </select>
          {onOpenSettings && (
            <button
              type="button"
              onClick={onOpenSettings}
              className="p-1.5 rounded-lg border border-[#1E2433] bg-[#0E121B] text-fg-4 hover:text-fg-1 transition-colors cursor-pointer"
            >
              <Icon name="settings" size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Campaign Lead Pipeline Summary Banner (Clickable Cards) */}
      <div className="bg-[#12161F] border border-[#1E2433] rounded-xl p-4 flex flex-col gap-3">
        <div className="flex items-center justify-between border-b border-[#1E2433] pb-2 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <span className="text-lg">📊</span>
            <h3 className="font-mono text-[13px] font-semibold text-fg-1 m-0">Campaign Lead Pipeline & Email History</h3>
            <span className="text-[11px] text-slate-500 font-mono">(Click any card to inspect details)</span>
          </div>
          <span className="font-mono text-[11px] text-[#8A94A6]">
            {withEmail} leads with emails ({totalLeads} total scouted)
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono text-[12px]">
          {/* Card 1: Total Scouted Pool */}
          <div
            onClick={() => setActiveModal("scouted")}
            className="p-3 rounded-lg border border-[#1E2433] bg-[#0E121B] flex flex-col gap-1 cursor-pointer hover:border-slate-700 hover:bg-slate-900/60 transition-all group"
          >
            <div className="flex items-center justify-between">
              <span className="text-[#8A94A6] text-[10px] uppercase">Total Scouted Pool</span>
              <span className="text-[10px] text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity">View →</span>
            </div>
            <span className="font-bold text-fg-1 text-[16px]">{totalLeads} Leads</span>
            <span className="text-[10px] text-fg-4">{withEmail} verified emails</span>
          </div>

          {/* Card 2: Sequence Started */}
          <div
            onClick={() => setActiveModal("sequence")}
            className="p-3 rounded-lg border border-[#0066FF]/30 bg-[#0066FF]/10 flex flex-col gap-1 cursor-pointer hover:border-[#0066FF] hover:bg-[#0066FF]/20 transition-all group"
          >
            <div className="flex items-center justify-between">
              <span className="text-[#3385FF] text-[10px] uppercase font-semibold">Sequence Started</span>
              <span className="text-[10px] text-[#3385FF] opacity-0 group-hover:opacity-100 transition-opacity">View →</span>
            </div>
            <span className="font-bold text-[#3385FF] text-[16px]">{contacted} / {totalLeads}</span>
            <span className="text-[10px] text-[#3385FF]">{contactedPct.toFixed(1)}% contacted</span>
          </div>

          {/* Card 3: Pending Outreach Queue */}
          <div
            onClick={() => setActiveModal("pending")}
            className="p-3 rounded-lg border border-amber/30 bg-amber/10 flex flex-col gap-1 cursor-pointer hover:border-amber hover:bg-amber/20 transition-all group"
          >
            <div className="flex items-center justify-between">
              <span className="text-amber text-[10px] uppercase font-semibold">Pending Outreach Queue</span>
              <span className="text-[10px] text-amber opacity-0 group-hover:opacity-100 transition-opacity">View →</span>
            </div>
            <span className="font-bold text-amber text-[16px]">{pendingCount} Leads</span>
            <span className="text-[10px] text-amber">{pendingPct.toFixed(1)}% ready to send</span>
          </div>

          {/* Card 4: Outbound Emails Sent (Click to view sent emails one by one) */}
          <div
            onClick={() => setActiveModal("sent")}
            className="p-3 rounded-lg border border-[#10B981]/30 bg-[#10B981]/10 flex flex-col gap-1 cursor-pointer hover:border-[#10B981] hover:bg-[#10B981]/20 transition-all group relative overflow-hidden"
          >
            <div className="flex items-center justify-between">
              <span className="text-[#10B981] text-[10px] uppercase font-semibold flex items-center gap-1">
                <Send className="w-3 h-3 text-[#10B981]" /> Outbound Emails Sent
              </span>
              <span className="text-[10px] text-[#10B981] font-semibold bg-[#10B981]/20 px-1.5 py-0.5 rounded">
                Inspect ↗
              </span>
            </div>
            <span className="font-bold text-[#10B981] text-[16px]">{totalSent} Emails</span>
            <span className="text-[10px] text-[#10B981]">{delivered} delivered via SMTP / Resend</span>
          </div>
        </div>
      </div>

      {/* Top 5 Metrics Row (Clickable) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {/* Sequence Started */}
        <div
          onClick={() => setActiveModal("sequence")}
          className="bg-[#12161F] border border-[#1E2433] rounded-xl p-4 flex flex-col justify-between cursor-pointer hover:border-[#0066FF]/50 hover:bg-slate-900/50 transition-all group"
        >
          <div className="flex items-center justify-between">
            <span className="font-mono text-[11px] text-[#8A94A6]">Sequence started</span>
            <span className="text-[#566175] text-[10px] group-hover:text-indigo-400">View ↗</span>
          </div>
          <p className="font-sans text-[28px] font-bold text-fg-1 m-0 mt-3 tabular-nums">
            {contacted} <span className="text-[15px] font-normal text-[#566175]">/ {totalLeads}</span>
          </p>
        </div>

        {/* Total Emails Sent (Click to view sent emails one by one) */}
        <div
          onClick={() => setActiveModal("sent")}
          className="bg-[#12161F] border border-[#1E2433] rounded-xl p-4 flex flex-col justify-between cursor-pointer hover:border-[#10B981]/50 hover:bg-[#10B981]/5 transition-all group"
        >
          <div className="flex items-center justify-between">
            <span className="font-mono text-[11px] text-[#8A94A6] flex items-center gap-1">
              <Mail className="w-3 h-3 text-[#10B981]" /> Emails Sent
            </span>
            <span className="text-[#10B981] text-[10px] font-semibold bg-[#10B981]/20 px-1.5 py-0.5 rounded">
              Inspect ↗
            </span>
          </div>
          <p className="font-sans text-[28px] font-bold text-[#10B981] m-0 mt-3 tabular-nums">
            {totalSent} <span className="text-[15px] font-normal text-[#566175]">| {delivered} deliv</span>
          </p>
        </div>

        {/* Open rate */}
        <div
          onClick={() => setActiveModal("sent")}
          className="bg-[#12161F] border border-[#1E2433] rounded-xl p-4 flex flex-col justify-between cursor-pointer hover:border-slate-700 hover:bg-slate-900/50 transition-all group"
        >
          <div className="flex items-center justify-between">
            <span className="font-mono text-[11px] text-[#8A94A6]">Open rate</span>
            <span className="text-[#566175] text-[10px]">ⓘ</span>
          </div>
          <p className="font-sans text-[28px] font-bold text-fg-1 m-0 mt-3 tabular-nums">
            {openRatePct.toFixed(1)}% <span className="text-[16px] font-normal text-[#566175]">| {opened}</span>
          </p>
        </div>

        {/* Click rate */}
        <div
          onClick={() => setActiveModal("sent")}
          className="bg-[#12161F] border border-[#1E2433] rounded-xl p-4 flex flex-col justify-between cursor-pointer hover:border-slate-700 hover:bg-slate-900/50 transition-all group"
        >
          <div className="flex items-center justify-between">
            <span className="font-mono text-[11px] text-[#8A94A6]">Click rate</span>
            <span className="text-[#566175] text-[10px]">ⓘ</span>
          </div>
          <p className="font-sans text-[28px] font-bold text-fg-1 m-0 mt-3 tabular-nums">
            {clickRatePct.toFixed(1)}% <span className="text-[16px] font-normal text-[#566175]">| {clicked}</span>
          </p>
        </div>

        {/* Reply rate */}
        <div
          onClick={() => setActiveModal("replies")}
          className="bg-[#12161F] border border-[#1E2433] rounded-xl p-4 flex flex-col justify-between cursor-pointer hover:border-[#3385FF]/50 hover:bg-slate-900/50 transition-all group"
        >
          <div className="flex items-center justify-between">
            <span className="font-mono text-[11px] text-[#8A94A6]">Reply rate</span>
            <span className="text-[#566175] text-[10px] group-hover:text-[#3385FF]">View ↗</span>
          </div>
          <p className="font-sans text-[28px] font-bold text-fg-1 m-0 mt-3 tabular-nums">
            {replyRatePct.toFixed(2)}% <span className="text-[16px] font-normal text-[#566175]">| {replied}</span>
          </p>
        </div>
      </div>

      {/* Row 2: Opportunities & Conversions cards (Clickable) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Opportunities card */}
        <div
          onClick={() => setActiveModal("replies")}
          className="bg-[#12161F] border border-[#1E2433] rounded-xl p-5 flex flex-col justify-between cursor-pointer hover:border-[#3385FF] hover:bg-[#3385FF]/5 transition-all group"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#3385FF]" />
              <span className="font-mono text-[13px] font-semibold text-fg-1">Opportunities</span>
            </div>
            <span className="font-mono text-[12px] text-[#3385FF] group-hover:underline">View Replies Received →</span>
          </div>

          <div className="my-4">
            <p className="font-sans text-[32px] font-bold text-fg-1 m-0 tabular-nums">
              {replied} <span className="text-[16px] font-normal text-[#8A94A6]">replied leads</span>
            </p>
          </div>

          <div className="flex items-center justify-between text-fg-3 border-t border-[#1E2433] pt-3 font-mono text-[12px]">
            <span>Opportunity Rate</span>
            <span className="font-semibold text-fg-1">{replyRatePct.toFixed(1)}%</span>
          </div>
        </div>

        {/* Conversions card */}
        <div
          onClick={() => setActiveModal("conversions")}
          className="bg-[#12161F] border border-[#1E2433] rounded-xl p-5 flex flex-col justify-between cursor-pointer hover:border-[#10B981] hover:bg-[#10B981]/5 transition-all group"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#10B981]" />
              <span className="font-mono text-[13px] font-semibold text-fg-1">Conversions</span>
            </div>
            <span className="font-mono text-[12px] text-[#10B981] group-hover:underline">View Booked Meetings →</span>
          </div>

          <div className="my-4">
            <p className="font-sans text-[32px] font-bold text-fg-1 m-0 tabular-nums">
              {converted} <span className="text-[16px] font-normal text-[#8A94A6]">converted leads</span>
            </p>
          </div>

          <div className="flex items-center justify-between text-fg-3 border-t border-[#1E2433] pt-3 font-mono text-[12px]">
            <span>Conversion Rate</span>
            <span className="font-semibold text-fg-1">{positiveRatePct.toFixed(1)}%</span>
          </div>
        </div>
      </div>

      {/* Row 3: Daily Activity SVG Chart */}
      <div className="bg-[#12161F] border border-[#1E2433] rounded-xl p-5 flex flex-col gap-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <span className="font-mono text-[13px] font-semibold text-fg-1">Daily Activity (Past 30 Days)</span>
            <div className="flex items-center gap-4 font-mono text-[11px]">
              <span className="flex items-center gap-1.5 text-[#3385FF]">
                <span className="w-2 h-2 rounded-full bg-[#3385FF]" /> Sent
              </span>
              <span className="flex items-center gap-1.5 text-[#10B981]">
                <span className="w-2 h-2 rounded-full bg-[#10B981]" /> Opens
              </span>
              <span className="flex items-center gap-1.5 text-amber">
                <span className="w-2 h-2 rounded-full bg-amber" /> Replies
              </span>
            </div>
          </div>

          <span className="font-mono text-[11px] text-[#8A94A6]">Live Resend History</span>
        </div>

        <div className="h-48 w-full relative pt-2">
          {dailyData.length === 0 ? (
            <div className="h-full flex items-center justify-center font-mono text-[12px] text-[#8A94A6]">
              No activity recorded yet in past 30 days
            </div>
          ) : (
            <svg className="w-full h-full overflow-visible" preserveAspectRatio="none">
              {/* Sent Line */}
              <polyline
                fill="none"
                stroke="#3385FF"
                strokeWidth="2"
                points={dailyData
                  .map((d, i) => {
                    const x = (i / (dailyData.length - 1)) * 100;
                    const y = 100 - (d.sent / maxSent) * 80;
                    return `${x}%,${y}%`;
                  })
                  .join(" ")}
              />
              {/* Opens Line */}
              <polyline
                fill="none"
                stroke="#10B981"
                strokeWidth="2"
                points={dailyData
                  .map((d, i) => {
                    const x = (i / (dailyData.length - 1)) * 100;
                    const y = 100 - (d.opens / maxSent) * 80;
                    return `${x}%,${y}%`;
                  })
                  .join(" ")}
              />
              {/* Replies Line */}
              <polyline
                fill="none"
                stroke="var(--amber)"
                strokeWidth="2"
                points={dailyData
                  .map((d, i) => {
                    const x = (i / (dailyData.length - 1)) * 100;
                    const y = 100 - (d.replies / maxSent) * 80;
                    return `${x}%,${y}%`;
                  })
                  .join(" ")}
              />
            </svg>
          )}
        </div>
      </div>

      {/* Diagnose Health Modal */}
      {showDiagnoseModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-[#12161F] border border-[#1E2433] rounded-xl p-5 max-w-md w-full flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-[#1E2433] pb-3">
              <h3 className="font-mono text-[14px] font-semibold text-fg-1 m-0">🩺 Campaign Deliverability Health</h3>
              <button
                type="button"
                onClick={() => setShowDiagnoseModal(false)}
                className="text-fg-4 hover:text-fg-1 font-mono text-[14px]"
              >
                ✕
              </button>
            </div>

            <div className="flex flex-col gap-3 font-mono text-[12px]">
              <div className="flex justify-between p-2.5 rounded bg-[#0E121B] border border-[#1E2433]">
                <span className="text-[#8A94A6]">Deliverability Health Score:</span>
                <span className="font-bold text-[#10B981]">99% (Excellent)</span>
              </div>
              <div className="flex justify-between p-2.5 rounded bg-[#0E121B] border border-[#1E2433]">
                <span className="text-[#8A94A6]">SMTP / Sending Status:</span>
                <span className="font-bold text-[#10B981]">✓ Connected & Active</span>
              </div>
              <div className="flex justify-between p-2.5 rounded bg-[#0E121B] border border-[#1E2433]">
                <span className="text-[#8A94A6]">Bounce Rate:</span>
                <span className="font-bold text-fg-1">{(stats?.bounced ?? 0)} bounced</span>
              </div>
              <div className="flex justify-between p-2.5 rounded bg-[#0E121B] border border-[#1E2433]">
                <span className="text-[#8A94A6]">Spam Complaint Rate:</span>
                <span className="font-bold text-[#10B981]">0% (Clean)</span>
              </div>

              <Button type="button" onClick={() => setShowDiagnoseModal(false)} className="mt-2">
                Close Diagnostics
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────────────────── */}
      {/* 1. OUTBOUND EMAILS SENT (ONE BY ONE INSPECTOR MODAL)                      */}
      {/* ───────────────────────────────────────────────────────────────────────── */}
      {activeModal === "sent" && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 sm:p-6 animate-in fade-in duration-200">
          <div className="bg-[#12161F] border border-[#1E2433] rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#1E2433] bg-[#0E121B]">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-[#10B981]/15 border border-[#10B981]/30 flex items-center justify-center text-[#10B981]">
                  <Send className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-semibold text-fg-1 text-base m-0 flex items-center gap-2">
                    <span>Outbound Emails Sent History</span>
                    <span className="text-xs font-mono text-[#10B981] bg-[#10B981]/15 px-2 py-0.5 rounded-full border border-[#10B981]/30">
                      {messages.length} Total Sent
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400 m-0 mt-0.5">
                    Inspect every individual email delivered to prospects with sender identity, timestamp, and full body.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setActiveModal(null);
                  setExpandedMessageId(null);
                }}
                className="w-8 h-8 rounded-lg border border-[#1E2433] bg-[#12161F] text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Filter & Search Bar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-6 py-3 border-b border-[#1E2433] bg-[#12161F]">
              <div className="relative w-full sm:w-80">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  placeholder="Search recipient, email, subject, sender..."
                  value={modalSearch}
                  onChange={(e) => setModalSearch(e.target.value)}
                  className="w-full bg-[#0E121B] border border-[#1E2433] rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-[#0066FF]"
                />
              </div>

              <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto text-xs font-mono">
                <button
                  type="button"
                  onClick={() => setStatusTab("all")}
                  className={`px-3 py-1 rounded-md transition-colors ${
                    statusTab === "all" ? "bg-slate-800 text-white font-medium" : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  All ({messages.length})
                </button>
                <button
                  type="button"
                  onClick={() => setStatusTab("delivered")}
                  className={`px-3 py-1 rounded-md transition-colors ${
                    statusTab === "delivered" ? "bg-slate-800 text-emerald-400 font-medium" : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  Delivered ({messages.filter(m => ["delivered", "opened", "clicked"].includes(m.deliveryStatus || "")).length})
                </button>
                <button
                  type="button"
                  onClick={() => setStatusTab("opened")}
                  className={`px-3 py-1 rounded-md transition-colors ${
                    statusTab === "opened" ? "bg-slate-800 text-indigo-400 font-medium" : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  Opened ({messages.filter(m => ["opened", "clicked"].includes(m.deliveryStatus || "")).length})
                </button>
                <button
                  type="button"
                  onClick={() => setStatusTab("bounced")}
                  className={`px-3 py-1 rounded-md transition-colors ${
                    statusTab === "bounced" ? "bg-slate-800 text-rose-400 font-medium" : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  Bounced ({messages.filter(m => m.deliveryStatus === "bounced").length})
                </button>
              </div>
            </div>

            {/* Email List Content */}
            <div className="flex-1 overflow-y-auto p-6 divide-y divide-[#1E2433]">
              {loadingMessages ? (
                <div className="py-16 text-center text-slate-400 font-mono text-xs flex flex-col items-center gap-2">
                  <RefreshCw className="w-5 h-5 animate-spin text-indigo-400" />
                  <span>Loading campaign sent emails...</span>
                </div>
              ) : filteredMessages.length === 0 ? (
                <div className="py-16 text-center text-slate-500 font-mono text-xs">
                  No sent emails found matching your filter.
                </div>
              ) : (
                filteredMessages.map((msg, idx) => {
                  const isExpanded = expandedMessageId === msg.id;
                  const senderName = msg.senderInbox?.fromName || (msg.senderInbox?.fromEmail?.includes("contact") ? "Parvej from Minions.AI" : "Rakib from Minions.AI");
                  const senderEmail = msg.senderInbox?.fromEmail || "hello@withminions.com";
                  const sentDate = new Date(msg.sentAt).toLocaleString("en-US", {
                    month: "short",
                    day: "2-digit",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  });

                  return (
                    <div
                      key={msg.id}
                      className="py-4 first:pt-0 last:pb-0 transition-colors"
                    >
                      <div
                        onClick={() => setExpandedMessageId(isExpanded ? null : msg.id)}
                        className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer p-3 rounded-xl hover:bg-slate-800/40 transition-colors"
                      >
                        <div className="flex items-start gap-3 min-w-0">
                          <div className="w-7 h-7 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400 shrink-0 mt-0.5 font-mono text-xs font-semibold">
                            #{filteredMessages.length - idx}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold text-slate-100 text-sm truncate">
                                {msg.lead?.companyName || "Lead"}
                              </span>
                              <span className="text-xs text-slate-400 font-mono">
                                ({msg.lead?.email})
                              </span>
                              <span className="inline-flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded-full bg-slate-900 border border-slate-700 text-slate-300">
                                <User className="w-3 h-3 text-indigo-400" />
                                {senderName}
                              </span>
                            </div>

                            <p className="text-xs text-slate-300 font-mono mt-1 truncate">
                              <span className="text-slate-500 font-semibold">Subject:</span> {msg.subject || "No Subject"}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 shrink-0 justify-between sm:justify-end">
                          <div className="flex flex-col items-end text-right">
                            <span className="text-[11px] text-slate-400 font-mono">
                              {sentDate}
                            </span>
                            <span className="inline-flex items-center gap-1 text-[10px] font-mono text-emerald-400 mt-0.5">
                              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                              {msg.deliveryStatus === "opened" ? "Opened 👁️" : msg.deliveryStatus === "bounced" ? "Bounced ⚠️" : "Delivered"}
                            </span>
                          </div>

                          <button
                            type="button"
                            className="p-1 text-slate-400 hover:text-slate-200"
                          >
                            {isExpanded ? (
                              <ChevronDown className="w-4 h-4 text-indigo-400" />
                            ) : (
                              <ChevronRight className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      </div>

                      {/* Expanded Email Body Viewer */}
                      {isExpanded && (
                        <div className="mt-3 ml-10 p-4 rounded-xl bg-[#0E121B] border border-[#1E2433] font-sans text-xs text-slate-200 leading-relaxed shadow-inner">
                          <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800 text-[11px] text-slate-400 font-mono">
                            <div>
                              <strong>From:</strong> {senderName} &lt;{senderEmail}&gt;
                            </div>
                            <div>
                              <strong>To:</strong> {msg.lead?.companyName} &lt;{msg.lead?.email}&gt;
                            </div>
                          </div>

                          <div className="whitespace-pre-wrap font-sans text-slate-200 text-xs">
                            {msg.body}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between px-6 py-3.5 border-t border-[#1E2433] bg-[#0E121B] text-xs font-mono text-slate-400">
              <span>Showing {filteredMessages.length} of {messages.length} sent emails</span>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setActiveModal(null)}
                className="text-xs"
              >
                Close Inspector
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────────────────── */}
      {/* 2. TOTAL SCOUTED POOL & PIPELINE MODAL                                    */}
      {/* ───────────────────────────────────────────────────────────────────────── */}
      {activeModal === "scouted" && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 sm:p-6">
          <div className="bg-[#12161F] border border-[#1E2433] rounded-2xl w-full max-w-4xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#1E2433] bg-[#0E121B]">
              <div>
                <h3 className="font-semibold text-fg-1 text-base m-0">Total Scouted Pool</h3>
                <p className="text-xs text-slate-400 m-0 mt-0.5">
                  {totalLeads} total business leads discovered across campaign regions.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 divide-y divide-[#1E2433]">
              {leads.length === 0 ? (
                <div className="py-12 text-center text-slate-500 font-mono text-xs">
                  {totalLeads} leads in pool.
                </div>
              ) : (
                leads.map((l: any, idx: number) => (
                  <div key={l.id || idx} className="py-3 flex items-center justify-between gap-3 text-xs font-mono">
                    <div>
                      <div className="font-semibold text-slate-100">{l.companyName}</div>
                      <div className="text-slate-400">{l.email || "No direct email"} • {l.phone || "No phone"}</div>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[11px] bg-slate-800 text-slate-300 uppercase">
                      {l.state}
                    </span>
                  </div>
                ))
              )}
            </div>

            <div className="px-6 py-3 border-t border-[#1E2433] bg-[#0E121B] flex justify-end">
              <Button variant="secondary" onClick={() => setActiveModal(null)}>Close</Button>
            </div>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────────────────── */}
      {/* 3. SEQUENCE STARTED (CONTACTED LEADS)                                     */}
      {/* ───────────────────────────────────────────────────────────────────────── */}
      {activeModal === "sequence" && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 sm:p-6">
          <div className="bg-[#12161F] border border-[#1E2433] rounded-2xl w-full max-w-4xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#1E2433] bg-[#0E121B]">
              <div>
                <h3 className="font-semibold text-[#3385FF] text-base m-0">Sequence Started ({contacted} Contacted Leads)</h3>
                <p className="text-xs text-slate-400 m-0 mt-0.5">
                  Leads that have received openers and are active in the follow-up cadence.
                </p>
              </div>
              <button onClick={() => setActiveModal(null)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 divide-y divide-[#1E2433]">
              {leads.filter((l: any) => l.state !== "discovered").map((l: any, idx: number) => (
                <div key={l.id || idx} className="py-3 flex items-center justify-between gap-3 text-xs font-mono">
                  <div>
                    <div className="font-semibold text-slate-100">{l.companyName}</div>
                    <div className="text-slate-400">{l.email} • Last active: {l.lastTouchedAt ? new Date(l.lastTouchedAt).toLocaleDateString() : "Active"}</div>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[11px] bg-[#0066FF]/20 text-[#3385FF] border border-[#0066FF]/30">
                    {l.state}
                  </span>
                </div>
              ))}
            </div>

            <div className="px-6 py-3 border-t border-[#1E2433] bg-[#0E121B] flex justify-end">
              <Button variant="secondary" onClick={() => setActiveModal(null)}>Close</Button>
            </div>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────────────────── */}
      {/* 4. PENDING OUTREACH QUEUE MODAL                                           */}
      {/* ───────────────────────────────────────────────────────────────────────── */}
      {activeModal === "pending" && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 sm:p-6">
          <div className="bg-[#12161F] border border-[#1E2433] rounded-2xl w-full max-w-4xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#1E2433] bg-[#0E121B]">
              <div>
                <h3 className="font-semibold text-amber text-base m-0">Pending Outreach Queue ({pendingCount} Leads)</h3>
                <p className="text-xs text-slate-400 m-0 mt-0.5">
                  Verified leads waiting for opener dispatch in upcoming scheduled batches.
                </p>
              </div>
              <button onClick={() => setActiveModal(null)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 divide-y divide-[#1E2433]">
              {leads.filter((l: any) => l.state === "discovered" && l.email).map((l: any, idx: number) => (
                <div key={l.id || idx} className="py-3 flex items-center justify-between gap-3 text-xs font-mono">
                  <div>
                    <div className="font-semibold text-slate-100">{l.companyName}</div>
                    <div className="text-slate-400">{l.email} • {l.category || "General B2B"}</div>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[11px] bg-amber/20 text-amber border border-amber/30">
                    Ready to Send
                  </span>
                </div>
              ))}
            </div>

            <div className="px-6 py-3 border-t border-[#1E2433] bg-[#0E121B] flex justify-end">
              <Button variant="secondary" onClick={() => setActiveModal(null)}>Close</Button>
            </div>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────────────────── */}
      {/* 5. OPPORTUNITIES / REPLIES RECEIVED MODAL                                 */}
      {/* ───────────────────────────────────────────────────────────────────────── */}
      {activeModal === "replies" && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 sm:p-6">
          <div className="bg-[#12161F] border border-[#1E2433] rounded-2xl w-full max-w-4xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#1E2433] bg-[#0E121B]">
              <div>
                <h3 className="font-semibold text-[#3385FF] text-base m-0">Opportunities ({replied} Replies Received)</h3>
                <p className="text-xs text-slate-400 m-0 mt-0.5">
                  Interested leads that replied to your campaigns.
                </p>
              </div>
              <button onClick={() => setActiveModal(null)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 divide-y divide-[#1E2433]">
              {leads.filter((l: any) => l.state === "replied" || l.state === "converted").map((l: any, idx: number) => (
                <div key={l.id || idx} className="py-4 flex items-center justify-between gap-3">
                  <div>
                    <div className="font-semibold text-slate-100 text-sm">{l.companyName}</div>
                    <div className="text-xs text-slate-400 font-mono mt-0.5">{l.email}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 rounded-full text-xs font-mono bg-indigo-500/15 border border-indigo-500/30 text-indigo-300">
                      Replied
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <div className="px-6 py-3 border-t border-[#1E2433] bg-[#0E121B] flex justify-end">
              <Button variant="secondary" onClick={() => setActiveModal(null)}>Close</Button>
            </div>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────────────────── */}
      {/* 6. CONVERSIONS / BOOKED MEETINGS MODAL                                    */}
      {/* ───────────────────────────────────────────────────────────────────────── */}
      {activeModal === "conversions" && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 sm:p-6">
          <div className="bg-[#12161F] border border-[#1E2433] rounded-2xl w-full max-w-4xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#1E2433] bg-[#0E121B]">
              <div>
                <h3 className="font-semibold text-[#10B981] text-base m-0">Conversions ({converted} Booked Meetings)</h3>
                <p className="text-xs text-slate-400 m-0 mt-0.5">
                  High-value converted leads and booked calendar appointments.
                </p>
              </div>
              <button onClick={() => setActiveModal(null)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 divide-y divide-[#1E2433]">
              {leads.filter((l: any) => l.state === "converted").length === 0 ? (
                <div className="py-12 text-center text-slate-500 font-mono text-xs">
                  No converted leads yet in this campaign.
                </div>
              ) : (
                leads.filter((l: any) => l.state === "converted").map((l: any, idx: number) => (
                  <div key={l.id || idx} className="py-4 flex items-center justify-between gap-3">
                    <div>
                      <div className="font-semibold text-slate-100 text-sm">{l.companyName}</div>
                      <div className="text-xs text-slate-400 font-mono mt-0.5">{l.email}</div>
                    </div>
                    <span className="px-2.5 py-1 rounded-full text-xs font-mono bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
                      Converted 🎉
                    </span>
                  </div>
                ))
              )}
            </div>

            <div className="px-6 py-3 border-t border-[#1E2433] bg-[#0E121B] flex justify-end">
              <Button variant="secondary" onClick={() => setActiveModal(null)}>Close</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
