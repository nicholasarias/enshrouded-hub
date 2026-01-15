import NextAuth from "next-auth";
import Discord from "next-auth/providers/discord";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

function isSnowflake(id: string) {
  return /^\d{10,25}$/.test(String(id || "").trim());
}

export const { handlers, auth } = NextAuth({
  // Always keep both supported. Env is handled in Vercel.
  secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET,

  trustHost: true,
  session: { strategy: "jwt" },

  // Force auth to stay on one canonical origin.
  // This prevents PKCE cookies being set on a preview host then read on prod (or vice versa).
  callbacks: {
    async redirect({ url, baseUrl }) {
      const canonical =
        String(process.env.NEXTAUTH_URL || process.env.AUTH_URL || baseUrl || "").trim().replace(/\/+$/, "");

      if (!canonical) return url;

      // Relative paths always go to canonical
      if (url.startsWith("/")) return `${canonical}${url}`;

      // Absolute URLs: force same origin
      try {
        const target = new URL(url);
        const canon = new URL(canonical);
        target.protocol = canon.protocol;
        target.host = canon.host;
        return target.toString();
      } catch {
        return canonical;
      }
    },

    async jwt({ token, account, profile }) {
      // First sign in with Discord profile present
      if (account?.provider === "discord" && profile) {
        const discordUserId = String((profile as any).id || "").trim();

        (token as any).discordUserId = isSnowflake(discordUserId) ? discordUserId : null;
        (token as any).discordUsername = (profile as any).username || null;
        (token as any).discordGlobalName = (profile as any).global_name || null;
        (token as any).discordAvatar = (profile as any).avatar || null;

        // Discord only returns email if scope includes email and user has one
        token.email = (profile as any).email || token.email || null;

        // Keep the JWT subject stable when we can
        if (isSnowflake(discordUserId)) token.sub = discordUserId;
      }

      return token;
    },

    async session({ session, token }) {
      const discordUserId = String((token as any).discordUserId || "").trim();
      const discordUsername = (token as any).discordUsername || null;
      const discordGlobalName = (token as any).discordGlobalName || null;
      const discordAvatar = (token as any).discordAvatar || null;

      (session as any).discordUserId = isSnowflake(discordUserId) ? discordUserId : null;
      (session as any).discordUsername = discordUsername;
      (session as any).discordGlobalName = discordGlobalName;
      (session as any).discordAvatar = discordAvatar;

      session.user = session.user || ({} as any);

      (session.user as any).discord_user_id = isSnowflake(discordUserId) ? discordUserId : null;
      (session.user as any).discordUserId = isSnowflake(discordUserId) ? discordUserId : null;
      (session.user as any).discordUsername = discordUsername;
      (session.user as any).discordGlobalName = discordGlobalName;
      (session.user as any).discordAvatar = discordAvatar;

      if (!session.user.name) {
        session.user.name = discordGlobalName || discordUsername || session.user.name || null;
      }

      return session;
    },

    async signIn({ account, profile }) {
      try {
        if (account?.provider !== "discord" || !profile) return true;

        const discordUserId = String((profile as any).id || "").trim();
        if (!isSnowflake(discordUserId)) return false;

        const payload = {
          discord_user_id: discordUserId,
          discord_username: (profile as any).username || null,
          discord_global_name: (profile as any).global_name || null,
          discord_avatar: (profile as any).avatar || null,
          email: (profile as any).email || null,
          updated_at: new Date().toISOString(),
        };

        const upsert = await supabaseAdmin
          .from("profiles")
          .upsert(payload, { onConflict: "discord_user_id" })
          .select("id")
          .single();

        if (upsert.error) {
          console.error("profiles upsert error", upsert.error);
          return false;
        }

        // Optional: auto link the user to the configured guild
        const guildId = String(process.env.NEXT_PUBLIC_DISCORD_GUILD_ID || "").trim();
        if (isSnowflake(guildId)) {
          const g = await supabaseAdmin
            .from("user_guilds")
            .upsert(
              { user_id: upsert.data.id, guild_id: guildId, joined_at: new Date().toISOString() },
              { onConflict: "user_id,guild_id" }
            );

          if (g.error) console.error("user_guilds upsert error", g.error);
        }

        return true;
      } catch (e) {
        console.error("signIn callback error", e);
        return false;
      }
    },
  },

  providers: [
    Discord({
      clientId: process.env.DISCORD_CLIENT_ID!,
      clientSecret: process.env.DISCORD_CLIENT_SECRET!,
      authorization: { params: { scope: "identify email" } },
    }),
  ],
});
