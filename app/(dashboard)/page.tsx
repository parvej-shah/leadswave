import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const [totalLeads, totalEmailsSent, meetingsBooked, totalReplies, campaigns] = await Promise.all([
    db.lead.count({ where: { deletedAt: null } }),
    db.message.count({ where: { direction: "outbound" } }),
    db.lead.count({ where: { state: "meeting_booked" } }),
    db.message.count({ where: { direction: "inbound" } }),
    db.campaign.findMany({
      where: { deletedAt: null },
      include: { leads: { include: { messages: true } } },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const hotLeads = await db.lead.count({ where: { state: "replied" } });
  const replyRate = totalEmailsSent > 0 ? ((totalReplies / totalEmailsSent) * 100).toFixed(1) : "0.0";

  const campaignStats = campaigns.map((c) => {
    let sent = 0, replies = 0, hot = 0, meetings = 0;
    c.leads.forEach((l) => {
      sent += l.messages.filter((m) => m.direction === "outbound").length;
      replies += l.messages.filter((m) => m.direction === "inbound").length;
      if (l.state === "replied") hot++;
      if (l.state === "meeting_booked") meetings++;
    });
    return { id: c.id, name: c.name, sent, replies, hot, meetings };
  });

  const recentActivity = campaigns
    .flatMap((c) => c.leads.map((l) => ({ ...l, campaignName: c.name })))
    .filter((l) => ["replied", "meeting_booked", "contacted"].includes(l.state))
    .sort((a, b) => (b.lastTouchedAt?.getTime() ?? 0) - (a.lastTouchedAt?.getTime() ?? 0))
    .slice(0, 5);

  const kpis = [
    { label: "Total Leads", value: totalLeads, color: "oklch(0.78 0.18 65)" },
    { label: "Emails Sent", value: totalEmailsSent, color: "oklch(0.78 0.18 65)" },
    { label: "Reply Rate", value: replyRate + "%", color: "oklch(0.72 0.18 145)" },
    { label: "Hot Leads", value: hotLeads, color: "oklch(0.70 0.20 25)" },
    { label: "Meetings", value: meetingsBooked, color: "oklch(0.65 0.18 260)" },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold" style={{ color: "oklch(0.92 0 0)", letterSpacing: "-0.02em" }}>
        Dashboard
      </h1>

      {/* KPI Cards */}
      <div className="grid grid-cols-5 gap-3">
        {kpis.map((k) => (
          <div
            key={k.label}
            className="rounded-xl p-4"
            style={{ background: "oklch(0.14 0 0)", border: "1px solid oklch(1 0 0 / 7%)" }}
          >
            <p className="text-xs font-mono mb-2" style={{ color: "oklch(0.45 0 0)" }}>{k.label}</p>
            <p className="text-2xl font-semibold" style={{ color: k.color }}>{k.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-4">
        {/* Campaign table */}
        <div
          className="col-span-4 rounded-xl"
          style={{ background: "oklch(0.14 0 0)", border: "1px solid oklch(1 0 0 / 7%)" }}
        >
          <div className="px-5 py-3 border-b" style={{ borderColor: "oklch(1 0 0 / 7%)" }}>
            <p className="text-sm font-semibold" style={{ color: "oklch(0.80 0 0)" }}>Campaign Health</p>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: "1px solid oklch(1 0 0 / 7%)" }}>
                {["Campaign", "Sent", "Replies", "Hot", "Meetings"].map((h) => (
                  <th key={h} className="px-5 py-2.5 text-left font-mono text-xs" style={{ color: "oklch(0.40 0 0)" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {campaignStats.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center font-mono text-xs" style={{ color: "oklch(0.35 0 0)" }}>
                    No campaigns yet.
                  </td>
                </tr>
              ) : (
                campaignStats.map((c) => (
                  <tr key={c.id} style={{ borderBottom: "1px solid oklch(1 0 0 / 4%)" }}>
                    <td className="px-5 py-3 font-medium" style={{ color: "oklch(0.82 0 0)" }}>{c.name}</td>
                    <td className="px-5 py-3 font-mono" style={{ color: "oklch(0.55 0 0)" }}>{c.sent}</td>
                    <td className="px-5 py-3 font-mono" style={{ color: "oklch(0.55 0 0)" }}>{c.replies}</td>
                    <td className="px-5 py-3">
                      {c.hot > 0 ? (
                        <span className="px-2 py-0.5 rounded text-xs font-mono" style={{ background: "oklch(0.70 0.20 25 / 15%)", color: "oklch(0.70 0.20 25)" }}>
                          {c.hot}
                        </span>
                      ) : <span style={{ color: "oklch(0.35 0 0)" }}>—</span>}
                    </td>
                    <td className="px-5 py-3">
                      {c.meetings > 0 ? (
                        <span className="px-2 py-0.5 rounded text-xs font-mono" style={{ background: "oklch(0.65 0.18 260 / 15%)", color: "oklch(0.65 0.18 260)" }}>
                          {c.meetings}
                        </span>
                      ) : <span style={{ color: "oklch(0.35 0 0)" }}>—</span>}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Recent Activity */}
        <div
          className="col-span-3 rounded-xl"
          style={{ background: "oklch(0.14 0 0)", border: "1px solid oklch(1 0 0 / 7%)" }}
        >
          <div className="px-5 py-3 border-b" style={{ borderColor: "oklch(1 0 0 / 7%)" }}>
            <p className="text-sm font-semibold" style={{ color: "oklch(0.80 0 0)" }}>Recent Activity</p>
          </div>
          <div className="p-4 space-y-3">
            {recentActivity.length === 0 ? (
              <p className="text-xs font-mono text-center py-6" style={{ color: "oklch(0.35 0 0)" }}>No activity yet.</p>
            ) : (
              recentActivity.map((lead) => (
                <div key={lead.id} className="flex items-start gap-3">
                  <span className="text-base mt-0.5">
                    {lead.state === "replied" ? "🔥" : lead.state === "meeting_booked" ? "📅" : "✉️"}
                  </span>
                  <div>
                    <p className="text-sm" style={{ color: "oklch(0.75 0 0)" }}>
                      {lead.state === "replied" && `Hot reply from ${lead.companyName}`}
                      {lead.state === "meeting_booked" && `Meeting booked with ${lead.companyName}`}
                      {lead.state === "contacted" && `Emailed ${lead.companyName}`}
                    </p>
                    <p className="text-xs font-mono" style={{ color: "oklch(0.38 0 0)" }}>
                      {lead.lastTouchedAt ? new Date(lead.lastTouchedAt).toLocaleDateString() : ""}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
