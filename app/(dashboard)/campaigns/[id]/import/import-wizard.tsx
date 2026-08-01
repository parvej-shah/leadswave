"use client";

import { useRef, useState, useCallback, useEffect, useMemo } from "react";
import Link from "next/link";
import { Button, Input, Toast, Icon } from "@/components/ui";
import {
  parseCSV,
  parseXLSX,
  rowsToLeads,
  autoMapHeader,
  CANONICAL_FIELDS,
  FIELD_LABELS,
  type MappedLead,
  type CanonicalField,
  type CSVRow,
} from "@/lib/csv";

type EditableLead = MappedLead;

// ─── Email validation ────────────────────────────────────────────────────────
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
function isValidEmail(email: string) {
  return !email.trim() || EMAIL_REGEX.test(email.trim());
}

// ─── Example / template data ─────────────────────────────────────────────────
const EXAMPLE_HEADERS = ["companyName", "email", "website", "phone", "description"] as const;
const EXAMPLE_ROWS: Pick<EditableLead, "companyName" | "email" | "website" | "phone" | "description">[] = [
  { companyName: "Acme Pest Control", email: "owner@acmepest.com", website: "acmepest.com", phone: "469-555-1234", description: "Dallas TX" },
  { companyName: "Beta Pressure Wash", email: "", website: "betapw.com", phone: "", description: "Austin TX" },
];

const TEMPLATE_CSV =
  "companyName,email,website,phone,address,description\n" +
  "Acme Pest Control,owner@acmepest.com,acmepest.com,469-555-1234,Dallas TX,Local pest control\n" +
  "Beta Pressure Wash,,betapw.com,,Austin TX,Pressure washing services\n";

