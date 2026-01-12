"use client";

import { signIn, signOut, useSession } from "next-auth/react";

export default function AuthButton() {
  const { data, status } = useSession();

  if (status === "loading") {
    return (
      <button className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-300">
        Checking…
      </button>
    );
  }

  const discordName =
    (data as any)?.discordGlobalName ||
    (data as any)?.discordUsername ||
    null;

  if (!data) {
    return (
      <button
        onClick={() => signIn("discord")}
        className="rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-3 py-2 text-sm font-semibold text-emerald-100 hover:border-emerald-400/30"
      >
        Link Discord
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-200">
        {discordName ? `Linked: ${discordName}` : "Linked"}
      </span>
      <button
        onClick={() => signOut()}
        className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-300 hover:border-white/20"
      >
        Sign out
      </button>
    </div>
  );
}
