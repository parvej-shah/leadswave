import { db } from "@/lib/db";

/**
 * Cross-process daily spend budget for the Google Places API.
 *
 * Two layers, cheapest first:
 *   1. An in-process counter — free, no I/O, stops a tight runaway loop inside a
 *      single invocation the instant it starts. Resets on cold start and is NOT
 *      shared between serverless instances, so it is a brake, not a budget.
 *   2. This DB counter — one atomic upsert per call, shared by every instance,
 *      cron job and cold start. This is the real daily ceiling.
 *
 * Neither replaces the Google Cloud Console daily quota, which is the only limit
 * Google itself enforces and the only one that cannot be bypassed by a bug here.
 *
 * Fails CLOSED: if the database is unreachable we block the call. For a billing
 * guard, an outage must not become an open budget.
 */

export const MAX_DAILY_REQUESTS = Number(process.env.PLACES_MAX_DAILY_REQUESTS ?? 100);

/**
 * Burst brake: a free, no-I/O stop for a runaway loop inside one process.
 *
 * A RATE, not a lifetime total. The August incident was ~9,600 calls in 11
 * minutes (~15/sec); normal scouting is a few calls per second at most. A
 * lifetime counter would instead punish a long-running process for being
 * long-running — legitimate traffic spread over hours would trip a limit meant
 * for a loop. The DB counter remains the authoritative daily budget.
 */
const BURST_WINDOW_MS = 60_000;
const MAX_CALLS_PER_WINDOW = 60;

export class QuotaExceededError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "QuotaExceededError";
  }
}

// Layer 1 — in-process burst brake (sliding window of recent call timestamps).
let recentCalls: number[] = [];

function utcDay(): string {
  return new Date().toISOString().slice(0, 10);
}

function quotaId(day: string): string {
  return `places:${day}`;
}

/**
 * Reserve one Places API call against today's budget, or throw.
 *
 * Increments first and validates the returned total, so two concurrent callers
 * cannot both read 99 and both proceed — Postgres serializes the increment and
 * hands each caller a distinct value.
 */
export async function reservePlacesCall(): Promise<void> {
  const day = utcDay();

  // Layer 1: free, catches a runaway loop without touching the network.
  const now = Date.now();
  recentCalls = recentCalls.filter((t) => now - t < BURST_WINDOW_MS);
  if (recentCalls.length >= MAX_CALLS_PER_WINDOW) {
    throw new QuotaExceededError(
      `[Places API Circuit-Breaker] Burst limit of ${MAX_CALLS_PER_WINDOW} requests in ${
        BURST_WINDOW_MS / 1000
      }s exceeded — this looks like a runaway loop. Blocking call to prevent billing overage.`,
    );
  }
  recentCalls.push(now);

  // Layer 2: the authoritative cross-process budget.
  let total: number;
  try {
    const row = await db.apiQuota.upsert({
      where: { id: quotaId(day) },
      create: { id: quotaId(day), count: 1 },
      update: { count: { increment: 1 } },
    });
    total = row.count;
  } catch (e) {
    throw new QuotaExceededError(
      `[Places API Circuit-Breaker] Could not reserve quota (database unreachable): ${
        e instanceof Error ? e.message : String(e)
      }. Blocking call — failing closed to prevent an unbounded bill.`,
    );
  }

  if (total > MAX_DAILY_REQUESTS) {
    throw new QuotaExceededError(
      `[Places API Circuit-Breaker] Daily safety limit of ${MAX_DAILY_REQUESTS} requests reached for ${day} (attempted #${total}). Blocking call to prevent billing overage.`,
    );
  }
}

/** Today's usage, for dashboards and diagnostics. Never throws. */
export async function getPlacesUsageToday(): Promise<{ used: number; limit: number }> {
  try {
    const row = await db.apiQuota.findUnique({ where: { id: quotaId(utcDay()) } });
    return { used: row?.count ?? 0, limit: MAX_DAILY_REQUESTS };
  } catch {
    return { used: -1, limit: MAX_DAILY_REQUESTS };
  }
}
