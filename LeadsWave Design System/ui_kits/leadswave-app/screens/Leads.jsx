// Leads v2 — sortable headers, refined avatars, inline hover quick actions.
const STATE_KEYS = ["discovered", "contacted", "replied", "converted", "unsubscribed", "bounced"];

function LeadsScreen({ onNavigate, onJumpToInbox }) {
  const [query, setQuery] = React.useState("");
  const [stateFilter, setStateFilter] = React.useState("all");
  const [campaignFilter, setCampaignFilter] = React.useState("all");
  const [selection, setSelection] = React.useState(new Set());
  const [focusIdx, setFocusIdx] = React.useState(0);
  const [sort, setSort] = React.useState({ key: "lastTouched", dir: "desc" });
  const [density, setDensity] = React.useState("comfortable"); // compact / comfortable

  const filtered = React.useMemo(() => {
    let list = LW.leads.filter(l => {
      if (stateFilter !== "all" && l.state !== stateFilter) return false;
      if (campaignFilter !== "all" && l.campaign !== campaignFilter) return false;
      if (query) {
        const q = query.toLowerCase();
        if (!l.company.toLowerCase().includes(q) &&
            !(l.email || "").toLowerCase().includes(q) &&
            !(l.website || "").toLowerCase().includes(q)) return false;
      }
      return true;
    });
    list = [...list].sort((a, b) => {
      const av = a[sort.key], bv = b[sort.key];
      if (av < bv) return sort.dir === "asc" ? -1 : 1;
      if (av > bv) return sort.dir === "asc" ? 1 : -1;
      return 0;
    });
    return list;
  }, [stateFilter, campaignFilter, query, sort]);

  function toggle(id) {
    setSelection(s => {
      const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n;
    });
  }
  function toggleAll() {
    if (selection.size === filtered.length) setSelection(new Set());
    else setSelection(new Set(filtered.map(l => l.id)));
  }
  function toggleSort(key) {
    setSort(s => s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "desc" });
  }

  React.useEffect(() => {
    function onKey(e) {
      if (document.activeElement && /input|textarea|select/i.test(document.activeElement.tagName)) return;
      if (e.key === "j") { setFocusIdx(i => Math.min(filtered.length - 1, i + 1)); e.preventDefault(); }
      if (e.key === "k") { setFocusIdx(i => Math.max(0, i - 1)); e.preventDefault(); }
      if (e.key === "/") { document.getElementById("leads-search")?.focus(); e.preventDefault(); }
      if (e.key === "x" && filtered[focusIdx]) { toggle(filtered[focusIdx].id); }
      if (e.key === "Enter" && filtered[focusIdx]) { onJumpToInbox?.(filtered[focusIdx].id); }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [filtered, focusIdx]);

  const campaigns = ["all", ...new Set(LW.leads.map(l => l.campaign))];
  const stateCount = (s) => LW.leads.filter(l => l.state === s).length;
  const rowPad = density === "compact" ? "7px 12px" : "11px 12px";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
        <div>
          <h1 style={{ fontFamily: "var(--font-sans)", fontWeight: 600, fontSize: "26px", letterSpacing: "-0.025em", color: "var(--fg-1)", margin: "0 0 4px" }}>Leads</h1>
          <p style={{ fontFamily: "var(--font-mono)", fontSize: "12px", color: "var(--fg-4)", margin: 0 }}>
            <span style={{ color: "var(--fg-2)" }}>{filtered.length}</span>
            <span> leads</span>
            {filtered.length !== LW.leads.length && <> · filtered from {LW.leads.length}</>}
            {selection.size > 0 && <> · <span style={{ color: "var(--amber)" }}>{selection.size} selected</span></>}
          </p>
        </div>
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <Segmented value={density} onChange={setDensity} options={[
            { value: "comfortable", label: "Cozy" },
            { value: "compact", label: "Dense" },
          ]} />
          <Button variant="secondary" size="md" iconStart="upload">Import CSV</Button>
          <Button size="md" iconStart="plus" onClick={() => onNavigate("campaign-new")}>New Campaign</Button>
        </div>
      </div>

      {/* State filter chips */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
        <FilterChip active={stateFilter === "all"} onClick={() => setStateFilter("all")} count={LW.leads.length}>All</FilterChip>
        {STATE_KEYS.map(s => (
          <FilterChip key={s} active={stateFilter === s} onClick={() => setStateFilter(s)} count={stateCount(s)}>{s}</FilterChip>
        ))}
      </div>

      {/* Search + filter row */}
      <div style={{
        display: "flex", alignItems: "center", gap: "12px",
        padding: "10px 14px",
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-lg)",
      }}>
        <div style={{ flex: 1, maxWidth: 360 }}>
          <Input id="leads-search" iconStart="search" placeholder="Search by company, email, website…  (press /)" value={query} onChange={(e) => setQuery(e.target.value)} onClear={() => setQuery("")} />
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: "10px", alignItems: "center" }}>
          <Icon name="filter" size={14} color="var(--fg-4)" />
          <Select value={campaignFilter} onChange={(e) => setCampaignFilter(e.target.value)} style={{ minWidth: 180 }}>
            {campaigns.map(c => <option key={c} value={c}>{c === "all" ? "All Campaigns" : c}</option>)}
          </Select>
        </div>
      </div>

      {/* Bulk action toolbar */}
      {selection.size > 0 && (
        <div style={{
          display: "flex", alignItems: "center", gap: "12px",
          padding: "8px 16px",
          background: "var(--amber-tinted-surface)",
          border: "1px solid var(--amber-border)",
          borderRadius: "var(--radius-lg)",
        }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: "12px", color: "var(--amber)", fontWeight: 600 }}>
            {selection.size} selected
          </span>
          <span style={{ flex: 1 }} />
          <Button size="sm" variant="tinted" iconStart="play">Send Outreach</Button>
          <Button size="sm" variant="secondary" iconStart="archive">Move to Campaign</Button>
          <Button size="sm" variant="destructive" iconStart="x">Delete</Button>
          <button onClick={() => setSelection(new Set())} title="Clear selection" style={{ background: "transparent", border: 0, color: "var(--fg-3)", cursor: "pointer", padding: 4, display: "flex" }}>
            <Icon name="x" size={14} />
          </button>
        </div>
      )}

      {/* Table */}
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", overflow: "hidden" }}>
        <div style={{
          display: "grid",
          gridTemplateColumns: "36px 2fr 1.6fr 1.4fr 110px 120px 56px 90px",
          background: "oklch(0.115 0 0)",
          borderBottom: "1px solid var(--border)",
          position: "sticky", top: 0, zIndex: 2,
        }}>
          <div style={{ padding: rowPad, display: "flex", alignItems: "center" }}>
            <Checkbox checked={selection.size === filtered.length && filtered.length > 0} onChange={toggleAll} />
          </div>
          <SortHeader label="Company" sortKey="company" sort={sort} onClick={toggleSort} />
          <SortHeader label="Campaign" sortKey="campaign" sort={sort} onClick={toggleSort} />
          <SortHeader label="Last touched" sortKey="lastTouched" sort={sort} onClick={toggleSort} />
          <SortHeader label="State" sortKey="state" sort={sort} onClick={toggleSort} />
          <SortHeader label="Engagement" />
          <SortHeader label="Msgs" sortKey="msgs" sort={sort} onClick={toggleSort} alignRight />
          <SortHeader label="" />
        </div>
        {filtered.length === 0 ? (
          <div style={{ padding: "40px 20px" }}>
            <EmptyState>No leads match the current filters.</EmptyState>
          </div>
        ) : filtered.map((lead, idx) => (
          <LeadRow key={lead.id} lead={lead} idx={idx} density={density} focused={idx === focusIdx} selected={selection.has(lead.id)} onToggle={() => toggle(lead.id)} onClick={() => setFocusIdx(idx)} onOpen={onJumpToInbox} />
        ))}
      </div>
    </div>
  );
}

