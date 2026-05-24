"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

type ParsedRow = Record<string, string>;

const CANONICAL_FIELDS = ["companyName", "email", "website", "description", "skip"] as const;
type CanonicalField = (typeof CANONICAL_FIELDS)[number];

const FIELD_LABELS: Record<CanonicalField, string> = {
  companyName: "Company Name",
  email: "Email",
  website: "Website",
  description: "Description",
  skip: "— skip —",
};

const AUTO_MAP: Record<string, CanonicalField> = {
  company: "companyName",
  company_name: "companyName",
  companyname: "companyName",
  "company name": "companyName",
  organization: "companyName",
  name: "companyName",
  business: "companyName",
  email: "email",
  "email address": "email",
  email_address: "email",
  mail: "email",
  website: "website",
  url: "website",
  site: "website",
  domain: "website",
  description: "description",
  notes: "description",
  about: "description",
};

function parseCSVRow(line: string): string[] {
  const cells: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { cur += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      cells.push(cur); cur = "";
    } else {
      cur += ch;
    }
  }
  cells.push(cur);
  return cells;
}

function parseCSV(text: string): { headers: string[]; rows: ParsedRow[] } {
  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n").filter((l) => l.trim());
  if (lines.length === 0) return { headers: [], rows: [] };
  if (lines.length === 1) {
    const vals = parseCSVRow(lines[0]).map((v) => v.trim());
    if (vals.length >= 2) {
      const headers = ["company", "email", "website", "description"].slice(0, vals.length);
      const row: ParsedRow = {};
      headers.forEach((h, i) => {
        row[h] = vals[i] ?? "";
      });
      return { headers, rows: [row] };
    }
    return { headers: [], rows: [] };
  }
  const headers = parseCSVRow(lines[0]).map((h) => h.trim());
  const rows = lines.slice(1).map((line) => {
    const vals = parseCSVRow(line);
    const row: ParsedRow = {};
    headers.forEach((h, i) => { row[h] = (vals[i] ?? "").trim(); });
    return row;
  }).filter((r) => Object.values(r).some((v) => v));
  return { headers, rows };
}

const mono = "'DM Mono', monospace";
const amber = "oklch(0.78 0.18 65)";

