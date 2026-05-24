// LeadsWave primitives — Button, Badge, Card, Input, KPI, Dialog, Toast, etc.
const { useState, useEffect, useRef, useMemo } = React;

// ─────────────────────────── ICON (Lucide-style inline) ───────────────────────────
function Icon({ name, size = 14, stroke = 1.5, color = "currentColor" }) {
  const common = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: color, strokeWidth: stroke, strokeLinecap: "round", strokeLinejoin: "round" };
  const paths = {
    search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-3-3" /></>,
    filter: <path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z" />,
    x: <><path d="M18 6 6 18" /><path d="M6 6l12 12" /></>,
    plus: <><path d="M12 5v14" /><path d="M5 12h14" /></>,
    arrow: <><path d="M5 12h14" /><path d="M12 5l7 7-7 7" /></>,
    chevron: <path d="m9 6 6 6-6 6" />,
    chevronDown: <path d="m6 9 6 6 6-6" />,
    check: <path d="M20 6 9 17l-5-5" />,
    inbox: <><path d="M22 12h-6l-2 3h-4l-2-3H2" /><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" /></>,
    target: <><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" /></>,
    users: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></>,
    home: <><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></>,
    settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h0a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h0a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v0a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></>,
    play: <polygon points="5 3 19 12 5 21 5 3" />,
    refresh: <><path d="M3 12a9 9 0 0 1 15-6.7L21 8" /><path d="M21 3v5h-5" /><path d="M21 12a9 9 0 0 1-15 6.7L3 16" /><path d="M3 21v-5h5" /></>,
    upload: <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></>,
    pencil: <><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5z" /></>,
    cal: <><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></>,
    pulse: <path d="M22 12h-4l-3 9L9 3l-3 9H2" />,
    sparkle: <><path d="M12 3l1.5 5L18 9.5 13.5 11 12 16l-1.5-5L6 9.5 10.5 8z" /><path d="M19 14l.7 2.3L22 17l-2.3.7L19 20l-.7-2.3L16 17l2.3-.7z" /></>,
    cmd: <path d="M18 3a3 3 0 0 0-3 3v12a3 3 0 0 0 3 3 3 3 0 0 0 3-3 3 3 0 0 0-3-3H6a3 3 0 0 0-3 3 3 3 0 0 0 3 3 3 3 0 0 0 3-3V6a3 3 0 0 0-3-3 3 3 0 0 0-3 3 3 3 0 0 0 3 3h12a3 3 0 0 0 3-3 3 3 0 0 0-3-3z" />,
    keyboard: <><rect x="2" y="6" width="20" height="12" rx="2" /><path d="M6 10h0M10 10h0M14 10h0M18 10h0M6 14h12" /></>,
    arrowDown: <><path d="M12 5v14" /><path d="M19 12l-7 7-7-7" /></>,
    arrowUp: <><path d="M12 19V5" /><path d="M5 12l7-7 7 7" /></>,
    archive: <><rect x="2" y="3" width="20" height="5" rx="1" /><path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8" /><line x1="10" y1="12" x2="14" y2="12" /></>,
    reply: <><polyline points="9 17 4 12 9 7" /><path d="M20 18v-2a4 4 0 0 0-4-4H4" /></>,
    google: <><path stroke="none" fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path stroke="none" fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path stroke="none" fill="#FBBC04" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path stroke="none" fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></>,
  };
  return <svg {...common}>{paths[name]}</svg>;
}

