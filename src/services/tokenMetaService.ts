/**
 * Token metadata (decimals, symbol, name) via eth_call. Cached 7 days.
 */

import { getChainInfo } from "../shared/chains";
import { normalizeAddress } from "../shared/utils";

const META_CACHE_KEY = "sg_token_meta_v1";
const META_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const SELECTOR_DECIMALS = "0x313ce567";
const SELECTOR_SYMBOL = "0x95d89b41";
const SELECTOR_NAME = "0x06fdde03";

type MetaEntry = { symbol?: string; decimals?: number; name?: string; updatedAt: number };

async function loadCache(): Promise<Record<string, MetaEntry>> {
  return new Promise((resolve) => {
    try {
      chrome.storage.local.get(META_CACHE_KEY, (r) => {
        const raw = (r as Record<string, unknown>)?.[META_CACHE_KEY];
        resolve(typeof raw === "object" && raw !== null ? (raw as Record<string, MetaEntry>) : {});
      });
    } catch {
      resolve({});
    }
  });
}

async function saveCache(data: Record<string, MetaEntry>): Promise<void> {
  return new Promise((resolve) => {
    try {
      chrome.storage.local.set({ [META_CACHE_KEY]: data }, () => resolve());
    } catch {
      resolve();
    }
  });
}

function cacheKey(chainId: string, addr: string): string {
  const a = normalizeAddress(addr);
  const c = String(chainId).toLowerCase();
  return a ? `${c}:${a}` : "";
}

function decodeStringResult(hex: string): string {
  if (!hex || hex === "0x") return "";
  const raw = hex.startsWith("0x") ? hex.slice(2) : hex;
  if (raw.length < 64) return "";
  const offset = parseInt(raw.slice(0, 64), 16);
  const length = parseInt(raw.slice(64, 128), 16);
  if (length === 0) return "";
  const dataStart = offset * 2;
  const dataHex = raw.slice(dataStart, dataStart + length * 2);
  let s = "";
  for (let i = 0; i < dataHex.length; i += 2) s += String.fromCharCode(parseInt(dataHex.slice(i, i + 2), 16));
  return s.replace(/\0/g, "").trim();
}

function decodeBytes32(hex: string): string {
  if (!hex || hex === "0x") return "";
  const raw = hex.startsWith("0x") ? hex.slice(2) : hex;
  if (raw.length < 64) return raw ? String.fromCharCode(parseInt(raw.slice(0, 2), 16)) : "";
  const data = raw.slice(64, 128);
  let s = "";
  for (let i = 0; i < data.length; i += 2) {
    const code = parseInt(data.slice(i, i + 2), 16);
    if (code === 0) break;
    s += String.fromCharCode(code);
  }
  return s.trim();
}

export async function getTokenMeta(
  chainIdHex: string,
  tokenAddress: string,
  rpcCall: (chainId: string, method: string, params: unknown[]) => Promise<unknown>
): Promise<{ ok: boolean; symbol?: string; decimals?: number; name?: string }> {
  const key = cacheKey(chainIdHex, tokenAddress);
  if (!key) return { ok: false };
  const cache = await loadCache();
  const now = Date.now();
  const hit = cache[key];
  if (hit && (now - hit.updatedAt) < META_TTL_MS) {
    return { ok: true, symbol: hit.symbol, decimals: hit.decimals, name: hit.name };
  }
  const to = normalizeAddress(tokenAddress);
  if (!to) return { ok: false };

  let decimals: number | undefined;
  let symbol: string | undefined;
  let name: string | undefined;

  try {
    const decRes = await rpcCall(chainIdHex, "eth_call", [{ to, data: SELECTOR_DECIMALS }, "latest"]);
    const decHex = typeof decRes === "string" ? decRes : "";
    if (decHex && decHex !== "0x") {
      const d = parseInt(decHex, 16);
      if (Number.isFinite(d) && d >= 0 && d <= 255) decimals = d;
    }
  } catch {}

  try {
    const symRes = await rpcCall(chainIdHex, "eth_call", [{ to, data: SELECTOR_SYMBOL }, "latest"]);
    const symHex = typeof symRes === "string" ? symRes : "";
    if (symHex && symHex.length > 2) {
      symbol = symHex.length <= 66 ? decodeBytes32(symHex) : decodeStringResult(symHex);
    }
  } catch {}

  try {
    const nameRes = await rpcCall(chainIdHex, "eth_call", [{ to, data: SELECTOR_NAME }, "latest"]);
    const nameHex = typeof nameRes === "string" ? nameRes : "";
    if (nameHex && nameHex.length > 2) {
      name = nameHex.length <= 66 ? decodeBytes32(nameHex) : decodeStringResult(nameHex);
    }
  } catch {}

  cache[key] = { symbol, decimals, name, updatedAt: now };
  await saveCache(cache);
  return { ok: true, symbol, decimals, name };
}
