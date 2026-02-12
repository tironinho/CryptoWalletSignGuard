/**
 * V2: Native USD per chain (CoinGecko) + token USD per contract (DexScreener). No API keys.
 */

import { getChainInfo } from "../shared/chains";

const NATIVE_CACHE_KEY = "sg_price_native_v1";
const TOKEN_CACHE_KEY = "sg_price_token_v1";
const NATIVE_TTL_MS = 60_000 * 5; // 5 min
const TOKEN_TTL_MS = 60_000 * 3;   // 3 min
const FETCH_TIMEOUT_MS = 8000;

type NativeCache = Record<string, { usd: number; updatedAt: number }>;
type TokenCache = Record<string, { priceUsd: number; updatedAt: number }>;

function getNativeCache(): Promise<NativeCache> {
  return new Promise((resolve) => {
    try {
      if (!chrome?.storage?.local) return resolve({});
      chrome.storage.local.get(NATIVE_CACHE_KEY, (r) => {
        const v = (r as Record<string, NativeCache>)?.[NATIVE_CACHE_KEY];
        resolve(v && typeof v === "object" ? v : {});
      });
    } catch {
      resolve({});
    }
  });
}

function setNativeCache(cache: NativeCache): Promise<void> {
  return new Promise((resolve) => {
    try {
      if (!chrome?.storage?.local) return resolve();
      chrome.storage.local.set({ [NATIVE_CACHE_KEY]: cache }, () => resolve());
    } catch {
      resolve();
    }
  });
}

function getTokenCache(): Promise<TokenCache> {
  return new Promise((resolve) => {
    try {
      if (!chrome?.storage?.local) return resolve({});
      chrome.storage.local.get(TOKEN_CACHE_KEY, (r) => {
        const v = (r as Record<string, TokenCache>)?.[TOKEN_CACHE_KEY];
        resolve(v && typeof v === "object" ? v : {});
      });
    } catch {
      resolve({});
    }
  });
}

function setTokenCache(cache: TokenCache): Promise<void> {
  return new Promise((resolve) => {
    try {
      if (!chrome?.storage?.local) return resolve();
      chrome.storage.local.set({ [TOKEN_CACHE_KEY]: cache }, () => resolve());
    } catch {
      resolve();
    }
  });
}

async function fetchWithTimeout(url: string): Promise<string | null> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
    const res = await fetch(url, { signal: ctrl.signal });
    clearTimeout(t);
    return res.ok ? await res.text() : null;
  } catch {
    return null;
  }
}

export async function getNativeUsd(chainIdHex: string): Promise<{ ok: boolean; usdPerNative?: number; nativeSymbol?: string }> {
  const info = getChainInfo(chainIdHex);
  if (!info) return { ok: false };
  const cache = await getNativeCache();
  const now = Date.now();
  const entry = cache[info.coingeckoId];
  if (entry && (now - entry.updatedAt) < NATIVE_TTL_MS) {
    return { ok: true, usdPerNative: entry.usd, nativeSymbol: info.nativeSymbol };
  }
  try {
    const ids = info.coingeckoId;
    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(ids)}&vs_currencies=usd`;
    const body = await fetchWithTimeout(url);
    if (!body) return { ok: false, nativeSymbol: info.nativeSymbol };
    const j = JSON.parse(body) as Record<string, { usd?: number }>;
    const usd = j[info.coingeckoId]?.usd;
    if (typeof usd !== "number" || usd <= 0) return { ok: false, nativeSymbol: info.nativeSymbol };
    cache[info.coingeckoId] = { usd, updatedAt: now };
    await setNativeCache(cache);
    return { ok: true, usdPerNative: usd, nativeSymbol: info.nativeSymbol };
  } catch {
    return { ok: false, nativeSymbol: info.nativeSymbol };
  }
}

function normalizeAddr(addr: string): string {
  const s = (addr || "").trim().toLowerCase();
  return s.startsWith("0x") && s.length === 42 ? s : "";
}

export async function getTokenUsd(chainIdHex: string, tokenAddress: string): Promise<{ ok: boolean; priceUsd?: number; source?: string }> {
  const addr = normalizeAddr(tokenAddress);
  if (!addr) return { ok: false };
  const key = `${(chainIdHex || "").toLowerCase()}:${addr}`;
  const cache = await getTokenCache();
  const now = Date.now();
  const entry = cache[key];
  if (entry && (now - entry.updatedAt) < TOKEN_TTL_MS) {
    return { ok: true, priceUsd: entry.priceUsd, source: "cache" };
  }
  try {
    const url = `https://api.dexscreener.com/latest/dex/tokens/${addr}`;
    const body = await fetchWithTimeout(url);
    if (!body) return { ok: false };
    const j = JSON.parse(body) as { pairs?: Array<{ liquidity?: { usd?: number }; priceUsd?: string }> };
    const pairs = Array.isArray(j.pairs) ? j.pairs : [];
    let best: { priceUsd: string; liq: number } | null = null;
    for (const p of pairs) {
      const price = p.priceUsd;
      const liq = typeof p.liquidity?.usd === "number" ? p.liquidity.usd : 0;
      if (price && liq > (best?.liq ?? 0)) best = { priceUsd: price, liq };
    }
    if (!best) return { ok: false };
    const priceUsd = parseFloat(best.priceUsd);
    if (!Number.isFinite(priceUsd) || priceUsd <= 0) return { ok: false };
    cache[key] = { priceUsd, updatedAt: now };
    await setTokenCache(cache);
    return { ok: true, priceUsd, source: "dexscreener" };
  } catch {
    return { ok: false };
  }
}
