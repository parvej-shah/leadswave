// LeadsWave UI Kit — main App shell with screen router.
function App() {
  const [screen, setScreen] = React.useState(() => {
    const hash = (window.location.hash || "#dashboard").slice(1);
    return ["login", "dashboard", "campaigns", "campaign-new", "leads", "inbox", "settings"].includes(hash) ? hash : "dashboard";
  });
  const [collapsed, setCollapsed] = React.useState(false);
  const [inboxInitial, setInboxInitial] = React.useState(null);
  const [authed, setAuthed] = React.useState(true);

  React.useEffect(() => {
    if (window.location.hash !== "#" + screen) window.location.hash = "#" + screen;
  }, [screen]);

  React.useEffect(() => {
    function onHash() {
      const h = (window.location.hash || "#dashboard").slice(1);
      if (["login", "dashboard", "campaigns", "campaign-new", "leads", "inbox", "settings"].includes(h)) {
        setScreen(h);
      }
    }
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  function navigate(key) {
    if (key === "campaign-new") setScreen("campaign-new");
    else setScreen(key);
  }

  function jumpToInbox(leadId) {
    setInboxInitial(leadId);
    setScreen("inbox");
  }

  // Cmd-K command palette (visual mock)
  const [cmdOpen, setCmdOpen] = React.useState(false);
  React.useEffect(() => {
    function onKey(e) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setCmdOpen(o => !o);
      }
      if (e.key === "Escape") setCmdOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (screen === "login" || !authed) {
    return <LoginScreen onSignIn={() => { setAuthed(true); setScreen("dashboard"); }} />;
  }

  const isInbox = screen === "inbox";
  const mainScreen = (
    screen === "dashboard"     ? <DashboardScreen onNavigate={navigate} onJumpToInbox={jumpToInbox} /> :
    screen === "campaigns"     ? <CampaignsScreen onNavigate={navigate} /> :
    screen === "campaign-new"  ? <CampaignNewScreen onNavigate={navigate} /> :
    screen === "leads"         ? <LeadsScreen onNavigate={navigate} onJumpToInbox={jumpToInbox} /> :
    screen === "inbox"         ? <InboxScreen initialThreadId={inboxInitial} /> :
    screen === "settings"      ? <SettingsScreen /> : null
  );

  return (
    <div style={{ display: "flex", height: "100vh", background: "var(--canvas)" }}>
      <Sidebar
        active={screen === "campaign-new" ? "campaigns" : screen}
        onNavigate={navigate}
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed(c => !c)}
        hotSignal={LW.inboxThreads.some(t => t.isFresh)}
        hotCount={LW.inboxThreads.filter(t => t.classify === "hot").length}
        onOpenCmd={() => setCmdOpen(true)}
      />
      <main style={{
        flex: 1, overflow: "auto",
        padding: isInbox ? "24px" : "24px 28px",
        position: "relative",
      }}>
        {mainScreen}
      </main>

      <CommandPalette open={cmdOpen} onClose={() => setCmdOpen(false)} onNavigate={(k) => { setCmdOpen(false); navigate(k); }} />

      <style>{`
        @keyframes pulse { 0%, 100% { opacity: 1 } 50% { opacity: 0.35 } }
        @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes scaleUp { from { transform: scale(0.96); opacity: 0 } to { transform: scale(1); opacity: 1 } }
        ::-webkit-scrollbar { width: 10px; height: 10px }
        ::-webkit-scrollbar-track { background: transparent }
        ::-webkit-scrollbar-thumb { background: oklch(0.18 0 0); border-radius: 6px; border: 2px solid var(--canvas) }
        ::-webkit-scrollbar-thumb:hover { background: oklch(0.24 0 0) }
        *::selection { background: var(--amber-bg); color: var(--fg-1) }
      `}</style>
    </div>
  );
}

function CommandPalette({ open, onClose, onNavigate }) {
  const [q, setQ] = React.useState("");
  const [sel, setSel] = React.useState(0);
  const listRef = React.useRef(null);

  React.useEffect(() => { if (!open) { setQ(""); setSel(0); } }, [open]);

  const allCommands = React.useMemo(() => [
    { group: "Navigate",    label: "Go to Dashboard",  icon: "home",     kbd: "G D", action: () => onNavigate("dashboard") },
    { group: "Navigate",    label: "Go to Campaigns",  icon: "target",   kbd: "G C", action: () => onNavigate("campaigns") },
    { group: "Navigate",    label: "Go to Leads",      icon: "users",    kbd: "G L", action: () => onNavigate("leads") },
    { group: "Navigate",    label: "Go to Inbox",      icon: "inbox",    kbd: "G I", action: () => onNavigate("inbox") },
    { group: "Navigate",    label: "Go to Settings",   icon: "settings", kbd: "G S", action: () => onNavigate("settings") },
    { group: "Create",      label: "New Campaign",        icon: "plus",    kbd: "⇧N", action: () => onNavigate("campaign-new") },
    { group: "Create",      label: "Import leads from CSV", icon: "upload", action: () => {} },
    { group: "Create",      label: "Invite teammate",     icon: "users",   action: () => onNavigate("settings") },
    { group: "Run",         label: "Run Follow-ups now",  icon: "refresh", action: () => {} },
    { group: "Run",         label: "Re-run Scout on all active campaigns", icon: "refresh", action: () => {} },
    { group: "Leads",       label: "Acme Robotics",       icon: "users",   subtitle: "BD Law Firms Q2 · hot", action: () => onNavigate("inbox") },
    { group: "Leads",       label: "Northwind Logistics", icon: "users",   subtitle: "Series-A SaaS · converted", action: () => onNavigate("inbox") },
    { group: "Leads",       label: "Pinion Labs",         icon: "users",   subtitle: "BD Law Firms Q2 · contacted", action: () => onNavigate("leads") },
    { group: "Account",     label: "Toggle sidebar",      icon: "chevron", action: () => {} },
    { group: "Account",     label: "Sign out",            icon: "x",        action: () => {} },
  ], [onNavigate]);

  const filtered = React.useMemo(() => {
    if (!q.trim()) return allCommands;
    const needle = q.toLowerCase();
    return allCommands.filter(c => c.label.toLowerCase().includes(needle) || (c.subtitle || "").toLowerCase().includes(needle));
  }, [q, allCommands]);

  // Group items, but only show groups when not filtering by text
  const groups = React.useMemo(() => {
    const m = new Map();
    filtered.forEach(c => {
      if (!m.has(c.group)) m.set(c.group, []);
      m.get(c.group).push(c);
    });
    return Array.from(m.entries());
  }, [filtered]);

  React.useEffect(() => { setSel(0); }, [q]);

  React.useEffect(() => {
    if (!open) return;
    function onKey(e) {
      if (e.key === "Escape") { onClose(); return; }
      if (e.key === "ArrowDown") { setSel(s => Math.min(filtered.length - 1, s + 1)); e.preventDefault(); }
      if (e.key === "ArrowUp")   { setSel(s => Math.max(0, s - 1)); e.preventDefault(); }
      if (e.key === "Enter") {
        const item = filtered[sel];
        if (item) { item.action(); onClose(); }
        e.preventDefault();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, sel, filtered]);

  React.useEffect(() => {
    if (!open || !listRef.current) return;
    const el = listRef.current.querySelector(`[data-cmd-idx="${sel}"]`);
    if (el) el.scrollIntoView({ block: "nearest" });
  }, [sel, open]);

  if (!open) return null;

  let runningIdx = -1;

  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, zIndex: 100,
      background: "rgba(0,0,0,0.75)", backdropFilter: "blur(6px)",
      display: "flex", alignItems: "flex-start", justifyContent: "center", paddingTop: "10vh",
      animation: "fadeIn 120ms ease",
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        width: "100%", maxWidth: 580,
        background: "oklch(0.11 0 0)",
        border: "1px solid oklch(1 0 0 / 10%)",
        borderRadius: "var(--radius-xl)",
        overflow: "hidden",
        animation: "scaleUp 180ms ease",
        boxShadow: "0 24px 80px oklch(0 0 0 / 60%)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", borderBottom: "1px solid var(--border)" }}>
          <Icon name="search" size={14} color="var(--fg-4)" />
          <input autoFocus placeholder="Type a command, lead, or page…"
            value={q} onChange={(e) => setQ(e.target.value)}
            style={{
              flex: 1, background: "transparent", border: 0, outline: 0,
              color: "var(--fg-1)", fontFamily: "var(--font-mono)", fontSize: "14px",
            }} />
          <Kbd>ESC</Kbd>
        </div>
        <div ref={listRef} style={{ maxHeight: "min(60vh, 480px)", overflowY: "auto", padding: "6px 0" }}>
          {groups.length === 0 ? (
            <div style={{ padding: 28, textAlign: "center" }}>
              <p style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--fg-5)", margin: 0 }}>No commands match "{q}"</p>
            </div>
          ) : groups.map(([group, items]) => (
            <div key={group} style={{ marginBottom: 6 }}>
              <p style={{
                fontFamily: "var(--font-mono)", fontSize: 9,
                textTransform: "uppercase", letterSpacing: "0.12em",
                color: "var(--fg-5)", padding: "6px 16px 4px", margin: 0,
              }}>{group}</p>
              {items.map((it) => {
                runningIdx++;
                const isSel = runningIdx === sel;
                return (
                  <button key={runningIdx} data-cmd-idx={runningIdx}
                    onMouseEnter={() => setSel(runningIdx)}
                    onClick={() => { it.action(); onClose(); }}
                    style={{
                      width: "100%", textAlign: "left", border: 0,
                      padding: "8px 16px",
                      background: isSel ? "oklch(0.16 0 0)" : "transparent",
                      borderLeft: isSel ? "2px solid var(--amber)" : "2px solid transparent",
                      display: "flex", alignItems: "center", gap: 12, cursor: "pointer",
                      color: isSel ? "var(--fg-1)" : "var(--fg-2)",
                      fontFamily: "var(--font-mono)", fontSize: "13px",
                    }}>
                    <Icon name={it.icon} size={13} color={isSel ? "var(--amber)" : "var(--fg-4)"} />
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.label}</span>
                      {it.subtitle && <span style={{ fontSize: 10, color: "var(--fg-5)" }}>{it.subtitle}</span>}
                    </span>
                    {it.kbd && <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--fg-5)" }}>{it.kbd}</span>}
                    {isSel && <Icon name="arrow" size={12} color="var(--amber)" />}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
        <div style={{
          padding: "8px 16px", borderTop: "1px solid var(--border)",
          background: "oklch(0.09 0 0)",
          display: "flex", alignItems: "center", gap: 14,
          fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--fg-5)",
        }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><Kbd>↑</Kbd><Kbd>↓</Kbd> navigate</span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><Kbd>↵</Kbd> select</span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><Kbd>ESC</Kbd> close</span>
          <span style={{ marginLeft: "auto" }}>{filtered.length} commands</span>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { App, CommandPalette });
