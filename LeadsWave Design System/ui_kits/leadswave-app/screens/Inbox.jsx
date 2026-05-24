// Inbox v2 — time-grouped thread list, cleaner messages, lead context panel.
function InboxScreen({ initialThreadId }) {
  const [threads, setThreads] = React.useState(LW.inboxThreads);
  const [selected, setSelected] = React.useState(() => threads.find(t => t.id === initialThreadId) || threads[0]);
  const [draft, setDraft] = React.useState(selected?.aiDraft || "");
  const [sending, setSending] = React.useState(false);
  const [sentToast, setSentToast] = React.useState(false);
  const [filter, setFilter] = React.useState("all"); // all / hot / warm
  const [contextOpen, setContextOpen] = React.useState(typeof window !== "undefined" && window.innerWidth >= 1280);

  React.useEffect(() => {
    function onResize() {
      if (window.innerWidth < 1180) setContextOpen(false);
    }
    window.addEventListener("resize", onResize);
    onResize();
    return () => window.removeEventListener("resize", onResize);
  }, []);

  React.useEffect(() => {
    setDraft(selected?.aiDraft || "");
  }, [selected?.id]);

  function selectThread(t) {
    setSelected(t);
    if (t.isFresh) {
      setThreads(prev => prev.map(x => x.id === t.id ? { ...x, isFresh: false } : x));
    }
  }

  function send() {
    if (!draft.trim() || !selected) return;
    setSending(true);
    setTimeout(() => {
      const newMsg = { id: "msend", direction: "outbound", body: draft, sentAt: "just now" };
      setThreads(prev => prev.map(t => t.id === selected.id ? {
        ...t, messages: [...t.messages, newMsg], aiDraft: "", state: "converted",
      } : t));
      setSelected(s => s && { ...s, messages: [...s.messages, newMsg], aiDraft: "", state: "converted" });
      setDraft("");
      setSending(false);
      setSentToast(true);
      setTimeout(() => setSentToast(false), 2800);
    }, 700);
  }

  React.useEffect(() => {
    function onKey(e) {
      if (document.activeElement && /input|textarea/i.test(document.activeElement.tagName)) return;
      const order = threads;
      const i = order.findIndex(t => t.id === selected?.id);
      if (e.key === "r" && selected) { document.getElementById("inbox-draft")?.focus(); e.preventDefault(); }
      if (e.key === "j") { selectThread(order[Math.min(order.length - 1, i + 1)] || order[0]); }
      if (e.key === "k") { selectThread(order[Math.max(0, i - 1)] || order[0]); }
      if (e.key === "c" && (e.metaKey || e.ctrlKey)) { /* allow */ }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected?.id, threads]);

  // Filter threads
  const visibleThreads = threads.filter(t => filter === "all" || t.classify === filter);
  // Time-grouped
  const grouped = groupByTime(visibleThreads);

  return (
    <div style={{ display: "flex", height: "100%", margin: "-24px", overflow: "hidden" }}>
      {/* LIST PANEL */}
      <div style={{
        width: 320, flexShrink: 0, display: "flex", flexDirection: "column",
        borderRight: "1px solid var(--border)", background: "var(--sidebar)",
      }}>
        <div style={{
          padding: "14px 18px 12px", borderBottom: "1px solid var(--border)",
          background: "oklch(0.105 0 0)",
          display: "flex", flexDirection: "column", gap: 12,
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <h1 style={{ fontFamily: "var(--font-sans)", fontWeight: 600, fontSize: "20px", color: "var(--fg-1)", margin: 0, letterSpacing: "-0.02em" }}>Inbox</h1>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--fg-4)", textTransform: "uppercase", letterSpacing: "0.08em" }}>{visibleThreads.length} threads</span>
          </div>
          <Segmented value={filter} onChange={setFilter} options={[
            { value: "all",  label: `All · ${threads.length}` },
            { value: "hot",  label: `Hot · ${threads.filter(t => t.classify === "hot").length}` },
            { value: "warm", label: `Warm · ${threads.filter(t => t.classify === "warm").length}` },
          ]} />
        </div>

        <div style={{ flex: 1, overflowY: "auto" }}>
          {grouped.map(([group, threads]) => (
            <div key={group}>
              <div style={{
                padding: "12px 18px 6px",
                fontFamily: "var(--font-mono)", fontSize: 9,
                textTransform: "uppercase", letterSpacing: "0.12em",
                color: "var(--fg-5)",
                position: "sticky", top: 0,
                background: "linear-gradient(to bottom, var(--sidebar) 60%, transparent)",
                zIndex: 1,
              }}>{group}</div>
              {threads.map(t => <ThreadRow key={t.id} thread={t} active={selected?.id === t.id} onClick={() => selectThread(t)} />)}
            </div>
          ))}
          {visibleThreads.length === 0 && (
            <div style={{ padding: "60px 20px", textAlign: "center" }}>
              <p style={{ fontFamily: "var(--font-mono)", fontSize: "12px", color: "var(--fg-5)", margin: 0 }}>No threads in this filter.</p>
            </div>
          )}
        </div>

        <div style={{
          padding: "10px 18px", borderTop: "1px solid var(--border)",
          background: "oklch(0.105 0 0)",
          fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--fg-5)",
          display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap",
        }}>
          <span style={{ display: "inline-flex", gap: 4, alignItems: "center" }}><Kbd>J</Kbd><Kbd>K</Kbd> next/prev</span>
          <span style={{ display: "inline-flex", gap: 4, alignItems: "center" }}><Kbd>R</Kbd> reply</span>
          <span style={{ display: "inline-flex", gap: 4, alignItems: "center" }}><Kbd>E</Kbd> archive</span>
        </div>
      </div>

      {/* DETAIL PANEL */}
      {!selected ? (
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", background: "var(--canvas)" }}>
          <p style={{ fontFamily: "var(--font-mono)", fontSize: "12px", color: "var(--fg-5)" }}>Select a thread to read and reply</p>
        </div>
      ) : (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", background: "var(--canvas)", minWidth: 0 }}>
          {/* Header */}
          <div style={{
            padding: "14px 24px", borderBottom: "1px solid var(--border)",
            display: "flex", alignItems: "center", justifyContent: "space-between",
            background: "oklch(0.105 0 0)",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px", minWidth: 0 }}>
              <Avatar name={selected.company} size={32} />
              <div style={{ display: "flex", flexDirection: "column", gap: "2px", minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontFamily: "var(--font-sans)", fontWeight: 600, fontSize: "15px", color: "var(--fg-1)", letterSpacing: "-0.01em" }}>{selected.company}</span>
                  <Badge variant={selected.classify === "hot" ? "hot" : "warm"} size="sm">{selected.classify}</Badge>
                </div>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--fg-4)" }}>{selected.email} · {selected.campaign}</span>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <Button variant="secondary" size="sm" iconStart="archive">Not interested</Button>
              <Button variant="secondary" size="sm" iconStart="cal">Book meeting</Button>
              <button onClick={() => setContextOpen(o => !o)} title="Toggle details" style={{
                background: "transparent", border: "1px solid oklch(0.22 0 0)",
                color: contextOpen ? "var(--amber)" : "var(--fg-4)",
                cursor: "pointer", padding: "5px 7px", borderRadius: 5, display: "flex",
              }}><Icon name="users" size={13} /></button>
            </div>
          </div>

          {/* Thread + Context split */}
          <div style={{ flex: 1, display: "flex", overflow: "hidden", minHeight: 0 }}>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minWidth: 0 }}>
              <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px", display: "flex", flexDirection: "column", gap: "16px" }}>
                {selected.messages.map(msg => <ThreadMessage key={msg.id} msg={msg} />)}
              </div>

              {/* Composer */}
              <div style={{
                padding: "14px 24px", borderTop: "1px solid var(--border)",
                background: "oklch(0.105 0 0)", display: "flex", flexDirection: "column", gap: "10px",
                flexShrink: 0,
              }}>
                {draft && selected.aiDraft && draft === selected.aiDraft && (
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ width: 4, height: 14, background: "var(--amber)", borderRadius: 2 }} />
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.10em", color: "var(--amber)", fontWeight: 600 }}>AI DRAFT</span>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--fg-4)" }}>· edit before sending</span>
                    <span style={{ marginLeft: "auto", fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--fg-5)" }}>Tone: friendly · 84 tokens</span>
                  </div>
                )}
                <div style={{
                  position: "relative",
                  border: `1px solid ${draft && selected.aiDraft && draft === selected.aiDraft ? "var(--amber-border)" : "oklch(0.20 0 0)"}`,
                  borderLeft: draft && selected.aiDraft && draft === selected.aiDraft ? "2px solid var(--amber)" : "1px solid oklch(0.20 0 0)",
                  borderRadius: "6px",
                  background: "oklch(0.115 0 0)",
                }}>
                  <textarea
                    id="inbox-draft"
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    placeholder="Write your reply…"
                    rows={5}
                    style={{
                      width: "100%", boxSizing: "border-box",
                      background: "transparent", border: 0,
                      padding: "12px 14px",
                      color: "var(--fg-1)", fontFamily: "var(--font-mono)", fontSize: "12.5px",
                      outline: "none", resize: "none", lineHeight: 1.65,
                    }}
                  />
                  <div style={{ padding: "8px 14px", borderTop: "1px solid var(--border-soft)", display: "flex", alignItems: "center", gap: 10 }}>
                    <button style={{ background: "transparent", border: 0, color: "var(--fg-4)", cursor: "pointer", display: "flex", alignItems: "center", gap: 4, fontFamily: "var(--font-mono)", fontSize: 10 }}>
                      <Icon name="cal" size={11} /> Insert calendar link
                    </button>
                    <span style={{ height: 12, width: 1, background: "var(--border)" }} />
                    <button style={{ background: "transparent", border: 0, color: "var(--fg-4)", cursor: "pointer", fontFamily: "var(--font-mono)", fontSize: 10 }}>
                      Signature
                    </button>
                    <span style={{ marginLeft: "auto", fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--fg-5)" }}>{draft.length} chars</span>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  {sentToast ? (
                    <Toast kind="success" pill="SENT">Reply sent to {selected.company} · meeting invite queued</Toast>
                  ) : <span />}
                  <div style={{ display: "flex", gap: 8 }}>
                    <Button variant="info" size="md" iconStart="sparkle" onClick={() => setDraft(selected.aiDraft || draft)}>Regenerate</Button>
                    <Button variant="success" size="md" iconEnd="arrow" onClick={send} disabled={!draft.trim() || sending} kbd="⌘↵">
                      {sending ? "Sending…" : "Send Reply"}
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            {/* Lead context panel */}
            {contextOpen && <LeadContextPanel lead={selected} />}
          </div>
        </div>
      )}
    </div>
  );
}

