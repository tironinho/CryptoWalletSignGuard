import type { ThreatIntel } from "./shared/types";

export const TRUSTED_DOMAINS_SEED: Array<{ domain: string; label: string; category: string }> = [
  { domain: "opensea.io", label: "OpenSea", category: "NFT Marketplace" },
  { domain: "blur.io", label: "Blur", category: "NFT Marketplace" },
  { domain: "looksrare.org", label: "LooksRare", category: "NFT Marketplace" },
  { domain: "rarible.com", label: "Rarible", category: "NFT Marketplace" },
  { domain: "magiceden.io", label: "Magic Eden", category: "NFT Marketplace" },

  { domain: "app.uniswap.org", label: "Uniswap App", category: "DEX" },
  { domain: "uniswap.org", label: "Uniswap", category: "DEX" },
  { domain: "1inch.io", label: "1inch", category: "DEX Aggregator" },
  { domain: "matcha.xyz", label: "Matcha", category: "DEX Aggregator" },
  { domain: "cow.fi", label: "CoW Swap", category: "DEX" },
  { domain: "curve.fi", label: "Curve", category: "DEX" },
  { domain: "balancer.fi", label: "Balancer", category: "DEX" },

  { domain: "aave.com", label: "Aave", category: "DeFi Lending" },
  { domain: "compound.finance", label: "Compound", category: "DeFi Lending" },
  { domain: "makerdao.com", label: "Maker", category: "DeFi" },
  { domain: "lido.fi", label: "Lido", category: "Staking" },

  { domain: "etherscan.io", label: "Etherscan", category: "Explorer" },
  { domain: "polygonscan.com", label: "Polygonscan", category: "Explorer" },
  { domain: "arbiscan.io", label: "Arbiscan", category: "Explorer" },
  { domain: "optimistic.etherscan.io", label: "Optimism Explorer", category: "Explorer" },

  { domain: "metamask.io", label: "MetaMask", category: "Wallet" },
  { domain: "walletconnect.com", label: "WalletConnect", category: "Wallet" },
  { domain: "rabby.io", label: "Rabby", category: "Wallet" },
  { domain: "ledger.com", label: "Ledger", category: "Wallet" },
  { domain: "trezor.io", label: "Trezor", category: "Wallet" },

  { domain: "coinbase.com", label: "Coinbase", category: "Exchange" },
  { domain: "binance.com", label: "Binance", category: "Exchange" },
  { domain: "kraken.com", label: "Kraken", category: "Exchange" },
  { domain: "okx.com", label: "OKX", category: "Exchange" },
];

export const METAMASK_PHISHING_HOSTS_TXT =
  "https://raw.githubusercontent.com/MetaMask/eth-phishing-detect/main/src/hosts.txt";

export function normalizeHost(host: string): string {
  return String(host || "").trim().toLowerCase().replace(/\.$/, "");
}

export function hostMatchesDomain(host: string, domain: string): boolean {
  const h = normalizeHost(host);
  const d = normalizeHost(domain);
  return h === d || h.endsWith("." + d);
}

export function parseHostsTxt(txt: string): string[] {
  return String(txt || "")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => !!l && !l.startsWith("#"))
    .map((l) => normalizeHost(l));
}

export async function fetchThreatIntel(): Promise<ThreatIntel> {
  const sources: ThreatIntel["sources"] = [];
  const now = Date.now();

  let blockedDomains: string[] = [];
  try {
    const res = await fetch(METAMASK_PHISHING_HOSTS_TXT, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const txt = await res.text();
    blockedDomains = parseHostsTxt(txt);
    sources.push({ id: "metamask-eth-phishing-detect-hosts", url: METAMASK_PHISHING_HOSTS_TXT, ok: true, fetchedAt: now });
  } catch (e: any) {
    sources.push({ id: "metamask-eth-phishing-detect-hosts", url: METAMASK_PHISHING_HOSTS_TXT, ok: false, fetchedAt: now, error: String(e?.message ?? e) });
  }

  const trustedDomains = TRUSTED_DOMAINS_SEED.map((x) => normalizeHost(x.domain));

  return {
    updatedAt: now,
    sources,
    trustedDomains,
    blockedDomains,
  };
}

