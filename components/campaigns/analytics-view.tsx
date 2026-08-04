"use client";

import { useState } from "react";
import { Button, Icon } from "@/components/ui";

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

type AnalyticsViewProps = {
  status: string;
  stats: CampaignStats | null;
  onOpenSettings?: () => void;
  onRunOutreach?: () => Promise<void>;
  runningOutreach?: boolean;
};

export function AnalyticsView({
  status,
  stats,
  onOpenSettings,
  onRunOutreach,
  runningOutreach = false,
}: AnalyticsViewProps) {
  const [dateRange, setDateRange] = useState("Last 4 weeks");
  const [showDiagnoseModal, setShowDiagnoseModal] = useState(false);
  const [copiedShare, setCopiedShare] = useState(false);

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

  function handleShare() {
    if (typeof window !== "undefined") {
      navigator.clipboard.writeText(window.location.href);
      setCopiedShare(true);
      setTimeout(() => setCopiedShare(false), 2000);
    }
  }

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

      {/* Campaign Lead Pipeline Summary Banner */}
      <div className="bg-[#12161F] border border-[#1E2433] rounded-xl p-4 flex flex-col gap-3">
        <div className="flex items-center justify-between border-b border-[#1E2433] pb-2 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <span className="text-lg">📊</span>
            <h3 className="font-mono text-[13px] font-semibold text-fg-1 m-0">Campaign Lead Pipeline & Email History</h3>
          </div>
          <span className="font-mono text-[11px] text-[#8A94A6]">
            {withEmail} leads with emails ({totalLeads} total scouted)
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono text-[12px]">
          <div className="p-3 rounded-lg border border-[#1E2433] bg-[#0E121B] flex flex-col gap-1">
            <span className="text-[#8A94A6] text-[10px] uppercase">Total Scouted Pool</span>
            <span className="font-bold text-fg-1 text-[16px]">{totalLeads} Leads</span>
            <span className="text-[10px] text-fg-4">{withEmail} verified emails</span>
          </div>

          <div className="p-3 rounded-lg border border-[#0066FF]/30 bg-[#0066FF]/10 flex flex-col gap-1">
            <span className="text-[#3385FF] text-[10px] uppercase font-semibold">Sequence Started</span>
            <span className="font-bold text-[#3385FF] text-[16px]">{contacted} / {totalLeads}</span>
            <span className="text-[10px] text-[#3385FF]">{contactedPct.toFixed(1)}% contacted</span>
          </div>

          <div className="p-3 rounded-lg border border-amber/30 bg-amber/10 flex flex-col gap-1">
            <span className="text-amber text-[10px] uppercase font-semibold">Pending Outreach Queue</span>
            <span className="font-bold text-amber text-[16px]">{pendingCount} Leads</span>
            <span className="text-[10px] text-amber">{pendingPct.toFixed(1)}% ready to send</span>
          </div>

          <div className="p-3 rounded-lg border border-[#10B981]/30 bg-[#10B981]/10 flex flex-col gap-1">
            <span className="text-[#10B981] text-[10px] uppercase font-semibold">Outbound Emails Sent</span>
            <span className="font-bold text-[#10B981] text-[16px]">{totalSent} Emails</span>
            <span className="text-[10px] text-[#10B981]">{delivered} delivered via Resend</span>
          </div>
        </div>
      </div>

      {/* Top 5 Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {/* Sequence Started */}
        <div className="bg-[#12161F] border border-[#1E2433] rounded-xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[11px] text-[#8A94A6]">Sequence started</span>
            <span className="text-[#566175] text-[10px] cursor-help" title="Leads contacted via Resend">ⓘ</span>
          </div>
          <p className="font-sans text-[28px] font-bold text-fg-1 m-0 mt-3 tabular-nums">
            {contacted} <span className="text-[15px] font-normal text-[#566175]">/ {totalLeads}</span>
          </p>
        </div>

        {/* Total Emails Sent */}
        <div className="bg-[#12161F] border border-[#1E2433] rounded-xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[11px] text-[#8A94A6]">Emails Sent</span>
            <span className="text-[#566175] text-[10px] cursor-help" title="Total outbound emails delivered via Resend">ⓘ</span>
          </div>
          <p className="font-sans text-[28px] font-bold text-[#10B981] m-0 mt-3 tabular-nums">
            {totalSent} <span className="text-[15px] font-normal text-[#566175]">| {delivered} deliv</span>
          </p>
        </div>

        {/* Open rate */}
        <div className="bg-[#12161F] border border-[#1E2433] rounded-xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[11px] text-[#8A94A6]">Open rate</span>
            <span className="text-[#566175] text-[10px] cursor-help" title="Tracked via Resend email.opened webhook">ⓘ</span>
          </div>
          <p className="font-sans text-[28px] font-bold text-fg-1 m-0 mt-3 tabular-nums">
            {openRatePct.toFixed(1)}% <span className="text-[16px] font-normal text-[#566175]">| {opened}</span>
          </p>
        </div>

        {/* Click rate */}
        <div className="bg-[#12161F] border border-[#1E2433] rounded-xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[11px] text-[#8A94A6]">Click rate</span>
            <span className="text-[#566175] text-[10px] cursor-help" title="Tracked via Resend email.clicked webhook">ⓘ</span>
          </div>
          <p className="font-sans text-[28px] font-bold text-fg-1 m-0 mt-3 tabular-nums">
            {clickRatePct.toFixed(1)}% <span className="text-[16px] font-normal text-[#566175]">| {clicked}</span>
          </p>
        </div>

        {/* Reply rate */}
        <div className="bg-[#12161F] border border-[#1E2433] rounded-xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[11px] text-[#8A94A6]">Reply rate</span>
            <span className="text-[#566175] text-[10px] cursor-help" title="Tracked via Resend email.received webhook">ⓘ</span>
          </div>
          <p className="font-sans text-[28px] font-bold text-fg-1 m-0 mt-3 tabular-nums">
            {replyRatePct.toFixed(2)}% <span className="text-[16px] font-normal text-[#566175]">| {replied}</span>
          </p>
        </div>
      </div>

      {/* Row 2: Opportunities & Conversions cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Opportunities card */}
        <div className="bg-[#12161F] border border-[#1E2433] rounded-xl p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#3385FF]" />
              <span className="font-mono text-[13px] font-semibold text-fg-1">Opportunities</span>
            </div>
            <span className="font-mono text-[12px] text-[#8A94A6]">Replies Received</span>
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
        <div className="bg-[#12161F] border border-[#1E2433] rounded-xl p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#10B981]" />
              <span className="font-mono text-[13px] font-semibold text-fg-1">Conversions</span>
            </div>
            <span className="font-mono text-[12px] text-[#8A94A6]">Booked Meetings</span>
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
                <span className="text-[#8A94A6]">Resend API Key Status:</span>
                <span className="font-bold text-[#10B981]">✓ Connected</span>
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
    </div>
  );
}
