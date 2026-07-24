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
  const lines = text
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

// Canonical lead fields an imported column can map to.
export const CANONICAL_FIELDS = ["companyName", "email", "website", "description", "skip"] as const;
export type CanonicalField = (typeof CANONICAL_FIELDS)[number];

export const FIELD_LABELS: Record<CanonicalField, string> = {
  companyName: "Company Name",
  email: "Email",
  website: "Website",
  description: "Description",
  skip: "— skip —",
};

// Resolve common column-name variations to canonical field names.
export const FIELD_ALIASES: Record<string, CanonicalField> = {
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
  "website url": "website",
  site: "website",
  domain: "website",
  description: "description",
  notes: "description",
  about: "description",
};

/** Auto-map a raw header to a canonical field (falls back to "skip"). */
export function autoMapHeader(header: string): CanonicalField {
  return FIELD_ALIASES[header.toLowerCase().trim()] ?? "skip";
}
