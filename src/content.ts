import type { AnalyzeRequest, Analysis, Settings, CheckResult } from "./shared/types";
import { DEFAULT_SETTINGS } from "./shared/types";
import { SUGGESTED_TRUSTED_DOMAINS } from "./shared/constants";
import { selectorToLabel } from "./shared/signatures";
import { t, tHasKey, renderText } from "./i18n";
import { clamp, escapeHtml } from "./shared/utils";
import { normMethod } from "./shared/normalize";
import { classifyAction, type SGAction } from "./shared/classifyAction";
import { actionTitle, simpleSummary } from "./shared/actionTexts";
import { extractTx } from "./shared/txExtract";
import { ingestRpc, hasRecentSwitch, newFlowState, type FlowState } from "./shared/flowTracker";
import { hexToBigInt, weiToEthString } from "./shared/txMath";
import { weiToEthString as weiToEthFmt } from "./format";
import { getNativeSymbol } from "./shared/chains";
import {
  isRuntimeUsable,
  portRequest,
  safeSendMessage,
  safeStorageGet,
  safeStorageSet,
  safeGetURL,
  safeLocalGet,
  safeLocalSet,
} from "./runtimeSafe";
import { runPageRiskScan, injectPageRiskBanner } from "./risk/domScanner";
import { renderAdToast, dismissAdToast } from "./features/adToast";

function isContextInvalidated(msg: string) {
  const s = (msg || "").toLowerCase();
  return s.includes("extension context invalidated") ||
         s.includes("context invalidated") ||
         s.includes("the message port closed") ||
         s.includes("runtime.lastError") ||
         s.includes("receiving end does not exist") ||
         s.includes("message port closed");
}

function showToast(text: string) {
  try {
    const el = document.createElement("div");
    el.className = "sg-toast";
    el.textContent = text;
    document.documentElement.appendChild(el);
    setTimeout(() => el.remove(), 2500);
  } catch {}
}

window.addEventListener("unhandledrejection", (ev) => {
  const msg = String((ev as any).reason?.message || (ev as any).reason || "");
  if (isContextInvalidated(msg)) {
    ev.preventDefault();
  }
});

window.addEventListener("error", (ev) => {
  const msg = String((ev as any).error?.message || (ev as any).message || "");
  if (isContextInvalidated(msg)) {
    ev.preventDefault?.();
  }
});

type MainWorldRequestMsg = {
  source: "signguard";
  type: "SG_REQUEST";
  requestId: string;
  payload: {
    url: string;
    host: string;
    method: string;
    params: any[] | null;
    chainId: string | null;
    providerHint?: { kind: string; name?: string };
    meta?: any;
  };
};

type DecisionDetail = { requestId: string; allow: boolean; errorMessage?: string };

function dispatchDecision(requestId: string, allow: boolean, errorMessage?: string) {
  try {
    const detail: DecisionDetail = { requestId, allow, errorMessage };
    window.dispatchEvent(new CustomEvent("signguard:decision", { detail }));
    window.postMessage({ source: "signguard-content", type: "SG_DECISION", requestId, allow, errorMessage }, "*");
  } catch {}
}