export default function ImportPage() {
  const { id: campaignId } = useParams<{ id: string }>();
  const router = useRouter();

  const [campaignName, setCampaignName] = useState("");
  const [step, setStep] = useState<"upload" | "map" | "preview" | "done">("upload");
  const [dragging, setDragging] = useState(false);
  const [csvText, setCsvText] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [columnMap, setColumnMap] = useState<Record<string, CanonicalField>>({});
  const [error, setError] = useState("");
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ imported: number; total: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch(`/api/campaigns`)
      .then((r) => r.json())
      .then((data: { id: string; name: string }[]) => {
        const c = data.find((c) => c.id === campaignId);
        if (c) setCampaignName(c.name);
      });
  }, [campaignId]);

  const processText = useCallback((text: string) => {
    const { headers, rows } = parseCSV(text);
    if (!headers.length) { setError("Could not parse CSV — check the file format."); return; }
    setCsvText(text);
    setHeaders(headers);
    setRows(rows);
    const map: Record<string, CanonicalField> = {};
    headers.forEach((h) => {
      map[h] = AUTO_MAP[h.toLowerCase()] ?? "skip";
    });
    setColumnMap(map);
    setError("");
    setStep("map");
  }, []);

  const onFile = (file: File) => {
    if (!file.name.endsWith(".csv") && file.type !== "text/csv") {
      setError("Please upload a .csv file.");
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => processText(e.target?.result as string);
    reader.readAsText(file);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) onFile(file);
  };

  const mappedRows = rows.map((row) => {
    const out: Record<string, string> = {};
    Object.entries(columnMap).forEach(([csvCol, field]) => {
      if (field !== "skip") out[field] = row[csvCol] ?? "";
    });
    return out;
  }).filter((r) => r.companyName || r.email);

  async function doImport() {
    setImporting(true);
    setError("");
    const effectiveMap: Record<string, string> = {};
    Object.entries(columnMap).forEach(([csvCol, field]) => {
      if (field !== "skip") effectiveMap[csvCol] = field;
    });
    const res = await fetch("/api/leads/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ campaignId, csvText, columnMap: effectiveMap }),
    });
    const data = await res.json();
    setImporting(false);
    if (!res.ok) { setError(data.error ?? "Import failed"); return; }
    setResult(data);
    setStep("done");
  }

  const inputCls = `bg-zinc-900 border border-zinc-800 text-zinc-300 text-xs rounded px-2 py-1
    focus:outline-none focus:border-[${amber}]`;

  return (
    <div style={{ maxWidth: 820 }}>
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 mb-6 text-xs text-zinc-500" style={{ fontFamily: mono }}>
        <Link href="/campaigns" className="hover:text-zinc-300 transition-colors">Campaigns</Link>
        <span>›</span>
        <span className="text-zinc-400">{campaignName || campaignId}</span>
        <span>›</span>
        <span style={{ color: amber }}>Import CSV</span>
      </div>

      <h1 className="text-xl font-semibold text-zinc-100 mb-1" style={{ fontFamily: mono }}>
        Import Leads from CSV
      </h1>
      <p className="text-sm text-zinc-500 mb-8">
        Upload a spreadsheet with contact details. Supported columns: company name, email, website, description.
      </p>

      {/* ── Step 1: Upload ── */}
      {step === "upload" && (
        <div>
          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            onClick={() => fileRef.current?.click()}
            className="rounded border-2 border-dashed cursor-pointer transition-colors flex flex-col items-center justify-center py-16 gap-3"
            style={{
              borderColor: dragging ? amber : "oklch(0.28 0 0)",
              background: dragging ? "oklch(0.14 0.02 65)" : "oklch(0.11 0 0)",
            }}
          >
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="1.5" className="text-zinc-500">
              <path d="M12 16V4m0 0-4 4m4-4 4 4" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M4 20h16" strokeLinecap="round" />
            </svg>
            <p className="text-sm text-zinc-400" style={{ fontFamily: mono }}>
              Drop a CSV file here, or click to browse
            </p>
            <p className="text-xs text-zinc-600">Columns: company, email, website, description</p>
          </div>
          <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }} />

          {/* Paste option */}
          <div className="mt-6">
            <p className="text-xs text-zinc-500 mb-2" style={{ fontFamily: mono }}>Or paste CSV text directly:</p>
            <textarea
              rows={6}
              placeholder={"company,email,website\nAcme Inc,john@acme.com,acme.com"}
              className="w-full bg-zinc-900 border border-zinc-800 text-zinc-300 text-xs rounded px-3 py-2 focus:outline-none focus:border-zinc-600 resize-none"
              style={{ fontFamily: mono }}
              onBlur={(e) => { if (e.target.value.trim()) processText(e.target.value); }}
            />
          </div>

          {error && <p className="mt-3 text-xs text-red-400" style={{ fontFamily: mono }}>{error}</p>}
        </div>
      )}

      {/* ── Step 2: Column Mapping ── */}
      {step === "map" && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-zinc-400" style={{ fontFamily: mono }}>
              Map your CSV columns to lead fields
            </p>
            <span className="text-xs text-zinc-600" style={{ fontFamily: mono }}>
              {rows.length} rows detected
            </span>
          </div>

          <div className="rounded border border-zinc-800 overflow-hidden mb-6">
            <div
              className="grid border-b border-zinc-800 px-4 py-2.5 text-xs text-zinc-500 uppercase tracking-wider"
              style={{ gridTemplateColumns: "1fr 1fr", fontFamily: mono, background: "oklch(0.11 0 0)" }}
            >
              <span>CSV Column</span>
              <span>Map to Field</span>
            </div>
            {headers.map((h) => (
              <div
                key={h}
                className="grid items-center px-4 py-2.5 border-b border-zinc-900 last:border-0"
                style={{ gridTemplateColumns: "1fr 1fr", background: "oklch(0.115 0 0)" }}
              >
                <span className="text-sm text-zinc-300 truncate" style={{ fontFamily: mono }}>{h}</span>
                <select
                  className={inputCls}
                  value={columnMap[h] ?? "skip"}
                  onChange={(e) =>
                    setColumnMap((prev) => ({ ...prev, [h]: e.target.value as CanonicalField }))
                  }
                >
                  {CANONICAL_FIELDS.map((f) => (
                    <option key={f} value={f}>{FIELD_LABELS[f]}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setStep("upload")}
              className="px-4 py-2 rounded text-xs text-zinc-400 border border-zinc-800 hover:border-zinc-600 transition-colors"
              style={{ fontFamily: mono }}
            >
              ← Back
            </button>
            <button
              onClick={() => { if (mappedRows.length === 0) { setError("No usable rows — map at least companyName or email."); return; } setError(""); setStep("preview"); }}
              className="px-4 py-2 rounded text-xs font-medium transition-opacity hover:opacity-90"
              style={{ background: amber, color: "oklch(0.15 0 0)", fontFamily: mono }}
            >
              Preview {mappedRows.length} leads →
            </button>
          </div>
          {error && <p className="mt-3 text-xs text-red-400" style={{ fontFamily: mono }}>{error}</p>}
        </div>
      )}

      {/* ── Step 3: Preview ── */}
      {step === "preview" && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-zinc-400" style={{ fontFamily: mono }}>
              Previewing first 10 of {mappedRows.length} leads
            </p>
          </div>

          <div className="rounded border border-zinc-800 overflow-hidden mb-6">
            <div
              className="grid border-b border-zinc-800 text-xs text-zinc-500 uppercase tracking-wider"
              style={{
                gridTemplateColumns: "2fr 2fr 2fr 2fr",
                fontFamily: mono,
                background: "oklch(0.11 0 0)",
              }}
            >
              {["Company", "Email", "Website", "Description"].map((h) => (
                <div key={h} className="px-3 py-2.5">{h}</div>
              ))}
            </div>
            {mappedRows.slice(0, 10).map((row, i) => (
              <div
                key={i}
                className="grid border-b border-zinc-900 last:border-0 text-xs"
                style={{
                  gridTemplateColumns: "2fr 2fr 2fr 2fr",
                  background: i % 2 === 0 ? "oklch(0.115 0 0)" : "oklch(0.105 0 0)",
                  fontFamily: mono,
                }}
              >
                <div className="px-3 py-2.5 text-zinc-200 truncate">{row.companyName || "—"}</div>
                <div className="px-3 py-2.5 text-zinc-400 truncate">{row.email || "—"}</div>
                <div className="px-3 py-2.5 text-zinc-500 truncate">{row.website || "—"}</div>
                <div className="px-3 py-2.5 text-zinc-600 truncate">{row.description || "—"}</div>
              </div>
            ))}
          </div>

          {mappedRows.length > 10 && (
            <p className="text-xs text-zinc-600 mb-4" style={{ fontFamily: mono }}>
              + {mappedRows.length - 10} more rows not shown
            </p>
          )}

          <div className="flex items-center gap-3">
            <button
              onClick={() => setStep("map")}
              className="px-4 py-2 rounded text-xs text-zinc-400 border border-zinc-800 hover:border-zinc-600 transition-colors"
              style={{ fontFamily: mono }}
            >
              ← Back
            </button>
            <button
              onClick={doImport}
              disabled={importing}
              className="px-5 py-2 rounded text-xs font-medium transition-opacity hover:opacity-90 disabled:opacity-50"
              style={{ background: amber, color: "oklch(0.15 0 0)", fontFamily: mono }}
            >
              {importing ? "Importing…" : `Import ${mappedRows.length} leads`}
            </button>
          </div>
          {error && <p className="mt-3 text-xs text-red-400" style={{ fontFamily: mono }}>{error}</p>}
        </div>
      )}

      {/* ── Step 4: Done ── */}
      {step === "done" && result && (
        <div className="rounded border border-zinc-800 bg-zinc-900/40 p-8 text-center">
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center mx-auto mb-4"
            style={{ background: "oklch(0.18 0.05 145)", border: "1px solid oklch(0.30 0.08 145)" }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2" style={{ color: "oklch(0.72 0.18 145)" }}>
              <path d="M20 6 9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <p className="text-lg font-semibold text-zinc-100 mb-1" style={{ fontFamily: mono }}>
            {result.imported} leads imported
          </p>
          {result.total > result.imported && (
            <p className="text-xs text-zinc-500 mb-4" style={{ fontFamily: mono }}>
              {result.total - result.imported} duplicate{result.total - result.imported !== 1 ? "s" : ""} skipped
            </p>
          )}
          <div className="flex items-center justify-center gap-3 mt-6">
            <Link
              href="/leads"
              className="px-4 py-2 rounded text-xs font-medium transition-opacity hover:opacity-90"
              style={{ background: amber, color: "oklch(0.15 0 0)", fontFamily: mono }}
            >
              View leads →
            </Link>
            <button
              onClick={() => { setStep("upload"); setCsvText(""); setHeaders([]); setRows([]); setResult(null); }}
              className="px-4 py-2 rounded text-xs text-zinc-400 border border-zinc-800 hover:border-zinc-600 transition-colors"
              style={{ fontFamily: mono }}
            >
              Import another file
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
