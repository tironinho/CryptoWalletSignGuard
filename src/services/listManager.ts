/**
 * V2: List manager — feeds, cache, user overrides. No secrets.
 */

import type { ListsCacheV1, ListSourceName } from "../shared/types";
import { normalizeHost, normalizeAddress, normalizeTokenKey, isHostMatch } from "../shared/utils";
import { TRUSTED_DOMAINS_SEED, BLOCKED_DOMAINS_SEED } from "./listSeeds";

const STORAGE_KEY = "sg_lists_cache_v1";
const LAST_REFRESH_KEY = "sg_lists_last_refresh";
const FETCH_TIMEOUT_MS = 6000;

function emptyCache(): ListsCacheV1 {
  return {
    version: 1,
    updatedAt: 0,
    sources: {
      metamask: {},
      scamsniffer: {},
      cryptoscamdb: {},
      dappradar: {},
      seed: {},
      user: {},
    },
    trustedDomains: [],
    blockedDomains: [],
    blockedAddresses: [],
    scamTokens: [],
    userTrustedDomains: [],
    userBlockedDomains: [],
    userBlockedAddresses: [],
    userScamTokens: [],
  };
}

function getStorage(): Promise<ListsCacheV1 | null> {
  return new Promise((resolve) => {
    try {
      if (!chrome?.storage?.local) return resolve(null);
      chrome.storage.local.get(STORAGE_KEY, (r) => {
        if (chrome.runtime?.lastError) return resolve(null);
        const v = (r as Record<string, unknown>)?.[STORAGE_KEY];
        resolve(v && typeof v === "object" && (v as ListsCacheV1).version === 1 ? (v as ListsCacheV1) : null);
      });
    } catch {
      resolve(null);
    }
  });
}

function setStorage(cache: ListsCacheV1): Promise<void> {
  return new Promise((resolve) => {
    try {
      if (!chrome?.storage?.local) return resolve();
      chrome.storage.local.set(
        { [STORAGE_KEY]: cache, [LAST_REFRESH_KEY]: Date.now() },
        () => resolve()
      );
    } catch {
      resolve();
    }
  });
}

async function fetchWithTimeout(url: string, etag?: string): Promise<{ body: string; etag?: string } | null> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
    const headers: Record<string, string> = {};
    if (etag) headers["If-None-Match"] = etag;
    const res = await fetch(url, { signal: ctrl.signal, headers });
    clearTimeout(t);
    const newEtag = res.headers.get("etag") ?? undefined;
    if (res.status === 304) return { body: "", etag: newEtag ?? etag };
    const body = await res.text();
    return { body, etag: newEtag ?? undefined };
  } catch {
    return null;
  }
}

function parseMetamask(body: string): { blocklist?: string[]; whitelist?: string[] } {
  try {
    const j = JSON.parse(body) as Record<string, unknown>;
    const blocklist = j.blocklist as string[] | undefined;
    const whitelist = j.whitelist as string[] | undefined;
    return { blocklist: Array.isArray(blocklist) ? blocklist : undefined, whitelist: Array.isArray(whitelist) ? whitelist : undefined };
  } catch {
    return {};
  }
}

function parseScamSnifferDomains(body: string): string[] {
  try {
    const j = JSON.parse(body);
    if (Array.isArray(j)) return j.map((x: any) => String(x?.domain ?? x ?? "").toLowerCase()).filter(Boolean);
    if (j && typeof j === "object" && Array.isArray(j.domains)) return j.domains.map((x: any) => String(x?.domain ?? x ?? "").toLowerCase()).filter(Boolean);
    return [];
  } catch {
    return [];
  }
}

function parseScamSnifferAddresses(body: string): string[] {
  try {
    const j = JSON.parse(body);
    if (Array.isArray(j)) return j.map((x: any) => normalizeAddress(String(x?.address ?? x ?? ""))).filter(Boolean);
    return [];
  } catch {
    return [];
  }
}

function parseCryptoScamDb(body: string): { blacklist?: string[]; whitelist?: string[] } {
  try {
    const j = JSON.parse(body) as Record<string, unknown>;
    const result = j.result as Record<string, string[]> | undefined;
    if (!result) return {};
    return {
      blacklist: Array.isArray(result.blacklist) ? result.blacklist : undefined,
      whitelist: Array.isArray(result.whitelist) ? result.whitelist : undefined,
    };
  } catch {
    return {};
  }
}

