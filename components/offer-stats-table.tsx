"use client";

import type { OfferStat } from "@/app/api/campaigns/[id]/offer-stats/route";

export function OfferStatsTable({ stats }: { stats: OfferStat[] }) {
  if (!stats || stats.length === 0) return null;

  return (
    <div className="bg-surface border border-border rounded-xl p-5 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-sans text-[14px] font-medium text-fg-1 m-0">
            Offer Performance Breakdown
          </h3>
          <p className="font-mono text-[11px] text-fg-5 m-0 mt-0.5">
            Reply rates grouped by matched CampaignOffer signal key
          </p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse font-mono text-[12px]">
          <thead>
            <tr className="border-b border-border text-fg-4 uppercase text-[10px] tracking-wider text-left">
              <th className="py-2 px-3 font-medium">Offer Signal</th>
              <th className="py-2 px-3 font-medium text-right">Contacted</th>
              <th className="py-2 px-3 font-medium text-right">Replies</th>
              <th className="py-2 px-3 font-medium text-right">Reply Rate</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {stats.map((row) => {
              const rateColor =
                row.replyRate >= 8.0
                  ? "text-emerald-400"
                  : row.replyRate >= 4.0
                  ? "text-amber"
                  : row.leadsSent > 0
                  ? "text-fg-4"
                  : "text-fg-5";

              return (
                <tr key={row.key} className="hover:bg-surface-hover/40 transition-colors">
                  <td className="py-2.5 px-3 font-medium text-fg-2">
                    {row.label}
                    <span className="text-fg-5 text-[10px] ml-2">({row.key})</span>
                  </td>
                  <td className="py-2.5 px-3 text-right text-fg-3 tabular-nums">
                    {row.leadsSent}
                  </td>
                  <td className="py-2.5 px-3 text-right text-fg-3 tabular-nums">
                    {row.replies}
                  </td>
                  <td className={`py-2.5 px-3 text-right font-semibold tabular-nums ${rateColor}`}>
                    {row.replyRate}%
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
