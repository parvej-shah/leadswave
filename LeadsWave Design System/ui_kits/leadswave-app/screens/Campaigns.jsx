// Campaigns v2 — refined cards with status indicators, performance, mini progress.
function CampaignsScreen({ onNavigate }) {
  const [running, setRunning] = React.useState(null);
  const [view, setView] = React.useState("rows"); // rows / grid
  const [filter, setFilter] = React.useState("all"); // all / active / paused / completed

  const statusDot = { active: "var(--success)", paused: "var(--fg-4)", completed: "var(--fg-5)" };
  const statusVariant = { active: "success", paused: "neutral", completed: "neutral" };

  const visible = LW.campaigns.filter(c => filter === "all" || c.status === filter);
  const total = { leads: 0, sent: 0, replies: 0, hot: 0, meetings: 0 };
  LW.campaigns.forEach(c => { total.leads += c.leads; total.sent += c.sent; total.replies += c.replies; total.hot += c.hot; total.meetings += c.meetings; });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
        <div>
          <h1 style={{ fontFamily: "var(--font-sans)", fontWeight: 600, fontSize: "26px", letterSpacing: "-0.025em", color: "var(--fg-1)", margin: "0 0 4px" }}>Campaigns</h1>
          <p style={{ fontFamily: "var(--font-mono)", fontSize: "12px", color: "var(--fg-4)", margin: 0 }}>
            {LW.campaigns.filter(c => c.status === "active").length} active · scouting <span style={{ color: "var(--fg-2)" }}>{total.leads}</span> leads · <span style={{ color: "var(--success)" }}>{total.replies}</span> replies
          </p>
        </div>
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <Segmented value={filter} onChange={setFilter} options={[
            { value: "all", label: "All" },
            { value: "active", label: "Active" },
            { value: "paused", label: "Paused" },
            { value: "completed", label: "Done" },
          ]} />
          <Button iconStart="plus" onClick={() => onNavigate("campaign-new")}>New Campaign</Button>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        {visible.map(c => (
          <CampaignRow key={c.id} c={c} running={running === c.id} onRun={() => setRunning(c.id)}
            statusDot={statusDot[c.status]} statusVariant={statusVariant[c.status]} />
        ))}
        {visible.length === 0 && (
          <EmptyState action={{ label: "Launch your first campaign →", onClick: () => onNavigate("campaign-new") }}>
            No campaigns in this filter.
          </EmptyState>
        )}
      </div>
    </div>
  );
}

function CampaignRow({ c, running, onRun, statusDot, statusVariant }) {
  const [hover, setHover] = React.useState(false);
  const replyRate = c.sent > 0 ? ((c.replies / c.sent) * 100) : 0;
  const seed = c.id.charCodeAt(1);
  const spark = Array.from({ length: 7 }, (_, i) => Math.max(0, c.leads * (i + 1) / 7 + Math.sin(i + seed) * 12));

  return (
    <div onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)} style={{
      background: "var(--surface)",
      border: `1px solid ${hover ? "oklch(1 0 0 / 12%)" : "var(--border)"}`,
      borderRadius: "var(--radius-xl)",
      padding: "14px 18px",
      display: "flex", alignItems: "center", gap: "20px",
      transition: "border-color 150ms ease",
      minWidth: 0,
    }}>
      {/* Status dot + name + sub */}
      <div style={{ minWidth: 0, display: "flex", alignItems: "center", gap: 12, flex: 1.6, flexBasis: 0 }}>
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: statusDot, animation: c.status === "active" ? "pulse 2s infinite" : undefined, flexShrink: 0 }} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <p style={{ fontFamily: "var(--font-sans)", fontSize: "14px", color: "var(--fg-1)", margin: 0, fontWeight: 500, letterSpacing: "-0.01em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "100%" }}>{c.name}</p>
            <Badge variant={statusVariant} size="sm">{c.status}</Badge>
          </div>
          <p style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--fg-4)", margin: "2px 0 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.query} · {c.location}</p>
        </div>
      </div>

      {/* Compact metric block */}
      <div style={{ display: "flex", alignItems: "center", gap: 16, flexShrink: 0 }}>
        <CompactMetric label="LEADS" value={c.leads} spark={spark} sparkColor="var(--amber)" />
        <CompactMetric label="REPLY %" value={`${replyRate.toFixed(1)}%`} color={replyRate > 10 ? "var(--success)" : "var(--fg-1)"} progress={replyRate * 4} progressColor={replyRate > 10 ? "var(--success)" : "var(--amber)"} />
        <div style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 72 }}>
          <p style={{ fontFamily: "var(--font-mono)", fontSize: 9, textTransform: "uppercase", letterSpacing: "0.10em", color: "var(--fg-5)", margin: 0 }}>SIGNAL</p>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            {c.hot > 0 ? <Badge variant="hot" size="sm">{c.hot}H</Badge> : null}
            {c.meetings > 0 ? <Badge variant="info" size="sm">{c.meetings}M</Badge> : null}
            {c.hot === 0 && c.meetings === 0 && <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-5)" }}>—</span>}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: "flex", gap: "6px", opacity: hover ? 1 : 0.7, transition: "opacity 150ms ease", flexShrink: 0 }}>
        <Button size="sm" variant="secondary" onClick={onRun} iconStart="refresh">
          {running ? "Scouting…" : "Re-scout"}
        </Button>
        <Button size="sm" variant="ghost" iconStart="pencil">Edit</Button>
        <button title="More" style={{ background: "transparent", border: "1px solid oklch(0.22 0 0)", color: "var(--fg-4)", cursor: "pointer", padding: "5px 7px", borderRadius: 5, display: "flex" }}>
          <Icon name="chevronDown" size={11} />
        </button>
      </div>
    </div>
  );
}

function CompactMetric({ label, value, spark, sparkColor, progress, progressColor, color = "var(--fg-1)" }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 80 }}>
      <p style={{ fontFamily: "var(--font-mono)", fontSize: 9, textTransform: "uppercase", letterSpacing: "0.10em", color: "var(--fg-5)", margin: 0 }}>{label}</p>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontFamily: "var(--font-sans)", fontSize: 15, fontWeight: 600, color, letterSpacing: "-0.02em", fontVariantNumeric: "tabular-nums" }}>{value}</span>
        {spark && <Sparkline data={spark} color={sparkColor} height={18} width={48} showDot={false} />}
      </div>
      {progress !== undefined && (
        <div style={{ height: 3, background: "oklch(0.16 0 0)", borderRadius: 1.5, overflow: "hidden", width: 64 }}>
          <div style={{ width: `${Math.min(progress, 100)}%`, height: "100%", background: progressColor || "var(--amber)" }} />
        </div>
      )}
    </div>
  );
}

Object.assign(window, { CampaignsScreen });
