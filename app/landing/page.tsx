export const dynamic = "force-dynamic";
export const revalidate = 0;

import LandingIntro from "./landing-intro";

type SearchParamsInput = Record<string, string | string[] | undefined>;

function firstParam(v: string | string[] | undefined) {
  return Array.isArray(v) ? v[0] : v;
}

export default async function LandingPage(props: {
  searchParams?: SearchParamsInput | Promise<SearchParamsInput>;
}) {
  // Next can pass searchParams as a Promise in newer versions
  let sp: SearchParamsInput = {};
  const spRaw = props.searchParams as any;

  if (spRaw && typeof spRaw.then === "function") {
    sp = (await spRaw) as SearchParamsInput;
  } else {
    sp = (spRaw || {}) as SearchParamsInput;
  }

  const guildId = String(firstParam(sp.guildId) || "").trim();

  return <LandingIntro guildId={guildId} />;
}
