import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getOrgOwnerGoogleToken } from "@/lib/tenant";
import { Button, Card, CardBody } from "@/components/ui";

type Step = {
  title: string;
  detail: string;
  done: boolean;
  href: string;
  cta: string;
};

export default async function OnboardingPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const orgId = session.orgId;
  if (!orgId) redirect("/login");

  const [settings, ownerToken, campaignCount, leadCount, sentCount] = await Promise.all([
    db.settings.findUnique({
      where: { orgId },
      select: { fromEmail: true, resendApiKey: true, signatureText: true, signatureHtml: true, googleRefreshToken: true },
    }),
    getOrgOwnerGoogleToken(orgId),
    db.campaign.count({ where: { orgId, deletedAt: null } }),
    db.lead.count({ where: { orgId, deletedAt: null } }),
    db.message.count({ where: { direction: "outbound", lead: { orgId } } }),
  ]);

  const steps: Step[] = [
    {
      title: "Connect Google",
      detail: "Powers calendar booking when leads want to meet.",
      done: !!(ownerToken?.refreshToken || settings?.googleRefreshToken),
      href: "/settings?tab=connection",
      cta: "Connect",
    },
    {
      title: "Configure sending",
      detail: "Your from-address and Resend API key — how emails go out.",
      done: !!(settings?.fromEmail && settings?.resendApiKey),
      href: "/settings?tab=keys",
      cta: "Set up",
    },
    {
      title: "Add your signature",
      detail: "Appended to every outbound email — who the message is from.",
      done: !!(settings?.signatureText || settings?.signatureHtml),
      href: "/settings?tab=outreach",
      cta: "Write it",
    },
    {
      title: "Create your first campaign",
      detail: "Pick a business type, country, and your offers.",
      done: campaignCount > 0,
      href: "/campaigns/new",
      cta: "Create",
    },
    {
      title: "Scout leads",
      detail: "The wizard finds and enriches businesses live as you watch.",
      done: leadCount > 0,
      href: campaignCount > 0 ? "/campaigns" : "/campaigns/new",
      cta: "Scout",
    },
    {
      title: "Approve your first sends",
      detail: "Review drafted openers and send — replies land in your Inbox.",
      done: sentCount > 0,
      href: "/leads",
      cta: "Review & send",
    },
  ];

  const doneCount = steps.filter((s) => s.done).length;
  const next = steps.find((s) => !s.done);

  return (
    <div className="max-w-[640px] mx-auto flex flex-col gap-5 py-4">
      <div>
        <h1 className="ds-h1 m-0 mb-1.5">Welcome to LeadsWave</h1>
        <p className="font-mono text-[12px] text-fg-4 m-0">
          {doneCount === steps.length
            ? "You're fully set up — the autopilot is ready."
            : `Six steps to your first reply · ${doneCount}/${steps.length} done`}
        </p>
      </div>

      <div className="h-[3px] rounded-full bg-[oklch(0.18_0_0)] overflow-hidden">
        <div
          className="h-full rounded-full bg-amber transition-all"
          style={{ width: `${(doneCount / steps.length) * 100}%` }}
        />
      </div>

      <Card>
        <CardBody className="flex flex-col gap-0 p-0">
          {steps.map((s, i) => (
            <div
              key={s.title}
              className={`flex items-center gap-4 px-5 py-4 ${i < steps.length - 1 ? "border-b border-border-soft" : ""}`}
            >
              <span
                className={`w-6 h-6 rounded-full border flex items-center justify-center font-mono text-[11px] shrink-0 ${
                  s.done
                    ? "bg-success-bg border-success-border text-success"
                    : s === next
                    ? "border-amber text-amber"
                    : "border-border text-fg-5"
                }`}
              >
                {s.done ? "✓" : i + 1}
              </span>
              <div className="flex-1 min-w-0">
                <p className={`font-mono text-[13px] m-0 ${s.done ? "text-fg-4 line-through" : "text-fg-1"}`}>
                  {s.title}
                </p>
                <p className="font-mono text-[11px] text-fg-5 m-0 mt-0.5">{s.detail}</p>
              </div>
              {!s.done && (
                <Link href={s.href}>
                  <Button variant={s === next ? "primary" : "ghost"} size="sm">
                    {s.cta} →
                  </Button>
                </Link>
              )}
            </div>
          ))}
        </CardBody>
      </Card>

      {doneCount === steps.length && (
        <Link href="/">
          <Button size="lg" fullWidth>Go to dashboard →</Button>
        </Link>
      )}
    </div>
  );
}
