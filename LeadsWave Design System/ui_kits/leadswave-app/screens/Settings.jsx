// Settings — Google connection, signature, sending limits, notifications, team.
function SettingsScreen() {
  const [signature, setSignature] = React.useState("— Daniel\nFounder, LeadsWave\ndaniel@leadswave.app");
  const [limits, setLimits] = React.useState({ daily: 80, perCampaign: 40, throttle: 90 });
  const [notifs, setNotifs] = React.useState({ telegram: true, email: true, hotOnly: false });
  const [tab, setTab] = React.useState("connection");

  const tabs = [
    { key: "connection", label: "Connection" },
    { key: "signature",  label: "Signature" },
    { key: "limits",     label: "Sending Limits" },
    { key: "notifs",     label: "Notifications" },
    { key: "team",       label: "Team" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px", maxWidth: 920 }}>
      <div>
        <h1 style={{ fontFamily: "var(--font-sans)", fontWeight: 600, fontSize: "24px", letterSpacing: "-0.02em", color: "var(--fg-1)", margin: "0 0 4px" }}>Settings</h1>
        <p style={{ fontFamily: "var(--font-mono)", fontSize: "12px", color: "var(--fg-4)", margin: 0 }}>
          Account, signature, sending behavior, notifications.
        </p>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: "2px", borderBottom: "1px solid var(--border)" }}>
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            padding: "10px 14px",
            background: "transparent", border: 0,
            borderBottom: `2px solid ${tab === t.key ? "var(--amber)" : "transparent"}`,
            color: tab === t.key ? "var(--amber)" : "var(--fg-3)",
            fontFamily: "var(--font-mono)", fontSize: "13px",
            cursor: "pointer", marginBottom: "-1px",
          }}>{t.label}</button>
        ))}
      </div>

      {tab === "connection" && (
        <Card title="Google Account">
          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            <div style={{ width: 36, height: 36, borderRadius: "50%", background: "oklch(0.20 0 0)", display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid var(--border)" }}>
              <Icon name="google" size={16} />
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ fontFamily: "var(--font-mono)", fontSize: "13px", color: "var(--fg-1)", margin: "0 0 2px" }}>daniel@leadswave.app</p>
              <p style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--fg-4)", margin: 0 }}>
                <Badge variant="success" size="sm">CONNECTED</Badge>
                <span style={{ marginLeft: 8 }}>Calendar · Gmail · Read & Send</span>
              </p>
            </div>
            <Button variant="secondary" size="sm">Reconnect</Button>
            <Button variant="destructive" size="sm">Disconnect</Button>
          </div>
        </Card>
      )}

      {tab === "signature" && (
        <Card title="Email Signature">
          <Textarea
            rows={6} value={signature}
            onChange={(e) => setSignature(e.target.value)}
            hint="Appended to every outbound email sent through LeadsWave."
          />
          <div style={{ marginTop: 16, display: "flex", justifyContent: "flex-end" }}>
            <Button>Save Signature</Button>
          </div>
        </Card>
      )}

      {tab === "limits" && (
        <Card title="Sending Limits">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20 }}>
            <Input label="Daily Cap" type="number" value={limits.daily} onChange={(e) => setLimits(l => ({ ...l, daily: +e.target.value }))} hint="Max emails sent per 24h" />
            <Input label="Per Campaign / Day" type="number" value={limits.perCampaign} onChange={(e) => setLimits(l => ({ ...l, perCampaign: +e.target.value }))} hint="Cap per active campaign" />
            <Input label="Throttle (sec)" type="number" value={limits.throttle} onChange={(e) => setLimits(l => ({ ...l, throttle: +e.target.value }))} hint="Wait between sends" />
          </div>
          <div style={{ marginTop: 20, padding: "12px 14px", background: "var(--info-tinted-surface)", border: "1px solid var(--info-border)", borderRadius: 6, display: "flex", gap: 10, alignItems: "flex-start" }}>
            <Icon name="pulse" size={14} color="var(--info)" />
            <p style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--info)", margin: 0, lineHeight: 1.55 }}>
              LeadsWave will pace sends throughout the day. Total volume today: <span style={{ color: "var(--fg-1)" }}>42 / 80</span>.
            </p>
          </div>
        </Card>
      )}

      {tab === "notifs" && (
        <Card title="Notifications">
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <NotifRow label="Telegram alerts" hint="Ping me when a HOT lead arrives" checked={notifs.telegram} onChange={(v) => setNotifs(n => ({ ...n, telegram: v }))} />
            <NotifRow label="Email digest" hint="Daily 9am summary of replies + meetings" checked={notifs.email} onChange={(v) => setNotifs(n => ({ ...n, email: v }))} />
            <NotifRow label="Only HOT, never WARM" hint="Filter notifications to converted leads only" checked={notifs.hotOnly} onChange={(v) => setNotifs(n => ({ ...n, hotOnly: v }))} />
          </div>
          <div style={{ marginTop: 18, paddingTop: 14, borderTop: "1px solid var(--border-soft)" }}>
            <Input label="Telegram bot token" placeholder="123456:ABC-DEF…" />
          </div>
        </Card>
      )}

      {tab === "team" && (
        <Card title="Team">
          <div style={{ display: "flex", flexDirection: "column" }}>
            {[
              { name: "Daniel Park",  email: "daniel@leadswave.app", role: "Owner",  badge: "warm" },
              { name: "Maya Chen",    email: "maya@leadswave.app",   role: "Editor", badge: "neutral" },
              { name: "Pending: tom@acme.io", email: "—",            role: "Invited", badge: "info" },
            ].map((m, i) => (
              <div key={i} style={{
                padding: "12px 0",
                borderBottom: i < 2 ? "1px solid var(--border-soft)" : 0,
                display: "flex", alignItems: "center", gap: 12,
              }}>
                <CompanyAvatar name={m.name} />
                <div style={{ flex: 1 }}>
                  <p style={{ fontFamily: "var(--font-mono)", fontSize: "13px", color: "var(--fg-1)", margin: 0 }}>{m.name}</p>
                  <p style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--fg-4)", margin: "2px 0 0" }}>{m.email}</p>
                </div>
                <Badge variant={m.badge}>{m.role}</Badge>
                <Button size="sm" variant="ghost">Remove</Button>
              </div>
            ))}
            <div style={{ marginTop: 14 }}>
              <Button variant="tinted" iconStart="plus">Invite teammate</Button>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}

function NotifRow({ label, hint, checked, onChange }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
      <Toggle checked={checked} onChange={onChange} />
      <div style={{ flex: 1 }}>
        <p style={{ fontFamily: "var(--font-mono)", fontSize: "13px", color: "var(--fg-2)", margin: 0 }}>{label}</p>
        <p style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--fg-4)", margin: "2px 0 0" }}>{hint}</p>
      </div>
    </div>
  );
}

Object.assign(window, { SettingsScreen });
