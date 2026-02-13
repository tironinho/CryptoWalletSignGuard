console.log("🚨 [SignGuard Background] Service Worker LOADED via " + new Date().toISOString());

import type { AnalyzeRequest, Analysis, Settings, AssetInfo, DecodedAction, SecurityMode, ThreatIntelAddress, CheckResult, CheckKey, PlanState } from "./shared/types";
import type { TxSummary } from "./shared/types";
import { DEFAULT_SETTINGS } from "./shared/types";
import type { Intent, TxExtras } from "./shared/types";
import { decodeErc20Approve, decodeSetApprovalForAll, decodeTx } from "./shared/decode";
import { hostFromUrl, isAllowlisted, hexSelector, isHexString } from "./shared/utils";
import { shortAddr } from "./txMath";
import { t } from "./i18n";
import { computeTrustVerdict } from "./shared/trust";
import { buildHumanLists, explainMethod } from "./shared/explain";
import { SUGGESTED_TRUSTED_DOMAINS as SUGGESTED_TRUSTED_DOMAINS_SHARED } from "./shared/constants";
import { fetchThreatIntel, hostMatches, normalizeHost, hostInBlocked, TRUSTED_SEED } from "./intel";
import type { ThreatIntel } from "./intel";
import { loadAddressIntelCachedFast, refreshAddressIntel, saveAddressIntel, normalizeAddr } from "./addressIntel";
import type { AddressIntel, AddressLabel } from "./addressIntel";
import { decodeEvmTx } from "./txHumanize";
import { extractTypedDataPermitExtras } from "./txHumanize";
import { hexToBigInt, weiToEth } from "./txMath";
import { assessDomainRisk } from "./domainRisk";
import { runSimulation } from "./services/simulationService";
import { runHoneypotCheck } from "./services/honeypotService";
import { initTokenSecurity, getTokenInfo, getTokenAddressForTx } from "./services/tokenSecurity";
import { getLists, refresh as refreshLists, getDomainDecision, isBlockedAddress, isScamToken, upsertUserOverride, deleteUserOverride } from "./services/listManager";
import { getNativeUsd, getTokenUsd } from "./services/priceService";
import { getTokenMeta } from "./services/tokenMetaService";
import { initTelemetry, telemetry } from "./services/telemetryService";
import { INTEREST_MAP } from "./shared/interestMap";
import {
  getEligibleCampaign,
  canShowAd,
  markAdShown,
  trackAdEvent,
} from "./services/marketingService";

export const SUGGESTED_TRUSTED_DOMAINS = SUGGESTED_TRUSTED_DOMAINS_SHARED;

// Bootstrap: registar onMessage/onConnect logo para PING (sem depender de async init)
chrome.runtime.onMessage.addListener((msg: any, _sender, sendResponse) => {
  if (msg?.type === "PING") {
    try { sendResponse({ ok: true, ts: Date.now() }); } catch {}
    return true;
  }
  return false;
});
chrome.runtime.onConnect.addListener((port) => {
  if (!port || port.name !== "sg_port") return;
  port.onMessage.addListener(async (msg: any) => {
    const requestId = msg?.requestId;
    const payload = msg ? { ...msg } : {};
    delete payload.requestId;
    try {
      const resp = await handleBgRequest(payload, port.sender);
      port.postMessage({ requestId, ...(resp ?? { ok: true }) });
    } catch (e: any) {
      port.postMessage({ requestId, ok: false, error: String(e?.message || e) });
    }
  });
});

