/**
 * V2: List manager — feeds, cache, user overrides. No secrets.
 */

import type { ListsCacheV1, ListSourceName } from "../shared/types";
import { normalizeHost, normalizeAddress, normalizeTokenKey, isHostMatch } from "../shared/utils";
import { TRUSTED_DOMAINS_SEED, BLOCKED_DOMAINS_SEED } from "./listSeeds";

const STORAGE_KEY = "sg_lists_cache_v1";
const LAST_REFRESH_KEY = "sg_lists_last_refresh";
const FETCH_TIMEOUT_MS = 6000;
const TTL_CACHE_MS = 12 * 60 * 60 * 1000; // 12h

function emptyCache(): ListsCacheV1 {
  return {
    version: 1,
    updatedAt: 0,
    sources: {
      metamask: {},
      scamsniffer: {},
      cryptoscamdb: {},
      dappradar: {},
      mew: {},
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
    userTrustedTokens: [],
  };
}

function normalizeChain(c: string): string {
  const s = String(c ?? "").trim().toLowerCase();
  if (!s) return "";
  return s.startsWith("0x") ? s : "0x" + parseInt(s, 10).toString(16);
}

/** Normalize domain from user input: strip protocol/path, lowercase hostname. */
export function normalizeDomainInput(input: string): string {
  const s = (input ?? "").trim();
  if (!s) return "";
  try {
    if (s.includes("://") || s.toLowerCase().startsWith("http")) {
      return new URL(s.startsWith("http") ? s : "https://" + s).hostname.replace(/^www\./, "").toLowerCase().trim() || "";
    }
    return (s.replace(/^www\./, "").toLowerCase().replace(/\.+$/, "").trim()) || "";
  } catch {
    return (s.replace(/^www\./, "").toLowerCase().replace(/\.+$/, "").trim()) || "";
  }
}

/** Normalize address: 0x + 40 hex lower. Returns "" if invalid. */
export function normalizeAddressInput(addr: string): string {
  const s = (addr ?? "").trim();
  const hex = s.startsWith("0x") ? s.slice(2) : s;
  if (hex.length !== 40 || !/^[a-fA-F0-9]{40}$/.test(hex)) return "";
  return "0x" + hex.toLowerCase();
}

/** Parse scam token input: "0x1:0xTOKEN", "1,0xTOKEN", "0x1,0xTOKEN" -> { chainId: "0x1", address: "0xtoken" } or null. */
export function normalizeScamTokenInput(input: string): { chainId: string; address: string } | null {
  const s = (input ?? "").trim();
  if (!s) return null;
  let chainId = "";
  let address = "";
  if (s.includes(":")) {
    const [c, a] = s.split(":").map((x) => x.trim());
    chainId = normalizeChain(c ?? "");
    address = normalizeAddressInput(a ?? "");
  } else if (s.includes(",")) {
    const [c, a] = s.split(",").map((x) => x.trim());
    chainId = normalizeChain(c ?? "");
    address = normalizeAddressInput(a ?? "");
  } else {
    return null;
  }
  if (!chainId || !address) return null;
  return { chainId, address };
}

/** Canonical scam token key: chainIdHex:addressLower */
export function scamTokenToCanonical(chainId: string, address: string): string {
  const c = normalizeChain(chainId);
  const a = normalizeAddressInput(address);
  return c && a ? `${c}:${a}` : "";
}

export function isTrustedToken(chainIdHex: string, tokenAddress: string, cache: ListsCacheV1): boolean {
  const c = normalizeChain(chainIdHex);
  const a = normalizeAddress(tokenAddress);
  if (!c || !a) return false;
  const list = cache.userTrustedTokens ?? [];
  return list.some((t) => normalizeChain(t.chainId) === c && normalizeAddress(t.address) === a);
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

function parseDappRadarTokens(body: string): Array<{ chainId: string; address: string; symbol?: string; name?: string }> {
  try {
    const j = JSON.parse(body);
    const arr = Array.isArray(j) ? j : (j?.tokens ? j.tokens : j?.data) ?? [];
    return arr
      .map((x: any) => {
        const chainId = String(x?.chainId ?? x?.chain ?? "0x1").toLowerCase();
        const addr = normalizeAddress(String(x?.address ?? x?.contract ?? x ?? ""));
        if (!addr) return null;
        const chainIdHex = chainId.startsWith("0x") ? chainId : "0x" + parseInt(chainId, 10).toString(16);
        return {
          chainId: chainIdHex,
          address: addr,
          symbol: typeof x?.symbol === "string" ? x.symbol : undefined,
          name: typeof x?.name === "string" ? x.name : undefined,
          source: "dappradar" as ListSourceName,
        };
      })
      .filter(Boolean) as Array<{ chainId: string; address: string; symbol?: string; name?: string; source: ListSourceName }>;
  } catch {
    return [];
  }
}

function parseMewUrls(body: string): string[] {
  try {
    const j = JSON.parse(body);
    const arr = Array.isArray(j) ? j : (j?.urls ?? j?.list ?? []);
    return arr
      .map((x: any) => (typeof x === "string" ? x : x?.id ?? x?.url ?? "").trim().toLowerCase())
      .filter((u: string) => u && (u.startsWith("http") || u.includes(".")))
      .map((u: string) => {
        try {
          const host = new URL(u.startsWith("http") ? u : "https://" + u).hostname.replace(/^www\./, "");
          return host || "";
        } catch {
          return "";
        }
      })
      .filter(Boolean);
  } catch {
    return [];
  }
}

function parseMewAddresses(body: string): string[] {
  try {
    const j = JSON.parse(body);
    const arr = Array.isArray(j) ? j : (j?.addresses ?? j?.list ?? []);
    return arr
      .map((x: any) => normalizeAddress(String(typeof x === "string" ? x : x?.address ?? x?.id ?? "")))
      .filter(Boolean);
  } catch {
    return [];
  }
}

const MIGRATED_KEY = "sg_lists_migrated_v1";

/** Migrate settings.trustedDomains (sync) to userTrustedDomains (local) once. */
async function migrateTrustedDomainsFromSettings(): Promise<void> {
  try {
    const done = await new Promise<boolean>((resolve) => {
      if (!chrome?.storage?.local) return resolve(true);
      chrome.storage.local.get(MIGRATED_KEY, (r) => resolve(!!(r as any)?.[MIGRATED_KEY]));
    });
    if (done) return;
    const [cached, sync] = await Promise.all([
      getStorage(),
      new Promise<Record<string, unknown>>((resolve) => {
        if (!chrome?.storage?.sync) return resolve({});
        chrome.storage.sync.get(["trustedDomains", "allowlist"], (r) => resolve((r as Record<string, unknown>) ?? {}));
      }),
    ]);
    const fromSettings = (sync.trustedDomains ?? sync.allowlist) as string[] | undefined;
    const arr = Array.isArray(fromSettings) ? fromSettings : [];
    const userTrusted = cached?.userTrustedDomains ?? [];
    if (arr.length > 0 && userTrusted.length === 0) {
      const merged = [...new Set([...arr.map((d) => normalizeHost(String(d))).filter(Boolean), ...userTrusted])];
      if (cached) {
        (cached as ListsCacheV1).userTrustedDomains = merged;
        (cached as ListsCacheV1).updatedAt = Date.now();
        await setStorage(cached);
      } else {
        const fresh = emptyCache();
        fresh.userTrustedDomains = merged;
        fresh.updatedAt = Date.now();
        await setStorage(fresh);
      }
    }
    await new Promise<void>((r) => { chrome.storage.local.set({ [MIGRATED_KEY]: true }, () => r()); });
  } catch {
    /* ignore */
  }
}

export async function getLists(): Promise<ListsCacheV1> {
  await migrateTrustedDomainsFromSettings();
  const cache = await getStorage();
  if (cache) {
    if (!cache.userTrustedTokens) (cache as ListsCacheV1).userTrustedTokens = [];
    return cache;
  }
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

export async function refresh(forceRefresh?: boolean): Promise<ListsCacheV1> {
  const cache = await getLists();
  if (!forceRefresh && cache.updatedAt && Date.now() - cache.updatedAt < TTL_CACHE_MS) {
    return cache;
  }
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

  // ScamSniffer scam-database (domains + addresses)
  const SCAMSNIFFER_DOMAINS_URL = "https://raw.githubusercontent.com/scamsniffer/scam-database/main/blacklist/domains.json";
  const SCAMSNIFFER_ADDRESSES_URL = "https://raw.githubusercontent.com/scamsniffer/scam-database/main/blacklist/address.json";
  try {
    const [ssDomains, ssAddresses] = await Promise.all([
      fetchWithTimeout(SCAMSNIFFER_DOMAINS_URL, updated.sources.scamsniffer?.etag),
      fetchWithTimeout(SCAMSNIFFER_ADDRESSES_URL),
    ]);
    if (ssDomains?.body) {
      const list = parseScamSnifferDomains(ssDomains.body);
      list.forEach((d) => { const n = normalizeHost(d); if (n) blockedSet.add(n); });
    }
    if (ssAddresses?.body) {
      const addrs = parseScamSnifferAddresses(ssAddresses.body);
      addrs.forEach((a) => { if (a) blockedAddrSet.add(a); });
    }
    if (ssDomains?.body || ssAddresses?.body) {
      updated.sources.scamsniffer = { ok: true, updatedAt: Date.now(), etag: ssDomains?.etag };
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

  // MEW ethereum-lists (domains + addresses)
  const MEW_URLS_URL = "https://raw.githubusercontent.com/MyEtherWallet/ethereum-lists/master/src/urls/urls-darklist.json";
  const MEW_ADDRESSES_URL = "https://raw.githubusercontent.com/MyEtherWallet/ethereum-lists/master/src/addresses/addresses-darklist.json";
  try {
    const [mewUrls, mewAddrs] = await Promise.all([
      fetchWithTimeout(MEW_URLS_URL, updated.sources.mew?.etag),
      fetchWithTimeout(MEW_ADDRESSES_URL),
    ]);
    if (mewUrls?.body) {
      const list = parseMewUrls(mewUrls.body);
      list.forEach((d) => { const n = normalizeHost(d); if (n) blockedSet.add(n); });
    }
    if (mewAddrs?.body) {
      const addrs = parseMewAddresses(mewAddrs.body);
      addrs.forEach((a) => { if (a) blockedAddrSet.add(a); });
    }
    if (mewUrls?.body || mewAddrs?.body) {
      updated.sources.mew = { ok: true, updatedAt: Date.now(), etag: mewUrls?.etag };
    } else {
      updated.sources.mew = { ...updated.sources.mew, ok: false, error: "fetch failed" };
    }
  } catch (e) {
    updated.sources.mew = { ...updated.sources.mew, ok: false, error: String((e as Error)?.message ?? e) };
  }

  // DappRadar tokens blacklist
  const DAPPRADAR_TOKENS_URL = "https://raw.githubusercontent.com/dappradar/tokens-blacklist/main/all-tokens.json";
  let dappradarTokenList: ListsCacheV1["scamTokens"] = [];
  try {
    const dr = await fetchWithTimeout(DAPPRADAR_TOKENS_URL, updated.sources.dappradar?.etag);
    if (dr?.body) {
      const tokens = parseDappRadarTokens(dr.body);
      tokens.forEach((t) => {
        const key = normalizeTokenKey(t.chainId, t.address);
        if (key) scamKeys.add(key);
      });
      dappradarTokenList = tokens.map((t) => ({ chainId: t.chainId, address: t.address, symbol: t.symbol, name: t.name, source: "dappradar" as ListSourceName }));
      updated.sources.dappradar = { ok: true, updatedAt: Date.now(), etag: dr.etag };
    } else {
      updated.sources.dappradar = { ...updated.sources.dappradar, ok: false, error: "fetch failed" };
    }
  } catch (e) {
    updated.sources.dappradar = { ...updated.sources.dappradar, ok: false, error: String((e as Error)?.message ?? e) };
  }

  updated.trustedDomains = [...trustedSet];
  updated.blockedDomains = [...blockedSet];
  updated.blockedAddresses = [...blockedAddrSet];
  updated.scamTokens = [...dappradarTokenList, ...cache.userScamTokens];
  await setStorage(updated);
  return updated;
}

export type OverrideType = "trusted_domain" | "blocked_domain" | "blocked_address" | "scam_token" | "trusted_token";
export type OverridePayload = { type?: OverrideType; value?: string; chainId?: string; address?: string; tokenAddress?: string };

/** Normalize legacy options payloads to canonical override format. */
export function normalizeOverridePayload(typeRaw: string, payload: Record<string, unknown>): { type: OverrideType; payload: OverridePayload } | null {
  const t = (typeRaw ?? "").toString().toLowerCase();
  const domain = (payload.domain ?? payload.value ?? "").toString().trim();
  const address = (payload.address ?? payload.tokenAddress ?? payload.value ?? "").toString().trim();
  const chainId = (payload.chainId ?? "").toString().trim();
  if (t === "usertrusteddomains" && domain) return { type: "trusted_domain", payload: { value: domain } };
  if (t === "userblockeddomains" && domain) return { type: "blocked_domain", payload: { value: domain } };
  if (t === "userblockedaddresses" && address) return { type: "blocked_address", payload: { value: address, address } };
  if (t === "userscamtokens" && chainId && address) return { type: "scam_token", payload: { chainId, address } };
  if (t === "usertrustedtokens" && chainId && address) return { type: "trusted_token", payload: { chainId, address } };
  if (t === "trusted_domain" && domain) return { type: "trusted_domain", payload: { value: domain } };
  if (t === "blocked_domain" && domain) return { type: "blocked_domain", payload: { value: domain } };
  if (t === "blocked_address" && address) return { type: "blocked_address", payload: { value: address, address } };
  if (t === "scam_token" && chainId && address) return { type: "scam_token", payload: { chainId, address } };
  if (t === "trusted_token" && chainId && address) return { type: "trusted_token", payload: { chainId, address } };
  return null;
}

export async function upsertUserOverride(type: OverrideType, payload: OverridePayload): Promise<ListsCacheV1> {
  const cache = await getLists();
  const next = { ...cache, userTrustedDomains: [...cache.userTrustedDomains], userBlockedDomains: [...cache.userBlockedDomains], userBlockedAddresses: [...cache.userBlockedAddresses], userScamTokens: [...cache.userScamTokens], userTrustedTokens: [...(cache.userTrustedTokens ?? [])], updatedAt: Date.now() };
  if (type === "trusted_domain") {
    const v = normalizeHost(payload.value ?? "");
    if (v && !next.userTrustedDomains.includes(v)) next.userTrustedDomains.push(v);
  } else if (type === "blocked_domain") {
    const v = normalizeHost(payload.value ?? "");
    if (v && !next.userBlockedDomains.includes(v)) next.userBlockedDomains.push(v);
  } else if (type === "blocked_address") {
    const v = normalizeAddress(payload.value || payload.address || "");
    if (v && !next.userBlockedAddresses.includes(v)) next.userBlockedAddresses.push(v);
  } else if (type === "scam_token" && payload.chainId && payload.address) {
    const addr = normalizeAddress(payload.address);
    const c = normalizeChain(payload.chainId);
    if (addr && c && !next.userScamTokens.some((t) => normalizeChain(t.chainId) === c && t.address === addr)) {
      next.userScamTokens.push({ chainId: c, address: addr });
    }
  } else if (type === "trusted_token" && payload.chainId && payload.address) {
    const addr = normalizeAddress(payload.address);
    const c = normalizeChain(payload.chainId);
    if (addr && c && !next.userTrustedTokens.some((t) => normalizeChain(t.chainId) === c && t.address === addr)) {
      next.userTrustedTokens.push({ chainId: c, address: addr });
    }
  }
  await setStorage(next);
  return next;
}

export async function deleteUserOverride(type: OverrideType, value: string, chainId?: string, address?: string): Promise<ListsCacheV1> {
  const cache = await getLists();
  const next = { ...cache, userTrustedDomains: [...cache.userTrustedDomains], userBlockedDomains: [...cache.userBlockedDomains], userBlockedAddresses: [...cache.userBlockedAddresses], userScamTokens: [...cache.userScamTokens], userTrustedTokens: [...(cache.userTrustedTokens ?? [])], updatedAt: Date.now() };
  if (type === "trusted_domain") next.userTrustedDomains = next.userTrustedDomains.filter((d) => d !== normalizeHost(value));
  else if (type === "blocked_domain") next.userBlockedDomains = next.userBlockedDomains.filter((d) => d !== normalizeHost(value));
  else if (type === "blocked_address") next.userBlockedAddresses = next.userBlockedAddresses.filter((a) => a !== normalizeAddress(value || address || ""));
  else if (type === "scam_token" && chainId && address) next.userScamTokens = next.userScamTokens.filter((t) => !(normalizeChain(t.chainId) === normalizeChain(chainId) && t.address === normalizeAddress(address)));
  else if (type === "trusted_token" && chainId && address) next.userTrustedTokens = next.userTrustedTokens.filter((t) => !(normalizeChain(t.chainId) === normalizeChain(chainId) && t.address === normalizeAddress(address)));
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

export type OverrideKind = "trustedDomains" | "blockedDomains" | "blockedAddresses" | "scamTokens";

export type SetOverridesResult = { ok: boolean; cache: ListsCacheV1; invalidCount?: number; invalidExamples?: string[] };

/** Replace entire user override list. Validates each item; invalid ones are skipped and reported. */
export async function setOverrides(kind: OverrideKind, values: string[]): Promise<SetOverridesResult> {
  const cache = await getLists();
  const next = { ...cache, updatedAt: Date.now() };
  const invalid: string[] = [];
  const raw = Array.isArray(values) ? values : [];

  if (kind === "trustedDomains" || kind === "blockedDomains") {
    const normalized: string[] = [];
    for (const v of raw) {
      const n = normalizeDomainInput(v);
      if (n) normalized.push(n);
      else if (v.trim()) invalid.push(v);
    }
    next.userTrustedDomains = kind === "trustedDomains" ? [...new Set(normalized)] : [...next.userTrustedDomains];
    next.userBlockedDomains = kind === "blockedDomains" ? [...new Set(normalized)] : [...next.userBlockedDomains];
  } else if (kind === "blockedAddresses") {
    const normalized: string[] = [];
    for (const v of raw) {
      const n = normalizeAddressInput(v);
      if (n) normalized.push(n);
      else if (v.trim()) invalid.push(v);
    }
    next.userBlockedAddresses = [...new Set(normalized)];
  } else if (kind === "scamTokens") {
    const tokens: Array<{ chainId: string; address: string }> = [];
    const seen = new Set<string>();
    for (const v of raw) {
      const parsed = normalizeScamTokenInput(v);
      if (parsed) {
        const key = `${parsed.chainId}:${parsed.address}`;
        if (!seen.has(key)) {
          seen.add(key);
          tokens.push(parsed);
        }
      } else if (v.trim()) invalid.push(v);
    }
    next.userScamTokens = tokens;
  }

  await setStorage(next);
  return {
    ok: true,
    cache: next,
    invalidCount: invalid.length,
    invalidExamples: invalid.length > 0 ? invalid.slice(0, 5) : undefined,
  };
}

export type ListsExportSnapshot = {
  updatedAt: number;
  sources: Array<{ name: string; ok: boolean; count?: number; error?: string }>;
  overrides: {
    trustedDomains: string[];
    blockedDomains: string[];
    blockedAddresses: string[];
    scamTokens: Array<{ chainId: string; address: string }>;
  };
  totals: {
    trustedDomainsTotal: number;
    blockedDomainsTotal: number;
    blockedAddressesTotal: number;
    scamTokensTotal: number;
  };
};

/** Export full snapshot for UI: overrides + totals + source stats. */
export async function exportSnapshot(): Promise<ListsExportSnapshot> {
  const cache = await getLists();
  const trustedEffective = [...new Set([...cache.trustedDomains, ...cache.userTrustedDomains])];
  const blockedDomainsEffective = [...new Set([...cache.blockedDomains, ...cache.userBlockedDomains])];
  const blockedAddressesEffective = [...new Set([...cache.blockedAddresses, ...cache.userBlockedAddresses])];
  const scamKeys = new Set<string>();
  for (const t of cache.scamTokens) scamKeys.add(normalizeTokenKey(t.chainId, t.address));
  for (const t of cache.userScamTokens) scamKeys.add(normalizeTokenKey(t.chainId, t.address));

  const sourceList: Array<{ name: string; ok: boolean; count?: number; error?: string }> = [];
  const src = cache.sources;
  if (src.metamask) sourceList.push({ name: "MetaMask", ok: !!src.metamask.ok, error: src.metamask.error });
  if (src.scamsniffer) sourceList.push({ name: "ScamSniffer", ok: !!src.scamsniffer.ok, error: src.scamsniffer.error });
  if (src.cryptoscamdb) sourceList.push({ name: "CryptoScamDB", ok: !!src.cryptoscamdb.ok, error: src.cryptoscamdb.error });
  if (src.mew) sourceList.push({ name: "MEW", ok: !!src.mew.ok, error: src.mew.error });
  if (src.dappradar) sourceList.push({ name: "DappRadar", ok: !!src.dappradar.ok, error: src.dappradar.error });
  if (src.seed) sourceList.push({ name: "Seed", ok: !!src.seed.ok });

  return {
    updatedAt: cache.updatedAt,
    sources: sourceList,
    overrides: {
      trustedDomains: cache.userTrustedDomains ?? [],
      blockedDomains: cache.userBlockedDomains ?? [],
      blockedAddresses: cache.userBlockedAddresses ?? [],
      scamTokens: (cache.userScamTokens ?? []).map((t) => ({ chainId: t.chainId, address: t.address })),
    },
    totals: {
      trustedDomainsTotal: trustedEffective.length,
      blockedDomainsTotal: blockedDomainsEffective.length,
      blockedAddressesTotal: blockedAddressesEffective.length,
      scamTokensTotal: scamKeys.size,
    },
  };
}

/** Merge only user overrides from imported data; validates and saves. */
export async function importUserOverrides(data: {
  userTrustedDomains?: string[];
  userBlockedDomains?: string[];
  userBlockedAddresses?: string[];
  userScamTokens?: Array<{ chainId: string; address: string; symbol?: string; name?: string }>;
  userTrustedTokens?: Array<{ chainId: string; address: string }>;
}): Promise<ListsCacheV1> {
  const cache = await getLists();
  const next = { ...cache, updatedAt: Date.now() };
  if (Array.isArray(data.userTrustedDomains)) next.userTrustedDomains = data.userTrustedDomains.map((d) => normalizeHost(String(d))).filter(Boolean);
  if (Array.isArray(data.userBlockedDomains)) next.userBlockedDomains = data.userBlockedDomains.map((d) => normalizeHost(String(d))).filter(Boolean);
  if (Array.isArray(data.userBlockedAddresses)) next.userBlockedAddresses = data.userBlockedAddresses.map((a) => normalizeAddress(String(a))).filter(Boolean);
  if (Array.isArray(data.userScamTokens)) next.userScamTokens = data.userScamTokens.filter((t) => t && t.chainId && t.address).map((t) => ({ chainId: normalizeChain(String(t.chainId)), address: normalizeAddress(t.address), symbol: t.symbol, name: t.name }));
  if (Array.isArray(data.userTrustedTokens)) next.userTrustedTokens = data.userTrustedTokens.filter((t) => t && t.chainId && t.address).map((t) => ({ chainId: normalizeChain(String(t.chainId)), address: normalizeAddress(t.address) }));
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