function parseDappRadarTokens(body: string): Array<{ chainId: string; address: string }> {
  try {
    const j = JSON.parse(body);
    const arr = Array.isArray(j) ? j : (j?.tokens ? j.tokens : j?.data) ?? [];
    return arr
      .map((x: any) => {
        const chainId = String(x?.chainId ?? x?.chain ?? "0x1").toLowerCase();
        const addr = normalizeAddress(String(x?.address ?? x?.contract ?? x ?? ""));
        return addr ? { chainId: chainId.startsWith("0x") ? chainId : "0x" + chainId, address: addr } : null;
      })
      .filter(Boolean) as Array<{ chainId: string; address: string }>;
  } catch {
    return [];
  }
}

export async function getLists(): Promise<ListsCacheV1> {
  const cache = await getStorage();
  if (cache) return cache;
  const fresh = emptyCache();
  fresh.trustedDomains = [...new Set(TRUSTED_DOMAINS_SEED.map((d) => normalizeHost(d)).filter(Boolean))];
  fresh.blockedDomains = [...new Set(BLOCKED_DOMAINS_SEED.map((d) => normalizeHost(d)).filter(Boolean))];
  fresh.sources.seed = { ok: true, updatedAt: Date.now() };
  fresh.updatedAt = Date.now();
  await setStorage(fresh);
  return fresh;
}

/** Priority: user > seed/feeds. TRUSTED if in trusted; BLOCKED if in blocked; else UNKNOWN. */
export function getDomainDecision(host: string, cache: ListsCacheV1): "TRUSTED" | "BLOCKED" | "UNKNOWN" {
  const h = normalizeHost(host);
  if (!h) return "UNKNOWN";
  const inUserBlocked = cache.userBlockedDomains.some((d) => isHostMatch(h, d));
  if (inUserBlocked) return "BLOCKED";
  const inUserTrusted = cache.userTrustedDomains.some((d) => isHostMatch(h, d));
  if (inUserTrusted) return "TRUSTED";
  const inBlocked = cache.blockedDomains.some((d) => isHostMatch(h, d));
  if (inBlocked) return "BLOCKED";
  const inTrusted = cache.trustedDomains.some((d) => isHostMatch(h, d));
  if (inTrusted) return "TRUSTED";
  return "UNKNOWN";
}

export function isBlockedAddress(addr: string, cache: ListsCacheV1): boolean {
  const a = normalizeAddress(addr);
  if (!a) return false;
  if (cache.userBlockedAddresses.includes(a)) return true;
  return cache.blockedAddresses.includes(a);
}

export function isScamToken(chainId: string, tokenAddress: string, cache: ListsCacheV1): boolean {
  const key = normalizeTokenKey(chainId, tokenAddress);
  if (!key) return false;
  const [c, addr] = key.split(":");
  const userMatch = cache.userScamTokens.some((t) => normalizeTokenKey(t.chainId, t.address) === key);
  if (userMatch) return true;
  return cache.scamTokens.some((t) => normalizeTokenKey(t.chainId, t.address) === key);
}