/** Single handler for all background requests (onMessage and Port). Used by options/content via sg_port. */
async function handleBgRequest(msg: any, sender?: chrome.runtime.MessageSender): Promise<any> {
  if (!msg || typeof msg !== "object" || !msg.type) return { ok: false, error: "INVALID_MESSAGE" };
  if (msg.type === "PING") return { ok: true, ts: Date.now() };
  try {
    switch (msg.type) {
      case "AD_TRACK_CLICK": {
        const campaignId = msg.payload?.campaignId;
        if (campaignId) trackAdEvent(campaignId, "CLICK").catch(() => {});
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
          const lists = await refreshLists(true);
          return { ok: true, updatedAt: lists.updatedAt, counts: { trustedDomains: lists.trustedDomains.length, blockedDomains: lists.blockedDomains.length, blockedAddresses: lists.blockedAddresses.length, scamTokens: lists.scamTokens.length, userTrustedDomains: lists.userTrustedDomains.length, userBlockedDomains: lists.userBlockedDomains.length, userBlockedAddresses: lists.userBlockedAddresses.length, userScamTokens: lists.userScamTokens.length }, sources: lists.sources };
        } catch (e) {
          return { ok: false, error: String((e as Error)?.message ?? e) };
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
        let items: Array<{ value: string; source?: string; kind?: string }> = [];
        if (type === "domain" && q) {
          const all = [...lists.trustedDomains, ...lists.blockedDomains];
          const filtered = all.filter((d) => d.includes(q));
          items = filtered.slice(page * pageSize, (page + 1) * pageSize).map((d) => ({ value: d, kind: lists.trustedDomains.includes(d) ? "trusted" : "blocked" }));
        } else if (type === "address" && q) {
          const all = [...lists.blockedAddresses];
          const filtered = all.filter((a) => a.includes(q));
          items = filtered.slice(page * pageSize, (page + 1) * pageSize).map((a) => ({ value: a, kind: "blocked" }));
        } else if (type === "token" && q) {
          const filtered = lists.scamTokens.filter((t) => t.address.includes(q) || (t.symbol || "").toLowerCase().includes(q));
          items = filtered.slice(page * pageSize, (page + 1) * pageSize).map((t) => ({ value: t.address, source: t.source, kind: "scam", chainId: t.chainId }));
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
          return { ok: false, error: String((e as Error)?.message ?? e) };
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
          return { ok: false, error: String((e as Error)?.message ?? e) };
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
          const { importUserOverrides } = await import("./services/listManager");
          const lists = await importUserOverrides(data);
          return { ok: true, updatedAt: lists.updatedAt };
        } catch (e) {
          return { ok: false, error: String((e as Error)?.message ?? e) };
        }
      }
      case "SG_INTEL_SUMMARY": {
        const intel = await getIntelFresh();
        return { ok: true, updatedAt: intel.updatedAt, trustedSeedCount: (intel.trustedSeed || (intel as any).trustedDomainsSeed || []).length, blockedCount: (intel.blockedDomainsList || (intel as any).blockedDomains || []).length, blockedAddressCount: (intel.blockedAddressesList || (intel as any).blockedAddresses || []).length, sources: intel.sources || [] };
      }
      case "SG_INTEL_UPDATE_NOW":
      case "UPDATE_INTEL_NOW": {
        let intel: ThreatIntel;
        try { intel = await updateIntelNow(); } catch { intel = await getIntelFresh(); }
        return { ok: true, updatedAt: intel.updatedAt, trustedSeedCount: (intel.trustedSeed || (intel as any).trustedDomainsSeed || []).length, blockedCount: (intel.blockedDomainsList || (intel as any).blockedDomains || []).length, blockedAddressCount: (intel.blockedAddressesList || (intel as any).blockedAddresses || []).length, sources: intel.sources || [] };
      }
      case "SG_LOG_HISTORY": {
        const evt = msg.payload;
        if (evt && typeof evt === "object") pushHistoryEvent(evt as HistoryEvent);
        return { ok: true };
      }
      case "SG_TELEMETRY_THREAT": {
        const p = msg.payload;
        if (p && typeof p === "object") {
          const url = typeof p.url === "string" ? p.url : "";
          const score = typeof p.riskScore === "number" ? p.riskScore : 100;
          const reasons = Array.isArray(p.reasons) ? p.reasons : [typeof p.reason === "string" ? p.reason : "HIGH_RISK"];
          const metadata = (p.metadata && typeof p.metadata === "object") ? p.metadata as Record<string, unknown> : {};
          telemetry.trackThreat(url, score, reasons, metadata).catch(() => {});
        }
        return { ok: true };
      }
      case "SG_TELEMETRY_USAGE": {
        const p = msg.payload;
        if (p && typeof p === "object" && typeof p.event === "string") telemetry.trackEvent(p.event, (p.props && typeof p.props === "object") ? p.props as Record<string, unknown> : undefined).catch(() => {});
        return { ok: true };
      }
      case "TELEMETRY_WALLETS_DETECTED": {
        const p = msg.payload;
        if (p && typeof p === "object" && Array.isArray(p.wallets)) telemetry.syncUserWallets(p.wallets).catch(() => {});
        return { ok: true };
      }
      case "SG_TELEMETRY_INTERACTION": {
        const p = msg.payload;
        if (p && typeof p === "object" && typeof p.domain === "string") telemetry.trackInteraction({ domain: p.domain, kind: p.kind ?? "click", props: (p.props && typeof p.props === "object") ? (p.props as Record<string, unknown>) : undefined }).catch(() => {});
        return { ok: true };
      }
      case "SG_GET_PLAN": {
        try {
          const got = await new Promise<Record<string, PlanState>>((resolve) => {
            chrome.storage.local.get(PLAN_KEY, (r) => { resolve((r as Record<string, PlanState>) ?? {}); });
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
            const plan: PlanState = { tier: "PRO", keyMasked: key ? key.slice(0, 6) + "…" + key.slice(-4) : undefined, activatedAt: Date.now() };
            await new Promise<void>((resolve, reject) => {
              chrome.storage.local.set({ [PLAN_KEY]: plan }, () => (chrome.runtime?.lastError ? reject(chrome.runtime.lastError) : resolve()));
            });
            return { ok: true, tier: "PRO", invalid: false };
          }
          return { ok: true, tier: "FREE", invalid: true };
        } catch (e) {
          return { ok: false, error: String((e as Error)?.message ?? e) };
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
        const req = msg.payload as AnalyzeRequest;
        if (isVaultLockedContract(settings, req)) return { ok: true, vaultBlocked: true, vaultMessage: t("vaultBlockedMessage") };
        const intel = await getIntelCachedFast();
        const isStale = intel.updatedAt === 0 || (Date.now() - intel.updatedAt >= INTEL_TTL_MS);
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
        const matchedBad = !!(analysis.isPhishing || (analysis.recommend === "BLOCK" && (analysis.reasons || []).some((r) => String(r).toLowerCase().includes("phishing") || String(r).toLowerCase().includes("blacklist"))));
        const matchedSeed = !!analysis.safeDomain;
        const signals: string[] = [];
        if (matchedSeed) signals.push("SEED_MATCH");
        if (matchedBad) signals.push("BLACKLIST_HIT");
        if ((analysis.reasons || []).some((r) => String(r).toLowerCase().includes("lookalike"))) signals.push("LOOKALIKE");
        if ((analysis.reasons || []).some((r) => String(r).toLowerCase().includes("punycode") || String(r).toLowerCase().includes("xn--"))) signals.push("PUNYCODE");
        if ((analysis.reasons || []).some((r) => String(r).toLowerCase().includes("suspicious") || String(r).toLowerCase().includes("tld"))) signals.push("SUSPICIOUS_TLD");
        Object.assign(analysis, setVerificationFields({ host, intel, usedCacheOnly: true, isStale, matchedBad, matchedSeed, signals }));
        if (settings.cloudIntelOptIn && (req?.request?.method === "eth_sendtransaction" || req?.request?.method === "wallet_sendtransaction") && analysis.tx) {
          const chainId = String(req?.meta?.chainId ?? (req as any)?.chainId ?? "0x1").replace(/^0x/, "").toLowerCase();
          const to = (analysis.tx as any)?.to;
          if (to && typeof to === "string" && to.startsWith("0x")) {
            let valueUsd: number | undefined;
            const valueEth = (analysis.tx as any)?.valueEth;
            if (typeof valueEth === "string" && parseFloat(valueEth) > 0) {
              const usdPerEth = await getEthUsdPriceCached();
              if (usdPerEth != null) valueUsd = parseFloat(valueEth) * usdPerEth;
            }
            telemetry.trackTx({ chainId: chainId.startsWith("0x") ? chainId : "0x" + chainId, contractAddress: to.toLowerCase(), method: (analysis.intent as string) || "unknown", valueUsd }).catch(() => {});
          }
        }
        if (settings.debugMode) {
          try {
            pushDebugEvent({ ts: Date.now(), kind: "ANALYZE", url: truncateStr(req?.url, 300), host: truncateStr(hostFromUrl(req?.url || ""), 120), method: truncateStr(req?.request?.method, 120), level: analysis.level, score: analysis.score, recommend: analysis.recommend, intent: analysis.intent, isPhishing: !!analysis.isPhishing, reasons: (analysis.reasons || []).slice(0, 8).map((r) => truncateStr(r, 240)), tx: analysis.tx ? { to: truncateStr((analysis.tx as any).to, 120), valueEth: truncateStr((analysis.tx as any).valueEth, 64), maxGasFeeEth: truncateStr((analysis.tx as any).maxGasFeeEth, 64), maxTotalEth: truncateStr((analysis.tx as any).maxTotalEth, 64), selector: truncateStr((analysis.tx as any).selector, 16) } : undefined, txExtras: analysis.txExtras ? { approvalType: (analysis.txExtras as any).approvalType, tokenContract: truncateStr((analysis.txExtras as any).tokenContract, 120), spender: truncateStr((analysis.txExtras as any).spender, 120), operator: truncateStr((analysis.txExtras as any).operator, 120), unlimited: !!(analysis.txExtras as any).unlimited } : undefined });
          } catch {}
        }
        return { ok: true, analysis };
      }
      default:
        return { ok: false, error: "UNKNOWN_MESSAGE_TYPE" };
    }
  } catch (e) {
    return { ok: false, error: String((e as Error)?.message || e) };
  }
}

const INTEL_KEY = "sg_threat_intel_v2";
const INTEL_TTL_MS = 24 * 60 * 60 * 1000;

const HISTORY_KEY = "sg_history_v1";
const HISTORY_MAX = 200;
const PLAN_KEY = "sg_plan_v1";

type HistoryEvent = {
  ts: number;
  requestId: string;
  host?: string;
  url?: string;
  wallet?: string;
  chainId?: string;
  action?: string;
  method?: string;
  to?: string;
  valueEth?: string;
  feeLikelyEth?: string;
  feeMaxEth?: string;
  totalLikelyEth?: string;
  totalMaxEth?: string;
  usdPerEth?: number;
  decision: "ALLOW" | "BLOCK";
  score?: number;
  level?: string;
};

function pushHistoryEvent(evt: HistoryEvent) {
  try {
    chrome.storage.local.get(HISTORY_KEY, (r) => {
      const err = chrome.runtime.lastError;
      if (err) return;
      const arr = Array.isArray((r as any)?.[HISTORY_KEY]) ? (r as any)[HISTORY_KEY] : [];
      arr.push(evt);
      const trimmed = arr.slice(-HISTORY_MAX);
      chrome.storage.local.set({ [HISTORY_KEY]: trimmed }, () => void 0);
    });
  } catch {}
}

/** Minimal intel from local seed only (no network). Used when cache is missing. */
function getMinimalSeedIntel(): ThreatIntel {
  return {
    updatedAt: 0,
    sources: [{ name: "local_seed", ok: true, count: 0, url: "" }],
    blockedDomains: {},
    allowedDomains: {},
    blockedAddresses: {},
    trustedSeed: [...TRUSTED_SEED],
    blockedDomainsList: [],
    blockedAddressesList: [],
  };
}
const ASSET_CACHE_KEY = "sg_asset_cache";
const ASSET_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

const getCodeCache = new Map<string, boolean>();

async function getToIsContract(address: string | undefined, tabId: number | undefined): Promise<boolean | undefined> {
  const addr = (address || "").toLowerCase();
  if (!addr || addr.length < 40) return undefined;
  const cacheKey = addr;
  const hit = getCodeCache.get(cacheKey);
  if (hit !== undefined) return hit;
  try {
    const code = await Promise.race([
      rpcCall(tabId, "eth_getCode", [addr, "latest"]),
      new Promise<null>((_, rej) => setTimeout(() => rej(new Error("timeout")), 1500)),
    ]);
    const isContract = !!(code && code !== "0x" && code !== "0x0" && (code as string).length > 2);
    getCodeCache.set(cacheKey, isContract);
    return isContract;
  } catch {
    return undefined;
  }
}

async function loadIntel(): Promise<ThreatIntel | null> {
  try {
    const r = await (chrome.storage.local.get as any)(INTEL_KEY);
    return (r?.[INTEL_KEY] as ThreatIntel) ?? null;
  } catch {
    return null;
  }
}

async function saveIntel(intel: ThreatIntel) {
  try {
    await (chrome.storage.local.set as any)({ [INTEL_KEY]: intel });
  } catch {}
}

async function getIntelFresh(): Promise<ThreatIntel> {
  const cached = await loadIntel();
  if (cached && Date.now() - cached.updatedAt < INTEL_TTL_MS) return cached;
  const fresh = await fetchThreatIntel();
  await saveIntel(fresh);
  return fresh;
}

/** Returns cached intel only (no network). Never blocks on fetch. */
async function getIntelCachedFast(): Promise<ThreatIntel> {
  const cached = await loadIntel();
  if (cached) return cached;
  return getMinimalSeedIntel();
}

let _intelRefreshInProgress = false;

/** Schedules an async intel refresh without blocking. Concurrency-safe. */
function ensureIntelRefreshSoon(reason: string): void {
  if (_intelRefreshInProgress) return;
  _intelRefreshInProgress = true;
  Promise.resolve()
    .then(() => updateIntelNow())
    .catch(() => {})
    .finally(() => {
      _intelRefreshInProgress = false;
    });
}

async function updateIntelNow(_opts?: { reason?: string }): Promise<ThreatIntel> {
  const fresh = await fetchThreatIntel();
  await saveIntel(fresh);
  return fresh;
}

let _addrIntelRefreshInProgress = false;

function ensureAddressIntelRefreshSoon(reason: string): void {
  if (_addrIntelRefreshInProgress) return;
  _addrIntelRefreshInProgress = true;
  Promise.resolve()
    .then(async () => {
      try {
        const fresh = await refreshAddressIntel();
        await saveAddressIntel(fresh);
      } finally {
        _addrIntelRefreshInProgress = false;
      }
    })
    .catch(() => { _addrIntelRefreshInProgress = false; });
}

chrome.runtime.onInstalled.addListener((details) => {
  console.log("🚨 [SignGuard Background] Installed/Updated event fired");
  if (details.reason === "install") {
    try {
      chrome.tabs.create({ url: chrome.runtime.getURL("onboarding.html") });
    } catch {}
  }
  initTokenSecurity().catch(() => {});
  ensureIntelRefreshSoon("startup");
  ensureAddressIntelRefreshSoon("startup");
  chrome.alarms.create("sg_intel_daily", { periodInMinutes: 24 * 60 });
  chrome.alarms.create("SG_REFRESH_LISTS", { periodInMinutes: 360 });
  refreshLists().catch(() => {});
});

chrome.alarms.onAlarm.addListener(async (a) => {
  if (a.name === "sg_intel_daily") {
    try { await updateIntelNow(); } catch {}
    try { ensureAddressIntelRefreshSoon("alarm_daily"); } catch {}
    return;
  }
  if (a.name === "SG_REFRESH_LISTS") {
    try { await refreshLists(); } catch {}
  }
});

async function rpcCall(tabId: number | undefined, method: string, params: any[]): Promise<any> {
  if (!tabId || typeof chrome.tabs.sendMessage !== "function") return null;
  const allowed = new Set(["eth_call", "eth_chainid", "eth_getCode"]);
  if (!allowed.has(String(method).toLowerCase())) return null;
  try {
    const resp = await chrome.tabs.sendMessage(tabId, { type: "SG_RPC_CALL_REQUEST", id: crypto.randomUUID(), method, params });
    return (resp as any)?.ok ? (resp as any).result : null;
  } catch {
    return null;
  }
}

async function getAssetInfo(chainId: string, address: string, tabId: number | undefined): Promise<AssetInfo | null> {
  const key = `${(chainId || "").toLowerCase()}:${(address || "").toLowerCase()}`;
  if (!key || key === ":") return null;
  try {
    const cached: Record<string, AssetInfo> = (await (chrome.storage.local.get as any)(ASSET_CACHE_KEY))?.[ASSET_CACHE_KEY] || {};
    const hit = cached[key];
    if (hit && Date.now() - (hit.fetchedAt || 0) < ASSET_CACHE_TTL_MS) return hit;

    const call = (to: string, data: string) => rpcCall(tabId, "eth_call", [{ to, data, gas: "0x7530" }]);
    const nameHex = await call(address, "0x06fdde03");
    const symbolHex = await call(address, "0x95d89b41");
    const decimalsHex = await call(address, "0x313ce567");

    let name = "";
    let symbol = "";
    let decimals: number | undefined;
    const decodeBytes = (h: string) => {
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
      try { decimals = parseInt(decimalsHex, 16); } catch {}
    }

    let kind: AssetInfo["kind"] = "UNKNOWN";
    if (decimals != null && (symbol || name)) {
      kind = "ERC20";
    } else {
      const pad32 = (h: string) => h.replace(/^0x/, "").padStart(64, "0").slice(0, 64);
      const sup721 = await call(address, "0x01ffc9a7" + pad32("0x80ac58cd"));
      const sup1155 = await call(address, "0x01ffc9a7" + pad32("0xd9b67a26"));
      const isTrue = (r: any) => r && /[1-9a-f]/.test(String(r).replace(/^0x/, ""));
      if (isTrue(sup721)) kind = "ERC721";
      else if (isTrue(sup1155)) kind = "ERC1155";
    }

    const info: AssetInfo = { chainId, address: address.toLowerCase(), kind, name: name || undefined, symbol: symbol || undefined, decimals, fetchedAt: Date.now() };
    cached[key] = info;
    await (chrome.storage.local.set as any)({ [ASSET_CACHE_KEY]: cached });
    return info;
  } catch {
    return null;
  }
}

const DEBUG_KEY = "sg_debug_events";

function clamp01(n: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, n));
}