function waitForDecisionAck(requestId: string, maxMs = 900): Promise<boolean> {
  return new Promise((resolve) => {
    let done = false;
    let t: ReturnType<typeof setTimeout>;

    const cleanup = () => {
      if (done) return;
      done = true;
      try { window.removeEventListener("message", onMsg); } catch {}
      try { clearTimeout(t); } catch {}
    };

    const onMsg = (ev: MessageEvent) => {
      const m = (ev as any)?.data;
      if (!m || typeof m !== "object") return;
      if (m.source !== "signguard-inpage") return;
      if (m.type !== "SG_DECISION_ACK") return;
      if (String(m.requestId || "") !== requestId) return;
      cleanup();
      resolve(true);
    };

    window.addEventListener("message", onMsg);
    t = setTimeout(() => {
      cleanup();
      resolve(false);
    }, maxMs);
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function defaultHumanForIntent(
  intent: string,
  tFn: (k: string) => string
): { whatItDoes: string[]; risks: string[]; safeNotes: string[]; nextSteps: string[] } {
  switch (intent) {
    case "SWITCH_CHAIN":
      return {
        whatItDoes: [tFn("default_human_switch_what")],
        risks: [tFn("default_human_switch_risk")],
        safeNotes: [tFn("default_human_switch_safe")],
        nextSteps: [tFn("default_human_switch_next")],
      };
    case "CONTRACT_INTERACTION":
      return {
        whatItDoes: [tFn("default_human_contract_what")],
        risks: [tFn("default_human_contract_risk")],
        safeNotes: [tFn("default_human_contract_safe")],
        nextSteps: [tFn("default_human_contract_next")],
      };
    case "ETH_TRANSFER":
      return {
        whatItDoes: [tFn("default_human_eth_what")],
        risks: [tFn("default_human_eth_risk")],
        safeNotes: [tFn("default_human_eth_safe")],
        nextSteps: [tFn("default_human_eth_next")],
      };
    case "TYPED_DATA":
      return {
        whatItDoes: [tFn("default_human_typed_what")],
        risks: [tFn("default_human_typed_risk")],
        safeNotes: [tFn("default_human_typed_safe")],
        nextSteps: [tFn("default_human_typed_next")],
      };
    default:
      return {
        whatItDoes: [tFn("default_human_generic_what")],
        risks: [tFn("default_human_generic_risk")],
        safeNotes: [tFn("default_human_generic_safe")],
        nextSteps: [tFn("default_human_generic_next")],
      };
  }
}

/** Local fallback when background fails — useful Analysis without "Análise indisponível"; always render normally. */
function buildLocalFallbackAnalysis(
  payload: MainWorldRequestMsg["payload"],
  settings: Settings,
  wallet?: { kind?: string; name?: string; walletBrand?: string },
  trustedDomainsList?: string[]
): Analysis {
  const method = String(payload?.method || "").toLowerCase();
  const params = payload?.params;
  const tx = Array.isArray(params) && params[0] && typeof params[0] === "object" ? params[0] : {};
  const data = typeof tx?.data === "string" ? tx.data : "";
  const to = typeof tx?.to === "string" ? tx.to : "";
  const valueWei = BigInt(typeof tx?.value === "string" ? tx.value : (tx?.value ?? "0x0") || "0x0");
  const hasData = !!data && data !== "0x" && data.toLowerCase() !== "0x";
  const selector = hasData && data.startsWith("0x") && data.length >= 10 ? data.slice(0, 10) : "";
  const chainId = (payload as any)?.meta?.chainId ?? (payload as any)?.chainId ?? "";
  const txCostPreview = (payload as any)?.txCostPreview;
  const host = (payload?.host || "").trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0];

  let intent: string = "UNKNOWN";
  if (method === "wallet_switchethereumchain") intent = "SWITCH_CHAIN";
  else if (method === "eth_signtypeddata_v4" || method === "eth_signtypeddata_v3" || method === "eth_signtypeddata") intent = "TYPED_DATA";
  else if (method === "eth_sendtransaction" || method === "wallet_sendtransaction") {
    if (hasData) intent = "CONTRACT_INTERACTION";
    else if (valueWei > 0n) intent = "ETH_TRANSFER";
  }

  const dh = defaultHumanForIntent(intent, t);
  const methodShort = method || t("tech_methodRaw");
  const isUnlimitedApproval = selector === "0x095ea7b3" || selector === "0xa22cb465";
  const allowlisted = !!(host && trustedDomainsList?.length && trustedDomainsList.some((d) => host === d || host.endsWith("." + d)));

  let recommend: Analysis["recommend"] = "WARN";
  let score = 50;
  if (intent === "SWITCH_CHAIN" && allowlisted) {
    score = 18;
    recommend = "ALLOW";
  } else if (intent === "ETH_TRANSFER" && allowlisted && valueWei < BigInt(1e18)) {
    score = 28;
    recommend = "WARN";
  } else if (intent === "CONTRACT_INTERACTION") {
    score = 50;
    recommend = "WARN";
  } else if (isUnlimitedApproval && (settings.strictBlockApprovalsUnlimited ?? settings.strictBlockSetApprovalForAll)) {
    score = 70;
    recommend = "HIGH";
  }

  const reasons: string[] = [t("fallback_partial_verification")];
  if (!payload?.host) reasons.push(t("trustReasonNoHost"));

  const checks: CheckResult[] = [
    { key: "DOMAIN_INTEL", status: trustedDomainsList?.length ? (allowlisted ? "PASS" : "WARN") : "WARN" },
    { key: "LOOKALIKE", status: host ? "PASS" : "SKIP" },
    { key: "TX_DECODE", status: intent !== "UNKNOWN" ? "PASS" : "WARN" },
    { key: "FEE_ESTIMATE", status: txCostPreview?.feeEstimated ? "PASS" : "WARN" },
    { key: "ADDRESS_INTEL", status: "SKIP" },
    { key: "ASSET_ENRICH", status: "SKIP" },
    { key: "CLOUD_INTEL", status: "SKIP" },
  ];
  const performed = checks.filter((c) => c.status !== "SKIP").length;
  const total = checks.length;
  const limited = true;
  let verdictLabelKey: string;
  if (recommend === "BLOCK") verdictLabelKey = "verdict_block";
  else if (score <= 20) verdictLabelKey = "verdict_ok";
  else if (score <= 60) verdictLabelKey = "verdict_warn";
  else verdictLabelKey = "verdict_high";

  const a: Analysis = {
    level: recommend === "HIGH" ? "HIGH" : recommend === "ALLOW" ? "LOW" : "WARN",
    score,
    title: recommend === "ALLOW" ? t("no_alerts_known") : t("txPreview"),
    reasons,
    decoded: { kind: "TX", raw: { method, selector, to: to || undefined } },
    recommend,
    intent: intent as any,
    trust: { verdict: allowlisted ? "LIKELY_OFFICIAL" : "UNKNOWN", trustScore: allowlisted ? 75 : 50, reasons: [] },
    suggestedTrustedDomains: [],
    txCostPreview: txCostPreview && typeof txCostPreview === "object"
      ? { feeEstimated: !!txCostPreview.feeEstimated, valueWei: String(txCostPreview.valueWei ?? valueWei.toString(10)), feeReasonKey: "fee_unknown_wallet_will_estimate", ...txCostPreview } as any
      : { feeEstimated: false, valueWei: valueWei.toString(10), feeReasonKey: "fee_unknown_wallet_will_estimate" } as any,
    wallet: wallet ? { kind: wallet.kind as any, name: wallet.name, walletBrand: wallet.walletBrand as any } : undefined,
    human: {
      methodTitle: recommend === "ALLOW" ? t("no_alerts_known") : t("txPreview"),
      methodShort,
      methodWhy: "",
      whatItDoes: dh.whatItDoes,
      risks: dh.risks,
      safeNotes: dh.safeNotes,
      nextSteps: dh.nextSteps,
      recommendation: recommend === "ALLOW" ? t("still_review_wallet") : t("check_wallet_network_fee"),
    },
    checks,
    coverage: { performed, total, limited },
    verdictLabelKey,
    verificationLevel: trustedDomainsList?.length ? "LOCAL" : "BASIC",
    knownSafe: false,
    knownBad: false,
  };
  (a as any)._partialData = true;
  if (to || valueWei > 0n) (a as any).tx = { to: to || undefined, selector, valueEth: valueWei > 0n ? weiToEthString(valueWei) : undefined };
  return a;
}

/** Alias for call sites that don't have settings yet. */
function buildFallbackAnalysis(payload: MainWorldRequestMsg["payload"], wallet?: { kind?: string; name?: string; walletBrand?: string }): Analysis {
  return buildLocalFallbackAnalysis(payload, __sgSettings || DEFAULT_SETTINGS, wallet, __sgTrustedDomains?.length ? __sgTrustedDomains : undefined);
}

function riskDotClass(level: string, severityKey?: string) {
  if (severityKey === "BLOCKED") return "block";
  if (level === "HIGH") return "high";
  if (level === "WARN") return "warn";
  return "low";
}

function riskLabel(level: Analysis["level"]) {
  if (level === "HIGH") return t("risk_HIGH");
  if (level === "WARN") return t("risk_WARN");
  return t("risk_LOW");
}

function recommendLabel(r: Analysis["recommend"]) {
  if (r === "BLOCK") return t("recommend_BLOCK");
  if (r === "HIGH") return t("recommend_HIGH");
  if (r === "WARN") return t("recommend_WARN");
  return t("recommend_ALLOW");
}

function trustLabel(verdict: string | undefined) {
  if (verdict === "LIKELY_OFFICIAL") return t("trust_likelyOfficial");
  if (verdict === "SUSPICIOUS") return t("trust_suspicious");
  return t("trust_unknown");
}

function trustDotClass(verdict: string | undefined) {
  if (verdict === "SUSPICIOUS") return "high";
  if (verdict === "LIKELY_OFFICIAL") return "";
  return "warn";
}

const CHAIN_NAMES: Record<string, string> = {
  "0x1": "Ethereum",
  "0x89": "Polygon",
  "0xa4b1": "Arbitrum",
  "0xa": "Optimism",
  "0x38": "BNB Chain",
  "0xa86a": "Avalanche",
};

function chainNameFromId(hex: string | undefined): string {
  if (!hex) return "";
  const id = String(hex).toLowerCase();
  return CHAIN_NAMES[id] || id;
}

function shortenHex(s: string | undefined) {
  if (!s || typeof s !== "string") return "";
  if (s.length <= 12) return s;
  return `${s.slice(0, 6)}…${s.slice(-4)}`;
}

function formatVerificationUpdated(updatedAt: number): string {
  const diffMs = Date.now() - updatedAt;
  const hours = Math.floor(diffMs / (60 * 60 * 1000));
  const days = Math.floor(diffMs / (24 * 60 * 60 * 1000));
  if (days >= 1) return t("updated_x_days", { n: days });
  return t("updated_x_hours", { n: hours < 1 ? 1 : hours });
}

/** Never show raw i18n keys. Resolve key to text, or return literal. */
function resolveText(x: string | undefined | null): string {
  if (!x) return "";
  const s = String(x).trim();
  if (!s) return "";
  if (tHasKey(s)) return t(s);
  return s;
}

function sendKeepalive(requestId: string) {
  try {
    window.postMessage({ source: "signguard-content", type: "SG_KEEPALIVE", requestId }, "*");
  } catch {}
}

/** Page Risk Scanner: run DOM heuristics and inject red bar if HIGH risk (e.g. lookalike domain). */
function runPageRiskScannerOnce() {
  try {
    const doc = document;
    if (!doc.body) return;
    const hostname = window.location.hostname || "";
    const result = runPageRiskScan(doc, hostname);
    if (result.riskScore === "HIGH") {
      injectPageRiskBanner(t("page_risk_suspicious_banner"), doc);
    }
    if (result.riskScore !== "LOW") {
      try {
        if (typeof chrome !== "undefined" && chrome.runtime?.sendMessage) {
          const title = doc.title ?? "";
          const metaDesc = doc.querySelector('meta[name="description"]')?.getAttribute("content") ?? "";
          const score = result.riskScore === "HIGH" ? 100 : 50;
          chrome.runtime.sendMessage({
            type: "SG_TELEMETRY_THREAT",
            payload: {
              url: window.location.href,
              riskScore: score,
              reasons: result.reasons?.length ? result.reasons : ["PAGE_RISK"],
              metadata: { title, description: metaDesc },
            },
          });
        }
      } catch {
        // telemetry best-effort
      }
    }
  } catch {}
}

type SGPageRpcMsg =
  | {
      __SIGNGUARD__: true;
      type: "SG_RPC";
      data: { method: any; params: any };
      href: string;
      origin: string;
      ts: number;
    }
  | {
      __SIGNGUARD__: true;
      type: "SG_RPC_ENRICH_TX";
      data: { gasLimit?: any; maxFeePerGas?: any; gasFeeWeiHex?: any; forHref?: any };
      href: string;
      origin: string;
      ts: number;
    }
  | {
      __SIGNGUARD__: true;
      type: "TELEMETRY_WALLETS_DETECTED";
      data: { wallets: string[] };
      href?: string;
      origin?: string;
      ts?: number;
    };

let __sgFlow: FlowState = newFlowState();

type PendingRequest = {
  requestId: string;
  method: string;
  params?: any[];
  origin: string;
  href: string;
  host: string;
  analysis: Analysis;
  receivedAt: number;
  rpcMeta?: any;
  chainIdHex?: string | null;
  wallet?: { kind: string; name: string };
};

// FLOW/QUEUE
const requestQueue: Array<PendingRequest> = [];
const recentSwitchByOrigin: Map<string, { ts: number; chainId?: string }> = new Map();
const FLOW_TTL_MS = 60_000;

let __sgSettings: Settings | null = null;
let __sgSettingsLoading: Promise<void> | null = null;

let __sgUsdPerEth: number | null = null;
let __sgUsdFetchedAt = 0;
const NATIVE_USD_TTL_MS = 120_000;
const __sgNativeByChain: Record<string, { usd: number; symbol: string; fetchedAt: number }> = {};

function toChainIdHex(chainId: string | number | null | undefined): string | null {
  if (chainId == null || chainId === "") return null;
  const s = String(chainId).trim();
  if (s.toLowerCase().startsWith("0x")) return s;
  const n = parseInt(s, 10);
  if (!Number.isFinite(n) || n < 0) return null;
  return "0x" + n.toString(16);
}

async function ensureUsdLoaded() {
  if ((__sgSettings ?? DEFAULT_SETTINGS).showUsd === false) return;
  const now = Date.now();
  if (__sgUsdPerEth != null && (now - __sgUsdFetchedAt) < 60_000) return;
  const resp = await safeSendMessage<any>({ type: "GET_ETH_USD" }, 2500);
  const usd = Number(resp?.usdPerEth);
  if (resp?.ok && Number.isFinite(usd) && usd > 0) {
    const changed = __sgUsdPerEth !== usd;
    __sgUsdPerEth = usd;
    __sgUsdFetchedAt = now;
    if (changed && __sgOverlay?.container?.isConnected) updateOverlay(__sgOverlay);
  }
}

async function ensureNativeUsdForChain(chainIdHex: string | null): Promise<{ usd: number; symbol: string } | null> {
  if ((__sgSettings ?? DEFAULT_SETTINGS).showUsd === false) return null;
  if (!chainIdHex) return null;
  const key = chainIdHex.toLowerCase();
  const now = Date.now();
  const hit = __sgNativeByChain[key];
  if (hit && (now - hit.fetchedAt) < NATIVE_USD_TTL_MS) return hit;
  const resp = await safeSendMessage<any>({ type: "SG_GET_NATIVE_USD", payload: { chainIdHex } }, 4000);
  if (resp?.ok && Number.isFinite(resp?.usdPerNative) && resp.usdPerNative > 0) {
    const entry = { usd: resp.usdPerNative, symbol: resp.nativeSymbol ?? getNativeSymbol(chainIdHex), fetchedAt: now };
    __sgNativeByChain[key] = entry;
    if (__sgOverlay?.container?.isConnected) updateOverlay(__sgOverlay);
    return entry;
  }
  if (hit) return hit;
  if (__sgUsdPerEth != null) return { usd: __sgUsdPerEth, symbol: getNativeSymbol(chainIdHex) };
  return null;
}

function usdFromEth(ethStr?: string, usdPerNative?: number | null): string {
  if ((__sgSettings ?? DEFAULT_SETTINGS).showUsd === false) return "";
  const rate = usdPerNative ?? __sgUsdPerEth;
  if (rate == null) return "";
  const n = Number(String(ethStr ?? "").trim());
  if (!Number.isFinite(n)) return "";
  const usd = n * rate;
  if (!Number.isFinite(usd)) return "";
  const fmt = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
  return ` (≈ ${fmt.format(usd)})`;
}

function usdApproxFromEthString(ethStr?: string, usdPerNative?: number | null): string {
  return usdFromEth(ethStr, usdPerNative);
}

async function ensureSettingsLoaded() {
  if (__sgSettings) return;
  if (__sgSettingsLoading) return __sgSettingsLoading;
  __sgSettingsLoading = (async () => {
    const r = await safeStorageGet<Settings>(DEFAULT_SETTINGS);
    __sgSettings = r.ok ? (r.data as any as Settings) : DEFAULT_SETTINGS;
    __sgSettingsLoading = null;
    if (__sgOverlay) updateOverlay(__sgOverlay);
  })();
  return __sgSettingsLoading;
}

let __sgTrustedDomains: string[] = [];
let __sgTrustedDomainsLoaded = false;
let __sgTrustedDomainsLoading: Promise<void> | null = null;

const toArr = (v: any): string[] => (Array.isArray(v) ? v.map(String) : []);

function normDomain(d: string): string {
  return (d || "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .split("/")[0];
}

async function ensureTrustedDomainsLoaded() {
  if (__sgTrustedDomainsLoaded) return;
  if (__sgTrustedDomainsLoading) return __sgTrustedDomainsLoading;
  __sgTrustedDomainsLoading = (async () => {
    const uniq: string[] = [];
    const push = (v: string) => {
      const n = normDomain(v);
      if (!n) return;
      if (!uniq.includes(n)) uniq.push(n);
    };
    [
      ...(DEFAULT_SETTINGS.trustedDomains ?? []),
      ...(DEFAULT_SETTINGS.allowlist ?? []),
      ...(SUGGESTED_TRUSTED_DOMAINS ?? []),
    ].forEach(push);
    const sync = await safeStorageGet<{ trustedDomains?: string[]; allowlist?: string[] }>({ trustedDomains: [], allowlist: [] });
    if (sync.ok) {
      toArr((sync.data as any)?.trustedDomains).forEach(push);
      toArr((sync.data as any)?.allowlist).forEach(push);
    }
    __sgTrustedDomains = uniq.slice(0, 500);
    __sgTrustedDomainsLoaded = true;
    __sgTrustedDomainsLoading = null;
    if (__sgOverlay) updateOverlay(__sgOverlay);
  })();
  return __sgTrustedDomainsLoading;
}

function lastSendTxStep() {
  for (let i = __sgFlow.steps.length - 1; i >= 0; i--) {
    const s = __sgFlow.steps[i] as any;
    if (s && s.kind === "SEND_TX") return s as any;
  }
  return null;
}

function recomputeLastSendTxMath() {
  const step = lastSendTxStep();
  if (!step) return;
  const tx = step.tx || {};
  const valueWei = hexToBigInt(typeof tx?.value === "string" ? tx.value : "0x0");
  step.valueWei = valueWei;
  step.valueEth = weiToEthString(valueWei);
  if (step.gasFeeWei && typeof step.gasFeeWei === "bigint") {
    step.gasEth = weiToEthString(step.gasFeeWei);
    step.totalEth = weiToEthString(valueWei + step.gasFeeWei);
  }
}

function handlePageRpcMessage(ev: MessageEvent) {
  try {
    if (ev.source !== window) return;
    const d = ev.data as any;
    if (!d || d.__SIGNGUARD__ !== true) return;
    const msg = d as SGPageRpcMsg;

    if (msg.type === "SG_RPC") {
      __sgFlow = ingestRpc(__sgFlow, String((msg as any).data?.method || ""), (msg as any).data?.params);
      recomputeLastSendTxMath();
      if (__sgOverlay) updateOverlay(__sgOverlay);
      return;
    }

    if (msg.type === "SG_RPC_ENRICH_TX") {
      const gasFeeWeiHex = String((msg as any).data?.gasFeeWeiHex || "");
      if (gasFeeWeiHex && gasFeeWeiHex.startsWith("0x")) {
        const step = lastSendTxStep();
        if (step) {
          step.gasFeeWei = hexToBigInt(gasFeeWeiHex);
          recomputeLastSendTxMath();
          if (__sgOverlay) updateOverlay(__sgOverlay);
        }
      }
      return;
    }

    if (msg.type === "TELEMETRY_WALLETS_DETECTED") {
      const wallets = (msg as any).data?.wallets;
      if (Array.isArray(wallets) && wallets.length > 0 && typeof chrome !== "undefined" && chrome.runtime?.sendMessage) {
        chrome.runtime.sendMessage({ type: "TELEMETRY_WALLETS_DETECTED", payload: { wallets } }).catch(() => {});
      }
      return;
    }
  } catch {}
}

// NOTE: intentionally no chrome.* Promise usage in this file.

function ensureOverlayCss(shadow: ShadowRoot) {
  try {
    const href = safeGetURL("overlay.css");
    const existing = shadow.querySelector(`link[rel="stylesheet"][href="${href}"]`);
    if (existing || !href) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = href;
    shadow.appendChild(link);
  } catch {}
}

type OverlayState = {
  requestId: string;
  analysis: Analysis;
  meta: { host: string; method: string; params?: any; rawShape?: string; rpcMeta?: any; chainIdHex?: string | null };
  container: HTMLDivElement;
  shadow: ShadowRoot;
  app: HTMLDivElement;
  onKey: (e: KeyboardEvent) => void;
  countdownTimer?: number | null;
  keepaliveInterval?: number | null;
  analysisLoading?: boolean;
};

let __sgOverlay: OverlayState | null = null;

const DEBUG_KEY = "sg_debug_events";

async function pushDebugEvent(evt: any) {
  try {
    if (!isRuntimeUsable()) return;
    const raw = await safeLocalGet<unknown[]>(DEBUG_KEY);
    const arr = Array.isArray(raw) ? [...raw] : [];
    arr.push(evt);
    const trimmed = arr.slice(-20);
    await safeLocalSet({ [DEBUG_KEY]: trimmed });
  } catch {}
}

function tryCopyToClipboard(text: string) {
  try {
    void navigator.clipboard?.writeText?.(text);
    return true;
  } catch {
    return false;
  }
}

function markUiShownFromContent(requestId: string) {
  // Mark that UI was shown (affects MAIN-world timeout behavior)
  try {
    window.dispatchEvent(new CustomEvent("signguard:uiShown", { detail: { requestId } }));
  } catch {}
  try {
    window.postMessage({ source: "signguard-content", type: "SG_UI_SHOWN", requestId }, "*");
  } catch {}
}

function getCurrentPending() {
  return requestQueue.length ? requestQueue[0] : null;
}

function showCurrentPending() {
  const cur = getCurrentPending();
  if (!cur) {
    cleanupOverlay();
    return;
  }
  const chainIdHex = cur.chainIdHex ?? toChainIdHex(cur.rpcMeta?.chainId);
  void ensureNativeUsdForChain(chainIdHex ?? null);
  showOverlay(cur.requestId, cur.analysis, { host: cur.host, method: cur.method, params: cur.params, rpcMeta: cur.rpcMeta, chainIdHex: chainIdHex ?? undefined });
}

const DECISION_ACK_FALLBACK_MS = 150;
const pendingClickFallback: Record<string, { allow: boolean; timer: ReturnType<typeof setTimeout> }> = {};

function closeOverlayAndAdvance(requestId: string, allow: boolean) {
  const idx = requestQueue.findIndex((p) => p.requestId === requestId);
  const cur = idx >= 0 ? requestQueue.splice(idx, 1)[0] : null;
  const buttons = __sgOverlay?.shadow?.querySelectorAll?.("button");
  buttons?.forEach((b) => { (b as HTMLButtonElement).disabled = true; (b as HTMLElement).style.pointerEvents = "none"; });
  if (__sgOverlay?.keepaliveInterval) {
    try { clearInterval(__sgOverlay.keepaliveInterval as any); } catch {}
    __sgOverlay.keepaliveInterval = null;
  }
  const container = __sgOverlay?.container;
  const onKey = __sgOverlay?.onKey;
  const hasMore = requestQueue.length > 0;
  __sgOverlay = null;

  if (cur) {
    try {
      const tx = (cur.analysis as any)?.tx;
      const txCost = (cur.analysis as any)?.txCostPreview;
      const txExtras = (cur.analysis as any)?.txExtras;
      const historyEvt = {
        ts: Date.now(),
        requestId,
        host: cur.host,
        url: cur.href,
        wallet: cur.wallet?.name,
        chainId: cur.rpcMeta?.chainId,
        action: (cur.analysis as any)?.intent ?? cur.method,
        method: cur.method,
        to: tx?.to ?? txExtras?.toAddress ?? txExtras?.tokenContract,
        valueEth: tx?.valueEth,
        feeLikelyEth: txCost?.feeLikelyWei != null ? weiToEthFmt(BigInt(txCost.feeLikelyWei)) : undefined,
        feeMaxEth: txCost?.feeMaxWei != null ? weiToEthFmt(BigInt(txCost.feeMaxWei)) : undefined,
        totalLikelyEth: txCost?.totalLikelyWei != null ? weiToEthFmt(BigInt(txCost.totalLikelyWei)) : undefined,
        totalMaxEth: txCost?.totalMaxWei != null ? weiToEthFmt(BigInt(txCost.totalMaxWei)) : undefined,
        usdPerEth: __sgUsdPerEth ?? undefined,
        decision: allow ? "ALLOW" : "BLOCK",
        score: cur.analysis?.score,
        level: cur.analysis?.level,
      };
      void safeSendMessage({ type: "SG_LOG_HISTORY", payload: historyEvt }, 800);
    } catch {}
    try {
      if ((__sgSettings || DEFAULT_SETTINGS).debugMode) {
        pushDebugEvent({
          ts: Date.now(),
          kind: "DECISION",
          requestId,
          allow,
          origin: cur.origin,
          href: cur.href,
          host: cur.host,
          method: cur.method,
          level: cur.analysis?.level,
          score: cur.analysis?.score,
          recommend: cur.analysis?.recommend,
          intent: (cur.analysis as any)?.intent,
          isPhishing: !!(cur.analysis as any)?.isPhishing,
        });
      }
    } catch {}
  }

  try { if (container) container.remove(); } catch {}
  try { if (onKey) document.removeEventListener("keydown", onKey); } catch {}
  if (hasMore) setTimeout(() => showCurrentPending(), 50);
  else cleanupOverlay();
}

window.addEventListener("message", (ev: MessageEvent) => {
  try {
    if (ev.source !== window) return;
    const d = (ev as any)?.data;
    if (!d || d.source !== "signguard-inpage" || d.type !== "SG_DECISION_ACK") return;
    const requestId = String(d.requestId || "");
    if (!requestId) return;
    const allow = !!d.allow;
    const pending = pendingClickFallback[requestId];
    if (pending) {
      clearTimeout(pending.timer);
      delete pendingClickFallback[requestId];
    }
    closeOverlayAndAdvance(requestId, allow);
  } catch {}
});

async function decideCurrentAndAdvance(allow: boolean) {
  const cur = requestQueue[0];
  if (!cur) {
    if (requestQueue.length) showCurrentPending();
    else cleanupOverlay();
    return;
  }
  const requestId = cur.requestId;
  dispatchDecision(requestId, allow);
  pendingClickFallback[requestId] = {
    allow,
    timer: setTimeout(() => {
      if (!pendingClickFallback[requestId]) return;
      delete pendingClickFallback[requestId];
      dispatchDecision(requestId, allow);
    }, DECISION_ACK_FALLBACK_MS),
  };
  showToast(t("hint_wallet_popup"));

  const ack = await waitForDecisionAck(requestId, 900);
  if (!ack) {
    showToast(t("request_expired_toast") || "Solicitação expirada. Refaça a ação no site e tente novamente.");
    await sleep(1200);
  }
  if (pendingClickFallback[requestId]) {
    clearTimeout(pendingClickFallback[requestId].timer);
    delete pendingClickFallback[requestId];
  }
  closeOverlayAndAdvance(requestId, allow);
}

function isPhishingAnalysis(a: Analysis) {
  if (a?.isPhishing) return true;
  const rs = (a?.reasons || []).map((x) => String(x || "").toLowerCase());
  return rs.some((r) => r.includes("blacklist") && r.includes("phishing"));
}

function actionTitleI18n(a: SGAction, intent?: string) {
  if (a === "SEND_TX" && intent) {
    if (intent === "CONTRACT_INTERACTION") return t("action_SEND_TX_contract_title");
    if (intent === "ETH_TRANSFER") return t("action_SEND_TX_eth_title");
  }
  const k = `action_${a}_title`;
  const v = t(k);
  return v === k ? actionTitle(a) : v;
}

function summaryBulletsI18n(a: SGAction): string[] {
  const keys: Record<SGAction, string[]> = {
    CONNECT: ["summary_CONNECT_1", "summary_CONNECT_2", "summary_CONNECT_3"],
    REQUEST_PERMISSIONS: ["summary_REQUEST_PERMISSIONS_1", "summary_REQUEST_PERMISSIONS_2"],
    SWITCH_CHAIN: ["summary_SWITCH_CHAIN_1", "summary_SWITCH_CHAIN_2"],
    ADD_CHAIN: ["summary_ADD_CHAIN_1", "summary_ADD_CHAIN_2"],
    SIGN_MESSAGE: ["summary_SIGN_MESSAGE_1", "summary_SIGN_MESSAGE_2"],
    SIGN_TYPED_DATA: ["summary_SIGN_TYPED_DATA_1", "summary_SIGN_TYPED_DATA_2", "summary_SIGN_TYPED_DATA_3"],
    SEND_TX: ["summary_SEND_TX_1", "summary_SEND_TX_2", "summary_SEND_TX_3"],
    WATCH_ASSET: ["summary_WATCH_ASSET_1", "summary_WATCH_ASSET_2"],
    SOLANA: ["summary_SOLANA_1"],
    UNKNOWN: ["summary_UNKNOWN_1", "summary_UNKNOWN_2"],
  };
  const ks = keys[a] || keys.UNKNOWN;
  return ks
    .map((key) => {
      const v = t(key);
      return v === key ? "" : v;
    })
    .filter(Boolean);
}

function renderOverlay(state: OverlayState) {
  if (state.container) {
    state.container.setAttribute("data-sg-overlay", "1");
    state.container.setAttribute("data-sg-request-id", state.requestId);
  }
  // Avoid leaking countdown timers when switching queued items
  if (state.countdownTimer) {
    try { clearInterval(state.countdownTimer as any); } catch {}
    state.countdownTimer = null;
  }

  const { analysis, meta, analysisLoading } = state;
  const host = meta.host;
  const method = meta.method;
  const methodNorm = normMethod(method);
  const chainIdHex = meta.chainIdHex ?? toChainIdHex((meta as any)?.rpcMeta?.chainId);
  const nativeSymbol = getNativeSymbol(chainIdHex) || "ETH";
  const usdPerNative = chainIdHex ? (__sgNativeByChain[chainIdHex.toLowerCase()]?.usd ?? __sgUsdPerEth) : __sgUsdPerEth;
  if (chainIdHex) void ensureNativeUsdForChain(chainIdHex);

  const stepTx = lastSendTxStep();
  const hasTxInFlow = !!stepTx;
  const baseAction: SGAction = classifyAction(method, meta.params);
  const displayAction: SGAction = baseAction;

  const tx = displayAction === "SEND_TX"
    ? extractTx(stepTx?.tx ? [stepTx.tx] : meta.params)
    : null;

  const settings = (__sgSettings || DEFAULT_SETTINGS);
  const phishingHardBlock =
    analysis.recommend === "BLOCK" &&
    isPhishingAnalysis(analysis) &&
    !(settings.allowOverrideOnPhishing ?? false);
  const severityKey = phishingHardBlock ? "BLOCKED" : (analysis.level === "HIGH" ? "HIGH" : analysis.level === "WARN" ? "WARN" : "LOW");
  const scoreNum = clamp(analysis.score, 0, 100);
  const pillSeverity = severityKey === "BLOCKED" ? "BLOCKED" : scoreNum <= 20 ? "LOW" : scoreNum <= 60 ? "WARN" : scoreNum <= 90 ? "HIGH" : "BLOCKED";
  const dotCls = riskDotClass(analysis.level, severityKey);
  const walletDisplay = (analysis as any).wallet?.walletName
    ?? (analysis as any).wallet?.walletBrand
    ?? (((analysis as any).wallet?.id === "unknown" || !(analysis as any).wallet?.id) ? t("wallet_evm_generic") : ((analysis as any).wallet?.name || t("wallet_detecting")));
  const chainTarget = analysis?.chainTarget;
  const chainDisplay = chainTarget?.chainName || chainNameFromId(chainTarget?.chainIdHex || (meta as any)?.rpcMeta?.chainId);

  const trust = analysis.trust;
  const trustText = `${trustLabel(trust?.verdict)} • ${clamp(trust?.trustScore ?? 0, 0, 100)}/100`;
  const trustReasons = (trust?.reasons || []).slice(0, 2);
  const domainListDecision = (analysis as any).domainListDecision as "TRUSTED" | "BLOCKED" | "UNKNOWN" | undefined;
  const siteReputationLabel = domainListDecision === "TRUSTED" ? t("list_site_trusted") : domainListDecision === "BLOCKED" ? t("list_site_blocked") : t("list_site_unknown");

  const human = analysis.human;

  const summaryBullets =
    displayAction === "SWITCH_CHAIN" && !hasTxInFlow
      ? [t("switch_summary_no_gas")]
      : summaryBulletsI18n(displayAction).slice(0, 6);

  const recommendedText =
    displayAction === "SEND_TX"
      ? t("sendtx_reco")
      : (human?.recommendation ? resolveText(human.recommendation) : t("info_unavailable"));

  const allReasons = (analysis.reasons || []).map((r) => resolveText(r));
  const mainReasons = allReasons.slice(0, 6);
  const moreReasons = allReasons.slice(6);

  const decodedStr = (() => {
    try {
      if (!analysis.decoded) return "";
      const s = JSON.stringify(analysis.decoded, null, 2) || "";
      const lines = s.split("\n");
      const limited = lines.slice(0, 10).join("\n");
      return lines.length > 10 ? `${limited}\n...` : limited;
    } catch {
      return "";
    }
  })();

  const trustedDomainsAll = __sgTrustedDomains || [];
  const TRUSTED_PREVIEW_COUNT = 8;
  const trustedDomainsPreview = trustedDomainsAll.slice(0, TRUSTED_PREVIEW_COUNT);
  const trustedDomainsMoreCount = Math.max(0, trustedDomainsAll.length - TRUSTED_PREVIEW_COUNT);

  const moreWhat = (human?.whatItDoes || []).slice(0, 4);
  const moreRisks = (human?.risks || []).slice(0, 4);
  const moreSafe = (human?.safeNotes || []).slice(0, 3);
  const moreNext = (human?.nextSteps || []).slice(0, 4);

  const cp = (analysis as any)?.txCostPreview;
  const valueEth = cp?.valueWei !== undefined
    ? weiToEthFmt(BigInt(cp.valueWei))
    : (stepTx?.valueEth || (displayAction === "SEND_TX" ? "0" : ""));
  const feeEstimated = !!cp?.feeEstimated;
  const feeLikelyEth = cp?.feeLikelyWei ? weiToEthFmt(BigInt(cp.feeLikelyWei)) : undefined;
  const feeMaxEth = cp?.feeMaxWei ? weiToEthFmt(BigInt(cp.feeMaxWei)) : undefined;
  const totalLikelyEth = cp?.totalLikelyWei ? weiToEthFmt(BigInt(cp.totalLikelyWei)) : undefined;
  const totalMaxEth = cp?.totalMaxWei ? weiToEthFmt(BigInt(cp.totalMaxWei)) : undefined;
  const feeReasonKey = cp?.feeReasonKey;
  const feeKnown = feeEstimated || !!(analysis?.tx as any)?.feeKnown;
  const maxGasFeeEthFromTx = (analysis?.tx as any)?.maxGasFeeEth;
  const maxTotalEthFromTx = (analysis?.tx as any)?.maxTotalEth;
  const gasEth = stepTx?.gasEth;
  const totalEth = stepTx?.totalEth;
  const hasFeeGtValue = !!(analysis as any)?.feeGtValue;
  const valueProvided = (() => {
    try { return !!(stepTx?.tx && typeof stepTx.tx.value === "string" && stepTx.tx.value.length > 0) || (cp?.valueWei !== undefined && BigInt(cp.valueWei) > 0n); } catch { return false; }
  })();
  const txTo = (() => {
    try { return typeof stepTx?.tx?.to === "string" ? String(stepTx.tx.to) : undefined; } catch { return undefined; }
  })();
  const txSelector = (() => {
    try {
      const d = stepTx?.tx?.data;
      return (typeof d === "string" && d.startsWith("0x") && d.length >= 10) ? d.slice(0, 10) : undefined;
    } catch {
      return undefined;
    }
  })();
  const maxGasFeeEth = feeEstimated ? feeMaxEth : (feeKnown ? (maxGasFeeEthFromTx || analysis?.tx?.maxGasFeeEth) : undefined);
  const maxTotalEth = feeEstimated ? totalMaxEth : (feeKnown ? (maxTotalEthFromTx || analysis?.tx?.maxTotalEth) : undefined);
  const addChainInfo = (analysis as any)?.addChainInfo as { chainId?: string; chainName?: string; rpcUrls?: string[]; nativeCurrencySymbol?: string } | undefined;
  const watchAssetInfo = (analysis as any)?.watchAssetInfo as { type?: string; address?: string; symbol?: string; decimals?: number; image?: string } | undefined;
  const txExtras = (analysis as any)?.txExtras as any;
  const intent = (analysis as any)?.intent as any;

  const intentLabel = (() => {
    const i = String(intent || "UNKNOWN");
    if (i === "NFT_PURCHASE") return t("intent_NFT_PURCHASE");
    if (i === "SWAP") return t("intent_SWAP");
    if (i === "APPROVAL") return t("intent_APPROVAL");
    if (i === "CONTRACT_INTERACTION") return t("intent_CONTRACT_INTERACTION");
    if (i === "ETH_TRANSFER") return t("intent_ETH_TRANSFER");
    if (i === "TOKEN_TRANSFER") return t("intent_TOKEN_TRANSFER");
    if (i === "NFT_TRANSFER") return t("intent_NFT_TRANSFER");
    if (i === "SWITCH_CHAIN") return t("intent_SWITCH_CHAIN");
    if (i === "ADD_CHAIN") return t("intent_ADD_CHAIN");
    if (i === "WATCH_ASSET") return t("intent_WATCH_ASSET");
    if (i === "SOLANA") return t("intent_SOLANA");
    if (i === "SIGNATURE") return t("intent_SIGNATURE");
    if (i === "TYPED_DATA") return t("intent_TYPED_DATA");
    if (i === "SEND") return t("intent_SEND");
    return t("intent_UNKNOWN");
  })();

  const decodedAction = (analysis as any)?.decodedAction;
  const approvalBlock = (() => {
    try {
      if (!txExtras || typeof txExtras !== "object") return "";
      const approvalType = String(txExtras.approvalType || "");
      const tokenContract = typeof txExtras.tokenContract === "string" ? txExtras.tokenContract : "";
      const spender = typeof txExtras.spender === "string" ? txExtras.spender : "";
      const operator = typeof txExtras.operator === "string" ? txExtras.operator : "";
      const unlimited = !!(txExtras as any).unlimited;
      if (!approvalType) return "";
      return `
        <div class="sg-kv">
          <div class="sg-k">${escapeHtml(t("permission_title"))}</div>
          <div class="sg-v">
            ${tokenContract ? `<div style="margin-top:2px"><b>${escapeHtml(t("permission_token_contract"))}</b>: <code>${escapeHtml(shortenHex(tokenContract))}</code> <button class="sg-copy" data-copy="${escapeHtml(tokenContract)}">${escapeHtml(t("copy"))}</button></div>` : ""}
            ${spender ? `<div style="margin-top:8px"><b>${escapeHtml(t("permission_spender"))}</b>: <code>${escapeHtml(shortenHex(spender))}</code> <button class="sg-copy" data-copy="${escapeHtml(spender)}">${escapeHtml(t("copy"))}</button></div>` : ""}
            ${operator ? `<div style="margin-top:8px"><b>${escapeHtml(t("permission_operator"))}</b>: <code>${escapeHtml(shortenHex(operator))}</code> <button class="sg-copy" data-copy="${escapeHtml(operator)}">${escapeHtml(t("copy"))}</button></div>` : ""}
            <div style="margin-top:6px;font-size:12px;opacity:.9">${escapeHtml(t("permission_unlimited"))}: ${unlimited ? escapeHtml(t("yes")) : escapeHtml(t("no"))}</div>
          </div>
        </div>
      `;
    } catch {
      return "";
    }
  })();

  const transferBlock = (() => {
    try {
      if (!decodedAction || (decodedAction.kind !== "TRANSFER_ERC20" && decodedAction.kind !== "TRANSFERFROM_ERC20" && decodedAction.kind !== "TRANSFER_NFT")) return "";
      const da = decodedAction as any;
      const recipient = da.to;
      const amountRaw = da.amountRaw;
      const tokenId = da.tokenIdRaw;
      if (!recipient && !amountRaw && !tokenId) return "";
      return `
        <div class="sg-kv">
          <div class="sg-k">${escapeHtml(intent === "NFT_TRANSFER" ? t("transfer_nft_title") : t("transfer_token_title"))}</div>
          <div class="sg-v">
            ${recipient ? `<div><b>${escapeHtml(t("tx_destination"))}</b>: <code>${escapeHtml(shortenHex(recipient))}</code> <button class="sg-copy" data-copy="${escapeHtml(recipient)}">${escapeHtml(t("copy"))}</button></div>` : ""}
            ${amountRaw ? `<div style="margin-top:6px"><b>${escapeHtml(t("transfer_amount"))}</b>: <code>${escapeHtml(amountRaw)}</code></div>` : ""}
            ${tokenId ? `<div style="margin-top:6px"><b>${escapeHtml(t("transfer_token_id"))}</b>: <code>${escapeHtml(tokenId)}</code></div>` : ""}
          </div>
        </div>
      `;
    } catch {
      return "";
    }
  })();

  const typedDataPermitBlock = (() => {
    try {
      const extras = (analysis as any)?.typedDataExtras as { spender?: string; value?: string; deadline?: string } | undefined;
      if (!extras || (!extras.spender && !extras.value && !extras.deadline)) return "";
      return `
        <div class="sg-kv">
          <div class="sg-k">${escapeHtml(t("permission_title"))} (Permit)</div>
          <div class="sg-v">
            ${extras.spender ? `<div><b>${escapeHtml(t("permission_spender"))}</b>: <code>${escapeHtml(shortenHex(extras.spender))}</code> <button class="sg-copy" data-copy="${escapeHtml(extras.spender)}">${escapeHtml(t("copy"))}</button></div>` : ""}
            ${extras.value ? `<div style="margin-top:6px"><b>${escapeHtml(t("transfer_amount"))}</b>: <code>${escapeHtml(extras.value)}</code></div>` : ""}
            ${extras.deadline ? `<div style="margin-top:6px"><b>Deadline</b>: <code>${escapeHtml(extras.deadline)}</code></div>` : ""}
          </div>
        </div>
      `;
    } catch {
      return "";
    }
  })();

  const knownSafe = !!(analysis as any).knownSafe;
  const knownBad = !!(analysis as any).knownBad;
  const verificationLevel = (analysis as any).verificationLevel as "FULL" | "LOCAL" | "BASIC" | undefined;
  const verificationUpdatedAt = (analysis as any).verificationUpdatedAt as number | undefined;
  const scoreMappedSeverity = knownSafe ? "LOW" : (knownBad ? "BLOCKED" : (scoreNum <= 20 ? "LOW" : scoreNum <= 60 ? "WARN" : "HIGH"));
  const pillSeverityFinal = severityKey === "BLOCKED" ? "BLOCKED" : scoreMappedSeverity === "BLOCKED" ? "BLOCKED" : scoreMappedSeverity === "HIGH" ? "HIGH" : scoreMappedSeverity === "WARN" ? "WARN" : "LOW";
  const verdictKey = analysis.verdictLabelKey || (analysis.recommend === "BLOCK" ? "verdict_block" : knownSafe ? "verdict_ok" : scoreNum <= 20 ? "verdict_ok" : scoreNum <= 60 ? "verdict_warn" : "verdict_high");
  const pillLabel = t(verdictKey);
  const pillClass = pillSeverityFinal === "BLOCKED" ? "sg-pill--block" : pillSeverityFinal === "HIGH" ? "sg-pill--high" : pillSeverityFinal === "WARN" ? "sg-pill--warn" : "sg-pill--low";
  const coverage = analysis.coverage;
  const coverageLine = coverage
    ? `${t("coverage_label")}: ${coverage.performed}/${coverage.total}`
    + (coverage.limited ? ` • ${t("coverage_limited")}` : "")
    : "";
  const queueTotal = requestQueue.length;
  const queueIndicator = queueTotal > 1 ? t("queue_indicator", { pos: 1, total: queueTotal }) : "";
  const needsFriction =
    (!phishingHardBlock && analysis.recommend === "BLOCK") ||
    (analysis.recommend === "HIGH") ||
    (analysis.level === "HIGH" && settings.blockHighRisk) ||
    (analysis.level === "HIGH" && displayAction === "SIGN_TYPED_DATA" && (settings.requireTypedOverride ?? true));

  const isLoading = !!analysisLoading;
  const showActivateProtectionLink = !isLoading && (analysis as any).simulationOutcome?.simulated === false;

  state.app.innerHTML = `
    <div class="sg-backdrop">
      <div class="sg-modal">
        <div class="sg-header">
          <div class="sg-brand">
            <span class="sg-brand-icon" aria-hidden="true"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 2L4 5v6.09c0 5.05 3.41 9.76 8 10.91 4.59-1.15 8-5.86 8-10.91V5l-8-3z" fill="currentColor" opacity="0.9"/></svg></span>
            <span>${escapeHtml(t("extName"))}</span>
            <span class="sg-chip">${escapeHtml(t("modeLabel"))} ${escapeHtml((__sgSettings || DEFAULT_SETTINGS).mode || "BALANCED")}</span>
            ${queueIndicator ? `<span class="sg-chip">${escapeHtml(queueIndicator)}</span>` : ""}
          </div>
          <div class="sg-score">
            <span class="sg-pill ${pillClass}">${escapeHtml(pillLabel)}</span>
          </div>
          <button type="button" class="sg-close-btn" id="sg-close" aria-label="${escapeHtml(t("btn_close"))}">×</button>
        </div>

        <div class="sg-body">
          ${isLoading ? `
          <div class="sg-skeleton-loading" aria-busy="true" aria-label="${escapeHtml(t("analyzing"))}">
            <div class="sg-summary-line" style="margin-bottom:16px;">
              <div class="sg-skeleton" style="height:24px;width:70%;max-width:320px;margin-bottom:10px;"></div>
              <div class="sg-skeleton" style="height:14px;width:90%;max-width:400px;"></div>
            </div>
            <div class="sg-card" style="margin-bottom:12px;">
              <div class="sg-card-title" style="visibility:hidden;">_</div>
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
                <div class="sg-skeleton" style="height:48px;border-radius:8px;"></div>
                <div class="sg-skeleton" style="height:48px;border-radius:8px;"></div>
              </div>
              <div style="margin-top:10px;display:flex;gap:8px;">
                <div class="sg-skeleton" style="height:36px;flex:1;border-radius:8px;"></div>
                <div class="sg-skeleton" style="height:36px;flex:1;border-radius:8px;"></div>
              </div>
            </div>
            <div style="display:flex;align-items:center;justify-content:center;gap:8px;margin-top:16px;">
              <span class="sg-spinner" aria-hidden="true"></span>
              <span class="sg-sub" style="margin:0;">${escapeHtml(t("analyzing"))}</span>
            </div>
          </div>
          ` : `
          <div class="sg-summary-line">
            <div class="sg-summary-title">${escapeHtml(actionTitleI18n(displayAction, intent))}</div>
            <div class="sg-summary-sub">${escapeHtml(t("site_label"))}: ${escapeHtml(host || "")} • ${escapeHtml(t("wallet_label"))}: ${escapeHtml(walletDisplay)} • ${escapeHtml(t("network_label"))}: ${escapeHtml(chainDisplay || "")}</div>
            ${host ? `<div class="sg-site-status ${trust?.verdict === "LIKELY_OFFICIAL" || (__sgTrustedDomains?.length && (__sgTrustedDomains.includes(host) || __sgTrustedDomains.some((d) => host.endsWith("." + d)))) ? "sg-site-status--known" : "sg-site-status--unknown"}">${escapeHtml(t("site_label"))}: ${escapeHtml(host)} • ${trust?.verdict === "LIKELY_OFFICIAL" || (__sgTrustedDomains?.length && (__sgTrustedDomains.includes(host) || __sgTrustedDomains.some((d) => host.endsWith("." + d)))) ? t("site_status_known") : t("site_status_not_in_list")}</div>` : ""}
            <div class="sg-summary-intent">${escapeHtml(t("looks_like"))} ${escapeHtml(intentLabel)}</div>
            ${coverageLine ? `<div class="sg-coverage-line">${escapeHtml(coverageLine)}</div>` : ""}
          </div>
          ${verdictKey === "verdict_ok" ? `<div class="sg-verdict-ok-block"><div class="sg-verdict-ok-text">${escapeHtml(t("no_alerts_known"))}</div><div class="sg-verdict-ok-sub">${escapeHtml(t("still_review_wallet"))}</div></div>` : ""}
          ${knownBad ? `<div class="sg-banner-block">${escapeHtml(t("banner_block_known_threat"))}</div>` : ""}
          ${!knownBad && knownSafe ? `<div class="sg-banner-ok"><div class="sg-banner-ok-text">${escapeHtml(t("banner_ok_no_known_threats"))}</div>${verificationUpdatedAt ? `<div class="sg-banner-ok-sub">${escapeHtml(formatVerificationUpdated(verificationUpdatedAt))}</div>` : ""}</div>` : ""}
          ${!knownBad && !knownSafe && verificationLevel === "LOCAL" ? `<div class="sg-banner-warn">${escapeHtml(t("banner_local_verification"))}</div>` : ""}
          ${!knownBad && !knownSafe && verificationLevel === "BASIC" ? `<div class="sg-banner-warn">${escapeHtml(t("banner_basic_verification"))}</div>` : ""}
          ${domainListDecision != null ? `<div class="sg-kv" style="margin-bottom:8px"><div class="sg-k">${escapeHtml(t("list_site_reputation"))}</div><div class="sg-v"><span class="sg-chip ${domainListDecision === "TRUSTED" ? "sg-chip-ok" : domainListDecision === "BLOCKED" ? "sg-chip-risk" : "sg-chip-warn"}">${escapeHtml(siteReputationLabel)}</span></div></div>` : ""}
          ${phishingHardBlock ? `<div class="sg-blocked-banner">${escapeHtml(t("severity_BLOCKED"))} — ${escapeHtml(t("phishing_hard_block"))}</div>` : ""}
          ${(analysis as any).simulationRevert ? `<div class="sg-simulation-revert-banner" role="alert">${escapeHtml(t("simulation_tx_will_fail"))}</div>` : ""}
          ${(analysis as any).isHoneypot ? `<div class="sg-honeypot-banner" role="alert">${escapeHtml(t("honeypot_message"))}</div>` : ""}

          ${
            displayAction === "SEND_TX"
              ? `<div class="sg-card">
                  <div class="sg-card-title">${escapeHtml(t("costs_title"))}</div>
                  <div><b>${escapeHtml(t("label_you_send"))}</b>: <code class="sg-mono">${escapeHtml(`${valueEth} ${nativeSymbol}${usdApproxFromEthString(valueEth, usdPerNative)}${valueProvided ? "" : " (" + t("cost_fee_only") + ")"}`)}</code></div>
                  ${feeEstimated
                    ? `<div style="margin-top:8px"><b>${escapeHtml(t("label_fee_likely"))}</b>: <code class="sg-mono">${escapeHtml(feeLikelyEth ? `${feeLikelyEth} ${nativeSymbol}${usdApproxFromEthString(feeLikelyEth, usdPerNative)}` : t("gas_calculating"))}</code></div>
                    <div style="margin-top:6px"><b>${escapeHtml(t("label_fee_max"))}</b>: <code class="sg-mono">${escapeHtml(feeMaxEth ? `${feeMaxEth} ${nativeSymbol}${usdApproxFromEthString(feeMaxEth, usdPerNative)}` : t("gas_calculating"))}</code></div>
                    <div style="margin-top:8px"><b>${escapeHtml(t("label_total_likely"))}</b>: <code class="sg-mono">${escapeHtml(totalLikelyEth ? `${totalLikelyEth} ${nativeSymbol}${usdApproxFromEthString(totalLikelyEth, usdPerNative)}` : t("gas_calculating"))}</code></div>
                    <div style="margin-top:6px"><b>${escapeHtml(t("label_total_max"))}</b>: <code class="sg-mono">${escapeHtml(totalMaxEth ? `${totalMaxEth} ${nativeSymbol}${usdApproxFromEthString(totalMaxEth, usdPerNative)}` : t("gas_calculating"))}</code></div>`
                    : `<div class="sg-sub" style="margin-top:8px">${escapeHtml(feeReasonKey ? resolveText(feeReasonKey) : t("fee_unknown_wallet_will_estimate"))}</div>
                    <div class="sg-sub" style="margin-top:6px">• ${escapeHtml(t("check_wallet_network_fee"))}</div>`
                  }
                  ${hasFeeGtValue ? `<div class="sg-fee-warn">${escapeHtml(t("fee_gt_value"))}</div>` : ""}
                  ${txTo ? `<div style="margin-top:10px"><b>${escapeHtml(t("tx_destination"))}</b>: <code class="sg-mono">${escapeHtml(shortenHex(txTo))}</code> ${(analysis as any).toIsContract === true ? `<span class="sg-dest-chip sg-dest-contract">${escapeHtml(t("destination_contract"))}</span>` : (analysis as any).toIsContract === false ? `<span class="sg-dest-chip sg-dest-wallet">${escapeHtml(t("destination_wallet"))}</span>` : ""} <button class="sg-copy" data-copy="${escapeHtml(txTo)}">${escapeHtml(t("copy"))}</button></div>` : ""}
                  ${txSelector ? `<div style="margin-top:6px"><b>${escapeHtml(t("tx_contract_method"))}</b>: <code class="sg-mono">${escapeHtml(txSelector)}${selectorToLabel(txSelector) ? " • " + escapeHtml(selectorToLabel(txSelector)!) : ""}</code></div>` : ""}
                  ${((): string => {
                    const tokenAddr = (analysis as any).tokenAddress;
                    if (!tokenAddr) return "";
                    const tokenVerified = (analysis as any).tokenVerified;
                    const tokenSymbol = (analysis as any).tokenSymbol;
                    const tokenLogoUri = (analysis as any).tokenLogoUri;
                    const logoUri = typeof tokenLogoUri === "string" && tokenLogoUri ? tokenLogoUri : "";
                    const placeholderSvg = "data:image/svg+xml," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="%2394a3b8" stroke-width="2"><circle cx="12" cy="12" r="10"/></svg>');
                    const imgSrc = logoUri || placeholderSvg;
                    const symbol = typeof tokenSymbol === "string" && tokenSymbol ? tokenSymbol : "";
                    const label = tokenVerified ? t("token_verified_uniswap") : t("token_unknown_unverified");
                    return `<div class="sg-token-badge-row" style="margin-top:10px;display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
                      <img class="sg-token-logo" src="${escapeHtml(imgSrc)}" alt="" width="24" height="24" loading="lazy" onerror="this.src='${placeholderSvg}'" />
                      ${symbol ? `<span class="sg-mono">${escapeHtml(symbol)}</span>` : ""}
                      <span class="sg-token-badge ${tokenVerified ? "sg-token-verified" : "sg-token-unknown"}">${tokenVerified ? "✅" : "⚠️"} ${escapeHtml(label)}</span>
                    </div>`;
                  })()}
                </div>`
              : (displayAction === "SWITCH_CHAIN" && !hasTxInFlow && hasRecentSwitch(__sgFlow))
                ? `<div class="sg-kv">
                    <div class="sg-k">${escapeHtml(t("overlay_note_title"))}</div>
                    <div class="sg-v">
                      <div class="sg-sub">${escapeHtml(t("switch_note_inline"))}</div>
                    </div>
                  </div>`
                : ""
          }

          ${approvalBlock}
          ${transferBlock}
          ${typedDataPermitBlock}

          ${((): string => {
            const hasImpacto = !!((analysis as any)?.tx?.valueEth || cp || (txExtras && (txExtras.spender || txExtras.operator || txExtras.toAddress || txExtras.tokenContract)) || (analysis as any).addressIntelHit);
            if (!hasImpacto) return "";
            const destAddr = txExtras?.toAddress || txTo || tx?.to;
            const impactLines: string[] = [];
            if (destAddr) {
              impactLines.push(`<div><b>${escapeHtml(t("tx_destination"))}</b>: <code class="sg-mono">${escapeHtml(shortenHex(destAddr))}</code> <button class="sg-copy" data-copy="${escapeHtml(destAddr)}">${escapeHtml(t("copy"))}</button></div>`);
            }
            const permAddr = txExtras?.spender || txExtras?.operator;
            if (permAddr) {
              const unlimited = !!(txExtras as any)?.unlimited;
              impactLines.push(`<div style="margin-top:${impactLines.length ? "8" : "0"}px"><b>${escapeHtml(t("permission_for"))}</b>: <code class="sg-mono">${escapeHtml(shortenHex(permAddr))}</code> <button class="sg-copy" data-copy="${escapeHtml(permAddr)}">${escapeHtml(t("copy"))}</button>${unlimited ? ` <span class="sg-chip sg-chip-warn">${escapeHtml(t("permission_unlimited"))}</span>` : ""}</div>`);
            }
            const addrIntelHit = !!(analysis as any).addressIntelHit;
            const addrIntel = (analysis as any).addressIntel as { to?: string[]; spender?: string[]; operator?: string[]; tokenContract?: string[] } | undefined;
            if (addrIntelHit && addrIntel) {
              const labels: string[] = [...(addrIntel.to || []), ...(addrIntel.spender || []), ...(addrIntel.operator || []), ...(addrIntel.tokenContract || [])];
              const uniq = [...new Set(labels)];
              if (uniq.length) {
                impactLines.push(`<div style="margin-top:${impactLines.length ? "8" : "0"}px"><span class="sg-chip sg-chip-amber">${escapeHtml(t("addr_marked_public"))}</span> ${uniq.slice(0, 5).map((l) => `<span class="sg-chip sg-chip-risk">${escapeHtml(String(l))}</span>`).join(" ")}</div>`);
              }
            }
            if (cp?.feeEstimated && (feeLikelyEth || feeMaxEth)) {
              impactLines.push(`<div style="margin-top:${impactLines.length ? "8" : "0"}px"><b>${escapeHtml(t("label_fee_likely"))}</b> / <b>${escapeHtml(t("label_fee_max"))}</b>: <code class="sg-mono">${escapeHtml(feeLikelyEth ? `${feeLikelyEth} ${nativeSymbol}${usdApproxFromEthString(feeLikelyEth, usdPerNative)}` : "—")}</code> / <code class="sg-mono">${escapeHtml(feeMaxEth ? `${feeMaxEth} ${nativeSymbol}${usdApproxFromEthString(feeMaxEth, usdPerNative)}` : "—")}</code></div><div style="margin-top:6px"><b>${escapeHtml(t("label_total_likely"))}</b> / <b>${escapeHtml(t("label_total_max"))}</b>: <code class="sg-mono">${escapeHtml(totalLikelyEth ? `${totalLikelyEth} ${nativeSymbol}${usdApproxFromEthString(totalLikelyEth, usdPerNative)}` : "—")}</code> / <code class="sg-mono">${escapeHtml(totalMaxEth ? `${totalMaxEth} ${nativeSymbol}${usdApproxFromEthString(totalMaxEth, usdPerNative)}` : "—")}</code></div>`);
            } else if (displayAction === "SEND_TX") {
              impactLines.push(`<div style="margin-top:${impactLines.length ? "8" : "0"}px" class="sg-sub">${escapeHtml(t("tx_fee_estimated_by_wallet"))}</div>`);
            }
            if (impactLines.length === 0) return "";
            return `<div class="sg-card"><div class="sg-card-title">${escapeHtml(t("impact_title"))}</div>${impactLines.join("")}</div>`;
          })()}

          ${
            displayAction === "ADD_CHAIN" && addChainInfo
              ? `<div class="sg-kv">
                  <div class="sg-k">${escapeHtml(t("add_chain_network_label"))}</div>
                  <div class="sg-v">
                    <div class="sg-sub">${escapeHtml((addChainInfo.chainName || "") + (addChainInfo.chainId ? ` (${addChainInfo.chainId})` : "")) || escapeHtml(addChainInfo.chainId || "")}</div>
                    ${addChainInfo.rpcUrls?.[0] ? `<div style="margin-top:6px"><b>${escapeHtml(t("add_chain_rpc_label"))}</b>: <code class="sg-break">${escapeHtml(addChainInfo.rpcUrls[0])}</code></div>` : ""}
                    <div style="margin-top:8px;background:rgba(245,158,11,.15);border:1px solid rgba(245,158,11,.4);border-radius:8px;padding:8px;font-size:12px;">${escapeHtml(t("add_chain_review_rpc"))}</div>
                  </div>
                </div>`
              : (displayAction === "SWITCH_CHAIN" && chainTarget?.chainIdHex)
              ? `<div class="sg-kv">
                  <div class="sg-k">${escapeHtml(t("network_target"))}</div>
                  <div class="sg-v">
                    <div class="sg-sub">${escapeHtml(chainTarget.chainName ? `${chainTarget.chainName} (${chainTarget.chainIdHex})` : chainTarget.chainIdHex)}</div>
                  </div>
                </div>`
              : ""
          }

          ${
            displayAction === "WATCH_ASSET" && watchAssetInfo
              ? `<div class="sg-kv">
                  <div class="sg-k">${escapeHtml(t("watch_asset_token_label"))}</div>
                  <div class="sg-v">
                    <div class="sg-sub">${escapeHtml((watchAssetInfo.symbol || "?") + (watchAssetInfo.address ? ` — ${shortenHex(watchAssetInfo.address)}` : ""))}</div>
                    <div style="margin-top:8px;background:rgba(245,158,11,.15);border:1px solid rgba(245,158,11,.4);border-radius:8px;padding:8px;font-size:12px;">${escapeHtml(t("watch_asset_no_spend_but_risk"))}</div>
                  </div>
                </div>`
              : ""
          }

          ${
            tx?.to || typeof tx?.dataLen === "number"
              ? `<details class="sg-accordion">
                  <summary>${escapeHtml(t("details_tx_title"))}</summary>
                  <div class="sg-accordion-content">
                    ${tx?.to ? `<div><b>${escapeHtml(t("tx_to"))}</b>: <code class="sg-mono">${escapeHtml(shortenHex(tx.to))}</code></div>` : ""}
                    ${typeof tx?.dataLen === "number" ? `<div style="margin-top:6px"><b>${escapeHtml(t("tx_data_length"))}</b>: <code>${escapeHtml(String(tx.dataLen))}</code></div>` : ""}
                  </div>
                </details>`
              : ""
          }

          ${!phishingHardBlock ? `<div class="sg-card sg-panel--${pillSeverityFinal === "BLOCKED" ? "high" : pillSeverityFinal === "HIGH" ? "high" : pillSeverityFinal === "WARN" ? "warn" : "low"}">
            <div class="sg-card-title">${escapeHtml(t("risk_title"))}</div>
            <ul class="sg-list">
              ${mainReasons.map((r) => `<li>${escapeHtml(r)}</li>`).join("")}
              ${mainReasons.length === 0 ? `<li>${escapeHtml(recommendedText)}</li>` : ""}
            </ul>
          </div>` : ""}
          <div class="sg-card sg-what-now">
            <div class="sg-card-title">${escapeHtml(t("what_to_do_now"))}</div>
            <div class="sg-sub">${escapeHtml(resolveText(human?.recommendation) || recommendedText)}</div>
          </div>

          <details class="sg-accordion">
            <summary>${escapeHtml(t("details_tech_title"))}</summary>
            <div class="sg-accordion-content">
              <div class="sg-kv"><div class="sg-k">${escapeHtml(t("tech_displayAction"))}</div><div class="sg-v"><code>${escapeHtml(displayAction)}</code></div></div>
              <div class="sg-kv"><div class="sg-k">${escapeHtml(t("tech_methodRaw"))}</div><div class="sg-v"><code class="sg-mono">${escapeHtml(method)}</code>${meta.rawShape ? ` (${escapeHtml(meta.rawShape)})` : ""}</div></div>
              <div class="sg-kv"><div class="sg-k">${escapeHtml(t("tech_recommendScoreLevel"))}</div><div class="sg-v">${escapeHtml(recommendLabel(analysis.recommend))} • ${escapeHtml(String(analysis.score))}/100 • ${escapeHtml(riskLabel(analysis.level))}</div></div>
              <div style="margin-top:8px"><b>${escapeHtml(t("tech_reasons"))}</b>:<ul class="sg-list">${mainReasons.map((r) => `<li>${escapeHtml(r)}</li>`).join("")}${moreReasons.length ? moreReasons.map((r) => `<li>${escapeHtml(r)}</li>`).join("") : ""}</ul></div>
              ${txSelector ? `<div style="margin-top:8px"><b>${escapeHtml(t("tx_contract_method"))}</b>: <code class="sg-mono">${escapeHtml(txSelector)}${selectorToLabel(txSelector) ? " • " + escapeHtml(selectorToLabel(txSelector)!) : ""}</code></div>` : ""}
              ${decodedStr ? `<div style="margin-top:10px"><b>${escapeHtml(t("tech_decoded"))}</b>:<pre class="sg-pre">${escapeHtml(decodedStr)}</pre></div>` : ""}
            </div>
          </details>

          <details class="sg-accordion">
            <summary>${escapeHtml(t("trusted_domain_ref_title"))}</summary>
            <div class="sg-accordion-content">
              ${
                trustedDomainsAll.length === 0
                  ? `<div class="sg-empty sg-sub">${escapeHtml(__sgTrustedDomainsLoaded ? t("trusted_domain_ref_empty") : t("loading_base"))}</div>
                     <button type="button" id="sg-intel-refresh" class="sg-btn sg-btn-secondary" style="margin-top:8px">${escapeHtml(t("trusted_domains_update_now"))}</button>
                     <button type="button" id="sg-open-options" class="sg-link" style="margin-left:8px">${escapeHtml(t("btn_open_options"))}</button>`
                  : `<div class="sg-domain-chips">
                      ${trustedDomainsPreview.map((d) => `<span class="sg-domain-chip ${(host === d || host.endsWith("." + d)) ? "current" : ""}">${escapeHtml(d)}</span>`).join("")}
                     </div>
                     ${trustedDomainsMoreCount > 0 ? `<span class="sg-domain-more">${escapeHtml(t("trusted_domains_more", { n: trustedDomainsMoreCount }))}</span> <button type="button" id="sg-trusted-view-more" class="sg-link">${escapeHtml(t("trusted_domain_ref_view_more"))}</button>` : ""}`
              }
            </div>
          </details>

          ${
            (moreWhat.length + moreRisks.length + moreSafe.length + moreNext.length) > 0
              ? `<details class="sg-accordion">
                  <summary>${escapeHtml(t("details_more_title"))}</summary>
                  <div class="sg-accordion-content">
                    ${moreWhat.length ? `<div style="font-weight:700; margin-bottom:6px">${escapeHtml(t("more_whatItDoes"))}</div><ul class="sg-list">${moreWhat.map((x) => `<li>${escapeHtml(resolveText(x))}</li>`).join("")}</ul>` : ""}
                    ${moreRisks.length ? `<div style="font-weight:700; margin-top:12px; margin-bottom:6px">${escapeHtml(t("more_risks"))}</div><ul class="sg-list">${moreRisks.map((x) => `<li>${escapeHtml(resolveText(x))}</li>`).join("")}</ul>` : ""}
                    ${moreSafe.length ? `<div style="font-weight:700; margin-top:12px; margin-bottom:6px">${escapeHtml(t("more_safeNotes"))}</div><ul class="sg-list">${moreSafe.map((x) => `<li>${escapeHtml(resolveText(x))}</li>`).join("")}</ul>` : ""}
                    ${moreNext.length ? `<div style="font-weight:700; margin-top:12px; margin-bottom:6px">${escapeHtml(t("more_nextSteps"))}</div><ul class="sg-list">${moreNext.map((x) => `<li>${escapeHtml(resolveText(x))}</li>`).join("")}</ul>` : ""}
                  </div>
                </details>`
              : ""
          }
        `}
        </div>

        <div class="sg-footer">
          ${
            isLoading
              ? `
                <button class="sg-btn sg-btn-secondary" id="sg-cancel">${escapeHtml(t("btn_cancel"))}</button>
                <button class="sg-btn sg-btn-primary" id="sg-continue" disabled style="opacity:.5;pointer-events:none;">${escapeHtml(t("btn_continue"))}</button>
              `
              : phishingHardBlock
              ? `
                <button class="sg-btn sg-btn-secondary" id="sg-cancel">${escapeHtml(t("btn_close"))}</button>
              `
              : needsFriction
              ? `
                <div style="flex:1; display:flex; align-items:center; gap:10px; justify-content:flex-start;">
                  <label style="display:flex; align-items:center; gap:8px; font-size:12px; color:#cbd5e1;">
                    <input id="sg-override" type="checkbox" style="width:16px; height:16px;" aria-label="${escapeHtml(t("override_checkbox"))}" />
                    <span>${escapeHtml(t("override_checkbox"))}</span>
                  </label>
                  <span id="sg-countdown" class="sg-sub" style="opacity:.9"></span>
                </div>
                <button class="sg-btn sg-btn-secondary" id="sg-cancel">${escapeHtml(t("btn_close"))}</button>
                <button class="sg-btn sg-btn-primary" id="sg-proceed" disabled style="opacity:.6; pointer-events:none;">${escapeHtml(t("btn_proceed_anyway"))}</button>
              `
              : `
                <button class="sg-btn sg-btn-secondary" id="sg-cancel">${escapeHtml(t("btn_cancel"))}</button>
                <button class="sg-btn sg-btn-primary" id="sg-continue">${escapeHtml(t("btn_continue"))}</button>
              `
          }
          ${showActivateProtectionLink ? `<div class="sg-footer-cta" style="margin-top:10px;text-align:center;"><button type="button" id="sg-activate-protection" class="sg-link" style="font-size:12px;">Ativar Proteção Máxima</button></div>` : ""}
        </div>
      </div>
    </div>
  `;

  // Bind buttons (requestId may change on update)
  const closeBtn = state.shadow.getElementById("sg-close") as HTMLElement | null;
  const continueBtn = state.shadow.getElementById("sg-continue") as HTMLElement | null;
  const proceedBtn = state.shadow.getElementById("sg-proceed") as HTMLButtonElement | null;
  const overrideCb = state.shadow.getElementById("sg-override") as HTMLInputElement | null;
  const countdownEl = state.shadow.getElementById("sg-countdown") as HTMLElement | null;
  const cancelBtn = state.shadow.getElementById("sg-cancel") as HTMLElement | null;

  closeBtn && (closeBtn.onclick = () => decideCurrentAndAdvance(false));

  // Bind copy buttons
  try {
    const btns = state.shadow.querySelectorAll<HTMLButtonElement>("button.sg-copy[data-copy]");
    btns.forEach((b) => {
      b.onclick = () => {
        const v = b.getAttribute("data-copy") || "";
        if (!v) return;
        tryCopyToClipboard(v);
      };
    });
  } catch {}

  continueBtn && (continueBtn.onclick = () => decideCurrentAndAdvance(true));
  proceedBtn && (proceedBtn.onclick = () => decideCurrentAndAdvance(true));
  cancelBtn && (cancelBtn.onclick = () => decideCurrentAndAdvance(false));

  const openOptionsPage = () => {
    try {
      if (typeof (globalThis as any).chrome !== "undefined" && (globalThis as any).chrome.runtime?.openOptionsPage) {
        (globalThis as any).chrome.runtime.openOptionsPage();
      }
    } catch {}
  };
  const openOpt = state.shadow.getElementById("sg-open-options") as HTMLButtonElement | null;
  openOpt && (openOpt.onclick = openOptionsPage);
  const activateProtectionBtn = state.shadow.getElementById("sg-activate-protection") as HTMLButtonElement | null;
  activateProtectionBtn && (activateProtectionBtn.onclick = openOptionsPage);
  const intelRefreshBtn = state.shadow.getElementById("sg-intel-refresh") as HTMLButtonElement | null;
  intelRefreshBtn && (intelRefreshBtn.onclick = async () => {
    try {
      await safeSendMessage({ type: "UPDATE_INTEL_NOW" }, { preferPort: true, timeoutMs: 8000 });
      __sgTrustedDomainsLoaded = false;
      __sgTrustedDomainsLoading = null;
      await ensureTrustedDomainsLoaded();
      if (__sgOverlay) updateOverlay(__sgOverlay);
    } catch {}
  });
  const viewMoreBtn = state.shadow.getElementById("sg-trusted-view-more") as HTMLButtonElement | null;
  viewMoreBtn && (viewMoreBtn.onclick = () => {
    try {
      const list = __sgTrustedDomains || [];
      const host = state.meta.host;
      const backdrop = document.createElement("div");
      backdrop.className = "sg-backdrop sg-submodal";
      backdrop.setAttribute("role", "dialog");
      backdrop.setAttribute("aria-label", t("trusted_domain_ref_title"));
      const panel = document.createElement("div");
      panel.className = "sg-modal sg-trusted-more-modal";
      const searchInput = document.createElement("input");
      searchInput.type = "text";
      searchInput.placeholder = t("trusted_domains_search_placeholder");
      searchInput.className = "sg-trusted-search";
      searchInput.setAttribute("aria-label", t("trusted_domains_search_placeholder"));
      const listDiv = document.createElement("div");
      listDiv.className = "sg-trusted-full-list";
      const renderList = (filter: string) => {
        const q = (filter || "").toLowerCase().trim();
        const items = q ? list.filter((d) => d.toLowerCase().includes(q)) : list;
        listDiv.innerHTML = items.map((d) => `<span class="sg-domain-chip ${(host === d || host.endsWith("." + d)) ? "current" : ""}">${escapeHtml(d)}</span>`).join("");
      };
      renderList("");
      searchInput.oninput = () => renderList(searchInput.value);
      const closeBtn = document.createElement("button");
      closeBtn.type = "button";
      closeBtn.className = "sg-btn sg-btn-secondary";
      closeBtn.textContent = t("btn_close");
      closeBtn.setAttribute("aria-label", t("btn_close"));
      closeBtn.onclick = () => backdrop.remove();
      panel.appendChild(searchInput);
      panel.appendChild(listDiv);
      panel.appendChild(closeBtn);
      backdrop.appendChild(panel);
      backdrop.onclick = (e) => { if (e.target === backdrop) backdrop.remove(); };
      state.shadow.appendChild(backdrop);
      searchInput.focus();
    } catch {}
  });

  // 3s delay after explicit override
  if (needsFriction && overrideCb && proceedBtn) {
    if (state.countdownTimer) {
      try { clearInterval(state.countdownTimer as any); } catch {}
      state.countdownTimer = null;
    }
    proceedBtn.disabled = true;
    proceedBtn.style.opacity = ".6";
    proceedBtn.style.pointerEvents = "none";
    countdownEl && (countdownEl.textContent = "");

    overrideCb.onchange = () => {
      if (overrideCb.checked) sendKeepalive(state.requestId);
      if (!overrideCb.checked) {
        proceedBtn.disabled = true;
        proceedBtn.style.opacity = ".6";
        proceedBtn.style.pointerEvents = "none";
        countdownEl && (countdownEl.textContent = "");
        if (state.countdownTimer) {
          try { clearInterval(state.countdownTimer as any); } catch {}
          state.countdownTimer = null;
        }
        return;
      }

      let left = 3;
      countdownEl && (countdownEl.textContent = t("override_countdown", { s: left }));
      state.countdownTimer = setInterval(() => {
        left--;
        if (left <= 0) {
          try { clearInterval(state.countdownTimer as any); } catch {}
          state.countdownTimer = null;
          countdownEl && (countdownEl.textContent = "");
          proceedBtn.disabled = false;
          proceedBtn.style.opacity = "1";
          proceedBtn.style.pointerEvents = "auto";
          return;
        }
        countdownEl && (countdownEl.textContent = t("override_countdown", { s: left }));
      }, 1000) as any;
    };
  }

}

function cleanupOverlay() {
  try {
    if (__sgOverlay?.keepaliveInterval) clearInterval(__sgOverlay.keepaliveInterval as any);
  } catch {}
  try {
    if (__sgOverlay?.countdownTimer) clearInterval(__sgOverlay.countdownTimer as any);
  } catch {}
  try {
    if (__sgOverlay?.container) __sgOverlay.container.remove();
  } catch {}
  try {
    if (__sgOverlay?.onKey) document.removeEventListener("keydown", __sgOverlay.onKey);
  } catch {}
  __sgOverlay = null;
}

function updateOverlay(state: OverlayState) {
  try { renderOverlay(state); } catch {}
}

function showOverlay(
  requestId: string,
  analysis: Analysis,
  meta: { host: string; method: string; params?: any; rawShape?: string; rpcMeta?: any }
) {
  void ensureTrustedDomainsLoaded();
  void ensureSettingsLoaded();
  void ensureUsdLoaded();
  // If an overlay is already open, update it in place (no close/reopen).
  if (__sgOverlay) {
    __sgOverlay.requestId = requestId;
    __sgOverlay.analysis = analysis;
    __sgOverlay.meta = meta;
    const root = __sgOverlay.container;
    if (root) root.setAttribute("data-sg-request-id", requestId);
    if (__sgOverlay.keepaliveInterval) {
      try { clearInterval(__sgOverlay.keepaliveInterval as any); } catch {}
    }
    __sgOverlay.keepaliveInterval = setInterval(() => sendKeepalive(requestId), 2000) as any;
    updateOverlay(__sgOverlay);
    markUiShownFromContent(requestId);
    return;
  }

  const container = document.createElement("div");
  container.className = "sg-root";
  container.setAttribute("data-sg-overlay", "1");
  container.setAttribute("data-sg-request-id", requestId);
  const shadow = container.attachShadow({ mode: "open" });
  ensureOverlayCss(shadow);
  const app = document.createElement("div");
  app.id = "sg-app";
  shadow.appendChild(app);

  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      decideCurrentAndAdvance(false);
    }
  };
  document.addEventListener("keydown", onKey);

  __sgOverlay = { requestId, analysis, meta, container, shadow, app, onKey };
  document.documentElement.appendChild(container);

  markUiShownFromContent(requestId);

  if (__sgOverlay.keepaliveInterval) {
    try { clearInterval(__sgOverlay.keepaliveInterval as any); } catch {}
  }
  __sgOverlay.keepaliveInterval = setInterval(() => sendKeepalive(requestId), 2000) as any;

  updateOverlay(__sgOverlay);
}

let __sgPinged = false;

async function handleSGRequest(ev: MessageEvent) {
  try {
    if (ev.source !== window) return;
    const data = ev.data as MainWorldRequestMsg;
    if (!data || (data.source !== "signguard" && data.source !== "signguard-inpage") || data.type !== "SG_REQUEST") return;

    const requestId = String(data.requestId || "");
    const url = String(data.payload?.url || "");
    const method = String(data.payload?.method || "");
    const params = Array.isArray(data.payload?.params) ? data.payload.params : undefined;
    const rpcMeta = (data.payload as any)?.meta ?? null;

    const host = (() => { try { return new URL(url).hostname.toLowerCase(); } catch { return String(data.payload?.host || ""); } })();
    const origin = (() => { try { return new URL(url).origin; } catch { return ""; } })();

    const providerHint = (data.payload as any)?.providerHint;
    const txCostPreview = (data.payload as any)?.txCostPreview;
    const wallet = (data.payload as any)?.wallet;
    const payload: AnalyzeRequest = {
      requestId,
      url,
      origin,
      request: { method, params },
      wallet: wallet && typeof wallet === "object" ? wallet : undefined,
      providerHint: providerHint && typeof providerHint === "object" ? { kind: providerHint.kind || "UNKNOWN", name: providerHint.name } : undefined,
      meta: rpcMeta ? { chainId: rpcMeta?.chainId, chainIdHex: chainIdHex ?? undefined, chainIdRequested: rpcMeta?.chainIdRequested, preflight: rpcMeta?.preflight } : (chainIdHex ? { chainId: (rpcMeta as any)?.chainId, chainIdHex } : undefined),
      txCostPreview,
    };

    const receivedAt = Date.now();
    for (const [k, v] of recentSwitchByOrigin.entries()) {
      if (receivedAt - v.ts > FLOW_TTL_MS) recentSwitchByOrigin.delete(k);
    }

    const chainIdHex = (data.payload as any)?.chainIdHex ?? toChainIdHex(rpcMeta?.chainId);
    const walletDisplay = wallet && typeof wallet === "object" ? { kind: wallet.kind, name: wallet.name, walletBrand: (wallet as any).walletBrand } : undefined;
    const fallbackAnalysis = buildFallbackAnalysis(data.payload, walletDisplay);
    if (txCostPreview) fallbackAnalysis.txCostPreview = txCostPreview;

    const pending: PendingRequest = {
      requestId,
      method,
      params,
      origin,
      href: url,
      host,
      wallet: walletDisplay,
      analysis: fallbackAnalysis,
      receivedAt,
      rpcMeta,
      chainIdHex: chainIdHex ?? undefined,
    };

    const newAction = classifyAction(method, params);
    if (newAction === "SWITCH_CHAIN") {
      try {
        const chainId = String((rpcMeta as any)?.chainIdRequested || "");
        recentSwitchByOrigin.set(origin, { ts: receivedAt, chainId: chainId || undefined });
      } catch {
        recentSwitchByOrigin.set(origin, { ts: receivedAt });
      }
    }

    const specialCaseMerge = (): boolean => {
      if (!__sgOverlay || !requestQueue.length) return false;
      const current = requestQueue[0];
      const currentAction = classifyAction(current.method, current.params);
      const recent = recentSwitchByOrigin.get(origin);
      const withinTtl = !!recent && (receivedAt - recent.ts) <= FLOW_TTL_MS;
      if (currentAction === "SWITCH_CHAIN" && newAction === "SEND_TX" && current.origin === origin && withinTtl) {
        dispatchDecision(current.requestId, true);
        requestQueue.shift();
        requestQueue.unshift(pending);
        showOverlay(requestId, fallbackAnalysis, { host, method, params, rpcMeta, chainIdHex: pending.chainIdHex ?? undefined });
        (__sgOverlay as any).analysisLoading = true;
        updateOverlay(__sgOverlay);
        markUiShownFromContent(requestId);
        void tryAnalyze();
        return true;
      }
      return false;
    };

    const tryAnalyze = async () => {
      const r = await safeSendMessage<{ ok?: boolean; analysis?: Analysis; vaultBlocked?: boolean; vaultMessage?: string }>(
        { type: "ANALYZE", payload },
        { preferPort: true, timeoutMs: 8000 }
      );

      const cur = requestQueue.find((p) => p.requestId === requestId);
      if (!cur || !__sgOverlay || __sgOverlay.requestId !== requestId) return;

      if (r && r.ok && r.vaultBlocked) {
        const idx = requestQueue.findIndex((p) => p.requestId === requestId);
        if (idx >= 0) requestQueue.splice(idx, 1);
        if (__sgOverlay && __sgOverlay.requestId === requestId) {
          cleanupOverlay();
          if (requestQueue.length) showCurrentPending();
        }
        dispatchDecision(requestId, false, r.vaultMessage ?? t("vaultBlockedMessage"));
        return;
      }

      if (r && r.ok && r.analysis) {
        cur.analysis = r.analysis as Analysis;
        if (cur.wallet && !(r.analysis as any).wallet) (r.analysis as any).wallet = cur.wallet;
      } else {
        cur.analysis = buildFallbackAnalysis(data.payload, walletDisplay);
        if (txCostPreview) cur.analysis.txCostPreview = txCostPreview;
      }

      const analysis = cur.analysis;
      if (analysis.protectionPaused) {
        const idx = requestQueue.findIndex((p) => p.requestId === requestId);
        if (idx >= 0) requestQueue.splice(idx, 1);
        if (__sgOverlay && __sgOverlay.requestId === requestId) {
          cleanupOverlay();
          if (requestQueue.length) showCurrentPending();
        }
        dispatchDecision(requestId, true);
        return;
      }

      (__sgOverlay as any).analysisLoading = false;
      __sgOverlay.analysis = cur.analysis;
      updateOverlay(__sgOverlay);

      const action = classifyAction(method, params);
      if (analysis.recommend === "ALLOW" && action !== "SEND_TX") {
        const idx = requestQueue.findIndex((p) => p.requestId === requestId);
        if (idx >= 0) requestQueue.splice(idx, 1);
        if (__sgOverlay && __sgOverlay.requestId === requestId) {
          cleanupOverlay();
          if (requestQueue.length) showCurrentPending();
        }
        dispatchDecision(requestId, true);
      }
    };

    if (specialCaseMerge()) return;

    requestQueue.push(pending);
    const isFirst = requestQueue.length === 1;
    if (isFirst) {
      showOverlay(requestId, fallbackAnalysis, { host, method, params, rpcMeta, chainIdHex: pending.chainIdHex ?? undefined });
      (__sgOverlay as any).analysisLoading = true;
      updateOverlay(__sgOverlay!);
    }
    markUiShownFromContent(requestId);

    if (!__sgPinged) {
      __sgPinged = true;
      const ping = await portRequest<{ ok?: boolean }>({ type: "PING" }, 2000);
      if (!ping?.ok) {
        const fb = await safeSendMessage<{ ok?: boolean }>({ type: "PING" }, 2000);
        if (!fb?.ok) showToast(t("toast_extension_updated"));
      }
    }

    void tryAnalyze();

    if (!isFirst) updateOverlay(__sgOverlay!);
  } catch (e: any) {
    try { dispatchDecision((ev as any)?.data?.requestId, true); } catch {}
  }
}

window.addEventListener("message", (ev) => { void handleSGRequest(ev); });

// Also listen to MAIN-world non-blocking RPC telemetry for 2-step flows.
window.addEventListener("message", (ev) => { void handlePageRpcMessage(ev); });

// Page Risk Scanner: run when DOM is ready (phishing/drainer heuristics, lookalike domain, overlay detection)
function schedulePageRiskScan() {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => runPageRiskScannerOnce(), { once: true });
  } else {
    if (document.body) runPageRiskScannerOnce();
    else setTimeout(runPageRiskScannerOnce, 100);
  }
}
schedulePageRiskScan();

