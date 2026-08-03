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
};

export function AnalyticsView({ status, stats, onOpenSettings }: AnalyticsViewProps) {
  const [dateRange, setDateRange] = useState("Last 4 weeks");
  const [showDiagnoseModal, setShowDiagnoseModal] = useState(false);
  const [copiedShare, setCopiedShare] = useState(false);

  const contacted = stats?.contactedLeads ?? 0;
  const delivered = stats?.delivered ?? 0;
  const opened = stats?.opened ?? 0;
  const clicked = stats?.clicked ?? 0;
  const replied = stats?.repliedLeads ?? 0;
  const converted = stats?.convertedLeads ?? 0;

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
      {/* Status Health Bar */}
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
            <span className="font-mono text-[13px] font-semibold text-fg-1">99%</span>
            <div className="w-20 h-1.5 rounded-full bg-[#1E2433] overflow-hidden">
              <div className="h-full bg-[#10B981] rounded-full w-[99%]" />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
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
            <Icon name="link" size={13} />
            {copiedShare ? "Copied!" : "Share"}
          </button>
          <select
            className="bg-[#0E121B] border border-[#1E2433] rounded-lg px-3 py-1.5 font-mono text-[11px] text-fg-2 cursor-pointer focus:outline-none"
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
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

      {/* Top 5 Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {/* Sequence Started */}
        <div className="bg-[#12161F] border border-[#1E2433] rounded-xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[11px] text-[#8A94A6]">Sequence started</span>
            <span className="text-[#566175] text-[10px] cursor-help" title="Leads contacted via Resend">ⓘ</span>
          </div>
          <p className="font-sans text-[28px] font-bold text-fg-1 m-0 mt-3 tabular-nums">{contacted}</p>
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

        {/* Positive Reply Rate */}
        <div className="bg-[#12161F] border border-[#1E2433] rounded-xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[11px] text-[#8A94A6]">Positive Reply Rate</span>
            <span className="text-[#566175] text-[10px] cursor-help" title="Leads converted to booked meetings">ⓘ</span>
          </div>
          <p className="font-sans text-[28px] font-bold text-fg-1 m-0 mt-3 tabular-nums">
            {positiveRatePct.toFixed(1)}% <span className="text-[16px] font-normal text-[#566175]">| {converted}</span>
          </p>
        </div>
      </div>

      {/* Row 2: Opportunities & Conversions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="bg-[#12161F] border border-[#1E2433] rounded-xl p-4 flex flex-col justify-between min-h-[90px]">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[11px] text-[#8A94A6]">Opportunities</span>
            <span className="text-[#566175] text-[10px] cursor-help">ⓘ</span>
          </div>
          <p className="font-sans text-[28px] font-bold text-fg-1 m-0 mt-2 tabular-nums">
            {stats?.opportunitiesCount ?? 0} <span className="text-[18px] font-normal text-[#566175]">| ${stats?.opportunitiesValue ?? 0}</span>
          </p>
        </div>

        <div className="bg-[#12161F] border border-[#1E2433] rounded-xl p-4 flex flex-col justify-between min-h-[90px]">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[11px] text-[#8A94A6]">Conversions</span>
            <span className="text-[#566175] text-[10px] cursor-help">ⓘ</span>
          </div>
          <p className="font-sans text-[28px] font-bold text-fg-1 m-0 mt-2 tabular-nums">
            {stats?.conversionsCount ?? 0} <span className="text-[18px] font-normal text-[#566175]">| ${stats?.conversionsValue ?? 0}</span>
          </p>
        </div>
      </div>

      {/* Activity Chart Section */}
      <div className="bg-[#12161F] border border-[#1E2433] rounded-xl p-5 flex flex-col gap-4">
        {/* Legend */}
        <div className="flex flex-wrap items-center justify-end gap-4 font-mono text-[11px] text-[#8A94A6]">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#0066FF]" />
            <span>Sent</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#F59E0B]" />
            <span>Total opens</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#10B981]" />
            <span>Unique opens</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#14B8A6]" />
            <span>Total replies</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#6B7280]" />
            <span>Total clicks</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#8B5CF6]" />
            <span>Unique clicks</span>
          </div>
        </div>

        {/* SVG Area Chart */}
        <div className="h-56 w-full relative pt-2">
          {dailyData.length > 0 ? (
            <svg className="w-full h-full overflow-visible" viewBox="0 0 800 200" preserveAspectRatio="none">
              {/* Grid lines */}
              <line x1="0" y1="0" x2="800" y2="0" stroke="#1E2433" strokeDasharray="3 3" />
              <line x1="0" y1="50" x2="800" y2="50" stroke="#1E2433" strokeDasharray="3 3" />
              <line x1="0" y1="100" x2="800" y2="100" stroke="#1E2433" strokeDasharray="3 3" />
              <line x1="0" y1="150" x2="800" y2="150" stroke="#1E2433" strokeDasharray="3 3" />
              <line x1="0" y1="200" x2="800" y2="200" stroke="#1E2433" />

              {/* Area path for Sent */}
              <path
                d={
                  `M 0 200 ` +
                  dailyData
                    .map((d, i) => {
                      const x = (i / (dailyData.length - 1)) * 800;
                      const y = 200 - (d.sent / maxSent) * 180;
                      return `L ${x} ${y}`;
                    })
                    .join(" ") +
                  ` L 800 200 Z`
                }
                fill="rgba(0, 102, 255, 0.25)"
              />

              {/* Line path for Sent */}
              <path
                d={dailyData
                  .map((d, i) => {
                    const x = (i / (dailyData.length - 1)) * 800;
                    const y = 200 - (d.sent / maxSent) * 180;
                    return `${i === 0 ? "M" : "L"} ${x} ${y}`;
                  })
                  .join(" ")}
                fill="none"
                stroke="#0066FF"
                strokeWidth="2.5"
              />

              {/* Line path for Opens */}
              <path
                d={dailyData
                  .map((d, i) => {
                    const x = (i / (dailyData.length - 1)) * 800;
                    const y = 200 - (d.opens / maxSent) * 180;
                    return `${i === 0 ? "M" : "L"} ${x} ${y}`;
                  })
                  .join(" ")}
                fill="none"
                stroke="#F59E0B"
                strokeWidth="2"
              />

              {/* Line path for Clicks */}
              <path
                d={dailyData
                  .map((d, i) => {
                    const x = (i / (dailyData.length - 1)) * 800;
                    const y = 200 - ((d.clicks ?? 0) / maxSent) * 180;
                    return `${i === 0 ? "M" : "L"} ${x} ${y}`;
                  })
                  .join(" ")}
                fill="none"
                stroke="#8B5CF6"
                strokeWidth="2"
              />
            </svg>
          ) : (
            <div className="h-full flex items-center justify-center border border-dashed border-[#1E2433] rounded-lg">
              <p className="font-mono text-[12px] text-[#566175]">No activity data available yet</p>
            </div>
          )}

          {/* Date Axis Labels */}
          <div className="flex justify-between font-mono text-[10px] text-[#566175] mt-2">
            {dailyData.filter((_, i) => i % 5 === 0).map((d) => (
              <span key={d.date}>{d.label}</span>
            ))}
          </div>
        </div>
      </div>

      {/* Diagnose Health Modal */}
      {showDiagnoseModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-[#12161F] border border-[#1E2433] rounded-xl p-5 max-w-md w-full flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h3 className="font-mono text-[14px] font-semibold text-fg-1 m-0">🩺 Campaign Diagnostics</h3>
              <button
                type="button"
                onClick={() => setShowDiagnoseModal(false)}
                className="text-fg-4 hover:text-fg-1 font-mono text-[14px]"
              >
                ✕
              </button>
            </div>

            <div className="flex flex-col gap-3 font-mono text-[12px]">
              <div className="flex items-center justify-between p-2.5 rounded bg-[#0E121B] border border-[#1E2433]">
                <span>Deliverability Score</span>
                <span className="text-[#10B981] font-semibold">99% Excellent</span>
              </div>
              <div className="flex items-center justify-between p-2.5 rounded bg-[#0E121B] border border-[#1E2433]">
                <span>Bounce Guard</span>
                <span className="text-[#10B981] font-semibold">Healthy (&lt;1%)</span>
              </div>
              <div className="flex items-center justify-between p-2.5 rounded bg-[#0E121B] border border-[#1E2433]">
                <span>Send Throttle</span>
                <span className="text-[#3385FF]">30s between sends</span>
              </div>
            </div>

            <Button type="button" onClick={() => setShowDiagnoseModal(false)} className="mt-2">
              Close Diagnostics
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