function SortHeader({ label, sortKey, sort, onClick, alignRight }) {
  if (!sortKey) {
    return <div style={{ padding: "11px 12px", fontFamily: "var(--font-mono)", fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--fg-4)" }}>{label}</div>;
  }
  const isActive = sort.key === sortKey;
  return (
    <button onClick={() => onClick(sortKey)} style={{
      padding: "11px 12px", background: "transparent", border: 0, cursor: "pointer",
      fontFamily: "var(--font-mono)", fontSize: "10px",
      textTransform: "uppercase", letterSpacing: "0.08em",
      color: isActive ? "var(--fg-1)" : "var(--fg-4)",
      display: "flex", alignItems: "center", gap: 4,
      justifyContent: alignRight ? "flex-end" : "flex-start",
      transition: "color 150ms ease",
    }}>
      <span>{label}</span>
      <span style={{ opacity: isActive ? 1 : 0.4 }}>
        {isActive ? <Icon name={sort.dir === "asc" ? "arrowUp" : "arrowDown"} size={10} /> : <Icon name="arrowDown" size={10} />}
      </span>
    </button>
  );
}

function Checkbox({ checked, onChange }) {
  return (
    <button onClick={onChange} style={{
      width: 14, height: 14, padding: 0, border: `1px solid ${checked ? "var(--amber)" : "oklch(0.30 0 0)"}`,
      background: checked ? "var(--amber)" : "transparent",
      borderRadius: 3, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      {checked && <Icon name="check" size={10} color="var(--canvas)" />}
    </button>
  );
}

function LeadRow({ lead, idx, focused, selected, density, onToggle, onClick, onOpen }) {
  const [hover, setHover] = React.useState(false);
  const rowPad = density === "compact" ? "7px 12px" : "11px 12px";
  // Engagement bar: pseudo metric based on msgs and state
  const engagement = Math.min(100, lead.msgs * 18 + (lead.state === "replied" || lead.state === "converted" ? 30 : 0));
  const engColor = lead.state === "replied" || lead.state === "converted" ? "var(--success)" : engagement > 0 ? "var(--amber)" : "oklch(0.18 0 0)";
  return (
    <div onClick={onClick}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
      display: "grid",
      gridTemplateColumns: "36px 2fr 1.6fr 1.4fr 110px 120px 56px 90px",
      borderBottom: "1px solid var(--border-soft)",
      background: focused ? "oklch(0.13 0 0)" : (hover ? "oklch(0.12 0 0)" : (idx % 2 === 0 ? "var(--surface)" : "oklch(0.135 0 0)")),
      borderLeft: focused ? "2px solid var(--amber)" : "2px solid transparent",
      cursor: "pointer", transition: "background 100ms ease",
    }}>
      <div style={{ padding: rowPad, display: "flex", alignItems: "center" }} onClick={(e) => e.stopPropagation()}>
        <Checkbox checked={selected} onChange={onToggle} />
      </div>
      <div style={{ padding: rowPad, display: "flex", alignItems: "center", gap: "10px", minWidth: 0 }}>
        <Avatar name={lead.company} size={22} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <p style={{ fontFamily: "var(--font-sans)", fontSize: "13px", color: "var(--fg-1)", margin: 0, lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: 500, letterSpacing: "-0.01em" }}>{lead.company}</p>
          {density !== "compact" && (
            <p style={{ fontFamily: "var(--font-mono)", fontSize: "10.5px", color: "var(--fg-4)", margin: "1px 0 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{lead.email || lead.website}</p>
          )}
        </div>
      </div>
      <div style={{ padding: rowPad, fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--fg-3)", display: "flex", alignItems: "center", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{lead.campaign}</div>
      <div style={{ padding: rowPad, fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--fg-4)", display: "flex", alignItems: "center" }}>{lead.lastTouched}</div>
      <div style={{ padding: rowPad, display: "flex", alignItems: "center" }}>
        <StateBadge state={lead.state} />
      </div>
      <div style={{ padding: rowPad, display: "flex", alignItems: "center", gap: 6 }}>
        <div style={{ flex: 1, height: 4, background: "oklch(0.16 0 0)", borderRadius: 2, overflow: "hidden" }}>
          <div style={{ width: `${engagement}%`, height: "100%", background: engColor, transition: "width 400ms ease" }} />
        </div>
      </div>
      <div style={{ padding: rowPad, display: "flex", alignItems: "center", justifyContent: "flex-end", fontFamily: "var(--font-mono)", fontSize: "12px", color: lead.msgs > 0 ? "var(--amber)" : "var(--fg-5)", fontVariantNumeric: "tabular-nums" }}>
        {lead.msgs}
      </div>
      <div style={{ padding: "5px 8px", display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "4px" }} onClick={(e) => e.stopPropagation()}>
        {hover ? (
          <>
            <Button size="sm" variant="tinted" onClick={() => onOpen?.(lead.id)}>Open</Button>
            <button title="More" style={{ background: "transparent", border: 0, color: "var(--fg-4)", cursor: "pointer", padding: 4, display: "flex" }}>
              <Icon name="pencil" size={11} />
            </button>
          </>
        ) : (
          <Icon name="chevron" size={12} color="var(--fg-5)" />
        )}
      </div>
    </div>
  );
}

Object.assign(window, { LeadsScreen, Checkbox });