// UI interaction telemetry: clicks that look like "Connect Wallet" / "Login" / "Wallet"
const CONNECT_WALLET_KEYWORDS = ["connect", "login", "wallet"];
function isConnectWalletLikeElement(el: EventTarget | null): { kind: string; text: string } | null {
  try {
    if (!el || !(el instanceof Node)) return null;
    let node: Node | null = el as Node;
    for (let i = 0; i < 5 && node; i++) {
      if (node instanceof Element) {
        const text = (node.textContent ?? "").trim().toLowerCase().slice(0, 80);
        const label = (node.getAttribute?.("aria-label") ?? node.getAttribute?.("title") ?? "").toLowerCase();
        const combined = `${text} ${label}`;
        for (const kw of CONNECT_WALLET_KEYWORDS) {
          if (combined.includes(kw)) return { kind: "connect_wallet", text: (node.textContent ?? "").trim().slice(0, 60) };
        }
      }
      node = node.parentNode;
    }
  } catch {
    // must not break
  }
  return null;
}
window.addEventListener(
  "click",
  (ev) => {
    try {
      const hit = isConnectWalletLikeElement(ev.target);
      if (!hit || typeof chrome === "undefined" || !chrome.runtime?.sendMessage) return;
      chrome.runtime.sendMessage({
        type: "SG_TELEMETRY_INTERACTION",
        payload: {
          domain: window.location.hostname || "",
          kind: hit.kind,
          props: { text: hit.text },
        },
      });
    } catch {
      // silent
    }
  },
  { capture: true, passive: true }
);

