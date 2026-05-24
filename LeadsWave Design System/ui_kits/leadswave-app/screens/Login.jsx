// Login screen — grid + amber-orb backdrop, Georgia welcome, Google CTA.
function LoginScreen({ onSignIn }) {
  return (
    <div style={{
      minHeight: "100%", display: "flex", alignItems: "center", justifyContent: "center",
      position: "relative", overflow: "hidden", background: "oklch(0.10 0 0)",
    }}>
      <div style={{
        position: "absolute", inset: 0, opacity: 0.035,
        backgroundImage: "linear-gradient(oklch(1 0 0) 1px, transparent 1px), linear-gradient(90deg, oklch(1 0 0) 1px, transparent 1px)",
        backgroundSize: "40px 40px", pointerEvents: "none",
      }} />
      <div style={{
        position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
        width: "600px", height: "600px", borderRadius: "50%",
        background: "var(--amber)", opacity: 0.06, filter: "blur(120px)",
        pointerEvents: "none",
      }} />

      <div style={{ position: "relative", width: "100%", maxWidth: "380px", padding: "0 16px" }}>
        <div style={{ marginBottom: "32px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "20px" }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--amber)", animation: "pulse 1.4s infinite" }} />
            <span style={{
              fontFamily: "var(--font-mono)", fontSize: "11px",
              textTransform: "uppercase", letterSpacing: "0.20em", color: "var(--amber)",
            }}>LeadsWave</span>
          </div>
          <h1 style={{
            fontFamily: "var(--font-serif)", fontWeight: 600, fontSize: "32px",
            letterSpacing: "-0.02em", color: "oklch(0.96 0 0)", margin: "0 0 6px",
          }}>Welcome back.</h1>
          <p style={{ fontFamily: "var(--font-mono)", fontSize: "13px", color: "var(--fg-4)", margin: 0 }}>
            Sign in to continue
          </p>
        </div>

        <div style={{
          background: "oklch(0.15 0 0)",
          border: "1px solid oklch(1 0 0 / 8%)",
          borderRadius: "var(--radius-xl)",
          padding: "20px",
          display: "flex", flexDirection: "column", gap: "14px",
        }}>
          <p style={{ fontFamily: "var(--font-mono)", fontSize: "12px", color: "var(--fg-4)", textAlign: "center", lineHeight: 1.55, margin: 0 }}>
            Sign in with your Google account to access your calendar and outreach tools.
          </p>

          <Button fullWidth onClick={onSignIn}>
            <Icon name="google" size={16} />
            <span>Continue with Google →</span>
          </Button>
        </div>

        <p style={{
          textAlign: "center", fontFamily: "var(--font-mono)", fontSize: "11px",
          color: "var(--fg-5)", marginTop: "20px",
        }}>
          LeadsWave · Outbound on autopilot
        </p>
      </div>
    </div>
  );
}

Object.assign(window, { LoginScreen });