// ─────────────────────────── BUTTON ───────────────────────────
function Button({ variant = "primary", size = "md", disabled, children, onClick, type = "button", iconStart, iconEnd, fullWidth, style: extraStyle, kbd, ...rest }) {
  const base = {
    fontFamily: "var(--font-mono)",
    fontWeight: 500,
    letterSpacing: "0.01em",
    borderRadius: "6px",
    border: "1px solid transparent",
    cursor: disabled ? "not-allowed" : "pointer",
    transition: "background-color 150ms ease, opacity 150ms ease, color 150ms ease, border-color 150ms ease, box-shadow 200ms ease",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    opacity: disabled ? 0.4 : 1,
    width: fullWidth ? "100%" : undefined,
    whiteSpace: "nowrap",
    position: "relative",
  };
  const sizes = {
    sm: { padding: "5px 10px", fontSize: "11px" },
    md: { padding: "7px 13px", fontSize: "13px" },
    lg: { padding: "10px 16px", fontSize: "14px" },
  };
  const variants = {
    primary: { background: "var(--amber)", color: "var(--canvas)", fontWeight: 600, boxShadow: "inset 0 1px 0 oklch(1 0 0 / 25%)" },
    secondary: { background: "oklch(0.13 0 0)", color: "var(--fg-2)", border: "1px solid oklch(0.22 0 0)", boxShadow: "inset 0 1px 0 oklch(1 0 0 / 4%)" },
    ghost: { background: "transparent", color: "var(--fg-3)" },
    destructive: { background: "var(--hot-bg)", color: "var(--hot)", border: "1px solid var(--hot-border)" },
    tinted: { background: "var(--amber-bg)", color: "var(--amber)", border: "1px solid var(--amber-border)" },
    success: { background: "var(--success-bg)", color: "var(--success)", border: "1px solid var(--success-border)" },
    info: { background: "var(--info-bg)", color: "var(--info)", border: "1px solid var(--info-border)" },
  };
  const [hover, setHover] = useState(false);
  const hoverStyle = !disabled && hover ? {
    primary: { background: "var(--amber-hover)" },
    secondary: { background: "oklch(0.16 0 0)", borderColor: "oklch(0.28 0 0)" },
    ghost: { color: "var(--fg-1)", background: "oklch(0.13 0 0)" },
    destructive: { background: "oklch(0.70 0.20 25 / 22%)" },
    tinted: { background: "oklch(0.78 0.18 65 / 22%)" },
    success: { background: "oklch(0.72 0.18 145 / 22%)" },
    info: { background: "oklch(0.65 0.18 260 / 22%)" },
  }[variant] : {};
  return (
    <button type={type} onClick={disabled ? undefined : onClick} disabled={disabled}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{ ...base, ...sizes[size], ...variants[variant], ...hoverStyle, ...extraStyle }} {...rest}>
      {iconStart && <Icon name={iconStart} size={size === "sm" ? 12 : 14} />}
      {children}
      {iconEnd && <Icon name={iconEnd} size={size === "sm" ? 12 : 14} />}
      {kbd && (
        <span style={{
          marginLeft: "4px", padding: "1px 5px", borderRadius: "3px",
          background: variant === "primary" ? "oklch(0 0 0 / 18%)" : "oklch(1 0 0 / 6%)",
          color: variant === "primary" ? "oklch(0 0 0 / 60%)" : "var(--fg-4)",
          fontFamily: "var(--font-mono)", fontSize: "10px",
        }}>{kbd}</span>
      )}
    </button>
  );
}

// ─────────────────────────── BADGE ───────────────────────────
const BADGE_STYLES = {
  hot:       { color: "var(--hot)",     bg: "var(--hot-bg)",     border: "var(--hot-border)" },
  warm:      { color: "var(--amber)",   bg: "var(--amber-bg)",   border: "var(--amber-border)" },
  success:   { color: "var(--success)", bg: "var(--success-bg)", border: "var(--success-border)" },
  info:      { color: "var(--info)",    bg: "var(--info-bg)",    border: "var(--info-border)" },
  neutral:   { color: "var(--fg-4)",    bg: "oklch(0.16 0 0)",   border: "oklch(0.25 0 0)" },
  destructive: { color: "oklch(0.55 0.12 25)", bg: "oklch(0.16 0.03 25)", border: "oklch(0.28 0.06 25)" },
};

function Badge({ variant = "neutral", children, size = "md", style }) {
  const s = BADGE_STYLES[variant];
  const sizes = { sm: { fontSize: "10px", padding: "1px 6px" }, md: { fontSize: "10px", padding: "2px 7px" }, lg: { fontSize: "11px", padding: "3px 9px" } };
  return (
    <span style={{
      fontFamily: "var(--font-mono)",
      textTransform: "uppercase",
      letterSpacing: "0.08em",
      color: s.color,
      background: s.bg,
      border: `1px solid ${s.border}`,
      borderRadius: "4px",
      whiteSpace: "nowrap",
      ...sizes[size], ...style,
    }}>{children}</span>
  );
}

const STATE_TO_VARIANT = {
  discovered: { v: "neutral", label: "DISCOVERED" },
  contacted: { v: "warm", label: "CONTACTED" },
  replied: { v: "success", label: "REPLIED" },
  converted: { v: "success", label: "CONVERTED" },
  meeting_booked: { v: "info", label: "MEETING" },
  unsubscribed: { v: "destructive", label: "UNSUB" },
  bounced: { v: "destructive", label: "BOUNCED" },
};
function StateBadge({ state, size }) {
  const s = STATE_TO_VARIANT[state] || STATE_TO_VARIANT.discovered;
  return <Badge variant={s.v} size={size}>{s.label}</Badge>;
}