// Marketing toast: show 5s after message (discreet, bottom-right card)
if (isRuntimeUsable() && typeof chrome?.runtime?.onMessage?.addListener === "function") {
  try {
    chrome.runtime.onMessage.addListener((msg: any, _sender, sendResponse) => {
      if (msg?.type === "SHOW_MARKETING_TOAST") {
        const campaign = msg?.payload;
        if (campaign?.id && campaign?.title && campaign?.link) {
          const delay = setTimeout(() => {
            renderAdToast(
              {
                id: campaign.id,
                title: campaign.title,
                body: campaign.body ?? "",
                cta_text: campaign.cta_text ?? "Saber mais",
                link: campaign.link,
                icon: campaign.icon,
              },
              () => dismissAdToast(),
              () => {
                if (typeof chrome?.runtime?.sendMessage === "function") {
                  chrome.runtime.sendMessage({ type: "AD_TRACK_CLICK", payload: { campaignId: campaign.id } });
                }
              }
            );
          }, 5000);
          sendResponse({ ok: true });
          return true;
        }
      }
      if (msg?.type !== "SG_RPC_CALL_REQUEST") return false;
      const { id, method, params } = msg;
      window.postMessage({ source: "signguard-content", type: "SG_RPC_CALL_REQUEST", id, method, params }, "*");
      const handler = (ev: MessageEvent) => {
        try {
          const d = (ev as any)?.data;
          if (!d || d.source !== "signguard" || d.type !== "SG_RPC_CALL_RESPONSE" || d.id !== id) return;
          window.removeEventListener("message", handler);
          clearTimeout(timer);
          sendResponse({ ok: !d.error, result: d.result, error: d.error });
        } catch {}
      };
      window.addEventListener("message", handler);
      const timer = setTimeout(() => {
        window.removeEventListener("message", handler);
        sendResponse({ ok: false, error: "timeout" });
      }, 8000);
      return true; // async
    });
  } catch (_) {}
}
