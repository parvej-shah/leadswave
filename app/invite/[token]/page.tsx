import { auth, signIn } from "@/lib/auth";
import { db } from "@/lib/db";
import { AcceptInvite } from "./accept-invite";

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const session = await auth();

  const invite = await db.invite.findUnique({
    where: { token },
    include: { org: { select: { name: true } } },
  });

  const invalid = !invite || !!invite.acceptedAt || invite.expiresAt < new Date();

  return (
    <div className="min-h-screen flex items-center justify-center bg-sidebar">
      <div className="w-full max-w-[420px] px-4">
        <div className="bg-[oklch(0.15_0_0)] border border-[oklch(1_0_0/8%)] rounded-xl p-6 text-center">
          {invalid ? (
            <>
              <h1 className="ds-serif-welcome m-0 mb-2" style={{ fontSize: 24 }}>
                Invite unavailable
              </h1>
              <p className="font-mono text-[13px] text-fg-4 m-0">
                This invite link is invalid, expired, or already used. Ask your team admin
                for a new one.
              </p>
            </>
          ) : (
            <>
              <h1 className="ds-serif-welcome m-0 mb-2" style={{ fontSize: 24 }}>
                Join {invite.org.name}
              </h1>
              <p className="font-mono text-[13px] text-fg-4 m-0 mb-5">
                You&apos;ve been invited as <b>{invite.role}</b> ({invite.email}).
              </p>
              {session?.user ? (
                <AcceptInvite token={token} sessionEmail={session.user.email ?? ""} inviteEmail={invite.email} />
              ) : (
                <form
                  action={async () => {
                    "use server";
                    await signIn("google", { redirectTo: `/invite/${token}` });
                  }}
                >
                  <button
                    type="submit"
                    className="w-full rounded-lg bg-amber text-black font-mono text-[13px] font-semibold py-2.5 cursor-pointer border-0"
                  >
                    Sign in with Google to accept →
                  </button>
                </form>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