function downloadTemplate() {
  const blob = new Blob([TEMPLATE_CSV], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "leads-template.csv";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// ─── Step type ────────────────────────────────────────────────────────────────
type Step = "upload" | "mapping" | "review" | "done";

// ─── Component ────────────────────────────────────────────────────────────────
export function ImportWizard({
  campaignId,
  onDone,
  onExit,
}: {
  campaignId: string;
  campaignName?: string;
  onDone?: () => void;
  onExit?: () => void;
}) {
  const [step, setStep] = useState<Step>("upload");
  const [dragging, setDragging] = useState(false);
  const [fileName, setFileName] = useState<string>("");
  const [editable, setEditable] = useState<EditableLead[]>([]);
  const [error, setError] = useState("");
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ imported: number; total: number } | null>(null);
  const [existingEmails, setExistingEmails] = useState<Set<string>>(new Set());
  const fileRef = useRef<HTMLInputElement>(null);

  // Mapping step state
  const [rawHeaders, setRawHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<CSVRow[]>([]);
  const [mapping, setMapping] = useState<Record<string, CanonicalField>>({});

  // XLSX multi-sheet state
  const [xlsxSheets, setXlsxSheets] = useState<string[]>([]);
  const [xlsxData, setXlsxData] = useState<Record<string, { headers: string[]; rows: CSVRow[] }>>({});
  const [selectedSheet, setSelectedSheet] = useState<string>("");

  // Load existing campaign emails once so we can flag duplicates live in the preview.
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/leads/import?campaignId=${encodeURIComponent(campaignId)}`)
      .then((r) => (r.ok ? r.json() : { emails: [] }))
      .then((d: { emails?: string[] }) => {
        if (!cancelled) setExistingEmails(new Set(d.emails ?? []));
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [campaignId]);

  // ── Transition upload → mapping ─────────────────────────────────────────────
  const enterMappingStep = useCallback((headers: string[], rows: CSVRow[], name = "") => {
    if (!headers.length || rows.length === 0) {
      setError("Couldn't find any rows — check the file has a header line and at least one row.");
      return;
    }
    const autoMap: Record<string, CanonicalField> = {};
    for (const h of headers) autoMap[h] = autoMapHeader(h);
    setRawHeaders(headers);
    setRawRows(rows);
    setMapping(autoMap);
    setFileName(name);
    setError("");
    setStep("mapping");
  }, []);

  // ── Transition mapping → review ─────────────────────────────────────────────
  function confirmMapping() {
    const mapped = rowsToLeads(rawHeaders, rawRows, mapping).filter(
      (r) => r.companyName || r.email,
    );
    if (mapped.length === 0) {
      setError("No usable rows — each lead needs a company name or email after mapping.");
      return;
    }
    setEditable(mapped);
    setError("");
    setStep("review");
  }

  // ── File handling ───────────────────────────────────────────────────────────
  async function onFile(file: File) {
    setError("");
    const ext = file.name.split(".").pop()?.toLowerCase();

    if (ext === "xlsx" || ext === "xls") {
      try {
        const buffer = await file.arrayBuffer();
        const { sheets, data } = await parseXLSX(buffer);
        if (sheets.length === 0) {
          setError("Couldn't find any data in this Excel file.");
          return;
        }
        if (sheets.length === 1) {
          // Single sheet — go straight to mapping
          const { headers, rows } = data[sheets[0]];
          setXlsxSheets([]);
          setXlsxData({});
          enterMappingStep(headers, rows, file.name);
        } else {
          // Multiple sheets — show sheet selector before mapping
          setXlsxSheets(sheets);
          setXlsxData(data);
          setSelectedSheet(sheets[0]);
          setFileName(file.name);
          setStep("upload"); // Stay on upload step — sheet selector will be shown
        }
      } catch (err) {
        setError("Could not read Excel file. Please ensure it is a valid .xlsx or .xls file.");
        console.error("[import] xlsx parse error:", err);
      }
      return;
    }

    if (ext !== "csv" && file.type !== "text/csv") {
      setError("Please upload a .csv, .xlsx, or .xls file.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const { headers, rows } = parseCSV(e.target?.result as string);
      enterMappingStep(headers, rows, file.name);
    };
    reader.readAsText(file);
  }

  function selectSheet(sheet: string) {
    const { headers, rows } = xlsxData[sheet];
    setXlsxSheets([]);
    setXlsxData({});
    enterMappingStep(headers, rows, fileName);
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) onFile(file);
  }

  // ── Review grid interactions ────────────────────────────────────────────────
  function updateCell(i: number, field: keyof EditableLead, value: string) {
    setEditable((prev) => prev.map((r, idx) => (idx === i ? { ...r, [field]: value } : r)));
  }

  function removeRow(i: number) {
    setEditable((prev) => prev.filter((_, idx) => idx !== i));
  }

  const dupFlags = useMemo(() => {
    const seen = new Set<string>();
    return editable.map((r) => {
      const email = r.email.trim().toLowerCase();
      if (!email) return false;
      const dup = existingEmails.has(email) || seen.has(email);
      seen.add(email);
      return dup;
    });
  }, [editable, existingEmails]);

  const emailInvalidFlags = useMemo(
    () => editable.map((r) => !isValidEmail(r.email)),
    [editable],
  );
  const invalidEmailCount = emailInvalidFlags.filter(Boolean).length;

  const dupCount = dupFlags.filter(Boolean).length;
  const usableCount = editable.filter((r) => r.companyName.trim() || r.email.trim()).length;
  const newCount = usableCount - dupCount;

  // ── Import submission ───────────────────────────────────────────────────────
  async function doImport() {
    const usable = editable.filter((r) => r.companyName.trim() || r.email.trim());
    if (usable.length === 0) {
      setError("No usable rows — each lead needs a company name and/or email.");
      return;
    }
    setImporting(true);
    setError("");
    const res = await fetch("/api/leads/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ campaignId, leads: usable }),
    });
    const data = await res.json();
    setImporting(false);
    if (!res.ok) {
      setError(data.error ?? "Import failed");
      return;
    }
    setResult(data);
    setStep("done");
  }

  function reset() {
    setStep("upload");
    setFileName("");
    setEditable([]);
    setRawHeaders([]);
    setRawRows([]);
    setMapping({});
    setXlsxSheets([]);
    setXlsxData({});
    setResult(null);
    setError("");
  }

  // ── Derived: how many fields are mapped (not skip) in mapping step ──────────
  const mappedCount = Object.values(mapping).filter((v) => v !== "skip").length;
  const hasMeaningfulMapping =
    Object.values(mapping).includes("companyName") ||
    Object.values(mapping).includes("email");

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-4">
      {/* ── Step 1: Upload ─────────────────────────────────────────────────── */}
      {step === "upload" && (
        <div className="flex flex-col gap-5">
          {/* Sheet selector — shown after multi-sheet xlsx is uploaded */}
          {xlsxSheets.length > 1 && (
            <div className="bg-surface border border-border rounded-xl p-4 flex flex-col gap-3">
              <p className="font-mono text-[12px] text-fg-2 m-0">
                <Icon name="layers" size={14} className="inline mr-1" />
                This workbook has {xlsxSheets.length} sheets. Choose one to import:
              </p>
              <div className="flex flex-wrap gap-2">
                {xlsxSheets.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => selectSheet(s)}
                    className="px-3 py-1.5 rounded-lg border border-border bg-surface hover:border-amber hover:text-amber font-mono text-[12px] text-fg-2 cursor-pointer transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Example CSV */}
          {!xlsxSheets.length && (
            <>
              <div className="bg-surface border border-border rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="font-mono text-[11px] uppercase tracking-wider text-fg-4 m-0">
                    Example format
                  </p>
                  <Button type="button" variant="ghost" size="sm" iconStart="arrowDown" onClick={downloadTemplate}>
                    Download template.csv
                  </Button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse font-mono text-[12px]">
                    <thead>
                      <tr>
                        {EXAMPLE_HEADERS.map((h) => (
                          <th
                            key={h}
                            className="text-left px-3 py-2 border-b border-border text-amber font-medium whitespace-nowrap"
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {EXAMPLE_ROWS.map((r, i) => (
                        <tr key={i}>
                          {EXAMPLE_HEADERS.map((h) => (
                            <td key={h} className="px-3 py-2 border-b border-border/50 text-fg-3 whitespace-nowrap">
                              {r[h] || <span className="text-fg-5">—</span>}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="font-mono text-[11px] text-fg-5 m-0 mt-3">
                  Supports <span className="text-fg-3">.csv</span>,{" "}
                  <span className="text-fg-3">.xlsx</span>, and{" "}
                  <span className="text-fg-3">.xls</span>. You'll map columns in the next
                  step — headers like <span className="text-fg-3">Work Phone</span>,{" "}
                  <span className="text-fg-3">Primary Email</span>, or{" "}
                  <span className="text-fg-3">City</span> are recognised automatically.
                </p>
              </div>

              {/* Dropzone */}
              <div
                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={onDrop}
                onClick={() => fileRef.current?.click()}
                className={[
                  "rounded-xl border-2 border-dashed cursor-pointer transition-colors flex flex-col items-center justify-center py-14 gap-3",
                  dragging ? "border-amber bg-amber-bg" : "border-border bg-surface hover:border-border-strong",
                ].join(" ")}
              >
                <Icon name="upload" size={28} />
                <p className="font-mono text-[13px] text-fg-2 m-0">
                  Drop a CSV or Excel file here, or click to browse
                </p>
                <p className="font-mono text-[11px] text-fg-5 m-0">
                  .csv · .xlsx · .xls
                </p>
              </div>
              <input
                ref={fileRef}
                type="file"
                accept=".csv,text/csv,.xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) onFile(f);
                  // Reset the input so the same file can be re-selected
                  e.target.value = "";
                }}
              />

              {/* Paste option */}
              <div>
                <p className="font-mono text-[11px] uppercase tracking-wider text-fg-4 mb-2">Or paste CSV text</p>
                <textarea
                  rows={5}
                  placeholder={"companyName,email,website,phone\nAcme Pest Control,owner@acmepest.com,acmepest.com,469-555-1234"}
                  className="w-full box-border bg-[oklch(0.13_0_0)] border border-[oklch(0.22_0_0)] focus:border-amber rounded-md px-3 py-2.5 text-fg-2 font-mono text-[12px] outline-none resize-none leading-[1.55] transition-colors duration-150"
                  onBlur={(e) => {
                    if (e.target.value.trim()) {
                      const { headers, rows } = parseCSV(e.target.value);
                      enterMappingStep(headers, rows, "pasted text");
                    }
                  }}
                />
              </div>
            </>
          )}

          {error && <Toast kind="hot" pill="ERROR">{error}</Toast>}

          {onExit && (
            <div>
              <Button type="button" variant="ghost" onClick={onExit}>
                ← Back
              </Button>
            </div>
          )}
        </div>
      )}

      {/* ── Step 2: Column Mapping ─────────────────────────────────────────── */}
      {step === "mapping" && (
        <div className="flex flex-col gap-4">
          <div className="bg-surface border border-border rounded-xl px-4 py-3 flex items-center gap-2">
            <Icon name="check" size={14} />
            <p className="font-mono text-[12px] text-fg-2 m-0 truncate">
              {fileName && <span className="text-fg-4">{fileName} · </span>}
              <span className="text-fg-1 font-medium">{rawRows.length}</span> rows detected
              {" · "}
              <span className="text-fg-3">{rawHeaders.length} columns</span>
              {" — "}
              review the column mapping below
            </p>
          </div>

          <div className="rounded-xl border border-border overflow-hidden">
            <div className="grid grid-cols-[1fr_1fr] gap-0 border-b border-border px-4 py-2 bg-surface font-mono text-[10px] uppercase tracking-wider text-fg-4">
              <span>Your column header</span>
              <span>Map to field</span>
            </div>
            <div className="divide-y divide-border/60">
              {rawHeaders.map((h) => (
                <div key={h} className="grid grid-cols-[1fr_1fr] gap-4 items-center px-4 py-2.5">
                  <div className="font-mono text-[12px] text-fg-2 truncate">
                    {h}
                    {rawRows[0]?.[h] && (
                      <span className="text-fg-5 ml-2 text-[11px]">
                        e.g. &ldquo;{String(rawRows[0][h]).slice(0, 30)}&rdquo;
                      </span>
                    )}
                  </div>
                  <select
                    value={mapping[h] ?? "skip"}
                    onChange={(e) =>
                      setMapping((prev) => ({ ...prev, [h]: e.target.value as CanonicalField }))
                    }
                    className="bg-[oklch(0.13_0_0)] border border-[oklch(0.22_0_0)] focus:border-amber rounded-md px-2 py-1.5 text-fg-2 font-mono text-[12px] outline-none cursor-pointer transition-colors"
                  >
                    {CANONICAL_FIELDS.map((f) => (
                      <option key={f} value={f}>
                        {FIELD_LABELS[f]}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>

          {!hasMeaningfulMapping && (
            <Toast kind="amber" pill="HEADS UP">
              Map at least one column to <strong>Company Name</strong> or{" "}
              <strong>Email</strong> to proceed.
            </Toast>
          )}

          {error && <Toast kind="hot" pill="ERROR">{error}</Toast>}

          <div className="flex items-center justify-between">
            <Button type="button" variant="ghost" onClick={reset}>
              ← Back
            </Button>
            <Button
              type="button"
              size="lg"
              onClick={confirmMapping}
              disabled={!hasMeaningfulMapping}
            >
              Continue → Preview {rawRows.length} rows
            </Button>
          </div>
        </div>
      )}

      {/* ── Step 3: Editable preview ──────────────────────────────────────── */}
      {step === "review" && (
        <div className="flex flex-col gap-4">
          {/* Summary banner */}
          <div className="flex items-center justify-between gap-3 flex-wrap bg-surface border border-border rounded-xl px-4 py-3">
            <div className="flex items-center gap-2 min-w-0">
              <Icon name="check" size={14} />
              <p className="font-mono text-[12px] text-fg-2 m-0 truncate">
                {fileName && <span className="text-fg-4">{fileName} · </span>}
                <span className="text-fg-1 font-medium">{newCount}</span> ready to import
                {dupCount > 0 && (
                  <span className="text-fg-4">
                    {" "}· <span className="text-amber">{dupCount}</span> duplicate{dupCount === 1 ? "" : "s"} will be skipped
                  </span>
                )}
                {invalidEmailCount > 0 && (
                  <span className="text-fg-4">
                    {" "}· <span className="text-hot">{invalidEmailCount}</span> invalid email{invalidEmailCount === 1 ? "" : "s"} (flagged)
                  </span>
                )}
              </p>
            </div>
            <Button type="button" variant="ghost" size="sm" iconStart="upload" onClick={reset}>
              Replace file
            </Button>
          </div>

          <div className="rounded-xl border border-border overflow-x-auto">
            <div className="min-w-[900px]">
              <div className="grid grid-cols-[1fr_1fr_1fr_1fr_1fr_1fr_auto] gap-2 border-b border-border px-3 py-2 bg-surface font-mono text-[10px] uppercase tracking-wider text-fg-4">
                <span>Company</span>
                <span>Email</span>
                <span>Website</span>
                <span>Phone</span>
                <span>Address</span>
                <span>Description</span>
                <span className="w-6" />
              </div>
              {editable.map((row, i) => (
                <div
                  key={i}
                  className={[
                    "grid grid-cols-[1fr_1fr_1fr_1fr_1fr_1fr_auto] gap-2 items-center px-3 py-1.5 border-b border-border/60 last:border-0",
                    dupFlags[i] ? "bg-amber-bg/40" : "",
                  ].join(" ")}
                >
                  <Input value={row.companyName} onChange={(e) => updateCell(i, "companyName", e.target.value)} />
                  <div className="relative">
                    <Input
                      value={row.email}
                      onChange={(e) => updateCell(i, "email", e.target.value)}
                      className={emailInvalidFlags[i] ? "border-hot/60 focus:border-hot" : ""}
                    />
                    {dupFlags[i] && (
                      <span
                        title="Already in this campaign — will be skipped"
                        className="absolute right-2 top-1/2 -translate-y-1/2 font-mono text-[9px] uppercase tracking-wider text-amber pointer-events-none"
                      >
                        dup
                      </span>
                    )}
                    {!dupFlags[i] && emailInvalidFlags[i] && row.email.trim() && (
                      <span
                        title="Invalid email format — will still be imported but may bounce"
                        className="absolute right-2 top-1/2 -translate-y-1/2 font-mono text-[9px] uppercase tracking-wider text-hot pointer-events-none"
                      >
                        ⚠
                      </span>
                    )}
                  </div>
                  <Input value={row.website} onChange={(e) => updateCell(i, "website", e.target.value)} />
                  <Input value={row.phone} onChange={(e) => updateCell(i, "phone", e.target.value)} placeholder="optional" />
                  <Input value={row.address} onChange={(e) => updateCell(i, "address", e.target.value)} placeholder="optional" />
                  <Input value={row.description} onChange={(e) => updateCell(i, "description", e.target.value)} />
                  <button
                    type="button"
                    onClick={() => removeRow(i)}
                    title="Remove row"
                    className="text-fg-5 hover:text-hot p-1 flex cursor-pointer"
                  >
                    <Icon name="x" size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {error && <Toast kind="hot" pill="ERROR">{error}</Toast>}

          <div className="flex items-center justify-between">
            <Button type="button" variant="ghost" onClick={() => setStep("mapping")}>
              ← Edit mapping
            </Button>
            <Button type="button" size="lg" onClick={doImport} disabled={importing || newCount === 0} iconStart="check">
              {importing
                ? "Importing…"
                : newCount === usableCount
                ? `Import ${usableCount} lead${usableCount === 1 ? "" : "s"}`
                : `Import ${newCount} new lead${newCount === 1 ? "" : "s"}`}
            </Button>
          </div>
        </div>
      )}

      {/* ── Step 4: Done ──────────────────────────────────────────────────── */}
      {step === "done" && result && (
        <div className="bg-surface border border-border rounded-xl p-8 text-center">
          <div className="w-12 h-12 rounded-full bg-amber-bg border border-amber-border flex items-center justify-center mx-auto mb-4">
            <span className="text-amber text-xl">✓</span>
          </div>
          <p className="font-sans text-[28px] font-semibold tracking-[-0.02em] text-amber m-0 mb-1 tabular-nums">
            {result.imported}
          </p>
          <p className="font-mono text-[13px] text-fg-3 m-0">
            lead{result.imported === 1 ? "" : "s"} imported
          </p>
          {result.total > result.imported && (
            <p className="font-mono text-[11px] text-fg-5 m-0 mt-2">
              {result.total - result.imported} duplicate{result.total - result.imported !== 1 ? "s" : ""} skipped
            </p>
          )}
          <div className="flex items-center justify-center gap-3 mt-6">
            {onDone ? (
              <Button type="button" size="lg" onClick={onDone} iconStart="arrow">
                View leads
              </Button>
            ) : (
              <Link href={`/campaigns/${campaignId}`}>
                <Button type="button" size="lg" iconStart="arrow">
                  View leads
                </Button>
              </Link>
            )}
            <Button type="button" variant="ghost" onClick={reset}>
              Import another file
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
