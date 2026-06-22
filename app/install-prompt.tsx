"use client";

import { useEffect, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISS_KEY = "lw:install-dismissed";

/**
 * A lightweight, dismissible "install app" affordance.
 * - Chromium/Android: uses the captured `beforeinstallprompt` event.
 * - iOS Safari: shows manual Add-to-Home-Screen instructions (no native prompt).
 * Hidden entirely when already running standalone, or after the user dismisses.
 */
export function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(
    null
  );
  const [isIOS, setIsIOS] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      // iOS Safari
      (window.navigator as unknown as { standalone?: boolean }).standalone ===
        true;
    if (standalone) return;

    if (localStorage.getItem(DISMISS_KEY)) return;

    const ios =
      /iphone|ipad|ipod/.test(navigator.userAgent.toLowerCase()) &&
      !(window as unknown as { MSStream?: unknown }).MSStream;
    setIsIOS(ios);

    // iOS has no beforeinstallprompt — show manual hint after a short delay.
    if (ios) {
      const t = setTimeout(() => setVisible(true), 1500);
      return () => clearTimeout(t);
    }

    function onBeforeInstall(e: Event) {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setVisible(true);
    }
    window.addEventListener("beforeinstallprompt", onBeforeInstall);

    function onInstalled() {
      setVisible(false);
      setDeferred(null);
    }
    window.addEventListener("appinstalled", onInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  function dismiss() {
    setVisible(false);
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* ignore */
    }
  }

  async function install() {
    if (!deferred) return;
    await deferred.prompt();
    const choice = await deferred.userChoice;
    if (choice.outcome === "accepted") {
      setVisible(false);
    }
    setDeferred(null);
  }

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-label="Install LeadsWave"
      className="fixed inset-x-3 z-[60] bottom-[calc(56px+env(safe-area-inset-bottom)+16px)] lg:inset-x-auto lg:right-4 lg:bottom-4 lg:w-80 max-w-[calc(100vw-24px)] mx-auto lg:mx-0 ds-fade-in"
    >
      <div className="bg-sidebar border border-border rounded-xl shadow-2xl shadow-black/40 p-4 flex flex-col gap-3">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 shrink-0 rounded-lg bg-amber-bg border border-amber-border flex items-center justify-center">
            <span className="w-2 h-2 rounded-full bg-amber ds-pulse" />
          </div>
          <div className="flex flex-col gap-1 min-w-0 flex-1">
            <p className="font-sans text-[14px] font-semibold text-fg-1 m-0 leading-tight">
              Install LeadsWave
            </p>
            {isIOS ? (
              <p className="font-mono text-[12px] text-fg-4 m-0 leading-relaxed">
                Tap the Share button{" "}
                <span aria-hidden className="text-fg-2">
                  ⎋
                </span>{" "}
                then <span className="text-fg-2">Add to Home Screen</span>.
              </p>
            ) : (
              <p className="font-mono text-[12px] text-fg-4 m-0 leading-relaxed">
                Add it to your home screen for a faster, full-screen app.
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={dismiss}
            aria-label="Dismiss"
            className="shrink-0 w-8 h-8 -mt-1 -mr-1 flex items-center justify-center text-fg-5 hover:text-fg-2 transition-colors cursor-pointer"
          >
            <svg width="15" height="15" viewBox="0 0 14 14" fill="none">
              <path
                d="M3.5 3.5l7 7M10.5 3.5l-7 7"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>
        {!isIOS && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={install}
              className="flex-1 min-h-[40px] font-mono text-[13px] text-canvas bg-amber hover:bg-amber-hover rounded-md px-4 font-medium transition-colors cursor-pointer"
            >
              Install
            </button>
            <button
              type="button"
              onClick={dismiss}
              className="min-h-[40px] font-mono text-[13px] text-fg-4 hover:text-fg-2 px-4 transition-colors cursor-pointer"
            >
              Not now
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
