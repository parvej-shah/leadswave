// Dashboard v2 — "Needs attention" actionable section + refined KPI strip + cleaner activity.
function DashboardScreen({ onNavigate, onJumpToInbox }) {
  const [period, setPeriod] = React.useState("7d");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
        <div>
          <h1 style={{ fontFamily: "var(--font-sans)", fontWeight: 600, fontSize: "26px", letterSpacing: "-0.025em", color: "var(--fg-1)", margin: "0 0 6px" }}>
            Dashboard
          </h1>
          <p style={{ fontFamily: "var(--font-mono)", fontSize: "12px", color: "var(--fg-4)", margin: 0, display: "flex", alignItems: "center", gap: 8, whiteSpace: "nowrap" }}>
            <span style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--success)", animation: "pulse 1.4s infinite", flexShrink: 0 }} />
            <span>Live · last sync <span style={{ color: "var(--fg-2)" }}>0:24</span> ago</span>
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <Segmented value={period} onChange={setPeriod} options={[
            { value: "24h", label: "24H" }, { value: "7d", label: "7D" }, { value: "30d", label: "30D" }, { value: "ytd", label: "YTD" },
          ]} />
          <Button variant="secondary" size="md" iconStart="refresh">Run Follow-ups</Button>
          <Button size="md" iconStart="plus" onClick={() => onNavigate("campaign-new")}>New Campaign</Button>
        </div>
      </div>

      {/* Needs attention — actionable triage */}
      <NeedsAttention onJumpToInbox={onJumpToInbox} onNavigate={onNavigate} />

      {/* KPI strip */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "12px" }}>
        {LW.kpis.map(k => (
          <KPI key={k.label} label={k.label} value={k.value} valueColor={k.color} spark={k.spark} sparkColor={k.color}
               delta={k.deltaPill || k.delta} deltaColor={k.deltaColor}
               deltaIsPill={!!k.deltaPill} sublabel={k.sublabel} />
        ))}
      </div>

      {/* Body grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: "16px" }}>
        <Card padded={false} title="Campaign Health"
          action={
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--fg-4)", letterSpacing: "0.08em", textTransform: "uppercase" }}>{LW.campaigns.filter(c => c.status === "active").length} ACTIVE</span>
              <Button variant="ghost" size="sm" iconEnd="arrow" onClick={() => onNavigate("campaigns")}>View all</Button>
            </div>
          }>
          <CampaignHealthTable campaigns={LW.campaigns} />
        </Card>

        <Card padded={false} title="Activity"
          action={<span style={{ display: "flex", alignItems: "center", gap: 6, fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--success)", letterSpacing: "0.08em", textTransform: "uppercase" }}>
            <span style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--success)", animation: "pulse 1.4s infinite" }} />
            LIVE
          </span>}>
          <ActivityStream items={LW.activityV2} />
        </Card>
      </div>
    </div>
  );
}

function NeedsAttention({ onJumpToInbox, onNavigate }) {
  const items = [
    { kind: "hot", title: "3 HOT replies waiting", subtitle: "Acme · Northwind · Beacon", action: "Triage now", onClick: () => onJumpToInbox?.("l1") },
    { kind: "meeting", title: "Meeting at 3:00pm with Northwind", subtitle: "in 2h 14m · cal.com link sent", action: "Open invite" },
    { kind: "scout", title: "Campaign 'Series-A SaaS Founders' scouted 24 new leads", subtitle: "needs review before outreach", action: "Review", onClick: () => onNavigate?.("leads") },
  ];
  const cfg = {
    hot: { color: "var(--hot)", bg: "var(--hot-tinted-surface)", border: "var(--hot-border)", icon: "🔥" },
    meeting: { color: "var(--info)", bg: "var(--info-tinted-surface)", border: "var(--info-border)", icon: "📅" },
    scout: { color: "var(--amber)", bg: "var(--amber-tinted-surface)", border: "var(--amber-border)", icon: "✦" },
  };
  return (
    <div style={{
      background: "var(--surface)",
      border: "1px solid var(--border)",
      borderRadius: "var(--radius-xl)",
      overflow: "hidden",
    }}>
      <div style={{
        padding: "10px 18px",
        borderBottom: "1px solid var(--border)",
        display: "flex", alignItems: "center", gap: 10,
        background: "oklch(0.115 0 0)",
      }}>
        <Icon name="pulse" size={13} color="var(--amber)" />
        <span style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--fg-2)", textTransform: "uppercase", letterSpacing: "0.10em", fontWeight: 600 }}>Needs your attention</span>
        <span style={{ marginLeft: "auto", fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--fg-4)" }}>3 items</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 0 }}>
        {items.map((it, i) => {
          const c = cfg[it.kind];
          return (
            <div key={i} style={{
              padding: "16px 20px",
              borderRight: i < 2 ? "1px solid var(--border-soft)" : 0,
              display: "flex", flexDirection: "column", gap: "10px",
              position: "relative",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{
                  width: 28, height: 28, borderRadius: 6,
                  background: c.bg, border: `1px solid ${c.border}`,
                  display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14,
                  color: c.color,
                }}>{it.icon}</span>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.10em", color: c.color, fontWeight: 600 }}>
                  {it.kind === "hot" ? "HOT" : it.kind === "meeting" ? "MEETING" : "REVIEW"}
                </span>
              </div>
              <div>
                <p style={{ fontFamily: "var(--font-sans)", fontSize: "14px", color: "var(--fg-1)", margin: "0 0 3px", fontWeight: 500, letterSpacing: "-0.01em", lineHeight: 1.35 }}>{it.title}</p>
                <p style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--fg-4)", margin: 0, lineHeight: 1.5 }}>{it.subtitle}</p>
              </div>
              <a onClick={it.onClick} style={{
                fontFamily: "var(--font-mono)", fontSize: "11px", color: c.color,
                textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4,
                cursor: "pointer", marginTop: "auto",
              }}>{it.action} <Icon name="arrow" size={11} /></a>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CampaignHealthTable({ campaigns }) {
  return (
    <table style={{ width: "100%", borderCollapse: "collapse" }}>
      <thead>
        <tr style={{ borderBottom: "1px solid var(--border)" }}>
          {["Campaign", "Sent", "Reply %", "Hot", "Meetings", ""].map(h => (
            <th key={h} style={{
              padding: "10px 20px", textAlign: "left",
              fontFamily: "var(--font-mono)", fontSize: "10px",
              textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--fg-4)", fontWeight: 400,
            }}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {campaigns.slice(0, 4).map(c => {
          const rate = c.sent > 0 ? (c.replies / c.sent * 100) : 0;
          return (
            <tr key={c.id} style={{ borderBottom: "1px solid var(--border-soft)" }}>
              <td style={{ padding: "12px 20px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ width: 5, height: 5, borderRadius: "50%", background: c.status === "active" ? "var(--success)" : c.status === "paused" ? "var(--fg-5)" : "var(--fg-5)" }} />
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: "13px", color: "var(--fg-1)" }}>{c.name}</span>
                </div>
              </td>
              <td style={{ padding: "12px 20px", fontFamily: "var(--font-mono)", fontSize: "13px", color: "var(--fg-3)", fontVariantNumeric: "tabular-nums" }}>{c.sent}</td>
              <td style={{ padding: "12px 20px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: "13px", color: rate > 10 ? "var(--success)" : "var(--fg-2)", fontVariantNumeric: "tabular-nums", minWidth: 36 }}>{rate.toFixed(1)}%</span>
                  <div style={{ width: 48, height: 4, background: "oklch(0.18 0 0)", borderRadius: 2, overflow: "hidden" }}>
                    <div style={{ width: `${Math.min(rate * 4, 100)}%`, height: "100%", background: rate > 10 ? "var(--success)" : "var(--amber)" }} />
                  </div>
                </div>
              </td>
              <td style={{ padding: "12px 20px" }}>
                {c.hot > 0 ? <Badge variant="hot">{c.hot}</Badge> : <span style={{ color: "var(--fg-5)" }}>—</span>}
              </td>
              <td style={{ padding: "12px 20px" }}>
                {c.meetings > 0 ? <Badge variant="info">{c.meetings}</Badge> : <span style={{ color: "var(--fg-5)" }}>—</span>}
              </td>
              <td style={{ padding: "12px 20px", textAlign: "right" }}>
                <Icon name="chevron" size={12} color="var(--fg-5)" />
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function ActivityStream({ items }) {
  const cfg = {
    hot:     { dot: "var(--hot)",     verb: (c) => <>Hot reply from <strong style={{ color: "var(--fg-1)", fontWeight: 500 }}>{c}</strong></> },
    meeting: { dot: "var(--info)",    verb: (c) => <>Meeting booked with <strong style={{ color: "var(--fg-1)", fontWeight: 500 }}>{c}</strong></> },
    sent:    { dot: "var(--fg-4)",    verb: (c) => <>Emailed <strong style={{ color: "var(--fg-2)", fontWeight: 500 }}>{c}</strong></> },
    scout:   { dot: "var(--amber)",   verb: (c) => <>Scout discovered <strong style={{ color: "var(--fg-1)", fontWeight: 500 }}>{c}</strong> new leads</> },
    open:    { dot: "var(--fg-4)",    verb: (c) => <><strong style={{ color: "var(--fg-2)", fontWeight: 500 }}>{c}</strong> opened your email</> },
  };
  let lastGroup = null;
  return (
    <div>
      {items.map((it, i) => {
        const groupLabel = it.group;
        const showGroup = groupLabel !== lastGroup;
        lastGroup = groupLabel;
        const c = cfg[it.kind];
        return (
          <React.Fragment key={i}>
            {showGroup && (
              <div style={{
                padding: "10px 20px 4px",
                fontFamily: "var(--font-mono)", fontSize: "9px",
                textTransform: "uppercase", letterSpacing: "0.10em",
                color: "var(--fg-5)",
              }}>{groupLabel}</div>
            )}
            <div style={{
              display: "flex", alignItems: "flex-start", gap: "12px",
              padding: "8px 20px",
              position: "relative",
            }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: c.dot, marginTop: 7, flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontFamily: "var(--font-sans)", fontSize: "13px", color: "var(--fg-3)", margin: 0, lineHeight: 1.4 }}>{c.verb(it.company)}</p>
                <p style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--fg-5)", margin: "2px 0 0", letterSpacing: "0.04em" }}>{it.at}</p>
              </div>
            </div>
          </React.Fragment>
        );
      })}
    </div>
  );
}

Object.assign(window, { DashboardScreen, NeedsAttention, ActivityStream });
