import { db } from "@/lib/db";
import { verifyUnsubscribeToken } from "@/lib/email/unsubscribe";
import { CheckCircle2, AlertCircle } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function UnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 px-4 text-slate-100 font-sans">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center shadow-xl">
          <AlertCircle className="w-12 h-12 text-amber-400 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-white mb-2">Invalid Link</h1>
          <p className="text-sm text-slate-400">
            This unsubscribe link appears to be incomplete or invalid. Please check the email you received.
          </p>
        </div>
      </div>
    );
  }

  const payload = verifyUnsubscribeToken(token);

  if (!payload) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 px-4 text-slate-100 font-sans">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center shadow-xl">
          <AlertCircle className="w-12 h-12 text-rose-400 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-white mb-2">Expired Link</h1>
          <p className="text-sm text-slate-400">
            This unsubscribe link has expired or is no longer valid.
          </p>
        </div>
      </div>
    );
  }

  const normalizedEmail = payload.email.toLowerCase().trim();

  // Process unsubscribe automatically upon visiting
  await db.suppression.upsert({
    where: {
      orgId_email: {
        orgId: payload.orgId,
        email: normalizedEmail,
      },
    },
    create: {
      orgId: payload.orgId,
      email: normalizedEmail,
      reason: "unsubscribed",
    },
    update: {
      reason: "unsubscribed",
    },
  });

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 px-4 text-slate-100 font-sans">
      <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center shadow-2xl">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-500/10 text-emerald-400 mb-6 ring-1 ring-emerald-500/20">
          <CheckCircle2 className="w-8 h-8" />
        </div>
        <h1 className="text-2xl font-bold text-white mb-3">You're Unsubscribed</h1>
        <p className="text-sm text-slate-300 mb-6 leading-relaxed">
          <span className="font-medium text-white">{normalizedEmail}</span> has been removed from all future email outreach from this sender.
        </p>
        <div className="text-xs text-slate-500 border-t border-slate-800/80 pt-6">
          If this was done in error or if you have questions, please reach out to hello@withminions.com.
        </div>
      </div>
    </div>
  );
}
