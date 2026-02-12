/**
 * Native USD price by chain (CoinGecko). Token USD via DexScreener. No API keys.
 */

import { getChainInfo } from "../shared/chains";

const NATIVE_PRICE_CACHE_KEY = "sg_price_native_v1";
const TOKEN_PRICE_CACHE_KEY = "sg_price_token_v1";
const NATIVE_CACHE_TTL_MS = 2 * 60 * 1000;   // 2 min
const TOKEN_CACHE_TTL_MS = 3 * 60 * 1000;   // 3 min
const FETCH_TIMEOUT_MS = 6000;

function normalizeTokenKey(chainId: string, addr: string): string {
  const c = String(chainId).toLowerCase();
  const a = String(addr).trim().toLowerCase();
  const hex = a.startsWith("0x") ? a.slice(2) : a;
  if (hex.length !== 40 || !/^[a-f0-9]{40}$/.test(hex)) return "";
  return `${c}:0x${hex}`;
}

async function loadNativeCache(): Promise<Record<string, { usd: number; updatedAt: number }>> {
  return new Promise((resolve) => {
    try {
      chrome.storage.local.get(NATIVE_PRICE_CACHE_KEY, (r) => {
        const raw = (r as Record<string, unknown>)?.[NATIVE_PRICE_CACHE_KEY];
        resolve(typeof raw === "object" && raw !== null ? (raw as Record<string, { usd: number; updatedAt: number }>) : {});
      });
    } catch {
      resolve({});
    }
  });
}

async function saveNativeCache(data: Record<string, { usd: number; updatedAt: number }>): Promise<void> {
  return new Promise((resolve) => {
    try {
      chrome.storage.local.set({ [NATIVE_PRICE_CACHE_KEY]: data }, () => resolve());
    } catch {
      resolve();
    }
  });
}

async function loadTokenCache(): Promise<Record<string, { priceUsd: number; updatedAt: number }>> {
  return new Promise((resolve) => {
    try {
      chrome.storage.local.get(TOKEN_PRICE_CACHE_KEY, (r) => {
        const raw = (r as Record<string, unknown>)?.[TOKEN_PRICE_CACHE_KEY];
        resolve(typeof raw === "object" && raw !== null ? (raw as Record<string, { priceUsd: number; updatedAt: number }>) : {});
      });
    } catch {
      resolve({});
    }
  });
}

async function saveTokenCache(data: Record<string, { priceUsd: number; updatedAt: number }>): Promise<void> {
  return new Promise((resolve) => {
    try {
      chrome.storage.local.set({ [TOKEN_PRICE_CACHE_KEY]: data }, () => resolve());
    } catch {
      resolve();
    }
  });
}

async function fetchWithTimeout(url: string): Promise<string | null> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: ctrl.signal, cache: "no-store" });
    clearTimeout(t);
    if (!res.ok) return null;
    return await res.text();
  } catch {
    clearTimeout(t);
    return null;
  }
}

/** CoinGecko simple price (no key). ids=ethereum&vs_currencies=usd */
export async function getNativeUsd(chainIdHex: string): Promise<{ usd: number; nativeSymbol: string } | null> {
  const chain = getChainInfo(chainIdHex);
  if (!chain) return null;
  const cache = await loadNativeCache();
  const now = Date.now();
  const entry = cache[chain.coingeckoId];
  if (entry && (now - entry.updatedAt) < NATIVE_CACHE_TTL_MS) {
    return { usd: entry.usd, nativeSymbol: chain.nativeSymbol };
  }
  const url = `https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(chain.coingeckoId)}&vs_currencies=usd`;
  const body = await fetchWithTimeout(url);
  if (!body) return entry ? { usd: entry.usd, nativeSymbol: chain.nativeSymbol } : null;
  try {
    const data = JSON.parse(body) as Record<string, { usd?: number }>;
    const usd = data?.[chain.coingeckoId]?.usd;
    if (typeof usd === "number" && usd > 0) {
      cache[chain.coingeckoId] = { usd, updatedAt: now };
      await saveNativeCache(cache);
      return { usd, nativeSymbol: chain.nativeSymbol };
    }
  } catch {}
  return entry ? { usd: entry.usd, nativeSymbol: chain.nativeSymbol } : null;
}

/** DexScreener token price by address. Picks pair with highest liquidity. */
export async function getTokenUsd(chainIdHex: string, tokenAddress: string): Promise<{ priceUsd: number; source: string } | null> {
  const key = normalizeTokenKey(chainIdHex, tokenAddress);
  if (!key) return null;
  const cache = await loadTokenCache();
  const now = Date.now();
  const entry = cache[key];
  if (entry && (now - entry.updatedAt) < TOKEN_CACHE_TTL_MS) {
    return { priceUsd: entry.priceUsd, source: "cache" };
  }
  const addr = key.includes("0x") ? key.split(":")[1] : "";
  if (!addr) return null;
  const url = `https://api.dexscreener.com/latest/dex/tokens/${addr}`;
  const body = await fetchWithTimeout(url);
  if (!body) return entry ? { priceUsd: entry.priceUsd, source: "cache" } : null;
  try {
    const data = JSON.parse(body) as { pairs?: Array<{ liquidity?: { usd?: number }; priceUsd?: string }> };
    const pairs = data?.pairs;
    if (!Array.isArray(pairs) || pairs.length === 0) return null;
    const withLiq = pairs
      .filter((p) => p?.priceUsd && Number(p.priceUsd) > 0)
      .map((p) => ({ priceUsd: Number(p.priceUsd), liquidity: (p.liquidity?.usd ?? 0) }));
    withLiq.sort((a, b) => b.liquidity - a.liquidity);
    const best = withLiq[0];
    if (best && best.priceUsd > 0) {
      cache[key] = { priceUsd: best.priceUsd, updatedAt: now };
      await saveTokenCache(cache);
      return { priceUsd: best.priceUsd, source: "dexscreener" };
    }
  } catch {}
  return null;
}
