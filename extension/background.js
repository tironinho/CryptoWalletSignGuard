var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// src/shared/utils.ts
function hostFromUrl(url) {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return "";
  }
}
function normalizeDomainLine(s) {
  return (s || "").trim().toLowerCase().replace(/^\.+/, "").replace(/\.+$/, "");
}
function isAllowlisted(host, allowlist) {
  const h = (host || "").toLowerCase();
  return allowlist.some((d) => {
    const dom = normalizeDomainLine(d);
    if (!dom) return false;
    return h === dom || h.endsWith("." + dom);
  });
}
function normalizeHost(host) {
  return (host || "").toLowerCase().replace(/\.+$/, "").trim();
}
function isHostMatch(host, domain) {
  const h = normalizeHost(host);
  const d = (domain || "").toLowerCase().trim();
  if (!d) return false;
  return h === d || h.endsWith("." + d);
}
function normalizeAddress(addr) {
  const s = (addr || "").trim();
  const hex = s.startsWith("0x") ? s.slice(2) : s;
  if (hex.length !== 40 || !/^[a-fA-F0-9]{40}$/.test(hex)) return "";
  return "0x" + hex.toLowerCase();
}
function normalizeTokenKey(chainId, addr) {
  const a = normalizeAddress(addr);
  const c = (chainId || "").toLowerCase().replace(/^0x/, "") || "0";
  return `${c}:${a}`;
}
function isHexString(v) {
  return typeof v === "string" && /^0x[0-9a-fA-F]*$/.test(v);
}
function hexSelector(data) {
  if (!isHexString(data) || data.length < 10) return null;
  return data.slice(0, 10).toLowerCase();
}
var init_utils = __esm({
  "src/shared/utils.ts"() {
    "use strict";
  }
});

// src/services/listSeeds.ts
var TRUSTED_DOMAINS_SEED, BLOCKED_DOMAINS_SEED;
var init_listSeeds = __esm({
  "src/services/listSeeds.ts"() {
    "use strict";
    TRUSTED_DOMAINS_SEED = [
      "metamask.io",
      "metamask.com",
      "rainbow.me",
      "walletconnect.com",
      "walletconnect.org",
      "phantom.app",
      "solana.com",
      // Explorers
      "etherscan.io",
      "etherscan.com",
      "arbiscan.io",
      "polygonscan.com",
      "bscscan.com",
      "snowtrace.io",
      "basescan.org",
      // Marketplaces
      "opensea.io",
      "blur.io",
      "magiceden.io",
      "rarible.com",
      "looksrare.org",
      "x2y2.io",
      // DEX / DeFi
      "app.uniswap.org",
      "uniswap.org",
      "aave.com",
      "curve.fi",
      "1inch.io",
      "sushiswap.fi",
      "pancakeswap.finance",
      "pancakeswap.com",
      "compound.finance",
      // Bridges
      "bridge.arbitrum.io",
      "bridge.base.org",
      "portal.polygon.technology",
      // Chains / info
      "arbitrum.io",
      "polygon.technology",
      "avax.network",
      "bnbchain.org",
      "base.org",
      "optimism.io",
      "ens.domains",
      "revoke.cash",
      "dexscreener.com",
      "coingecko.com"
    ];
    BLOCKED_DOMAINS_SEED = [
      // Minimal seed; feeds will add more
    ];
  }
});

// src/services/listManager.ts
var listManager_exports = {};
__export(listManager_exports, {
  deleteUserOverride: () => deleteUserOverride,
  getDomainDecision: () => getDomainDecision,
  getLastRefresh: () => getLastRefresh,
  getLists: () => getLists,
  importUserOverrides: () => importUserOverrides,
  isBlockedAddress: () => isBlockedAddress,
  isScamToken: () => isScamToken,
  refresh: () => refresh,
  searchLists: () => searchLists,
  upsertUserOverride: () => upsertUserOverride
});
function emptyCache() {
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
      user: {}
    },
    trustedDomains: [],
    blockedDomains: [],
    blockedAddresses: [],
    scamTokens: [],
    userTrustedDomains: [],
    userBlockedDomains: [],
    userBlockedAddresses: [],
    userScamTokens: []
  };
}
function getStorage() {
  return new Promise((resolve) => {
    try {
      if (!chrome?.storage?.local) return resolve(null);
      chrome.storage.local.get(STORAGE_KEY, (r) => {
        if (chrome.runtime?.lastError) return resolve(null);
        const v = r?.[STORAGE_KEY];
        resolve(v && typeof v === "object" && v.version === 1 ? v : null);
      });
    } catch {
      resolve(null);
    }
  });
}
function setStorage(cache) {
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
async function fetchWithTimeout3(url, etag) {
  try {
    const ctrl = new AbortController();
    const t2 = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS4);
    const headers = {};
    if (etag) headers["If-None-Match"] = etag;
    const res = await fetch(url, { signal: ctrl.signal, headers });
    clearTimeout(t2);
    const newEtag = res.headers.get("etag") ?? void 0;
    if (res.status === 304) return { body: "", etag: newEtag ?? etag };
    const body = await res.text();
    return { body, etag: newEtag ?? void 0 };
  } catch {
    return null;
  }
}
function parseMetamask(body) {
  try {
    const j = JSON.parse(body);
    const blocklist = j.blocklist;
    const whitelist = j.whitelist;
    return { blocklist: Array.isArray(blocklist) ? blocklist : void 0, whitelist: Array.isArray(whitelist) ? whitelist : void 0 };
  } catch {
    return {};
  }
}
function parseScamSnifferDomains(body) {
  try {
    const j = JSON.parse(body);
    if (Array.isArray(j)) return j.map((x) => String(x?.domain ?? x ?? "").toLowerCase()).filter(Boolean);
    if (j && typeof j === "object" && Array.isArray(j.domains)) return j.domains.map((x) => String(x?.domain ?? x ?? "").toLowerCase()).filter(Boolean);
    return [];
  } catch {
    return [];
  }
}
function parseScamSnifferAddresses(body) {
  try {
    const j = JSON.parse(body);
    if (Array.isArray(j)) return j.map((x) => normalizeAddress(String(x?.address ?? x ?? ""))).filter(Boolean);
    return [];
  } catch {
    return [];
  }
}
function parseCryptoScamDb(body) {
  try {
    const j = JSON.parse(body);
    const result = j.result;
    if (!result) return {};
    return {
      blacklist: Array.isArray(result.blacklist) ? result.blacklist : void 0,
      whitelist: Array.isArray(result.whitelist) ? result.whitelist : void 0
    };
  } catch {
    return {};
  }
}
function parseDappRadarTokens(body) {
  try {
    const j = JSON.parse(body);
    const arr = Array.isArray(j) ? j : (j?.tokens ? j.tokens : j?.data) ?? [];
    return arr.map((x) => {
      const chainId = String(x?.chainId ?? x?.chain ?? "0x1").toLowerCase();
      const addr = normalizeAddress(String(x?.address ?? x?.contract ?? x ?? ""));
      if (!addr) return null;
      const chainIdHex = chainId.startsWith("0x") ? chainId : "0x" + parseInt(chainId, 10).toString(16);
      return {
        chainId: chainIdHex,
        address: addr,
        symbol: typeof x?.symbol === "string" ? x.symbol : void 0,
        name: typeof x?.name === "string" ? x.name : void 0,
        source: "dappradar"
      };
    }).filter(Boolean);
  } catch {
    return [];
  }
}
function parseMewUrls(body) {
  try {
    const j = JSON.parse(body);
    const arr = Array.isArray(j) ? j : j?.urls ?? j?.list ?? [];
    return arr.map((x) => (typeof x === "string" ? x : x?.id ?? x?.url ?? "").trim().toLowerCase()).filter((u) => u && (u.startsWith("http") || u.includes("."))).map((u) => {
      try {
        const host = new URL(u.startsWith("http") ? u : "https://" + u).hostname.replace(/^www\./, "");
        return host || "";
      } catch {
        return "";
      }
    }).filter(Boolean);
  } catch {
    return [];
  }
}
function parseMewAddresses(body) {
  try {
    const j = JSON.parse(body);
    const arr = Array.isArray(j) ? j : j?.addresses ?? j?.list ?? [];
    return arr.map((x) => normalizeAddress(String(typeof x === "string" ? x : x?.address ?? x?.id ?? ""))).filter(Boolean);
  } catch {
    return [];
  }
}
async function getLists() {
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
function getDomainDecision(host, cache) {
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
function isBlockedAddress(addr, cache) {
  const a = normalizeAddress(addr);
  if (!a) return false;
  if (cache.userBlockedAddresses.includes(a)) return true;
  return cache.blockedAddresses.includes(a);
}
function isScamToken(chainId, tokenAddress, cache) {
  const key = normalizeTokenKey(chainId, tokenAddress);
  if (!key) return false;
  const [c, addr] = key.split(":");
  const userMatch = cache.userScamTokens.some((t2) => normalizeTokenKey(t2.chainId, t2.address) === key);
  if (userMatch) return true;
  return cache.scamTokens.some((t2) => normalizeTokenKey(t2.chainId, t2.address) === key);
}
async function refresh(forceRefresh) {
  const cache = await getLists();
  if (!forceRefresh && cache.updatedAt && Date.now() - cache.updatedAt < TTL_CACHE_MS) {
    return cache;
  }
  const updated = { ...cache, updatedAt: Date.now() };
  const trustedSet = new Set(updated.trustedDomains);
  const blockedSet = new Set(updated.blockedDomains);
  const blockedAddrSet = new Set(updated.blockedAddresses);
  const scamKeys = new Set(updated.scamTokens.map((t2) => normalizeTokenKey(t2.chainId, t2.address)));
  try {
    const meta = await fetchWithTimeout3("https://raw.githubusercontent.com/MetaMask/eth-phishing-detect/main/src/config.json", updated.sources.metamask?.etag);
    if (meta?.body) {
      const { blocklist, whitelist } = parseMetamask(meta.body);
      updated.sources.metamask = { ok: true, updatedAt: Date.now(), etag: meta.etag };
      if (blocklist) blocklist.forEach((d) => {
        const n = normalizeHost(d);
        if (n) blockedSet.add(n);
      });
      if (whitelist) whitelist.forEach((d) => {
        const n = normalizeHost(d);
        if (n) trustedSet.add(n);
      });
    } else {
      updated.sources.metamask = { ...updated.sources.metamask, ok: false, error: "fetch failed" };
    }
  } catch (e) {
    updated.sources.metamask = { ...updated.sources.metamask, ok: false, error: String(e?.message ?? e) };
  }
  const SCAMSNIFFER_DOMAINS_URL = "https://raw.githubusercontent.com/scamsniffer/scam-database/main/blacklist/domains.json";
  const SCAMSNIFFER_ADDRESSES_URL = "https://raw.githubusercontent.com/scamsniffer/scam-database/main/blacklist/address.json";
  try {
    const [ssDomains, ssAddresses] = await Promise.all([
      fetchWithTimeout3(SCAMSNIFFER_DOMAINS_URL, updated.sources.scamsniffer?.etag),
      fetchWithTimeout3(SCAMSNIFFER_ADDRESSES_URL)
    ]);
    if (ssDomains?.body) {
      const list = parseScamSnifferDomains(ssDomains.body);
      list.forEach((d) => {
        const n = normalizeHost(d);
        if (n) blockedSet.add(n);
      });
    }
    if (ssAddresses?.body) {
      const addrs = parseScamSnifferAddresses(ssAddresses.body);
      addrs.forEach((a) => {
        if (a) blockedAddrSet.add(a);
      });
    }
    if (ssDomains?.body || ssAddresses?.body) {
      updated.sources.scamsniffer = { ok: true, updatedAt: Date.now(), etag: ssDomains?.etag };
    } else {
      updated.sources.scamsniffer = { ...updated.sources.scamsniffer, ok: false, error: "fetch failed" };
    }
  } catch (e) {
    updated.sources.scamsniffer = { ...updated.sources.scamsniffer, ok: false, error: String(e?.message ?? e) };
  }
  try {
    const csdb = await fetchWithTimeout3("https://api.cryptoscamdb.org/v1/blacklist", updated.sources.cryptoscamdb?.etag);
    if (csdb?.body) {
      const { blacklist, whitelist } = parseCryptoScamDb(csdb.body);
      if (blacklist) blacklist.forEach((d) => {
        const n = normalizeHost(d);
        if (n) blockedSet.add(n);
      });
      if (whitelist) whitelist.forEach((d) => {
        const n = normalizeHost(d);
        if (n) trustedSet.add(n);
      });
      updated.sources.cryptoscamdb = { ok: true, updatedAt: Date.now(), etag: csdb.etag };
    } else {
      updated.sources.cryptoscamdb = { ...updated.sources.cryptoscamdb, ok: false, error: "fetch failed" };
    }
  } catch (e) {
    updated.sources.cryptoscamdb = { ...updated.sources.cryptoscamdb, ok: false, error: String(e?.message ?? e) };
  }
  const MEW_URLS_URL = "https://raw.githubusercontent.com/MyEtherWallet/ethereum-lists/master/src/urls/urls-darklist.json";
  const MEW_ADDRESSES_URL = "https://raw.githubusercontent.com/MyEtherWallet/ethereum-lists/master/src/addresses/addresses-darklist.json";
  try {
    const [mewUrls, mewAddrs] = await Promise.all([
      fetchWithTimeout3(MEW_URLS_URL, updated.sources.mew?.etag),
      fetchWithTimeout3(MEW_ADDRESSES_URL)
    ]);
    if (mewUrls?.body) {
      const list = parseMewUrls(mewUrls.body);
      list.forEach((d) => {
        const n = normalizeHost(d);
        if (n) blockedSet.add(n);
      });
    }
    if (mewAddrs?.body) {
      const addrs = parseMewAddresses(mewAddrs.body);
      addrs.forEach((a) => {
        if (a) blockedAddrSet.add(a);
      });
    }
    if (mewUrls?.body || mewAddrs?.body) {
      updated.sources.mew = { ok: true, updatedAt: Date.now(), etag: mewUrls?.etag };
    } else {
      updated.sources.mew = { ...updated.sources.mew, ok: false, error: "fetch failed" };
    }
  } catch (e) {
    updated.sources.mew = { ...updated.sources.mew, ok: false, error: String(e?.message ?? e) };
  }
  const DAPPRADAR_TOKENS_URL = "https://raw.githubusercontent.com/dappradar/tokens-blacklist/main/all-tokens.json";
  let dappradarTokenList = [];
  try {
    const dr = await fetchWithTimeout3(DAPPRADAR_TOKENS_URL, updated.sources.dappradar?.etag);
    if (dr?.body) {
      const tokens = parseDappRadarTokens(dr.body);
      tokens.forEach((t2) => {
        const key = normalizeTokenKey(t2.chainId, t2.address);
        if (key) scamKeys.add(key);
      });
      dappradarTokenList = tokens.map((t2) => ({ chainId: t2.chainId, address: t2.address, symbol: t2.symbol, name: t2.name, source: "dappradar" }));
      updated.sources.dappradar = { ok: true, updatedAt: Date.now(), etag: dr.etag };
    } else {
      updated.sources.dappradar = { ...updated.sources.dappradar, ok: false, error: "fetch failed" };
    }
  } catch (e) {
    updated.sources.dappradar = { ...updated.sources.dappradar, ok: false, error: String(e?.message ?? e) };
  }
  updated.trustedDomains = [...trustedSet];
  updated.blockedDomains = [...blockedSet];
  updated.blockedAddresses = [...blockedAddrSet];
  updated.scamTokens = [...dappradarTokenList, ...cache.userScamTokens];
  await setStorage(updated);
  return updated;
}
async function upsertUserOverride(type, payload) {
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
    if (addr && !next.userScamTokens.some((t2) => t2.chainId === payload.chainId && t2.address === addr)) {
      next.userScamTokens.push({ chainId: payload.chainId, address: addr });
    }
  }
  await setStorage(next);
  return next;
}
async function deleteUserOverride(type, value, chainId, address) {
  const cache = await getLists();
  const next = { ...cache, userTrustedDomains: [...cache.userTrustedDomains], userBlockedDomains: [...cache.userBlockedDomains], userBlockedAddresses: [...cache.userBlockedAddresses], userScamTokens: [...cache.userScamTokens], updatedAt: Date.now() };
  if (type === "trusted_domain") next.userTrustedDomains = next.userTrustedDomains.filter((d) => d !== normalizeHost(value));
  else if (type === "blocked_domain") next.userBlockedDomains = next.userBlockedDomains.filter((d) => d !== normalizeHost(value));
  else if (type === "blocked_address") next.userBlockedAddresses = next.userBlockedAddresses.filter((a) => a !== normalizeAddress(value || address || ""));
  else if (type === "scam_token" && chainId && address) next.userScamTokens = next.userScamTokens.filter((t2) => !(t2.chainId === chainId && t2.address === normalizeAddress(address)));
  await setStorage(next);
  return next;
}
async function getLastRefresh() {
  return new Promise((resolve) => {
    try {
      if (!chrome?.storage?.local) return resolve(0);
      chrome.storage.local.get(LAST_REFRESH_KEY, (r) => {
        const v = r?.[LAST_REFRESH_KEY];
        resolve(typeof v === "number" ? v : 0);
      });
    } catch {
      resolve(0);
    }
  });
}
async function importUserOverrides(data) {
  const cache = await getLists();
  const next = { ...cache, updatedAt: Date.now() };
  if (Array.isArray(data.userTrustedDomains)) next.userTrustedDomains = data.userTrustedDomains.map((d) => normalizeHost(String(d))).filter(Boolean);
  if (Array.isArray(data.userBlockedDomains)) next.userBlockedDomains = data.userBlockedDomains.map((d) => normalizeHost(String(d))).filter(Boolean);
  if (Array.isArray(data.userBlockedAddresses)) next.userBlockedAddresses = data.userBlockedAddresses.map((a) => normalizeAddress(String(a))).filter(Boolean);
  if (Array.isArray(data.userScamTokens)) next.userScamTokens = data.userScamTokens.filter((t2) => t2 && t2.chainId && t2.address).map((t2) => ({ chainId: String(t2.chainId), address: normalizeAddress(t2.address), symbol: t2.symbol, name: t2.name }));
  await setStorage(next);
  return next;
}
function searchLists(cache, query, kind, limit, offset) {
  const q = (query || "").toLowerCase().trim();
  const results = [];
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
    const filtered = all.filter((t2) => !q || t2.address.toLowerCase().includes(q) || t2.symbol && t2.symbol.toLowerCase().includes(q) || t2.name && t2.name.toLowerCase().includes(q));
    filtered.forEach((t2) => results.push({ value: t2.address, source: "blocked", list: cache.userScamTokens.some((u) => u.chainId === t2.chainId && u.address === t2.address) ? "user" : "feed", chainId: t2.chainId, address: t2.address, symbol: t2.symbol, name: t2.name }));
  }
  const total = results.length;
  const paginated = results.slice(offset, offset + limit);
  return { results: paginated, total };
}
var STORAGE_KEY, LAST_REFRESH_KEY, FETCH_TIMEOUT_MS4, TTL_CACHE_MS;
var init_listManager = __esm({
  "src/services/listManager.ts"() {
    "use strict";
    init_utils();
    init_listSeeds();
    STORAGE_KEY = "sg_lists_cache_v1";
    LAST_REFRESH_KEY = "sg_lists_last_refresh";
    FETCH_TIMEOUT_MS4 = 6e3;
    TTL_CACHE_MS = 12 * 60 * 60 * 1e3;
  }
});

// src/shared/types.ts
var SUPPORTED_WALLETS = [
  { name: "MetaMask", kind: "EVM" },
  { name: "Coinbase Wallet", kind: "EVM" },
  { name: "Trust Wallet", kind: "EVM" },
  { name: "OKX Wallet", kind: "EVM" },
  { name: "Binance Web3", kind: "EVM" },
  { name: "Rabby", kind: "EVM" },
  { name: "Rainbow", kind: "EVM" },
  { name: "Phantom", kind: "EVM/Solana" },
  { name: "Brave Wallet", kind: "EVM" },
  { name: "Bitget Wallet", kind: "EVM" },
  { name: "MathWallet", kind: "EVM" },
  { name: "Solflare", kind: "Solana" },
  { name: "Backpack", kind: "Solana" }
];
var DEFAULT_SETTINGS = {
  riskWarnings: true,
  showConnectOverlay: true,
  blockHighRisk: true,
  requireTypedOverride: true,
  allowOverrideOnPhishing: false,
  debugMode: false,
  domainChecks: true,
  mode: "BALANCED",
  strictBlockApprovalsUnlimited: true,
  strictBlockSetApprovalForAll: true,
  strictBlockPermitLike: true,
  assetEnrichmentEnabled: true,
  addressIntelEnabled: true,
  cloudIntelOptIn: true,
  showUsd: true,
  defaultExpandDetails: true,
  planTier: "FREE",
  licenseKey: "",
  trustedDomains: [
    "opensea.io",
    "blur.io",
    "app.uniswap.org",
    "uniswap.org",
    "looksrare.org",
    "x2y2.io",
    "etherscan.io",
    "arbitrum.io",
    "polygon.technology"
  ],
  supportedWalletsInfo: SUPPORTED_WALLETS,
  allowlist: [
    "opensea.io",
    "blur.io",
    "app.uniswap.org",
    "uniswap.org",
    "looksrare.org",
    "x2y2.io",
    "etherscan.io",
    "arbitrum.io",
    "polygon.technology"
  ],
  customBlockedDomains: [],
  customTrustedDomains: [],
  enableIntel: true,
  vault: {
    enabled: false,
    lockedContracts: []
  },
  simulation: {
    enabled: false,
    tenderlyAccount: "",
    tenderlyProject: "",
    tenderlyKey: ""
  },
  whitelistedDomains: [],
  fortressMode: false
};

// src/shared/decode.ts
init_utils();
var SELECTOR_ERC20_APPROVE = "0x095ea7b3";
var SELECTOR_SET_APPROVAL_FOR_ALL = "0xa22cb465";
var SELECTOR_TRANSFER = "0xa9059cbb";
var SELECTOR_TRANSFER_FROM = "0x23b872dd";
var SELECTOR_SAFE_TRANSFER_FROM_1 = "0x42842e0e";
var SELECTOR_SAFE_TRANSFER_FROM_2 = "0xb88d4fde";
var SELECTOR_ERC1155_SAFE_TRANSFER = "0xf242432a";
var SELECTOR_ERC1155_SAFE_BATCH_TRANSFER = "0x2eb2c2d6";
var SELECTOR_PERMIT = "0xd505accf";
var MAX_UINT256 = 2n ** 256n - 1n;
function isMaxUint256Word(word64) {
  return /^[fF]{64}$/.test(word64);
}
function wordAt(dataNo0x, wordIndex) {
  const start = wordIndex * 64;
  const end = start + 64;
  if (dataNo0x.length < end) return null;
  return dataNo0x.slice(start, end);
}
function readWord(dataHex, wordIndex) {
  const data = dataHex.startsWith("0x") ? dataHex.slice(2) : dataHex;
  const start = wordIndex * 64;
  return data.slice(start, start + 64);
}
function readAddress(dataHex, wordIndex) {
  const word = readWord(dataHex, wordIndex);
  return ("0x" + (word.length >= 40 ? word.slice(24) : word.padStart(40, "0"))).toLowerCase();
}
function readUint256(dataHex, wordIndex) {
  const word = readWord(dataHex, wordIndex);
  if (!word) return 0n;
  return BigInt("0x" + word);
}
function decodeTx(data, txTo) {
  if (!isHexString(data) || data.length < 10) return null;
  const lower = data.toLowerCase();
  const selector = lower.slice(0, 10);
  const body = lower.slice(10);
  const token = (txTo || "").toLowerCase();
  if (selector === SELECTOR_ERC20_APPROVE) {
    const spender = readAddress(body, 0);
    const amount = readUint256(body, 2);
    const amountType = amount === MAX_UINT256 ? "UNLIMITED" : "LIMITED";
    return { kind: "APPROVE_ERC20", token, spender, amountType, amountRaw: amount.toString() };
  }
  if (selector === SELECTOR_TRANSFER) {
    const to = readAddress(body, 0);
    const amount = readUint256(body, 2);
    return { kind: "TRANSFER_ERC20", token, to, amountRaw: amount.toString() };
  }
  if (selector === SELECTOR_TRANSFER_FROM) {
    const from = readAddress(body, 0);
    const to = readAddress(body, 1);
    const amount = readUint256(body, 2);
    return { kind: "TRANSFERFROM_ERC20", token, from, to, amountRaw: amount.toString() };
  }
  if (selector === SELECTOR_SET_APPROVAL_FOR_ALL) {
    const operator = readAddress(body, 0);
    const approved = readUint256(body, 2) !== 0n;
    return { kind: "SET_APPROVAL_FOR_ALL", token, operator, approved };
  }
  if (selector === SELECTOR_SAFE_TRANSFER_FROM_1 || selector === SELECTOR_SAFE_TRANSFER_FROM_2) {
    const from = readAddress(body, 0);
    const to = readAddress(body, 2);
    const tokenId = readUint256(body, 4);
    return { kind: "TRANSFER_NFT", token, to, tokenIdRaw: tokenId.toString(), standard: "ERC721" };
  }
  if (selector === SELECTOR_ERC1155_SAFE_TRANSFER) {
    const from = readAddress(body, 0);
    const to = readAddress(body, 1);
    const id = readUint256(body, 2);
    const amount = readUint256(body, 3);
    return { kind: "TRANSFER_NFT", token, from, to, tokenIdRaw: id.toString(), amountRaw: amount.toString(), standard: "ERC1155" };
  }
  if (selector === SELECTOR_ERC1155_SAFE_BATCH_TRANSFER) {
    const from = readAddress(body, 0);
    const to = readAddress(body, 1);
    return { kind: "TRANSFER_NFT", token, from, to, standard: "ERC1155", batch: true };
  }
  if (selector === SELECTOR_PERMIT) {
    const spender = readAddress(body, 1);
    const value = readUint256(body, 2);
    const deadline = readUint256(body, 3);
    const valueType = value === MAX_UINT256 ? "UNLIMITED" : "LIMITED";
    return { kind: "PERMIT_EIP2612", token, spender, valueType, valueRaw: value.toString(), deadlineRaw: deadline.toString() };
  }
  return { kind: "UNKNOWN", selector };
}
function decodeErc20Approve(data) {
  if (!isHexString(data)) return null;
  const lower = data.toLowerCase();
  if (!lower.startsWith(SELECTOR_ERC20_APPROVE)) return null;
  const body = lower.slice(10);
  const spenderWord = wordAt(body, 0);
  const valueWord = wordAt(body, 1);
  if (!spenderWord || !valueWord) return null;
  const spender = ("0x" + spenderWord.slice(24)).toLowerCase();
  let value = null;
  try {
    value = BigInt("0x" + valueWord);
  } catch {
    value = null;
  }
  return {
    spender,
    isMax: isMaxUint256Word(valueWord),
    value
  };
}
function decodeSetApprovalForAll(data) {
  if (!isHexString(data)) return null;
  const lower = data.toLowerCase();
  if (!lower.startsWith(SELECTOR_SET_APPROVAL_FOR_ALL)) return null;
  const body = lower.slice(10);
  const operatorWord = wordAt(body, 0);
  const approvedWord = wordAt(body, 1);
  if (!operatorWord || !approvedWord) return null;
  const operator = ("0x" + operatorWord.slice(24)).toLowerCase();
  const approved = /^0{63}1$/.test(approvedWord);
  return { operator, approved };
}

// src/background.ts
init_utils();

// src/txMath.ts
function hexToBigInt(hex) {
  if (!hex) return 0n;
  try {
    return BigInt(hex);
  } catch {
    return 0n;
  }
}
function weiToEth(wei, decimals = 6) {
  const base = 10n ** 18n;
  const whole = wei / base;
  const frac = wei % base;
  const fracStr = frac.toString().padStart(18, "0").slice(0, decimals);
  const s = `${whole}.${fracStr}`;
  return s.replace(/\.?0+$/, (m) => m === "." ? "" : m);
}
function shortAddr(addr) {
  if (!addr || typeof addr !== "string") return "";
  if (addr.length <= 12) return addr;
  return addr.slice(0, 6) + "\u2026" + addr.slice(-4);
}

// src/i18n.ts
function detectLocale() {
  const raw = (navigator.languages?.[0] || navigator.language || "en").toLowerCase();
  if (raw.startsWith("pt")) return "pt";
  return "en";
}
var dict = {
  pt: {
    tech_displayAction: "A\xE7\xE3o (classifica\xE7\xE3o)",
    tech_methodRaw: "M\xE9todo (raw)",
    tech_recommendScoreLevel: "Recomenda\xE7\xE3o/score/n\xEDvel",
    tech_reasons: "Motivos",
    tech_decoded: "Decodificado",
    dash: "\u2014",
    tx_to: "To",
    tx_data_length: "Tamanho do data",
    more_whatItDoes: "O que isso faz",
    more_risks: "Riscos",
    more_safeNotes: "Notas de seguran\xE7a",
    more_nextSteps: "Pr\xF3ximos passos",
    // Brand
    extName: "Crypto Wallet SignGuard",
    // Overlay - generic labels
    overlay_requested_title: "O que est\xE1 sendo solicitado",
    overlay_site_trusted_title: "Site confi\xE1vel?",
    overlay_summary_title: "Resumo (linguagem simples)",
    overlay_recommended_title: "A\xE7\xE3o recomendada",
    overlay_note_title: "Observa\xE7\xE3o",
    // Overlay - details sections
    details_tx_title: "Detalhes da transa\xE7\xE3o",
    details_tech_title: "Detalhes t\xE9cnicos",
    details_more_title: "Mais explica\xE7\xF5es",
    // Queue
    queue_indicator: "Fila: {pos} de {total}",
    // Action titles
    action_CONNECT_title: "Conectar carteira",
    action_REQUEST_PERMISSIONS_title: "Solicitar permiss\xF5es",
    action_SWITCH_CHAIN_title: "Trocar rede",
    action_ADD_CHAIN_title: "Adicionar rede",
    action_SIGN_MESSAGE_title: "Assinar mensagem",
    action_SIGN_TYPED_DATA_title: "Assinar dados (Typed Data)",
    action_SEND_TX_title: "Enviar transa\xE7\xE3o",
    action_SEND_TX_contract_title: "Interagir com contrato",
    action_SEND_TX_eth_title: "Enviar ETH",
    action_WATCH_ASSET_title: "Adicionar token/ativo",
    action_SOLANA_title: "Assinatura/Transa\xE7\xE3o Solana",
    action_UNKNOWN_title: "Solicita\xE7\xE3o",
    // Summary bullets (plain language)
    summary_CONNECT_1: "O site quer ver seus endere\xE7os e a rede atual.",
    summary_CONNECT_2: "Ele poder\xE1 pedir assinaturas/transa\xE7\xF5es depois.",
    summary_CONNECT_3: "Conecte apenas se confiar no site.",
    summary_REQUEST_PERMISSIONS_1: "O site quer permiss\xF5es adicionais na sua carteira.",
    summary_REQUEST_PERMISSIONS_2: "Revise as permiss\xF5es na carteira antes de aceitar.",
    summary_SWITCH_CHAIN_1: "O site quer trocar a rede (chain) da sua carteira.",
    summary_SWITCH_CHAIN_2: "Troca de rede normalmente n\xE3o custa gas.",
    explain_connect_title: "Conectar carteira",
    explain_connect_short: "Login com carteira (compartilha seu endere\xE7o p\xFAblico)",
    explain_connect_why: "Isso permite ao site mostrar sua conta e pedir assinaturas/aprova\xE7\xF5es/transa\xE7\xF5es depois.",
    explain_sign_title: "Assinar mensagem",
    explain_sign_short: "Sem gas, mas assinaturas podem autorizar a\xE7\xF5es",
    explain_sign_why: "Sites usam assinaturas para login, verifica\xE7\xE3o de posse ou autoriza\xE7\xF5es off-chain.",
    explain_typed_title: "Assinar dados estruturados",
    explain_typed_short: "Typed-data pode incluir permits/autoriza\xE7\xF5es",
    explain_typed_why: "Typed-data \xE9 frequentemente usado para permits (aprova\xE7\xF5es sem approve on-chain separado).",
    explain_tx_title: "Enviar transa\xE7\xE3o",
    explain_tx_short: "A\xE7\xE3o on-chain (pode ter taxa de gas)",
    explain_tx_why: "Isso criar\xE1 uma transa\xE7\xE3o on-chain se voc\xEA aprovar na sua carteira.",
    explain_switch_title: "Trocar rede",
    explain_switch_why: "Alguns sites exigem uma rede espec\xEDfica para funcionar.",
    explain_addchain_title: "Adicionar rede",
    explain_addchain_short: "Adiciona uma configura\xE7\xE3o de chain na carteira",
    explain_add_chain_short: "Adicionar rede na carteira",
    add_chain_review_rpc: "RPC malicioso pode enganar saldos/transa\xE7\xF5es; confirme a proced\xEAncia.",
    add_chain_verify_chainid: "Confirme o chainId e o nome da rede antes de adicionar.",
    explain_addchain_why: "A carteira pode adicionar detalhes de RPC para a rede solicitada.",
    explain_watchasset_title: "Adicionar ativo",
    explain_watchasset_short: "Adiciona um token/ativo na UI da carteira",
    explain_watch_asset_short: "Adicionar token/ativo na carteira",
    watch_asset_no_spend_but_risk: "Adicionar token n\xE3o gasta fundos, mas tokens podem ser golpe; confirme contrato.",
    watch_asset_verify_contract: "Verifique o endere\xE7o do contrato em um explorer confi\xE1vel.",
    explain_watchasset_why: "N\xE3o gasta fundos, mas confirme se os detalhes do token est\xE3o corretos.",
    explain_generic_title: "Solicita\xE7\xE3o da carteira",
    explain_generic_short: "Um site est\xE1 pedindo uma a\xE7\xE3o da carteira",
    explain_generic_why: "Revise os detalhes na carteira e confirme a URL do site.",
    human_connect_whatIs: "Conecta seu endere\xE7o de carteira a este site (como um login).",
    human_connect_sees_1: "Seu endere\xE7o p\xFAblico (e sele\xE7\xE3o de conta)",
    human_connect_sees_2: "Sua rede/chain selecionada",
    human_connect_sees_3: "Atividade on-chain p\xFAblica (tokens/NFTs s\xE3o dados p\xFAblicos)",
    human_connect_not_1: "N\xC3O revela sua seed phrase nem a senha da carteira",
    human_connect_not_2: "N\xC3O move fundos automaticamente por si s\xF3",
    human_connect_why_1: "Para mostrar sua conta e saldos na interface",
    human_connect_why_2: "Para permitir assinar mensagens (login/verifica\xE7\xE3o)",
    human_connect_why_3: "Para pedir aprova\xE7\xF5es/transa\xE7\xF5es depois (com sua confirma\xE7\xE3o)",
    human_connect_risk_1: "Privacidade/rastreamento: pode vincular seu endere\xE7o a este site",
    human_connect_risk_2: "Phishing em etapas: os pr\xF3ximos prompts podem pedir assinatura/approve",
    human_connect_risk_3: "Dom\xEDnios similares: sites falsos costumam come\xE7ar com um connect inofensivo",
    human_connect_safe_1: "Trate connect como compartilhar identidade: fa\xE7a isso s\xF3 em sites que voc\xEA reconhece.",
    human_connect_next_1: "Confira o dom\xEDnio (ortografia, HTTPS, sem punycode)",
    human_connect_next_2: "Se tiver d\xFAvida, cancele e abra o site por um favorito confi\xE1vel",
    human_connect_reco_suspicious: "Cancele e verifique a URL por outro meio (favorito/busca), depois tente novamente.",
    human_connect_reco_ok: "Continue apenas se voc\xEA reconhece o site e a URL parece correta.",
    human_sign_whatIs: "Cria uma assinatura criptogr\xE1fica. Geralmente n\xE3o custa gas, mas pode autorizar a\xE7\xF5es.",
    human_sign_risk_1: "Assinar textos desconhecidos pode autorizar a\xE7\xF5es/login que voc\xEA n\xE3o pretendia",
    human_sign_risk_2: "Blind sign pode esconder o que voc\xEA est\xE1 autorizando",
    human_typed_whatIs: "Assina dados estruturados (typed-data). Frequentemente usado para permits/autoriza\xE7\xF5es.",
    human_typed_risk_1: "Typed-data pode incluir permits de token que funcionam como aprova\xE7\xF5es",
    human_sign_safe_1: "Prefira carteiras que mostrem detalhes de assinatura de forma leg\xEDvel.",
    human_sign_next_1: "Verifique a URL e leia a mensagem/typed-data com aten\xE7\xE3o",
    human_sign_next_2: "Se o prompt for vago, cancele e pe\xE7a contexto ao site",
    human_sign_reco_suspicious: "Cancele. Dom\xEDnio suspeito + assinatura \xE9 um padr\xE3o comum de phishing.",
    human_sign_reco_ok: "S\xF3 continue se voc\xEA entende o motivo da assinatura e confia no site.",
    human_approve_whatIs: "Uma aprova\xE7\xE3o permite que um contrato gaste seus tokens depois (at\xE9 o limite aprovado).",
    human_approve_risk_1: "Aprova\xE7\xF5es podem ser abusadas se o contrato gastador for malicioso ou comprometido",
    human_approve_risk_unlimited: "Aprova\xE7\xE3o ilimitada significa que pode gastar TODO o saldo do token",
    human_approve_safe_1: "Quando poss\xEDvel, aprove apenas o m\xEDnimo necess\xE1rio.",
    human_approve_next_1: "Confira o spender/operador e se voc\xEA reconhece o dApp",
    human_approve_next_2: "Considere revogar aprova\xE7\xF5es depois se n\xE3o usar mais o site",
    human_approve_reco: "Continue apenas se voc\xEA confia no site e o spender faz sentido.",
    human_approve_reco_unlimited: "Evite aprova\xE7\xF5es ilimitadas a menos que voc\xEA confie muito no site e entenda o risco.",
    human_setApprovalForAll_whatIs: "D\xE1 permiss\xE3o a um operador para mover TODOS os NFTs de uma cole\xE7\xE3o por voc\xEA.",
    human_setApprovalForAll_risk_1: "Isso pode permitir drenar NFTs se o operador for malicioso/comprometido",
    human_setApprovalForAll_safe_1: "Aprove apenas operadores que voc\xEA reconhece (ex.: marketplaces conhecidos).",
    human_setApprovalForAll_next_1: "Verifique o endere\xE7o do operador e se o site \xE9 o marketplace pretendido",
    human_setApprovalForAll_reco: "Cancele a menos que voc\xEA esteja em um marketplace reconhecido e espere essa a\xE7\xE3o.",
    human_tx_whatIs: "Isso criar\xE1 uma transa\xE7\xE3o on-chain se voc\xEA aprovar na sua carteira.",
    human_tx_risk_1: "Transa\xE7\xF5es podem mover fundos ou alterar permiss\xF5es dependendo da chamada",
    human_tx_safe_1: "Sempre verifique destinat\xE1rio, valor e o contrato com o qual est\xE1 interagindo.",
    human_tx_next_1: "Confira o destino (to), valor e a a\xE7\xE3o decodificada (se houver)",
    human_tx_reco_suspicious: "Cancele. N\xE3o envie transa\xE7\xF5es em dom\xEDnios suspeitos.",
    human_tx_reco_ok: "Continue apenas se voc\xEA pretendia essa a\xE7\xE3o e os detalhes parecem corretos.",
    human_chain_whatIs: "Muda a rede selecionada na sua carteira.",
    human_chain_risk_1: "Redes/RPCs errados podem te enganar sobre ativos ou transa\xE7\xF5es",
    human_chain_safe_1: "S\xF3 troque/adicione redes que voc\xEA reconhece.",
    human_chain_next_1: "Confirme nome da rede e chainId no prompt da carteira",
    human_watchasset_whatIs: "Adiciona um token/ativo na UI da carteira para facilitar a visualiza\xE7\xE3o.",
    human_watchasset_risk_1: "Tokens falsos podem se passar por reais\u2014verifique endere\xE7o e s\xEDmbolo",
    human_watchasset_safe_1: "Confirme detalhes do token em um explorer confi\xE1vel (ex.: Etherscan).",
    human_watchasset_next_1: "Verifique o contrato do token e as decimais",
    human_watchasset_reco: "Continue apenas se os detalhes baterem com uma fonte oficial.",
    human_generic_whatIs: "Um site solicitou uma a\xE7\xE3o da carteira. Revise os detalhes com cuidado.",
    human_generic_risk_1: "Prompts desconhecidos podem fazer parte de fluxos de phishing",
    human_generic_safe_1: "Na d\xFAvida, cancele e verifique o site.",
    human_generic_next_1: "Confira a URL e leia os detalhes do prompt da carteira",
    human_generic_reco: "Continue apenas se voc\xEA entende e esperava essa solicita\xE7\xE3o.",
    human_revoke_link_text: "Revogar permiss\xF5es depois: revoke.cash",
    trustReasonNotHttps: "N\xE3o \xE9 HTTPS (maior risco de spoofing/inje\xE7\xE3o).",
    trustReasonManyHyphens: "Muitos h\xEDfens no dom\xEDnio (comum em similares).",
    trustReasonSuspiciousKeywords: "Dom\xEDnio cont\xE9m palavras de alto risco (login/verify/secure/...).",
    trustReasonBrandLookalike: "Nome lembra uma marca, mas n\xE3o \xE9 o dom\xEDnio oficial.",
    trustReasonManySubdomains: "Estrutura de subdom\xEDnio profunda/incomum.",
    trustReasonNoHost: "N\xE3o foi poss\xEDvel ler o hostname do site.",
    trustReasonAllowlistedVariant: "Dom\xEDnio casa com um padr\xE3o confi\xE1vel.",
    trustReasonUnknown: "Sem sinais fortes para um lado ou outro.",
    summary_ADD_CHAIN_1: "O site quer adicionar uma nova rede na sua carteira.",
    summary_ADD_CHAIN_2: "Confirme o chainId e o nome da rede com cuidado.",
    summary_SIGN_MESSAGE_1: "Voc\xEA vai assinar uma mensagem (n\xE3o \xE9 transa\xE7\xE3o).",
    summary_SIGN_MESSAGE_2: "A assinatura pode ter efeitos fora da blockchain (login, termos, permiss\xF5es).",
    summary_SIGN_TYPED_DATA_1: "Voc\xEA vai assinar dados estruturados (EIP-712).",
    summary_SIGN_TYPED_DATA_2: "Isso pode autorizar gastos/ordens dependendo do conte\xFAdo.",
    summary_SIGN_TYPED_DATA_3: "Verifique quem \xE9 o spender/contrato envolvido.",
    summary_SEND_TX_1: "Voc\xEA vai enviar uma transa\xE7\xE3o on-chain.",
    summary_SEND_TX_2: "Isso pode mover ETH/tokens ou interagir com um contrato.",
    summary_SEND_TX_3: "Confira valor, rede e destino antes de confirmar.",
    summary_WATCH_ASSET_1: "O site quer adicionar um token/ativo na sua carteira.",
    summary_WATCH_ASSET_2: "Confirme s\xEDmbolo e endere\xE7o do contrato do token.",
    summary_SOLANA_1: "Assinatura ou transa\xE7\xE3o Solana. Os valores ser\xE3o confirmados na carteira.",
    summary_UNKNOWN_1: "O site est\xE1 fazendo uma chamada de carteira desconhecida.",
    summary_UNKNOWN_2: "Se n\xE3o souber o que \xE9, cancele.",
    // Costs / TX labels
    btn_cancel: "Cancelar",
    btn_continue: "Continuar",
    toast_request_expired: "Solicita\xE7\xE3o expirada. Refa\xE7a a a\xE7\xE3o no site e tente novamente.",
    simulation_tx_will_fail: "ESTA TRANSA\xC7\xC3O VAI FALHAR",
    btn_close: "Fechar",
    btn_proceed_anyway: "Prosseguir mesmo assim",
    override_checkbox: "Eu entendo o risco e quero prosseguir",
    override_countdown: "({s}s)",
    tip_revoke: "Revogar permiss\xF5es depois: revoke.cash",
    cost_summary_title: "Resumo de custos",
    costs_title: "Custos e impacto",
    impact_title: "Impacto",
    permission_for: "Permiss\xE3o para",
    addr_marked_public: "Marcado em base p\xFAblica",
    risk_title: "Risco e por qu\xEA",
    what_to_do_now: "O que fazer agora",
    site_label: "Site",
    network_label: "Rede",
    severity_BLOCKED: "BLOQUEADO",
    severity_HIGH: "ALTO",
    severity_WARN: "ATEN\xC7\xC3O",
    severity_LOW: "BAIXO",
    cost_you_send: "Voc\xEA envia",
    cost_fee_only: "apenas taxa",
    cost_value: "Valor",
    cost_fee: "Taxa estimada",
    cost_total: "Total estimado",
    cost_fee_unknown: "Taxa ser\xE1 cobrada (confirme na carteira)",
    network_switch_title: "Troca de rede",
    network_current: "Rede atual",
    network_requested: "Rede solicitada",
    trusted_domain_ref_title: "Dom\xEDnios confi\xE1veis (refer\xEAncia)",
    tx_cost_sending: "Voc\xEA est\xE1 enviando {value} + taxa de rede",
    tx_cost_gas_only: "Mesmo sem enviar moeda nativa, voc\xEA pagar\xE1 taxa de rede (gas)",
    gas_calculating: "calculando\u2026",
    tx_destination: "Destino",
    token_verified_uniswap: "Token Verificado (Uniswap List)",
    token_unknown_unverified: "Token Desconhecido (N\xE3o Verificado)",
    tx_contract_method: "Contrato/m\xE9todo",
    tx_max_gas_fee: "Taxa m\xE1xima (gas)",
    tx_max_total: "Total m\xE1ximo",
    tx_fee_estimated_by_wallet: "A carteira estimar\xE1 a taxa na pr\xF3xima etapa.",
    network_target: "Rede alvo",
    switch_no_gas: "A troca de rede normalmente N\xC3O custa gas.",
    switch_next_step_gas: "A pr\xF3xima etapa (compra/transa\xE7\xE3o) ter\xE1 taxa de rede.",
    switch_note_inline: "A troca de rede normalmente N\xC3O custa gas. Por\xE9m a pr\xF3xima etapa (compra/transa\xE7\xE3o) ter\xE1 taxa de rede.",
    sendtx_reco: "Confirme na carteira apenas se os detalhes (valor, rede e contrato) estiverem corretos.",
    // Risk/trust labels
    risk_LOW: "Baixo",
    risk_WARN: "Aten\xE7\xE3o",
    risk_HIGH: "Alto",
    recommend_ALLOW: "Permitir",
    recommend_WARN: "Avisar",
    recommend_HIGH: "Alto risco",
    recommend_BLOCK: "Bloquear",
    trust_unknown: "Desconhecido",
    trust_suspicious: "Suspeito",
    trust_likelyOfficial: "Dom\xEDnio conhecido (lista de refer\xEAncia)",
    trust_domainNotRecognized: "Dom\xEDnio n\xE3o reconhecido",
    // Phishing hard-block
    phishing_hard_block: "Dom\xEDnio em blacklist de phishing. Bloqueado.",
    // Toasts
    toast_extension_updated: "Extens\xE3o atualizada \u2014 recarregue a aba.",
    toast_cannot_analyze: "N\xE3o foi poss\xEDvel analisar. Recarregue a aba.",
    // Options page
    optionsTitle: "Crypto Wallet SignGuard \u2014 Configura\xE7\xF5es",
    optionsSubtitle: "Controle quando o SignGuard deve alertar e bloquear.",
    dashboardLink: "Dashboard",
    onboardingTitle: "Como usar",
    onboardingHowTo: "A extens\xE3o intercepta solicita\xE7\xF5es sens\xEDveis (conex\xE3o, assinatura, transa\xE7\xE3o) de carteiras injetadas (window.ethereum / window.solana). Ao detectar, mostra um overlay para voc\xEA revisar antes de a carteira abrir.",
    onboardingWhatItDoes: "Faz: alerta antes de conectar, assinar ou enviar; verifica dom\xEDnio contra listas de phishing; mostra inten\xE7\xE3o da transa\xE7\xE3o (swap, NFT, approval).",
    onboardingWhatItDoesNot: "N\xE3o faz: n\xE3o protege conex\xF5es via QR/WalletConnect; n\xE3o garante que contratos sejam seguros; n\xE3o substitui verifica\xE7\xE3o manual.",
    onboardingLinkRevoke: "revoke.cash \u2014 revogar permiss\xF5es",
    onboardingLinkEtherscan: "Etherscan \u2014 explorar transa\xE7\xF5es",
    exportDebugRequiresDebugMode: "Ative o modo Debug primeiro para exportar eventos.",
    securityModeLabel: "Modo de seguran\xE7a",
    securityModeDesc: "Strict bloqueia mais; Balanced alerta; Relaxed reduz fric\xE7\xE3o; Off desativa bloqueios.",
    modeStrict: "Strict",
    modeBalanced: "Balanced",
    modeRelaxed: "Relaxed",
    modeOff: "Off",
    strictBlockApprovalsUnlimitedLabel: "Strict: bloquear approve ilimitado",
    strictBlockApprovalsUnlimitedDesc: "Bloqueia aprova\xE7\xF5es ERC20 unlimited (MAX_UINT256).",
    strictBlockSetApprovalForAllLabel: "Strict: bloquear setApprovalForAll",
    strictBlockSetApprovalForAllDesc: "Bloqueia permiss\xE3o para mover todos os NFTs.",
    strictBlockPermitLikeLabel: "Strict: bloquear Permit ilimitado",
    strictBlockPermitLikeDesc: "Bloqueia assinaturas Permit (EIP-2612) unlimited.",
    assetEnrichmentEnabledLabel: "Enriquecimento de ativos",
    assetEnrichmentEnabledDesc: "Busca s\xEDmbolo/nome de tokens via eth_call.",
    addressIntelEnabledLabel: "Threat intel de endere\xE7os",
    addressIntelEnabledDesc: "Verifica spender/operator/to contra blacklist.",
    riskWarningsLabel: "Alertas de risco",
    riskWarningsDesc: "Mostra avisos e recomenda\xE7\xF5es antes de abrir a carteira.",
    connectOverlayLabel: "Overlay ao conectar",
    connectOverlayDesc: "Mostra o overlay tamb\xE9m para conex\xE3o/permiss\xF5es.",
    blockHighRiskLabel: "Bloquear alto risco",
    blockHighRiskDesc: "Bloqueia automaticamente a\xE7\xF5es de alto risco.",
    requireTypedOverrideLabel: "Exigir override em Typed Data (alto risco)",
    requireTypedOverrideDesc: "Para assinaturas EIP-712 de alto risco, exige confirma\xE7\xE3o extra.",
    allowOverrideOnPhishingLabel: "Permitir override em phishing (N\xC3O recomendado)",
    allowOverrideOnPhishingDesc: "Se desativado (padr\xE3o), phishing em blacklist \xE9 bloqueado sem op\xE7\xE3o de prosseguir.",
    mode_off_reason: "Modo OFF: sem bloqueios.",
    address_flagged_reason: "Endere\xE7o/contrato sinalizado: {label} ({category})",
    addr_sanctioned_block: "Endere\xE7o em lista de san\xE7\xF5es.",
    addr_scam_reported_warn: "Endere\xE7o marcado como suspeito/relatado.",
    addr_phishing_reported_warn: "Endere\xE7o marcado como suspeito/relatado.",
    addr_malicious_contract_warn: "Contrato marcado como malicioso.",
    asset_info_reason: "Ativo: {sym} ({kind})",
    reason_permission_tokens: "Permiss\xE3o para gastar tokens",
    reason_permission_all_nfts: "Permiss\xE3o para mover TODOS os NFTs",
    reason_transfer_tokens: "Transfer\xEAncia de tokens/NFT",
    domainChecksLabel: "Checagens de dom\xEDnio",
    domainChecksDesc: "Alertas por padr\xF5es suspeitos no dom\xEDnio quando n\xE3o estiver na allowlist.",
    allowlistLabel: "Allowlist (dom\xEDnios confi\xE1veis)",
    allowlistDesc: "Um dom\xEDnio por linha. Ex.: opensea.io",
    vaultTitle: "Cofre SignGuard",
    vaultDesc: "Contratos nesta lista nunca podem ser transacionados sem desbloqueio expl\xEDcito nas op\xE7\xF5es.",
    vaultAddLabel: "Adicionar contrato ao cofre",
    vaultAddButton: "Adicionar ao Cofre",
    vaultListLabel: "Contratos bloqueados",
    vaultListEmpty: "Nenhum contrato no cofre.",
    vaultRemove: "Remover",
    vaultInvalidAddress: "Endere\xE7o inv\xE1lido. Use 0x e 40 caracteres hexadecimais.",
    vaultAlreadyAdded: "Este contrato j\xE1 est\xE1 no cofre.",
    vaultBlockedMessage: "SignGuard: Ativo Bloqueado no Cofre. Desbloqueie nas op\xE7\xF5es para continuar.",
    addSuggested: "Adicionar sugeridos",
    save: "Salvar",
    saved: "Salvo",
    intelTitle: "Threat Intel",
    intelSubtitle: "Listas de dom\xEDnios (fontes plug\xE1veis) usadas na an\xE1lise.",
    intelTrustedCountLabel: "Dom\xEDnios confi\xE1veis",
    intelBlockedCountLabel: "Dom\xEDnios bloqueados",
    intelBlockedAddressCountLabel: "Endere\xE7os bloqueados",
    intelUpdatedAtLabel: "\xDAltima atualiza\xE7\xE3o",
    intelUpdateNow: "Atualizar agora",
    enableIntelLabel: "Usar Threat Intel",
    enableIntelDesc: "Usa listas de dom\xEDnios confi\xE1veis/bloqueados na an\xE1lise.",
    customTrustedDomainsLabel: "Dom\xEDnios confi\xE1veis (lista personalizada)",
    customTrustedDomainsDesc: "Um por linha. Ex.: meusite.io",
    customBlockedDomainsLabel: "Dom\xEDnios bloqueados (lista personalizada)",
    customBlockedDomainsDesc: "Um por linha. Sempre bloqueados.",
    exportListsLabel: "Exportar listas",
    privacyLimitsTitle: "Privacidade & Limita\xE7\xF5es",
    privacyLimitsLine1: "A extens\xE3o n\xE3o acessa sua seed/frase secreta e n\xE3o tem cust\xF3dia.",
    privacyLimitsLine2: "Ela analisa dom\xEDnios e dados de transa\xE7\xE3o exibidos pelo navegador para alertas. N\xE3o garante 100%.",
    privacyLimitsLine3: "Threat intel pode ser atualizado via fontes p\xFAblicas (opcional).",
    cloudIntelOptInLabel: "Permitir checagens externas",
    cloudIntelOptInDesc: "Mais prote\xE7\xE3o; pode enviar dom\xEDnio/endere\xE7os para valida\xE7\xE3o (preparado para P1).",
    showUsdLabel: "Exibir valores em USD",
    showUsdDesc: "Converte valores da moeda nativa e tokens para d\xF3lar (quando dispon\xEDvel).",
    tabSettings: "Configura\xE7\xF5es",
    tabHistory: "Hist\xF3rico",
    tabPlan: "Plano",
    historySubtitle: "\xDAltimas decis\xF5es do overlay.",
    historyExport: "Exportar JSON",
    historyClear: "Limpar",
    historyEmpty: "Nenhum registro.",
    request_expired_toast: "Solicita\xE7\xE3o expirada. Refa\xE7a a a\xE7\xE3o no site e tente novamente.",
    failopen_armed_banner: "An\xE1lise demorou. Voc\xEA pode Continuar mesmo assim ou Cancelar.",
    decision_allow: "Permitido",
    decision_block: "Bloqueado",
    planSubtitle: "Gerencie seu plano e licen\xE7a.",
    planCurrent: "Plano atual",
    planLicenseKey: "Chave de licen\xE7a",
    planActivate: "Ativar",
    planGoPro: "Assinar PRO",
    // Options: Safety notes + debug
    safetyNotesTitle: "Limita\xE7\xF5es & seguran\xE7a",
    safetyNotesLine1: "Esta extens\xE3o monitora solicita\xE7\xF5es feitas por carteiras injetadas (window.ethereum / window.solana).",
    safetyNotesLine2: "Conex\xF5es via QR/WalletConnect podem n\xE3o ser interceptadas. Sempre verifique na sua carteira.",
    safetyNotesLinkRevoke: "revoke.cash",
    safetyNotesLinkEtherscan: "etherscan.io",
    debugModeLabel: "Modo debug",
    debugModeDesc: "Armazena os \xFAltimos 20 eventos (sem payload grande) para suporte.",
    exportDebug: "Exportar",
    // Overlay: intent + permission + copy
    looks_like: "Parece:",
    intent_NFT_PURCHASE: "Compra de NFT",
    intent_SWAP: "Swap",
    intent_APPROVAL: "Permiss\xE3o",
    intent_SEND: "Envio",
    intent_UNKNOWN: "Desconhecido",
    intent_ETH_TRANSFER: "Envio de ETH",
    intent_TOKEN_TRANSFER: "Transfer\xEAncia de token",
    intent_NFT_TRANSFER: "Transfer\xEAncia de NFT",
    intent_CONTRACT_INTERACTION: "Intera\xE7\xE3o com contrato",
    intent_SWITCH_CHAIN: "Troca de rede",
    intent_ADD_CHAIN: "Adicionar rede",
    intent_WATCH_ASSET: "Adicionar token",
    intent_SOLANA: "Assinatura/Transa\xE7\xE3o Solana",
    intent_SIGNATURE: "Assinatura",
    intent_TYPED_DATA: "Dados tipados",
    wallet_label: "Carteira",
    wallet_detecting: "Detectando\u2026",
    wallet_evm_generic: "Carteira EIP-1193",
    trust_disclaimer: "Lista de refer\xEAncia \u2260 garantia. Golpistas podem usar dom\xEDnios parecidos.",
    hint_wallet_popup: "Sua carteira deve abrir agora. Se n\xE3o abrir, clique no \xEDcone da carteira e verifique solicita\xE7\xF5es pendentes.",
    add_chain_network_label: "Rede a adicionar",
    add_chain_rpc_label: "RPC",
    watch_asset_token_label: "Token a adicionar",
    modeLabel: "Modo:",
    popupPauseProtection: "PAUSAR PROTE\xC7\xC3O",
    popupStatusProtected: "Protegido",
    popupStatusPaused: "Pausado",
    fortressModeLabel: "MODO FORTALEZA",
    fortressModeDesc: "Bloqueia todas as aprova\xE7\xF5es de tokens, exceto em sites confi\xE1veis.",
    fortress_block_message: "SignGuard Fortaleza: Aprova\xE7\xE3o bloqueada em site desconhecido. Desative o modo Fortaleza para prosseguir.",
    honeypot_message: "\u{1FAA4} HONEYPOT: Voc\xEA pode comprar, mas N\xC3O poder\xE1 vender.",
    info_unavailable: "Informa\xE7\xE3o indispon\xEDvel.",
    explain_switch_short: "O site pediu para trocar a rede (chain) da sua carteira.",
    human_chain_reco: "Continue apenas se voc\xEA esperava a troca de rede e ela parece correta.",
    trustReasonAllowlisted: "Dom\xEDnio est\xE1 em uma lista confi\xE1vel (seed).",
    trustReasonPhishingBlacklist: "Dom\xEDnio est\xE1 em blacklist de phishing (lista de refer\xEAncia).",
    fee_unknown_wallet_will_estimate: "Taxa: ser\xE1 exibida pela carteira",
    label_you_send: "Voc\xEA envia",
    label_fee_likely: "Taxa estimada (prov\xE1vel)",
    label_fee_max: "Taxa m\xE1xima (pior caso)",
    label_total_likely: "Total prov\xE1vel",
    label_total_max: "Total m\xE1ximo",
    fee_gt_value: "A taxa m\xE1xima \xE9 MAIOR que o valor enviado. Confirme se faz sentido.",
    check_wallet_network_fee: "Voc\xEA ainda n\xE3o viu a taxa. Verifique o 'Network fee' na carteira antes de confirmar.",
    label_max_fee: "Taxa m\xE1xima",
    label_max_total: "Total m\xE1ximo",
    switch_summary_no_gas: "Troca de rede normalmente n\xE3o custa gas, mas pode mudar quais ativos voc\xEA est\xE1 vendo.",
    permission_title: "Permiss\xE3o",
    permission_token_contract: "Contrato",
    permission_spender: "Spender",
    permission_operator: "Operator",
    permission_unlimited: "Ilimitado",
    approval_unlimited_detected: "Aprova\xE7\xE3o ilimitada detectada",
    permit_signature_detected: "Assinatura tipo Permit detectada (pode autorizar gasto de tokens)",
    token_transfer_detected: "Transfer\xEAncia de token detectada",
    nft_transfer_detected: "Transfer\xEAncia de NFT detectada",
    transfer_token_title: "Transfer\xEAncia de token",
    transfer_nft_title: "Transfer\xEAncia de NFT",
    transfer_amount: "Quantidade",
    transfer_token_id: "Token ID",
    yes: "Sim",
    no: "N\xE3o",
    copy: "Copiar",
    chainChangeTitle: "Solicita\xE7\xE3o de troca/adicionar rede",
    watchAssetTitle: "Solicita\xE7\xE3o de adicionar ativo",
    domainPunycodeReason: "Dom\xEDnio usa punycode (xn--); verifique a URL.",
    domainDoubleDashReason: "Dom\xEDnio cont\xE9m h\xEDfen duplo (suspeito).",
    domainNumberPatternReason: "Dom\xEDnio com muitos n\xFAmeros (comum em phishing).",
    domainLookalikeReason: "Poss\xEDvel imita\xE7\xE3o do dom\xEDnio oficial de {legit}.",
    suspiciousWebsitePatterns: "Padr\xF5es suspeitos no site.",
    page_risk_suspicious_banner: "\u26A0\uFE0F SignGuard: Site Suspeito Detetado",
    connectTitle: "Conectar carteira",
    connectReason: "O site quer conectar \xE0 sua carteira.",
    walletRequestPermissionsTitle: "Solicitar permiss\xF5es",
    walletRequestPermissionsReason: "O site quer permiss\xF5es adicionais na carteira.",
    typedDataWarnReason: "Assinatura de dados estruturados (EIP-712); pode autorizar a\xE7\xF5es.",
    signatureRequest: "Pedido de assinatura",
    rawSignWarnReason: "Assinatura de mensagem raw; pode autorizar a\xE7\xF5es fora da blockchain.",
    tokenApproval: "Aprova\xE7\xE3o de token",
    unlimitedApprovalReason: "Aprova\xE7\xE3o ilimitada detectada (MAX_UINT256).",
    unlimitedApprovalDetected: "Aprova\xE7\xE3o ilimitada detectada",
    nftOperatorApprovalReason: "Permiss\xE3o para mover TODOS os NFTs da cole\xE7\xE3o.",
    nftOperatorApproval: "Permiss\xE3o de operador NFT",
    txPreview: "Visualiza\xE7\xE3o da transa\xE7\xE3o",
    txWarnReason: "Transa\xE7\xE3o on-chain; confira valor, destino e rede.",
    unknownMethodReason: "M\xE9todo de carteira desconhecido.",
    warningsDisabledReason: "Alertas desativados nas configura\xE7\xF5es.",
    analyzing: "Analisando\u2026",
    analyzing_subtitle: "Site \u2022 M\xE9todo",
    analyzing_hint: "Validando dom\xEDnio e estimando impacto",
    fallback_partial_check: "Sem verifica\xE7\xE3o completa agora \u2014 revise os detalhes abaixo antes de prosseguir.",
    fallback_partial_verification: "Verifica\xE7\xE3o parcial agora \u2014 revise os detalhes abaixo antes de prosseguir.",
    loading_base: "Carregando base\u2026",
    analyzerUnavailableTitle: "Analisador indispon\xEDvel",
    analysis_unavailable: "An\xE1lise indispon\xEDvel \u2014 confira na carteira antes de continuar.",
    dados_parciais_title: "Dados parciais \u2014 confirme na carteira",
    dados_parciais_subtitle: "Exibindo o que foi poss\xEDvel analisar. Verifique os detalhes na carteira antes de continuar.",
    risk_low: "Baixo",
    risk_warn: "Aten\xE7\xE3o",
    risk_high: "Alto",
    risk_block: "Bloqueado",
    trustReasonAllowlistedMatched: "Dom\xEDnio em allowlist: {matched}.",
    list_empty_domains: "Lista vazia. Abra as op\xE7\xF5es para adicionar dom\xEDnios confi\xE1veis.",
    btn_open_options: "Abrir op\xE7\xF5es",
    default_human_switch_what: "Troca a rede ativa da carteira (ex.: Ethereum \u2192 outra rede).",
    default_human_switch_risk: "Voc\xEA pode assinar/transacionar na rede errada se a troca n\xE3o for esperada.",
    default_human_switch_safe: "Confirme a rede solicitada e se o site \xE9 o correto.",
    default_human_switch_next: "Se estiver certo, aprove na carteira. Se estiver estranho, cancele.",
    default_human_contract_what: "Envia uma transa\xE7\xE3o para um contrato (a\xE7\xE3o dentro do dApp).",
    default_human_contract_risk: "O custo real pode variar e a a\xE7\xE3o pode mover ativos/tokens via contrato.",
    default_human_contract_safe: "Confira destino (to), rede, valor e a taxa (Network fee) na carteira.",
    default_human_contract_next: "Se os detalhes baterem, prossiga. Caso contr\xE1rio, cancele.",
    default_human_eth_what: "Envia ETH diretamente para um endere\xE7o.",
    default_human_eth_risk: "Transfer\xEAncias s\xE3o irrevers\xEDveis se o destino estiver errado.",
    default_human_eth_safe: "Verifique o endere\xE7o e o valor. Desconfie de links/encurtadores.",
    default_human_eth_next: "S\xF3 confirme se voc\xEA reconhece o destinat\xE1rio.",
    default_human_typed_what: "Assinatura off-chain (EIP-712). Pode autorizar a\xE7\xF5es sem pagar gas.",
    default_human_typed_risk: "Pode conceder permiss\xF5es/autoriza\xE7\xF5es (ex.: permit/approval) dependendo do conte\xFAdo.",
    default_human_typed_safe: "Revise o que est\xE1 sendo autorizado (spender/operator) e o dom\xEDnio/contrato.",
    default_human_typed_next: "Se n\xE3o entender, cancele e valide no site oficial do dApp.",
    default_human_generic_what: "A\xE7\xE3o solicitada pela dApp.",
    default_human_generic_risk: "Se algo n\xE3o fizer sentido, cancele.",
    default_human_generic_safe: "Confirme dom\xEDnio, rede e detalhes na carteira.",
    default_human_generic_next: "Prossiga apenas se tudo estiver correto.",
    verdict_ok: "OK",
    verdict_warn: "Aten\xE7\xE3o",
    verdict_high: "Risco alto",
    verdict_block: "Bloqueado",
    coverage_label: "Cobertura",
    coverage_limited: "cobertura limitada",
    trusted_domain_ref_empty: "Lista de refer\xEAncia ainda n\xE3o carregou.",
    trusted_domain_ref_loading: "Carregando lista de refer\xEAncia\u2026",
    trusted_domain_ref_refresh: "Atualizar listas",
    trusted_domain_ref_view_more: "Ver mais",
    trusted_domains_loading: "Carregando lista de refer\xEAncia\u2026",
    trusted_domains_more: "+{n}",
    trusted_domains_search_placeholder: "Filtrar dom\xEDnios\u2026",
    trusted_domains_update_now: "Atualizar agora",
    trusted_domains_auto_update: "Atualiza automaticamente nas op\xE7\xF5es",
    banner_ok_no_known_threats: "OK: nenhum sinal conhecido de golpe/scam detectado.",
    banner_block_known_threat: "Bloqueado: amea\xE7a conhecida detectada.",
    banner_local_verification: "Aten\xE7\xE3o: verifica\xE7\xE3o local (cache). Revise os detalhes abaixo antes de prosseguir.",
    banner_basic_verification: "Aten\xE7\xE3o: verifica\xE7\xE3o b\xE1sica. Revise cuidadosamente os detalhes antes de prosseguir.",
    list_site_reputation: "Reputa\xE7\xE3o do site",
    list_site_trusted: "Confi\xE1vel",
    list_site_blocked: "Bloqueado",
    list_site_unknown: "Desconhecido",
    updated_x_hours: "Base atualizada h\xE1 {n} hora(s)",
    updated_x_days: "Base atualizada h\xE1 {n} dia(s)",
    tip_check_wallet_details: "Confira valor, rede e taxa na carteira.",
    no_alerts_known: "Nenhum alerta conhecido foi detectado para este contexto.",
    still_review_wallet: "Mesmo assim, revise na carteira (valor, rede, destino e taxa).",
    site_status_known: "refer\xEAncia conhecida",
    site_status_not_in_list: "Site n\xE3o est\xE1 na lista de refer\xEAncia",
    destination_contract: "Contrato",
    destination_wallet: "Carteira",
    overlay_coverage_title: "Cobertura de seguran\xE7a",
    overlay_simulation_title: "Simula\xE7\xE3o",
    overlay_address_intel_title: "Intel de endere\xE7os",
    btn_copy: "Copiar",
    btn_copy_json: "Copiar JSON",
    chain_not_recognized: "Rede n\xE3o reconhecida",
    simulation_skipped_caution: "Sem simula\xE7\xE3o \u2014 valide com mais cautela.",
    toast_copied: "Copiado",
    btn_ver_menos: "Ver menos"
  },
  en: {
    tech_displayAction: "Action (classification)",
    tech_methodRaw: "Method (raw)",
    tech_recommendScoreLevel: "Recommend/score/level",
    tech_reasons: "Reasons",
    tech_decoded: "Decoded",
    dash: "\u2014",
    tx_to: "To",
    tx_data_length: "Data length",
    more_whatItDoes: "What it does",
    more_risks: "Risks",
    more_safeNotes: "Safety notes",
    more_nextSteps: "Next steps",
    // Brand
    extName: "Crypto Wallet SignGuard",
    // Overlay - generic labels
    overlay_requested_title: "What is being requested",
    overlay_site_trusted_title: "Is the site trusted?",
    overlay_summary_title: "Summary (plain language)",
    overlay_recommended_title: "Recommended action",
    overlay_note_title: "Note",
    // Overlay - details sections
    details_tx_title: "Transaction details",
    details_tech_title: "Technical details",
    details_more_title: "More explanations",
    // Queue
    queue_indicator: "Queue: {pos} of {total}",
    // Action titles
    action_CONNECT_title: "Connect wallet",
    action_REQUEST_PERMISSIONS_title: "Request permissions",
    action_SWITCH_CHAIN_title: "Switch network",
    action_ADD_CHAIN_title: "Add network",
    action_SIGN_MESSAGE_title: "Sign message",
    action_SIGN_TYPED_DATA_title: "Sign typed data",
    action_SEND_TX_title: "Send transaction",
    action_SEND_TX_contract_title: "Contract interaction",
    action_SEND_TX_eth_title: "Send ETH",
    action_WATCH_ASSET_title: "Add token/asset",
    action_SOLANA_title: "Solana signature/transaction",
    action_UNKNOWN_title: "Request",
    // Summary bullets
    summary_CONNECT_1: "The site wants to see your addresses and current network.",
    summary_CONNECT_2: "It may request signatures/transactions later.",
    summary_CONNECT_3: "Only connect if you trust the site.",
    summary_REQUEST_PERMISSIONS_1: "The site is requesting additional wallet permissions.",
    summary_REQUEST_PERMISSIONS_2: "Review permissions in your wallet before accepting.",
    summary_SWITCH_CHAIN_1: "The site wants to switch your wallet network (chain).",
    summary_SWITCH_CHAIN_2: "Switching networks usually costs no gas.",
    explain_connect_title: "Connect wallet",
    explain_connect_short: "Wallet login (share your public address)",
    explain_connect_why: "This lets the site show your account and ask for signatures/approvals/transactions later.",
    explain_sign_title: "Sign a message",
    explain_sign_short: "No gas, but signatures can authorize actions",
    explain_sign_why: "Sites use signatures to log in, verify ownership, or authorize off-chain actions.",
    explain_typed_title: "Sign structured data",
    explain_typed_short: "Typed-data signatures can include permits/authorizations",
    explain_typed_why: "Typed-data is often used for permits (token approvals without a separate on-chain approve).",
    explain_tx_title: "Send a transaction",
    explain_tx_short: "On-chain action (gas fees may apply)",
    explain_tx_why: "This will create an on-chain transaction if you approve it in your wallet.",
    explain_switch_title: "Switch network",
    explain_switch_why: "Some sites require a specific network to function.",
    explain_addchain_title: "Add network",
    explain_addchain_short: "Add a new chain configuration to your wallet",
    explain_add_chain_short: "Add network to wallet",
    add_chain_review_rpc: "Malicious RPC can deceive balances/transactions; verify the source.",
    add_chain_verify_chainid: "Verify chainId and network name before adding.",
    explain_addchain_why: "Wallet may add RPC details for a chain requested by the site.",
    explain_watchasset_title: "Watch asset",
    explain_watchasset_short: "Add a token/asset to your wallet UI",
    explain_watch_asset_short: "Add token/asset to wallet",
    watch_asset_no_spend_but_risk: "Adding a token does not spend funds, but scam tokens exist; verify the contract.",
    watch_asset_verify_contract: "Verify the contract address on a trusted explorer.",
    explain_watchasset_why: "This does not spend funds, but confirm the token details are correct.",
    explain_generic_title: "Wallet request",
    explain_generic_short: "A site is requesting a wallet action",
    explain_generic_why: "Review details in your wallet and confirm the site URL.",
    human_connect_whatIs: "Connects your wallet address to this site (like logging in).",
    human_connect_sees_1: "Your public address (and account selection)",
    human_connect_sees_2: "Your network/chain selection",
    human_connect_sees_3: "Public on-chain activity (tokens/NFTs are public data)",
    human_connect_not_1: "It does NOT reveal your seed phrase or wallet password",
    human_connect_not_2: "It does NOT move funds automatically by itself",
    human_connect_why_1: "To show your account and balances in the UI",
    human_connect_why_2: "To let you sign messages (login/verification)",
    human_connect_why_3: "To request approvals/transactions later (with your confirmation)",
    human_connect_risk_1: "Privacy/tracking: it can link your address to this site",
    human_connect_risk_2: "Phishing steps: next prompts may ask for signatures/approvals",
    human_connect_risk_3: "Lookalike domains: fake sites often start with a harmless connect",
    human_connect_safe_1: "Treat connect like sharing an identity: only do it on sites you recognize.",
    human_connect_next_1: "Double-check the domain (spelling, HTTPS, no punycode)",
    human_connect_next_2: "If unsure, cancel and open the site from a trusted bookmark",
    human_connect_reco_suspicious: "Cancel and verify the URL in another way (bookmark/search), then try again.",
    human_connect_reco_ok: "Continue only if you recognize the site and the URL looks right.",
    human_sign_whatIs: "Creates a cryptographic signature. It usually does not cost gas, but it can authorize actions.",
    human_sign_risk_1: "Signing unknown text can approve off-site actions or logins you didn't intend",
    human_sign_risk_2: "Blind signing can hide what you're authorizing",
    human_typed_whatIs: "Signs structured data (typed-data). Often used for permits/authorizations.",
    human_typed_risk_1: "Typed-data may include token permits that behave like approvals",
    human_sign_safe_1: "Prefer wallets that show clear human-readable signing details.",
    human_sign_next_1: "Verify the site URL and read the message/typed-data carefully",
    human_sign_next_2: "If you see vague prompts, cancel and ask the site for context",
    human_sign_reco_suspicious: "Cancel. Suspicious domains + signature prompts are a common phishing pattern.",
    human_sign_reco_ok: "Only continue if you understand what the signature is for and trust the site.",
    human_approve_whatIs: "An approval lets a contract spend your tokens later (up to the approved amount).",
    human_approve_risk_1: "Approvals can be abused if the spender contract is malicious or compromised",
    human_approve_risk_unlimited: "Unlimited approval means it may spend ALL your token balance",
    human_approve_safe_1: "Prefer approving the minimum needed amount whenever possible.",
    human_approve_next_1: "Check the spender address/operator and whether you recognize the dApp",
    human_approve_next_2: "Consider revoking approvals later if you no longer use the site",
    human_approve_reco: "Continue only if you trust the site and the spender makes sense.",
    human_approve_reco_unlimited: "Avoid unlimited approvals unless you strongly trust the site and understand the risk.",
    human_setApprovalForAll_whatIs: "Gives an operator permission to move ALL NFTs in a collection on your behalf.",
    human_setApprovalForAll_risk_1: "This can allow draining NFTs if the operator is malicious or compromised",
    human_setApprovalForAll_safe_1: "Only approve operators you fully recognize (e.g., known marketplaces).",
    human_setApprovalForAll_next_1: "Verify the operator address and confirm the site is the intended marketplace",
    human_setApprovalForAll_reco: "Cancel unless you are on a recognized marketplace and expect this action.",
    human_tx_whatIs: "This will create an on-chain transaction if you approve it in your wallet.",
    human_tx_risk_1: "Transactions can move funds or change permissions depending on the contract call",
    human_tx_safe_1: "Always verify recipient, value, and the contract you're interacting with.",
    human_tx_next_1: "Check the destination (to), value, and decoded action (if available)",
    human_tx_reco_suspicious: "Cancel. Do not send transactions from suspicious domains.",
    human_tx_reco_ok: "Continue only if you intended this action and the details look correct.",
    human_chain_whatIs: "Changes the selected network in your wallet.",
    human_chain_risk_1: "Wrong networks/RPCs can mislead you about assets or transactions",
    human_chain_safe_1: "Only switch/add networks you recognize.",
    human_chain_next_1: "Confirm chain name and chainId in the wallet prompt",
    human_watchasset_whatIs: "Adds a token/asset to your wallet UI for easier viewing.",
    human_watchasset_risk_1: "Fake tokens can impersonate real ones\u2014verify contract address and symbol",
    human_watchasset_safe_1: "Cross-check token details on a trusted explorer (e.g., Etherscan).",
    human_watchasset_next_1: "Verify token contract address and decimals",
    human_watchasset_reco: "Continue only if token details match an official source.",
    human_generic_whatIs: "A site requested a wallet action. Review details carefully.",
    human_generic_risk_1: "Unknown prompts can be part of phishing flows",
    human_generic_safe_1: "If in doubt, cancel and verify the site.",
    human_generic_next_1: "Check the URL and read the wallet prompt details",
    human_generic_reco: "Continue only if you understand and expected this request.",
    human_revoke_link_text: "Revoke permissions later: revoke.cash",
    trustReasonNotHttps: "Not HTTPS (higher risk of spoofing/injection).",
    trustReasonManyHyphens: "Many hyphens in the domain (common in lookalikes).",
    trustReasonSuspiciousKeywords: "Domain contains high-risk keywords (login/verify/secure/...).",
    trustReasonBrandLookalike: "Brand-like wording in domain but not the official domain.",
    trustReasonManySubdomains: "Unusually deep subdomain structure.",
    trustReasonNoHost: "Could not read the site hostname.",
    trustReasonAllowlistedVariant: "Domain matches a trusted pattern.",
    trustReasonUnknown: "No strong signals either way.",
    summary_ADD_CHAIN_1: "The site wants to add a new network to your wallet.",
    summary_ADD_CHAIN_2: "Carefully verify the chainId and network name.",
    summary_SIGN_MESSAGE_1: "You are signing a message (not a transaction).",
    summary_SIGN_MESSAGE_2: "Signatures can be used for logins/terms/permissions.",
    summary_SIGN_TYPED_DATA_1: "You are signing structured data (EIP-712).",
    summary_SIGN_TYPED_DATA_2: "This may authorize spending/orders depending on the content.",
    summary_SIGN_TYPED_DATA_3: "Verify the spender/contract involved.",
    summary_SEND_TX_1: "You are sending an on-chain transaction.",
    summary_SEND_TX_2: "This may move ETH/tokens or interact with a contract.",
    summary_SEND_TX_3: "Verify value, network and destination before confirming.",
    summary_WATCH_ASSET_1: "The site wants to add a token/asset to your wallet.",
    summary_WATCH_ASSET_2: "Verify the token symbol and contract address.",
    summary_SOLANA_1: "Solana signature or transaction. Values will be confirmed in your wallet.",
    summary_UNKNOWN_1: "The site is making an unknown wallet request.",
    summary_UNKNOWN_2: "If you don't recognize it, cancel.",
    // Buttons / friction
    btn_cancel: "Cancel",
    btn_continue: "Continue",
    toast_request_expired: "Request expired. Please retry the action on the site.",
    simulation_tx_will_fail: "THIS TRANSACTION WILL FAIL",
    btn_close: "Close",
    btn_proceed_anyway: "Proceed anyway",
    override_checkbox: "I understand the risk and want to proceed",
    override_countdown: "({s}s)",
    tip_revoke: "Revoke permissions later: revoke.cash",
    cost_summary_title: "Cost summary",
    costs_title: "Costs and impact",
    impact_title: "Impact",
    permission_for: "Permission for",
    addr_marked_public: "Flagged in public database",
    risk_title: "Risk and why",
    what_to_do_now: "What to do now",
    site_label: "Site",
    network_label: "Network",
    severity_BLOCKED: "BLOCKED",
    severity_HIGH: "HIGH",
    severity_WARN: "WARNING",
    severity_LOW: "LOW",
    cost_you_send: "You send",
    cost_fee_only: "fee only",
    cost_value: "Value",
    cost_fee: "Estimated fee",
    cost_total: "Estimated total",
    cost_fee_unknown: "A network fee will be charged (confirm in wallet)",
    network_switch_title: "Network switch",
    network_current: "Current network",
    network_requested: "Requested network",
    trusted_domain_ref_title: "Trusted domains (reference)",
    tx_cost_sending: "You are sending {value} + network fee",
    tx_cost_gas_only: "Even with no native currency sent, you will pay a network fee (gas)",
    gas_calculating: "calculating\u2026",
    tx_destination: "Destination",
    token_verified_uniswap: "Token Verified (Uniswap List)",
    token_unknown_unverified: "Token Unknown (Not Verified)",
    tx_contract_method: "Contract/method",
    tx_max_gas_fee: "Max gas fee",
    tx_max_total: "Max total",
    tx_fee_estimated_by_wallet: "The wallet will estimate the fee in the next step.",
    network_target: "Target network",
    switch_no_gas: "Switching networks usually costs NO gas.",
    switch_next_step_gas: "The next step (purchase/transaction) will have a network fee.",
    switch_note_inline: "Switching networks usually costs NO gas. The next step (purchase/transaction) will have a network fee.",
    sendtx_reco: "Confirm in your wallet only if the details (value, network and contract) are correct.",
    // Risk/trust labels
    risk_LOW: "Low",
    risk_WARN: "Warning",
    risk_HIGH: "High",
    recommend_ALLOW: "Allow",
    recommend_WARN: "Warn",
    recommend_HIGH: "High risk",
    recommend_BLOCK: "Block",
    trust_unknown: "Unknown",
    trust_suspicious: "Suspicious",
    trust_likelyOfficial: "Known domain (reference list)",
    trust_domainNotRecognized: "Domain not recognized",
    // Phishing hard-block
    phishing_hard_block: "Domain is in a phishing blacklist. Blocked.",
    // Toasts
    toast_extension_updated: "Extension updated \u2014 reload the tab.",
    toast_cannot_analyze: "Couldn't analyze. Reload the tab.",
    // Options page
    optionsTitle: "Crypto Wallet SignGuard \u2014 Settings",
    optionsSubtitle: "Control when SignGuard should warn and block.",
    dashboardLink: "Dashboard",
    onboardingTitle: "How to use",
    onboardingHowTo: "The extension intercepts sensitive requests (connect, sign, transaction) from injected wallets (window.ethereum / window.solana). When detected, it shows an overlay for you to review before the wallet opens.",
    onboardingWhatItDoes: "Does: warns before connecting, signing, or sending; checks domain against phishing lists; shows transaction intent (swap, NFT, approval).",
    onboardingWhatItDoesNot: "Does not: protect QR/WalletConnect connections; guarantee contracts are safe; replace manual verification.",
    onboardingLinkRevoke: "revoke.cash \u2014 revoke permissions",
    onboardingLinkEtherscan: "Etherscan \u2014 explore transactions",
    exportDebugRequiresDebugMode: "Enable Debug Mode first to export events.",
    securityModeLabel: "Security mode",
    securityModeDesc: "Strict blocks more; Balanced warns; Relaxed reduces friction; Off disables blocking.",
    modeStrict: "Strict",
    modeBalanced: "Balanced",
    modeRelaxed: "Relaxed",
    modeOff: "Off",
    strictBlockApprovalsUnlimitedLabel: "Strict: block unlimited approve",
    strictBlockApprovalsUnlimitedDesc: "Blocks ERC20 unlimited approvals (MAX_UINT256).",
    strictBlockSetApprovalForAllLabel: "Strict: block setApprovalForAll",
    strictBlockSetApprovalForAllDesc: "Blocks permission to move all NFTs.",
    strictBlockPermitLikeLabel: "Strict: block unlimited Permit",
    strictBlockPermitLikeDesc: "Blocks Permit (EIP-2612) unlimited signatures.",
    assetEnrichmentEnabledLabel: "Asset enrichment",
    assetEnrichmentEnabledDesc: "Fetches token symbol/name via eth_call.",
    addressIntelEnabledLabel: "Address threat intel",
    addressIntelEnabledDesc: "Checks spender/operator/to against blacklist.",
    riskWarningsLabel: "Risk warnings",
    riskWarningsDesc: "Shows warnings and recommendations before opening your wallet.",
    connectOverlayLabel: "Overlay on connect",
    connectOverlayDesc: "Also show the overlay for connect/permissions requests.",
    blockHighRiskLabel: "Block high risk",
    blockHighRiskDesc: "Automatically blocks high-risk actions.",
    requireTypedOverrideLabel: "Require override for typed data (high risk)",
    requireTypedOverrideDesc: "For high-risk EIP-712 signatures, requires extra confirmation.",
    allowOverrideOnPhishingLabel: "Allow override on phishing (NOT recommended)",
    allowOverrideOnPhishingDesc: "If disabled (default), phishing blacklist matches are blocked with no option to proceed.",
    mode_off_reason: "OFF mode: no blocking.",
    address_flagged_reason: "Flagged address/contract: {label} ({category})",
    addr_sanctioned_block: "Address is on a sanctions list.",
    addr_scam_reported_warn: "Address marked as suspected/reported.",
    addr_phishing_reported_warn: "Address marked as suspected/reported.",
    addr_malicious_contract_warn: "Contract marked as malicious.",
    asset_info_reason: "Asset: {sym} ({kind})",
    reason_permission_tokens: "Permission to spend tokens",
    reason_permission_all_nfts: "Permission to move ALL NFTs",
    reason_transfer_tokens: "Token/NFT transfer",
    domainChecksLabel: "Domain checks",
    domainChecksDesc: "Warns about suspicious domain patterns when not on your allowlist.",
    allowlistLabel: "Allowlist (trusted domains)",
    allowlistDesc: "One domain per line. Example: opensea.io",
    vaultTitle: "SignGuard Vault",
    vaultDesc: "Contracts in this list can never be transacted without explicit unlock in options.",
    vaultAddLabel: "Add contract to vault",
    vaultAddButton: "Add to Vault",
    vaultListLabel: "Locked contracts",
    vaultListEmpty: "No contracts in vault.",
    vaultRemove: "Remove",
    vaultInvalidAddress: "Invalid address. Use 0x and 40 hex characters.",
    vaultAlreadyAdded: "This contract is already in the vault.",
    vaultBlockedMessage: "SignGuard: Asset Locked in Vault. Unlock in options to continue.",
    addSuggested: "Add suggested",
    save: "Save",
    saved: "Saved",
    intelTitle: "Threat Intel",
    intelSubtitle: "Domain lists (pluggable sources) used in analysis.",
    intelTrustedCountLabel: "Trusted domains",
    intelBlockedCountLabel: "Blocked domains",
    intelBlockedAddressCountLabel: "Blocked addresses",
    intelUpdatedAtLabel: "Last update",
    intelUpdateNow: "Update now",
    enableIntelLabel: "Use Threat Intel",
    enableIntelDesc: "Uses trusted/blocked domain lists in analysis.",
    customTrustedDomainsLabel: "Trusted domains (custom list)",
    customTrustedDomainsDesc: "One per line. Example: mysite.io",
    customBlockedDomainsLabel: "Blocked domains (custom list)",
    customBlockedDomainsDesc: "One per line. Always blocked.",
    exportListsLabel: "Export lists",
    privacyLimitsTitle: "Privacy & Limitations",
    privacyLimitsLine1: "The extension does not access your seed phrase and has no custody.",
    privacyLimitsLine2: "It analyzes domains and transaction data displayed by the browser for alerts. No 100% guarantee.",
    privacyLimitsLine3: "Threat intel may be updated from public sources (optional).",
    cloudIntelOptInLabel: "Allow external checks",
    cloudIntelOptInDesc: "More protection; may send domain/addresses for validation (prepared for P1).",
    showUsdLabel: "Show USD values",
    showUsdDesc: "Converts native and token amounts to USD when available.",
    tabSettings: "Settings",
    tabHistory: "History",
    tabPlan: "Plan",
    historySubtitle: "Recent overlay decisions.",
    historyExport: "Export JSON",
    historyClear: "Clear",
    historyEmpty: "No entries.",
    request_expired_toast: "Request expired. Redo the action on the site and try again.",
    failopen_armed_banner: "Analysis took too long. You can Continue anyway or Cancel.",
    decision_allow: "Allowed",
    decision_block: "Blocked",
    planSubtitle: "Manage your plan and license.",
    planCurrent: "Current plan",
    planLicenseKey: "License key",
    planActivate: "Activate",
    planGoPro: "Subscribe PRO",
    // Options: Safety notes + debug
    safetyNotesTitle: "Limitations & security",
    safetyNotesLine1: "This extension monitors requests from injected wallets (window.ethereum / window.solana).",
    safetyNotesLine2: "Connections via QR/WalletConnect may not be intercepted. Always verify in your wallet.",
    safetyNotesLinkRevoke: "revoke.cash",
    safetyNotesLinkEtherscan: "etherscan.io",
    debugModeLabel: "Debug mode",
    debugModeDesc: "Stores the last 20 events (without large payloads) for support.",
    exportDebug: "Export",
    // Overlay: intent + permission + copy
    looks_like: "Looks like:",
    intent_NFT_PURCHASE: "NFT purchase",
    intent_SWAP: "Swap",
    intent_APPROVAL: "Permission",
    intent_SEND: "Send",
    intent_UNKNOWN: "Unknown",
    intent_ETH_TRANSFER: "ETH transfer",
    intent_TOKEN_TRANSFER: "Token transfer",
    intent_NFT_TRANSFER: "NFT transfer",
    intent_CONTRACT_INTERACTION: "Contract interaction",
    intent_SWITCH_CHAIN: "Network switch",
    intent_ADD_CHAIN: "Add network",
    intent_WATCH_ASSET: "Add token",
    intent_SOLANA: "Solana signature/transaction",
    intent_SIGNATURE: "Signature",
    intent_TYPED_DATA: "Typed data",
    wallet_label: "Wallet",
    wallet_detecting: "Detecting\u2026",
    wallet_evm_generic: "EVM Wallet",
    trust_disclaimer: "Reference list \u2260 guarantee. Scammers may use similar domains.",
    hint_wallet_popup: "Your wallet should open now. If it doesn't, click the wallet icon and check for pending requests.",
    add_chain_network_label: "Network to add",
    add_chain_rpc_label: "RPC",
    watch_asset_token_label: "Token to add",
    modeLabel: "Mode:",
    popupPauseProtection: "PAUSE PROTECTION",
    popupStatusProtected: "Protected",
    popupStatusPaused: "Paused",
    fortressModeLabel: "FORTRESS MODE",
    fortressModeDesc: "Blocks all token approvals except on trusted sites.",
    fortress_block_message: "SignGuard Fortress: Approval blocked on unknown site. Disable Fortress mode to proceed.",
    honeypot_message: "\u{1FAA4} HONEYPOT: You can buy, but you will NOT be able to sell.",
    info_unavailable: "Information unavailable.",
    explain_switch_short: "The site is requesting a network (chain) switch in your wallet.",
    human_chain_reco: "Continue only if you expected a network switch and it looks correct.",
    trustReasonAllowlisted: "Domain is present in a trusted seed list.",
    trustReasonPhishingBlacklist: "Domain is in a phishing blacklist (reference list).",
    fee_unknown_wallet_will_estimate: "Fee: will be displayed by wallet",
    label_you_send: "You send",
    label_fee_likely: "Estimated fee (likely)",
    label_fee_max: "Max fee (worst case)",
    label_total_likely: "Total likely",
    label_total_max: "Total max",
    fee_gt_value: "The max fee is HIGHER than the value being sent. Make sure this is expected.",
    check_wallet_network_fee: "You haven't seen the fee yet. Check the wallet 'Network fee' before confirming.",
    label_max_fee: "Max fee",
    label_max_total: "Max total",
    switch_summary_no_gas: "Switching networks usually has no gas fee, but it changes which assets you see.",
    permission_title: "Permission",
    permission_token_contract: "Contract",
    permission_spender: "Spender",
    permission_operator: "Operator",
    permission_unlimited: "Unlimited",
    approval_unlimited_detected: "Unlimited approval detected",
    permit_signature_detected: "Permit-style signature detected (may authorize token spending)",
    token_transfer_detected: "Token transfer detected",
    nft_transfer_detected: "NFT transfer detected",
    transfer_token_title: "Token transfer",
    transfer_nft_title: "NFT transfer",
    transfer_amount: "Amount",
    transfer_token_id: "Token ID",
    yes: "Yes",
    no: "No",
    copy: "Copy",
    chainChangeTitle: "Network switch/add request",
    watchAssetTitle: "Add asset request",
    domainPunycodeReason: "Domain uses punycode (xn--); verify the URL.",
    domainDoubleDashReason: "Domain contains double hyphen (suspicious).",
    domainNumberPatternReason: "Domain with many numbers (common in phishing).",
    domainLookalikeReason: "Possible lookalike of official domain {legit}.",
    suspiciousWebsitePatterns: "Suspicious website patterns.",
    page_risk_suspicious_banner: "\u26A0\uFE0F SignGuard: Suspicious Site Detected",
    connectTitle: "Connect wallet",
    connectReason: "The site wants to connect to your wallet.",
    walletRequestPermissionsTitle: "Request permissions",
    walletRequestPermissionsReason: "The site wants additional wallet permissions.",
    typedDataWarnReason: "Structured data signature (EIP-712); may authorize actions.",
    signatureRequest: "Signature request",
    rawSignWarnReason: "Raw message signature; may authorize off-chain actions.",
    tokenApproval: "Token approval",
    unlimitedApprovalReason: "Unlimited approval detected (MAX_UINT256).",
    unlimitedApprovalDetected: "Unlimited approval detected",
    nftOperatorApprovalReason: "Permission to move ALL NFTs in the collection.",
    nftOperatorApproval: "NFT operator approval",
    txPreview: "Transaction preview",
    txWarnReason: "On-chain transaction; verify value, destination and network.",
    unknownMethodReason: "Unknown wallet method.",
    warningsDisabledReason: "Warnings disabled in settings.",
    analyzing: "Analyzing\u2026",
    analyzing_subtitle: "Site \u2022 Method",
    analyzing_hint: "Validating domain and estimating impact",
    fallback_partial_check: "No full verification right now \u2014 review the details below before proceeding.",
    fallback_partial_verification: "Partial verification now \u2014 review the details below before proceeding.",
    loading_base: "Loading base\u2026",
    analyzerUnavailableTitle: "Analyzer unavailable",
    analysis_unavailable: "Analysis unavailable \u2014 verify in your wallet before continuing.",
    dados_parciais_title: "Partial data \u2014 confirm in wallet",
    dados_parciais_subtitle: "Showing what we could analyze. Verify details in your wallet before continuing.",
    risk_low: "Low",
    risk_warn: "Warning",
    risk_high: "High",
    risk_block: "Blocked",
    trustReasonAllowlistedMatched: "Domain in allowlist: {matched}.",
    list_empty_domains: "List empty. Open options to add trusted domains.",
    btn_open_options: "Open options",
    default_human_switch_what: "Switches the active network in your wallet (e.g. Ethereum \u2192 another network).",
    default_human_switch_risk: "You may sign/transact on the wrong network if the switch is unexpected.",
    default_human_switch_safe: "Confirm the requested network and that the site is correct.",
    default_human_switch_next: "If correct, approve in the wallet. If something looks wrong, cancel.",
    default_human_contract_what: "Sends a transaction to a contract (action within the dApp).",
    default_human_contract_risk: "Actual cost may vary and the action may move assets/tokens via the contract.",
    default_human_contract_safe: "Check destination (to), network, value and fee (Network fee) in the wallet.",
    default_human_contract_next: "If details match, proceed. Otherwise, cancel.",
    default_human_eth_what: "Sends ETH directly to an address.",
    default_human_eth_risk: "Transfers are irreversible if the destination is wrong.",
    default_human_eth_safe: "Verify the address and amount. Be wary of links/shorteners.",
    default_human_eth_next: "Only confirm if you recognize the recipient.",
    default_human_typed_what: "Off-chain signature (EIP-712). May authorize actions without paying gas.",
    default_human_typed_risk: "May grant permissions/authorizations (e.g. permit/approval) depending on content.",
    default_human_typed_safe: "Review what is being authorized (spender/operator) and the domain/contract.",
    default_human_typed_next: "If unsure, cancel and verify on the dApp\u2019s official site.",
    default_human_generic_what: "Action requested by the dApp.",
    default_human_generic_risk: "If something doesn\u2019t make sense, cancel.",
    default_human_generic_safe: "Confirm domain, network and details in the wallet.",
    default_human_generic_next: "Proceed only if everything looks correct.",
    verdict_ok: "OK",
    verdict_warn: "Warning",
    verdict_high: "High risk",
    verdict_block: "Blocked",
    coverage_label: "Coverage",
    coverage_limited: "limited coverage",
    trusted_domain_ref_empty: "Reference list has not loaded yet.",
    trusted_domain_ref_loading: "Loading reference list\u2026",
    trusted_domain_ref_refresh: "Update lists",
    trusted_domain_ref_view_more: "View more",
    trusted_domains_loading: "Loading reference list\u2026",
    trusted_domains_more: "+{n}",
    trusted_domains_search_placeholder: "Filter domains\u2026",
    trusted_domains_update_now: "Update now",
    trusted_domains_auto_update: "Updates automatically in options",
    banner_ok_no_known_threats: "OK: no known scam/threat signals detected.",
    banner_block_known_threat: "Blocked: known threat detected.",
    banner_local_verification: "Caution: local verification (cache). Review the details below before proceeding.",
    banner_basic_verification: "Caution: basic verification. Review the details carefully before proceeding.",
    list_site_reputation: "Site reputation",
    list_site_trusted: "Trusted",
    list_site_blocked: "Blocked",
    list_site_unknown: "Unknown",
    updated_x_hours: "Base updated {n} hour(s) ago",
    updated_x_days: "Base updated {n} day(s) ago",
    tip_check_wallet_details: "Verify amount, network and fee in your wallet.",
    no_alerts_known: "No known alerts were detected for this context.",
    still_review_wallet: "Still, review in your wallet (value, network, destination and fee).",
    site_status_known: "known reference",
    site_status_not_in_list: "Site is not on the reference list",
    destination_contract: "Contract",
    destination_wallet: "Wallet",
    overlay_coverage_title: "Security coverage",
    overlay_simulation_title: "Simulation",
    overlay_address_intel_title: "Address intel",
    btn_copy: "Copy",
    btn_copy_json: "Copy JSON",
    chain_not_recognized: "Chain not recognized",
    simulation_skipped_caution: "No simulation \u2014 validate with extra care.",
    toast_copied: "Copied",
    btn_ver_menos: "Show less"
  }
};
function format(template, params) {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (_m, k) => k in params ? String(params[k]) : `{${k}}`);
}
function t(key, params) {
  const loc = detectLocale();
  const v = dict[loc]?.[key] || dict.en[key] || key;
  const rendered = format(v, params);
  if (rendered !== key) return rendered;
  try {
    const c = globalThis.chrome;
    const msg = c?.i18n?.getMessage?.(key);
    if (msg) return format(msg, params);
  } catch {
  }
  return rendered;
}

// src/shared/trust.ts
init_utils();
function countChar(haystack, ch) {
  return (haystack.match(new RegExp(`\\${ch}`, "g")) || []).length;
}
function hasSuspiciousKeywords(host) {
  const h = host.toLowerCase();
  return /(login|secure|verify|account|wallet|airdrop|claim|support|auth)/.test(h);
}
function hasBrandLookalike(host) {
  const h = host.toLowerCase();
  const brands = ["opensea", "uniswap", "blur", "metamask", "aave", "etherscan", "revoke"];
  return brands.some((b) => h.includes(b)) && !/(opensea\.io|uniswap\.org|blur\.io|metamask\.io|aave\.com|etherscan\.io|revoke\.cash)$/.test(h);
}
function computeTrustVerdict(host, allowlist) {
  const h = (host || "").toLowerCase();
  if (!h) {
    return { verdict: "UNKNOWN", trustScore: 50, reasons: [t("trustReasonNoHost")] };
  }
  let trustScore = 55;
  const reasons = [];
  const matched = allowlist.find((d) => {
    const dom = (d || "").toLowerCase().trim();
    if (!dom) return false;
    return h === dom || h.endsWith("." + dom);
  });
  if (matched) {
    trustScore = 92;
    reasons.push(t("trustReasonAllowlistedMatched", { matched }));
    return { verdict: "LIKELY_OFFICIAL", trustScore, reasons, matchedAllowlistDomain: matched };
  }
  const isPunycode = h.startsWith("xn--") || h.includes(".xn--");
  const hasDoubleDash = h.includes("--");
  const digits = (h.match(/\d/g) || []).length;
  const hyphens = countChar(h, "-");
  const dots = countChar(h, ".");
  const parts = h.split(".").filter(Boolean);
  const subdomainParts = Math.max(0, parts.length - 2);
  const suspicious = [];
  if (isPunycode) suspicious.push(t("domainPunycodeReason"));
  if (hasDoubleDash) suspicious.push(t("domainDoubleDashReason"));
  if (digits >= 4) suspicious.push(t("domainNumberPatternReason"));
  if (hyphens >= 3) suspicious.push(t("trustReasonManyHyphens"));
  if (hasSuspiciousKeywords(h)) suspicious.push(t("trustReasonSuspiciousKeywords"));
  if (hasBrandLookalike(h)) suspicious.push(t("trustReasonBrandLookalike"));
  if (subdomainParts >= 3 && dots >= 4) suspicious.push(t("trustReasonManySubdomains"));
  const allowlistedElsewhere = isAllowlisted(h, allowlist);
  if (allowlistedElsewhere) {
    trustScore = Math.max(trustScore, 70);
    reasons.push(t("trustReasonAllowlistedVariant"));
  }
  if (suspicious.length) {
    trustScore = 22;
    reasons.push(...suspicious.slice(0, 4));
    return { verdict: "SUSPICIOUS", trustScore, reasons };
  }
  reasons.push(t("trustReasonUnknown"));
  return { verdict: "UNKNOWN", trustScore, reasons };
}

// src/shared/explain.ts
function explainMethod(method) {
  const m = (method || "").toLowerCase();
  if (m === "eth_requestaccounts" || m === "wallet_requestpermissions") {
    return {
      title: t("explain_connect_title"),
      short: t("explain_connect_short"),
      why: t("explain_connect_why")
    };
  }
  if (m === "personal_sign" || m === "eth_sign") {
    return {
      title: t("explain_sign_title"),
      short: t("explain_sign_short"),
      why: t("explain_sign_why")
    };
  }
  if (m === "eth_signtypeddata_v4") {
    return {
      title: t("explain_typed_title"),
      short: t("explain_typed_short"),
      why: t("explain_typed_why")
    };
  }
  if (m === "eth_sendtransaction") {
    return {
      title: t("explain_tx_title"),
      short: t("explain_tx_short"),
      why: t("explain_tx_why")
    };
  }
  if (m === "wallet_switchethereumchain") {
    return {
      title: t("explain_switch_title"),
      short: t("explain_switch_short"),
      why: t("explain_switch_why")
    };
  }
  if (m === "wallet_addethereumchain") {
    return {
      title: t("explain_addchain_title"),
      short: t("explain_addchain_short"),
      why: t("explain_addchain_why")
    };
  }
  if (m === "wallet_watchasset") {
    return {
      title: t("explain_watchasset_title"),
      short: t("explain_watchasset_short"),
      why: t("explain_watchasset_why")
    };
  }
  return {
    title: t("explain_generic_title"),
    short: t("explain_generic_short"),
    why: t("explain_generic_why")
  };
}
function buildHumanLists(method, trustVerdict) {
  const m = (method || "").toLowerCase();
  const suspicious = trustVerdict === "SUSPICIOUS";
  if (m === "eth_requestaccounts" || m === "wallet_requestpermissions") {
    return {
      whatItDoes: [t("human_connect_whatIs"), t("human_connect_why_1")].slice(0, 2),
      risks: [t("human_connect_risk_1"), t("human_connect_risk_2"), t("human_connect_risk_3")].slice(0, 3),
      safeNotes: [t("human_connect_safe_1")].slice(0, 2),
      nextSteps: [t("human_connect_next_1"), t("human_connect_next_2")].slice(0, 3)
    };
  }
  if (m === "personal_sign" || m === "eth_sign" || m === "eth_signtypeddata_v4") {
    const risks = [t("human_sign_risk_1"), t("human_sign_risk_2")];
    if (m === "eth_signtypeddata_v4") risks.push(t("human_typed_risk_1"));
    return {
      whatItDoes: [t(m === "eth_signtypeddata_v4" ? "human_typed_whatIs" : "human_sign_whatIs"), t("explain_sign_why")].slice(0, 2),
      risks: risks.slice(0, 3),
      safeNotes: [t("human_sign_safe_1")].slice(0, 2),
      nextSteps: [t("human_sign_next_1"), t("human_sign_next_2")].slice(0, 3)
    };
  }
  if (m === "eth_sendtransaction") {
    return {
      whatItDoes: [t("human_tx_whatIs")].slice(0, 2),
      risks: [t("human_tx_risk_1")].slice(0, 3),
      safeNotes: [t("human_tx_safe_1")].slice(0, 1),
      nextSteps: [t("human_tx_next_1")].slice(0, 3)
    };
  }
  if (m === "wallet_switchethereumchain" || m === "wallet_addethereumchain") {
    return {
      whatItDoes: [t("human_chain_whatIs")].slice(0, 2),
      risks: [t("human_chain_risk_1")].slice(0, 3),
      safeNotes: [t("human_chain_safe_1")].slice(0, 1),
      nextSteps: [t("human_chain_next_1")].slice(0, 3)
    };
  }
  if (m === "wallet_watchasset") {
    return {
      whatItDoes: [t("human_watchasset_whatIs")].slice(0, 2),
      risks: [t("human_watchasset_risk_1")].slice(0, 3),
      safeNotes: [t("human_watchasset_safe_1")].slice(0, 1),
      nextSteps: [t("human_watchasset_next_1")].slice(0, 3)
    };
  }
  return {
    whatItDoes: [t("human_generic_whatIs")].slice(0, 2),
    risks: [t("human_generic_risk_1")].slice(0, 3),
    safeNotes: [t("human_generic_safe_1")].slice(0, 1),
    nextSteps: [t("human_generic_next_1")].slice(0, 3)
  };
}

// src/shared/constants.ts
var SUGGESTED_TRUSTED_DOMAINS = [
  "opensea.io",
  "blur.io",
  "app.uniswap.org",
  "uniswap.org",
  "looksrare.org",
  "x2y2.io",
  "etherscan.io",
  "arbitrum.io",
  "app.aave.com",
  "curve.finance",
  "revoke.cash",
  "rabby.io",
  "metamask.io"
];

// src/intelSources.ts
var DOMAIN_SOURCES = [
  // Blocklists (Anti-Phishing)
  {
    id: "metamask-phishing",
    kind: "blocklist",
    url: "https://raw.githubusercontent.com/MetaMask/eth-phishing-detect/main/src/hosts.txt",
    format: "hosts"
  },
  {
    id: "phishdestroy",
    kind: "blocklist",
    url: "https://raw.githubusercontent.com/phishdestroy/destroylist/main/rootlist/formats/primary/domains.txt",
    format: "txt"
  },
  {
    id: "cryptoscamdb",
    kind: "blocklist",
    url: "https://raw.githubusercontent.com/CryptoScamDB/blacklist/master/data/urls.txt",
    format: "txt"
  },
  {
    id: "409h",
    kind: "blocklist",
    url: "https://raw.githubusercontent.com/409H/EtherAddressLookup/master/blacklists/domains.json",
    format: "json-array"
  },
  // Allowlists (Legítimos)
  {
    id: "defillama",
    kind: "allowlist",
    url: "https://api.llama.fi/protocols",
    format: "defillama"
  },
  {
    id: "uniswap-tokens",
    kind: "allowlist",
    url: "https://gateway.ipfs.io/ipns/tokens.uniswap.org",
    format: "uniswap-tokens"
  }
];
function normalizeDomain(raw) {
  let s = String(raw || "").trim().toLowerCase();
  if (!s) return "";
  if (s.startsWith("#")) return "";
  try {
    if (s.startsWith("http://") || s.startsWith("https://")) {
      const u = new URL(s);
      s = u.hostname;
    }
  } catch {
  }
  if (s.startsWith("www.")) s = s.slice(4);
  if (s.startsWith("0.0.0.0 ") || s.startsWith("127.0.0.1 ")) {
    s = s.replace(/^(0\.0\.0\.0|127\.0\.0\.1)\s+/, "");
  }
  if (s.startsWith("*.")) s = s.slice(2);
  s = s.replace(/\.+$/, "").split("/")[0] || "";
  return s;
}
function normalizeAddress2(raw) {
  const s = String(raw || "").trim().toLowerCase();
  if (s.startsWith("0x") && s.length === 42 && /^0x[a-f0-9]{40}$/.test(s)) return s;
  return "";
}
function parseHostsFormat(text) {
  const out = [];
  for (const line of text.split("\n")) {
    const h = normalizeDomain(line);
    if (h) out.push(h);
  }
  return [...new Set(out)];
}
function parseJsonArray(data) {
  const out = [];
  if (!Array.isArray(data)) return out;
  for (const item of data) {
    const s = typeof item === "string" ? item : String(item?.id ?? item?.domain ?? "");
    const h = normalizeDomain(s);
    if (h) out.push(h);
  }
  return [...new Set(out)];
}
function parseDefiLlama(data) {
  const out = [];
  if (!data || typeof data !== "object") return out;
  const list = Array.isArray(data) ? data : Array.isArray(data.protocols) ? data.protocols : [];
  for (const p of list) {
    const obj = typeof p === "object" && p !== null ? p : {};
    const url = obj.url ?? obj.homepage ?? obj.website ?? "";
    if (typeof url === "string" && url) {
      const h = normalizeDomain(url);
      if (h) out.push(h);
    }
    const gecko = obj.gecko_id;
    if (gecko && typeof obj.name === "string") {
      const slug = String(obj.slug || obj.name || "").toLowerCase().replace(/\s+/g, "-");
      if (slug) out.push(normalizeDomain(slug + ".com"));
    }
  }
  return [...new Set(out)];
}
function parseUniswapTokens(data) {
  const out = [];
  if (!data || typeof data !== "object") return out;
  const tokens = Array.isArray(data.tokens) ? data.tokens : [];
  for (const t2 of tokens) {
    const addr = t2?.address;
    const a = normalizeAddress2(typeof addr === "string" ? addr : "");
    if (a) out.push(a);
  }
  return [...new Set(out)];
}
async function fetchSource(source, timeoutMs = 8e3) {
  try {
    const ctrl = new AbortController();
    const t2 = setTimeout(() => ctrl.abort(), timeoutMs);
    const res = await fetch(source.url, { cache: "no-store", signal: ctrl.signal });
    clearTimeout(t2);
    if (!res.ok) return { ok: false, domains: [], error: `HTTP ${res.status}` };
    const text = await res.text();
    let domains = [];
    let addresses;
    switch (source.format) {
      case "hosts":
      case "txt":
        domains = parseHostsFormat(text);
        break;
      case "json-array": {
        try {
          domains = parseJsonArray(JSON.parse(text));
        } catch {
          return { ok: false, domains: [], error: "JSON parse failed" };
        }
        break;
      }
      case "defillama": {
        try {
          domains = parseDefiLlama(JSON.parse(text));
        } catch {
          return { ok: false, domains: [], error: "JSON parse failed" };
        }
        break;
      }
      case "uniswap-tokens": {
        try {
          const parsed = JSON.parse(text);
          addresses = parseUniswapTokens(parsed);
        } catch {
          return { ok: false, domains: [], addresses: [], error: "JSON parse failed" };
        }
        break;
      }
      default:
        return { ok: false, domains: [], error: "Unknown format" };
    }
    return { ok: true, domains, addresses };
  } catch (e) {
    return { ok: false, domains: [], error: e?.message || String(e) };
  }
}

// src/intel.ts
var METAMASK_HOSTS = "https://raw.githubusercontent.com/MetaMask/eth-phishing-detect/main/src/hosts.txt";
var MEW_DARKLIST = "https://raw.githubusercontent.com/MyEtherWallet/ethereum-lists/master/src/urls/urls-darklist.json";
var MEW_LIGHTLIST = "https://raw.githubusercontent.com/MyEtherWallet/ethereum-lists/master/src/urls/urls-lightlist.json";
var CRYPTO_SCAM_DB_BLACKLIST = "https://api.cryptoscamdb.org/v1/blacklist";
var CRYPTO_SCAM_DB_WHITELIST = "https://api.cryptoscamdb.org/v1/whitelist";
var CRYPTO_SCAM_DB_BLOCK_TXT = "https://gitlab.com/KevinThomas0/cryptoscamdb-lists/-/raw/master/cryptoscamdb-blocklist.txt";
var CRYPTO_SCAM_DB_ALLOW_TXT = "https://gitlab.com/KevinThomas0/cryptoscamdb-lists/-/raw/master/cryptoscamdb-allowlist.txt";
var POLKADOT_ALL = "https://raw.githubusercontent.com/polkadot-js/phishing/master/all.json";
var POLKADOT_ADDRESSES = "https://raw.githubusercontent.com/polkadot-js/phishing/master/address.json";
var SCAMSNIFFER_DOMAINS = "https://raw.githubusercontent.com/scamsniffer/scam-database/main/blacklist/domains.json";
var SCAMSNIFFER_ADDRESSES = "https://raw.githubusercontent.com/scamsniffer/scam-database/main/blacklist/address.json";
var FETCH_TIMEOUT_MS = 4e3;
async function fetchWithTimeout(url, init) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { ...init, signal: ctrl.signal, cache: "no-store" });
    return res;
  } finally {
    clearTimeout(timer);
  }
}
var TRUSTED_SEED = [
  "opensea.io",
  "blur.io",
  "looksrare.org",
  "rarible.com",
  "magiceden.io",
  "x2y2.io",
  "app.uniswap.org",
  "uniswap.org",
  "1inch.io",
  "app.1inch.io",
  "matcha.xyz",
  "cow.fi",
  "sushiswap.fi",
  "curve.fi",
  "balancer.fi",
  "app.aave.com",
  "aave.com",
  "compound.finance",
  "makerdao.com",
  "lido.fi",
  "etherscan.io",
  "arbiscan.io",
  "polygonscan.com",
  "bscscan.com",
  "basescan.org",
  "optimistic.etherscan.io",
  "snowtrace.io",
  "bridge.arbitrum.io",
  "bridge.base.org",
  "app.optimism.io",
  "polygon.technology",
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
function normalizeHost2(host) {
  let h = String(host || "").trim().toLowerCase().replace(/\.$/, "");
  try {
    if (h.startsWith("http")) {
      const u = new URL(h);
      h = u.hostname;
    }
  } catch {
  }
  return h;
}
function hostMatches(host, domain) {
  const h = normalizeHost2(host);
  let d = normalizeHost2(domain);
  if (d.startsWith("*.")) d = d.slice(2);
  return h === d || h.endsWith("." + d);
}
function parseHostsTxt(txt) {
  return txt.split("\n").map((l) => l.trim()).filter((l) => !!l && !l.startsWith("#")).map((l) => normalizeHost2(l));
}
var EVM_ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/;
function addToMap(map, key, source) {
  const k = key.toLowerCase();
  if (!map[k]) map[k] = [];
  if (!map[k].includes(source)) map[k].push(source);
}
function parseMewId(id) {
  const s = String(id || "").trim();
  if (!s) return "";
  if (s.startsWith("http")) {
    try {
      return new URL(s).hostname.toLowerCase();
    } catch {
      return "";
    }
  }
  return normalizeHost2(s);
}
async function fetchScamSniffer(blockedDomains, blockedAddresses, sources) {
  let domCount = 0;
  try {
    const res = await fetchWithTimeout(SCAMSNIFFER_DOMAINS);
    if (res.ok) {
      const arr = await res.json();
      const list = Array.isArray(arr) ? arr : [];
      for (const item of list) {
        const h = normalizeHost2(String(item || ""));
        if (h) {
          addToMap(blockedDomains, h, "ScamSniffer-domains");
          domCount++;
        }
      }
    }
    sources.push({ name: "ScamSniffer domains", ok: res.ok, count: domCount, url: SCAMSNIFFER_DOMAINS });
  } catch {
    sources.push({ name: "ScamSniffer domains", ok: false, count: 0, url: SCAMSNIFFER_DOMAINS });
  }
  let addrCount = 0;
  try {
    const res = await fetchWithTimeout(SCAMSNIFFER_ADDRESSES);
    if (res.ok) {
      const arr = await res.json();
      const list = Array.isArray(arr) ? arr : [];
      for (const item of list) {
        const s = String(item || "").trim().toLowerCase();
        if (s.startsWith("0x") && s.length === 42 && EVM_ADDRESS_REGEX.test(s)) {
          addToMap(blockedAddresses, s, "ScamSniffer-addresses");
          addrCount++;
        }
      }
    }
    sources.push({ name: "ScamSniffer addresses", ok: res.ok, count: addrCount, url: SCAMSNIFFER_ADDRESSES });
  } catch {
    sources.push({ name: "ScamSniffer addresses", ok: false, count: 0, url: SCAMSNIFFER_ADDRESSES });
  }
}
async function fetchMewDarklist(blockedDomains, sources) {
  try {
    const res = await fetchWithTimeout(MEW_DARKLIST);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const arr = await res.json();
    const list = Array.isArray(arr) ? arr : [];
    for (const item of list) {
      const host = parseMewId(item?.id || "");
      if (host) addToMap(blockedDomains, host, "MEW-darklist");
    }
    sources.push({ name: "MEW darklist", ok: true, count: list.length, url: MEW_DARKLIST });
  } catch (e) {
    sources.push({ name: "MEW darklist", ok: false, count: 0, url: MEW_DARKLIST });
  }
}
async function fetchMewLightlist(allowedDomains, sources) {
  try {
    const res = await fetchWithTimeout(MEW_LIGHTLIST);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const arr = await res.json();
    const list = Array.isArray(arr) ? arr : [];
    for (const item of list) {
      const host = parseMewId(item?.id || "");
      if (host) addToMap(allowedDomains, host, "MEW-lightlist");
    }
    sources.push({ name: "MEW lightlist", ok: true, count: list.length, url: MEW_LIGHTLIST });
  } catch (e) {
    sources.push({ name: "MEW lightlist", ok: false, count: 0, url: MEW_LIGHTLIST });
  }
}
async function fetchMetamaskHosts() {
  try {
    const res = await fetchWithTimeout(METAMASK_HOSTS);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const blocked = parseHostsTxt(await res.text());
    return {
      blocked,
      source: { name: "MetaMask hosts", ok: true, count: blocked.length, url: METAMASK_HOSTS }
    };
  } catch (e) {
    return {
      blocked: [],
      source: {
        name: "MetaMask hosts",
        ok: false,
        count: 0,
        url: METAMASK_HOSTS
      }
    };
  }
}
async function fetchCryptoScamDb(blockedDomains, allowedDomains, sources) {
  try {
    const [blRes, wlRes] = await Promise.all([
      fetchWithTimeout(CRYPTO_SCAM_DB_BLACKLIST),
      fetchWithTimeout(CRYPTO_SCAM_DB_WHITELIST)
    ]);
    if (blRes.ok) {
      const j = await blRes.json();
      const list = Array.isArray(j?.result) ? j.result : [];
      for (const d of list) {
        const host = normalizeHost2(String(d));
        if (host) addToMap(blockedDomains, host, "CryptoScamDB");
      }
      sources.push({
        name: "CryptoScamDB blacklist",
        ok: true,
        count: list.length,
        url: CRYPTO_SCAM_DB_BLACKLIST
      });
    } else throw new Error("blacklist failed");
  } catch {
    try {
      const res = await fetchWithTimeout(CRYPTO_SCAM_DB_BLOCK_TXT);
      if (res.ok) {
        const blocked = parseHostsTxt(await res.text());
        for (const h of blocked) addToMap(blockedDomains, h, "CryptoScamDB-txt");
        sources.push({
          name: "CryptoScamDB blocklist",
          ok: true,
          count: blocked.length,
          url: CRYPTO_SCAM_DB_BLOCK_TXT
        });
      } else throw new Error("fallback failed");
    } catch {
      sources.push({
        name: "CryptoScamDB blacklist",
        ok: false,
        count: 0,
        url: CRYPTO_SCAM_DB_BLACKLIST
      });
    }
  }
  try {
    const wlRes = await fetchWithTimeout(CRYPTO_SCAM_DB_WHITELIST);
    if (wlRes.ok) {
      const j = await wlRes.json();
      const list = Array.isArray(j?.result) ? j.result : [];
      for (const d of list) {
        const host = normalizeHost2(String(d));
        if (host) addToMap(allowedDomains, host, "CryptoScamDB");
      }
      sources.push({
        name: "CryptoScamDB whitelist",
        ok: true,
        count: list.length,
        url: CRYPTO_SCAM_DB_WHITELIST
      });
    }
  } catch {
    try {
      const res = await fetchWithTimeout(CRYPTO_SCAM_DB_ALLOW_TXT);
      if (res.ok) {
        const allowed = parseHostsTxt(await res.text());
        for (const h of allowed) addToMap(allowedDomains, h, "CryptoScamDB-txt");
      }
    } catch {
    }
  }
}
async function fetchPolkadot(blockedDomains, allowedDomains, blockedAddresses, sources) {
  try {
    const res = await fetchWithTimeout(POLKADOT_ALL);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const j = await res.json();
    const allow = Array.isArray(j?.allow) ? j.allow : [];
    const deny = Array.isArray(j?.deny) ? j.deny : [];
    for (const d of allow) {
      const host = normalizeHost2(String(d));
      if (host) addToMap(allowedDomains, host, "polkadot-js");
    }
    for (const d of deny) {
      const host = normalizeHost2(String(d));
      if (host) addToMap(blockedDomains, host, "polkadot-js");
    }
    sources.push({
      name: "polkadot-js phishing",
      ok: true,
      count: deny.length,
      url: POLKADOT_ALL
    });
  } catch (e) {
    sources.push({
      name: "polkadot-js phishing",
      ok: false,
      count: 0,
      url: POLKADOT_ALL
    });
  }
  try {
    const res = await fetchWithTimeout(POLKADOT_ADDRESSES);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const j = await res.json();
    const entries = typeof j === "object" && j !== null ? Object.entries(j) : [];
    let evmCount = 0;
    for (const [_domain, arr] of entries) {
      const list = Array.isArray(arr) ? arr : [];
      for (const a of list) {
        const s = String(a || "").trim();
        if (EVM_ADDRESS_REGEX.test(s)) {
          addToMap(blockedAddresses, s.toLowerCase(), "polkadot-js");
          evmCount++;
        }
      }
    }
    sources.push({
      name: "polkadot-js addresses",
      ok: true,
      count: evmCount,
      url: POLKADOT_ADDRESSES
    });
  } catch {
    sources.push({
      name: "polkadot-js addresses",
      ok: false,
      count: 0,
      url: POLKADOT_ADDRESSES
    });
  }
}
async function fetchThreatIntel() {
  const now = Date.now();
  const blockedDomains = {};
  const allowedDomains = {};
  const blockedAddresses = {};
  const sources = [];
  const meta = await fetchMetamaskHosts();
  sources.push(meta.source);
  for (const h of meta.blocked) addToMap(blockedDomains, h, "MetaMask");
  const trustedTokenAddresses = [];
  for (const src of DOMAIN_SOURCES) {
    if (src.id === "metamask-phishing") continue;
    const r = await fetchSource(src);
    if (src.kind === "blocklist") {
      for (const h of r.domains) addToMap(blockedDomains, h, src.id);
    } else {
      for (const h of r.domains) addToMap(allowedDomains, h, src.id);
    }
    if (r.addresses?.length) trustedTokenAddresses.push(...r.addresses);
    sources.push({
      name: src.id,
      ok: r.ok,
      count: r.domains.length + (r.addresses?.length ?? 0),
      url: src.url
    });
  }
  await fetchMewDarklist(blockedDomains, sources);
  await fetchMewLightlist(allowedDomains, sources);
  await fetchScamSniffer(blockedDomains, blockedAddresses, sources);
  await fetchCryptoScamDb(blockedDomains, allowedDomains, sources);
  await fetchPolkadot(blockedDomains, allowedDomains, blockedAddresses, sources);
  const blockedDomainsList = Object.keys(blockedDomains);
  const trustedDomainsList = Array.from(/* @__PURE__ */ new Set([...Object.keys(allowedDomains), ...TRUSTED_SEED])).map(normalizeHost2).filter(Boolean);
  const blockedAddressesList = Object.entries(blockedAddresses).map(
    ([addr, srcs]) => ({
      address: addr,
      chainId: void 0,
      label: `Blocked (${srcs.join(", ")})`,
      category: "UNKNOWN",
      sourceId: srcs[0] || "intel",
      confidence: 1,
      updatedAt: now
    })
  );
  return {
    updatedAt: now,
    sources,
    blockedDomains,
    allowedDomains,
    blockedAddresses,
    trustedSeed: trustedDomainsList,
    trustedTokenAddresses: [...new Set(trustedTokenAddresses.map((a) => a.toLowerCase()))],
    blockedDomainsList,
    blockedAddressesList
  };
}
function hostInBlocked(intel, host) {
  if (!intel) return false;
  const h = normalizeHost2(host);
  return h in intel.blockedDomains || intel.blockedDomainsList.includes(h);
}

// src/addressIntel.ts
var STORAGE_ADDR_INTEL_KEY = "sg_addr_intel";
var ADDR_INTEL_TTL_MS = 24 * 60 * 60 * 1e3;
var FETCH_TIMEOUT_MS2 = 6e3;
var EVM_ADDRESS_REGEX2 = /^0x[a-fA-F0-9]{40}$/;
function normalizeAddr(addr) {
  const s = String(addr || "").trim();
  if (!s.startsWith("0x")) return "";
  const hex = s.slice(2).toLowerCase().replace(/^0x/, "");
  if (hex.length !== 40 || !/^[a-f0-9]{40}$/.test(hex)) return "";
  return "0x" + hex;
}
function mergeLabels(dst, addr, labels) {
  const a = normalizeAddr(addr);
  if (!a || !labels.length) return;
  if (!dst[a]) dst[a] = [];
  for (const l of labels) {
    if (!dst[a].includes(l)) dst[a].push(l);
  }
}
function fetchWithTimeout2(url) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS2);
  try {
    return fetch(url, { signal: ctrl.signal, cache: "no-store" }).finally(() => clearTimeout(timer));
  } catch {
    clearTimeout(timer);
    throw new Error("timeout");
  }
}
var SCAMSNIFFER_ADDRESSES2 = "https://raw.githubusercontent.com/scamsniffer/scam-database/main/blacklist/address.json";
async function fetchScamSnifferAddresses(labelsByAddress, sources) {
  try {
    const res = await fetchWithTimeout2(SCAMSNIFFER_ADDRESSES2);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const rawList = Array.isArray(data) ? data : data && typeof data === "object" ? Object.keys(data) : [];
    let count = 0;
    for (const item of rawList) {
      const s = String(item || "").trim().toLowerCase();
      if (EVM_ADDRESS_REGEX2.test(s)) {
        mergeLabels(labelsByAddress, s, ["SCAM_REPORTED"]);
        count++;
      }
    }
    sources.push({ name: "scamsniffer-addresses", ok: true, count, url: SCAMSNIFFER_ADDRESSES2 });
  } catch {
    sources.push({ name: "scamsniffer-addresses", ok: false, count: 0, url: SCAMSNIFFER_ADDRESSES2 });
  }
}
function seedKnownAddresses() {
  return { labelsByAddress: {} };
}
function getMinimalAddressIntel() {
  return {
    updatedAt: 0,
    sources: [{ name: "local_seed", ok: true, count: 0, url: "" }],
    labelsByAddress: {},
    tokenFlagsByContract: {}
  };
}
function isValidIntelShape(r) {
  if (!r || typeof r !== "object") return false;
  const o = r;
  return typeof o.updatedAt === "number" && Array.isArray(o.sources) && typeof o.labelsByAddress === "object" && o.labelsByAddress !== null && typeof o.tokenFlagsByContract === "object" && o.tokenFlagsByContract !== null;
}
async function loadAddressIntelCachedFast() {
  try {
    const r = await chrome.storage.local.get(STORAGE_ADDR_INTEL_KEY);
    const raw = r?.[STORAGE_ADDR_INTEL_KEY];
    if (!raw || !isValidIntelShape(raw)) {
      const minimal = getMinimalAddressIntel();
      return { intel: minimal, isMissing: true, isStale: true };
    }
    const intel = raw;
    const isStale = Date.now() - intel.updatedAt > ADDR_INTEL_TTL_MS;
    return { intel, isMissing: false, isStale };
  } catch {
    const minimal = getMinimalAddressIntel();
    return { intel: minimal, isMissing: true, isStale: true };
  }
}
async function saveAddressIntel(intel) {
  try {
    await chrome.storage.local.set({ [STORAGE_ADDR_INTEL_KEY]: intel });
  } catch {
  }
}
async function refreshAddressIntel() {
  const now = Date.now();
  const labelsByAddress = {};
  const tokenFlagsByContract = {};
  const sources = [];
  await fetchScamSnifferAddresses(labelsByAddress, sources);
  const seed = seedKnownAddresses();
  for (const [addr, labels] of Object.entries(seed.labelsByAddress)) {
    if (addr && labels?.length) mergeLabels(labelsByAddress, addr, labels);
  }
  return {
    updatedAt: now,
    sources,
    labelsByAddress,
    tokenFlagsByContract
  };
}

// src/txHumanize.ts
var MAX_UINT2562 = 2n ** 256n - 1n;
function extractTypedDataPermitExtras(raw) {
  try {
    if (!raw || raw.length > 2e5) return null;
    const j = JSON.parse(raw);
    const domainName = String(j?.domain?.name || "").toLowerCase();
    const primaryType = String(j?.primaryType || "").toLowerCase();
    const msg = j?.message || {};
    const looksPermit = domainName.includes("permit") || primaryType.includes("permit") || !!msg?.permitted && !!msg?.spender;
    const looksApproveLike = !!msg?.spender && ("value" in msg || "amount" in msg);
    if (!looksPermit && !looksApproveLike) return null;
    const spender = typeof msg?.spender === "string" ? msg.spender.trim() : void 0;
    const value = typeof msg?.value === "string" ? msg.value : typeof msg?.amount === "string" ? msg.amount : void 0;
    const deadline = typeof msg?.deadline === "string" ? msg.deadline : typeof msg?.expiry === "string" ? msg.expiry : void 0;
    if (!spender && !value && !deadline) return null;
    return { spender: spender || void 0, value, deadline };
  } catch {
    return null;
  }
}

// src/domainRisk.ts
function normalizeHost3(host) {
  return String(host || "").trim().toLowerCase().replace(/\.$/, "");
}
function getTld(host) {
  const parts = normalizeHost3(host).split(".").filter(Boolean);
  return parts.length ? parts[parts.length - 1] : "";
}
function getLabels(host) {
  return normalizeHost3(host).split(".").filter(Boolean);
}
function getRegistrableLabel(host) {
  const parts = getLabels(host);
  if (parts.length < 2) return parts[0] || "";
  return parts[parts.length - 2] || "";
}
function hasPunycode(host) {
  const h = normalizeHost3(host);
  return h.startsWith("xn--") || h.includes(".xn--");
}
function levenshtein(a, b) {
  const s = String(a || "");
  const t2 = String(b || "");
  const n = s.length;
  const m = t2.length;
  if (n === 0) return m;
  if (m === 0) return n;
  const v0 = new Array(m + 1).fill(0);
  const v1 = new Array(m + 1).fill(0);
  for (let i = 0; i <= m; i++) v0[i] = i;
  for (let i = 0; i < n; i++) {
    v1[0] = i + 1;
    for (let j = 0; j < m; j++) {
      const cost = s[i] === t2[j] ? 0 : 1;
      v1[j + 1] = Math.min(
        v1[j] + 1,
        // insertion
        v0[j + 1] + 1,
        // deletion
        v0[j] + cost
        // substitution
      );
    }
    for (let j = 0; j <= m; j++) v0[j] = v1[j];
  }
  return v0[m];
}
function isSuspiciousSubdomain(host, brands) {
  const labels = getLabels(host);
  if (labels.length < 3) return false;
  const registrable = getRegistrableLabel(host);
  const sub = labels.slice(0, -2).join(".");
  if (!sub) return false;
  for (const b of brands) {
    if (!b) continue;
    const hitInSub = labels.slice(0, -2).some((x) => x.includes(b));
    if (hitInSub && !registrable.includes(b)) return true;
  }
  return false;
}
function findBrandTypo(host, brands) {
  const reg = getRegistrableLabel(host);
  const clean = reg.replace(/[^a-z0-9]/g, "");
  const segments = reg.split(/[-_]/g).filter(Boolean);
  const candidates = Array.from(new Set([reg, clean, ...segments].filter(Boolean)));
  let best = null;
  for (const b of brands) {
    const brand = String(b || "").toLowerCase();
    if (!brand) continue;
    for (const cand of candidates) {
      const c = String(cand || "").toLowerCase();
      if (!c) continue;
      if (c.includes(brand) && c !== brand) {
        return { brand, cand: c, dist: 0 };
      }
      const d = levenshtein(c, brand);
      if (d <= 2 && c !== brand) {
        if (!best || d < best.dist) best = { brand, cand: c, dist: d };
      }
    }
  }
  return best;
}
function assessDomainRisk(host, brandSeeds) {
  const reasons = [];
  let scoreDelta = 0;
  const h = normalizeHost3(host);
  if (!h) return { scoreDelta, reasons };
  const suspiciousTlds = /* @__PURE__ */ new Set(["zip", "mov", "top", "xyz", "click", "fit"]);
  const tld = getTld(h);
  if (hasPunycode(h)) {
    scoreDelta += 30;
    reasons.push("Lookalike: punycode (xn--) detectado.");
  }
  if (isSuspiciousSubdomain(h, brandSeeds)) {
    scoreDelta += 35;
    reasons.push("Lookalike: marca aparece no subdom\xEDnio (n\xE3o no dom\xEDnio registr\xE1vel).");
  }
  const typo = findBrandTypo(h, brandSeeds);
  if (typo) {
    scoreDelta += 40;
    reasons.push(`Lookalike: poss\xEDvel typo/varia\xE7\xE3o de "${typo.brand}".`);
  }
  if (tld && suspiciousTlds.has(tld)) {
    scoreDelta += 10;
    reasons.push(`TLD suspeito (.${tld}).`);
  }
  scoreDelta = Math.max(0, Math.min(80, scoreDelta));
  return { scoreDelta, reasons };
}

// src/services/simulationService.ts
var TENDERLY_API_BASE = "https://api.tenderly.co/api/v1";
var SIMULATE_TIMEOUT_MS = 4e3;
function getSimulateUrl(settings) {
  const account = settings?.simulation?.tenderlyAccount?.trim();
  const project = settings?.simulation?.tenderlyProject?.trim();
  if (!account || !project) return null;
  return `${TENDERLY_API_BASE}/account/${encodeURIComponent(account)}/project/${encodeURIComponent(project)}/simulate`;
}
async function simulateTransaction(body, settings) {
  const key = settings?.simulation?.tenderlyKey?.trim();
  const url = getSimulateUrl(settings);
  if (!url || !key) return null;
  let timeoutId;
  try {
    const controller = new AbortController();
    timeoutId = setTimeout(() => controller.abort(), SIMULATE_TIMEOUT_MS);
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Access-Key": key
      },
      body: JSON.stringify(body),
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    timeoutId = void 0;
    if (!res.ok) return null;
    const data = await res.json();
    return data;
  } catch {
    if (timeoutId != null) try {
      clearTimeout(timeoutId);
    } catch {
    }
    return null;
  }
}
function makeStaticModeOutcome() {
  return {
    status: "SKIPPED",
    outgoingAssets: [],
    incomingAssets: [],
    gasUsed: "0",
    fallback: true,
    simulated: false,
    message: "Modo Est\xE1tico (Adicione chaves para Simula\xE7\xE3o)"
  };
}
function parseSimulationResult(data) {
  if (!data || typeof data !== "object") return null;
  const txStatus = data.transaction?.status;
  const status = txStatus === 1 ? "REVERT" : txStatus === 0 ? "SUCCESS" : "RISK";
  const outgoingAssets = [];
  const incomingAssets = [];
  const assetChanges = Array.isArray(data.asset_changes) ? data.asset_changes : [];
  for (const change of assetChanges) {
    const info = change?.asset_info;
    const symbol = (info?.symbol || info?.name || "?").toString();
    const amount = (change?.amount ?? change?.raw_amount ?? "0").toString();
    const logo = typeof info?.logo === "string" ? info.logo : void 0;
    const entry = { symbol, amount, logo };
    const type = String(change?.type || "").toUpperCase();
    if (type.includes("SEND") || change?.from) {
      outgoingAssets.push(entry);
    } else if (type.includes("RECEIVE") || change?.to) {
      incomingAssets.push(entry);
    } else {
      outgoingAssets.push(entry);
    }
  }
  const gasUsed = typeof data.gas_used === "string" ? data.gas_used : data.gas_used != null ? String(data.gas_used) : "0";
  let gasCostWei;
  try {
    const gasPrice = data.effective_gas_price ?? data.gas_price ?? data.transaction?.gas_price;
    const gasPriceStr = typeof gasPrice === "string" ? gasPrice : gasPrice != null ? String(gasPrice) : "";
    const usedNum = BigInt(gasUsed);
    const priceNum = gasPriceStr ? BigInt(gasPriceStr) : 0n;
    if (usedNum > 0n && priceNum > 0n) {
      gasCostWei = (usedNum * priceNum).toString();
    }
  } catch {
  }
  return {
    status,
    outgoingAssets,
    incomingAssets,
    gasUsed,
    gasCostWei,
    simulated: true
  };
}
async function runSimulation(networkId, from, to, input, value, gas, settings) {
  try {
    const body = {
      network_id: networkId,
      from,
      to,
      input: input || "0x",
      value: value || "0x0"
    };
    if (gas != null && gas > 0) body.gas = gas;
    const raw = await simulateTransaction(body, settings);
    if (raw) return parseSimulationResult(raw);
    return makeStaticModeOutcome();
  } catch {
    return makeStaticModeOutcome();
  }
}

// src/services/honeypotService.ts
var HONEYPOT_SOFT_THRESHOLD = 0.8;
async function runHoneypotCheck(networkId, from, to, input, value, gas, settings, tokenAddress) {
  try {
    const body = {
      network_id: networkId,
      from,
      to,
      input: input || "0x",
      value: value || "0x0"
    };
    if (gas != null && gas > 0) body.gas = gas;
    const raw = await simulateTransaction(body, settings);
    if (!raw) return { isHoneypot: false, simulated: false, message: "Modo Est\xE1tico (Adicione chaves para Simula\xE7\xE3o)" };
    const txStatus = raw.transaction?.status;
    if (txStatus === 1) return { isHoneypot: false };
    const assetChanges = Array.isArray(raw.asset_changes) ? raw.asset_changes : [];
    let ethSpent = "0";
    let ethReceived = "0";
    let incomingTokenAddress;
    let incomingTokenAmount;
    for (const ch of assetChanges) {
      const type = String(ch?.type || "").toUpperCase();
      const fromAddr = (ch?.from ?? "").toLowerCase();
      const toAddr = (ch?.to ?? "").toLowerCase();
      const amount = ch?.amount ?? ch?.raw_amount ?? "0";
      const info = ch?.asset_info;
      if (type.includes("SEND") && fromAddr === from.toLowerCase()) {
        if (info?.symbol === "ETH" || !info?.symbol) ethSpent = String(amount);
      } else if ((type.includes("RECEIVE") || toAddr === from.toLowerCase()) && toAddr === from.toLowerCase()) {
        if (info?.symbol === "ETH" || !info?.symbol) {
          ethReceived = String(amount);
        } else {
          incomingTokenAddress = fromAddr.startsWith("0x") ? fromAddr : void 0;
          incomingTokenAmount = String(amount);
        }
      }
    }
    const _tokenToTest = tokenAddress || incomingTokenAddress;
    const spendNum = parseFloat(ethSpent);
    const receivedNum = parseFloat(ethReceived);
    if (spendNum > 0 && receivedNum > 0 && receivedNum / spendNum < HONEYPOT_SOFT_THRESHOLD) {
      return {
        isHoneypot: true,
        type: "SOFT",
        reason: "Sell returns < 80% of buy cost (abusive sell tax).",
        ethSpent,
        ethReceived
      };
    }
    return { isHoneypot: false, ethSpent, ethReceived };
  } catch {
    return { isHoneypot: false };
  }
}

// src/services/tokenSecurity.ts
var TOKEN_CACHE_KEY = "tokenCache";
var CACHE_AGE_MS = 7 * 24 * 60 * 60 * 1e3;
var UNISWAP_LIST_URL = "https://gateway.ipfs.io/ipns/tokens.uniswap.org";
var FETCH_TIMEOUT_MS3 = 15e3;
var inMemoryMap = {};
function normalizeAddr2(addr) {
  const a = String(addr || "").trim().toLowerCase();
  return a.startsWith("0x") && a.length === 42 ? a : "";
}
function buildTokenMap(data) {
  const map = {};
  if (!data || typeof data !== "object") return map;
  const tokens = Array.isArray(data.tokens) ? data.tokens : [];
  for (const t2 of tokens) {
    const addr = t2?.address;
    const a = normalizeAddr2(typeof addr === "string" ? addr : "");
    if (!a) continue;
    const symbol = typeof t2.symbol === "string" ? t2.symbol : "?";
    const logoURI = typeof t2.logoURI === "string" ? t2.logoURI : "";
    map[a] = { s: symbol, l: logoURI, v: true };
  }
  return map;
}
async function fetchUniswapList() {
  const ctrl = new AbortController();
  const t2 = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS3);
  try {
    const res = await fetch(UNISWAP_LIST_URL, { cache: "no-store", signal: ctrl.signal });
    clearTimeout(t2);
    if (!res.ok) return {};
    const data = await res.json();
    return buildTokenMap(data);
  } catch {
    clearTimeout(t2);
    return {};
  }
}
async function loadFromStorageAndMaybeRefresh() {
  try {
    const raw = await new Promise((resolve) => {
      chrome.storage.local.get(TOKEN_CACHE_KEY, (r) => resolve(r));
    });
    const cache = raw?.tokenCache;
    const map = cache?.map && typeof cache?.updatedAt === "number" ? cache.map : null;
    const updatedAt = cache?.updatedAt ?? 0;
    const isStale = Date.now() - updatedAt > CACHE_AGE_MS;
    if (map && Object.keys(map).length > 0 && !isStale) {
      inMemoryMap = map;
      return;
    }
    const fresh = await fetchUniswapList();
    if (Object.keys(fresh).length > 0) {
      inMemoryMap = fresh;
      await new Promise((resolve, reject) => {
        chrome.storage.local.set(
          { [TOKEN_CACHE_KEY]: { map: fresh, updatedAt: Date.now() } },
          () => chrome.runtime?.lastError ? reject(chrome.runtime.lastError) : resolve()
        );
      });
    } else if (map && Object.keys(map).length > 0) {
      inMemoryMap = map;
    }
  } catch {
    if (Object.keys(inMemoryMap).length > 0) return;
  }
}
async function initTokenSecurity() {
  await loadFromStorageAndMaybeRefresh();
}
function getTokenInfo(address) {
  const a = normalizeAddr2(address);
  return a ? inMemoryMap[a] : void 0;
}
function getTokenAddressForTx(txTo, decodedAction) {
  const to = (txTo ?? "").trim().toLowerCase();
  if (decodedAction && "token" in decodedAction && decodedAction.token) {
    return decodedAction.token.trim().toLowerCase();
  }
  if (to && to.startsWith("0x") && to.length === 42) return to;
  return void 0;
}

// src/background.ts
init_listManager();

// src/shared/chains.ts
var CHAINS = [
  { chainIdHex: "0x1", name: "Ethereum", nativeSymbol: "ETH", coingeckoId: "ethereum", rpcUrls: ["https://eth.llamarpc.com"] },
  { chainIdHex: "0xa", name: "Optimism", nativeSymbol: "ETH", coingeckoId: "ethereum", rpcUrls: ["https://mainnet.optimism.io"] },
  { chainIdHex: "0xa4b1", name: "Arbitrum One", nativeSymbol: "ETH", coingeckoId: "ethereum", rpcUrls: ["https://arb1.arbitrum.io/rpc"] },
  { chainIdHex: "0x2105", name: "Base", nativeSymbol: "ETH", coingeckoId: "ethereum", rpcUrls: ["https://mainnet.base.org"] },
  { chainIdHex: "0x89", name: "Polygon", nativeSymbol: "MATIC", coingeckoId: "matic-network", rpcUrls: ["https://polygon-rpc.com"] },
  { chainIdHex: "0x38", name: "BNB Smart Chain", nativeSymbol: "BNB", coingeckoId: "binancecoin", rpcUrls: ["https://bsc-dataseed.binance.org"] },
  { chainIdHex: "0xa86a", name: "Avalanche C-Chain", nativeSymbol: "AVAX", coingeckoId: "avalanche-2", rpcUrls: ["https://api.avax.network/ext/bc/C/rpc"] },
  { chainIdHex: "0xfa", name: "Fantom", nativeSymbol: "FTM", coingeckoId: "fantom", rpcUrls: ["https://rpc.ftm.tools"] },
  { chainIdHex: "0x64", name: "Gnosis", nativeSymbol: "xDAI", coingeckoId: "xdai", rpcUrls: ["https://rpc.gnosischain.com"] },
  { chainIdHex: "0xa4ec", name: "Celo", nativeSymbol: "CELO", coingeckoId: "celo", rpcUrls: ["https://forno.celo.org"] },
  { chainIdHex: "0x82750", name: "Scroll", nativeSymbol: "ETH", coingeckoId: "ethereum", rpcUrls: ["https://rpc.scroll.io"] },
  { chainIdHex: "0xe708", name: "Linea", nativeSymbol: "ETH", coingeckoId: "ethereum", rpcUrls: ["https://rpc.linea.build"] },
  { chainIdHex: "0x144", name: "zkSync Era", nativeSymbol: "ETH", coingeckoId: "ethereum", rpcUrls: ["https://mainnet.era.zksync.io"] },
  { chainIdHex: "0x2a", name: "zkSync", nativeSymbol: "ETH", coingeckoId: "ethereum", rpcUrls: ["https://mainnet.zksync.io"] },
  { chainIdHex: "0x44d", name: "Polygon zkEVM", nativeSymbol: "ETH", coingeckoId: "ethereum", rpcUrls: ["https://zkevm-rpc.com"] },
  { chainIdHex: "0x13e31", name: "Polygon zkEVM (Chain 81489)", nativeSymbol: "ETH", coingeckoId: "ethereum", rpcUrls: ["https://zkevm-rpc.com"] }
];
var byChainId = /* @__PURE__ */ new Map();
for (const c of CHAINS) {
  const id = c.chainIdHex.toLowerCase();
  byChainId.set(id, c);
  const num = id.startsWith("0x") ? id : "0x" + id;
  if (num !== id) byChainId.set(num, c);
}
function getChainInfo(chainIdHex) {
  if (!chainIdHex) return null;
  const id = String(chainIdHex).toLowerCase();
  if (!id.startsWith("0x")) return byChainId.get("0x" + id) ?? null;
  return byChainId.get(id) ?? null;
}

// src/services/priceService.ts
var NATIVE_CACHE_KEY = "sg_price_native_v1";
var TOKEN_CACHE_KEY2 = "sg_price_token_v1";
var NATIVE_TTL_MS = 6e4 * 5;
var TOKEN_TTL_MS = 6e4 * 3;
var FETCH_TIMEOUT_MS5 = 8e3;
function getNativeCache() {
  return new Promise((resolve) => {
    try {
      if (!chrome?.storage?.local) return resolve({});
      chrome.storage.local.get(NATIVE_CACHE_KEY, (r) => {
        const v = r?.[NATIVE_CACHE_KEY];
        resolve(v && typeof v === "object" ? v : {});
      });
    } catch {
      resolve({});
    }
  });
}
function setNativeCache(cache) {
  return new Promise((resolve) => {
    try {
      if (!chrome?.storage?.local) return resolve();
      chrome.storage.local.set({ [NATIVE_CACHE_KEY]: cache }, () => resolve());
    } catch {
      resolve();
    }
  });
}
function getTokenCache() {
  return new Promise((resolve) => {
    try {
      if (!chrome?.storage?.local) return resolve({});
      chrome.storage.local.get(TOKEN_CACHE_KEY2, (r) => {
        const v = r?.[TOKEN_CACHE_KEY2];
        resolve(v && typeof v === "object" ? v : {});
      });
    } catch {
      resolve({});
    }
  });
}
function setTokenCache(cache) {
  return new Promise((resolve) => {
    try {
      if (!chrome?.storage?.local) return resolve();
      chrome.storage.local.set({ [TOKEN_CACHE_KEY2]: cache }, () => resolve());
    } catch {
      resolve();
    }
  });
}
async function fetchWithTimeout4(url) {
  try {
    const ctrl = new AbortController();
    const t2 = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS5);
    const res = await fetch(url, { signal: ctrl.signal });
    clearTimeout(t2);
    return res.ok ? await res.text() : null;
  } catch {
    return null;
  }
}
async function getNativeUsd(chainIdHex) {
  const info = getChainInfo(chainIdHex);
  if (!info) return { ok: false };
  const cache = await getNativeCache();
  const now = Date.now();
  const entry = cache[info.coingeckoId];
  if (entry && now - entry.updatedAt < NATIVE_TTL_MS) {
    return { ok: true, usdPerNative: entry.usd, nativeSymbol: info.nativeSymbol };
  }
  try {
    const ids = info.coingeckoId;
    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(ids)}&vs_currencies=usd`;
    const body = await fetchWithTimeout4(url);
    if (!body) return { ok: false, nativeSymbol: info.nativeSymbol };
    const j = JSON.parse(body);
    const usd = j[info.coingeckoId]?.usd;
    if (typeof usd !== "number" || usd <= 0) return { ok: false, nativeSymbol: info.nativeSymbol };
    cache[info.coingeckoId] = { usd, updatedAt: now };
    await setNativeCache(cache);
    return { ok: true, usdPerNative: usd, nativeSymbol: info.nativeSymbol };
  } catch {
    return { ok: false, nativeSymbol: info.nativeSymbol };
  }
}
function normalizeAddr3(addr) {
  const s = (addr || "").trim().toLowerCase();
  return s.startsWith("0x") && s.length === 42 ? s : "";
}
async function getTokenUsd(chainIdHex, tokenAddress) {
  const addr = normalizeAddr3(tokenAddress);
  if (!addr) return { ok: false };
  const key = `${(chainIdHex || "").toLowerCase()}:${addr}`;
  const cache = await getTokenCache();
  const now = Date.now();
  const entry = cache[key];
  if (entry && now - entry.updatedAt < TOKEN_TTL_MS) {
    return { ok: true, priceUsd: entry.priceUsd, source: "cache" };
  }
  try {
    const url = `https://api.dexscreener.com/latest/dex/tokens/${addr}`;
    const body = await fetchWithTimeout4(url);
    if (!body) return { ok: false };
    const j = JSON.parse(body);
    const pairs = Array.isArray(j.pairs) ? j.pairs : [];
    let best = null;
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

// src/services/tokenMetaService.ts
var META_CACHE_KEY = "sg_token_meta_v1";
var META_TTL_MS = 7 * 24 * 60 * 60 * 1e3;
var RPC_TIMEOUT_MS = 6e3;
var DECIMALS_SEL = "0x313ce567";
var SYMBOL_SEL = "0x95d89b41";
var NAME_SEL = "0x06fdde03";
function getCache() {
  return new Promise((resolve) => {
    try {
      if (!chrome?.storage?.local) return resolve({});
      chrome.storage.local.get(META_CACHE_KEY, (r) => {
        const v = r?.[META_CACHE_KEY];
        resolve(v && typeof v === "object" ? v : {});
      });
    } catch {
      resolve({});
    }
  });
}
function setCache(cache) {
  return new Promise((resolve) => {
    try {
      if (!chrome?.storage?.local) return resolve();
      chrome.storage.local.set({ [META_CACHE_KEY]: cache }, () => resolve());
    } catch {
      resolve();
    }
  });
}
function normalizeAddr4(addr) {
  const s = (addr || "").trim().toLowerCase();
  return s.startsWith("0x") && s.length === 42 ? s : "";
}
function decodeStringResult(hex) {
  if (!hex || hex.length < 66) return "";
  const data = hex.startsWith("0x") ? hex.slice(2) : hex;
  if (data.length < 64) return "";
  const firstWord = data.slice(0, 64);
  const offset = parseInt(firstWord.slice(0, 16), 16);
  if (offset === 32 && data.length >= 128) {
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
async function ethCall(rpcUrl, to, data) {
  try {
    const ctrl = new AbortController();
    const t2 = setTimeout(() => ctrl.abort(), RPC_TIMEOUT_MS);
    const res = await fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_call", params: [{ to, data }, "latest"] }),
      signal: ctrl.signal
    });
    clearTimeout(t2);
    if (!res.ok) return null;
    const j = await res.json();
    return j.result ?? null;
  } catch {
    return null;
  }
}
async function getTokenMeta(chainIdHex, tokenAddress, rpcUrlOverride) {
  const addr = normalizeAddr4(tokenAddress);
  if (!addr) return { ok: false };
  const chainId = (chainIdHex || "").toLowerCase();
  const key = `${chainId}:${addr}`;
  const cache = await getCache();
  const now = Date.now();
  const entry = cache[key];
  if (entry && now - entry.updatedAt < META_TTL_MS) {
    return { ok: true, symbol: entry.symbol, decimals: entry.decimals, name: entry.name };
  }
  const info = getChainInfo(chainIdHex);
  const rpcUrl = rpcUrlOverride || info?.rpcUrls?.[0];
  if (!rpcUrl) return { ok: false };
  const [decRes, symRes, nameRes] = await Promise.all([
    ethCall(rpcUrl, addr, DECIMALS_SEL + "0".repeat(56)),
    ethCall(rpcUrl, addr, SYMBOL_SEL + "0".repeat(56)),
    ethCall(rpcUrl, addr, NAME_SEL + "0".repeat(56))
  ]);
  let decimals;
  if (decRes && decRes.length >= 66) {
    const n = parseInt(decRes.slice(2, 66), 16);
    if (Number.isFinite(n)) decimals = n;
  }
  let symbol = "";
  if (symRes && symRes.length >= 66) symbol = decodeStringResult(symRes);
  let name = "";
  if (nameRes && nameRes.length >= 66) name = decodeStringResult(nameRes);
  cache[key] = { symbol: symbol || void 0, decimals, name: name || void 0, updatedAt: now };
  await setCache(cache);
  return { ok: true, symbol: symbol || void 0, decimals, name: name || void 0 };
}

// src/services/telemetryService.ts
var SUPABASE_URL = "https://cjnzidctntqzamhwmwkt.supabase.co";
var SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNqbnppZGN0bnRxemFtaHdtd2t0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5MzIzNzQsImV4cCI6MjA4NjUwODM3NH0.NyUvGRPY1psOwpJytWG_d3IXwCwPxLtuSG6V1uX13mc";
var INSTALL_ID_KEY = "installId";
var getSettingsFn = null;
function initTelemetry(getSettings2) {
  getSettingsFn = getSettings2;
}
async function getTermsAccepted() {
  try {
    const r = await new Promise((resolve) => {
      if (typeof chrome?.storage?.local?.get !== "function") return resolve({});
      chrome.storage.local.get("termsAccepted", (res) => {
        resolve(res ?? {});
      });
    });
    return r?.termsAccepted === true;
  } catch {
    return false;
  }
}
async function getOptIn() {
  if (!await getTermsAccepted()) return false;
  if (!getSettingsFn) return true;
  try {
    const s = await getSettingsFn();
    return s?.cloudIntelOptIn !== false;
  } catch {
    return true;
  }
}
async function sendToSupabase(table, data) {
  try {
    if (typeof navigator !== "undefined" && !navigator.onLine) return;
    await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal"
      },
      body: JSON.stringify(data)
    });
  } catch {
  }
}
async function getOrCreateInstallationId() {
  return new Promise((resolve) => {
    try {
      if (typeof chrome?.storage?.local?.get !== "function") {
        resolve(typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : "unknown");
        return;
      }
      chrome.storage.local.get(INSTALL_ID_KEY, (r) => {
        if (chrome.runtime?.lastError) {
          const id2 = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : "unknown";
          chrome.storage.local.set({ [INSTALL_ID_KEY]: id2 }, () => resolve(id2));
          return;
        }
        const id = r?.[INSTALL_ID_KEY];
        if (id && typeof id === "string") {
          resolve(id);
          return;
        }
        const newId = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : "unknown";
        chrome.storage.local.set({ [INSTALL_ID_KEY]: newId }, () => resolve(newId));
      });
    } catch {
      resolve("unknown");
    }
  });
}
async function identifyUser() {
  try {
    if (!await getTermsAccepted()) return await getOrCreateInstallationId();
    let uuid = await getOrCreateInstallationId();
    if (uuid === "unknown") {
      uuid = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : "unknown";
      await new Promise((resolve) => {
        chrome.storage.local.set({ [INSTALL_ID_KEY]: uuid }, () => resolve());
      });
    }
    if (await getOptIn()) {
      await sendToSupabase("installations", {
        install_id: uuid,
        user_agent: typeof navigator !== "undefined" ? navigator.userAgent : "",
        language: typeof navigator !== "undefined" ? navigator.language : "",
        timezone: typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : "",
        last_active_at: (/* @__PURE__ */ new Date()).toISOString()
      });
    }
    return uuid;
  } catch {
    return "unknown";
  }
}
async function registerUser() {
  await identifyUser();
}
async function syncUserWallets(_wallets) {
}
async function trackInterest(_category) {
  if (!await getOptIn()) return;
}
async function trackTransaction(txData) {
  if (!await getOptIn()) return;
  try {
    const installId = await getOrCreateInstallationId();
    await sendToSupabase("tx_logs", {
      install_id: installId,
      created_at: (/* @__PURE__ */ new Date()).toISOString(),
      chain_id: txData.chain_id ?? txData.chainId ? String(txData.chain_id ?? txData.chainId) : null,
      asset_address: txData.asset_address ?? txData.contractAddress ?? null,
      method: txData.method ?? "unknown",
      status: txData.status ?? "simulated"
    });
  } catch {
  }
}
async function trackTx(payload) {
  await trackTransaction({
    chain_id: payload.chainId,
    asset_address: payload.contractAddress,
    method: payload.method,
    status: "simulated"
  });
}
async function trackThreat(url, score, reasons, metadata) {
  if (!await getOptIn()) return;
  try {
    const installId = await getOrCreateInstallationId();
    let domain = "";
    try {
      domain = new URL(url).hostname;
    } catch {
      domain = url?.slice(0, 256) ?? "";
    }
    await sendToSupabase("threat_reports", {
      install_id: installId,
      url: url?.slice(0, 2048) ?? "",
      domain,
      risk_score: score,
      risk_reason: Array.isArray(reasons) ? reasons.join(", ") : "Unknown",
      created_at: (/* @__PURE__ */ new Date()).toISOString(),
      ...metadata && typeof metadata === "object" ? metadata : {}
    });
  } catch {
  }
}
async function reportThreat(threatData) {
  await trackThreat(
    threatData.url ?? "",
    threatData.score ?? 100,
    Array.isArray(threatData.reasons) ? threatData.reasons : [],
    threatData.metadata
  );
}
async function trackEvent(_eventName, _props) {
  if (!await getOptIn()) return;
}
async function trackSession(_data) {
  if (!await getOptIn()) return;
}
async function trackInteraction(_data) {
  if (!await getOptIn()) return;
}
async function updateExtendedProfile(_data) {
}
var telemetry = {
  identifyUser,
  registerUser,
  syncUserWallets,
  trackInterest,
  trackThreat,
  reportThreat,
  trackTransaction,
  trackEvent,
  trackTx,
  trackSession,
  trackInteraction,
  updateExtendedProfile
};

// src/shared/interestMap.ts
var INTEREST_MAP = {
  "opensea.io": "NFT",
  "blur.io": "NFT",
  "magiceden.io": "NFT",
  "uniswap.org": "DEFI",
  "aave.com": "DEFI",
  "curve.fi": "DEFI",
  "1inch.io": "DEFI",
  "pump.fun": "MEMECOINS",
  "dexscreener.com": "TRADING",
  "galxe.com": "AIRDROP",
  "layer3.xyz": "AIRDROP"
};

// node_modules/tslib/tslib.es6.mjs
function __rest(s, e) {
  var t2 = {};
  for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
    t2[p] = s[p];
  if (s != null && typeof Object.getOwnPropertySymbols === "function")
    for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
      if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
        t2[p[i]] = s[p[i]];
    }
  return t2;
}
function __awaiter(thisArg, _arguments, P, generator) {
  function adopt(value) {
    return value instanceof P ? value : new P(function(resolve) {
      resolve(value);
    });
  }
  return new (P || (P = Promise))(function(resolve, reject) {
    function fulfilled(value) {
      try {
        step(generator.next(value));
      } catch (e) {
        reject(e);
      }
    }
    function rejected(value) {
      try {
        step(generator["throw"](value));
      } catch (e) {
        reject(e);
      }
    }
    function step(result) {
      result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected);
    }
    step((generator = generator.apply(thisArg, _arguments || [])).next());
  });
}

// node_modules/@supabase/functions-js/dist/module/helper.js
var resolveFetch = (customFetch) => {
  if (customFetch) {
    return (...args) => customFetch(...args);
  }
  return (...args) => fetch(...args);
};

// node_modules/@supabase/functions-js/dist/module/types.js
var FunctionsError = class extends Error {
  constructor(message, name = "FunctionsError", context) {
    super(message);
    this.name = name;
    this.context = context;
  }
};
var FunctionsFetchError = class extends FunctionsError {
  constructor(context) {
    super("Failed to send a request to the Edge Function", "FunctionsFetchError", context);
  }
};
var FunctionsRelayError = class extends FunctionsError {
  constructor(context) {
    super("Relay Error invoking the Edge Function", "FunctionsRelayError", context);
  }
};
var FunctionsHttpError = class extends FunctionsError {
  constructor(context) {
    super("Edge Function returned a non-2xx status code", "FunctionsHttpError", context);
  }
};
var FunctionRegion;
(function(FunctionRegion2) {
  FunctionRegion2["Any"] = "any";
  FunctionRegion2["ApNortheast1"] = "ap-northeast-1";
  FunctionRegion2["ApNortheast2"] = "ap-northeast-2";
  FunctionRegion2["ApSouth1"] = "ap-south-1";
  FunctionRegion2["ApSoutheast1"] = "ap-southeast-1";
  FunctionRegion2["ApSoutheast2"] = "ap-southeast-2";
  FunctionRegion2["CaCentral1"] = "ca-central-1";
  FunctionRegion2["EuCentral1"] = "eu-central-1";
  FunctionRegion2["EuWest1"] = "eu-west-1";
  FunctionRegion2["EuWest2"] = "eu-west-2";
  FunctionRegion2["EuWest3"] = "eu-west-3";
  FunctionRegion2["SaEast1"] = "sa-east-1";
  FunctionRegion2["UsEast1"] = "us-east-1";
  FunctionRegion2["UsWest1"] = "us-west-1";
  FunctionRegion2["UsWest2"] = "us-west-2";
})(FunctionRegion || (FunctionRegion = {}));

// node_modules/@supabase/functions-js/dist/module/FunctionsClient.js
var FunctionsClient = class {
  /**
   * Creates a new Functions client bound to an Edge Functions URL.
   *
   * @example
   * ```ts
   * import { FunctionsClient, FunctionRegion } from '@supabase/functions-js'
   *
   * const functions = new FunctionsClient('https://xyzcompany.supabase.co/functions/v1', {
   *   headers: { apikey: 'public-anon-key' },
   *   region: FunctionRegion.UsEast1,
   * })
   * ```
   */
  constructor(url, { headers = {}, customFetch, region = FunctionRegion.Any } = {}) {
    this.url = url;
    this.headers = headers;
    this.region = region;
    this.fetch = resolveFetch(customFetch);
  }
  /**
   * Updates the authorization header
   * @param token - the new jwt token sent in the authorisation header
   * @example
   * ```ts
   * functions.setAuth(session.access_token)
   * ```
   */
  setAuth(token) {
    this.headers.Authorization = `Bearer ${token}`;
  }
  /**
   * Invokes a function
   * @param functionName - The name of the Function to invoke.
   * @param options - Options for invoking the Function.
   * @example
   * ```ts
   * const { data, error } = await functions.invoke('hello-world', {
   *   body: { name: 'Ada' },
   * })
   * ```
   */
  invoke(functionName_1) {
    return __awaiter(this, arguments, void 0, function* (functionName, options = {}) {
      var _a;
      let timeoutId;
      let timeoutController;
      try {
        const { headers, method, body: functionArgs, signal, timeout } = options;
        let _headers = {};
        let { region } = options;
        if (!region) {
          region = this.region;
        }
        const url = new URL(`${this.url}/${functionName}`);
        if (region && region !== "any") {
          _headers["x-region"] = region;
          url.searchParams.set("forceFunctionRegion", region);
        }
        let body;
        if (functionArgs && (headers && !Object.prototype.hasOwnProperty.call(headers, "Content-Type") || !headers)) {
          if (typeof Blob !== "undefined" && functionArgs instanceof Blob || functionArgs instanceof ArrayBuffer) {
            _headers["Content-Type"] = "application/octet-stream";
            body = functionArgs;
          } else if (typeof functionArgs === "string") {
            _headers["Content-Type"] = "text/plain";
            body = functionArgs;
          } else if (typeof FormData !== "undefined" && functionArgs instanceof FormData) {
            body = functionArgs;
          } else {
            _headers["Content-Type"] = "application/json";
            body = JSON.stringify(functionArgs);
          }
        } else {
          if (functionArgs && typeof functionArgs !== "string" && !(typeof Blob !== "undefined" && functionArgs instanceof Blob) && !(functionArgs instanceof ArrayBuffer) && !(typeof FormData !== "undefined" && functionArgs instanceof FormData)) {
            body = JSON.stringify(functionArgs);
          } else {
            body = functionArgs;
          }
        }
        let effectiveSignal = signal;
        if (timeout) {
          timeoutController = new AbortController();
          timeoutId = setTimeout(() => timeoutController.abort(), timeout);
          if (signal) {
            effectiveSignal = timeoutController.signal;
            signal.addEventListener("abort", () => timeoutController.abort());
          } else {
            effectiveSignal = timeoutController.signal;
          }
        }
        const response = yield this.fetch(url.toString(), {
          method: method || "POST",
          // headers priority is (high to low):
          // 1. invoke-level headers
          // 2. client-level headers
          // 3. default Content-Type header
          headers: Object.assign(Object.assign(Object.assign({}, _headers), this.headers), headers),
          body,
          signal: effectiveSignal
        }).catch((fetchError) => {
          throw new FunctionsFetchError(fetchError);
        });
        const isRelayError = response.headers.get("x-relay-error");
        if (isRelayError && isRelayError === "true") {
          throw new FunctionsRelayError(response);
        }
        if (!response.ok) {
          throw new FunctionsHttpError(response);
        }
        let responseType = ((_a = response.headers.get("Content-Type")) !== null && _a !== void 0 ? _a : "text/plain").split(";")[0].trim();
        let data;
        if (responseType === "application/json") {
          data = yield response.json();
        } else if (responseType === "application/octet-stream" || responseType === "application/pdf") {
          data = yield response.blob();
        } else if (responseType === "text/event-stream") {
          data = response;
        } else if (responseType === "multipart/form-data") {
          data = yield response.formData();
        } else {
          data = yield response.text();
        }
        return { data, error: null, response };
      } catch (error) {
        return {
          data: null,
          error,
          response: error instanceof FunctionsHttpError || error instanceof FunctionsRelayError ? error.context : void 0
        };
      } finally {
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
      }
    });
  }
};

// node_modules/@supabase/postgrest-js/dist/index.mjs
var PostgrestError = class extends Error {
  /**
  * @example
  * ```ts
  * import PostgrestError from '@supabase/postgrest-js'
  *
  * throw new PostgrestError({
  *   message: 'Row level security prevented the request',
  *   details: 'RLS denied the insert',
  *   hint: 'Check your policies',
  *   code: 'PGRST301',
  * })
  * ```
  */
  constructor(context) {
    super(context.message);
    this.name = "PostgrestError";
    this.details = context.details;
    this.hint = context.hint;
    this.code = context.code;
  }
};
var PostgrestBuilder = class {
  /**
  * Creates a builder configured for a specific PostgREST request.
  *
  * @example
  * ```ts
  * import PostgrestQueryBuilder from '@supabase/postgrest-js'
  *
  * const builder = new PostgrestQueryBuilder(
  *   new URL('https://xyzcompany.supabase.co/rest/v1/users'),
  *   { headers: new Headers({ apikey: 'public-anon-key' }) }
  * )
  * ```
  */
  constructor(builder) {
    var _builder$shouldThrowO, _builder$isMaybeSingl, _builder$urlLengthLim;
    this.shouldThrowOnError = false;
    this.method = builder.method;
    this.url = builder.url;
    this.headers = new Headers(builder.headers);
    this.schema = builder.schema;
    this.body = builder.body;
    this.shouldThrowOnError = (_builder$shouldThrowO = builder.shouldThrowOnError) !== null && _builder$shouldThrowO !== void 0 ? _builder$shouldThrowO : false;
    this.signal = builder.signal;
    this.isMaybeSingle = (_builder$isMaybeSingl = builder.isMaybeSingle) !== null && _builder$isMaybeSingl !== void 0 ? _builder$isMaybeSingl : false;
    this.urlLengthLimit = (_builder$urlLengthLim = builder.urlLengthLimit) !== null && _builder$urlLengthLim !== void 0 ? _builder$urlLengthLim : 8e3;
    if (builder.fetch) this.fetch = builder.fetch;
    else this.fetch = fetch;
  }
  /**
  * If there's an error with the query, throwOnError will reject the promise by
  * throwing the error instead of returning it as part of a successful response.
  *
  * {@link https://github.com/supabase/supabase-js/issues/92}
  */
  throwOnError() {
    this.shouldThrowOnError = true;
    return this;
  }
  /**
  * Set an HTTP header for the request.
  */
  setHeader(name, value) {
    this.headers = new Headers(this.headers);
    this.headers.set(name, value);
    return this;
  }
  then(onfulfilled, onrejected) {
    var _this = this;
    if (this.schema === void 0) {
    } else if (["GET", "HEAD"].includes(this.method)) this.headers.set("Accept-Profile", this.schema);
    else this.headers.set("Content-Profile", this.schema);
    if (this.method !== "GET" && this.method !== "HEAD") this.headers.set("Content-Type", "application/json");
    const _fetch = this.fetch;
    let res = _fetch(this.url.toString(), {
      method: this.method,
      headers: this.headers,
      body: JSON.stringify(this.body),
      signal: this.signal
    }).then(async (res$1) => {
      let error = null;
      let data = null;
      let count = null;
      let status = res$1.status;
      let statusText = res$1.statusText;
      if (res$1.ok) {
        var _this$headers$get2, _res$headers$get;
        if (_this.method !== "HEAD") {
          var _this$headers$get;
          const body = await res$1.text();
          if (body === "") {
          } else if (_this.headers.get("Accept") === "text/csv") data = body;
          else if (_this.headers.get("Accept") && ((_this$headers$get = _this.headers.get("Accept")) === null || _this$headers$get === void 0 ? void 0 : _this$headers$get.includes("application/vnd.pgrst.plan+text"))) data = body;
          else data = JSON.parse(body);
        }
        const countHeader = (_this$headers$get2 = _this.headers.get("Prefer")) === null || _this$headers$get2 === void 0 ? void 0 : _this$headers$get2.match(/count=(exact|planned|estimated)/);
        const contentRange = (_res$headers$get = res$1.headers.get("content-range")) === null || _res$headers$get === void 0 ? void 0 : _res$headers$get.split("/");
        if (countHeader && contentRange && contentRange.length > 1) count = parseInt(contentRange[1]);
        if (_this.isMaybeSingle && _this.method === "GET" && Array.isArray(data)) if (data.length > 1) {
          error = {
            code: "PGRST116",
            details: `Results contain ${data.length} rows, application/vnd.pgrst.object+json requires 1 row`,
            hint: null,
            message: "JSON object requested, multiple (or no) rows returned"
          };
          data = null;
          count = null;
          status = 406;
          statusText = "Not Acceptable";
        } else if (data.length === 1) data = data[0];
        else data = null;
      } else {
        var _error$details;
        const body = await res$1.text();
        try {
          error = JSON.parse(body);
          if (Array.isArray(error) && res$1.status === 404) {
            data = [];
            error = null;
            status = 200;
            statusText = "OK";
          }
        } catch (_unused) {
          if (res$1.status === 404 && body === "") {
            status = 204;
            statusText = "No Content";
          } else error = { message: body };
        }
        if (error && _this.isMaybeSingle && (error === null || error === void 0 || (_error$details = error.details) === null || _error$details === void 0 ? void 0 : _error$details.includes("0 rows"))) {
          error = null;
          status = 200;
          statusText = "OK";
        }
        if (error && _this.shouldThrowOnError) throw new PostgrestError(error);
      }
      return {
        error,
        data,
        count,
        status,
        statusText
      };
    });
    if (!this.shouldThrowOnError) res = res.catch((fetchError) => {
      var _fetchError$name2;
      let errorDetails = "";
      let hint = "";
      let code = "";
      const cause = fetchError === null || fetchError === void 0 ? void 0 : fetchError.cause;
      if (cause) {
        var _cause$message, _cause$code, _fetchError$name, _cause$name;
        const causeMessage = (_cause$message = cause === null || cause === void 0 ? void 0 : cause.message) !== null && _cause$message !== void 0 ? _cause$message : "";
        const causeCode = (_cause$code = cause === null || cause === void 0 ? void 0 : cause.code) !== null && _cause$code !== void 0 ? _cause$code : "";
        errorDetails = `${(_fetchError$name = fetchError === null || fetchError === void 0 ? void 0 : fetchError.name) !== null && _fetchError$name !== void 0 ? _fetchError$name : "FetchError"}: ${fetchError === null || fetchError === void 0 ? void 0 : fetchError.message}`;
        errorDetails += `

Caused by: ${(_cause$name = cause === null || cause === void 0 ? void 0 : cause.name) !== null && _cause$name !== void 0 ? _cause$name : "Error"}: ${causeMessage}`;
        if (causeCode) errorDetails += ` (${causeCode})`;
        if (cause === null || cause === void 0 ? void 0 : cause.stack) errorDetails += `
${cause.stack}`;
      } else {
        var _fetchError$stack;
        errorDetails = (_fetchError$stack = fetchError === null || fetchError === void 0 ? void 0 : fetchError.stack) !== null && _fetchError$stack !== void 0 ? _fetchError$stack : "";
      }
      const urlLength = this.url.toString().length;
      if ((fetchError === null || fetchError === void 0 ? void 0 : fetchError.name) === "AbortError" || (fetchError === null || fetchError === void 0 ? void 0 : fetchError.code) === "ABORT_ERR") {
        code = "";
        hint = "Request was aborted (timeout or manual cancellation)";
        if (urlLength > this.urlLengthLimit) hint += `. Note: Your request URL is ${urlLength} characters, which may exceed server limits. If selecting many fields, consider using views. If filtering with large arrays (e.g., .in('id', [many IDs])), consider using an RPC function to pass values server-side.`;
      } else if ((cause === null || cause === void 0 ? void 0 : cause.name) === "HeadersOverflowError" || (cause === null || cause === void 0 ? void 0 : cause.code) === "UND_ERR_HEADERS_OVERFLOW") {
        code = "";
        hint = "HTTP headers exceeded server limits (typically 16KB)";
        if (urlLength > this.urlLengthLimit) hint += `. Your request URL is ${urlLength} characters. If selecting many fields, consider using views. If filtering with large arrays (e.g., .in('id', [200+ IDs])), consider using an RPC function instead.`;
      }
      return {
        error: {
          message: `${(_fetchError$name2 = fetchError === null || fetchError === void 0 ? void 0 : fetchError.name) !== null && _fetchError$name2 !== void 0 ? _fetchError$name2 : "FetchError"}: ${fetchError === null || fetchError === void 0 ? void 0 : fetchError.message}`,
          details: errorDetails,
          hint,
          code
        },
        data: null,
        count: null,
        status: 0,
        statusText: ""
      };
    });
    return res.then(onfulfilled, onrejected);
  }
  /**
  * Override the type of the returned `data`.
  *
  * @typeParam NewResult - The new result type to override with
  * @deprecated Use overrideTypes<yourType, { merge: false }>() method at the end of your call chain instead
  */
  returns() {
    return this;
  }
  /**
  * Override the type of the returned `data` field in the response.
  *
  * @typeParam NewResult - The new type to cast the response data to
  * @typeParam Options - Optional type configuration (defaults to { merge: true })
  * @typeParam Options.merge - When true, merges the new type with existing return type. When false, replaces the existing types entirely (defaults to true)
  * @example
  * ```typescript
  * // Merge with existing types (default behavior)
  * const query = supabase
  *   .from('users')
  *   .select()
  *   .overrideTypes<{ custom_field: string }>()
  *
  * // Replace existing types completely
  * const replaceQuery = supabase
  *   .from('users')
  *   .select()
  *   .overrideTypes<{ id: number; name: string }, { merge: false }>()
  * ```
  * @returns A PostgrestBuilder instance with the new type
  */
  overrideTypes() {
    return this;
  }
};
var PostgrestTransformBuilder = class extends PostgrestBuilder {
  /**
  * Perform a SELECT on the query result.
  *
  * By default, `.insert()`, `.update()`, `.upsert()`, and `.delete()` do not
  * return modified rows. By calling this method, modified rows are returned in
  * `data`.
  *
  * @param columns - The columns to retrieve, separated by commas
  */
  select(columns) {
    let quoted = false;
    const cleanedColumns = (columns !== null && columns !== void 0 ? columns : "*").split("").map((c) => {
      if (/\s/.test(c) && !quoted) return "";
      if (c === '"') quoted = !quoted;
      return c;
    }).join("");
    this.url.searchParams.set("select", cleanedColumns);
    this.headers.append("Prefer", "return=representation");
    return this;
  }
  /**
  * Order the query result by `column`.
  *
  * You can call this method multiple times to order by multiple columns.
  *
  * You can order referenced tables, but it only affects the ordering of the
  * parent table if you use `!inner` in the query.
  *
  * @param column - The column to order by
  * @param options - Named parameters
  * @param options.ascending - If `true`, the result will be in ascending order
  * @param options.nullsFirst - If `true`, `null`s appear first. If `false`,
  * `null`s appear last.
  * @param options.referencedTable - Set this to order a referenced table by
  * its columns
  * @param options.foreignTable - Deprecated, use `options.referencedTable`
  * instead
  */
  order(column, { ascending = true, nullsFirst, foreignTable, referencedTable = foreignTable } = {}) {
    const key = referencedTable ? `${referencedTable}.order` : "order";
    const existingOrder = this.url.searchParams.get(key);
    this.url.searchParams.set(key, `${existingOrder ? `${existingOrder},` : ""}${column}.${ascending ? "asc" : "desc"}${nullsFirst === void 0 ? "" : nullsFirst ? ".nullsfirst" : ".nullslast"}`);
    return this;
  }
  /**
  * Limit the query result by `count`.
  *
  * @param count - The maximum number of rows to return
  * @param options - Named parameters
  * @param options.referencedTable - Set this to limit rows of referenced
  * tables instead of the parent table
  * @param options.foreignTable - Deprecated, use `options.referencedTable`
  * instead
  */
  limit(count, { foreignTable, referencedTable = foreignTable } = {}) {
    const key = typeof referencedTable === "undefined" ? "limit" : `${referencedTable}.limit`;
    this.url.searchParams.set(key, `${count}`);
    return this;
  }
  /**
  * Limit the query result by starting at an offset `from` and ending at the offset `to`.
  * Only records within this range are returned.
  * This respects the query order and if there is no order clause the range could behave unexpectedly.
  * The `from` and `to` values are 0-based and inclusive: `range(1, 3)` will include the second, third
  * and fourth rows of the query.
  *
  * @param from - The starting index from which to limit the result
  * @param to - The last index to which to limit the result
  * @param options - Named parameters
  * @param options.referencedTable - Set this to limit rows of referenced
  * tables instead of the parent table
  * @param options.foreignTable - Deprecated, use `options.referencedTable`
  * instead
  */
  range(from, to, { foreignTable, referencedTable = foreignTable } = {}) {
    const keyOffset = typeof referencedTable === "undefined" ? "offset" : `${referencedTable}.offset`;
    const keyLimit = typeof referencedTable === "undefined" ? "limit" : `${referencedTable}.limit`;
    this.url.searchParams.set(keyOffset, `${from}`);
    this.url.searchParams.set(keyLimit, `${to - from + 1}`);
    return this;
  }
  /**
  * Set the AbortSignal for the fetch request.
  *
  * @param signal - The AbortSignal to use for the fetch request
  */
  abortSignal(signal) {
    this.signal = signal;
    return this;
  }
  /**
  * Return `data` as a single object instead of an array of objects.
  *
  * Query result must be one row (e.g. using `.limit(1)`), otherwise this
  * returns an error.
  */
  single() {
    this.headers.set("Accept", "application/vnd.pgrst.object+json");
    return this;
  }
  /**
  * Return `data` as a single object instead of an array of objects.
  *
  * Query result must be zero or one row (e.g. using `.limit(1)`), otherwise
  * this returns an error.
  */
  maybeSingle() {
    if (this.method === "GET") this.headers.set("Accept", "application/json");
    else this.headers.set("Accept", "application/vnd.pgrst.object+json");
    this.isMaybeSingle = true;
    return this;
  }
  /**
  * Return `data` as a string in CSV format.
  */
  csv() {
    this.headers.set("Accept", "text/csv");
    return this;
  }
  /**
  * Return `data` as an object in [GeoJSON](https://geojson.org) format.
  */
  geojson() {
    this.headers.set("Accept", "application/geo+json");
    return this;
  }
  /**
  * Return `data` as the EXPLAIN plan for the query.
  *
  * You need to enable the
  * [db_plan_enabled](https://supabase.com/docs/guides/database/debugging-performance#enabling-explain)
  * setting before using this method.
  *
  * @param options - Named parameters
  *
  * @param options.analyze - If `true`, the query will be executed and the
  * actual run time will be returned
  *
  * @param options.verbose - If `true`, the query identifier will be returned
  * and `data` will include the output columns of the query
  *
  * @param options.settings - If `true`, include information on configuration
  * parameters that affect query planning
  *
  * @param options.buffers - If `true`, include information on buffer usage
  *
  * @param options.wal - If `true`, include information on WAL record generation
  *
  * @param options.format - The format of the output, can be `"text"` (default)
  * or `"json"`
  */
  explain({ analyze: analyze2 = false, verbose = false, settings = false, buffers = false, wal = false, format: format2 = "text" } = {}) {
    var _this$headers$get;
    const options = [
      analyze2 ? "analyze" : null,
      verbose ? "verbose" : null,
      settings ? "settings" : null,
      buffers ? "buffers" : null,
      wal ? "wal" : null
    ].filter(Boolean).join("|");
    const forMediatype = (_this$headers$get = this.headers.get("Accept")) !== null && _this$headers$get !== void 0 ? _this$headers$get : "application/json";
    this.headers.set("Accept", `application/vnd.pgrst.plan+${format2}; for="${forMediatype}"; options=${options};`);
    if (format2 === "json") return this;
    else return this;
  }
  /**
  * Rollback the query.
  *
  * `data` will still be returned, but the query is not committed.
  */
  rollback() {
    this.headers.append("Prefer", "tx=rollback");
    return this;
  }
  /**
  * Override the type of the returned `data`.
  *
  * @typeParam NewResult - The new result type to override with
  * @deprecated Use overrideTypes<yourType, { merge: false }>() method at the end of your call chain instead
  */
  returns() {
    return this;
  }
  /**
  * Set the maximum number of rows that can be affected by the query.
  * Only available in PostgREST v13+ and only works with PATCH and DELETE methods.
  *
  * @param value - The maximum number of rows that can be affected
  */
  maxAffected(value) {
    this.headers.append("Prefer", "handling=strict");
    this.headers.append("Prefer", `max-affected=${value}`);
    return this;
  }
};
var PostgrestReservedCharsRegexp = /* @__PURE__ */ new RegExp("[,()]");
var PostgrestFilterBuilder = class extends PostgrestTransformBuilder {
  /**
  * Match only rows where `column` is equal to `value`.
  *
  * To check if the value of `column` is NULL, you should use `.is()` instead.
  *
  * @param column - The column to filter on
  * @param value - The value to filter with
  */
  eq(column, value) {
    this.url.searchParams.append(column, `eq.${value}`);
    return this;
  }
  /**
  * Match only rows where `column` is not equal to `value`.
  *
  * @param column - The column to filter on
  * @param value - The value to filter with
  */
  neq(column, value) {
    this.url.searchParams.append(column, `neq.${value}`);
    return this;
  }
  /**
  * Match only rows where `column` is greater than `value`.
  *
  * @param column - The column to filter on
  * @param value - The value to filter with
  */
  gt(column, value) {
    this.url.searchParams.append(column, `gt.${value}`);
    return this;
  }
  /**
  * Match only rows where `column` is greater than or equal to `value`.
  *
  * @param column - The column to filter on
  * @param value - The value to filter with
  */
  gte(column, value) {
    this.url.searchParams.append(column, `gte.${value}`);
    return this;
  }
  /**
  * Match only rows where `column` is less than `value`.
  *
  * @param column - The column to filter on
  * @param value - The value to filter with
  */
  lt(column, value) {
    this.url.searchParams.append(column, `lt.${value}`);
    return this;
  }
  /**
  * Match only rows where `column` is less than or equal to `value`.
  *
  * @param column - The column to filter on
  * @param value - The value to filter with
  */
  lte(column, value) {
    this.url.searchParams.append(column, `lte.${value}`);
    return this;
  }
  /**
  * Match only rows where `column` matches `pattern` case-sensitively.
  *
  * @param column - The column to filter on
  * @param pattern - The pattern to match with
  */
  like(column, pattern) {
    this.url.searchParams.append(column, `like.${pattern}`);
    return this;
  }
  /**
  * Match only rows where `column` matches all of `patterns` case-sensitively.
  *
  * @param column - The column to filter on
  * @param patterns - The patterns to match with
  */
  likeAllOf(column, patterns) {
    this.url.searchParams.append(column, `like(all).{${patterns.join(",")}}`);
    return this;
  }
  /**
  * Match only rows where `column` matches any of `patterns` case-sensitively.
  *
  * @param column - The column to filter on
  * @param patterns - The patterns to match with
  */
  likeAnyOf(column, patterns) {
    this.url.searchParams.append(column, `like(any).{${patterns.join(",")}}`);
    return this;
  }
  /**
  * Match only rows where `column` matches `pattern` case-insensitively.
  *
  * @param column - The column to filter on
  * @param pattern - The pattern to match with
  */
  ilike(column, pattern) {
    this.url.searchParams.append(column, `ilike.${pattern}`);
    return this;
  }
  /**
  * Match only rows where `column` matches all of `patterns` case-insensitively.
  *
  * @param column - The column to filter on
  * @param patterns - The patterns to match with
  */
  ilikeAllOf(column, patterns) {
    this.url.searchParams.append(column, `ilike(all).{${patterns.join(",")}}`);
    return this;
  }
  /**
  * Match only rows where `column` matches any of `patterns` case-insensitively.
  *
  * @param column - The column to filter on
  * @param patterns - The patterns to match with
  */
  ilikeAnyOf(column, patterns) {
    this.url.searchParams.append(column, `ilike(any).{${patterns.join(",")}}`);
    return this;
  }
  /**
  * Match only rows where `column` matches the PostgreSQL regex `pattern`
  * case-sensitively (using the `~` operator).
  *
  * @param column - The column to filter on
  * @param pattern - The PostgreSQL regular expression pattern to match with
  */
  regexMatch(column, pattern) {
    this.url.searchParams.append(column, `match.${pattern}`);
    return this;
  }
  /**
  * Match only rows where `column` matches the PostgreSQL regex `pattern`
  * case-insensitively (using the `~*` operator).
  *
  * @param column - The column to filter on
  * @param pattern - The PostgreSQL regular expression pattern to match with
  */
  regexIMatch(column, pattern) {
    this.url.searchParams.append(column, `imatch.${pattern}`);
    return this;
  }
  /**
  * Match only rows where `column` IS `value`.
  *
  * For non-boolean columns, this is only relevant for checking if the value of
  * `column` is NULL by setting `value` to `null`.
  *
  * For boolean columns, you can also set `value` to `true` or `false` and it
  * will behave the same way as `.eq()`.
  *
  * @param column - The column to filter on
  * @param value - The value to filter with
  */
  is(column, value) {
    this.url.searchParams.append(column, `is.${value}`);
    return this;
  }
  /**
  * Match only rows where `column` IS DISTINCT FROM `value`.
  *
  * Unlike `.neq()`, this treats `NULL` as a comparable value. Two `NULL` values
  * are considered equal (not distinct), and comparing `NULL` with any non-NULL
  * value returns true (distinct).
  *
  * @param column - The column to filter on
  * @param value - The value to filter with
  */
  isDistinct(column, value) {
    this.url.searchParams.append(column, `isdistinct.${value}`);
    return this;
  }
  /**
  * Match only rows where `column` is included in the `values` array.
  *
  * @param column - The column to filter on
  * @param values - The values array to filter with
  */
  in(column, values) {
    const cleanedValues = Array.from(new Set(values)).map((s) => {
      if (typeof s === "string" && PostgrestReservedCharsRegexp.test(s)) return `"${s}"`;
      else return `${s}`;
    }).join(",");
    this.url.searchParams.append(column, `in.(${cleanedValues})`);
    return this;
  }
  /**
  * Match only rows where `column` is NOT included in the `values` array.
  *
  * @param column - The column to filter on
  * @param values - The values array to filter with
  */
  notIn(column, values) {
    const cleanedValues = Array.from(new Set(values)).map((s) => {
      if (typeof s === "string" && PostgrestReservedCharsRegexp.test(s)) return `"${s}"`;
      else return `${s}`;
    }).join(",");
    this.url.searchParams.append(column, `not.in.(${cleanedValues})`);
    return this;
  }
  /**
  * Only relevant for jsonb, array, and range columns. Match only rows where
  * `column` contains every element appearing in `value`.
  *
  * @param column - The jsonb, array, or range column to filter on
  * @param value - The jsonb, array, or range value to filter with
  */
  contains(column, value) {
    if (typeof value === "string") this.url.searchParams.append(column, `cs.${value}`);
    else if (Array.isArray(value)) this.url.searchParams.append(column, `cs.{${value.join(",")}}`);
    else this.url.searchParams.append(column, `cs.${JSON.stringify(value)}`);
    return this;
  }
  /**
  * Only relevant for jsonb, array, and range columns. Match only rows where
  * every element appearing in `column` is contained by `value`.
  *
  * @param column - The jsonb, array, or range column to filter on
  * @param value - The jsonb, array, or range value to filter with
  */
  containedBy(column, value) {
    if (typeof value === "string") this.url.searchParams.append(column, `cd.${value}`);
    else if (Array.isArray(value)) this.url.searchParams.append(column, `cd.{${value.join(",")}}`);
    else this.url.searchParams.append(column, `cd.${JSON.stringify(value)}`);
    return this;
  }
  /**
  * Only relevant for range columns. Match only rows where every element in
  * `column` is greater than any element in `range`.
  *
  * @param column - The range column to filter on
  * @param range - The range to filter with
  */
  rangeGt(column, range) {
    this.url.searchParams.append(column, `sr.${range}`);
    return this;
  }
  /**
  * Only relevant for range columns. Match only rows where every element in
  * `column` is either contained in `range` or greater than any element in
  * `range`.
  *
  * @param column - The range column to filter on
  * @param range - The range to filter with
  */
  rangeGte(column, range) {
    this.url.searchParams.append(column, `nxl.${range}`);
    return this;
  }
  /**
  * Only relevant for range columns. Match only rows where every element in
  * `column` is less than any element in `range`.
  *
  * @param column - The range column to filter on
  * @param range - The range to filter with
  */
  rangeLt(column, range) {
    this.url.searchParams.append(column, `sl.${range}`);
    return this;
  }
  /**
  * Only relevant for range columns. Match only rows where every element in
  * `column` is either contained in `range` or less than any element in
  * `range`.
  *
  * @param column - The range column to filter on
  * @param range - The range to filter with
  */
  rangeLte(column, range) {
    this.url.searchParams.append(column, `nxr.${range}`);
    return this;
  }
  /**
  * Only relevant for range columns. Match only rows where `column` is
  * mutually exclusive to `range` and there can be no element between the two
  * ranges.
  *
  * @param column - The range column to filter on
  * @param range - The range to filter with
  */
  rangeAdjacent(column, range) {
    this.url.searchParams.append(column, `adj.${range}`);
    return this;
  }
  /**
  * Only relevant for array and range columns. Match only rows where
  * `column` and `value` have an element in common.
  *
  * @param column - The array or range column to filter on
  * @param value - The array or range value to filter with
  */
  overlaps(column, value) {
    if (typeof value === "string") this.url.searchParams.append(column, `ov.${value}`);
    else this.url.searchParams.append(column, `ov.{${value.join(",")}}`);
    return this;
  }
  /**
  * Only relevant for text and tsvector columns. Match only rows where
  * `column` matches the query string in `query`.
  *
  * @param column - The text or tsvector column to filter on
  * @param query - The query text to match with
  * @param options - Named parameters
  * @param options.config - The text search configuration to use
  * @param options.type - Change how the `query` text is interpreted
  */
  textSearch(column, query, { config, type } = {}) {
    let typePart = "";
    if (type === "plain") typePart = "pl";
    else if (type === "phrase") typePart = "ph";
    else if (type === "websearch") typePart = "w";
    const configPart = config === void 0 ? "" : `(${config})`;
    this.url.searchParams.append(column, `${typePart}fts${configPart}.${query}`);
    return this;
  }
  /**
  * Match only rows where each column in `query` keys is equal to its
  * associated value. Shorthand for multiple `.eq()`s.
  *
  * @param query - The object to filter with, with column names as keys mapped
  * to their filter values
  */
  match(query) {
    Object.entries(query).forEach(([column, value]) => {
      this.url.searchParams.append(column, `eq.${value}`);
    });
    return this;
  }
  /**
  * Match only rows which doesn't satisfy the filter.
  *
  * Unlike most filters, `opearator` and `value` are used as-is and need to
  * follow [PostgREST
  * syntax](https://postgrest.org/en/stable/api.html#operators). You also need
  * to make sure they are properly sanitized.
  *
  * @param column - The column to filter on
  * @param operator - The operator to be negated to filter with, following
  * PostgREST syntax
  * @param value - The value to filter with, following PostgREST syntax
  */
  not(column, operator, value) {
    this.url.searchParams.append(column, `not.${operator}.${value}`);
    return this;
  }
  /**
  * Match only rows which satisfy at least one of the filters.
  *
  * Unlike most filters, `filters` is used as-is and needs to follow [PostgREST
  * syntax](https://postgrest.org/en/stable/api.html#operators). You also need
  * to make sure it's properly sanitized.
  *
  * It's currently not possible to do an `.or()` filter across multiple tables.
  *
  * @param filters - The filters to use, following PostgREST syntax
  * @param options - Named parameters
  * @param options.referencedTable - Set this to filter on referenced tables
  * instead of the parent table
  * @param options.foreignTable - Deprecated, use `referencedTable` instead
  */
  or(filters, { foreignTable, referencedTable = foreignTable } = {}) {
    const key = referencedTable ? `${referencedTable}.or` : "or";
    this.url.searchParams.append(key, `(${filters})`);
    return this;
  }
  /**
  * Match only rows which satisfy the filter. This is an escape hatch - you
  * should use the specific filter methods wherever possible.
  *
  * Unlike most filters, `opearator` and `value` are used as-is and need to
  * follow [PostgREST
  * syntax](https://postgrest.org/en/stable/api.html#operators). You also need
  * to make sure they are properly sanitized.
  *
  * @param column - The column to filter on
  * @param operator - The operator to filter with, following PostgREST syntax
  * @param value - The value to filter with, following PostgREST syntax
  */
  filter(column, operator, value) {
    this.url.searchParams.append(column, `${operator}.${value}`);
    return this;
  }
};
var PostgrestQueryBuilder = class {
  /**
  * Creates a query builder scoped to a Postgres table or view.
  *
  * @example
  * ```ts
  * import PostgrestQueryBuilder from '@supabase/postgrest-js'
  *
  * const query = new PostgrestQueryBuilder(
  *   new URL('https://xyzcompany.supabase.co/rest/v1/users'),
  *   { headers: { apikey: 'public-anon-key' } }
  * )
  * ```
  */
  constructor(url, { headers = {}, schema, fetch: fetch$1, urlLengthLimit = 8e3 }) {
    this.url = url;
    this.headers = new Headers(headers);
    this.schema = schema;
    this.fetch = fetch$1;
    this.urlLengthLimit = urlLengthLimit;
  }
  /**
  * Clone URL and headers to prevent shared state between operations.
  */
  cloneRequestState() {
    return {
      url: new URL(this.url.toString()),
      headers: new Headers(this.headers)
    };
  }
  /**
  * Perform a SELECT query on the table or view.
  *
  * @param columns - The columns to retrieve, separated by commas. Columns can be renamed when returned with `customName:columnName`
  *
  * @param options - Named parameters
  *
  * @param options.head - When set to `true`, `data` will not be returned.
  * Useful if you only need the count.
  *
  * @param options.count - Count algorithm to use to count rows in the table or view.
  *
  * `"exact"`: Exact but slow count algorithm. Performs a `COUNT(*)` under the
  * hood.
  *
  * `"planned"`: Approximated but fast count algorithm. Uses the Postgres
  * statistics under the hood.
  *
  * `"estimated"`: Uses exact count for low numbers and planned count for high
  * numbers.
  *
  * @remarks
  * When using `count` with `.range()` or `.limit()`, the returned `count` is the total number of rows
  * that match your filters, not the number of rows in the current page. Use this to build pagination UI.
  */
  select(columns, options) {
    const { head: head2 = false, count } = options !== null && options !== void 0 ? options : {};
    const method = head2 ? "HEAD" : "GET";
    let quoted = false;
    const cleanedColumns = (columns !== null && columns !== void 0 ? columns : "*").split("").map((c) => {
      if (/\s/.test(c) && !quoted) return "";
      if (c === '"') quoted = !quoted;
      return c;
    }).join("");
    const { url, headers } = this.cloneRequestState();
    url.searchParams.set("select", cleanedColumns);
    if (count) headers.append("Prefer", `count=${count}`);
    return new PostgrestFilterBuilder({
      method,
      url,
      headers,
      schema: this.schema,
      fetch: this.fetch,
      urlLengthLimit: this.urlLengthLimit
    });
  }
  /**
  * Perform an INSERT into the table or view.
  *
  * By default, inserted rows are not returned. To return it, chain the call
  * with `.select()`.
  *
  * @param values - The values to insert. Pass an object to insert a single row
  * or an array to insert multiple rows.
  *
  * @param options - Named parameters
  *
  * @param options.count - Count algorithm to use to count inserted rows.
  *
  * `"exact"`: Exact but slow count algorithm. Performs a `COUNT(*)` under the
  * hood.
  *
  * `"planned"`: Approximated but fast count algorithm. Uses the Postgres
  * statistics under the hood.
  *
  * `"estimated"`: Uses exact count for low numbers and planned count for high
  * numbers.
  *
  * @param options.defaultToNull - Make missing fields default to `null`.
  * Otherwise, use the default value for the column. Only applies for bulk
  * inserts.
  */
  insert(values, { count, defaultToNull = true } = {}) {
    var _this$fetch;
    const method = "POST";
    const { url, headers } = this.cloneRequestState();
    if (count) headers.append("Prefer", `count=${count}`);
    if (!defaultToNull) headers.append("Prefer", `missing=default`);
    if (Array.isArray(values)) {
      const columns = values.reduce((acc, x) => acc.concat(Object.keys(x)), []);
      if (columns.length > 0) {
        const uniqueColumns = [...new Set(columns)].map((column) => `"${column}"`);
        url.searchParams.set("columns", uniqueColumns.join(","));
      }
    }
    return new PostgrestFilterBuilder({
      method,
      url,
      headers,
      schema: this.schema,
      body: values,
      fetch: (_this$fetch = this.fetch) !== null && _this$fetch !== void 0 ? _this$fetch : fetch,
      urlLengthLimit: this.urlLengthLimit
    });
  }
  /**
  * Perform an UPSERT on the table or view. Depending on the column(s) passed
  * to `onConflict`, `.upsert()` allows you to perform the equivalent of
  * `.insert()` if a row with the corresponding `onConflict` columns doesn't
  * exist, or if it does exist, perform an alternative action depending on
  * `ignoreDuplicates`.
  *
  * By default, upserted rows are not returned. To return it, chain the call
  * with `.select()`.
  *
  * @param values - The values to upsert with. Pass an object to upsert a
  * single row or an array to upsert multiple rows.
  *
  * @param options - Named parameters
  *
  * @param options.onConflict - Comma-separated UNIQUE column(s) to specify how
  * duplicate rows are determined. Two rows are duplicates if all the
  * `onConflict` columns are equal.
  *
  * @param options.ignoreDuplicates - If `true`, duplicate rows are ignored. If
  * `false`, duplicate rows are merged with existing rows.
  *
  * @param options.count - Count algorithm to use to count upserted rows.
  *
  * `"exact"`: Exact but slow count algorithm. Performs a `COUNT(*)` under the
  * hood.
  *
  * `"planned"`: Approximated but fast count algorithm. Uses the Postgres
  * statistics under the hood.
  *
  * `"estimated"`: Uses exact count for low numbers and planned count for high
  * numbers.
  *
  * @param options.defaultToNull - Make missing fields default to `null`.
  * Otherwise, use the default value for the column. This only applies when
  * inserting new rows, not when merging with existing rows under
  * `ignoreDuplicates: false`. This also only applies when doing bulk upserts.
  *
  * @example Upsert a single row using a unique key
  * ```ts
  * // Upserting a single row, overwriting based on the 'username' unique column
  * const { data, error } = await supabase
  *   .from('users')
  *   .upsert({ username: 'supabot' }, { onConflict: 'username' })
  *
  * // Example response:
  * // {
  * //   data: [
  * //     { id: 4, message: 'bar', username: 'supabot' }
  * //   ],
  * //   error: null
  * // }
  * ```
  *
  * @example Upsert with conflict resolution and exact row counting
  * ```ts
  * // Upserting and returning exact count
  * const { data, error, count } = await supabase
  *   .from('users')
  *   .upsert(
  *     {
  *       id: 3,
  *       message: 'foo',
  *       username: 'supabot'
  *     },
  *     {
  *       onConflict: 'username',
  *       count: 'exact'
  *     }
  *   )
  *
  * // Example response:
  * // {
  * //   data: [
  * //     {
  * //       id: 42,
  * //       handle: "saoirse",
  * //       display_name: "Saoirse"
  * //     }
  * //   ],
  * //   count: 1,
  * //   error: null
  * // }
  * ```
  */
  upsert(values, { onConflict, ignoreDuplicates = false, count, defaultToNull = true } = {}) {
    var _this$fetch2;
    const method = "POST";
    const { url, headers } = this.cloneRequestState();
    headers.append("Prefer", `resolution=${ignoreDuplicates ? "ignore" : "merge"}-duplicates`);
    if (onConflict !== void 0) url.searchParams.set("on_conflict", onConflict);
    if (count) headers.append("Prefer", `count=${count}`);
    if (!defaultToNull) headers.append("Prefer", "missing=default");
    if (Array.isArray(values)) {
      const columns = values.reduce((acc, x) => acc.concat(Object.keys(x)), []);
      if (columns.length > 0) {
        const uniqueColumns = [...new Set(columns)].map((column) => `"${column}"`);
        url.searchParams.set("columns", uniqueColumns.join(","));
      }
    }
    return new PostgrestFilterBuilder({
      method,
      url,
      headers,
      schema: this.schema,
      body: values,
      fetch: (_this$fetch2 = this.fetch) !== null && _this$fetch2 !== void 0 ? _this$fetch2 : fetch,
      urlLengthLimit: this.urlLengthLimit
    });
  }
  /**
  * Perform an UPDATE on the table or view.
  *
  * By default, updated rows are not returned. To return it, chain the call
  * with `.select()` after filters.
  *
  * @param values - The values to update with
  *
  * @param options - Named parameters
  *
  * @param options.count - Count algorithm to use to count updated rows.
  *
  * `"exact"`: Exact but slow count algorithm. Performs a `COUNT(*)` under the
  * hood.
  *
  * `"planned"`: Approximated but fast count algorithm. Uses the Postgres
  * statistics under the hood.
  *
  * `"estimated"`: Uses exact count for low numbers and planned count for high
  * numbers.
  */
  update(values, { count } = {}) {
    var _this$fetch3;
    const method = "PATCH";
    const { url, headers } = this.cloneRequestState();
    if (count) headers.append("Prefer", `count=${count}`);
    return new PostgrestFilterBuilder({
      method,
      url,
      headers,
      schema: this.schema,
      body: values,
      fetch: (_this$fetch3 = this.fetch) !== null && _this$fetch3 !== void 0 ? _this$fetch3 : fetch,
      urlLengthLimit: this.urlLengthLimit
    });
  }
  /**
  * Perform a DELETE on the table or view.
  *
  * By default, deleted rows are not returned. To return it, chain the call
  * with `.select()` after filters.
  *
  * @param options - Named parameters
  *
  * @param options.count - Count algorithm to use to count deleted rows.
  *
  * `"exact"`: Exact but slow count algorithm. Performs a `COUNT(*)` under the
  * hood.
  *
  * `"planned"`: Approximated but fast count algorithm. Uses the Postgres
  * statistics under the hood.
  *
  * `"estimated"`: Uses exact count for low numbers and planned count for high
  * numbers.
  */
  delete({ count } = {}) {
    var _this$fetch4;
    const method = "DELETE";
    const { url, headers } = this.cloneRequestState();
    if (count) headers.append("Prefer", `count=${count}`);
    return new PostgrestFilterBuilder({
      method,
      url,
      headers,
      schema: this.schema,
      fetch: (_this$fetch4 = this.fetch) !== null && _this$fetch4 !== void 0 ? _this$fetch4 : fetch,
      urlLengthLimit: this.urlLengthLimit
    });
  }
};
function _typeof(o) {
  "@babel/helpers - typeof";
  return _typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function(o$1) {
    return typeof o$1;
  } : function(o$1) {
    return o$1 && "function" == typeof Symbol && o$1.constructor === Symbol && o$1 !== Symbol.prototype ? "symbol" : typeof o$1;
  }, _typeof(o);
}
function toPrimitive(t2, r) {
  if ("object" != _typeof(t2) || !t2) return t2;
  var e = t2[Symbol.toPrimitive];
  if (void 0 !== e) {
    var i = e.call(t2, r || "default");
    if ("object" != _typeof(i)) return i;
    throw new TypeError("@@toPrimitive must return a primitive value.");
  }
  return ("string" === r ? String : Number)(t2);
}
function toPropertyKey(t2) {
  var i = toPrimitive(t2, "string");
  return "symbol" == _typeof(i) ? i : i + "";
}
function _defineProperty(e, r, t2) {
  return (r = toPropertyKey(r)) in e ? Object.defineProperty(e, r, {
    value: t2,
    enumerable: true,
    configurable: true,
    writable: true
  }) : e[r] = t2, e;
}
function ownKeys(e, r) {
  var t2 = Object.keys(e);
  if (Object.getOwnPropertySymbols) {
    var o = Object.getOwnPropertySymbols(e);
    r && (o = o.filter(function(r$1) {
      return Object.getOwnPropertyDescriptor(e, r$1).enumerable;
    })), t2.push.apply(t2, o);
  }
  return t2;
}
function _objectSpread2(e) {
  for (var r = 1; r < arguments.length; r++) {
    var t2 = null != arguments[r] ? arguments[r] : {};
    r % 2 ? ownKeys(Object(t2), true).forEach(function(r$1) {
      _defineProperty(e, r$1, t2[r$1]);
    }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(t2)) : ownKeys(Object(t2)).forEach(function(r$1) {
      Object.defineProperty(e, r$1, Object.getOwnPropertyDescriptor(t2, r$1));
    });
  }
  return e;
}
var PostgrestClient = class PostgrestClient2 {
  /**
  * Creates a PostgREST client.
  *
  * @param url - URL of the PostgREST endpoint
  * @param options - Named parameters
  * @param options.headers - Custom headers
  * @param options.schema - Postgres schema to switch to
  * @param options.fetch - Custom fetch
  * @param options.timeout - Optional timeout in milliseconds for all requests. When set, requests will automatically abort after this duration to prevent indefinite hangs.
  * @param options.urlLengthLimit - Maximum URL length in characters before warnings/errors are triggered. Defaults to 8000.
  * @example
  * ```ts
  * import PostgrestClient from '@supabase/postgrest-js'
  *
  * const postgrest = new PostgrestClient('https://xyzcompany.supabase.co/rest/v1', {
  *   headers: { apikey: 'public-anon-key' },
  *   schema: 'public',
  *   timeout: 30000, // 30 second timeout
  * })
  * ```
  */
  constructor(url, { headers = {}, schema, fetch: fetch$1, timeout, urlLengthLimit = 8e3 } = {}) {
    this.url = url;
    this.headers = new Headers(headers);
    this.schemaName = schema;
    this.urlLengthLimit = urlLengthLimit;
    const originalFetch = fetch$1 !== null && fetch$1 !== void 0 ? fetch$1 : globalThis.fetch;
    if (timeout !== void 0 && timeout > 0) this.fetch = (input, init) => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);
      const existingSignal = init === null || init === void 0 ? void 0 : init.signal;
      if (existingSignal) {
        if (existingSignal.aborted) {
          clearTimeout(timeoutId);
          return originalFetch(input, init);
        }
        const abortHandler = () => {
          clearTimeout(timeoutId);
          controller.abort();
        };
        existingSignal.addEventListener("abort", abortHandler, { once: true });
        return originalFetch(input, _objectSpread2(_objectSpread2({}, init), {}, { signal: controller.signal })).finally(() => {
          clearTimeout(timeoutId);
          existingSignal.removeEventListener("abort", abortHandler);
        });
      }
      return originalFetch(input, _objectSpread2(_objectSpread2({}, init), {}, { signal: controller.signal })).finally(() => clearTimeout(timeoutId));
    };
    else this.fetch = originalFetch;
  }
  /**
  * Perform a query on a table or a view.
  *
  * @param relation - The table or view name to query
  */
  from(relation) {
    if (!relation || typeof relation !== "string" || relation.trim() === "") throw new Error("Invalid relation name: relation must be a non-empty string.");
    return new PostgrestQueryBuilder(new URL(`${this.url}/${relation}`), {
      headers: new Headers(this.headers),
      schema: this.schemaName,
      fetch: this.fetch,
      urlLengthLimit: this.urlLengthLimit
    });
  }
  /**
  * Select a schema to query or perform an function (rpc) call.
  *
  * The schema needs to be on the list of exposed schemas inside Supabase.
  *
  * @param schema - The schema to query
  */
  schema(schema) {
    return new PostgrestClient2(this.url, {
      headers: this.headers,
      schema,
      fetch: this.fetch,
      urlLengthLimit: this.urlLengthLimit
    });
  }
  /**
  * Perform a function call.
  *
  * @param fn - The function name to call
  * @param args - The arguments to pass to the function call
  * @param options - Named parameters
  * @param options.head - When set to `true`, `data` will not be returned.
  * Useful if you only need the count.
  * @param options.get - When set to `true`, the function will be called with
  * read-only access mode.
  * @param options.count - Count algorithm to use to count rows returned by the
  * function. Only applicable for [set-returning
  * functions](https://www.postgresql.org/docs/current/functions-srf.html).
  *
  * `"exact"`: Exact but slow count algorithm. Performs a `COUNT(*)` under the
  * hood.
  *
  * `"planned"`: Approximated but fast count algorithm. Uses the Postgres
  * statistics under the hood.
  *
  * `"estimated"`: Uses exact count for low numbers and planned count for high
  * numbers.
  *
  * @example
  * ```ts
  * // For cross-schema functions where type inference fails, use overrideTypes:
  * const { data } = await supabase
  *   .schema('schema_b')
  *   .rpc('function_a', {})
  *   .overrideTypes<{ id: string; user_id: string }[]>()
  * ```
  */
  rpc(fn, args = {}, { head: head2 = false, get: get2 = false, count } = {}) {
    var _this$fetch;
    let method;
    const url = new URL(`${this.url}/rpc/${fn}`);
    let body;
    const _isObject = (v) => v !== null && typeof v === "object" && (!Array.isArray(v) || v.some(_isObject));
    const _hasObjectArg = head2 && Object.values(args).some(_isObject);
    if (_hasObjectArg) {
      method = "POST";
      body = args;
    } else if (head2 || get2) {
      method = head2 ? "HEAD" : "GET";
      Object.entries(args).filter(([_, value]) => value !== void 0).map(([name, value]) => [name, Array.isArray(value) ? `{${value.join(",")}}` : `${value}`]).forEach(([name, value]) => {
        url.searchParams.append(name, value);
      });
    } else {
      method = "POST";
      body = args;
    }
    const headers = new Headers(this.headers);
    if (_hasObjectArg) headers.set("Prefer", count ? `count=${count},return=minimal` : "return=minimal");
    else if (count) headers.set("Prefer", `count=${count}`);
    return new PostgrestFilterBuilder({
      method,
      url,
      headers,
      schema: this.schemaName,
      body,
      fetch: (_this$fetch = this.fetch) !== null && _this$fetch !== void 0 ? _this$fetch : fetch,
      urlLengthLimit: this.urlLengthLimit
    });
  }
};

// node_modules/@supabase/realtime-js/dist/module/lib/websocket-factory.js
var WebSocketFactory = class {
  /**
   * Static-only utility – prevent instantiation.
   */
  constructor() {
  }
  static detectEnvironment() {
    var _a;
    if (typeof WebSocket !== "undefined") {
      return { type: "native", constructor: WebSocket };
    }
    if (typeof globalThis !== "undefined" && typeof globalThis.WebSocket !== "undefined") {
      return { type: "native", constructor: globalThis.WebSocket };
    }
    if (typeof global !== "undefined" && typeof global.WebSocket !== "undefined") {
      return { type: "native", constructor: global.WebSocket };
    }
    if (typeof globalThis !== "undefined" && typeof globalThis.WebSocketPair !== "undefined" && typeof globalThis.WebSocket === "undefined") {
      return {
        type: "cloudflare",
        error: "Cloudflare Workers detected. WebSocket clients are not supported in Cloudflare Workers.",
        workaround: "Use Cloudflare Workers WebSocket API for server-side WebSocket handling, or deploy to a different runtime."
      };
    }
    if (typeof globalThis !== "undefined" && globalThis.EdgeRuntime || typeof navigator !== "undefined" && ((_a = navigator.userAgent) === null || _a === void 0 ? void 0 : _a.includes("Vercel-Edge"))) {
      return {
        type: "unsupported",
        error: "Edge runtime detected (Vercel Edge/Netlify Edge). WebSockets are not supported in edge functions.",
        workaround: "Use serverless functions or a different deployment target for WebSocket functionality."
      };
    }
    const _process = globalThis["process"];
    if (_process) {
      const processVersions = _process["versions"];
      if (processVersions && processVersions["node"]) {
        const versionString = processVersions["node"];
        const nodeVersion = parseInt(versionString.replace(/^v/, "").split(".")[0]);
        if (nodeVersion >= 22) {
          if (typeof globalThis.WebSocket !== "undefined") {
            return { type: "native", constructor: globalThis.WebSocket };
          }
          return {
            type: "unsupported",
            error: `Node.js ${nodeVersion} detected but native WebSocket not found.`,
            workaround: "Provide a WebSocket implementation via the transport option."
          };
        }
        return {
          type: "unsupported",
          error: `Node.js ${nodeVersion} detected without native WebSocket support.`,
          workaround: 'For Node.js < 22, install "ws" package and provide it via the transport option:\nimport ws from "ws"\nnew RealtimeClient(url, { transport: ws })'
        };
      }
    }
    return {
      type: "unsupported",
      error: "Unknown JavaScript runtime without WebSocket support.",
      workaround: "Ensure you're running in a supported environment (browser, Node.js, Deno) or provide a custom WebSocket implementation."
    };
  }
  /**
   * Returns the best available WebSocket constructor for the current runtime.
   *
   * @example
   * ```ts
   * const WS = WebSocketFactory.getWebSocketConstructor()
   * const socket = new WS('wss://realtime.supabase.co/socket')
   * ```
   */
  static getWebSocketConstructor() {
    const env = this.detectEnvironment();
    if (env.constructor) {
      return env.constructor;
    }
    let errorMessage = env.error || "WebSocket not supported in this environment.";
    if (env.workaround) {
      errorMessage += `

Suggested solution: ${env.workaround}`;
    }
    throw new Error(errorMessage);
  }
  /**
   * Creates a WebSocket using the detected constructor.
   *
   * @example
   * ```ts
   * const socket = WebSocketFactory.createWebSocket('wss://realtime.supabase.co/socket')
   * ```
   */
  static createWebSocket(url, protocols) {
    const WS = this.getWebSocketConstructor();
    return new WS(url, protocols);
  }
  /**
   * Detects whether the runtime can establish WebSocket connections.
   *
   * @example
   * ```ts
   * if (!WebSocketFactory.isWebSocketSupported()) {
   *   console.warn('Falling back to long polling')
   * }
   * ```
   */
  static isWebSocketSupported() {
    try {
      const env = this.detectEnvironment();
      return env.type === "native" || env.type === "ws";
    } catch (_a) {
      return false;
    }
  }
};
var websocket_factory_default = WebSocketFactory;

// node_modules/@supabase/realtime-js/dist/module/lib/version.js
var version = "2.95.3";

// node_modules/@supabase/realtime-js/dist/module/lib/constants.js
var DEFAULT_VERSION = `realtime-js/${version}`;
var VSN_1_0_0 = "1.0.0";
var VSN_2_0_0 = "2.0.0";
var DEFAULT_VSN = VSN_2_0_0;
var DEFAULT_TIMEOUT = 1e4;
var WS_CLOSE_NORMAL = 1e3;
var MAX_PUSH_BUFFER_SIZE = 100;
var SOCKET_STATES;
(function(SOCKET_STATES2) {
  SOCKET_STATES2[SOCKET_STATES2["connecting"] = 0] = "connecting";
  SOCKET_STATES2[SOCKET_STATES2["open"] = 1] = "open";
  SOCKET_STATES2[SOCKET_STATES2["closing"] = 2] = "closing";
  SOCKET_STATES2[SOCKET_STATES2["closed"] = 3] = "closed";
})(SOCKET_STATES || (SOCKET_STATES = {}));
var CHANNEL_STATES;
(function(CHANNEL_STATES2) {
  CHANNEL_STATES2["closed"] = "closed";
  CHANNEL_STATES2["errored"] = "errored";
  CHANNEL_STATES2["joined"] = "joined";
  CHANNEL_STATES2["joining"] = "joining";
  CHANNEL_STATES2["leaving"] = "leaving";
})(CHANNEL_STATES || (CHANNEL_STATES = {}));
var CHANNEL_EVENTS;
(function(CHANNEL_EVENTS2) {
  CHANNEL_EVENTS2["close"] = "phx_close";
  CHANNEL_EVENTS2["error"] = "phx_error";
  CHANNEL_EVENTS2["join"] = "phx_join";
  CHANNEL_EVENTS2["reply"] = "phx_reply";
  CHANNEL_EVENTS2["leave"] = "phx_leave";
  CHANNEL_EVENTS2["access_token"] = "access_token";
})(CHANNEL_EVENTS || (CHANNEL_EVENTS = {}));
var TRANSPORTS;
(function(TRANSPORTS2) {
  TRANSPORTS2["websocket"] = "websocket";
})(TRANSPORTS || (TRANSPORTS = {}));
var CONNECTION_STATE;
(function(CONNECTION_STATE2) {
  CONNECTION_STATE2["Connecting"] = "connecting";
  CONNECTION_STATE2["Open"] = "open";
  CONNECTION_STATE2["Closing"] = "closing";
  CONNECTION_STATE2["Closed"] = "closed";
})(CONNECTION_STATE || (CONNECTION_STATE = {}));

// node_modules/@supabase/realtime-js/dist/module/lib/serializer.js
var Serializer = class {
  constructor(allowedMetadataKeys) {
    this.HEADER_LENGTH = 1;
    this.USER_BROADCAST_PUSH_META_LENGTH = 6;
    this.KINDS = { userBroadcastPush: 3, userBroadcast: 4 };
    this.BINARY_ENCODING = 0;
    this.JSON_ENCODING = 1;
    this.BROADCAST_EVENT = "broadcast";
    this.allowedMetadataKeys = [];
    this.allowedMetadataKeys = allowedMetadataKeys !== null && allowedMetadataKeys !== void 0 ? allowedMetadataKeys : [];
  }
  encode(msg, callback) {
    if (msg.event === this.BROADCAST_EVENT && !(msg.payload instanceof ArrayBuffer) && typeof msg.payload.event === "string") {
      return callback(this._binaryEncodeUserBroadcastPush(msg));
    }
    let payload = [msg.join_ref, msg.ref, msg.topic, msg.event, msg.payload];
    return callback(JSON.stringify(payload));
  }
  _binaryEncodeUserBroadcastPush(message) {
    var _a;
    if (this._isArrayBuffer((_a = message.payload) === null || _a === void 0 ? void 0 : _a.payload)) {
      return this._encodeBinaryUserBroadcastPush(message);
    } else {
      return this._encodeJsonUserBroadcastPush(message);
    }
  }
  _encodeBinaryUserBroadcastPush(message) {
    var _a, _b;
    const userPayload = (_b = (_a = message.payload) === null || _a === void 0 ? void 0 : _a.payload) !== null && _b !== void 0 ? _b : new ArrayBuffer(0);
    return this._encodeUserBroadcastPush(message, this.BINARY_ENCODING, userPayload);
  }
  _encodeJsonUserBroadcastPush(message) {
    var _a, _b;
    const userPayload = (_b = (_a = message.payload) === null || _a === void 0 ? void 0 : _a.payload) !== null && _b !== void 0 ? _b : {};
    const encoder = new TextEncoder();
    const encodedUserPayload = encoder.encode(JSON.stringify(userPayload)).buffer;
    return this._encodeUserBroadcastPush(message, this.JSON_ENCODING, encodedUserPayload);
  }
  _encodeUserBroadcastPush(message, encodingType, encodedPayload) {
    var _a, _b;
    const topic = message.topic;
    const ref = (_a = message.ref) !== null && _a !== void 0 ? _a : "";
    const joinRef = (_b = message.join_ref) !== null && _b !== void 0 ? _b : "";
    const userEvent = message.payload.event;
    const rest = this.allowedMetadataKeys ? this._pick(message.payload, this.allowedMetadataKeys) : {};
    const metadata = Object.keys(rest).length === 0 ? "" : JSON.stringify(rest);
    if (joinRef.length > 255) {
      throw new Error(`joinRef length ${joinRef.length} exceeds maximum of 255`);
    }
    if (ref.length > 255) {
      throw new Error(`ref length ${ref.length} exceeds maximum of 255`);
    }
    if (topic.length > 255) {
      throw new Error(`topic length ${topic.length} exceeds maximum of 255`);
    }
    if (userEvent.length > 255) {
      throw new Error(`userEvent length ${userEvent.length} exceeds maximum of 255`);
    }
    if (metadata.length > 255) {
      throw new Error(`metadata length ${metadata.length} exceeds maximum of 255`);
    }
    const metaLength = this.USER_BROADCAST_PUSH_META_LENGTH + joinRef.length + ref.length + topic.length + userEvent.length + metadata.length;
    const header = new ArrayBuffer(this.HEADER_LENGTH + metaLength);
    let view = new DataView(header);
    let offset = 0;
    view.setUint8(offset++, this.KINDS.userBroadcastPush);
    view.setUint8(offset++, joinRef.length);
    view.setUint8(offset++, ref.length);
    view.setUint8(offset++, topic.length);
    view.setUint8(offset++, userEvent.length);
    view.setUint8(offset++, metadata.length);
    view.setUint8(offset++, encodingType);
    Array.from(joinRef, (char) => view.setUint8(offset++, char.charCodeAt(0)));
    Array.from(ref, (char) => view.setUint8(offset++, char.charCodeAt(0)));
    Array.from(topic, (char) => view.setUint8(offset++, char.charCodeAt(0)));
    Array.from(userEvent, (char) => view.setUint8(offset++, char.charCodeAt(0)));
    Array.from(metadata, (char) => view.setUint8(offset++, char.charCodeAt(0)));
    var combined = new Uint8Array(header.byteLength + encodedPayload.byteLength);
    combined.set(new Uint8Array(header), 0);
    combined.set(new Uint8Array(encodedPayload), header.byteLength);
    return combined.buffer;
  }
  decode(rawPayload, callback) {
    if (this._isArrayBuffer(rawPayload)) {
      let result = this._binaryDecode(rawPayload);
      return callback(result);
    }
    if (typeof rawPayload === "string") {
      const jsonPayload = JSON.parse(rawPayload);
      const [join_ref, ref, topic, event, payload] = jsonPayload;
      return callback({ join_ref, ref, topic, event, payload });
    }
    return callback({});
  }
  _binaryDecode(buffer) {
    const view = new DataView(buffer);
    const kind = view.getUint8(0);
    const decoder = new TextDecoder();
    switch (kind) {
      case this.KINDS.userBroadcast:
        return this._decodeUserBroadcast(buffer, view, decoder);
    }
  }
  _decodeUserBroadcast(buffer, view, decoder) {
    const topicSize = view.getUint8(1);
    const userEventSize = view.getUint8(2);
    const metadataSize = view.getUint8(3);
    const payloadEncoding = view.getUint8(4);
    let offset = this.HEADER_LENGTH + 4;
    const topic = decoder.decode(buffer.slice(offset, offset + topicSize));
    offset = offset + topicSize;
    const userEvent = decoder.decode(buffer.slice(offset, offset + userEventSize));
    offset = offset + userEventSize;
    const metadata = decoder.decode(buffer.slice(offset, offset + metadataSize));
    offset = offset + metadataSize;
    const payload = buffer.slice(offset, buffer.byteLength);
    const parsedPayload = payloadEncoding === this.JSON_ENCODING ? JSON.parse(decoder.decode(payload)) : payload;
    const data = {
      type: this.BROADCAST_EVENT,
      event: userEvent,
      payload: parsedPayload
    };
    if (metadataSize > 0) {
      data["meta"] = JSON.parse(metadata);
    }
    return { join_ref: null, ref: null, topic, event: this.BROADCAST_EVENT, payload: data };
  }
  _isArrayBuffer(buffer) {
    var _a;
    return buffer instanceof ArrayBuffer || ((_a = buffer === null || buffer === void 0 ? void 0 : buffer.constructor) === null || _a === void 0 ? void 0 : _a.name) === "ArrayBuffer";
  }
  _pick(obj, keys) {
    if (!obj || typeof obj !== "object") {
      return {};
    }
    return Object.fromEntries(Object.entries(obj).filter(([key]) => keys.includes(key)));
  }
};

// node_modules/@supabase/realtime-js/dist/module/lib/timer.js
var Timer = class {
  constructor(callback, timerCalc) {
    this.callback = callback;
    this.timerCalc = timerCalc;
    this.timer = void 0;
    this.tries = 0;
    this.callback = callback;
    this.timerCalc = timerCalc;
  }
  reset() {
    this.tries = 0;
    clearTimeout(this.timer);
    this.timer = void 0;
  }
  // Cancels any previous scheduleTimeout and schedules callback
  scheduleTimeout() {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.tries = this.tries + 1;
      this.callback();
    }, this.timerCalc(this.tries + 1));
  }
};

// node_modules/@supabase/realtime-js/dist/module/lib/transformers.js
var PostgresTypes;
(function(PostgresTypes2) {
  PostgresTypes2["abstime"] = "abstime";
  PostgresTypes2["bool"] = "bool";
  PostgresTypes2["date"] = "date";
  PostgresTypes2["daterange"] = "daterange";
  PostgresTypes2["float4"] = "float4";
  PostgresTypes2["float8"] = "float8";
  PostgresTypes2["int2"] = "int2";
  PostgresTypes2["int4"] = "int4";
  PostgresTypes2["int4range"] = "int4range";
  PostgresTypes2["int8"] = "int8";
  PostgresTypes2["int8range"] = "int8range";
  PostgresTypes2["json"] = "json";
  PostgresTypes2["jsonb"] = "jsonb";
  PostgresTypes2["money"] = "money";
  PostgresTypes2["numeric"] = "numeric";
  PostgresTypes2["oid"] = "oid";
  PostgresTypes2["reltime"] = "reltime";
  PostgresTypes2["text"] = "text";
  PostgresTypes2["time"] = "time";
  PostgresTypes2["timestamp"] = "timestamp";
  PostgresTypes2["timestamptz"] = "timestamptz";
  PostgresTypes2["timetz"] = "timetz";
  PostgresTypes2["tsrange"] = "tsrange";
  PostgresTypes2["tstzrange"] = "tstzrange";
})(PostgresTypes || (PostgresTypes = {}));
var convertChangeData = (columns, record, options = {}) => {
  var _a;
  const skipTypes = (_a = options.skipTypes) !== null && _a !== void 0 ? _a : [];
  if (!record) {
    return {};
  }
  return Object.keys(record).reduce((acc, rec_key) => {
    acc[rec_key] = convertColumn(rec_key, columns, record, skipTypes);
    return acc;
  }, {});
};
var convertColumn = (columnName, columns, record, skipTypes) => {
  const column = columns.find((x) => x.name === columnName);
  const colType = column === null || column === void 0 ? void 0 : column.type;
  const value = record[columnName];
  if (colType && !skipTypes.includes(colType)) {
    return convertCell(colType, value);
  }
  return noop(value);
};
var convertCell = (type, value) => {
  if (type.charAt(0) === "_") {
    const dataType = type.slice(1, type.length);
    return toArray(value, dataType);
  }
  switch (type) {
    case PostgresTypes.bool:
      return toBoolean(value);
    case PostgresTypes.float4:
    case PostgresTypes.float8:
    case PostgresTypes.int2:
    case PostgresTypes.int4:
    case PostgresTypes.int8:
    case PostgresTypes.numeric:
    case PostgresTypes.oid:
      return toNumber(value);
    case PostgresTypes.json:
    case PostgresTypes.jsonb:
      return toJson(value);
    case PostgresTypes.timestamp:
      return toTimestampString(value);
    // Format to be consistent with PostgREST
    case PostgresTypes.abstime:
    // To allow users to cast it based on Timezone
    case PostgresTypes.date:
    // To allow users to cast it based on Timezone
    case PostgresTypes.daterange:
    case PostgresTypes.int4range:
    case PostgresTypes.int8range:
    case PostgresTypes.money:
    case PostgresTypes.reltime:
    // To allow users to cast it based on Timezone
    case PostgresTypes.text:
    case PostgresTypes.time:
    // To allow users to cast it based on Timezone
    case PostgresTypes.timestamptz:
    // To allow users to cast it based on Timezone
    case PostgresTypes.timetz:
    // To allow users to cast it based on Timezone
    case PostgresTypes.tsrange:
    case PostgresTypes.tstzrange:
      return noop(value);
    default:
      return noop(value);
  }
};
var noop = (value) => {
  return value;
};
var toBoolean = (value) => {
  switch (value) {
    case "t":
      return true;
    case "f":
      return false;
    default:
      return value;
  }
};
var toNumber = (value) => {
  if (typeof value === "string") {
    const parsedValue = parseFloat(value);
    if (!Number.isNaN(parsedValue)) {
      return parsedValue;
    }
  }
  return value;
};
var toJson = (value) => {
  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch (_a) {
      return value;
    }
  }
  return value;
};
var toArray = (value, type) => {
  if (typeof value !== "string") {
    return value;
  }
  const lastIdx = value.length - 1;
  const closeBrace = value[lastIdx];
  const openBrace = value[0];
  if (openBrace === "{" && closeBrace === "}") {
    let arr;
    const valTrim = value.slice(1, lastIdx);
    try {
      arr = JSON.parse("[" + valTrim + "]");
    } catch (_) {
      arr = valTrim ? valTrim.split(",") : [];
    }
    return arr.map((val) => convertCell(type, val));
  }
  return value;
};
var toTimestampString = (value) => {
  if (typeof value === "string") {
    return value.replace(" ", "T");
  }
  return value;
};
var httpEndpointURL = (socketUrl) => {
  const wsUrl = new URL(socketUrl);
  wsUrl.protocol = wsUrl.protocol.replace(/^ws/i, "http");
  wsUrl.pathname = wsUrl.pathname.replace(/\/+$/, "").replace(/\/socket\/websocket$/i, "").replace(/\/socket$/i, "").replace(/\/websocket$/i, "");
  if (wsUrl.pathname === "" || wsUrl.pathname === "/") {
    wsUrl.pathname = "/api/broadcast";
  } else {
    wsUrl.pathname = wsUrl.pathname + "/api/broadcast";
  }
  return wsUrl.href;
};

// node_modules/@supabase/realtime-js/dist/module/lib/push.js
var Push = class {
  /**
   * Initializes the Push
   *
   * @param channel The Channel
   * @param event The event, for example `"phx_join"`
   * @param payload The payload, for example `{user_id: 123}`
   * @param timeout The push timeout in milliseconds
   */
  constructor(channel, event, payload = {}, timeout = DEFAULT_TIMEOUT) {
    this.channel = channel;
    this.event = event;
    this.payload = payload;
    this.timeout = timeout;
    this.sent = false;
    this.timeoutTimer = void 0;
    this.ref = "";
    this.receivedResp = null;
    this.recHooks = [];
    this.refEvent = null;
  }
  resend(timeout) {
    this.timeout = timeout;
    this._cancelRefEvent();
    this.ref = "";
    this.refEvent = null;
    this.receivedResp = null;
    this.sent = false;
    this.send();
  }
  send() {
    if (this._hasReceived("timeout")) {
      return;
    }
    this.startTimeout();
    this.sent = true;
    this.channel.socket.push({
      topic: this.channel.topic,
      event: this.event,
      payload: this.payload,
      ref: this.ref,
      join_ref: this.channel._joinRef()
    });
  }
  updatePayload(payload) {
    this.payload = Object.assign(Object.assign({}, this.payload), payload);
  }
  receive(status, callback) {
    var _a;
    if (this._hasReceived(status)) {
      callback((_a = this.receivedResp) === null || _a === void 0 ? void 0 : _a.response);
    }
    this.recHooks.push({ status, callback });
    return this;
  }
  startTimeout() {
    if (this.timeoutTimer) {
      return;
    }
    this.ref = this.channel.socket._makeRef();
    this.refEvent = this.channel._replyEventName(this.ref);
    const callback = (payload) => {
      this._cancelRefEvent();
      this._cancelTimeout();
      this.receivedResp = payload;
      this._matchReceive(payload);
    };
    this.channel._on(this.refEvent, {}, callback);
    this.timeoutTimer = setTimeout(() => {
      this.trigger("timeout", {});
    }, this.timeout);
  }
  trigger(status, response) {
    if (this.refEvent)
      this.channel._trigger(this.refEvent, { status, response });
  }
  destroy() {
    this._cancelRefEvent();
    this._cancelTimeout();
  }
  _cancelRefEvent() {
    if (!this.refEvent) {
      return;
    }
    this.channel._off(this.refEvent, {});
  }
  _cancelTimeout() {
    clearTimeout(this.timeoutTimer);
    this.timeoutTimer = void 0;
  }
  _matchReceive({ status, response }) {
    this.recHooks.filter((h) => h.status === status).forEach((h) => h.callback(response));
  }
  _hasReceived(status) {
    return this.receivedResp && this.receivedResp.status === status;
  }
};

// node_modules/@supabase/realtime-js/dist/module/RealtimePresence.js
var REALTIME_PRESENCE_LISTEN_EVENTS;
(function(REALTIME_PRESENCE_LISTEN_EVENTS2) {
  REALTIME_PRESENCE_LISTEN_EVENTS2["SYNC"] = "sync";
  REALTIME_PRESENCE_LISTEN_EVENTS2["JOIN"] = "join";
  REALTIME_PRESENCE_LISTEN_EVENTS2["LEAVE"] = "leave";
})(REALTIME_PRESENCE_LISTEN_EVENTS || (REALTIME_PRESENCE_LISTEN_EVENTS = {}));
var RealtimePresence = class _RealtimePresence {
  /**
   * Creates a Presence helper that keeps the local presence state in sync with the server.
   *
   * @param channel - The realtime channel to bind to.
   * @param opts - Optional custom event names, e.g. `{ events: { state: 'state', diff: 'diff' } }`.
   *
   * @example
   * ```ts
   * const presence = new RealtimePresence(channel)
   *
   * channel.on('presence', ({ event, key }) => {
   *   console.log(`Presence ${event} on ${key}`)
   * })
   * ```
   */
  constructor(channel, opts) {
    this.channel = channel;
    this.state = {};
    this.pendingDiffs = [];
    this.joinRef = null;
    this.enabled = false;
    this.caller = {
      onJoin: () => {
      },
      onLeave: () => {
      },
      onSync: () => {
      }
    };
    const events = (opts === null || opts === void 0 ? void 0 : opts.events) || {
      state: "presence_state",
      diff: "presence_diff"
    };
    this.channel._on(events.state, {}, (newState) => {
      const { onJoin, onLeave, onSync } = this.caller;
      this.joinRef = this.channel._joinRef();
      this.state = _RealtimePresence.syncState(this.state, newState, onJoin, onLeave);
      this.pendingDiffs.forEach((diff) => {
        this.state = _RealtimePresence.syncDiff(this.state, diff, onJoin, onLeave);
      });
      this.pendingDiffs = [];
      onSync();
    });
    this.channel._on(events.diff, {}, (diff) => {
      const { onJoin, onLeave, onSync } = this.caller;
      if (this.inPendingSyncState()) {
        this.pendingDiffs.push(diff);
      } else {
        this.state = _RealtimePresence.syncDiff(this.state, diff, onJoin, onLeave);
        onSync();
      }
    });
    this.onJoin((key, currentPresences, newPresences) => {
      this.channel._trigger("presence", {
        event: "join",
        key,
        currentPresences,
        newPresences
      });
    });
    this.onLeave((key, currentPresences, leftPresences) => {
      this.channel._trigger("presence", {
        event: "leave",
        key,
        currentPresences,
        leftPresences
      });
    });
    this.onSync(() => {
      this.channel._trigger("presence", { event: "sync" });
    });
  }
  /**
   * Used to sync the list of presences on the server with the
   * client's state.
   *
   * An optional `onJoin` and `onLeave` callback can be provided to
   * react to changes in the client's local presences across
   * disconnects and reconnects with the server.
   *
   * @internal
   */
  static syncState(currentState, newState, onJoin, onLeave) {
    const state = this.cloneDeep(currentState);
    const transformedState = this.transformState(newState);
    const joins = {};
    const leaves = {};
    this.map(state, (key, presences) => {
      if (!transformedState[key]) {
        leaves[key] = presences;
      }
    });
    this.map(transformedState, (key, newPresences) => {
      const currentPresences = state[key];
      if (currentPresences) {
        const newPresenceRefs = newPresences.map((m) => m.presence_ref);
        const curPresenceRefs = currentPresences.map((m) => m.presence_ref);
        const joinedPresences = newPresences.filter((m) => curPresenceRefs.indexOf(m.presence_ref) < 0);
        const leftPresences = currentPresences.filter((m) => newPresenceRefs.indexOf(m.presence_ref) < 0);
        if (joinedPresences.length > 0) {
          joins[key] = joinedPresences;
        }
        if (leftPresences.length > 0) {
          leaves[key] = leftPresences;
        }
      } else {
        joins[key] = newPresences;
      }
    });
    return this.syncDiff(state, { joins, leaves }, onJoin, onLeave);
  }
  /**
   * Used to sync a diff of presence join and leave events from the
   * server, as they happen.
   *
   * Like `syncState`, `syncDiff` accepts optional `onJoin` and
   * `onLeave` callbacks to react to a user joining or leaving from a
   * device.
   *
   * @internal
   */
  static syncDiff(state, diff, onJoin, onLeave) {
    const { joins, leaves } = {
      joins: this.transformState(diff.joins),
      leaves: this.transformState(diff.leaves)
    };
    if (!onJoin) {
      onJoin = () => {
      };
    }
    if (!onLeave) {
      onLeave = () => {
      };
    }
    this.map(joins, (key, newPresences) => {
      var _a;
      const currentPresences = (_a = state[key]) !== null && _a !== void 0 ? _a : [];
      state[key] = this.cloneDeep(newPresences);
      if (currentPresences.length > 0) {
        const joinedPresenceRefs = state[key].map((m) => m.presence_ref);
        const curPresences = currentPresences.filter((m) => joinedPresenceRefs.indexOf(m.presence_ref) < 0);
        state[key].unshift(...curPresences);
      }
      onJoin(key, currentPresences, newPresences);
    });
    this.map(leaves, (key, leftPresences) => {
      let currentPresences = state[key];
      if (!currentPresences)
        return;
      const presenceRefsToRemove = leftPresences.map((m) => m.presence_ref);
      currentPresences = currentPresences.filter((m) => presenceRefsToRemove.indexOf(m.presence_ref) < 0);
      state[key] = currentPresences;
      onLeave(key, currentPresences, leftPresences);
      if (currentPresences.length === 0)
        delete state[key];
    });
    return state;
  }
  /** @internal */
  static map(obj, func) {
    return Object.getOwnPropertyNames(obj).map((key) => func(key, obj[key]));
  }
  /**
   * Remove 'metas' key
   * Change 'phx_ref' to 'presence_ref'
   * Remove 'phx_ref' and 'phx_ref_prev'
   *
   * @example
   * // returns {
   *  abc123: [
   *    { presence_ref: '2', user_id: 1 },
   *    { presence_ref: '3', user_id: 2 }
   *  ]
   * }
   * RealtimePresence.transformState({
   *  abc123: {
   *    metas: [
   *      { phx_ref: '2', phx_ref_prev: '1' user_id: 1 },
   *      { phx_ref: '3', user_id: 2 }
   *    ]
   *  }
   * })
   *
   * @internal
   */
  static transformState(state) {
    state = this.cloneDeep(state);
    return Object.getOwnPropertyNames(state).reduce((newState, key) => {
      const presences = state[key];
      if ("metas" in presences) {
        newState[key] = presences.metas.map((presence) => {
          presence["presence_ref"] = presence["phx_ref"];
          delete presence["phx_ref"];
          delete presence["phx_ref_prev"];
          return presence;
        });
      } else {
        newState[key] = presences;
      }
      return newState;
    }, {});
  }
  /** @internal */
  static cloneDeep(obj) {
    return JSON.parse(JSON.stringify(obj));
  }
  /** @internal */
  onJoin(callback) {
    this.caller.onJoin = callback;
  }
  /** @internal */
  onLeave(callback) {
    this.caller.onLeave = callback;
  }
  /** @internal */
  onSync(callback) {
    this.caller.onSync = callback;
  }
  /** @internal */
  inPendingSyncState() {
    return !this.joinRef || this.joinRef !== this.channel._joinRef();
  }
};

// node_modules/@supabase/realtime-js/dist/module/RealtimeChannel.js
var REALTIME_POSTGRES_CHANGES_LISTEN_EVENT;
(function(REALTIME_POSTGRES_CHANGES_LISTEN_EVENT2) {
  REALTIME_POSTGRES_CHANGES_LISTEN_EVENT2["ALL"] = "*";
  REALTIME_POSTGRES_CHANGES_LISTEN_EVENT2["INSERT"] = "INSERT";
  REALTIME_POSTGRES_CHANGES_LISTEN_EVENT2["UPDATE"] = "UPDATE";
  REALTIME_POSTGRES_CHANGES_LISTEN_EVENT2["DELETE"] = "DELETE";
})(REALTIME_POSTGRES_CHANGES_LISTEN_EVENT || (REALTIME_POSTGRES_CHANGES_LISTEN_EVENT = {}));
var REALTIME_LISTEN_TYPES;
(function(REALTIME_LISTEN_TYPES2) {
  REALTIME_LISTEN_TYPES2["BROADCAST"] = "broadcast";
  REALTIME_LISTEN_TYPES2["PRESENCE"] = "presence";
  REALTIME_LISTEN_TYPES2["POSTGRES_CHANGES"] = "postgres_changes";
  REALTIME_LISTEN_TYPES2["SYSTEM"] = "system";
})(REALTIME_LISTEN_TYPES || (REALTIME_LISTEN_TYPES = {}));
var REALTIME_SUBSCRIBE_STATES;
(function(REALTIME_SUBSCRIBE_STATES2) {
  REALTIME_SUBSCRIBE_STATES2["SUBSCRIBED"] = "SUBSCRIBED";
  REALTIME_SUBSCRIBE_STATES2["TIMED_OUT"] = "TIMED_OUT";
  REALTIME_SUBSCRIBE_STATES2["CLOSED"] = "CLOSED";
  REALTIME_SUBSCRIBE_STATES2["CHANNEL_ERROR"] = "CHANNEL_ERROR";
})(REALTIME_SUBSCRIBE_STATES || (REALTIME_SUBSCRIBE_STATES = {}));
var RealtimeChannel = class _RealtimeChannel {
  /**
   * Creates a channel that can broadcast messages, sync presence, and listen to Postgres changes.
   *
   * The topic determines which realtime stream you are subscribing to. Config options let you
   * enable acknowledgement for broadcasts, presence tracking, or private channels.
   *
   * @example
   * ```ts
   * import RealtimeClient from '@supabase/realtime-js'
   *
   * const client = new RealtimeClient('https://xyzcompany.supabase.co/realtime/v1', {
   *   params: { apikey: 'public-anon-key' },
   * })
   * const channel = new RealtimeChannel('realtime:public:messages', { config: {} }, client)
   * ```
   */
  constructor(topic, params = { config: {} }, socket) {
    var _a, _b;
    this.topic = topic;
    this.params = params;
    this.socket = socket;
    this.bindings = {};
    this.state = CHANNEL_STATES.closed;
    this.joinedOnce = false;
    this.pushBuffer = [];
    this.subTopic = topic.replace(/^realtime:/i, "");
    this.params.config = Object.assign({
      broadcast: { ack: false, self: false },
      presence: { key: "", enabled: false },
      private: false
    }, params.config);
    this.timeout = this.socket.timeout;
    this.joinPush = new Push(this, CHANNEL_EVENTS.join, this.params, this.timeout);
    this.rejoinTimer = new Timer(() => this._rejoinUntilConnected(), this.socket.reconnectAfterMs);
    this.joinPush.receive("ok", () => {
      this.state = CHANNEL_STATES.joined;
      this.rejoinTimer.reset();
      this.pushBuffer.forEach((pushEvent) => pushEvent.send());
      this.pushBuffer = [];
    });
    this._onClose(() => {
      this.rejoinTimer.reset();
      this.socket.log("channel", `close ${this.topic} ${this._joinRef()}`);
      this.state = CHANNEL_STATES.closed;
      this.socket._remove(this);
    });
    this._onError((reason) => {
      if (this._isLeaving() || this._isClosed()) {
        return;
      }
      this.socket.log("channel", `error ${this.topic}`, reason);
      this.state = CHANNEL_STATES.errored;
      this.rejoinTimer.scheduleTimeout();
    });
    this.joinPush.receive("timeout", () => {
      if (!this._isJoining()) {
        return;
      }
      this.socket.log("channel", `timeout ${this.topic}`, this.joinPush.timeout);
      this.state = CHANNEL_STATES.errored;
      this.rejoinTimer.scheduleTimeout();
    });
    this.joinPush.receive("error", (reason) => {
      if (this._isLeaving() || this._isClosed()) {
        return;
      }
      this.socket.log("channel", `error ${this.topic}`, reason);
      this.state = CHANNEL_STATES.errored;
      this.rejoinTimer.scheduleTimeout();
    });
    this._on(CHANNEL_EVENTS.reply, {}, (payload, ref) => {
      this._trigger(this._replyEventName(ref), payload);
    });
    this.presence = new RealtimePresence(this);
    this.broadcastEndpointURL = httpEndpointURL(this.socket.endPoint);
    this.private = this.params.config.private || false;
    if (!this.private && ((_b = (_a = this.params.config) === null || _a === void 0 ? void 0 : _a.broadcast) === null || _b === void 0 ? void 0 : _b.replay)) {
      throw `tried to use replay on public channel '${this.topic}'. It must be a private channel.`;
    }
  }
  /** Subscribe registers your client with the server */
  subscribe(callback, timeout = this.timeout) {
    var _a, _b, _c;
    if (!this.socket.isConnected()) {
      this.socket.connect();
    }
    if (this.state == CHANNEL_STATES.closed) {
      const { config: { broadcast, presence, private: isPrivate } } = this.params;
      const postgres_changes = (_b = (_a = this.bindings.postgres_changes) === null || _a === void 0 ? void 0 : _a.map((r) => r.filter)) !== null && _b !== void 0 ? _b : [];
      const presence_enabled = !!this.bindings[REALTIME_LISTEN_TYPES.PRESENCE] && this.bindings[REALTIME_LISTEN_TYPES.PRESENCE].length > 0 || ((_c = this.params.config.presence) === null || _c === void 0 ? void 0 : _c.enabled) === true;
      const accessTokenPayload = {};
      const config = {
        broadcast,
        presence: Object.assign(Object.assign({}, presence), { enabled: presence_enabled }),
        postgres_changes,
        private: isPrivate
      };
      if (this.socket.accessTokenValue) {
        accessTokenPayload.access_token = this.socket.accessTokenValue;
      }
      this._onError((e) => callback === null || callback === void 0 ? void 0 : callback(REALTIME_SUBSCRIBE_STATES.CHANNEL_ERROR, e));
      this._onClose(() => callback === null || callback === void 0 ? void 0 : callback(REALTIME_SUBSCRIBE_STATES.CLOSED));
      this.updateJoinPayload(Object.assign({ config }, accessTokenPayload));
      this.joinedOnce = true;
      this._rejoin(timeout);
      this.joinPush.receive("ok", async ({ postgres_changes: postgres_changes2 }) => {
        var _a2;
        if (!this.socket._isManualToken()) {
          this.socket.setAuth();
        }
        if (postgres_changes2 === void 0) {
          callback === null || callback === void 0 ? void 0 : callback(REALTIME_SUBSCRIBE_STATES.SUBSCRIBED);
          return;
        } else {
          const clientPostgresBindings = this.bindings.postgres_changes;
          const bindingsLen = (_a2 = clientPostgresBindings === null || clientPostgresBindings === void 0 ? void 0 : clientPostgresBindings.length) !== null && _a2 !== void 0 ? _a2 : 0;
          const newPostgresBindings = [];
          for (let i = 0; i < bindingsLen; i++) {
            const clientPostgresBinding = clientPostgresBindings[i];
            const { filter: { event, schema, table, filter } } = clientPostgresBinding;
            const serverPostgresFilter = postgres_changes2 && postgres_changes2[i];
            if (serverPostgresFilter && serverPostgresFilter.event === event && _RealtimeChannel.isFilterValueEqual(serverPostgresFilter.schema, schema) && _RealtimeChannel.isFilterValueEqual(serverPostgresFilter.table, table) && _RealtimeChannel.isFilterValueEqual(serverPostgresFilter.filter, filter)) {
              newPostgresBindings.push(Object.assign(Object.assign({}, clientPostgresBinding), { id: serverPostgresFilter.id }));
            } else {
              this.unsubscribe();
              this.state = CHANNEL_STATES.errored;
              callback === null || callback === void 0 ? void 0 : callback(REALTIME_SUBSCRIBE_STATES.CHANNEL_ERROR, new Error("mismatch between server and client bindings for postgres changes"));
              return;
            }
          }
          this.bindings.postgres_changes = newPostgresBindings;
          callback && callback(REALTIME_SUBSCRIBE_STATES.SUBSCRIBED);
          return;
        }
      }).receive("error", (error) => {
        this.state = CHANNEL_STATES.errored;
        callback === null || callback === void 0 ? void 0 : callback(REALTIME_SUBSCRIBE_STATES.CHANNEL_ERROR, new Error(JSON.stringify(Object.values(error).join(", ") || "error")));
        return;
      }).receive("timeout", () => {
        callback === null || callback === void 0 ? void 0 : callback(REALTIME_SUBSCRIBE_STATES.TIMED_OUT);
        return;
      });
    }
    return this;
  }
  /**
   * Returns the current presence state for this channel.
   *
   * The shape is a map keyed by presence key (for example a user id) where each entry contains the
   * tracked metadata for that user.
   */
  presenceState() {
    return this.presence.state;
  }
  /**
   * Sends the supplied payload to the presence tracker so other subscribers can see that this
   * client is online. Use `untrack` to stop broadcasting presence for the same key.
   */
  async track(payload, opts = {}) {
    return await this.send({
      type: "presence",
      event: "track",
      payload
    }, opts.timeout || this.timeout);
  }
  /**
   * Removes the current presence state for this client.
   */
  async untrack(opts = {}) {
    return await this.send({
      type: "presence",
      event: "untrack"
    }, opts);
  }
  on(type, filter, callback) {
    if (this.state === CHANNEL_STATES.joined && type === REALTIME_LISTEN_TYPES.PRESENCE) {
      this.socket.log("channel", `resubscribe to ${this.topic} due to change in presence callbacks on joined channel`);
      this.unsubscribe().then(async () => await this.subscribe());
    }
    return this._on(type, filter, callback);
  }
  /**
   * Sends a broadcast message explicitly via REST API.
   *
   * This method always uses the REST API endpoint regardless of WebSocket connection state.
   * Useful when you want to guarantee REST delivery or when gradually migrating from implicit REST fallback.
   *
   * @param event The name of the broadcast event
   * @param payload Payload to be sent (required)
   * @param opts Options including timeout
   * @returns Promise resolving to object with success status, and error details if failed
   */
  async httpSend(event, payload, opts = {}) {
    var _a;
    if (payload === void 0 || payload === null) {
      return Promise.reject("Payload is required for httpSend()");
    }
    const headers = {
      apikey: this.socket.apiKey ? this.socket.apiKey : "",
      "Content-Type": "application/json"
    };
    if (this.socket.accessTokenValue) {
      headers["Authorization"] = `Bearer ${this.socket.accessTokenValue}`;
    }
    const options = {
      method: "POST",
      headers,
      body: JSON.stringify({
        messages: [
          {
            topic: this.subTopic,
            event,
            payload,
            private: this.private
          }
        ]
      })
    };
    const response = await this._fetchWithTimeout(this.broadcastEndpointURL, options, (_a = opts.timeout) !== null && _a !== void 0 ? _a : this.timeout);
    if (response.status === 202) {
      return { success: true };
    }
    let errorMessage = response.statusText;
    try {
      const errorBody = await response.json();
      errorMessage = errorBody.error || errorBody.message || errorMessage;
    } catch (_b) {
    }
    return Promise.reject(new Error(errorMessage));
  }
  /**
   * Sends a message into the channel.
   *
   * @param args Arguments to send to channel
   * @param args.type The type of event to send
   * @param args.event The name of the event being sent
   * @param args.payload Payload to be sent
   * @param opts Options to be used during the send process
   */
  async send(args, opts = {}) {
    var _a, _b;
    if (!this._canPush() && args.type === "broadcast") {
      console.warn("Realtime send() is automatically falling back to REST API. This behavior will be deprecated in the future. Please use httpSend() explicitly for REST delivery.");
      const { event, payload: endpoint_payload } = args;
      const headers = {
        apikey: this.socket.apiKey ? this.socket.apiKey : "",
        "Content-Type": "application/json"
      };
      if (this.socket.accessTokenValue) {
        headers["Authorization"] = `Bearer ${this.socket.accessTokenValue}`;
      }
      const options = {
        method: "POST",
        headers,
        body: JSON.stringify({
          messages: [
            {
              topic: this.subTopic,
              event,
              payload: endpoint_payload,
              private: this.private
            }
          ]
        })
      };
      try {
        const response = await this._fetchWithTimeout(this.broadcastEndpointURL, options, (_a = opts.timeout) !== null && _a !== void 0 ? _a : this.timeout);
        await ((_b = response.body) === null || _b === void 0 ? void 0 : _b.cancel());
        return response.ok ? "ok" : "error";
      } catch (error) {
        if (error.name === "AbortError") {
          return "timed out";
        } else {
          return "error";
        }
      }
    } else {
      return new Promise((resolve) => {
        var _a2, _b2, _c;
        const push = this._push(args.type, args, opts.timeout || this.timeout);
        if (args.type === "broadcast" && !((_c = (_b2 = (_a2 = this.params) === null || _a2 === void 0 ? void 0 : _a2.config) === null || _b2 === void 0 ? void 0 : _b2.broadcast) === null || _c === void 0 ? void 0 : _c.ack)) {
          resolve("ok");
        }
        push.receive("ok", () => resolve("ok"));
        push.receive("error", () => resolve("error"));
        push.receive("timeout", () => resolve("timed out"));
      });
    }
  }
  /**
   * Updates the payload that will be sent the next time the channel joins (reconnects).
   * Useful for rotating access tokens or updating config without re-creating the channel.
   */
  updateJoinPayload(payload) {
    this.joinPush.updatePayload(payload);
  }
  /**
   * Leaves the channel.
   *
   * Unsubscribes from server events, and instructs channel to terminate on server.
   * Triggers onClose() hooks.
   *
   * To receive leave acknowledgements, use the a `receive` hook to bind to the server ack, ie:
   * channel.unsubscribe().receive("ok", () => alert("left!") )
   */
  unsubscribe(timeout = this.timeout) {
    this.state = CHANNEL_STATES.leaving;
    const onClose = () => {
      this.socket.log("channel", `leave ${this.topic}`);
      this._trigger(CHANNEL_EVENTS.close, "leave", this._joinRef());
    };
    this.joinPush.destroy();
    let leavePush = null;
    return new Promise((resolve) => {
      leavePush = new Push(this, CHANNEL_EVENTS.leave, {}, timeout);
      leavePush.receive("ok", () => {
        onClose();
        resolve("ok");
      }).receive("timeout", () => {
        onClose();
        resolve("timed out");
      }).receive("error", () => {
        resolve("error");
      });
      leavePush.send();
      if (!this._canPush()) {
        leavePush.trigger("ok", {});
      }
    }).finally(() => {
      leavePush === null || leavePush === void 0 ? void 0 : leavePush.destroy();
    });
  }
  /**
   * Teardown the channel.
   *
   * Destroys and stops related timers.
   */
  teardown() {
    this.pushBuffer.forEach((push) => push.destroy());
    this.pushBuffer = [];
    this.rejoinTimer.reset();
    this.joinPush.destroy();
    this.state = CHANNEL_STATES.closed;
    this.bindings = {};
  }
  /** @internal */
  async _fetchWithTimeout(url, options, timeout) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    const response = await this.socket.fetch(url, Object.assign(Object.assign({}, options), { signal: controller.signal }));
    clearTimeout(id);
    return response;
  }
  /** @internal */
  _push(event, payload, timeout = this.timeout) {
    if (!this.joinedOnce) {
      throw `tried to push '${event}' to '${this.topic}' before joining. Use channel.subscribe() before pushing events`;
    }
    let pushEvent = new Push(this, event, payload, timeout);
    if (this._canPush()) {
      pushEvent.send();
    } else {
      this._addToPushBuffer(pushEvent);
    }
    return pushEvent;
  }
  /** @internal */
  _addToPushBuffer(pushEvent) {
    pushEvent.startTimeout();
    this.pushBuffer.push(pushEvent);
    if (this.pushBuffer.length > MAX_PUSH_BUFFER_SIZE) {
      const removedPush = this.pushBuffer.shift();
      if (removedPush) {
        removedPush.destroy();
        this.socket.log("channel", `discarded push due to buffer overflow: ${removedPush.event}`, removedPush.payload);
      }
    }
  }
  /**
   * Overridable message hook
   *
   * Receives all events for specialized message handling before dispatching to the channel callbacks.
   * Must return the payload, modified or unmodified.
   *
   * @internal
   */
  _onMessage(_event, payload, _ref) {
    return payload;
  }
  /** @internal */
  _isMember(topic) {
    return this.topic === topic;
  }
  /** @internal */
  _joinRef() {
    return this.joinPush.ref;
  }
  /** @internal */
  _trigger(type, payload, ref) {
    var _a, _b;
    const typeLower = type.toLocaleLowerCase();
    const { close, error, leave, join } = CHANNEL_EVENTS;
    const events = [close, error, leave, join];
    if (ref && events.indexOf(typeLower) >= 0 && ref !== this._joinRef()) {
      return;
    }
    let handledPayload = this._onMessage(typeLower, payload, ref);
    if (payload && !handledPayload) {
      throw "channel onMessage callbacks must return the payload, modified or unmodified";
    }
    if (["insert", "update", "delete"].includes(typeLower)) {
      (_a = this.bindings.postgres_changes) === null || _a === void 0 ? void 0 : _a.filter((bind) => {
        var _a2, _b2, _c;
        return ((_a2 = bind.filter) === null || _a2 === void 0 ? void 0 : _a2.event) === "*" || ((_c = (_b2 = bind.filter) === null || _b2 === void 0 ? void 0 : _b2.event) === null || _c === void 0 ? void 0 : _c.toLocaleLowerCase()) === typeLower;
      }).map((bind) => bind.callback(handledPayload, ref));
    } else {
      (_b = this.bindings[typeLower]) === null || _b === void 0 ? void 0 : _b.filter((bind) => {
        var _a2, _b2, _c, _d, _e, _f;
        if (["broadcast", "presence", "postgres_changes"].includes(typeLower)) {
          if ("id" in bind) {
            const bindId = bind.id;
            const bindEvent = (_a2 = bind.filter) === null || _a2 === void 0 ? void 0 : _a2.event;
            return bindId && ((_b2 = payload.ids) === null || _b2 === void 0 ? void 0 : _b2.includes(bindId)) && (bindEvent === "*" || (bindEvent === null || bindEvent === void 0 ? void 0 : bindEvent.toLocaleLowerCase()) === ((_c = payload.data) === null || _c === void 0 ? void 0 : _c.type.toLocaleLowerCase()));
          } else {
            const bindEvent = (_e = (_d = bind === null || bind === void 0 ? void 0 : bind.filter) === null || _d === void 0 ? void 0 : _d.event) === null || _e === void 0 ? void 0 : _e.toLocaleLowerCase();
            return bindEvent === "*" || bindEvent === ((_f = payload === null || payload === void 0 ? void 0 : payload.event) === null || _f === void 0 ? void 0 : _f.toLocaleLowerCase());
          }
        } else {
          return bind.type.toLocaleLowerCase() === typeLower;
        }
      }).map((bind) => {
        if (typeof handledPayload === "object" && "ids" in handledPayload) {
          const postgresChanges = handledPayload.data;
          const { schema, table, commit_timestamp, type: type2, errors } = postgresChanges;
          const enrichedPayload = {
            schema,
            table,
            commit_timestamp,
            eventType: type2,
            new: {},
            old: {},
            errors
          };
          handledPayload = Object.assign(Object.assign({}, enrichedPayload), this._getPayloadRecords(postgresChanges));
        }
        bind.callback(handledPayload, ref);
      });
    }
  }
  /** @internal */
  _isClosed() {
    return this.state === CHANNEL_STATES.closed;
  }
  /** @internal */
  _isJoined() {
    return this.state === CHANNEL_STATES.joined;
  }
  /** @internal */
  _isJoining() {
    return this.state === CHANNEL_STATES.joining;
  }
  /** @internal */
  _isLeaving() {
    return this.state === CHANNEL_STATES.leaving;
  }
  /** @internal */
  _replyEventName(ref) {
    return `chan_reply_${ref}`;
  }
  /** @internal */
  _on(type, filter, callback) {
    const typeLower = type.toLocaleLowerCase();
    const binding = {
      type: typeLower,
      filter,
      callback
    };
    if (this.bindings[typeLower]) {
      this.bindings[typeLower].push(binding);
    } else {
      this.bindings[typeLower] = [binding];
    }
    return this;
  }
  /** @internal */
  _off(type, filter) {
    const typeLower = type.toLocaleLowerCase();
    if (this.bindings[typeLower]) {
      this.bindings[typeLower] = this.bindings[typeLower].filter((bind) => {
        var _a;
        return !(((_a = bind.type) === null || _a === void 0 ? void 0 : _a.toLocaleLowerCase()) === typeLower && _RealtimeChannel.isEqual(bind.filter, filter));
      });
    }
    return this;
  }
  /** @internal */
  static isEqual(obj1, obj2) {
    if (Object.keys(obj1).length !== Object.keys(obj2).length) {
      return false;
    }
    for (const k in obj1) {
      if (obj1[k] !== obj2[k]) {
        return false;
      }
    }
    return true;
  }
  /**
   * Compares two optional filter values for equality.
   * Treats undefined, null, and empty string as equivalent empty values.
   * @internal
   */
  static isFilterValueEqual(serverValue, clientValue) {
    const normalizedServer = serverValue !== null && serverValue !== void 0 ? serverValue : void 0;
    const normalizedClient = clientValue !== null && clientValue !== void 0 ? clientValue : void 0;
    return normalizedServer === normalizedClient;
  }
  /** @internal */
  _rejoinUntilConnected() {
    this.rejoinTimer.scheduleTimeout();
    if (this.socket.isConnected()) {
      this._rejoin();
    }
  }
  /**
   * Registers a callback that will be executed when the channel closes.
   *
   * @internal
   */
  _onClose(callback) {
    this._on(CHANNEL_EVENTS.close, {}, callback);
  }
  /**
   * Registers a callback that will be executed when the channel encounteres an error.
   *
   * @internal
   */
  _onError(callback) {
    this._on(CHANNEL_EVENTS.error, {}, (reason) => callback(reason));
  }
  /**
   * Returns `true` if the socket is connected and the channel has been joined.
   *
   * @internal
   */
  _canPush() {
    return this.socket.isConnected() && this._isJoined();
  }
  /** @internal */
  _rejoin(timeout = this.timeout) {
    if (this._isLeaving()) {
      return;
    }
    this.socket._leaveOpenTopic(this.topic);
    this.state = CHANNEL_STATES.joining;
    this.joinPush.resend(timeout);
  }
  /** @internal */
  _getPayloadRecords(payload) {
    const records = {
      new: {},
      old: {}
    };
    if (payload.type === "INSERT" || payload.type === "UPDATE") {
      records.new = convertChangeData(payload.columns, payload.record);
    }
    if (payload.type === "UPDATE" || payload.type === "DELETE") {
      records.old = convertChangeData(payload.columns, payload.old_record);
    }
    return records;
  }
};

// node_modules/@supabase/realtime-js/dist/module/RealtimeClient.js
var noop2 = () => {
};
var CONNECTION_TIMEOUTS = {
  HEARTBEAT_INTERVAL: 25e3,
  RECONNECT_DELAY: 10,
  HEARTBEAT_TIMEOUT_FALLBACK: 100
};
var RECONNECT_INTERVALS = [1e3, 2e3, 5e3, 1e4];
var DEFAULT_RECONNECT_FALLBACK = 1e4;
var WORKER_SCRIPT = `
  addEventListener("message", (e) => {
    if (e.data.event === "start") {
      setInterval(() => postMessage({ event: "keepAlive" }), e.data.interval);
    }
  });`;
var RealtimeClient = class {
  /**
   * Initializes the Socket.
   *
   * @param endPoint The string WebSocket endpoint, ie, "ws://example.com/socket", "wss://example.com", "/socket" (inherited host & protocol)
   * @param httpEndpoint The string HTTP endpoint, ie, "https://example.com", "/" (inherited host & protocol)
   * @param options.transport The Websocket Transport, for example WebSocket. This can be a custom implementation
   * @param options.timeout The default timeout in milliseconds to trigger push timeouts.
   * @param options.params The optional params to pass when connecting.
   * @param options.headers Deprecated: headers cannot be set on websocket connections and this option will be removed in the future.
   * @param options.heartbeatIntervalMs The millisec interval to send a heartbeat message.
   * @param options.heartbeatCallback The optional function to handle heartbeat status and latency.
   * @param options.logger The optional function for specialized logging, ie: logger: (kind, msg, data) => { console.log(`${kind}: ${msg}`, data) }
   * @param options.logLevel Sets the log level for Realtime
   * @param options.encode The function to encode outgoing messages. Defaults to JSON: (payload, callback) => callback(JSON.stringify(payload))
   * @param options.decode The function to decode incoming messages. Defaults to Serializer's decode.
   * @param options.reconnectAfterMs he optional function that returns the millsec reconnect interval. Defaults to stepped backoff off.
   * @param options.worker Use Web Worker to set a side flow. Defaults to false.
   * @param options.workerUrl The URL of the worker script. Defaults to https://realtime.supabase.com/worker.js that includes a heartbeat event call to keep the connection alive.
   * @param options.vsn The protocol version to use when connecting. Supported versions are "1.0.0" and "2.0.0". Defaults to "2.0.0".
   * @example
   * ```ts
   * import RealtimeClient from '@supabase/realtime-js'
   *
   * const client = new RealtimeClient('https://xyzcompany.supabase.co/realtime/v1', {
   *   params: { apikey: 'public-anon-key' },
   * })
   * client.connect()
   * ```
   */
  constructor(endPoint, options) {
    var _a;
    this.accessTokenValue = null;
    this.apiKey = null;
    this._manuallySetToken = false;
    this.channels = new Array();
    this.endPoint = "";
    this.httpEndpoint = "";
    this.headers = {};
    this.params = {};
    this.timeout = DEFAULT_TIMEOUT;
    this.transport = null;
    this.heartbeatIntervalMs = CONNECTION_TIMEOUTS.HEARTBEAT_INTERVAL;
    this.heartbeatTimer = void 0;
    this.pendingHeartbeatRef = null;
    this.heartbeatCallback = noop2;
    this.ref = 0;
    this.reconnectTimer = null;
    this.vsn = DEFAULT_VSN;
    this.logger = noop2;
    this.conn = null;
    this.sendBuffer = [];
    this.serializer = new Serializer();
    this.stateChangeCallbacks = {
      open: [],
      close: [],
      error: [],
      message: []
    };
    this.accessToken = null;
    this._connectionState = "disconnected";
    this._wasManualDisconnect = false;
    this._authPromise = null;
    this._heartbeatSentAt = null;
    this._resolveFetch = (customFetch) => {
      if (customFetch) {
        return (...args) => customFetch(...args);
      }
      return (...args) => fetch(...args);
    };
    if (!((_a = options === null || options === void 0 ? void 0 : options.params) === null || _a === void 0 ? void 0 : _a.apikey)) {
      throw new Error("API key is required to connect to Realtime");
    }
    this.apiKey = options.params.apikey;
    this.endPoint = `${endPoint}/${TRANSPORTS.websocket}`;
    this.httpEndpoint = httpEndpointURL(endPoint);
    this._initializeOptions(options);
    this._setupReconnectionTimer();
    this.fetch = this._resolveFetch(options === null || options === void 0 ? void 0 : options.fetch);
  }
  /**
   * Connects the socket, unless already connected.
   */
  connect() {
    if (this.isConnecting() || this.isDisconnecting() || this.conn !== null && this.isConnected()) {
      return;
    }
    this._setConnectionState("connecting");
    if (this.accessToken && !this._authPromise) {
      this._setAuthSafely("connect");
    }
    if (this.transport) {
      this.conn = new this.transport(this.endpointURL());
    } else {
      try {
        this.conn = websocket_factory_default.createWebSocket(this.endpointURL());
      } catch (error) {
        this._setConnectionState("disconnected");
        const errorMessage = error.message;
        if (errorMessage.includes("Node.js")) {
          throw new Error(`${errorMessage}

To use Realtime in Node.js, you need to provide a WebSocket implementation:

Option 1: Use Node.js 22+ which has native WebSocket support
Option 2: Install and provide the "ws" package:

  npm install ws

  import ws from "ws"
  const client = new RealtimeClient(url, {
    ...options,
    transport: ws
  })`);
        }
        throw new Error(`WebSocket not available: ${errorMessage}`);
      }
    }
    this._setupConnectionHandlers();
  }
  /**
   * Returns the URL of the websocket.
   * @returns string The URL of the websocket.
   */
  endpointURL() {
    return this._appendParams(this.endPoint, Object.assign({}, this.params, { vsn: this.vsn }));
  }
  /**
   * Disconnects the socket.
   *
   * @param code A numeric status code to send on disconnect.
   * @param reason A custom reason for the disconnect.
   */
  disconnect(code, reason) {
    if (this.isDisconnecting()) {
      return;
    }
    this._setConnectionState("disconnecting", true);
    if (this.conn) {
      const fallbackTimer = setTimeout(() => {
        this._setConnectionState("disconnected");
      }, 100);
      this.conn.onclose = () => {
        clearTimeout(fallbackTimer);
        this._setConnectionState("disconnected");
      };
      if (typeof this.conn.close === "function") {
        if (code) {
          this.conn.close(code, reason !== null && reason !== void 0 ? reason : "");
        } else {
          this.conn.close();
        }
      }
      this._teardownConnection();
    } else {
      this._setConnectionState("disconnected");
    }
  }
  /**
   * Returns all created channels
   */
  getChannels() {
    return this.channels;
  }
  /**
   * Unsubscribes and removes a single channel
   * @param channel A RealtimeChannel instance
   */
  async removeChannel(channel) {
    const status = await channel.unsubscribe();
    if (status === "ok") {
      this._remove(channel);
    }
    if (this.channels.length === 0) {
      this.disconnect();
    }
    return status;
  }
  /**
   * Unsubscribes and removes all channels
   */
  async removeAllChannels() {
    const values_1 = await Promise.all(this.channels.map((channel) => channel.unsubscribe()));
    this.channels = [];
    this.disconnect();
    return values_1;
  }
  /**
   * Logs the message.
   *
   * For customized logging, `this.logger` can be overridden.
   */
  log(kind, msg, data) {
    this.logger(kind, msg, data);
  }
  /**
   * Returns the current state of the socket.
   */
  connectionState() {
    switch (this.conn && this.conn.readyState) {
      case SOCKET_STATES.connecting:
        return CONNECTION_STATE.Connecting;
      case SOCKET_STATES.open:
        return CONNECTION_STATE.Open;
      case SOCKET_STATES.closing:
        return CONNECTION_STATE.Closing;
      default:
        return CONNECTION_STATE.Closed;
    }
  }
  /**
   * Returns `true` is the connection is open.
   */
  isConnected() {
    return this.connectionState() === CONNECTION_STATE.Open;
  }
  /**
   * Returns `true` if the connection is currently connecting.
   */
  isConnecting() {
    return this._connectionState === "connecting";
  }
  /**
   * Returns `true` if the connection is currently disconnecting.
   */
  isDisconnecting() {
    return this._connectionState === "disconnecting";
  }
  /**
   * Creates (or reuses) a {@link RealtimeChannel} for the provided topic.
   *
   * Topics are automatically prefixed with `realtime:` to match the Realtime service.
   * If a channel with the same topic already exists it will be returned instead of creating
   * a duplicate connection.
   */
  channel(topic, params = { config: {} }) {
    const realtimeTopic = `realtime:${topic}`;
    const exists = this.getChannels().find((c) => c.topic === realtimeTopic);
    if (!exists) {
      const chan = new RealtimeChannel(`realtime:${topic}`, params, this);
      this.channels.push(chan);
      return chan;
    } else {
      return exists;
    }
  }
  /**
   * Push out a message if the socket is connected.
   *
   * If the socket is not connected, the message gets enqueued within a local buffer, and sent out when a connection is next established.
   */
  push(data) {
    const { topic, event, payload, ref } = data;
    const callback = () => {
      this.encode(data, (result) => {
        var _a;
        (_a = this.conn) === null || _a === void 0 ? void 0 : _a.send(result);
      });
    };
    this.log("push", `${topic} ${event} (${ref})`, payload);
    if (this.isConnected()) {
      callback();
    } else {
      this.sendBuffer.push(callback);
    }
  }
  /**
   * Sets the JWT access token used for channel subscription authorization and Realtime RLS.
   *
   * If param is null it will use the `accessToken` callback function or the token set on the client.
   *
   * On callback used, it will set the value of the token internal to the client.
   *
   * When a token is explicitly provided, it will be preserved across channel operations
   * (including removeChannel and resubscribe). The `accessToken` callback will not be
   * invoked until `setAuth()` is called without arguments.
   *
   * @param token A JWT string to override the token set on the client.
   *
   * @example
   * // Use a manual token (preserved across resubscribes, ignores accessToken callback)
   * client.realtime.setAuth('my-custom-jwt')
   *
   * // Switch back to using the accessToken callback
   * client.realtime.setAuth()
   */
  async setAuth(token = null) {
    this._authPromise = this._performAuth(token);
    try {
      await this._authPromise;
    } finally {
      this._authPromise = null;
    }
  }
  /**
   * Returns true if the current access token was explicitly set via setAuth(token),
   * false if it was obtained via the accessToken callback.
   * @internal
   */
  _isManualToken() {
    return this._manuallySetToken;
  }
  /**
   * Sends a heartbeat message if the socket is connected.
   */
  async sendHeartbeat() {
    var _a;
    if (!this.isConnected()) {
      try {
        this.heartbeatCallback("disconnected");
      } catch (e) {
        this.log("error", "error in heartbeat callback", e);
      }
      return;
    }
    if (this.pendingHeartbeatRef) {
      this.pendingHeartbeatRef = null;
      this._heartbeatSentAt = null;
      this.log("transport", "heartbeat timeout. Attempting to re-establish connection");
      try {
        this.heartbeatCallback("timeout");
      } catch (e) {
        this.log("error", "error in heartbeat callback", e);
      }
      this._wasManualDisconnect = false;
      (_a = this.conn) === null || _a === void 0 ? void 0 : _a.close(WS_CLOSE_NORMAL, "heartbeat timeout");
      setTimeout(() => {
        var _a2;
        if (!this.isConnected()) {
          (_a2 = this.reconnectTimer) === null || _a2 === void 0 ? void 0 : _a2.scheduleTimeout();
        }
      }, CONNECTION_TIMEOUTS.HEARTBEAT_TIMEOUT_FALLBACK);
      return;
    }
    this._heartbeatSentAt = Date.now();
    this.pendingHeartbeatRef = this._makeRef();
    this.push({
      topic: "phoenix",
      event: "heartbeat",
      payload: {},
      ref: this.pendingHeartbeatRef
    });
    try {
      this.heartbeatCallback("sent");
    } catch (e) {
      this.log("error", "error in heartbeat callback", e);
    }
    this._setAuthSafely("heartbeat");
  }
  /**
   * Sets a callback that receives lifecycle events for internal heartbeat messages.
   * Useful for instrumenting connection health (e.g. sent/ok/timeout/disconnected).
   */
  onHeartbeat(callback) {
    this.heartbeatCallback = callback;
  }
  /**
   * Flushes send buffer
   */
  flushSendBuffer() {
    if (this.isConnected() && this.sendBuffer.length > 0) {
      this.sendBuffer.forEach((callback) => callback());
      this.sendBuffer = [];
    }
  }
  /**
   * Return the next message ref, accounting for overflows
   *
   * @internal
   */
  _makeRef() {
    let newRef = this.ref + 1;
    if (newRef === this.ref) {
      this.ref = 0;
    } else {
      this.ref = newRef;
    }
    return this.ref.toString();
  }
  /**
   * Unsubscribe from channels with the specified topic.
   *
   * @internal
   */
  _leaveOpenTopic(topic) {
    let dupChannel = this.channels.find((c) => c.topic === topic && (c._isJoined() || c._isJoining()));
    if (dupChannel) {
      this.log("transport", `leaving duplicate topic "${topic}"`);
      dupChannel.unsubscribe();
    }
  }
  /**
   * Removes a subscription from the socket.
   *
   * @param channel An open subscription.
   *
   * @internal
   */
  _remove(channel) {
    this.channels = this.channels.filter((c) => c.topic !== channel.topic);
  }
  /** @internal */
  _onConnMessage(rawMessage) {
    this.decode(rawMessage.data, (msg) => {
      if (msg.topic === "phoenix" && msg.event === "phx_reply" && msg.ref && msg.ref === this.pendingHeartbeatRef) {
        const latency = this._heartbeatSentAt ? Date.now() - this._heartbeatSentAt : void 0;
        try {
          this.heartbeatCallback(msg.payload.status === "ok" ? "ok" : "error", latency);
        } catch (e) {
          this.log("error", "error in heartbeat callback", e);
        }
        this._heartbeatSentAt = null;
        this.pendingHeartbeatRef = null;
      }
      const { topic, event, payload, ref } = msg;
      const refString = ref ? `(${ref})` : "";
      const status = payload.status || "";
      this.log("receive", `${status} ${topic} ${event} ${refString}`.trim(), payload);
      this.channels.filter((channel) => channel._isMember(topic)).forEach((channel) => channel._trigger(event, payload, ref));
      this._triggerStateCallbacks("message", msg);
    });
  }
  /**
   * Clear specific timer
   * @internal
   */
  _clearTimer(timer) {
    var _a;
    if (timer === "heartbeat" && this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = void 0;
    } else if (timer === "reconnect") {
      (_a = this.reconnectTimer) === null || _a === void 0 ? void 0 : _a.reset();
    }
  }
  /**
   * Clear all timers
   * @internal
   */
  _clearAllTimers() {
    this._clearTimer("heartbeat");
    this._clearTimer("reconnect");
  }
  /**
   * Setup connection handlers for WebSocket events
   * @internal
   */
  _setupConnectionHandlers() {
    if (!this.conn)
      return;
    if ("binaryType" in this.conn) {
      ;
      this.conn.binaryType = "arraybuffer";
    }
    this.conn.onopen = () => this._onConnOpen();
    this.conn.onerror = (error) => this._onConnError(error);
    this.conn.onmessage = (event) => this._onConnMessage(event);
    this.conn.onclose = (event) => this._onConnClose(event);
    if (this.conn.readyState === SOCKET_STATES.open) {
      this._onConnOpen();
    }
  }
  /**
   * Teardown connection and cleanup resources
   * @internal
   */
  _teardownConnection() {
    if (this.conn) {
      if (this.conn.readyState === SOCKET_STATES.open || this.conn.readyState === SOCKET_STATES.connecting) {
        try {
          this.conn.close();
        } catch (e) {
          this.log("error", "Error closing connection", e);
        }
      }
      this.conn.onopen = null;
      this.conn.onerror = null;
      this.conn.onmessage = null;
      this.conn.onclose = null;
      this.conn = null;
    }
    this._clearAllTimers();
    this._terminateWorker();
    this.channels.forEach((channel) => channel.teardown());
  }
  /** @internal */
  _onConnOpen() {
    this._setConnectionState("connected");
    this.log("transport", `connected to ${this.endpointURL()}`);
    const authPromise = this._authPromise || (this.accessToken && !this.accessTokenValue ? this.setAuth() : Promise.resolve());
    authPromise.then(() => {
      this.flushSendBuffer();
    }).catch((e) => {
      this.log("error", "error waiting for auth on connect", e);
      this.flushSendBuffer();
    });
    this._clearTimer("reconnect");
    if (!this.worker) {
      this._startHeartbeat();
    } else {
      if (!this.workerRef) {
        this._startWorkerHeartbeat();
      }
    }
    this._triggerStateCallbacks("open");
  }
  /** @internal */
  _startHeartbeat() {
    this.heartbeatTimer && clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = setInterval(() => this.sendHeartbeat(), this.heartbeatIntervalMs);
  }
  /** @internal */
  _startWorkerHeartbeat() {
    if (this.workerUrl) {
      this.log("worker", `starting worker for from ${this.workerUrl}`);
    } else {
      this.log("worker", `starting default worker`);
    }
    const objectUrl = this._workerObjectUrl(this.workerUrl);
    this.workerRef = new Worker(objectUrl);
    this.workerRef.onerror = (error) => {
      this.log("worker", "worker error", error.message);
      this._terminateWorker();
    };
    this.workerRef.onmessage = (event) => {
      if (event.data.event === "keepAlive") {
        this.sendHeartbeat();
      }
    };
    this.workerRef.postMessage({
      event: "start",
      interval: this.heartbeatIntervalMs
    });
  }
  /**
   * Terminate the Web Worker and clear the reference
   * @internal
   */
  _terminateWorker() {
    if (this.workerRef) {
      this.log("worker", "terminating worker");
      this.workerRef.terminate();
      this.workerRef = void 0;
    }
  }
  /** @internal */
  _onConnClose(event) {
    var _a;
    this._setConnectionState("disconnected");
    this.log("transport", "close", event);
    this._triggerChanError();
    this._clearTimer("heartbeat");
    if (!this._wasManualDisconnect) {
      (_a = this.reconnectTimer) === null || _a === void 0 ? void 0 : _a.scheduleTimeout();
    }
    this._triggerStateCallbacks("close", event);
  }
  /** @internal */
  _onConnError(error) {
    this._setConnectionState("disconnected");
    this.log("transport", `${error}`);
    this._triggerChanError();
    this._triggerStateCallbacks("error", error);
    try {
      this.heartbeatCallback("error");
    } catch (e) {
      this.log("error", "error in heartbeat callback", e);
    }
  }
  /** @internal */
  _triggerChanError() {
    this.channels.forEach((channel) => channel._trigger(CHANNEL_EVENTS.error));
  }
  /** @internal */
  _appendParams(url, params) {
    if (Object.keys(params).length === 0) {
      return url;
    }
    const prefix = url.match(/\?/) ? "&" : "?";
    const query = new URLSearchParams(params);
    return `${url}${prefix}${query}`;
  }
  _workerObjectUrl(url) {
    let result_url;
    if (url) {
      result_url = url;
    } else {
      const blob = new Blob([WORKER_SCRIPT], { type: "application/javascript" });
      result_url = URL.createObjectURL(blob);
    }
    return result_url;
  }
  /**
   * Set connection state with proper state management
   * @internal
   */
  _setConnectionState(state, manual = false) {
    this._connectionState = state;
    if (state === "connecting") {
      this._wasManualDisconnect = false;
    } else if (state === "disconnecting") {
      this._wasManualDisconnect = manual;
    }
  }
  /**
   * Perform the actual auth operation
   * @internal
   */
  async _performAuth(token = null) {
    let tokenToSend;
    let isManualToken = false;
    if (token) {
      tokenToSend = token;
      isManualToken = true;
    } else if (this.accessToken) {
      try {
        tokenToSend = await this.accessToken();
      } catch (e) {
        this.log("error", "Error fetching access token from callback", e);
        tokenToSend = this.accessTokenValue;
      }
    } else {
      tokenToSend = this.accessTokenValue;
    }
    if (isManualToken) {
      this._manuallySetToken = true;
    } else if (this.accessToken) {
      this._manuallySetToken = false;
    }
    if (this.accessTokenValue != tokenToSend) {
      this.accessTokenValue = tokenToSend;
      this.channels.forEach((channel) => {
        const payload = {
          access_token: tokenToSend,
          version: DEFAULT_VERSION
        };
        tokenToSend && channel.updateJoinPayload(payload);
        if (channel.joinedOnce && channel._isJoined()) {
          channel._push(CHANNEL_EVENTS.access_token, {
            access_token: tokenToSend
          });
        }
      });
    }
  }
  /**
   * Wait for any in-flight auth operations to complete
   * @internal
   */
  async _waitForAuthIfNeeded() {
    if (this._authPromise) {
      await this._authPromise;
    }
  }
  /**
   * Safely call setAuth with standardized error handling
   * @internal
   */
  _setAuthSafely(context = "general") {
    if (!this._isManualToken()) {
      this.setAuth().catch((e) => {
        this.log("error", `Error setting auth in ${context}`, e);
      });
    }
  }
  /**
   * Trigger state change callbacks with proper error handling
   * @internal
   */
  _triggerStateCallbacks(event, data) {
    try {
      this.stateChangeCallbacks[event].forEach((callback) => {
        try {
          callback(data);
        } catch (e) {
          this.log("error", `error in ${event} callback`, e);
        }
      });
    } catch (e) {
      this.log("error", `error triggering ${event} callbacks`, e);
    }
  }
  /**
   * Setup reconnection timer with proper configuration
   * @internal
   */
  _setupReconnectionTimer() {
    this.reconnectTimer = new Timer(async () => {
      setTimeout(async () => {
        await this._waitForAuthIfNeeded();
        if (!this.isConnected()) {
          this.connect();
        }
      }, CONNECTION_TIMEOUTS.RECONNECT_DELAY);
    }, this.reconnectAfterMs);
  }
  /**
   * Initialize client options with defaults
   * @internal
   */
  _initializeOptions(options) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m;
    this.transport = (_a = options === null || options === void 0 ? void 0 : options.transport) !== null && _a !== void 0 ? _a : null;
    this.timeout = (_b = options === null || options === void 0 ? void 0 : options.timeout) !== null && _b !== void 0 ? _b : DEFAULT_TIMEOUT;
    this.heartbeatIntervalMs = (_c = options === null || options === void 0 ? void 0 : options.heartbeatIntervalMs) !== null && _c !== void 0 ? _c : CONNECTION_TIMEOUTS.HEARTBEAT_INTERVAL;
    this.worker = (_d = options === null || options === void 0 ? void 0 : options.worker) !== null && _d !== void 0 ? _d : false;
    this.accessToken = (_e = options === null || options === void 0 ? void 0 : options.accessToken) !== null && _e !== void 0 ? _e : null;
    this.heartbeatCallback = (_f = options === null || options === void 0 ? void 0 : options.heartbeatCallback) !== null && _f !== void 0 ? _f : noop2;
    this.vsn = (_g = options === null || options === void 0 ? void 0 : options.vsn) !== null && _g !== void 0 ? _g : DEFAULT_VSN;
    if (options === null || options === void 0 ? void 0 : options.params)
      this.params = options.params;
    if (options === null || options === void 0 ? void 0 : options.logger)
      this.logger = options.logger;
    if ((options === null || options === void 0 ? void 0 : options.logLevel) || (options === null || options === void 0 ? void 0 : options.log_level)) {
      this.logLevel = options.logLevel || options.log_level;
      this.params = Object.assign(Object.assign({}, this.params), { log_level: this.logLevel });
    }
    this.reconnectAfterMs = (_h = options === null || options === void 0 ? void 0 : options.reconnectAfterMs) !== null && _h !== void 0 ? _h : (tries) => {
      return RECONNECT_INTERVALS[tries - 1] || DEFAULT_RECONNECT_FALLBACK;
    };
    switch (this.vsn) {
      case VSN_1_0_0:
        this.encode = (_j = options === null || options === void 0 ? void 0 : options.encode) !== null && _j !== void 0 ? _j : (payload, callback) => {
          return callback(JSON.stringify(payload));
        };
        this.decode = (_k = options === null || options === void 0 ? void 0 : options.decode) !== null && _k !== void 0 ? _k : (payload, callback) => {
          return callback(JSON.parse(payload));
        };
        break;
      case VSN_2_0_0:
        this.encode = (_l = options === null || options === void 0 ? void 0 : options.encode) !== null && _l !== void 0 ? _l : this.serializer.encode.bind(this.serializer);
        this.decode = (_m = options === null || options === void 0 ? void 0 : options.decode) !== null && _m !== void 0 ? _m : this.serializer.decode.bind(this.serializer);
        break;
      default:
        throw new Error(`Unsupported serializer version: ${this.vsn}`);
    }
    if (this.worker) {
      if (typeof window !== "undefined" && !window.Worker) {
        throw new Error("Web Worker is not supported");
      }
      this.workerUrl = options === null || options === void 0 ? void 0 : options.workerUrl;
    }
  }
};

// node_modules/iceberg-js/dist/index.mjs
var IcebergError = class extends Error {
  constructor(message, opts) {
    super(message);
    this.name = "IcebergError";
    this.status = opts.status;
    this.icebergType = opts.icebergType;
    this.icebergCode = opts.icebergCode;
    this.details = opts.details;
    this.isCommitStateUnknown = opts.icebergType === "CommitStateUnknownException" || [500, 502, 504].includes(opts.status) && opts.icebergType?.includes("CommitState") === true;
  }
  /**
   * Returns true if the error is a 404 Not Found error.
   */
  isNotFound() {
    return this.status === 404;
  }
  /**
   * Returns true if the error is a 409 Conflict error.
   */
  isConflict() {
    return this.status === 409;
  }
  /**
   * Returns true if the error is a 419 Authentication Timeout error.
   */
  isAuthenticationTimeout() {
    return this.status === 419;
  }
};
function buildUrl(baseUrl, path, query) {
  const url = new URL(path, baseUrl);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== void 0) {
        url.searchParams.set(key, value);
      }
    }
  }
  return url.toString();
}
async function buildAuthHeaders(auth) {
  if (!auth || auth.type === "none") {
    return {};
  }
  if (auth.type === "bearer") {
    return { Authorization: `Bearer ${auth.token}` };
  }
  if (auth.type === "header") {
    return { [auth.name]: auth.value };
  }
  if (auth.type === "custom") {
    return await auth.getHeaders();
  }
  return {};
}
function createFetchClient(options) {
  const fetchFn = options.fetchImpl ?? globalThis.fetch;
  return {
    async request({
      method,
      path,
      query,
      body,
      headers
    }) {
      const url = buildUrl(options.baseUrl, path, query);
      const authHeaders = await buildAuthHeaders(options.auth);
      const res = await fetchFn(url, {
        method,
        headers: {
          ...body ? { "Content-Type": "application/json" } : {},
          ...authHeaders,
          ...headers
        },
        body: body ? JSON.stringify(body) : void 0
      });
      const text = await res.text();
      const isJson = (res.headers.get("content-type") || "").includes("application/json");
      const data = isJson && text ? JSON.parse(text) : text;
      if (!res.ok) {
        const errBody = isJson ? data : void 0;
        const errorDetail = errBody?.error;
        throw new IcebergError(
          errorDetail?.message ?? `Request failed with status ${res.status}`,
          {
            status: res.status,
            icebergType: errorDetail?.type,
            icebergCode: errorDetail?.code,
            details: errBody
          }
        );
      }
      return { status: res.status, headers: res.headers, data };
    }
  };
}
function namespaceToPath(namespace) {
  return namespace.join("");
}
var NamespaceOperations = class {
  constructor(client, prefix = "") {
    this.client = client;
    this.prefix = prefix;
  }
  async listNamespaces(parent) {
    const query = parent ? { parent: namespaceToPath(parent.namespace) } : void 0;
    const response = await this.client.request({
      method: "GET",
      path: `${this.prefix}/namespaces`,
      query
    });
    return response.data.namespaces.map((ns) => ({ namespace: ns }));
  }
  async createNamespace(id, metadata) {
    const request = {
      namespace: id.namespace,
      properties: metadata?.properties
    };
    const response = await this.client.request({
      method: "POST",
      path: `${this.prefix}/namespaces`,
      body: request
    });
    return response.data;
  }
  async dropNamespace(id) {
    await this.client.request({
      method: "DELETE",
      path: `${this.prefix}/namespaces/${namespaceToPath(id.namespace)}`
    });
  }
  async loadNamespaceMetadata(id) {
    const response = await this.client.request({
      method: "GET",
      path: `${this.prefix}/namespaces/${namespaceToPath(id.namespace)}`
    });
    return {
      properties: response.data.properties
    };
  }
  async namespaceExists(id) {
    try {
      await this.client.request({
        method: "HEAD",
        path: `${this.prefix}/namespaces/${namespaceToPath(id.namespace)}`
      });
      return true;
    } catch (error) {
      if (error instanceof IcebergError && error.status === 404) {
        return false;
      }
      throw error;
    }
  }
  async createNamespaceIfNotExists(id, metadata) {
    try {
      return await this.createNamespace(id, metadata);
    } catch (error) {
      if (error instanceof IcebergError && error.status === 409) {
        return;
      }
      throw error;
    }
  }
};
function namespaceToPath2(namespace) {
  return namespace.join("");
}
var TableOperations = class {
  constructor(client, prefix = "", accessDelegation) {
    this.client = client;
    this.prefix = prefix;
    this.accessDelegation = accessDelegation;
  }
  async listTables(namespace) {
    const response = await this.client.request({
      method: "GET",
      path: `${this.prefix}/namespaces/${namespaceToPath2(namespace.namespace)}/tables`
    });
    return response.data.identifiers;
  }
  async createTable(namespace, request) {
    const headers = {};
    if (this.accessDelegation) {
      headers["X-Iceberg-Access-Delegation"] = this.accessDelegation;
    }
    const response = await this.client.request({
      method: "POST",
      path: `${this.prefix}/namespaces/${namespaceToPath2(namespace.namespace)}/tables`,
      body: request,
      headers
    });
    return response.data.metadata;
  }
  async updateTable(id, request) {
    const response = await this.client.request({
      method: "POST",
      path: `${this.prefix}/namespaces/${namespaceToPath2(id.namespace)}/tables/${id.name}`,
      body: request
    });
    return {
      "metadata-location": response.data["metadata-location"],
      metadata: response.data.metadata
    };
  }
  async dropTable(id, options) {
    await this.client.request({
      method: "DELETE",
      path: `${this.prefix}/namespaces/${namespaceToPath2(id.namespace)}/tables/${id.name}`,
      query: { purgeRequested: String(options?.purge ?? false) }
    });
  }
  async loadTable(id) {
    const headers = {};
    if (this.accessDelegation) {
      headers["X-Iceberg-Access-Delegation"] = this.accessDelegation;
    }
    const response = await this.client.request({
      method: "GET",
      path: `${this.prefix}/namespaces/${namespaceToPath2(id.namespace)}/tables/${id.name}`,
      headers
    });
    return response.data.metadata;
  }
  async tableExists(id) {
    const headers = {};
    if (this.accessDelegation) {
      headers["X-Iceberg-Access-Delegation"] = this.accessDelegation;
    }
    try {
      await this.client.request({
        method: "HEAD",
        path: `${this.prefix}/namespaces/${namespaceToPath2(id.namespace)}/tables/${id.name}`,
        headers
      });
      return true;
    } catch (error) {
      if (error instanceof IcebergError && error.status === 404) {
        return false;
      }
      throw error;
    }
  }
  async createTableIfNotExists(namespace, request) {
    try {
      return await this.createTable(namespace, request);
    } catch (error) {
      if (error instanceof IcebergError && error.status === 409) {
        return await this.loadTable({ namespace: namespace.namespace, name: request.name });
      }
      throw error;
    }
  }
};
var IcebergRestCatalog = class {
  /**
   * Creates a new Iceberg REST Catalog client.
   *
   * @param options - Configuration options for the catalog client
   */
  constructor(options) {
    let prefix = "v1";
    if (options.catalogName) {
      prefix += `/${options.catalogName}`;
    }
    const baseUrl = options.baseUrl.endsWith("/") ? options.baseUrl : `${options.baseUrl}/`;
    this.client = createFetchClient({
      baseUrl,
      auth: options.auth,
      fetchImpl: options.fetch
    });
    this.accessDelegation = options.accessDelegation?.join(",");
    this.namespaceOps = new NamespaceOperations(this.client, prefix);
    this.tableOps = new TableOperations(this.client, prefix, this.accessDelegation);
  }
  /**
   * Lists all namespaces in the catalog.
   *
   * @param parent - Optional parent namespace to list children under
   * @returns Array of namespace identifiers
   *
   * @example
   * ```typescript
   * // List all top-level namespaces
   * const namespaces = await catalog.listNamespaces();
   *
   * // List namespaces under a parent
   * const children = await catalog.listNamespaces({ namespace: ['analytics'] });
   * ```
   */
  async listNamespaces(parent) {
    return this.namespaceOps.listNamespaces(parent);
  }
  /**
   * Creates a new namespace in the catalog.
   *
   * @param id - Namespace identifier to create
   * @param metadata - Optional metadata properties for the namespace
   * @returns Response containing the created namespace and its properties
   *
   * @example
   * ```typescript
   * const response = await catalog.createNamespace(
   *   { namespace: ['analytics'] },
   *   { properties: { owner: 'data-team' } }
   * );
   * console.log(response.namespace); // ['analytics']
   * console.log(response.properties); // { owner: 'data-team', ... }
   * ```
   */
  async createNamespace(id, metadata) {
    return this.namespaceOps.createNamespace(id, metadata);
  }
  /**
   * Drops a namespace from the catalog.
   *
   * The namespace must be empty (contain no tables) before it can be dropped.
   *
   * @param id - Namespace identifier to drop
   *
   * @example
   * ```typescript
   * await catalog.dropNamespace({ namespace: ['analytics'] });
   * ```
   */
  async dropNamespace(id) {
    await this.namespaceOps.dropNamespace(id);
  }
  /**
   * Loads metadata for a namespace.
   *
   * @param id - Namespace identifier to load
   * @returns Namespace metadata including properties
   *
   * @example
   * ```typescript
   * const metadata = await catalog.loadNamespaceMetadata({ namespace: ['analytics'] });
   * console.log(metadata.properties);
   * ```
   */
  async loadNamespaceMetadata(id) {
    return this.namespaceOps.loadNamespaceMetadata(id);
  }
  /**
   * Lists all tables in a namespace.
   *
   * @param namespace - Namespace identifier to list tables from
   * @returns Array of table identifiers
   *
   * @example
   * ```typescript
   * const tables = await catalog.listTables({ namespace: ['analytics'] });
   * console.log(tables); // [{ namespace: ['analytics'], name: 'events' }, ...]
   * ```
   */
  async listTables(namespace) {
    return this.tableOps.listTables(namespace);
  }
  /**
   * Creates a new table in the catalog.
   *
   * @param namespace - Namespace to create the table in
   * @param request - Table creation request including name, schema, partition spec, etc.
   * @returns Table metadata for the created table
   *
   * @example
   * ```typescript
   * const metadata = await catalog.createTable(
   *   { namespace: ['analytics'] },
   *   {
   *     name: 'events',
   *     schema: {
   *       type: 'struct',
   *       fields: [
   *         { id: 1, name: 'id', type: 'long', required: true },
   *         { id: 2, name: 'timestamp', type: 'timestamp', required: true }
   *       ],
   *       'schema-id': 0
   *     },
   *     'partition-spec': {
   *       'spec-id': 0,
   *       fields: [
   *         { source_id: 2, field_id: 1000, name: 'ts_day', transform: 'day' }
   *       ]
   *     }
   *   }
   * );
   * ```
   */
  async createTable(namespace, request) {
    return this.tableOps.createTable(namespace, request);
  }
  /**
   * Updates an existing table's metadata.
   *
   * Can update the schema, partition spec, or properties of a table.
   *
   * @param id - Table identifier to update
   * @param request - Update request with fields to modify
   * @returns Response containing the metadata location and updated table metadata
   *
   * @example
   * ```typescript
   * const response = await catalog.updateTable(
   *   { namespace: ['analytics'], name: 'events' },
   *   {
   *     properties: { 'read.split.target-size': '134217728' }
   *   }
   * );
   * console.log(response['metadata-location']); // s3://...
   * console.log(response.metadata); // TableMetadata object
   * ```
   */
  async updateTable(id, request) {
    return this.tableOps.updateTable(id, request);
  }
  /**
   * Drops a table from the catalog.
   *
   * @param id - Table identifier to drop
   *
   * @example
   * ```typescript
   * await catalog.dropTable({ namespace: ['analytics'], name: 'events' });
   * ```
   */
  async dropTable(id, options) {
    await this.tableOps.dropTable(id, options);
  }
  /**
   * Loads metadata for a table.
   *
   * @param id - Table identifier to load
   * @returns Table metadata including schema, partition spec, location, etc.
   *
   * @example
   * ```typescript
   * const metadata = await catalog.loadTable({ namespace: ['analytics'], name: 'events' });
   * console.log(metadata.schema);
   * console.log(metadata.location);
   * ```
   */
  async loadTable(id) {
    return this.tableOps.loadTable(id);
  }
  /**
   * Checks if a namespace exists in the catalog.
   *
   * @param id - Namespace identifier to check
   * @returns True if the namespace exists, false otherwise
   *
   * @example
   * ```typescript
   * const exists = await catalog.namespaceExists({ namespace: ['analytics'] });
   * console.log(exists); // true or false
   * ```
   */
  async namespaceExists(id) {
    return this.namespaceOps.namespaceExists(id);
  }
  /**
   * Checks if a table exists in the catalog.
   *
   * @param id - Table identifier to check
   * @returns True if the table exists, false otherwise
   *
   * @example
   * ```typescript
   * const exists = await catalog.tableExists({ namespace: ['analytics'], name: 'events' });
   * console.log(exists); // true or false
   * ```
   */
  async tableExists(id) {
    return this.tableOps.tableExists(id);
  }
  /**
   * Creates a namespace if it does not exist.
   *
   * If the namespace already exists, returns void. If created, returns the response.
   *
   * @param id - Namespace identifier to create
   * @param metadata - Optional metadata properties for the namespace
   * @returns Response containing the created namespace and its properties, or void if it already exists
   *
   * @example
   * ```typescript
   * const response = await catalog.createNamespaceIfNotExists(
   *   { namespace: ['analytics'] },
   *   { properties: { owner: 'data-team' } }
   * );
   * if (response) {
   *   console.log('Created:', response.namespace);
   * } else {
   *   console.log('Already exists');
   * }
   * ```
   */
  async createNamespaceIfNotExists(id, metadata) {
    return this.namespaceOps.createNamespaceIfNotExists(id, metadata);
  }
  /**
   * Creates a table if it does not exist.
   *
   * If the table already exists, returns its metadata instead.
   *
   * @param namespace - Namespace to create the table in
   * @param request - Table creation request including name, schema, partition spec, etc.
   * @returns Table metadata for the created or existing table
   *
   * @example
   * ```typescript
   * const metadata = await catalog.createTableIfNotExists(
   *   { namespace: ['analytics'] },
   *   {
   *     name: 'events',
   *     schema: {
   *       type: 'struct',
   *       fields: [
   *         { id: 1, name: 'id', type: 'long', required: true },
   *         { id: 2, name: 'timestamp', type: 'timestamp', required: true }
   *       ],
   *       'schema-id': 0
   *     }
   *   }
   * );
   * ```
   */
  async createTableIfNotExists(namespace, request) {
    return this.tableOps.createTableIfNotExists(namespace, request);
  }
};

// node_modules/@supabase/storage-js/dist/index.mjs
var StorageError = class extends Error {
  constructor(message, namespace = "storage", status, statusCode) {
    super(message);
    this.__isStorageError = true;
    this.namespace = namespace;
    this.name = namespace === "vectors" ? "StorageVectorsError" : "StorageError";
    this.status = status;
    this.statusCode = statusCode;
  }
};
function isStorageError(error) {
  return typeof error === "object" && error !== null && "__isStorageError" in error;
}
var StorageApiError = class extends StorageError {
  constructor(message, status, statusCode, namespace = "storage") {
    super(message, namespace, status, statusCode);
    this.name = namespace === "vectors" ? "StorageVectorsApiError" : "StorageApiError";
    this.status = status;
    this.statusCode = statusCode;
  }
  toJSON() {
    return {
      name: this.name,
      message: this.message,
      status: this.status,
      statusCode: this.statusCode
    };
  }
};
var StorageUnknownError = class extends StorageError {
  constructor(message, originalError, namespace = "storage") {
    super(message, namespace);
    this.name = namespace === "vectors" ? "StorageVectorsUnknownError" : "StorageUnknownError";
    this.originalError = originalError;
  }
};
var resolveFetch2 = (customFetch) => {
  if (customFetch) return (...args) => customFetch(...args);
  return (...args) => fetch(...args);
};
var isPlainObject = (value) => {
  if (typeof value !== "object" || value === null) return false;
  const prototype = Object.getPrototypeOf(value);
  return (prototype === null || prototype === Object.prototype || Object.getPrototypeOf(prototype) === null) && !(Symbol.toStringTag in value) && !(Symbol.iterator in value);
};
var recursiveToCamel = (item) => {
  if (Array.isArray(item)) return item.map((el) => recursiveToCamel(el));
  else if (typeof item === "function" || item !== Object(item)) return item;
  const result = {};
  Object.entries(item).forEach(([key, value]) => {
    const newKey = key.replace(/([-_][a-z])/gi, (c) => c.toUpperCase().replace(/[-_]/g, ""));
    result[newKey] = recursiveToCamel(value);
  });
  return result;
};
var isValidBucketName = (bucketName) => {
  if (!bucketName || typeof bucketName !== "string") return false;
  if (bucketName.length === 0 || bucketName.length > 100) return false;
  if (bucketName.trim() !== bucketName) return false;
  if (bucketName.includes("/") || bucketName.includes("\\")) return false;
  return /^[\w!.\*'() &$@=;:+,?-]+$/.test(bucketName);
};
function _typeof2(o) {
  "@babel/helpers - typeof";
  return _typeof2 = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function(o$1) {
    return typeof o$1;
  } : function(o$1) {
    return o$1 && "function" == typeof Symbol && o$1.constructor === Symbol && o$1 !== Symbol.prototype ? "symbol" : typeof o$1;
  }, _typeof2(o);
}
function toPrimitive2(t2, r) {
  if ("object" != _typeof2(t2) || !t2) return t2;
  var e = t2[Symbol.toPrimitive];
  if (void 0 !== e) {
    var i = e.call(t2, r || "default");
    if ("object" != _typeof2(i)) return i;
    throw new TypeError("@@toPrimitive must return a primitive value.");
  }
  return ("string" === r ? String : Number)(t2);
}
function toPropertyKey2(t2) {
  var i = toPrimitive2(t2, "string");
  return "symbol" == _typeof2(i) ? i : i + "";
}
function _defineProperty2(e, r, t2) {
  return (r = toPropertyKey2(r)) in e ? Object.defineProperty(e, r, {
    value: t2,
    enumerable: true,
    configurable: true,
    writable: true
  }) : e[r] = t2, e;
}
function ownKeys2(e, r) {
  var t2 = Object.keys(e);
  if (Object.getOwnPropertySymbols) {
    var o = Object.getOwnPropertySymbols(e);
    r && (o = o.filter(function(r$1) {
      return Object.getOwnPropertyDescriptor(e, r$1).enumerable;
    })), t2.push.apply(t2, o);
  }
  return t2;
}
function _objectSpread22(e) {
  for (var r = 1; r < arguments.length; r++) {
    var t2 = null != arguments[r] ? arguments[r] : {};
    r % 2 ? ownKeys2(Object(t2), true).forEach(function(r$1) {
      _defineProperty2(e, r$1, t2[r$1]);
    }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(t2)) : ownKeys2(Object(t2)).forEach(function(r$1) {
      Object.defineProperty(e, r$1, Object.getOwnPropertyDescriptor(t2, r$1));
    });
  }
  return e;
}
var _getErrorMessage = (err) => {
  var _err$error;
  return err.msg || err.message || err.error_description || (typeof err.error === "string" ? err.error : (_err$error = err.error) === null || _err$error === void 0 ? void 0 : _err$error.message) || JSON.stringify(err);
};
var handleError = async (error, reject, options, namespace) => {
  if (error && typeof error === "object" && "status" in error && "ok" in error && typeof error.status === "number" && !(options === null || options === void 0 ? void 0 : options.noResolveJson)) {
    const responseError = error;
    const status = responseError.status || 500;
    if (typeof responseError.json === "function") responseError.json().then((err) => {
      const statusCode = (err === null || err === void 0 ? void 0 : err.statusCode) || (err === null || err === void 0 ? void 0 : err.code) || status + "";
      reject(new StorageApiError(_getErrorMessage(err), status, statusCode, namespace));
    }).catch(() => {
      if (namespace === "vectors") {
        const statusCode = status + "";
        reject(new StorageApiError(responseError.statusText || `HTTP ${status} error`, status, statusCode, namespace));
      } else {
        const statusCode = status + "";
        reject(new StorageApiError(responseError.statusText || `HTTP ${status} error`, status, statusCode, namespace));
      }
    });
    else {
      const statusCode = status + "";
      reject(new StorageApiError(responseError.statusText || `HTTP ${status} error`, status, statusCode, namespace));
    }
  } else reject(new StorageUnknownError(_getErrorMessage(error), error, namespace));
};
var _getRequestParams = (method, options, parameters, body) => {
  const params = {
    method,
    headers: (options === null || options === void 0 ? void 0 : options.headers) || {}
  };
  if (method === "GET" || method === "HEAD" || !body) return _objectSpread22(_objectSpread22({}, params), parameters);
  if (isPlainObject(body)) {
    params.headers = _objectSpread22({ "Content-Type": "application/json" }, options === null || options === void 0 ? void 0 : options.headers);
    params.body = JSON.stringify(body);
  } else params.body = body;
  if (options === null || options === void 0 ? void 0 : options.duplex) params.duplex = options.duplex;
  return _objectSpread22(_objectSpread22({}, params), parameters);
};
async function _handleRequest(fetcher, method, url, options, parameters, body, namespace) {
  return new Promise((resolve, reject) => {
    fetcher(url, _getRequestParams(method, options, parameters, body)).then((result) => {
      if (!result.ok) throw result;
      if (options === null || options === void 0 ? void 0 : options.noResolveJson) return result;
      if (namespace === "vectors") {
        const contentType = result.headers.get("content-type");
        if (result.headers.get("content-length") === "0" || result.status === 204) return {};
        if (!contentType || !contentType.includes("application/json")) return {};
      }
      return result.json();
    }).then((data) => resolve(data)).catch((error) => handleError(error, reject, options, namespace));
  });
}
function createFetchApi(namespace = "storage") {
  return {
    get: async (fetcher, url, options, parameters) => {
      return _handleRequest(fetcher, "GET", url, options, parameters, void 0, namespace);
    },
    post: async (fetcher, url, body, options, parameters) => {
      return _handleRequest(fetcher, "POST", url, options, parameters, body, namespace);
    },
    put: async (fetcher, url, body, options, parameters) => {
      return _handleRequest(fetcher, "PUT", url, options, parameters, body, namespace);
    },
    head: async (fetcher, url, options, parameters) => {
      return _handleRequest(fetcher, "HEAD", url, _objectSpread22(_objectSpread22({}, options), {}, { noResolveJson: true }), parameters, void 0, namespace);
    },
    remove: async (fetcher, url, body, options, parameters) => {
      return _handleRequest(fetcher, "DELETE", url, options, parameters, body, namespace);
    }
  };
}
var defaultApi = createFetchApi("storage");
var { get, post, put, head, remove } = defaultApi;
var vectorsApi = createFetchApi("vectors");
var BaseApiClient = class {
  /**
  * Creates a new BaseApiClient instance
  * @param url - Base URL for API requests
  * @param headers - Default headers for API requests
  * @param fetch - Optional custom fetch implementation
  * @param namespace - Error namespace ('storage' or 'vectors')
  */
  constructor(url, headers = {}, fetch$1, namespace = "storage") {
    this.shouldThrowOnError = false;
    this.url = url;
    this.headers = headers;
    this.fetch = resolveFetch2(fetch$1);
    this.namespace = namespace;
  }
  /**
  * Enable throwing errors instead of returning them.
  * When enabled, errors are thrown instead of returned in { data, error } format.
  *
  * @returns this - For method chaining
  */
  throwOnError() {
    this.shouldThrowOnError = true;
    return this;
  }
  /**
  * Handles API operation with standardized error handling
  * Eliminates repetitive try-catch blocks across all API methods
  *
  * This wrapper:
  * 1. Executes the operation
  * 2. Returns { data, error: null } on success
  * 3. Returns { data: null, error } on failure (if shouldThrowOnError is false)
  * 4. Throws error on failure (if shouldThrowOnError is true)
  *
  * @typeParam T - The expected data type from the operation
  * @param operation - Async function that performs the API call
  * @returns Promise with { data, error } tuple
  *
  * @example
  * ```typescript
  * async listBuckets() {
  *   return this.handleOperation(async () => {
  *     return await get(this.fetch, `${this.url}/bucket`, {
  *       headers: this.headers,
  *     })
  *   })
  * }
  * ```
  */
  async handleOperation(operation) {
    var _this = this;
    try {
      return {
        data: await operation(),
        error: null
      };
    } catch (error) {
      if (_this.shouldThrowOnError) throw error;
      if (isStorageError(error)) return {
        data: null,
        error
      };
      throw error;
    }
  }
};
var StreamDownloadBuilder = class {
  constructor(downloadFn, shouldThrowOnError) {
    this.downloadFn = downloadFn;
    this.shouldThrowOnError = shouldThrowOnError;
  }
  then(onfulfilled, onrejected) {
    return this.execute().then(onfulfilled, onrejected);
  }
  async execute() {
    var _this = this;
    try {
      return {
        data: (await _this.downloadFn()).body,
        error: null
      };
    } catch (error) {
      if (_this.shouldThrowOnError) throw error;
      if (isStorageError(error)) return {
        data: null,
        error
      };
      throw error;
    }
  }
};
var _Symbol$toStringTag;
_Symbol$toStringTag = Symbol.toStringTag;
var BlobDownloadBuilder = class {
  constructor(downloadFn, shouldThrowOnError) {
    this.downloadFn = downloadFn;
    this.shouldThrowOnError = shouldThrowOnError;
    this[_Symbol$toStringTag] = "BlobDownloadBuilder";
    this.promise = null;
  }
  asStream() {
    return new StreamDownloadBuilder(this.downloadFn, this.shouldThrowOnError);
  }
  then(onfulfilled, onrejected) {
    return this.getPromise().then(onfulfilled, onrejected);
  }
  catch(onrejected) {
    return this.getPromise().catch(onrejected);
  }
  finally(onfinally) {
    return this.getPromise().finally(onfinally);
  }
  getPromise() {
    if (!this.promise) this.promise = this.execute();
    return this.promise;
  }
  async execute() {
    var _this = this;
    try {
      return {
        data: await (await _this.downloadFn()).blob(),
        error: null
      };
    } catch (error) {
      if (_this.shouldThrowOnError) throw error;
      if (isStorageError(error)) return {
        data: null,
        error
      };
      throw error;
    }
  }
};
var DEFAULT_SEARCH_OPTIONS = {
  limit: 100,
  offset: 0,
  sortBy: {
    column: "name",
    order: "asc"
  }
};
var DEFAULT_FILE_OPTIONS = {
  cacheControl: "3600",
  contentType: "text/plain;charset=UTF-8",
  upsert: false
};
var StorageFileApi = class extends BaseApiClient {
  constructor(url, headers = {}, bucketId, fetch$1) {
    super(url, headers, fetch$1, "storage");
    this.bucketId = bucketId;
  }
  /**
  * Uploads a file to an existing bucket or replaces an existing file at the specified path with a new one.
  *
  * @param method HTTP method.
  * @param path The relative file path. Should be of the format `folder/subfolder/filename.png`. The bucket must already exist before attempting to upload.
  * @param fileBody The body of the file to be stored in the bucket.
  */
  async uploadOrUpdate(method, path, fileBody, fileOptions) {
    var _this = this;
    return _this.handleOperation(async () => {
      let body;
      const options = _objectSpread22(_objectSpread22({}, DEFAULT_FILE_OPTIONS), fileOptions);
      let headers = _objectSpread22(_objectSpread22({}, _this.headers), method === "POST" && { "x-upsert": String(options.upsert) });
      const metadata = options.metadata;
      if (typeof Blob !== "undefined" && fileBody instanceof Blob) {
        body = new FormData();
        body.append("cacheControl", options.cacheControl);
        if (metadata) body.append("metadata", _this.encodeMetadata(metadata));
        body.append("", fileBody);
      } else if (typeof FormData !== "undefined" && fileBody instanceof FormData) {
        body = fileBody;
        if (!body.has("cacheControl")) body.append("cacheControl", options.cacheControl);
        if (metadata && !body.has("metadata")) body.append("metadata", _this.encodeMetadata(metadata));
      } else {
        body = fileBody;
        headers["cache-control"] = `max-age=${options.cacheControl}`;
        headers["content-type"] = options.contentType;
        if (metadata) headers["x-metadata"] = _this.toBase64(_this.encodeMetadata(metadata));
        if ((typeof ReadableStream !== "undefined" && body instanceof ReadableStream || body && typeof body === "object" && "pipe" in body && typeof body.pipe === "function") && !options.duplex) options.duplex = "half";
      }
      if (fileOptions === null || fileOptions === void 0 ? void 0 : fileOptions.headers) headers = _objectSpread22(_objectSpread22({}, headers), fileOptions.headers);
      const cleanPath = _this._removeEmptyFolders(path);
      const _path = _this._getFinalPath(cleanPath);
      const data = await (method == "PUT" ? put : post)(_this.fetch, `${_this.url}/object/${_path}`, body, _objectSpread22({ headers }, (options === null || options === void 0 ? void 0 : options.duplex) ? { duplex: options.duplex } : {}));
      return {
        path: cleanPath,
        id: data.Id,
        fullPath: data.Key
      };
    });
  }
  /**
  * Uploads a file to an existing bucket.
  *
  * @category File Buckets
  * @param path The file path, including the file name. Should be of the format `folder/subfolder/filename.png`. The bucket must already exist before attempting to upload.
  * @param fileBody The body of the file to be stored in the bucket.
  * @param fileOptions Optional file upload options including cacheControl, contentType, upsert, and metadata.
  * @returns Promise with response containing file path, id, and fullPath or error
  *
  * @example Upload file
  * ```js
  * const avatarFile = event.target.files[0]
  * const { data, error } = await supabase
  *   .storage
  *   .from('avatars')
  *   .upload('public/avatar1.png', avatarFile, {
  *     cacheControl: '3600',
  *     upsert: false
  *   })
  * ```
  *
  * Response:
  * ```json
  * {
  *   "data": {
  *     "path": "public/avatar1.png",
  *     "fullPath": "avatars/public/avatar1.png"
  *   },
  *   "error": null
  * }
  * ```
  *
  * @example Upload file using `ArrayBuffer` from base64 file data
  * ```js
  * import { decode } from 'base64-arraybuffer'
  *
  * const { data, error } = await supabase
  *   .storage
  *   .from('avatars')
  *   .upload('public/avatar1.png', decode('base64FileData'), {
  *     contentType: 'image/png'
  *   })
  * ```
  */
  async upload(path, fileBody, fileOptions) {
    return this.uploadOrUpdate("POST", path, fileBody, fileOptions);
  }
  /**
  * Upload a file with a token generated from `createSignedUploadUrl`.
  *
  * @category File Buckets
  * @param path The file path, including the file name. Should be of the format `folder/subfolder/filename.png`. The bucket must already exist before attempting to upload.
  * @param token The token generated from `createSignedUploadUrl`
  * @param fileBody The body of the file to be stored in the bucket.
  * @param fileOptions HTTP headers (cacheControl, contentType, etc.).
  * **Note:** The `upsert` option has no effect here. To enable upsert behavior,
  * pass `{ upsert: true }` when calling `createSignedUploadUrl()` instead.
  * @returns Promise with response containing file path and fullPath or error
  *
  * @example Upload to a signed URL
  * ```js
  * const { data, error } = await supabase
  *   .storage
  *   .from('avatars')
  *   .uploadToSignedUrl('folder/cat.jpg', 'token-from-createSignedUploadUrl', file)
  * ```
  *
  * Response:
  * ```json
  * {
  *   "data": {
  *     "path": "folder/cat.jpg",
  *     "fullPath": "avatars/folder/cat.jpg"
  *   },
  *   "error": null
  * }
  * ```
  */
  async uploadToSignedUrl(path, token, fileBody, fileOptions) {
    var _this3 = this;
    const cleanPath = _this3._removeEmptyFolders(path);
    const _path = _this3._getFinalPath(cleanPath);
    const url = new URL(_this3.url + `/object/upload/sign/${_path}`);
    url.searchParams.set("token", token);
    return _this3.handleOperation(async () => {
      let body;
      const options = _objectSpread22({ upsert: DEFAULT_FILE_OPTIONS.upsert }, fileOptions);
      const headers = _objectSpread22(_objectSpread22({}, _this3.headers), { "x-upsert": String(options.upsert) });
      if (typeof Blob !== "undefined" && fileBody instanceof Blob) {
        body = new FormData();
        body.append("cacheControl", options.cacheControl);
        body.append("", fileBody);
      } else if (typeof FormData !== "undefined" && fileBody instanceof FormData) {
        body = fileBody;
        body.append("cacheControl", options.cacheControl);
      } else {
        body = fileBody;
        headers["cache-control"] = `max-age=${options.cacheControl}`;
        headers["content-type"] = options.contentType;
      }
      return {
        path: cleanPath,
        fullPath: (await put(_this3.fetch, url.toString(), body, { headers })).Key
      };
    });
  }
  /**
  * Creates a signed upload URL.
  * Signed upload URLs can be used to upload files to the bucket without further authentication.
  * They are valid for 2 hours.
  *
  * @category File Buckets
  * @param path The file path, including the current file name. For example `folder/image.png`.
  * @param options.upsert If set to true, allows the file to be overwritten if it already exists.
  * @returns Promise with response containing signed upload URL, token, and path or error
  *
  * @example Create Signed Upload URL
  * ```js
  * const { data, error } = await supabase
  *   .storage
  *   .from('avatars')
  *   .createSignedUploadUrl('folder/cat.jpg')
  * ```
  *
  * Response:
  * ```json
  * {
  *   "data": {
  *     "signedUrl": "https://example.supabase.co/storage/v1/object/upload/sign/avatars/folder/cat.jpg?token=<TOKEN>",
  *     "path": "folder/cat.jpg",
  *     "token": "<TOKEN>"
  *   },
  *   "error": null
  * }
  * ```
  */
  async createSignedUploadUrl(path, options) {
    var _this4 = this;
    return _this4.handleOperation(async () => {
      let _path = _this4._getFinalPath(path);
      const headers = _objectSpread22({}, _this4.headers);
      if (options === null || options === void 0 ? void 0 : options.upsert) headers["x-upsert"] = "true";
      const data = await post(_this4.fetch, `${_this4.url}/object/upload/sign/${_path}`, {}, { headers });
      const url = new URL(_this4.url + data.url);
      const token = url.searchParams.get("token");
      if (!token) throw new StorageError("No token returned by API");
      return {
        signedUrl: url.toString(),
        path,
        token
      };
    });
  }
  /**
  * Replaces an existing file at the specified path with a new one.
  *
  * @category File Buckets
  * @param path The relative file path. Should be of the format `folder/subfolder/filename.png`. The bucket must already exist before attempting to update.
  * @param fileBody The body of the file to be stored in the bucket.
  * @param fileOptions Optional file upload options including cacheControl, contentType, upsert, and metadata.
  * @returns Promise with response containing file path, id, and fullPath or error
  *
  * @example Update file
  * ```js
  * const avatarFile = event.target.files[0]
  * const { data, error } = await supabase
  *   .storage
  *   .from('avatars')
  *   .update('public/avatar1.png', avatarFile, {
  *     cacheControl: '3600',
  *     upsert: true
  *   })
  * ```
  *
  * Response:
  * ```json
  * {
  *   "data": {
  *     "path": "public/avatar1.png",
  *     "fullPath": "avatars/public/avatar1.png"
  *   },
  *   "error": null
  * }
  * ```
  *
  * @example Update file using `ArrayBuffer` from base64 file data
  * ```js
  * import {decode} from 'base64-arraybuffer'
  *
  * const { data, error } = await supabase
  *   .storage
  *   .from('avatars')
  *   .update('public/avatar1.png', decode('base64FileData'), {
  *     contentType: 'image/png'
  *   })
  * ```
  */
  async update(path, fileBody, fileOptions) {
    return this.uploadOrUpdate("PUT", path, fileBody, fileOptions);
  }
  /**
  * Moves an existing file to a new path in the same bucket.
  *
  * @category File Buckets
  * @param fromPath The original file path, including the current file name. For example `folder/image.png`.
  * @param toPath The new file path, including the new file name. For example `folder/image-new.png`.
  * @param options The destination options.
  * @returns Promise with response containing success message or error
  *
  * @example Move file
  * ```js
  * const { data, error } = await supabase
  *   .storage
  *   .from('avatars')
  *   .move('public/avatar1.png', 'private/avatar2.png')
  * ```
  *
  * Response:
  * ```json
  * {
  *   "data": {
  *     "message": "Successfully moved"
  *   },
  *   "error": null
  * }
  * ```
  */
  async move(fromPath, toPath, options) {
    var _this6 = this;
    return _this6.handleOperation(async () => {
      return await post(_this6.fetch, `${_this6.url}/object/move`, {
        bucketId: _this6.bucketId,
        sourceKey: fromPath,
        destinationKey: toPath,
        destinationBucket: options === null || options === void 0 ? void 0 : options.destinationBucket
      }, { headers: _this6.headers });
    });
  }
  /**
  * Copies an existing file to a new path in the same bucket.
  *
  * @category File Buckets
  * @param fromPath The original file path, including the current file name. For example `folder/image.png`.
  * @param toPath The new file path, including the new file name. For example `folder/image-copy.png`.
  * @param options The destination options.
  * @returns Promise with response containing copied file path or error
  *
  * @example Copy file
  * ```js
  * const { data, error } = await supabase
  *   .storage
  *   .from('avatars')
  *   .copy('public/avatar1.png', 'private/avatar2.png')
  * ```
  *
  * Response:
  * ```json
  * {
  *   "data": {
  *     "path": "avatars/private/avatar2.png"
  *   },
  *   "error": null
  * }
  * ```
  */
  async copy(fromPath, toPath, options) {
    var _this7 = this;
    return _this7.handleOperation(async () => {
      return { path: (await post(_this7.fetch, `${_this7.url}/object/copy`, {
        bucketId: _this7.bucketId,
        sourceKey: fromPath,
        destinationKey: toPath,
        destinationBucket: options === null || options === void 0 ? void 0 : options.destinationBucket
      }, { headers: _this7.headers })).Key };
    });
  }
  /**
  * Creates a signed URL. Use a signed URL to share a file for a fixed amount of time.
  *
  * @category File Buckets
  * @param path The file path, including the current file name. For example `folder/image.png`.
  * @param expiresIn The number of seconds until the signed URL expires. For example, `60` for a URL which is valid for one minute.
  * @param options.download triggers the file as a download if set to true. Set this parameter as the name of the file if you want to trigger the download with a different filename.
  * @param options.transform Transform the asset before serving it to the client.
  * @returns Promise with response containing signed URL or error
  *
  * @example Create Signed URL
  * ```js
  * const { data, error } = await supabase
  *   .storage
  *   .from('avatars')
  *   .createSignedUrl('folder/avatar1.png', 60)
  * ```
  *
  * Response:
  * ```json
  * {
  *   "data": {
  *     "signedUrl": "https://example.supabase.co/storage/v1/object/sign/avatars/folder/avatar1.png?token=<TOKEN>"
  *   },
  *   "error": null
  * }
  * ```
  *
  * @example Create a signed URL for an asset with transformations
  * ```js
  * const { data } = await supabase
  *   .storage
  *   .from('avatars')
  *   .createSignedUrl('folder/avatar1.png', 60, {
  *     transform: {
  *       width: 100,
  *       height: 100,
  *     }
  *   })
  * ```
  *
  * @example Create a signed URL which triggers the download of the asset
  * ```js
  * const { data } = await supabase
  *   .storage
  *   .from('avatars')
  *   .createSignedUrl('folder/avatar1.png', 60, {
  *     download: true,
  *   })
  * ```
  */
  async createSignedUrl(path, expiresIn, options) {
    var _this8 = this;
    return _this8.handleOperation(async () => {
      let _path = _this8._getFinalPath(path);
      let data = await post(_this8.fetch, `${_this8.url}/object/sign/${_path}`, _objectSpread22({ expiresIn }, (options === null || options === void 0 ? void 0 : options.transform) ? { transform: options.transform } : {}), { headers: _this8.headers });
      const downloadQueryParam = (options === null || options === void 0 ? void 0 : options.download) ? `&download=${options.download === true ? "" : options.download}` : "";
      return { signedUrl: encodeURI(`${_this8.url}${data.signedURL}${downloadQueryParam}`) };
    });
  }
  /**
  * Creates multiple signed URLs. Use a signed URL to share a file for a fixed amount of time.
  *
  * @category File Buckets
  * @param paths The file paths to be downloaded, including the current file names. For example `['folder/image.png', 'folder2/image2.png']`.
  * @param expiresIn The number of seconds until the signed URLs expire. For example, `60` for URLs which are valid for one minute.
  * @param options.download triggers the file as a download if set to true. Set this parameter as the name of the file if you want to trigger the download with a different filename.
  * @returns Promise with response containing array of objects with signedUrl, path, and error or error
  *
  * @example Create Signed URLs
  * ```js
  * const { data, error } = await supabase
  *   .storage
  *   .from('avatars')
  *   .createSignedUrls(['folder/avatar1.png', 'folder/avatar2.png'], 60)
  * ```
  *
  * Response:
  * ```json
  * {
  *   "data": [
  *     {
  *       "error": null,
  *       "path": "folder/avatar1.png",
  *       "signedURL": "/object/sign/avatars/folder/avatar1.png?token=<TOKEN>",
  *       "signedUrl": "https://example.supabase.co/storage/v1/object/sign/avatars/folder/avatar1.png?token=<TOKEN>"
  *     },
  *     {
  *       "error": null,
  *       "path": "folder/avatar2.png",
  *       "signedURL": "/object/sign/avatars/folder/avatar2.png?token=<TOKEN>",
  *       "signedUrl": "https://example.supabase.co/storage/v1/object/sign/avatars/folder/avatar2.png?token=<TOKEN>"
  *     }
  *   ],
  *   "error": null
  * }
  * ```
  */
  async createSignedUrls(paths, expiresIn, options) {
    var _this9 = this;
    return _this9.handleOperation(async () => {
      const data = await post(_this9.fetch, `${_this9.url}/object/sign/${_this9.bucketId}`, {
        expiresIn,
        paths
      }, { headers: _this9.headers });
      const downloadQueryParam = (options === null || options === void 0 ? void 0 : options.download) ? `&download=${options.download === true ? "" : options.download}` : "";
      return data.map((datum) => _objectSpread22(_objectSpread22({}, datum), {}, { signedUrl: datum.signedURL ? encodeURI(`${_this9.url}${datum.signedURL}${downloadQueryParam}`) : null }));
    });
  }
  /**
  * Downloads a file from a private bucket. For public buckets, make a request to the URL returned from `getPublicUrl` instead.
  *
  * @category File Buckets
  * @param path The full path and file name of the file to be downloaded. For example `folder/image.png`.
  * @param options.transform Transform the asset before serving it to the client.
  * @param parameters Additional fetch parameters like signal for cancellation. Supports standard fetch options including cache control.
  * @returns BlobDownloadBuilder instance for downloading the file
  *
  * @example Download file
  * ```js
  * const { data, error } = await supabase
  *   .storage
  *   .from('avatars')
  *   .download('folder/avatar1.png')
  * ```
  *
  * Response:
  * ```json
  * {
  *   "data": <BLOB>,
  *   "error": null
  * }
  * ```
  *
  * @example Download file with transformations
  * ```js
  * const { data, error } = await supabase
  *   .storage
  *   .from('avatars')
  *   .download('folder/avatar1.png', {
  *     transform: {
  *       width: 100,
  *       height: 100,
  *       quality: 80
  *     }
  *   })
  * ```
  *
  * @example Download with cache control (useful in Edge Functions)
  * ```js
  * const { data, error } = await supabase
  *   .storage
  *   .from('avatars')
  *   .download('folder/avatar1.png', {}, { cache: 'no-store' })
  * ```
  *
  * @example Download with abort signal
  * ```js
  * const controller = new AbortController()
  * setTimeout(() => controller.abort(), 5000)
  *
  * const { data, error } = await supabase
  *   .storage
  *   .from('avatars')
  *   .download('folder/avatar1.png', {}, { signal: controller.signal })
  * ```
  */
  download(path, options, parameters) {
    const renderPath = typeof (options === null || options === void 0 ? void 0 : options.transform) !== "undefined" ? "render/image/authenticated" : "object";
    const transformationQuery = this.transformOptsToQueryString((options === null || options === void 0 ? void 0 : options.transform) || {});
    const queryString = transformationQuery ? `?${transformationQuery}` : "";
    const _path = this._getFinalPath(path);
    const downloadFn = () => get(this.fetch, `${this.url}/${renderPath}/${_path}${queryString}`, {
      headers: this.headers,
      noResolveJson: true
    }, parameters);
    return new BlobDownloadBuilder(downloadFn, this.shouldThrowOnError);
  }
  /**
  * Retrieves the details of an existing file.
  *
  * @category File Buckets
  * @param path The file path, including the file name. For example `folder/image.png`.
  * @returns Promise with response containing file metadata or error
  *
  * @example Get file info
  * ```js
  * const { data, error } = await supabase
  *   .storage
  *   .from('avatars')
  *   .info('folder/avatar1.png')
  * ```
  */
  async info(path) {
    var _this10 = this;
    const _path = _this10._getFinalPath(path);
    return _this10.handleOperation(async () => {
      return recursiveToCamel(await get(_this10.fetch, `${_this10.url}/object/info/${_path}`, { headers: _this10.headers }));
    });
  }
  /**
  * Checks the existence of a file.
  *
  * @category File Buckets
  * @param path The file path, including the file name. For example `folder/image.png`.
  * @returns Promise with response containing boolean indicating file existence or error
  *
  * @example Check file existence
  * ```js
  * const { data, error } = await supabase
  *   .storage
  *   .from('avatars')
  *   .exists('folder/avatar1.png')
  * ```
  */
  async exists(path) {
    var _this11 = this;
    const _path = _this11._getFinalPath(path);
    try {
      await head(_this11.fetch, `${_this11.url}/object/${_path}`, { headers: _this11.headers });
      return {
        data: true,
        error: null
      };
    } catch (error) {
      if (_this11.shouldThrowOnError) throw error;
      if (isStorageError(error) && error instanceof StorageUnknownError) {
        const originalError = error.originalError;
        if ([400, 404].includes(originalError === null || originalError === void 0 ? void 0 : originalError.status)) return {
          data: false,
          error
        };
      }
      throw error;
    }
  }
  /**
  * A simple convenience function to get the URL for an asset in a public bucket. If you do not want to use this function, you can construct the public URL by concatenating the bucket URL with the path to the asset.
  * This function does not verify if the bucket is public. If a public URL is created for a bucket which is not public, you will not be able to download the asset.
  *
  * @category File Buckets
  * @param path The path and name of the file to generate the public URL for. For example `folder/image.png`.
  * @param options.download Triggers the file as a download if set to true. Set this parameter as the name of the file if you want to trigger the download with a different filename.
  * @param options.transform Transform the asset before serving it to the client.
  * @returns Object with public URL
  *
  * @example Returns the URL for an asset in a public bucket
  * ```js
  * const { data } = supabase
  *   .storage
  *   .from('public-bucket')
  *   .getPublicUrl('folder/avatar1.png')
  * ```
  *
  * Response:
  * ```json
  * {
  *   "data": {
  *     "publicUrl": "https://example.supabase.co/storage/v1/object/public/public-bucket/folder/avatar1.png"
  *   }
  * }
  * ```
  *
  * @example Returns the URL for an asset in a public bucket with transformations
  * ```js
  * const { data } = supabase
  *   .storage
  *   .from('public-bucket')
  *   .getPublicUrl('folder/avatar1.png', {
  *     transform: {
  *       width: 100,
  *       height: 100,
  *     }
  *   })
  * ```
  *
  * @example Returns the URL which triggers the download of an asset in a public bucket
  * ```js
  * const { data } = supabase
  *   .storage
  *   .from('public-bucket')
  *   .getPublicUrl('folder/avatar1.png', {
  *     download: true,
  *   })
  * ```
  */
  getPublicUrl(path, options) {
    const _path = this._getFinalPath(path);
    const _queryString = [];
    const downloadQueryParam = (options === null || options === void 0 ? void 0 : options.download) ? `download=${options.download === true ? "" : options.download}` : "";
    if (downloadQueryParam !== "") _queryString.push(downloadQueryParam);
    const renderPath = typeof (options === null || options === void 0 ? void 0 : options.transform) !== "undefined" ? "render/image" : "object";
    const transformationQuery = this.transformOptsToQueryString((options === null || options === void 0 ? void 0 : options.transform) || {});
    if (transformationQuery !== "") _queryString.push(transformationQuery);
    let queryString = _queryString.join("&");
    if (queryString !== "") queryString = `?${queryString}`;
    return { data: { publicUrl: encodeURI(`${this.url}/${renderPath}/public/${_path}${queryString}`) } };
  }
  /**
  * Deletes files within the same bucket
  *
  * @category File Buckets
  * @param paths An array of files to delete, including the path and file name. For example [`'folder/image.png'`].
  * @returns Promise with response containing array of deleted file objects or error
  *
  * @example Delete file
  * ```js
  * const { data, error } = await supabase
  *   .storage
  *   .from('avatars')
  *   .remove(['folder/avatar1.png'])
  * ```
  *
  * Response:
  * ```json
  * {
  *   "data": [],
  *   "error": null
  * }
  * ```
  */
  async remove(paths) {
    var _this12 = this;
    return _this12.handleOperation(async () => {
      return await remove(_this12.fetch, `${_this12.url}/object/${_this12.bucketId}`, { prefixes: paths }, { headers: _this12.headers });
    });
  }
  /**
  * Get file metadata
  * @param id the file id to retrieve metadata
  */
  /**
  * Update file metadata
  * @param id the file id to update metadata
  * @param meta the new file metadata
  */
  /**
  * Lists all the files and folders within a path of the bucket.
  *
  * @category File Buckets
  * @param path The folder path.
  * @param options Search options including limit (defaults to 100), offset, sortBy, and search
  * @param parameters Optional fetch parameters including signal for cancellation
  * @returns Promise with response containing array of files or error
  *
  * @example List files in a bucket
  * ```js
  * const { data, error } = await supabase
  *   .storage
  *   .from('avatars')
  *   .list('folder', {
  *     limit: 100,
  *     offset: 0,
  *     sortBy: { column: 'name', order: 'asc' },
  *   })
  * ```
  *
  * Response:
  * ```json
  * {
  *   "data": [
  *     {
  *       "name": "avatar1.png",
  *       "id": "e668cf7f-821b-4a2f-9dce-7dfa5dd1cfd2",
  *       "updated_at": "2024-05-22T23:06:05.580Z",
  *       "created_at": "2024-05-22T23:04:34.443Z",
  *       "last_accessed_at": "2024-05-22T23:04:34.443Z",
  *       "metadata": {
  *         "eTag": "\"c5e8c553235d9af30ef4f6e280790b92\"",
  *         "size": 32175,
  *         "mimetype": "image/png",
  *         "cacheControl": "max-age=3600",
  *         "lastModified": "2024-05-22T23:06:05.574Z",
  *         "contentLength": 32175,
  *         "httpStatusCode": 200
  *       }
  *     }
  *   ],
  *   "error": null
  * }
  * ```
  *
  * @example Search files in a bucket
  * ```js
  * const { data, error } = await supabase
  *   .storage
  *   .from('avatars')
  *   .list('folder', {
  *     limit: 100,
  *     offset: 0,
  *     sortBy: { column: 'name', order: 'asc' },
  *     search: 'jon'
  *   })
  * ```
  */
  async list(path, options, parameters) {
    var _this13 = this;
    return _this13.handleOperation(async () => {
      const body = _objectSpread22(_objectSpread22(_objectSpread22({}, DEFAULT_SEARCH_OPTIONS), options), {}, { prefix: path || "" });
      return await post(_this13.fetch, `${_this13.url}/object/list/${_this13.bucketId}`, body, { headers: _this13.headers }, parameters);
    });
  }
  /**
  * @experimental this method signature might change in the future
  *
  * @category File Buckets
  * @param options search options
  * @param parameters
  */
  async listV2(options, parameters) {
    var _this14 = this;
    return _this14.handleOperation(async () => {
      const body = _objectSpread22({}, options);
      return await post(_this14.fetch, `${_this14.url}/object/list-v2/${_this14.bucketId}`, body, { headers: _this14.headers }, parameters);
    });
  }
  encodeMetadata(metadata) {
    return JSON.stringify(metadata);
  }
  toBase64(data) {
    if (typeof Buffer !== "undefined") return Buffer.from(data).toString("base64");
    return btoa(data);
  }
  _getFinalPath(path) {
    return `${this.bucketId}/${path.replace(/^\/+/, "")}`;
  }
  _removeEmptyFolders(path) {
    return path.replace(/^\/|\/$/g, "").replace(/\/+/g, "/");
  }
  transformOptsToQueryString(transform) {
    const params = [];
    if (transform.width) params.push(`width=${transform.width}`);
    if (transform.height) params.push(`height=${transform.height}`);
    if (transform.resize) params.push(`resize=${transform.resize}`);
    if (transform.format) params.push(`format=${transform.format}`);
    if (transform.quality) params.push(`quality=${transform.quality}`);
    return params.join("&");
  }
};
var version2 = "2.95.3";
var DEFAULT_HEADERS = { "X-Client-Info": `storage-js/${version2}` };
var StorageBucketApi = class extends BaseApiClient {
  constructor(url, headers = {}, fetch$1, opts) {
    const baseUrl = new URL(url);
    if (opts === null || opts === void 0 ? void 0 : opts.useNewHostname) {
      if (/supabase\.(co|in|red)$/.test(baseUrl.hostname) && !baseUrl.hostname.includes("storage.supabase.")) baseUrl.hostname = baseUrl.hostname.replace("supabase.", "storage.supabase.");
    }
    const finalUrl = baseUrl.href.replace(/\/$/, "");
    const finalHeaders = _objectSpread22(_objectSpread22({}, DEFAULT_HEADERS), headers);
    super(finalUrl, finalHeaders, fetch$1, "storage");
  }
  /**
  * Retrieves the details of all Storage buckets within an existing project.
  *
  * @category File Buckets
  * @param options Query parameters for listing buckets
  * @param options.limit Maximum number of buckets to return
  * @param options.offset Number of buckets to skip
  * @param options.sortColumn Column to sort by ('id', 'name', 'created_at', 'updated_at')
  * @param options.sortOrder Sort order ('asc' or 'desc')
  * @param options.search Search term to filter bucket names
  * @returns Promise with response containing array of buckets or error
  *
  * @example List buckets
  * ```js
  * const { data, error } = await supabase
  *   .storage
  *   .listBuckets()
  * ```
  *
  * @example List buckets with options
  * ```js
  * const { data, error } = await supabase
  *   .storage
  *   .listBuckets({
  *     limit: 10,
  *     offset: 0,
  *     sortColumn: 'created_at',
  *     sortOrder: 'desc',
  *     search: 'prod'
  *   })
  * ```
  */
  async listBuckets(options) {
    var _this = this;
    return _this.handleOperation(async () => {
      const queryString = _this.listBucketOptionsToQueryString(options);
      return await get(_this.fetch, `${_this.url}/bucket${queryString}`, { headers: _this.headers });
    });
  }
  /**
  * Retrieves the details of an existing Storage bucket.
  *
  * @category File Buckets
  * @param id The unique identifier of the bucket you would like to retrieve.
  * @returns Promise with response containing bucket details or error
  *
  * @example Get bucket
  * ```js
  * const { data, error } = await supabase
  *   .storage
  *   .getBucket('avatars')
  * ```
  *
  * Response:
  * ```json
  * {
  *   "data": {
  *     "id": "avatars",
  *     "name": "avatars",
  *     "owner": "",
  *     "public": false,
  *     "file_size_limit": 1024,
  *     "allowed_mime_types": [
  *       "image/png"
  *     ],
  *     "created_at": "2024-05-22T22:26:05.100Z",
  *     "updated_at": "2024-05-22T22:26:05.100Z"
  *   },
  *   "error": null
  * }
  * ```
  */
  async getBucket(id) {
    var _this2 = this;
    return _this2.handleOperation(async () => {
      return await get(_this2.fetch, `${_this2.url}/bucket/${id}`, { headers: _this2.headers });
    });
  }
  /**
  * Creates a new Storage bucket
  *
  * @category File Buckets
  * @param id A unique identifier for the bucket you are creating.
  * @param options.public The visibility of the bucket. Public buckets don't require an authorization token to download objects, but still require a valid token for all other operations. By default, buckets are private.
  * @param options.fileSizeLimit specifies the max file size in bytes that can be uploaded to this bucket.
  * The global file size limit takes precedence over this value.
  * The default value is null, which doesn't set a per bucket file size limit.
  * @param options.allowedMimeTypes specifies the allowed mime types that this bucket can accept during upload.
  * The default value is null, which allows files with all mime types to be uploaded.
  * Each mime type specified can be a wildcard, e.g. image/*, or a specific mime type, e.g. image/png.
  * @param options.type (private-beta) specifies the bucket type. see `BucketType` for more details.
  *   - default bucket type is `STANDARD`
  * @returns Promise with response containing newly created bucket name or error
  *
  * @example Create bucket
  * ```js
  * const { data, error } = await supabase
  *   .storage
  *   .createBucket('avatars', {
  *     public: false,
  *     allowedMimeTypes: ['image/png'],
  *     fileSizeLimit: 1024
  *   })
  * ```
  *
  * Response:
  * ```json
  * {
  *   "data": {
  *     "name": "avatars"
  *   },
  *   "error": null
  * }
  * ```
  */
  async createBucket(id, options = { public: false }) {
    var _this3 = this;
    return _this3.handleOperation(async () => {
      return await post(_this3.fetch, `${_this3.url}/bucket`, {
        id,
        name: id,
        type: options.type,
        public: options.public,
        file_size_limit: options.fileSizeLimit,
        allowed_mime_types: options.allowedMimeTypes
      }, { headers: _this3.headers });
    });
  }
  /**
  * Updates a Storage bucket
  *
  * @category File Buckets
  * @param id A unique identifier for the bucket you are updating.
  * @param options.public The visibility of the bucket. Public buckets don't require an authorization token to download objects, but still require a valid token for all other operations.
  * @param options.fileSizeLimit specifies the max file size in bytes that can be uploaded to this bucket.
  * The global file size limit takes precedence over this value.
  * The default value is null, which doesn't set a per bucket file size limit.
  * @param options.allowedMimeTypes specifies the allowed mime types that this bucket can accept during upload.
  * The default value is null, which allows files with all mime types to be uploaded.
  * Each mime type specified can be a wildcard, e.g. image/*, or a specific mime type, e.g. image/png.
  * @returns Promise with response containing success message or error
  *
  * @example Update bucket
  * ```js
  * const { data, error } = await supabase
  *   .storage
  *   .updateBucket('avatars', {
  *     public: false,
  *     allowedMimeTypes: ['image/png'],
  *     fileSizeLimit: 1024
  *   })
  * ```
  *
  * Response:
  * ```json
  * {
  *   "data": {
  *     "message": "Successfully updated"
  *   },
  *   "error": null
  * }
  * ```
  */
  async updateBucket(id, options) {
    var _this4 = this;
    return _this4.handleOperation(async () => {
      return await put(_this4.fetch, `${_this4.url}/bucket/${id}`, {
        id,
        name: id,
        public: options.public,
        file_size_limit: options.fileSizeLimit,
        allowed_mime_types: options.allowedMimeTypes
      }, { headers: _this4.headers });
    });
  }
  /**
  * Removes all objects inside a single bucket.
  *
  * @category File Buckets
  * @param id The unique identifier of the bucket you would like to empty.
  * @returns Promise with success message or error
  *
  * @example Empty bucket
  * ```js
  * const { data, error } = await supabase
  *   .storage
  *   .emptyBucket('avatars')
  * ```
  *
  * Response:
  * ```json
  * {
  *   "data": {
  *     "message": "Successfully emptied"
  *   },
  *   "error": null
  * }
  * ```
  */
  async emptyBucket(id) {
    var _this5 = this;
    return _this5.handleOperation(async () => {
      return await post(_this5.fetch, `${_this5.url}/bucket/${id}/empty`, {}, { headers: _this5.headers });
    });
  }
  /**
  * Deletes an existing bucket. A bucket can't be deleted with existing objects inside it.
  * You must first `empty()` the bucket.
  *
  * @category File Buckets
  * @param id The unique identifier of the bucket you would like to delete.
  * @returns Promise with success message or error
  *
  * @example Delete bucket
  * ```js
  * const { data, error } = await supabase
  *   .storage
  *   .deleteBucket('avatars')
  * ```
  *
  * Response:
  * ```json
  * {
  *   "data": {
  *     "message": "Successfully deleted"
  *   },
  *   "error": null
  * }
  * ```
  */
  async deleteBucket(id) {
    var _this6 = this;
    return _this6.handleOperation(async () => {
      return await remove(_this6.fetch, `${_this6.url}/bucket/${id}`, {}, { headers: _this6.headers });
    });
  }
  listBucketOptionsToQueryString(options) {
    const params = {};
    if (options) {
      if ("limit" in options) params.limit = String(options.limit);
      if ("offset" in options) params.offset = String(options.offset);
      if (options.search) params.search = options.search;
      if (options.sortColumn) params.sortColumn = options.sortColumn;
      if (options.sortOrder) params.sortOrder = options.sortOrder;
    }
    return Object.keys(params).length > 0 ? "?" + new URLSearchParams(params).toString() : "";
  }
};
var StorageAnalyticsClient = class extends BaseApiClient {
  /**
  * @alpha
  *
  * Creates a new StorageAnalyticsClient instance
  *
  * **Public alpha:** This API is part of a public alpha release and may not be available to your account type.
  *
  * @category Analytics Buckets
  * @param url - The base URL for the storage API
  * @param headers - HTTP headers to include in requests
  * @param fetch - Optional custom fetch implementation
  *
  * @example
  * ```typescript
  * const client = new StorageAnalyticsClient(url, headers)
  * ```
  */
  constructor(url, headers = {}, fetch$1) {
    const finalUrl = url.replace(/\/$/, "");
    const finalHeaders = _objectSpread22(_objectSpread22({}, DEFAULT_HEADERS), headers);
    super(finalUrl, finalHeaders, fetch$1, "storage");
  }
  /**
  * @alpha
  *
  * Creates a new analytics bucket using Iceberg tables
  * Analytics buckets are optimized for analytical queries and data processing
  *
  * **Public alpha:** This API is part of a public alpha release and may not be available to your account type.
  *
  * @category Analytics Buckets
  * @param name A unique name for the bucket you are creating
  * @returns Promise with response containing newly created analytics bucket or error
  *
  * @example Create analytics bucket
  * ```js
  * const { data, error } = await supabase
  *   .storage
  *   .analytics
  *   .createBucket('analytics-data')
  * ```
  *
  * Response:
  * ```json
  * {
  *   "data": {
  *     "name": "analytics-data",
  *     "type": "ANALYTICS",
  *     "format": "iceberg",
  *     "created_at": "2024-05-22T22:26:05.100Z",
  *     "updated_at": "2024-05-22T22:26:05.100Z"
  *   },
  *   "error": null
  * }
  * ```
  */
  async createBucket(name) {
    var _this = this;
    return _this.handleOperation(async () => {
      return await post(_this.fetch, `${_this.url}/bucket`, { name }, { headers: _this.headers });
    });
  }
  /**
  * @alpha
  *
  * Retrieves the details of all Analytics Storage buckets within an existing project
  * Only returns buckets of type 'ANALYTICS'
  *
  * **Public alpha:** This API is part of a public alpha release and may not be available to your account type.
  *
  * @category Analytics Buckets
  * @param options Query parameters for listing buckets
  * @param options.limit Maximum number of buckets to return
  * @param options.offset Number of buckets to skip
  * @param options.sortColumn Column to sort by ('name', 'created_at', 'updated_at')
  * @param options.sortOrder Sort order ('asc' or 'desc')
  * @param options.search Search term to filter bucket names
  * @returns Promise with response containing array of analytics buckets or error
  *
  * @example List analytics buckets
  * ```js
  * const { data, error } = await supabase
  *   .storage
  *   .analytics
  *   .listBuckets({
  *     limit: 10,
  *     offset: 0,
  *     sortColumn: 'created_at',
  *     sortOrder: 'desc'
  *   })
  * ```
  *
  * Response:
  * ```json
  * {
  *   "data": [
  *     {
  *       "name": "analytics-data",
  *       "type": "ANALYTICS",
  *       "format": "iceberg",
  *       "created_at": "2024-05-22T22:26:05.100Z",
  *       "updated_at": "2024-05-22T22:26:05.100Z"
  *     }
  *   ],
  *   "error": null
  * }
  * ```
  */
  async listBuckets(options) {
    var _this2 = this;
    return _this2.handleOperation(async () => {
      const queryParams = new URLSearchParams();
      if ((options === null || options === void 0 ? void 0 : options.limit) !== void 0) queryParams.set("limit", options.limit.toString());
      if ((options === null || options === void 0 ? void 0 : options.offset) !== void 0) queryParams.set("offset", options.offset.toString());
      if (options === null || options === void 0 ? void 0 : options.sortColumn) queryParams.set("sortColumn", options.sortColumn);
      if (options === null || options === void 0 ? void 0 : options.sortOrder) queryParams.set("sortOrder", options.sortOrder);
      if (options === null || options === void 0 ? void 0 : options.search) queryParams.set("search", options.search);
      const queryString = queryParams.toString();
      const url = queryString ? `${_this2.url}/bucket?${queryString}` : `${_this2.url}/bucket`;
      return await get(_this2.fetch, url, { headers: _this2.headers });
    });
  }
  /**
  * @alpha
  *
  * Deletes an existing analytics bucket
  * A bucket can't be deleted with existing objects inside it
  * You must first empty the bucket before deletion
  *
  * **Public alpha:** This API is part of a public alpha release and may not be available to your account type.
  *
  * @category Analytics Buckets
  * @param bucketName The unique identifier of the bucket you would like to delete
  * @returns Promise with response containing success message or error
  *
  * @example Delete analytics bucket
  * ```js
  * const { data, error } = await supabase
  *   .storage
  *   .analytics
  *   .deleteBucket('analytics-data')
  * ```
  *
  * Response:
  * ```json
  * {
  *   "data": {
  *     "message": "Successfully deleted"
  *   },
  *   "error": null
  * }
  * ```
  */
  async deleteBucket(bucketName) {
    var _this3 = this;
    return _this3.handleOperation(async () => {
      return await remove(_this3.fetch, `${_this3.url}/bucket/${bucketName}`, {}, { headers: _this3.headers });
    });
  }
  /**
  * @alpha
  *
  * Get an Iceberg REST Catalog client configured for a specific analytics bucket
  * Use this to perform advanced table and namespace operations within the bucket
  * The returned client provides full access to the Apache Iceberg REST Catalog API
  * with the Supabase `{ data, error }` pattern for consistent error handling on all operations.
  *
  * **Public alpha:** This API is part of a public alpha release and may not be available to your account type.
  *
  * @category Analytics Buckets
  * @param bucketName - The name of the analytics bucket (warehouse) to connect to
  * @returns The wrapped Iceberg catalog client
  * @throws {StorageError} If the bucket name is invalid
  *
  * @example Get catalog and create table
  * ```js
  * // First, create an analytics bucket
  * const { data: bucket, error: bucketError } = await supabase
  *   .storage
  *   .analytics
  *   .createBucket('analytics-data')
  *
  * // Get the Iceberg catalog for that bucket
  * const catalog = supabase.storage.analytics.from('analytics-data')
  *
  * // Create a namespace
  * const { error: nsError } = await catalog.createNamespace({ namespace: ['default'] })
  *
  * // Create a table with schema
  * const { data: tableMetadata, error: tableError } = await catalog.createTable(
  *   { namespace: ['default'] },
  *   {
  *     name: 'events',
  *     schema: {
  *       type: 'struct',
  *       fields: [
  *         { id: 1, name: 'id', type: 'long', required: true },
  *         { id: 2, name: 'timestamp', type: 'timestamp', required: true },
  *         { id: 3, name: 'user_id', type: 'string', required: false }
  *       ],
  *       'schema-id': 0,
  *       'identifier-field-ids': [1]
  *     },
  *     'partition-spec': {
  *       'spec-id': 0,
  *       fields: []
  *     },
  *     'write-order': {
  *       'order-id': 0,
  *       fields: []
  *     },
  *     properties: {
  *       'write.format.default': 'parquet'
  *     }
  *   }
  * )
  * ```
  *
  * @example List tables in namespace
  * ```js
  * const catalog = supabase.storage.analytics.from('analytics-data')
  *
  * // List all tables in the default namespace
  * const { data: tables, error: listError } = await catalog.listTables({ namespace: ['default'] })
  * if (listError) {
  *   if (listError.isNotFound()) {
  *     console.log('Namespace not found')
  *   }
  *   return
  * }
  * console.log(tables) // [{ namespace: ['default'], name: 'events' }]
  * ```
  *
  * @example Working with namespaces
  * ```js
  * const catalog = supabase.storage.analytics.from('analytics-data')
  *
  * // List all namespaces
  * const { data: namespaces } = await catalog.listNamespaces()
  *
  * // Create namespace with properties
  * await catalog.createNamespace(
  *   { namespace: ['production'] },
  *   { properties: { owner: 'data-team', env: 'prod' } }
  * )
  * ```
  *
  * @example Cleanup operations
  * ```js
  * const catalog = supabase.storage.analytics.from('analytics-data')
  *
  * // Drop table with purge option (removes all data)
  * const { error: dropError } = await catalog.dropTable(
  *   { namespace: ['default'], name: 'events' },
  *   { purge: true }
  * )
  *
  * if (dropError?.isNotFound()) {
  *   console.log('Table does not exist')
  * }
  *
  * // Drop namespace (must be empty)
  * await catalog.dropNamespace({ namespace: ['default'] })
  * ```
  *
  * @remarks
  * This method provides a bridge between Supabase's bucket management and the standard
  * Apache Iceberg REST Catalog API. The bucket name maps to the Iceberg warehouse parameter.
  * All authentication and configuration is handled automatically using your Supabase credentials.
  *
  * **Error Handling**: Invalid bucket names throw immediately. All catalog
  * operations return `{ data, error }` where errors are `IcebergError` instances from iceberg-js.
  * Use helper methods like `error.isNotFound()` or check `error.status` for specific error handling.
  * Use `.throwOnError()` on the analytics client if you prefer exceptions for catalog operations.
  *
  * **Cleanup Operations**: When using `dropTable`, the `purge: true` option permanently
  * deletes all table data. Without it, the table is marked as deleted but data remains.
  *
  * **Library Dependency**: The returned catalog wraps `IcebergRestCatalog` from iceberg-js.
  * For complete API documentation and advanced usage, refer to the
  * [iceberg-js documentation](https://supabase.github.io/iceberg-js/).
  */
  from(bucketName) {
    var _this4 = this;
    if (!isValidBucketName(bucketName)) throw new StorageError("Invalid bucket name: File, folder, and bucket names must follow AWS object key naming guidelines and should avoid the use of any other characters.");
    const catalog = new IcebergRestCatalog({
      baseUrl: this.url,
      catalogName: bucketName,
      auth: {
        type: "custom",
        getHeaders: async () => _this4.headers
      },
      fetch: this.fetch
    });
    const shouldThrowOnError = this.shouldThrowOnError;
    return new Proxy(catalog, { get(target, prop) {
      const value = target[prop];
      if (typeof value !== "function") return value;
      return async (...args) => {
        try {
          return {
            data: await value.apply(target, args),
            error: null
          };
        } catch (error) {
          if (shouldThrowOnError) throw error;
          return {
            data: null,
            error
          };
        }
      };
    } });
  }
};
var VectorIndexApi = class extends BaseApiClient {
  /** Creates a new VectorIndexApi instance */
  constructor(url, headers = {}, fetch$1) {
    const finalUrl = url.replace(/\/$/, "");
    const finalHeaders = _objectSpread22(_objectSpread22({}, DEFAULT_HEADERS), {}, { "Content-Type": "application/json" }, headers);
    super(finalUrl, finalHeaders, fetch$1, "vectors");
  }
  /** Creates a new vector index within a bucket */
  async createIndex(options) {
    var _this = this;
    return _this.handleOperation(async () => {
      return await vectorsApi.post(_this.fetch, `${_this.url}/CreateIndex`, options, { headers: _this.headers }) || {};
    });
  }
  /** Retrieves metadata for a specific vector index */
  async getIndex(vectorBucketName, indexName) {
    var _this2 = this;
    return _this2.handleOperation(async () => {
      return await vectorsApi.post(_this2.fetch, `${_this2.url}/GetIndex`, {
        vectorBucketName,
        indexName
      }, { headers: _this2.headers });
    });
  }
  /** Lists vector indexes within a bucket with optional filtering and pagination */
  async listIndexes(options) {
    var _this3 = this;
    return _this3.handleOperation(async () => {
      return await vectorsApi.post(_this3.fetch, `${_this3.url}/ListIndexes`, options, { headers: _this3.headers });
    });
  }
  /** Deletes a vector index and all its data */
  async deleteIndex(vectorBucketName, indexName) {
    var _this4 = this;
    return _this4.handleOperation(async () => {
      return await vectorsApi.post(_this4.fetch, `${_this4.url}/DeleteIndex`, {
        vectorBucketName,
        indexName
      }, { headers: _this4.headers }) || {};
    });
  }
};
var VectorDataApi = class extends BaseApiClient {
  /** Creates a new VectorDataApi instance */
  constructor(url, headers = {}, fetch$1) {
    const finalUrl = url.replace(/\/$/, "");
    const finalHeaders = _objectSpread22(_objectSpread22({}, DEFAULT_HEADERS), {}, { "Content-Type": "application/json" }, headers);
    super(finalUrl, finalHeaders, fetch$1, "vectors");
  }
  /** Inserts or updates vectors in batch (1-500 per request) */
  async putVectors(options) {
    var _this = this;
    if (options.vectors.length < 1 || options.vectors.length > 500) throw new Error("Vector batch size must be between 1 and 500 items");
    return _this.handleOperation(async () => {
      return await vectorsApi.post(_this.fetch, `${_this.url}/PutVectors`, options, { headers: _this.headers }) || {};
    });
  }
  /** Retrieves vectors by their keys in batch */
  async getVectors(options) {
    var _this2 = this;
    return _this2.handleOperation(async () => {
      return await vectorsApi.post(_this2.fetch, `${_this2.url}/GetVectors`, options, { headers: _this2.headers });
    });
  }
  /** Lists vectors in an index with pagination */
  async listVectors(options) {
    var _this3 = this;
    if (options.segmentCount !== void 0) {
      if (options.segmentCount < 1 || options.segmentCount > 16) throw new Error("segmentCount must be between 1 and 16");
      if (options.segmentIndex !== void 0) {
        if (options.segmentIndex < 0 || options.segmentIndex >= options.segmentCount) throw new Error(`segmentIndex must be between 0 and ${options.segmentCount - 1}`);
      }
    }
    return _this3.handleOperation(async () => {
      return await vectorsApi.post(_this3.fetch, `${_this3.url}/ListVectors`, options, { headers: _this3.headers });
    });
  }
  /** Queries for similar vectors using approximate nearest neighbor search */
  async queryVectors(options) {
    var _this4 = this;
    return _this4.handleOperation(async () => {
      return await vectorsApi.post(_this4.fetch, `${_this4.url}/QueryVectors`, options, { headers: _this4.headers });
    });
  }
  /** Deletes vectors by their keys in batch (1-500 per request) */
  async deleteVectors(options) {
    var _this5 = this;
    if (options.keys.length < 1 || options.keys.length > 500) throw new Error("Keys batch size must be between 1 and 500 items");
    return _this5.handleOperation(async () => {
      return await vectorsApi.post(_this5.fetch, `${_this5.url}/DeleteVectors`, options, { headers: _this5.headers }) || {};
    });
  }
};
var VectorBucketApi = class extends BaseApiClient {
  /** Creates a new VectorBucketApi instance */
  constructor(url, headers = {}, fetch$1) {
    const finalUrl = url.replace(/\/$/, "");
    const finalHeaders = _objectSpread22(_objectSpread22({}, DEFAULT_HEADERS), {}, { "Content-Type": "application/json" }, headers);
    super(finalUrl, finalHeaders, fetch$1, "vectors");
  }
  /** Creates a new vector bucket */
  async createBucket(vectorBucketName) {
    var _this = this;
    return _this.handleOperation(async () => {
      return await vectorsApi.post(_this.fetch, `${_this.url}/CreateVectorBucket`, { vectorBucketName }, { headers: _this.headers }) || {};
    });
  }
  /** Retrieves metadata for a specific vector bucket */
  async getBucket(vectorBucketName) {
    var _this2 = this;
    return _this2.handleOperation(async () => {
      return await vectorsApi.post(_this2.fetch, `${_this2.url}/GetVectorBucket`, { vectorBucketName }, { headers: _this2.headers });
    });
  }
  /** Lists vector buckets with optional filtering and pagination */
  async listBuckets(options = {}) {
    var _this3 = this;
    return _this3.handleOperation(async () => {
      return await vectorsApi.post(_this3.fetch, `${_this3.url}/ListVectorBuckets`, options, { headers: _this3.headers });
    });
  }
  /** Deletes a vector bucket (must be empty first) */
  async deleteBucket(vectorBucketName) {
    var _this4 = this;
    return _this4.handleOperation(async () => {
      return await vectorsApi.post(_this4.fetch, `${_this4.url}/DeleteVectorBucket`, { vectorBucketName }, { headers: _this4.headers }) || {};
    });
  }
};
var StorageVectorsClient = class extends VectorBucketApi {
  /**
  * @alpha
  *
  * Creates a StorageVectorsClient that can manage buckets, indexes, and vectors.
  *
  * **Public alpha:** This API is part of a public alpha release and may not be available to your account type.
  *
  * @category Vector Buckets
  * @param url - Base URL of the Storage Vectors REST API.
  * @param options.headers - Optional headers (for example `Authorization`) applied to every request.
  * @param options.fetch - Optional custom `fetch` implementation for non-browser runtimes.
  *
  * @example
  * ```typescript
  * const client = new StorageVectorsClient(url, options)
  * ```
  */
  constructor(url, options = {}) {
    super(url, options.headers || {}, options.fetch);
  }
  /**
  *
  * @alpha
  *
  * Access operations for a specific vector bucket
  * Returns a scoped client for index and vector operations within the bucket
  *
  * **Public alpha:** This API is part of a public alpha release and may not be available to your account type.
  *
  * @category Vector Buckets
  * @param vectorBucketName - Name of the vector bucket
  * @returns Bucket-scoped client with index and vector operations
  *
  * @example
  * ```typescript
  * const bucket = supabase.storage.vectors.from('embeddings-prod')
  * ```
  */
  from(vectorBucketName) {
    return new VectorBucketScope(this.url, this.headers, vectorBucketName, this.fetch);
  }
  /**
  *
  * @alpha
  *
  * Creates a new vector bucket
  * Vector buckets are containers for vector indexes and their data
  *
  * **Public alpha:** This API is part of a public alpha release and may not be available to your account type.
  *
  * @category Vector Buckets
  * @param vectorBucketName - Unique name for the vector bucket
  * @returns Promise with empty response on success or error
  *
  * @example
  * ```typescript
  * const { data, error } = await supabase
  *   .storage
  *   .vectors
  *   .createBucket('embeddings-prod')
  * ```
  */
  async createBucket(vectorBucketName) {
    var _superprop_getCreateBucket = () => super.createBucket, _this = this;
    return _superprop_getCreateBucket().call(_this, vectorBucketName);
  }
  /**
  *
  * @alpha
  *
  * Retrieves metadata for a specific vector bucket
  *
  * **Public alpha:** This API is part of a public alpha release and may not be available to your account type.
  *
  * @category Vector Buckets
  * @param vectorBucketName - Name of the vector bucket
  * @returns Promise with bucket metadata or error
  *
  * @example
  * ```typescript
  * const { data, error } = await supabase
  *   .storage
  *   .vectors
  *   .getBucket('embeddings-prod')
  *
  * console.log('Bucket created:', data?.vectorBucket.creationTime)
  * ```
  */
  async getBucket(vectorBucketName) {
    var _superprop_getGetBucket = () => super.getBucket, _this2 = this;
    return _superprop_getGetBucket().call(_this2, vectorBucketName);
  }
  /**
  *
  * @alpha
  *
  * Lists all vector buckets with optional filtering and pagination
  *
  * **Public alpha:** This API is part of a public alpha release and may not be available to your account type.
  *
  * @category Vector Buckets
  * @param options - Optional filters (prefix, maxResults, nextToken)
  * @returns Promise with list of buckets or error
  *
  * @example
  * ```typescript
  * const { data, error } = await supabase
  *   .storage
  *   .vectors
  *   .listBuckets({ prefix: 'embeddings-' })
  *
  * data?.vectorBuckets.forEach(bucket => {
  *   console.log(bucket.vectorBucketName)
  * })
  * ```
  */
  async listBuckets(options = {}) {
    var _superprop_getListBuckets = () => super.listBuckets, _this3 = this;
    return _superprop_getListBuckets().call(_this3, options);
  }
  /**
  *
  * @alpha
  *
  * Deletes a vector bucket (bucket must be empty)
  * All indexes must be deleted before deleting the bucket
  *
  * **Public alpha:** This API is part of a public alpha release and may not be available to your account type.
  *
  * @category Vector Buckets
  * @param vectorBucketName - Name of the vector bucket to delete
  * @returns Promise with empty response on success or error
  *
  * @example
  * ```typescript
  * const { data, error } = await supabase
  *   .storage
  *   .vectors
  *   .deleteBucket('embeddings-old')
  * ```
  */
  async deleteBucket(vectorBucketName) {
    var _superprop_getDeleteBucket = () => super.deleteBucket, _this4 = this;
    return _superprop_getDeleteBucket().call(_this4, vectorBucketName);
  }
};
var VectorBucketScope = class extends VectorIndexApi {
  /**
  * @alpha
  *
  * Creates a helper that automatically scopes all index operations to the provided bucket.
  *
  * **Public alpha:** This API is part of a public alpha release and may not be available to your account type.
  *
  * @category Vector Buckets
  * @example
  * ```typescript
  * const bucket = supabase.storage.vectors.from('embeddings-prod')
  * ```
  */
  constructor(url, headers, vectorBucketName, fetch$1) {
    super(url, headers, fetch$1);
    this.vectorBucketName = vectorBucketName;
  }
  /**
  *
  * @alpha
  *
  * Creates a new vector index in this bucket
  * Convenience method that automatically includes the bucket name
  *
  * **Public alpha:** This API is part of a public alpha release and may not be available to your account type.
  *
  * @category Vector Buckets
  * @param options - Index configuration (vectorBucketName is automatically set)
  * @returns Promise with empty response on success or error
  *
  * @example
  * ```typescript
  * const bucket = supabase.storage.vectors.from('embeddings-prod')
  * await bucket.createIndex({
  *   indexName: 'documents-openai',
  *   dataType: 'float32',
  *   dimension: 1536,
  *   distanceMetric: 'cosine',
  *   metadataConfiguration: {
  *     nonFilterableMetadataKeys: ['raw_text']
  *   }
  * })
  * ```
  */
  async createIndex(options) {
    var _superprop_getCreateIndex = () => super.createIndex, _this5 = this;
    return _superprop_getCreateIndex().call(_this5, _objectSpread22(_objectSpread22({}, options), {}, { vectorBucketName: _this5.vectorBucketName }));
  }
  /**
  *
  * @alpha
  *
  * Lists indexes in this bucket
  * Convenience method that automatically includes the bucket name
  *
  * **Public alpha:** This API is part of a public alpha release and may not be available to your account type.
  *
  * @category Vector Buckets
  * @param options - Listing options (vectorBucketName is automatically set)
  * @returns Promise with response containing indexes array and pagination token or error
  *
  * @example
  * ```typescript
  * const bucket = supabase.storage.vectors.from('embeddings-prod')
  * const { data } = await bucket.listIndexes({ prefix: 'documents-' })
  * ```
  */
  async listIndexes(options = {}) {
    var _superprop_getListIndexes = () => super.listIndexes, _this6 = this;
    return _superprop_getListIndexes().call(_this6, _objectSpread22(_objectSpread22({}, options), {}, { vectorBucketName: _this6.vectorBucketName }));
  }
  /**
  *
  * @alpha
  *
  * Retrieves metadata for a specific index in this bucket
  * Convenience method that automatically includes the bucket name
  *
  * **Public alpha:** This API is part of a public alpha release and may not be available to your account type.
  *
  * @category Vector Buckets
  * @param indexName - Name of the index to retrieve
  * @returns Promise with index metadata or error
  *
  * @example
  * ```typescript
  * const bucket = supabase.storage.vectors.from('embeddings-prod')
  * const { data } = await bucket.getIndex('documents-openai')
  * console.log('Dimension:', data?.index.dimension)
  * ```
  */
  async getIndex(indexName) {
    var _superprop_getGetIndex = () => super.getIndex, _this7 = this;
    return _superprop_getGetIndex().call(_this7, _this7.vectorBucketName, indexName);
  }
  /**
  *
  * @alpha
  *
  * Deletes an index from this bucket
  * Convenience method that automatically includes the bucket name
  *
  * **Public alpha:** This API is part of a public alpha release and may not be available to your account type.
  *
  * @category Vector Buckets
  * @param indexName - Name of the index to delete
  * @returns Promise with empty response on success or error
  *
  * @example
  * ```typescript
  * const bucket = supabase.storage.vectors.from('embeddings-prod')
  * await bucket.deleteIndex('old-index')
  * ```
  */
  async deleteIndex(indexName) {
    var _superprop_getDeleteIndex = () => super.deleteIndex, _this8 = this;
    return _superprop_getDeleteIndex().call(_this8, _this8.vectorBucketName, indexName);
  }
  /**
  *
  * @alpha
  *
  * Access operations for a specific index within this bucket
  * Returns a scoped client for vector data operations
  *
  * **Public alpha:** This API is part of a public alpha release and may not be available to your account type.
  *
  * @category Vector Buckets
  * @param indexName - Name of the index
  * @returns Index-scoped client with vector data operations
  *
  * @example
  * ```typescript
  * const index = supabase.storage.vectors.from('embeddings-prod').index('documents-openai')
  *
  * // Insert vectors
  * await index.putVectors({
  *   vectors: [
  *     { key: 'doc-1', data: { float32: [...] }, metadata: { title: 'Intro' } }
  *   ]
  * })
  *
  * // Query similar vectors
  * const { data } = await index.queryVectors({
  *   queryVector: { float32: [...] },
  *   topK: 5
  * })
  * ```
  */
  index(indexName) {
    return new VectorIndexScope(this.url, this.headers, this.vectorBucketName, indexName, this.fetch);
  }
};
var VectorIndexScope = class extends VectorDataApi {
  /**
  *
  * @alpha
  *
  * Creates a helper that automatically scopes all vector operations to the provided bucket/index names.
  *
  * **Public alpha:** This API is part of a public alpha release and may not be available to your account type.
  *
  * @category Vector Buckets
  * @example
  * ```typescript
  * const index = supabase.storage.vectors.from('embeddings-prod').index('documents-openai')
  * ```
  */
  constructor(url, headers, vectorBucketName, indexName, fetch$1) {
    super(url, headers, fetch$1);
    this.vectorBucketName = vectorBucketName;
    this.indexName = indexName;
  }
  /**
  *
  * @alpha
  *
  * Inserts or updates vectors in this index
  * Convenience method that automatically includes bucket and index names
  *
  * **Public alpha:** This API is part of a public alpha release and may not be available to your account type.
  *
  * @category Vector Buckets
  * @param options - Vector insertion options (bucket and index names automatically set)
  * @returns Promise with empty response on success or error
  *
  * @example
  * ```typescript
  * const index = supabase.storage.vectors.from('embeddings-prod').index('documents-openai')
  * await index.putVectors({
  *   vectors: [
  *     {
  *       key: 'doc-1',
  *       data: { float32: [0.1, 0.2, ...] },
  *       metadata: { title: 'Introduction', page: 1 }
  *     }
  *   ]
  * })
  * ```
  */
  async putVectors(options) {
    var _superprop_getPutVectors = () => super.putVectors, _this9 = this;
    return _superprop_getPutVectors().call(_this9, _objectSpread22(_objectSpread22({}, options), {}, {
      vectorBucketName: _this9.vectorBucketName,
      indexName: _this9.indexName
    }));
  }
  /**
  *
  * @alpha
  *
  * Retrieves vectors by keys from this index
  * Convenience method that automatically includes bucket and index names
  *
  * **Public alpha:** This API is part of a public alpha release and may not be available to your account type.
  *
  * @category Vector Buckets
  * @param options - Vector retrieval options (bucket and index names automatically set)
  * @returns Promise with response containing vectors array or error
  *
  * @example
  * ```typescript
  * const index = supabase.storage.vectors.from('embeddings-prod').index('documents-openai')
  * const { data } = await index.getVectors({
  *   keys: ['doc-1', 'doc-2'],
  *   returnMetadata: true
  * })
  * ```
  */
  async getVectors(options) {
    var _superprop_getGetVectors = () => super.getVectors, _this10 = this;
    return _superprop_getGetVectors().call(_this10, _objectSpread22(_objectSpread22({}, options), {}, {
      vectorBucketName: _this10.vectorBucketName,
      indexName: _this10.indexName
    }));
  }
  /**
  *
  * @alpha
  *
  * Lists vectors in this index with pagination
  * Convenience method that automatically includes bucket and index names
  *
  * **Public alpha:** This API is part of a public alpha release and may not be available to your account type.
  *
  * @category Vector Buckets
  * @param options - Listing options (bucket and index names automatically set)
  * @returns Promise with response containing vectors array and pagination token or error
  *
  * @example
  * ```typescript
  * const index = supabase.storage.vectors.from('embeddings-prod').index('documents-openai')
  * const { data } = await index.listVectors({
  *   maxResults: 500,
  *   returnMetadata: true
  * })
  * ```
  */
  async listVectors(options = {}) {
    var _superprop_getListVectors = () => super.listVectors, _this11 = this;
    return _superprop_getListVectors().call(_this11, _objectSpread22(_objectSpread22({}, options), {}, {
      vectorBucketName: _this11.vectorBucketName,
      indexName: _this11.indexName
    }));
  }
  /**
  *
  * @alpha
  *
  * Queries for similar vectors in this index
  * Convenience method that automatically includes bucket and index names
  *
  * **Public alpha:** This API is part of a public alpha release and may not be available to your account type.
  *
  * @category Vector Buckets
  * @param options - Query options (bucket and index names automatically set)
  * @returns Promise with response containing matches array of similar vectors ordered by distance or error
  *
  * @example
  * ```typescript
  * const index = supabase.storage.vectors.from('embeddings-prod').index('documents-openai')
  * const { data } = await index.queryVectors({
  *   queryVector: { float32: [0.1, 0.2, ...] },
  *   topK: 5,
  *   filter: { category: 'technical' },
  *   returnDistance: true,
  *   returnMetadata: true
  * })
  * ```
  */
  async queryVectors(options) {
    var _superprop_getQueryVectors = () => super.queryVectors, _this12 = this;
    return _superprop_getQueryVectors().call(_this12, _objectSpread22(_objectSpread22({}, options), {}, {
      vectorBucketName: _this12.vectorBucketName,
      indexName: _this12.indexName
    }));
  }
  /**
  *
  * @alpha
  *
  * Deletes vectors by keys from this index
  * Convenience method that automatically includes bucket and index names
  *
  * **Public alpha:** This API is part of a public alpha release and may not be available to your account type.
  *
  * @category Vector Buckets
  * @param options - Deletion options (bucket and index names automatically set)
  * @returns Promise with empty response on success or error
  *
  * @example
  * ```typescript
  * const index = supabase.storage.vectors.from('embeddings-prod').index('documents-openai')
  * await index.deleteVectors({
  *   keys: ['doc-1', 'doc-2', 'doc-3']
  * })
  * ```
  */
  async deleteVectors(options) {
    var _superprop_getDeleteVectors = () => super.deleteVectors, _this13 = this;
    return _superprop_getDeleteVectors().call(_this13, _objectSpread22(_objectSpread22({}, options), {}, {
      vectorBucketName: _this13.vectorBucketName,
      indexName: _this13.indexName
    }));
  }
};
var StorageClient = class extends StorageBucketApi {
  /**
  * Creates a client for Storage buckets, files, analytics, and vectors.
  *
  * @category File Buckets
  * @example
  * ```ts
  * import { StorageClient } from '@supabase/storage-js'
  *
  * const storage = new StorageClient('https://xyzcompany.supabase.co/storage/v1', {
  *   apikey: 'public-anon-key',
  * })
  * const avatars = storage.from('avatars')
  * ```
  */
  constructor(url, headers = {}, fetch$1, opts) {
    super(url, headers, fetch$1, opts);
  }
  /**
  * Perform file operation in a bucket.
  *
  * @category File Buckets
  * @param id The bucket id to operate on.
  *
  * @example
  * ```typescript
  * const avatars = supabase.storage.from('avatars')
  * ```
  */
  from(id) {
    return new StorageFileApi(this.url, this.headers, id, this.fetch);
  }
  /**
  *
  * @alpha
  *
  * Access vector storage operations.
  *
  * **Public alpha:** This API is part of a public alpha release and may not be available to your account type.
  *
  * @category Vector Buckets
  * @returns A StorageVectorsClient instance configured with the current storage settings.
  */
  get vectors() {
    return new StorageVectorsClient(this.url + "/vector", {
      headers: this.headers,
      fetch: this.fetch
    });
  }
  /**
  *
  * @alpha
  *
  * Access analytics storage operations using Iceberg tables.
  *
  * **Public alpha:** This API is part of a public alpha release and may not be available to your account type.
  *
  * @category Analytics Buckets
  * @returns A StorageAnalyticsClient instance configured with the current storage settings.
  */
  get analytics() {
    return new StorageAnalyticsClient(this.url + "/iceberg", this.headers, this.fetch);
  }
};

// node_modules/@supabase/auth-js/dist/module/lib/version.js
var version3 = "2.95.3";

// node_modules/@supabase/auth-js/dist/module/lib/constants.js
var AUTO_REFRESH_TICK_DURATION_MS = 30 * 1e3;
var AUTO_REFRESH_TICK_THRESHOLD = 3;
var EXPIRY_MARGIN_MS = AUTO_REFRESH_TICK_THRESHOLD * AUTO_REFRESH_TICK_DURATION_MS;
var GOTRUE_URL = "http://localhost:9999";
var STORAGE_KEY2 = "supabase.auth.token";
var DEFAULT_HEADERS2 = { "X-Client-Info": `gotrue-js/${version3}` };
var API_VERSION_HEADER_NAME = "X-Supabase-Api-Version";
var API_VERSIONS = {
  "2024-01-01": {
    timestamp: Date.parse("2024-01-01T00:00:00.0Z"),
    name: "2024-01-01"
  }
};
var BASE64URL_REGEX = /^([a-z0-9_-]{4})*($|[a-z0-9_-]{3}$|[a-z0-9_-]{2}$)$/i;
var JWKS_TTL = 10 * 60 * 1e3;

// node_modules/@supabase/auth-js/dist/module/lib/errors.js
var AuthError = class extends Error {
  constructor(message, status, code) {
    super(message);
    this.__isAuthError = true;
    this.name = "AuthError";
    this.status = status;
    this.code = code;
  }
};
function isAuthError(error) {
  return typeof error === "object" && error !== null && "__isAuthError" in error;
}
var AuthApiError = class extends AuthError {
  constructor(message, status, code) {
    super(message, status, code);
    this.name = "AuthApiError";
    this.status = status;
    this.code = code;
  }
};
function isAuthApiError(error) {
  return isAuthError(error) && error.name === "AuthApiError";
}
var AuthUnknownError = class extends AuthError {
  constructor(message, originalError) {
    super(message);
    this.name = "AuthUnknownError";
    this.originalError = originalError;
  }
};
var CustomAuthError = class extends AuthError {
  constructor(message, name, status, code) {
    super(message, status, code);
    this.name = name;
    this.status = status;
  }
};
var AuthSessionMissingError = class extends CustomAuthError {
  constructor() {
    super("Auth session missing!", "AuthSessionMissingError", 400, void 0);
  }
};
function isAuthSessionMissingError(error) {
  return isAuthError(error) && error.name === "AuthSessionMissingError";
}
var AuthInvalidTokenResponseError = class extends CustomAuthError {
  constructor() {
    super("Auth session or user missing", "AuthInvalidTokenResponseError", 500, void 0);
  }
};
var AuthInvalidCredentialsError = class extends CustomAuthError {
  constructor(message) {
    super(message, "AuthInvalidCredentialsError", 400, void 0);
  }
};
var AuthImplicitGrantRedirectError = class extends CustomAuthError {
  constructor(message, details = null) {
    super(message, "AuthImplicitGrantRedirectError", 500, void 0);
    this.details = null;
    this.details = details;
  }
  toJSON() {
    return {
      name: this.name,
      message: this.message,
      status: this.status,
      details: this.details
    };
  }
};
function isAuthImplicitGrantRedirectError(error) {
  return isAuthError(error) && error.name === "AuthImplicitGrantRedirectError";
}
var AuthPKCEGrantCodeExchangeError = class extends CustomAuthError {
  constructor(message, details = null) {
    super(message, "AuthPKCEGrantCodeExchangeError", 500, void 0);
    this.details = null;
    this.details = details;
  }
  toJSON() {
    return {
      name: this.name,
      message: this.message,
      status: this.status,
      details: this.details
    };
  }
};
var AuthPKCECodeVerifierMissingError = class extends CustomAuthError {
  constructor() {
    super("PKCE code verifier not found in storage. This can happen if the auth flow was initiated in a different browser or device, or if the storage was cleared. For SSR frameworks (Next.js, SvelteKit, etc.), use @supabase/ssr on both the server and client to store the code verifier in cookies.", "AuthPKCECodeVerifierMissingError", 400, "pkce_code_verifier_not_found");
  }
};
var AuthRetryableFetchError = class extends CustomAuthError {
  constructor(message, status) {
    super(message, "AuthRetryableFetchError", status, void 0);
  }
};
function isAuthRetryableFetchError(error) {
  return isAuthError(error) && error.name === "AuthRetryableFetchError";
}
var AuthWeakPasswordError = class extends CustomAuthError {
  constructor(message, status, reasons) {
    super(message, "AuthWeakPasswordError", status, "weak_password");
    this.reasons = reasons;
  }
};
var AuthInvalidJwtError = class extends CustomAuthError {
  constructor(message) {
    super(message, "AuthInvalidJwtError", 400, "invalid_jwt");
  }
};

// node_modules/@supabase/auth-js/dist/module/lib/base64url.js
var TO_BASE64URL = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_".split("");
var IGNORE_BASE64URL = " 	\n\r=".split("");
var FROM_BASE64URL = (() => {
  const charMap = new Array(128);
  for (let i = 0; i < charMap.length; i += 1) {
    charMap[i] = -1;
  }
  for (let i = 0; i < IGNORE_BASE64URL.length; i += 1) {
    charMap[IGNORE_BASE64URL[i].charCodeAt(0)] = -2;
  }
  for (let i = 0; i < TO_BASE64URL.length; i += 1) {
    charMap[TO_BASE64URL[i].charCodeAt(0)] = i;
  }
  return charMap;
})();
function byteToBase64URL(byte, state, emit) {
  if (byte !== null) {
    state.queue = state.queue << 8 | byte;
    state.queuedBits += 8;
    while (state.queuedBits >= 6) {
      const pos = state.queue >> state.queuedBits - 6 & 63;
      emit(TO_BASE64URL[pos]);
      state.queuedBits -= 6;
    }
  } else if (state.queuedBits > 0) {
    state.queue = state.queue << 6 - state.queuedBits;
    state.queuedBits = 6;
    while (state.queuedBits >= 6) {
      const pos = state.queue >> state.queuedBits - 6 & 63;
      emit(TO_BASE64URL[pos]);
      state.queuedBits -= 6;
    }
  }
}
function byteFromBase64URL(charCode, state, emit) {
  const bits = FROM_BASE64URL[charCode];
  if (bits > -1) {
    state.queue = state.queue << 6 | bits;
    state.queuedBits += 6;
    while (state.queuedBits >= 8) {
      emit(state.queue >> state.queuedBits - 8 & 255);
      state.queuedBits -= 8;
    }
  } else if (bits === -2) {
    return;
  } else {
    throw new Error(`Invalid Base64-URL character "${String.fromCharCode(charCode)}"`);
  }
}
function stringFromBase64URL(str) {
  const conv = [];
  const utf8Emit = (codepoint) => {
    conv.push(String.fromCodePoint(codepoint));
  };
  const utf8State = {
    utf8seq: 0,
    codepoint: 0
  };
  const b64State = { queue: 0, queuedBits: 0 };
  const byteEmit = (byte) => {
    stringFromUTF8(byte, utf8State, utf8Emit);
  };
  for (let i = 0; i < str.length; i += 1) {
    byteFromBase64URL(str.charCodeAt(i), b64State, byteEmit);
  }
  return conv.join("");
}
function codepointToUTF8(codepoint, emit) {
  if (codepoint <= 127) {
    emit(codepoint);
    return;
  } else if (codepoint <= 2047) {
    emit(192 | codepoint >> 6);
    emit(128 | codepoint & 63);
    return;
  } else if (codepoint <= 65535) {
    emit(224 | codepoint >> 12);
    emit(128 | codepoint >> 6 & 63);
    emit(128 | codepoint & 63);
    return;
  } else if (codepoint <= 1114111) {
    emit(240 | codepoint >> 18);
    emit(128 | codepoint >> 12 & 63);
    emit(128 | codepoint >> 6 & 63);
    emit(128 | codepoint & 63);
    return;
  }
  throw new Error(`Unrecognized Unicode codepoint: ${codepoint.toString(16)}`);
}
function stringToUTF8(str, emit) {
  for (let i = 0; i < str.length; i += 1) {
    let codepoint = str.charCodeAt(i);
    if (codepoint > 55295 && codepoint <= 56319) {
      const highSurrogate = (codepoint - 55296) * 1024 & 65535;
      const lowSurrogate = str.charCodeAt(i + 1) - 56320 & 65535;
      codepoint = (lowSurrogate | highSurrogate) + 65536;
      i += 1;
    }
    codepointToUTF8(codepoint, emit);
  }
}
function stringFromUTF8(byte, state, emit) {
  if (state.utf8seq === 0) {
    if (byte <= 127) {
      emit(byte);
      return;
    }
    for (let leadingBit = 1; leadingBit < 6; leadingBit += 1) {
      if ((byte >> 7 - leadingBit & 1) === 0) {
        state.utf8seq = leadingBit;
        break;
      }
    }
    if (state.utf8seq === 2) {
      state.codepoint = byte & 31;
    } else if (state.utf8seq === 3) {
      state.codepoint = byte & 15;
    } else if (state.utf8seq === 4) {
      state.codepoint = byte & 7;
    } else {
      throw new Error("Invalid UTF-8 sequence");
    }
    state.utf8seq -= 1;
  } else if (state.utf8seq > 0) {
    if (byte <= 127) {
      throw new Error("Invalid UTF-8 sequence");
    }
    state.codepoint = state.codepoint << 6 | byte & 63;
    state.utf8seq -= 1;
    if (state.utf8seq === 0) {
      emit(state.codepoint);
    }
  }
}
function base64UrlToUint8Array(str) {
  const result = [];
  const state = { queue: 0, queuedBits: 0 };
  const onByte = (byte) => {
    result.push(byte);
  };
  for (let i = 0; i < str.length; i += 1) {
    byteFromBase64URL(str.charCodeAt(i), state, onByte);
  }
  return new Uint8Array(result);
}
function stringToUint8Array(str) {
  const result = [];
  stringToUTF8(str, (byte) => result.push(byte));
  return new Uint8Array(result);
}
function bytesToBase64URL(bytes) {
  const result = [];
  const state = { queue: 0, queuedBits: 0 };
  const onChar = (char) => {
    result.push(char);
  };
  bytes.forEach((byte) => byteToBase64URL(byte, state, onChar));
  byteToBase64URL(null, state, onChar);
  return result.join("");
}

// node_modules/@supabase/auth-js/dist/module/lib/helpers.js
function expiresAt(expiresIn) {
  const timeNow = Math.round(Date.now() / 1e3);
  return timeNow + expiresIn;
}
function generateCallbackId() {
  return Symbol("auth-callback");
}
var isBrowser = () => typeof window !== "undefined" && typeof document !== "undefined";
var localStorageWriteTests = {
  tested: false,
  writable: false
};
var supportsLocalStorage = () => {
  if (!isBrowser()) {
    return false;
  }
  try {
    if (typeof globalThis.localStorage !== "object") {
      return false;
    }
  } catch (e) {
    return false;
  }
  if (localStorageWriteTests.tested) {
    return localStorageWriteTests.writable;
  }
  const randomKey = `lswt-${Math.random()}${Math.random()}`;
  try {
    globalThis.localStorage.setItem(randomKey, randomKey);
    globalThis.localStorage.removeItem(randomKey);
    localStorageWriteTests.tested = true;
    localStorageWriteTests.writable = true;
  } catch (e) {
    localStorageWriteTests.tested = true;
    localStorageWriteTests.writable = false;
  }
  return localStorageWriteTests.writable;
};
function parseParametersFromURL(href) {
  const result = {};
  const url = new URL(href);
  if (url.hash && url.hash[0] === "#") {
    try {
      const hashSearchParams = new URLSearchParams(url.hash.substring(1));
      hashSearchParams.forEach((value, key) => {
        result[key] = value;
      });
    } catch (e) {
    }
  }
  url.searchParams.forEach((value, key) => {
    result[key] = value;
  });
  return result;
}
var resolveFetch3 = (customFetch) => {
  if (customFetch) {
    return (...args) => customFetch(...args);
  }
  return (...args) => fetch(...args);
};
var looksLikeFetchResponse = (maybeResponse) => {
  return typeof maybeResponse === "object" && maybeResponse !== null && "status" in maybeResponse && "ok" in maybeResponse && "json" in maybeResponse && typeof maybeResponse.json === "function";
};
var setItemAsync = async (storage, key, data) => {
  await storage.setItem(key, JSON.stringify(data));
};
var getItemAsync = async (storage, key) => {
  const value = await storage.getItem(key);
  if (!value) {
    return null;
  }
  try {
    return JSON.parse(value);
  } catch (_a) {
    return value;
  }
};
var removeItemAsync = async (storage, key) => {
  await storage.removeItem(key);
};
var Deferred = class _Deferred {
  constructor() {
    ;
    this.promise = new _Deferred.promiseConstructor((res, rej) => {
      ;
      this.resolve = res;
      this.reject = rej;
    });
  }
};
Deferred.promiseConstructor = Promise;
function decodeJWT(token) {
  const parts = token.split(".");
  if (parts.length !== 3) {
    throw new AuthInvalidJwtError("Invalid JWT structure");
  }
  for (let i = 0; i < parts.length; i++) {
    if (!BASE64URL_REGEX.test(parts[i])) {
      throw new AuthInvalidJwtError("JWT not in base64url format");
    }
  }
  const data = {
    // using base64url lib
    header: JSON.parse(stringFromBase64URL(parts[0])),
    payload: JSON.parse(stringFromBase64URL(parts[1])),
    signature: base64UrlToUint8Array(parts[2]),
    raw: {
      header: parts[0],
      payload: parts[1]
    }
  };
  return data;
}
async function sleep(time) {
  return await new Promise((accept) => {
    setTimeout(() => accept(null), time);
  });
}
function retryable(fn, isRetryable) {
  const promise = new Promise((accept, reject) => {
    ;
    (async () => {
      for (let attempt = 0; attempt < Infinity; attempt++) {
        try {
          const result = await fn(attempt);
          if (!isRetryable(attempt, null, result)) {
            accept(result);
            return;
          }
        } catch (e) {
          if (!isRetryable(attempt, e)) {
            reject(e);
            return;
          }
        }
      }
    })();
  });
  return promise;
}
function dec2hex(dec) {
  return ("0" + dec.toString(16)).substr(-2);
}
function generatePKCEVerifier() {
  const verifierLength = 56;
  const array = new Uint32Array(verifierLength);
  if (typeof crypto === "undefined") {
    const charSet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";
    const charSetLen = charSet.length;
    let verifier = "";
    for (let i = 0; i < verifierLength; i++) {
      verifier += charSet.charAt(Math.floor(Math.random() * charSetLen));
    }
    return verifier;
  }
  crypto.getRandomValues(array);
  return Array.from(array, dec2hex).join("");
}
async function sha256(randomString) {
  const encoder = new TextEncoder();
  const encodedData = encoder.encode(randomString);
  const hash = await crypto.subtle.digest("SHA-256", encodedData);
  const bytes = new Uint8Array(hash);
  return Array.from(bytes).map((c) => String.fromCharCode(c)).join("");
}
async function generatePKCEChallenge(verifier) {
  const hasCryptoSupport = typeof crypto !== "undefined" && typeof crypto.subtle !== "undefined" && typeof TextEncoder !== "undefined";
  if (!hasCryptoSupport) {
    console.warn("WebCrypto API is not supported. Code challenge method will default to use plain instead of sha256.");
    return verifier;
  }
  const hashed = await sha256(verifier);
  return btoa(hashed).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
async function getCodeChallengeAndMethod(storage, storageKey, isPasswordRecovery = false) {
  const codeVerifier = generatePKCEVerifier();
  let storedCodeVerifier = codeVerifier;
  if (isPasswordRecovery) {
    storedCodeVerifier += "/PASSWORD_RECOVERY";
  }
  await setItemAsync(storage, `${storageKey}-code-verifier`, storedCodeVerifier);
  const codeChallenge = await generatePKCEChallenge(codeVerifier);
  const codeChallengeMethod = codeVerifier === codeChallenge ? "plain" : "s256";
  return [codeChallenge, codeChallengeMethod];
}
var API_VERSION_REGEX = /^2[0-9]{3}-(0[1-9]|1[0-2])-(0[1-9]|1[0-9]|2[0-9]|3[0-1])$/i;
function parseResponseAPIVersion(response) {
  const apiVersion = response.headers.get(API_VERSION_HEADER_NAME);
  if (!apiVersion) {
    return null;
  }
  if (!apiVersion.match(API_VERSION_REGEX)) {
    return null;
  }
  try {
    const date = /* @__PURE__ */ new Date(`${apiVersion}T00:00:00.0Z`);
    return date;
  } catch (e) {
    return null;
  }
}
function validateExp(exp) {
  if (!exp) {
    throw new Error("Missing exp claim");
  }
  const timeNow = Math.floor(Date.now() / 1e3);
  if (exp <= timeNow) {
    throw new Error("JWT has expired");
  }
}
function getAlgorithm(alg) {
  switch (alg) {
    case "RS256":
      return {
        name: "RSASSA-PKCS1-v1_5",
        hash: { name: "SHA-256" }
      };
    case "ES256":
      return {
        name: "ECDSA",
        namedCurve: "P-256",
        hash: { name: "SHA-256" }
      };
    default:
      throw new Error("Invalid alg claim");
  }
}
var UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
function validateUUID(str) {
  if (!UUID_REGEX.test(str)) {
    throw new Error("@supabase/auth-js: Expected parameter to be UUID but is not");
  }
}
function userNotAvailableProxy() {
  const proxyTarget = {};
  return new Proxy(proxyTarget, {
    get: (target, prop) => {
      if (prop === "__isUserNotAvailableProxy") {
        return true;
      }
      if (typeof prop === "symbol") {
        const sProp = prop.toString();
        if (sProp === "Symbol(Symbol.toPrimitive)" || sProp === "Symbol(Symbol.toStringTag)" || sProp === "Symbol(util.inspect.custom)") {
          return void 0;
        }
      }
      throw new Error(`@supabase/auth-js: client was created with userStorage option and there was no user stored in the user storage. Accessing the "${prop}" property of the session object is not supported. Please use getUser() instead.`);
    },
    set: (_target, prop) => {
      throw new Error(`@supabase/auth-js: client was created with userStorage option and there was no user stored in the user storage. Setting the "${prop}" property of the session object is not supported. Please use getUser() to fetch a user object you can manipulate.`);
    },
    deleteProperty: (_target, prop) => {
      throw new Error(`@supabase/auth-js: client was created with userStorage option and there was no user stored in the user storage. Deleting the "${prop}" property of the session object is not supported. Please use getUser() to fetch a user object you can manipulate.`);
    }
  });
}
function insecureUserWarningProxy(user, suppressWarningRef) {
  return new Proxy(user, {
    get: (target, prop, receiver) => {
      if (prop === "__isInsecureUserWarningProxy") {
        return true;
      }
      if (typeof prop === "symbol") {
        const sProp = prop.toString();
        if (sProp === "Symbol(Symbol.toPrimitive)" || sProp === "Symbol(Symbol.toStringTag)" || sProp === "Symbol(util.inspect.custom)" || sProp === "Symbol(nodejs.util.inspect.custom)") {
          return Reflect.get(target, prop, receiver);
        }
      }
      if (!suppressWarningRef.value && typeof prop === "string") {
        console.warn("Using the user object as returned from supabase.auth.getSession() or from some supabase.auth.onAuthStateChange() events could be insecure! This value comes directly from the storage medium (usually cookies on the server) and may not be authentic. Use supabase.auth.getUser() instead which authenticates the data by contacting the Supabase Auth server.");
        suppressWarningRef.value = true;
      }
      return Reflect.get(target, prop, receiver);
    }
  });
}
function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

// node_modules/@supabase/auth-js/dist/module/lib/fetch.js
var _getErrorMessage2 = (err) => err.msg || err.message || err.error_description || err.error || JSON.stringify(err);
var NETWORK_ERROR_CODES = [502, 503, 504];
async function handleError2(error) {
  var _a;
  if (!looksLikeFetchResponse(error)) {
    throw new AuthRetryableFetchError(_getErrorMessage2(error), 0);
  }
  if (NETWORK_ERROR_CODES.includes(error.status)) {
    throw new AuthRetryableFetchError(_getErrorMessage2(error), error.status);
  }
  let data;
  try {
    data = await error.json();
  } catch (e) {
    throw new AuthUnknownError(_getErrorMessage2(e), e);
  }
  let errorCode = void 0;
  const responseAPIVersion = parseResponseAPIVersion(error);
  if (responseAPIVersion && responseAPIVersion.getTime() >= API_VERSIONS["2024-01-01"].timestamp && typeof data === "object" && data && typeof data.code === "string") {
    errorCode = data.code;
  } else if (typeof data === "object" && data && typeof data.error_code === "string") {
    errorCode = data.error_code;
  }
  if (!errorCode) {
    if (typeof data === "object" && data && typeof data.weak_password === "object" && data.weak_password && Array.isArray(data.weak_password.reasons) && data.weak_password.reasons.length && data.weak_password.reasons.reduce((a, i) => a && typeof i === "string", true)) {
      throw new AuthWeakPasswordError(_getErrorMessage2(data), error.status, data.weak_password.reasons);
    }
  } else if (errorCode === "weak_password") {
    throw new AuthWeakPasswordError(_getErrorMessage2(data), error.status, ((_a = data.weak_password) === null || _a === void 0 ? void 0 : _a.reasons) || []);
  } else if (errorCode === "session_not_found") {
    throw new AuthSessionMissingError();
  }
  throw new AuthApiError(_getErrorMessage2(data), error.status || 500, errorCode);
}
var _getRequestParams2 = (method, options, parameters, body) => {
  const params = { method, headers: (options === null || options === void 0 ? void 0 : options.headers) || {} };
  if (method === "GET") {
    return params;
  }
  params.headers = Object.assign({ "Content-Type": "application/json;charset=UTF-8" }, options === null || options === void 0 ? void 0 : options.headers);
  params.body = JSON.stringify(body);
  return Object.assign(Object.assign({}, params), parameters);
};
async function _request(fetcher, method, url, options) {
  var _a;
  const headers = Object.assign({}, options === null || options === void 0 ? void 0 : options.headers);
  if (!headers[API_VERSION_HEADER_NAME]) {
    headers[API_VERSION_HEADER_NAME] = API_VERSIONS["2024-01-01"].name;
  }
  if (options === null || options === void 0 ? void 0 : options.jwt) {
    headers["Authorization"] = `Bearer ${options.jwt}`;
  }
  const qs = (_a = options === null || options === void 0 ? void 0 : options.query) !== null && _a !== void 0 ? _a : {};
  if (options === null || options === void 0 ? void 0 : options.redirectTo) {
    qs["redirect_to"] = options.redirectTo;
  }
  const queryString = Object.keys(qs).length ? "?" + new URLSearchParams(qs).toString() : "";
  const data = await _handleRequest2(fetcher, method, url + queryString, {
    headers,
    noResolveJson: options === null || options === void 0 ? void 0 : options.noResolveJson
  }, {}, options === null || options === void 0 ? void 0 : options.body);
  return (options === null || options === void 0 ? void 0 : options.xform) ? options === null || options === void 0 ? void 0 : options.xform(data) : { data: Object.assign({}, data), error: null };
}
async function _handleRequest2(fetcher, method, url, options, parameters, body) {
  const requestParams = _getRequestParams2(method, options, parameters, body);
  let result;
  try {
    result = await fetcher(url, Object.assign({}, requestParams));
  } catch (e) {
    console.error(e);
    throw new AuthRetryableFetchError(_getErrorMessage2(e), 0);
  }
  if (!result.ok) {
    await handleError2(result);
  }
  if (options === null || options === void 0 ? void 0 : options.noResolveJson) {
    return result;
  }
  try {
    return await result.json();
  } catch (e) {
    await handleError2(e);
  }
}
function _sessionResponse(data) {
  var _a;
  let session = null;
  if (hasSession(data)) {
    session = Object.assign({}, data);
    if (!data.expires_at) {
      session.expires_at = expiresAt(data.expires_in);
    }
  }
  const user = (_a = data.user) !== null && _a !== void 0 ? _a : data;
  return { data: { session, user }, error: null };
}
function _sessionResponsePassword(data) {
  const response = _sessionResponse(data);
  if (!response.error && data.weak_password && typeof data.weak_password === "object" && Array.isArray(data.weak_password.reasons) && data.weak_password.reasons.length && data.weak_password.message && typeof data.weak_password.message === "string" && data.weak_password.reasons.reduce((a, i) => a && typeof i === "string", true)) {
    response.data.weak_password = data.weak_password;
  }
  return response;
}
function _userResponse(data) {
  var _a;
  const user = (_a = data.user) !== null && _a !== void 0 ? _a : data;
  return { data: { user }, error: null };
}
function _ssoResponse(data) {
  return { data, error: null };
}
function _generateLinkResponse(data) {
  const { action_link, email_otp, hashed_token, redirect_to, verification_type } = data, rest = __rest(data, ["action_link", "email_otp", "hashed_token", "redirect_to", "verification_type"]);
  const properties = {
    action_link,
    email_otp,
    hashed_token,
    redirect_to,
    verification_type
  };
  const user = Object.assign({}, rest);
  return {
    data: {
      properties,
      user
    },
    error: null
  };
}
function _noResolveJsonResponse(data) {
  return data;
}
function hasSession(data) {
  return data.access_token && data.refresh_token && data.expires_in;
}

// node_modules/@supabase/auth-js/dist/module/lib/types.js
var SIGN_OUT_SCOPES = ["global", "local", "others"];

// node_modules/@supabase/auth-js/dist/module/GoTrueAdminApi.js
var GoTrueAdminApi = class {
  /**
   * Creates an admin API client that can be used to manage users and OAuth clients.
   *
   * @example
   * ```ts
   * import { GoTrueAdminApi } from '@supabase/auth-js'
   *
   * const admin = new GoTrueAdminApi({
   *   url: 'https://xyzcompany.supabase.co/auth/v1',
   *   headers: { Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}` },
   * })
   * ```
   */
  constructor({ url = "", headers = {}, fetch: fetch2 }) {
    this.url = url;
    this.headers = headers;
    this.fetch = resolveFetch3(fetch2);
    this.mfa = {
      listFactors: this._listFactors.bind(this),
      deleteFactor: this._deleteFactor.bind(this)
    };
    this.oauth = {
      listClients: this._listOAuthClients.bind(this),
      createClient: this._createOAuthClient.bind(this),
      getClient: this._getOAuthClient.bind(this),
      updateClient: this._updateOAuthClient.bind(this),
      deleteClient: this._deleteOAuthClient.bind(this),
      regenerateClientSecret: this._regenerateOAuthClientSecret.bind(this)
    };
  }
  /**
   * Removes a logged-in session.
   * @param jwt A valid, logged-in JWT.
   * @param scope The logout sope.
   */
  async signOut(jwt, scope = SIGN_OUT_SCOPES[0]) {
    if (SIGN_OUT_SCOPES.indexOf(scope) < 0) {
      throw new Error(`@supabase/auth-js: Parameter scope must be one of ${SIGN_OUT_SCOPES.join(", ")}`);
    }
    try {
      await _request(this.fetch, "POST", `${this.url}/logout?scope=${scope}`, {
        headers: this.headers,
        jwt,
        noResolveJson: true
      });
      return { data: null, error: null };
    } catch (error) {
      if (isAuthError(error)) {
        return { data: null, error };
      }
      throw error;
    }
  }
  /**
   * Sends an invite link to an email address.
   * @param email The email address of the user.
   * @param options Additional options to be included when inviting.
   */
  async inviteUserByEmail(email, options = {}) {
    try {
      return await _request(this.fetch, "POST", `${this.url}/invite`, {
        body: { email, data: options.data },
        headers: this.headers,
        redirectTo: options.redirectTo,
        xform: _userResponse
      });
    } catch (error) {
      if (isAuthError(error)) {
        return { data: { user: null }, error };
      }
      throw error;
    }
  }
  /**
   * Generates email links and OTPs to be sent via a custom email provider.
   * @param email The user's email.
   * @param options.password User password. For signup only.
   * @param options.data Optional user metadata. For signup only.
   * @param options.redirectTo The redirect url which should be appended to the generated link
   */
  async generateLink(params) {
    try {
      const { options } = params, rest = __rest(params, ["options"]);
      const body = Object.assign(Object.assign({}, rest), options);
      if ("newEmail" in rest) {
        body.new_email = rest === null || rest === void 0 ? void 0 : rest.newEmail;
        delete body["newEmail"];
      }
      return await _request(this.fetch, "POST", `${this.url}/admin/generate_link`, {
        body,
        headers: this.headers,
        xform: _generateLinkResponse,
        redirectTo: options === null || options === void 0 ? void 0 : options.redirectTo
      });
    } catch (error) {
      if (isAuthError(error)) {
        return {
          data: {
            properties: null,
            user: null
          },
          error
        };
      }
      throw error;
    }
  }
  // User Admin API
  /**
   * Creates a new user.
   * This function should only be called on a server. Never expose your `service_role` key in the browser.
   */
  async createUser(attributes) {
    try {
      return await _request(this.fetch, "POST", `${this.url}/admin/users`, {
        body: attributes,
        headers: this.headers,
        xform: _userResponse
      });
    } catch (error) {
      if (isAuthError(error)) {
        return { data: { user: null }, error };
      }
      throw error;
    }
  }
  /**
   * Get a list of users.
   *
   * This function should only be called on a server. Never expose your `service_role` key in the browser.
   * @param params An object which supports `page` and `perPage` as numbers, to alter the paginated results.
   */
  async listUsers(params) {
    var _a, _b, _c, _d, _e, _f, _g;
    try {
      const pagination = { nextPage: null, lastPage: 0, total: 0 };
      const response = await _request(this.fetch, "GET", `${this.url}/admin/users`, {
        headers: this.headers,
        noResolveJson: true,
        query: {
          page: (_b = (_a = params === null || params === void 0 ? void 0 : params.page) === null || _a === void 0 ? void 0 : _a.toString()) !== null && _b !== void 0 ? _b : "",
          per_page: (_d = (_c = params === null || params === void 0 ? void 0 : params.perPage) === null || _c === void 0 ? void 0 : _c.toString()) !== null && _d !== void 0 ? _d : ""
        },
        xform: _noResolveJsonResponse
      });
      if (response.error)
        throw response.error;
      const users = await response.json();
      const total = (_e = response.headers.get("x-total-count")) !== null && _e !== void 0 ? _e : 0;
      const links = (_g = (_f = response.headers.get("link")) === null || _f === void 0 ? void 0 : _f.split(",")) !== null && _g !== void 0 ? _g : [];
      if (links.length > 0) {
        links.forEach((link) => {
          const page = parseInt(link.split(";")[0].split("=")[1].substring(0, 1));
          const rel = JSON.parse(link.split(";")[1].split("=")[1]);
          pagination[`${rel}Page`] = page;
        });
        pagination.total = parseInt(total);
      }
      return { data: Object.assign(Object.assign({}, users), pagination), error: null };
    } catch (error) {
      if (isAuthError(error)) {
        return { data: { users: [] }, error };
      }
      throw error;
    }
  }
  /**
   * Get user by id.
   *
   * @param uid The user's unique identifier
   *
   * This function should only be called on a server. Never expose your `service_role` key in the browser.
   */
  async getUserById(uid) {
    validateUUID(uid);
    try {
      return await _request(this.fetch, "GET", `${this.url}/admin/users/${uid}`, {
        headers: this.headers,
        xform: _userResponse
      });
    } catch (error) {
      if (isAuthError(error)) {
        return { data: { user: null }, error };
      }
      throw error;
    }
  }
  /**
   * Updates the user data. Changes are applied directly without confirmation flows.
   *
   * @param attributes The data you want to update.
   *
   * This function should only be called on a server. Never expose your `service_role` key in the browser.
   */
  async updateUserById(uid, attributes) {
    validateUUID(uid);
    try {
      return await _request(this.fetch, "PUT", `${this.url}/admin/users/${uid}`, {
        body: attributes,
        headers: this.headers,
        xform: _userResponse
      });
    } catch (error) {
      if (isAuthError(error)) {
        return { data: { user: null }, error };
      }
      throw error;
    }
  }
  /**
   * Delete a user. Requires a `service_role` key.
   *
   * @param id The user id you want to remove.
   * @param shouldSoftDelete If true, then the user will be soft-deleted from the auth schema. Soft deletion allows user identification from the hashed user ID but is not reversible.
   * Defaults to false for backward compatibility.
   *
   * This function should only be called on a server. Never expose your `service_role` key in the browser.
   */
  async deleteUser(id, shouldSoftDelete = false) {
    validateUUID(id);
    try {
      return await _request(this.fetch, "DELETE", `${this.url}/admin/users/${id}`, {
        headers: this.headers,
        body: {
          should_soft_delete: shouldSoftDelete
        },
        xform: _userResponse
      });
    } catch (error) {
      if (isAuthError(error)) {
        return { data: { user: null }, error };
      }
      throw error;
    }
  }
  async _listFactors(params) {
    validateUUID(params.userId);
    try {
      const { data, error } = await _request(this.fetch, "GET", `${this.url}/admin/users/${params.userId}/factors`, {
        headers: this.headers,
        xform: (factors) => {
          return { data: { factors }, error: null };
        }
      });
      return { data, error };
    } catch (error) {
      if (isAuthError(error)) {
        return { data: null, error };
      }
      throw error;
    }
  }
  async _deleteFactor(params) {
    validateUUID(params.userId);
    validateUUID(params.id);
    try {
      const data = await _request(this.fetch, "DELETE", `${this.url}/admin/users/${params.userId}/factors/${params.id}`, {
        headers: this.headers
      });
      return { data, error: null };
    } catch (error) {
      if (isAuthError(error)) {
        return { data: null, error };
      }
      throw error;
    }
  }
  /**
   * Lists all OAuth clients with optional pagination.
   * Only relevant when the OAuth 2.1 server is enabled in Supabase Auth.
   *
   * This function should only be called on a server. Never expose your `service_role` key in the browser.
   */
  async _listOAuthClients(params) {
    var _a, _b, _c, _d, _e, _f, _g;
    try {
      const pagination = { nextPage: null, lastPage: 0, total: 0 };
      const response = await _request(this.fetch, "GET", `${this.url}/admin/oauth/clients`, {
        headers: this.headers,
        noResolveJson: true,
        query: {
          page: (_b = (_a = params === null || params === void 0 ? void 0 : params.page) === null || _a === void 0 ? void 0 : _a.toString()) !== null && _b !== void 0 ? _b : "",
          per_page: (_d = (_c = params === null || params === void 0 ? void 0 : params.perPage) === null || _c === void 0 ? void 0 : _c.toString()) !== null && _d !== void 0 ? _d : ""
        },
        xform: _noResolveJsonResponse
      });
      if (response.error)
        throw response.error;
      const clients = await response.json();
      const total = (_e = response.headers.get("x-total-count")) !== null && _e !== void 0 ? _e : 0;
      const links = (_g = (_f = response.headers.get("link")) === null || _f === void 0 ? void 0 : _f.split(",")) !== null && _g !== void 0 ? _g : [];
      if (links.length > 0) {
        links.forEach((link) => {
          const page = parseInt(link.split(";")[0].split("=")[1].substring(0, 1));
          const rel = JSON.parse(link.split(";")[1].split("=")[1]);
          pagination[`${rel}Page`] = page;
        });
        pagination.total = parseInt(total);
      }
      return { data: Object.assign(Object.assign({}, clients), pagination), error: null };
    } catch (error) {
      if (isAuthError(error)) {
        return { data: { clients: [] }, error };
      }
      throw error;
    }
  }
  /**
   * Creates a new OAuth client.
   * Only relevant when the OAuth 2.1 server is enabled in Supabase Auth.
   *
   * This function should only be called on a server. Never expose your `service_role` key in the browser.
   */
  async _createOAuthClient(params) {
    try {
      return await _request(this.fetch, "POST", `${this.url}/admin/oauth/clients`, {
        body: params,
        headers: this.headers,
        xform: (client) => {
          return { data: client, error: null };
        }
      });
    } catch (error) {
      if (isAuthError(error)) {
        return { data: null, error };
      }
      throw error;
    }
  }
  /**
   * Gets details of a specific OAuth client.
   * Only relevant when the OAuth 2.1 server is enabled in Supabase Auth.
   *
   * This function should only be called on a server. Never expose your `service_role` key in the browser.
   */
  async _getOAuthClient(clientId) {
    try {
      return await _request(this.fetch, "GET", `${this.url}/admin/oauth/clients/${clientId}`, {
        headers: this.headers,
        xform: (client) => {
          return { data: client, error: null };
        }
      });
    } catch (error) {
      if (isAuthError(error)) {
        return { data: null, error };
      }
      throw error;
    }
  }
  /**
   * Updates an existing OAuth client.
   * Only relevant when the OAuth 2.1 server is enabled in Supabase Auth.
   *
   * This function should only be called on a server. Never expose your `service_role` key in the browser.
   */
  async _updateOAuthClient(clientId, params) {
    try {
      return await _request(this.fetch, "PUT", `${this.url}/admin/oauth/clients/${clientId}`, {
        body: params,
        headers: this.headers,
        xform: (client) => {
          return { data: client, error: null };
        }
      });
    } catch (error) {
      if (isAuthError(error)) {
        return { data: null, error };
      }
      throw error;
    }
  }
  /**
   * Deletes an OAuth client.
   * Only relevant when the OAuth 2.1 server is enabled in Supabase Auth.
   *
   * This function should only be called on a server. Never expose your `service_role` key in the browser.
   */
  async _deleteOAuthClient(clientId) {
    try {
      await _request(this.fetch, "DELETE", `${this.url}/admin/oauth/clients/${clientId}`, {
        headers: this.headers,
        noResolveJson: true
      });
      return { data: null, error: null };
    } catch (error) {
      if (isAuthError(error)) {
        return { data: null, error };
      }
      throw error;
    }
  }
  /**
   * Regenerates the secret for an OAuth client.
   * Only relevant when the OAuth 2.1 server is enabled in Supabase Auth.
   *
   * This function should only be called on a server. Never expose your `service_role` key in the browser.
   */
  async _regenerateOAuthClientSecret(clientId) {
    try {
      return await _request(this.fetch, "POST", `${this.url}/admin/oauth/clients/${clientId}/regenerate_secret`, {
        headers: this.headers,
        xform: (client) => {
          return { data: client, error: null };
        }
      });
    } catch (error) {
      if (isAuthError(error)) {
        return { data: null, error };
      }
      throw error;
    }
  }
};

// node_modules/@supabase/auth-js/dist/module/lib/local-storage.js
function memoryLocalStorageAdapter(store = {}) {
  return {
    getItem: (key) => {
      return store[key] || null;
    },
    setItem: (key, value) => {
      store[key] = value;
    },
    removeItem: (key) => {
      delete store[key];
    }
  };
}

// node_modules/@supabase/auth-js/dist/module/lib/locks.js
var internals = {
  /**
   * @experimental
   */
  debug: !!(globalThis && supportsLocalStorage() && globalThis.localStorage && globalThis.localStorage.getItem("supabase.gotrue-js.locks.debug") === "true")
};
var LockAcquireTimeoutError = class extends Error {
  constructor(message) {
    super(message);
    this.isAcquireTimeout = true;
  }
};
var NavigatorLockAcquireTimeoutError = class extends LockAcquireTimeoutError {
};
async function navigatorLock(name, acquireTimeout, fn) {
  if (internals.debug) {
    console.log("@supabase/gotrue-js: navigatorLock: acquire lock", name, acquireTimeout);
  }
  const abortController = new globalThis.AbortController();
  if (acquireTimeout > 0) {
    setTimeout(() => {
      abortController.abort();
      if (internals.debug) {
        console.log("@supabase/gotrue-js: navigatorLock acquire timed out", name);
      }
    }, acquireTimeout);
  }
  return await Promise.resolve().then(() => globalThis.navigator.locks.request(name, acquireTimeout === 0 ? {
    mode: "exclusive",
    ifAvailable: true
  } : {
    mode: "exclusive",
    signal: abortController.signal
  }, async (lock) => {
    if (lock) {
      if (internals.debug) {
        console.log("@supabase/gotrue-js: navigatorLock: acquired", name, lock.name);
      }
      try {
        return await fn();
      } finally {
        if (internals.debug) {
          console.log("@supabase/gotrue-js: navigatorLock: released", name, lock.name);
        }
      }
    } else {
      if (acquireTimeout === 0) {
        if (internals.debug) {
          console.log("@supabase/gotrue-js: navigatorLock: not immediately available", name);
        }
        throw new NavigatorLockAcquireTimeoutError(`Acquiring an exclusive Navigator LockManager lock "${name}" immediately failed`);
      } else {
        if (internals.debug) {
          try {
            const result = await globalThis.navigator.locks.query();
            console.log("@supabase/gotrue-js: Navigator LockManager state", JSON.stringify(result, null, "  "));
          } catch (e) {
            console.warn("@supabase/gotrue-js: Error when querying Navigator LockManager state", e);
          }
        }
        console.warn("@supabase/gotrue-js: Navigator LockManager returned a null lock when using #request without ifAvailable set to true, it appears this browser is not following the LockManager spec https://developer.mozilla.org/en-US/docs/Web/API/LockManager/request");
        return await fn();
      }
    }
  }));
}

// node_modules/@supabase/auth-js/dist/module/lib/polyfills.js
function polyfillGlobalThis() {
  if (typeof globalThis === "object")
    return;
  try {
    Object.defineProperty(Object.prototype, "__magic__", {
      get: function() {
        return this;
      },
      configurable: true
    });
    __magic__.globalThis = __magic__;
    delete Object.prototype.__magic__;
  } catch (e) {
    if (typeof self !== "undefined") {
      self.globalThis = self;
    }
  }
}

// node_modules/@supabase/auth-js/dist/module/lib/web3/ethereum.js
function getAddress(address) {
  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
    throw new Error(`@supabase/auth-js: Address "${address}" is invalid.`);
  }
  return address.toLowerCase();
}
function fromHex(hex) {
  return parseInt(hex, 16);
}
function toHex(value) {
  const bytes = new TextEncoder().encode(value);
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return "0x" + hex;
}
function createSiweMessage(parameters) {
  var _a;
  const { chainId, domain, expirationTime, issuedAt = /* @__PURE__ */ new Date(), nonce, notBefore, requestId, resources, scheme, uri, version: version5 } = parameters;
  {
    if (!Number.isInteger(chainId))
      throw new Error(`@supabase/auth-js: Invalid SIWE message field "chainId". Chain ID must be a EIP-155 chain ID. Provided value: ${chainId}`);
    if (!domain)
      throw new Error(`@supabase/auth-js: Invalid SIWE message field "domain". Domain must be provided.`);
    if (nonce && nonce.length < 8)
      throw new Error(`@supabase/auth-js: Invalid SIWE message field "nonce". Nonce must be at least 8 characters. Provided value: ${nonce}`);
    if (!uri)
      throw new Error(`@supabase/auth-js: Invalid SIWE message field "uri". URI must be provided.`);
    if (version5 !== "1")
      throw new Error(`@supabase/auth-js: Invalid SIWE message field "version". Version must be '1'. Provided value: ${version5}`);
    if ((_a = parameters.statement) === null || _a === void 0 ? void 0 : _a.includes("\n"))
      throw new Error(`@supabase/auth-js: Invalid SIWE message field "statement". Statement must not include '\\n'. Provided value: ${parameters.statement}`);
  }
  const address = getAddress(parameters.address);
  const origin = scheme ? `${scheme}://${domain}` : domain;
  const statement = parameters.statement ? `${parameters.statement}
` : "";
  const prefix = `${origin} wants you to sign in with your Ethereum account:
${address}

${statement}`;
  let suffix = `URI: ${uri}
Version: ${version5}
Chain ID: ${chainId}${nonce ? `
Nonce: ${nonce}` : ""}
Issued At: ${issuedAt.toISOString()}`;
  if (expirationTime)
    suffix += `
Expiration Time: ${expirationTime.toISOString()}`;
  if (notBefore)
    suffix += `
Not Before: ${notBefore.toISOString()}`;
  if (requestId)
    suffix += `
Request ID: ${requestId}`;
  if (resources) {
    let content = "\nResources:";
    for (const resource of resources) {
      if (!resource || typeof resource !== "string")
        throw new Error(`@supabase/auth-js: Invalid SIWE message field "resources". Every resource must be a valid string. Provided value: ${resource}`);
      content += `
- ${resource}`;
    }
    suffix += content;
  }
  return `${prefix}
${suffix}`;
}

// node_modules/@supabase/auth-js/dist/module/lib/webauthn.errors.js
var WebAuthnError = class extends Error {
  constructor({ message, code, cause, name }) {
    var _a;
    super(message, { cause });
    this.__isWebAuthnError = true;
    this.name = (_a = name !== null && name !== void 0 ? name : cause instanceof Error ? cause.name : void 0) !== null && _a !== void 0 ? _a : "Unknown Error";
    this.code = code;
  }
};
var WebAuthnUnknownError = class extends WebAuthnError {
  constructor(message, originalError) {
    super({
      code: "ERROR_PASSTHROUGH_SEE_CAUSE_PROPERTY",
      cause: originalError,
      message
    });
    this.name = "WebAuthnUnknownError";
    this.originalError = originalError;
  }
};
function identifyRegistrationError({ error, options }) {
  var _a, _b, _c;
  const { publicKey } = options;
  if (!publicKey) {
    throw Error("options was missing required publicKey property");
  }
  if (error.name === "AbortError") {
    if (options.signal instanceof AbortSignal) {
      return new WebAuthnError({
        message: "Registration ceremony was sent an abort signal",
        code: "ERROR_CEREMONY_ABORTED",
        cause: error
      });
    }
  } else if (error.name === "ConstraintError") {
    if (((_a = publicKey.authenticatorSelection) === null || _a === void 0 ? void 0 : _a.requireResidentKey) === true) {
      return new WebAuthnError({
        message: "Discoverable credentials were required but no available authenticator supported it",
        code: "ERROR_AUTHENTICATOR_MISSING_DISCOVERABLE_CREDENTIAL_SUPPORT",
        cause: error
      });
    } else if (
      // @ts-ignore: `mediation` doesn't yet exist on CredentialCreationOptions but it's possible as of Sept 2024
      options.mediation === "conditional" && ((_b = publicKey.authenticatorSelection) === null || _b === void 0 ? void 0 : _b.userVerification) === "required"
    ) {
      return new WebAuthnError({
        message: "User verification was required during automatic registration but it could not be performed",
        code: "ERROR_AUTO_REGISTER_USER_VERIFICATION_FAILURE",
        cause: error
      });
    } else if (((_c = publicKey.authenticatorSelection) === null || _c === void 0 ? void 0 : _c.userVerification) === "required") {
      return new WebAuthnError({
        message: "User verification was required but no available authenticator supported it",
        code: "ERROR_AUTHENTICATOR_MISSING_USER_VERIFICATION_SUPPORT",
        cause: error
      });
    }
  } else if (error.name === "InvalidStateError") {
    return new WebAuthnError({
      message: "The authenticator was previously registered",
      code: "ERROR_AUTHENTICATOR_PREVIOUSLY_REGISTERED",
      cause: error
    });
  } else if (error.name === "NotAllowedError") {
    return new WebAuthnError({
      message: error.message,
      code: "ERROR_PASSTHROUGH_SEE_CAUSE_PROPERTY",
      cause: error
    });
  } else if (error.name === "NotSupportedError") {
    const validPubKeyCredParams = publicKey.pubKeyCredParams.filter((param) => param.type === "public-key");
    if (validPubKeyCredParams.length === 0) {
      return new WebAuthnError({
        message: 'No entry in pubKeyCredParams was of type "public-key"',
        code: "ERROR_MALFORMED_PUBKEYCREDPARAMS",
        cause: error
      });
    }
    return new WebAuthnError({
      message: "No available authenticator supported any of the specified pubKeyCredParams algorithms",
      code: "ERROR_AUTHENTICATOR_NO_SUPPORTED_PUBKEYCREDPARAMS_ALG",
      cause: error
    });
  } else if (error.name === "SecurityError") {
    const effectiveDomain = window.location.hostname;
    if (!isValidDomain(effectiveDomain)) {
      return new WebAuthnError({
        message: `${window.location.hostname} is an invalid domain`,
        code: "ERROR_INVALID_DOMAIN",
        cause: error
      });
    } else if (publicKey.rp.id !== effectiveDomain) {
      return new WebAuthnError({
        message: `The RP ID "${publicKey.rp.id}" is invalid for this domain`,
        code: "ERROR_INVALID_RP_ID",
        cause: error
      });
    }
  } else if (error.name === "TypeError") {
    if (publicKey.user.id.byteLength < 1 || publicKey.user.id.byteLength > 64) {
      return new WebAuthnError({
        message: "User ID was not between 1 and 64 characters",
        code: "ERROR_INVALID_USER_ID_LENGTH",
        cause: error
      });
    }
  } else if (error.name === "UnknownError") {
    return new WebAuthnError({
      message: "The authenticator was unable to process the specified options, or could not create a new credential",
      code: "ERROR_AUTHENTICATOR_GENERAL_ERROR",
      cause: error
    });
  }
  return new WebAuthnError({
    message: "a Non-Webauthn related error has occurred",
    code: "ERROR_PASSTHROUGH_SEE_CAUSE_PROPERTY",
    cause: error
  });
}
function identifyAuthenticationError({ error, options }) {
  const { publicKey } = options;
  if (!publicKey) {
    throw Error("options was missing required publicKey property");
  }
  if (error.name === "AbortError") {
    if (options.signal instanceof AbortSignal) {
      return new WebAuthnError({
        message: "Authentication ceremony was sent an abort signal",
        code: "ERROR_CEREMONY_ABORTED",
        cause: error
      });
    }
  } else if (error.name === "NotAllowedError") {
    return new WebAuthnError({
      message: error.message,
      code: "ERROR_PASSTHROUGH_SEE_CAUSE_PROPERTY",
      cause: error
    });
  } else if (error.name === "SecurityError") {
    const effectiveDomain = window.location.hostname;
    if (!isValidDomain(effectiveDomain)) {
      return new WebAuthnError({
        message: `${window.location.hostname} is an invalid domain`,
        code: "ERROR_INVALID_DOMAIN",
        cause: error
      });
    } else if (publicKey.rpId !== effectiveDomain) {
      return new WebAuthnError({
        message: `The RP ID "${publicKey.rpId}" is invalid for this domain`,
        code: "ERROR_INVALID_RP_ID",
        cause: error
      });
    }
  } else if (error.name === "UnknownError") {
    return new WebAuthnError({
      message: "The authenticator was unable to process the specified options, or could not create a new assertion signature",
      code: "ERROR_AUTHENTICATOR_GENERAL_ERROR",
      cause: error
    });
  }
  return new WebAuthnError({
    message: "a Non-Webauthn related error has occurred",
    code: "ERROR_PASSTHROUGH_SEE_CAUSE_PROPERTY",
    cause: error
  });
}

// node_modules/@supabase/auth-js/dist/module/lib/webauthn.js
var WebAuthnAbortService = class {
  /**
   * Create an abort signal for a new WebAuthn operation.
   * Automatically cancels any existing operation.
   *
   * @returns {AbortSignal} Signal to pass to navigator.credentials.create() or .get()
   * @see {@link https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal MDN - AbortSignal}
   */
  createNewAbortSignal() {
    if (this.controller) {
      const abortError = new Error("Cancelling existing WebAuthn API call for new one");
      abortError.name = "AbortError";
      this.controller.abort(abortError);
    }
    const newController = new AbortController();
    this.controller = newController;
    return newController.signal;
  }
  /**
   * Manually cancel the current WebAuthn operation.
   * Useful for cleaning up when user cancels or navigates away.
   *
   * @see {@link https://developer.mozilla.org/en-US/docs/Web/API/AbortController/abort MDN - AbortController.abort}
   */
  cancelCeremony() {
    if (this.controller) {
      const abortError = new Error("Manually cancelling existing WebAuthn API call");
      abortError.name = "AbortError";
      this.controller.abort(abortError);
      this.controller = void 0;
    }
  }
};
var webAuthnAbortService = new WebAuthnAbortService();
function deserializeCredentialCreationOptions(options) {
  if (!options) {
    throw new Error("Credential creation options are required");
  }
  if (typeof PublicKeyCredential !== "undefined" && "parseCreationOptionsFromJSON" in PublicKeyCredential && typeof PublicKeyCredential.parseCreationOptionsFromJSON === "function") {
    return PublicKeyCredential.parseCreationOptionsFromJSON(
      /** we assert the options here as typescript still doesn't know about future webauthn types */
      options
    );
  }
  const { challenge: challengeStr, user: userOpts, excludeCredentials } = options, restOptions = __rest(
    options,
    ["challenge", "user", "excludeCredentials"]
  );
  const challenge = base64UrlToUint8Array(challengeStr).buffer;
  const user = Object.assign(Object.assign({}, userOpts), { id: base64UrlToUint8Array(userOpts.id).buffer });
  const result = Object.assign(Object.assign({}, restOptions), {
    challenge,
    user
  });
  if (excludeCredentials && excludeCredentials.length > 0) {
    result.excludeCredentials = new Array(excludeCredentials.length);
    for (let i = 0; i < excludeCredentials.length; i++) {
      const cred = excludeCredentials[i];
      result.excludeCredentials[i] = Object.assign(Object.assign({}, cred), {
        id: base64UrlToUint8Array(cred.id).buffer,
        type: cred.type || "public-key",
        // Cast transports to handle future transport types like "cable"
        transports: cred.transports
      });
    }
  }
  return result;
}
function deserializeCredentialRequestOptions(options) {
  if (!options) {
    throw new Error("Credential request options are required");
  }
  if (typeof PublicKeyCredential !== "undefined" && "parseRequestOptionsFromJSON" in PublicKeyCredential && typeof PublicKeyCredential.parseRequestOptionsFromJSON === "function") {
    return PublicKeyCredential.parseRequestOptionsFromJSON(options);
  }
  const { challenge: challengeStr, allowCredentials } = options, restOptions = __rest(
    options,
    ["challenge", "allowCredentials"]
  );
  const challenge = base64UrlToUint8Array(challengeStr).buffer;
  const result = Object.assign(Object.assign({}, restOptions), { challenge });
  if (allowCredentials && allowCredentials.length > 0) {
    result.allowCredentials = new Array(allowCredentials.length);
    for (let i = 0; i < allowCredentials.length; i++) {
      const cred = allowCredentials[i];
      result.allowCredentials[i] = Object.assign(Object.assign({}, cred), {
        id: base64UrlToUint8Array(cred.id).buffer,
        type: cred.type || "public-key",
        // Cast transports to handle future transport types like "cable"
        transports: cred.transports
      });
    }
  }
  return result;
}
function serializeCredentialCreationResponse(credential) {
  var _a;
  if ("toJSON" in credential && typeof credential.toJSON === "function") {
    return credential.toJSON();
  }
  const credentialWithAttachment = credential;
  return {
    id: credential.id,
    rawId: credential.id,
    response: {
      attestationObject: bytesToBase64URL(new Uint8Array(credential.response.attestationObject)),
      clientDataJSON: bytesToBase64URL(new Uint8Array(credential.response.clientDataJSON))
    },
    type: "public-key",
    clientExtensionResults: credential.getClientExtensionResults(),
    // Convert null to undefined and cast to AuthenticatorAttachment type
    authenticatorAttachment: (_a = credentialWithAttachment.authenticatorAttachment) !== null && _a !== void 0 ? _a : void 0
  };
}
function serializeCredentialRequestResponse(credential) {
  var _a;
  if ("toJSON" in credential && typeof credential.toJSON === "function") {
    return credential.toJSON();
  }
  const credentialWithAttachment = credential;
  const clientExtensionResults = credential.getClientExtensionResults();
  const assertionResponse = credential.response;
  return {
    id: credential.id,
    rawId: credential.id,
    // W3C spec expects rawId to match id for JSON format
    response: {
      authenticatorData: bytesToBase64URL(new Uint8Array(assertionResponse.authenticatorData)),
      clientDataJSON: bytesToBase64URL(new Uint8Array(assertionResponse.clientDataJSON)),
      signature: bytesToBase64URL(new Uint8Array(assertionResponse.signature)),
      userHandle: assertionResponse.userHandle ? bytesToBase64URL(new Uint8Array(assertionResponse.userHandle)) : void 0
    },
    type: "public-key",
    clientExtensionResults,
    // Convert null to undefined and cast to AuthenticatorAttachment type
    authenticatorAttachment: (_a = credentialWithAttachment.authenticatorAttachment) !== null && _a !== void 0 ? _a : void 0
  };
}
function isValidDomain(hostname) {
  return (
    // Consider localhost valid as well since it's okay wrt Secure Contexts
    hostname === "localhost" || /^([a-z0-9]+(-[a-z0-9]+)*\.)+[a-z]{2,}$/i.test(hostname)
  );
}
function browserSupportsWebAuthn() {
  var _a, _b;
  return !!(isBrowser() && "PublicKeyCredential" in window && window.PublicKeyCredential && "credentials" in navigator && typeof ((_a = navigator === null || navigator === void 0 ? void 0 : navigator.credentials) === null || _a === void 0 ? void 0 : _a.create) === "function" && typeof ((_b = navigator === null || navigator === void 0 ? void 0 : navigator.credentials) === null || _b === void 0 ? void 0 : _b.get) === "function");
}
async function createCredential(options) {
  try {
    const response = await navigator.credentials.create(
      /** we assert the type here until typescript types are updated */
      options
    );
    if (!response) {
      return {
        data: null,
        error: new WebAuthnUnknownError("Empty credential response", response)
      };
    }
    if (!(response instanceof PublicKeyCredential)) {
      return {
        data: null,
        error: new WebAuthnUnknownError("Browser returned unexpected credential type", response)
      };
    }
    return { data: response, error: null };
  } catch (err) {
    return {
      data: null,
      error: identifyRegistrationError({
        error: err,
        options
      })
    };
  }
}
async function getCredential(options) {
  try {
    const response = await navigator.credentials.get(
      /** we assert the type here until typescript types are updated */
      options
    );
    if (!response) {
      return {
        data: null,
        error: new WebAuthnUnknownError("Empty credential response", response)
      };
    }
    if (!(response instanceof PublicKeyCredential)) {
      return {
        data: null,
        error: new WebAuthnUnknownError("Browser returned unexpected credential type", response)
      };
    }
    return { data: response, error: null };
  } catch (err) {
    return {
      data: null,
      error: identifyAuthenticationError({
        error: err,
        options
      })
    };
  }
}
var DEFAULT_CREATION_OPTIONS = {
  hints: ["security-key"],
  authenticatorSelection: {
    authenticatorAttachment: "cross-platform",
    requireResidentKey: false,
    /** set to preferred because older yubikeys don't have PIN/Biometric */
    userVerification: "preferred",
    residentKey: "discouraged"
  },
  attestation: "direct"
};
var DEFAULT_REQUEST_OPTIONS = {
  /** set to preferred because older yubikeys don't have PIN/Biometric */
  userVerification: "preferred",
  hints: ["security-key"],
  attestation: "direct"
};
function deepMerge(...sources) {
  const isObject = (val) => val !== null && typeof val === "object" && !Array.isArray(val);
  const isArrayBufferLike = (val) => val instanceof ArrayBuffer || ArrayBuffer.isView(val);
  const result = {};
  for (const source of sources) {
    if (!source)
      continue;
    for (const key in source) {
      const value = source[key];
      if (value === void 0)
        continue;
      if (Array.isArray(value)) {
        result[key] = value;
      } else if (isArrayBufferLike(value)) {
        result[key] = value;
      } else if (isObject(value)) {
        const existing = result[key];
        if (isObject(existing)) {
          result[key] = deepMerge(existing, value);
        } else {
          result[key] = deepMerge(value);
        }
      } else {
        result[key] = value;
      }
    }
  }
  return result;
}
function mergeCredentialCreationOptions(baseOptions, overrides) {
  return deepMerge(DEFAULT_CREATION_OPTIONS, baseOptions, overrides || {});
}
function mergeCredentialRequestOptions(baseOptions, overrides) {
  return deepMerge(DEFAULT_REQUEST_OPTIONS, baseOptions, overrides || {});
}
var WebAuthnApi = class {
  constructor(client) {
    this.client = client;
    this.enroll = this._enroll.bind(this);
    this.challenge = this._challenge.bind(this);
    this.verify = this._verify.bind(this);
    this.authenticate = this._authenticate.bind(this);
    this.register = this._register.bind(this);
  }
  /**
   * Enroll a new WebAuthn factor.
   * Creates an unverified WebAuthn factor that must be verified with a credential.
   *
   * @experimental This method is experimental and may change in future releases
   * @param {Omit<MFAEnrollWebauthnParams, 'factorType'>} params - Enrollment parameters (friendlyName required)
   * @returns {Promise<AuthMFAEnrollWebauthnResponse>} Enrolled factor details or error
   * @see {@link https://w3c.github.io/webauthn/#sctn-registering-a-new-credential W3C WebAuthn Spec - Registering a New Credential}
   */
  async _enroll(params) {
    return this.client.mfa.enroll(Object.assign(Object.assign({}, params), { factorType: "webauthn" }));
  }
  /**
   * Challenge for WebAuthn credential creation or authentication.
   * Combines server challenge with browser credential operations.
   * Handles both registration (create) and authentication (request) flows.
   *
   * @experimental This method is experimental and may change in future releases
   * @param {MFAChallengeWebauthnParams & { friendlyName?: string; signal?: AbortSignal }} params - Challenge parameters including factorId
   * @param {Object} overrides - Allows you to override the parameters passed to navigator.credentials
   * @param {PublicKeyCredentialCreationOptionsFuture} overrides.create - Override options for credential creation
   * @param {PublicKeyCredentialRequestOptionsFuture} overrides.request - Override options for credential request
   * @returns {Promise<RequestResult>} Challenge response with credential or error
   * @see {@link https://w3c.github.io/webauthn/#sctn-credential-creation W3C WebAuthn Spec - Credential Creation}
   * @see {@link https://w3c.github.io/webauthn/#sctn-verifying-assertion W3C WebAuthn Spec - Verifying Assertion}
   */
  async _challenge({ factorId, webauthn, friendlyName, signal }, overrides) {
    var _a;
    try {
      const { data: challengeResponse, error: challengeError } = await this.client.mfa.challenge({
        factorId,
        webauthn
      });
      if (!challengeResponse) {
        return { data: null, error: challengeError };
      }
      const abortSignal = signal !== null && signal !== void 0 ? signal : webAuthnAbortService.createNewAbortSignal();
      if (challengeResponse.webauthn.type === "create") {
        const { user } = challengeResponse.webauthn.credential_options.publicKey;
        if (!user.name) {
          const nameToUse = friendlyName;
          if (!nameToUse) {
            const currentUser = await this.client.getUser();
            const userData = currentUser.data.user;
            const fallbackName = ((_a = userData === null || userData === void 0 ? void 0 : userData.user_metadata) === null || _a === void 0 ? void 0 : _a.name) || (userData === null || userData === void 0 ? void 0 : userData.email) || (userData === null || userData === void 0 ? void 0 : userData.id) || "User";
            user.name = `${user.id}:${fallbackName}`;
          } else {
            user.name = `${user.id}:${nameToUse}`;
          }
        }
        if (!user.displayName) {
          user.displayName = user.name;
        }
      }
      switch (challengeResponse.webauthn.type) {
        case "create": {
          const options = mergeCredentialCreationOptions(challengeResponse.webauthn.credential_options.publicKey, overrides === null || overrides === void 0 ? void 0 : overrides.create);
          const { data, error } = await createCredential({
            publicKey: options,
            signal: abortSignal
          });
          if (data) {
            return {
              data: {
                factorId,
                challengeId: challengeResponse.id,
                webauthn: {
                  type: challengeResponse.webauthn.type,
                  credential_response: data
                }
              },
              error: null
            };
          }
          return { data: null, error };
        }
        case "request": {
          const options = mergeCredentialRequestOptions(challengeResponse.webauthn.credential_options.publicKey, overrides === null || overrides === void 0 ? void 0 : overrides.request);
          const { data, error } = await getCredential(Object.assign(Object.assign({}, challengeResponse.webauthn.credential_options), { publicKey: options, signal: abortSignal }));
          if (data) {
            return {
              data: {
                factorId,
                challengeId: challengeResponse.id,
                webauthn: {
                  type: challengeResponse.webauthn.type,
                  credential_response: data
                }
              },
              error: null
            };
          }
          return { data: null, error };
        }
      }
    } catch (error) {
      if (isAuthError(error)) {
        return { data: null, error };
      }
      return {
        data: null,
        error: new AuthUnknownError("Unexpected error in challenge", error)
      };
    }
  }
  /**
   * Verify a WebAuthn credential with the server.
   * Completes the WebAuthn ceremony by sending the credential to the server for verification.
   *
   * @experimental This method is experimental and may change in future releases
   * @param {Object} params - Verification parameters
   * @param {string} params.challengeId - ID of the challenge being verified
   * @param {string} params.factorId - ID of the WebAuthn factor
   * @param {MFAVerifyWebauthnParams<T>['webauthn']} params.webauthn - WebAuthn credential response
   * @returns {Promise<AuthMFAVerifyResponse>} Verification result with session or error
   * @see {@link https://w3c.github.io/webauthn/#sctn-verifying-assertion W3C WebAuthn Spec - Verifying an Authentication Assertion}
   * */
  async _verify({ challengeId, factorId, webauthn }) {
    return this.client.mfa.verify({
      factorId,
      challengeId,
      webauthn
    });
  }
  /**
   * Complete WebAuthn authentication flow.
   * Performs challenge and verification in a single operation for existing credentials.
   *
   * @experimental This method is experimental and may change in future releases
   * @param {Object} params - Authentication parameters
   * @param {string} params.factorId - ID of the WebAuthn factor to authenticate with
   * @param {Object} params.webauthn - WebAuthn configuration
   * @param {string} params.webauthn.rpId - Relying Party ID (defaults to current hostname)
   * @param {string[]} params.webauthn.rpOrigins - Allowed origins (defaults to current origin)
   * @param {AbortSignal} params.webauthn.signal - Optional abort signal
   * @param {PublicKeyCredentialRequestOptionsFuture} overrides - Override options for navigator.credentials.get
   * @returns {Promise<RequestResult<AuthMFAVerifyResponseData, WebAuthnError | AuthError>>} Authentication result
   * @see {@link https://w3c.github.io/webauthn/#sctn-authentication W3C WebAuthn Spec - Authentication Ceremony}
   * @see {@link https://developer.mozilla.org/en-US/docs/Web/API/PublicKeyCredentialRequestOptions MDN - PublicKeyCredentialRequestOptions}
   */
  async _authenticate({ factorId, webauthn: { rpId = typeof window !== "undefined" ? window.location.hostname : void 0, rpOrigins = typeof window !== "undefined" ? [window.location.origin] : void 0, signal } = {} }, overrides) {
    if (!rpId) {
      return {
        data: null,
        error: new AuthError("rpId is required for WebAuthn authentication")
      };
    }
    try {
      if (!browserSupportsWebAuthn()) {
        return {
          data: null,
          error: new AuthUnknownError("Browser does not support WebAuthn", null)
        };
      }
      const { data: challengeResponse, error: challengeError } = await this.challenge({
        factorId,
        webauthn: { rpId, rpOrigins },
        signal
      }, { request: overrides });
      if (!challengeResponse) {
        return { data: null, error: challengeError };
      }
      const { webauthn } = challengeResponse;
      return this._verify({
        factorId,
        challengeId: challengeResponse.challengeId,
        webauthn: {
          type: webauthn.type,
          rpId,
          rpOrigins,
          credential_response: webauthn.credential_response
        }
      });
    } catch (error) {
      if (isAuthError(error)) {
        return { data: null, error };
      }
      return {
        data: null,
        error: new AuthUnknownError("Unexpected error in authenticate", error)
      };
    }
  }
  /**
   * Complete WebAuthn registration flow.
   * Performs enrollment, challenge, and verification in a single operation for new credentials.
   *
   * @experimental This method is experimental and may change in future releases
   * @param {Object} params - Registration parameters
   * @param {string} params.friendlyName - User-friendly name for the credential
   * @param {string} params.rpId - Relying Party ID (defaults to current hostname)
   * @param {string[]} params.rpOrigins - Allowed origins (defaults to current origin)
   * @param {AbortSignal} params.signal - Optional abort signal
   * @param {PublicKeyCredentialCreationOptionsFuture} overrides - Override options for navigator.credentials.create
   * @returns {Promise<RequestResult<AuthMFAVerifyResponseData, WebAuthnError | AuthError>>} Registration result
   * @see {@link https://w3c.github.io/webauthn/#sctn-registering-a-new-credential W3C WebAuthn Spec - Registration Ceremony}
   * @see {@link https://developer.mozilla.org/en-US/docs/Web/API/PublicKeyCredentialCreationOptions MDN - PublicKeyCredentialCreationOptions}
   */
  async _register({ friendlyName, webauthn: { rpId = typeof window !== "undefined" ? window.location.hostname : void 0, rpOrigins = typeof window !== "undefined" ? [window.location.origin] : void 0, signal } = {} }, overrides) {
    if (!rpId) {
      return {
        data: null,
        error: new AuthError("rpId is required for WebAuthn registration")
      };
    }
    try {
      if (!browserSupportsWebAuthn()) {
        return {
          data: null,
          error: new AuthUnknownError("Browser does not support WebAuthn", null)
        };
      }
      const { data: factor, error: enrollError } = await this._enroll({
        friendlyName
      });
      if (!factor) {
        await this.client.mfa.listFactors().then((factors) => {
          var _a;
          return (_a = factors.data) === null || _a === void 0 ? void 0 : _a.all.find((v) => v.factor_type === "webauthn" && v.friendly_name === friendlyName && v.status !== "unverified");
        }).then((factor2) => factor2 ? this.client.mfa.unenroll({ factorId: factor2 === null || factor2 === void 0 ? void 0 : factor2.id }) : void 0);
        return { data: null, error: enrollError };
      }
      const { data: challengeResponse, error: challengeError } = await this._challenge({
        factorId: factor.id,
        friendlyName: factor.friendly_name,
        webauthn: { rpId, rpOrigins },
        signal
      }, {
        create: overrides
      });
      if (!challengeResponse) {
        return { data: null, error: challengeError };
      }
      return this._verify({
        factorId: factor.id,
        challengeId: challengeResponse.challengeId,
        webauthn: {
          rpId,
          rpOrigins,
          type: challengeResponse.webauthn.type,
          credential_response: challengeResponse.webauthn.credential_response
        }
      });
    } catch (error) {
      if (isAuthError(error)) {
        return { data: null, error };
      }
      return {
        data: null,
        error: new AuthUnknownError("Unexpected error in register", error)
      };
    }
  }
};

// node_modules/@supabase/auth-js/dist/module/GoTrueClient.js
polyfillGlobalThis();
var DEFAULT_OPTIONS = {
  url: GOTRUE_URL,
  storageKey: STORAGE_KEY2,
  autoRefreshToken: true,
  persistSession: true,
  detectSessionInUrl: true,
  headers: DEFAULT_HEADERS2,
  flowType: "implicit",
  debug: false,
  hasCustomAuthorizationHeader: false,
  throwOnError: false,
  lockAcquireTimeout: 1e4
  // 10 seconds
};
async function lockNoOp(name, acquireTimeout, fn) {
  return await fn();
}
var GLOBAL_JWKS = {};
var GoTrueClient = class _GoTrueClient {
  /**
   * The JWKS used for verifying asymmetric JWTs
   */
  get jwks() {
    var _a, _b;
    return (_b = (_a = GLOBAL_JWKS[this.storageKey]) === null || _a === void 0 ? void 0 : _a.jwks) !== null && _b !== void 0 ? _b : { keys: [] };
  }
  set jwks(value) {
    GLOBAL_JWKS[this.storageKey] = Object.assign(Object.assign({}, GLOBAL_JWKS[this.storageKey]), { jwks: value });
  }
  get jwks_cached_at() {
    var _a, _b;
    return (_b = (_a = GLOBAL_JWKS[this.storageKey]) === null || _a === void 0 ? void 0 : _a.cachedAt) !== null && _b !== void 0 ? _b : Number.MIN_SAFE_INTEGER;
  }
  set jwks_cached_at(value) {
    GLOBAL_JWKS[this.storageKey] = Object.assign(Object.assign({}, GLOBAL_JWKS[this.storageKey]), { cachedAt: value });
  }
  /**
   * Create a new client for use in the browser.
   *
   * @example
   * ```ts
   * import { GoTrueClient } from '@supabase/auth-js'
   *
   * const auth = new GoTrueClient({
   *   url: 'https://xyzcompany.supabase.co/auth/v1',
   *   headers: { apikey: 'public-anon-key' },
   *   storageKey: 'supabase-auth',
   * })
   * ```
   */
  constructor(options) {
    var _a, _b, _c;
    this.userStorage = null;
    this.memoryStorage = null;
    this.stateChangeEmitters = /* @__PURE__ */ new Map();
    this.autoRefreshTicker = null;
    this.autoRefreshTickTimeout = null;
    this.visibilityChangedCallback = null;
    this.refreshingDeferred = null;
    this.initializePromise = null;
    this.detectSessionInUrl = true;
    this.hasCustomAuthorizationHeader = false;
    this.suppressGetSessionWarning = false;
    this.lockAcquired = false;
    this.pendingInLock = [];
    this.broadcastChannel = null;
    this.logger = console.log;
    const settings = Object.assign(Object.assign({}, DEFAULT_OPTIONS), options);
    this.storageKey = settings.storageKey;
    this.instanceID = (_a = _GoTrueClient.nextInstanceID[this.storageKey]) !== null && _a !== void 0 ? _a : 0;
    _GoTrueClient.nextInstanceID[this.storageKey] = this.instanceID + 1;
    this.logDebugMessages = !!settings.debug;
    if (typeof settings.debug === "function") {
      this.logger = settings.debug;
    }
    if (this.instanceID > 0 && isBrowser()) {
      const message = `${this._logPrefix()} Multiple GoTrueClient instances detected in the same browser context. It is not an error, but this should be avoided as it may produce undefined behavior when used concurrently under the same storage key.`;
      console.warn(message);
      if (this.logDebugMessages) {
        console.trace(message);
      }
    }
    this.persistSession = settings.persistSession;
    this.autoRefreshToken = settings.autoRefreshToken;
    this.admin = new GoTrueAdminApi({
      url: settings.url,
      headers: settings.headers,
      fetch: settings.fetch
    });
    this.url = settings.url;
    this.headers = settings.headers;
    this.fetch = resolveFetch3(settings.fetch);
    this.lock = settings.lock || lockNoOp;
    this.detectSessionInUrl = settings.detectSessionInUrl;
    this.flowType = settings.flowType;
    this.hasCustomAuthorizationHeader = settings.hasCustomAuthorizationHeader;
    this.throwOnError = settings.throwOnError;
    this.lockAcquireTimeout = settings.lockAcquireTimeout;
    if (settings.lock) {
      this.lock = settings.lock;
    } else if (this.persistSession && isBrowser() && ((_b = globalThis === null || globalThis === void 0 ? void 0 : globalThis.navigator) === null || _b === void 0 ? void 0 : _b.locks)) {
      this.lock = navigatorLock;
    } else {
      this.lock = lockNoOp;
    }
    if (!this.jwks) {
      this.jwks = { keys: [] };
      this.jwks_cached_at = Number.MIN_SAFE_INTEGER;
    }
    this.mfa = {
      verify: this._verify.bind(this),
      enroll: this._enroll.bind(this),
      unenroll: this._unenroll.bind(this),
      challenge: this._challenge.bind(this),
      listFactors: this._listFactors.bind(this),
      challengeAndVerify: this._challengeAndVerify.bind(this),
      getAuthenticatorAssuranceLevel: this._getAuthenticatorAssuranceLevel.bind(this),
      webauthn: new WebAuthnApi(this)
    };
    this.oauth = {
      getAuthorizationDetails: this._getAuthorizationDetails.bind(this),
      approveAuthorization: this._approveAuthorization.bind(this),
      denyAuthorization: this._denyAuthorization.bind(this),
      listGrants: this._listOAuthGrants.bind(this),
      revokeGrant: this._revokeOAuthGrant.bind(this)
    };
    if (this.persistSession) {
      if (settings.storage) {
        this.storage = settings.storage;
      } else {
        if (supportsLocalStorage()) {
          this.storage = globalThis.localStorage;
        } else {
          this.memoryStorage = {};
          this.storage = memoryLocalStorageAdapter(this.memoryStorage);
        }
      }
      if (settings.userStorage) {
        this.userStorage = settings.userStorage;
      }
    } else {
      this.memoryStorage = {};
      this.storage = memoryLocalStorageAdapter(this.memoryStorage);
    }
    if (isBrowser() && globalThis.BroadcastChannel && this.persistSession && this.storageKey) {
      try {
        this.broadcastChannel = new globalThis.BroadcastChannel(this.storageKey);
      } catch (e) {
        console.error("Failed to create a new BroadcastChannel, multi-tab state changes will not be available", e);
      }
      (_c = this.broadcastChannel) === null || _c === void 0 ? void 0 : _c.addEventListener("message", async (event) => {
        this._debug("received broadcast notification from other tab or client", event);
        try {
          await this._notifyAllSubscribers(event.data.event, event.data.session, false);
        } catch (error) {
          this._debug("#broadcastChannel", "error", error);
        }
      });
    }
    this.initialize().catch((error) => {
      this._debug("#initialize()", "error", error);
    });
  }
  /**
   * Returns whether error throwing mode is enabled for this client.
   */
  isThrowOnErrorEnabled() {
    return this.throwOnError;
  }
  /**
   * Centralizes return handling with optional error throwing. When `throwOnError` is enabled
   * and the provided result contains a non-nullish error, the error is thrown instead of
   * being returned. This ensures consistent behavior across all public API methods.
   */
  _returnResult(result) {
    if (this.throwOnError && result && result.error) {
      throw result.error;
    }
    return result;
  }
  _logPrefix() {
    return `GoTrueClient@${this.storageKey}:${this.instanceID} (${version3}) ${(/* @__PURE__ */ new Date()).toISOString()}`;
  }
  _debug(...args) {
    if (this.logDebugMessages) {
      this.logger(this._logPrefix(), ...args);
    }
    return this;
  }
  /**
   * Initializes the client session either from the url or from storage.
   * This method is automatically called when instantiating the client, but should also be called
   * manually when checking for an error from an auth redirect (oauth, magiclink, password recovery, etc).
   */
  async initialize() {
    if (this.initializePromise) {
      return await this.initializePromise;
    }
    this.initializePromise = (async () => {
      return await this._acquireLock(this.lockAcquireTimeout, async () => {
        return await this._initialize();
      });
    })();
    return await this.initializePromise;
  }
  /**
   * IMPORTANT:
   * 1. Never throw in this method, as it is called from the constructor
   * 2. Never return a session from this method as it would be cached over
   *    the whole lifetime of the client
   */
  async _initialize() {
    var _a;
    try {
      let params = {};
      let callbackUrlType = "none";
      if (isBrowser()) {
        params = parseParametersFromURL(window.location.href);
        if (this._isImplicitGrantCallback(params)) {
          callbackUrlType = "implicit";
        } else if (await this._isPKCECallback(params)) {
          callbackUrlType = "pkce";
        }
      }
      if (isBrowser() && this.detectSessionInUrl && callbackUrlType !== "none") {
        const { data, error } = await this._getSessionFromURL(params, callbackUrlType);
        if (error) {
          this._debug("#_initialize()", "error detecting session from URL", error);
          if (isAuthImplicitGrantRedirectError(error)) {
            const errorCode = (_a = error.details) === null || _a === void 0 ? void 0 : _a.code;
            if (errorCode === "identity_already_exists" || errorCode === "identity_not_found" || errorCode === "single_identity_not_deletable") {
              return { error };
            }
          }
          return { error };
        }
        const { session, redirectType } = data;
        this._debug("#_initialize()", "detected session in URL", session, "redirect type", redirectType);
        await this._saveSession(session);
        setTimeout(async () => {
          if (redirectType === "recovery") {
            await this._notifyAllSubscribers("PASSWORD_RECOVERY", session);
          } else {
            await this._notifyAllSubscribers("SIGNED_IN", session);
          }
        }, 0);
        return { error: null };
      }
      await this._recoverAndRefresh();
      return { error: null };
    } catch (error) {
      if (isAuthError(error)) {
        return this._returnResult({ error });
      }
      return this._returnResult({
        error: new AuthUnknownError("Unexpected error during initialization", error)
      });
    } finally {
      await this._handleVisibilityChange();
      this._debug("#_initialize()", "end");
    }
  }
  /**
   * Creates a new anonymous user.
   *
   * @returns A session where the is_anonymous claim in the access token JWT set to true
   */
  async signInAnonymously(credentials) {
    var _a, _b, _c;
    try {
      const res = await _request(this.fetch, "POST", `${this.url}/signup`, {
        headers: this.headers,
        body: {
          data: (_b = (_a = credentials === null || credentials === void 0 ? void 0 : credentials.options) === null || _a === void 0 ? void 0 : _a.data) !== null && _b !== void 0 ? _b : {},
          gotrue_meta_security: { captcha_token: (_c = credentials === null || credentials === void 0 ? void 0 : credentials.options) === null || _c === void 0 ? void 0 : _c.captchaToken }
        },
        xform: _sessionResponse
      });
      const { data, error } = res;
      if (error || !data) {
        return this._returnResult({ data: { user: null, session: null }, error });
      }
      const session = data.session;
      const user = data.user;
      if (data.session) {
        await this._saveSession(data.session);
        await this._notifyAllSubscribers("SIGNED_IN", session);
      }
      return this._returnResult({ data: { user, session }, error: null });
    } catch (error) {
      if (isAuthError(error)) {
        return this._returnResult({ data: { user: null, session: null }, error });
      }
      throw error;
    }
  }
  /**
   * Creates a new user.
   *
   * Be aware that if a user account exists in the system you may get back an
   * error message that attempts to hide this information from the user.
   * This method has support for PKCE via email signups. The PKCE flow cannot be used when autoconfirm is enabled.
   *
   * @returns A logged-in session if the server has "autoconfirm" ON
   * @returns A user if the server has "autoconfirm" OFF
   */
  async signUp(credentials) {
    var _a, _b, _c;
    try {
      let res;
      if ("email" in credentials) {
        const { email, password, options } = credentials;
        let codeChallenge = null;
        let codeChallengeMethod = null;
        if (this.flowType === "pkce") {
          ;
          [codeChallenge, codeChallengeMethod] = await getCodeChallengeAndMethod(this.storage, this.storageKey);
        }
        res = await _request(this.fetch, "POST", `${this.url}/signup`, {
          headers: this.headers,
          redirectTo: options === null || options === void 0 ? void 0 : options.emailRedirectTo,
          body: {
            email,
            password,
            data: (_a = options === null || options === void 0 ? void 0 : options.data) !== null && _a !== void 0 ? _a : {},
            gotrue_meta_security: { captcha_token: options === null || options === void 0 ? void 0 : options.captchaToken },
            code_challenge: codeChallenge,
            code_challenge_method: codeChallengeMethod
          },
          xform: _sessionResponse
        });
      } else if ("phone" in credentials) {
        const { phone, password, options } = credentials;
        res = await _request(this.fetch, "POST", `${this.url}/signup`, {
          headers: this.headers,
          body: {
            phone,
            password,
            data: (_b = options === null || options === void 0 ? void 0 : options.data) !== null && _b !== void 0 ? _b : {},
            channel: (_c = options === null || options === void 0 ? void 0 : options.channel) !== null && _c !== void 0 ? _c : "sms",
            gotrue_meta_security: { captcha_token: options === null || options === void 0 ? void 0 : options.captchaToken }
          },
          xform: _sessionResponse
        });
      } else {
        throw new AuthInvalidCredentialsError("You must provide either an email or phone number and a password");
      }
      const { data, error } = res;
      if (error || !data) {
        await removeItemAsync(this.storage, `${this.storageKey}-code-verifier`);
        return this._returnResult({ data: { user: null, session: null }, error });
      }
      const session = data.session;
      const user = data.user;
      if (data.session) {
        await this._saveSession(data.session);
        await this._notifyAllSubscribers("SIGNED_IN", session);
      }
      return this._returnResult({ data: { user, session }, error: null });
    } catch (error) {
      await removeItemAsync(this.storage, `${this.storageKey}-code-verifier`);
      if (isAuthError(error)) {
        return this._returnResult({ data: { user: null, session: null }, error });
      }
      throw error;
    }
  }
  /**
   * Log in an existing user with an email and password or phone and password.
   *
   * Be aware that you may get back an error message that will not distinguish
   * between the cases where the account does not exist or that the
   * email/phone and password combination is wrong or that the account can only
   * be accessed via social login.
   */
  async signInWithPassword(credentials) {
    try {
      let res;
      if ("email" in credentials) {
        const { email, password, options } = credentials;
        res = await _request(this.fetch, "POST", `${this.url}/token?grant_type=password`, {
          headers: this.headers,
          body: {
            email,
            password,
            gotrue_meta_security: { captcha_token: options === null || options === void 0 ? void 0 : options.captchaToken }
          },
          xform: _sessionResponsePassword
        });
      } else if ("phone" in credentials) {
        const { phone, password, options } = credentials;
        res = await _request(this.fetch, "POST", `${this.url}/token?grant_type=password`, {
          headers: this.headers,
          body: {
            phone,
            password,
            gotrue_meta_security: { captcha_token: options === null || options === void 0 ? void 0 : options.captchaToken }
          },
          xform: _sessionResponsePassword
        });
      } else {
        throw new AuthInvalidCredentialsError("You must provide either an email or phone number and a password");
      }
      const { data, error } = res;
      if (error) {
        return this._returnResult({ data: { user: null, session: null }, error });
      } else if (!data || !data.session || !data.user) {
        const invalidTokenError = new AuthInvalidTokenResponseError();
        return this._returnResult({ data: { user: null, session: null }, error: invalidTokenError });
      }
      if (data.session) {
        await this._saveSession(data.session);
        await this._notifyAllSubscribers("SIGNED_IN", data.session);
      }
      return this._returnResult({
        data: Object.assign({ user: data.user, session: data.session }, data.weak_password ? { weakPassword: data.weak_password } : null),
        error
      });
    } catch (error) {
      if (isAuthError(error)) {
        return this._returnResult({ data: { user: null, session: null }, error });
      }
      throw error;
    }
  }
  /**
   * Log in an existing user via a third-party provider.
   * This method supports the PKCE flow.
   */
  async signInWithOAuth(credentials) {
    var _a, _b, _c, _d;
    return await this._handleProviderSignIn(credentials.provider, {
      redirectTo: (_a = credentials.options) === null || _a === void 0 ? void 0 : _a.redirectTo,
      scopes: (_b = credentials.options) === null || _b === void 0 ? void 0 : _b.scopes,
      queryParams: (_c = credentials.options) === null || _c === void 0 ? void 0 : _c.queryParams,
      skipBrowserRedirect: (_d = credentials.options) === null || _d === void 0 ? void 0 : _d.skipBrowserRedirect
    });
  }
  /**
   * Log in an existing user by exchanging an Auth Code issued during the PKCE flow.
   */
  async exchangeCodeForSession(authCode) {
    await this.initializePromise;
    return this._acquireLock(this.lockAcquireTimeout, async () => {
      return this._exchangeCodeForSession(authCode);
    });
  }
  /**
   * Signs in a user by verifying a message signed by the user's private key.
   * Supports Ethereum (via Sign-In-With-Ethereum) & Solana (Sign-In-With-Solana) standards,
   * both of which derive from the EIP-4361 standard
   * With slight variation on Solana's side.
   * @reference https://eips.ethereum.org/EIPS/eip-4361
   */
  async signInWithWeb3(credentials) {
    const { chain } = credentials;
    switch (chain) {
      case "ethereum":
        return await this.signInWithEthereum(credentials);
      case "solana":
        return await this.signInWithSolana(credentials);
      default:
        throw new Error(`@supabase/auth-js: Unsupported chain "${chain}"`);
    }
  }
  async signInWithEthereum(credentials) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l;
    let message;
    let signature;
    if ("message" in credentials) {
      message = credentials.message;
      signature = credentials.signature;
    } else {
      const { chain, wallet, statement, options } = credentials;
      let resolvedWallet;
      if (!isBrowser()) {
        if (typeof wallet !== "object" || !(options === null || options === void 0 ? void 0 : options.url)) {
          throw new Error("@supabase/auth-js: Both wallet and url must be specified in non-browser environments.");
        }
        resolvedWallet = wallet;
      } else if (typeof wallet === "object") {
        resolvedWallet = wallet;
      } else {
        const windowAny = window;
        if ("ethereum" in windowAny && typeof windowAny.ethereum === "object" && "request" in windowAny.ethereum && typeof windowAny.ethereum.request === "function") {
          resolvedWallet = windowAny.ethereum;
        } else {
          throw new Error(`@supabase/auth-js: No compatible Ethereum wallet interface on the window object (window.ethereum) detected. Make sure the user already has a wallet installed and connected for this app. Prefer passing the wallet interface object directly to signInWithWeb3({ chain: 'ethereum', wallet: resolvedUserWallet }) instead.`);
        }
      }
      const url = new URL((_a = options === null || options === void 0 ? void 0 : options.url) !== null && _a !== void 0 ? _a : window.location.href);
      const accounts = await resolvedWallet.request({
        method: "eth_requestAccounts"
      }).then((accs) => accs).catch(() => {
        throw new Error(`@supabase/auth-js: Wallet method eth_requestAccounts is missing or invalid`);
      });
      if (!accounts || accounts.length === 0) {
        throw new Error(`@supabase/auth-js: No accounts available. Please ensure the wallet is connected.`);
      }
      const address = getAddress(accounts[0]);
      let chainId = (_b = options === null || options === void 0 ? void 0 : options.signInWithEthereum) === null || _b === void 0 ? void 0 : _b.chainId;
      if (!chainId) {
        const chainIdHex = await resolvedWallet.request({
          method: "eth_chainId"
        });
        chainId = fromHex(chainIdHex);
      }
      const siweMessage = {
        domain: url.host,
        address,
        statement,
        uri: url.href,
        version: "1",
        chainId,
        nonce: (_c = options === null || options === void 0 ? void 0 : options.signInWithEthereum) === null || _c === void 0 ? void 0 : _c.nonce,
        issuedAt: (_e = (_d = options === null || options === void 0 ? void 0 : options.signInWithEthereum) === null || _d === void 0 ? void 0 : _d.issuedAt) !== null && _e !== void 0 ? _e : /* @__PURE__ */ new Date(),
        expirationTime: (_f = options === null || options === void 0 ? void 0 : options.signInWithEthereum) === null || _f === void 0 ? void 0 : _f.expirationTime,
        notBefore: (_g = options === null || options === void 0 ? void 0 : options.signInWithEthereum) === null || _g === void 0 ? void 0 : _g.notBefore,
        requestId: (_h = options === null || options === void 0 ? void 0 : options.signInWithEthereum) === null || _h === void 0 ? void 0 : _h.requestId,
        resources: (_j = options === null || options === void 0 ? void 0 : options.signInWithEthereum) === null || _j === void 0 ? void 0 : _j.resources
      };
      message = createSiweMessage(siweMessage);
      signature = await resolvedWallet.request({
        method: "personal_sign",
        params: [toHex(message), address]
      });
    }
    try {
      const { data, error } = await _request(this.fetch, "POST", `${this.url}/token?grant_type=web3`, {
        headers: this.headers,
        body: Object.assign({
          chain: "ethereum",
          message,
          signature
        }, ((_k = credentials.options) === null || _k === void 0 ? void 0 : _k.captchaToken) ? { gotrue_meta_security: { captcha_token: (_l = credentials.options) === null || _l === void 0 ? void 0 : _l.captchaToken } } : null),
        xform: _sessionResponse
      });
      if (error) {
        throw error;
      }
      if (!data || !data.session || !data.user) {
        const invalidTokenError = new AuthInvalidTokenResponseError();
        return this._returnResult({ data: { user: null, session: null }, error: invalidTokenError });
      }
      if (data.session) {
        await this._saveSession(data.session);
        await this._notifyAllSubscribers("SIGNED_IN", data.session);
      }
      return this._returnResult({ data: Object.assign({}, data), error });
    } catch (error) {
      if (isAuthError(error)) {
        return this._returnResult({ data: { user: null, session: null }, error });
      }
      throw error;
    }
  }
  async signInWithSolana(credentials) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m;
    let message;
    let signature;
    if ("message" in credentials) {
      message = credentials.message;
      signature = credentials.signature;
    } else {
      const { chain, wallet, statement, options } = credentials;
      let resolvedWallet;
      if (!isBrowser()) {
        if (typeof wallet !== "object" || !(options === null || options === void 0 ? void 0 : options.url)) {
          throw new Error("@supabase/auth-js: Both wallet and url must be specified in non-browser environments.");
        }
        resolvedWallet = wallet;
      } else if (typeof wallet === "object") {
        resolvedWallet = wallet;
      } else {
        const windowAny = window;
        if ("solana" in windowAny && typeof windowAny.solana === "object" && ("signIn" in windowAny.solana && typeof windowAny.solana.signIn === "function" || "signMessage" in windowAny.solana && typeof windowAny.solana.signMessage === "function")) {
          resolvedWallet = windowAny.solana;
        } else {
          throw new Error(`@supabase/auth-js: No compatible Solana wallet interface on the window object (window.solana) detected. Make sure the user already has a wallet installed and connected for this app. Prefer passing the wallet interface object directly to signInWithWeb3({ chain: 'solana', wallet: resolvedUserWallet }) instead.`);
        }
      }
      const url = new URL((_a = options === null || options === void 0 ? void 0 : options.url) !== null && _a !== void 0 ? _a : window.location.href);
      if ("signIn" in resolvedWallet && resolvedWallet.signIn) {
        const output = await resolvedWallet.signIn(Object.assign(Object.assign(Object.assign({ issuedAt: (/* @__PURE__ */ new Date()).toISOString() }, options === null || options === void 0 ? void 0 : options.signInWithSolana), {
          // non-overridable properties
          version: "1",
          domain: url.host,
          uri: url.href
        }), statement ? { statement } : null));
        let outputToProcess;
        if (Array.isArray(output) && output[0] && typeof output[0] === "object") {
          outputToProcess = output[0];
        } else if (output && typeof output === "object" && "signedMessage" in output && "signature" in output) {
          outputToProcess = output;
        } else {
          throw new Error("@supabase/auth-js: Wallet method signIn() returned unrecognized value");
        }
        if ("signedMessage" in outputToProcess && "signature" in outputToProcess && (typeof outputToProcess.signedMessage === "string" || outputToProcess.signedMessage instanceof Uint8Array) && outputToProcess.signature instanceof Uint8Array) {
          message = typeof outputToProcess.signedMessage === "string" ? outputToProcess.signedMessage : new TextDecoder().decode(outputToProcess.signedMessage);
          signature = outputToProcess.signature;
        } else {
          throw new Error("@supabase/auth-js: Wallet method signIn() API returned object without signedMessage and signature fields");
        }
      } else {
        if (!("signMessage" in resolvedWallet) || typeof resolvedWallet.signMessage !== "function" || !("publicKey" in resolvedWallet) || typeof resolvedWallet !== "object" || !resolvedWallet.publicKey || !("toBase58" in resolvedWallet.publicKey) || typeof resolvedWallet.publicKey.toBase58 !== "function") {
          throw new Error("@supabase/auth-js: Wallet does not have a compatible signMessage() and publicKey.toBase58() API");
        }
        message = [
          `${url.host} wants you to sign in with your Solana account:`,
          resolvedWallet.publicKey.toBase58(),
          ...statement ? ["", statement, ""] : [""],
          "Version: 1",
          `URI: ${url.href}`,
          `Issued At: ${(_c = (_b = options === null || options === void 0 ? void 0 : options.signInWithSolana) === null || _b === void 0 ? void 0 : _b.issuedAt) !== null && _c !== void 0 ? _c : (/* @__PURE__ */ new Date()).toISOString()}`,
          ...((_d = options === null || options === void 0 ? void 0 : options.signInWithSolana) === null || _d === void 0 ? void 0 : _d.notBefore) ? [`Not Before: ${options.signInWithSolana.notBefore}`] : [],
          ...((_e = options === null || options === void 0 ? void 0 : options.signInWithSolana) === null || _e === void 0 ? void 0 : _e.expirationTime) ? [`Expiration Time: ${options.signInWithSolana.expirationTime}`] : [],
          ...((_f = options === null || options === void 0 ? void 0 : options.signInWithSolana) === null || _f === void 0 ? void 0 : _f.chainId) ? [`Chain ID: ${options.signInWithSolana.chainId}`] : [],
          ...((_g = options === null || options === void 0 ? void 0 : options.signInWithSolana) === null || _g === void 0 ? void 0 : _g.nonce) ? [`Nonce: ${options.signInWithSolana.nonce}`] : [],
          ...((_h = options === null || options === void 0 ? void 0 : options.signInWithSolana) === null || _h === void 0 ? void 0 : _h.requestId) ? [`Request ID: ${options.signInWithSolana.requestId}`] : [],
          ...((_k = (_j = options === null || options === void 0 ? void 0 : options.signInWithSolana) === null || _j === void 0 ? void 0 : _j.resources) === null || _k === void 0 ? void 0 : _k.length) ? [
            "Resources",
            ...options.signInWithSolana.resources.map((resource) => `- ${resource}`)
          ] : []
        ].join("\n");
        const maybeSignature = await resolvedWallet.signMessage(new TextEncoder().encode(message), "utf8");
        if (!maybeSignature || !(maybeSignature instanceof Uint8Array)) {
          throw new Error("@supabase/auth-js: Wallet signMessage() API returned an recognized value");
        }
        signature = maybeSignature;
      }
    }
    try {
      const { data, error } = await _request(this.fetch, "POST", `${this.url}/token?grant_type=web3`, {
        headers: this.headers,
        body: Object.assign({ chain: "solana", message, signature: bytesToBase64URL(signature) }, ((_l = credentials.options) === null || _l === void 0 ? void 0 : _l.captchaToken) ? { gotrue_meta_security: { captcha_token: (_m = credentials.options) === null || _m === void 0 ? void 0 : _m.captchaToken } } : null),
        xform: _sessionResponse
      });
      if (error) {
        throw error;
      }
      if (!data || !data.session || !data.user) {
        const invalidTokenError = new AuthInvalidTokenResponseError();
        return this._returnResult({ data: { user: null, session: null }, error: invalidTokenError });
      }
      if (data.session) {
        await this._saveSession(data.session);
        await this._notifyAllSubscribers("SIGNED_IN", data.session);
      }
      return this._returnResult({ data: Object.assign({}, data), error });
    } catch (error) {
      if (isAuthError(error)) {
        return this._returnResult({ data: { user: null, session: null }, error });
      }
      throw error;
    }
  }
  async _exchangeCodeForSession(authCode) {
    const storageItem = await getItemAsync(this.storage, `${this.storageKey}-code-verifier`);
    const [codeVerifier, redirectType] = (storageItem !== null && storageItem !== void 0 ? storageItem : "").split("/");
    try {
      if (!codeVerifier && this.flowType === "pkce") {
        throw new AuthPKCECodeVerifierMissingError();
      }
      const { data, error } = await _request(this.fetch, "POST", `${this.url}/token?grant_type=pkce`, {
        headers: this.headers,
        body: {
          auth_code: authCode,
          code_verifier: codeVerifier
        },
        xform: _sessionResponse
      });
      await removeItemAsync(this.storage, `${this.storageKey}-code-verifier`);
      if (error) {
        throw error;
      }
      if (!data || !data.session || !data.user) {
        const invalidTokenError = new AuthInvalidTokenResponseError();
        return this._returnResult({
          data: { user: null, session: null, redirectType: null },
          error: invalidTokenError
        });
      }
      if (data.session) {
        await this._saveSession(data.session);
        await this._notifyAllSubscribers("SIGNED_IN", data.session);
      }
      return this._returnResult({ data: Object.assign(Object.assign({}, data), { redirectType: redirectType !== null && redirectType !== void 0 ? redirectType : null }), error });
    } catch (error) {
      await removeItemAsync(this.storage, `${this.storageKey}-code-verifier`);
      if (isAuthError(error)) {
        return this._returnResult({
          data: { user: null, session: null, redirectType: null },
          error
        });
      }
      throw error;
    }
  }
  /**
   * Allows signing in with an OIDC ID token. The authentication provider used
   * should be enabled and configured.
   */
  async signInWithIdToken(credentials) {
    try {
      const { options, provider, token, access_token, nonce } = credentials;
      const res = await _request(this.fetch, "POST", `${this.url}/token?grant_type=id_token`, {
        headers: this.headers,
        body: {
          provider,
          id_token: token,
          access_token,
          nonce,
          gotrue_meta_security: { captcha_token: options === null || options === void 0 ? void 0 : options.captchaToken }
        },
        xform: _sessionResponse
      });
      const { data, error } = res;
      if (error) {
        return this._returnResult({ data: { user: null, session: null }, error });
      } else if (!data || !data.session || !data.user) {
        const invalidTokenError = new AuthInvalidTokenResponseError();
        return this._returnResult({ data: { user: null, session: null }, error: invalidTokenError });
      }
      if (data.session) {
        await this._saveSession(data.session);
        await this._notifyAllSubscribers("SIGNED_IN", data.session);
      }
      return this._returnResult({ data, error });
    } catch (error) {
      if (isAuthError(error)) {
        return this._returnResult({ data: { user: null, session: null }, error });
      }
      throw error;
    }
  }
  /**
   * Log in a user using magiclink or a one-time password (OTP).
   *
   * If the `{{ .ConfirmationURL }}` variable is specified in the email template, a magiclink will be sent.
   * If the `{{ .Token }}` variable is specified in the email template, an OTP will be sent.
   * If you're using phone sign-ins, only an OTP will be sent. You won't be able to send a magiclink for phone sign-ins.
   *
   * Be aware that you may get back an error message that will not distinguish
   * between the cases where the account does not exist or, that the account
   * can only be accessed via social login.
   *
   * Do note that you will need to configure a Whatsapp sender on Twilio
   * if you are using phone sign in with the 'whatsapp' channel. The whatsapp
   * channel is not supported on other providers
   * at this time.
   * This method supports PKCE when an email is passed.
   */
  async signInWithOtp(credentials) {
    var _a, _b, _c, _d, _e;
    try {
      if ("email" in credentials) {
        const { email, options } = credentials;
        let codeChallenge = null;
        let codeChallengeMethod = null;
        if (this.flowType === "pkce") {
          ;
          [codeChallenge, codeChallengeMethod] = await getCodeChallengeAndMethod(this.storage, this.storageKey);
        }
        const { error } = await _request(this.fetch, "POST", `${this.url}/otp`, {
          headers: this.headers,
          body: {
            email,
            data: (_a = options === null || options === void 0 ? void 0 : options.data) !== null && _a !== void 0 ? _a : {},
            create_user: (_b = options === null || options === void 0 ? void 0 : options.shouldCreateUser) !== null && _b !== void 0 ? _b : true,
            gotrue_meta_security: { captcha_token: options === null || options === void 0 ? void 0 : options.captchaToken },
            code_challenge: codeChallenge,
            code_challenge_method: codeChallengeMethod
          },
          redirectTo: options === null || options === void 0 ? void 0 : options.emailRedirectTo
        });
        return this._returnResult({ data: { user: null, session: null }, error });
      }
      if ("phone" in credentials) {
        const { phone, options } = credentials;
        const { data, error } = await _request(this.fetch, "POST", `${this.url}/otp`, {
          headers: this.headers,
          body: {
            phone,
            data: (_c = options === null || options === void 0 ? void 0 : options.data) !== null && _c !== void 0 ? _c : {},
            create_user: (_d = options === null || options === void 0 ? void 0 : options.shouldCreateUser) !== null && _d !== void 0 ? _d : true,
            gotrue_meta_security: { captcha_token: options === null || options === void 0 ? void 0 : options.captchaToken },
            channel: (_e = options === null || options === void 0 ? void 0 : options.channel) !== null && _e !== void 0 ? _e : "sms"
          }
        });
        return this._returnResult({
          data: { user: null, session: null, messageId: data === null || data === void 0 ? void 0 : data.message_id },
          error
        });
      }
      throw new AuthInvalidCredentialsError("You must provide either an email or phone number.");
    } catch (error) {
      await removeItemAsync(this.storage, `${this.storageKey}-code-verifier`);
      if (isAuthError(error)) {
        return this._returnResult({ data: { user: null, session: null }, error });
      }
      throw error;
    }
  }
  /**
   * Log in a user given a User supplied OTP or TokenHash received through mobile or email.
   */
  async verifyOtp(params) {
    var _a, _b;
    try {
      let redirectTo = void 0;
      let captchaToken = void 0;
      if ("options" in params) {
        redirectTo = (_a = params.options) === null || _a === void 0 ? void 0 : _a.redirectTo;
        captchaToken = (_b = params.options) === null || _b === void 0 ? void 0 : _b.captchaToken;
      }
      const { data, error } = await _request(this.fetch, "POST", `${this.url}/verify`, {
        headers: this.headers,
        body: Object.assign(Object.assign({}, params), { gotrue_meta_security: { captcha_token: captchaToken } }),
        redirectTo,
        xform: _sessionResponse
      });
      if (error) {
        throw error;
      }
      if (!data) {
        const tokenVerificationError = new Error("An error occurred on token verification.");
        throw tokenVerificationError;
      }
      const session = data.session;
      const user = data.user;
      if (session === null || session === void 0 ? void 0 : session.access_token) {
        await this._saveSession(session);
        await this._notifyAllSubscribers(params.type == "recovery" ? "PASSWORD_RECOVERY" : "SIGNED_IN", session);
      }
      return this._returnResult({ data: { user, session }, error: null });
    } catch (error) {
      if (isAuthError(error)) {
        return this._returnResult({ data: { user: null, session: null }, error });
      }
      throw error;
    }
  }
  /**
   * Attempts a single-sign on using an enterprise Identity Provider. A
   * successful SSO attempt will redirect the current page to the identity
   * provider authorization page. The redirect URL is implementation and SSO
   * protocol specific.
   *
   * You can use it by providing a SSO domain. Typically you can extract this
   * domain by asking users for their email address. If this domain is
   * registered on the Auth instance the redirect will use that organization's
   * currently active SSO Identity Provider for the login.
   *
   * If you have built an organization-specific login page, you can use the
   * organization's SSO Identity Provider UUID directly instead.
   */
  async signInWithSSO(params) {
    var _a, _b, _c, _d, _e;
    try {
      let codeChallenge = null;
      let codeChallengeMethod = null;
      if (this.flowType === "pkce") {
        ;
        [codeChallenge, codeChallengeMethod] = await getCodeChallengeAndMethod(this.storage, this.storageKey);
      }
      const result = await _request(this.fetch, "POST", `${this.url}/sso`, {
        body: Object.assign(Object.assign(Object.assign(Object.assign(Object.assign({}, "providerId" in params ? { provider_id: params.providerId } : null), "domain" in params ? { domain: params.domain } : null), { redirect_to: (_b = (_a = params.options) === null || _a === void 0 ? void 0 : _a.redirectTo) !== null && _b !== void 0 ? _b : void 0 }), ((_c = params === null || params === void 0 ? void 0 : params.options) === null || _c === void 0 ? void 0 : _c.captchaToken) ? { gotrue_meta_security: { captcha_token: params.options.captchaToken } } : null), { skip_http_redirect: true, code_challenge: codeChallenge, code_challenge_method: codeChallengeMethod }),
        headers: this.headers,
        xform: _ssoResponse
      });
      if (((_d = result.data) === null || _d === void 0 ? void 0 : _d.url) && isBrowser() && !((_e = params.options) === null || _e === void 0 ? void 0 : _e.skipBrowserRedirect)) {
        window.location.assign(result.data.url);
      }
      return this._returnResult(result);
    } catch (error) {
      await removeItemAsync(this.storage, `${this.storageKey}-code-verifier`);
      if (isAuthError(error)) {
        return this._returnResult({ data: null, error });
      }
      throw error;
    }
  }
  /**
   * Sends a reauthentication OTP to the user's email or phone number.
   * Requires the user to be signed-in.
   */
  async reauthenticate() {
    await this.initializePromise;
    return await this._acquireLock(this.lockAcquireTimeout, async () => {
      return await this._reauthenticate();
    });
  }
  async _reauthenticate() {
    try {
      return await this._useSession(async (result) => {
        const { data: { session }, error: sessionError } = result;
        if (sessionError)
          throw sessionError;
        if (!session)
          throw new AuthSessionMissingError();
        const { error } = await _request(this.fetch, "GET", `${this.url}/reauthenticate`, {
          headers: this.headers,
          jwt: session.access_token
        });
        return this._returnResult({ data: { user: null, session: null }, error });
      });
    } catch (error) {
      if (isAuthError(error)) {
        return this._returnResult({ data: { user: null, session: null }, error });
      }
      throw error;
    }
  }
  /**
   * Resends an existing signup confirmation email, email change email, SMS OTP or phone change OTP.
   */
  async resend(credentials) {
    try {
      const endpoint = `${this.url}/resend`;
      if ("email" in credentials) {
        const { email, type, options } = credentials;
        const { error } = await _request(this.fetch, "POST", endpoint, {
          headers: this.headers,
          body: {
            email,
            type,
            gotrue_meta_security: { captcha_token: options === null || options === void 0 ? void 0 : options.captchaToken }
          },
          redirectTo: options === null || options === void 0 ? void 0 : options.emailRedirectTo
        });
        return this._returnResult({ data: { user: null, session: null }, error });
      } else if ("phone" in credentials) {
        const { phone, type, options } = credentials;
        const { data, error } = await _request(this.fetch, "POST", endpoint, {
          headers: this.headers,
          body: {
            phone,
            type,
            gotrue_meta_security: { captcha_token: options === null || options === void 0 ? void 0 : options.captchaToken }
          }
        });
        return this._returnResult({
          data: { user: null, session: null, messageId: data === null || data === void 0 ? void 0 : data.message_id },
          error
        });
      }
      throw new AuthInvalidCredentialsError("You must provide either an email or phone number and a type");
    } catch (error) {
      if (isAuthError(error)) {
        return this._returnResult({ data: { user: null, session: null }, error });
      }
      throw error;
    }
  }
  /**
   * Returns the session, refreshing it if necessary.
   *
   * The session returned can be null if the session is not detected which can happen in the event a user is not signed-in or has logged out.
   *
   * **IMPORTANT:** This method loads values directly from the storage attached
   * to the client. If that storage is based on request cookies for example,
   * the values in it may not be authentic and therefore it's strongly advised
   * against using this method and its results in such circumstances. A warning
   * will be emitted if this is detected. Use {@link #getUser()} instead.
   */
  async getSession() {
    await this.initializePromise;
    const result = await this._acquireLock(this.lockAcquireTimeout, async () => {
      return this._useSession(async (result2) => {
        return result2;
      });
    });
    return result;
  }
  /**
   * Acquires a global lock based on the storage key.
   */
  async _acquireLock(acquireTimeout, fn) {
    this._debug("#_acquireLock", "begin", acquireTimeout);
    try {
      if (this.lockAcquired) {
        const last = this.pendingInLock.length ? this.pendingInLock[this.pendingInLock.length - 1] : Promise.resolve();
        const result = (async () => {
          await last;
          return await fn();
        })();
        this.pendingInLock.push((async () => {
          try {
            await result;
          } catch (e) {
          }
        })());
        return result;
      }
      return await this.lock(`lock:${this.storageKey}`, acquireTimeout, async () => {
        this._debug("#_acquireLock", "lock acquired for storage key", this.storageKey);
        try {
          this.lockAcquired = true;
          const result = fn();
          this.pendingInLock.push((async () => {
            try {
              await result;
            } catch (e) {
            }
          })());
          await result;
          while (this.pendingInLock.length) {
            const waitOn = [...this.pendingInLock];
            await Promise.all(waitOn);
            this.pendingInLock.splice(0, waitOn.length);
          }
          return await result;
        } finally {
          this._debug("#_acquireLock", "lock released for storage key", this.storageKey);
          this.lockAcquired = false;
        }
      });
    } finally {
      this._debug("#_acquireLock", "end");
    }
  }
  /**
   * Use instead of {@link #getSession} inside the library. It is
   * semantically usually what you want, as getting a session involves some
   * processing afterwards that requires only one client operating on the
   * session at once across multiple tabs or processes.
   */
  async _useSession(fn) {
    this._debug("#_useSession", "begin");
    try {
      const result = await this.__loadSession();
      return await fn(result);
    } finally {
      this._debug("#_useSession", "end");
    }
  }
  /**
   * NEVER USE DIRECTLY!
   *
   * Always use {@link #_useSession}.
   */
  async __loadSession() {
    this._debug("#__loadSession()", "begin");
    if (!this.lockAcquired) {
      this._debug("#__loadSession()", "used outside of an acquired lock!", new Error().stack);
    }
    try {
      let currentSession = null;
      const maybeSession = await getItemAsync(this.storage, this.storageKey);
      this._debug("#getSession()", "session from storage", maybeSession);
      if (maybeSession !== null) {
        if (this._isValidSession(maybeSession)) {
          currentSession = maybeSession;
        } else {
          this._debug("#getSession()", "session from storage is not valid");
          await this._removeSession();
        }
      }
      if (!currentSession) {
        return { data: { session: null }, error: null };
      }
      const hasExpired = currentSession.expires_at ? currentSession.expires_at * 1e3 - Date.now() < EXPIRY_MARGIN_MS : false;
      this._debug("#__loadSession()", `session has${hasExpired ? "" : " not"} expired`, "expires_at", currentSession.expires_at);
      if (!hasExpired) {
        if (this.userStorage) {
          const maybeUser = await getItemAsync(this.userStorage, this.storageKey + "-user");
          if (maybeUser === null || maybeUser === void 0 ? void 0 : maybeUser.user) {
            currentSession.user = maybeUser.user;
          } else {
            currentSession.user = userNotAvailableProxy();
          }
        }
        if (this.storage.isServer && currentSession.user && !currentSession.user.__isUserNotAvailableProxy) {
          const suppressWarningRef = { value: this.suppressGetSessionWarning };
          currentSession.user = insecureUserWarningProxy(currentSession.user, suppressWarningRef);
          if (suppressWarningRef.value) {
            this.suppressGetSessionWarning = true;
          }
        }
        return { data: { session: currentSession }, error: null };
      }
      const { data: session, error } = await this._callRefreshToken(currentSession.refresh_token);
      if (error) {
        return this._returnResult({ data: { session: null }, error });
      }
      return this._returnResult({ data: { session }, error: null });
    } finally {
      this._debug("#__loadSession()", "end");
    }
  }
  /**
   * Gets the current user details if there is an existing session. This method
   * performs a network request to the Supabase Auth server, so the returned
   * value is authentic and can be used to base authorization rules on.
   *
   * @param jwt Takes in an optional access token JWT. If no JWT is provided, the JWT from the current session is used.
   */
  async getUser(jwt) {
    if (jwt) {
      return await this._getUser(jwt);
    }
    await this.initializePromise;
    const result = await this._acquireLock(this.lockAcquireTimeout, async () => {
      return await this._getUser();
    });
    if (result.data.user) {
      this.suppressGetSessionWarning = true;
    }
    return result;
  }
  async _getUser(jwt) {
    try {
      if (jwt) {
        return await _request(this.fetch, "GET", `${this.url}/user`, {
          headers: this.headers,
          jwt,
          xform: _userResponse
        });
      }
      return await this._useSession(async (result) => {
        var _a, _b, _c;
        const { data, error } = result;
        if (error) {
          throw error;
        }
        if (!((_a = data.session) === null || _a === void 0 ? void 0 : _a.access_token) && !this.hasCustomAuthorizationHeader) {
          return { data: { user: null }, error: new AuthSessionMissingError() };
        }
        return await _request(this.fetch, "GET", `${this.url}/user`, {
          headers: this.headers,
          jwt: (_c = (_b = data.session) === null || _b === void 0 ? void 0 : _b.access_token) !== null && _c !== void 0 ? _c : void 0,
          xform: _userResponse
        });
      });
    } catch (error) {
      if (isAuthError(error)) {
        if (isAuthSessionMissingError(error)) {
          await this._removeSession();
          await removeItemAsync(this.storage, `${this.storageKey}-code-verifier`);
        }
        return this._returnResult({ data: { user: null }, error });
      }
      throw error;
    }
  }
  /**
   * Updates user data for a logged in user.
   */
  async updateUser(attributes, options = {}) {
    await this.initializePromise;
    return await this._acquireLock(this.lockAcquireTimeout, async () => {
      return await this._updateUser(attributes, options);
    });
  }
  async _updateUser(attributes, options = {}) {
    try {
      return await this._useSession(async (result) => {
        const { data: sessionData, error: sessionError } = result;
        if (sessionError) {
          throw sessionError;
        }
        if (!sessionData.session) {
          throw new AuthSessionMissingError();
        }
        const session = sessionData.session;
        let codeChallenge = null;
        let codeChallengeMethod = null;
        if (this.flowType === "pkce" && attributes.email != null) {
          ;
          [codeChallenge, codeChallengeMethod] = await getCodeChallengeAndMethod(this.storage, this.storageKey);
        }
        const { data, error: userError } = await _request(this.fetch, "PUT", `${this.url}/user`, {
          headers: this.headers,
          redirectTo: options === null || options === void 0 ? void 0 : options.emailRedirectTo,
          body: Object.assign(Object.assign({}, attributes), { code_challenge: codeChallenge, code_challenge_method: codeChallengeMethod }),
          jwt: session.access_token,
          xform: _userResponse
        });
        if (userError) {
          throw userError;
        }
        session.user = data.user;
        await this._saveSession(session);
        await this._notifyAllSubscribers("USER_UPDATED", session);
        return this._returnResult({ data: { user: session.user }, error: null });
      });
    } catch (error) {
      await removeItemAsync(this.storage, `${this.storageKey}-code-verifier`);
      if (isAuthError(error)) {
        return this._returnResult({ data: { user: null }, error });
      }
      throw error;
    }
  }
  /**
   * Sets the session data from the current session. If the current session is expired, setSession will take care of refreshing it to obtain a new session.
   * If the refresh token or access token in the current session is invalid, an error will be thrown.
   * @param currentSession The current session that minimally contains an access token and refresh token.
   */
  async setSession(currentSession) {
    await this.initializePromise;
    return await this._acquireLock(this.lockAcquireTimeout, async () => {
      return await this._setSession(currentSession);
    });
  }
  async _setSession(currentSession) {
    try {
      if (!currentSession.access_token || !currentSession.refresh_token) {
        throw new AuthSessionMissingError();
      }
      const timeNow = Date.now() / 1e3;
      let expiresAt2 = timeNow;
      let hasExpired = true;
      let session = null;
      const { payload } = decodeJWT(currentSession.access_token);
      if (payload.exp) {
        expiresAt2 = payload.exp;
        hasExpired = expiresAt2 <= timeNow;
      }
      if (hasExpired) {
        const { data: refreshedSession, error } = await this._callRefreshToken(currentSession.refresh_token);
        if (error) {
          return this._returnResult({ data: { user: null, session: null }, error });
        }
        if (!refreshedSession) {
          return { data: { user: null, session: null }, error: null };
        }
        session = refreshedSession;
      } else {
        const { data, error } = await this._getUser(currentSession.access_token);
        if (error) {
          return this._returnResult({ data: { user: null, session: null }, error });
        }
        session = {
          access_token: currentSession.access_token,
          refresh_token: currentSession.refresh_token,
          user: data.user,
          token_type: "bearer",
          expires_in: expiresAt2 - timeNow,
          expires_at: expiresAt2
        };
        await this._saveSession(session);
        await this._notifyAllSubscribers("SIGNED_IN", session);
      }
      return this._returnResult({ data: { user: session.user, session }, error: null });
    } catch (error) {
      if (isAuthError(error)) {
        return this._returnResult({ data: { session: null, user: null }, error });
      }
      throw error;
    }
  }
  /**
   * Returns a new session, regardless of expiry status.
   * Takes in an optional current session. If not passed in, then refreshSession() will attempt to retrieve it from getSession().
   * If the current session's refresh token is invalid, an error will be thrown.
   * @param currentSession The current session. If passed in, it must contain a refresh token.
   */
  async refreshSession(currentSession) {
    await this.initializePromise;
    return await this._acquireLock(this.lockAcquireTimeout, async () => {
      return await this._refreshSession(currentSession);
    });
  }
  async _refreshSession(currentSession) {
    try {
      return await this._useSession(async (result) => {
        var _a;
        if (!currentSession) {
          const { data, error: error2 } = result;
          if (error2) {
            throw error2;
          }
          currentSession = (_a = data.session) !== null && _a !== void 0 ? _a : void 0;
        }
        if (!(currentSession === null || currentSession === void 0 ? void 0 : currentSession.refresh_token)) {
          throw new AuthSessionMissingError();
        }
        const { data: session, error } = await this._callRefreshToken(currentSession.refresh_token);
        if (error) {
          return this._returnResult({ data: { user: null, session: null }, error });
        }
        if (!session) {
          return this._returnResult({ data: { user: null, session: null }, error: null });
        }
        return this._returnResult({ data: { user: session.user, session }, error: null });
      });
    } catch (error) {
      if (isAuthError(error)) {
        return this._returnResult({ data: { user: null, session: null }, error });
      }
      throw error;
    }
  }
  /**
   * Gets the session data from a URL string
   */
  async _getSessionFromURL(params, callbackUrlType) {
    try {
      if (!isBrowser())
        throw new AuthImplicitGrantRedirectError("No browser detected.");
      if (params.error || params.error_description || params.error_code) {
        throw new AuthImplicitGrantRedirectError(params.error_description || "Error in URL with unspecified error_description", {
          error: params.error || "unspecified_error",
          code: params.error_code || "unspecified_code"
        });
      }
      switch (callbackUrlType) {
        case "implicit":
          if (this.flowType === "pkce") {
            throw new AuthPKCEGrantCodeExchangeError("Not a valid PKCE flow url.");
          }
          break;
        case "pkce":
          if (this.flowType === "implicit") {
            throw new AuthImplicitGrantRedirectError("Not a valid implicit grant flow url.");
          }
          break;
        default:
      }
      if (callbackUrlType === "pkce") {
        this._debug("#_initialize()", "begin", "is PKCE flow", true);
        if (!params.code)
          throw new AuthPKCEGrantCodeExchangeError("No code detected.");
        const { data: data2, error: error2 } = await this._exchangeCodeForSession(params.code);
        if (error2)
          throw error2;
        const url = new URL(window.location.href);
        url.searchParams.delete("code");
        window.history.replaceState(window.history.state, "", url.toString());
        return { data: { session: data2.session, redirectType: null }, error: null };
      }
      const { provider_token, provider_refresh_token, access_token, refresh_token, expires_in, expires_at, token_type } = params;
      if (!access_token || !expires_in || !refresh_token || !token_type) {
        throw new AuthImplicitGrantRedirectError("No session defined in URL");
      }
      const timeNow = Math.round(Date.now() / 1e3);
      const expiresIn = parseInt(expires_in);
      let expiresAt2 = timeNow + expiresIn;
      if (expires_at) {
        expiresAt2 = parseInt(expires_at);
      }
      const actuallyExpiresIn = expiresAt2 - timeNow;
      if (actuallyExpiresIn * 1e3 <= AUTO_REFRESH_TICK_DURATION_MS) {
        console.warn(`@supabase/gotrue-js: Session as retrieved from URL expires in ${actuallyExpiresIn}s, should have been closer to ${expiresIn}s`);
      }
      const issuedAt = expiresAt2 - expiresIn;
      if (timeNow - issuedAt >= 120) {
        console.warn("@supabase/gotrue-js: Session as retrieved from URL was issued over 120s ago, URL could be stale", issuedAt, expiresAt2, timeNow);
      } else if (timeNow - issuedAt < 0) {
        console.warn("@supabase/gotrue-js: Session as retrieved from URL was issued in the future? Check the device clock for skew", issuedAt, expiresAt2, timeNow);
      }
      const { data, error } = await this._getUser(access_token);
      if (error)
        throw error;
      const session = {
        provider_token,
        provider_refresh_token,
        access_token,
        expires_in: expiresIn,
        expires_at: expiresAt2,
        refresh_token,
        token_type,
        user: data.user
      };
      window.location.hash = "";
      this._debug("#_getSessionFromURL()", "clearing window.location.hash");
      return this._returnResult({ data: { session, redirectType: params.type }, error: null });
    } catch (error) {
      if (isAuthError(error)) {
        return this._returnResult({ data: { session: null, redirectType: null }, error });
      }
      throw error;
    }
  }
  /**
   * Checks if the current URL contains parameters given by an implicit oauth grant flow (https://www.rfc-editor.org/rfc/rfc6749.html#section-4.2)
   *
   * If `detectSessionInUrl` is a function, it will be called with the URL and params to determine
   * if the URL should be processed as a Supabase auth callback. This allows users to exclude
   * URLs from other OAuth providers (e.g., Facebook Login) that also return access_token in the fragment.
   */
  _isImplicitGrantCallback(params) {
    if (typeof this.detectSessionInUrl === "function") {
      return this.detectSessionInUrl(new URL(window.location.href), params);
    }
    return Boolean(params.access_token || params.error_description);
  }
  /**
   * Checks if the current URL and backing storage contain parameters given by a PKCE flow
   */
  async _isPKCECallback(params) {
    const currentStorageContent = await getItemAsync(this.storage, `${this.storageKey}-code-verifier`);
    return !!(params.code && currentStorageContent);
  }
  /**
   * Inside a browser context, `signOut()` will remove the logged in user from the browser session and log them out - removing all items from localstorage and then trigger a `"SIGNED_OUT"` event.
   *
   * For server-side management, you can revoke all refresh tokens for a user by passing a user's JWT through to `auth.api.signOut(JWT: string)`.
   * There is no way to revoke a user's access token jwt until it expires. It is recommended to set a shorter expiry on the jwt for this reason.
   *
   * If using `others` scope, no `SIGNED_OUT` event is fired!
   */
  async signOut(options = { scope: "global" }) {
    await this.initializePromise;
    return await this._acquireLock(this.lockAcquireTimeout, async () => {
      return await this._signOut(options);
    });
  }
  async _signOut({ scope } = { scope: "global" }) {
    return await this._useSession(async (result) => {
      var _a;
      const { data, error: sessionError } = result;
      if (sessionError && !isAuthSessionMissingError(sessionError)) {
        return this._returnResult({ error: sessionError });
      }
      const accessToken = (_a = data.session) === null || _a === void 0 ? void 0 : _a.access_token;
      if (accessToken) {
        const { error } = await this.admin.signOut(accessToken, scope);
        if (error) {
          if (!(isAuthApiError(error) && (error.status === 404 || error.status === 401 || error.status === 403) || isAuthSessionMissingError(error))) {
            return this._returnResult({ error });
          }
        }
      }
      if (scope !== "others") {
        await this._removeSession();
        await removeItemAsync(this.storage, `${this.storageKey}-code-verifier`);
      }
      return this._returnResult({ error: null });
    });
  }
  onAuthStateChange(callback) {
    const id = generateCallbackId();
    const subscription = {
      id,
      callback,
      unsubscribe: () => {
        this._debug("#unsubscribe()", "state change callback with id removed", id);
        this.stateChangeEmitters.delete(id);
      }
    };
    this._debug("#onAuthStateChange()", "registered callback with id", id);
    this.stateChangeEmitters.set(id, subscription);
    (async () => {
      await this.initializePromise;
      await this._acquireLock(this.lockAcquireTimeout, async () => {
        this._emitInitialSession(id);
      });
    })();
    return { data: { subscription } };
  }
  async _emitInitialSession(id) {
    return await this._useSession(async (result) => {
      var _a, _b;
      try {
        const { data: { session }, error } = result;
        if (error)
          throw error;
        await ((_a = this.stateChangeEmitters.get(id)) === null || _a === void 0 ? void 0 : _a.callback("INITIAL_SESSION", session));
        this._debug("INITIAL_SESSION", "callback id", id, "session", session);
      } catch (err) {
        await ((_b = this.stateChangeEmitters.get(id)) === null || _b === void 0 ? void 0 : _b.callback("INITIAL_SESSION", null));
        this._debug("INITIAL_SESSION", "callback id", id, "error", err);
        console.error(err);
      }
    });
  }
  /**
   * Sends a password reset request to an email address. This method supports the PKCE flow.
   *
   * @param email The email address of the user.
   * @param options.redirectTo The URL to send the user to after they click the password reset link.
   * @param options.captchaToken Verification token received when the user completes the captcha on the site.
   */
  async resetPasswordForEmail(email, options = {}) {
    let codeChallenge = null;
    let codeChallengeMethod = null;
    if (this.flowType === "pkce") {
      ;
      [codeChallenge, codeChallengeMethod] = await getCodeChallengeAndMethod(
        this.storage,
        this.storageKey,
        true
        // isPasswordRecovery
      );
    }
    try {
      return await _request(this.fetch, "POST", `${this.url}/recover`, {
        body: {
          email,
          code_challenge: codeChallenge,
          code_challenge_method: codeChallengeMethod,
          gotrue_meta_security: { captcha_token: options.captchaToken }
        },
        headers: this.headers,
        redirectTo: options.redirectTo
      });
    } catch (error) {
      await removeItemAsync(this.storage, `${this.storageKey}-code-verifier`);
      if (isAuthError(error)) {
        return this._returnResult({ data: null, error });
      }
      throw error;
    }
  }
  /**
   * Gets all the identities linked to a user.
   */
  async getUserIdentities() {
    var _a;
    try {
      const { data, error } = await this.getUser();
      if (error)
        throw error;
      return this._returnResult({ data: { identities: (_a = data.user.identities) !== null && _a !== void 0 ? _a : [] }, error: null });
    } catch (error) {
      if (isAuthError(error)) {
        return this._returnResult({ data: null, error });
      }
      throw error;
    }
  }
  async linkIdentity(credentials) {
    if ("token" in credentials) {
      return this.linkIdentityIdToken(credentials);
    }
    return this.linkIdentityOAuth(credentials);
  }
  async linkIdentityOAuth(credentials) {
    var _a;
    try {
      const { data, error } = await this._useSession(async (result) => {
        var _a2, _b, _c, _d, _e;
        const { data: data2, error: error2 } = result;
        if (error2)
          throw error2;
        const url = await this._getUrlForProvider(`${this.url}/user/identities/authorize`, credentials.provider, {
          redirectTo: (_a2 = credentials.options) === null || _a2 === void 0 ? void 0 : _a2.redirectTo,
          scopes: (_b = credentials.options) === null || _b === void 0 ? void 0 : _b.scopes,
          queryParams: (_c = credentials.options) === null || _c === void 0 ? void 0 : _c.queryParams,
          skipBrowserRedirect: true
        });
        return await _request(this.fetch, "GET", url, {
          headers: this.headers,
          jwt: (_e = (_d = data2.session) === null || _d === void 0 ? void 0 : _d.access_token) !== null && _e !== void 0 ? _e : void 0
        });
      });
      if (error)
        throw error;
      if (isBrowser() && !((_a = credentials.options) === null || _a === void 0 ? void 0 : _a.skipBrowserRedirect)) {
        window.location.assign(data === null || data === void 0 ? void 0 : data.url);
      }
      return this._returnResult({
        data: { provider: credentials.provider, url: data === null || data === void 0 ? void 0 : data.url },
        error: null
      });
    } catch (error) {
      if (isAuthError(error)) {
        return this._returnResult({ data: { provider: credentials.provider, url: null }, error });
      }
      throw error;
    }
  }
  async linkIdentityIdToken(credentials) {
    return await this._useSession(async (result) => {
      var _a;
      try {
        const { error: sessionError, data: { session } } = result;
        if (sessionError)
          throw sessionError;
        const { options, provider, token, access_token, nonce } = credentials;
        const res = await _request(this.fetch, "POST", `${this.url}/token?grant_type=id_token`, {
          headers: this.headers,
          jwt: (_a = session === null || session === void 0 ? void 0 : session.access_token) !== null && _a !== void 0 ? _a : void 0,
          body: {
            provider,
            id_token: token,
            access_token,
            nonce,
            link_identity: true,
            gotrue_meta_security: { captcha_token: options === null || options === void 0 ? void 0 : options.captchaToken }
          },
          xform: _sessionResponse
        });
        const { data, error } = res;
        if (error) {
          return this._returnResult({ data: { user: null, session: null }, error });
        } else if (!data || !data.session || !data.user) {
          return this._returnResult({
            data: { user: null, session: null },
            error: new AuthInvalidTokenResponseError()
          });
        }
        if (data.session) {
          await this._saveSession(data.session);
          await this._notifyAllSubscribers("USER_UPDATED", data.session);
        }
        return this._returnResult({ data, error });
      } catch (error) {
        await removeItemAsync(this.storage, `${this.storageKey}-code-verifier`);
        if (isAuthError(error)) {
          return this._returnResult({ data: { user: null, session: null }, error });
        }
        throw error;
      }
    });
  }
  /**
   * Unlinks an identity from a user by deleting it. The user will no longer be able to sign in with that identity once it's unlinked.
   */
  async unlinkIdentity(identity) {
    try {
      return await this._useSession(async (result) => {
        var _a, _b;
        const { data, error } = result;
        if (error) {
          throw error;
        }
        return await _request(this.fetch, "DELETE", `${this.url}/user/identities/${identity.identity_id}`, {
          headers: this.headers,
          jwt: (_b = (_a = data.session) === null || _a === void 0 ? void 0 : _a.access_token) !== null && _b !== void 0 ? _b : void 0
        });
      });
    } catch (error) {
      if (isAuthError(error)) {
        return this._returnResult({ data: null, error });
      }
      throw error;
    }
  }
  /**
   * Generates a new JWT.
   * @param refreshToken A valid refresh token that was returned on login.
   */
  async _refreshAccessToken(refreshToken) {
    const debugName = `#_refreshAccessToken(${refreshToken.substring(0, 5)}...)`;
    this._debug(debugName, "begin");
    try {
      const startedAt = Date.now();
      return await retryable(async (attempt) => {
        if (attempt > 0) {
          await sleep(200 * Math.pow(2, attempt - 1));
        }
        this._debug(debugName, "refreshing attempt", attempt);
        return await _request(this.fetch, "POST", `${this.url}/token?grant_type=refresh_token`, {
          body: { refresh_token: refreshToken },
          headers: this.headers,
          xform: _sessionResponse
        });
      }, (attempt, error) => {
        const nextBackOffInterval = 200 * Math.pow(2, attempt);
        return error && isAuthRetryableFetchError(error) && // retryable only if the request can be sent before the backoff overflows the tick duration
        Date.now() + nextBackOffInterval - startedAt < AUTO_REFRESH_TICK_DURATION_MS;
      });
    } catch (error) {
      this._debug(debugName, "error", error);
      if (isAuthError(error)) {
        return this._returnResult({ data: { session: null, user: null }, error });
      }
      throw error;
    } finally {
      this._debug(debugName, "end");
    }
  }
  _isValidSession(maybeSession) {
    const isValidSession = typeof maybeSession === "object" && maybeSession !== null && "access_token" in maybeSession && "refresh_token" in maybeSession && "expires_at" in maybeSession;
    return isValidSession;
  }
  async _handleProviderSignIn(provider, options) {
    const url = await this._getUrlForProvider(`${this.url}/authorize`, provider, {
      redirectTo: options.redirectTo,
      scopes: options.scopes,
      queryParams: options.queryParams
    });
    this._debug("#_handleProviderSignIn()", "provider", provider, "options", options, "url", url);
    if (isBrowser() && !options.skipBrowserRedirect) {
      window.location.assign(url);
    }
    return { data: { provider, url }, error: null };
  }
  /**
   * Recovers the session from LocalStorage and refreshes the token
   * Note: this method is async to accommodate for AsyncStorage e.g. in React native.
   */
  async _recoverAndRefresh() {
    var _a, _b;
    const debugName = "#_recoverAndRefresh()";
    this._debug(debugName, "begin");
    try {
      const currentSession = await getItemAsync(this.storage, this.storageKey);
      if (currentSession && this.userStorage) {
        let maybeUser = await getItemAsync(this.userStorage, this.storageKey + "-user");
        if (!this.storage.isServer && Object.is(this.storage, this.userStorage) && !maybeUser) {
          maybeUser = { user: currentSession.user };
          await setItemAsync(this.userStorage, this.storageKey + "-user", maybeUser);
        }
        currentSession.user = (_a = maybeUser === null || maybeUser === void 0 ? void 0 : maybeUser.user) !== null && _a !== void 0 ? _a : userNotAvailableProxy();
      } else if (currentSession && !currentSession.user) {
        if (!currentSession.user) {
          const separateUser = await getItemAsync(this.storage, this.storageKey + "-user");
          if (separateUser && (separateUser === null || separateUser === void 0 ? void 0 : separateUser.user)) {
            currentSession.user = separateUser.user;
            await removeItemAsync(this.storage, this.storageKey + "-user");
            await setItemAsync(this.storage, this.storageKey, currentSession);
          } else {
            currentSession.user = userNotAvailableProxy();
          }
        }
      }
      this._debug(debugName, "session from storage", currentSession);
      if (!this._isValidSession(currentSession)) {
        this._debug(debugName, "session is not valid");
        if (currentSession !== null) {
          await this._removeSession();
        }
        return;
      }
      const expiresWithMargin = ((_b = currentSession.expires_at) !== null && _b !== void 0 ? _b : Infinity) * 1e3 - Date.now() < EXPIRY_MARGIN_MS;
      this._debug(debugName, `session has${expiresWithMargin ? "" : " not"} expired with margin of ${EXPIRY_MARGIN_MS}s`);
      if (expiresWithMargin) {
        if (this.autoRefreshToken && currentSession.refresh_token) {
          const { error } = await this._callRefreshToken(currentSession.refresh_token);
          if (error) {
            console.error(error);
            if (!isAuthRetryableFetchError(error)) {
              this._debug(debugName, "refresh failed with a non-retryable error, removing the session", error);
              await this._removeSession();
            }
          }
        }
      } else if (currentSession.user && currentSession.user.__isUserNotAvailableProxy === true) {
        try {
          const { data, error: userError } = await this._getUser(currentSession.access_token);
          if (!userError && (data === null || data === void 0 ? void 0 : data.user)) {
            currentSession.user = data.user;
            await this._saveSession(currentSession);
            await this._notifyAllSubscribers("SIGNED_IN", currentSession);
          } else {
            this._debug(debugName, "could not get user data, skipping SIGNED_IN notification");
          }
        } catch (getUserError) {
          console.error("Error getting user data:", getUserError);
          this._debug(debugName, "error getting user data, skipping SIGNED_IN notification", getUserError);
        }
      } else {
        await this._notifyAllSubscribers("SIGNED_IN", currentSession);
      }
    } catch (err) {
      this._debug(debugName, "error", err);
      console.error(err);
      return;
    } finally {
      this._debug(debugName, "end");
    }
  }
  async _callRefreshToken(refreshToken) {
    var _a, _b;
    if (!refreshToken) {
      throw new AuthSessionMissingError();
    }
    if (this.refreshingDeferred) {
      return this.refreshingDeferred.promise;
    }
    const debugName = `#_callRefreshToken(${refreshToken.substring(0, 5)}...)`;
    this._debug(debugName, "begin");
    try {
      this.refreshingDeferred = new Deferred();
      const { data, error } = await this._refreshAccessToken(refreshToken);
      if (error)
        throw error;
      if (!data.session)
        throw new AuthSessionMissingError();
      await this._saveSession(data.session);
      await this._notifyAllSubscribers("TOKEN_REFRESHED", data.session);
      const result = { data: data.session, error: null };
      this.refreshingDeferred.resolve(result);
      return result;
    } catch (error) {
      this._debug(debugName, "error", error);
      if (isAuthError(error)) {
        const result = { data: null, error };
        if (!isAuthRetryableFetchError(error)) {
          await this._removeSession();
        }
        (_a = this.refreshingDeferred) === null || _a === void 0 ? void 0 : _a.resolve(result);
        return result;
      }
      (_b = this.refreshingDeferred) === null || _b === void 0 ? void 0 : _b.reject(error);
      throw error;
    } finally {
      this.refreshingDeferred = null;
      this._debug(debugName, "end");
    }
  }
  async _notifyAllSubscribers(event, session, broadcast = true) {
    const debugName = `#_notifyAllSubscribers(${event})`;
    this._debug(debugName, "begin", session, `broadcast = ${broadcast}`);
    try {
      if (this.broadcastChannel && broadcast) {
        this.broadcastChannel.postMessage({ event, session });
      }
      const errors = [];
      const promises = Array.from(this.stateChangeEmitters.values()).map(async (x) => {
        try {
          await x.callback(event, session);
        } catch (e) {
          errors.push(e);
        }
      });
      await Promise.all(promises);
      if (errors.length > 0) {
        for (let i = 0; i < errors.length; i += 1) {
          console.error(errors[i]);
        }
        throw errors[0];
      }
    } finally {
      this._debug(debugName, "end");
    }
  }
  /**
   * set currentSession and currentUser
   * process to _startAutoRefreshToken if possible
   */
  async _saveSession(session) {
    this._debug("#_saveSession()", session);
    this.suppressGetSessionWarning = true;
    await removeItemAsync(this.storage, `${this.storageKey}-code-verifier`);
    const sessionToProcess = Object.assign({}, session);
    const userIsProxy = sessionToProcess.user && sessionToProcess.user.__isUserNotAvailableProxy === true;
    if (this.userStorage) {
      if (!userIsProxy && sessionToProcess.user) {
        await setItemAsync(this.userStorage, this.storageKey + "-user", {
          user: sessionToProcess.user
        });
      } else if (userIsProxy) {
      }
      const mainSessionData = Object.assign({}, sessionToProcess);
      delete mainSessionData.user;
      const clonedMainSessionData = deepClone(mainSessionData);
      await setItemAsync(this.storage, this.storageKey, clonedMainSessionData);
    } else {
      const clonedSession = deepClone(sessionToProcess);
      await setItemAsync(this.storage, this.storageKey, clonedSession);
    }
  }
  async _removeSession() {
    this._debug("#_removeSession()");
    this.suppressGetSessionWarning = false;
    await removeItemAsync(this.storage, this.storageKey);
    await removeItemAsync(this.storage, this.storageKey + "-code-verifier");
    await removeItemAsync(this.storage, this.storageKey + "-user");
    if (this.userStorage) {
      await removeItemAsync(this.userStorage, this.storageKey + "-user");
    }
    await this._notifyAllSubscribers("SIGNED_OUT", null);
  }
  /**
   * Removes any registered visibilitychange callback.
   *
   * {@see #startAutoRefresh}
   * {@see #stopAutoRefresh}
   */
  _removeVisibilityChangedCallback() {
    this._debug("#_removeVisibilityChangedCallback()");
    const callback = this.visibilityChangedCallback;
    this.visibilityChangedCallback = null;
    try {
      if (callback && isBrowser() && (window === null || window === void 0 ? void 0 : window.removeEventListener)) {
        window.removeEventListener("visibilitychange", callback);
      }
    } catch (e) {
      console.error("removing visibilitychange callback failed", e);
    }
  }
  /**
   * This is the private implementation of {@link #startAutoRefresh}. Use this
   * within the library.
   */
  async _startAutoRefresh() {
    await this._stopAutoRefresh();
    this._debug("#_startAutoRefresh()");
    const ticker = setInterval(() => this._autoRefreshTokenTick(), AUTO_REFRESH_TICK_DURATION_MS);
    this.autoRefreshTicker = ticker;
    if (ticker && typeof ticker === "object" && typeof ticker.unref === "function") {
      ticker.unref();
    } else if (typeof Deno !== "undefined" && typeof Deno.unrefTimer === "function") {
      Deno.unrefTimer(ticker);
    }
    const timeout = setTimeout(async () => {
      await this.initializePromise;
      await this._autoRefreshTokenTick();
    }, 0);
    this.autoRefreshTickTimeout = timeout;
    if (timeout && typeof timeout === "object" && typeof timeout.unref === "function") {
      timeout.unref();
    } else if (typeof Deno !== "undefined" && typeof Deno.unrefTimer === "function") {
      Deno.unrefTimer(timeout);
    }
  }
  /**
   * This is the private implementation of {@link #stopAutoRefresh}. Use this
   * within the library.
   */
  async _stopAutoRefresh() {
    this._debug("#_stopAutoRefresh()");
    const ticker = this.autoRefreshTicker;
    this.autoRefreshTicker = null;
    if (ticker) {
      clearInterval(ticker);
    }
    const timeout = this.autoRefreshTickTimeout;
    this.autoRefreshTickTimeout = null;
    if (timeout) {
      clearTimeout(timeout);
    }
  }
  /**
   * Starts an auto-refresh process in the background. The session is checked
   * every few seconds. Close to the time of expiration a process is started to
   * refresh the session. If refreshing fails it will be retried for as long as
   * necessary.
   *
   * If you set the {@link GoTrueClientOptions#autoRefreshToken} you don't need
   * to call this function, it will be called for you.
   *
   * On browsers the refresh process works only when the tab/window is in the
   * foreground to conserve resources as well as prevent race conditions and
   * flooding auth with requests. If you call this method any managed
   * visibility change callback will be removed and you must manage visibility
   * changes on your own.
   *
   * On non-browser platforms the refresh process works *continuously* in the
   * background, which may not be desirable. You should hook into your
   * platform's foreground indication mechanism and call these methods
   * appropriately to conserve resources.
   *
   * {@see #stopAutoRefresh}
   */
  async startAutoRefresh() {
    this._removeVisibilityChangedCallback();
    await this._startAutoRefresh();
  }
  /**
   * Stops an active auto refresh process running in the background (if any).
   *
   * If you call this method any managed visibility change callback will be
   * removed and you must manage visibility changes on your own.
   *
   * See {@link #startAutoRefresh} for more details.
   */
  async stopAutoRefresh() {
    this._removeVisibilityChangedCallback();
    await this._stopAutoRefresh();
  }
  /**
   * Runs the auto refresh token tick.
   */
  async _autoRefreshTokenTick() {
    this._debug("#_autoRefreshTokenTick()", "begin");
    try {
      await this._acquireLock(0, async () => {
        try {
          const now = Date.now();
          try {
            return await this._useSession(async (result) => {
              const { data: { session } } = result;
              if (!session || !session.refresh_token || !session.expires_at) {
                this._debug("#_autoRefreshTokenTick()", "no session");
                return;
              }
              const expiresInTicks = Math.floor((session.expires_at * 1e3 - now) / AUTO_REFRESH_TICK_DURATION_MS);
              this._debug("#_autoRefreshTokenTick()", `access token expires in ${expiresInTicks} ticks, a tick lasts ${AUTO_REFRESH_TICK_DURATION_MS}ms, refresh threshold is ${AUTO_REFRESH_TICK_THRESHOLD} ticks`);
              if (expiresInTicks <= AUTO_REFRESH_TICK_THRESHOLD) {
                await this._callRefreshToken(session.refresh_token);
              }
            });
          } catch (e) {
            console.error("Auto refresh tick failed with error. This is likely a transient error.", e);
          }
        } finally {
          this._debug("#_autoRefreshTokenTick()", "end");
        }
      });
    } catch (e) {
      if (e.isAcquireTimeout || e instanceof LockAcquireTimeoutError) {
        this._debug("auto refresh token tick lock not available");
      } else {
        throw e;
      }
    }
  }
  /**
   * Registers callbacks on the browser / platform, which in-turn run
   * algorithms when the browser window/tab are in foreground. On non-browser
   * platforms it assumes always foreground.
   */
  async _handleVisibilityChange() {
    this._debug("#_handleVisibilityChange()");
    if (!isBrowser() || !(window === null || window === void 0 ? void 0 : window.addEventListener)) {
      if (this.autoRefreshToken) {
        this.startAutoRefresh();
      }
      return false;
    }
    try {
      this.visibilityChangedCallback = async () => {
        try {
          await this._onVisibilityChanged(false);
        } catch (error) {
          this._debug("#visibilityChangedCallback", "error", error);
        }
      };
      window === null || window === void 0 ? void 0 : window.addEventListener("visibilitychange", this.visibilityChangedCallback);
      await this._onVisibilityChanged(true);
    } catch (error) {
      console.error("_handleVisibilityChange", error);
    }
  }
  /**
   * Callback registered with `window.addEventListener('visibilitychange')`.
   */
  async _onVisibilityChanged(calledFromInitialize) {
    const methodName = `#_onVisibilityChanged(${calledFromInitialize})`;
    this._debug(methodName, "visibilityState", document.visibilityState);
    if (document.visibilityState === "visible") {
      if (this.autoRefreshToken) {
        this._startAutoRefresh();
      }
      if (!calledFromInitialize) {
        await this.initializePromise;
        await this._acquireLock(this.lockAcquireTimeout, async () => {
          if (document.visibilityState !== "visible") {
            this._debug(methodName, "acquired the lock to recover the session, but the browser visibilityState is no longer visible, aborting");
            return;
          }
          await this._recoverAndRefresh();
        });
      }
    } else if (document.visibilityState === "hidden") {
      if (this.autoRefreshToken) {
        this._stopAutoRefresh();
      }
    }
  }
  /**
   * Generates the relevant login URL for a third-party provider.
   * @param options.redirectTo A URL or mobile address to send the user to after they are confirmed.
   * @param options.scopes A space-separated list of scopes granted to the OAuth application.
   * @param options.queryParams An object of key-value pairs containing query parameters granted to the OAuth application.
   */
  async _getUrlForProvider(url, provider, options) {
    const urlParams = [`provider=${encodeURIComponent(provider)}`];
    if (options === null || options === void 0 ? void 0 : options.redirectTo) {
      urlParams.push(`redirect_to=${encodeURIComponent(options.redirectTo)}`);
    }
    if (options === null || options === void 0 ? void 0 : options.scopes) {
      urlParams.push(`scopes=${encodeURIComponent(options.scopes)}`);
    }
    if (this.flowType === "pkce") {
      const [codeChallenge, codeChallengeMethod] = await getCodeChallengeAndMethod(this.storage, this.storageKey);
      const flowParams = new URLSearchParams({
        code_challenge: `${encodeURIComponent(codeChallenge)}`,
        code_challenge_method: `${encodeURIComponent(codeChallengeMethod)}`
      });
      urlParams.push(flowParams.toString());
    }
    if (options === null || options === void 0 ? void 0 : options.queryParams) {
      const query = new URLSearchParams(options.queryParams);
      urlParams.push(query.toString());
    }
    if (options === null || options === void 0 ? void 0 : options.skipBrowserRedirect) {
      urlParams.push(`skip_http_redirect=${options.skipBrowserRedirect}`);
    }
    return `${url}?${urlParams.join("&")}`;
  }
  async _unenroll(params) {
    try {
      return await this._useSession(async (result) => {
        var _a;
        const { data: sessionData, error: sessionError } = result;
        if (sessionError) {
          return this._returnResult({ data: null, error: sessionError });
        }
        return await _request(this.fetch, "DELETE", `${this.url}/factors/${params.factorId}`, {
          headers: this.headers,
          jwt: (_a = sessionData === null || sessionData === void 0 ? void 0 : sessionData.session) === null || _a === void 0 ? void 0 : _a.access_token
        });
      });
    } catch (error) {
      if (isAuthError(error)) {
        return this._returnResult({ data: null, error });
      }
      throw error;
    }
  }
  async _enroll(params) {
    try {
      return await this._useSession(async (result) => {
        var _a, _b;
        const { data: sessionData, error: sessionError } = result;
        if (sessionError) {
          return this._returnResult({ data: null, error: sessionError });
        }
        const body = Object.assign({ friendly_name: params.friendlyName, factor_type: params.factorType }, params.factorType === "phone" ? { phone: params.phone } : params.factorType === "totp" ? { issuer: params.issuer } : {});
        const { data, error } = await _request(this.fetch, "POST", `${this.url}/factors`, {
          body,
          headers: this.headers,
          jwt: (_a = sessionData === null || sessionData === void 0 ? void 0 : sessionData.session) === null || _a === void 0 ? void 0 : _a.access_token
        });
        if (error) {
          return this._returnResult({ data: null, error });
        }
        if (params.factorType === "totp" && data.type === "totp" && ((_b = data === null || data === void 0 ? void 0 : data.totp) === null || _b === void 0 ? void 0 : _b.qr_code)) {
          data.totp.qr_code = `data:image/svg+xml;utf-8,${data.totp.qr_code}`;
        }
        return this._returnResult({ data, error: null });
      });
    } catch (error) {
      if (isAuthError(error)) {
        return this._returnResult({ data: null, error });
      }
      throw error;
    }
  }
  async _verify(params) {
    return this._acquireLock(this.lockAcquireTimeout, async () => {
      try {
        return await this._useSession(async (result) => {
          var _a;
          const { data: sessionData, error: sessionError } = result;
          if (sessionError) {
            return this._returnResult({ data: null, error: sessionError });
          }
          const body = Object.assign({ challenge_id: params.challengeId }, "webauthn" in params ? {
            webauthn: Object.assign(Object.assign({}, params.webauthn), { credential_response: params.webauthn.type === "create" ? serializeCredentialCreationResponse(params.webauthn.credential_response) : serializeCredentialRequestResponse(params.webauthn.credential_response) })
          } : { code: params.code });
          const { data, error } = await _request(this.fetch, "POST", `${this.url}/factors/${params.factorId}/verify`, {
            body,
            headers: this.headers,
            jwt: (_a = sessionData === null || sessionData === void 0 ? void 0 : sessionData.session) === null || _a === void 0 ? void 0 : _a.access_token
          });
          if (error) {
            return this._returnResult({ data: null, error });
          }
          await this._saveSession(Object.assign({ expires_at: Math.round(Date.now() / 1e3) + data.expires_in }, data));
          await this._notifyAllSubscribers("MFA_CHALLENGE_VERIFIED", data);
          return this._returnResult({ data, error });
        });
      } catch (error) {
        if (isAuthError(error)) {
          return this._returnResult({ data: null, error });
        }
        throw error;
      }
    });
  }
  async _challenge(params) {
    return this._acquireLock(this.lockAcquireTimeout, async () => {
      try {
        return await this._useSession(async (result) => {
          var _a;
          const { data: sessionData, error: sessionError } = result;
          if (sessionError) {
            return this._returnResult({ data: null, error: sessionError });
          }
          const response = await _request(this.fetch, "POST", `${this.url}/factors/${params.factorId}/challenge`, {
            body: params,
            headers: this.headers,
            jwt: (_a = sessionData === null || sessionData === void 0 ? void 0 : sessionData.session) === null || _a === void 0 ? void 0 : _a.access_token
          });
          if (response.error) {
            return response;
          }
          const { data } = response;
          if (data.type !== "webauthn") {
            return { data, error: null };
          }
          switch (data.webauthn.type) {
            case "create":
              return {
                data: Object.assign(Object.assign({}, data), { webauthn: Object.assign(Object.assign({}, data.webauthn), { credential_options: Object.assign(Object.assign({}, data.webauthn.credential_options), { publicKey: deserializeCredentialCreationOptions(data.webauthn.credential_options.publicKey) }) }) }),
                error: null
              };
            case "request":
              return {
                data: Object.assign(Object.assign({}, data), { webauthn: Object.assign(Object.assign({}, data.webauthn), { credential_options: Object.assign(Object.assign({}, data.webauthn.credential_options), { publicKey: deserializeCredentialRequestOptions(data.webauthn.credential_options.publicKey) }) }) }),
                error: null
              };
          }
        });
      } catch (error) {
        if (isAuthError(error)) {
          return this._returnResult({ data: null, error });
        }
        throw error;
      }
    });
  }
  /**
   * {@see GoTrueMFAApi#challengeAndVerify}
   */
  async _challengeAndVerify(params) {
    const { data: challengeData, error: challengeError } = await this._challenge({
      factorId: params.factorId
    });
    if (challengeError) {
      return this._returnResult({ data: null, error: challengeError });
    }
    return await this._verify({
      factorId: params.factorId,
      challengeId: challengeData.id,
      code: params.code
    });
  }
  /**
   * {@see GoTrueMFAApi#listFactors}
   */
  async _listFactors() {
    var _a;
    const { data: { user }, error: userError } = await this.getUser();
    if (userError) {
      return { data: null, error: userError };
    }
    const data = {
      all: [],
      phone: [],
      totp: [],
      webauthn: []
    };
    for (const factor of (_a = user === null || user === void 0 ? void 0 : user.factors) !== null && _a !== void 0 ? _a : []) {
      data.all.push(factor);
      if (factor.status === "verified") {
        ;
        data[factor.factor_type].push(factor);
      }
    }
    return {
      data,
      error: null
    };
  }
  /**
   * {@see GoTrueMFAApi#getAuthenticatorAssuranceLevel}
   */
  async _getAuthenticatorAssuranceLevel(jwt) {
    var _a, _b, _c, _d;
    if (jwt) {
      try {
        const { payload: payload2 } = decodeJWT(jwt);
        let currentLevel2 = null;
        if (payload2.aal) {
          currentLevel2 = payload2.aal;
        }
        let nextLevel2 = currentLevel2;
        const { data: { user }, error: userError } = await this.getUser(jwt);
        if (userError) {
          return this._returnResult({ data: null, error: userError });
        }
        const verifiedFactors2 = (_b = (_a = user === null || user === void 0 ? void 0 : user.factors) === null || _a === void 0 ? void 0 : _a.filter((factor) => factor.status === "verified")) !== null && _b !== void 0 ? _b : [];
        if (verifiedFactors2.length > 0) {
          nextLevel2 = "aal2";
        }
        const currentAuthenticationMethods2 = payload2.amr || [];
        return { data: { currentLevel: currentLevel2, nextLevel: nextLevel2, currentAuthenticationMethods: currentAuthenticationMethods2 }, error: null };
      } catch (error) {
        if (isAuthError(error)) {
          return this._returnResult({ data: null, error });
        }
        throw error;
      }
    }
    const { data: { session }, error: sessionError } = await this.getSession();
    if (sessionError) {
      return this._returnResult({ data: null, error: sessionError });
    }
    if (!session) {
      return {
        data: { currentLevel: null, nextLevel: null, currentAuthenticationMethods: [] },
        error: null
      };
    }
    const { payload } = decodeJWT(session.access_token);
    let currentLevel = null;
    if (payload.aal) {
      currentLevel = payload.aal;
    }
    let nextLevel = currentLevel;
    const verifiedFactors = (_d = (_c = session.user.factors) === null || _c === void 0 ? void 0 : _c.filter((factor) => factor.status === "verified")) !== null && _d !== void 0 ? _d : [];
    if (verifiedFactors.length > 0) {
      nextLevel = "aal2";
    }
    const currentAuthenticationMethods = payload.amr || [];
    return { data: { currentLevel, nextLevel, currentAuthenticationMethods }, error: null };
  }
  /**
   * Retrieves details about an OAuth authorization request.
   * Only relevant when the OAuth 2.1 server is enabled in Supabase Auth.
   *
   * Returns authorization details including client info, scopes, and user information.
   * If the response includes only a redirect_url field, it means consent was already given - the caller
   * should handle the redirect manually if needed.
   */
  async _getAuthorizationDetails(authorizationId) {
    try {
      return await this._useSession(async (result) => {
        const { data: { session }, error: sessionError } = result;
        if (sessionError) {
          return this._returnResult({ data: null, error: sessionError });
        }
        if (!session) {
          return this._returnResult({ data: null, error: new AuthSessionMissingError() });
        }
        return await _request(this.fetch, "GET", `${this.url}/oauth/authorizations/${authorizationId}`, {
          headers: this.headers,
          jwt: session.access_token,
          xform: (data) => ({ data, error: null })
        });
      });
    } catch (error) {
      if (isAuthError(error)) {
        return this._returnResult({ data: null, error });
      }
      throw error;
    }
  }
  /**
   * Approves an OAuth authorization request.
   * Only relevant when the OAuth 2.1 server is enabled in Supabase Auth.
   */
  async _approveAuthorization(authorizationId, options) {
    try {
      return await this._useSession(async (result) => {
        const { data: { session }, error: sessionError } = result;
        if (sessionError) {
          return this._returnResult({ data: null, error: sessionError });
        }
        if (!session) {
          return this._returnResult({ data: null, error: new AuthSessionMissingError() });
        }
        const response = await _request(this.fetch, "POST", `${this.url}/oauth/authorizations/${authorizationId}/consent`, {
          headers: this.headers,
          jwt: session.access_token,
          body: { action: "approve" },
          xform: (data) => ({ data, error: null })
        });
        if (response.data && response.data.redirect_url) {
          if (isBrowser() && !(options === null || options === void 0 ? void 0 : options.skipBrowserRedirect)) {
            window.location.assign(response.data.redirect_url);
          }
        }
        return response;
      });
    } catch (error) {
      if (isAuthError(error)) {
        return this._returnResult({ data: null, error });
      }
      throw error;
    }
  }
  /**
   * Denies an OAuth authorization request.
   * Only relevant when the OAuth 2.1 server is enabled in Supabase Auth.
   */
  async _denyAuthorization(authorizationId, options) {
    try {
      return await this._useSession(async (result) => {
        const { data: { session }, error: sessionError } = result;
        if (sessionError) {
          return this._returnResult({ data: null, error: sessionError });
        }
        if (!session) {
          return this._returnResult({ data: null, error: new AuthSessionMissingError() });
        }
        const response = await _request(this.fetch, "POST", `${this.url}/oauth/authorizations/${authorizationId}/consent`, {
          headers: this.headers,
          jwt: session.access_token,
          body: { action: "deny" },
          xform: (data) => ({ data, error: null })
        });
        if (response.data && response.data.redirect_url) {
          if (isBrowser() && !(options === null || options === void 0 ? void 0 : options.skipBrowserRedirect)) {
            window.location.assign(response.data.redirect_url);
          }
        }
        return response;
      });
    } catch (error) {
      if (isAuthError(error)) {
        return this._returnResult({ data: null, error });
      }
      throw error;
    }
  }
  /**
   * Lists all OAuth grants that the authenticated user has authorized.
   * Only relevant when the OAuth 2.1 server is enabled in Supabase Auth.
   */
  async _listOAuthGrants() {
    try {
      return await this._useSession(async (result) => {
        const { data: { session }, error: sessionError } = result;
        if (sessionError) {
          return this._returnResult({ data: null, error: sessionError });
        }
        if (!session) {
          return this._returnResult({ data: null, error: new AuthSessionMissingError() });
        }
        return await _request(this.fetch, "GET", `${this.url}/user/oauth/grants`, {
          headers: this.headers,
          jwt: session.access_token,
          xform: (data) => ({ data, error: null })
        });
      });
    } catch (error) {
      if (isAuthError(error)) {
        return this._returnResult({ data: null, error });
      }
      throw error;
    }
  }
  /**
   * Revokes a user's OAuth grant for a specific client.
   * Only relevant when the OAuth 2.1 server is enabled in Supabase Auth.
   */
  async _revokeOAuthGrant(options) {
    try {
      return await this._useSession(async (result) => {
        const { data: { session }, error: sessionError } = result;
        if (sessionError) {
          return this._returnResult({ data: null, error: sessionError });
        }
        if (!session) {
          return this._returnResult({ data: null, error: new AuthSessionMissingError() });
        }
        await _request(this.fetch, "DELETE", `${this.url}/user/oauth/grants`, {
          headers: this.headers,
          jwt: session.access_token,
          query: { client_id: options.clientId },
          noResolveJson: true
        });
        return { data: {}, error: null };
      });
    } catch (error) {
      if (isAuthError(error)) {
        return this._returnResult({ data: null, error });
      }
      throw error;
    }
  }
  async fetchJwk(kid, jwks = { keys: [] }) {
    let jwk = jwks.keys.find((key) => key.kid === kid);
    if (jwk) {
      return jwk;
    }
    const now = Date.now();
    jwk = this.jwks.keys.find((key) => key.kid === kid);
    if (jwk && this.jwks_cached_at + JWKS_TTL > now) {
      return jwk;
    }
    const { data, error } = await _request(this.fetch, "GET", `${this.url}/.well-known/jwks.json`, {
      headers: this.headers
    });
    if (error) {
      throw error;
    }
    if (!data.keys || data.keys.length === 0) {
      return null;
    }
    this.jwks = data;
    this.jwks_cached_at = now;
    jwk = data.keys.find((key) => key.kid === kid);
    if (!jwk) {
      return null;
    }
    return jwk;
  }
  /**
   * Extracts the JWT claims present in the access token by first verifying the
   * JWT against the server's JSON Web Key Set endpoint
   * `/.well-known/jwks.json` which is often cached, resulting in significantly
   * faster responses. Prefer this method over {@link #getUser} which always
   * sends a request to the Auth server for each JWT.
   *
   * If the project is not using an asymmetric JWT signing key (like ECC or
   * RSA) it always sends a request to the Auth server (similar to {@link
   * #getUser}) to verify the JWT.
   *
   * @param jwt An optional specific JWT you wish to verify, not the one you
   *            can obtain from {@link #getSession}.
   * @param options Various additional options that allow you to customize the
   *                behavior of this method.
   */
  async getClaims(jwt, options = {}) {
    try {
      let token = jwt;
      if (!token) {
        const { data, error } = await this.getSession();
        if (error || !data.session) {
          return this._returnResult({ data: null, error });
        }
        token = data.session.access_token;
      }
      const { header, payload, signature, raw: { header: rawHeader, payload: rawPayload } } = decodeJWT(token);
      if (!(options === null || options === void 0 ? void 0 : options.allowExpired)) {
        validateExp(payload.exp);
      }
      const signingKey = !header.alg || header.alg.startsWith("HS") || !header.kid || !("crypto" in globalThis && "subtle" in globalThis.crypto) ? null : await this.fetchJwk(header.kid, (options === null || options === void 0 ? void 0 : options.keys) ? { keys: options.keys } : options === null || options === void 0 ? void 0 : options.jwks);
      if (!signingKey) {
        const { error } = await this.getUser(token);
        if (error) {
          throw error;
        }
        return {
          data: {
            claims: payload,
            header,
            signature
          },
          error: null
        };
      }
      const algorithm = getAlgorithm(header.alg);
      const publicKey = await crypto.subtle.importKey("jwk", signingKey, algorithm, true, [
        "verify"
      ]);
      const isValid = await crypto.subtle.verify(algorithm, publicKey, signature, stringToUint8Array(`${rawHeader}.${rawPayload}`));
      if (!isValid) {
        throw new AuthInvalidJwtError("Invalid JWT signature");
      }
      return {
        data: {
          claims: payload,
          header,
          signature
        },
        error: null
      };
    } catch (error) {
      if (isAuthError(error)) {
        return this._returnResult({ data: null, error });
      }
      throw error;
    }
  }
};
GoTrueClient.nextInstanceID = {};
var GoTrueClient_default = GoTrueClient;

// node_modules/@supabase/auth-js/dist/module/AuthClient.js
var AuthClient = GoTrueClient_default;
var AuthClient_default = AuthClient;

// node_modules/@supabase/supabase-js/dist/index.mjs
var version4 = "2.95.3";
var JS_ENV = "";
if (typeof Deno !== "undefined") JS_ENV = "deno";
else if (typeof document !== "undefined") JS_ENV = "web";
else if (typeof navigator !== "undefined" && navigator.product === "ReactNative") JS_ENV = "react-native";
else JS_ENV = "node";
var DEFAULT_HEADERS3 = { "X-Client-Info": `supabase-js-${JS_ENV}/${version4}` };
var DEFAULT_GLOBAL_OPTIONS = { headers: DEFAULT_HEADERS3 };
var DEFAULT_DB_OPTIONS = { schema: "public" };
var DEFAULT_AUTH_OPTIONS = {
  autoRefreshToken: true,
  persistSession: true,
  detectSessionInUrl: true,
  flowType: "implicit"
};
var DEFAULT_REALTIME_OPTIONS = {};
function _typeof3(o) {
  "@babel/helpers - typeof";
  return _typeof3 = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function(o$1) {
    return typeof o$1;
  } : function(o$1) {
    return o$1 && "function" == typeof Symbol && o$1.constructor === Symbol && o$1 !== Symbol.prototype ? "symbol" : typeof o$1;
  }, _typeof3(o);
}
function toPrimitive3(t2, r) {
  if ("object" != _typeof3(t2) || !t2) return t2;
  var e = t2[Symbol.toPrimitive];
  if (void 0 !== e) {
    var i = e.call(t2, r || "default");
    if ("object" != _typeof3(i)) return i;
    throw new TypeError("@@toPrimitive must return a primitive value.");
  }
  return ("string" === r ? String : Number)(t2);
}
function toPropertyKey3(t2) {
  var i = toPrimitive3(t2, "string");
  return "symbol" == _typeof3(i) ? i : i + "";
}
function _defineProperty3(e, r, t2) {
  return (r = toPropertyKey3(r)) in e ? Object.defineProperty(e, r, {
    value: t2,
    enumerable: true,
    configurable: true,
    writable: true
  }) : e[r] = t2, e;
}
function ownKeys3(e, r) {
  var t2 = Object.keys(e);
  if (Object.getOwnPropertySymbols) {
    var o = Object.getOwnPropertySymbols(e);
    r && (o = o.filter(function(r$1) {
      return Object.getOwnPropertyDescriptor(e, r$1).enumerable;
    })), t2.push.apply(t2, o);
  }
  return t2;
}
function _objectSpread23(e) {
  for (var r = 1; r < arguments.length; r++) {
    var t2 = null != arguments[r] ? arguments[r] : {};
    r % 2 ? ownKeys3(Object(t2), true).forEach(function(r$1) {
      _defineProperty3(e, r$1, t2[r$1]);
    }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(t2)) : ownKeys3(Object(t2)).forEach(function(r$1) {
      Object.defineProperty(e, r$1, Object.getOwnPropertyDescriptor(t2, r$1));
    });
  }
  return e;
}
var resolveFetch4 = (customFetch) => {
  if (customFetch) return (...args) => customFetch(...args);
  return (...args) => fetch(...args);
};
var resolveHeadersConstructor = () => {
  return Headers;
};
var fetchWithAuth = (supabaseKey, getAccessToken, customFetch) => {
  const fetch$1 = resolveFetch4(customFetch);
  const HeadersConstructor = resolveHeadersConstructor();
  return async (input, init) => {
    var _await$getAccessToken;
    const accessToken = (_await$getAccessToken = await getAccessToken()) !== null && _await$getAccessToken !== void 0 ? _await$getAccessToken : supabaseKey;
    let headers = new HeadersConstructor(init === null || init === void 0 ? void 0 : init.headers);
    if (!headers.has("apikey")) headers.set("apikey", supabaseKey);
    if (!headers.has("Authorization")) headers.set("Authorization", `Bearer ${accessToken}`);
    return fetch$1(input, _objectSpread23(_objectSpread23({}, init), {}, { headers }));
  };
};
function ensureTrailingSlash(url) {
  return url.endsWith("/") ? url : url + "/";
}
function applySettingDefaults(options, defaults) {
  var _DEFAULT_GLOBAL_OPTIO, _globalOptions$header;
  const { db: dbOptions, auth: authOptions, realtime: realtimeOptions, global: globalOptions } = options;
  const { db: DEFAULT_DB_OPTIONS$1, auth: DEFAULT_AUTH_OPTIONS$1, realtime: DEFAULT_REALTIME_OPTIONS$1, global: DEFAULT_GLOBAL_OPTIONS$1 } = defaults;
  const result = {
    db: _objectSpread23(_objectSpread23({}, DEFAULT_DB_OPTIONS$1), dbOptions),
    auth: _objectSpread23(_objectSpread23({}, DEFAULT_AUTH_OPTIONS$1), authOptions),
    realtime: _objectSpread23(_objectSpread23({}, DEFAULT_REALTIME_OPTIONS$1), realtimeOptions),
    storage: {},
    global: _objectSpread23(_objectSpread23(_objectSpread23({}, DEFAULT_GLOBAL_OPTIONS$1), globalOptions), {}, { headers: _objectSpread23(_objectSpread23({}, (_DEFAULT_GLOBAL_OPTIO = DEFAULT_GLOBAL_OPTIONS$1 === null || DEFAULT_GLOBAL_OPTIONS$1 === void 0 ? void 0 : DEFAULT_GLOBAL_OPTIONS$1.headers) !== null && _DEFAULT_GLOBAL_OPTIO !== void 0 ? _DEFAULT_GLOBAL_OPTIO : {}), (_globalOptions$header = globalOptions === null || globalOptions === void 0 ? void 0 : globalOptions.headers) !== null && _globalOptions$header !== void 0 ? _globalOptions$header : {}) }),
    accessToken: async () => ""
  };
  if (options.accessToken) result.accessToken = options.accessToken;
  else delete result.accessToken;
  return result;
}
function validateSupabaseUrl(supabaseUrl) {
  const trimmedUrl = supabaseUrl === null || supabaseUrl === void 0 ? void 0 : supabaseUrl.trim();
  if (!trimmedUrl) throw new Error("supabaseUrl is required.");
  if (!trimmedUrl.match(/^https?:\/\//i)) throw new Error("Invalid supabaseUrl: Must be a valid HTTP or HTTPS URL.");
  try {
    return new URL(ensureTrailingSlash(trimmedUrl));
  } catch (_unused) {
    throw Error("Invalid supabaseUrl: Provided URL is malformed.");
  }
}
var SupabaseAuthClient = class extends AuthClient_default {
  constructor(options) {
    super(options);
  }
};
var SupabaseClient = class {
  /**
  * Create a new client for use in the browser.
  * @param supabaseUrl The unique Supabase URL which is supplied when you create a new project in your project dashboard.
  * @param supabaseKey The unique Supabase Key which is supplied when you create a new project in your project dashboard.
  * @param options.db.schema You can switch in between schemas. The schema needs to be on the list of exposed schemas inside Supabase.
  * @param options.auth.autoRefreshToken Set to "true" if you want to automatically refresh the token before expiring.
  * @param options.auth.persistSession Set to "true" if you want to automatically save the user session into local storage.
  * @param options.auth.detectSessionInUrl Set to "true" if you want to automatically detects OAuth grants in the URL and signs in the user.
  * @param options.realtime Options passed along to realtime-js constructor.
  * @param options.storage Options passed along to the storage-js constructor.
  * @param options.global.fetch A custom fetch implementation.
  * @param options.global.headers Any additional headers to send with each network request.
  * @example
  * ```ts
  * import { createClient } from '@supabase/supabase-js'
  *
  * const supabase = createClient('https://xyzcompany.supabase.co', 'public-anon-key')
  * const { data } = await supabase.from('profiles').select('*')
  * ```
  */
  constructor(supabaseUrl, supabaseKey, options) {
    var _settings$auth$storag, _settings$global$head;
    this.supabaseUrl = supabaseUrl;
    this.supabaseKey = supabaseKey;
    const baseUrl = validateSupabaseUrl(supabaseUrl);
    if (!supabaseKey) throw new Error("supabaseKey is required.");
    this.realtimeUrl = new URL("realtime/v1", baseUrl);
    this.realtimeUrl.protocol = this.realtimeUrl.protocol.replace("http", "ws");
    this.authUrl = new URL("auth/v1", baseUrl);
    this.storageUrl = new URL("storage/v1", baseUrl);
    this.functionsUrl = new URL("functions/v1", baseUrl);
    const defaultStorageKey = `sb-${baseUrl.hostname.split(".")[0]}-auth-token`;
    const DEFAULTS = {
      db: DEFAULT_DB_OPTIONS,
      realtime: DEFAULT_REALTIME_OPTIONS,
      auth: _objectSpread23(_objectSpread23({}, DEFAULT_AUTH_OPTIONS), {}, { storageKey: defaultStorageKey }),
      global: DEFAULT_GLOBAL_OPTIONS
    };
    const settings = applySettingDefaults(options !== null && options !== void 0 ? options : {}, DEFAULTS);
    this.storageKey = (_settings$auth$storag = settings.auth.storageKey) !== null && _settings$auth$storag !== void 0 ? _settings$auth$storag : "";
    this.headers = (_settings$global$head = settings.global.headers) !== null && _settings$global$head !== void 0 ? _settings$global$head : {};
    if (!settings.accessToken) {
      var _settings$auth;
      this.auth = this._initSupabaseAuthClient((_settings$auth = settings.auth) !== null && _settings$auth !== void 0 ? _settings$auth : {}, this.headers, settings.global.fetch);
    } else {
      this.accessToken = settings.accessToken;
      this.auth = new Proxy({}, { get: (_, prop) => {
        throw new Error(`@supabase/supabase-js: Supabase Client is configured with the accessToken option, accessing supabase.auth.${String(prop)} is not possible`);
      } });
    }
    this.fetch = fetchWithAuth(supabaseKey, this._getAccessToken.bind(this), settings.global.fetch);
    this.realtime = this._initRealtimeClient(_objectSpread23({
      headers: this.headers,
      accessToken: this._getAccessToken.bind(this)
    }, settings.realtime));
    if (this.accessToken) Promise.resolve(this.accessToken()).then((token) => this.realtime.setAuth(token)).catch((e) => console.warn("Failed to set initial Realtime auth token:", e));
    this.rest = new PostgrestClient(new URL("rest/v1", baseUrl).href, {
      headers: this.headers,
      schema: settings.db.schema,
      fetch: this.fetch,
      timeout: settings.db.timeout,
      urlLengthLimit: settings.db.urlLengthLimit
    });
    this.storage = new StorageClient(this.storageUrl.href, this.headers, this.fetch, options === null || options === void 0 ? void 0 : options.storage);
    if (!settings.accessToken) this._listenForAuthEvents();
  }
  /**
  * Supabase Functions allows you to deploy and invoke edge functions.
  */
  get functions() {
    return new FunctionsClient(this.functionsUrl.href, {
      headers: this.headers,
      customFetch: this.fetch
    });
  }
  /**
  * Perform a query on a table or a view.
  *
  * @param relation - The table or view name to query
  */
  from(relation) {
    return this.rest.from(relation);
  }
  /**
  * Select a schema to query or perform an function (rpc) call.
  *
  * The schema needs to be on the list of exposed schemas inside Supabase.
  *
  * @param schema - The schema to query
  */
  schema(schema) {
    return this.rest.schema(schema);
  }
  /**
  * Perform a function call.
  *
  * @param fn - The function name to call
  * @param args - The arguments to pass to the function call
  * @param options - Named parameters
  * @param options.head - When set to `true`, `data` will not be returned.
  * Useful if you only need the count.
  * @param options.get - When set to `true`, the function will be called with
  * read-only access mode.
  * @param options.count - Count algorithm to use to count rows returned by the
  * function. Only applicable for [set-returning
  * functions](https://www.postgresql.org/docs/current/functions-srf.html).
  *
  * `"exact"`: Exact but slow count algorithm. Performs a `COUNT(*)` under the
  * hood.
  *
  * `"planned"`: Approximated but fast count algorithm. Uses the Postgres
  * statistics under the hood.
  *
  * `"estimated"`: Uses exact count for low numbers and planned count for high
  * numbers.
  */
  rpc(fn, args = {}, options = {
    head: false,
    get: false,
    count: void 0
  }) {
    return this.rest.rpc(fn, args, options);
  }
  /**
  * Creates a Realtime channel with Broadcast, Presence, and Postgres Changes.
  *
  * @param {string} name - The name of the Realtime channel.
  * @param {Object} opts - The options to pass to the Realtime channel.
  *
  */
  channel(name, opts = { config: {} }) {
    return this.realtime.channel(name, opts);
  }
  /**
  * Returns all Realtime channels.
  */
  getChannels() {
    return this.realtime.getChannels();
  }
  /**
  * Unsubscribes and removes Realtime channel from Realtime client.
  *
  * @param {RealtimeChannel} channel - The name of the Realtime channel.
  *
  */
  removeChannel(channel) {
    return this.realtime.removeChannel(channel);
  }
  /**
  * Unsubscribes and removes all Realtime channels from Realtime client.
  */
  removeAllChannels() {
    return this.realtime.removeAllChannels();
  }
  async _getAccessToken() {
    var _this = this;
    var _data$session$access_, _data$session;
    if (_this.accessToken) return await _this.accessToken();
    const { data } = await _this.auth.getSession();
    return (_data$session$access_ = (_data$session = data.session) === null || _data$session === void 0 ? void 0 : _data$session.access_token) !== null && _data$session$access_ !== void 0 ? _data$session$access_ : _this.supabaseKey;
  }
  _initSupabaseAuthClient({ autoRefreshToken, persistSession, detectSessionInUrl, storage, userStorage, storageKey, flowType, lock, debug, throwOnError }, headers, fetch$1) {
    const authHeaders = {
      Authorization: `Bearer ${this.supabaseKey}`,
      apikey: `${this.supabaseKey}`
    };
    return new SupabaseAuthClient({
      url: this.authUrl.href,
      headers: _objectSpread23(_objectSpread23({}, authHeaders), headers),
      storageKey,
      autoRefreshToken,
      persistSession,
      detectSessionInUrl,
      storage,
      userStorage,
      flowType,
      lock,
      debug,
      throwOnError,
      fetch: fetch$1,
      hasCustomAuthorizationHeader: Object.keys(this.headers).some((key) => key.toLowerCase() === "authorization")
    });
  }
  _initRealtimeClient(options) {
    return new RealtimeClient(this.realtimeUrl.href, _objectSpread23(_objectSpread23({}, options), {}, { params: _objectSpread23(_objectSpread23({}, { apikey: this.supabaseKey }), options === null || options === void 0 ? void 0 : options.params) }));
  }
  _listenForAuthEvents() {
    return this.auth.onAuthStateChange((event, session) => {
      this._handleTokenChanged(event, "CLIENT", session === null || session === void 0 ? void 0 : session.access_token);
    });
  }
  _handleTokenChanged(event, source, token) {
    if ((event === "TOKEN_REFRESHED" || event === "SIGNED_IN") && this.changedAccessToken !== token) {
      this.changedAccessToken = token;
      this.realtime.setAuth(token);
    } else if (event === "SIGNED_OUT") {
      this.realtime.setAuth();
      if (source == "STORAGE") this.auth.signOut();
      this.changedAccessToken = void 0;
    }
  }
};
var createClient = (supabaseUrl, supabaseKey, options) => {
  return new SupabaseClient(supabaseUrl, supabaseKey, options);
};
function shouldShowDeprecationWarning() {
  if (typeof window !== "undefined") return false;
  const _process = globalThis["process"];
  if (!_process) return false;
  const processVersion = _process["version"];
  if (processVersion === void 0 || processVersion === null) return false;
  const versionMatch = processVersion.match(/^v(\d+)\./);
  if (!versionMatch) return false;
  return parseInt(versionMatch[1], 10) <= 18;
}
if (shouldShowDeprecationWarning()) console.warn("\u26A0\uFE0F  Node.js 18 and below are deprecated and will no longer be supported in future versions of @supabase/supabase-js. Please upgrade to Node.js 20 or later. For more information, visit: https://github.com/orgs/supabase/discussions/37217");

// src/lib/supabase.ts
var SUPABASE_URL2 = "https://cjnzidctntqzamhwmwkt.supabase.co";
var SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNqbnppZGN0bnRxemFtaHdtd2t0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5MzIzNzQsImV4cCI6MjA4NjUwODM3NH0.NyUvGRPY1psOwpJytWG_d3IXwCwPxLtuSG6V1uX13mc";
var supabase = createClient(SUPABASE_URL2, SUPABASE_ANON_KEY);

// src/services/marketingService.ts
var STORAGE_LAST_AD_AT = "sg_last_ad_shown_at";
var STORAGE_USER_TAGS = "sg_user_interest_tags";
async function fetchActiveCampaigns() {
  try {
    const { data, error } = await supabase.from("marketing_campaigns").select("id, title, body, cta_text, link, required_tags, priority, is_active, icon").eq("is_active", true).order("priority", { ascending: false });
    if (error) return [];
    const rows = data ?? [];
    return rows.map((r) => ({
      ...r,
      required_tags: Array.isArray(r.required_tags) ? r.required_tags : r.required_tags ? [r.required_tags] : null
    }));
  } catch {
    return [];
  }
}
async function getUserTags() {
  return new Promise((resolve) => {
    try {
      chrome.storage.local.get(STORAGE_USER_TAGS, (r) => {
        if (chrome.runtime?.lastError) return resolve([]);
        const arr = r?.[STORAGE_USER_TAGS];
        resolve(Array.isArray(arr) ? arr.map(String) : []);
      });
    } catch {
      resolve([]);
    }
  });
}
function campaignMatches(campaign, userTags) {
  const required = campaign.required_tags;
  if (!required || required.length === 0) return true;
  const set = new Set(userTags.map((t2) => t2.toUpperCase()));
  return required.every((t2) => set.has(String(t2).toUpperCase()));
}
async function getEligibleCampaign() {
  const [campaigns, userTags] = await Promise.all([fetchActiveCampaigns(), getUserTags()]);
  const matched = campaigns.filter((c) => campaignMatches(c, userTags));
  return matched.length > 0 ? matched[0] : null;
}
var ONE_DAY_MS = 24 * 60 * 60 * 1e3;
async function canShowAd() {
  return new Promise((resolve) => {
    try {
      chrome.storage.local.get(STORAGE_LAST_AD_AT, (r) => {
        if (chrome.runtime?.lastError) return resolve(true);
        const at = r?.[STORAGE_LAST_AD_AT];
        if (typeof at !== "number") return resolve(true);
        resolve(Date.now() - at >= ONE_DAY_MS);
      });
    } catch {
      resolve(false);
    }
  });
}
async function markAdShown() {
  try {
    await new Promise((res, rej) => {
      chrome.storage.local.set(
        { [STORAGE_LAST_AD_AT]: Date.now() },
        () => chrome.runtime?.lastError ? rej(chrome.runtime.lastError) : res()
      );
    });
  } catch {
  }
}
async function trackAdEvent(campaignId, type) {
  try {
    const installId = await getOrCreateInstallationId();
    await supabase.from("ad_metrics").insert({
      campaign_id: campaignId,
      install_id: installId,
      event_type: type,
      created_at: (/* @__PURE__ */ new Date()).toISOString()
    });
  } catch {
  }
}

// src/background.ts
console.log("\u{1F6A8} [SignGuard Background] Service Worker LOADED via " + (/* @__PURE__ */ new Date()).toISOString());
var SUGGESTED_TRUSTED_DOMAINS2 = SUGGESTED_TRUSTED_DOMAINS;
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === "PING") {
    try {
      sendResponse({ ok: true, ts: Date.now() });
    } catch {
    }
    return true;
  }
  return false;
});
chrome.runtime.onConnect.addListener((port) => {
  if (!port || port.name !== "sg_port") return;
  port.onMessage.addListener(async (msg) => {
    const requestId = msg?.requestId;
    const payload = msg ? { ...msg } : {};
    delete payload.requestId;
    try {
      const resp = await handleBgRequest(payload, port.sender);
      port.postMessage({ requestId, ...resp ?? { ok: true } });
    } catch (e) {
      port.postMessage({ requestId, ok: false, error: String(e?.message || e) });
    }
  });
});
async function handleBgRequest(msg, sender) {
  if (!msg || typeof msg !== "object" || !msg.type) return { ok: false, error: "INVALID_MESSAGE" };
  if (msg.type === "PING") return { ok: true, ts: Date.now() };
  try {
    switch (msg.type) {
      case "AD_TRACK_CLICK": {
        const campaignId = msg.payload?.campaignId;
        if (campaignId) trackAdEvent(campaignId, "CLICK").catch(() => {
        });
        return { ok: true };
      }
      case "GET_ETH_USD":
      case "SG_GET_PRICE": {
        const usdPerEth = await getEthUsdPriceCached();
        if (usdPerEth != null) return { ok: true, usdPerEth, ethUsd: usdPerEth, updatedAt: __ethUsdCache?.fetchedAt ?? Date.now() };
        return { ok: false };
      }
      case "SG_GET_NATIVE_USD": {
        const chainIdHex = msg.payload?.chainIdHex ?? "0x1";
        const result = await getNativeUsd(chainIdHex);
        if (result?.ok && result.usdPerNative != null) return { ok: true, usdPerNative: result.usdPerNative, nativeSymbol: result.nativeSymbol };
        return { ok: false };
      }
      case "SG_GET_TOKEN_USD": {
        const chainIdHex = msg.payload?.chainIdHex ?? "0x1";
        const tokenAddress = msg.payload?.tokenAddress;
        if (!tokenAddress) return { ok: false };
        const result = await getTokenUsd(chainIdHex, tokenAddress);
        if (result) return { ok: true, priceUsd: result.priceUsd, source: "dexscreener" };
        return { ok: false };
      }
      case "SG_GET_TOKEN_META": {
        const chainIdHex = msg.payload?.chainIdHex ?? "0x1";
        const tokenAddress = msg.payload?.tokenAddress;
        if (!tokenAddress) return { ok: false };
        const result = await getTokenMeta(chainIdHex, tokenAddress);
        if (result) return { ok: true, symbol: result.symbol, decimals: result.decimals, name: result.name };
        return { ok: false };
      }
      case "SG_LISTS_STATUS": {
        const lists = await getLists();
        return { ok: true, updatedAt: lists.updatedAt, counts: { trustedDomains: lists.trustedDomains.length, blockedDomains: lists.blockedDomains.length, blockedAddresses: lists.blockedAddresses.length, scamTokens: lists.scamTokens.length, userTrustedDomains: lists.userTrustedDomains.length, userBlockedDomains: lists.userBlockedDomains.length, userBlockedAddresses: lists.userBlockedAddresses.length, userScamTokens: lists.userScamTokens.length }, sources: lists.sources };
      }
      case "SG_LISTS_REFRESH_NOW": {
        try {
          const lists = await refresh(true);
          return { ok: true, updatedAt: lists.updatedAt, counts: { trustedDomains: lists.trustedDomains.length, blockedDomains: lists.blockedDomains.length, blockedAddresses: lists.blockedAddresses.length, scamTokens: lists.scamTokens.length, userTrustedDomains: lists.userTrustedDomains.length, userBlockedDomains: lists.userBlockedDomains.length, userBlockedAddresses: lists.userBlockedAddresses.length, userScamTokens: lists.userScamTokens.length }, sources: lists.sources };
        } catch (e) {
          return { ok: false, error: String(e?.message ?? e) };
        }
      }
      case "SG_LISTS_DECIDE_DOMAIN": {
        const host = msg.payload?.host;
        const lists = await getLists();
        const decision = getDomainDecision(host ?? "", lists);
        return { ok: true, decision };
      }
      case "SG_LISTS_SEARCH": {
        const lists = await getLists();
        const q = (msg.payload?.q ?? "").toString().toLowerCase().trim();
        const type = (msg.payload?.type ?? "domain").toString().toLowerCase();
        const page = Math.max(0, parseInt(msg.payload?.page, 10) || 0);
        const pageSize = Math.min(50, Math.max(10, parseInt(msg.payload?.pageSize, 10) || 20));
        let items = [];
        if (type === "domain" && q) {
          const all = [...lists.trustedDomains, ...lists.blockedDomains];
          const filtered = all.filter((d) => d.includes(q));
          items = filtered.slice(page * pageSize, (page + 1) * pageSize).map((d) => ({ value: d, kind: lists.trustedDomains.includes(d) ? "trusted" : "blocked" }));
        } else if (type === "address" && q) {
          const all = [...lists.blockedAddresses];
          const filtered = all.filter((a) => a.includes(q));
          items = filtered.slice(page * pageSize, (page + 1) * pageSize).map((a) => ({ value: a, kind: "blocked" }));
        } else if (type === "token" && q) {
          const filtered = lists.scamTokens.filter((t2) => t2.address.includes(q) || (t2.symbol || "").toLowerCase().includes(q));
          items = filtered.slice(page * pageSize, (page + 1) * pageSize).map((t2) => ({ value: t2.address, source: t2.source, kind: "scam", chainId: t2.chainId }));
        }
        return { ok: true, items, page, pageSize };
      }
      case "SG_LISTS_OVERRIDE_ADD": {
        const overrideType = msg.payload?.type;
        const payload = msg.payload?.payload ?? {};
        try {
          await upsertUserOverride(overrideType, payload);
          const lists = await getLists();
          return { ok: true, updatedAt: lists.updatedAt };
        } catch (e) {
          return { ok: false, error: String(e?.message ?? e) };
        }
      }
      case "SG_LISTS_OVERRIDE_REMOVE": {
        const overrideType = msg.payload?.type;
        const payload = msg.payload?.payload ?? {};
        try {
          await deleteUserOverride(overrideType, payload);
          const lists = await getLists();
          return { ok: true, updatedAt: lists.updatedAt };
        } catch (e) {
          return { ok: false, error: String(e?.message ?? e) };
        }
      }
      case "SG_LISTS_EXPORT": {
        const lists = await getLists();
        return { ok: true, data: lists };
      }
      case "SG_LISTS_IMPORT": {
        const data = msg.payload?.data;
        if (!data || typeof data !== "object") return { ok: false, error: "invalid_data" };
        try {
          const { importUserOverrides: importUserOverrides2 } = await Promise.resolve().then(() => (init_listManager(), listManager_exports));
          const lists = await importUserOverrides2(data);
          return { ok: true, updatedAt: lists.updatedAt };
        } catch (e) {
          return { ok: false, error: String(e?.message ?? e) };
        }
      }
      case "SG_INTEL_SUMMARY": {
        const intel = await getIntelFresh();
        return { ok: true, updatedAt: intel.updatedAt, trustedSeedCount: (intel.trustedSeed || intel.trustedDomainsSeed || []).length, blockedCount: (intel.blockedDomainsList || intel.blockedDomains || []).length, blockedAddressCount: (intel.blockedAddressesList || intel.blockedAddresses || []).length, sources: intel.sources || [] };
      }
      case "SG_INTEL_UPDATE_NOW":
      case "UPDATE_INTEL_NOW": {
        let intel;
        try {
          intel = await updateIntelNow();
        } catch {
          intel = await getIntelFresh();
        }
        return { ok: true, updatedAt: intel.updatedAt, trustedSeedCount: (intel.trustedSeed || intel.trustedDomainsSeed || []).length, blockedCount: (intel.blockedDomainsList || intel.blockedDomains || []).length, blockedAddressCount: (intel.blockedAddressesList || intel.blockedAddresses || []).length, sources: intel.sources || [] };
      }
      case "SG_LOG_HISTORY": {
        const evt = msg.payload;
        if (evt && typeof evt === "object") pushHistoryEvent(evt);
        return { ok: true };
      }
      case "SG_TELEMETRY_THREAT": {
        const p = msg.payload;
        if (p && typeof p === "object") {
          const url = typeof p.url === "string" ? p.url : "";
          const score = typeof p.riskScore === "number" ? p.riskScore : 100;
          const reasons = Array.isArray(p.reasons) ? p.reasons : [typeof p.reason === "string" ? p.reason : "HIGH_RISK"];
          const metadata = p.metadata && typeof p.metadata === "object" ? p.metadata : {};
          telemetry.trackThreat(url, score, reasons, metadata).catch(() => {
          });
        }
        return { ok: true };
      }
      case "SG_TELEMETRY_USAGE": {
        const p = msg.payload;
        if (p && typeof p === "object" && typeof p.event === "string") telemetry.trackEvent(p.event, p.props && typeof p.props === "object" ? p.props : void 0).catch(() => {
        });
        return { ok: true };
      }
      case "TELEMETRY_WALLETS_DETECTED": {
        const p = msg.payload;
        if (p && typeof p === "object" && Array.isArray(p.wallets)) telemetry.syncUserWallets(p.wallets).catch(() => {
        });
        return { ok: true };
      }
      case "SG_TELEMETRY_INTERACTION": {
        const p = msg.payload;
        if (p && typeof p === "object" && typeof p.domain === "string") telemetry.trackInteraction({ domain: p.domain, kind: p.kind ?? "click", props: p.props && typeof p.props === "object" ? p.props : void 0 }).catch(() => {
        });
        return { ok: true };
      }
      case "SG_GET_PLAN": {
        try {
          const got = await new Promise((resolve) => {
            chrome.storage.local.get(PLAN_KEY, (r) => {
              resolve(r ?? {});
            });
          });
          const plan = got[PLAN_KEY] ?? { tier: "FREE" };
          return { ok: true, plan };
        } catch {
          return { ok: false, plan: { tier: "FREE" } };
        }
      }
      case "SG_ACTIVATE_LICENSE": {
        const key = String(msg.payload?.key ?? "").trim();
        const valid = key.startsWith("CSG-") && key.length > 15;
        try {
          if (valid) {
            const plan = { tier: "PRO", keyMasked: key ? key.slice(0, 6) + "\u2026" + key.slice(-4) : void 0, activatedAt: Date.now() };
            await new Promise((resolve, reject) => {
              chrome.storage.local.set({ [PLAN_KEY]: plan }, () => chrome.runtime?.lastError ? reject(chrome.runtime.lastError) : resolve());
            });
            return { ok: true, tier: "PRO", invalid: false };
          }
          return { ok: true, tier: "FREE", invalid: true };
        } catch (e) {
          return { ok: false, error: String(e?.message ?? e) };
        }
      }
      case "SG_ADDR_INTEL_SUMMARY": {
        const { intel: addrIntel, isMissing, isStale } = await loadAddressIntelCachedFast();
        const labeledCount = Object.keys(addrIntel.labelsByAddress || {}).length;
        return { ok: true, updatedAt: addrIntel.updatedAt, labeledCount, sources: addrIntel.sources || [], isMissing, isStale };
      }
      case "SG_ADDR_INTEL_UPDATE_NOW": {
        const fresh = await refreshAddressIntel();
        await saveAddressIntel(fresh);
        const labeledCount = Object.keys(fresh.labelsByAddress || {}).length;
        return { ok: true, updatedAt: fresh.updatedAt, labeledCount, sources: fresh.sources || [] };
      }
      case "ANALYZE": {
        const settings = await getSettings();
        const req = msg.payload;
        if (isVaultLockedContract(settings, req)) return { ok: true, vaultBlocked: true, vaultMessage: t("vaultBlockedMessage") };
        const intel = await getIntelCachedFast();
        const isStale = intel.updatedAt === 0 || Date.now() - intel.updatedAt >= INTEL_TTL_MS;
        if (isStale) ensureIntelRefreshSoon("analyze_path");
        const { intel: addrIntel, isMissing: addrMissing, isStale: addrStale } = await loadAddressIntelCachedFast();
        if (addrMissing || addrStale) ensureAddressIntelRefreshSoon("analyze_path");
        const tabId = sender?.tab?.id;
        const analysis = await analyze(req, settings, intel, tabId, addrIntel);
        if (req.wallet) analysis.wallet = req.wallet;
        if (req.txCostPreview) analysis.txCostPreview = req.txCostPreview;
        await enrichWithSimulation(req, analysis, settings);
        applyPolicy(analysis, settings);
        if (!settings.riskWarnings) {
          analysis.recommend = "ALLOW";
          analysis.level = "LOW";
          analysis.score = 0;
          analysis.reasons = [t("warningsDisabledReason")];
          analysis.title = t("analyzerUnavailableTitle");
        }
        addChecksAndVerdict(analysis, { req, settings, intel });
        const host = hostFromUrl(req.url);
        const matchedBad = !!(analysis.isPhishing || analysis.recommend === "BLOCK" && (analysis.reasons || []).some((r) => String(r).toLowerCase().includes("phishing") || String(r).toLowerCase().includes("blacklist")));
        const matchedSeed = !!analysis.safeDomain;
        const signals = [];
        if (matchedSeed) signals.push("SEED_MATCH");
        if (matchedBad) signals.push("BLACKLIST_HIT");
        if ((analysis.reasons || []).some((r) => String(r).toLowerCase().includes("lookalike"))) signals.push("LOOKALIKE");
        if ((analysis.reasons || []).some((r) => String(r).toLowerCase().includes("punycode") || String(r).toLowerCase().includes("xn--"))) signals.push("PUNYCODE");
        if ((analysis.reasons || []).some((r) => String(r).toLowerCase().includes("suspicious") || String(r).toLowerCase().includes("tld"))) signals.push("SUSPICIOUS_TLD");
        Object.assign(analysis, setVerificationFields({ host, intel, usedCacheOnly: true, isStale, matchedBad, matchedSeed, signals }));
        if (settings.cloudIntelOptIn && (req?.request?.method === "eth_sendtransaction" || req?.request?.method === "wallet_sendtransaction") && analysis.tx) {
          const chainId = String(req?.meta?.chainId ?? req?.chainId ?? "0x1").replace(/^0x/, "").toLowerCase();
          const to = analysis.tx?.to;
          if (to && typeof to === "string" && to.startsWith("0x")) {
            let valueUsd;
            const valueEth = analysis.tx?.valueEth;
            if (typeof valueEth === "string" && parseFloat(valueEth) > 0) {
              const usdPerEth = await getEthUsdPriceCached();
              if (usdPerEth != null) valueUsd = parseFloat(valueEth) * usdPerEth;
            }
            telemetry.trackTx({ chainId: chainId.startsWith("0x") ? chainId : "0x" + chainId, contractAddress: to.toLowerCase(), method: analysis.intent || "unknown", valueUsd }).catch(() => {
            });
          }
        }
        if (settings.debugMode) {
          try {
            pushDebugEvent({ ts: Date.now(), kind: "ANALYZE", url: truncateStr(req?.url, 300), host: truncateStr(hostFromUrl(req?.url || ""), 120), method: truncateStr(req?.request?.method, 120), level: analysis.level, score: analysis.score, recommend: analysis.recommend, intent: analysis.intent, isPhishing: !!analysis.isPhishing, reasons: (analysis.reasons || []).slice(0, 8).map((r) => truncateStr(r, 240)), tx: analysis.tx ? { to: truncateStr(analysis.tx.to, 120), valueEth: truncateStr(analysis.tx.valueEth, 64), maxGasFeeEth: truncateStr(analysis.tx.maxGasFeeEth, 64), maxTotalEth: truncateStr(analysis.tx.maxTotalEth, 64), selector: truncateStr(analysis.tx.selector, 16) } : void 0, txExtras: analysis.txExtras ? { approvalType: analysis.txExtras.approvalType, tokenContract: truncateStr(analysis.txExtras.tokenContract, 120), spender: truncateStr(analysis.txExtras.spender, 120), operator: truncateStr(analysis.txExtras.operator, 120), unlimited: !!analysis.txExtras.unlimited } : void 0 });
          } catch {
          }
        }
        return { ok: true, analysis };
      }
      default:
        return { ok: false, error: "UNKNOWN_MESSAGE_TYPE" };
    }
  } catch (e) {
    return { ok: false, error: String(e?.message || e) };
  }
}
var INTEL_KEY = "sg_threat_intel_v2";
var INTEL_TTL_MS = 24 * 60 * 60 * 1e3;
var HISTORY_KEY = "sg_history_v1";
var HISTORY_MAX = 200;
var PLAN_KEY = "sg_plan_v1";
function pushHistoryEvent(evt) {
  try {
    chrome.storage.local.get(HISTORY_KEY, (r) => {
      const err = chrome.runtime.lastError;
      if (err) return;
      const arr = Array.isArray(r?.[HISTORY_KEY]) ? r[HISTORY_KEY] : [];
      arr.push(evt);
      const trimmed = arr.slice(-HISTORY_MAX);
      chrome.storage.local.set({ [HISTORY_KEY]: trimmed }, () => void 0);
    });
  } catch {
  }
}
function getMinimalSeedIntel() {
  return {
    updatedAt: 0,
    sources: [{ name: "local_seed", ok: true, count: 0, url: "" }],
    blockedDomains: {},
    allowedDomains: {},
    blockedAddresses: {},
    trustedSeed: [...TRUSTED_SEED],
    blockedDomainsList: [],
    blockedAddressesList: [],
    trustedTokenAddresses: []
  };
}
var ASSET_CACHE_KEY = "sg_asset_cache";
var ASSET_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1e3;
var getCodeCache = /* @__PURE__ */ new Map();
async function getToIsContract(address, tabId) {
  const addr = (address || "").toLowerCase();
  if (!addr || addr.length < 40) return void 0;
  const cacheKey = addr;
  const hit = getCodeCache.get(cacheKey);
  if (hit !== void 0) return hit;
  try {
    const code = await Promise.race([
      rpcCall(tabId, "eth_getCode", [addr, "latest"]),
      new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), 1500))
    ]);
    const isContract = !!(code && code !== "0x" && code !== "0x0" && code.length > 2);
    getCodeCache.set(cacheKey, isContract);
    return isContract;
  } catch {
    return void 0;
  }
}
async function loadIntel() {
  try {
    const r = await chrome.storage.local.get(INTEL_KEY);
    return r?.[INTEL_KEY] ?? null;
  } catch {
    return null;
  }
}
async function saveIntel(intel) {
  try {
    await chrome.storage.local.set({ [INTEL_KEY]: intel });
  } catch {
  }
}
async function getIntelFresh() {
  const cached = await loadIntel();
  if (cached && Date.now() - cached.updatedAt < INTEL_TTL_MS) return cached;
  const fresh = await fetchThreatIntel();
  await saveIntel(fresh);
  return fresh;
}
async function getIntelCachedFast() {
  const cached = await loadIntel();
  if (cached) return cached;
  return getMinimalSeedIntel();
}
var _intelRefreshInProgress = false;
function ensureIntelRefreshSoon(reason) {
  if (_intelRefreshInProgress) return;
  _intelRefreshInProgress = true;
  Promise.resolve().then(() => updateIntelNow()).catch(() => {
  }).finally(() => {
    _intelRefreshInProgress = false;
  });
}
async function updateIntelNow(_opts) {
  const fresh = await fetchThreatIntel();
  await saveIntel(fresh);
  return fresh;
}
var _addrIntelRefreshInProgress = false;
function ensureAddressIntelRefreshSoon(reason) {
  if (_addrIntelRefreshInProgress) return;
  _addrIntelRefreshInProgress = true;
  Promise.resolve().then(async () => {
    try {
      const fresh = await refreshAddressIntel();
      await saveAddressIntel(fresh);
    } finally {
      _addrIntelRefreshInProgress = false;
    }
  }).catch(() => {
    _addrIntelRefreshInProgress = false;
  });
}
chrome.runtime.onInstalled.addListener((details) => {
  console.log("\u{1F6A8} [SignGuard Background] Installed/Updated event fired");
  if (details.reason === "install") {
    try {
      chrome.tabs.create({ url: chrome.runtime.getURL("onboarding.html") });
    } catch {
    }
  }
  initTokenSecurity().catch(() => {
  });
  ensureIntelRefreshSoon("startup");
  ensureAddressIntelRefreshSoon("startup");
  chrome.alarms.create("sg_intel_daily", { periodInMinutes: 24 * 60 });
  chrome.alarms.create("SG_REFRESH_LISTS", { periodInMinutes: 360 });
  refresh().catch(() => {
  });
});
chrome.alarms.onAlarm.addListener(async (a) => {
  if (a.name === "sg_intel_daily") {
    try {
      await updateIntelNow();
    } catch {
    }
    try {
      ensureAddressIntelRefreshSoon("alarm_daily");
    } catch {
    }
    return;
  }
  if (a.name === "SG_REFRESH_LISTS") {
    try {
      await refresh();
    } catch {
    }
  }
});
async function rpcCall(tabId, method, params) {
  if (!tabId || typeof chrome.tabs.sendMessage !== "function") return null;
  const allowed = /* @__PURE__ */ new Set(["eth_call", "eth_chainid", "eth_getCode"]);
  if (!allowed.has(String(method).toLowerCase())) return null;
  try {
    const resp = await chrome.tabs.sendMessage(tabId, { type: "SG_RPC_CALL_REQUEST", id: crypto.randomUUID(), method, params });
    return resp?.ok ? resp.result : null;
  } catch {
    return null;
  }
}
async function getAssetInfo(chainId, address, tabId) {
  const key = `${(chainId || "").toLowerCase()}:${(address || "").toLowerCase()}`;
  if (!key || key === ":") return null;
  try {
    const cached = (await chrome.storage.local.get(ASSET_CACHE_KEY))?.[ASSET_CACHE_KEY] || {};
    const hit = cached[key];
    if (hit && Date.now() - (hit.fetchedAt || 0) < ASSET_CACHE_TTL_MS) return hit;
    const call = (to, data) => rpcCall(tabId, "eth_call", [{ to, data, gas: "0x7530" }]);
    const nameHex = await call(address, "0x06fdde03");
    const symbolHex = await call(address, "0x95d89b41");
    const decimalsHex = await call(address, "0x313ce567");
    let name = "";
    let symbol = "";
    let decimals;
    const decodeBytes = (h) => {
      if (!h || typeof h !== "string" || !h.startsWith("0x")) return "";
      const hex = h.slice(2);
      const len = parseInt(hex.slice(64, 128), 16) || 0;
      const data = hex.slice(128, 128 + len * 2);
      let s = "";
      for (let i = 0; i < data.length; i += 2) {
        const c = parseInt(data.slice(i, i + 2), 16);
        if (c > 0) s += String.fromCharCode(c);
      }
      return s;
    };
    if (nameHex) name = decodeBytes(nameHex);
    if (symbolHex) symbol = decodeBytes(symbolHex);
    if (decimalsHex && typeof decimalsHex === "string" && decimalsHex.startsWith("0x")) {
      try {
        decimals = parseInt(decimalsHex, 16);
      } catch {
      }
    }
    let kind = "UNKNOWN";
    if (decimals != null && (symbol || name)) {
      kind = "ERC20";
    } else {
      const pad32 = (h) => h.replace(/^0x/, "").padStart(64, "0").slice(0, 64);
      const sup721 = await call(address, "0x01ffc9a7" + pad32("0x80ac58cd"));
      const sup1155 = await call(address, "0x01ffc9a7" + pad32("0xd9b67a26"));
      const isTrue = (r) => r && /[1-9a-f]/.test(String(r).replace(/^0x/, ""));
      if (isTrue(sup721)) kind = "ERC721";
      else if (isTrue(sup1155)) kind = "ERC1155";
    }
    const info = { chainId, address: address.toLowerCase(), kind, name: name || void 0, symbol: symbol || void 0, decimals, fetchedAt: Date.now() };
    cached[key] = info;
    await chrome.storage.local.set({ [ASSET_CACHE_KEY]: cached });
    return info;
  } catch {
    return null;
  }
}
var DEBUG_KEY = "sg_debug_events";
function clamp01(n, min = 0, max = 100) {
  return Math.max(min, Math.min(max, n));
}
function truncateStr(s, max = 1200) {
  const str = typeof s === "string" ? s : String(s ?? "");
  if (str.length <= max) return str;
  return str.slice(0, max) + "\u2026";
}
function pushDebugEvent(evt) {
  try {
    chrome.storage.local.get(DEBUG_KEY, (r) => {
      const err = chrome.runtime.lastError;
      if (err) return;
      const arr = Array.isArray(r?.[DEBUG_KEY]) ? r[DEBUG_KEY] : [];
      arr.push(evt);
      const trimmed = arr.slice(-20);
      chrome.storage.local.set({ [DEBUG_KEY]: trimmed }, () => void 0);
    });
  } catch {
  }
}
var PRICE_CACHE_KEY = "sg_price_cache";
var PRICE_CACHE_TTL_MS = 12e4;
var __ethUsdCache = null;
async function getEthUsdPriceCached() {
  const now = Date.now();
  if (__ethUsdCache && now - __ethUsdCache.fetchedAt < PRICE_CACHE_TTL_MS) return __ethUsdCache.usdPerEth;
  try {
    const stored = await new Promise((resolve) => {
      chrome.storage.local.get(PRICE_CACHE_KEY, (r) => {
        if (chrome.runtime?.lastError) return resolve(null);
        resolve(r?.[PRICE_CACHE_KEY] ?? null);
      });
    });
    if (stored?.ethUsd != null && Number.isFinite(stored.ethUsd) && stored.updatedAt != null && now - stored.updatedAt < PRICE_CACHE_TTL_MS) {
      __ethUsdCache = { usdPerEth: stored.ethUsd, fetchedAt: stored.updatedAt };
      return stored.ethUsd;
    }
  } catch {
  }
  try {
    const resp = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd", {
      method: "GET",
      headers: { "accept": "application/json" }
    });
    if (!resp.ok) return null;
    const j = await resp.json();
    const usd = Number(j?.ethereum?.usd);
    if (!Number.isFinite(usd) || usd <= 0) return null;
    __ethUsdCache = { usdPerEth: usd, fetchedAt: now };
    try {
      chrome.storage.local.set({ [PRICE_CACHE_KEY]: { ethUsd: usd, updatedAt: now } }, () => void 0);
    } catch {
    }
    return usd;
  } catch {
    return null;
  }
}
async function getSettings() {
  return await new Promise((resolve) => {
    try {
      chrome.storage.sync.get(DEFAULT_SETTINGS, (got) => {
        const err = chrome.runtime.lastError;
        if (err) return resolve(DEFAULT_SETTINGS);
        resolve(got);
      });
    } catch {
      resolve(DEFAULT_SETTINGS);
    }
  });
}
try {
  initTelemetry(getSettings);
} catch (e) {
  console.warn("SignGuard: Telemetry init failed (non-fatal):", e);
}
var WEB3_KEYWORDS = ["swap", "dex", "finance", "crypto", "nft", "wallet", "bridge", "stake", "defi", "uniswap", "pancake", "opensea", "metamask", "phantom"];
var tabSessions = /* @__PURE__ */ new Map();
function isWeb3RelevantDomain(host) {
  const h = (host || "").toLowerCase();
  if (!h) return false;
  return WEB3_KEYWORDS.some((k) => h.includes(k));
}
function domainToInterestCategory(host) {
  const h = (host || "").toLowerCase();
  if (!h) return void 0;
  for (const [key, category] of Object.entries(INTEREST_MAP)) {
    if (h.includes(key.toLowerCase()) || h.endsWith("." + key.toLowerCase())) return category;
  }
  return void 0;
}
async function endSessionAndTrack(tabId) {
  const s = tabSessions.get(tabId);
  tabSessions.delete(tabId);
  if (!s) return;
  try {
    const durationSec = Math.max(0, Math.round((Date.now() - s.startTime) / 1e3));
    if (durationSec > 0 && (await getSettings()).cloudIntelOptIn !== false) {
      await telemetry.trackSession({ domain: s.domain, referrer: s.referrer, durationSec });
    }
  } catch {
  }
}
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  try {
    const url = changeInfo.url ?? tab?.url;
    const status = changeInfo.status;
    if (status === "complete" && url) {
      try {
        const u = new URL(url);
        const host = u.hostname || "";
        if (isWeb3RelevantDomain(host)) {
          const category = domainToInterestCategory(host);
          if (category) {
            telemetry.trackInterest(category).catch(() => {
            });
            chrome.storage.local.get("sg_user_interest_tags", (r) => {
              const arr = Array.isArray(r?.sg_user_interest_tags) ? r.sg_user_interest_tags : [];
              if (!arr.includes(category)) {
                arr.push(category);
                chrome.storage.local.set({ sg_user_interest_tags: arr });
              }
            });
          }
          endSessionAndTrack(tabId).then(() => {
            tabSessions.set(tabId, { startTime: Date.now(), domain: host, referrer: "" });
          });
        }
        getSettings().then((settings) => {
          const allowlist = settings?.allowlist || [];
          const trusted = [...allowlist, ...settings?.trustedDomains || []];
          if (!isAllowlisted(host, trusted) && !isWeb3RelevantDomain(host)) return null;
          return Promise.all([canShowAd(), getEligibleCampaign()]).then(
            ([can, campaign]) => can && campaign ? { campaign } : null
          );
        }).then((result) => {
          if (!result?.campaign) return;
          const campaign = result.campaign;
          markAdShown().catch(() => {
          });
          trackAdEvent(campaign.id, "VIEW").catch(() => {
          });
          chrome.tabs.sendMessage(tabId, {
            type: "SHOW_MARKETING_TOAST",
            payload: {
              id: campaign.id,
              title: campaign.title,
              body: campaign.body,
              cta_text: campaign.cta_text || "Saber mais",
              link: campaign.link,
              icon: campaign.icon
            }
          }).catch(() => {
          });
        }).catch(() => {
        });
      } catch {
      }
    }
  } catch {
  }
});
chrome.tabs.onRemoved.addListener((tabId) => {
  endSessionAndTrack(tabId).catch(() => {
  });
});
function isVaultLockedContract(settings, req) {
  const vault = settings.vault;
  if (!vault?.enabled || !Array.isArray(vault.lockedContracts) || vault.lockedContracts.length === 0) return false;
  const method = String(req?.request?.method ?? "").toLowerCase();
  if (method !== "eth_sendtransaction" && method !== "wallet_sendtransaction") return false;
  const params = req?.request?.params;
  const tx = Array.isArray(params) && params[0] && typeof params[0] === "object" ? params[0] : null;
  if (!tx) return false;
  const to = typeof tx.to === "string" ? tx.to.trim() : "";
  if (!to || !to.startsWith("0x")) return false;
  const hex = to.replace(/^0x/, "").toLowerCase();
  if (hex.length !== 40 || !/^[a-f0-9]{40}$/.test(hex)) return false;
  const toNorm = "0x" + hex;
  const locked = vault.lockedContracts.map((a) => {
    const h = String(a).replace(/^0x/, "").toLowerCase();
    return h.length === 40 ? "0x" + h : "";
  }).filter(Boolean);
  return locked.includes(toNorm);
}
function domainHeuristicsLocalized(host) {
  const h = (host || "").toLowerCase();
  const reasons = [];
  if (!h) return { level: "LOW", reasons };
  if (h.startsWith("xn--") || h.includes(".xn--")) reasons.push(t("domainPunycodeReason"));
  if (h.includes("--")) reasons.push(t("domainDoubleDashReason"));
  if (/\d{2,}/.test(h)) reasons.push(t("domainNumberPatternReason"));
  const suspects = [
    { legit: "uniswap.org", typos: ["uniswa", "un1swap", "unlswap", "uniswap-app"] },
    { legit: "opensea.io", typos: ["opensea-", "open-sea", "0pensea"] }
  ];
  for (const s of suspects) {
    if (s.typos.some((tt) => h.includes(tt))) reasons.push(t("domainLookalikeReason", { domain: s.legit }));
  }
  return { level: reasons.length ? "WARN" : "LOW", reasons };
}
function summarizeTx(method, params) {
  const m = String(method || "").toLowerCase();
  if (m !== "eth_sendtransaction" && m !== "wallet_sendtransaction") return null;
  const tx = params?.[0];
  if (!tx || typeof tx !== "object") return null;
  const to = typeof tx.to === "string" ? tx.to : "";
  const data = typeof tx.data === "string" ? tx.data : "";
  const valueWei = hexToBigInt(tx.value || "0x0");
  const valueEth = weiToEth(valueWei);
  const gasLimit = hexToBigInt(tx.gas || tx.gasLimit || "0x0");
  const maxFeePerGas = hexToBigInt(tx.maxFeePerGas || "0x0");
  const gasPrice = hexToBigInt(tx.gasPrice || "0x0");
  const hasGas = gasLimit > 0n;
  const hasFeePerGas = maxFeePerGas > 0n || gasPrice > 0n;
  const feeKnown = !!(hasGas && hasFeePerGas);
  const feePerGas = maxFeePerGas > 0n ? maxFeePerGas : gasPrice;
  let maxGasFeeEth = "";
  let maxTotalEth = "";
  if (feeKnown && gasLimit > 0n && feePerGas > 0n) {
    const gasFeeWei = gasLimit * feePerGas;
    maxGasFeeEth = weiToEth(gasFeeWei);
    maxTotalEth = weiToEth(valueWei + gasFeeWei);
  }
  const selector = data && data.startsWith("0x") && data.length >= 10 ? data.slice(0, 10) : "";
  const contractNameHint = to && data && data !== "0x" && data.toLowerCase() !== "0x" ? shortAddr(to) : void 0;
  return { to, valueEth, maxGasFeeEth, maxTotalEth, selector, feeKnown, contractNameHint };
}
function isProtectionPaused(settings) {
  const until = settings.pausedUntil;
  return typeof until === "number" && Number.isFinite(until) && Date.now() < until;
}
function applyPolicy(analysis, settings) {
  if (isProtectionPaused(settings)) {
    analysis.protectionPaused = true;
    analysis.recommend = "ALLOW";
    analysis.score = 0;
    analysis.reasons = [t("mode_off_reason")];
    return;
  }
  const mode = settings.mode || "BALANCED";
  if (mode === "OFF") {
    analysis.recommend = "ALLOW";
    analysis.score = 0;
    analysis.reasons = [t("mode_off_reason")];
    return;
  }
  const decoded = analysis.decodedAction;
  if (analysis.isPhishing) {
    analysis.recommend = "BLOCK";
    return;
  }
  if (mode === "STRICT") {
    if (decoded?.kind === "SET_APPROVAL_FOR_ALL" && decoded.approved && (settings.strictBlockSetApprovalForAll ?? true)) {
      analysis.recommend = "BLOCK";
      return;
    }
    if (decoded?.kind === "APPROVE_ERC20" && decoded.amountType === "UNLIMITED" && (settings.strictBlockApprovalsUnlimited ?? true)) {
      analysis.recommend = "BLOCK";
      return;
    }
    if (decoded?.kind === "PERMIT_EIP2612" && decoded.valueType === "UNLIMITED" && (settings.strictBlockPermitLike ?? true)) {
      analysis.recommend = "BLOCK";
      return;
    }
    if (analysis.flaggedAddress) {
      analysis.recommend = "BLOCK";
      return;
    }
  }
  if (mode === "BALANCED") {
    if (analysis.flaggedAddress) {
      analysis.recommend = "HIGH";
      return;
    }
    if (decoded?.kind === "APPROVE_ERC20" && decoded.amountType === "UNLIMITED" || decoded?.kind === "SET_APPROVAL_FOR_ALL" && decoded?.approved) {
      if (analysis.recommend !== "BLOCK") analysis.recommend = "HIGH";
    }
  }
  if (mode === "RELAXED") {
    if (analysis.flaggedAddress) {
      analysis.recommend = "HIGH";
      return;
    }
  }
}
function chainName(chainIdHex) {
  const id = String(chainIdHex || "").toLowerCase();
  const map = {
    "0x1": "Ethereum",
    "0x89": "Polygon",
    "0xa4b1": "Arbitrum",
    "0xa": "Optimism",
    "0x38": "BNB Chain",
    "0xa86a": "Avalanche"
  };
  return map[id] || chainIdHex;
}
function intentFromTxDataAndValue(data, valueWei, selector) {
  const dataNorm = typeof data === "string" ? data : "";
  const hasData = !!dataNorm && dataNorm !== "0x" && dataNorm.toLowerCase() !== "0x";
  const hasValue = valueWei > 0n;
  if (hasData && hasValue) return "CONTRACT_INTERACTION";
  if (hasData) return "CONTRACT_INTERACTION";
  if (!hasData && hasValue) return "ETH_TRANSFER";
  const s = String(selector || "").toLowerCase();
  if (!s || !s.startsWith("0x") || s.length !== 10) return "UNKNOWN";
  if (s === "0x095ea7b3" || s === "0xa22cb465") return "APPROVAL";
  const swap = /* @__PURE__ */ new Set([
    "0x38ed1739",
    "0x7ff36ab5",
    "0x18cbafe5",
    "0x04e45aaf",
    "0xb858183f",
    "0x5023b4df",
    "0x09b81346"
  ]);
  if (swap.has(s)) return "SWAP";
  const seaport = /* @__PURE__ */ new Set([
    "0xfb0f3ee1",
    "0xb3a34c4c",
    "0xed98a574",
    "0xf2d12b12"
  ]);
  if (seaport.has(s)) return "NFT_PURCHASE";
  return "CONTRACT_INTERACTION";
}
function addChecksAndVerdict(analysis, ctx) {
  const host = hostFromUrl(ctx.req.url);
  const method = (ctx.req.request?.method || "").toLowerCase();
  const intelEnabled = ctx.settings.enableIntel !== false;
  const checks = [];
  if (!ctx.settings.domainChecks) {
    checks.push({ key: "DOMAIN_INTEL", status: "SKIP" });
  } else if (analysis.isPhishing) {
    checks.push({ key: "DOMAIN_INTEL", status: "FAIL" });
  } else if (host && intelEnabled && ctx.intel && (analysis.safeDomain || analysis.trust?.verdict === "LIKELY_OFFICIAL")) {
    checks.push({ key: "DOMAIN_INTEL", status: "PASS" });
  } else if (host) {
    checks.push({ key: "DOMAIN_INTEL", status: "WARN", noteKey: "coverage_limited" });
  } else {
    checks.push({ key: "DOMAIN_INTEL", status: "SKIP" });
  }
  if (!host) {
    checks.push({ key: "LOOKALIKE", status: "SKIP" });
  } else if ((analysis.reasons || []).some((r) => String(r).toLowerCase().includes("lookalike") || String(r).toLowerCase().includes("imitation"))) {
    checks.push({ key: "LOOKALIKE", status: "WARN" });
  } else {
    checks.push({ key: "LOOKALIKE", status: "PASS" });
  }
  const intent = analysis.intent;
  if (method.includes("sendtransaction") || method.includes("signtypeddata") || method.includes("sign")) {
    if (intent && intent !== "UNKNOWN") {
      checks.push({ key: "TX_DECODE", status: "PASS" });
    } else {
      checks.push({ key: "TX_DECODE", status: "WARN" });
    }
  } else {
    checks.push({ key: "TX_DECODE", status: "SKIP" });
  }
  const feeKnown = !!(analysis.txCostPreview?.feeEstimated || analysis.tx?.feeKnown);
  if (method.includes("sendtransaction")) {
    checks.push({ key: "FEE_ESTIMATE", status: feeKnown ? "PASS" : "WARN", noteKey: feeKnown ? void 0 : "fee_unknown_wallet_will_estimate" });
  } else {
    checks.push({ key: "FEE_ESTIMATE", status: "SKIP" });
  }
  if (!(ctx.settings.addressIntelEnabled ?? true)) {
    checks.push({ key: "ADDRESS_INTEL", status: "SKIP" });
  } else if (analysis.flaggedAddress) {
    checks.push({ key: "ADDRESS_INTEL", status: "FAIL" });
  } else if (method.includes("sendtransaction") || method.includes("signtypeddata")) {
    checks.push({ key: "ADDRESS_INTEL", status: "PASS" });
  } else {
    checks.push({ key: "ADDRESS_INTEL", status: "SKIP" });
  }
  if (!(ctx.settings.assetEnrichmentEnabled ?? true)) {
    checks.push({ key: "ASSET_ENRICH", status: "SKIP" });
  } else if (analysis.asset?.symbol != null || analysis.asset?.name != null) {
    checks.push({ key: "ASSET_ENRICH", status: "PASS" });
  } else if (method.includes("sendtransaction") && analysis.decodedAction) {
    checks.push({ key: "ASSET_ENRICH", status: "WARN" });
  } else {
    checks.push({ key: "ASSET_ENRICH", status: "SKIP" });
  }
  checks.push({ key: "CLOUD_INTEL", status: "SKIP" });
  const total = checks.length;
  const performed = checks.filter((c) => c.status !== "SKIP").length;
  const limited = checks.some((c) => c.status === "WARN" && (c.noteKey === "fee_unknown_wallet_will_estimate" || c.key === "DOMAIN_INTEL" || c.key === "ASSET_ENRICH"));
  let verdictLabelKey;
  if (analysis.recommend === "BLOCK") verdictLabelKey = "verdict_block";
  else if (analysis.score <= 20 && !checks.some((c) => c.status === "FAIL")) verdictLabelKey = "verdict_ok";
  else if (analysis.score <= 60) verdictLabelKey = "verdict_warn";
  else verdictLabelKey = "verdict_high";
  analysis.checks = checks;
  analysis.coverage = { performed, total, limited };
  analysis.verdictLabelKey = verdictLabelKey;
}
async function enrichWithSimulation(req, analysis, settings) {
  const method = (req?.request?.method || "").toLowerCase();
  if (!method.includes("sendtransaction")) return;
  const params = req?.request?.params;
  const tx = Array.isArray(params) && params[0] && typeof params[0] === "object" ? params[0] : null;
  if (!tx) return;
  const from = typeof tx.from === "string" ? tx.from : "0x0000000000000000000000000000000000000000";
  const to = typeof tx.to === "string" ? tx.to : "0x0000000000000000000000000000000000000000";
  const input = typeof tx.data === "string" ? tx.data : "0x";
  const value = typeof tx.value === "string" ? tx.value : "0x0";
  let gas;
  if (typeof tx.gas === "string" && tx.gas.startsWith("0x")) {
    try {
      gas = parseInt(tx.gas, 16);
    } catch {
    }
  } else if (typeof tx.gas === "number") gas = tx.gas;
  const rawChainId = req?.meta?.chainId ?? req?.chainId ?? "1";
  const networkId = String(rawChainId).replace(/^0x/, "");
  try {
    const outcome = await runSimulation(networkId, from, to, input, value, gas, settings);
    if (!outcome) return;
    analysis.simulationOutcome = outcome;
    if (settings.cloudIntelOptIn !== false) {
      try {
        let valueUsd;
        const usdPerEth = await getEthUsdPriceCached();
        if (usdPerEth != null && value) {
          const valueWei = hexToBigInt(value || "0x0");
          valueUsd = Number(valueWei) / 1e18 * usdPerEth;
        }
        await telemetry.trackTransaction({
          chainId: networkId.startsWith("0x") ? networkId : "0x" + networkId,
          contractAddress: to,
          value: value || "0x0",
          inputData: input || "0x",
          tokenSymbol: analysis.asset?.symbol,
          valueUsd
        });
      } catch {
      }
    }
    try {
      const gasCostWei = outcome.gasCostWei;
      if (gasCostWei && typeof gasCostWei === "string") {
        const usdPerEth = await getEthUsdPriceCached();
        if (usdPerEth != null && usdPerEth > 0) {
          const valueWei = hexToBigInt(value || "0x0");
          const gasCostNum = BigInt(gasCostWei);
          const gasCostUsd = Number(gasCostNum) / 1e18 * usdPerEth;
          const valueUsd = Number(valueWei) / 1e18 * usdPerEth;
          if (gasCostUsd > 50 && valueUsd < 50) {
            outcome.isHighGas = true;
          }
        }
      }
    } catch {
    }
    if (outcome.status === "REVERT") {
      analysis.simulationRevert = true;
      analysis.reasons.unshift(t("simulation_tx_will_fail"));
      analysis.recommend = "BLOCK";
      analysis.score = Math.max(analysis.score, 100);
      analysis.level = "HIGH";
      analysis.title = t("simulation_tx_will_fail");
    } else if (outcome.status === "SUCCESS") {
      const tokenAddress = analysis.tokenAddress;
      try {
        const honeypot = await runHoneypotCheck(networkId, from, to, input, value, gas, settings, tokenAddress);
        if (honeypot.isHoneypot) {
          analysis.isHoneypot = true;
          analysis.recommend = "BLOCK";
          analysis.score = Math.max(analysis.score, 100);
          analysis.level = "HIGH";
          analysis.reasons.unshift(honeypot.reason || t("honeypot_message"));
          analysis.title = t("honeypot_message");
        }
      } catch {
      }
    }
  } catch {
  }
}
function setVerificationFields(ctx) {
  const { intel, isStale, matchedBad, matchedSeed, signals } = ctx;
  const hasCache = intel.updatedAt > 0;
  let verificationLevel = "BASIC";
  if (matchedBad) {
    verificationLevel = hasCache ? "FULL" : "BASIC";
    return {
      verificationLevel,
      verificationUpdatedAt: hasCache ? intel.updatedAt : void 0,
      knownBad: true,
      knownSafe: false,
      domainSignals: signals.length ? signals : void 0,
      intelSources: (intel.sources || []).map((s) => typeof s === "string" ? s : s.name || s.id || "").filter(Boolean)
    };
  }
  if (hasCache && !isStale) verificationLevel = "FULL";
  else if (hasCache && isStale) verificationLevel = "LOCAL";
  else verificationLevel = "BASIC";
  return {
    verificationLevel,
    verificationUpdatedAt: hasCache ? intel.updatedAt : void 0,
    knownSafe: matchedSeed,
    knownBad: false,
    domainSignals: signals.length ? signals : void 0,
    intelSources: (intel.sources || []).map((s) => typeof s === "string" ? s : s.name || s.id || "").filter(Boolean)
  };
}
function labelsFor(addrIntel, addr) {
  const a = normalizeAddr(addr);
  if (!a) return [];
  return addrIntel?.labelsByAddress?.[a] || [];
}
async function analyze(req, settings, intel, tabId, addrIntel) {
  const host = hostFromUrl(req.url);
  const reasons = [];
  let level = "LOW";
  let score = 0;
  let title = "Looks OK";
  const trust = computeTrustVerdict(host, settings.allowlist);
  const explain = explainMethod(req.request?.method || "");
  const lists = buildHumanLists(req.request?.method || "", trust.verdict);
  let listCache = null;
  try {
    listCache = await getLists();
  } catch {
  }
  const listDomainDecision = listCache ? getDomainDecision(host, listCache) : "UNKNOWN";
  if (listDomainDecision === "BLOCKED") {
    return {
      level: "HIGH",
      score: 100,
      title: t("suspiciousWebsitePatterns"),
      reasons: [t("trustReasonPhishingBlacklist"), "Domain is on the blocklist."],
      decoded: { kind: "TX", raw: { host } },
      recommend: "BLOCK",
      trust,
      suggestedTrustedDomains: [...SUGGESTED_TRUSTED_DOMAINS2],
      safeDomain: false,
      isPhishing: true,
      human: {
        methodTitle: explain.title,
        methodShort: explain.short,
        methodWhy: explain.why,
        whatItDoes: lists.whatItDoes,
        risks: lists.risks,
        safeNotes: lists.safeNotes,
        nextSteps: lists.nextSteps,
        recommendation: t("human_generic_reco")
      }
    };
  }
  const listTrusted = listDomainDecision === "TRUSTED";
  if (settings.domainChecks && host && !isAllowlisted(host, settings.allowlist)) {
    const d = domainHeuristicsLocalized(host);
    if (d.level === "WARN") {
      reasons.push(...d.reasons);
      level = "WARN";
      score = Math.max(score, 45);
      title = t("suspiciousWebsitePatterns");
    }
  }
  const method = (req.request?.method || "").toLowerCase();
  if (settings.fortressMode === true && (method === "eth_sendtransaction" || method === "wallet_sendtransaction")) {
    const tx = req.request?.params?.[0];
    const data = typeof tx?.data === "string" ? tx.data : "";
    const selector = data && data.length >= 10 ? data.slice(0, 10).toLowerCase() : "";
    const isApproval = selector === "0x095ea7b3" || selector === "0xa22cb465" || selector === "0x39509351";
    if (isApproval) {
      const fortressAllowlist = [
        ...settings.allowlist || [],
        ...settings.trustedDomains || [],
        ...settings.whitelistedDomains || []
      ];
      if (!isAllowlisted(host, fortressAllowlist)) {
        const fortressMsg = t("fortress_block_message");
        return {
          level: "HIGH",
          score: 100,
          title: fortressMsg,
          reasons: [fortressMsg],
          decoded: { kind: "TX", raw: { host, method } },
          recommend: "BLOCK",
          trust,
          suggestedTrustedDomains: [...SUGGESTED_TRUSTED_DOMAINS2],
          safeDomain: false,
          human: {
            methodTitle: explain.title,
            methodShort: explain.short,
            methodWhy: explain.why,
            whatItDoes: lists.whatItDoes,
            risks: lists.risks,
            safeNotes: lists.safeNotes,
            nextSteps: lists.nextSteps,
            recommendation: fortressMsg
          }
        };
      }
    }
  }
  const intelHost = normalizeHost2(host || "");
  const customBlocked = (settings.customBlockedDomains || []).map((d) => String(d || "").trim().toLowerCase()).filter(Boolean);
  const customTrusted = (settings.customTrustedDomains || settings.allowlist || []).map((d) => String(d || "").trim().toLowerCase()).filter(Boolean);
  const inCustomBlocked = customBlocked.some((d) => hostMatches(intelHost, d));
  const inCustomTrusted = customTrusted.some((d) => hostMatches(intelHost, d));
  const intelEnabled = settings.enableIntel !== false;
  const isBlocked = inCustomBlocked || !!intelEnabled && !!intel && hostInBlocked(intel, intelHost);
  const isTrustedSeed = inCustomTrusted || !!intel && (intel.trustedSeed || intel.trustedDomainsSeed || intel.trustedDomains)?.some?.((d) => hostMatches(intelHost, d));
  const safeDomain = (isTrustedSeed || listTrusted) && !isBlocked;
  try {
    const brands = ["opensea", "uniswap", "metamask", "blur", "etherscan"];
    const dr = assessDomainRisk(intelHost, brands);
    if (dr.scoreDelta > 0) {
      reasons.push(...dr.reasons);
      score = Math.max(score, clamp01(score + dr.scoreDelta, 0, 100));
      const looksLike = dr.reasons.some((r) => String(r || "").toLowerCase().includes("lookalike"));
      if (looksLike && !isTrustedSeed) {
        level = "HIGH";
        score = Math.max(score, 85);
        title = t("suspiciousWebsitePatterns");
      } else {
        level = "WARN";
        score = Math.max(score, 45);
        title = t("suspiciousWebsitePatterns");
      }
    }
  } catch {
  }
  if (isBlocked) {
    return {
      level: "HIGH",
      score: 100,
      title: t("suspiciousWebsitePatterns"),
      reasons: [t("trustReasonPhishingBlacklist"), ...reasons],
      decoded: { kind: "TX", raw: { host } },
      recommend: "BLOCK",
      trust,
      suggestedTrustedDomains: [...SUGGESTED_TRUSTED_DOMAINS2],
      safeDomain,
      isPhishing: true,
      human: {
        methodTitle: explain.title,
        methodShort: explain.short,
        methodWhy: explain.why,
        whatItDoes: lists.whatItDoes,
        risks: lists.risks,
        safeNotes: lists.safeNotes,
        nextSteps: lists.nextSteps,
        recommendation: t("human_generic_reco")
      }
    };
  }
  if (isTrustedSeed || listTrusted) {
    reasons.push(t("trustReasonAllowlisted"));
    score = Math.max(0, score - 15);
  }
  if (method.startsWith("solana:")) {
    return {
      level: "WARN",
      score: 50,
      title: t("watchAssetTitle"),
      reasons: [t("intent_SOLANA")],
      decoded: { kind: "SIGN", raw: { method, params: req.request.params } },
      recommend: "WARN",
      trust,
      suggestedTrustedDomains: [...SUGGESTED_TRUSTED_DOMAINS2],
      intent: "SOLANA",
      human: {
        methodTitle: t("intent_SOLANA"),
        methodShort: t("summary_SOLANA_1"),
        methodWhy: t("explain_generic_why"),
        whatItDoes: [],
        risks: [t("human_generic_risk_1")],
        safeNotes: [t("human_generic_safe_1")],
        nextSteps: [t("human_generic_next_1")],
        recommendation: t("human_generic_reco")
      }
    };
  }
  if (method === "eth_requestaccounts" || method === "wallet_requestpermissions") {
    const isPerms = method === "wallet_requestpermissions";
    const baseTitle = isPerms ? t("walletRequestPermissionsTitle") : t("connectTitle");
    const baseReason = isPerms ? t("walletRequestPermissionsReason") : t("connectReason");
    const connectReasons = reasons.length ? reasons.slice() : [baseReason];
    if (settings.showConnectOverlay) {
      return {
        level: level === "HIGH" ? "HIGH" : "WARN",
        score: Math.max(score, 30),
        title: level === "WARN" ? title : baseTitle,
        reasons: connectReasons,
        decoded: { kind: "CONNECT", raw: { host } },
        recommend: "WARN",
        trust,
        suggestedTrustedDomains: [...SUGGESTED_TRUSTED_DOMAINS2],
        safeDomain,
        human: {
          methodTitle: explain.title,
          methodShort: explain.short,
          methodWhy: explain.why,
          whatItDoes: lists.whatItDoes,
          siteSees: [t("human_connect_sees_1"), t("human_connect_sees_2"), t("human_connect_sees_3")],
          notHappen: [t("human_connect_not_1"), t("human_connect_not_2")],
          whyAsked: [t("human_connect_why_1"), t("human_connect_why_2"), t("human_connect_why_3")],
          risks: lists.risks,
          safeNotes: lists.safeNotes,
          nextSteps: lists.nextSteps,
          recommendation: trust.verdict === "SUSPICIOUS" ? t("human_connect_reco_suspicious") : t("human_connect_reco_ok")
        }
      };
    }
    return {
      level,
      score,
      title: level === "WARN" ? title : baseTitle,
      reasons: connectReasons,
      decoded: { kind: "CONNECT", raw: { host } },
      recommend: level === "WARN" ? "WARN" : "ALLOW",
      trust,
      suggestedTrustedDomains: [...SUGGESTED_TRUSTED_DOMAINS2],
      safeDomain,
      human: {
        methodTitle: explain.title,
        methodShort: explain.short,
        methodWhy: explain.why,
        whatItDoes: lists.whatItDoes,
        siteSees: [t("human_connect_sees_1"), t("human_connect_sees_2"), t("human_connect_sees_3")],
        notHappen: [t("human_connect_not_1"), t("human_connect_not_2")],
        whyAsked: [t("human_connect_why_1"), t("human_connect_why_2"), t("human_connect_why_3")],
        risks: lists.risks,
        safeNotes: lists.safeNotes,
        nextSteps: lists.nextSteps,
        recommendation: trust.verdict === "SUSPICIOUS" ? t("human_connect_reco_suspicious") : t("human_connect_reco_ok")
      }
    };
  }
  if (method === "eth_signtypeddata_v4") {
    reasons.push(t("typedDataWarnReason"));
    if (level !== "HIGH") level = "WARN";
    score = Math.max(score, 60);
    title = t("signatureRequest");
    let permitExtras = null;
    try {
      const params = req.request.params;
      const raw = Array.isArray(params) && typeof params[1] === "string" ? params[1] : Array.isArray(params) && typeof params[0] === "string" ? params[0] : "";
      if (raw) {
        permitExtras = extractTypedDataPermitExtras(raw);
        if (raw.length > 2e5) {
          reasons.push("Payload muito grande; confirme na carteira.");
          level = "HIGH";
          score = Math.max(score, 85);
          return {
            level,
            score,
            title,
            reasons,
            decoded: { kind: "TYPED_DATA", raw: { size: raw.length } },
            recommend: "WARN",
            trust,
            suggestedTrustedDomains: [...SUGGESTED_TRUSTED_DOMAINS2],
            safeDomain,
            human: {
              methodTitle: explain.title,
              methodShort: explain.short,
              methodWhy: explain.why,
              whatItDoes: lists.whatItDoes,
              risks: lists.risks,
              safeNotes: lists.safeNotes,
              nextSteps: lists.nextSteps,
              recommendation: trust.verdict === "SUSPICIOUS" ? t("human_sign_reco_suspicious") : t("human_sign_reco_ok")
            }
          };
        }
        const j = JSON.parse(raw);
        const domainName = String(j?.domain?.name || "");
        const msg = j?.message || {};
        if (permitExtras) {
          reasons.push(t("permit_signature_detected"));
          if (permitExtras.spender) reasons.push("Verifique o spender.");
          level = "HIGH";
          score = Math.max(score, 90);
        }
        const looksPermit2 = domainName.toLowerCase().includes("permit2") || !!msg?.permitted && !!msg?.spender;
        const looksApproveLike = !!msg?.spender && ("value" in msg || "amount" in msg);
        const looksSeaport = domainName.toLowerCase().includes("seaport") || !!msg?.offer && !!msg?.consideration;
        if (!permitExtras && (looksPermit2 || looksApproveLike)) {
          reasons.push("Assinatura pode permitir que um endere\xE7o gaste seus tokens.");
          if (String(msg?.spender || "").trim()) {
            reasons.push("Verifique o spender.");
            level = "HIGH";
            score = Math.max(score, 90);
          }
        }
        if (looksSeaport) {
          reasons.push("Assinatura \xE9 uma ordem de marketplace (pode listar/comprar).");
          score = Math.max(score, 70);
        }
      }
    } catch {
    }
    const typedDataExtras = permitExtras ? { spender: permitExtras.spender, value: permitExtras.value, deadline: permitExtras.deadline } : void 0;
    return {
      level,
      score,
      title,
      reasons,
      decoded: { kind: "TYPED_DATA", raw: { params: req.request.params } },
      recommend: "WARN",
      trust,
      suggestedTrustedDomains: [...SUGGESTED_TRUSTED_DOMAINS2],
      safeDomain,
      typedDataExtras,
      human: {
        methodTitle: explain.title,
        methodShort: explain.short,
        methodWhy: explain.why,
        whatItDoes: lists.whatItDoes,
        risks: lists.risks,
        safeNotes: lists.safeNotes,
        nextSteps: lists.nextSteps,
        recommendation: trust.verdict === "SUSPICIOUS" ? t("human_sign_reco_suspicious") : t("human_sign_reco_ok")
      }
    };
  }
  if (method === "personal_sign" || method === "eth_sign") {
    reasons.push(t("rawSignWarnReason"));
    if (level !== "HIGH") level = "WARN";
    score = Math.max(score, 55);
    title = t("signatureRequest");
    return {
      level,
      score,
      title,
      reasons,
      decoded: { kind: "SIGN", raw: { params: req.request.params } },
      recommend: "WARN",
      trust,
      suggestedTrustedDomains: [...SUGGESTED_TRUSTED_DOMAINS2],
      human: {
        methodTitle: explain.title,
        methodShort: explain.short,
        methodWhy: explain.why,
        whatItDoes: lists.whatItDoes,
        risks: lists.risks,
        safeNotes: lists.safeNotes,
        nextSteps: lists.nextSteps,
        recommendation: trust.verdict === "SUSPICIOUS" ? t("human_sign_reco_suspicious") : t("human_sign_reco_ok")
      }
    };
  }
  if (method === "wallet_switchethereumchain") {
    reasons.push(t("explain_switch_short"));
    if (level !== "HIGH") level = "WARN";
    score = Math.max(score, 45);
    title = t("chainChangeTitle");
    return {
      level,
      score,
      title,
      reasons,
      decoded: { kind: "TX", raw: { params: req.request.params } },
      recommend: "WARN",
      trust,
      suggestedTrustedDomains: [...SUGGESTED_TRUSTED_DOMAINS2],
      safeDomain,
      intent: "SWITCH_CHAIN",
      chainTarget: (() => {
        try {
          const p0 = req.request.params?.[0];
          const chainIdHex = String(p0?.chainId || "");
          if (!chainIdHex) return void 0;
          return { chainIdHex, chainName: chainName(chainIdHex) };
        } catch {
          return void 0;
        }
      })(),
      human: {
        methodTitle: explain.title,
        methodShort: explain.short,
        methodWhy: explain.why,
        whatItDoes: lists.whatItDoes,
        risks: lists.risks,
        safeNotes: lists.safeNotes,
        nextSteps: lists.nextSteps,
        recommendation: t("human_chain_reco")
      }
    };
  }
  if (method === "wallet_addethereumchain") {
    reasons.push(t("add_chain_review_rpc"));
    reasons.push(t("add_chain_verify_chainid"));
    if (level !== "HIGH") level = "WARN";
    score = Math.max(score, 45);
    title = t("chainChangeTitle");
    const p0 = req.request.params?.[0];
    const addChainInfo = p0 ? {
      chainId: String(p0.chainId || ""),
      chainName: String(p0.chainName || ""),
      rpcUrls: Array.isArray(p0.rpcUrls) ? p0.rpcUrls : p0.rpcUrls ? [p0.rpcUrls] : [],
      nativeCurrencySymbol: p0?.nativeCurrency?.symbol ? String(p0.nativeCurrency.symbol) : void 0
    } : void 0;
    return {
      level,
      score,
      title,
      reasons,
      decoded: { kind: "TX", raw: { params: req.request.params } },
      recommend: "WARN",
      trust,
      suggestedTrustedDomains: [...SUGGESTED_TRUSTED_DOMAINS2],
      safeDomain,
      intent: "ADD_CHAIN",
      chainTarget: addChainInfo ? { chainIdHex: addChainInfo.chainId, chainName: addChainInfo.chainName } : void 0,
      addChainInfo,
      human: {
        methodTitle: explain.title,
        methodShort: t("explain_add_chain_short"),
        methodWhy: explain.why,
        whatItDoes: lists.whatItDoes,
        risks: lists.risks,
        safeNotes: lists.safeNotes,
        nextSteps: lists.nextSteps,
        recommendation: t("human_chain_reco")
      }
    };
  }
  if (method === "wallet_watchasset") {
    reasons.push(t("watch_asset_no_spend_but_risk"));
    reasons.push(t("watch_asset_verify_contract"));
    if (level !== "HIGH") level = "WARN";
    score = Math.max(score, 40);
    title = t("watchAssetTitle");
    const p0 = req.request.params?.[0];
    const opts = p0?.options || p0;
    const watchAssetInfo = opts ? {
      type: String(opts.type || "ERC20"),
      address: typeof opts.address === "string" ? opts.address : void 0,
      symbol: typeof opts.symbol === "string" ? opts.symbol : void 0,
      decimals: typeof opts.decimals === "number" ? opts.decimals : void 0,
      image: typeof opts.image === "string" ? opts.image : void 0
    } : void 0;
    return {
      level,
      score,
      title,
      reasons,
      decoded: { kind: "TX", raw: { params: req.request.params } },
      recommend: "WARN",
      trust,
      suggestedTrustedDomains: [...SUGGESTED_TRUSTED_DOMAINS2],
      intent: "WATCH_ASSET",
      watchAssetInfo,
      human: {
        methodTitle: explain.title,
        methodShort: t("explain_watch_asset_short"),
        methodWhy: explain.why,
        whatItDoes: lists.whatItDoes,
        risks: lists.risks,
        safeNotes: lists.safeNotes,
        nextSteps: lists.nextSteps,
        recommendation: t("human_watchasset_reco")
      }
    };
  }
  if (method === "eth_sendtransaction" || method === "wallet_sendtransaction") {
    await initTokenSecurity().catch(() => {
    });
    const tx = req.request.params?.[0] ?? {};
    const to = (tx.to ?? "").toLowerCase();
    const data = typeof tx.data === "string" ? tx.data : "";
    const value = tx.value ?? "0x0";
    const txSummary = summarizeTx(method, req.request.params || []);
    const selector = (txSummary?.selector || "").toLowerCase();
    const chainId = (req.meta?.chainId ?? "").toString().toLowerCase() || void 0;
    const decodedAction = isHexString(data) && data.startsWith("0x") ? decodeTx(data.toLowerCase(), to) : null;
    const valueWei = hexToBigInt(tx.value || "0x0");
    let intent = decodedAction ? decodedAction.kind === "APPROVE_ERC20" || decodedAction.kind === "SET_APPROVAL_FOR_ALL" || decodedAction.kind === "PERMIT_EIP2612" ? "APPROVAL" : decodedAction.kind === "TRANSFER_ERC20" || decodedAction.kind === "TRANSFERFROM_ERC20" ? "TOKEN_TRANSFER" : decodedAction.kind === "TRANSFER_NFT" ? "NFT_TRANSFER" : intentFromTxDataAndValue(data, valueWei, selector) : intentFromTxDataAndValue(data, valueWei, selector);
    let txExtras;
    let flaggedAddr;
    let asset = null;
    const tokenAddr = getTokenAddressForTx(to, decodedAction);
    const tokenInfo = tokenAddr ? getTokenInfo(tokenAddr) : void 0;
    const tokenMeta = tokenAddr ? {
      tokenVerified: tokenInfo?.v ?? false,
      tokenAddress: tokenAddr,
      tokenSymbol: tokenInfo?.s,
      tokenLogoUri: tokenInfo?.l || void 0
    } : {};
    const labelsTo = settings.addressIntelEnabled ?? true ? labelsFor(addrIntel ?? null, to) : [];
    const labelsSpender = (settings.addressIntelEnabled ?? true) && decodedAction && "spender" in decodedAction ? labelsFor(addrIntel ?? null, decodedAction.spender || "") : [];
    const labelsOperator = (settings.addressIntelEnabled ?? true) && decodedAction && "operator" in decodedAction ? labelsFor(addrIntel ?? null, decodedAction.operator || "") : [];
    const labelsTokenContract = (settings.addressIntelEnabled ?? true) && decodedAction && "token" in decodedAction ? labelsFor(addrIntel ?? null, decodedAction.token || to) : [];
    const hasAddrIntelHit = labelsTo.length > 0 || labelsSpender.length > 0 || labelsOperator.length > 0 || labelsTokenContract.length > 0;
    const addrIntelReasons = [];
    let addrIntelScore = 0;
    let addrIntelRecommend;
    if (hasAddrIntelHit) {
      const allLabels = [...labelsTo, ...labelsSpender, ...labelsOperator, ...labelsTokenContract];
      if (allLabels.includes("SANCTIONED")) {
        addrIntelReasons.push(t("addr_sanctioned_block"));
        addrIntelScore = 100;
        addrIntelRecommend = "BLOCK";
      } else {
        if (allLabels.some((l) => l === "SCAM_REPORTED" || l === "PHISHING_REPORTED")) addrIntelReasons.push(t("addr_scam_reported_warn"));
        if (allLabels.includes("MALICIOUS_CONTRACT")) addrIntelReasons.push(t("addr_malicious_contract_warn"));
        addrIntelScore = 80;
        addrIntelRecommend = "HIGH";
      }
    }
    const addressIntelPartial = hasAddrIntelHit ? {
      addressIntelHit: true,
      addressIntel: {
        to: labelsTo.map(String),
        spender: labelsSpender.map(String),
        operator: labelsOperator.map(String),
        tokenContract: labelsTokenContract.map(String)
      }
    } : {};
    if (decodedAction && (settings.addressIntelEnabled ?? true)) {
      const candidates = [to];
      if ("spender" in decodedAction && decodedAction.spender) candidates.push(decodedAction.spender);
      if ("operator" in decodedAction && decodedAction.operator) candidates.push(decodedAction.operator);
      if ("to" in decodedAction && decodedAction.to) candidates.push(decodedAction.to);
      if ("from" in decodedAction && decodedAction.from) candidates.push(decodedAction.from);
      const blocked = intel?.blockedAddressesList || intel?.blockedAddresses || [];
      for (const addr of candidates) {
        const a = addr.toLowerCase();
        if (!a || a.length < 40) continue;
        const match = blocked.find((b) => b.address.toLowerCase() === a && (!b.chainId || b.chainId.toLowerCase() === (chainId || "")));
        if (match) {
          flaggedAddr = match;
          reasons.unshift(t("address_flagged_reason", { label: match.label, category: match.category }));
          break;
        }
        if (listCache && isBlockedAddress(a, listCache)) {
          reasons.unshift("Address is on the blocklist.");
          level = "HIGH";
          score = Math.max(score, 95);
          flaggedAddr = { address: a, label: "Blocklist", category: "blocklist", sourceId: "blocklist", confidence: 1, updatedAt: Date.now() };
          break;
        }
      }
    }
    const tokenForAsset = decodedAction && ("token" in decodedAction && decodedAction.token) ? decodedAction.token : to;
    const chainIdHex = (chainId || "0x1").startsWith("0x") ? chainId || "0x1" : "0x" + (chainId || "1");
    if (listCache && tokenForAsset && isScamToken(chainIdHex, tokenForAsset, listCache)) {
      reasons.unshift("Token contract is marked as scam / suspicious.");
      level = "HIGH";
      score = Math.max(score, 95);
    }
    if (decodedAction && tokenForAsset && (settings.assetEnrichmentEnabled ?? true) && tabId) {
      try {
        asset = await getAssetInfo(chainId || "0x1", tokenForAsset, tabId);
      } catch {
      }
    }
    if (asset) reasons.push(t("asset_info_reason", { sym: asset.symbol || asset.name || "?", kind: asset.kind }));
    if (isHexString(data) && data.startsWith("0x")) {
      const ap = decodeErc20Approve(data.toLowerCase());
      if (ap) {
        if (ap.isMax) {
          reasons.push(t("unlimitedApprovalReason"));
          level = "HIGH";
          score = Math.max(score, 90);
          title = t("unlimitedApprovalDetected");
          txExtras = {
            approvalType: "ERC20_APPROVE",
            tokenContract: typeof tx.to === "string" ? String(tx.to) : void 0,
            spender: ap.spender,
            unlimited: true
          };
          return {
            level: hasAddrIntelHit && addrIntelRecommend === "BLOCK" ? "HIGH" : level,
            score: Math.max(score, addrIntelScore),
            title,
            reasons: hasAddrIntelHit ? [...addrIntelReasons, ...reasons] : reasons,
            decoded: {
              kind: "APPROVE",
              spenderOrOperator: ap.spender,
              amountHuman: "UNLIMITED",
              raw: { to, value, selector: hexSelector(data) }
            },
            decodedAction: decodedAction?.kind === "APPROVE_ERC20" ? decodedAction : void 0,
            recommend: addrIntelRecommend ?? (settings.blockHighRisk ? "BLOCK" : "WARN"),
            trust,
            suggestedTrustedDomains: [...SUGGESTED_TRUSTED_DOMAINS2],
            tx: txSummary || void 0,
            txExtras,
            intent: "APPROVAL",
            asset: asset || void 0,
            flaggedAddress: flaggedAddr,
            provider: req.providerHint ? { kind: req.providerHint.kind, name: req.providerHint.name } : void 0,
            ...addressIntelPartial,
            ...tokenMeta,
            human: {
              methodTitle: explain.title,
              methodShort: explain.short,
              methodWhy: explain.why,
              whatItDoes: [t("human_approve_whatIs"), t("human_approve_safe_1")].slice(0, 2),
              risks: [t("human_approve_risk_1"), t("human_approve_risk_unlimited")].slice(0, 3),
              safeNotes: [t("human_approve_safe_1")].slice(0, 1),
              nextSteps: [t("human_approve_next_1"), t("human_approve_next_2")].slice(0, 3),
              recommendation: t("human_approve_reco_unlimited"),
              links: [{ text: t("human_revoke_link_text"), href: "https://revoke.cash" }]
            }
          };
        } else {
          reasons.push(t("tokenApproval"));
          level = "WARN";
          score = Math.max(score, 40);
          title = t("tokenApproval");
          txExtras = {
            approvalType: "ERC20_APPROVE",
            tokenContract: typeof tx.to === "string" ? String(tx.to) : void 0,
            spender: ap.spender,
            unlimited: false
          };
          return {
            level: hasAddrIntelHit && addrIntelRecommend === "BLOCK" ? "HIGH" : level,
            score: Math.max(score, addrIntelScore),
            title,
            reasons: hasAddrIntelHit ? [...addrIntelReasons, ...reasons] : reasons,
            decoded: {
              kind: "APPROVE",
              spenderOrOperator: ap.spender,
              amountHuman: ap.value ? ap.value.toString() : "UNKNOWN",
              raw: { to, value, selector: hexSelector(data) }
            },
            decodedAction: decodedAction?.kind === "APPROVE_ERC20" ? decodedAction : void 0,
            recommend: addrIntelRecommend ?? "WARN",
            trust,
            suggestedTrustedDomains: [...SUGGESTED_TRUSTED_DOMAINS2],
            tx: txSummary || void 0,
            txExtras,
            intent: "APPROVAL",
            asset: asset || void 0,
            flaggedAddress: flaggedAddr,
            provider: req.providerHint ? { kind: req.providerHint.kind, name: req.providerHint.name } : void 0,
            ...addressIntelPartial,
            ...tokenMeta,
            human: {
              methodTitle: explain.title,
              methodShort: explain.short,
              methodWhy: explain.why,
              whatItDoes: [t("human_approve_whatIs"), t("human_approve_safe_1")].slice(0, 2),
              risks: [t("human_approve_risk_1")].slice(0, 3),
              safeNotes: [t("human_approve_safe_1")].slice(0, 1),
              nextSteps: [t("human_approve_next_1"), t("human_approve_next_2")].slice(0, 3),
              recommendation: t("human_approve_reco"),
              links: [{ text: t("human_revoke_link_text"), href: "https://revoke.cash" }]
            }
          };
        }
      }
      const sa = decodeSetApprovalForAll(data.toLowerCase());
      if (sa && sa.approved) {
        reasons.push(t("nftOperatorApprovalReason"));
        level = "HIGH";
        score = Math.max(score, 95);
        title = t("nftOperatorApproval");
        txExtras = {
          approvalType: "NFT_SET_APPROVAL_FOR_ALL",
          tokenContract: typeof tx.to === "string" ? String(tx.to) : void 0,
          operator: sa.operator,
          unlimited: true
        };
        return {
          level: hasAddrIntelHit && addrIntelRecommend === "BLOCK" ? "HIGH" : level,
          score: Math.max(score, addrIntelScore),
          title,
          reasons: hasAddrIntelHit ? [...addrIntelReasons, ...reasons] : reasons,
          decoded: {
            kind: "SET_APPROVAL_FOR_ALL",
            spenderOrOperator: sa.operator,
            raw: { to, value, selector: hexSelector(data) }
          },
          decodedAction: decodedAction?.kind === "SET_APPROVAL_FOR_ALL" ? decodedAction : void 0,
          recommend: addrIntelRecommend ?? (settings.blockHighRisk ? "BLOCK" : "WARN"),
          trust,
          suggestedTrustedDomains: [...SUGGESTED_TRUSTED_DOMAINS2],
          tx: txSummary || void 0,
          txExtras,
          intent: "APPROVAL",
          asset: asset || void 0,
          flaggedAddress: flaggedAddr,
          provider: req.providerHint ? { kind: req.providerHint.kind, name: req.providerHint.name } : void 0,
          ...addressIntelPartial,
          ...tokenMeta,
          human: {
            methodTitle: explain.title,
            methodShort: explain.short,
            methodWhy: explain.why,
            whatItDoes: [t("human_setApprovalForAll_whatIs")].slice(0, 2),
            risks: [t("human_setApprovalForAll_risk_1")].slice(0, 3),
            safeNotes: [t("human_setApprovalForAll_safe_1")].slice(0, 1),
            nextSteps: [t("human_setApprovalForAll_next_1")].slice(0, 3),
            recommendation: t("human_setApprovalForAll_reco"),
            links: [{ text: t("human_revoke_link_text"), href: "https://revoke.cash" }]
          }
        };
      }
    }
    if (decodedAction?.kind === "TRANSFER_NFT" && !txExtras) {
      txExtras = {
        approvalType: "NFT_TRANSFER",
        tokenContract: decodedAction.token,
        toAddress: decodedAction.to
      };
    }
    if (decodedAction) {
      if (decodedAction.kind === "APPROVE_ERC20" || decodedAction.kind === "PERMIT_EIP2612") reasons.push(t("reason_permission_tokens"));
      else if (decodedAction.kind === "SET_APPROVAL_FOR_ALL" && decodedAction.approved) reasons.push(t("reason_permission_all_nfts"));
      else if (decodedAction.kind === "TRANSFER_ERC20" || decodedAction.kind === "TRANSFERFROM_ERC20") reasons.push(t("token_transfer_detected"));
      else if (decodedAction.kind === "TRANSFER_NFT") reasons.push(t("nft_transfer_detected"));
      else if (decodedAction.kind !== "UNKNOWN") reasons.push(t("reason_transfer_tokens"));
    }
    if (level === "LOW") {
      title = t("txPreview");
      score = 20;
      reasons.push(t("txWarnReason"));
    }
    if (txSummary?.valueEth) reasons.push(`Transa\xE7\xE3o: envia ${txSummary.valueEth} ETH.`);
    if (txSummary?.feeKnown) {
      if (txSummary.maxGasFeeEth) reasons.push(`Taxa m\xE1xima: ${txSummary.maxGasFeeEth} ETH.`);
      if (txSummary.maxTotalEth) reasons.push(`Total m\xE1ximo: ${txSummary.maxTotalEth} ETH.`);
    } else {
      reasons.push(t("fee_unknown_wallet_will_estimate"));
      reasons.push(t("check_wallet_network_fee"));
    }
    const feeGtValue = !!(txSummary?.feeKnown && txSummary.maxGasFeeEth && txSummary.valueEth && parseFloat(txSummary.maxGasFeeEth) > parseFloat(txSummary.valueEth));
    if (feeGtValue) reasons.unshift(t("fee_gt_value"));
    const toIsContract = await getToIsContract(to || void 0, tabId);
    const defaultRecommend = level === "HIGH" ? settings.blockHighRisk ? "BLOCK" : "WARN" : level === "WARN" ? "WARN" : "ALLOW";
    return {
      level: hasAddrIntelHit && addrIntelRecommend === "BLOCK" ? "HIGH" : level,
      score: Math.max(score, addrIntelScore),
      title,
      reasons: hasAddrIntelHit ? [...addrIntelReasons, ...reasons] : reasons,
      decoded: { kind: "TX", raw: { to, value, selector: hexSelector(data) } },
      decodedAction: decodedAction || void 0,
      recommend: addrIntelRecommend ?? defaultRecommend,
      trust,
      suggestedTrustedDomains: [...SUGGESTED_TRUSTED_DOMAINS2],
      tx: txSummary || void 0,
      txExtras,
      intent,
      safeDomain,
      asset: asset || void 0,
      flaggedAddress: flaggedAddr,
      provider: req.providerHint ? { kind: req.providerHint.kind, name: req.providerHint.name } : void 0,
      feeGtValue,
      toIsContract,
      ...addressIntelPartial,
      ...tokenMeta,
      human: {
        methodTitle: explain.title,
        methodShort: explain.short,
        methodWhy: explain.why,
        whatItDoes: lists.whatItDoes,
        risks: lists.risks,
        safeNotes: lists.safeNotes,
        nextSteps: lists.nextSteps,
        recommendation: trust.verdict === "SUSPICIOUS" ? t("human_tx_reco_suspicious") : t("human_tx_reco_ok")
      }
    };
  }
  return {
    level,
    score,
    title: level === "WARN" ? title : "Request",
    reasons: reasons.length ? reasons : [t("unknownMethodReason")],
    decoded: { kind: "TX", raw: { method: req.request.method } },
    recommend: level === "WARN" ? "WARN" : "ALLOW",
    trust,
    suggestedTrustedDomains: [...SUGGESTED_TRUSTED_DOMAINS2],
    human: {
      methodTitle: explain.title,
      methodShort: explain.short,
      methodWhy: explain.why,
      whatItDoes: lists.whatItDoes,
      risks: lists.risks,
      safeNotes: lists.safeNotes,
      nextSteps: lists.nextSteps,
      recommendation: t("human_generic_reco")
    }
  };
}
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  console.log("\u2699\uFE0F [SignGuard Background] Message received:", msg?.type, msg);
  if (!msg || typeof msg !== "object" || !msg.type) {
    try {
      sendResponse({ ok: false, error: "INVALID_MESSAGE" });
    } catch {
    }
    return false;
  }
  if (msg.type === "PING") return false;
  handleBgRequest(msg, sender).then(sendResponse).catch((err) => {
    try {
      sendResponse({ ok: false, error: String(err?.message || err) });
    } catch {
    }
  });
  return true;
});
export {
  SUGGESTED_TRUSTED_DOMAINS2 as SUGGESTED_TRUSTED_DOMAINS
};
//# sourceMappingURL=background.js.map
