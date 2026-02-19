console.log("🚨 [SignGuard Background] Service Worker LOADED via " + new Date().toISOString());

import type { AnalyzeRequest, Analysis, Settings, AssetInfo, DecodedAction, SecurityMode, ThreatIntelAddress, CheckResult, CheckKey, PlanState, TxSummaryV1 } from "./shared/types";
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
import { decodeEvmTx, extractTypedDataPermitExtras, extractPermit2FromTypedData, extractSeaportFromTypedData, isBlurTypedData } from "./txHumanize";
import { hexToBigInt, weiToEth } from "./txMath";
import { assessDomainRisk } from "./domainRisk";
import { runSimulation } from "./services/simulationService";
import { runHoneypotCheck } from "./services/honeypotService";
import { initTokenSecurity, getTokenInfo, getTokenAddressForTx, markTokenSeen, getTokenFirstSeen } from "./services/tokenSecurity";
import { extractTokenCandidates, getTokenRisk } from "./services/tokenRisk";
import { getLists, refresh as refreshLists, getDomainDecision, isBlockedAddress, isScamToken, isTrustedToken, upsertUserOverride, deleteUserOverride, normalizeOverridePayload, setOverrides, exportSnapshot } from "./services/listManager";
import { getNativeUsd, getTokenUsd } from "./services/priceService";
import { getTokenMetaViaProvider } from "./services/tokenMetaViaProvider";
import { initTelemetry, telemetry } from "./services/telemetryService";
import { INTEREST_MAP } from "./shared/interestMap";
import { REASON_KEYS } from "./shared/reasonKeys";
import { normalizeTypedDataParams, isTypedDataMethod } from "./shared/normalize";
import { hasOptionalHostPermissions, hasOptionalHostPermissionsAll, requestOptionalHostPermissionsOrigins } from "./permissions";
import { getAllOptionalOrigins } from "./shared/optionalOrigins";
import { canUseNetwork } from "./services/netGate";

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
        const s = await getSettings();
        if (!(await canUseNetwork("pricing", s)).ok) return { ok: false };
        const usdPerEth = await getEthUsdPriceCached();
        if (usdPerEth != null) return { ok: true, usdPerEth, ethUsd: usdPerEth, updatedAt: __ethUsdCache?.fetchedAt ?? Date.now() };
        return { ok: false };
      }
      case "SG_GET_NATIVE_USD": {
        const s = await getSettings();
        if (!(await canUseNetwork("pricing", s)).ok) return { ok: false };
        const chainIdHex = msg.payload?.chainIdHex ?? "0x1";
        const result = await getNativeUsd(chainIdHex);
        if (result?.ok && result.usdPerNative != null) return { ok: true, usdPerNative: result.usdPerNative, nativeSymbol: result.nativeSymbol };
        return { ok: false };
      }
      case "SG_GET_TOKEN_USD": {
        const s = await getSettings();
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
          rpc: (method, params) => rpcCallFull(tabId, method, params),
        });
        if (result.ok) {
          __tokenMetaCache.set(cacheKey, { expiresAt: Date.now() + TOKEN_META_CACHE_TTL_MS, value: result });
          evictTokenMetaCacheIfNeeded();
          return { ok: true, symbol: result.symbol, decimals: result.decimals, name: result.name };
        }
        return { ok: false, reason: (result as { reason?: string }).reason ?? "PROVIDER_CALL_FAILED" };
      }
      case "SG_DIAG_PUSH": {
        const p = msg.payload ?? {};
        diagPush({ src: (p.src as DiagEvent["src"]) ?? "content", kind: String(p.kind ?? ""), requestId: p.requestId, method: p.method, host: p.host, level: p.level, recommend: p.recommend, decision: p.decision, extra: typeof p.extra === "object" ? p.extra : undefined });
        return { ok: true };
      }
      case "SG_DIAG_EXPORT": {
        const manifest = chrome.runtime.getManifest();
        const settings = await getSettings();
        const settingsSnapshot: Record<string, unknown> = { riskWarnings: settings.riskWarnings, mode: settings.mode, failMode: settings.failMode, cloudIntelOptIn: settings.cloudIntelOptIn, telemetryOptIn: settings.telemetryOptIn, simulationEnabled: settings.simulation?.enabled };
        if (settings.simulation?.tenderlyAccount) settingsSnapshot.tenderlyAccount = "[REDACTED]";
        if (settings.simulation?.tenderlyProject) settingsSnapshot.tenderlyProject = "[REDACTED]";
        if (settings.simulation?.tenderlyKey) settingsSnapshot.tenderlyKey = "[REDACTED]";
        const DIAG_STR_MAX = 500;
        const truncate = (v: unknown): unknown => {
          if (typeof v === "string") return v.length <= DIAG_STR_MAX ? v : v.slice(0, DIAG_STR_MAX) + "...TRUNCATED";
          if (Array.isArray(v)) return v.map(truncate);
          if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, truncate(x)]));
          return v;
        };
        const lastDiagEvents = __diag.slice(-DIAG_MAX).map((e) => truncate({ ...e, host: e.host ? e.host.slice(0, 50) : undefined }) as DiagEvent);
        const out = { extensionVersion: manifest.version, exportedAt: new Date().toISOString(), buildTime: (manifest as { buildTime?: string }).buildTime, settingsSnapshot, lastDiagEvents };
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
        const p = msg.payload ?? {};
        const typeRaw = p.type ?? p.overrideType;
        let overrideType: string;
        let payload: Record<string, unknown>;
        if (p.payload && typeof p.payload === "object") {
          overrideType = (typeRaw ?? p.payload.type ?? "").toString();
          payload = p.payload as Record<string, unknown>;
        } else {
          overrideType = (typeRaw ?? "").toString();
          payload = p as Record<string, unknown>;
        }
        const norm = normalizeOverridePayload(overrideType, payload);
        if (!norm) return { ok: false, error: "invalid_payload" };
        try {
          await upsertUserOverride(norm.type, norm.payload);
          const lists = await getLists();
          return { ok: true, updatedAt: lists.updatedAt };
        } catch (e) {
          return { ok: false, error: String((e as Error)?.message ?? e) };
        }
      }
      case "SG_LISTS_OVERRIDE_REMOVE": {
        const p = msg.payload ?? {};
        const typeRaw = p.type ?? p.overrideType;
        let overrideType: string;
        let payload: Record<string, unknown>;
        if (p.payload && typeof p.payload === "object") {
          overrideType = (typeRaw ?? p.payload.type ?? "").toString();
          payload = p.payload as Record<string, unknown>;
        } else {
          overrideType = (typeRaw ?? "").toString();
          payload = p as Record<string, unknown>;
        }
        const norm = normalizeOverridePayload(overrideType, payload);
        if (!norm) return { ok: false, error: "invalid_payload" };
        const val = (norm.payload.value ?? norm.payload.address ?? "").toString();
        const chainId = (norm.payload.chainId ?? "").toString();
        const addr = (norm.payload.address ?? norm.payload.tokenAddress ?? "").toString();
        try {
          await deleteUserOverride(norm.type, val, (norm.type === "scam_token" || norm.type === "trusted_token") ? chainId : undefined, (norm.type === "scam_token" || norm.type === "trusted_token") ? addr : undefined);
          const lists = await getLists();
          return { ok: true, updatedAt: lists.updatedAt };
        } catch (e) {
          return { ok: false, error: String((e as Error)?.message ?? e) };
        }
      }
      case "SG_LISTS_EXPORT": {
        const snapshot = await exportSnapshot();
        return { ok: true, ...snapshot };
      }
      case "SG_LISTS_OVERRIDE_SET": {
        const kind = msg.payload?.kind as string;
        const values = msg.payload?.values;
        const validKinds = ["trustedDomains", "blockedDomains", "blockedAddresses", "scamTokens"];
        if (!validKinds.includes(kind) || !Array.isArray(values)) return { ok: false, error: "invalid_payload" };
        try {
          const result = await setOverrides(kind as "trustedDomains" | "blockedDomains" | "blockedAddresses" | "scamTokens", values);
          return { ok: true, updatedAt: result.cache.updatedAt, invalidCount: result.invalidCount, invalidExamples: result.invalidExamples };
        } catch (e) {
          return { ok: false, error: String((e as Error)?.message ?? e) };
        }
      }
      case "SG_LISTS_REFRESH":
      case "SG_LISTS_REFRESH_NOW": {
        try {
          const s = await getSettings();
          const gate = await canUseNetwork("cloudIntel", s);
          if (!gate.ok) {
            const lists = await getLists();
            return { ok: true, updatedAt: lists.updatedAt, counts: { trustedDomains: lists.trustedDomains.length, blockedDomains: lists.blockedDomains.length, blockedAddresses: lists.blockedAddresses.length, scamTokens: lists.scamTokens.length, userTrustedDomains: lists.userTrustedDomains.length, userBlockedDomains: lists.userBlockedDomains.length, userBlockedAddresses: lists.userBlockedAddresses.length, userScamTokens: lists.userScamTokens.length, userTrustedTokens: (lists.userTrustedTokens ?? []).length }, sources: lists.sources, skipped: "cloud_intel_off_or_no_permissions" };
          }
          const lists = await refreshLists(true);
          return { ok: true, updatedAt: lists.updatedAt, counts: { trustedDomains: lists.trustedDomains.length, blockedDomains: lists.blockedDomains.length, blockedAddresses: lists.blockedAddresses.length, scamTokens: lists.scamTokens.length, userTrustedDomains: lists.userTrustedDomains.length, userBlockedDomains: lists.userBlockedDomains.length, userBlockedAddresses: lists.userBlockedAddresses.length, userScamTokens: lists.userScamTokens.length, userTrustedTokens: (lists.userTrustedTokens ?? []).length }, sources: lists.sources };
        } catch (e) {
          return { ok: false, error: String((e as Error)?.message ?? e) };
        }
      }
      case "SG_LISTS_IMPORT": {
        const raw = msg.payload?.data;
        if (!raw || typeof raw !== "object") return { ok: false, error: "invalid_data" };
        try {
          const { importUserOverrides } = await import("./services/listManager");
          const data = raw.overrides && typeof raw.overrides === "object"
            ? { userTrustedDomains: raw.overrides.trustedDomains, userBlockedDomains: raw.overrides.blockedDomains, userBlockedAddresses: raw.overrides.blockedAddresses, userScamTokens: raw.overrides.scamTokens }
            : raw;
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
        const s = await getSettings();
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
        const settings = await getSettings();
        let allow = [...(settings.allowlistSpenders ?? [])];
        let deny = [...(settings.denylistSpenders ?? [])];
        const norm = (a: string) => {
          const h = String(a).replace(/^0x/i, "").toLowerCase();
          if (h.length !== 40 || !/^[a-f0-9]{40}$/.test(h)) return "";
          return "0x" + h;
        };
        if (addToAllow && typeof addToAllow === "string" && /^0x[a-fA-F0-9]{40}$/.test(addToAllow)) {
          allow = [...new Set([...allow, norm(addToAllow)])];
          deny = deny.filter((x) => x !== norm(addToAllow));
        }
        if (addToDeny && typeof addToDeny === "string" && /^0x[a-fA-F0-9]{40}$/.test(addToDeny)) {
          deny = [...new Set([...deny, norm(addToDeny)])];
          allow = allow.filter((x) => x !== norm(addToDeny));
        }
        if (removeFromAllow && typeof removeFromAllow === "string") {
          allow = allow.filter((x) => x !== norm(removeFromAllow));
        }
        if (removeFromDeny && typeof removeFromDeny === "string") {
          deny = deny.filter((x) => x !== norm(removeFromDeny));
        }
        await new Promise<void>((resolve, reject) => {
          chrome.storage.sync.set({ allowlistSpenders: allow, denylistSpenders: deny } as any, () =>
            chrome.runtime?.lastError ? reject(chrome.runtime.lastError) : resolve()
          );
        });
        return { ok: true };
      }
      case "SG_ADD_TEMP_ALLOW": {
        const { host, spender, ttlMs } = msg.payload ?? {};
        const ms = typeof ttlMs === "number" && ttlMs > 0 ? ttlMs : 10 * 60 * 1000;
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
        const ms = Math.min(30 * 60 * 1000, Math.max(60 * 1000, Number(ttlMs) || 5 * 60 * 1000));
        await setVaultOverride(chainIdHex ?? "0x0", c, ms);
        return { ok: true, ttlMs: ms };
      }
      case "SG_VAULT_UNLOCK": {
        const durationMs = Math.min(600_000, Math.max(60_000, (msg.payload?.durationMs ?? 5 * 60 * 1000)));
        const settings = await getSettings();
        const vault = settings.vault ?? { enabled: false, lockedContracts: [], unlockedUntil: 0 };
        const next = { ...settings, vault: { ...vault, unlockedUntil: Date.now() + durationMs } };
        await new Promise<void>((resolve, reject) => {
          chrome.storage.sync.set(next as unknown as Record<string, unknown>, () =>
            chrome.runtime?.lastError ? reject(chrome.runtime.lastError) : resolve()
          );
        });
        return { ok: true, unlockedUntil: (next.vault as any).unlockedUntil };
      }
      case "SG_TEST_SIMULATION": {
        const settings = await getSettings();
        const { simulateTransaction } = await import("./services/simulationService");
        const body = {
          network_id: "1",
          from: "0x0000000000000000000000000000000000000001",
          to: "0x0000000000000000000000000000000000000002",
          input: "0x",
          value: "0",
        };
        const res = await simulateTransaction(body, settings);
        return { ok: res != null, error: res == null ? "Conexão falhou ou credenciais inválidas" : undefined };
      }
      case "ANALYZE": {
        const settings = await getSettings();
        const req = msg.payload as AnalyzeRequest;
        diagPush({ src: "background", kind: "ANALYZE_START", requestId: req?.requestId, method: req?.request?.method, host: req?.url ? hostFromUrl(req.url) : undefined });
        const intel = await getIntelCachedFast();
        const isStale = intel.updatedAt === 0 || (Date.now() - intel.updatedAt >= INTEL_TTL_MS);
        if (isStale) ensureIntelRefreshSoon("analyze_path");
        const { intel: addrIntel, isMissing: addrMissing, isStale: addrStale } = await loadAddressIntelCachedFast();
        if (addrMissing || addrStale) ensureAddressIntelRefreshSoon("analyze_path");
        const tabId = sender?.tab?.id;
        const analysis = await analyze(req, settings, intel, tabId, addrIntel);
        (analysis as Analysis & { method?: string }).method = req.request?.method;
        const summaryV1 = buildTxSummaryV1(req, analysis, settings);
        analysis.summary = summaryV1;
        analysis.summaryV1 = summaryV1;
        if (req.wallet) analysis.wallet = req.wallet;
        if (req.txCostPreview) {
          analysis.txCostPreview = { ...req.txCostPreview };
          const tx = analysis.tx as { feeMaxWei?: string; totalMaxWei?: string; valueWei?: string } | undefined;
          if (tx && !(analysis.txCostPreview as any).feeMaxWei && tx.feeMaxWei) {
            (analysis.txCostPreview as any).feeMaxWei = tx.feeMaxWei;
            (analysis.txCostPreview as any).totalMaxWei = tx.totalMaxWei;
            (analysis.txCostPreview as any).feeEstimated = true;
          }
        }
        const feeEst = req.feeEstimate;
        if (feeEst?.ok && feeEst.feeEstimated && (feeEst.feeLikelyWeiHex || feeEst.feeMaxWeiHex)) {
          const preview = analysis.txCostPreview || { valueWei: "0", feeEstimated: false };
          const valueWei = BigInt(preview.valueWei || (analysis.tx as any)?.valueWei || "0");
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
            feeEstimated: true,
          };
        }
        const chainIdHex = (req.txCostPreview as any)?.chainIdHex ?? (req.meta as any)?.preflight?.chainIdHex ?? (req.meta as any)?.chainIdHex;
        if (chainIdHex) (analysis as any).chainIdHex = chainIdHex;
        if (settings.simulation?.enabled === true) {
          await enrichWithSimulation(req, analysis, settings);
        }
        applySpenderPolicy(analysis, settings);
        if (analysis.safeDomain) {
          (analysis.reasonKeys ??= []).push(REASON_KEYS.KNOWN_SAFE_DOMAIN);
        }
        const da = analysis.decodedAction as DecodedAction | undefined;
        if (da?.kind === "PERMIT_EIP2612") (analysis.reasonKeys ??= []).push(REASON_KEYS.PERMIT_GRANT);
        if ((da?.permit2 || da?.kind === "PERMIT2_ALLOWANCE" || da?.kind === "PERMIT2_TRANSFER")) {
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
        diagPush({ src: "background", kind: "ANALYZE_DONE", requestId: req?.requestId, method: req?.request?.method, host: req?.url ? hostFromUrl(req.url) : undefined, level: analysis.level, recommend: analysis.recommend, extra: { flags: analysis.summary?.flags?.slice(0, 10) } });
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
const DECISION_LOG_KEY = "sg_decision_log_v1";
const VAULT_OVERRIDES_KEY = "sg_vault_overrides_v1";
const TEMP_ALLOW_KEY = "sg_temp_allow_v1";

/** P1: Diagnosis ring buffer (in-memory, no PII/params). */
const DIAG_MAX = 200;
type DiagEvent = { ts: number; src: "mainWorld" | "content" | "background"; kind: string; requestId?: string; method?: string; host?: string; level?: string; recommend?: string; decision?: string; extra?: Record<string, unknown> };
const __diag: DiagEvent[] = [];
function diagPush(e: Omit<DiagEvent, "ts" | "src"> & { src?: DiagEvent["src"]; ts?: number }): void {
  const entry: DiagEvent = { ts: e.ts ?? Date.now(), src: e.src ?? "background", kind: e.kind, requestId: e.requestId, method: e.method, host: e.host, level: e.level, recommend: e.recommend, decision: e.decision, extra: e.extra };
  __diag.push(entry);
  if (__diag.length > DIAG_MAX) __diag.splice(0, __diag.length - DIAG_MAX);
}

type VaultOverrides = Record<string, number>; // key => unlockedUntil epochMs

async function getVaultOverrides(): Promise<VaultOverrides> {
  try {
    const r = await new Promise<Record<string, VaultOverrides>>((resolve) => {
      chrome.storage.local.get(VAULT_OVERRIDES_KEY, (x) => resolve(x ?? {}));
    });
    const raw = r[VAULT_OVERRIDES_KEY];
    if (!raw || typeof raw !== "object") return {};
    return cleanupExpiredOverrides(raw as VaultOverrides);
  } catch {
    return {};
  }
}

function cleanupExpiredOverrides(overrides: VaultOverrides): VaultOverrides {
  const now = Date.now();
  const out: VaultOverrides = {};
  for (const [k, v] of Object.entries(overrides)) {
    if (typeof v === "number" && v > now) out[k] = v;
  }
  return out;
}

async function setVaultOverride(chainIdHex: string, contract: string, ttlMs: number): Promise<void> {
  const c = normAddr40(contract);
  if (!c) return;
  const key = `${(chainIdHex || "0x0").toLowerCase()}:${c}`;
  const overrides = await getVaultOverrides();
  overrides[key] = Date.now() + ttlMs;
  await new Promise<void>((resolve) => {
    chrome.storage.local.set({ [VAULT_OVERRIDES_KEY]: overrides }, () => resolve());
  });
}

function isVaultOverrideActive(overrides: VaultOverrides, chainIdHex: string, contract: string): boolean {
  const c = normAddr40(contract);
  if (!c) return false;
  const key = `${(chainIdHex || "0x0").toLowerCase()}:${c}`;
  const until = overrides[key];
  return typeof until === "number" && until > Date.now();
}
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
  /** @deprecated use usdPerNative + nativeSymbol */
  usdPerEth?: number;
  nativeSymbol?: string;
  usdPerNative?: number;
  decision: "ALLOW" | "BLOCK";
  score?: number;
  level?: string;
};

function pushHistoryEvent(evt: HistoryEvent) {
  try {
    const payload = { [HISTORY_KEY]: true, [DECISION_LOG_KEY]: true };
    chrome.storage.local.get(payload, (r) => {
      const err = chrome.runtime.lastError;
      if (err) return;
      const arr = Array.isArray((r as any)?.[HISTORY_KEY]) ? (r as any)[HISTORY_KEY] : [];
      arr.push(evt);
      const trimmed = arr.slice(-HISTORY_MAX);
      chrome.storage.local.set({ [HISTORY_KEY]: trimmed, [DECISION_LOG_KEY]: trimmed }, () => void 0);
    });
  } catch {}
}

type TempAllowEntry = { expiresAt: number };
async function addTempAllow(host: string, spender: string | null, ttlMs: number): Promise<void> {
  const now = Date.now();
  const expiresAt = now + ttlMs;
  const got = await new Promise<Record<string, Record<string, TempAllowEntry>>>((resolve) => {
    chrome.storage.local.get(TEMP_ALLOW_KEY, (r) => resolve((r as any) ?? {}));
  });
  const map = (got[TEMP_ALLOW_KEY] ?? {}) as Record<string, TempAllowEntry>;
  if (host) map[`domain:${host.toLowerCase()}`] = { expiresAt };
  if (spender && /^0x[a-fA-F0-9]{40}$/.test(spender)) map[`spender:${spender.toLowerCase()}`] = { expiresAt };
  await new Promise<void>((res) => chrome.storage.local.set({ [TEMP_ALLOW_KEY]: map }, () => res()));
}

async function isTempAllowed(host: string, spender: string | null): Promise<boolean> {
  const now = Date.now();
  const got = await new Promise<Record<string, Record<string, TempAllowEntry>>>((resolve) => {
    chrome.storage.local.get(TEMP_ALLOW_KEY, (r) => resolve((r as any) ?? {}));
  });
  const map = (got[TEMP_ALLOW_KEY] ?? {}) as Record<string, TempAllowEntry>;
  const entries = Object.entries(map).filter(([, v]) => v.expiresAt > now);
  const fresh: Record<string, TempAllowEntry> = {};
  for (const [k, v] of entries) fresh[k] = v;
  if (entries.length < Object.keys(map).length) {
    chrome.storage.local.set({ [TEMP_ALLOW_KEY]: fresh }, () => void 0);
  }
  if (host && fresh[`domain:${host.toLowerCase()}`]) return true;
  if (spender && fresh[`spender:${spender.toLowerCase()}`]) return true;
  return false;
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
    trustedTokenAddresses: [],
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
  const gate = await canUseNetwork("cloudIntel", await getSettings());
  if (!gate.ok) {
    if (cached) return cached;
    return getMinimalSeedIntel();
  }
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
  const settings = await getSettings();
  const gate = await canUseNetwork("cloudIntel", settings);
  if (!gate.ok) return getIntelCachedFast();
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
        const s = await getSettings();
        if (!(await canUseNetwork("cloudIntel", s)).ok) return;
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
  getSettings().then(async (s) => {
    if ((await canUseNetwork("cloudIntel", s)).ok) refreshLists().catch(() => {});
  });
});