// ─────────────────────────── CARD ───────────────────────────
function Card({ title, action, children, padded = true, style, headerStyle }) {
  return (
    <div style={{
      background: "var(--surface)",
      border: "1px solid var(--border)",
      borderRadius: "var(--radius-xl)",
      overflow: "hidden",
      ...style,
    }}>
      {title && (
        <div style={{
          padding: "12px 20px",
          borderBottom: "1px solid var(--border)",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          ...headerStyle,
        }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: "13px", color: "var(--fg-2)", fontWeight: 500 }}>{title}</span>
          {action}
        </div>
      )}
      {padded ? <div style={{ padding: title ? "16px 20px" : "20px" }}>{children}</div> : children}
    </div>
  );
}

// ─────────────────────────── INPUT / SELECT / TEXTAREA ───────────────────────────
function Label({ children, htmlFor }) {
  return (
    <label htmlFor={htmlFor} style={{
      fontFamily: "var(--font-mono)", fontSize: "10px", textTransform: "uppercase",
      letterSpacing: "0.08em", color: "var(--fg-4)", display: "block", marginBottom: "6px",
    }}>{children}</label>
  );
}

function Input({ label, hint, error, iconStart, value, onChange, placeholder, type = "text", style, onClear, autoFocus, ...rest }) {
  const id = useMemo(() => "i" + Math.random().toString(36).slice(2, 8), []);
  const [focus, setFocus] = useState(false);
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      {label && <Label htmlFor={id}>{label}</Label>}
      <div style={{ position: "relative" }}>
        {iconStart && (
          <span style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", color: "var(--fg-4)", display: "flex", pointerEvents: "none" }}>
            <Icon name={iconStart} size={14} />
          </span>
        )}
        <input id={id} type={type} value={value || ""} onChange={onChange} placeholder={placeholder}
          autoFocus={autoFocus}
          onFocus={() => setFocus(true)} onBlur={() => setFocus(false)}
          style={{
            width: "100%", boxSizing: "border-box",
            background: "oklch(0.13 0 0)",
            border: `1px solid ${focus ? "var(--amber)" : error ? "var(--hot-border)" : "oklch(0.22 0 0)"}`,
            borderRadius: "6px",
            padding: iconStart ? "8px 10px 8px 32px" : "8px 12px",
            color: "var(--fg-2)", fontFamily: "var(--font-mono)", fontSize: "13px",
            outline: "none", transition: "border-color 150ms ease",
            ...style,
          }} {...rest} />
        {onClear && value && (
          <button onClick={onClear} style={{ position: "absolute", right: "8px", top: "50%", transform: "translateY(-50%)", background: "transparent", border: 0, color: "var(--fg-4)", cursor: "pointer", display: "flex", padding: 4 }}>
            <Icon name="x" size={12} />
          </button>
        )}
      </div>
      {hint && <p style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--fg-4)", marginTop: "6px", margin: "6px 0 0" }}>{hint}</p>}
      {error && <p style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--hot)", marginTop: "6px", margin: "6px 0 0" }}>{error}</p>}
    </div>
  );
}

function Textarea({ label, hint, value, onChange, placeholder, rows = 4, style }) {
  const id = useMemo(() => "t" + Math.random().toString(36).slice(2, 8), []);
  const [focus, setFocus] = useState(false);
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      {label && <Label htmlFor={id}>{label}</Label>}
      <textarea id={id} rows={rows} value={value || ""} onChange={onChange} placeholder={placeholder}
        onFocus={() => setFocus(true)} onBlur={() => setFocus(false)}
        style={{
          width: "100%", boxSizing: "border-box",
          background: "oklch(0.13 0 0)",
          border: `1px solid ${focus ? "var(--amber)" : "oklch(0.22 0 0)"}`,
          borderRadius: "6px",
          padding: "10px 12px",
          color: "var(--fg-2)", fontFamily: "var(--font-mono)", fontSize: "12px",
          outline: "none", resize: "none", lineHeight: 1.55,
          transition: "border-color 150ms ease",
          ...style,
        }} />
      {hint && <p style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--fg-4)", marginTop: "6px", margin: "6px 0 0" }}>{hint}</p>}
    </div>
  );
}

