import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { db } from "@/lib/db";
import { encryptSecret } from "@/lib/crypto";

/**
 * Ensure a User + Organization + owner Membership exist for this identity.
 * Keyed by EMAIL — NextAuth's JWT token.sub is not stable across logins here
 * (it minted a new UUID per login under the old setup), while the Google
 * account email is. googleSub (account.providerAccountId) is stored when
 * available as the stable provider id.
 */
async function ensureUserAndOrg(params: {
  email: string;
  name?: string | null;
  image?: string | null;
  googleSub?: string;
  refreshToken?: string;
}) {
  const { email, name, image, googleSub, refreshToken } = params;
  const storedToken = refreshToken ? encryptSecret(refreshToken) : undefined;

  const user = await db.user.upsert({
    where: { email: email.toLowerCase() },
    update: {
      ...(name ? { name } : {}),
      ...(image ? { image } : {}),
      ...(googleSub ? { googleSub } : {}),
      ...(storedToken ? { googleRefreshToken: storedToken } : {}),
    },
    create: {
      email: email.toLowerCase(),
      name: name ?? null,
      image: image ?? null,
      googleSub: googleSub ?? null,
      googleRefreshToken: storedToken ?? null,
    },
  });

  // Prefer the org the user explicitly joined/switched to; else oldest membership.
  let membership =
    (user.defaultOrgId
      ? await db.membership.findFirst({ where: { userId: user.id, orgId: user.defaultOrgId } })
      : null) ??
    (await db.membership.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: "asc" },
    }));

  if (!membership) {
    // A pending invite beats auto-provisioning a personal org: the invitee
    // lands directly in the org that invited them.
    const invite = await db.invite.findFirst({
      where: { email: email.toLowerCase(), acceptedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: "desc" },
    });

    if (invite) {
      membership = await db.$transaction(async (tx) => {
        const m = await tx.membership.create({
          data: { userId: user.id, orgId: invite.orgId, role: invite.role },
        });
        await tx.invite.update({ where: { id: invite.id }, data: { acceptedAt: new Date() } });
        await tx.user.update({ where: { id: user.id }, data: { defaultOrgId: invite.orgId } });
        return m;
      });
    } else {
      membership = await db.$transaction(async (tx) => {
        const org = await tx.organization.create({
          data: { name: name ? `${name}'s Org` : "My Org" },
        });
        const m = await tx.membership.create({
          data: { userId: user.id, orgId: org.id, role: "owner" },
        });
        await tx.settings.create({
          data: { orgId: org.id, userId: user.id },
        });
        return m;
      });
    }
  }

  return { user, membership };
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET,
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      authorization: {
        params: {
          access_type: "offline",
          prompt: "consent",
          scope: [
            "openid",
            "email",
            "profile",
            "https://www.googleapis.com/auth/calendar.events",
            "https://www.googleapis.com/auth/calendar.readonly",
          ].join(" "),
        },
      },
    }),
  ],
  callbacks: {
    async jwt({ token, account, profile }) {
      if (account) {
        token.accessToken = account.access_token;
        token.refreshToken = account.refresh_token;
        token.accessTokenExpires = account.expires_at ? account.expires_at * 1000 : 0;

        const email = (profile?.email ?? token.email) as string | undefined;
        if (email) {
          try {
            const { user, membership } = await ensureUserAndOrg({
              email,
              name: (profile?.name ?? token.name) as string | null,
              image: (profile?.picture ?? token.picture) as string | null,
              googleSub: account.providerAccountId,
              refreshToken: account.refresh_token ?? undefined,
            });
            token.userId = user.id;
            token.orgId = membership.orgId;
            token.role = membership.role;
          } catch (e) {
            console.error("[auth] Failed to provision user/org:", e);
          }
        }
      }

      // Self-heal: tokens minted before multi-tenancy (or a failed provision
      // above) lack orgId. Hydrate from the DB by email so live sessions keep
      // working across the tenancy deploy without a forced re-login.
      if (!token.orgId && token.email) {
        try {
          const user = await db.user.findUnique({
            where: { email: token.email.toLowerCase() },
            include: { memberships: { orderBy: { createdAt: "asc" } } },
          });
          const membership =
            user?.memberships.find((m) => m.orgId === user.defaultOrgId) ?? user?.memberships[0];
          if (user && membership) {
            token.userId = user.id;
            token.orgId = membership.orgId;
            token.role = membership.role;
          }
        } catch (e) {
          console.error("[auth] Self-heal lookup failed:", e);
        }
      }

      return token;
    },
    async session({ session, token }) {
      session.user.id = token.userId ?? token.sub!;
      session.orgId = token.orgId ?? "";
      session.role = token.role ?? "";
      session.accessToken = token.accessToken as string;
      session.refreshToken = token.refreshToken as string;
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
});
