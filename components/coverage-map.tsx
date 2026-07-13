"use client";

import "leaflet/dist/leaflet.css";
import { Fragment, useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, CircleMarker, Circle, Popup, useMap } from "react-leaflet";
import type { LatLngBoundsExpression, Map as LeafletMap } from "leaflet";
import Link from "next/link";
import { Icon } from "@/components/ui";
import { cn } from "@/lib/utils";

type CoverageLead = {
  id: string;
  lat: number;
  lng: number;
  state: string;
  category: string | null;
  campaignId: string;
  companyName: string;
};

type CoverageArea = {
  label: string;
  city: string;
  lat: number;
  lng: number;
  radiusM: number;
  leadCount: number;
  campaignId: string;
  campaignName: string;
};

type CoverageResponse = {
  leads: CoverageLead[];
  areas: CoverageArea[];
  filters: {
    businessTypes: { id: string; name: string }[];
    campaigns: { id: string; name: string; businessTypeId: string | null }[];
  };
  stats: {
    leadsMapped: number;
    contactedPct: number;
    replied: number;
    areasCovered: number;
    areasPlanned: number;
  };
};

const HOT_STATES = new Set(["replied", "converted", "meeting_booked"]);
const CONTACTED_STATES = new Set(["contacted"]);
const DEAD_STATES = new Set(["bounced", "unsubscribed", "cold"]);

// Leaflet paints Circle/CircleMarker to a <canvas>; canvas fillStyle/strokeStyle
// cannot resolve `var(--…)` and silently no-ops (invisible shapes). These are the
// same oklch tokens from globals.css, inlined so the canvas renderer can paint them.
const MAP_COLORS = {
  discovered: "#7db3d8", // soft cyan-blue — reads clearly on the dark basemap (was near-black grey)
  contacted: "#ff9b00", // --amber
  hot: "#ff5f5b", // --hot
  meeting: "#488bfb", // --info
  dead: "#4a4a52", // muted slate for bounced/cold
  success: "#4cc157", // --success
} as const;

function stateColor(state: string): string {
  if (state === "meeting_booked") return MAP_COLORS.meeting;
  if (HOT_STATES.has(state)) return MAP_COLORS.hot;
  if (CONTACTED_STATES.has(state)) return MAP_COLORS.contacted;
  if (DEAD_STATES.has(state)) return MAP_COLORS.dead;
  return MAP_COLORS.discovered; // discovered
}

const STATE_LABEL: Record<string, string> = {
  discovered: "Discovered",
  contacted: "Contacted",
  replied: "Replied",
  converted: "Converted",
  meeting_booked: "Meeting booked",
  bounced: "Bounced",
  unsubscribed: "Unsubscribed",
  cold: "Cold",
};

/** Fits the map to lead/area bounds whenever the data set changes. */
function FitBounds({ bounds }: { bounds: LatLngBoundsExpression | null }) {
  const map = useMap();
  useEffect(() => {
    if (!bounds) return;
    // Defer one frame so the container has its final size (dynamic import + flex
    // layout can leave the map 0×0 on the first paint, which makes fitBounds no-op).
    const id = requestAnimationFrame(() => {
      map.invalidateSize();
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 13 });
    });
    return () => cancelAnimationFrame(id);
  }, [bounds, map]);
  return null;
}