chrome.alarms.onAlarm.addListener(async (a) => {
  if (a.name === "sg_intel_daily") {
    try { await updateIntelNow(); } catch {}
    try { ensureAddressIntelRefreshSoon("alarm_daily"); } catch {}
    return;
  }
  if (a.name === "SG_REFRESH_LISTS") {
    try {
      const s = await getSettings();
      if ((await canUseNetwork("cloudIntel", s)).ok) await refreshLists();
    } catch {}
  }
});

function tabsSendMessageSafe(tabId: number, message: any): Promise<any | null> {
  return new Promise((resolve) => {
    try {
      if (!chrome?.tabs?.sendMessage) return resolve(null);
      chrome.tabs.sendMessage(tabId, message, (resp: any) => {
        const err = chrome.runtime?.lastError;
        if (err) return resolve(null);
        resolve(resp ?? null);
      });
    } catch {
      resolve(null);
    }
  });
}

const RPC_ALLOWED = new Set(["eth_call", "eth_chainid", "eth_getcode", "eth_getblockbynumber", "eth_getlogs", "eth_estimategas"]);

async function rpcCall(tabId: number | undefined, method: string, params: any[]): Promise<any> {
  if (!tabId || typeof chrome.tabs.sendMessage !== "function") return null;
  const m = String(method).toLowerCase();
  if (!RPC_ALLOWED.has(m)) return null;
  try {
    const resp = await tabsSendMessageSafe(tabId, { type: "SG_RPC_CALL_REQUEST", method: m, params: params ?? [] });
    return (resp as any)?.ok ? (resp as any).result : null;
  } catch {
    return null;
  }
}

