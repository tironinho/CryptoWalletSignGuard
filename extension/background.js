var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// src/lists/cryptoTrustedDomainsSeed.ts
var CRYPTO_TRUSTED_DOMAINS_SEED;
var init_cryptoTrustedDomainsSeed = __esm({
  "src/lists/cryptoTrustedDomainsSeed.ts"() {
    "use strict";
    CRYPTO_TRUSTED_DOMAINS_SEED = [
      // Explorers
      "etherscan.io",
      "etherscan.com",
      "arbiscan.io",
      "polygonscan.com",
      "bscscan.com",
      "basescan.org",
      "snowtrace.io",
      "optimistic.etherscan.io",
      // NFTs
      "opensea.io",
      "blur.io",
      "looksrare.org",
      "x2y2.io",
      "rarible.com",
      "magiceden.io",
      // DEX/DeFi
      "uniswap.org",
      "app.uniswap.org",
      "1inch.io",
      "app.1inch.io",
      "aave.com",
      "app.aave.com",
      "curve.fi",
      "app.curve.fi",
      "balancer.fi",
      "app.balancer.fi",
      "sushiswap.fi",
      "matcha.xyz",
      "paraswap.io",
      "cowswap.exchange",
      // Bridges/L2
      "bridge.arbitrum.io",
      "optimism.io",
      "base.org",
      "arbitrum.io",
      "polygon.technology",
      "hop.exchange",
      "stargate.finance",
      "across.to",
      "portalbridge.com",
      "zksync.io",
      // Infra / Wallets
      "chain.link",
      "lido.fi",
      "stake.lido.fi",
      "ens.domains",
      "app.ens.domains",
      "metamask.io",
      "metamask.com",
      "rabby.io",
      "walletconnect.com",
      "walletconnect.org",
      "safe.global",
      "revoke.cash",
      "app.revoke.cash"
    ];
  }
});

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

// src/services/simulationService.ts
var simulationService_exports = {};
__export(simulationService_exports, {
  makeSkippedOutcome: () => makeSkippedOutcome,
  makeStaticModeOutcome: () => makeStaticModeOutcome,
  parseSimulationResult: () => parseSimulationResult,
  runSimulation: () => runSimulation,
  simulateTransaction: () => simulateTransaction
});
function normAddr(a) {
  if (!a || typeof a !== "string") return "";
  const s = a.toLowerCase().replace(/^0x/, "").padStart(40, "0");
  return "0x" + s.slice(-40);
}
function decodeApprovalsFromLogs(logs) {
  const out = [];
  if (!Array.isArray(logs)) return out;
  for (const log of logs) {
    const t0 = log.topics?.[0];
    if (!t0) continue;
    const t0n = t0.toLowerCase();
    if (t0n === KECCAK_APPROVAL) {
      const owner = log.topics?.[1] ? normAddr("0x" + String(log.topics[1]).slice(-40)) : "";
      const spender = log.topics?.[2] ? normAddr("0x" + String(log.topics[2]).slice(-40)) : "";
      const token = normAddr(log.address);
      let value = 0n;
      try {
        if (log.data && log.data.startsWith("0x")) value = BigInt(log.data);
      } catch {
      }
      const unlimited = value >= 2n ** 256n - 2n ** 255n;
      out.push({ token, spender, approved: true, unlimited });
    } else if (t0n === KECCAK_APPROVAL_FOR_ALL) {
      const owner = log.topics?.[1] ? normAddr("0x" + String(log.topics[1]).slice(-40)) : "";
      const operator = log.topics?.[2] ? normAddr("0x" + String(log.topics[2]).slice(-40)) : "";
      const token = normAddr(log.address);
      let approved = false;
      try {
        if (log.data && log.data.startsWith("0x")) approved = BigInt(log.data) !== 0n;
      } catch {
      }
      out.push({ token, spender: operator, approved, approvalForAll: true });
    }
  }
  return out;
}
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
function makeSkippedOutcome() {
  return {
    status: "SKIPPED",
    outgoingAssets: [],
    incomingAssets: [],
    gasUsed: "0",
    fallback: true
  };
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
function parseSimulationResult(data, walletAddress) {
  if (!data || typeof data !== "object") return null;
  const txStatus = data.transaction?.status;
  const status = txStatus === 1 ? "REVERT" : txStatus === 0 ? "SUCCESS" : "RISK";
  const wallet = normAddr(walletAddress);
  const outgoingAssets = [];
  const incomingAssets = [];
  const assetChangesRaw = data.transaction?.transaction_info?.asset_changes ?? data.asset_changes;
  const assetChanges = Array.isArray(assetChangesRaw) ? assetChangesRaw : [];
  for (const change of assetChanges) {
    const info = change?.asset_info;
    const symbol = (info?.symbol || info?.name || "?").toString();
    const amount = (change?.amount ?? change?.raw_amount ?? "0").toString();
    const logo = typeof info?.logo === "string" ? info.logo : void 0;
    const entry = { symbol, amount, logo };
    const fromNorm = normAddr(change?.from);
    const toNorm = normAddr(change?.to);
    const type = String(change?.type || "").toUpperCase();
    if (wallet) {
      if (fromNorm === wallet) outgoingAssets.push(entry);
      else if (toNorm === wallet) incomingAssets.push(entry);
      else if (type.includes("SEND") || fromNorm) outgoingAssets.push(entry);
      else if (type.includes("RECEIVE") || toNorm) incomingAssets.push(entry);
      else outgoingAssets.push(entry);
    } else {
      if (type.includes("SEND") || change?.from) outgoingAssets.push(entry);
      else if (type.includes("RECEIVE") || change?.to) incomingAssets.push(entry);
      else outgoingAssets.push(entry);
    }
  }
  const logs = data.transaction?.transaction_info?.logs;
  const approvals = decodeApprovalsFromLogs(Array.isArray(logs) ? logs : void 0);
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
  const out = {
    status,
    outgoingAssets,
    incomingAssets,
    gasUsed,
    gasCostWei,
    simulated: true
  };
  if (approvals.length > 0) out.approvals = approvals;
  return out;
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
    if (raw) return parseSimulationResult(raw, from);
    return makeStaticModeOutcome();
  } catch {
    return makeStaticModeOutcome();
  }
}
var TENDERLY_API_BASE, SIMULATE_TIMEOUT_MS, KECCAK_APPROVAL, KECCAK_APPROVAL_FOR_ALL;
var init_simulationService = __esm({
  "src/services/simulationService.ts"() {
    "use strict";
    TENDERLY_API_BASE = "https://api.tenderly.co/api/v1";
    SIMULATE_TIMEOUT_MS = 4e3;
    KECCAK_APPROVAL = "0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925";
    KECCAK_APPROVAL_FOR_ALL = "0x17307eab39ab6107e8899845ad3d59bd9653f200f220920489ca2b5937696c31";
  }
});

// src/services/listSeeds.ts
var TRUSTED_DOMAINS_SEED, BLOCKED_DOMAINS_SEED;
var init_listSeeds = __esm({
  "src/services/listSeeds.ts"() {
    "use strict";
    init_cryptoTrustedDomainsSeed();
    TRUSTED_DOMAINS_SEED = [...CRYPTO_TRUSTED_DOMAINS_SEED];
    BLOCKED_DOMAINS_SEED = [
      // Minimal seed; feeds will add more
    ];
  }
});

