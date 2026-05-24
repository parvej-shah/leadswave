// Sidebar v2 — workspace switcher header + integrated search trigger + collapse + signal pulse.
const { useState: useStateSb, useRef: useRefSb } = React;

const NAV_ITEMS = [
  { key: "dashboard",  label: "Dashboard",  icon: "home",     kbd: "G D" },
  { key: "campaigns",  label: "Campaigns",  icon: "target",   kbd: "G C" },
  { key: "leads",      label: "Leads",      icon: "users",    kbd: "G L" },
  { key: "inbox",      label: "Inbox",      icon: "inbox",    kbd: "G I" },
  { key: "settings",   label: "Settings",   icon: "settings", kbd: "G S" },
];

function Sidebar({ active, onNavigate, collapsed, onToggleCollapse, hotSignal = true, hotCount = 0, userEmail = "daniel@leadswave.app", onOpenCmd }) {
  const [menuOpen, setMenuOpen] = useStateSb(false);
  return (
    <aside style={{
      width: collapsed ? "56px" : "224px",
      transition: "width 200ms ease",
      flexShrink: 0,
      background: "var(--sidebar)",
      borderRight: "1px solid var(--border)",
      display: "flex", flexDirection: "column",
      padding: collapsed ? "12px 8px" : "12px",
      gap: "10px", height: "100%",
      position: "relative",
    }}>
      {/* Workspace switcher header */}
      <WorkspaceHeader collapsed={collapsed} menuOpen={menuOpen} setMenuOpen={setMenuOpen} />

      {/* Cmd-K trigger */}
      {!collapsed ? (
        <button onClick={onOpenCmd} style={{
          width: "100%", display: "flex", alignItems: "center", gap: 8,
          padding: "7px 10px", borderRadius: 6,
          background: "oklch(0.12 0 0)",
          border: "1px solid var(--border)",
          color: "var(--fg-4)", cursor: "pointer",
          fontFamily: "var(--font-mono)", fontSize: 12,
          textAlign: "left",
          transition: "border-color 150ms ease",
        }} onMouseEnter={(e) => e.currentTarget.style.borderColor = "oklch(0.20 0 0)"}
           onMouseLeave={(e) => e.currentTarget.style.borderColor = "var(--border)"}>
          <Icon name="search" size={12} />
          <span>Search…</span>
          <span style={{ marginLeft: "auto", display: "inline-flex", gap: 2 }}>
            <Kbd>⌘</Kbd><Kbd>K</Kbd>
          </span>
        </button>
      ) : (
        <button onClick={onOpenCmd} title="Search ⌘K" style={{
          width: "40px", height: "32px",
          display: "flex", alignItems: "center", justifyContent: "center",
          background: "oklch(0.12 0 0)", border: "1px solid var(--border)",
          color: "var(--fg-4)", cursor: "pointer", borderRadius: 6,
        }}><Icon name="search" size={13} /></button>
      )}

      {/* Navigation */}
      <nav style={{ display: "flex", flexDirection: "column", gap: "2px", flex: 1, marginTop: 4 }}>
        {!collapsed && <NavSectionLabel>Workspace</NavSectionLabel>}
        {NAV_ITEMS.map(item => {
          const isActive = active === item.key;
          const showSignal = item.key === "inbox" && hotSignal;
          return (
            <NavItem key={item.key} item={item} active={isActive} signal={showSignal} signalCount={item.key === "inbox" ? hotCount : 0} collapsed={collapsed} onClick={() => onNavigate(item.key)} />
          );
        })}

        {!collapsed && <NavSectionLabel style={{ marginTop: 16 }}>Campaigns</NavSectionLabel>}
        {!collapsed && LW.campaigns.slice(0, 3).map(c => (
          <CampaignRail key={c.id} campaign={c} />
        ))}
      </nav>

      {/* Footer */}
      <div style={{ borderTop: "1px solid var(--border)", paddingTop: collapsed ? 8 : 10 }}>
        {!collapsed ? (
          <div style={{
            display: "flex", alignItems: "center", gap: 8,
            padding: "6px 4px",
            cursor: "pointer", borderRadius: 4,
            transition: "background 150ms ease",
          }} onMouseEnter={(e) => e.currentTarget.style.background = "oklch(0.13 0 0)"}
             onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
            <Avatar name="Daniel" size={22} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-2)", margin: 0, lineHeight: 1.2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>Daniel Park</p>
              <p style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--fg-5)", margin: 0, lineHeight: 1.2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{userEmail}</p>
            </div>
            <Icon name="chevronDown" size={10} color="var(--fg-5)" />
          </div>
        ) : (
          <div style={{ display: "flex", justifyContent: "center", padding: "4px 0" }}>
            <Avatar name="Daniel" size={22} />
          </div>
        )}
        <button onClick={onToggleCollapse} title={collapsed ? "Expand" : "Collapse"} style={{
          width: collapsed ? "40px" : "100%",
          margin: collapsed ? "8px auto 0" : "8px 0 0",
          padding: "5px 8px", background: "transparent", border: 0,
          color: "var(--fg-5)", cursor: "pointer", fontFamily: "var(--font-mono)", fontSize: 10,
          borderRadius: 4, display: "flex", alignItems: "center", justifyContent: collapsed ? "center" : "flex-start",
          gap: 6,
        }}>
          <Icon name={collapsed ? "arrow" : "x"} size={10} />
          {!collapsed && <span style={{ letterSpacing: "0.04em" }}>Collapse</span>}
        </button>
      </div>
    </aside>
  );
}