/** Renders the heat layer imperatively via leaflet.heat (no React wrapper exists). */
function HeatLayer({ points }: { points: [number, number, number][] }) {
  const map = useMap();
  useEffect(() => {
    let layer: import("leaflet").Layer | null = null;
    let cancelled = false;
    (async () => {
      // leaflet.heat augments the leaflet global as an import side effect. Under
      // the bundler the ESM namespace isn't the object it patches, so expose the
      // real instance on window.L *before* loading the plugin, then read from it.
      const mod = await import("leaflet");
      const L = (mod.default ?? mod) as typeof import("leaflet") & {
        heatLayer: (points: [number, number, number][], opts?: unknown) => import("leaflet").Layer;
      };
      (window as unknown as { L: unknown }).L = L;
      await import("leaflet.heat");
      if (cancelled || points.length === 0 || typeof L.heatLayer !== "function") return;
      layer = L.heatLayer(points, {
        radius: 18,
        blur: 24,
        minOpacity: 0.35,
        maxZoom: 12,
        // Cool → warm density ramp: sparse areas glow teal, hotspots burn amber/red.
        gradient: { 0.15: "#1e5f8a", 0.35: "#2b8fc4", 0.55: "#37c0c9", 0.75: "#f0b429", 1.0: "#f04a3d" },
      });
      layer.addTo(map);
    })();
    return () => {
      cancelled = true;
      if (layer) map.removeLayer(layer);
    };
  }, [map, points]);
  return null;
}

