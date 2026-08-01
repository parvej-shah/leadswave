// Shared CSV parsing — used by the import API route and the import wizard so
// both agree on how quotes, escaped quotes, and CRLF are handled.

export type CSVRow = Record<string, string>;

/** Parse a single CSV line into cells, honouring quotes and escaped ("") quotes. */
export function parseCSVRow(line: string): string[] {
  const cells: string[] = [];
  let cur = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      cells.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  cells.push(cur);
  return cells;
}

/**
 * Parse CSV text into headers + row objects (keyed by header). A single
 * headerless line falls back to the fixed [company, email, website, description]
 * column order so a quick paste of one row still works.
 */
export function parseCSV(text: string): { headers: string[]; rows: CSVRow[] } {
  // Strip UTF-8 BOM if present
  const clean = text.replace(/^\uFEFF/, "");
  const lines = clean
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .filter((l) => l.trim());

  if (lines.length === 0) return { headers: [], rows: [] };

  if (lines.length === 1) {
    const vals = parseCSVRow(lines[0]).map((v) => v.trim());
    if (vals.length < 2) return { headers: [], rows: [] };
    const headers = ["company", "email", "website", "description"].slice(0, vals.length);
    const row: CSVRow = {};
    headers.forEach((h, i) => {
      row[h] = vals[i] ?? "";
    });
    return { headers, rows: [row] };
  }

  const headers = parseCSVRow(lines[0]).map((h) => h.trim());
  const rows = lines
    .slice(1)
    .map((line) => {
      const vals = parseCSVRow(line);
      const row: CSVRow = {};
      headers.forEach((h, i) => {
        row[h] = (vals[i] ?? "").trim();
      });
      return row;
    })
    .filter((r) => Object.values(r).some((v) => v));

  return { headers, rows };
}

/**
 * Parse an Excel (.xlsx / .xls) ArrayBuffer using SheetJS.
 * Returns all non-empty sheets parsed into headers + rows.
 * Dynamic import ensures SheetJS is only bundled client-side.
 */
export async function parseXLSX(
  buffer: ArrayBuffer,
): Promise<{ sheets: string[]; data: Record<string, { headers: string[]; rows: CSVRow[] }> }> {
  const XLSX = await import("xlsx");
  const wb = XLSX.read(buffer, { type: "array", cellText: true, cellDates: false });

  const sheets: string[] = [];
  const data: Record<string, { headers: string[]; rows: CSVRow[] }> = {};

  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName];
    const csv = XLSX.utils.sheet_to_csv(ws, { blankrows: false });
    const parsed = parseCSV(csv);
    if (parsed.headers.length > 0 && parsed.rows.length > 0) {
      sheets.push(sheetName);
      data[sheetName] = parsed;
    }
  }

  return { sheets, data };
}

// Canonical lead fields an imported column can map to.
export const CANONICAL_FIELDS = ["companyName", "email", "website", "description", "phone", "address", "skip"] as const;
export type CanonicalField = (typeof CANONICAL_FIELDS)[number];

export const FIELD_LABELS: Record<CanonicalField, string> = {
  companyName: "Company Name",
  email: "Email",
  website: "Website",
  description: "Description",
  phone: "Phone",
  address: "Address",
  skip: "— skip —",
};

// Resolve common column-name variations to canonical field names.
export const FIELD_ALIASES: Record<string, CanonicalField> = {
  // Company
  company: "companyName",
  company_name: "companyName",
  companyname: "companyName",
  "company name": "companyName",
  organization: "companyName",
  name: "companyName",
  business: "companyName",
  "business name": "companyName",
  // Email
  email: "email",
  "email address": "email",
  email_address: "email",
  "primary email": "email",
  "work email": "email",
  mail: "email",
  // Website
  website: "website",
  url: "website",
  "website url": "website",
  site: "website",
  domain: "website",
  // Phone
  phone: "phone",
  "phone number": "phone",
  phone_number: "phone",
  phonenumber: "phone",
  "work phone": "phone",
  "mobile phone": "phone",
  mobile: "phone",
  cell: "phone",
  tel: "phone",
  telephone: "phone",
  "contact number": "phone",
  // Address / Location
  address: "address",
  addr: "address",
  location: "address",
  city: "address",
  street: "address",
  state: "address",
  zip: "address",
  "zip code": "address",
  region: "address",
  area: "address",
  "city/state": "address",
  // Description
  description: "description",
  notes: "description",
  about: "description",
  details: "description",
  summary: "description",
};

/** Auto-map a raw header to a canonical field (falls back to "skip"). */
export function autoMapHeader(header: string): CanonicalField {
  return FIELD_ALIASES[header.toLowerCase().trim()] ?? "skip";
}

export type MappedLead = {
  companyName: string;
  email: string;
  website: string;
  description: string;
  phone: string;
  address: string;
};

/**
 * Zero-configuration mapping: auto-resolve every header to a canonical field.
 * Headers that don't match a known alias are NOT dropped — their values are
 * folded into `description` (prefixed with the header) so nothing is silently
 * lost when mapping is hidden from the user. The user can still edit the result
 * in the preview. This is the single source of truth shared by the client
 * wizard and the API's fallback path.
 */
export function rowsToLeads(
  headers: string[],
  rows: CSVRow[],
  overrideMapping: Record<string, CanonicalField> = {}
): MappedLead[] {
  const mapping = headers.map((h) => [h, overrideMapping[h] ?? autoMapHeader(h)] as const);
  const unmatched = mapping.filter(([, field]) => field === "skip").map(([h]) => h);

  return rows.map((row) => {
    const out: MappedLead = { companyName: "", email: "", website: "", description: "", phone: "", address: "" };
    for (const [h, field] of mapping) {
      if (field === "skip") continue;
      const val = (row[h] ?? "").trim();
      if (val && !out[field]) out[field] = val;
    }
    // Fold any unmatched columns into description so their data survives.
    const extras = unmatched
      .map((h) => {
        const val = (row[h] ?? "").trim();
        return val ? `${h}: ${val}` : "";
      })
      .filter(Boolean);
    if (extras.length) {
      out.description = [out.description, ...extras].filter(Boolean).join(" · ");
    }
    return out;
  });
}