export async function refresh(): Promise<ListsCacheV1> {
  const cache = await getLists();
  const updated = { ...cache, updatedAt: Date.now() };
  const trustedSet = new Set(updated.trustedDomains);
  const blockedSet = new Set(updated.blockedDomains);
  const blockedAddrSet = new Set(updated.blockedAddresses);
  const scamKeys = new Set(updated.scamTokens.map((t) => normalizeTokenKey(t.chainId, t.address)));

  // MetaMask config
  try {
    const meta = await fetchWithTimeout("https://raw.githubusercontent.com/MetaMask/eth-phishing-detect/main/src/config.json", updated.sources.metamask?.etag);
    if (meta?.body) {
      const { blocklist, whitelist } = parseMetamask(meta.body);
      updated.sources.metamask = { ok: true, updatedAt: Date.now(), etag: meta.etag };
      if (blocklist) blocklist.forEach((d) => { const n = normalizeHost(d); if (n) blockedSet.add(n); });
      if (whitelist) whitelist.forEach((d) => { const n = normalizeHost(d); if (n) trustedSet.add(n); });
    } else {
      updated.sources.metamask = { ...updated.sources.metamask, ok: false, error: "fetch failed" };
    }
  } catch (e) {
    updated.sources.metamask = { ...updated.sources.metamask, ok: false, error: String((e as Error)?.message ?? e) };
  }

  // ScamSniffer (example URLs — adjust if real endpoints differ)
  try {
    const ssDomains = await fetchWithTimeout("https://raw.githubusercontent.com/ScamSniffer/blockchain-scam-list/main/domains.json", updated.sources.scamsniffer?.etag);
    if (ssDomains?.body) {
      const list = parseScamSnifferDomains(ssDomains.body);
      list.forEach((d) => { const n = normalizeHost(d); if (n) blockedSet.add(n); });
      updated.sources.scamsniffer = { ok: true, updatedAt: Date.now(), etag: ssDomains.etag };
    } else {
      updated.sources.scamsniffer = { ...updated.sources.scamsniffer, ok: false, error: "fetch failed" };
    }
  } catch (e) {
    updated.sources.scamsniffer = { ...updated.sources.scamsniffer, ok: false, error: String((e as Error)?.message ?? e) };
  }

  // CryptoScamDB (public list if available)
  try {
    const csdb = await fetchWithTimeout("https://api.cryptoscamdb.org/v1/blacklist", updated.sources.cryptoscamdb?.etag);
    if (csdb?.body) {
      const { blacklist, whitelist } = parseCryptoScamDb(csdb.body);
      if (blacklist) blacklist.forEach((d) => { const n = normalizeHost(d); if (n) blockedSet.add(n); });
      if (whitelist) whitelist.forEach((d) => { const n = normalizeHost(d); if (n) trustedSet.add(n); });
      updated.sources.cryptoscamdb = { ok: true, updatedAt: Date.now(), etag: csdb.etag };
    } else {
      updated.sources.cryptoscamdb = { ...updated.sources.cryptoscamdb, ok: false, error: "fetch failed" };
    }
  } catch (e) {
    updated.sources.cryptoscamdb = { ...updated.sources.cryptoscamdb, ok: false, error: String((e as Error)?.message ?? e) };
  }

  updated.trustedDomains = [...trustedSet];
  updated.blockedDomains = [...blockedSet];
  updated.blockedAddresses = [...blockedAddrSet];
  updated.scamTokens = updated.scamTokens.filter((t) => scamKeys.has(normalizeTokenKey(t.chainId, t.address)));
  await setStorage(updated);
  return updated;
}

export type OverrideType = "trusted_domain" | "blocked_domain" | "blocked_address" | "scam_token";
export type OverridePayload = { type: OverrideType; value: string; chainId?: string; address?: string };

export async function upsertUserOverride(type: OverrideType, payload: OverridePayload): Promise<ListsCacheV1> {
  const cache = await getLists();
  const next = { ...cache, userTrustedDomains: [...cache.userTrustedDomains], userBlockedDomains: [...cache.userBlockedDomains], userBlockedAddresses: [...cache.userBlockedAddresses], userScamTokens: [...cache.userScamTokens], updatedAt: Date.now() };
  if (type === "trusted_domain") {
    const v = normalizeHost(payload.value);
    if (v && !next.userTrustedDomains.includes(v)) next.userTrustedDomains.push(v);
  } else if (type === "blocked_domain") {
    const v = normalizeHost(payload.value);
    if (v && !next.userBlockedDomains.includes(v)) next.userBlockedDomains.push(v);
  } else if (type === "blocked_address") {
    const v = normalizeAddress(payload.value || payload.address || "");
    if (v && !next.userBlockedAddresses.includes(v)) next.userBlockedAddresses.push(v);
  } else if (type === "scam_token" && payload.chainId && payload.address) {
    const addr = normalizeAddress(payload.address);
    if (addr && !next.userScamTokens.some((t) => t.chainId === payload.chainId && t.address === addr)) {
      next.userScamTokens.push({ chainId: payload.chainId, address: addr });
    }
  }
  await setStorage(next);
  return next;
}

export async function deleteUserOverride(type: OverrideType, value: string, chainId?: string, address?: string): Promise<ListsCacheV1> {
  const cache = await getLists();
  const next = { ...cache, userTrustedDomains: [...cache.userTrustedDomains], userBlockedDomains: [...cache.userBlockedDomains], userBlockedAddresses: [...cache.userBlockedAddresses], userScamTokens: [...cache.userScamTokens], updatedAt: Date.now() };
  if (type === "trusted_domain") next.userTrustedDomains = next.userTrustedDomains.filter((d) => d !== normalizeHost(value));
  else if (type === "blocked_domain") next.userBlockedDomains = next.userBlockedDomains.filter((d) => d !== normalizeHost(value));
  else if (type === "blocked_address") next.userBlockedAddresses = next.userBlockedAddresses.filter((a) => a !== normalizeAddress(value || address || ""));
  else if (type === "scam_token" && chainId && address) next.userScamTokens = next.userScamTokens.filter((t) => !(t.chainId === chainId && t.address === normalizeAddress(address)));
  await setStorage(next);
  return next;
}

