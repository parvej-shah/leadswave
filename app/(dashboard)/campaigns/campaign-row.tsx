"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Badge, Button, Icon, Sparkline } from "@/components/ui";
import { cn } from "@/lib/utils";

export type CampaignRowData = {
  id: string;
  name: string;
  query: string;
  location: string;
  status: string;
  leads: number;
  sent: number;
  replies: number;
  hot: number;
  meetings: number;
  createdAt: string;
};

const statusVariant = {
  active: "success",
  paused: "neutral",
  completed: "neutral",
} as const;

const statusDot = {
  active: "var(--success)",
  paused: "var(--fg-4)",
  completed: "var(--fg-5)",
} as const;

export function CampaignRow({ c }: { c: CampaignRowData }) {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState<string>("");

  const replyRate = c.sent > 0 ? (c.replies / c.sent) * 100 : 0;
  const isHealthy = replyRate > 10;

  const seed = (c.id.charCodeAt(1) || 0) + (c.id.charCodeAt(2) || 0);
  const spark = Array.from({ length: 7 }, (_, i) =>
    Math.max(0, (c.leads * (i + 1)) / 7 + Math.sin(i + seed) * Math.max(c.leads / 4, 4))
  );

  async function rerunScout() {
    setMessage("");
    setRunning(true);
    try {
      const res = await fetch("/api/agents/scout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaignId: c.id }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error ?? "Scout failed");
        return;
      }
      setMessage(`Scout complete. ${data.savedCount ?? 0} leads saved.`);
      router.refresh();
    } catch {
      setMessage("Scout failed");
    } finally {
      setRunning(false);
    }
  }

  const variant = (statusVariant as Record<string, "success" | "neutral">)[c.status] ?? "neutral";
  const dotColor = (statusDot as Record<string, string>)[c.status] ?? "var(--fg-5)";

  return (
    <div className="bg-surface border border-border hover:border-border-strong rounded-xl px-4.5 py-3.5 flex items-center gap-5 transition-colors duration-150 min-w-0 group">
      {/* Status + name + sub */}
      <div className="min-w-0 flex items-center gap-3 flex-[1.6] basis-0">
        <span
          className={cn(
            "w-1.5 h-1.5 rounded-full shrink-0",
            c.status === "active" && "ds-pulse"
          )}
          style={{ background: dotColor }}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Link
              href={`/campaigns/${c.id}`}
              className="font-sans text-[14px] text-fg-1 hover:text-amber font-medium tracking-[-0.01em] truncate max-w-full transition-colors duration-150"
            >
              {c.name}
            </Link>
            <Badge variant={variant} size="sm">
              {c.status}
            </Badge>
          </div>
          <p className="font-mono text-[11px] text-fg-4 m-0 mt-0.5 truncate">
            {c.query} · {c.location}
          </p>
        </div>
      </div>

      {/* Compact metrics */}
      <div className="flex items-center gap-4 shrink-0">
        <CompactMetric label="LEADS" value={c.leads}>
          <Sparkline data={spark} color="var(--amber)" height={18} width={48} showDot={false} />
        </CompactMetric>
        <CompactMetric
          label="REPLY %"
          value={`${replyRate.toFixed(1)}%`}
          valueColor={isHealthy ? "var(--success)" : "var(--fg-1)"}
        >
          <div className="h-[3px] w-16 bg-[oklch(0.16_0_0)] rounded-[1.5px] overflow-hidden">
            <div
              className="h-full"
              style={{
                width: `${Math.min(replyRate * 4, 100)}%`,
                background: isHealthy ? "var(--success)" : "var(--amber)",
              }}
            />
          </div>
        </CompactMetric>
        <div className="flex flex-col gap-[3px] min-w-[72px]">
          <p className="font-mono text-[9px] uppercase tracking-[0.10em] text-fg-5 m-0">
            SIGNAL
          </p>
          <div className="flex items-center gap-1">
            {c.hot > 0 && (
              <Badge variant="hot" size="sm">
                {c.hot}H
              </Badge>
            )}
            {c.meetings > 0 && (
              <Badge variant="info" size="sm">
                {c.meetings}M
              </Badge>
            )}
            {c.hot === 0 && c.meetings === 0 && (
              <span className="font-mono text-[11px] text-fg-5">—</span>
            )}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-1.5 shrink-0 opacity-70 group-hover:opacity-100 transition-opacity duration-150">
        <Button
          size="sm"
          variant="secondary"
          iconStart="refresh"
          disabled={running}
          onClick={rerunScout}
        >
          {running ? "Scouting…" : "Re-scout"}
        </Button>
        <Link href={`/campaigns/${c.id}/edit`}>
          <Button size="sm" variant="ghost" iconStart="pencil">
            Edit
          </Button>
        </Link>
        <Link href={`/campaigns/${c.id}/import`}>
          <Button size="sm" variant="tinted" iconStart="upload">
            Import
          </Button>
        </Link>
        <button
          type="button"
          title="More"
          className="bg-transparent border border-[oklch(0.22_0_0)] hover:border-[oklch(0.28_0_0)] text-fg-4 hover:text-fg-2 cursor-pointer px-1.5 py-[5px] rounded-[5px] flex transition-colors duration-150"
        >
          <Icon name="chevronDown" size={11} />
        </button>
      </div>

      {message && (
        <p className="absolute right-4 -bottom-5 font-mono text-[11px] text-fg-4 m-0">
          {message}
        </p>
      )}
    </div>
  );
}

function CompactMetric({
  label,
  value,
  valueColor = "var(--fg-1)",
  children,
}: {
  label: string;
  value: React.ReactNode;
  valueColor?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-[3px] min-w-[80px]">
      <p className="font-mono text-[9px] uppercase tracking-[0.10em] text-fg-5 m-0">{label}</p>
      <div className="flex items-center gap-2">
        <span
          className="font-sans text-[15px] font-semibold tracking-[-0.02em] tabular-nums"
          style={{ color: valueColor }}
        >
          {value}
        </span>
        {children}
      </div>
    </div>
  );
}