function WorkspaceHeader({ collapsed, menuOpen, setMenuOpen }) {
  if (collapsed) {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: "4px 0 8px", borderBottom: "1px solid var(--border)", marginBottom: 4 }}>
        <span style={{
          width: 26, height: 26, borderRadius: 6,
          background: "var(--amber-tinted-surface)",
          border: "1px solid var(--amber-border)",
          display: "flex", alignItems: "center", justifyContent: "center",
          color: "var(--amber)", fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700,
        }}>L</span>
      </div>
    );
  }
  return (
    <div style={{ position: "relative" }}>
      <button onClick={() => setMenuOpen(!menuOpen)} style={{
        width: "100%", display: "flex", alignItems: "center", gap: 8,
        padding: "8px 8px", border: 0, borderRadius: 6,
        background: menuOpen ? "oklch(0.13 0 0)" : "transparent",
        cursor: "pointer", transition: "background 150ms ease",
      }} onMouseEnter={(e) => !menuOpen && (e.currentTarget.style.background = "oklch(0.12 0 0)")}
         onMouseLeave={(e) => !menuOpen && (e.currentTarget.style.background = "transparent")}>
        <span style={{
          width: 26, height: 26, borderRadius: 6,
          background: "var(--amber-tinted-surface)",
          border: "1px solid var(--amber-border)",
          display: "flex", alignItems: "center", justifyContent: "center",
          color: "var(--amber)", fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 700,
        }}>L</span>
        <div style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
          <p style={{ fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 600, color: "var(--fg-1)", margin: 0, lineHeight: 1.15 }}>LeadsWave</p>
          <p style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--fg-4)", margin: 0, lineHeight: 1.2, letterSpacing: "0.06em", textTransform: "uppercase" }}>Free · Solo</p>
        </div>
        <Icon name="chevronDown" size={10} color="var(--fg-5)" />
      </button>
      {menuOpen && (
        <div style={{
          position: "absolute", top: "100%", left: 0, right: 0, marginTop: 4,
          background: "var(--sidebar)", border: "1px solid var(--border)",
          borderRadius: 8, padding: 6,
          zIndex: 10,
          boxShadow: "0 8px 24px oklch(0 0 0 / 50%)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 8px", background: "var(--amber-tinted-surface)", borderRadius: 4 }}>
            <span style={{ width: 18, height: 18, borderRadius: 4, background: "var(--amber-tinted-surface)", border: "1px solid var(--amber-border)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--amber)", fontFamily: "var(--font-mono)", fontSize: 9, fontWeight: 700 }}>L</span>
            <span style={{ flex: 1, fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--amber)" }}>LeadsWave</span>
            <Icon name="check" size={11} color="var(--amber)" />
          </div>
          <button style={{ width: "100%", textAlign: "left", padding: "6px 8px", marginTop: 2, fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-3)", background: "transparent", border: 0, borderRadius: 4, cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}>
            <Icon name="plus" size={11} /> New workspace
          </button>
          <div style={{ height: 1, background: "var(--border-soft)", margin: "6px 0" }} />
          <button style={{ width: "100%", textAlign: "left", padding: "6px 8px", fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-3)", background: "transparent", border: 0, borderRadius: 4, cursor: "pointer" }}>
            Workspace settings
          </button>
          <button style={{ width: "100%", textAlign: "left", padding: "6px 8px", fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-3)", background: "transparent", border: 0, borderRadius: 4, cursor: "pointer" }}>
            Billing
          </button>
        </div>
      )}
    </div>
  );
}

function NavSectionLabel({ children, style }) {
  return (
    <p style={{
      fontFamily: "var(--font-mono)", fontSize: 9,
      textTransform: "uppercase", letterSpacing: "0.12em",
      color: "var(--fg-5)", margin: 0,
      padding: "4px 10px 4px", ...style,
    }}>{children}</p>
  );
}

function NavItem({ item, active, signal, signalCount, collapsed, onClick }) {
  const [hover, setHover] = useStateSb(false);
  return (
    <button onClick={onClick}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      title={collapsed ? `${item.label}${item.kbd ? ` (${item.kbd})` : ""}` : undefined}
      style={{
        display: "flex", alignItems: "center", gap: "10px",
        padding: collapsed ? "8px" : "6px 10px",
        justifyContent: collapsed ? "center" : "flex-start",
        background: active ? "var(--amber-tinted-surface)" : (hover ? "oklch(0.13 0 0)" : "transparent"),
        color: active ? "var(--amber)" : hover ? "var(--fg-2)" : "var(--fg-3)",
        border: 0, borderRadius: "5px",
        fontFamily: "var(--font-mono)", fontSize: "12.5px",
        cursor: "pointer", textAlign: "left",
        transition: "background 150ms ease, color 150ms ease",
        position: "relative",
      }}>
      <Icon name={item.icon} size={13} />
      {!collapsed && <span style={{ flex: 1 }}>{item.label}</span>}
      {!collapsed && signal && signalCount > 0 && (
        <span style={{
          fontFamily: "var(--font-mono)", fontSize: 9,
          padding: "1px 5px", borderRadius: 3,
          background: "var(--amber-bg)", color: "var(--amber)",
          border: "1px solid var(--amber-border)",
        }}>{signalCount}</span>
      )}
      {!collapsed && signal && signalCount === 0 && (
        <span style={{
          width: 5, height: 5, borderRadius: "50%",
          background: "var(--amber)", animation: "pulse 1.4s infinite",
        }} />
      )}
      {collapsed && signal && (
        <span style={{
          position: "absolute", top: 4, right: 4,
          width: 5, height: 5, borderRadius: "50%",
          background: "var(--amber)", animation: "pulse 1.4s infinite",
        }} />
      )}
    </button>
  );
}

function CampaignRail({ campaign }) {
  const [hover, setHover] = useStateSb(false);
  return (
    <button onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)} style={{
      display: "flex", alignItems: "center", gap: 8,
      padding: "5px 10px",
      background: hover ? "oklch(0.13 0 0)" : "transparent",
      border: 0, borderRadius: 5, cursor: "pointer", width: "100%",
      transition: "background 150ms ease",
    }}>
      <span style={{ width: 5, height: 5, borderRadius: "50%", background: campaign.status === "active" ? "var(--success)" : "var(--fg-5)", flexShrink: 0 }} />
      <span style={{ fontFamily: "var(--font-mono)", fontSize: "11.5px", color: "var(--fg-4)", flex: 1, textAlign: "left", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{campaign.name}</span>
      {campaign.hot > 0 && (
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--hot)", padding: "1px 4px", borderRadius: 3, background: "var(--hot-bg)", border: "1px solid var(--hot-border)" }}>{campaign.hot}</span>
      )}
    </button>
  );
}

Object.assign(window, { Sidebar, NavItem, NAV_ITEMS, WorkspaceHeader, NavSectionLabel, CampaignRail });