function groupByTime(threads) {
  const buckets = { Today: [], Yesterday: [], "This Week": [], Older: [] };
  threads.forEach(t => {
    const time = (t.lastTouched || "").toLowerCase();
    if (time.includes("m ago") || time.includes("h ago")) buckets.Today.push(t);
    else if (time.includes("1d ago")) buckets.Yesterday.push(t);
    else if (time.includes("d ago")) buckets["This Week"].push(t);
    else buckets.Older.push(t);
  });
  return Object.entries(buckets).filter(([, v]) => v.length > 0);
}

function ThreadRow({ thread, active, onClick }) {
  const [hover, setHover] = React.useState(false);
  return (
    <button onClick={onClick}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
        width: "100%", textAlign: "left",
        padding: "12px 18px", border: 0,
        background: active ? "oklch(0.14 0 0)" : (hover ? "oklch(0.115 0 0)" : "transparent"),
        borderLeft: active ? "2px solid var(--amber)" : "2px solid transparent",
        cursor: "pointer", display: "flex", flexDirection: "column", gap: "5px",
        transition: "background 150ms ease",
        position: "relative",
      }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
          <Avatar name={thread.company} size={20} />
          <span style={{ fontFamily: "var(--font-sans)", fontSize: "13px", color: active ? "var(--fg-1)" : "var(--fg-2)", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", letterSpacing: "-0.01em" }}>
            {thread.company}
          </span>
          {thread.isFresh && <span style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--amber)", animation: "pulse 1.4s infinite", flexShrink: 0 }} />}
        </div>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--fg-5)", flexShrink: 0 }}>{thread.lastTouched}</span>
      </div>
      <p style={{ fontFamily: "var(--font-mono)", fontSize: "11.5px", color: thread.isFresh ? "var(--fg-2)" : "var(--fg-4)", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", lineHeight: 1.4 }}>{thread.snippet}</p>
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <Badge variant={thread.classify === "hot" ? "hot" : "warm"} size="sm">{thread.classify}</Badge>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--fg-5)" }}>{thread.campaign}</span>
      </div>
    </button>
  );
}

function ThreadMessage({ msg }) {
  const inbound = msg.direction === "inbound";
  return (
    <div style={{
      display: "flex", flexDirection: "column", gap: "6px",
      paddingLeft: inbound ? 0 : "0",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        <DirectionTag dir={msg.direction} />
        {msg.subject && <span style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--fg-4)" }}>{msg.subject}</span>}
        <span style={{ marginLeft: "auto", fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--fg-5)" }}>{msg.sentAt}</span>
      </div>
      <div style={{
        padding: "12px 14px",
        borderRadius: "8px",
        background: inbound ? "color-mix(in oklch, var(--success) 8%, var(--surface))" : "var(--surface)",
        borderLeft: inbound ? "2px solid var(--success)" : "2px solid var(--fg-5)",
        color: "var(--fg-2)", fontFamily: "var(--font-mono)", fontSize: "12.5px",
        whiteSpace: "pre-wrap", lineHeight: 1.65,
      }}>{msg.body}</div>
    </div>
  );
}

function LeadContextPanel({ lead }) {
  return (
    <div style={{
      width: 280, flexShrink: 0,
      borderLeft: "1px solid var(--border)",
      background: "oklch(0.105 0 0)",
      padding: "16px 18px",
      overflowY: "auto",
      display: "flex", flexDirection: "column", gap: 18,
    }}>
      <ContextSection label="Lead">
        <ContextRow k="Company" v={lead.company} />
        <ContextRow k="Email" v={lead.email} mono />
        <ContextRow k="Campaign" v={lead.campaign} />
        <ContextRow k="State" v={<StateBadge state={lead.state} />} />
      </ContextSection>

      <ContextSection label="Signals" right={<Badge variant="hot" size="sm">{lead.classify === "hot" ? "STRONG" : "MEDIUM"}</Badge>}>
        <SignalRow icon="✓" label="Replied within 48h" color="var(--success)" />
        <SignalRow icon="✓" label="Asked about pricing" color="var(--success)" />
        {lead.classify === "hot" && <SignalRow icon="✓" label="Mentioned timeline" color="var(--success)" />}
        <SignalRow icon="—" label="No unsubscribe intent" color="var(--fg-4)" />
      </ContextSection>

      <ContextSection label="Timeline">
        <TimelineDot kind="contacted" label="Initial outreach" at="2d ago" />
        <TimelineDot kind="replied" label="They replied" at="12m ago" />
        <TimelineDot kind="pending" label="Awaiting reply" />
      </ContextSection>

      <ContextSection label="Next steps">
        <Button variant="tinted" size="sm" iconStart="cal" fullWidth>Suggest Thu 3pm ET</Button>
        <Button variant="secondary" size="sm" iconStart="archive" fullWidth>Move to "Won"</Button>
      </ContextSection>
    </div>
  );
}

function ContextSection({ label, right, children }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <p style={{ fontFamily: "var(--font-mono)", fontSize: 9, textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--fg-5)", margin: 0 }}>{label}</p>
        {right}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>{children}</div>
    </div>
  );
}

function ContextRow({ k, v, mono }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
      <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-4)" }}>{k}</span>
      {typeof v === "string" ? (
        <span style={{ fontFamily: mono ? "var(--font-mono)" : "var(--font-sans)", fontSize: 12, color: "var(--fg-2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{v}</span>
      ) : v}
    </div>
  );
}

function SignalRow({ icon, label, color }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <span style={{ width: 14, fontFamily: "var(--font-mono)", color }}>{icon}</span>
      <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-3)" }}>{label}</span>
    </div>
  );
}

function TimelineDot({ kind, label, at }) {
  const c = kind === "replied" ? "var(--success)" : kind === "contacted" ? "var(--amber)" : "var(--fg-5)";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: kind === "pending" ? "transparent" : c, border: kind === "pending" ? `1.5px dashed ${c}` : `1.5px solid ${c}` }} />
      <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-3)" }}>{label}</span>
      {at && <span style={{ marginLeft: "auto", fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--fg-5)" }}>{at}</span>}
    </div>
  );
}

Object.assign(window, { InboxScreen, ThreadRow, ThreadMessage, LeadContextPanel });