/** Like rpcCall but returns full { ok, result, error } for preflight revert detection. */
async function rpcCallFull(tabId: number | undefined, method: string, params: any[]): Promise<{ ok: boolean; result?: unknown; error?: string } | null> {
  if (!tabId || typeof chrome.tabs.sendMessage !== "function") return null;
  const m = String(method).toLowerCase();
  if (!RPC_ALLOWED.has(m)) return null;
  try {
    const resp = await tabsSendMessageSafe(tabId, { type: "SG_RPC_CALL_REQUEST", method: m, params: params ?? [] });
    if (resp && typeof resp === "object") return { ok: !!(resp as any).ok, result: (resp as any).result, error: (resp as any).error };
    return null;
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

const TOKEN_META_CACHE_TTL_MS = 5 * 60 * 1000; // 5 min
const TOKEN_META_CACHE_MAX = 500;
type TokenMetaCacheEntry = { expiresAt: number; value: { symbol?: string; decimals?: number; name?: string } };
const __tokenMetaCache = new Map<string, TokenMetaCacheEntry>();
function evictTokenMetaCacheIfNeeded(): void {
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

  const gate = await canUseNetwork("pricing", await getSettings());
  if (!gate.ok) {
    return __ethUsdCache?.usdPerEth ?? null;
  }
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
    if (durationSec > 0) await telemetry.trackSession({ domain: s.domain, referrer: s.referrer, durationSec });
  } catch {
    // silent (trackSession already checks telemetry opt-in internally)
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
            getSettings().then((settings) => {
              chrome.storage.local.get(["termsAccepted", "sg_user_interest_tags"], (r) => {
                const terms = (r as Record<string, unknown>)?.termsAccepted === true;
                if (!terms || !settings?.telemetryOptIn) return;
                const arr = Array.isArray((r as any)?.sg_user_interest_tags) ? (r as any).sg_user_interest_tags : [];
                if (!arr.includes(category)) {
                  arr.push(category);
                  chrome.storage.local.set({ sg_user_interest_tags: arr });
                }
              });
            }).catch(() => {});
          }
          endSessionAndTrack(tabId).then(() => {
            tabSessions.set(tabId, { startTime: Date.now(), domain: host, referrer: "" });
          });
        }
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

function normAddr40(addr: string | undefined): string | null {
  if (!addr || typeof addr !== "string" || !addr.startsWith("0x")) return null;
  const hex = addr.replace(/^0x/, "").toLowerCase();
  if (hex.length !== 40 || !/^[a-f0-9]{40}$/.test(hex)) return null;
  return "0x" + hex;
}

/** Returns { blocked, lockedTo, chainIdHex } if vault blocks this request. Uses local overrides (per chain:contract). */
async function getVaultBlock(
  settings: Settings,
  req: AnalyzeRequest,
  analysis: Analysis
): Promise<{ blocked: boolean; lockedTo?: string; chainIdHex?: string }> {
  const vault = settings.vault;
  if (!vault?.enabled || !Array.isArray(vault.lockedContracts) || vault.lockedContracts.length === 0)
    return { blocked: false };
  const locked = vault.lockedContracts.map((a) => normAddr40(a)).filter((x): x is string => !!x);
  if (locked.length === 0) return { blocked: false };

  const chainIdHex =
    (req.meta as { chainIdHex?: string })?.chainIdHex ??
    (req.txCostPreview as { chainIdHex?: string })?.chainIdHex ??
    "0x0";
  const overrides = await getVaultOverrides();

  const method = String(req?.request?.method ?? "").toLowerCase();
  const params = req?.request?.params;

  if (method === "eth_sendtransaction" || method === "wallet_sendtransaction") {
    const tx = Array.isArray(params) && params[0] && typeof params[0] === "object" ? params[0] : null;
    if (tx) {
      const to = normAddr40((tx as any).to);
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

function applyPageRiskOverride(req: AnalyzeRequest, analysis: Analysis): void {
  const pageRisk = (req.meta as { pageRisk?: { score: string; reasons: string[] } } | undefined)?.pageRisk;
  if (!pageRisk) return;
  if (pageRisk.score === "HIGH") {
    analysis.score = Math.max(analysis.score, 85);
    if (analysis.level !== "HIGH") analysis.level = "WARN";
    if (analysis.recommend !== "BLOCK") analysis.recommend = "HIGH";
    analysis.reasons.unshift(t("reason_page_risk_high") || REASON_KEYS.PAGE_RISK_HIGH + ": Página com risco alto detectado.");
    (analysis.reasonKeys ??= []).unshift(REASON_KEYS.PAGE_RISK_HIGH);
  } else if (pageRisk.score === "MEDIUM") {
    analysis.score = Math.max(analysis.score, 50);
    if (analysis.level === "LOW") analysis.level = "WARN";
    analysis.reasons.push(t("reason_page_risk_medium") || REASON_KEYS.PAGE_RISK_MEDIUM + ": Página com risco médio.");
    (analysis.reasonKeys ??= []).push(REASON_KEYS.PAGE_RISK_MEDIUM);
  }
}

async function applyVaultOverride(analysis: Analysis, settings: Settings, req: AnalyzeRequest): Promise<void> {
  const block = await getVaultBlock(settings, req, analysis);
  if (!block.blocked) return;
  analysis.recommend = "BLOCK";
  analysis.level = "HIGH";
  analysis.score = Math.max(analysis.score, 95);
  analysis.title = t("vaultBlockedTitle");
  analysis.reasons.unshift(t("vaultBlockedReason"));
  (analysis.reasonKeys ??= []).unshift(REASON_KEYS.VAULT_LOCKED);
  (analysis as Analysis).vaultBlocked = true;
  if (block.lockedTo) (analysis as Analysis).vaultLockedTo = block.lockedTo;
  if (block.chainIdHex) (analysis as Analysis).vaultChainIdHex = block.chainIdHex;
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
    if (s.typos.some((tt) => h.includes(tt))) reasons.push(t("domainLookalikeReason", { domain: s.legit }));
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
  const maxPriorityFeePerGas = hexToBigInt((tx as any).maxPriorityFeePerGas || "0x0");
  const gasPrice = hexToBigInt((tx as any).gasPrice || "0x0");
  const dataLen = typeof (tx as any).data === "string" ? (tx as any).data.length : 0;

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

  const selector =
    data && data.startsWith("0x") && data.length >= 10 ? data.slice(0, 10) : "";

  const contractNameHint = to && data && data !== "0x" && data.toLowerCase() !== "0x" ? shortAddr(to) : undefined;
  return {
    to,
    valueWei: valueWei.toString(),
    valueEth,
    gasLimitWei: gasLimit > 0n ? gasLimit.toString() : undefined,
    gasLimit: gasLimit > 0n ? gasLimit.toString() : undefined,
    maxFeePerGasWei: maxFeePerGas > 0n ? maxFeePerGas.toString() : undefined,
    maxPriorityFeePerGasWei: maxPriorityFeePerGas > 0n ? maxPriorityFeePerGas.toString() : undefined,
    gasPriceWei: gasPrice > 0n ? gasPrice.toString() : undefined,
    dataLen: dataLen > 0 ? dataLen : undefined,
    feeMaxWei: feeMaxWeiStr || undefined,
    totalMaxWei: totalMaxWeiStr || undefined,
    maxGasFeeEth,
    maxTotalEth,
    selector,
    feeKnown,
    contractNameHint,
  };
}

function isProtectionPaused(settings: Settings): boolean {
  const until = settings.pausedUntil;
  return typeof until === "number" && Number.isFinite(until) && Date.now() < until;
}

/** Extract spender candidates from analysis context (lowercase). */
function extractSpenderCandidates(analysis: Analysis): string[] {
  const out: string[] = [];
  const add = (a: string | undefined) => {
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
    const te = analysis.txExtras as { spender?: string; operator?: string };
    add(te.spender);
    add(te.operator);
  }
  if (analysis.typedDataExtras?.spender) add(analysis.typedDataExtras.spender);
  if (analysis.tx?.to) add((analysis.tx as { to?: string }).to);
  return [...new Set(out)];
}

/** Policy: allowlistSpenders / denylistSpenders. Runs before applyPolicy. */
function applySpenderPolicy(analysis: Analysis, settings: Settings): void {
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
  const isApprovalLike =
    analysis.decodedAction?.kind === "APPROVE_ERC20" ||
    analysis.decodedAction?.kind === "INCREASE_ALLOWANCE" ||
    analysis.decodedAction?.kind === "SET_APPROVAL_FOR_ALL" ||
    analysis.decodedAction?.kind === "PERMIT_EIP2612" ||
    analysis.decodedAction?.kind === "PERMIT2_ALLOWANCE" ||
    analysis.decodedAction?.kind === "PERMIT2_TRANSFER" ||
    !!analysis.typedDataExtras?.spender;
  if (isApprovalLike && !analysis.matchedAllowSpender && !analysis.matchedDenySpender && candidates.length > 0) {
    const hasUnknownSpender = candidates.some((c) => !allow.includes(c));
    if (hasUnknownSpender) {
      analysis.reasons.push(t("reason_new_spender") || REASON_KEYS.NEW_SPENDER + ": Novo spender — verifique.");
      (analysis.reasonKeys ??= []).push(REASON_KEYS.NEW_SPENDER);
      analysis.score = Math.min(100, analysis.score + 25);
      if (analysis.level !== "HIGH") analysis.level = "WARN";
    }
  }
}

/** Drainer heuristics: elevate to HIGH when risk combo detected. */
function applyDrainerHeuristics(analysis: Analysis): void {
  if (analysis.isPhishing || analysis.matchedDenySpender) return;
  const decoded = analysis.decodedAction as DecodedAction | undefined;
  const safeDomain = !!analysis.safeDomain;
  const hasNewSpender = !analysis.matchedAllowSpender && extractSpenderCandidates(analysis).length > 0;
  const isUnlimited =
    ((decoded?.kind === "APPROVE_ERC20" || decoded?.kind === "INCREASE_ALLOWANCE") && (decoded as any).amountType === "UNLIMITED") ||
    (decoded?.kind === "PERMIT_EIP2612" && decoded.valueType === "UNLIMITED") ||
    (decoded?.kind === "PERMIT2_ALLOWANCE" && (decoded as any).amountType === "UNLIMITED");
  const isSetApprovalForAllNft = decoded?.kind === "SET_APPROVAL_FOR_ALL" && decoded.approved;
  const isPermit2Unknown = ((decoded as { permit2?: boolean } | undefined)?.permit2 || decoded?.kind === "PERMIT2_ALLOWANCE" || decoded?.kind === "PERMIT2_TRANSFER") && hasNewSpender;

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
  const m = (analysis as Analysis & { method?: string }).method ?? "";
  // Phishing / matchedDenySpender always blocked regardless of mode
  if (analysis.isPhishing) { analysis.recommend = "BLOCK"; return; }
  if (analysis.matchedDenySpender) { analysis.recommend = "BLOCK"; return; }
  // P1 Policy: STRICT => snaps BLOCK, raw/sign HIGH (explicit confirm); BALANCED => snaps/raw/sign HIGH; RELAXED => WARN (flags visible)
  if (m === "wallet_invokesnap" || m === "wallet_requestsnaps") {
    if (mode === "STRICT") { analysis.recommend = "BLOCK"; return; }
    if (mode === "BALANCED") { analysis.recommend = "HIGH"; return; }
    if (mode === "RELAXED") { if (analysis.recommend !== "BLOCK") analysis.recommend = "WARN"; return; }
  }
  if (m === "eth_sendrawtransaction" || m === "eth_signtransaction") {
    if (mode === "STRICT") { analysis.recommend = "HIGH"; return; }
    if (mode === "BALANCED") { analysis.recommend = "HIGH"; return; }
    if (mode === "RELAXED") { if (analysis.recommend !== "BLOCK") analysis.recommend = "WARN"; return; }
  }
  if (mode === "STRICT") {
    if (decoded?.kind === "SET_APPROVAL_FOR_ALL" && decoded.approved && (settings.strictBlockSetApprovalForAll ?? true)) { analysis.recommend = "BLOCK"; return; }
    if ((decoded?.kind === "APPROVE_ERC20" || decoded?.kind === "INCREASE_ALLOWANCE") && (decoded as any).amountType === "UNLIMITED" && (settings.strictBlockApprovalsUnlimited ?? true)) { analysis.recommend = "BLOCK"; return; }
    if (decoded?.kind === "PERMIT_EIP2612" && decoded.valueType === "UNLIMITED" && (settings.strictBlockPermitLike ?? true)) { analysis.recommend = "BLOCK"; return; }
    if (decoded?.kind === "PERMIT2_ALLOWANCE" && (decoded as any).amountType === "UNLIMITED" && (settings.strictBlockPermitLike ?? true)) { analysis.recommend = "BLOCK"; return; }
    if (analysis.flaggedAddress) { analysis.recommend = "BLOCK"; return; }
  }
  if (mode === "BALANCED") {
    if (analysis.flaggedAddress) { analysis.recommend = "HIGH"; return; }
    if (((decoded?.kind === "APPROVE_ERC20" || decoded?.kind === "INCREASE_ALLOWANCE") && (decoded as any).amountType === "UNLIMITED") || (decoded?.kind === "SET_APPROVAL_FOR_ALL" && decoded?.approved)) {
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

/** P1: Build TxSummaryV1 for overlay from request + analysis. */
function buildTxSummaryV1(req: AnalyzeRequest, analysis: Analysis, _settings: Settings): TxSummaryV1 {
  const method = (analysis as Analysis & { method?: string }).method ?? req.request?.method ?? "";
  const m = String(method).toLowerCase();
  const existing = analysis.summary;
  if (existing && existing.title) {
    const flags = [...(existing.flags ?? []), ...(analysis.reasonKeys ?? [])].filter((x, i, a) => a.indexOf(x) === i);
    return { ...existing, flags: flags.length ? flags : existing.flags };
  }
  if (m === "wallet_switchethereumchain") {
    const chainIdHex = (req.request?.params as any)?.[0]?.chainId;
    const name = chainIdHex ? chainName(chainIdHex) : "";
    return {
      title: t("summary_title_switch_chain") || "Troca de rede",
      subtitle: chainIdHex ? `${chainIdHex} → ${name}` : undefined,
      flags: [],
    };
  }
  if (m === "wallet_getpermissions") {
    return {
      title: t("summary_title_read_permissions") || "Leitura de permissões",
      flags: analysis.reasonKeys ?? [REASON_KEYS.READ_PERMISSIONS],
    };
  }
  if (m === "wallet_invokesnap" || m === "wallet_requestsnaps") {
    return {
      title: t("summary_title_snaps") || "Snaps / Extensões da carteira",
      flags: analysis.reasonKeys ?? [m === "wallet_invokesnap" ? REASON_KEYS.SNAP_INVOKE : REASON_KEYS.REQUEST_SNAPS],
    };
  }
  if (m === "eth_signtransaction") {
    return {
      title: t("summary_title_sign_tx") || "Assinatura de transação",
      flags: analysis.reasonKeys ?? [REASON_KEYS.SIGN_TRANSACTION],
    };
  }
  if (m === "eth_sendrawtransaction") {
    return existing ?? {
      title: t("summary_title_raw_tx") || "Broadcast de transação assinada",
      flags: analysis.reasonKeys ?? [REASON_KEYS.RAW_TX_BROADCAST],
    };
  }
  const sim = analysis.simulationOutcome;
  const give = (sim?.outgoingAssets ?? []).map((o) => ({ amount: o.amount, symbol: o.symbol, kind: "ERC20" as const }));
  const get = (sim?.incomingAssets ?? []).map((i) => ({ amount: i.amount, symbol: i.symbol, kind: "ERC20" as const }));
  const approvals: NonNullable<TxSummaryV1["approvals"]> = (sim?.approvals ?? []).map((a) => ({
    kind: "ERC20" as const,
    tokenAddress: a.token,
    spender: a.spender,
    unlimited: a.unlimited,
  }));
  const flags = analysis.reasonKeys ?? [];
  const tx = analysis.tx as { to?: string; valueEth?: string; selector?: string } | undefined;
  if (analysis.decodedAction && !give.length && !get.length && (m === "eth_sendtransaction" || m === "wallet_sendtransaction")) {
    const da = analysis.decodedAction;
    if ("spender" in da && da.spender) {
      approvals.push({
        kind: (da as any).kind === "SET_APPROVAL_FOR_ALL" ? "ERC721_ALL" : "ERC20",
        tokenAddress: (da as any).token ?? tx?.to,
        spender: (da as any).spender,
        unlimited: (da as any).amountType === "UNLIMITED",
      });
    }
  }
  return {
    title: analysis.title || (t("action_SEND_TX_contract_title") || "Interação com contrato"),
    subtitle: tx?.to ? `${tx.to.slice(0, 10)}…` : undefined,
    give: give.length ? give : undefined,
    get: get.length ? get : undefined,
    approvals: approvals.length ? approvals : undefined,
    flags: flags.length ? flags : undefined,
  };
}

function intentFromTxDataAndValue(data: string, valueWei: bigint, selector: string): Intent {
  const dataNorm = typeof data === "string" ? data : "";
  const hasData = !!dataNorm && dataNorm !== "0x" && dataNorm.toLowerCase() !== "0x";
  const hasValue = valueWei > 0n;

  const s = String(selector || "").toLowerCase();
  if (hasData && s && s.startsWith("0x") && s.length === 10) {
    if (s === "0x095ea7b3" || s === "0xa22cb465") return "APPROVAL";
    const swap = new Set([
      "0x38ed1739", "0x7ff36ab5", "0x18cbafe5", "0x04e45aaf", "0xb858183f", "0x5023b4df", "0x09b81346",
    ]);
    if (swap.has(s)) return "SWAP";
    const nftPurchase = new Set([
      "0xfb0f3ee1", "0xb3a34c4c", "0xed98a574", "0xf2d12b12",
      "0xab834bab", "0x24856bc3", "0xa6f97b27", "0x1b14e9e1",
    ]);
    if (nftPurchase.has(s)) return "NFT_PURCHASE";
  }

  if (hasData && hasValue) return "CONTRACT_INTERACTION";
  if (hasData) return "CONTRACT_INTERACTION";
  if (!hasData && hasValue) return "ETH_TRANSFER";
  if (!s || !s.startsWith("0x") || s.length !== 10) return "UNKNOWN";
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

  const nftPurchase = new Set([
    "0xfb0f3ee1", "0xb3a34c4c", "0xed98a574", "0xf2d12b12",
    "0xab834bab", "0x24856bc3", "0xa6f97b27", "0x1b14e9e1",
  ]);
  if (nftPurchase.has(s)) return "NFT_PURCHASE";

  return "CONTRACT_INTERACTION";
}

type TxContextKind = "SWITCH_NETWORK" | "NFT_PURCHASE" | "TOKEN_SWAP" | "VALUE_TRANSFER" | "CONTRACT_CALL" | "APPROVAL";

function detectTxContext(opts: { host: string; txTo: string; data: string; valueWei: bigint; selector: string }): TxContextKind {
  const { host, data, valueWei, selector } = opts;
  const s = String(selector || "").toLowerCase();
  const h = (host || "").toLowerCase();
  const hasData = !!data && data !== "0x" && data.toLowerCase() !== "0x";
  const hasValue = valueWei > 0n;

  const approveSelectors = new Set(["0x095ea7b3", "0xa22cb465"]);
  if (approveSelectors.has(s)) return "APPROVAL";

  const swapSelectors = new Set(["0x38ed1739", "0x7ff36ab5", "0x18cbafe5", "0x04e45aaf", "0xb858183f", "0x5023b4df", "0x09b81346"]);
  if (swapSelectors.has(s)) return "TOKEN_SWAP";

  const seaportSelectors = new Set(["0xfb0f3ee1", "0xb3a34c4c", "0xed98a574", "0xf2d12b12", "0xab834bab", "0x24856bc3", "0xa6f97b27", "0x1b14e9e1"]);
  if (seaportSelectors.has(s)) return "NFT_PURCHASE";

  if (!hasData && hasValue) return "VALUE_TRANSFER";
  return "CONTRACT_CALL";
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

const SIMULATION_CACHE_TTL_MS = 30000;
const SIMULATION_TIMEOUT_MS = 2200;
const __simulationCache = new Map<string, { outcome: Awaited<ReturnType<typeof runSimulation>>; ts: number }>();

/** Run Tenderly simulation for eth_sendTransaction and merge outcome into analysis. Cache 30s, timeout 2.2s. Without simulation permission/setting, skips Tenderly and falls back to eth_call preflight only. */
async function enrichWithSimulation(req: AnalyzeRequest, analysis: Analysis, settings: Settings): Promise<void> {
  const method = (req?.request?.method || "").toLowerCase();
  if (!method.includes("sendtransaction")) return;
  const simGate = await canUseNetwork("simulation", settings);
  const mayCallTenderly = simGate.ok;

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

  const cacheKey = `${req.requestId}|${networkId}|${to}|${(input || "").slice(0, 66)}`;
  const cached = __simulationCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < SIMULATION_CACHE_TTL_MS && cached.outcome) {
    analysis.simulationOutcome = cached.outcome;
    return;
  }
  for (const [k, v] of __simulationCache) {
    if (Date.now() - v.ts > SIMULATION_CACHE_TTL_MS) __simulationCache.delete(k);
  }

  let outcome: Awaited<ReturnType<typeof runSimulation>> | null = null;
  if (mayCallTenderly) {
    try {
      const outcomePromise = runSimulation(networkId, from, to, input, value, gas, settings);
      const timeoutPromise = new Promise<never>((_, rej) =>
        setTimeout(() => rej(new Error("SIMULATION_TIMEOUT")), SIMULATION_TIMEOUT_MS)
      );
      outcome = await Promise.race([outcomePromise, timeoutPromise]);
    } catch (e) {
    if (String((e as Error)?.message || e).includes("SIMULATION_TIMEOUT")) {
      (analysis.reasonKeys ??= []).push(REASON_KEYS.SIMULATION_TIMEOUT);
    }
    }
  }
  if (!outcome) {
    // Preflight without Tenderly: eth_call with same params to detect quick revert
    const tabId = req.tabId;
    if (tabId && to && to !== "0x0000000000000000000000000000000000000000") {
      try {
        const callResp = await rpcCallFull(tabId, "eth_call", [{ to, from, data: input, value: value || "0x0" }, "latest"]);
        if (callResp && !callResp.ok && typeof callResp.error === "string" && callResp.error.toLowerCase().includes("revert")) {
          (analysis.reasonKeys ??= []).push(REASON_KEYS.SIM_FAILED);
          analysis.reasons.unshift(t("simulation_tx_will_fail") || "Pré-execução indica falha (revert).");
          analysis.recommend = "BLOCK";
          analysis.score = Math.max(analysis.score, 85);
          analysis.level = "HIGH";
        }
      } catch {
        // ignore
      }
    }
    return;
  }
  try {
    analysis.simulationOutcome = outcome;
    __simulationCache.set(cacheKey, { outcome, ts: Date.now() });

    // P1-8: Simulation approvals -> score/reasons
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
          if (analysis.txCostPreview) (analysis.txCostPreview as any).usdPerNative = usdPerEth;
          if (gasCostUsd > 50 && valueUsd < 50) {
            (outcome as any).isHighGas = true;
            analysis.reasons.unshift(t("reason_high_gas") || REASON_KEYS.HIGH_GAS + ": Taxa de gas alta em relação ao valor.");
          }
          if (gasCostUsd > 80) {
            (outcome as any).isHighGas = true;
            if (!analysis.reasons.some((r) => String(r).includes("HIGH_GAS") || String(r).includes("alta"))) {
              analysis.reasons.unshift(t("reason_high_gas") || REASON_KEYS.HIGH_GAS + ": Taxa de gas muito alta.");
            }
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
    }
    // When simulation was skipped (no Tenderly key), preflight eth_call can still detect revert
    if (outcome.fallback && req.tabId && to && to !== "0x0000000000000000000000000000000000000000") {
      try {
        const callResp = await rpcCallFull(req.tabId, "eth_call", [{ to, from, data: input, value: value || "0x0" }, "latest"]);
        if (callResp && !callResp.ok && typeof callResp.error === "string" && callResp.error.toLowerCase().includes("revert")) {
          (analysis.reasonKeys ??= []).push(REASON_KEYS.SIM_FAILED);
          analysis.reasons.unshift(t("simulation_tx_will_fail") || "Pré-execução indica falha (revert).");
          analysis.recommend = "BLOCK";
          analysis.score = Math.max(analysis.score, 85);
          analysis.level = "HIGH";
        }
      } catch {
        // ignore
      }
    }

    if (outcome.status === "SUCCESS") {
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

  // P1: wallet_getPermissions — read-only, LOW/INFO; ANALYZE exists for consistency/diagnóstico (content may auto-allow without overlay)
  if (method === "wallet_getpermissions") {
    level = "LOW";
    score = 10;
    title = t("summary_title_read_permissions") || "Leitura de permissões";
    (reasons as string[]).push(t("reason_read_permissions") || "O site está a ler as permissões já concedidas à carteira.");
    return {
      level,
      score,
      title,
      reasons,
      decoded: { kind: "TX", raw: { method, params: req.request.params } },
      recommend: "ALLOW",
      trust,
      suggestedTrustedDomains: [...SUGGESTED_TRUSTED_DOMAINS],
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
        recommendation: t("human_generic_reco"),
      },
    };
  }

  // P1: Snaps / raw tx / sign tx — high risk, explicit confirmation (safeDomain not computed yet)
  if (method === "wallet_invokesnap" || method === "wallet_requestsnaps") {
    const isInvoke = method === "wallet_invokesnap";
    (reasons as string[]).push(t("reason_snap_invoke") || "Snaps podem executar código na carteira. Confirme a origem.");
    level = "HIGH";
    score = 90;
    title = t("summary_title_snaps") || "Snaps / Extensões da carteira";
    return {
      level,
      score,
      title,
      reasons,
      decoded: { kind: "TX", raw: { method, params: req.request.params } },
      recommend: "HIGH",
      trust,
      suggestedTrustedDomains: [...SUGGESTED_TRUSTED_DOMAINS],
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
        recommendation: t("human_generic_reco"),
      },
    };
  }
  if (method === "eth_signtransaction") {
    (reasons as string[]).push(t("reason_sign_tx") || "Assinatura de transação sem envio imediato. Pode ser usada depois para broadcast.");
    level = "HIGH";
    score = 75;
    title = t("summary_title_sign_tx") || "Assinatura de transação";
    return {
      level,
      score,
      title,
      reasons,
      decoded: { kind: "TX", raw: { method, params: req.request.params } },
      recommend: "HIGH",
      trust,
      suggestedTrustedDomains: [...SUGGESTED_TRUSTED_DOMAINS],
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
        recommendation: t("human_generic_reco"),
      },
    };
  }
  if (method === "eth_sendrawtransaction") {
    const rawTx = (req.request?.params as any)?.[0];
    const rawStr = typeof rawTx === "string" ? rawTx : "";
    let subtitle = "";
    if (rawStr && rawStr.startsWith("0x")) {
      const len = (rawStr.length - 2) / 2;
      const prefix = rawStr.length >= 4 ? rawStr.slice(0, 4).toLowerCase() : "";
      if (prefix === "0x02") subtitle = `EIP-1559 · ${len} bytes`;
      else if (prefix === "0x01") subtitle = `EIP-2930 · ${len} bytes`;
      else subtitle = `rawTx · ${len} bytes`;
    }
    (reasons as string[]).push(t("reason_raw_broadcast") || "Broadcast de transação já assinada. Não há confirmação visual prévia do conteúdo.");
    level = "HIGH";
    score = 85;
    title = t("summary_title_raw_tx") || "Broadcast de transação assinada";
    return {
      level,
      score,
      title,
      reasons,
      decoded: { kind: "TX", raw: { method, params: req.request.params } },
      recommend: "HIGH",
      trust,
      suggestedTrustedDomains: [...SUGGESTED_TRUSTED_DOMAINS],
      safeDomain: false,
      method,
      reasonKeys: [REASON_KEYS.RAW_TX_BROADCAST],
      summary: { title, subtitle: subtitle || undefined, flags: [REASON_KEYS.RAW_TX_BROADCAST] },
      human: {
        methodTitle: title,
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
  const isTrustedSeed = inCustomTrusted || (!!intel && (intel.trustedSeed || (intel as any).trustedDomainsSeed || (intel as any).trustedDomains)?.some?.((d: string) => hostMatches(intelHost, d)));
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
      } else {
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

  // Typed data signatures (eth_signTypedData, eth_signTypedData_v3, eth_signTypedData_v4)
  if (isTypedDataMethod(method)) {
    reasons.push(t("typedDataWarnReason"));
    if (level !== "HIGH") level = "WARN";
    score = Math.max(score, 60);
    title = t("signatureRequest");

    const norm = normalizeTypedDataParams(method, req.request.params);
    const raw = norm.typedDataRaw ?? "";

    let permitExtras: { spender?: string; value?: string; deadline?: string } | null = null;
    let typedDataDecoded: Analysis["typedDataDecoded"] = undefined;
    try {
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
        const j: any = norm.typedDataObj ?? (() => { try { return JSON.parse(raw); } catch { return null; } })();
        const domainName = String(j?.domain?.name || "");
        const msg: any = j?.message || {};

        if (permitExtras) {
          reasons.push(t("permit_signature_detected"));
          if (permitExtras.spender) {
            reasons.push(t("permit_spender_check") || "Verifique o spender.");
          }
          level = "HIGH";
          score = Math.max(score, 90);
        }
        const looksPermit2 = domainName.toLowerCase().includes("permit2") || (!!msg?.permitted && !!msg?.spender);
        const looksApproveLike = !!msg?.spender && (("value" in msg) || ("amount" in msg));
        const looksSeaport = domainName.toLowerCase().includes("seaport") || (!!msg?.offer && !!msg?.consideration);

        if (!permitExtras && (looksPermit2 || looksApproveLike)) {
          reasons.push("Assinatura pode permitir que um endereço gaste seus tokens.");
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
          ...(permit2 && { permit2: { spender: permit2.spender, tokens: permit2.tokens, amounts: permit2.amounts, unlimited: permit2.unlimited, sigDeadline: permit2.sigDeadline } }),
          ...(seaport && { seaport: { offerSummary: seaport.offerSummary, considerationSummary: seaport.considerationSummary, primaryType: seaport.primaryType } }),
          ...(blur && { isBlur: true }),
        };
      }
    } catch {}

    const typedDataExtras = permitExtras ? { spender: permitExtras.spender, value: permitExtras.value, deadline: permitExtras.deadline } : undefined;
    const typedDataReasonKeys: string[] = [];
    if (permitExtras?.spender) typedDataReasonKeys.push(REASON_KEYS.PERMIT_GRANT);
    try {
      const j2: any = norm.typedDataObj ?? (typeof raw === "string" ? (() => { try { return JSON.parse(raw); } catch { return null; } })() : null);
      const dn = String(j2?.domain?.name || "").toLowerCase();
      const msg2 = j2?.message || {};
      const looksP2 = dn.includes("permit2") || (!!msg2?.permitted && !!msg2?.spender);
      const permit2Dec = typeof raw === "string" ? extractPermit2FromTypedData(raw) : null;
      if (looksP2 || (permit2Dec && permit2Dec.spender)) typedDataReasonKeys.push(REASON_KEYS.PERMIT2_GRANT);
    } catch {}
    return {
      level,
      score,
      title,
      reasons,
      reasonKeys: typedDataReasonKeys.length ? typedDataReasonKeys : undefined,
      decoded: { kind: "TYPED_DATA", raw: { params: req.request.params } },
      recommend: "WARN",
      trust,
      suggestedTrustedDomains: [...SUGGESTED_TRUSTED_DOMAINS],
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
      ? (decodedAction.kind === "APPROVE_ERC20" || decodedAction.kind === "INCREASE_ALLOWANCE" || decodedAction.kind === "DECREASE_ALLOWANCE" || decodedAction.kind === "SET_APPROVAL_FOR_ALL" || decodedAction.kind === "PERMIT_EIP2612" || decodedAction.kind === "PERMIT2_ALLOWANCE"
          ? "APPROVAL"
          : decodedAction.kind === "TRANSFER_ERC20" || decodedAction.kind === "TRANSFERFROM_ERC20" || decodedAction.kind === "PERMIT2_TRANSFER"
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
        const match = blocked.find((b: any) => b.address.toLowerCase() === a && (!b.chainId || b.chainId.toLowerCase() === (chainId || "")));
        if (match) { flaggedAddr = match; reasons.unshift(t("address_flagged_reason", { label: match.label, category: match.category })); break; }
        if (listCache && isBlockedAddress(a, listCache)) {
          reasons.unshift("Address is on the blocklist.");
          level = "HIGH";
          score = Math.max(score, 95);
          flaggedAddr = { address: a, label: "Blocklist", category: "blocklist" as any, sourceId: "blocklist", confidence: 1 as const, updatedAt: Date.now() };
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
    let tokenConfidencePartial: Partial<Analysis> = {};
    if (tokenForAsset && listCache) {
      await markTokenSeen(chainIdHex, tokenForAsset);
      const firstSeen = await getTokenFirstSeen(chainIdHex, tokenForAsset);
      const tokenScam = isScamToken(chainIdHex, tokenForAsset, listCache);
      const tokenTrusted = isTrustedToken(chainIdHex, tokenForAsset, listCache) || !!(tokenInfo?.v);
      const isNew = firstSeen ? (Date.now() - firstSeen < 7 * 24 * 60 * 60 * 1000) : true;
      let tokenConfidence: "SCAM" | "TRUSTED" | "LOW" | "UNKNOWN" = "UNKNOWN";
      if (tokenScam) tokenConfidence = "SCAM";
      else if (tokenTrusted) tokenConfidence = "TRUSTED";
      else if (isNew) tokenConfidence = "LOW";
      tokenConfidencePartial = { tokenConfidence, tokenFirstSeenAt: firstSeen ?? undefined };
      if (tokenConfidence === "LOW") reasons.push(`Token analisado: ${tokenInfo?.s ?? "?"} — Confiança: BAIXA (recém-lançado / pouca liquidez / sem reputação)`);
    }
    Object.assign(tokenMeta, tokenConfidencePartial);
    if (decodedAction && tokenForAsset && (settings.assetEnrichmentEnabled ?? true) && tabId) {
      try { asset = await getAssetInfo(chainId || "0x1", tokenForAsset, tabId); } catch {}
    }

    if (asset) reasons.push(t("asset_info_reason", { sym: asset.symbol || asset.name || "?", kind: asset.kind }));

    if (isHexString(data) && data.startsWith("0x")) {
      const ap = decodeErc20Approve(data.toLowerCase());
      const incDec = decodedAction && (decodedAction.kind === "INCREASE_ALLOWANCE" || decodedAction.kind === "DECREASE_ALLOWANCE") ? decodedAction : null;
      if (incDec) {
        const isUnlimited = incDec.kind === "INCREASE_ALLOWANCE" && (incDec as any).amountType === "UNLIMITED";
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
          tokenContract: typeof (tx as any).to === "string" ? String((tx as any).to) : undefined,
          spender,
          unlimited: isUnlimited,
        };
        return {
          level: hasAddrIntelHit && addrIntelRecommend === "BLOCK" ? "HIGH" : level,
          score: Math.max(score, addrIntelScore),
          title,
          reasons: hasAddrIntelHit ? [...addrIntelReasons, ...reasons] : reasons,
          decoded: { kind: "APPROVE", spenderOrOperator: spender, amountHuman: isUnlimited ? "UNLIMITED" : (incDec as any).amountRaw ?? "?", raw: { to, value, selector: hexSelector(data) } },
          decodedAction: incDec,
          recommend: isUnlimited ? (addrIntelRecommend ?? (settings.blockHighRisk ? "BLOCK" : "WARN")) : (addrIntelRecommend ?? "WARN"),
          trust,
          suggestedTrustedDomains: [...SUGGESTED_TRUSTED_DOMAINS],
          tx: txSummary || undefined,
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
            risks: isUnlimited ? [t("human_approve_risk_1"), t("human_approve_risk_unlimited")].slice(0, 3) : [t("human_approve_risk_1")].slice(0, 3),
            safeNotes: [t("human_approve_safe_1")].slice(0, 1),
            nextSteps: [t("human_approve_next_1"), t("human_approve_next_2")].slice(0, 3),
            recommendation: isUnlimited ? t("human_approve_reco_unlimited") : t("human_approve_reco"),
            links: [{ text: t("human_revoke_link_text"), href: "https://revoke.cash" }],
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
            tx: txSummary || undefined,
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
            tx: txSummary || undefined,
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
          tx: txSummary || undefined,
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
      if (decodedAction.kind === "APPROVE_ERC20" || decodedAction.kind === "INCREASE_ALLOWANCE" || decodedAction.kind === "DECREASE_ALLOWANCE" || decodedAction.kind === "PERMIT_EIP2612" || decodedAction.kind === "PERMIT2_ALLOWANCE") reasons.push(t("reason_permission_tokens"));
      else if (decodedAction.kind === "SET_APPROVAL_FOR_ALL" && decodedAction.approved) reasons.push(t("reason_permission_all_nfts"));
      else if (decodedAction.kind === "TRANSFER_ERC20" || decodedAction.kind === "TRANSFERFROM_ERC20" || decodedAction.kind === "PERMIT2_TRANSFER") reasons.push(t("token_transfer_detected"));
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
    const host = hostFromUrl(req.url || "");
    const txCtx = detectTxContext({ host, txTo: to, data, valueWei, selector });
    if (intent === "NFT_PURCHASE") reasons.push("Compra de NFT: ao confirmar, valor será transferido e NFT adquirido.");
    if (intent === "SWAP") {
      reasons.push("Swap/compra de token via contrato: ao confirmar, você troca ativo por token.");
      if (listCache) {
        const sim = (req as any)?.simulationOutcome;
        const pathTokens = extractTokenCandidates(to, data, decodedAction, sim);
        for (const addr of pathTokens.slice(0, 5)) {
          try {
            const risk = await getTokenRisk(addr, chainIdHex, listCache);
            if (risk.confidence === "LOW" && risk.symbol) {
              reasons.push(`Token analisado: ${risk.symbol} — Confiança: BAIXA (recém-lançado / pouca liquidez / sem reputação)`);
              if (!tokenConfidencePartial.tokenConfidence || tokenConfidencePartial.tokenConfidence === "UNKNOWN") {
                tokenConfidencePartial = { ...tokenConfidencePartial, tokenConfidence: "LOW" };
                Object.assign(tokenMeta, tokenConfidencePartial);
              }
              break;
            }
          } catch { /* ignore */ }
        }
      }
    }
    if (valueWei > 0n) reasons.push("Envia valor nativo (ETH).");
    if (toIsContract === true) reasons.push(t("reason_contract_target") || REASON_KEYS.CONTRACT_TARGET + ": Destino é contrato.");
    if (reasons.length === 0) reasons.push("Transação on-chain: confirme valor, destino e rede.");
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
      txContext: { kind: txCtx },
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
        safe: lists.safeNotes,
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
