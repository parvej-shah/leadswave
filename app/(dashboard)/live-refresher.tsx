"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

const POLL_MS = 15_000;

/** Fired on window whenever the poll finds new activity, so client widgets
 *  (FollowupQueue) can refetch on the same tick as router.refresh(). */
export const LIVE_REFRESH_EVENT = "leadswave:live-refresh";

/**
 * Keeps the dashboard live-ish without SSE: polls /api/activity?after=<id>
 * every 15s while the tab is visible; on new events, refreshes the server
 * components. Renders nothing.
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

    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [router]);

  return null;
}