function Select({ label, value, onChange, children, style }) {
  const id = useMemo(() => "s" + Math.random().toString(36).slice(2, 8), []);
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      {label && <Label htmlFor={id}>{label}</Label>}
      <div style={{ position: "relative" }}>
        <select id={id} value={value} onChange={onChange} style={{
          width: "100%", appearance: "none",
          background: "oklch(0.13 0 0)",
          border: "1px solid oklch(0.22 0 0)",
          borderRadius: "6px",
          padding: "8px 28px 8px 12px",
          color: "var(--fg-2)", fontFamily: "var(--font-mono)", fontSize: "13px",
          outline: "none", cursor: "pointer", ...style,
        }}>{children}</select>
        <span style={{ position: "absolute", right: "8px", top: "50%", transform: "translateY(-50%)", color: "var(--fg-4)", pointerEvents: "none", display: "flex" }}>
          <Icon name="chevronDown" size={12} />
        </span>
      </div>
    </div>
  );
}

function Toggle({ checked, onChange, label }) {
  return (
    <button onClick={() => onChange(!checked)} style={{
      display: "flex", alignItems: "center", gap: "10px",
      background: "transparent", border: 0, cursor: "pointer", padding: 0,
    }}>
      <span style={{
        width: "28px", height: "16px", borderRadius: "999px",
        background: checked ? "var(--amber)" : "oklch(0.20 0 0)",
        border: `1px solid ${checked ? "var(--amber)" : "oklch(0.25 0 0)"}`,
        position: "relative", transition: "all 150ms ease",
      }}>
        <span style={{
          position: "absolute", top: "1px", left: checked ? "13px" : "1px",
          width: "12px", height: "12px", borderRadius: "50%",
          background: checked ? "var(--canvas)" : "oklch(0.55 0 0)",
          transition: "left 150ms ease",
        }} />
      </span>
      {label && <span style={{ fontFamily: "var(--font-mono)", fontSize: "13px", color: "var(--fg-2)" }}>{label}</span>}
    </button>
  );
}

// ─────────────────────────── SPARKLINE (smooth SVG area) ───────────────────────────
function Sparkline({ data, color = "var(--amber)", height = 32, width = 140, showDot = true }) {
  if (!data || data.length === 0) return null;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const stepX = data.length > 1 ? width / (data.length - 1) : width;
  const points = data.map((v, i) => {
    const x = i * stepX;
    const y = height - 4 - ((v - min) / range) * (height - 8);
    return [x, y];
  });
  // Smooth curve with quadratic Bézier midpoints
  const pathD = points.reduce((acc, [x, y], i) => {
    if (i === 0) return `M ${x} ${y}`;
    const [px, py] = points[i - 1];
    const mx = (px + x) / 2;
    return acc + ` Q ${px} ${py}, ${mx} ${(py + y) / 2} T ${x} ${y}`;
  }, "");
  const areaD = `${pathD} L ${width} ${height} L 0 ${height} Z`;
  const last = points[points.length - 1];
  const id = "g" + Math.random().toString(36).slice(2, 7);
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ display: "block", overflow: "visible" }}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaD} fill={`url(#${id})`} />
      <path d={pathD} stroke={color} strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      {showDot && last && (
        <>
          <circle cx={last[0]} cy={last[1]} r="3" fill={color} opacity="0.25" />
          <circle cx={last[0]} cy={last[1]} r="1.75" fill={color} />
        </>
      )}
    </svg>
  );
}

// ─────────────────────────── KPI CARD ───────────────────────────
function DeltaPill({ value, color = "var(--success)" }) {
  if (!value) return null;
  const isUp = !value.startsWith("-") && !value.startsWith("↓");
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: "3px",
      fontFamily: "var(--font-mono)", fontSize: "10px",
      color, letterSpacing: "0.02em",
      padding: "1px 5px", borderRadius: "3px",
      background: "oklch(1 0 0 / 4%)",
    }}>
      <svg width="9" height="9" viewBox="0 0 12 12" fill="none">
        <path d={isUp ? "M6 2 L10 8 L2 8 Z" : "M6 10 L2 4 L10 4 Z"} fill={color} />
      </svg>
      {value.replace(/^[+\-↑↓]\s*/, "")}
    </span>
  );
}