export async function getLastRefresh(): Promise<number> {
  return new Promise((resolve) => {
    try {
      if (!chrome?.storage?.local) return resolve(0);
      chrome.storage.local.get(LAST_REFRESH_KEY, (r) => {
        const v = (r as Record<string, number>)?.[LAST_REFRESH_KEY];
        resolve(typeof v === "number" ? v : 0);
      });
    } catch {
      resolve(0);
    }
  });
}

/** Merge only user overrides from imported data; validates and saves. */
export async function importUserOverrides(data: {
  userTrustedDomains?: string[];
  userBlockedDomains?: string[];
  userBlockedAddresses?: string[];
  userScamTokens?: Array<{ chainId: string; address: string; symbol?: string; name?: string }>;
}): Promise<ListsCacheV1> {
  const cache = await getLists();
  const next = { ...cache, updatedAt: Date.now() };
  if (Array.isArray(data.userTrustedDomains)) next.userTrustedDomains = data.userTrustedDomains.map((d) => normalizeHost(String(d))).filter(Boolean);
  if (Array.isArray(data.userBlockedDomains)) next.userBlockedDomains = data.userBlockedDomains.map((d) => normalizeHost(String(d))).filter(Boolean);
  if (Array.isArray(data.userBlockedAddresses)) next.userBlockedAddresses = data.userBlockedAddresses.map((a) => normalizeAddress(String(a))).filter(Boolean);
  if (Array.isArray(data.userScamTokens)) next.userScamTokens = data.userScamTokens.filter((t) => t && t.chainId && t.address).map((t) => ({ chainId: String(t.chainId), address: normalizeAddress(t.address), symbol: t.symbol, name: t.name }));
  await setStorage(next);
  return next;
}

export type ListSearchType = "domain" | "address" | "token";
export type ListSearchResult = { value: string; source: "trusted" | "blocked"; list: "feed" | "user"; chainId?: string; address?: string; symbol?: string; name?: string };

/** Local search in lists; returns paginated results. */
export function searchLists(cache: ListsCacheV1, query: string, kind: ListSearchType, limit: number, offset: number): { results: ListSearchResult[]; total: number } {
  const q = (query || "").toLowerCase().trim();
  const results: ListSearchResult[] = [];
  if (kind === "domain") {
    const allTrusted = [...cache.trustedDomains, ...cache.userTrustedDomains];
    const allBlocked = [...cache.blockedDomains, ...cache.userBlockedDomains];
    const trusted = allTrusted.filter((d) => !q || d.toLowerCase().includes(q));
    const blocked = allBlocked.filter((d) => !q || d.toLowerCase().includes(q));
    trusted.forEach((d) => results.push({ value: d, source: "trusted", list: cache.userTrustedDomains.includes(d) ? "user" : "feed" }));
    blocked.forEach((d) => results.push({ value: d, source: "blocked", list: cache.userBlockedDomains.includes(d) ? "user" : "feed" }));
  } else if (kind === "address") {
    const blocked = [...cache.blockedAddresses, ...cache.userBlockedAddresses].filter((a) => !q || a.toLowerCase().includes(q));
    blocked.forEach((a) => results.push({ value: a, source: "blocked", list: cache.userBlockedAddresses.includes(a) ? "user" : "feed" }));
  } else {
    const all = [...cache.scamTokens, ...cache.userScamTokens];
    const filtered = all.filter((t) => !q || t.address.toLowerCase().includes(q) || (t.symbol && t.symbol.toLowerCase().includes(q)) || (t.name && t.name.toLowerCase().includes(q)));
    filtered.forEach((t) => results.push({ value: t.address, source: "blocked", list: cache.userScamTokens.some((u) => u.chainId === t.chainId && u.address === t.address) ? "user" : "feed", chainId: t.chainId, address: t.address, symbol: t.symbol, name: t.name }));
  }
  const total = results.length;
  const paginated = results.slice(offset, offset + limit);
  return { results: paginated, total };
}
