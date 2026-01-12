import NextAuth from "next-auth";
import Discord from "next-auth/providers/discord";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const { handlers, auth } = NextAuth({
  secret: process.env.NEXTAUTH_SECRET,
  session: { strategy: "jwt" },

  providers: [
    Discord({
      clientId: process.env.DISCORD_CLIENT_ID!,
      clientSecret: process.env.DISCORD_CLIENT_SECRET!,
      authorization: { params: { scope: "identify email" } },
    }),
  ],

  callbacks: {
    async jwt({ token, account, profile }) {
      if (account?.provider === "discord" && profile) {
        token.discordUserId = String((profile as any).id || "");
        token.discordUsername = (profile as any).username || null;
        token.discordGlobalName = (profile as any).global_name || null;
        token.discordAvatar = (profile as any).avatar || null;
        token.email = (profile as any).email || token.email || null;
      }
      return token;
    },

    async session({ session, token }) {
      (session as any).discordUserId = (token as any).discordUserId || null;
      (session as any).discordUsername = (token as any).discordUsername || null;
      (session as any).discordGlobalName = (token as any).discordGlobalName || null;
      (session as any).discordAvatar = (token as any).discordAvatar || null;
      return session;
    },

    async signIn({ account, profile }) {
      try {
        if (account?.provider !== "discord" || !profile) return true;

        const discordUserId = String((profile as any).id || "");
        if (!discordUserId) return false;

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

        const guildId = process.env.NEXT_PUBLIC_DISCORD_GUILD_ID || "";
        if (guildId) {
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
});