function truncateStr(s: any, max = 1200) {
  const str = typeof s === "string" ? s : String(s ?? "");
  if (str.length <= max) return str;
  return str.slice(0, max) + "…";
}

function pushDebugEvent(evt: any) {
  try {
    chrome.storage.local.get(DEBUG_KEY, (r) => {
      const err = chrome.runtime.lastError;
      if (err) return;
      const arr = Array.isArray((r as any)?.[DEBUG_KEY]) ? (r as any)[DEBUG_KEY] : [];
      arr.push(evt);
      const trimmed = arr.slice(-20);
      chrome.storage.local.set({ [DEBUG_KEY]: trimmed }, () => void 0);
    });
  } catch {}
}

const PRICE_CACHE_KEY = "sg_price_cache";
const PRICE_CACHE_TTL_MS = 120_000; // 2 min
let __ethUsdCache: { usdPerEth: number; fetchedAt: number } | null = null;

async function getEthUsdPriceCached(): Promise<number | null> {
  const now = Date.now();
  if (__ethUsdCache && (now - __ethUsdCache.fetchedAt) < PRICE_CACHE_TTL_MS) return __ethUsdCache.usdPerEth;

  try {
    const stored = await new Promise<{ ethUsd?: number; updatedAt?: number } | null>((resolve) => {
      chrome.storage.local.get(PRICE_CACHE_KEY, (r) => {
        if (chrome.runtime?.lastError) return resolve(null);
        resolve((r as any)?.[PRICE_CACHE_KEY] ?? null);
      });
    });
    if (stored?.ethUsd != null && Number.isFinite(stored.ethUsd) && stored.updatedAt != null && (now - stored.updatedAt) < PRICE_CACHE_TTL_MS) {
      __ethUsdCache = { usdPerEth: stored.ethUsd, fetchedAt: stored.updatedAt };
      return stored.ethUsd;
    }
  } catch {}

  try {
    const resp = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd", {
      method: "GET",
      headers: { "accept": "application/json" },
    });
    if (!resp.ok) return null;
    const j: any = await resp.json();
    const usd = Number(j?.ethereum?.usd);
    if (!Number.isFinite(usd) || usd <= 0) return null;
    __ethUsdCache = { usdPerEth: usd, fetchedAt: now };
    try {
      chrome.storage.local.set({ [PRICE_CACHE_KEY]: { ethUsd: usd, updatedAt: now } }, () => void 0);
    } catch {}
    return usd;
  } catch {
    return null;
  }
}

