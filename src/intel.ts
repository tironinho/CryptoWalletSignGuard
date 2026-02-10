export type ThreatIntel = {
  updatedAt: number;
  sources: Array<{ id: string; url: string; ok: boolean; fetchedAt: number; error?: string }>;
  trustedDomainsSeed: string[];
  blockedDomains: string[];
};

export const METAMASK_HOSTS_TXT =
  "https://raw.githubusercontent.com/MetaMask/eth-phishing-detect/main/src/hosts.txt";

export const TRUSTED_SEED: string[] = [
  "opensea.io",
  "blur.io",
  "looksrare.org",
  "rarible.com",
  "magiceden.io",
  "app.uniswap.org",
  "uniswap.org",
  "1inch.io",
  "matcha.xyz",
  "cow.fi",
  "curve.fi",
  "balancer.fi",
  "aave.com",
  "compound.finance",
  "makerdao.com",
  "lido.fi",
  "etherscan.io",
  "polygonscan.com",
  "arbiscan.io",
  "optimistic.etherscan.io",
  "metamask.io",
  "walletconnect.com",
  "rabby.io",
  "ledger.com",
  "trezor.io",
  "coinbase.com",
  "binance.com",
  "kraken.com",
  "okx.com"
].map((x) => x.toLowerCase());

export function normalizeHost(host: string): string {
  return String(host || "").trim().toLowerCase().replace(/\.$/, "");
}

export function hostMatches(host: string, domain: string): boolean {
  const h = normalizeHost(host);
  const d = normalizeHost(domain);
  return h === d || h.endsWith("." + d);
}

export function parseHostsTxt(txt: string): string[] {
  return txt
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => !!l && !l.startsWith("#"))
    .map((l) => normalizeHost(l));
}

export async function fetchThreatIntel(): Promise<ThreatIntel> {
  const now = Date.now();
  const sources: ThreatIntel["sources"] = [];
  let blocked: string[] = [];
  try {
    const res = await fetch(METAMASK_HOSTS_TXT, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    blocked = parseHostsTxt(await res.text());
    sources.push({ id: "metamask-eth-phishing-detect", url: METAMASK_HOSTS_TXT, ok: true, fetchedAt: now });
  } catch (e: any) {
    sources.push({ id: "metamask-eth-phishing-detect", url: METAMASK_HOSTS_TXT, ok: false, fetchedAt: now, error: String(e?.message ?? e) });
  }

  return {
    updatedAt: now,
    sources,
    trustedDomainsSeed: TRUSTED_SEED,
    blockedDomains: blocked
  };
}

