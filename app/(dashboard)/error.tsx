"use client";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center h-64 gap-4">
      <p
        className="text-sm"
        style={{ color: "oklch(0.62 0.18 25)", fontFamily: "'DM Mono', monospace" }}
      >
        Something went wrong: {error.message}
      </p>
      <button
        onClick={reset}
        className="text-xs px-3 py-1.5 rounded"
        style={{
          background: "oklch(0.18 0 0)",
          color: "oklch(0.60 0 0)",
          border: "1px solid oklch(0.26 0 0)",
          fontFamily: "'DM Mono', monospace",
        }}
      >
        Try again
      </button>
    </div>
  );
}
