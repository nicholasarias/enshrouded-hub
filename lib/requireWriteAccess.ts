import { requireOfficer } from "@/lib/requireOfficer";

type GateOk = { ok: true };
type GateFail = { ok: false; status: number; error: string };
type GateResult = GateOk | GateFail;

export async function requireWriteAccess(req: Request): Promise<GateResult> {
  const apiKey = req.headers.get("x-api-key") || req.headers.get("X-API-Key");

  const hasConfiguredApiKey = !!process.env.SESSIONS_API_KEY;
  const validApiKey =
    hasConfiguredApiKey && !!apiKey && apiKey === process.env.SESSIONS_API_KEY;

  if (validApiKey) return { ok: true };

  const gate = await requireOfficer();
  if (!gate.ok) return gate;

  return { ok: true };
}