async function getSettings(): Promise<Settings> {
  return await new Promise((resolve) => {
    try {
      chrome.storage.sync.get(DEFAULT_SETTINGS, (got) => {
        const err = chrome.runtime.lastError;
        if (err) return resolve(DEFAULT_SETTINGS);
        resolve(got as Settings);
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

const WEB3_KEYWORDS = ["swap", "dex", "finance", "crypto", "nft", "wallet", "bridge", "stake", "defi", "uniswap", "pancake", "opensea", "metamask", "phantom"];
const tabSessions = new Map<number, { startTime: number; domain: string; referrer: string }>();

function isWeb3RelevantDomain(host: string): boolean {
  const h = (host || "").toLowerCase();
  if (!h) return false;
  return WEB3_KEYWORDS.some((k) => h.includes(k));
}

/** Map host to interest category (e.g. opensea.io -> NFT). */
function domainToInterestCategory(host: string): string | undefined {
  const h = (host || "").toLowerCase();
  if (!h) return undefined;
  for (const [key, category] of Object.entries(INTEREST_MAP)) {
    if (h.includes(key.toLowerCase()) || h.endsWith("." + key.toLowerCase())) return category;
  }
  return undefined;
}

async function endSessionAndTrack(tabId: number) {
  const s = tabSessions.get(tabId);
  tabSessions.delete(tabId);
  if (!s) return;
  try {
    const durationSec = Math.max(0, Math.round((Date.now() - s.startTime) / 1000));
    if (durationSec > 0 && (await getSettings()).cloudIntelOptIn !== false) {
      await telemetry.trackSession({ domain: s.domain, referrer: s.referrer, durationSec });
    }
  } catch {
    // silent
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
            telemetry.trackInterest(category).catch(() => {});
            chrome.storage.local.get("sg_user_interest_tags", (r) => {
              const arr = Array.isArray((r as any)?.sg_user_interest_tags) ? (r as any).sg_user_interest_tags : [];
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
        // Marketing toast: only on allowlisted or Web3 domains (non-blocking)
        getSettings()
          .then((settings) => {
            const allowlist = settings?.allowlist || [];
            const trusted = [...allowlist, ...(settings?.trustedDomains || [])];
            if (!isAllowlisted(host, trusted) && !isWeb3RelevantDomain(host)) return null;
            return Promise.all([canShowAd(), getEligibleCampaign()]).then(([can, campaign]) =>
              can && campaign ? { campaign } : null
            );
          })
          .then((result) => {
            if (!result?.campaign) return;
            const campaign = result.campaign;
            markAdShown().catch(() => {});
            trackAdEvent(campaign.id, "VIEW").catch(() => {});
            chrome.tabs.sendMessage(tabId, {
              type: "SHOW_MARKETING_TOAST",
              payload: {
                id: campaign.id,
                title: campaign.title,
                body: campaign.body,
                cta_text: campaign.cta_text || "Saber mais",
                link: campaign.link,
                icon: campaign.icon,
              },
            }).catch(() => {});
          })
          .catch(() => {});
      } catch {
        // ignore invalid url
      }
    }
  } catch {
    // must not break extension
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  endSessionAndTrack(tabId).catch(() => {});
});

/** Returns true if this request is a sendTransaction targeting a contract in the vault (Cofre). */
function isVaultLockedContract(settings: Settings, req: AnalyzeRequest): boolean {
  const vault = settings.vault;
  if (!vault?.enabled || !Array.isArray(vault.lockedContracts) || vault.lockedContracts.length === 0) return false;
  const method = String(req?.request?.method ?? "").toLowerCase();
  if (method !== "eth_sendtransaction" && method !== "wallet_sendtransaction") return false;
  const params = req?.request?.params;
  const tx = Array.isArray(params) && params[0] && typeof params[0] === "object" ? params[0] : null;
  if (!tx) return false;
  const to = typeof (tx as any).to === "string" ? (tx as any).to.trim() : "";
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

function domainHeuristicsLocalized(host: string): { level: "LOW" | "WARN"; reasons: string[] } {
  const h = (host || "").toLowerCase();
  const reasons: string[] = [];
  if (!h) return { level: "LOW", reasons };

  if (h.startsWith("xn--") || h.includes(".xn--")) reasons.push(t("domainPunycodeReason"));
  if (h.includes("--")) reasons.push(t("domainDoubleDashReason"));
  if (/\d{2,}/.test(h)) reasons.push(t("domainNumberPatternReason"));

  const suspects = [
    { legit: "uniswap.org", typos: ["uniswa", "un1swap", "unlswap", "uniswap-app"] },
    { legit: "opensea.io", typos: ["opensea-", "open-sea", "0pensea"] },
  ];
  for (const s of suspects) {
    if (s.typos.some((tt) => h.includes(tt))) reasons.push(t("domainLookalikeReason", s.legit));
  }

  return { level: reasons.length ? "WARN" : "LOW", reasons };
}

function summarizeTx(method: string, params: any[]): any | null {
  const m = String(method || "").toLowerCase();
  if (m !== "eth_sendtransaction" && m !== "wallet_sendtransaction") return null;
  const tx = params?.[0];
  if (!tx || typeof tx !== "object") return null;

  const to = typeof (tx as any).to === "string" ? (tx as any).to : "";
  const data = typeof (tx as any).data === "string" ? (tx as any).data : "";
  const valueWei = hexToBigInt((tx as any).value || "0x0");
  const valueEth = weiToEth(valueWei);

  const gasLimit = hexToBigInt((tx as any).gas || (tx as any).gasLimit || "0x0");
  const maxFeePerGas = hexToBigInt((tx as any).maxFeePerGas || "0x0");
  const gasPrice = hexToBigInt((tx as any).gasPrice || "0x0");

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

  const selector =
    data && data.startsWith("0x") && data.length >= 10 ? data.slice(0, 10) : "";

  const contractNameHint = to && data && data !== "0x" && data.toLowerCase() !== "0x" ? shortAddr(to) : undefined;
  return { to, valueEth, maxGasFeeEth, maxTotalEth, selector, feeKnown, contractNameHint };
}

function isProtectionPaused(settings: Settings): boolean {
  const until = settings.pausedUntil;
  return typeof until === "number" && Number.isFinite(until) && Date.now() < until;
}

function applyPolicy(analysis: Analysis, settings: Settings): void {
  if (isProtectionPaused(settings)) {
    (analysis as Analysis).protectionPaused = true;
    analysis.recommend = "ALLOW";
    analysis.score = 0;
    analysis.reasons = [t("mode_off_reason")];
    return;
  }
  const mode = (settings.mode || "BALANCED") as SecurityMode;
  if (mode === "OFF") {
    analysis.recommend = "ALLOW";
    analysis.score = 0;
    analysis.reasons = [t("mode_off_reason")];
    return;
  }
  const decoded = analysis.decodedAction as DecodedAction | undefined;
  // Phishing always blocked regardless of mode (STRICT/BALANCED/RELAXED)
  if (analysis.isPhishing) { analysis.recommend = "BLOCK"; return; }
  if (mode === "STRICT") {
    if (decoded?.kind === "SET_APPROVAL_FOR_ALL" && decoded.approved && (settings.strictBlockSetApprovalForAll ?? true)) { analysis.recommend = "BLOCK"; return; }
    if (decoded?.kind === "APPROVE_ERC20" && decoded.amountType === "UNLIMITED" && (settings.strictBlockApprovalsUnlimited ?? true)) { analysis.recommend = "BLOCK"; return; }
    if (decoded?.kind === "PERMIT_EIP2612" && decoded.valueType === "UNLIMITED" && (settings.strictBlockPermitLike ?? true)) { analysis.recommend = "BLOCK"; return; }
    if (analysis.flaggedAddress) { analysis.recommend = "BLOCK"; return; }
  }
  if (mode === "BALANCED") {
    if (analysis.flaggedAddress) { analysis.recommend = "HIGH"; return; }
    if ((decoded?.kind === "APPROVE_ERC20" && decoded.amountType === "UNLIMITED") || (decoded?.kind === "SET_APPROVAL_FOR_ALL" && decoded?.approved)) {
      if (analysis.recommend !== "BLOCK") analysis.recommend = "HIGH";
    }
  }
  if (mode === "RELAXED") {
    // Reduces friction, phishing still BLOCK (handled above)
    if (analysis.flaggedAddress) { analysis.recommend = "HIGH"; return; }
    // Don't auto-BLOCK approvals in RELAXED
  }
}

function chainName(chainIdHex: string): string {
  const id = String(chainIdHex || "").toLowerCase();
  const map: Record<string,string> = {
    "0x1":"Ethereum",
    "0x89":"Polygon",
    "0xa4b1":"Arbitrum",
    "0xa":"Optimism",
    "0x38":"BNB Chain",
    "0xa86a":"Avalanche"
  };
  return map[id] || chainIdHex;
}

function intentFromTxDataAndValue(data: string, valueWei: bigint, selector: string): Intent {
  const dataNorm = typeof data === "string" ? data : "";
  const hasData = !!dataNorm && dataNorm !== "0x" && dataNorm.toLowerCase() !== "0x";
  const hasValue = valueWei > 0n;

  if (hasData && hasValue) return "CONTRACT_INTERACTION";
  if (hasData) return "CONTRACT_INTERACTION";
  if (!hasData && hasValue) return "ETH_TRANSFER";

  const s = String(selector || "").toLowerCase();
  if (!s || !s.startsWith("0x") || s.length !== 10) return "UNKNOWN";
  if (s === "0x095ea7b3" || s === "0xa22cb465") return "APPROVAL";

  const swap = new Set([
    "0x38ed1739", "0x7ff36ab5", "0x18cbafe5", "0x04e45aaf", "0xb858183f", "0x5023b4df", "0x09b81346",
  ]);
  if (swap.has(s)) return "SWAP";

  const seaport = new Set([
    "0xfb0f3ee1", "0xb3a34c4c", "0xed98a574", "0xf2d12b12",
  ]);
  if (seaport.has(s)) return "NFT_PURCHASE";

  return "CONTRACT_INTERACTION";
}

function intentFromSelector(selector: string): Intent {
  const s = String(selector || "").toLowerCase();
  if (!s || !s.startsWith("0x") || s.length !== 10) return "UNKNOWN";
  if (s === "0x095ea7b3" || s === "0xa22cb465") return "APPROVAL";

  const swap = new Set([
    "0x38ed1739", "0x7ff36ab5", "0x18cbafe5", "0x04e45aaf", "0xb858183f", "0x5023b4df", "0x09b81346",
  ]);
  if (swap.has(s)) return "SWAP";

  const seaport = new Set([
    "0xfb0f3ee1", "0xb3a34c4c", "0xed98a574", "0xf2d12b12",
  ]);
  if (seaport.has(s)) return "NFT_PURCHASE";

  return "CONTRACT_INTERACTION";
}

function addChecksAndVerdict(
  analysis: Analysis,
  ctx: { req: AnalyzeRequest; settings: Settings; intel: ThreatIntel | null }
): void {
  const host = hostFromUrl(ctx.req.url);
  const method = (ctx.req.request?.method || "").toLowerCase();
  const intelEnabled = ctx.settings.enableIntel !== false;
  const checks: CheckResult[] = [];

  // DOMAIN_INTEL
  if (!ctx.settings.domainChecks) {
    checks.push({ key: "DOMAIN_INTEL" as CheckKey, status: "SKIP" });
  } else if (analysis.isPhishing) {
    checks.push({ key: "DOMAIN_INTEL" as CheckKey, status: "FAIL" });
  } else if (host && intelEnabled && ctx.intel && (analysis.safeDomain || analysis.trust?.verdict === "LIKELY_OFFICIAL")) {
    checks.push({ key: "DOMAIN_INTEL" as CheckKey, status: "PASS" });
  } else if (host) {
    checks.push({ key: "DOMAIN_INTEL" as CheckKey, status: "WARN", noteKey: "coverage_limited" });
  } else {
    checks.push({ key: "DOMAIN_INTEL" as CheckKey, status: "SKIP" });
  }

  // LOOKALIKE
  if (!host) {
    checks.push({ key: "LOOKALIKE" as CheckKey, status: "SKIP" });
  } else if ((analysis.reasons || []).some((r) => String(r).toLowerCase().includes("lookalike") || String(r).toLowerCase().includes("imitation"))) {
    checks.push({ key: "LOOKALIKE" as CheckKey, status: "WARN" });
  } else {
    checks.push({ key: "LOOKALIKE" as CheckKey, status: "PASS" });
  }

  // TX_DECODE (relevant for tx/sign)
  const intent = analysis.intent;
  if (method.includes("sendtransaction") || method.includes("signtypeddata") || method.includes("sign")) {
    if (intent && intent !== "UNKNOWN") {
      checks.push({ key: "TX_DECODE" as CheckKey, status: "PASS" });
    } else {
      checks.push({ key: "TX_DECODE" as CheckKey, status: "WARN" });
    }
  } else {
    checks.push({ key: "TX_DECODE" as CheckKey, status: "SKIP" });
  }

  // FEE_ESTIMATE
  const feeKnown = !!(analysis.txCostPreview?.feeEstimated || (analysis.tx as any)?.feeKnown);
  if (method.includes("sendtransaction")) {
    checks.push({ key: "FEE_ESTIMATE" as CheckKey, status: feeKnown ? "PASS" : "WARN", noteKey: feeKnown ? undefined : "fee_unknown_wallet_will_estimate" });
  } else {
    checks.push({ key: "FEE_ESTIMATE" as CheckKey, status: "SKIP" });
  }

  // ADDRESS_INTEL
  if (!(ctx.settings.addressIntelEnabled ?? true)) {
    checks.push({ key: "ADDRESS_INTEL" as CheckKey, status: "SKIP" });
  } else if (analysis.flaggedAddress) {
    checks.push({ key: "ADDRESS_INTEL" as CheckKey, status: "FAIL" });
  } else if (method.includes("sendtransaction") || method.includes("signtypeddata")) {
    checks.push({ key: "ADDRESS_INTEL" as CheckKey, status: "PASS" });
  } else {
    checks.push({ key: "ADDRESS_INTEL" as CheckKey, status: "SKIP" });
  }

  // ASSET_ENRICH
  if (!(ctx.settings.assetEnrichmentEnabled ?? true)) {
    checks.push({ key: "ASSET_ENRICH" as CheckKey, status: "SKIP" });
  } else if (analysis.asset?.symbol != null || analysis.asset?.name != null) {
    checks.push({ key: "ASSET_ENRICH" as CheckKey, status: "PASS" });
  } else if (method.includes("sendtransaction") && analysis.decodedAction) {
    checks.push({ key: "ASSET_ENRICH" as CheckKey, status: "WARN" });
  } else {
    checks.push({ key: "ASSET_ENRICH" as CheckKey, status: "SKIP" });
  }

  // CLOUD_INTEL (not implemented yet)
  checks.push({ key: "CLOUD_INTEL" as CheckKey, status: "SKIP" });

  const total = checks.length;
  const performed = checks.filter((c) => c.status !== "SKIP").length;
  const limited = checks.some((c) => c.status === "WARN" && (c.noteKey === "fee_unknown_wallet_will_estimate" || c.key === "DOMAIN_INTEL" || c.key === "ASSET_ENRICH"));

  let verdictLabelKey: string;
  if (analysis.recommend === "BLOCK") verdictLabelKey = "verdict_block";
  else if (analysis.score <= 20 && !checks.some((c) => c.status === "FAIL")) verdictLabelKey = "verdict_ok";
  else if (analysis.score <= 60) verdictLabelKey = "verdict_warn";
  else verdictLabelKey = "verdict_high";

  (analysis as Analysis).checks = checks;
  (analysis as Analysis).coverage = { performed, total, limited };
  (analysis as Analysis).verdictLabelKey = verdictLabelKey;
}

/** Run Tenderly simulation for eth_sendTransaction and merge outcome into analysis. */
async function enrichWithSimulation(req: AnalyzeRequest, analysis: Analysis, settings: Settings): Promise<void> {
  const method = (req?.request?.method || "").toLowerCase();
  if (!method.includes("sendtransaction")) return;

  const params = req?.request?.params;
  const tx = Array.isArray(params) && params[0] && typeof params[0] === "object" ? params[0] as Record<string, unknown> : null;
  if (!tx) return;

  const from = typeof tx.from === "string" ? tx.from : "0x0000000000000000000000000000000000000000";
  const to = typeof tx.to === "string" ? tx.to : "0x0000000000000000000000000000000000000000";
  const input = typeof tx.data === "string" ? tx.data : "0x";
  const value = typeof tx.value === "string" ? tx.value : "0x0";
  let gas: number | undefined;
  if (typeof tx.gas === "string" && tx.gas.startsWith("0x")) {
    try { gas = parseInt(tx.gas, 16); } catch {}
  } else if (typeof tx.gas === "number") gas = tx.gas;

  const rawChainId = req?.meta?.chainId ?? (req as any)?.chainId ?? "1";
  const networkId = String(rawChainId).replace(/^0x/, "");

  try {
    const outcome = await runSimulation(networkId, from, to, input, value, gas, settings);
    if (!outcome) return;

    analysis.simulationOutcome = outcome;

    if (settings.cloudIntelOptIn !== false) {
      try {
        let valueUsd: number | undefined;
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
          valueUsd,
        });
      } catch {
        // silent
      }
    }

    try {
      const gasCostWei = (outcome as any).gasCostWei;
      if (gasCostWei && typeof gasCostWei === "string") {
        const usdPerEth = await getEthUsdPriceCached();
        if (usdPerEth != null && usdPerEth > 0) {
          const valueWei = hexToBigInt(value || "0x0");
          const gasCostNum = BigInt(gasCostWei);
          const gasCostUsd = Number(gasCostNum) / 1e18 * usdPerEth;
          const valueUsd = Number(valueWei) / 1e18 * usdPerEth;
          if (gasCostUsd > 50 && valueUsd < 50) {
            (outcome as any).isHighGas = true;
          }
        }
      }
    } catch {
      // ignore
    }

    if (outcome.status === "REVERT") {
      analysis.simulationRevert = true;
      analysis.reasons.unshift(t("simulation_tx_will_fail"));
      analysis.recommend = "BLOCK";
      analysis.score = Math.max(analysis.score, 100);
      analysis.level = "HIGH";
      analysis.title = t("simulation_tx_will_fail");
    } else if (outcome.status === "SUCCESS") {
      const tokenAddress = (analysis as any).tokenAddress as string | undefined;
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
        // Honeypot check optional
      }
    }
  } catch {
    // Fail silently: overlay works without simulation
  }
}

function setVerificationFields(ctx: {
  host: string;
  intel: ThreatIntel;
  usedCacheOnly: boolean;
  isStale: boolean;
  matchedBad: boolean;
  matchedSeed: boolean;
  signals: string[];
}): Partial<Analysis> {
  const { intel, isStale, matchedBad, matchedSeed, signals } = ctx;
  const hasCache = intel.updatedAt > 0;
  let verificationLevel: "FULL" | "LOCAL" | "BASIC" = "BASIC";
  if (matchedBad) {
    verificationLevel = hasCache ? "FULL" : "BASIC";
    return {
      verificationLevel,
      verificationUpdatedAt: hasCache ? intel.updatedAt : undefined,
      knownBad: true,
      knownSafe: false,
      domainSignals: signals.length ? signals : undefined,
      intelSources: (intel.sources || []).map((s: any) => (typeof s === "string" ? s : s.name || s.id || "")).filter(Boolean),
    };
  }
  if (hasCache && !isStale) verificationLevel = "FULL";
  else if (hasCache && isStale) verificationLevel = "LOCAL";
  else verificationLevel = "BASIC";
  return {
    verificationLevel,
    verificationUpdatedAt: hasCache ? intel.updatedAt : undefined,
    knownSafe: matchedSeed,
    knownBad: false,
    domainSignals: signals.length ? signals : undefined,
    intelSources: (intel.sources || []).map((s: any) => (typeof s === "string" ? s : s.name || s.id || "")).filter(Boolean),
  };
}

function labelsFor(addrIntel: AddressIntel | null | undefined, addr: string): AddressLabel[] {
  const a = normalizeAddr(addr);
  if (!a) return [];
  return (addrIntel?.labelsByAddress?.[a] || []) as AddressLabel[];
}

async function analyze(req: AnalyzeRequest, settings: Settings, intel: ThreatIntel | null, tabId?: number, addrIntel?: AddressIntel | null): Promise<Analysis> {
  const host = hostFromUrl(req.url);
  const reasons: string[] = [];
  let level: Analysis["level"] = "LOW";
  let score = 0;
  let title = "Looks OK";

  const trust = computeTrustVerdict(host, settings.allowlist);
  const explain = explainMethod(req.request?.method || "");
  const lists = buildHumanLists(req.request?.method || "", trust.verdict);

  // List manager: domain/address/token lists (SEED + FEEDS + user overrides)
  let listCache: Awaited<ReturnType<typeof getLists>> | null = null;
  try {
    listCache = await getLists();
  } catch {}
  const listDomainDecision = listCache ? getDomainDecision(host, listCache) : "UNKNOWN" as const;
  if (listDomainDecision === "BLOCKED") {
    return {
      level: "HIGH",
      score: 100,
      title: t("suspiciousWebsitePatterns"),
      reasons: [t("trustReasonPhishingBlacklist"), "Domain is on the blocklist."],
      decoded: { kind: "TX", raw: { host } },
      recommend: "BLOCK",
      trust,
      suggestedTrustedDomains: [...SUGGESTED_TRUSTED_DOMAINS],
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
        recommendation: t("human_generic_reco"),
      },
    };
  }
  const listTrusted = listDomainDecision === "TRUSTED";

  // Domain checks (optional)
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

  // Modo Fortaleza: block token approvals on non-trusted sites
  if (settings.fortressMode === true && (method === "eth_sendtransaction" || method === "wallet_sendtransaction")) {
    const tx = req.request?.params?.[0] as { data?: string } | undefined;
    const data = typeof tx?.data === "string" ? tx.data : "";
    const selector = data && data.length >= 10 ? data.slice(0, 10).toLowerCase() : "";
    const isApproval = selector === "0x095ea7b3" || selector === "0xa22cb465" || selector === "0x39509351";
    if (isApproval) {
      const fortressAllowlist = [
        ...(settings.allowlist || []),
        ...(settings.trustedDomains || []),
        ...(settings.whitelistedDomains || []),
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
          suggestedTrustedDomains: [...SUGGESTED_TRUSTED_DOMAINS],
          safeDomain: false,
          human: {
            methodTitle: explain.title,
            methodShort: explain.short,
            methodWhy: explain.why,
            whatItDoes: lists.whatItDoes,
            risks: lists.risks,
            safeNotes: lists.safeNotes,
            nextSteps: lists.nextSteps,
            recommendation: fortressMsg,
          },
        };
      }
    }
  }

  // Threat intel (blocked/trusted seed) — respect enableIntel; merge user custom lists
  const intelHost = normalizeHost(host || "");
  const customBlocked = (settings.customBlockedDomains || []).map((d) => String(d || "").trim().toLowerCase()).filter(Boolean);
  const customTrusted = (settings.customTrustedDomains || settings.allowlist || []).map((d) => String(d || "").trim().toLowerCase()).filter(Boolean);
  const inCustomBlocked = customBlocked.some((d) => hostMatches(intelHost, d));
  const inCustomTrusted = customTrusted.some((d) => hostMatches(intelHost, d));
  const intelEnabled = settings.enableIntel !== false;
  const isBlocked = inCustomBlocked || (!!intelEnabled && !!intel && hostInBlocked(intel, intelHost));
  const isTrustedSeed = inCustomTrusted || (!!intel && (intel.trustedSeed || (intel as any).trustedDomainsSeed || intel.trustedDomains)?.some?.((d: string) => hostMatches(intelHost, d)));
  const safeDomain = (isTrustedSeed || listTrusted) && !isBlocked;

  // Strong lookalike scoring (always)
  try {
    const brands = ["opensea", "uniswap", "metamask", "blur", "etherscan"];
    const dr = assessDomainRisk(intelHost, brands);
    if (dr.scoreDelta > 0) {
      reasons.push(...dr.reasons);
      score = Math.max(score, clamp01(score + dr.scoreDelta, 0, 100));
      // If we detected lookalike and it's NOT trusted seed, elevate to HIGH (but don't BLOCK by itself)
      const looksLike = dr.reasons.some((r) => String(r || "").toLowerCase().includes("lookalike"));
      if (looksLike && !isTrustedSeed) {
        level = "HIGH";
        score = Math.max(score, 85);
        title = t("suspiciousWebsitePatterns");
      } else if (level !== "HIGH") {
        level = "WARN";
        score = Math.max(score, 45);
        title = t("suspiciousWebsitePatterns");
      }
    }
  } catch {}

  if (isBlocked) {
    return {
      level: "HIGH",
      score: 100,
      title: t("suspiciousWebsitePatterns"),
      reasons: [t("trustReasonPhishingBlacklist"), ...reasons],
      decoded: { kind: "TX", raw: { host } },
      recommend: "BLOCK",
      trust,
      suggestedTrustedDomains: [...SUGGESTED_TRUSTED_DOMAINS],
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
        recommendation: t("human_generic_reco"),
      }
    };
  }

  if (isTrustedSeed || listTrusted) {
    reasons.push(t("trustReasonAllowlisted"));
    score = Math.max(0, score - 15);
  }

  // Solana (solana:connect, solana:signMessage, etc.)
  if (method.startsWith("solana:")) {
    return {
      level: "WARN",
      score: 50,
      title: t("watchAssetTitle"),
      reasons: [t("intent_SOLANA")],
      decoded: { kind: "SIGN", raw: { method, params: req.request.params } },
      recommend: "WARN",
      trust,
      suggestedTrustedDomains: [...SUGGESTED_TRUSTED_DOMAINS],
      intent: "SOLANA",
      human: {
        methodTitle: t("intent_SOLANA"),
        methodShort: t("summary_SOLANA_1"),
        methodWhy: t("explain_generic_why"),
        whatItDoes: [],
        risks: [t("human_generic_risk_1")],
        safeNotes: [t("human_generic_safe_1")],
        nextSteps: [t("human_generic_next_1")],
        recommendation: t("human_generic_reco"),
      },
    };
  }

  // Connect / permissions
  if (method === "eth_requestaccounts" || method === "wallet_requestpermissions") {
    const isPerms = method === "wallet_requestpermissions";
    const baseTitle = isPerms ? t("walletRequestPermissionsTitle") : t("connectTitle");
    const baseReason = isPerms ? t("walletRequestPermissionsReason") : t("connectReason");
    const connectReasons = reasons.length ? reasons.slice() : [baseReason];
    if (settings.showConnectOverlay) {
      // SPEC: if showConnectOverlay=true -> WARN (score >= 30)
      return {
        level: level === "HIGH" ? "HIGH" : "WARN",
        score: Math.max(score, 30),
        title: level === "WARN" ? title : baseTitle,
        reasons: connectReasons,
        decoded: { kind: "CONNECT", raw: { host } },
        recommend: "WARN",
        trust,
        suggestedTrustedDomains: [...SUGGESTED_TRUSTED_DOMAINS],
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
          recommendation:
            trust.verdict === "SUSPICIOUS"
              ? t("human_connect_reco_suspicious")
              : t("human_connect_reco_ok"),
        },
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
      suggestedTrustedDomains: [...SUGGESTED_TRUSTED_DOMAINS],
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
        recommendation:
          trust.verdict === "SUSPICIOUS"
            ? t("human_connect_reco_suspicious")
            : t("human_connect_reco_ok"),
      },
    };
  }

  // Typed data signatures
  if (method === "eth_signtypeddata_v4") {
    reasons.push(t("typedDataWarnReason"));
    if (level !== "HIGH") level = "WARN";
    score = Math.max(score, 60);
    title = t("signatureRequest");

    // Minimal typed-data risk detection (safe parse)
    let permitExtras: { spender?: string; value?: string; deadline?: string } | null = null;
    try {
      const params = req.request.params as any;
      const raw =
        Array.isArray(params) && typeof params[1] === "string"
          ? params[1]
          : (Array.isArray(params) && typeof params[0] === "string" ? params[0] : "");
      if (raw) {
        permitExtras = extractTypedDataPermitExtras(raw);
        if (raw.length > 200_000) {
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
            suggestedTrustedDomains: [...SUGGESTED_TRUSTED_DOMAINS],
            safeDomain,
            human: {
              methodTitle: explain.title,
              methodShort: explain.short,
              methodWhy: explain.why,
              whatItDoes: lists.whatItDoes,
              risks: lists.risks,
              safeNotes: lists.safeNotes,
              nextSteps: lists.nextSteps,
              recommendation:
                trust.verdict === "SUSPICIOUS" ? t("human_sign_reco_suspicious") : t("human_sign_reco_ok"),
            }
          };
        }
        const j: any = JSON.parse(raw);
        const domainName = String(j?.domain?.name || "");
        const msg: any = j?.message || {};

        if (permitExtras) {
          reasons.push(t("permit_signature_detected"));
          if (permitExtras.spender) reasons.push("Verifique o spender.");
          level = "HIGH";
          score = Math.max(score, 90);
        }
        const looksPermit2 = domainName.toLowerCase().includes("permit2") || (!!msg?.permitted && !!msg?.spender);
        const looksApproveLike = !!msg?.spender && (("value" in msg) || ("amount" in msg));
        const looksSeaport = domainName.toLowerCase().includes("seaport") || (!!msg?.offer && !!msg?.consideration);

        if (!permitExtras && (looksPermit2 || looksApproveLike)) {
          reasons.push("Assinatura pode permitir que um endereço gaste seus tokens.");
          if (String(msg?.spender || "").trim()) {
            reasons.push("Verifique o spender.");
            level = "HIGH";
            score = Math.max(score, 90);
          }
        }
        if (looksSeaport) {
          reasons.push("Assinatura é uma ordem de marketplace (pode listar/comprar).");
          score = Math.max(score, 70);
        }
      }
    } catch {}

    const typedDataExtras = permitExtras ? { spender: permitExtras.spender, value: permitExtras.value, deadline: permitExtras.deadline } : undefined;
    return {
      level,
      score,
      title,
      reasons,
      decoded: { kind: "TYPED_DATA", raw: { params: req.request.params } },
      recommend: "WARN",
      trust,
      suggestedTrustedDomains: [...SUGGESTED_TRUSTED_DOMAINS],
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
        recommendation:
          trust.verdict === "SUSPICIOUS" ? t("human_sign_reco_suspicious") : t("human_sign_reco_ok"),
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
      suggestedTrustedDomains: [...SUGGESTED_TRUSTED_DOMAINS],
      human: {
        methodTitle: explain.title,
        methodShort: explain.short,
        methodWhy: explain.why,
        whatItDoes: lists.whatItDoes,
        risks: lists.risks,
        safeNotes: lists.safeNotes,
        nextSteps: lists.nextSteps,
        recommendation:
          trust.verdict === "SUSPICIOUS" ? t("human_sign_reco_suspicious") : t("human_sign_reco_ok"),
      }
    };
  }

  // wallet_switchethereumchain
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
      suggestedTrustedDomains: [...SUGGESTED_TRUSTED_DOMAINS],
      safeDomain,
      intent: "SWITCH_CHAIN",
      chainTarget: (() => {
        try {
          const p0 = (req.request.params as any)?.[0];
          const chainIdHex = String(p0?.chainId || "");
          if (!chainIdHex) return undefined;
          return { chainIdHex, chainName: chainName(chainIdHex) };
        } catch { return undefined; }
      })(),
      human: {
        methodTitle: explain.title,
        methodShort: explain.short,
        methodWhy: explain.why,
        whatItDoes: lists.whatItDoes,
        risks: lists.risks,
        safeNotes: lists.safeNotes,
        nextSteps: lists.nextSteps,
        recommendation: t("human_chain_reco"),
      }
    };
  }

  // wallet_addEthereumChain
  if (method === "wallet_addethereumchain") {
    reasons.push(t("add_chain_review_rpc"));
    reasons.push(t("add_chain_verify_chainid"));
    if (level !== "HIGH") level = "WARN";
    score = Math.max(score, 45);
    title = t("chainChangeTitle");
    const p0 = (req.request.params as any)?.[0];
    const addChainInfo = p0 ? {
      chainId: String(p0.chainId || ""),
      chainName: String(p0.chainName || ""),
      rpcUrls: Array.isArray(p0.rpcUrls) ? p0.rpcUrls : (p0.rpcUrls ? [p0.rpcUrls] : []),
      nativeCurrencySymbol: p0?.nativeCurrency?.symbol ? String(p0.nativeCurrency.symbol) : undefined,
    } : undefined;
    return {
      level,
      score,
      title,
      reasons,
      decoded: { kind: "TX", raw: { params: req.request.params } },
      recommend: "WARN",
      trust,
      suggestedTrustedDomains: [...SUGGESTED_TRUSTED_DOMAINS],
      safeDomain,
      intent: "ADD_CHAIN",
      chainTarget: addChainInfo ? { chainIdHex: addChainInfo.chainId, chainName: addChainInfo.chainName } : undefined,
      addChainInfo,
      human: {
        methodTitle: explain.title,
        methodShort: t("explain_add_chain_short"),
        methodWhy: explain.why,
        whatItDoes: lists.whatItDoes,
        risks: lists.risks,
        safeNotes: lists.safeNotes,
        nextSteps: lists.nextSteps,
        recommendation: t("human_chain_reco"),
      }
    };
  }

  // wallet_watchAsset
  if (method === "wallet_watchasset") {
    reasons.push(t("watch_asset_no_spend_but_risk"));
    reasons.push(t("watch_asset_verify_contract"));
    if (level !== "HIGH") level = "WARN";
    score = Math.max(score, 40);
    title = t("watchAssetTitle");
    const p0 = (req.request.params as any)?.[0];
    const opts = p0?.options || p0;
    const watchAssetInfo = opts ? {
      type: String(opts.type || "ERC20"),
      address: typeof opts.address === "string" ? opts.address : undefined,
      symbol: typeof opts.symbol === "string" ? opts.symbol : undefined,
      decimals: typeof opts.decimals === "number" ? opts.decimals : undefined,
      image: typeof opts.image === "string" ? opts.image : undefined,
    } : undefined;
    return {
      level,
      score,
      title,
      reasons,
      decoded: { kind: "TX", raw: { params: req.request.params } },
      recommend: "WARN",
      trust,
      suggestedTrustedDomains: [...SUGGESTED_TRUSTED_DOMAINS],
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
        recommendation: t("human_watchasset_reco"),
      }
    };
  }

  // Transactions
  if (method === "eth_sendtransaction" || method === "wallet_sendtransaction") {
    await initTokenSecurity().catch(() => {});
    const tx = (req.request.params?.[0] ?? {}) as any;
    const to = (tx.to ?? "").toLowerCase();
    const data = typeof tx.data === "string" ? tx.data : "";
    const value = tx.value ?? "0x0";
    const txSummary = summarizeTx(method, (req.request.params || []) as any) as (TxSummary | null);
    const selector = (txSummary?.selector || "").toLowerCase();
    const chainId = (req.meta?.chainId ?? "").toString().toLowerCase() || undefined;
    const decodedAction = isHexString(data) && data.startsWith("0x") ? decodeTx(data.toLowerCase(), to) : null;
    const valueWei = hexToBigInt((tx as any).value || "0x0");
    let intent: Intent = decodedAction
      ? (decodedAction.kind === "APPROVE_ERC20" || decodedAction.kind === "SET_APPROVAL_FOR_ALL" || decodedAction.kind === "PERMIT_EIP2612"
          ? "APPROVAL"
          : decodedAction.kind === "TRANSFER_ERC20" || decodedAction.kind === "TRANSFERFROM_ERC20"
          ? "TOKEN_TRANSFER"
          : decodedAction.kind === "TRANSFER_NFT"
          ? "NFT_TRANSFER"
          : intentFromTxDataAndValue(data, valueWei, selector))
      : intentFromTxDataAndValue(data, valueWei, selector);
    let txExtras: TxExtras | undefined;
    let flaggedAddr: ThreatIntelAddress | undefined;
    let asset: AssetInfo | null = null;

    const tokenAddr = getTokenAddressForTx(to, decodedAction);
    const tokenInfo = tokenAddr ? getTokenInfo(tokenAddr) : undefined;
    const tokenMeta = tokenAddr
      ? {
          tokenVerified: tokenInfo?.v ?? false,
          tokenAddress: tokenAddr,
          tokenSymbol: tokenInfo?.s,
          tokenLogoUri: tokenInfo?.l || undefined,
        }
      : {};

    const labelsTo = (settings.addressIntelEnabled ?? true) ? labelsFor(addrIntel ?? null, to) : [];
    const labelsSpender = (settings.addressIntelEnabled ?? true) && decodedAction && "spender" in decodedAction ? labelsFor(addrIntel ?? null, decodedAction.spender || "") : [];
    const labelsOperator = (settings.addressIntelEnabled ?? true) && decodedAction && "operator" in decodedAction ? labelsFor(addrIntel ?? null, decodedAction.operator || "") : [];
    const labelsTokenContract = (settings.addressIntelEnabled ?? true) && decodedAction && "token" in decodedAction ? labelsFor(addrIntel ?? null, decodedAction.token || to) : [];
    const hasAddrIntelHit = labelsTo.length > 0 || labelsSpender.length > 0 || labelsOperator.length > 0 || labelsTokenContract.length > 0;
    const addrIntelReasons: string[] = [];
    let addrIntelScore = 0;
    let addrIntelRecommend: Analysis["recommend"] | undefined;
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
    const addressIntelPartial = hasAddrIntelHit
      ? {
          addressIntelHit: true as const,
          addressIntel: {
            to: labelsTo.map(String),
            spender: labelsSpender.map(String),
            operator: labelsOperator.map(String),
            tokenContract: labelsTokenContract.map(String),
          },
        }
      : {};

    if (decodedAction && (settings.addressIntelEnabled ?? true)) {
      const candidates: string[] = [to];
      if ("spender" in decodedAction && decodedAction.spender) candidates.push(decodedAction.spender);
      if ("operator" in decodedAction && decodedAction.operator) candidates.push(decodedAction.operator);
      if ("to" in decodedAction && decodedAction.to) candidates.push(decodedAction.to);
      if ("from" in decodedAction && decodedAction.from) candidates.push(decodedAction.from);
      const blocked = (intel as any)?.blockedAddressesList || (intel as any)?.blockedAddresses || [];
      for (const addr of candidates) {
        const a = addr.toLowerCase();
        if (!a || a.length < 40) continue;
        const match = blocked.find((b) => b.address.toLowerCase() === a && (!b.chainId || b.chainId.toLowerCase() === (chainId || "")));
        if (match) { flaggedAddr = match; reasons.unshift(t("address_flagged_reason", { label: match.label, category: match.category })); break; }
        if (listCache && isBlockedAddress(a, listCache)) {
          reasons.unshift("Address is on the blocklist.");
          level = "HIGH";
          score = Math.max(score, 95);
          flaggedAddr = { address: a, label: "Blocklist", category: "blocklist" };
          break;
        }
      }
    }

    const tokenForAsset = decodedAction && ("token" in decodedAction && decodedAction.token) ? decodedAction.token : to;
    const chainIdHex = (chainId || "0x1").startsWith("0x") ? (chainId || "0x1") : "0x" + (chainId || "1");
    if (listCache && tokenForAsset && isScamToken(chainIdHex, tokenForAsset, listCache)) {
      reasons.unshift("Token contract is marked as scam / suspicious.");
      level = "HIGH";
      score = Math.max(score, 95);
    }
    if (decodedAction && tokenForAsset && (settings.assetEnrichmentEnabled ?? true) && tabId) {
      try { asset = await getAssetInfo(chainId || "0x1", tokenForAsset, tabId); } catch {}
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
            tokenContract: typeof (tx as any).to === "string" ? String((tx as any).to) : undefined,
            spender: ap.spender,
            unlimited: true,
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
            decodedAction: decodedAction?.kind === "APPROVE_ERC20" ? decodedAction : undefined,
            recommend: addrIntelRecommend ?? (settings.blockHighRisk ? "BLOCK" : "WARN"),
            trust,
            suggestedTrustedDomains: [...SUGGESTED_TRUSTED_DOMAINS],
            tx: txSummary,
            txExtras,
            intent: "APPROVAL",
            asset: asset || undefined,
            flaggedAddress: flaggedAddr,
            provider: req.providerHint ? { kind: req.providerHint.kind as any, name: req.providerHint.name } : undefined,
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
              links: [{ text: t("human_revoke_link_text"), href: "https://revoke.cash" }],
            }
          };
        } else {
          reasons.push(t("tokenApproval"));
          level = "WARN";
          score = Math.max(score, 40);
          title = t("tokenApproval");
          txExtras = {
            approvalType: "ERC20_APPROVE",
            tokenContract: typeof (tx as any).to === "string" ? String((tx as any).to) : undefined,
            spender: ap.spender,
            unlimited: false,
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
            decodedAction: decodedAction?.kind === "APPROVE_ERC20" ? decodedAction : undefined,
            recommend: addrIntelRecommend ?? "WARN",
            trust,
            suggestedTrustedDomains: [...SUGGESTED_TRUSTED_DOMAINS],
            tx: txSummary,
            txExtras,
            intent: "APPROVAL",
            asset: asset || undefined,
            flaggedAddress: flaggedAddr,
            provider: req.providerHint ? { kind: req.providerHint.kind as any, name: req.providerHint.name } : undefined,
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
              links: [{ text: t("human_revoke_link_text"), href: "https://revoke.cash" }],
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
          tokenContract: typeof (tx as any).to === "string" ? String((tx as any).to) : undefined,
          operator: sa.operator,
          unlimited: true,
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
          decodedAction: decodedAction?.kind === "SET_APPROVAL_FOR_ALL" ? decodedAction : undefined,
          recommend: addrIntelRecommend ?? (settings.blockHighRisk ? "BLOCK" : "WARN"),
          trust,
          suggestedTrustedDomains: [...SUGGESTED_TRUSTED_DOMAINS],
          tx: txSummary,
          txExtras,
          intent: "APPROVAL",
          asset: asset || undefined,
          flaggedAddress: flaggedAddr,
          provider: req.providerHint ? { kind: req.providerHint.kind as any, name: req.providerHint.name } : undefined,
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
            links: [{ text: t("human_revoke_link_text"), href: "https://revoke.cash" }],
          }
        };
      }
    }

    if (decodedAction?.kind === "TRANSFER_NFT" && !txExtras) {
      txExtras = {
        approvalType: "NFT_TRANSFER",
        tokenContract: decodedAction.token,
        toAddress: decodedAction.to,
      };
    }

    if (decodedAction) {
      if (decodedAction.kind === "APPROVE_ERC20" || decodedAction.kind === "PERMIT_EIP2612") reasons.push(t("reason_permission_tokens"));
      else if (decodedAction.kind === "SET_APPROVAL_FOR_ALL" && decodedAction.approved) reasons.push(t("reason_permission_all_nfts"));
      else if (decodedAction.kind === "TRANSFER_ERC20" || decodedAction.kind === "TRANSFERFROM_ERC20") reasons.push(t("token_transfer_detected"));
      else if (decodedAction.kind === "TRANSFER_NFT") reasons.push(t("nft_transfer_detected"));
      else if (decodedAction.kind !== "UNKNOWN") reasons.push(t("reason_transfer_tokens"));
    }
    // Default tx
    if (level === "LOW") {
      title = t("txPreview");
      score = 20;
      reasons.push(t("txWarnReason"));
    }
    if (txSummary?.valueEth) reasons.push(`Transação: envia ${txSummary.valueEth} ETH.`);
    if (txSummary?.feeKnown) {
      if (txSummary.maxGasFeeEth) reasons.push(`Taxa máxima: ${txSummary.maxGasFeeEth} ETH.`);
      if (txSummary.maxTotalEth) reasons.push(`Total máximo: ${txSummary.maxTotalEth} ETH.`);
    } else {
      reasons.push(t("fee_unknown_wallet_will_estimate"));
      reasons.push(t("check_wallet_network_fee"));
    }
    const feeGtValue = !!(txSummary?.feeKnown && txSummary.maxGasFeeEth && txSummary.valueEth && parseFloat(txSummary.maxGasFeeEth) > parseFloat(txSummary.valueEth));
    if (feeGtValue) reasons.unshift(t("fee_gt_value"));
    const toIsContract = await getToIsContract(to || undefined, tabId);
    const defaultRecommend = level === "HIGH" ? (settings.blockHighRisk ? "BLOCK" : "WARN") : (level === "WARN" ? "WARN" : "ALLOW");
    return {
      level: hasAddrIntelHit && addrIntelRecommend === "BLOCK" ? "HIGH" : level,
      score: Math.max(score, addrIntelScore),
      title,
      reasons: hasAddrIntelHit ? [...addrIntelReasons, ...reasons] : reasons,
      decoded: { kind: "TX", raw: { to, value, selector: hexSelector(data) } },
      decodedAction: decodedAction || undefined,
      recommend: addrIntelRecommend ?? defaultRecommend,
      trust,
      suggestedTrustedDomains: [...SUGGESTED_TRUSTED_DOMAINS],
      tx: txSummary || undefined,
      txExtras,
      intent,
      safeDomain,
      asset: asset || undefined,
      flaggedAddress: flaggedAddr,
      provider: req.providerHint ? { kind: req.providerHint.kind as any, name: req.providerHint.name } : undefined,
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
        recommendation: trust.verdict === "SUSPICIOUS" ? t("human_tx_reco_suspicious") : t("human_tx_reco_ok"),
      }
    };
  }

  // Unknown method: allow
  return {
    level,
    score,
    title: level === "WARN" ? title : "Request",
    reasons: reasons.length ? reasons : [t("unknownMethodReason")],
    decoded: { kind: "TX", raw: { method: req.request.method } },
    recommend: level === "WARN" ? "WARN" : "ALLOW"
    ,
    trust,
    suggestedTrustedDomains: [...SUGGESTED_TRUSTED_DOMAINS],
    human: {
      methodTitle: explain.title,
      methodShort: explain.short,
      methodWhy: explain.why,
      whatItDoes: lists.whatItDoes,
      risks: lists.risks,
      safeNotes: lists.safeNotes,
      nextSteps: lists.nextSteps,
      recommendation: t("human_generic_reco"),
    }
  };
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  console.log("⚙️ [SignGuard Background] Message received:", msg?.type, msg);
  if (!msg || typeof msg !== "object" || !msg.type) {
    try { sendResponse({ ok: false, error: "INVALID_MESSAGE" }); } catch {}
    return false;
  }
  if (msg.type === "PING") return false;
  handleBgRequest(msg, sender).then(sendResponse).catch((err) => {
    try { sendResponse({ ok: false, error: String((err as Error)?.message || err) }); } catch {}
  });
  return true;
});
