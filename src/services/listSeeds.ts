/**
 * Seed data for list manager — trusted/blocked base. No secrets.
 */

import type { ListSourceName } from "../shared/types";

export const TRUSTED_DOMAINS_SEED: string[] = [
  "opensea.io",
  "blur.io",
  "looksrare.org",
  "rarible.com",
  "app.uniswap.org",
  "uniswap.org",
  "app.1inch.io",
  "1inch.io",
  "etherscan.io",
  "arbiscan.io",
  "polygonscan.com",
  "bscscan.com",
  "snowtrace.io",
  "metamask.io",
  "rainbow.me",
  "walletconnect.com",
  "aave.com",
  "app.aave.com",
  "curve.fi",
  "balancer.fi",
  "compound.finance",
  "lido.fi",
  "cow.fi",
  "matcha.xyz",
  "arbitrum.io",
  "polygon.technology",
  "avax.network",
  "binance.com",
];

export const BLOCKED_DOMAINS_SEED: string[] = [];

export function buildSeedLists(): {
  trustedDomains: string[];
  blockedDomains: string[];
  blockedAddresses: string[];
  scamTokens: Array<{ chainId: string; address: string; symbol?: string; name?: string; source: ListSourceName }>;
} {
  const trustedDomains = [...new Set(TRUSTED_DOMAINS_SEED)].map((h) => h.trim().toLowerCase()).filter(Boolean);
  const blockedDomains = [...new Set(BLOCKED_DOMAINS_SEED)].map((h) => h.trim().toLowerCase()).filter(Boolean);
  return {
    trustedDomains,
    blockedDomains,
    blockedAddresses: [],
    scamTokens: [],
  };
}
