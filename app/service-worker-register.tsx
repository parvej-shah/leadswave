"use client";

import { useEffect } from "react";

/**
 * Registers the PWA service worker. Mounted once in the root layout.
 * Activates new SW versions immediately so the app self-updates on deploy.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    let refreshing = false;

    function onControllerChange() {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    }

    navigator.serviceWorker.addEventListener(
      "controllerchange",
      onControllerChange
    );

    navigator.serviceWorker
      .register("/sw.js", { scope: "/", updateViaCache: "none" })
      .then((registration) => {
        // If a new SW is waiting, tell it to take over.
        function promote(worker: ServiceWorker | null) {
          if (worker) worker.postMessage("SKIP_WAITING");
        }
        if (registration.waiting) promote(registration.waiting);
        registration.addEventListener("updatefound", () => {
          const next = registration.installing;
          next?.addEventListener("statechange", () => {
            if (
              next.state === "installed" &&
              navigator.serviceWorker.controller
            ) {
              promote(next);
            }
          });
        });
      })
      .catch(() => {
        /* registration failures are non-fatal */
      });

    return () => {
      navigator.serviceWorker.removeEventListener(
        "controllerchange",
        onControllerChange
      );
    };
  }, []);

  return null;
}
