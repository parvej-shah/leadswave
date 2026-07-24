"use client";

import { useRef, useState, useCallback, useEffect, useMemo } from "react";
import Link from "next/link";
import { Button, Input, Toast, Icon } from "@/components/ui";
import { parseCSV, rowsToLeads, type MappedLead } from "@/lib/csv";

type EditableLead = MappedLead;

const EXAMPLE_HEADERS = ["companyName", "email", "website", "description"] as const;
const EXAMPLE_ROWS: EditableLead[] = [
  { companyName: "Acme Inc", email: "hi@acme.com", website: "acme.com", description: "Local bakery" },
  { companyName: "Beta LLC", email: "", website: "beta.io", description: "SaaS startup" },
];

const TEMPLATE_CSV =
  "companyName,email,website,description\n" +
  "Acme Inc,hi@acme.com,acme.com,Local bakery\n" +
  "Beta LLC,,beta.io,SaaS startup\n";

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

type Step = "upload" | "review" | "done";

export function ImportWizard({
  campaignId,
  onDone,
  onExit,
}: {
  campaignId: string;
  /** Accepted for call-site clarity; the breadcrumb lives in the page wrapper. */
  campaignName?: string;
  onDone?: () => void;
  /** Called from the first (upload) step's Back button — e.g. to return to the
   *  method chooser in the new-campaign wizard. Omitted → no Back on step 1. */
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

  // Load existing campaign emails once so we can flag duplicates live in the preview.
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/leads/import?campaignId=${encodeURIComponent(campaignId)}`)
      .then((r) => (r.ok ? r.json() : { emails: [] }))
      .then((d: { emails?: string[] }) => {
        if (!cancelled) setExistingEmails(new Set(d.emails ?? []));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [campaignId]);

  // Zero-config: parse → auto-map → drop straight into the editable preview.
  const processText = useCallback((text: string, name = "") => {
    const { headers, rows } = parseCSV(text);
    if (!headers.length || rows.length === 0) {
      setError("Couldn't find any rows — check the file has a header line and at least one row.");
      return;
    }
    const mapped = rowsToLeads(headers, rows).filter((r) => r.companyName || r.email);
    if (mapped.length === 0) {
      setError("No usable rows — each lead needs a company name or email.");
      return;
    }
    setFileName(name);
    setEditable(mapped);
    setError("");
    setStep("review");
  }, []);

  function onFile(file: File) {
    if (!file.name.endsWith(".csv") && file.type !== "text/csv") {
      setError("Please upload a .csv file.");
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => processText(e.target?.result as string, file.name);
    reader.readAsText(file);
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) onFile(file);
  }

  function updateCell(i: number, field: keyof EditableLead, value: string) {
    setEditable((prev) => prev.map((r, idx) => (idx === i ? { ...r, [field]: value } : r)));
  }

  function removeRow(i: number) {
    setEditable((prev) => prev.filter((_, idx) => idx !== i));
  }

  // A row is a "duplicate" if its email already exists in the campaign, or if
  // an earlier row in this same batch already used that email.
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

  const dupCount = dupFlags.filter(Boolean).length;
  const usableCount = editable.filter((r) => r.companyName.trim() || r.email.trim()).length;
  const newCount = usableCount - dupCount;

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
    setResult(null);
    setError("");
  }

  return (
    <div className="flex flex-col gap-4">
      {/* ── Step 1: Upload ── */}
      {step === "upload" && (
        <div className="flex flex-col gap-5">
          {/* Example CSV */}
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
              Columns are matched automatically — headers like <span className="text-fg-3">company</span>,{" "}
              <span className="text-fg-3">url</span> or <span className="text-fg-3">notes</span> just work. Only a{" "}
              <span className="text-fg-3">company name</span> or <span className="text-fg-3">email</span> per row is
              required; you can review and edit everything on the next step.
            </p>
          </div>

          {/* Dropzone */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            onClick={() => fileRef.current?.click()}
            className={[
              "rounded-xl border-2 border-dashed cursor-pointer transition-colors flex flex-col items-center justify-center py-14 gap-3",
              dragging ? "border-amber bg-amber-bg" : "border-border bg-surface hover:border-border-strong",
            ].join(" ")}
          >
            <Icon name="upload" size={28} />
            <p className="font-mono text-[13px] text-fg-2 m-0">Drop a CSV file here, or click to browse</p>
            <p className="font-mono text-[11px] text-fg-5 m-0">columns are matched for you automatically</p>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onFile(f);
            }}
          />

          {/* Paste option */}
          <div>
            <p className="font-mono text-[11px] uppercase tracking-wider text-fg-4 mb-2">Or paste CSV text</p>
            <textarea
              rows={5}
              placeholder={"companyName,email,website\nAcme Inc,hi@acme.com,acme.com"}
              className="w-full box-border bg-[oklch(0.13_0_0)] border border-[oklch(0.22_0_0)] focus:border-amber rounded-md px-3 py-2.5 text-fg-2 font-mono text-[12px] outline-none resize-none leading-[1.55] transition-colors duration-150"
              onBlur={(e) => {
                if (e.target.value.trim()) processText(e.target.value, "pasted text");
              }}
            />
          </div>

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

      {/* ── Step 2: Editable preview (mapping happened automatically) ── */}
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
                    {" "}
                    · <span className="text-amber">{dupCount}</span> duplicate{dupCount === 1 ? "" : "s"} will be skipped
                  </span>
                )}
              </p>
            </div>
            <Button type="button" variant="ghost" size="sm" iconStart="upload" onClick={reset}>
              Replace file
            </Button>
          </div>

          <div className="rounded-xl border border-border overflow-x-auto">
            <div className="min-w-[720px]">
              <div className="grid grid-cols-[1fr_1fr_1fr_1fr_auto] gap-2 border-b border-border px-3 py-2 bg-surface font-mono text-[10px] uppercase tracking-wider text-fg-4">
                <span>Company</span>
                <span>Email</span>
                <span>Website</span>
                <span>Description</span>
                <span className="w-6" />
              </div>
              {editable.map((row, i) => (
                <div
                  key={i}
                  className={[
                    "grid grid-cols-[1fr_1fr_1fr_1fr_auto] gap-2 items-center px-3 py-1.5 border-b border-border/60 last:border-0",
                    dupFlags[i] ? "bg-amber-bg/40" : "",
                  ].join(" ")}
                >
                  <Input value={row.companyName} onChange={(e) => updateCell(i, "companyName", e.target.value)} />
                  <div className="relative">
                    <Input value={row.email} onChange={(e) => updateCell(i, "email", e.target.value)} />
                    {dupFlags[i] && (
                      <span
                        title="Already in this campaign — will be skipped"
                        className="absolute right-2 top-1/2 -translate-y-1/2 font-mono text-[9px] uppercase tracking-wider text-amber pointer-events-none"
                      >
                        dup
                      </span>
                    )}
                  </div>
                  <Input value={row.website} onChange={(e) => updateCell(i, "website", e.target.value)} />
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
            <Button type="button" variant="ghost" onClick={reset}>
              ← Back
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

      {/* ── Step 3: Done ── */}
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
