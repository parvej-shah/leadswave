import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

async function getUserId() {
  const session = await auth();
  return session?.user?.id ?? null;
}

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  const nonEmpty = lines.filter((l) => l.trim());
  if (nonEmpty.length === 0) return [];
  if (nonEmpty.length === 1) {
    const values = parseCSVRow(nonEmpty[0]).map((v) => v.trim());
    if (values.length < 2) return [];
    const headers = ["company", "email", "website", "description"].slice(0, values.length);
    const row: Record<string, string> = {};
    headers.forEach((h, i) => {
      row[h] = values[i] ?? "";
    });
    return [row];
  }

  const headers = parseCSVRow(nonEmpty[0]).map((h) => h.trim().toLowerCase());

  return nonEmpty
    .slice(1)
    .map((line) => {
      const values = parseCSVRow(line);
      const row: Record<string, string> = {};
      headers.forEach((h, i) => {
        row[h] = (values[i] ?? "").trim();
      });
      return row;
    })
    .filter((row) => Object.values(row).some((v) => v));
}

function parseCSVRow(line: string): string[] {
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

// Resolve common column name variations to canonical field names
const FIELD_ALIASES: Record<string, string> = {
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

function resolveHeaders(rawHeaders: string[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const h of rawHeaders) {
    const canonical = FIELD_ALIASES[h.toLowerCase().trim()];
    if (canonical) map[h.toLowerCase().trim()] = canonical;
  }
  return map;
}

export async function POST(req: NextRequest) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { campaignId, csvText, columnMap } = body as {
    campaignId: string;
    csvText: string;
    columnMap?: Record<string, string>; // user-supplied override: csvHeader -> field
  };

  if (!campaignId) return NextResponse.json({ error: "campaignId required" }, { status: 400 });
  if (!csvText?.trim()) return NextResponse.json({ error: "csvText required" }, { status: 400 });

  const campaign = await db.campaign.findUnique({ where: { id: campaignId, deletedAt: null } });
  if (!campaign) return NextResponse.json({ error: "Campaign not found" }, { status: 404 });

  const rows = parseCSV(csvText);
  if (rows.length === 0) return NextResponse.json({ error: "No data rows found in CSV" }, { status: 400 });

  const rawHeaders = Object.keys(rows[0]);
  const autoMap = resolveHeaders(rawHeaders);
  const effectiveMap = columnMap ?? autoMap;

  const leads = rows
    .map((row) => {
      const mapped: Record<string, string> = {};
      for (const [csvCol, field] of Object.entries(effectiveMap)) {
        const val = row[csvCol.toLowerCase().trim()];
        if (val) mapped[field] = val;
      }
      return mapped;
    })
    .filter((l) => l.companyName || l.email);

  if (leads.length === 0) {
    return NextResponse.json(
      { error: "No usable rows found — ensure columns map to companyName and/or email" },
      { status: 400 }
    );
  }

  const result = await db.lead.createMany({
    data: leads.map((l) => ({
      campaignId,
      companyName: l.companyName ?? l.email ?? "Unknown",
      email: l.email ?? null,
      website: l.website ?? null,
      description: l.description ?? null,
      state: "discovered",
    })),
    skipDuplicates: true,
  });

  return NextResponse.json({ imported: result.count, total: leads.length });
}
