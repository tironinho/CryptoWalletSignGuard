import { hostFromUrl } from "./utils";

export function domainHeuristics(host: string): { level: "LOW" | "WARN"; reasons: string[] } {
  const h = (host || "").toLowerCase();
  const reasons: string[] = [];
  if (!h) return { level: "LOW", reasons };

  if (h.startsWith("xn--") || h.includes(".xn--")) reasons.push("Punycode domain (possible lookalike).");
  if (h.includes("--")) reasons.push("Double-dash in hostname (often used in lookalikes).");
  if (/\d{2,}/.test(h)) reasons.push("Hostname contains unusual number patterns.");

  const suspects = [
    { legit: "uniswap.org", typos: ["uniswa", "un1swap", "unlswap", "uniswap-app"] },
    { legit: "opensea.io", typos: ["opensea-", "open-sea", "0pensea"] },
  ];
  for (const s of suspects) {
    if (s.typos.some((t) => h.includes(t))) reasons.push(`Possible lookalike of ${s.legit}.`);
  }

  return { level: reasons.length ? "WARN" : "LOW", reasons };
}

export function hostFromAnalyzeUrl(url: string) {
  return hostFromUrl(url);
}

