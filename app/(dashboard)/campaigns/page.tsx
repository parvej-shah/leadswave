"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Campaign = {
  id: string;
  name: string;
  query: string;
  location: string;
  status: string;
  createdAt: string;
  _count: { leads: number };
};

const statusColors: Record<string, string> = {
  active: "text-emerald-400 bg-emerald-950/50 border-emerald-900",
  paused: "text-zinc-400 bg-zinc-800/50 border-zinc-700",
  completed: "text-zinc-500 bg-zinc-900/50 border-zinc-800",
};

function StatusBadge({ status }: { status: string }) {
  const cls = statusColors[status] ?? "text-zinc-500 bg-zinc-900/50 border-zinc-800";
  return (
    <span
      className={`text-xs font-medium px-2 py-0.5 rounded-full border ${cls}`}
      style={{ fontFamily: "'DM Mono', monospace" }}
    >
      {status}
    </span>
  );
}

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/campaigns")
      .then((r) => r.json())
      .then((data) => {
        setCampaigns(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => {
        setError("Failed to load campaigns.");
        setLoading(false);
      });
  }, []);

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1
            className="text-xl font-semibold text-zinc-100 mb-1"
            style={{ fontFamily: "'DM Mono', monospace" }}
          >
            Campaigns
          </h1>
          <p className="text-sm text-zinc-500">
            Each campaign scouts for matching companies.
          </p>
        </div>
        <Link
          href="/campaigns/new"
          className="px-3 py-2 rounded text-sm font-medium text-zinc-900 transition-opacity hover:opacity-90"
          style={{ backgroundColor: "oklch(0.78 0.18 65)", fontFamily: "'DM Mono', monospace" }}
        >
          + New Campaign
        </Link>
      </div>

      {error && (
        <p className="text-xs text-red-400 border border-red-900/50 bg-red-950/30 rounded px-3 py-2 mb-4">
          {error}
        </p>
      )}

      {loading ? (
        <div className="flex flex-col gap-3">
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className="h-16 rounded border border-zinc-800 bg-zinc-900/50 animate-pulse"
            />
          ))}
        </div>
      ) : campaigns.length === 0 ? (
        <div className="border border-dashed border-zinc-800 rounded p-12 text-center">
          <p className="text-sm text-zinc-500 mb-4">No campaigns yet.</p>
          <Link
            href="/campaigns/new"
            className="text-sm underline underline-offset-4"
            style={{ color: "oklch(0.78 0.18 65)" }}
          >
            Launch your first campaign →
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {campaigns.map((c) => (
            <div
              key={c.id}
              className="flex items-center gap-4 px-4 py-3 rounded border border-zinc-800 bg-zinc-900/40 hover:border-zinc-700 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <p
                  className="text-sm font-medium text-zinc-100 truncate"
                  style={{ fontFamily: "'DM Mono', monospace" }}
                >
                  {c.name}
                </p>
                <p className="text-xs text-zinc-500 truncate mt-0.5">
                  {c.query} · {c.location}
                </p>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <StatusBadge status={c.status} />

                <span
                  className="text-xs text-zinc-400"
                  style={{ fontFamily: "'DM Mono', monospace" }}
                >
                  {c._count.leads} leads
                </span>

                <span className="text-xs text-zinc-600">
                  {new Date(c.createdAt).toLocaleDateString()}
                </span>

                <Link
                  href={`/campaigns/${c.id}/import`}
                  className="px-2 py-1 rounded text-xs transition-opacity hover:opacity-90"
                  style={{
                    background: "oklch(0.18 0.03 65)",
                    color: "oklch(0.78 0.18 65)",
                    border: "1px solid oklch(0.28 0.06 65)",
                    fontFamily: "'DM Mono', monospace",
                  }}
                >
                  Import CSV
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
