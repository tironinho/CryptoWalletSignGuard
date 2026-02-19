/**
 * Token verification + cache: Uniswap list as verified tokens with symbol/logo.
 * TokenMap in storage for O(1) lookup; 7-day cache.
 * Network fetch only when Cloud Intel is on and permissions granted (see netGate).
 */

import { canUseNetwork } from "./netGate";
import { DEFAULT_SETTINGS } from "../shared/types";
import type { Settings } from "../shared/types";

/** Compact entry: s = symbol, l = logoURI, v = verified */
export type TokenEntry = { s: string; l: string; v: boolean };

/** Key = address (lowercase), value = TokenEntry */
export type TokenMap = Record<string, TokenEntry>;

const TOKEN_CACHE_KEY = "tokenCache";
const TOKEN_FIRST_SEEN_KEY = "sg_token_first_seen_v1";
const CACHE_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const NEW_TOKEN_DAYS = 7; // tokens seen < 7 days ago = "low confidence"
const UNISWAP_LIST_URL = "https://gateway.ipfs.io/ipns/tokens.uniswap.org";
const FETCH_TIMEOUT_MS = 15000;

let inMemoryMap: TokenMap = {};

function normalizeAddr(addr: string): string {
  const a = String(addr || "").trim().toLowerCase();
  return a.startsWith("0x") && a.length === 42 ? a : "";
}

function buildTokenMap(data: unknown): TokenMap {
  const map: TokenMap = {};
  if (!data || typeof data !== "object") return map;
  const tokens = Array.isArray((data as any).tokens) ? (data as any).tokens : [];
  for (const t of tokens) {
    const addr = (t as any)?.address;
    const a = normalizeAddr(typeof addr === "string" ? addr : "");
    if (!a) continue;
    const symbol = typeof (t as any).symbol === "string" ? (t as any).symbol : "?";
    const logoURI = typeof (t as any).logoURI === "string" ? (t as any).logoURI : "";
    map[a] = { s: symbol, l: logoURI, v: true };
  }
  return map;
}

async function fetchUniswapList(): Promise<TokenMap> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(UNISWAP_LIST_URL, { cache: "no-store", signal: ctrl.signal });
    clearTimeout(t);
    if (!res.ok) return {};
    const data = await res.json();
    return buildTokenMap(data);
  } catch {
    clearTimeout(t);
    return {};
  }
}

async function getSettings(): Promise<Settings> {
  return new Promise((resolve) => {
    try {
      chrome.storage.sync.get(DEFAULT_SETTINGS, (r) => resolve((r as Settings) ?? DEFAULT_SETTINGS));
    } catch {
      resolve(DEFAULT_SETTINGS);
    }
  });
}

async function loadFromStorageAndMaybeRefresh(): Promise<void> {
  try {
    const raw = await new Promise<{ tokenCache?: { map?: TokenMap; updatedAt?: number } }>((resolve) => {
      chrome.storage.local.get(TOKEN_CACHE_KEY, (r) => resolve(r as any));
    });
    const cache = raw?.tokenCache;
    const map = cache?.map && typeof cache?.updatedAt === "number" ? cache.map : null;
    const updatedAt = cache?.updatedAt ?? 0;
    const isStale = Date.now() - updatedAt > CACHE_AGE_MS;

    if (map && Object.keys(map).length > 0 && !isStale) {
      inMemoryMap = map;
      return;
    }

    const settings = await getSettings();
    const gate = await canUseNetwork("cloudIntel", settings);
    if (!gate.ok) {
      if (map && Object.keys(map).length > 0) inMemoryMap = map;
      return;
    }

    const fresh = await fetchUniswapList();
    if (Object.keys(fresh).length > 0) {
      inMemoryMap = fresh;
      await new Promise<void>((resolve, reject) => {
        chrome.storage.local.set(
          { [TOKEN_CACHE_KEY]: { map: fresh, updatedAt: Date.now() } },
          () => (chrome.runtime?.lastError ? reject(chrome.runtime.lastError) : resolve())
        );
      });
    } else if (map && Object.keys(map).length > 0) {
      inMemoryMap = map;
    }
  } catch {
    if (Object.keys(inMemoryMap).length > 0) return;
  }
}

/**
 * Initialize token security: load cache from storage; if missing or older than 7 days, fetch Uniswap list and save.
 * Call from background on startup or first use.
 */
export async function initTokenSecurity(): Promise<void> {
  await loadFromStorageAndMaybeRefresh();
}

/**
 * O(1) lookup from in-memory map (loaded from storage on init).
 * Returns { symbol, logoURI, verified } or undefined if not in list.
 */
export function getTokenInfo(address: string): TokenEntry | undefined {
  const a = normalizeAddr(address);
  return a ? inMemoryMap[a] : undefined;
}

/** Legacy: whether the address is in the verified (Uniswap) list. */
export function isTokenVerified(_intel: unknown, address: string): boolean {
  return getTokenInfo(address)?.v ?? false;
}

function tokenKey(chainIdHex: string, address: string): string {
  const c = String(chainIdHex ?? "").trim().toLowerCase();
  const a = normalizeAddr(address);
  if (!a) return "";
  const ch = c.startsWith("0x") ? c : "0x" + parseInt(c || "0", 10).toString(16);
  return ch + ":" + a;
}

/** Get first-seen timestamp for a token (chainId, address). Returns null if never seen. */
export async function getTokenFirstSeen(chainIdHex: string, address: string): Promise<number | null> {
  const key = tokenKey(chainIdHex, address);
  if (!key) return null;
  try {
    const raw = await new Promise<Record<string, number>>((resolve) => {
      chrome.storage.local.get(TOKEN_FIRST_SEEN_KEY, (r) => resolve((r as any)?.[TOKEN_FIRST_SEEN_KEY] ?? {}));
    });
    const ts = raw?.[key];
    return typeof ts === "number" ? ts : null;
  } catch {
    return null;
  }
}

/** Mark token as seen; stores timestamp only if not already present. */
export async function markTokenSeen(chainIdHex: string, address: string): Promise<void> {
  const key = tokenKey(chainIdHex, address);
  if (!key) return;
  try {
    const raw = await new Promise<Record<string, number>>((resolve) => {
      chrome.storage.local.get(TOKEN_FIRST_SEEN_KEY, (r) => resolve((r as any)?.[TOKEN_FIRST_SEEN_KEY] ?? {}));
    });
    const map = { ...(raw || {}) };
    if (typeof map[key] !== "number") {
      map[key] = Date.now();
      await new Promise<void>((resolve, reject) => {
        chrome.storage.local.set({ [TOKEN_FIRST_SEEN_KEY]: map }, () => (chrome.runtime?.lastError ? reject(chrome.runtime.lastError) : resolve()));
      });
    }
  } catch {}
}

/** Resolve token address for a tx: contract (to) for ERC20, or from decoded action */
export function getTokenAddressForTx(
  txTo: string | undefined,
  decodedAction: { kind: string; token?: string } | null
): string | undefined {
  const to = (txTo ?? "").trim().toLowerCase();
  if (decodedAction && "token" in decodedAction && decodedAction.token) {
    return decodedAction.token.trim().toLowerCase();
  }
  if (to && to.startsWith("0x") && to.length === 42) return to;
  return undefined;
}
