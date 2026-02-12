/**
 * V2: Token metadata (decimals, symbol, name) via eth_call. Cache 7 days.
 */

import { getChainInfo } from "../shared/chains";

const META_CACHE_KEY = "sg_token_meta_v1";
const META_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const RPC_TIMEOUT_MS = 6000;

type MetaEntry = { symbol?: string; decimals?: number; name?: string; updatedAt: number };
type MetaCache = Record<string, MetaEntry>;

const DECIMALS_SEL = "0x313ce567";
const SYMBOL_SEL = "0x95d89b41";
const NAME_SEL = "0x06fdde03";

function getCache(): Promise<MetaCache> {
  return new Promise((resolve) => {
    try {
      if (!chrome?.storage?.local) return resolve({});
      chrome.storage.local.get(META_CACHE_KEY, (r) => {
        const v = (r as Record<string, MetaCache>)?.[META_CACHE_KEY];
        resolve(v && typeof v === "object" ? v : {});
      });
    } catch {
      resolve({});
    }
  });
}

function setCache(cache: MetaCache): Promise<void> {
  return new Promise((resolve) => {
    try {
      if (!chrome?.storage?.local) return resolve();
      chrome.storage.local.set({ [META_CACHE_KEY]: cache }, () => resolve());
    } catch {
      resolve();
    }
  });
}

function normalizeAddr(addr: string): string {
  const s = (addr || "").trim().toLowerCase();
  return s.startsWith("0x") && s.length === 42 ? s : "";
}

function decodeStringResult(hex: string): string {
  if (!hex || hex.length < 66) return "";
  const data = hex.startsWith("0x") ? hex.slice(2) : hex;
  if (data.length < 64) return "";
  const firstWord = data.slice(0, 64);
  const offset = parseInt(firstWord.slice(0, 16), 16);
  if (offset === 0x20 && data.length >= 128) {
    const lenHex = data.slice(64, 128);
    const len = parseInt(lenHex, 16) * 2;
    const strHex = data.slice(128, 128 + len);
    try {
      return decodeURIComponent(strHex.replace(/(..)/g, "%$1")).replace(/\0/g, "").trim();
    } catch {
      return "";
    }
  }
  const ascii = firstWord.match(/.{2}/g)?.map((b) => String.fromCharCode(parseInt(b, 16))).join("") ?? "";
  return ascii.replace(/\0/g, "").trim();
}

async function ethCall(rpcUrl: string, to: string, data: string): Promise<string | null> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), RPC_TIMEOUT_MS);
    const res = await fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_call", params: [{ to, data }, "latest"] }),
      signal: ctrl.signal,
    });
    clearTimeout(t);
    if (!res.ok) return null;
    const j = (await res.json()) as { result?: string };
    return j.result ?? null;
  } catch {
    return null;
  }
}

export async function getTokenMeta(chainIdHex: string, tokenAddress: string, rpcUrlOverride?: string): Promise<{ ok: boolean; symbol?: string; decimals?: number; name?: string }> {
  const addr = normalizeAddr(tokenAddress);
  if (!addr) return { ok: false };
  const chainId = (chainIdHex || "").toLowerCase();
  const key = `${chainId}:${addr}`;
  const cache = await getCache();
  const now = Date.now();
  const entry = cache[key];
  if (entry && (now - entry.updatedAt) < META_TTL_MS) {
    return { ok: true, symbol: entry.symbol, decimals: entry.decimals, name: entry.name };
  }
  const info = getChainInfo(chainIdHex);
  const rpcUrl = rpcUrlOverride || info?.rpcUrls?.[0];
  if (!rpcUrl) return { ok: false };

  const [decRes, symRes, nameRes] = await Promise.all([
    ethCall(rpcUrl, addr, DECIMALS_SEL + "0".repeat(56)),
    ethCall(rpcUrl, addr, SYMBOL_SEL + "0".repeat(56)),
    ethCall(rpcUrl, addr, NAME_SEL + "0".repeat(56)),
  ]);

  let decimals: number | undefined;
  if (decRes && decRes.length >= 66) {
    const n = parseInt(decRes.slice(2, 66), 16);
    if (Number.isFinite(n)) decimals = n;
  }
  let symbol = "";
  if (symRes && symRes.length >= 66) symbol = decodeStringResult(symRes);
  let name = "";
  if (nameRes && nameRes.length >= 66) name = decodeStringResult(nameRes);

  cache[key] = { symbol: symbol || undefined, decimals, name: name || undefined, updatedAt: now };
  await setCache(cache);
  return { ok: true, symbol: symbol || undefined, decimals, name: name || undefined };
}
