import type { ReactNode } from "react";
import Providers from "./providers";
import AuthButton from "../components/AuthButton";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function HubLayout({ children }: { children: ReactNode }) {
  return (
    <Providers>
      <div className="min-h-screen">
        <header className="flex items-center justify-between px-4 py-3">
          <div className="text-sm font-semibold text-zinc-200">
            Enshrouded Hub
          </div>
          <AuthButton />
        </header>

        <main className="px-4 py-4">{children}</main>
      </div>
    </Providers>
  );
}
