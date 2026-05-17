import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { db } from "@/lib/db";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
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
    async jwt({ token, account }) {
      if (account) {
        token.accessToken = account.access_token;
        token.refreshToken = account.refresh_token;
        token.accessTokenExpires = account.expires_at ? account.expires_at * 1000 : 0;

        // Persist refresh token to Settings so the inbox agent can use it without a session
        if (account.refresh_token) {
          try {
            // Update all existing settings rows first (single-tenant app)
            const updated = await db.settings.updateMany({
              data: { googleRefreshToken: account.refresh_token },
            });
            // If no rows exist yet, create one with the Google user ID
            if (updated.count === 0 && token.sub) {
              await db.settings.create({
                data: { userId: token.sub, googleRefreshToken: account.refresh_token },
              });
            }
            console.log("[auth] Stored Google refresh token, updated rows:", updated.count);
          } catch (e) {
            console.error("[auth] Failed to store refresh token:", e);
          }
        }
      }
      return token;
    },
    async session({ session, token }) {
      session.user.id = token.sub!;
      session.accessToken = token.accessToken as string;
      session.refreshToken = token.refreshToken as string;
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
});