function KPI({ label, value, valueColor = "var(--fg-1)", spark, sparkColor, delta, deltaColor = "var(--fg-4)", deltaIsPill = false, sublabel }) {
  const [hover, setHover] = useState(false);
  return (
    <div onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)} style={{
      background: "var(--surface)",
      border: `1px solid ${hover ? "oklch(1 0 0 / 12%)" : "var(--border)"}`,
      borderRadius: "var(--radius-xl)",
      padding: "14px 16px",
      transition: "border-color 200ms ease",
      position: "relative", overflow: "hidden",
      minWidth: 0,
    }}>
      <p style={{ fontFamily: "var(--font-mono)", fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.10em", color: "var(--fg-4)", margin: "0 0 10px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{label}</p>
      <div style={{ display: "flex", alignItems: "baseline", gap: "8px", flexWrap: "wrap" }}>
        <p style={{ fontFamily: "var(--font-sans)", fontSize: "26px", fontWeight: 600, letterSpacing: "-0.025em", color: valueColor, margin: 0, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>{value}</p>
        {deltaIsPill && delta && <DeltaPill value={delta} color={deltaColor} />}
        {sublabel && <span style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--fg-4)", letterSpacing: "0.04em" }}>{sublabel}</span>}
      </div>
      {spark && (
        <div style={{ marginTop: "12px", marginLeft: "-2px", marginRight: "-2px" }}>
          <Sparkline data={spark} color={sparkColor || valueColor} height={28} width={200} />
        </div>
      )}
      {!deltaIsPill && delta && (
        <p style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: deltaColor, margin: "10px 0 0", letterSpacing: "0.08em", textTransform: "uppercase" }}>{delta}</p>
      )}
    </div>
  );
}

