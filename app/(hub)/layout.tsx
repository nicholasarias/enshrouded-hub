import type { ReactNode } from "react";
import Providers from "./providers";
import AuthButton from "../components/AuthButton";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function HubLayout({ children }: { children: ReactNode }) {
  return (
    <Providers>
          <div className="min-h-screen">{children}</div>

    </Providers>
  );
}
