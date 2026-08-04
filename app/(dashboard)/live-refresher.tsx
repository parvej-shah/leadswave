"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

const POLL_MS = 15_000;
/** How often the dashboard pings the cron endpoint when the tab is open.
 *  Vercel cron handles it every 10 min in production; this covers local dev. */
const CRON_PING_MS = 5 * 60 * 1_000; // 5 minutes

/** Fired on window whenever the poll finds new activity, so client widgets
 *  (FollowupQueue) can refetch on the same tick as router.refresh(). */
export const LIVE_REFRESH_EVENT = "leadswave:live-refresh";

/**
 * Keeps the dashboard live-ish without SSE: polls /api/activity?after=<id>
 * every 15s while the tab is visible; on new events, refreshes the server
 * components. Also pings /api/cron/process-jobs every 5 min so active
 * campaigns continue sending automatically in local dev.
 * Renders nothing.
 */
export function LiveRefresher({ latestEventId }: { latestEventId: string | null }) {
  const router = useRouter();
  const anchor = useRef(latestEventId ?? "none");

  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    async function tick() {
      if (stopped) return;
      if (document.visibilityState === "visible") {
        try {
          const res = await fetch(`/api/activity?after=${encodeURIComponent(anchor.current)}`);
          if (res.ok) {
            const data: { events: unknown[]; latestId?: string } = await res.json();
            if (data.latestId) {
              const hadAnchor = anchor.current !== "none";
              const moved = data.latestId !== anchor.current;
              anchor.current = data.latestId;
              if (hadAnchor && moved && data.events.length > 0) {
                router.refresh();
                window.dispatchEvent(new CustomEvent(LIVE_REFRESH_EVENT));
              }
            }
          }
        } catch {
          // transient network failure — try again next tick
        }
      }
      timer = setTimeout(tick, POLL_MS);
    }

    timer = setTimeout(tick, POLL_MS);

    // Catch up immediately when the user returns to the tab.
    function onVisible() {
      if (document.visibilityState === "visible" && !stopped) {
        if (timer) clearTimeout(timer);
        void tick();
      }
    }
    document.addEventListener("visibilitychange", onVisible);

    // Background cron ping — drives automated campaign sends in local dev.
    // Fire immediately on mount (in case the user just opened the dashboard)
    // then every CRON_PING_MS while the tab is open.
    async function pingCron() {
      if (stopped || document.visibilityState !== "visible") return;
      try {
        await fetch("/api/cron/process-jobs", { method: "POST" });
        // Refresh UI after cron runs so new activity shows up immediately
        router.refresh();
      } catch {
        // ignore — cron will catch up on next ping
      }
    }

    void pingCron(); // fire immediately on mount
    const cronTimer = setInterval(pingCron, CRON_PING_MS);

    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
      clearInterval(cronTimer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [router]);

  return null;
}