// src/services/listManager.ts
var listManager_exports = {};
__export(listManager_exports, {
  deleteUserOverride: () => deleteUserOverride,
  exportSnapshot: () => exportSnapshot,
  getDomainDecision: () => getDomainDecision,
  getLastRefresh: () => getLastRefresh,
  getLists: () => getLists,
  importUserOverrides: () => importUserOverrides,
  isBlockedAddress: () => isBlockedAddress,
  isScamToken: () => isScamToken,
  isTrustedToken: () => isTrustedToken,
  normalizeAddressInput: () => normalizeAddressInput,
  normalizeDomainInput: () => normalizeDomainInput,
  normalizeOverridePayload: () => normalizeOverridePayload,
  normalizeScamTokenInput: () => normalizeScamTokenInput,
  refresh: () => refresh,
  scamTokenToCanonical: () => scamTokenToCanonical,
  searchLists: () => searchLists,
  setOverrides: () => setOverrides,
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
    userScamTokens: [],
    userTrustedTokens: []
  };
}
function normalizeChain(c) {
  const s = String(c ?? "").trim().toLowerCase();
  if (!s) return "";
  return s.startsWith("0x") ? s : "0x" + parseInt(s, 10).toString(16);
}
function normalizeDomainInput(input) {
  const s = (input ?? "").trim();
  if (!s) return "";
  try {
    if (s.includes("://") || s.toLowerCase().startsWith("http")) {
      return new URL(s.startsWith("http") ? s : "https://" + s).hostname.replace(/^www\./, "").toLowerCase().trim() || "";
    }
    return s.replace(/^www\./, "").toLowerCase().replace(/\.+$/, "").trim() || "";
  } catch {
    return s.replace(/^www\./, "").toLowerCase().replace(/\.+$/, "").trim() || "";
  }
}
function normalizeAddressInput(addr) {
  const s = (addr ?? "").trim();
  const hex = s.startsWith("0x") ? s.slice(2) : s;
  if (hex.length !== 40 || !/^[a-fA-F0-9]{40}$/.test(hex)) return "";
  return "0x" + hex.toLowerCase();
}
function normalizeScamTokenInput(input) {
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
function scamTokenToCanonical(chainId, address) {
  const c = normalizeChain(chainId);
  const a = normalizeAddressInput(address);
  return c && a ? `${c}:${a}` : "";
}
function isTrustedToken(chainIdHex, tokenAddress, cache) {
  const c = normalizeChain(chainIdHex);
  const a = normalizeAddress(tokenAddress);
  if (!c || !a) return false;
  const list = cache.userTrustedTokens ?? [];
  return list.some((t2) => normalizeChain(t2.chainId) === c && normalizeAddress(t2.address) === a);
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
async function migrateTrustedDomainsFromSettings() {
  try {
    const done = await new Promise((resolve) => {
      if (!chrome?.storage?.local) return resolve(true);
      chrome.storage.local.get(MIGRATED_KEY, (r) => resolve(!!r?.[MIGRATED_KEY]));
    });
    if (done) return;
    const [cached, sync] = await Promise.all([
      getStorage(),
      new Promise((resolve) => {
        if (!chrome?.storage?.sync) return resolve({});
        chrome.storage.sync.get(["trustedDomains", "allowlist"], (r) => resolve(r ?? {}));
      })
    ]);
    const fromSettings = sync.trustedDomains ?? sync.allowlist;
    const arr = Array.isArray(fromSettings) ? fromSettings : [];
    const userTrusted = cached?.userTrustedDomains ?? [];
    if (arr.length > 0 && userTrusted.length === 0) {
      const merged = [.../* @__PURE__ */ new Set([...arr.map((d) => normalizeHost(String(d))).filter(Boolean), ...userTrusted])];
      if (cached) {
        cached.userTrustedDomains = merged;
        cached.updatedAt = Date.now();
        await setStorage(cached);
      } else {
        const fresh = emptyCache();
        fresh.userTrustedDomains = merged;
        fresh.updatedAt = Date.now();
        await setStorage(fresh);
      }
    }
    await new Promise((r) => {
      chrome.storage.local.set({ [MIGRATED_KEY]: true }, () => r());
    });
  } catch {
  }
}
async function getLists() {
  await migrateTrustedDomainsFromSettings();
  const cache = await getStorage();
  if (cache) {
    if (!cache.userTrustedTokens) cache.userTrustedTokens = [];
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
function normalizeOverridePayload(typeRaw, payload) {
  const t2 = (typeRaw ?? "").toString().toLowerCase();
  const domain = (payload.domain ?? payload.value ?? "").toString().trim();
  const address = (payload.address ?? payload.tokenAddress ?? payload.value ?? "").toString().trim();
  const chainId = (payload.chainId ?? "").toString().trim();
  if (t2 === "usertrusteddomains" && domain) return { type: "trusted_domain", payload: { value: domain } };
  if (t2 === "userblockeddomains" && domain) return { type: "blocked_domain", payload: { value: domain } };
  if (t2 === "userblockedaddresses" && address) return { type: "blocked_address", payload: { value: address, address } };
  if (t2 === "userscamtokens" && chainId && address) return { type: "scam_token", payload: { chainId, address } };
  if (t2 === "usertrustedtokens" && chainId && address) return { type: "trusted_token", payload: { chainId, address } };
  if (t2 === "trusted_domain" && domain) return { type: "trusted_domain", payload: { value: domain } };
  if (t2 === "blocked_domain" && domain) return { type: "blocked_domain", payload: { value: domain } };
  if (t2 === "blocked_address" && address) return { type: "blocked_address", payload: { value: address, address } };
  if (t2 === "scam_token" && chainId && address) return { type: "scam_token", payload: { chainId, address } };
  if (t2 === "trusted_token" && chainId && address) return { type: "trusted_token", payload: { chainId, address } };
  return null;
}
async function upsertUserOverride(type, payload) {
  const cache = await getLists();
  const next = { ...cache, userTrustedDomains: [...cache.userTrustedDomains], userBlockedDomains: [...cache.userBlockedDomains], userBlockedAddresses: [...cache.userBlockedAddresses], userScamTokens: [...cache.userScamTokens], userTrustedTokens: [...cache.userTrustedTokens ?? []], updatedAt: Date.now() };
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
    if (addr && c && !next.userScamTokens.some((t2) => normalizeChain(t2.chainId) === c && t2.address === addr)) {
      next.userScamTokens.push({ chainId: c, address: addr });
    }
  } else if (type === "trusted_token" && payload.chainId && payload.address) {
    const addr = normalizeAddress(payload.address);
    const c = normalizeChain(payload.chainId);
    if (addr && c && !next.userTrustedTokens.some((t2) => normalizeChain(t2.chainId) === c && t2.address === addr)) {
      next.userTrustedTokens.push({ chainId: c, address: addr });
    }
  }
  await setStorage(next);
  return next;
}
async function deleteUserOverride(type, value, chainId, address) {
  const cache = await getLists();
  const next = { ...cache, userTrustedDomains: [...cache.userTrustedDomains], userBlockedDomains: [...cache.userBlockedDomains], userBlockedAddresses: [...cache.userBlockedAddresses], userScamTokens: [...cache.userScamTokens], userTrustedTokens: [...cache.userTrustedTokens ?? []], updatedAt: Date.now() };
  if (type === "trusted_domain") next.userTrustedDomains = next.userTrustedDomains.filter((d) => d !== normalizeHost(value));
  else if (type === "blocked_domain") next.userBlockedDomains = next.userBlockedDomains.filter((d) => d !== normalizeHost(value));
  else if (type === "blocked_address") next.userBlockedAddresses = next.userBlockedAddresses.filter((a) => a !== normalizeAddress(value || address || ""));
  else if (type === "scam_token" && chainId && address) next.userScamTokens = next.userScamTokens.filter((t2) => !(normalizeChain(t2.chainId) === normalizeChain(chainId) && t2.address === normalizeAddress(address)));
  else if (type === "trusted_token" && chainId && address) next.userTrustedTokens = next.userTrustedTokens.filter((t2) => !(normalizeChain(t2.chainId) === normalizeChain(chainId) && t2.address === normalizeAddress(address)));
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
async function setOverrides(kind, values) {
  const cache = await getLists();
  const next = { ...cache, updatedAt: Date.now() };
  const invalid = [];
  const raw = Array.isArray(values) ? values : [];
  if (kind === "trustedDomains" || kind === "blockedDomains") {
    const normalized = [];
    for (const v of raw) {
      const n = normalizeDomainInput(v);
      if (n) normalized.push(n);
      else if (v.trim()) invalid.push(v);
    }
    next.userTrustedDomains = kind === "trustedDomains" ? [...new Set(normalized)] : [...next.userTrustedDomains];
    next.userBlockedDomains = kind === "blockedDomains" ? [...new Set(normalized)] : [...next.userBlockedDomains];
  } else if (kind === "blockedAddresses") {
    const normalized = [];
    for (const v of raw) {
      const n = normalizeAddressInput(v);
      if (n) normalized.push(n);
      else if (v.trim()) invalid.push(v);
    }
    next.userBlockedAddresses = [...new Set(normalized)];
  } else if (kind === "scamTokens") {
    const tokens = [];
    const seen = /* @__PURE__ */ new Set();
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
    invalidExamples: invalid.length > 0 ? invalid.slice(0, 5) : void 0
  };
}
async function exportSnapshot() {
  const cache = await getLists();
  const trustedEffective = [.../* @__PURE__ */ new Set([...cache.trustedDomains, ...cache.userTrustedDomains])];
  const blockedDomainsEffective = [.../* @__PURE__ */ new Set([...cache.blockedDomains, ...cache.userBlockedDomains])];
  const blockedAddressesEffective = [.../* @__PURE__ */ new Set([...cache.blockedAddresses, ...cache.userBlockedAddresses])];
  const scamKeys = /* @__PURE__ */ new Set();
  for (const t2 of cache.scamTokens) scamKeys.add(normalizeTokenKey(t2.chainId, t2.address));
  for (const t2 of cache.userScamTokens) scamKeys.add(normalizeTokenKey(t2.chainId, t2.address));
  const sourceList = [];
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
      scamTokens: (cache.userScamTokens ?? []).map((t2) => ({ chainId: t2.chainId, address: t2.address }))
    },
    totals: {
      trustedDomainsTotal: trustedEffective.length,
      blockedDomainsTotal: blockedDomainsEffective.length,
      blockedAddressesTotal: blockedAddressesEffective.length,
      scamTokensTotal: scamKeys.size
    }
  };
}
async function importUserOverrides(data) {
  const cache = await getLists();
  const next = { ...cache, updatedAt: Date.now() };
  if (Array.isArray(data.userTrustedDomains)) next.userTrustedDomains = data.userTrustedDomains.map((d) => normalizeHost(String(d))).filter(Boolean);
  if (Array.isArray(data.userBlockedDomains)) next.userBlockedDomains = data.userBlockedDomains.map((d) => normalizeHost(String(d))).filter(Boolean);
  if (Array.isArray(data.userBlockedAddresses)) next.userBlockedAddresses = data.userBlockedAddresses.map((a) => normalizeAddress(String(a))).filter(Boolean);
  if (Array.isArray(data.userScamTokens)) next.userScamTokens = data.userScamTokens.filter((t2) => t2 && t2.chainId && t2.address).map((t2) => ({ chainId: normalizeChain(String(t2.chainId)), address: normalizeAddress(t2.address), symbol: t2.symbol, name: t2.name }));
  if (Array.isArray(data.userTrustedTokens)) next.userTrustedTokens = data.userTrustedTokens.filter((t2) => t2 && t2.chainId && t2.address).map((t2) => ({ chainId: normalizeChain(String(t2.chainId)), address: normalizeAddress(t2.address) }));
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
var STORAGE_KEY, LAST_REFRESH_KEY, FETCH_TIMEOUT_MS4, TTL_CACHE_MS, MIGRATED_KEY;
var init_listManager = __esm({
  "src/services/listManager.ts"() {
    "use strict";
    init_utils();
    init_listSeeds();
    STORAGE_KEY = "sg_lists_cache_v1";
    LAST_REFRESH_KEY = "sg_lists_last_refresh";
    FETCH_TIMEOUT_MS4 = 6e3;
    TTL_CACHE_MS = 12 * 60 * 60 * 1e3;
    MIGRATED_KEY = "sg_lists_migrated_v1";
  }
});

// src/shared/types.ts
init_cryptoTrustedDomainsSeed();
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
  cloudIntelOptIn: false,
  telemetryOptIn: false,
  telemetryEnabled: false,
  showUsd: false,
  defaultExpandDetails: true,
  planTier: "FREE",
  licenseKey: "",
  trustedDomains: CRYPTO_TRUSTED_DOMAINS_SEED.slice(0, 24),
  supportedWalletsInfo: SUPPORTED_WALLETS,
  allowlist: CRYPTO_TRUSTED_DOMAINS_SEED.slice(0, 24),
  customBlockedDomains: [],
  customTrustedDomains: [],
  allowlistSpenders: [],
  denylistSpenders: [],
  failMode: "fail_open",
  enableIntel: true,
  vault: {
    enabled: false,
    lockedContracts: [],
    unlockedUntil: 0,
    blockApprovals: false
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
var SELECTOR_INCREASE_ALLOWANCE = "0x39509351";
var SELECTOR_DECREASE_ALLOWANCE = "0xa457c2d7";
var SELECTOR_SET_APPROVAL_FOR_ALL = "0xa22cb465";
var SELECTOR_TRANSFER = "0xa9059cbb";
var SELECTOR_TRANSFER_FROM = "0x23b872dd";
var SELECTOR_SAFE_TRANSFER_FROM_1 = "0x42842e0e";
var SELECTOR_SAFE_TRANSFER_FROM_2 = "0xb88d4fde";
var SELECTOR_ERC1155_SAFE_TRANSFER = "0xf242432a";
var SELECTOR_ERC1155_SAFE_BATCH_TRANSFER = "0x2eb2c2d6";
var SELECTOR_PERMIT = "0xd505accf";
var SELECTOR_PERMIT2_ALLOWANCE = "0x2b67b570";
var SELECTOR_PERMIT2_SIGNATURE_TRANSFER = "0x0d58b1db";
var PERMIT2_ADDRESS = "0x000000000022d473030f116ddee9f6b43ac78ba3";
var SEAPORT_ADDRESS = "0x00000000000000adc04c56bf30ac9d3c0aaf14dc";
var BLUR_MARKETPLACE = "0x000000000000ad05ccc4f10045630fb830b95127";
var KNOWN_MARKETPLACES = {
  [PERMIT2_ADDRESS.toLowerCase().replace(/^0x/, "").slice(-40)]: "PERMIT2",
  [SEAPORT_ADDRESS.toLowerCase().replace(/^0x/, "").slice(-40)]: "SEAPORT",
  [BLUR_MARKETPLACE.toLowerCase().replace(/^0x/, "").slice(-40)]: "BLUR"
};
var SELECTOR_MULTICALL = "0x5ae401dc";
var MAX_UINT256 = 2n ** 256n - 1n;
function getKnownMarketplace(addr) {
  if (!addr || typeof addr !== "string") return null;
  const a = addr.toLowerCase().replace(/^0x/, "").padStart(40, "0").slice(-40);
  return KNOWN_MARKETPLACES[a] ?? null;
}
function isPermit2Contract(addr) {
  if (!addr || typeof addr !== "string") return false;
  const a = addr.toLowerCase().replace(/^0x/, "").padStart(40, "0").slice(-40);
  const b = PERMIT2_ADDRESS.toLowerCase().replace(/^0x/, "").padStart(40, "0").slice(-40);
  return a === b;
}
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
var permit2Flag = (txTo) => isPermit2Contract(txTo || "") ? { permit2: true } : {};
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
    return { kind: "APPROVE_ERC20", token, spender, amountType, amountRaw: amount.toString(), ...permit2Flag(txTo) };
  }
  if (selector === SELECTOR_INCREASE_ALLOWANCE) {
    const spender = readAddress(body, 0);
    const addedValue = readUint256(body, 2);
    const amountType = addedValue === MAX_UINT256 ? "UNLIMITED" : "LIMITED";
    return { kind: "INCREASE_ALLOWANCE", token, spender, amountType, amountRaw: addedValue.toString(), ...permit2Flag(txTo) };
  }
  if (selector === SELECTOR_DECREASE_ALLOWANCE) {
    const spender = readAddress(body, 0);
    const subtractedValue = readUint256(body, 2);
    return { kind: "DECREASE_ALLOWANCE", token, spender, amountRaw: subtractedValue.toString(), ...permit2Flag(txTo) };
  }
  if (selector === SELECTOR_TRANSFER) {
    const to = readAddress(body, 0);
    const amount = readUint256(body, 2);
    return { kind: "TRANSFER_ERC20", token, to, amountRaw: amount.toString(), ...permit2Flag(txTo) };
  }
  if (selector === SELECTOR_TRANSFER_FROM) {
    const from = readAddress(body, 0);
    const to = readAddress(body, 1);
    const amount = readUint256(body, 2);
    return { kind: "TRANSFERFROM_ERC20", token, from, to, amountRaw: amount.toString(), ...permit2Flag(txTo) };
  }
  if (selector === SELECTOR_SET_APPROVAL_FOR_ALL) {
    const operator = readAddress(body, 0);
    const approved = readUint256(body, 2) !== 0n;
    return { kind: "SET_APPROVAL_FOR_ALL", token, operator, approved, ...permit2Flag(txTo) };
  }
  if (selector === SELECTOR_SAFE_TRANSFER_FROM_1 || selector === SELECTOR_SAFE_TRANSFER_FROM_2) {
    const from = readAddress(body, 0);
    const to = readAddress(body, 2);
    const tokenId = readUint256(body, 4);
    return { kind: "TRANSFER_NFT", token, to, tokenIdRaw: tokenId.toString(), standard: "ERC721", ...permit2Flag(txTo) };
  }
  if (selector === SELECTOR_ERC1155_SAFE_TRANSFER) {
    const from = readAddress(body, 0);
    const to = readAddress(body, 1);
    const id = readUint256(body, 2);
    const amount = readUint256(body, 3);
    return { kind: "TRANSFER_NFT", token, from, to, tokenIdRaw: id.toString(), amountRaw: amount.toString(), standard: "ERC1155", ...permit2Flag(txTo) };
  }
  if (selector === SELECTOR_ERC1155_SAFE_BATCH_TRANSFER) {
    const from = readAddress(body, 0);
    const to = readAddress(body, 1);
    return { kind: "TRANSFER_NFT", token, from, to, standard: "ERC1155", batch: true, ...permit2Flag(txTo) };
  }
  if (selector === SELECTOR_PERMIT) {
    const spender = readAddress(body, 1);
    const value = readUint256(body, 2);
    const deadline = readUint256(body, 3);
    const valueType = value === MAX_UINT256 ? "UNLIMITED" : "LIMITED";
    return { kind: "PERMIT_EIP2612", token, spender, valueType, valueRaw: value.toString(), deadlineRaw: deadline.toString(), ...permit2Flag(txTo) };
  }
  if (isPermit2Contract(txTo || "") && selector === SELECTOR_PERMIT2_ALLOWANCE) {
    if (body.length >= 9 * 64) {
      const tokenAddr = readAddress(body, 3);
      const amount = readUint256(body, 4);
      const spenderAddr = readAddress(body, 7);
      const sigDeadline = readUint256(body, 8);
      const amountType = amount === MAX_UINT256 || amount >= 2n ** 160n - 1n ? "UNLIMITED" : "LIMITED";
      return { kind: "PERMIT2_ALLOWANCE", token: tokenAddr, spender: spenderAddr, amountType, amountRaw: amount.toString(), deadlineRaw: sigDeadline.toString(), ...permit2Flag(txTo) };
    }
    return { kind: "PERMIT2_ALLOWANCE", token: "", spender: "", amountType: "LIMITED", amountRaw: "0", deadlineRaw: "0", ...permit2Flag(txTo) };
  }
  if (isPermit2Contract(txTo || "") && selector === SELECTOR_PERMIT2_SIGNATURE_TRANSFER) {
    if (body.length >= 8 * 64) {
      const tokenAddr = readAddress(body, 3);
      const amount = readUint256(body, 4);
      const toAddr = readAddress(body, 6);
      const amountType = amount === MAX_UINT256 ? "UNLIMITED" : "LIMITED";
      return { kind: "PERMIT2_TRANSFER", token: tokenAddr, to: toAddr, amountType, amountRaw: amount.toString(), ...permit2Flag(txTo) };
    }
    return { kind: "PERMIT2_TRANSFER", token: "", to: "", amountType: "LIMITED", amountRaw: "0", ...permit2Flag(txTo) };
  }
  const mh = getKnownMarketplace(txTo || "");
  const marketplaceHint = mh ? { marketplaceHint: mh } : {};
  if (selector === SELECTOR_MULTICALL) {
    return { kind: "MULTICALL", selector, ...marketplaceHint, ...permit2Flag(txTo) };
  }
  return { kind: "UNKNOWN", selector, ...marketplaceHint, ...permit2Flag(txTo) };
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
    overlay_analyzing: "Analisando Transa\xE7\xE3o...",
    overlay_simulating: "O SignGuard est\xE1 a simular o resultado.",
    overlay_safe: "Parece Seguro",
    overlay_attention: "Aten\xE7\xE3o Detectada",
    overlay_action: "A\xE7\xE3o",
    overlay_simulation_balance: "Simula\xE7\xE3o de Balan\xE7o",
    overlay_approvals_detected: "Aprova\xE7\xF5es detectadas",
    overlay_confirm_allow_msg: "Tem certeza? Isso ignora prote\xE7\xE3o.",
    overlay_confirm_allow: "Confirmar permitir 1 vez",
    overlay_try_again: "Tentar novamente",
    overlay_analysis_taking_long: "A an\xE1lise est\xE1 demorando.",
    overlay_fee_calculated: "Taxas calculadas.",
    overlay_finishing: "Finalizando an\xE1lise...",
    overlay_typed_data_card_title: "Assinatura (EIP-712)",
    overlay_typed_data_sign_warning: "Assinar isso pode permitir gasto futuro sem nova confirma\xE7\xE3o.",
    overlay_allowance_loading: "Allowance atual: \u2026",
    overlay_allowance_current: "Allowance atual: ",
    overlay_allowance_approved: "Aprovado",
    overlay_allowance_not_approved: "N\xE3o aprovado",
    overlay_allowance_unlimited: "Ilimitado",
    simulation_no_changes: "Nenhuma mudan\xE7a de saldo detetada.",
    tx_unknown: "Transa\xE7\xE3o Desconhecida",
    dapp_unknown: "DApp Desconhecido",
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
    btn_block: "Bloquear",
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
    cost_you_receive: "Voc\xEA recebe",
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
    vaultBlockedTitle: "Cofre bloqueou esta a\xE7\xE3o",
    vaultBlockedReason: "O contrato/ativo est\xE1 no Cofre. Desbloqueie temporariamente para prosseguir.",
    vault_unlock_5min: "Desbloquear 5 min",
    vault_unlock_30min: "Desbloquear 30 min",
    vault_unlocked_toast: "Desbloqueado por {n} min",
    overlay_temp_allow_10min: "Permitir por 10 min",
    overlay_temp_allow_toast: "Permitido por 10 min",
    page_risk_warning: "P\xE1gina com poss\xEDvel risco detectado.",
    reason_page_risk_high: "P\xE1gina com risco alto detectado (ex.: lookalike, clickjacking).",
    reason_page_risk_medium: "P\xE1gina com risco m\xE9dio (ex.: frases suspeitas, overlay).",
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
    reason_high_gas: "Taxa de gas alta em rela\xE7\xE3o ao valor.",
    reason_new_spender: "Novo spender \u2014 verifique.",
    reason_contract_target: "Destino \xE9 contrato.",
    reason_known_bad_spender: "Spender bloqueado.",
    reason_known_safe_spender: "Spender na allowlist.",
    reason_unlimited_approval: "Simula\xE7\xE3o: aprova\xE7\xE3o ilimitada detectada.",
    reason_set_approval_for_all: "Simula\xE7\xE3o: ApprovalForAll (permite mover todos os NFTs).",
    reason_snap_invoke: "Snaps podem executar c\xF3digo na carteira. Confirme a origem.",
    reason_sign_tx: "Assinatura de transa\xE7\xE3o sem envio imediato. Pode ser usada depois para broadcast.",
    reason_raw_broadcast: "Broadcast de transa\xE7\xE3o j\xE1 assinada. N\xE3o h\xE1 confirma\xE7\xE3o visual pr\xE9via do conte\xFAdo.",
    reason_read_permissions: "O site est\xE1 a ler as permiss\xF5es j\xE1 concedidas \xE0 carteira.",
    summary_title_snaps: "Snaps / Extens\xF5es da carteira",
    summary_title_read_permissions: "Leitura de permiss\xF5es",
    summary_title_sign_tx: "Assinatura de transa\xE7\xE3o",
    summary_title_raw_tx: "Broadcast de transa\xE7\xE3o assinada",
    summary_title_switch_chain: "Troca de rede",
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
    overlay_analyzing: "Analyzing Transaction...",
    overlay_simulating: "SignGuard is simulating the outcome.",
    overlay_safe: "Looks Safe",
    overlay_attention: "Attention Detected",
    overlay_action: "Action",
    overlay_simulation_balance: "Balance Simulation",
    overlay_approvals_detected: "Approvals detected",
    overlay_confirm_allow_msg: "Are you sure? This bypasses protection.",
    overlay_confirm_allow: "Confirm allow once",
    overlay_try_again: "Try again",
    overlay_analysis_taking_long: "Analysis is taking too long.",
    overlay_fee_calculated: "Fees calculated.",
    overlay_finishing: "Finishing analysis...",
    overlay_typed_data_card_title: "Signature (EIP-712)",
    overlay_typed_data_sign_warning: "Signing this may allow future spending without another confirmation.",
    overlay_allowance_loading: "Current allowance: \u2026",
    overlay_allowance_current: "Current allowance: ",
    overlay_allowance_approved: "Approved",
    overlay_allowance_not_approved: "Not approved",
    overlay_allowance_unlimited: "Unlimited",
    simulation_no_changes: "No balance changes detected.",
    tx_unknown: "Unknown Transaction",
    dapp_unknown: "Unknown DApp",
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
    btn_block: "Block",
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
    cost_you_receive: "You receive",
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
    vaultBlockedTitle: "Vault blocked this action",
    vaultBlockedReason: "The contract/asset is in the Vault. Unlock temporarily to proceed.",
    vault_unlock_5min: "Unlock 5 min",
    vault_unlock_30min: "Unlock 30 min",
    vault_unlocked_toast: "Unlocked for {n} min",
    overlay_temp_allow_10min: "Allow for 10 min",
    overlay_temp_allow_toast: "Allowed for 10 min",
    page_risk_warning: "Possible risk detected on this page.",
    reason_page_risk_high: "High-risk page detected (e.g. lookalike, clickjacking).",
    reason_page_risk_medium: "Medium-risk page (e.g. suspicious phrases, overlay).",
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
    reason_high_gas: "High gas fee relative to value.",
    reason_new_spender: "New spender \u2014 verify.",
    reason_contract_target: "Destination is a contract.",
    reason_known_bad_spender: "Spender blocked.",
    reason_known_safe_spender: "Spender on allowlist.",
    reason_unlimited_approval: "Simulation: unlimited approval detected.",
    reason_set_approval_for_all: "Simulation: ApprovalForAll (allows moving all NFTs).",
    reason_snap_invoke: "Snaps can run code in your wallet. Confirm the source.",
    reason_sign_tx: "Transaction signature without immediate send. May be used later for broadcast.",
    reason_raw_broadcast: "Broadcast of already-signed transaction. No prior visual confirmation of content.",
    reason_read_permissions: "The site is reading the permissions already granted to the wallet.",
    summary_title_snaps: "Snaps / Wallet extensions",
    summary_title_read_permissions: "Read permissions",
    summary_title_sign_tx: "Transaction signature",
    summary_title_raw_tx: "Signed transaction broadcast",
    summary_title_switch_chain: "Switch network",
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
  if (m === "eth_signtypeddata" || m === "eth_signtypeddata_v3" || m === "eth_signtypeddata_v4") {
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
  const isTyped = m === "eth_signtypeddata" || m === "eth_signtypeddata_v3" || m === "eth_signtypeddata_v4";
  if (m === "personal_sign" || m === "eth_sign" || isTyped) {
    const risks = [t("human_sign_risk_1"), t("human_sign_risk_2")];
    if (isTyped) risks.push(t("human_typed_risk_1"));
    return {
      whatItDoes: [t(isTyped ? "human_typed_whatIs" : "human_sign_whatIs"), t("explain_sign_why")].slice(0, 2),
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
init_cryptoTrustedDomainsSeed();
var SUGGESTED_TRUSTED_DOMAINS = CRYPTO_TRUSTED_DOMAINS_SEED.slice(0, 24);

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
function extractPermit2FromTypedData(raw) {
  try {
    if (!raw || raw.length > 2e5) return null;
    const j = JSON.parse(raw);
    const domainName = String(j?.domain?.name || "").toLowerCase();
    const primaryType = String(j?.primaryType || "").toLowerCase();
    const msg = j?.message || {};
    const isPermit2 = domainName.includes("permit2") || !!msg?.permitted && !!msg?.spender;
    if (!isPermit2) return null;
    const spender = typeof msg?.spender === "string" ? msg.spender.trim().toLowerCase() : "";
    if (!spender) return null;
    const tokens = [];
    const amounts = [];
    let unlimited = false;
    const MAX_UINT = "115792089237316195423570985008687907853269984665640564039457584007913129639935";
    if (msg?.permitted && Array.isArray(msg.permitted)) {
      for (const p of msg.permitted) {
        const tok = p?.token ?? p?.tokenAddress;
        if (typeof tok === "string") tokens.push(tok.toLowerCase());
        const amt = p?.amount ?? p?.amountMax ?? "0";
        amounts.push(String(amt));
        if (String(amt) === MAX_UINT || BigInt(amt) >= 2n ** 255n) unlimited = true;
      }
    } else if (msg?.token || msg?.tokenAddress) {
      tokens.push(String(msg.token || msg.tokenAddress).toLowerCase());
      const amt = msg?.amount ?? msg?.amountMax ?? "0";
      amounts.push(String(amt));
      if (String(amt) === MAX_UINT || BigInt(amt) >= 2n ** 255n) unlimited = true;
    }
    const expiration = msg?.expiration ?? msg?.nonce;
    const sigDeadline = msg?.sigDeadline ?? msg?.deadline;
    return { spender, tokens, amounts, expiration: expiration != null ? String(expiration) : void 0, sigDeadline: sigDeadline != null ? String(sigDeadline) : void 0, unlimited };
  } catch {
    return null;
  }
}
function extractSeaportFromTypedData(raw) {
  try {
    if (!raw || raw.length > 2e5) return null;
    const j = JSON.parse(raw);
    const domainName = String(j?.domain?.name || "").toLowerCase();
    const msg = j?.message || {};
    const isSeaport = domainName.includes("seaport") || !!msg?.offer && !!msg?.consideration;
    if (!isSeaport) return null;
    const primaryType = j?.primaryType ?? "OrderComponents";
    const offer = Array.isArray(msg?.offer) ? msg.offer : [];
    const consideration = Array.isArray(msg?.consideration) ? msg.consideration : [];
    const fmt = (arr) => {
      if (arr.length === 0) return "\u2014";
      if (arr.length === 1) {
        const x = arr[0];
        const amt = x?.startAmount ?? x?.amount ?? "?";
        return `${amt} item(s)`;
      }
      return `${arr.length} itens`;
    };
    return { offerSummary: fmt(offer), considerationSummary: fmt(consideration), primaryType };
  } catch {
    return null;
  }
}
function isBlurTypedData(raw) {
  try {
    if (!raw || raw.length > 5e4) return false;
    const j = JSON.parse(raw);
    const domainName = String(j?.domain?.name || "").toLowerCase();
    return domainName.includes("blur");
  } catch {
    return false;
  }
}
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

// src/background.ts
init_simulationService();

// src/services/honeypotService.ts
init_simulationService();
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

// src/shared/optionalOrigins.ts
var OPTIONAL_ORIGINS = {
  cloudIntel: [
    "https://raw.githubusercontent.com/*",
    "https://api.cryptoscamdb.org/*",
    "https://gitlab.com/*",
    "https://gateway.ipfs.io/*",
    "https://api.llama.fi/*"
  ],
  pricing: [
    "https://api.coingecko.com/*",
    "https://api.dexscreener.com/*"
  ],
  simulation: ["https://api.tenderly.co/*"],
  telemetry: ["https://cjnzidctntqzamhwmwkt.supabase.co/*"]
};
function getOriginsForFeature(feature) {
  const list = OPTIONAL_ORIGINS[feature];
  return list ? [...list] : [];
}
function getAllOptionalOrigins() {
  return normalizeOrigins(
    [].concat(
      ...Object.keys(OPTIONAL_ORIGINS).map((k) => OPTIONAL_ORIGINS[k])
    )
  );
}
function normalizeOrigins(origins) {
  return [...new Set(origins)].filter(Boolean).sort();
}

// src/permissions.ts
async function hasOrigins(origins) {
  if (!origins.length) return true;
  try {
    if (!chrome?.permissions?.contains) return false;
    return await chrome.permissions.contains({ origins });
  } catch {
    return false;
  }
}
async function requestOrigins(origins) {
  if (!origins.length) return true;
  try {
    if (!chrome?.permissions?.request) return false;
    return await chrome.permissions.request({ origins });
  } catch {
    return false;
  }
}
async function hasOptionalHostPermissions(feature) {
  const origins = getOriginsForFeature(feature);
  return hasOrigins(origins);
}
async function requestOptionalHostPermissionsOrigins(origins) {
  return requestOrigins(origins);
}
async function hasOptionalHostPermissionsAll() {
  return hasOrigins(getAllOptionalOrigins());
}

// src/services/netGate.ts
async function hasOriginsForFeature(feature) {
  return hasOptionalHostPermissions(feature);
}
async function canUseNetwork(feature, settings, opts) {
  const origins = OPTIONAL_ORIGINS[feature];
  if (!origins?.length) return { ok: false, reason: "no origins defined" };
  const granted = await hasOriginsForFeature(feature);
  if (!granted) return { ok: false, reason: "permissions not granted" };
  switch (feature) {
    case "cloudIntel":
      if (settings?.cloudIntelOptIn !== true) return { ok: false, reason: "Cloud Intel disabled" };
      return { ok: true };
    case "pricing":
      if (settings?.showUsd !== true) return { ok: false, reason: "USD/pricing disabled" };
      return { ok: true };
    case "simulation":
      if (settings?.simulation?.enabled !== true) return { ok: false, reason: "Simulation disabled" };
      return { ok: true };
    case "telemetry":
      if (opts?.termsAccepted !== true) return { ok: false, reason: "terms not accepted" };
      if (settings?.telemetryOptIn !== true) return { ok: false, reason: "telemetry disabled" };
      return { ok: true };
    default:
      return { ok: false, reason: "unknown feature" };
  }
}

// src/services/tokenSecurity.ts
var TOKEN_CACHE_KEY = "tokenCache";
var TOKEN_FIRST_SEEN_KEY = "sg_token_first_seen_v1";
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
async function getSettings() {
  return new Promise((resolve) => {
    try {
      chrome.storage.sync.get(DEFAULT_SETTINGS, (r) => resolve(r ?? DEFAULT_SETTINGS));
    } catch {
      resolve(DEFAULT_SETTINGS);
    }
  });
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
    const settings = await getSettings();
    const gate = await canUseNetwork("cloudIntel", settings);
    if (!gate.ok) {
      if (map && Object.keys(map).length > 0) inMemoryMap = map;
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
function tokenKey(chainIdHex, address) {
  const c = String(chainIdHex ?? "").trim().toLowerCase();
  const a = normalizeAddr2(address);
  if (!a) return "";
  const ch = c.startsWith("0x") ? c : "0x" + parseInt(c || "0", 10).toString(16);
  return ch + ":" + a;
}
async function getTokenFirstSeen(chainIdHex, address) {
  const key = tokenKey(chainIdHex, address);
  if (!key) return null;
  try {
    const raw = await new Promise((resolve) => {
      chrome.storage.local.get(TOKEN_FIRST_SEEN_KEY, (r) => resolve(r?.[TOKEN_FIRST_SEEN_KEY] ?? {}));
    });
    const ts = raw?.[key];
    return typeof ts === "number" ? ts : null;
  } catch {
    return null;
  }
}
async function markTokenSeen(chainIdHex, address) {
  const key = tokenKey(chainIdHex, address);
  if (!key) return;
  try {
    const raw = await new Promise((resolve) => {
      chrome.storage.local.get(TOKEN_FIRST_SEEN_KEY, (r) => resolve(r?.[TOKEN_FIRST_SEEN_KEY] ?? {}));
    });
    const map = { ...raw || {} };
    if (typeof map[key] !== "number") {
      map[key] = Date.now();
      await new Promise((resolve, reject) => {
        chrome.storage.local.set({ [TOKEN_FIRST_SEEN_KEY]: map }, () => chrome.runtime?.lastError ? reject(chrome.runtime.lastError) : resolve());
      });
    }
  } catch {
  }
}
function getTokenAddressForTx(txTo, decodedAction) {
  const to = (txTo ?? "").trim().toLowerCase();
  if (decodedAction && "token" in decodedAction && decodedAction.token) {
    return decodedAction.token.trim().toLowerCase();
  }
  if (to && to.startsWith("0x") && to.length === 42) return to;
  return void 0;
}

// src/services/tokenRisk.ts
init_listManager();
var SWAP_PATH_SELECTORS = /* @__PURE__ */ new Set([
  "0x38ed1739",
  "0x7ff36ab5",
  "0x18cbafe5",
  "0x04e45aaf",
  "0xb858183f",
  "0x5023b4df",
  "0x09b81346"
]);
function normalizeAddr3(a) {
  const s = String(a || "").trim().toLowerCase();
  return s.startsWith("0x") && s.length === 42 ? s : "";
}
function decodeSwapPath(data) {
  const addrs = [];
  if (!data || typeof data !== "string" || !data.startsWith("0x") || data.length < 10) return addrs;
  const body = data.slice(10).toLowerCase();
  if (body.length < 192) return addrs;
  const pathOffsetHex = body.slice(128, 192);
  const pathOffset = parseInt(pathOffsetHex, 16);
  if (!Number.isFinite(pathOffset) || pathOffset < 0 || pathOffset * 2 > body.length) return addrs;
  const pathStart = pathOffset * 2;
  if (body.length < pathStart + 64) return addrs;
  const lenHex = body.slice(pathStart, pathStart + 64);
  const len = parseInt(lenHex, 16);
  if (!Number.isFinite(len) || len <= 0 || len > 20) return addrs;
  for (let i = 0; i < len; i++) {
    const addrStart = pathStart + 64 + i * 64;
    const addrEnd = addrStart + 64;
    if (body.length < addrEnd) break;
    const word = body.slice(addrStart, addrEnd);
    const addr = "0x" + (word.length >= 40 ? word.slice(24) : word.padStart(40, "0"));
    const n = normalizeAddr3(addr);
    if (n && !addrs.includes(n)) addrs.push(n);
  }
  return addrs;
}
function extractTokenCandidates(txTo, data, decodedAction, _simulation) {
  const candidates = [];
  const to = (txTo ?? "").trim().toLowerCase();
  const dataStr = typeof data === "string" ? data : "";
  if (decodedAction) {
    if ("token" in decodedAction && decodedAction.token) {
      const t2 = normalizeAddr3(decodedAction.token);
      if (t2) candidates.push(t2);
    }
    if ("spender" in decodedAction && decodedAction.spender) {
      const s = normalizeAddr3(decodedAction.spender);
      if (s && !candidates.includes(s)) candidates.push(s);
    }
  }
  if (dataStr.length >= 10) {
    const sel = dataStr.slice(0, 10).toLowerCase();
    if (SWAP_PATH_SELECTORS.has(sel)) {
      const path = decodeSwapPath(dataStr);
      for (const p of path) {
        if (p && !candidates.includes(p)) candidates.push(p);
      }
    }
  }
  const fromTo = getTokenAddressForTx(txTo, decodedAction);
  if (fromTo && !candidates.includes(fromTo)) candidates.push(fromTo);
  if (to && to.startsWith("0x") && to.length === 42 && !candidates.includes(to)) {
    candidates.push(to);
  }
  return [...new Set(candidates)];
}
var NEW_TOKEN_DAYS_MS = 7 * 24 * 60 * 60 * 1e3;
async function getTokenRisk(address, chainIdHex, listCache) {
  const addr = normalizeAddr3(address);
  if (!addr) return { confidence: "LOW", signals: ["Endere\xE7o inv\xE1lido."] };
  const chainId = String(chainIdHex || "0x1").toLowerCase();
  const ch = chainId.startsWith("0x") ? chainId : "0x" + parseInt(chainId || "0", 10).toString(16);
  await markTokenSeen(ch, addr);
  const firstSeen = await getTokenFirstSeen(ch, addr);
  const tokenInfo = getTokenInfo(addr);
  const tokenScam = listCache ? isScamToken(ch, addr, listCache) : false;
  const tokenTrusted = listCache ? isTrustedToken(ch, addr, listCache) : false;
  const verified = tokenInfo?.v ?? false;
  const signals = [];
  let confidence = "MEDIUM";
  if (tokenScam) {
    return {
      confidence: "LOW",
      signals: ["Token em lista de scam/bloqueado."],
      symbol: tokenInfo?.s
    };
  }
  if (tokenTrusted || verified) {
    return {
      confidence: "HIGH",
      signals: ["Token em lista confi\xE1vel ou verificado."],
      symbol: tokenInfo?.s
    };
  }
  const isNew = !firstSeen || Date.now() - firstSeen < NEW_TOKEN_DAYS_MS;
  if (isNew) {
    signals.push("Token rec\xE9m-visto ou sem hist\xF3rico.");
    confidence = "LOW";
  } else {
    signals.push("Sem lista de reputa\xE7\xE3o conhecida.");
    confidence = "MEDIUM";
  }
  return {
    confidence,
    signals,
    isNew,
    symbol: tokenInfo?.s
  };
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
function normalizeAddr4(addr) {
  const s = (addr || "").trim().toLowerCase();
  return s.startsWith("0x") && s.length === 42 ? s : "";
}
async function getTokenUsd(chainIdHex, tokenAddress) {
  const addr = normalizeAddr4(tokenAddress);
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

// src/services/tokenMetaViaProvider.ts
var DECIMALS_SEL = "0x313ce567" + "0".repeat(56);
var SYMBOL_SEL = "0x95d89b41" + "0".repeat(56);
var NAME_SEL = "0x06fdde03" + "0".repeat(56);
var CALL_TIMEOUT_MS = 1200;
var TOTAL_TIMEOUT_MS = 2500;
function normalizeAddr5(addr) {
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
function withTimeout(p, ms) {
  return Promise.race([
    p,
    new Promise((_, rej) => setTimeout(() => rej(new Error("PROVIDER_CALL_FAILED")), ms))
  ]);
}
async function getTokenMetaViaProvider(opts) {
  const addr = normalizeAddr5(opts.token);
  if (!addr) return { ok: false, meta: { address: opts.token, chainIdHex: opts.chainIdHex }, reason: "INVALID_ADDRESS" };
  const callTimeout = opts.timeoutMs ?? CALL_TIMEOUT_MS;
  const totalTimeout = opts.totalTimeoutMs ?? TOTAL_TIMEOUT_MS;
  const rpc = opts.rpc;
  const start = Date.now();
  const mustFinishBy = start + totalTimeout;
  const ethCall = async (to, data) => {
    if (Date.now() >= mustFinishBy) throw new Error("PROVIDER_CALL_FAILED");
    const res = await withTimeout(
      rpc("eth_call", [{ to, data, gas: "0x7530" }, "latest"]),
      Math.min(callTimeout, mustFinishBy - Date.now())
    );
    if (!res?.ok || res.result == null) return null;
    return typeof res.result === "string" ? res.result : null;
  };
  try {
    const [decRes, symRes, nameRes] = await Promise.all([
      ethCall(addr, DECIMALS_SEL),
      ethCall(addr, SYMBOL_SEL),
      ethCall(addr, NAME_SEL)
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
    return { ok: true, symbol: symbol || void 0, decimals, name: name || void 0 };
  } catch {
    return { ok: false, meta: { address: addr, chainIdHex: opts.chainIdHex }, reason: "PROVIDER_CALL_FAILED" };
  }
}

// src/services/telemetryService.ts
var SUPABASE_URL = "https://cjnzidctntqzamhwmwkt.supabase.co";
var SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNqbnppZGN0bnRxemFtaHdtd2t0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5MzIzNzQsImV4cCI6MjA4NjUwODM3NH0.NyUvGRPY1psOwpJytWG_d3IXwCwPxLtuSG6V1uX13mc";
var INSTALL_ID_KEY = "installId";
var getSettingsFn = null;
function initTelemetry(getSettings3) {
  getSettingsFn = getSettings3;
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
  if (!getSettingsFn) return false;
  try {
    const s = await getSettingsFn();
    return s?.telemetryOptIn === true;
  } catch {
    return false;
  }
}
async function sendToSupabase(table, data) {
  try {
    if (typeof navigator !== "undefined" && !navigator.onLine) return;
    const origins = ["https://cjnzidctntqzamhwmwkt.supabase.co/*"];
    if (typeof chrome?.permissions?.contains === "function" && !await chrome.permissions.contains({ origins })) return;
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

// src/shared/reasonKeys.ts
var REASON_KEYS = {
  NEW_DOMAIN: "NEW_DOMAIN",
  KNOWN_BAD_DOMAIN: "KNOWN_BAD_DOMAIN",
  KNOWN_SAFE_DOMAIN: "KNOWN_SAFE_DOMAIN",
  UNLIMITED_APPROVAL: "UNLIMITED_APPROVAL",
  SET_APPROVAL_FOR_ALL: "SET_APPROVAL_FOR_ALL",
  PERMIT_GRANT: "PERMIT_GRANT",
  PERMIT2_GRANT: "PERMIT2_GRANT",
  HIGH_VALUE_TRANSFER: "HIGH_VALUE_TRANSFER",
  NEW_SPENDER: "NEW_SPENDER",
  FRESH_DEPLOY: "FRESH_DEPLOY",
  SIM_FAILED: "SIM_FAILED",
  TOKEN_LOW_CONFIDENCE: "TOKEN_LOW_CONFIDENCE",
  ADDRESS_BLOCKLIST: "ADDRESS_BLOCKLIST",
  KNOWN_BAD_SPENDER: "KNOWN_BAD_SPENDER",
  KNOWN_SAFE_SPENDER: "KNOWN_SAFE_SPENDER",
  TOKEN_SCAM: "TOKEN_SCAM",
  PHISHING: "PHISHING",
  PUNYCODE_DOMAIN: "PUNYCODE_DOMAIN",
  LOOKALIKE: "LOOKALIKE",
  NFT_PURCHASE: "NFT_PURCHASE",
  TOKEN_SWAP: "TOKEN_SWAP",
  MARKETPLACE_SIGNATURE: "MARKETPLACE_SIGNATURE",
  MARKETPLACE_LISTING: "MARKETPLACE_LISTING",
  HIGH_GAS: "HIGH_GAS",
  CONTRACT_TARGET: "CONTRACT_TARGET",
  VAULT_LOCKED: "VAULT_LOCKED",
  SPENDER_DENYLIST: "SPENDER_DENYLIST",
  SPENDER_ALLOWLIST: "SPENDER_ALLOWLIST",
  PAGE_RISK_HIGH: "PAGE_RISK_HIGH",
  PAGE_RISK_MEDIUM: "PAGE_RISK_MEDIUM",
  FAILMODE_FALLBACK: "FAILMODE_FALLBACK",
  SIMULATION_TIMEOUT: "SIMULATION_TIMEOUT",
  SNAP_INVOKE: "SNAP_INVOKE",
  REQUEST_SNAPS: "REQUEST_SNAPS",
  SIGN_TRANSACTION: "SIGN_TRANSACTION",
  RAW_TX_BROADCAST: "RAW_TX_BROADCAST",
  READ_PERMISSIONS: "READ_PERMISSIONS"
};

// src/shared/normalize.ts
function normalizeTypedDataParams(method, params) {
  const result = { rawShape: "unknown" };
  if (!params || !Array.isArray(params) || params.length === 0) return result;
  let address;
  let typedData;
  const p0 = params[0];
  const p1 = params[1];
  const p0IsAddr = typeof p0 === "string" && /^0x[a-fA-F0-9]{40}$/.test(p0);
  const p1IsAddr = typeof p1 === "string" && /^0x[a-fA-F0-9]{40}$/.test(p1);
  const p0IsTypedData = typeof p0 === "string" && (p0.startsWith("{") || p0.startsWith("[")) || typeof p0 === "object" && p0 !== null && (p0.domain || p0.types || p0.primaryType || p0.message);
  const p1IsTypedData = typeof p1 === "string" && (p1.startsWith("{") || p1.startsWith("[")) || typeof p1 === "object" && p1 !== null && (p1.domain || p1.types || p1.primaryType || p1.message);
  if (p0IsAddr && p1IsTypedData) {
    address = p0;
    typedData = p1;
  } else if (p0IsTypedData && p1IsAddr) {
    typedData = p0;
    address = p1;
  } else if (p0IsTypedData) {
    typedData = p0;
    address = p1IsAddr ? p1 : void 0;
  } else if (p1IsTypedData) {
    typedData = p1;
    address = p0IsAddr ? p0 : void 0;
  }
  if (typeof typedData === "string") {
    result.typedDataRaw = typedData;
    result.rawShape = "string";
    try {
      result.typedDataObj = JSON.parse(typedData);
    } catch {
      result.typedDataObj = void 0;
    }
  } else if (typedData && typeof typedData === "object") {
    result.typedDataObj = typedData;
    result.typedDataRaw = JSON.stringify(typedData);
    result.rawShape = "object";
  }
  if (address) result.address = address.trim().toLowerCase();
  return result;
}
var TYPED_DATA_METHODS = /* @__PURE__ */ new Set([
  "eth_signtypeddata",
  "eth_signtypeddata_v3",
  "eth_signtypeddata_v4"
]);
function isTypedDataMethod(method) {
  return TYPED_DATA_METHODS.has(String(method || "").toLowerCase());
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
      case "SG_HAS_OPTIONAL_PERMISSIONS": {
        const ok = await hasOptionalHostPermissionsAll();
        return { ok: true, granted: ok };
      }
      case "SG_REQUEST_OPTIONAL_PERMISSIONS": {
        const granted = await requestOptionalHostPermissionsOrigins(getAllOptionalOrigins());
        return { ok: true, granted };
      }
      case "GET_ETH_USD":
      case "SG_GET_PRICE": {
        const s = await getSettings2();
        if (!(await canUseNetwork("pricing", s)).ok) return { ok: false };
        const usdPerEth = await getEthUsdPriceCached();
        if (usdPerEth != null) return { ok: true, usdPerEth, ethUsd: usdPerEth, updatedAt: __ethUsdCache?.fetchedAt ?? Date.now() };
        return { ok: false };
      }
      case "SG_GET_NATIVE_USD": {
        const s = await getSettings2();
        if (!(await canUseNetwork("pricing", s)).ok) return { ok: false };
        const chainIdHex = msg.payload?.chainIdHex ?? "0x1";
        const result = await getNativeUsd(chainIdHex);
        if (result?.ok && result.usdPerNative != null) return { ok: true, usdPerNative: result.usdPerNative, nativeSymbol: result.nativeSymbol };
        return { ok: false };
      }
      case "SG_GET_TOKEN_USD": {
        const s = await getSettings2();
        if (!(await canUseNetwork("pricing", s)).ok) return { ok: false };
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
        const tabId = sender?.tab?.id;
        if (!tabId) return { ok: false, reason: "NO_TAB" };
        const addrNorm = normalizeAddr(tokenAddress) || String(tokenAddress).toLowerCase();
        const cacheKey = `${(chainIdHex || "").toLowerCase()}:${addrNorm}`;
        const cached = __tokenMetaCache.get(cacheKey);
        if (cached && Date.now() < cached.expiresAt)
          return { ok: true, symbol: cached.value.symbol, decimals: cached.value.decimals, name: cached.value.name };
        const result = await getTokenMetaViaProvider({
          tabId,
          chainIdHex,
          token: tokenAddress,
          rpc: (method, params) => rpcCallFull(tabId, method, params)
        });
        if (result.ok) {
          __tokenMetaCache.set(cacheKey, { expiresAt: Date.now() + TOKEN_META_CACHE_TTL_MS, value: result });
          evictTokenMetaCacheIfNeeded();
          return { ok: true, symbol: result.symbol, decimals: result.decimals, name: result.name };
        }
        return { ok: false, reason: result.reason ?? "PROVIDER_CALL_FAILED" };
      }
      case "SG_DIAG_PUSH": {
        const p = msg.payload ?? {};
        diagPush({ src: p.src ?? "content", kind: String(p.kind ?? ""), requestId: p.requestId, method: p.method, host: p.host, level: p.level, recommend: p.recommend, decision: p.decision, extra: typeof p.extra === "object" ? p.extra : void 0 });
        return { ok: true };
      }
      case "SG_DIAG_EXPORT": {
        const manifest = chrome.runtime.getManifest();
        const settings = await getSettings2();
        const settingsSnapshot = { riskWarnings: settings.riskWarnings, mode: settings.mode, failMode: settings.failMode, cloudIntelOptIn: settings.cloudIntelOptIn, telemetryOptIn: settings.telemetryOptIn, simulationEnabled: settings.simulation?.enabled };
        if (settings.simulation?.tenderlyAccount) settingsSnapshot.tenderlyAccount = "[REDACTED]";
        if (settings.simulation?.tenderlyProject) settingsSnapshot.tenderlyProject = "[REDACTED]";
        if (settings.simulation?.tenderlyKey) settingsSnapshot.tenderlyKey = "[REDACTED]";
        const DIAG_STR_MAX = 500;
        const truncate = (v) => {
          if (typeof v === "string") return v.length <= DIAG_STR_MAX ? v : v.slice(0, DIAG_STR_MAX) + "...TRUNCATED";
          if (Array.isArray(v)) return v.map(truncate);
          if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, truncate(x)]));
          return v;
        };
        const lastDiagEvents = __diag.slice(-DIAG_MAX).map((e) => truncate({ ...e, host: e.host ? e.host.slice(0, 50) : void 0 }));
        const out = { extensionVersion: manifest.version, exportedAt: (/* @__PURE__ */ new Date()).toISOString(), buildTime: manifest.buildTime, settingsSnapshot, lastDiagEvents };
        return { ok: true, export: out };
      }
      case "SG_LISTS_STATUS": {
        const lists = await getLists();
        return { ok: true, updatedAt: lists.updatedAt, counts: { trustedDomains: lists.trustedDomains.length, blockedDomains: lists.blockedDomains.length, blockedAddresses: lists.blockedAddresses.length, scamTokens: lists.scamTokens.length, userTrustedDomains: lists.userTrustedDomains.length, userBlockedDomains: lists.userBlockedDomains.length, userBlockedAddresses: lists.userBlockedAddresses.length, userScamTokens: lists.userScamTokens.length, userTrustedTokens: (lists.userTrustedTokens ?? []).length }, sources: lists.sources };
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
        const p = msg.payload ?? {};
        const typeRaw = p.type ?? p.overrideType;
        let overrideType;
        let payload;
        if (p.payload && typeof p.payload === "object") {
          overrideType = (typeRaw ?? p.payload.type ?? "").toString();
          payload = p.payload;
        } else {
          overrideType = (typeRaw ?? "").toString();
          payload = p;
        }
        const norm = normalizeOverridePayload(overrideType, payload);
        if (!norm) return { ok: false, error: "invalid_payload" };
        try {
          await upsertUserOverride(norm.type, norm.payload);
          const lists = await getLists();
          return { ok: true, updatedAt: lists.updatedAt };
        } catch (e) {
          return { ok: false, error: String(e?.message ?? e) };
        }
      }
      case "SG_LISTS_OVERRIDE_REMOVE": {
        const p = msg.payload ?? {};
        const typeRaw = p.type ?? p.overrideType;
        let overrideType;
        let payload;
        if (p.payload && typeof p.payload === "object") {
          overrideType = (typeRaw ?? p.payload.type ?? "").toString();
          payload = p.payload;
        } else {
          overrideType = (typeRaw ?? "").toString();
          payload = p;
        }
        const norm = normalizeOverridePayload(overrideType, payload);
        if (!norm) return { ok: false, error: "invalid_payload" };
        const val = (norm.payload.value ?? norm.payload.address ?? "").toString();
        const chainId = (norm.payload.chainId ?? "").toString();
        const addr = (norm.payload.address ?? norm.payload.tokenAddress ?? "").toString();
        try {
          await deleteUserOverride(norm.type, val, norm.type === "scam_token" || norm.type === "trusted_token" ? chainId : void 0, norm.type === "scam_token" || norm.type === "trusted_token" ? addr : void 0);
          const lists = await getLists();
          return { ok: true, updatedAt: lists.updatedAt };
        } catch (e) {
          return { ok: false, error: String(e?.message ?? e) };
        }
      }
      case "SG_LISTS_EXPORT": {
        const snapshot = await exportSnapshot();
        return { ok: true, ...snapshot };
      }
      case "SG_LISTS_OVERRIDE_SET": {
        const kind = msg.payload?.kind;
        const values = msg.payload?.values;
        const validKinds = ["trustedDomains", "blockedDomains", "blockedAddresses", "scamTokens"];
        if (!validKinds.includes(kind) || !Array.isArray(values)) return { ok: false, error: "invalid_payload" };
        try {
          const result = await setOverrides(kind, values);
          return { ok: true, updatedAt: result.cache.updatedAt, invalidCount: result.invalidCount, invalidExamples: result.invalidExamples };
        } catch (e) {
          return { ok: false, error: String(e?.message ?? e) };
        }
      }
      case "SG_LISTS_REFRESH":
      case "SG_LISTS_REFRESH_NOW": {
        try {
          const s = await getSettings2();
          const gate = await canUseNetwork("cloudIntel", s);
          if (!gate.ok) {
            const lists2 = await getLists();
            return { ok: true, updatedAt: lists2.updatedAt, counts: { trustedDomains: lists2.trustedDomains.length, blockedDomains: lists2.blockedDomains.length, blockedAddresses: lists2.blockedAddresses.length, scamTokens: lists2.scamTokens.length, userTrustedDomains: lists2.userTrustedDomains.length, userBlockedDomains: lists2.userBlockedDomains.length, userBlockedAddresses: lists2.userBlockedAddresses.length, userScamTokens: lists2.userScamTokens.length, userTrustedTokens: (lists2.userTrustedTokens ?? []).length }, sources: lists2.sources, skipped: "cloud_intel_off_or_no_permissions" };
          }
          const lists = await refresh(true);
          return { ok: true, updatedAt: lists.updatedAt, counts: { trustedDomains: lists.trustedDomains.length, blockedDomains: lists.blockedDomains.length, blockedAddresses: lists.blockedAddresses.length, scamTokens: lists.scamTokens.length, userTrustedDomains: lists.userTrustedDomains.length, userBlockedDomains: lists.userBlockedDomains.length, userBlockedAddresses: lists.userBlockedAddresses.length, userScamTokens: lists.userScamTokens.length, userTrustedTokens: (lists.userTrustedTokens ?? []).length }, sources: lists.sources };
        } catch (e) {
          return { ok: false, error: String(e?.message ?? e) };
        }
      }
      case "SG_LISTS_IMPORT": {
        const raw = msg.payload?.data;
        if (!raw || typeof raw !== "object") return { ok: false, error: "invalid_data" };
        try {
          const { importUserOverrides: importUserOverrides2 } = await Promise.resolve().then(() => (init_listManager(), listManager_exports));
          const data = raw.overrides && typeof raw.overrides === "object" ? { userTrustedDomains: raw.overrides.trustedDomains, userBlockedDomains: raw.overrides.blockedDomains, userBlockedAddresses: raw.overrides.blockedAddresses, userScamTokens: raw.overrides.scamTokens } : raw;
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
        const s = await getSettings2();
        if (!(await canUseNetwork("cloudIntel", s)).ok) {
          const { intel } = await loadAddressIntelCachedFast();
          return { ok: true, updatedAt: intel.updatedAt, labeledCount: Object.keys(intel.labelsByAddress || {}).length, sources: intel.sources || [], skipped: "cloud_intel_off_or_no_permissions" };
        }
        const fresh = await refreshAddressIntel();
        await saveAddressIntel(fresh);
        const labeledCount = Object.keys(fresh.labelsByAddress || {}).length;
        return { ok: true, updatedAt: fresh.updatedAt, labeledCount, sources: fresh.sources || [] };
      }
      case "SG_UPDATE_SPENDERS": {
        const { addToAllow, addToDeny, removeFromAllow, removeFromDeny } = msg.payload ?? {};
        const settings = await getSettings2();
        let allow = [...settings.allowlistSpenders ?? []];
        let deny = [...settings.denylistSpenders ?? []];
        const norm = (a) => {
          const h = String(a).replace(/^0x/i, "").toLowerCase();
          if (h.length !== 40 || !/^[a-f0-9]{40}$/.test(h)) return "";
          return "0x" + h;
        };
        if (addToAllow && typeof addToAllow === "string" && /^0x[a-fA-F0-9]{40}$/.test(addToAllow)) {
          allow = [.../* @__PURE__ */ new Set([...allow, norm(addToAllow)])];
          deny = deny.filter((x) => x !== norm(addToAllow));
        }
        if (addToDeny && typeof addToDeny === "string" && /^0x[a-fA-F0-9]{40}$/.test(addToDeny)) {
          deny = [.../* @__PURE__ */ new Set([...deny, norm(addToDeny)])];
          allow = allow.filter((x) => x !== norm(addToDeny));
        }
        if (removeFromAllow && typeof removeFromAllow === "string") {
          allow = allow.filter((x) => x !== norm(removeFromAllow));
        }
        if (removeFromDeny && typeof removeFromDeny === "string") {
          deny = deny.filter((x) => x !== norm(removeFromDeny));
        }
        await new Promise((resolve, reject) => {
          chrome.storage.sync.set(
            { allowlistSpenders: allow, denylistSpenders: deny },
            () => chrome.runtime?.lastError ? reject(chrome.runtime.lastError) : resolve()
          );
        });
        return { ok: true };
      }
      case "SG_ADD_TEMP_ALLOW": {
        const { host, spender, ttlMs } = msg.payload ?? {};
        const ms = typeof ttlMs === "number" && ttlMs > 0 ? ttlMs : 10 * 60 * 1e3;
        await addTempAllow(host ?? "", spender ?? null, ms);
        return { ok: true };
      }
      case "SG_CHECK_TEMP_ALLOW": {
        const { host, spender } = msg.payload ?? {};
        const allowed = await isTempAllowed(host ?? "", spender ?? null);
        return { ok: true, allowed };
      }
      case "VAULT_UNLOCK": {
        const { chainIdHex, contract, ttlMs } = msg.payload ?? {};
        const c = normAddr40(contract);
        if (!c) return { ok: false, error: "invalid_contract" };
        const ms = Math.min(30 * 60 * 1e3, Math.max(60 * 1e3, Number(ttlMs) || 5 * 60 * 1e3));
        await setVaultOverride(chainIdHex ?? "0x0", c, ms);
        return { ok: true, ttlMs: ms };
      }
      case "SG_VAULT_UNLOCK": {
        const durationMs = Math.min(6e5, Math.max(6e4, msg.payload?.durationMs ?? 5 * 60 * 1e3));
        const settings = await getSettings2();
        const vault = settings.vault ?? { enabled: false, lockedContracts: [], unlockedUntil: 0 };
        const next = { ...settings, vault: { ...vault, unlockedUntil: Date.now() + durationMs } };
        await new Promise((resolve, reject) => {
          chrome.storage.sync.set(
            next,
            () => chrome.runtime?.lastError ? reject(chrome.runtime.lastError) : resolve()
          );
        });
        return { ok: true, unlockedUntil: next.vault.unlockedUntil };
      }
      case "SG_TEST_SIMULATION": {
        const settings = await getSettings2();
        const { simulateTransaction: simulateTransaction2 } = await Promise.resolve().then(() => (init_simulationService(), simulationService_exports));
        const body = {
          network_id: "1",
          from: "0x0000000000000000000000000000000000000001",
          to: "0x0000000000000000000000000000000000000002",
          input: "0x",
          value: "0"
        };
        const res = await simulateTransaction2(body, settings);
        return { ok: res != null, error: res == null ? "Conex\xE3o falhou ou credenciais inv\xE1lidas" : void 0 };
      }
      case "ANALYZE": {
        const settings = await getSettings2();
        const req = msg.payload;
        diagPush({ src: "background", kind: "ANALYZE_START", requestId: req?.requestId, method: req?.request?.method, host: req?.url ? hostFromUrl(req.url) : void 0 });
        const intel = await getIntelCachedFast();
        const isStale = intel.updatedAt === 0 || Date.now() - intel.updatedAt >= INTEL_TTL_MS;
        if (isStale) ensureIntelRefreshSoon("analyze_path");
        const { intel: addrIntel, isMissing: addrMissing, isStale: addrStale } = await loadAddressIntelCachedFast();
        if (addrMissing || addrStale) ensureAddressIntelRefreshSoon("analyze_path");
        const tabId = sender?.tab?.id;
        const analysis = await analyze(req, settings, intel, tabId, addrIntel);
        analysis.method = req.request?.method;
        const summaryV1 = buildTxSummaryV1(req, analysis, settings);
        analysis.summary = summaryV1;
        analysis.summaryV1 = summaryV1;
        if (req.wallet) analysis.wallet = req.wallet;
        if (req.txCostPreview) {
          analysis.txCostPreview = { ...req.txCostPreview };
          const tx = analysis.tx;
          if (tx && !analysis.txCostPreview.feeMaxWei && tx.feeMaxWei) {
            analysis.txCostPreview.feeMaxWei = tx.feeMaxWei;
            analysis.txCostPreview.totalMaxWei = tx.totalMaxWei;
            analysis.txCostPreview.feeEstimated = true;
          }
        }
        const feeEst = req.feeEstimate;
        if (feeEst?.ok && feeEst.feeEstimated && (feeEst.feeLikelyWeiHex || feeEst.feeMaxWeiHex)) {
          const preview = analysis.txCostPreview || { valueWei: "0", feeEstimated: false };
          const valueWei = BigInt(preview.valueWei || analysis.tx?.valueWei || "0");
          const feeLikelyWei = feeEst.feeLikelyWeiHex ? BigInt(feeEst.feeLikelyWeiHex) : 0n;
          const feeMaxWei = feeEst.feeMaxWeiHex ? BigInt(feeEst.feeMaxWeiHex) : feeLikelyWei;
          analysis.txCostPreview = {
            ...preview,
            valueWei: valueWei.toString(),
            gasLimitWei: feeEst.gasLimitHex ? BigInt(feeEst.gasLimitHex).toString() : preview.gasLimitWei,
            feeLikelyWei: feeLikelyWei.toString(),
            feeMaxWei: feeMaxWei.toString(),
            totalLikelyWei: (valueWei + feeLikelyWei).toString(),
            totalMaxWei: (valueWei + feeMaxWei).toString(),
            feeEstimated: true
          };
        }
        const chainIdHex = req.txCostPreview?.chainIdHex ?? req.meta?.preflight?.chainIdHex ?? req.meta?.chainIdHex;
        if (chainIdHex) analysis.chainIdHex = chainIdHex;
        if (settings.simulation?.enabled === true) {
          await enrichWithSimulation(req, analysis, settings);
        }
        applySpenderPolicy(analysis, settings);
        if (analysis.safeDomain) {
          (analysis.reasonKeys ??= []).push(REASON_KEYS.KNOWN_SAFE_DOMAIN);
        }
        const da = analysis.decodedAction;
        if (da?.kind === "PERMIT_EIP2612") (analysis.reasonKeys ??= []).push(REASON_KEYS.PERMIT_GRANT);
        if (da?.permit2 || da?.kind === "PERMIT2_ALLOWANCE" || da?.kind === "PERMIT2_TRANSFER") {
          (analysis.reasonKeys ??= []).push(REASON_KEYS.PERMIT2_GRANT);
        }
        applyDrainerHeuristics(analysis);
        applyPolicy(analysis, settings);
        applyPageRiskOverride(req, analysis);
        await applyVaultOverride(analysis, settings, req);
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
        diagPush({ src: "background", kind: "ANALYZE_DONE", requestId: req?.requestId, method: req?.request?.method, host: req?.url ? hostFromUrl(req.url) : void 0, level: analysis.level, recommend: analysis.recommend, extra: { flags: analysis.summary?.flags?.slice(0, 10) } });
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
var DECISION_LOG_KEY = "sg_decision_log_v1";
var VAULT_OVERRIDES_KEY = "sg_vault_overrides_v1";
var TEMP_ALLOW_KEY = "sg_temp_allow_v1";
var DIAG_MAX = 200;
var __diag = [];
function diagPush(e) {
  const entry = { ts: e.ts ?? Date.now(), src: e.src ?? "background", kind: e.kind, requestId: e.requestId, method: e.method, host: e.host, level: e.level, recommend: e.recommend, decision: e.decision, extra: e.extra };
  __diag.push(entry);
  if (__diag.length > DIAG_MAX) __diag.splice(0, __diag.length - DIAG_MAX);
}
async function getVaultOverrides() {
  try {
    const r = await new Promise((resolve) => {
      chrome.storage.local.get(VAULT_OVERRIDES_KEY, (x) => resolve(x ?? {}));
    });
    const raw = r[VAULT_OVERRIDES_KEY];
    if (!raw || typeof raw !== "object") return {};
    return cleanupExpiredOverrides(raw);
  } catch {
    return {};
  }
}
function cleanupExpiredOverrides(overrides) {
  const now = Date.now();
  const out = {};
  for (const [k, v] of Object.entries(overrides)) {
    if (typeof v === "number" && v > now) out[k] = v;
  }
  return out;
}
async function setVaultOverride(chainIdHex, contract, ttlMs) {
  const c = normAddr40(contract);
  if (!c) return;
  const key = `${(chainIdHex || "0x0").toLowerCase()}:${c}`;
  const overrides = await getVaultOverrides();
  overrides[key] = Date.now() + ttlMs;
  await new Promise((resolve) => {
    chrome.storage.local.set({ [VAULT_OVERRIDES_KEY]: overrides }, () => resolve());
  });
}
function isVaultOverrideActive(overrides, chainIdHex, contract) {
  const c = normAddr40(contract);
  if (!c) return false;
  const key = `${(chainIdHex || "0x0").toLowerCase()}:${c}`;
  const until = overrides[key];
  return typeof until === "number" && until > Date.now();
}
var HISTORY_MAX = 200;
var PLAN_KEY = "sg_plan_v1";
function pushHistoryEvent(evt) {
  try {
    const payload = { [HISTORY_KEY]: true, [DECISION_LOG_KEY]: true };
    chrome.storage.local.get(payload, (r) => {
      const err = chrome.runtime.lastError;
      if (err) return;
      const arr = Array.isArray(r?.[HISTORY_KEY]) ? r[HISTORY_KEY] : [];
      arr.push(evt);
      const trimmed = arr.slice(-HISTORY_MAX);
      chrome.storage.local.set({ [HISTORY_KEY]: trimmed, [DECISION_LOG_KEY]: trimmed }, () => void 0);
    });
  } catch {
  }
}
async function addTempAllow(host, spender, ttlMs) {
  const now = Date.now();
  const expiresAt = now + ttlMs;
  const got = await new Promise((resolve) => {
    chrome.storage.local.get(TEMP_ALLOW_KEY, (r) => resolve(r ?? {}));
  });
  const map = got[TEMP_ALLOW_KEY] ?? {};
  if (host) map[`domain:${host.toLowerCase()}`] = { expiresAt };
  if (spender && /^0x[a-fA-F0-9]{40}$/.test(spender)) map[`spender:${spender.toLowerCase()}`] = { expiresAt };
  await new Promise((res) => chrome.storage.local.set({ [TEMP_ALLOW_KEY]: map }, () => res()));
}
async function isTempAllowed(host, spender) {
  const now = Date.now();
  const got = await new Promise((resolve) => {
    chrome.storage.local.get(TEMP_ALLOW_KEY, (r) => resolve(r ?? {}));
  });
  const map = got[TEMP_ALLOW_KEY] ?? {};
  const entries = Object.entries(map).filter(([, v]) => v.expiresAt > now);
  const fresh = {};
  for (const [k, v] of entries) fresh[k] = v;
  if (entries.length < Object.keys(map).length) {
    chrome.storage.local.set({ [TEMP_ALLOW_KEY]: fresh }, () => void 0);
  }
  if (host && fresh[`domain:${host.toLowerCase()}`]) return true;
  if (spender && fresh[`spender:${spender.toLowerCase()}`]) return true;
  return false;
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
  const gate = await canUseNetwork("cloudIntel", await getSettings2());
  if (!gate.ok) {
    if (cached) return cached;
    return getMinimalSeedIntel();
  }
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
  const settings = await getSettings2();
  const gate = await canUseNetwork("cloudIntel", settings);
  if (!gate.ok) return getIntelCachedFast();
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
      const s = await getSettings2();
      if (!(await canUseNetwork("cloudIntel", s)).ok) return;
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
  getSettings2().then(async (s) => {
    if ((await canUseNetwork("cloudIntel", s)).ok) refresh().catch(() => {
    });
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
      const s = await getSettings2();
      if ((await canUseNetwork("cloudIntel", s)).ok) await refresh();
    } catch {
    }
  }
});
function tabsSendMessageSafe(tabId, message) {
  return new Promise((resolve) => {
    try {
      if (!chrome?.tabs?.sendMessage) return resolve(null);
      chrome.tabs.sendMessage(tabId, message, (resp) => {
        const err = chrome.runtime?.lastError;
        if (err) return resolve(null);
        resolve(resp ?? null);
      });
    } catch {
      resolve(null);
    }
  });
}
var RPC_ALLOWED = /* @__PURE__ */ new Set(["eth_call", "eth_chainid", "eth_getcode", "eth_getblockbynumber", "eth_getlogs", "eth_estimategas"]);
async function rpcCall(tabId, method, params) {
  if (!tabId || typeof chrome.tabs.sendMessage !== "function") return null;
  const m = String(method).toLowerCase();
  if (!RPC_ALLOWED.has(m)) return null;
  try {
    const resp = await tabsSendMessageSafe(tabId, { type: "SG_RPC_CALL_REQUEST", method: m, params: params ?? [] });
    return resp?.ok ? resp.result : null;
  } catch {
    return null;
  }
}
async function rpcCallFull(tabId, method, params) {
  if (!tabId || typeof chrome.tabs.sendMessage !== "function") return null;
  const m = String(method).toLowerCase();
  if (!RPC_ALLOWED.has(m)) return null;
  try {
    const resp = await tabsSendMessageSafe(tabId, { type: "SG_RPC_CALL_REQUEST", method: m, params: params ?? [] });
    if (resp && typeof resp === "object") return { ok: !!resp.ok, result: resp.result, error: resp.error };
    return null;
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
var TOKEN_META_CACHE_TTL_MS = 5 * 60 * 1e3;
var TOKEN_META_CACHE_MAX = 500;
var __tokenMetaCache = /* @__PURE__ */ new Map();
function evictTokenMetaCacheIfNeeded() {
  if (__tokenMetaCache.size <= TOKEN_META_CACHE_MAX) return;
  const now = Date.now();
  for (const [k, v] of __tokenMetaCache) {
    if (now >= v.expiresAt) __tokenMetaCache.delete(k);
  }
  if (__tokenMetaCache.size > TOKEN_META_CACHE_MAX) {
    const keysToDelete = [...__tokenMetaCache.keys()].slice(0, __tokenMetaCache.size - TOKEN_META_CACHE_MAX);
    keysToDelete.forEach((k) => __tokenMetaCache.delete(k));
  }
}
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
  const gate = await canUseNetwork("pricing", await getSettings2());
  if (!gate.ok) {
    return __ethUsdCache?.usdPerEth ?? null;
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
async function getSettings2() {
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
  initTelemetry(getSettings2);
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
    if (durationSec > 0) await telemetry.trackSession({ domain: s.domain, referrer: s.referrer, durationSec });
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
            getSettings2().then((settings) => {
              chrome.storage.local.get(["termsAccepted", "sg_user_interest_tags"], (r) => {
                const terms = r?.termsAccepted === true;
                if (!terms || !settings?.telemetryOptIn) return;
                const arr = Array.isArray(r?.sg_user_interest_tags) ? r.sg_user_interest_tags : [];
                if (!arr.includes(category)) {
                  arr.push(category);
                  chrome.storage.local.set({ sg_user_interest_tags: arr });
                }
              });
            }).catch(() => {
            });
          }
          endSessionAndTrack(tabId).then(() => {
            tabSessions.set(tabId, { startTime: Date.now(), domain: host, referrer: "" });
          });
        }
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
function normAddr40(addr) {
  if (!addr || typeof addr !== "string" || !addr.startsWith("0x")) return null;
  const hex = addr.replace(/^0x/, "").toLowerCase();
  if (hex.length !== 40 || !/^[a-f0-9]{40}$/.test(hex)) return null;
  return "0x" + hex;
}
async function getVaultBlock(settings, req, analysis) {
  const vault = settings.vault;
  if (!vault?.enabled || !Array.isArray(vault.lockedContracts) || vault.lockedContracts.length === 0)
    return { blocked: false };
  const locked = vault.lockedContracts.map((a) => normAddr40(a)).filter((x) => !!x);
  if (locked.length === 0) return { blocked: false };
  const chainIdHex = req.meta?.chainIdHex ?? req.txCostPreview?.chainIdHex ?? "0x0";
  const overrides = await getVaultOverrides();
  const method = String(req?.request?.method ?? "").toLowerCase();
  const params = req?.request?.params;
  if (method === "eth_sendtransaction" || method === "wallet_sendtransaction") {
    const tx = Array.isArray(params) && params[0] && typeof params[0] === "object" ? params[0] : null;
    if (tx) {
      const to = normAddr40(tx.to);
      if (to && locked.includes(to)) {
        if (isVaultOverrideActive(overrides, chainIdHex, to)) return { blocked: false };
        const globalUntil = vault.unlockedUntil ?? 0;
        if (globalUntil > 0 && Date.now() < globalUntil) return { blocked: false };
        return { blocked: true, lockedTo: to, chainIdHex };
      }
    }
  }
  const blockApprovals = vault.blockApprovals === true;
  const candidates = extractSpenderCandidates(analysis);
  for (const c of candidates) {
    if (locked.includes(c)) {
      if (!blockApprovals) continue;
      if (isVaultOverrideActive(overrides, chainIdHex, c)) continue;
      const globalUntil = vault.unlockedUntil ?? 0;
      if (globalUntil > 0 && Date.now() < globalUntil) continue;
      return { blocked: true, lockedTo: c, chainIdHex };
    }
  }
  return { blocked: false };
}
function applyPageRiskOverride(req, analysis) {
  const pageRisk = req.meta?.pageRisk;
  if (!pageRisk) return;
  if (pageRisk.score === "HIGH") {
    analysis.score = Math.max(analysis.score, 85);
    if (analysis.level !== "HIGH") analysis.level = "WARN";
    if (analysis.recommend !== "BLOCK") analysis.recommend = "HIGH";
    analysis.reasons.unshift(t("reason_page_risk_high") || REASON_KEYS.PAGE_RISK_HIGH + ": P\xE1gina com risco alto detectado.");
    (analysis.reasonKeys ??= []).unshift(REASON_KEYS.PAGE_RISK_HIGH);
  } else if (pageRisk.score === "MEDIUM") {
    analysis.score = Math.max(analysis.score, 50);
    if (analysis.level === "LOW") analysis.level = "WARN";
    analysis.reasons.push(t("reason_page_risk_medium") || REASON_KEYS.PAGE_RISK_MEDIUM + ": P\xE1gina com risco m\xE9dio.");
    (analysis.reasonKeys ??= []).push(REASON_KEYS.PAGE_RISK_MEDIUM);
  }
}
async function applyVaultOverride(analysis, settings, req) {
  const block = await getVaultBlock(settings, req, analysis);
  if (!block.blocked) return;
  analysis.recommend = "BLOCK";
  analysis.level = "HIGH";
  analysis.score = Math.max(analysis.score, 95);
  analysis.title = t("vaultBlockedTitle");
  analysis.reasons.unshift(t("vaultBlockedReason"));
  (analysis.reasonKeys ??= []).unshift(REASON_KEYS.VAULT_LOCKED);
  analysis.vaultBlocked = true;
  if (block.lockedTo) analysis.vaultLockedTo = block.lockedTo;
  if (block.chainIdHex) analysis.vaultChainIdHex = block.chainIdHex;
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
  const maxPriorityFeePerGas = hexToBigInt(tx.maxPriorityFeePerGas || "0x0");
  const gasPrice = hexToBigInt(tx.gasPrice || "0x0");
  const dataLen = typeof tx.data === "string" ? tx.data.length : 0;
  const hasGas = gasLimit > 0n;
  const hasFeePerGas = maxFeePerGas > 0n || gasPrice > 0n;
  const feeKnown = !!(hasGas && hasFeePerGas);
  const feePerGas = maxFeePerGas > 0n ? maxFeePerGas : gasPrice;
  let maxGasFeeEth = "";
  let maxTotalEth = "";
  let feeMaxWeiStr = "";
  let totalMaxWeiStr = "";
  if (feeKnown && gasLimit > 0n && feePerGas > 0n) {
    const gasFeeWei = gasLimit * feePerGas;
    maxGasFeeEth = weiToEth(gasFeeWei);
    maxTotalEth = weiToEth(valueWei + gasFeeWei);
    feeMaxWeiStr = gasFeeWei.toString();
    totalMaxWeiStr = (valueWei + gasFeeWei).toString();
  }
  const selector = data && data.startsWith("0x") && data.length >= 10 ? data.slice(0, 10) : "";
  const contractNameHint = to && data && data !== "0x" && data.toLowerCase() !== "0x" ? shortAddr(to) : void 0;
  return {
    to,
    valueWei: valueWei.toString(),
    valueEth,
    gasLimitWei: gasLimit > 0n ? gasLimit.toString() : void 0,
    gasLimit: gasLimit > 0n ? gasLimit.toString() : void 0,
    maxFeePerGasWei: maxFeePerGas > 0n ? maxFeePerGas.toString() : void 0,
    maxPriorityFeePerGasWei: maxPriorityFeePerGas > 0n ? maxPriorityFeePerGas.toString() : void 0,
    gasPriceWei: gasPrice > 0n ? gasPrice.toString() : void 0,
    dataLen: dataLen > 0 ? dataLen : void 0,
    feeMaxWei: feeMaxWeiStr || void 0,
    totalMaxWei: totalMaxWeiStr || void 0,
    maxGasFeeEth,
    maxTotalEth,
    selector,
    feeKnown,
    contractNameHint
  };
}
function isProtectionPaused(settings) {
  const until = settings.pausedUntil;
  return typeof until === "number" && Number.isFinite(until) && Date.now() < until;
}
function extractSpenderCandidates(analysis) {
  const out = [];
  const add = (a) => {
    if (a && typeof a === "string" && a.startsWith("0x") && a.length === 42) {
      out.push(a.toLowerCase());
    }
  };
  const da = analysis.decodedAction;
  if (da) {
    if ("spender" in da) add(da.spender);
    if ("operator" in da) add(da.operator);
    if ("to" in da) add(da.to);
  }
  if (analysis.txExtras) {
    const te = analysis.txExtras;
    add(te.spender);
    add(te.operator);
  }
  if (analysis.typedDataExtras?.spender) add(analysis.typedDataExtras.spender);
  if (analysis.tx?.to) add(analysis.tx.to);
  return [...new Set(out)];
}
function applySpenderPolicy(analysis, settings) {
  const deny = (settings.denylistSpenders ?? []).map((a) => String(a).toLowerCase()).filter(Boolean);
  const allow = (settings.allowlistSpenders ?? []).map((a) => String(a).toLowerCase()).filter(Boolean);
  const candidates = extractSpenderCandidates(analysis);
  if (candidates.length === 0) return;
  for (const c of candidates) {
    if (deny.includes(c)) {
      analysis.matchedDenySpender = true;
      analysis.recommend = "BLOCK";
      analysis.score = Math.max(analysis.score, 100);
      analysis.level = "HIGH";
      analysis.knownBad = true;
      analysis.reasons.unshift(t("reason_known_bad_spender") || REASON_KEYS.KNOWN_BAD_SPENDER + ": Spender bloqueado.");
      (analysis.reasonKeys ??= []).unshift(REASON_KEYS.SPENDER_DENYLIST);
      return;
    }
    if (allow.includes(c)) {
      analysis.matchedAllowSpender = true;
      analysis.score = Math.min(analysis.score, 15);
      analysis.level = "LOW";
      analysis.knownSafe = true;
      analysis.reasons.push(t("reason_known_safe_spender") || REASON_KEYS.KNOWN_SAFE_SPENDER + ": Spender na allowlist.");
      (analysis.reasonKeys ??= []).push(REASON_KEYS.SPENDER_ALLOWLIST);
    }
  }
  const isApprovalLike = analysis.decodedAction?.kind === "APPROVE_ERC20" || analysis.decodedAction?.kind === "INCREASE_ALLOWANCE" || analysis.decodedAction?.kind === "SET_APPROVAL_FOR_ALL" || analysis.decodedAction?.kind === "PERMIT_EIP2612" || analysis.decodedAction?.kind === "PERMIT2_ALLOWANCE" || analysis.decodedAction?.kind === "PERMIT2_TRANSFER" || !!analysis.typedDataExtras?.spender;
  if (isApprovalLike && !analysis.matchedAllowSpender && !analysis.matchedDenySpender && candidates.length > 0) {
    const hasUnknownSpender = candidates.some((c) => !allow.includes(c));
    if (hasUnknownSpender) {
      analysis.reasons.push(t("reason_new_spender") || REASON_KEYS.NEW_SPENDER + ": Novo spender \u2014 verifique.");
      (analysis.reasonKeys ??= []).push(REASON_KEYS.NEW_SPENDER);
      analysis.score = Math.min(100, analysis.score + 25);
      if (analysis.level !== "HIGH") analysis.level = "WARN";
    }
  }
}
function applyDrainerHeuristics(analysis) {
  if (analysis.isPhishing || analysis.matchedDenySpender) return;
  const decoded = analysis.decodedAction;
  const safeDomain = !!analysis.safeDomain;
  const hasNewSpender = !analysis.matchedAllowSpender && extractSpenderCandidates(analysis).length > 0;
  const isUnlimited = (decoded?.kind === "APPROVE_ERC20" || decoded?.kind === "INCREASE_ALLOWANCE") && decoded.amountType === "UNLIMITED" || decoded?.kind === "PERMIT_EIP2612" && decoded.valueType === "UNLIMITED" || decoded?.kind === "PERMIT2_ALLOWANCE" && decoded.amountType === "UNLIMITED";
  const isSetApprovalForAllNft = decoded?.kind === "SET_APPROVAL_FOR_ALL" && decoded.approved;
  const isPermit2Unknown = (decoded?.permit2 || decoded?.kind === "PERMIT2_ALLOWANCE" || decoded?.kind === "PERMIT2_TRANSFER") && hasNewSpender;
  if (!safeDomain && isUnlimited && hasNewSpender) {
    analysis.level = "HIGH";
    analysis.score = Math.max(analysis.score, 85);
    if (analysis.recommend !== "BLOCK") analysis.recommend = "HIGH";
    (analysis.reasonKeys ??= []).push(REASON_KEYS.NEW_DOMAIN);
  }
  if (isPermit2Unknown) {
    analysis.level = "HIGH";
    analysis.score = Math.max(analysis.score, 80);
    if (analysis.recommend !== "BLOCK") analysis.recommend = "HIGH";
    (analysis.reasonKeys ??= []).push(REASON_KEYS.PERMIT2_GRANT);
  }
  if (!safeDomain && isSetApprovalForAllNft) {
    analysis.level = "HIGH";
    analysis.score = Math.max(analysis.score, 80);
    if (analysis.recommend !== "BLOCK") analysis.recommend = "HIGH";
    (analysis.reasonKeys ??= []).push(REASON_KEYS.SET_APPROVAL_FOR_ALL);
  }
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
  const m = analysis.method ?? "";
  if (analysis.isPhishing) {
    analysis.recommend = "BLOCK";
    return;
  }
  if (analysis.matchedDenySpender) {
    analysis.recommend = "BLOCK";
    return;
  }
  if (m === "wallet_invokesnap" || m === "wallet_requestsnaps") {
    if (mode === "STRICT") {
      analysis.recommend = "BLOCK";
      return;
    }
    if (mode === "BALANCED") {
      analysis.recommend = "HIGH";
      return;
    }
    if (mode === "RELAXED") {
      if (analysis.recommend !== "BLOCK") analysis.recommend = "WARN";
      return;
    }
  }
  if (m === "eth_sendrawtransaction" || m === "eth_signtransaction") {
    if (mode === "STRICT") {
      analysis.recommend = "HIGH";
      return;
    }
    if (mode === "BALANCED") {
      analysis.recommend = "HIGH";
      return;
    }
    if (mode === "RELAXED") {
      if (analysis.recommend !== "BLOCK") analysis.recommend = "WARN";
      return;
    }
  }
  if (mode === "STRICT") {
    if (decoded?.kind === "SET_APPROVAL_FOR_ALL" && decoded.approved && (settings.strictBlockSetApprovalForAll ?? true)) {
      analysis.recommend = "BLOCK";
      return;
    }
    if ((decoded?.kind === "APPROVE_ERC20" || decoded?.kind === "INCREASE_ALLOWANCE") && decoded.amountType === "UNLIMITED" && (settings.strictBlockApprovalsUnlimited ?? true)) {
      analysis.recommend = "BLOCK";
      return;
    }
    if (decoded?.kind === "PERMIT_EIP2612" && decoded.valueType === "UNLIMITED" && (settings.strictBlockPermitLike ?? true)) {
      analysis.recommend = "BLOCK";
      return;
    }
    if (decoded?.kind === "PERMIT2_ALLOWANCE" && decoded.amountType === "UNLIMITED" && (settings.strictBlockPermitLike ?? true)) {
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
    if ((decoded?.kind === "APPROVE_ERC20" || decoded?.kind === "INCREASE_ALLOWANCE") && decoded.amountType === "UNLIMITED" || decoded?.kind === "SET_APPROVAL_FOR_ALL" && decoded?.approved) {
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
function buildTxSummaryV1(req, analysis, _settings) {
  const method = analysis.method ?? req.request?.method ?? "";
  const m = String(method).toLowerCase();
  const existing = analysis.summary;
  if (existing && existing.title) {
    const flags2 = [...existing.flags ?? [], ...analysis.reasonKeys ?? []].filter((x, i, a) => a.indexOf(x) === i);
    return { ...existing, flags: flags2.length ? flags2 : existing.flags };
  }
  if (m === "wallet_switchethereumchain") {
    const chainIdHex = req.request?.params?.[0]?.chainId;
    const name = chainIdHex ? chainName(chainIdHex) : "";
    return {
      title: t("summary_title_switch_chain") || "Troca de rede",
      subtitle: chainIdHex ? `${chainIdHex} \u2192 ${name}` : void 0,
      flags: []
    };
  }
  if (m === "wallet_getpermissions") {
    return {
      title: t("summary_title_read_permissions") || "Leitura de permiss\xF5es",
      flags: analysis.reasonKeys ?? [REASON_KEYS.READ_PERMISSIONS]
    };
  }
  if (m === "wallet_invokesnap" || m === "wallet_requestsnaps") {
    return {
      title: t("summary_title_snaps") || "Snaps / Extens\xF5es da carteira",
      flags: analysis.reasonKeys ?? [m === "wallet_invokesnap" ? REASON_KEYS.SNAP_INVOKE : REASON_KEYS.REQUEST_SNAPS]
    };
  }
  if (m === "eth_signtransaction") {
    return {
      title: t("summary_title_sign_tx") || "Assinatura de transa\xE7\xE3o",
      flags: analysis.reasonKeys ?? [REASON_KEYS.SIGN_TRANSACTION]
    };
  }
  if (m === "eth_sendrawtransaction") {
    return existing ?? {
      title: t("summary_title_raw_tx") || "Broadcast de transa\xE7\xE3o assinada",
      flags: analysis.reasonKeys ?? [REASON_KEYS.RAW_TX_BROADCAST]
    };
  }
  const sim = analysis.simulationOutcome;
  const give = (sim?.outgoingAssets ?? []).map((o) => ({ amount: o.amount, symbol: o.symbol, kind: "ERC20" }));
  const get = (sim?.incomingAssets ?? []).map((i) => ({ amount: i.amount, symbol: i.symbol, kind: "ERC20" }));
  const approvals = (sim?.approvals ?? []).map((a) => ({
    kind: "ERC20",
    tokenAddress: a.token,
    spender: a.spender,
    unlimited: a.unlimited
  }));
  const flags = analysis.reasonKeys ?? [];
  const tx = analysis.tx;
  if (analysis.decodedAction && !give.length && !get.length && (m === "eth_sendtransaction" || m === "wallet_sendtransaction")) {
    const da = analysis.decodedAction;
    if ("spender" in da && da.spender) {
      approvals.push({
        kind: da.kind === "SET_APPROVAL_FOR_ALL" ? "ERC721_ALL" : "ERC20",
        tokenAddress: da.token ?? tx?.to,
        spender: da.spender,
        unlimited: da.amountType === "UNLIMITED"
      });
    }
  }
  return {
    title: analysis.title || (t("action_SEND_TX_contract_title") || "Intera\xE7\xE3o com contrato"),
    subtitle: tx?.to ? `${tx.to.slice(0, 10)}\u2026` : void 0,
    give: give.length ? give : void 0,
    get: get.length ? get : void 0,
    approvals: approvals.length ? approvals : void 0,
    flags: flags.length ? flags : void 0
  };
}
function intentFromTxDataAndValue(data, valueWei, selector) {
  const dataNorm = typeof data === "string" ? data : "";
  const hasData = !!dataNorm && dataNorm !== "0x" && dataNorm.toLowerCase() !== "0x";
  const hasValue = valueWei > 0n;
  const s = String(selector || "").toLowerCase();
  if (hasData && s && s.startsWith("0x") && s.length === 10) {
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
    const nftPurchase = /* @__PURE__ */ new Set([
      "0xfb0f3ee1",
      "0xb3a34c4c",
      "0xed98a574",
      "0xf2d12b12",
      "0xab834bab",
      "0x24856bc3",
      "0xa6f97b27",
      "0x1b14e9e1"
    ]);
    if (nftPurchase.has(s)) return "NFT_PURCHASE";
  }
  if (hasData && hasValue) return "CONTRACT_INTERACTION";
  if (hasData) return "CONTRACT_INTERACTION";
  if (!hasData && hasValue) return "ETH_TRANSFER";
  if (!s || !s.startsWith("0x") || s.length !== 10) return "UNKNOWN";
  return "CONTRACT_INTERACTION";
}
function detectTxContext(opts) {
  const { host, data, valueWei, selector } = opts;
  const s = String(selector || "").toLowerCase();
  const h = (host || "").toLowerCase();
  const hasData = !!data && data !== "0x" && data.toLowerCase() !== "0x";
  const hasValue = valueWei > 0n;
  const approveSelectors = /* @__PURE__ */ new Set(["0x095ea7b3", "0xa22cb465"]);
  if (approveSelectors.has(s)) return "APPROVAL";
  const swapSelectors = /* @__PURE__ */ new Set(["0x38ed1739", "0x7ff36ab5", "0x18cbafe5", "0x04e45aaf", "0xb858183f", "0x5023b4df", "0x09b81346"]);
  if (swapSelectors.has(s)) return "TOKEN_SWAP";
  const seaportSelectors = /* @__PURE__ */ new Set(["0xfb0f3ee1", "0xb3a34c4c", "0xed98a574", "0xf2d12b12", "0xab834bab", "0x24856bc3", "0xa6f97b27", "0x1b14e9e1"]);
  if (seaportSelectors.has(s)) return "NFT_PURCHASE";
  if (!hasData && hasValue) return "VALUE_TRANSFER";
  return "CONTRACT_CALL";
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
var SIMULATION_CACHE_TTL_MS = 3e4;
var SIMULATION_TIMEOUT_MS = 2200;
var __simulationCache = /* @__PURE__ */ new Map();
async function enrichWithSimulation(req, analysis, settings) {
  const method = (req?.request?.method || "").toLowerCase();
  if (!method.includes("sendtransaction")) return;
  const simGate = await canUseNetwork("simulation", settings);
  const mayCallTenderly = simGate.ok;
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
  const cacheKey = `${req.requestId}|${networkId}|${to}|${(input || "").slice(0, 66)}`;
  const cached = __simulationCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < SIMULATION_CACHE_TTL_MS && cached.outcome) {
    analysis.simulationOutcome = cached.outcome;
    return;
  }
  for (const [k, v] of __simulationCache) {
    if (Date.now() - v.ts > SIMULATION_CACHE_TTL_MS) __simulationCache.delete(k);
  }
  let outcome = null;
  if (mayCallTenderly) {
    try {
      const outcomePromise = runSimulation(networkId, from, to, input, value, gas, settings);
      const timeoutPromise = new Promise(
        (_, rej) => setTimeout(() => rej(new Error("SIMULATION_TIMEOUT")), SIMULATION_TIMEOUT_MS)
      );
      outcome = await Promise.race([outcomePromise, timeoutPromise]);
    } catch (e) {
      if (String(e?.message || e).includes("SIMULATION_TIMEOUT")) {
        (analysis.reasonKeys ??= []).push(REASON_KEYS.SIMULATION_TIMEOUT);
      }
    }
  }
  if (!outcome) {
    const tabId = req.tabId;
    if (tabId && to && to !== "0x0000000000000000000000000000000000000000") {
      try {
        const callResp = await rpcCallFull(tabId, "eth_call", [{ to, from, data: input, value: value || "0x0" }, "latest"]);
        if (callResp && !callResp.ok && typeof callResp.error === "string" && callResp.error.toLowerCase().includes("revert")) {
          (analysis.reasonKeys ??= []).push(REASON_KEYS.SIM_FAILED);
          analysis.reasons.unshift(t("simulation_tx_will_fail") || "Pr\xE9-execu\xE7\xE3o indica falha (revert).");
          analysis.recommend = "BLOCK";
          analysis.score = Math.max(analysis.score, 85);
          analysis.level = "HIGH";
        }
      } catch {
      }
    }
    return;
  }
  try {
    analysis.simulationOutcome = outcome;
    __simulationCache.set(cacheKey, { outcome, ts: Date.now() });
    const approvals = outcome.approvals ?? [];
    for (const a of approvals) {
      if (a.approved) {
        if (a.unlimited) {
          (analysis.reasonKeys ??= []).push(REASON_KEYS.UNLIMITED_APPROVAL);
          analysis.reasons.push(t("reason_unlimited_approval") || REASON_KEYS.UNLIMITED_APPROVAL);
          analysis.level = "HIGH";
          analysis.score = Math.max(analysis.score, 90);
        }
        if (a.approvalForAll) {
          (analysis.reasonKeys ??= []).push(REASON_KEYS.SET_APPROVAL_FOR_ALL);
          analysis.reasons.push(t("reason_set_approval_for_all") || REASON_KEYS.SET_APPROVAL_FOR_ALL);
          analysis.level = "HIGH";
          analysis.score = Math.max(analysis.score, 90);
        }
      }
    }
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
          if (analysis.txCostPreview) analysis.txCostPreview.usdPerNative = usdPerEth;
          if (gasCostUsd > 50 && valueUsd < 50) {
            outcome.isHighGas = true;
            analysis.reasons.unshift(t("reason_high_gas") || REASON_KEYS.HIGH_GAS + ": Taxa de gas alta em rela\xE7\xE3o ao valor.");
          }
          if (gasCostUsd > 80) {
            outcome.isHighGas = true;
            if (!analysis.reasons.some((r) => String(r).includes("HIGH_GAS") || String(r).includes("alta"))) {
              analysis.reasons.unshift(t("reason_high_gas") || REASON_KEYS.HIGH_GAS + ": Taxa de gas muito alta.");
            }
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
    }
    if (outcome.fallback && req.tabId && to && to !== "0x0000000000000000000000000000000000000000") {
      try {
        const callResp = await rpcCallFull(req.tabId, "eth_call", [{ to, from, data: input, value: value || "0x0" }, "latest"]);
        if (callResp && !callResp.ok && typeof callResp.error === "string" && callResp.error.toLowerCase().includes("revert")) {
          (analysis.reasonKeys ??= []).push(REASON_KEYS.SIM_FAILED);
          analysis.reasons.unshift(t("simulation_tx_will_fail") || "Pr\xE9-execu\xE7\xE3o indica falha (revert).");
          analysis.recommend = "BLOCK";
          analysis.score = Math.max(analysis.score, 85);
          analysis.level = "HIGH";
        }
      } catch {
      }
    }
    if (outcome.status === "SUCCESS") {
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
  if (method === "wallet_getpermissions") {
    level = "LOW";
    score = 10;
    title = t("summary_title_read_permissions") || "Leitura de permiss\xF5es";
    reasons.push(t("reason_read_permissions") || "O site est\xE1 a ler as permiss\xF5es j\xE1 concedidas \xE0 carteira.");
    return {
      level,
      score,
      title,
      reasons,
      decoded: { kind: "TX", raw: { method, params: req.request.params } },
      recommend: "ALLOW",
      trust,
      suggestedTrustedDomains: [...SUGGESTED_TRUSTED_DOMAINS2],
      safeDomain: false,
      method,
      reasonKeys: [REASON_KEYS.READ_PERMISSIONS],
      human: {
        methodTitle: title,
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
  if (method === "wallet_invokesnap" || method === "wallet_requestsnaps") {
    const isInvoke = method === "wallet_invokesnap";
    reasons.push(t("reason_snap_invoke") || "Snaps podem executar c\xF3digo na carteira. Confirme a origem.");
    level = "HIGH";
    score = 90;
    title = t("summary_title_snaps") || "Snaps / Extens\xF5es da carteira";
    return {
      level,
      score,
      title,
      reasons,
      decoded: { kind: "TX", raw: { method, params: req.request.params } },
      recommend: "HIGH",
      trust,
      suggestedTrustedDomains: [...SUGGESTED_TRUSTED_DOMAINS2],
      safeDomain: false,
      method,
      reasonKeys: [isInvoke ? REASON_KEYS.SNAP_INVOKE : REASON_KEYS.REQUEST_SNAPS],
      human: {
        methodTitle: title,
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
  if (method === "eth_signtransaction") {
    reasons.push(t("reason_sign_tx") || "Assinatura de transa\xE7\xE3o sem envio imediato. Pode ser usada depois para broadcast.");
    level = "HIGH";
    score = 75;
    title = t("summary_title_sign_tx") || "Assinatura de transa\xE7\xE3o";
    return {
      level,
      score,
      title,
      reasons,
      decoded: { kind: "TX", raw: { method, params: req.request.params } },
      recommend: "HIGH",
      trust,
      suggestedTrustedDomains: [...SUGGESTED_TRUSTED_DOMAINS2],
      safeDomain: false,
      method,
      reasonKeys: [REASON_KEYS.SIGN_TRANSACTION],
      human: {
        methodTitle: title,
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
  if (method === "eth_sendrawtransaction") {
    const rawTx = req.request?.params?.[0];
    const rawStr = typeof rawTx === "string" ? rawTx : "";
    let subtitle = "";
    if (rawStr && rawStr.startsWith("0x")) {
      const len = (rawStr.length - 2) / 2;
      const prefix = rawStr.length >= 4 ? rawStr.slice(0, 4).toLowerCase() : "";
      if (prefix === "0x02") subtitle = `EIP-1559 \xB7 ${len} bytes`;
      else if (prefix === "0x01") subtitle = `EIP-2930 \xB7 ${len} bytes`;
      else subtitle = `rawTx \xB7 ${len} bytes`;
    }
    reasons.push(t("reason_raw_broadcast") || "Broadcast de transa\xE7\xE3o j\xE1 assinada. N\xE3o h\xE1 confirma\xE7\xE3o visual pr\xE9via do conte\xFAdo.");
    level = "HIGH";
    score = 85;
    title = t("summary_title_raw_tx") || "Broadcast de transa\xE7\xE3o assinada";
    return {
      level,
      score,
      title,
      reasons,
      decoded: { kind: "TX", raw: { method, params: req.request.params } },
      recommend: "HIGH",
      trust,
      suggestedTrustedDomains: [...SUGGESTED_TRUSTED_DOMAINS2],
      safeDomain: false,
      method,
      reasonKeys: [REASON_KEYS.RAW_TX_BROADCAST],
      summary: { title, subtitle: subtitle || void 0, flags: [REASON_KEYS.RAW_TX_BROADCAST] },
      human: {
        methodTitle: title,
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
  if (isTypedDataMethod(method)) {
    reasons.push(t("typedDataWarnReason"));
    if (level !== "HIGH") level = "WARN";
    score = Math.max(score, 60);
    title = t("signatureRequest");
    const norm = normalizeTypedDataParams(method, req.request.params);
    const raw = norm.typedDataRaw ?? "";
    let permitExtras = null;
    let typedDataDecoded = void 0;
    try {
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
        const j = norm.typedDataObj ?? (() => {
          try {
            return JSON.parse(raw);
          } catch {
            return null;
          }
        })();
        const domainName = String(j?.domain?.name || "");
        const msg = j?.message || {};
        if (permitExtras) {
          reasons.push(t("permit_signature_detected"));
          if (permitExtras.spender) {
            reasons.push(t("permit_spender_check") || "Verifique o spender.");
          }
          level = "HIGH";
          score = Math.max(score, 90);
        }
        const looksPermit2 = domainName.toLowerCase().includes("permit2") || !!msg?.permitted && !!msg?.spender;
        const looksApproveLike = !!msg?.spender && ("value" in msg || "amount" in msg);
        const looksSeaport = domainName.toLowerCase().includes("seaport") || !!msg?.offer && !!msg?.consideration;
        if (!permitExtras && (looksPermit2 || looksApproveLike)) {
          reasons.push("Assinatura pode permitir que um endere\xE7o gaste seus tokens.");
          if (String(msg?.spender || "").trim()) {
            reasons.push(REASON_KEYS.PERMIT2_GRANT);
            level = "HIGH";
            score = Math.max(score, 90);
          }
        }
        if (looksSeaport) {
          reasons.push(REASON_KEYS.MARKETPLACE_LISTING);
          score = Math.max(score, 70);
        }
        const permit2 = extractPermit2FromTypedData(raw);
        if (permit2?.unlimited) {
          reasons.push(REASON_KEYS.UNLIMITED_APPROVAL);
          level = "HIGH";
          score = Math.max(score, 90);
        }
        const seaport = extractSeaportFromTypedData(raw);
        const blur = isBlurTypedData(raw);
        typedDataDecoded = {
          ...permit2 && { permit2: { spender: permit2.spender, tokens: permit2.tokens, amounts: permit2.amounts, unlimited: permit2.unlimited, sigDeadline: permit2.sigDeadline } },
          ...seaport && { seaport: { offerSummary: seaport.offerSummary, considerationSummary: seaport.considerationSummary, primaryType: seaport.primaryType } },
          ...blur && { isBlur: true }
        };
      }
    } catch {
    }
    const typedDataExtras = permitExtras ? { spender: permitExtras.spender, value: permitExtras.value, deadline: permitExtras.deadline } : void 0;
    const typedDataReasonKeys = [];
    if (permitExtras?.spender) typedDataReasonKeys.push(REASON_KEYS.PERMIT_GRANT);
    try {
      const j2 = norm.typedDataObj ?? (typeof raw === "string" ? (() => {
        try {
          return JSON.parse(raw);
        } catch {
          return null;
        }
      })() : null);
      const dn = String(j2?.domain?.name || "").toLowerCase();
      const msg2 = j2?.message || {};
      const looksP2 = dn.includes("permit2") || !!msg2?.permitted && !!msg2?.spender;
      const permit2Dec = typeof raw === "string" ? extractPermit2FromTypedData(raw) : null;
      if (looksP2 || permit2Dec && permit2Dec.spender) typedDataReasonKeys.push(REASON_KEYS.PERMIT2_GRANT);
    } catch {
    }
    return {
      level,
      score,
      title,
      reasons,
      reasonKeys: typedDataReasonKeys.length ? typedDataReasonKeys : void 0,
      decoded: { kind: "TYPED_DATA", raw: { params: req.request.params } },
      recommend: "WARN",
      trust,
      suggestedTrustedDomains: [...SUGGESTED_TRUSTED_DOMAINS2],
      safeDomain,
      typedDataExtras,
      typedDataDecoded,
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
    let intent = decodedAction ? decodedAction.kind === "APPROVE_ERC20" || decodedAction.kind === "INCREASE_ALLOWANCE" || decodedAction.kind === "DECREASE_ALLOWANCE" || decodedAction.kind === "SET_APPROVAL_FOR_ALL" || decodedAction.kind === "PERMIT_EIP2612" || decodedAction.kind === "PERMIT2_ALLOWANCE" ? "APPROVAL" : decodedAction.kind === "TRANSFER_ERC20" || decodedAction.kind === "TRANSFERFROM_ERC20" || decodedAction.kind === "PERMIT2_TRANSFER" ? "TOKEN_TRANSFER" : decodedAction.kind === "TRANSFER_NFT" ? "NFT_TRANSFER" : intentFromTxDataAndValue(data, valueWei, selector) : intentFromTxDataAndValue(data, valueWei, selector);
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
    let tokenConfidencePartial = {};
    if (tokenForAsset && listCache) {
      await markTokenSeen(chainIdHex, tokenForAsset);
      const firstSeen = await getTokenFirstSeen(chainIdHex, tokenForAsset);
      const tokenScam = isScamToken(chainIdHex, tokenForAsset, listCache);
      const tokenTrusted = isTrustedToken(chainIdHex, tokenForAsset, listCache) || !!tokenInfo?.v;
      const isNew = firstSeen ? Date.now() - firstSeen < 7 * 24 * 60 * 60 * 1e3 : true;
      let tokenConfidence = "UNKNOWN";
      if (tokenScam) tokenConfidence = "SCAM";
      else if (tokenTrusted) tokenConfidence = "TRUSTED";
      else if (isNew) tokenConfidence = "LOW";
      tokenConfidencePartial = { tokenConfidence, tokenFirstSeenAt: firstSeen ?? void 0 };
      if (tokenConfidence === "LOW") reasons.push(`Token analisado: ${tokenInfo?.s ?? "?"} \u2014 Confian\xE7a: BAIXA (rec\xE9m-lan\xE7ado / pouca liquidez / sem reputa\xE7\xE3o)`);
    }
    Object.assign(tokenMeta, tokenConfidencePartial);
    if (decodedAction && tokenForAsset && (settings.assetEnrichmentEnabled ?? true) && tabId) {
      try {
        asset = await getAssetInfo(chainId || "0x1", tokenForAsset, tabId);
      } catch {
      }
    }
    if (asset) reasons.push(t("asset_info_reason", { sym: asset.symbol || asset.name || "?", kind: asset.kind }));
    if (isHexString(data) && data.startsWith("0x")) {
      const ap = decodeErc20Approve(data.toLowerCase());
      const incDec = decodedAction && (decodedAction.kind === "INCREASE_ALLOWANCE" || decodedAction.kind === "DECREASE_ALLOWANCE") ? decodedAction : null;
      if (incDec) {
        const isUnlimited = incDec.kind === "INCREASE_ALLOWANCE" && incDec.amountType === "UNLIMITED";
        const spender = "spender" in incDec ? incDec.spender : "";
        if (isUnlimited) {
          reasons.push(t("unlimitedApprovalReason"));
          level = "HIGH";
          score = Math.max(score, 90);
          title = t("unlimitedApprovalDetected");
        } else {
          reasons.push(incDec.kind === "INCREASE_ALLOWANCE" ? "Aumenta limite de gasto (increaseAllowance)." : "Diminui limite de gasto (decreaseAllowance).");
          level = "WARN";
          score = Math.max(score, 40);
          title = incDec.kind === "INCREASE_ALLOWANCE" ? "Increase Allowance" : "Decrease Allowance";
        }
        txExtras = {
          approvalType: "ERC20_APPROVE",
          tokenContract: typeof tx.to === "string" ? String(tx.to) : void 0,
          spender,
          unlimited: isUnlimited
        };
        return {
          level: hasAddrIntelHit && addrIntelRecommend === "BLOCK" ? "HIGH" : level,
          score: Math.max(score, addrIntelScore),
          title,
          reasons: hasAddrIntelHit ? [...addrIntelReasons, ...reasons] : reasons,
          decoded: { kind: "APPROVE", spenderOrOperator: spender, amountHuman: isUnlimited ? "UNLIMITED" : incDec.amountRaw ?? "?", raw: { to, value, selector: hexSelector(data) } },
          decodedAction: incDec,
          recommend: isUnlimited ? addrIntelRecommend ?? (settings.blockHighRisk ? "BLOCK" : "WARN") : addrIntelRecommend ?? "WARN",
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
            risks: isUnlimited ? [t("human_approve_risk_1"), t("human_approve_risk_unlimited")].slice(0, 3) : [t("human_approve_risk_1")].slice(0, 3),
            safeNotes: [t("human_approve_safe_1")].slice(0, 1),
            nextSteps: [t("human_approve_next_1"), t("human_approve_next_2")].slice(0, 3),
            recommendation: isUnlimited ? t("human_approve_reco_unlimited") : t("human_approve_reco"),
            links: [{ text: t("human_revoke_link_text"), href: "https://revoke.cash" }]
          }
        };
      }
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
      if (decodedAction.kind === "APPROVE_ERC20" || decodedAction.kind === "INCREASE_ALLOWANCE" || decodedAction.kind === "DECREASE_ALLOWANCE" || decodedAction.kind === "PERMIT_EIP2612" || decodedAction.kind === "PERMIT2_ALLOWANCE") reasons.push(t("reason_permission_tokens"));
      else if (decodedAction.kind === "SET_APPROVAL_FOR_ALL" && decodedAction.approved) reasons.push(t("reason_permission_all_nfts"));
      else if (decodedAction.kind === "TRANSFER_ERC20" || decodedAction.kind === "TRANSFERFROM_ERC20" || decodedAction.kind === "PERMIT2_TRANSFER") reasons.push(t("token_transfer_detected"));
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
    const host2 = hostFromUrl(req.url || "");
    const txCtx = detectTxContext({ host: host2, txTo: to, data, valueWei, selector });
    if (intent === "NFT_PURCHASE") reasons.push("Compra de NFT: ao confirmar, valor ser\xE1 transferido e NFT adquirido.");
    if (intent === "SWAP") {
      reasons.push("Swap/compra de token via contrato: ao confirmar, voc\xEA troca ativo por token.");
      if (listCache) {
        const sim = req?.simulationOutcome;
        const pathTokens = extractTokenCandidates(to, data, decodedAction, sim);
        for (const addr of pathTokens.slice(0, 5)) {
          try {
            const risk = await getTokenRisk(addr, chainIdHex, listCache);
            if (risk.confidence === "LOW" && risk.symbol) {
              reasons.push(`Token analisado: ${risk.symbol} \u2014 Confian\xE7a: BAIXA (rec\xE9m-lan\xE7ado / pouca liquidez / sem reputa\xE7\xE3o)`);
              if (!tokenConfidencePartial.tokenConfidence || tokenConfidencePartial.tokenConfidence === "UNKNOWN") {
                tokenConfidencePartial = { ...tokenConfidencePartial, tokenConfidence: "LOW" };
                Object.assign(tokenMeta, tokenConfidencePartial);
              }
              break;
            }
          } catch {
          }
        }
      }
    }
    if (valueWei > 0n) reasons.push("Envia valor nativo (ETH).");
    if (toIsContract === true) reasons.push(t("reason_contract_target") || REASON_KEYS.CONTRACT_TARGET + ": Destino \xE9 contrato.");
    if (reasons.length === 0) reasons.push("Transa\xE7\xE3o on-chain: confirme valor, destino e rede.");
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
      txContext: { kind: txCtx },
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
        safe: lists.safeNotes,
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
