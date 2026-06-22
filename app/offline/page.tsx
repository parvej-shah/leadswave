import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Offline · LeadsWave",
};

export default function OfflinePage() {
  return (
    <main className="min-h-dvh flex flex-col items-center justify-center gap-4 bg-canvas px-6 text-center">
      <div className="w-12 h-12 rounded-xl bg-surface border border-border flex items-center justify-center">
        <span className="w-2 h-2 rounded-full bg-amber ds-pulse" />
      </div>
      <div className="flex flex-col gap-1.5">
        <h1 className="ds-h2 m-0 text-fg-1">You&rsquo;re offline</h1>
        <p className="font-mono text-[12px] text-fg-4 m-0 max-w-xs">
          LeadsWave can&rsquo;t reach the network right now. Check your
          connection — your data is safe and will sync when you&rsquo;re back.
        </p>
      </div>
      <a
        href="/"
        className="font-mono text-[12px] text-amber border border-amber-border bg-amber-bg rounded-md px-4 py-2 hover:bg-amber-tinted-surface transition-colors"
      >
        Try again
      </a>
    </main>
  );
}