export function CoverageMap({
  campaignId,
  businessTypeId,
  compact = false,
}: {
  campaignId?: string;
  businessTypeId?: string;
  compact?: boolean;
}) {
  const [data, setData] = useState<CoverageResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [businessType, setBusinessType] = useState(businessTypeId ?? "all");
  const [campaignFilter, setCampaignFilter] = useState(campaignId ?? "all");
  const [stateFilter, setStateFilter] = useState<"all" | "hot" | "contacted" | "discovered">("all");

  useEffect(() => {
    const params = new URLSearchParams();
    if (campaignId) params.set("campaignId", campaignId);
    else if (campaignFilter !== "all") params.set("campaignId", campaignFilter);
    if (!compact && businessType !== "all") params.set("businessTypeId", businessType);

    setLoading(true);
    fetch(`/api/map/coverage?${params.toString()}`)
      .then((r) => r.json())
      .then((d: CoverageResponse) => setData(d))
      .finally(() => setLoading(false));
  }, [campaignId, campaignFilter, businessType, compact]);

  // Campaign dropdown lists only the selected type's campaigns (all when "all").
  const visibleCampaigns = useMemo(() => {
    const all = data?.filters.campaigns ?? [];
    if (businessType === "all") return all;
    return all.filter((c) => c.businessTypeId === businessType);
  }, [data, businessType]);

  // If the picked type no longer contains the selected campaign, drop back to "all".
  useEffect(() => {
    if (campaignFilter === "all") return;
    if (!visibleCampaigns.some((c) => c.id === campaignFilter)) {
      setCampaignFilter("all");
    }
  }, [visibleCampaigns, campaignFilter]);

  const filteredLeads = useMemo(() => {
    if (!data) return [];
    if (stateFilter === "all") return data.leads;
    if (stateFilter === "hot") return data.leads.filter((l) => HOT_STATES.has(l.state));
    if (stateFilter === "contacted")
      return data.leads.filter((l) => CONTACTED_STATES.has(l.state) || HOT_STATES.has(l.state));
    return data.leads.filter((l) => l.state === "discovered");
  }, [data, stateFilter]);

  const heatPoints = useMemo<[number, number, number][]>(
    () => filteredLeads.map((l) => [l.lat, l.lng, 0.6]),
    [filteredLeads],
  );

  const bounds = useMemo<LatLngBoundsExpression | null>(() => {
    const pts: [number, number][] = [
      ...filteredLeads.map((l): [number, number] => [l.lat, l.lng]),
      ...(data?.areas.map((a): [number, number] => [a.lat, a.lng]) ?? []),
    ];
    if (pts.length === 0) return null;
    return pts;
  }, [filteredLeads, data]);

  const height = compact ? "360px" : "calc(100vh - 220px)";

  return (
    <div
      className={cn(
        "relative rounded-xl overflow-hidden border border-border bg-[oklch(0.08_0_0)]",
        !compact && "flex flex-col",
      )}
    >
      {/* Filter bar */}
      {!compact && (
        <div className="flex flex-wrap items-center gap-2.5 px-4 py-3 border-b border-border bg-[oklch(0.105_0_0)] z-[1]">
          <div className="flex items-center gap-1.5">
            <Icon name="map" size={14} className="text-amber" />
            <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-fg-3 font-semibold">
              Coverage
            </span>
          </div>
          <div className="w-px h-4 bg-border-soft mx-1" />
          <select
            value={businessType}
            onChange={(e) => setBusinessType(e.target.value)}
            className="bg-[oklch(0.13_0_0)] border border-border rounded-md px-2.5 py-1.5 font-mono text-[11px] text-fg-2 outline-none focus:border-amber-border transition-colors"
          >
            <option value="all">All business types</option>
            {data?.filters.businessTypes.map((bt) => (
              <option key={bt.id} value={bt.id}>{bt.name}</option>
            ))}
          </select>
          <select
            value={campaignFilter}
            onChange={(e) => setCampaignFilter(e.target.value)}
            className="bg-[oklch(0.13_0_0)] border border-border rounded-md px-2.5 py-1.5 font-mono text-[11px] text-fg-2 outline-none focus:border-amber-border transition-colors"
          >
            <option value="all">All campaigns</option>
            {visibleCampaigns.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <div className="flex items-center gap-1 ml-1">
            {(["all", "hot", "contacted", "discovered"] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStateFilter(s)}
                className={cn(
                  "px-2.5 py-1 rounded-md font-mono text-[10px] uppercase tracking-[0.06em] transition-colors border",
                  stateFilter === s
                    ? "bg-amber-bg border-amber-border text-amber"
                    : "bg-transparent border-transparent text-fg-4 hover:text-fg-2 hover:bg-[oklch(0.13_0_0)]",
                )}
              >
                {s}
              </button>
            ))}
          </div>

          {/* Stats strip */}
          {data && (
            <div className="flex items-center gap-4 ml-auto font-mono text-[11px] text-fg-4">
              <span><span className="text-fg-1">{data.stats.leadsMapped}</span> mapped</span>
              <span><span className="text-success">{data.stats.contactedPct}%</span> contacted</span>
              <span><span className="text-hot">{data.stats.replied}</span> replied</span>
              <span>
                <span className="text-info">{data.stats.areasCovered}</span>
                <span className="text-fg-5">/{data.stats.areasPlanned}</span> areas covered
              </span>
            </div>
          )}
        </div>
      )}

      {/* Map */}
      <div style={{ height }} className="relative">
        {loading && (
          <div className="absolute inset-0 z-[2] flex items-center justify-center bg-[oklch(0.08_0_0)]">
            <span className="font-mono text-[11px] text-fg-5 ds-pulse">Loading coverage…</span>
          </div>
        )}
        {!loading && data && data.leads.length === 0 && data.areas.length === 0 && (
          <div className="absolute inset-0 z-[2] flex flex-col items-center justify-center gap-1.5 bg-[oklch(0.08_0_0)] text-center px-6">
            <Icon name="map" size={22} className="text-fg-5 mb-1" />
            <p className="font-mono text-[12px] text-fg-4 m-0">No geocoded leads yet.</p>
            <p className="font-mono text-[11px] text-fg-5 m-0">
              Run a scout to start covering the map.
            </p>
          </div>
        )}
        <MapContainer
          center={[20, 0]}
          zoom={2}
          scrollWheelZoom
          style={{ height: "100%", width: "100%", background: "oklch(0.08 0 0)" }}
          zoomControl={!compact}
        >
          <TileLayer
            attribution='&copy; <a href="https://carto.com/attributions">CARTO</a> &copy; OpenStreetMap contributors'
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          />
          <FitBounds bounds={bounds} />
          <HeatLayer points={heatPoints} />

          {data?.areas.map((area, i) => (
            <Circle
              key={`${area.campaignId}-${area.label}-${i}`}
              center={[area.lat, area.lng]}
              radius={area.radiusM}
              pathOptions={
                area.leadCount > 0
                  ? { color: MAP_COLORS.success, fillColor: MAP_COLORS.success, fillOpacity: 0.08, weight: 1.5 }
                  : { color: MAP_COLORS.dead, fillColor: "transparent", fillOpacity: 0, weight: 1.5, dashArray: "5 5" }
              }
            >
              <Popup>
                <div className="font-mono text-[12px]">
                  <strong>{area.label}</strong>
                  <div className="text-fg-4">{area.city} · {area.campaignName}</div>
                  <div className="mt-1">
                    {area.leadCount > 0 ? `${area.leadCount} lead(s) here` : "Planned — not yet covered"}
                  </div>
                </div>
              </Popup>
            </Circle>
          ))}

          <ZoomGatedMarkers leads={filteredLeads} />
        </MapContainer>

        {/* Legend */}
        {!loading && (
          <div className="absolute bottom-3 left-3 z-[400] bg-[oklch(0.11_0_0)]/90 backdrop-blur border border-border rounded-lg px-3 py-2.5 flex flex-col gap-1.5 font-mono text-[10px] text-fg-4">
            <LegendRow color={MAP_COLORS.discovered} label="Discovered" />
            <LegendRow color={MAP_COLORS.contacted} label="Contacted" />
            <LegendRow color={MAP_COLORS.hot} label="Replied" />
            <LegendRow color={MAP_COLORS.meeting} label="Meeting booked" />
            <div className="w-full h-px bg-border-soft my-0.5" />
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full border border-success" style={{ background: "color-mix(in oklch, var(--success) 15%, transparent)" }} />
              <span>Area covered</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full border border-dashed border-fg-5" />
              <span>Area planned</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function LegendRow({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: color }} />
      <span>{label}</span>
    </div>
  );
}

/**
 * Render individual pins from zoom 7 up — small dots when zoomed out, full-size
 * up close. Below 7, heat + area circles carry the view (avoids marker soup).
 */
function ZoomGatedMarkers({ leads }: { leads: CoverageLead[] }) {
  const map = useMap();
  const [zoom, setZoom] = useState(map.getZoom());

  useEffect(() => {
    const onZoom = () => setZoom(map.getZoom());
    map.on("zoomend", onZoom);
    return () => {
      map.off("zoomend", onZoom);
    };
  }, [map]);

  if (zoom < 7) return null;

  const close = zoom >= 11;
  const core = close ? 4.5 : 3;
  const halo = close ? 9 : 6;

  return (
    <>
      {leads.map((lead) => {
        const color = stateColor(lead.state);
        return (
          <Fragment key={lead.id}>
            {/* Soft glow so the pin reads on the dark basemap */}
            <CircleMarker
              center={[lead.lat, lead.lng]}
              radius={halo}
              pathOptions={{
                stroke: false,
                fillColor: color,
                fillOpacity: 0.18,
                interactive: false,
              }}
            />
            {/* Crisp core with a dark rim for contrast */}
            <CircleMarker
              center={[lead.lat, lead.lng]}
              radius={core}
              pathOptions={{
                color: "#0b0b0d",
                weight: 1,
                fillColor: color,
                fillOpacity: 1,
              }}
            >
              <Popup>
                <div className="font-mono text-[12px] flex flex-col gap-0.5">
                  <strong>{lead.companyName}</strong>
                  <span className="text-fg-4">{STATE_LABEL[lead.state] ?? lead.state}</span>
                  {lead.category && <span className="text-fg-4">{lead.category}</span>}
                  <Link href={`/leads?highlight=${lead.id}`} className="text-amber mt-1 inline-block">
                    View lead →
                  </Link>
                </div>
              </Popup>
            </CircleMarker>
          </Fragment>
        );
      })}
    </>
  );
}
