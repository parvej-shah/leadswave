// Campaign New / Detail — form with AI-generated description + scouted preview.
function CampaignNewScreen({ onNavigate }) {
  const [form, setForm] = React.useState({
    name: "", query: "", location: "", keywords: "", offer: "",
  });
  const [status, setStatus] = React.useState("idle"); // idle | scouting | done
  const [savedCount, setSavedCount] = React.useState(0);

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  function aiWrite() {
    setForm(f => ({
      ...f,
      offer: `We help boutique law firms launch AI-led cold outreach without hiring an SDR. Setup in 1 day, replies routed to your inbox, meetings booked into Google Calendar. Pricing starts at $49/mo per seat.`,
    }));
  }

  function launch() {
    setStatus("scouting");
    setTimeout(() => { setSavedCount(5); setStatus("done"); }, 1400);
  }

  if (status === "done") {
    return (
      <div style={{ maxWidth: 560 }}>
        <Card>
          <div style={{ textAlign: "center", padding: "20px 0" }}>
            <p style={{ fontFamily: "var(--font-sans)", fontSize: "36px", fontWeight: 600, letterSpacing: "-0.02em", color: "var(--amber)", margin: "0 0 6px", fontVariantNumeric: "tabular-nums" }}>{savedCount}</p>
            <p style={{ fontFamily: "var(--font-mono)", fontSize: "13px", color: "var(--fg-3)", margin: 0 }}>leads discovered</p>
            <p style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--fg-5)", margin: "16px 0 0" }}>redirecting to campaigns…</p>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 420px)", gap: "24px", alignItems: "flex-start" }}>
      <div style={{ maxWidth: 560 }}>
        <div style={{ marginBottom: 24 }}>
          <a onClick={() => onNavigate("campaigns")} style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-4)", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6, marginBottom: 12 }}>
            ← Campaigns
          </a>
          <h1 style={{ fontFamily: "var(--font-sans)", fontWeight: 600, fontSize: "24px", letterSpacing: "-0.02em", color: "var(--fg-1)", margin: "0 0 4px" }}>New Campaign</h1>
          <p style={{ fontFamily: "var(--font-mono)", fontSize: "12px", color: "var(--fg-4)", margin: 0 }}>
            Scout finds companies matching your query and saves them as leads.
          </p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          <Input label="Campaign Name" placeholder="e.g. BD law firms Q2" value={form.name} onChange={set("name")} />
          <Input label="Search Query" placeholder='e.g. "digital marketing agencies"' hint="What kind of business are you targeting?" value={form.query} onChange={set("query")} />
          <Input label="Location" placeholder='e.g. "New York, NY"' value={form.location} onChange={set("location")} />

          <div>
            <Label>Offer Description</Label>
            <div style={{ display: "flex", gap: "8px", marginBottom: "10px" }}>
              <div style={{ flex: 1 }}>
                <Input placeholder="Keywords for AI (e.g. MVP, SaaS founders, rapid launch)" value={form.keywords} onChange={set("keywords")} />
              </div>
              <Button variant="secondary" iconStart="sparkle" onClick={aiWrite}>AI Write</Button>
            </div>
            <Textarea rows={5} placeholder="What are you offering? AI will personalize this per lead." value={form.offer} onChange={set("offer")} hint="Pre-filled from Settings — edit per campaign if needed." />
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 8 }}>
            <Button variant="ghost" onClick={() => onNavigate("campaigns")}>Cancel</Button>
            <Button size="lg" onClick={launch} disabled={status === "scouting"} iconStart={status === "scouting" ? "refresh" : "play"}>
              {status === "scouting" ? "scouting leads… (~30s)" : "Launch Campaign"}
            </Button>
          </div>
        </div>
      </div>

      <Card title="Preview · 5 scouted leads" padded={false}
        action={<Badge variant="warm">DRY RUN</Badge>}>
        <div>
          {LW.scoutedLeadsPreview.map((l, i) => (
            <div key={i} style={{
              padding: "12px 20px",
              borderBottom: i < LW.scoutedLeadsPreview.length - 1 ? "1px solid var(--border-soft)" : 0,
              display: "flex", flexDirection: "column", gap: "3px",
            }}>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: "13px", color: "var(--fg-2)" }}>{l.company}</span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--fg-4)" }}>{l.website} · {l.contact}</span>
            </div>
          ))}
          <div style={{ padding: "12px 20px", borderTop: "1px solid var(--border)" }}>
            <p style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--fg-4)", margin: 0, lineHeight: 1.55 }}>
              These are a sample. The full scout will discover up to <span style={{ color: "var(--amber)" }}>200 leads</span> matching your query, deduped against your existing campaigns.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}

Object.assign(window, { CampaignNewScreen });