// ─────────────────────────── DIALOG ───────────────────────────
function Dialog({ open, onClose, title, dotColor = "var(--amber)", children, footer, width = 440 }) {
  if (!open) return null;
  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, zIndex: 50,
      background: "rgba(0,0,0,0.75)", backdropFilter: "blur(4px)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: "16px",
      animation: "fadeIn 150ms ease",
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        width: "100%", maxWidth: `${width}px`,
        background: "var(--sidebar)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-xl)",
        animation: "scaleUp 200ms ease",
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: "1px solid var(--border)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: dotColor, animation: "pulse 1.4s infinite" }} />
            <span style={{ fontFamily: "var(--font-mono)", fontSize: "13px", color: "var(--fg-1)", fontWeight: 500 }}>{title}</span>
          </div>
          <button onClick={onClose} style={{ background: "transparent", border: 0, color: "var(--fg-4)", cursor: "pointer", padding: 4, display: "flex" }}>
            <Icon name="x" size={16} />
          </button>
        </div>
        <div style={{ padding: "20px" }}>{children}</div>
        {footer && (
          <div style={{ padding: "14px 20px", borderTop: "1px solid var(--border)", display: "flex", justifyContent: "flex-end", gap: "10px" }}>{footer}</div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────── TOAST ───────────────────────────
function Toast({ kind = "success", pill, children }) {
  const styles = {
    success: { bg: "var(--success-tinted-surface)", color: "var(--success)", border: "var(--success-border)" },
    info:    { bg: "var(--info-tinted-surface)",    color: "var(--info)",    border: "var(--info-border)" },
    hot:     { bg: "var(--hot-tinted-surface)",     color: "var(--hot)",     border: "var(--hot-border)" },
    amber:   { bg: "var(--amber-tinted-surface)",   color: "var(--amber)",   border: "var(--amber-border)" },
  };
  const s = styles[kind];
  return (
    <div style={{
      display: "inline-flex", alignItems: "center", gap: "10px",
      padding: "8px 14px", borderRadius: "6px",
      background: s.bg, color: s.color, border: `1px solid ${s.border}`,
      fontFamily: "var(--font-mono)", fontSize: "12px", letterSpacing: "0.02em",
    }}>
      {pill && <span style={{
        fontFamily: "var(--font-mono)", fontSize: "10px", textTransform: "uppercase",
        letterSpacing: "0.1em", padding: "1px 6px", borderRadius: "3px",
        background: "oklch(1 0 0 / 6%)",
      }}>{pill}</span>}
      {children}
    </div>
  );
}

// ─────────────────────────── EMPTY STATE ───────────────────────────
function EmptyState({ children, action }) {
  return (
    <div style={{
      border: "1px dashed oklch(0.22 0 0)",
      borderRadius: "var(--radius-lg)",
      padding: "48px 24px", textAlign: "center",
    }}>
      <p style={{ fontFamily: "var(--font-mono)", fontSize: "13px", color: "var(--fg-4)", margin: "0 0 12px" }}>{children}</p>
      {action && (
        <a onClick={action.onClick} style={{ fontFamily: "var(--font-mono)", fontSize: "13px", color: "var(--amber)", textDecoration: "underline", textUnderlineOffset: "4px", cursor: "pointer" }}>{action.label}</a>
      )}
    </div>
  );
}

// ─────────────────────────── DIRECTION TAG ───────────────────────────
function DirectionTag({ dir }) {
  const map = {
    outbound: { color: "var(--fg-4)", text: "YOU →" },
    inbound:  { color: "var(--success)", text: "← THEM" },
    system:   { color: "var(--info)", text: "AI DRAFT" },
  };
  const s = map[dir] || map.outbound;
  return (
    <span style={{
      fontFamily: "var(--font-mono)", fontSize: "10px",
      textTransform: "uppercase", letterSpacing: "0.08em", color: s.color,
    }}>{s.text}</span>
  );
}

// ─────────────────────────── KBD ───────────────────────────
function Kbd({ children }) {
  return (
    <kbd style={{
      fontFamily: "var(--font-mono)", fontSize: "10px",
      padding: "1px 5px", borderRadius: "3px",
      background: "oklch(0.18 0 0)", color: "var(--fg-3)",
      border: "1px solid oklch(0.25 0 0)",
      borderBottomWidth: "2px",
    }}>{children}</kbd>
  );
}

// ─────────────────────────── FILTER CHIP ───────────────────────────
function FilterChip({ active, count, onClick, children }) {
  return (
    <button onClick={onClick} style={{
      fontFamily: "var(--font-mono)", fontSize: "11px",
      textTransform: "uppercase", letterSpacing: "0.06em",
      padding: "5px 10px", borderRadius: "999px",
      background: active ? "var(--amber-bg)" : "transparent",
      color: active ? "var(--amber)" : "var(--fg-4)",
      border: `1px solid ${active ? "var(--amber-border)" : "oklch(0.20 0 0)"}`,
      cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "6px",
      transition: "all 150ms ease",
    }}>
      {children}
      {count !== undefined && <span style={{ opacity: 0.6 }}>· {count}</span>}
    </button>
  );
}

// ─────────────────────────── EXPORT ───────────────────────────
function Segmented({ value, onChange, options, size = "md" }) {
  const sizes = { sm: { padding: "3px 8px", fontSize: "10px" }, md: { padding: "5px 10px", fontSize: "11px" } };
  return (
    <div style={{
      display: "inline-flex", padding: "2px", borderRadius: "6px",
      background: "oklch(0.13 0 0)", border: "1px solid oklch(0.20 0 0)", gap: "1px",
    }}>
      {options.map(o => (
        <button key={o.value} onClick={() => onChange(o.value)} style={{
          ...sizes[size],
          fontFamily: "var(--font-mono)",
          textTransform: "uppercase", letterSpacing: "0.06em",
          background: value === o.value ? "oklch(0.18 0 0)" : "transparent",
          color: value === o.value ? "var(--fg-1)" : "var(--fg-4)",
          border: 0, borderRadius: "4px", cursor: "pointer",
          transition: "all 150ms ease",
        }}>{o.label}</button>
      ))}
    </div>
  );
}

function Avatar({ name, size = 24, color }) {
  const palette = ["oklch(0.75 0.13 35)", "oklch(0.72 0.10 220)", "oklch(0.72 0.10 145)", "oklch(0.70 0.12 320)", "oklch(0.74 0.11 90)", "oklch(0.70 0.13 265)"];
  const c = color || palette[name.charCodeAt(0) % palette.length];
  return (
    <span style={{
      width: size, height: size, borderRadius: size > 28 ? 6 : 4, flexShrink: 0,
      background: `color-mix(in oklch, ${c} 14%, var(--surface))`,
      color: c,
      display: "inline-flex", alignItems: "center", justifyContent: "center",
      fontFamily: "var(--font-mono)", fontSize: size > 28 ? 11 : 10, fontWeight: 600,
      border: `1px solid color-mix(in oklch, ${c} 22%, transparent)`,
      letterSpacing: 0,
    }}>{name[0].toUpperCase()}</span>
  );
}

Object.assign(window, {
  Icon, Button, Badge, StateBadge, Card, Label, Input, Textarea, Select, Toggle,
  Sparkline, KPI, DeltaPill, Dialog, Toast, EmptyState, DirectionTag, Kbd, FilterChip,
  Segmented, Avatar,
});
