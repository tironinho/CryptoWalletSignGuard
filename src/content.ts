// ARQUIVO: src/content.ts
import type { AnalyzeRequest, Analysis, Settings, CheckResult, TxCostPreview, FeeEstimateWire, DecisionMeta } from "./shared/types";
import { DEFAULT_SETTINGS } from "./shared/types";
import { shouldGateUI } from "./shared/uiGate";
import { SUGGESTED_TRUSTED_DOMAINS } from "./shared/constants";
import { selectorToLabel } from "./shared/signatures";
import { t } from "./i18n";
import { clamp, escapeHtml } from "./shared/utils";
import { normMethod } from "./shared/normalize";
import { classifyAction, type SGAction } from "./shared/classifyAction";
import { actionTitle, simpleSummary } from "./shared/actionTexts";
import { extractTx } from "./shared/txExtract";
import { ingestRpc, hasRecentSwitch, newFlowState, type FlowState } from "./shared/flowTracker";
import { hexToBigInt, weiToEthString } from "./shared/txMath";
import { weiToEthString as weiToEthFmt } from "./format";
import { getNativeSymbol, getChainInfo } from "./shared/chains";
import {
  isRuntimeUsable,
  safeSendMessage,
  safeStorageGet,
  safeGetURL,
  safeLocalGet,
  safeLocalSet,
} from "./runtimeSafe";
import { runPageRiskScan, injectPageRiskBanner, type PageRiskResult } from "./risk/domScanner";
import { REASON_KEYS } from "./shared/reasonKeys";

const IS_TOP_FRAME = (() => {
  try {
    return typeof window !== "undefined" && window.top === window;
  } catch {
    return true;
  }
})();
console.log("[SignGuard Content] loaded", { top: IS_TOP_FRAME, href: location.href });

/** Page risk scan result (run on init); attached to ANALYZE meta when available. */
let __sgPageRiskResult: PageRiskResult | null = null;

/** CustomEvent name for decision (synchronous → preserves user activation for MetaMask). */
const SG_DECISION_EVENT = "__sg_decision__";

/** Cache de preflight (SG_PREVIEW) por requestId — pode chegar antes do SG_REQUEST. */
const __sgPreflightCache = new Map<string, { chainIdHex?: string; txCostPreview?: TxCostPreview }>();

/** P1-7: Dedupe Map — key -> entry; duplicates attach to same entry, get same decision. */
type DedupeEntry = { primaryRequestId: string; requestIds: Set<string>; addedAt: number };
const __sgDedupeMap = new Map<string, DedupeEntry>();
const DEDUPE_MS = 3000;

/** Top-frame overlay broker: iframe waits for SG_RELAY_DECISION; timeout 15s then fail-open/fail-closed or overlay local. */
const RELAY_TIMEOUT_MS = 15000;
const relayPending = new Map<string, { timeoutId: ReturnType<typeof setTimeout> }>();

function stableStringifyParams(val: unknown): string {
  if (val === null) return "null";
  if (val === undefined) return "undefined";
  if (typeof val !== "object") return String(val);
  if (Array.isArray(val)) return "[" + val.map(stableStringifyParams).join(",") + "]";
  const obj = val as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return "{" + keys.map((k) => JSON.stringify(k) + ":" + stableStringifyParams(obj[k])).join(",") + "}";
}

/** Métodos RPC permitidos para encaminhamento ao mainWorld (background -> content -> mainWorld). */
const RPC_ALLOWED = new Set(["eth_call", "eth_chainid", "eth_getcode", "eth_getblockbynumber", "eth_getlogs", "eth_estimategas"]);

/** P1: Read-only methods → auto ALLOW without overlay; still logged to diagnosis. */
const AUTO_ALLOW_METHODS = new Set(["wallet_getPermissions"]);

/** Cache para allowance atual: key -> { value, ts }. TTL 15s. */
const __allowanceCache = new Map<string, { value: string; ts: number }>();
const ALLOWANCE_CACHE_TTL_MS = 15000;

function padAddr(addr: string): string {
  const a = String(addr).toLowerCase().replace(/^0x/, "");
  return a.padStart(64, "0");
}

function encodeAllowanceCall(token: string, owner: string, spender: string): { to: string; data: string } {
  return {
    to: token,
    data: "0xdd62ed3e" + padAddr(owner) + padAddr(spender),
  };
}

function encodeIsApprovedForAllCall(token: string, owner: string, operator: string): { to: string; data: string } {
  return {
    to: token,
    data: "0xe985e9c5" + padAddr(owner) + padAddr(operator),
  };
}

function decodeUint256Hex(hex: string): bigint {
  try {
    const h = String(hex || "").replace(/^0x/, "");
    if (h.length < 64) return 0n;
    return BigInt("0x" + h);
  } catch {
    return 0n;
  }
}

function decodeBoolHex(hex: string): boolean {
  try {
    const h = String(hex || "").replace(/^0x/, "");
    if (h.length < 64) return false;
    return BigInt("0x" + h.slice(-64)) !== 0n;
  } catch {
    return false;
  }
}

async function fetchCurrentAllowance(
  chainIdHex: string | null | undefined,
  token: string,
  owner: string,
  spender: string,
  isNft: boolean
): Promise<string | null> {
  if (!token || !owner || !spender || !/^0x[a-fA-F0-9]{40}$/.test(token) || !/^0x[a-fA-F0-9]{40}$/.test(owner) || !/^0x[a-fA-F0-9]{40}$/.test(spender))
    return null;
  const key = `${chainIdHex ?? ""}:${token}:${owner}:${spender}:${isNft}`;
  const cached = __allowanceCache.get(key);
  if (cached && Date.now() - cached.ts < ALLOWANCE_CACHE_TTL_MS) return cached.value;

  const { to, data } = isNft
    ? encodeIsApprovedForAllCall(token, owner, spender)
    : encodeAllowanceCall(token, owner, spender);
  try {
    const timeoutMs = 1500;
    const res = await Promise.race([
      rpcViaMainWorld("eth_call", [{ to, data }]),
      new Promise<never>((_, rej) => setTimeout(() => rej(new Error("timeout")), timeoutMs)),
    ]);
    if (!res || typeof res !== "object" || !(res as { ok?: boolean }).ok) return null;
    const result = (res as { result?: string }).result;
    if (typeof result !== "string") return null;
    const MAX_U256 = 2n ** 256n - 1n;
    const value = isNft
      ? decodeBoolHex(result)
        ? (t("overlay_allowance_approved") || "Aprovado")
        : (t("overlay_allowance_not_approved") || "Não aprovado")
      : (() => {
          const v = decodeUint256Hex(result);
          return v >= MAX_U256 ? (t("overlay_allowance_unlimited") || "Ilimitado") : v.toString();
        })();
    __allowanceCache.set(key, { value, ts: Date.now() });
    return value;
  } catch {
    return null;
  }
}

function rpcViaMainWorld(method: string, params: any[]): Promise<{ ok: boolean; result?: any; error?: string }> {
  return new Promise((resolve) => {
    const requestId = typeof crypto?.randomUUID === "function" ? crypto.randomUUID() : `rpc_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const timeout = setTimeout(() => {
      window.removeEventListener("message", handler);
      resolve({ ok: false, error: "timeout" });
    }, 2000);
    const handler = (ev: MessageEvent) => {
      if (ev.source !== window || ev.data?.source !== "signguard-mainworld" || ev.data?.type !== "SG_RPC_CALL_RES" || ev.data?.requestId !== requestId) return;
      clearTimeout(timeout);
      window.removeEventListener("message", handler);
      resolve({ ok: ev.data.ok ?? false, result: ev.data.result, error: ev.data.error });
    };
    window.addEventListener("message", handler);
    window.postMessage({ source: "signguard-content", type: "SG_RPC_CALL_REQ", requestId, method, params: params ?? [] }, "*");
  });
}

chrome.runtime.onMessage.addListener((msg: any, _sender, sendResponse) => {
  if (msg?.type !== "SG_RPC_CALL_REQUEST") return false;
  const method = msg?.method ?? msg?.payload?.method;
  const params = msg?.params ?? msg?.payload?.params ?? [];
  if (!method || !RPC_ALLOWED.has(String(method).toLowerCase())) {
    sendResponse({ ok: false, error: "method_not_allowed" });
    return false;
  }
  rpcViaMainWorld(String(method), Array.isArray(params) ? params : []).then((r) => {
    sendResponse(r);
  });
  return true;
});

function sendDecisionToMainWorld(requestId: string, allow: boolean, meta?: DecisionMeta) {
  const detail = { type: "SG_DECISION" as const, requestId, allow, meta };
  window.dispatchEvent(new CustomEvent(SG_DECISION_EVENT, { detail }));
  window.postMessage({ source: "signguard-content", type: "SG_DECISION", requestId, allow, meta }, "*");
}

/** Normalize chainId to hex (e.g. 1 -> "0x1", "0x1" -> "0x1"). Returns null if invalid. */
function toChainIdHex(chainId: string | number | null | undefined): string | null {
  if (chainId == null || chainId === "") return null;
  const s = String(chainId).trim();
  if (s.toLowerCase().startsWith("0x")) return s;
  const n = parseInt(s, 10);
  if (!Number.isFinite(n) || n < 0) return null;
  return "0x" + n.toString(16);
}

/** Infer host from URL (strip www.). */
function inferHost(url: string): string {
  try {
    const u = new URL(url);
    let h = u.hostname || "";
    if (h.toLowerCase().startsWith("www.")) h = h.slice(4);
    return h;
  } catch {
    return "";
  }
}

// --- UTILS ---
function showToast(text: string) {
  try {
    const el = document.createElement("div");
    el.className = "sg-toast";
    el.textContent = text;
    document.documentElement.appendChild(el);
    setTimeout(() => el.remove(), 2500);
  } catch {}
}

let __sgSettings: Settings | null = null;
const __sgNativeUsd: Record<string, { usd: number; symbol: string }> = {};

function loadSettings(): Promise<void> {
  return new Promise((resolve) => {
    try {
      if (typeof chrome !== "undefined" && chrome.storage?.sync?.get) {
        chrome.storage.sync.get(DEFAULT_SETTINGS, (r: Record<string, unknown>) => {
          __sgSettings = (r && typeof r === "object" ? r : DEFAULT_SETTINGS) as Settings;
          resolve();
        });
      } else {
        __sgSettings = DEFAULT_SETTINGS;
        resolve();
      }
    } catch {
      __sgSettings = DEFAULT_SETTINGS;
      resolve();
    }
  });
}

function fetchNativeUsdAndRerender(chainIdHex: string | null) {
  if (!chainIdHex) return;
  const key = String(chainIdHex).toLowerCase();
  if (__sgNativeUsd[key]) return;
  safeSendMessage<{ ok?: boolean; usdPerNative?: number; nativeSymbol?: string }>({
    type: "SG_GET_NATIVE_USD",
    payload: { chainIdHex },
  }).then((res) => {
    if (res?.ok && res.usdPerNative != null) {
      __sgNativeUsd[key] = { usd: res.usdPerNative, symbol: res.nativeSymbol ?? getNativeSymbol(chainIdHex) };
      if (__sgOverlay) updateOverlay(__sgOverlay);
    }
  }).catch(() => {});
}

function tryCopy(text: string): boolean {
  try {
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text);
      showToast(typeof t === "function" ? (t("toast_copied") || "Copied") : "Copied");
      return true;
    }
  } catch {}
  return false;
}

/** Structured "Mais explicações" HTML: O que isso faz / Riscos / Notas de segurança / Próximos passos. */
function renderMoreExplanationsHtml(action: SGAction, isContractInteraction: boolean): string {
  const what = t("more_whatItDoes") || "O que isso faz";
  const risks = t("more_risks") || "Riscos";
  const safe = t("more_safeNotes") || "Notas de segurança";
  const next = t("more_nextSteps") || "Próximos passos";

  let whatItems: string[];
  let riskItems: string[];
  let safeItems: string[];
  let nextItems: string[];

  if (isContractInteraction || action === "SEND_TX") {
    whatItems = [t("default_human_contract_what") || "Envia uma transação para um contrato (ação dentro do dApp)."];
    riskItems = [t("default_human_contract_risk") || "O custo real pode variar e a ação pode mover ativos/tokens via contrato."];
    safeItems = [t("default_human_contract_safe") || "Confira destino (to), rede, valor e a taxa (Network fee) na carteira."];
    nextItems = [t("default_human_contract_next") || "Se os detalhes baterem, prossiga. Caso contrário, cancele."];
  } else if (action === "SWITCH_CHAIN" || action === "ADD_CHAIN") {
    whatItems = [t("explain_switch_why") || "Alguns sites exigem uma rede específica para funcionar."];
    riskItems = [t("switch_note_inline") || "Trocar rede normalmente não custa gas."];
    safeItems = [t("default_human_generic_safe") || "Confirme domínio, rede e detalhes na carteira."];
    nextItems = [t("human_connect_next_2") || "Confirme se a rede solicitada é a esperada. Se não, cancele."];
  } else if (action === "SIGN_MESSAGE" || action === "SIGN_TYPED_DATA") {
    whatItems = [t("human_sign_whatIs") || "Cria uma assinatura criptográfica. Geralmente não custa gas, mas pode autorizar ações."];
    riskItems = [t("human_sign_risk_1") || "Assinar textos desconhecidos pode autorizar ações/login que você não pretendia."];
    safeItems = [t("human_sign_safe_1") || "Prefira carteiras que mostrem detalhes de assinatura de forma legível."];
    nextItems = [t("human_sign_next_1") || "Verifique a URL e leia a mensagem/typed-data com atenção."];
  } else if (action === "CONNECT") {
    whatItems = [t("human_connect_whatIs") || "Conecta seu endereço de carteira a este site (como um login)."];
    riskItems = [t("human_connect_risk_1") || "Privacidade/rastreamento: pode vincular seu endereço a este site."];
    safeItems = [t("human_connect_safe_1") || "Trate connect como compartilhar identidade: faça isso só em sites que você reconhece."];
    nextItems = [t("human_connect_next_1") || "Confira o domínio (ortografia, HTTPS, sem punycode)."];
  } else {
    whatItems = [t("default_human_generic_what") || "Ação solicitada pela dApp."];
    riskItems = [t("default_human_generic_risk") || "Se algo não fizer sentido, cancele."];
    safeItems = [t("default_human_generic_safe") || "Confirme domínio, rede e detalhes na carteira."];
    nextItems = [t("default_human_generic_next") || "Prossiga apenas se tudo estiver correto."];
  }

  const ul = (items: string[]) =>
    `<ul><li>${items.map((x) => escapeHtml(x)).join("</li><li>")}</li></ul>`;
  return (
    `<p><strong>${escapeHtml(what)}</strong></p>${ul(whatItems)}` +
    `<p><strong>${escapeHtml(risks)}</strong></p>${ul(riskItems)}` +
    `<p><strong>${escapeHtml(safe)}</strong></p>${ul(safeItems)}` +
    `<p><strong>${escapeHtml(next)}</strong></p>${ul(nextItems)}`
  );
}

// --- HELPERS DE UI ---
function getRiskColor(level: string): string {
  if (level === "HIGH" || level === "CRITICAL" || level === "BLOCK") return "#ef4444"; // Red
  if (level === "WARN") return "#f59e0b"; // Orange
  return "#22c55e"; // Green
}

function renderAssetChanges(changes: Array<{ type: "OUT" | "IN"; amount: string; symbol: string }>): string {
  if (!changes || changes.length === 0)
    return `<div style="opacity:0.6; font-size:12px;">${escapeHtml(t("simulation_no_changes") || "Nenhuma mudança de saldo detetada.")}</div>`;
  return changes
    .map(
      (c) => `
    <div style="display:flex; justify-content:space-between; font-size:13px; margin-bottom:4px; padding:4px; background:rgba(255,255,255,0.05); border-radius:4px;">
      <span style="color:${c.type === "OUT" ? "#ef4444" : "#22c55e"}">${c.type === "OUT" ? "📤 Sai" : "📥 Entra"}</span>
      <span>${escapeHtml(c.amount)} <b>${escapeHtml(c.symbol)}</b></span>
    </div>
  `
    )
    .join("");
}

/** UX human-readable panel per request type (CONNECT, ADD_CHAIN, WATCH_ASSET, etc.). */
function renderTypeSpecificPanel(
  action: SGAction,
  meta: { host: string; method: string; params?: any; chainIdHex?: string | null; chainIdRequested?: string },
  analysis: Analysis
): string {
  const host = meta.host || "";
  const params = meta.params ?? [];
  const p0 = Array.isArray(params) && params[0] && typeof params[0] === "object" ? params[0] : null;

  if (action === "CONNECT") {
    const dd = analysis.domainListDecision;
    const signals = analysis.domainSignals ?? [];
    const puny = host.includes("xn--");
    const trustBadge = dd === "TRUSTED"
      ? '<span style="color:#22c55e;">✓ Domínio confiável</span>'
      : dd === "BLOCKED"
        ? '<span style="color:#ef4444;">⚠ Domínio bloqueado</span>'
        : puny
          ? '<span style="color:#f59e0b;">⚠ Domínio punycode (possível lookalike)</span>'
          : '<span style="color:#94a3b8;">Domínio não verificado</span>';
    return `
      <div style="margin-bottom:15px; background:#1e293b; padding:12px; border-radius:8px;">
        <p style="font-size:11px; text-transform:uppercase; color:#64748b; font-weight:bold; margin:0 0 6px 0;">${escapeHtml(t("overlay_action") || "Ação")}</p>
        <p style="margin:0 0 6px 0; font-size:14px;">🔗 ${escapeHtml(actionTitle("CONNECT"))}</p>
        <p style="margin:0 0 6px 0; font-size:12px;">${escapeHtml(host)}</p>
        <p style="margin:0; font-size:12px;">${trustBadge}</p>
        ${signals.length ? `<p style="margin:6px 0 0 0; font-size:11px; color:#94a3b8;">${escapeHtml(signals.join(", "))}</p>` : ""}
      </div>`;
  }

  if (action === "REQUEST_PERMISSIONS") {
    const perms = p0 && typeof p0 === "object" ? (Array.isArray(p0) ? p0 : Object.keys(p0)) : [];
    const permList = perms.length ? perms.map((x: any) => escapeHtml(typeof x === "string" ? x : JSON.stringify(x))).join(", ") : escapeHtml(JSON.stringify(p0 ?? "{}"));
    return `
      <div style="margin-bottom:15px; background:#1e293b; padding:12px; border-radius:8px;">
        <p style="font-size:11px; text-transform:uppercase; color:#64748b; font-weight:bold; margin:0 0 6px 0;">${escapeHtml(t("overlay_action") || "Ação")}</p>
        <p style="margin:0 0 6px 0; font-size:14px;">🔐 ${escapeHtml(actionTitle("REQUEST_PERMISSIONS"))}</p>
        <p style="margin:0; font-size:12px; color:#94a3b8;">Site poderá ver/solicitar contas. Permissões: ${permList}</p>
      </div>`;
  }

  if (action === "ADD_CHAIN") {
    const info = analysis.addChainInfo ?? p0;
    const chainId = info?.chainId ?? meta.chainIdRequested ?? "?";
    const chainName = info?.chainName ?? "?";
    const native = info?.nativeCurrency ?? p0?.nativeCurrency;
    const symbol = (native?.symbol ?? native?.name ?? "?");
    const decimals = native?.decimals ?? 18;
    const rpcUrls = info?.rpcUrls ?? p0?.rpcUrls ?? [];
    const rpc0 = Array.isArray(rpcUrls) ? rpcUrls[0] : (typeof rpcUrls === "string" ? rpcUrls : "");
    const explorerUrls = info?.blockExplorerUrls ?? p0?.blockExplorerUrls ?? [];
    const exp0 = Array.isArray(explorerUrls) ? explorerUrls[0] : (typeof explorerUrls === "string" ? explorerUrls : "");
    const chainIdHex = String(chainId).startsWith("0x") ? chainId : "0x" + parseInt(String(chainId), 10).toString(16);
    const chainInfo = getChainInfo(chainIdHex);
    const knownChain = chainInfo ? `${chainInfo.name} (conhecida)` : "Rede não reconhecida";
    return `
      <div style="margin-bottom:15px; background:#1e293b; padding:12px; border-radius:8px;">
        <p style="font-size:11px; text-transform:uppercase; color:#64748b; font-weight:bold; margin:0 0 6px 0;">${escapeHtml(t("overlay_action") || "Ação")}</p>
        <p style="margin:0 0 6px 0; font-size:14px;">➕ ${escapeHtml(actionTitle("ADD_CHAIN"))}</p>
        <p style="margin:0 0 4px 0; font-size:12px;"><b>chainId:</b> ${escapeHtml(String(chainId))} (${escapeHtml(knownChain)})</p>
        <p style="margin:0 0 4px 0; font-size:12px;"><b>Nome:</b> ${escapeHtml(String(chainName))}</p>
        <p style="margin:0 0 4px 0; font-size:12px;"><b>Moeda:</b> ${escapeHtml(symbol)} (decimals: ${decimals})</p>
        ${rpc0 ? `<p style="margin:0 0 4px 0; font-size:11px; color:#94a3b8;"><b>RPC:</b> ${escapeHtml(String(rpc0).slice(0, 50))}…</p>` : ""}
        ${exp0 ? `<p style="margin:0; font-size:11px; color:#94a3b8;"><b>Explorer:</b> ${escapeHtml(String(exp0).slice(0, 50))}…</p>` : ""}
      </div>`;
  }

  if (action === "SWITCH_CHAIN") {
    const chainId = p0?.chainId ?? meta.chainIdRequested ?? "?";
    const chainIdHex = String(chainId).startsWith("0x") ? chainId : "0x" + parseInt(String(chainId), 10).toString(16);
    const chainInfo = getChainInfo(chainIdHex);
    const name = chainInfo?.name ?? analysis.chainTarget?.chainName ?? "Rede desconhecida";
    return `
      <div style="margin-bottom:15px; background:#1e293b; padding:12px; border-radius:8px;">
        <p style="font-size:11px; text-transform:uppercase; color:#64748b; font-weight:bold; margin:0 0 6px 0;">${escapeHtml(t("overlay_action") || "Ação")}</p>
        <p style="margin:0 0 6px 0; font-size:14px;">🔄 ${escapeHtml(actionTitle("SWITCH_CHAIN"))}</p>
        <p style="margin:0; font-size:12px;"><b>chainId:</b> ${escapeHtml(String(chainId))} — ${escapeHtml(name)}</p>
      </div>`;
  }

  if (action === "WATCH_ASSET") {
    const info = analysis.watchAssetInfo ?? p0?.options ?? p0;
    const type_ = info?.type ?? p0?.type ?? "ERC20";
    const addr = info?.address ?? info?.token_address ?? "?";
    const symbol = info?.symbol ?? "?";
    const decimals = info?.decimals ?? 18;
    const image = info?.image ?? "";
    const decimalsWarn = decimals < 0 || decimals > 18 ? '<span style="color:#f59e0b;">⚠ decimals fora de [0..18]</span>' : "";
    return `
      <div style="margin-bottom:15px; background:#1e293b; padding:12px; border-radius:8px;">
        <p style="font-size:11px; text-transform:uppercase; color:#64748b; font-weight:bold; margin:0 0 6px 0;">${escapeHtml(t("overlay_action") || "Ação")}</p>
        <p style="margin:0 0 6px 0; font-size:14px;">👁 ${escapeHtml(actionTitle("WATCH_ASSET"))}</p>
        <p style="margin:0 0 4px 0; font-size:12px;"><b>Tipo:</b> ${escapeHtml(String(type_))}</p>
        <p style="margin:0 0 4px 0; font-size:11px; word-break:break-all;"><b>Endereço:</b> ${escapeHtml(String(addr).slice(0, 20))}…</p>
        <p style="margin:0; font-size:12px;"><b>Symbol:</b> ${escapeHtml(String(symbol))} (decimals: ${decimals}) ${decimalsWarn}</p>
        ${image ? `<p style="margin:4px 0 0 0; font-size:11px; color:#94a3b8;">Imagem: ${escapeHtml(String(image).slice(0, 40))}…</p>` : ""}
      </div>`;
  }

  if (action === "SIGN_MESSAGE") {
    const msg = Array.isArray(params) && typeof params[0] === "string" ? params[0] : (p0 ? JSON.stringify(p0).slice(0, 200) : "");
    const preview = msg ? (msg.length > 120 ? msg.slice(0, 120) + "…" : msg) : "—";
    return `
      <div style="margin-bottom:15px; background:#1e293b; padding:12px; border-radius:8px;">
        <p style="font-size:11px; text-transform:uppercase; color:#64748b; font-weight:bold; margin:0 0 6px 0;">${escapeHtml(t("overlay_action") || "Ação")}</p>
        <p style="margin:0 0 6px 0; font-size:14px;">✍️ ${escapeHtml(actionTitle("SIGN_MESSAGE"))}</p>
        <p style="margin:0; font-size:12px; word-break:break-word; max-height:80px; overflow-y:auto;">${escapeHtml(preview)}</p>
      </div>`;
  }

  if (action === "SIGN_TYPED_DATA") {
    const decoded = analysis.typedDataDecoded;
    const permit2 = decoded?.permit2;
    const seaport = decoded?.seaport;
    const isBlur = decoded?.isBlur;
    const extras = analysis.typedDataExtras;
    const raw = analysis.decoded?.raw ?? p0;
    const domain = (typeof raw === "object" && raw?.domain) ? raw.domain : {};
    const primaryType = raw?.primaryType ?? raw?.types?.EIP712Domain ? "EIP712" : "?";
    const contract = domain?.verifyingContract ?? domain?.name ?? "?";
    const isPermitLike = !!(permit2 || (extras?.spender && (extras?.value != null || extras?.deadline != null)));
    const signWarning = t("overlay_typed_data_sign_warning") || "Assinar isso pode permitir gasto futuro sem nova confirmação.";
    let body = "";
    if (isPermitLike) {
      body += `<p style="margin:0 0 8px 0; font-size:11px; text-transform:uppercase; color:#f59e0b; font-weight:bold;">${escapeHtml(t("overlay_typed_data_card_title") || "Assinatura (EIP-712)")}</p>`;
      if (permit2) {
        body += `<p style="margin:0 0 4px 0; font-size:12px;"><b>Spender/Operator:</b> <code style="word-break:break-all;">${escapeHtml(permit2.spender.slice(0, 14))}…</code></p>`;
        if (permit2.tokens?.length) body += `<p style="margin:0 0 4px 0; font-size:11px;">Token(s): ${permit2.tokens.length} — ${permit2.unlimited ? "∞ Ilimitado" : "valor limitado"}</p>`;
        if (permit2.sigDeadline) body += `<p style="margin:0 0 4px 0; font-size:11px;">Deadline: ${escapeHtml(permit2.sigDeadline)}</p>`;
      }
      if (extras?.spender) {
        body += `<p style="margin:0 0 4px 0; font-size:12px;"><b>Spender:</b> <code style="word-break:break-all;">${escapeHtml(extras.spender.slice(0, 14))}…</code></p>`;
        if (extras.value != null) body += `<p style="margin:0 0 4px 0; font-size:11px;">Valor: ${escapeHtml(extras.value)}</p>`;
        if (extras.deadline) body += `<p style="margin:0 0 4px 0; font-size:11px;">Deadline: ${escapeHtml(extras.deadline)}</p>`;
      }
      body += `<p style="margin:8px 0 0 0; font-size:11px; color:#fcd34d;">⚠️ ${escapeHtml(signWarning)}</p>`;
    }
    if (seaport) {
      body += `<p style="margin:0 0 4px 0; font-size:12px;"><b>Seaport:</b> Você oferece ${escapeHtml(seaport.offerSummary)} → Recebe ${escapeHtml(seaport.considerationSummary)}</p>`;
    }
    if (isBlur) {
      body += `<p style="margin:0 0 4px 0; font-size:12px; color:#f59e0b;"><b>Blur:</b> Assinatura de marketplace — revise com cuidado</p>`;
    }
    body += `<p style="margin:0 0 4px 0; font-size:12px;"><b>primaryType:</b> ${escapeHtml(String(primaryType))}</p>`;
    body += `<p style="margin:0 0 4px 0; font-size:11px; word-break:break-all;"><b>Contract:</b> ${escapeHtml(String(contract).slice(0, 24))}…</p>`;
    body += `<p style="margin:0; font-size:11px; color:#94a3b8;">Leia o que você está autorizando na carteira.</p>`;
    return `
      <div style="margin-bottom:15px; background:#1e293b; padding:12px; border-radius:8px;">
        <p style="font-size:11px; text-transform:uppercase; color:#64748b; font-weight:bold; margin:0 0 6px 0;">${escapeHtml(t("overlay_action") || "Ação")}</p>
        <p style="margin:0 0 6px 0; font-size:14px;">✍️ ${escapeHtml(actionTitle("SIGN_TYPED_DATA"))}</p>
        ${body}
      </div>`;
  }

  if (action === "SEND_TX") {
    const tx = analysis.tx ?? p0;
    const to = tx?.to ?? "?";
    const value = tx?.valueEth ?? tx?.valueWei ?? (tx?.value != null ? String(tx.value) : "?");
    const gasFmt = analysis.txCostPreview?.feeLikelyWei
      ? weiToEthFmt(BigInt(analysis.txCostPreview.feeLikelyWei)) + " " + getNativeSymbol(meta.chainIdHex ?? undefined)
      : (t("overlay_calculating") || "Calculando...");
    const usd = analysis.txCostPreview?.usdPerNative && analysis.txCostPreview?.feeLikelyWei
      ? ` (~$${((parseFloat(analysis.txCostPreview.feeLikelyWei) / 1e18) * analysis.txCostPreview.usdPerNative).toFixed(2)} USD)`
      : "";
    const selector = tx?.selector ?? "";
    const selLabel = selector ? selectorToLabel(selector) : null;
    const da = analysis.decodedAction as { kind?: string; standard?: string; tokenIdRaw?: string; to?: string; amountRaw?: string } | undefined;
    const te = analysis.txExtras as { approvalType?: string; spender?: string; operator?: string; tokenContract?: string } | undefined;
    const isNftTransfer = da?.kind === "TRANSFER_NFT";
    const nftInfo =
      isNftTransfer && da
        ? `<p style="margin:0 0 4px 0; font-size:12px;">🖼️ ${escapeHtml(da.standard ?? "NFT")} transfer ${da.tokenIdRaw ? `#${da.tokenIdRaw}` : ""} → ${escapeHtml((da.to ?? "?").slice(0, 12))}…</p>`
        : "";
    const isApproval =
      te?.approvalType === "ERC20_APPROVE" ||
      te?.approvalType === "NFT_SET_APPROVAL_FOR_ALL" ||
      da?.kind === "APPROVE_ERC20" ||
      da?.kind === "INCREASE_ALLOWANCE" ||
      da?.kind === "SET_APPROVAL_FOR_ALL";
    const allowanceBlock =
      isApproval && to && /^0x[a-fA-F0-9]{40}$/.test(String(to))
        ? `<div id="sg-allowance-block" style="margin:8px 0 0 0; font-size:11px; color:#94a3b8;">${escapeHtml(t("overlay_allowance_loading") || "Allowance atual: …")}</div>`
        : "";
    return `
      <div style="margin-bottom:15px; background:#1e293b; padding:12px; border-radius:8px;">
        <p style="font-size:11px; text-transform:uppercase; color:#64748b; font-weight:bold; margin:0 0 6px 0;">${escapeHtml(t("overlay_action") || "Ação")}</p>
        <p style="margin:0 0 6px 0; font-size:14px;">📤 ${escapeHtml(actionTitle("SEND_TX"))}</p>
        <p style="margin:0 0 4px 0; font-size:11px; word-break:break-all;"><b>Para:</b> ${escapeHtml(String(to).slice(0, 24))}…</p>
        ${nftInfo}
        <p style="margin:0 0 4px 0; font-size:12px;"><b>Valor:</b> ${escapeHtml(String(value))} ${getNativeSymbol(meta.chainIdHex ?? undefined)}</p>
        <p style="margin:0 0 4px 0; font-size:12px;"><b>Gas estimado:</b> ${escapeHtml(gasFmt)}${usd}</p>
        ${selLabel ? `<p style="margin:0; font-size:11px; color:#38bdf8;"><b>Função:</b> ${escapeHtml(selLabel)}</p>` : ""}
        ${allowanceBlock}
      </div>`;
  }

  return `
    <div style="margin-bottom:15px;">
      <p style="font-size:11px; text-transform:uppercase; color:#64748b; font-weight:bold; margin-bottom:5px;">${escapeHtml(t("overlay_action") || "Ação")}</p>
      <code style="background:#1e293b; padding:4px 8px; border-radius:4px; color:#38bdf8; font-size:12px;">${escapeHtml(meta.method)}</code>
    </div>`;
}

// --- VISUALIZAÇÃO (UI) ---
type OverlayState = {
  requestId: string;
  analysis: Analysis;
  meta: { host: string; method: string; params?: any; rawShape?: string; rpcMeta?: any; chainIdHex?: string | null; chainIdRequested?: string; gateUI?: boolean };
  container: HTMLDivElement;
  shadow: ShadowRoot;
  app: HTMLDivElement;
  onKey: (e: KeyboardEvent) => void;
  countdownTimer?: number | null;
  keepaliveInterval?: number | null;
  analysisLoading?: boolean;
  domainsExpanded?: boolean;
  _restore?: () => void;
  _watchdogId?: ReturnType<typeof setTimeout> | null;
  /** P1 A11y: element that had focus before overlay */
  prevFocus?: HTMLElement | null;
  /** P1 A11y: siblings we set inert on */
  _inertTargets?: Element[];
};

let __sgOverlay: OverlayState | null = null;

const OVERLAY_CSS_FALLBACK = `
*{box-sizing:border-box}
.sg-backdrop{position:fixed;inset:0;background:rgba(15,23,42,0.6);z-index:2147483647;display:flex;align-items:center;justify-content:center;padding:16px;pointer-events:auto}
.sg-modal{width:min(820px,100vw);max-height:85vh;background:rgba(15,23,42,0.95);border:1px solid #334155;border-radius:14px;box-shadow:0 20px 50px rgba(0,0,0,0.5);display:flex;flex-direction:column;overflow:hidden;pointer-events:auto}
.sg-header,.sg-body,.sg-footer{pointer-events:auto}
.sg-header{padding:12px 16px;border-bottom:1px solid rgba(148,163,184,0.18)}
.sg-body{flex:1;overflow-y:auto;padding:16px}
.sg-footer{display:flex;gap:12px;justify-content:flex-end;padding:14px 16px;border-top:1px solid rgba(255,255,255,0.06);background:rgba(8,12,20,0.92)}
.sg-card{background:rgba(2,6,23,0.5);border:1px solid rgba(148,163,184,0.18);border-radius:10px;padding:12px 16px;margin-bottom:12px}
.sg-btn,.sg-btn-primary,.sg-btn-secondary{all:unset;cursor:pointer;padding:10px 18px;border-radius:10px;font-weight:700;font-size:13px}
.sg-btn-primary{background:#f97316;color:#0b1220}
.sg-btn-secondary{background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);color:#e5e7eb}
.sg-close-btn{all:unset;cursor:pointer;width:32px;height:32px;display:flex;align-items:center;justify-content:center}
input,textarea{background:#020617;border:1px solid rgba(148,163,184,0.2);color:#f8fafc;border-radius:8px;padding:10px}
body,.sg-root{font-family:system-ui,sans-serif;color:#f8fafc;background:transparent}
`;

function ensureOverlayCss(shadow: ShadowRoot) {
  const applyFallback = (reason: string) => {
    try {
      const style = document.createElement("style");
      style.textContent = OVERLAY_CSS_FALLBACK;
      shadow.appendChild(style);
      console.warn("[SignGuard UI] CSS fallback inline applied:", reason);
    } catch {
      console.warn("[SignGuard UI] CSS fallback failed:", reason);
    }
  };
  try {
    let href = safeGetURL("overlay.css");
    if (!href && typeof chrome?.runtime?.getURL === "function") {
      try { href = chrome.runtime.getURL("overlay.css"); } catch {}
    }
    if (!href) {
      applyFallback("getURL returned empty");
      return;
    }
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = href;
    link.onerror = () => applyFallback("overlay.css failed to load");
    shadow.appendChild(link);
  } catch (e) {
    applyFallback(String((e as Error)?.message ?? e));
  }
}

function showOverlay(
  requestId: string,
  analysis: Analysis,
  meta: { host: string; method: string; params?: any; rawShape?: string; rpcMeta?: any; chainIdHex?: string | null; chainIdRequested?: string; gateUI?: boolean }
) {
  console.log("🎨 [SignGuard UI] showOverlay CALLED for:", requestId);

  if (__sgOverlay) {
    console.log("🎨 [SignGuard UI] Updating existing overlay");
    __sgOverlay.requestId = requestId;
    __sgOverlay.analysis = analysis;
    __sgOverlay.meta = meta;
    updateOverlay(__sgOverlay);
    try { safeSendMessage({ type: "SG_DIAG_PUSH", payload: { kind: "OVERLAY_SHOWN", requestId, method: meta.method } }, 500); } catch { /* ignore */ }
    return;
  }

  try {
    const container = document.createElement("div");
    container.id = "__sg_host";
    container.className = "sg-root";
    container.setAttribute("data-sg-overlay", "1");
    container.style.cssText = "position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; z-index: 2147483647; pointer-events: none;";

    const shadow = container.attachShadow({ mode: "open" });
    ensureOverlayCss(shadow);

    const app = document.createElement("div");
    app.id = "sg-app";
    app.style.pointerEvents = "auto";
    shadow.appendChild(app);

    const previousActive = document.activeElement as HTMLElement | null;
    const prevOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        decideCurrentAndAdvance(false);
        return;
      }
      if (e.key === "Tab") {
        const focusables = shadow.querySelectorAll<HTMLElement>("button, [tabindex]:not([tabindex='-1'])");
        const arr = Array.from(focusables);
        if (arr.length === 0) return;
        const idx = arr.indexOf(document.activeElement as HTMLElement);
        if (e.shiftKey) {
          const next = idx <= 0 ? arr[arr.length - 1] : arr[idx - 1];
          next?.focus();
          e.preventDefault();
        } else {
          const next = idx < 0 || idx >= arr.length - 1 ? arr[0] : arr[idx + 1];
          next?.focus();
          e.preventDefault();
        }
      }
    };
    document.addEventListener("keydown", onKey);

    __sgOverlay = {
      requestId,
      analysis,
      meta,
      container,
      shadow,
      app,
      onKey,
      prevFocus: previousActive,
      _inertTargets: [],
      _restore: () => {
        const state = __sgOverlay;
        if (state?._inertTargets) {
          for (const el of state._inertTargets) {
            try { el.removeAttribute("inert"); el.removeAttribute("aria-hidden"); } catch {}
          }
        }
        document.documentElement.style.overflow = prevOverflow;
        try {
          if (previousActive && typeof previousActive.focus === "function" && document.body?.contains(previousActive)) {
            (previousActive as HTMLElement).focus();
          } else {
            document.body?.focus?.();
          }
        } catch {}
      },
    };

    if (document.documentElement) {
      document.documentElement.appendChild(container);
    } else {
      document.body.appendChild(container);
    }

    const state = __sgOverlay;
    const inertTargets: Element[] = [];
    for (const el of Array.from(document.documentElement.children)) {
      if (el !== container) {
        el.setAttribute("inert", "");
        el.setAttribute("aria-hidden", "true");
        inertTargets.push(el);
      }
    }
    state._inertTargets = inertTargets;

    if (state) updateOverlay(state);
    try { safeSendMessage({ type: "SG_DIAG_PUSH", payload: { kind: "OVERLAY_SHOWN", requestId, method: meta.method } }, 500); } catch { /* ignore */ }
    setTimeout(() => {
      const toFocus = shadow.querySelector<HTMLElement>("[data-sg-initial-focus]") ?? shadow.querySelector<HTMLElement>("button, [tabindex]:not([tabindex='-1'])");
      toFocus?.focus?.();
    }, 50);
  } catch (e) {
    console.error("🎨 [SignGuard UI] FATAL UI ERROR:", e);
  }
}

function updateOverlay(state: OverlayState) {
  if (!state?.app) return;

  const analysis = state.analysis;

  // 1. ESTADO DE LOADING — esconder "calculando" quando feeEstimated (destravar UI)
  const cost = analysis?.txCostPreview;
  const feeEstimated = cost?.feeEstimated === true;
  const showLoading = !analysis || ((analysis as { level?: string }).level === "LOADING" && !feeEstimated);
  if (showLoading) {
    if (state._watchdogId != null) clearTimeout(state._watchdogId);
    state._watchdogId = setTimeout(() => {
      state._watchdogId = null;
      if (__sgOverlay?.requestId !== state.requestId || !state.app) return;
      const tryAgainLabel = t("overlay_try_again") || "Tentar novamente";
      const closeLabel = t("btn_close") || "Fechar";
      state.app.innerHTML = `
        <div class="sg-card" style="background:#0f172a; padding:30px; border-radius:16px; color:white; width:360px; text-align:center; font-family:sans-serif; border:1px solid #334155; box-shadow:0 20px 50px rgba(0,0,0,0.5);">
          <h3 style="margin:0; font-size:16px;">${escapeHtml(t("overlay_analyzing") || "Analisando Transação...")}</h3>
          <p style="opacity:0.8; font-size:13px; margin-top:12px;">${escapeHtml(t("overlay_analysis_taking_long") || "A análise está demorando.")}</p>
          <div style="display:flex; gap:12px; margin-top:20px; justify-content:center;">
            <button id="sg-btn-retry-loading" style="flex:1; background:#f59e0b; color:black; border:none; padding:12px; border-radius:8px; font-weight:600; cursor:pointer;">${escapeHtml(tryAgainLabel)}</button>
            <button id="sg-btn-close-loading" style="flex:1; background:#334155; color:white; border:none; padding:12px; border-radius:8px; font-weight:600; cursor:pointer;">${escapeHtml(closeLabel)}</button>
          </div>
        </div>
      `;
      state.shadow.getElementById("sg-btn-retry-loading")?.addEventListener("click", () => retryAnalyze());
      state.shadow.getElementById("sg-btn-close-loading")?.addEventListener("click", () => decideCurrentAndAdvance(false));
    }, 8000);
    state.app.innerHTML = `
      <div class="sg-card" style="background:#0f172a; padding:30px; border-radius:16px; color:white; width:360px; text-align:center; font-family:sans-serif; border:1px solid #334155; box-shadow:0 20px 50px rgba(0,0,0,0.5);">
        <div class="sg-spinner" style="border:3px solid rgba(255,255,255,0.3); border-top:3px solid #38bdf8; border-radius:50%; width:30px; height:30px; animation:sg-spin 1s linear infinite; margin:0 auto 15px;"></div>
        <h3 style="margin:0; font-size:16px;">${escapeHtml(t("overlay_analyzing") || "Analisando Transação...")}</h3>
        <p style="opacity:0.6; font-size:12px; margin-top:5px;">${feeEstimated ? (escapeHtml(t("overlay_fee_calculated") || "Taxas calculadas.") + " " + (t("overlay_finishing") || "Finalizando análise...")) : escapeHtml(t("overlay_simulating") || "O SignGuard está a simular o resultado.")}</p>
        <div style="display:flex; gap:12px; margin-top:20px; justify-content:center;">
          <button id="sg-btn-block-loading" style="flex:1; background:#334155; color:white; border:none; padding:12px; border-radius:8px; font-weight:600; cursor:pointer;">${escapeHtml(t("btn_block") || "Bloquear")}</button>
          <button id="sg-btn-allow-loading" style="flex:1; background:#f59e0b; color:black; border:none; padding:12px; border-radius:8px; font-weight:bold; cursor:pointer;">${escapeHtml(t("overlay_continue_no_analysis") || "Continuar (sem análise)")}</button>
        </div>
        <style>@keyframes sg-spin {0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}}</style>
      </div>
    `;
    setTimeout(() => {
      state.shadow.getElementById("sg-btn-block-loading")?.addEventListener("click", () => decideCurrentAndAdvance(false));
      state.shadow.getElementById("sg-btn-allow-loading")?.addEventListener("click", () => {
        if (confirm(t("overlay_confirm_allow_msg") || "Tem certeza? Isso ignora proteção.")) {
          decideCurrentAndAdvance(true);
        }
      });
    }, 0);
    return;
  }

  if (state._watchdogId != null) {
    clearTimeout(state._watchdogId);
    state._watchdogId = null;
  }

  // 2. DADOS FINAIS
  const level = (analysis.level || (analysis.recommend === "ALLOW" ? "LOW" : analysis.recommend === "WARN" ? "WARN" : "HIGH")) as string;
  const recommend = analysis.recommend ?? "WARN";
  const score = analysis.score ?? 0;
  const color = getRiskColor(level);
  const method = state.meta?.method || (t("tx_unknown") || "Transação Desconhecida");
  const host = state.meta?.host || (t("dapp_unknown") || "DApp Desconhecido");
  const rawReasons = analysis.reasons ?? [];
  const sim = analysis.simulationOutcome;
  const intent = analysis.intent ?? analysis.txContext?.kind;
  const isNftPurchase = intent === "NFT_PURCHASE";
  const isTokenSwap = intent === "SWAP" || intent === "TOKEN_SWAP";

  const assetChanges: Array<{ type: "OUT" | "IN"; amount: string; symbol: string }> = [];
  const outgoing = sim?.outgoingAssets ?? [];
  const incoming = sim?.incomingAssets ?? [];
  for (const o of outgoing)
    assetChanges.push({ type: "OUT", amount: o.amount ?? "", symbol: o.symbol ?? "?" });
  for (const i of incoming)
    assetChanges.push({ type: "IN", amount: i.amount ?? "", symbol: i.symbol ?? "?" });
  const approvals = sim?.approvals ?? [];

  const tokenConf = analysis.tokenConfidence;
  const tokenSymbol = analysis.asset?.symbol ?? analysis.asset?.name ?? (analysis as { tokenSymbol?: string }).tokenSymbol ?? "?";
  const reasons = rawReasons.length > 0
    ? rawReasons
    : ["Sem sinais fortes, mas confirme destino, valor e rede."];
  const showTokenLowConf = (tokenConf === "LOW" || tokenConf === "UNKNOWN") && (isTokenSwap || analysis.intent === "APPROVAL");
  const bannerColor = recommend === "ALLOW"
    ? "#22c55e"
    : recommend === "WARN"
      ? "#f59e0b"
      : "#ef4444";
  const bannerText = recommend === "ALLOW"
    ? (t("overlay_safe_continue") || "Seguro para continuar")
    : recommend === "WARN"
      ? (t("overlay_attention") || "Atenção")
      : (t("overlay_danger") || "Perigoso / provável golpe");
  const intentMsg = isNftPurchase
    ? (t("overlay_nft_purchase_msg") || "Se confirmar, os valores serão transferidos e a aquisição do NFT será realizada.")
    : isTokenSwap
      ? (t("overlay_swap_msg") || "Você está prestes a trocar tokens. Confirme token recebido e liquidez.")
      : "";
  const feeStatusText = feeEstimated
    ? (t("overlay_fee_calculated") || "Taxas calculadas.")
    : (t("overlay_calculating") || "Calculando...");
  const isFallback = !!(analysis as { _isFallback?: boolean })._isFallback;
  const failMode = __sgSettings?.failMode ?? "fail_open";
  const vaultBlocked = analysis.vaultBlocked === true;
  const hideAllow = analysis.matchedDenySpender === true || vaultBlocked;
  const fallbackFailClosed = isFallback && failMode === "fail_closed";
  const allowLabel = fallbackFailClosed
    ? (t("overlay_allow_once_risky") || "Permitir 1 vez (arriscado)")
    : isFallback && failMode === "fail_open"
      ? (t("overlay_allow_anyway") || "Permitir mesmo assim")
      : (t("btn_continue") || "Continuar");

  const action = classifyAction(method, state.meta?.params ?? []);
  const typePanel = renderTypeSpecificPanel(action, state.meta, analysis);
  const showSimulation = action === "SEND_TX";

  function getSpenderFromAnalysis(a: Analysis): string | null {
    const da = a.decodedAction as { spender?: string; operator?: string } | undefined;
    if (da?.spender && /^0x[a-fA-F0-9]{40}$/.test(da.spender)) return da.spender.toLowerCase();
    if (da?.operator && /^0x[a-fA-F0-9]{40}$/.test(da.operator)) return da.operator.toLowerCase();
    const te = a.txExtras as { spender?: string; operator?: string } | undefined;
    if (te?.spender && /^0x[a-fA-F0-9]{40}$/.test(te.spender)) return te.spender.toLowerCase();
    if (te?.operator) return te.operator.toLowerCase();
    if (a.typedDataExtras?.spender && /^0x[a-fA-F0-9]{40}$/.test(a.typedDataExtras.spender)) return a.typedDataExtras.spender.toLowerCase();
    return null;
  }
  const overlaySpender = getSpenderFromAnalysis(analysis);
  const quickSpenderBlock = overlaySpender
    ? `
        <div style="margin-bottom:15px; background:#1e293b; padding:10px; border-radius:8px;">
          <p style="font-size:11px; color:#64748b; margin:0 0 6px 0;">Spender: <code style="word-break:break-all;">${escapeHtml(overlaySpender.slice(0, 10))}…</code></p>
          <div style="display:flex; gap:8px; flex-wrap:wrap;">
            <button id="sg-btn-allow-spender" style="background:#22c55e; color:black; border:none; padding:6px 12px; border-radius:6px; font-size:12px; cursor:pointer;">Sempre permitir</button>
            <button id="sg-btn-deny-spender" style="background:#ef4444; color:white; border:none; padding:6px 12px; border-radius:6px; font-size:12px; cursor:pointer;">Sempre bloquear</button>
          </div>
        </div>`
    : "";
  const quickDomainBlock = `
        <div style="margin-bottom:15px; background:#1e293b; padding:10px; border-radius:8px;">
          <p style="font-size:11px; color:#64748b; margin:0 0 6px 0;">Domínio: ${escapeHtml(host)}</p>
          <div style="display:flex; gap:8px; flex-wrap:wrap;">
            <button id="sg-btn-trust-domain" style="background:#22c55e; color:black; border:none; padding:6px 12px; border-radius:6px; font-size:12px; cursor:pointer;">Adicionar a Trusted</button>
            <button id="sg-btn-block-domain" style="background:#ef4444; color:white; border:none; padding:6px 12px; border-radius:6px; font-size:12px; cursor:pointer;">Adicionar a Blocked</button>
            <button id="sg-btn-temp-allow-10" style="background:#334155; color:white; border:none; padding:6px 12px; border-radius:6px; font-size:12px; cursor:pointer;">${escapeHtml(t("overlay_temp_allow_10min") || "Permitir por 10 min")}</button>
          </div>
        </div>`;

  state.app.innerHTML = `
    <div class="sg-card" role="dialog" aria-labelledby="sg-overlay-title" aria-describedby="sg-overlay-desc" aria-modal="true" style="background:#0f172a; color:white; width:380px; font-family:'Inter', sans-serif; border-radius:16px; overflow:hidden; box-shadow:0 25px 50px -12px rgba(0,0,0,0.7); border:1px solid ${color}; position:fixed; bottom:30px; right:30px; z-index:999999;">
      
      <div style="background:${bannerColor}; padding:10px 16px; text-align:center;">
        <span style="font-weight:800; font-size:13px; text-transform:uppercase; color:${recommend === "ALLOW" ? "black" : "white"}; letter-spacing:0.5px;">${escapeHtml(bannerText)}</span>
      </div>
      <div style="background:${color}; padding:10px 20px; display:flex; justify-content:space-between; align-items:center;">
        <span style="font-weight:700; font-size:13px; color:${level === "HIGH" || level === "BLOCK" ? "white" : "black"}; letter-spacing:0.5px;">🛡️ SignGuard</span>
        <span style="background:rgba(0,0,0,0.2); color:white; padding:2px 8px; border-radius:12px; font-size:11px; font-weight:bold;">SCORE ${score}/100</span>
      </div>

      <div style="padding:20px;">
        ${(state.meta as { gateUI?: boolean }).gateUI ? `<div style="margin-bottom:15px; background:#1e3a5f; border:1px solid #38bdf8; padding:10px 14px; border-radius:8px; font-size:13px; color:#e0f2fe;">${escapeHtml(t("overlay_confirm_before_wallet") || "Confirme aqui antes de abrir a carteira.")}</div>` : ""}
        <div id="sg-overlay-desc" style="margin-bottom:15px; border-bottom:1px solid #334155; padding-bottom:15px;">
          <h2 id="sg-overlay-title" style="margin:0 0 5px 0; font-size:18px; color:#f8fafc;">${escapeHtml(host)}</h2>
          <p style="margin:0; font-size:13px; color:#94a3b8;">${escapeHtml(method)}</p>
        </div>

        ${intentMsg ? `
        <div style="margin-bottom:15px; background:rgba(56,189,248,0.1); border:1px solid rgba(56,189,248,0.3); padding:10px; border-radius:8px;">
          <p style="margin:0; font-size:12px; color:#93c5fd;">ℹ️ ${escapeHtml(intentMsg)}</p>
        </div>
        ` : ""}

        ${((): string => {
          const sum = analysis.summaryV1 ?? analysis.summary;
          if (!sum?.title) return "";
          const giveList = (sum.give ?? []).map((g) => `${g.amount ?? "?"} ${g.symbol ?? ""}`.trim()).filter(Boolean);
          const getList = (sum.get ?? []).map((g) => `${g.amount ?? "?"} ${g.symbol ?? ""}`.trim()).filter(Boolean);
          const approvalLines = (sum.approvals ?? []).map((a) => `${a.tokenSymbol || a.tokenAddress?.slice(0, 8) || "?"} → ${a.spender?.slice(0, 10) ?? "?"}… ${a.unlimited ? "∞" : a.amount ?? ""}`.trim());
          const nftLines = (sum.nfts ?? []).map((n) => `${n.collection || n.tokenAddress?.slice(0, 8) || "NFT"} ${n.tokenId ? "#" + n.tokenId : ""}`.trim()).filter(Boolean);
          const flagPills = (sum.flags ?? []).map((f) => {
            const label = t("reason_" + String(f).toLowerCase()) || f;
            return `<span style="display:inline-block;background:rgba(245,158,11,0.2);color:#fcd34d;padding:2px 8px;border-radius:6px;font-size:11px;margin:2px 4px 2px 0;">${escapeHtml(label)}</span>`;
          }).join("");
          return `
        <div style="margin-bottom:15px; background:#1e293b; border:1px solid #334155; padding:12px; border-radius:8px;">
          <p style="font-size:11px; text-transform:uppercase; color:#64748b; font-weight:bold; margin:0 0 6px 0;">${escapeHtml(t("overlay_summary_title") || "Resumo")}</p>
          <p style="margin:0 0 4px 0; font-size:14px; font-weight:600; color:#f8fafc;">${escapeHtml(sum.title)}</p>
          ${sum.subtitle ? `<p style="margin:0 0 8px 0; font-size:12px; color:#94a3b8;">${escapeHtml(sum.subtitle)}</p>` : ""}
          ${giveList.length ? `<p style="margin:4px 0; font-size:12px; color:#fca5a5;">${escapeHtml(t("cost_you_send") || "Você envia")}: ${escapeHtml(giveList.join(", "))}</p>` : ""}
          ${getList.length ? `<p style="margin:4px 0; font-size:12px; color:#86efac;">${escapeHtml(t("cost_you_receive") || "Você recebe")}: ${escapeHtml(getList.join(", "))}</p>` : ""}
          ${approvalLines.length ? `<p style="margin:4px 0; font-size:11px; color:#fcd34d;">${escapeHtml(t("overlay_approvals_detected") || "Aprovações")}: ${escapeHtml(approvalLines.join("; "))}</p>` : ""}
          ${nftLines.length ? `<p style="margin:4px 0; font-size:11px; color:#93c5fd;">NFT: ${escapeHtml(nftLines.join(", "))}</p>` : ""}
          ${flagPills ? `<div style="margin-top:8px;">${flagPills}</div>` : ""}
        </div>`;
        })()}

        ${typePanel}
        ${quickSpenderBlock}
        ${quickDomainBlock}

        ${showSimulation ? `
        <div style="margin-bottom:20px;">
          <p style="font-size:11px; text-transform:uppercase; color:#64748b; font-weight:bold; margin-bottom:5px;">${escapeHtml(t("overlay_simulation_balance") || "Simulação de Balanço")}</p>
          <div style="background:#1e293b; padding:10px; border-radius:8px; max-height:100px; overflow-y:auto;">
            ${renderAssetChanges(assetChanges)}
          </div>
          ${approvals.length > 0 ? `
          <p style="font-size:11px; text-transform:uppercase; color:#f59e0b; font-weight:bold; margin:10px 0 4px 0;">${escapeHtml(t("overlay_approvals_detected") || "Aprovações detectadas")}</p>
          <div style="background:rgba(245,158,11,0.1); padding:8px; border-radius:6px; font-size:11px;">
            ${approvals.map((a) => `<p style="margin:0 0 4px 0;">${a.unlimited ? "∞" : ""} ${escapeHtml(a.spender.slice(0, 10))}…</p>`).join("")}
          </div>
          ` : ""}
          ${feeEstimated ? `<p style="margin:8px 0 0 0; font-size:11px; color:#64748b;">✓ ${escapeHtml(feeStatusText)}</p>` : `<p style="margin:8px 0 0 0; font-size:11px; color:#94a3b8;">${escapeHtml(feeStatusText)}</p>`}
        </div>
        ` : ""}

        <div style="margin-bottom:20px;">
          <p style="font-size:11px; text-transform:uppercase; color:#64748b; font-weight:bold; margin-bottom:5px;">${escapeHtml(t("overlay_risk_why") || "RISCO E POR QUÊ")}</p>
          ${showTokenLowConf ? `
          <div style="background:rgba(245,158,11,0.15); border:1px solid rgba(245,158,11,0.4); padding:10px; border-radius:8px; margin-bottom:10px;">
            <p style="margin:0; font-size:12px; color:#fcd34d;">Token analisado: ${escapeHtml(tokenSymbol)} — Confiança: BAIXA (recém-lançado / pouca liquidez / sem reputação)</p>
          </div>
          ` : ""}
          <div style="background:rgba(239,68,68,0.1); border:1px solid rgba(239,68,68,0.3); padding:10px; border-radius:8px;">
            ${reasons.map((r) => `<p style="margin:0 0 6px 0; color:#fca5a5; font-size:12px;">⚠️ ${escapeHtml(r)}</p>`).join("")}
          </div>
        </div>

        ${vaultBlocked ? `
        <div style="margin-bottom:15px; background:rgba(245,158,11,0.15); border:1px solid rgba(245,158,11,0.4); padding:12px; border-radius:8px;">
          <p style="margin:0 0 10px 0; font-size:12px; color:#fcd34d;">Este contrato está bloqueado pelo Vault.</p>
          <div style="display:flex; gap:8px; flex-wrap:wrap;">
            <button id="sg-btn-vault-unlock-5" style="background:#f59e0b; color:black; border:none; padding:8px 14px; border-radius:6px; font-weight:600; cursor:pointer; font-size:12px;">${escapeHtml(t("vault_unlock_5min") || "Desbloquear 5 min")}</button>
            <button id="sg-btn-vault-unlock-30" style="background:#eab308; color:black; border:none; padding:8px 14px; border-radius:6px; font-weight:600; cursor:pointer; font-size:12px;">${escapeHtml(t("vault_unlock_30min") || "Desbloquear 30 min")}</button>
            <a id="sg-btn-vault-settings" href="${escapeHtml((typeof chrome !== "undefined" && chrome?.runtime?.getURL ? chrome.runtime.getURL("options.html") : "") + "#vault")}" target="_blank" rel="noopener" style="display:inline-block; background:#334155; color:white; padding:8px 14px; border-radius:6px; font-size:12px; text-decoration:none;">Abrir configurações</a>
          </div>
        </div>
        ` : ""}
        <div style="display:flex; gap:12px;">
          ${vaultBlocked ? `
          <button id="sg-btn-block" data-sg-initial-focus="1" data-sg-secondary="1" style="flex:1; background:#ef4444; color:white; border:none; padding:12px; border-radius:8px; font-weight:600; cursor:pointer;">${escapeHtml(t("btn_block") || "Manter bloqueado")}</button>
          ` : fallbackFailClosed ? `
          <button id="sg-btn-block" ${recommend === "BLOCK" ? 'data-sg-initial-focus="1" data-sg-secondary="1"' : 'data-sg-primary="1"'} style="flex:1; background:#ef4444; color:white; border:none; padding:12px; border-radius:8px; font-weight:600; cursor:pointer;">${escapeHtml(t("btn_block") || "Bloquear")}</button>
          <button id="sg-btn-allow" ${recommend !== "BLOCK" ? 'data-sg-initial-focus="1" data-sg-primary="1"' : 'data-sg-secondary="1"'} style="flex:1; background:#334155; color:white; border:none; padding:12px; border-radius:8px; font-weight:600; cursor:pointer;">${escapeHtml(allowLabel)}</button>
          ` : `
          <button id="sg-btn-block" ${hideAllow || recommend === "BLOCK" ? 'data-sg-initial-focus="1" data-sg-secondary="1"' : 'data-sg-secondary="1"'} style="flex:1; background:#334155; color:white; border:none; padding:12px; border-radius:8px; font-weight:600; cursor:pointer;">${escapeHtml(t("btn_block") || "Bloquear")}</button>
          ${hideAllow ? "" : `<button id="sg-btn-allow" ${!hideAllow && recommend !== "BLOCK" ? 'data-sg-initial-focus="1" data-sg-primary="1"' : 'data-sg-primary="1"'} style="flex:1; background:${color}; color:${level === "HIGH" || level === "BLOCK" ? "white" : "black"}; border:none; padding:12px; border-radius:8px; font-weight:bold; cursor:pointer;">${escapeHtml(allowLabel)}</button>`}
          `}
        </div>
        <div style="margin-top:12px;">
          <button id="sg-btn-retry" style="width:100%; background:transparent; color:#64748b; border:1px solid #334155; padding:8px; border-radius:6px; font-size:12px; cursor:pointer;">${escapeHtml(t("overlay_try_again") || "Tentar novamente")}</button>
        </div>

      </div>
    </div>
  `;

  const needsAllowFriction = (fallbackFailClosed || (isFallback && failMode === "fail_open"));
  setTimeout(() => {
    state.shadow.getElementById("sg-btn-block")?.addEventListener("click", () => decideCurrentAndAdvance(false));
    const allowBtn = state.shadow.getElementById("sg-btn-allow");
    if (allowBtn) {
      allowBtn.addEventListener("click", () => {
        if (needsAllowFriction && !(state as any).__sgAllowConfirmed) {
          const parent = allowBtn.closest("div");
          if (parent) {
            const confirmDiv = document.createElement("div");
            confirmDiv.id = "sg-confirm-allow";
            confirmDiv.style.cssText = "margin-top:12px; padding:12px; background:rgba(239,68,68,0.15); border:1px solid rgba(239,68,68,0.4); border-radius:8px;";
            confirmDiv.innerHTML = `<p style="margin:0 0 10px 0; font-size:12px; color:#fca5a5;">${escapeHtml(t("overlay_confirm_allow_msg") || "Tem certeza? Isso ignora proteção.")}</p>
              <div style="display:flex; gap:8px;">
                <button id="sg-btn-confirm-allow" style="background:#f59e0b; color:black; border:none; padding:8px 14px; border-radius:6px; font-weight:600; cursor:pointer;">${escapeHtml(t("overlay_confirm_allow") || "Confirmar permitir 1 vez")}</button>
                <button id="sg-btn-cancel-allow" style="background:#334155; color:white; border:none; padding:8px 14px; border-radius:6px; cursor:pointer;">${escapeHtml(t("btn_cancel") || "Cancelar")}</button>
              </div>`;
            parent.appendChild(confirmDiv);
            (state as any).__sgAllowConfirmed = true;
            state.shadow.getElementById("sg-btn-confirm-allow")?.addEventListener("click", () => {
              decideCurrentAndAdvance(true);
            });
            state.shadow.getElementById("sg-btn-cancel-allow")?.addEventListener("click", () => {
              confirmDiv.remove();
              (state as any).__sgAllowConfirmed = false;
            });
          }
          return;
        }
        decideCurrentAndAdvance(true);
      });
    }
    state.shadow.getElementById("sg-btn-retry")?.addEventListener("click", () => retryAnalyze());
    state.shadow.getElementById("sg-btn-allow-spender")?.addEventListener("click", async () => {
      if (!overlaySpender) return;
      try {
        await safeSendMessage({ type: "SG_UPDATE_SPENDERS", payload: { addToAllow: overlaySpender } }, 3000);
        await loadSettings();
        retryAnalyze();
      } catch {}
    });
    state.shadow.getElementById("sg-btn-deny-spender")?.addEventListener("click", async () => {
      if (!overlaySpender) return;
      try {
        await safeSendMessage({ type: "SG_UPDATE_SPENDERS", payload: { addToDeny: overlaySpender } }, 3000);
        await loadSettings();
        retryAnalyze();
      } catch {}
    });
    state.shadow.getElementById("sg-btn-trust-domain")?.addEventListener("click", async () => {
      try {
        await safeSendMessage({ type: "SG_LISTS_OVERRIDE_ADD", payload: { type: "trusted_domain", payload: { value: host } } }, 3000);
        retryAnalyze();
      } catch {}
    });
    state.shadow.getElementById("sg-btn-block-domain")?.addEventListener("click", async () => {
      try {
        await safeSendMessage({ type: "SG_LISTS_OVERRIDE_ADD", payload: { type: "blocked_domain", payload: { value: host } } }, 3000);
        retryAnalyze();
      } catch {}
    });
    state.shadow.getElementById("sg-btn-temp-allow-10")?.addEventListener("click", async () => {
      try {
        await safeSendMessage({ type: "SG_ADD_TEMP_ALLOW", payload: { host, spender: overlaySpender ?? null, ttlMs: 10 * 60 * 1000 } }, 3000);
        showToast(t("overlay_temp_allow_toast") || "Permitido por 10 min");
        decideCurrentAndAdvance(true);
      } catch {}
    });
    const doVaultUnlock = async (ttlMs: number) => {
      const contract = analysis.vaultLockedTo;
      const chainIdHex = analysis.vaultChainIdHex ?? state.meta?.chainIdHex ?? (requestQueue[0] as { chainIdHex?: string })?.chainIdHex ?? "0x0";
      if (!contract) return;
      try {
        const res = await safeSendMessage<any>({ type: "VAULT_UNLOCK", payload: { chainIdHex, contract, ttlMs } }, 3000);
        if (res?.ok) {
          const mins = Math.round(ttlMs / 60000);
          showToast(t("vault_unlocked_toast")?.replace("{n}", String(mins)) || `Desbloqueado por ${mins} min`);
          await loadSettings();
          retryAnalyze();
        }
      } catch { /* ignore */ }
    };
    state.shadow.getElementById("sg-btn-vault-unlock-5")?.addEventListener("click", () => doVaultUnlock(5 * 60 * 1000));
    state.shadow.getElementById("sg-btn-vault-unlock-30")?.addEventListener("click", () => doVaultUnlock(30 * 60 * 1000));
    const initialFocusBtn = state.shadow.querySelector<HTMLElement>("[data-sg-initial-focus]");
    if (initialFocusBtn) initialFocusBtn.focus();
    const allowanceEl = state.shadow.getElementById("sg-allowance-block");
    if (allowanceEl && overlaySpender) {
      const token = (analysis.tx as { to?: string } | undefined)?.to;
      const p0 = state.meta?.params?.[0];
      const owner = p0 && typeof p0 === "object" ? (p0 as { from?: string }).from : undefined;
      const chainIdHex = state.meta?.chainIdHex ?? (requestQueue[0] as { chainIdHex?: string } | undefined)?.chainIdHex;
      const isNft =
        (analysis.txExtras as { approvalType?: string } | undefined)?.approvalType === "NFT_SET_APPROVAL_FOR_ALL" ||
        (analysis.decodedAction as { kind?: string } | undefined)?.kind === "SET_APPROVAL_FOR_ALL";
      if (token && owner && /^0x[a-fA-F0-9]{40}$/.test(token) && /^0x[a-fA-F0-9]{40}$/.test(owner)) {
        fetchCurrentAllowance(chainIdHex, token, owner, overlaySpender, isNft).then((val) => {
          if (val != null && __sgOverlay?.requestId === state.requestId) {
            const el = state.shadow.getElementById("sg-allowance-block");
            if (el) el.textContent = (t("overlay_allowance_current") || "Allowance atual: ") + val;
          }
        }).catch(() => {});
      }
    }
  }, 0);
}

function cleanupOverlay() {
  if (__sgOverlay) {
    try { if (__sgOverlay._watchdogId != null) clearTimeout(__sgOverlay._watchdogId); } catch {}
    try { __sgOverlay._restore?.(); } catch {}
    try { document.removeEventListener("keydown", __sgOverlay.onKey); } catch {}
    try { __sgOverlay.container.remove(); } catch {}
    __sgOverlay = null;
  }
}

// --- LÓGICA DE DECISÃO ---

const requestQueue: Array<{
  requestId: string;
  method: string;
  host: string;
  params?: any;
  chainIdHex?: string;
  chainIdRequested?: string;
  analysis: Analysis | { level: string };
  analyzePayload?: AnalyzeRequest;
}> = [];

function showCurrentPending() {
  const cur = requestQueue[0];
  if (cur) {
    showOverlay(cur.requestId, cur.analysis as Analysis, {
      host: cur.host,
      method: cur.method,
      params: cur.params,
      chainIdHex: cur.chainIdHex ?? null,
      chainIdRequested: cur.chainIdRequested,
      gateUI: (cur as { _uiGate?: boolean })._uiGate ?? false,
    });
  }
}

/** P0-B: Re-dispatch ANALYZE for current request (Tentar novamente). */
async function retryAnalyze() {
  const cur = requestQueue[0];
  if (!cur?.analyzePayload) return;
  const loadingAnalysis = { level: "LOADING" as const, score: 0, title: "", reasons: [], recommend: "WARN" as const };
  cur.analysis = loadingAnalysis as unknown as Analysis | { level: string };
  if (__sgOverlay && __sgOverlay.requestId === cur.requestId) {
    __sgOverlay.analysis = loadingAnalysis as unknown as Analysis;
    updateOverlay(__sgOverlay);
  }
  try {
    const resp = await safeSendMessage<{ ok?: boolean; analysis?: Analysis }>(
      { type: "ANALYZE", payload: cur.analyzePayload },
      { timeoutMs: 8000, preferPort: true }
    );
    if (resp?.analysis) {
      cur.analysis = resp.analysis;
      if (__sgOverlay && __sgOverlay.requestId === cur.requestId) {
        __sgOverlay.analysis = resp.analysis;
        updateOverlay(__sgOverlay);
      }
    }
  } catch {
    const fallback = {
      level: "WARN" as const,
      score: 0,
      title: t("overlay_analysis_unavailable") || "Análise indisponível",
      reasons: [t("overlay_analysis_fallback") || "Não foi possível obter a análise."],
      recommend: "WARN" as const,
    };
    cur.analysis = fallback as unknown as Analysis | { level: string };
    if (__sgOverlay && __sgOverlay.requestId === cur.requestId) {
      __sgOverlay.analysis = fallback;
      updateOverlay(__sgOverlay);
    }
  }
}

function decideCurrentAndAdvance(allow: boolean, userTriggered = true) {
  const cur = requestQueue[0];
  if (!cur) return;

  try {
    safeSendMessage({ type: "SG_DIAG_PUSH", payload: { kind: "DECISION", requestId: cur.requestId, decision: allow ? "ALLOW" : "BLOCK", method: cur.method, host: cur.host } }, 500);
  } catch { /* ignore */ }

  console.log(`📨 [SignGuard Content] ${userTriggered ? "User decided" : "Auto"}: ${allow ? "ALLOW" : "BLOCK"}`);

  const analysis = cur.analysis as Analysis;
  const chainKey = cur.chainIdHex ? String(cur.chainIdHex).toLowerCase() : "";
  const nativeInfo = chainKey ? __sgNativeUsd[chainKey] : null;
  const nativeSymbol = nativeInfo?.symbol ?? (cur.chainIdHex ? getNativeSymbol(cur.chainIdHex) : "ETH");
  const usdPerNative = nativeInfo?.usd ?? (analysis.txCostPreview as { usdPerNative?: number } | undefined)?.usdPerNative;
  const tx = analysis.tx ?? analysis.txCostPreview;
  const valueEth =
    (analysis.tx as { valueEth?: string } | undefined)?.valueEth ??
    (tx && (tx as { valueWei?: string }).valueWei
      ? weiToEthFmt(BigInt((tx as { valueWei: string }).valueWei))
      : undefined);
  const feeLikely = (analysis.txCostPreview as { feeLikelyWei?: string } | undefined)?.feeLikelyWei
    ? weiToEthFmt(BigInt((analysis.txCostPreview as { feeLikelyWei: string }).feeLikelyWei))
    : (analysis.tx as { maxGasFeeEth?: string } | undefined)?.maxGasFeeEth;
  const feeMax = (analysis.txCostPreview as { feeMaxWei?: string } | undefined)?.feeMaxWei
    ? weiToEthFmt(BigInt((analysis.txCostPreview as { feeMaxWei: string }).feeMaxWei))
    : (analysis.tx as { maxGasFeeEth?: string } | undefined)?.maxGasFeeEth;
  const totalLikely = (analysis.txCostPreview as { totalLikelyWei?: string } | undefined)?.totalLikelyWei
    ? weiToEthFmt(BigInt((analysis.txCostPreview as { totalLikelyWei: string }).totalLikelyWei))
    : (analysis.tx as { maxTotalEth?: string } | undefined)?.maxTotalEth;
  const totalMax = (analysis.txCostPreview as { totalMaxWei?: string } | undefined)?.totalMaxWei
    ? weiToEthFmt(BigInt((analysis.txCostPreview as { totalMaxWei: string }).totalMaxWei))
    : (analysis.tx as { maxTotalEth?: string } | undefined)?.maxTotalEth;

  const historyEvt = {
    ts: Date.now(),
    requestId: cur.requestId,
    host: cur.host,
    method: cur.method,
    to: (analysis.tx as { to?: string } | undefined)?.to,
    valueEth,
    feeLikelyEth: feeLikely,
    feeMaxEth: feeMax,
    totalLikelyEth: totalLikely,
    totalMaxEth: totalMax,
    nativeSymbol,
    usdPerNative: usdPerNative ?? undefined,
    decision: allow ? "ALLOW" : "BLOCK",
    score: analysis.score,
    level: analysis.level,
  };
  safeSendMessage({ type: "SG_LOG_HISTORY", payload: historyEvt }).catch(() => {});

  const uiGate = (cur as { _uiGate?: boolean })._uiGate ?? false;
  const meta: DecisionMeta = { uiConfirmed: userTriggered, uiGate, method: cur.method };
  if (userTriggered) {
    try { safeSendMessage({ type: "SG_DIAG_PUSH", payload: { kind: "DECISION_SENT", requestId: cur.requestId, method: cur.method, decision: allow ? "ALLOW" : "BLOCK" } }, 500); } catch { /* ignore */ }
  }
  const dedupeKey = (cur as any)._dedupeKey as string | undefined;
  const entry = dedupeKey ? __sgDedupeMap.get(dedupeKey) : undefined;
  const relayOrigin = (cur as { _relayOrigin?: Window })._relayOrigin;

  if (relayOrigin) {
    const rids = entry ? Array.from(entry.requestIds) : [cur.requestId];
    for (const rid of rids) {
      try {
        relayOrigin.postMessage(
          {
            source: "signguard",
            type: "SG_RELAY_DECISION",
            relay: { requestId: rid, ts: Date.now() },
            decision: { allow, analysis: cur.analysis, meta },
          },
          "*"
        );
      } catch (e) {
        console.warn("[SignGuard Content] relay decision postMessage failed", rid, e);
      }
    }
    if (dedupeKey) __sgDedupeMap.delete(dedupeKey);
  } else {
    if (entry && dedupeKey) {
      for (const rid of entry.requestIds) sendDecisionToMainWorld(rid, allow, meta);
      __sgDedupeMap.delete(dedupeKey);
    } else {
      sendDecisionToMainWorld(cur.requestId, allow, meta);
    }
  }

  requestQueue.shift();
  cleanupOverlay();

  if (requestQueue.length > 0) setTimeout(showCurrentPending, 100);
}

function requestFeeEstimateFromMainWorld(requestId: string, tx: unknown): Promise<FeeEstimateWire> {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      window.removeEventListener("message", handler);
      resolve({ ok: false, feeEstimated: false, error: "timeout" });
    }, 2200);
    const handler = (ev: MessageEvent) => {
      if (ev.source !== window || ev.data?.source !== "signguard" || ev.data?.type !== "SG_FEE_ESTIMATE_RES") return;
      if (ev.data.requestId !== requestId) return;
      clearTimeout(timeout);
      window.removeEventListener("message", handler);
      resolve(ev.data.feeEstimate ?? { ok: false, feeEstimated: false });
    };
    window.addEventListener("message", handler);
    window.postMessage({ source: "signguard-content", type: "SG_FEE_ESTIMATE_REQ", payload: { requestId, tx } }, "*");
  });
}

// --- LISTENER DE MENSAGENS ---

window.addEventListener("message", async (ev) => {
  if (ev.source !== window || !ev.data) return;
  if (ev.data.source === "signguard-mainworld") {
    const d = ev.data;
    if (d.type === "SG_DIAG_TIMEOUT") {
      try {
        safeSendMessage({ type: "SG_DIAG_PUSH", payload: { kind: d.failMode === "fail_closed" ? "FAILCLOSED_TIMEOUT" : "FAILOPEN_TIMEOUT", requestId: d.requestId, method: d.method } }, 500);
      } catch { /* ignore */ }
    } else if (d.type === "SG_RELEASED") {
      try {
        safeSendMessage({ type: "SG_DIAG_PUSH", payload: { kind: "MAINWORLD_RELEASE", requestId: d.requestId, method: d.method } }, 500);
      } catch { /* ignore */ }
    }
    return;
  }
  if (ev.data.source !== "signguard") return;

  const type = ev.data.type;
  let requestId: string;
  let payload: any;
  let relayOrigin: Window | null = null;
  let relayOriginHref = "";

  if (type === "SG_RELAY_DECISION") {
    const relay = ev.data.relay;
    const decision = ev.data.decision;
    const rid = relay?.requestId;
    const allow = decision?.allow === true;
    const meta = decision?.meta;
    const rec = rid != null ? relayPending.get(rid) : undefined;
    if (rec?.timeoutId) clearTimeout(rec.timeoutId);
    if (rid != null) relayPending.delete(rid);
    if (rid != null) sendDecisionToMainWorld(rid, allow, meta);
    return;
  }

  if (type === "SG_RELAY_REQUEST") {
    if (!IS_TOP_FRAME) return;
    requestId = ev.data.relay?.requestId ?? "";
    payload = ev.data.req ?? {};
    relayOrigin = ev.source as Window;
    relayOriginHref = ev.data.relay?.originHref ?? "";
    console.log("[SignGuard Content] top received relay", { requestId, method: payload?.method, origin: relayOriginHref });
  } else if (type === "SG_REQUEST") {
    requestId = ev.data.requestId;
    payload = ev.data.payload ?? {};
  } else {
    if (type === "SG_PREVIEW") {
      const pid = ev.data.requestId;
      const ppayload = ev.data.payload;
      const chainIdHex = ppayload?.chainIdHex;
      const txCostPreview = ppayload?.txCostPreview;
      __sgPreflightCache.set(pid, { chainIdHex, txCostPreview });
      console.log("📨 [SignGuard Content] SG_PREVIEW received");
      const cur = requestQueue.find((r) => r.requestId === pid);
      if (cur) {
        if (chainIdHex) cur.chainIdHex = chainIdHex;
        if (txCostPreview) (cur.analysis as any).txCostPreview = txCostPreview;
        if (requestQueue[0]?.requestId === pid) showCurrentPending();
      }
      return;
    }
    return;
  }

  await loadSettings();
  const method = (payload?.method ?? "").toLowerCase();
  const gateUI = shouldGateUI(method);
  const failMode = gateUI ? "fail_closed" : (__sgSettings?.failMode ?? "fail_open");

  if (!relayOrigin) {
    window.postMessage({ source: "signguard-content", type: "SG_SETTINGS", requestId, failMode }, "*");
    try {
      safeSendMessage({ type: "SG_DIAG_PUSH", payload: { kind: "MAINWORLD_HOLD_START", requestId, method: payload?.method, host: (payload?.host && String(payload.host).trim()) ? String(payload.host).trim() : "" } }, 500);
    } catch { /* ignore */ }
    console.log("📨 [SignGuard Content] Request received:", payload?.method, "requestId=" + requestId);

    const hostForCheck = (payload?.host && String(payload.host).trim()) ? String(payload.host).trim() : (() => {
      try { return new URL(payload?.url ?? window.location.href).hostname || ""; } catch { return ""; }
    })();

    const paused = typeof __sgSettings?.pausedUntil === "number" && Date.now() < __sgSettings.pausedUntil;

    if (paused) {
      console.log("[SignGuard UI] UI gate bypassed due to EXTENSION_PAUSED");
      sendDecisionToMainWorld(requestId, true, { uiConfirmed: false, uiGate: true, reasonKeys: ["EXTENSION_PAUSED"], method });
      return;
    }

    if (!gateUI) {
      try {
        const res = await safeSendMessage<{ ok?: boolean; allowed?: boolean }>(
          { type: "SG_CHECK_TEMP_ALLOW", payload: { host: hostForCheck, spender: null } },
          { timeoutMs: 500 }
        );
        if (res?.ok && res?.allowed) {
          sendDecisionToMainWorld(requestId, true, { uiConfirmed: false, uiGate: false, method });
          return;
        }
      } catch { /* ignore */ }
    }

    const methodForAuto = method;
    if (AUTO_ALLOW_METHODS.has(methodForAuto)) {
      try {
        safeSendMessage({ type: "SG_DIAG_PUSH", payload: { kind: "REQ", requestId, method: methodForAuto, host: hostForCheck } }, 500);
      } catch { /* ignore */ }
      sendDecisionToMainWorld(requestId, true, { uiConfirmed: false, uiGate: false, method });
      return;
    }

    if (!IS_TOP_FRAME) {
      const meth = String(payload?.method ?? "").toLowerCase();
      const isUiGated = shouldGateUI(meth);
      const allowOnTimeout = !isUiGated && failMode === "fail_open";
      console.log("[SignGuard Content] iframe request -> relaying to top", { requestId, method: payload?.method, href: location.href });
      try {
        window.top?.postMessage(
          { source: "signguard", type: "SG_RELAY_REQUEST", relay: { requestId, originHref: location.href, ts: Date.now() }, req: payload },
          "*"
        );
      } catch (e) {
        console.warn("[SignGuard Content] relay postMessage failed", e);
      }
      const timeoutId = setTimeout(() => {
        relayPending.delete(requestId);
        sendDecisionToMainWorld(requestId, allowOnTimeout, {
          uiConfirmed: false,
          uiGate: isUiGated,
          method: payload?.method,
          reasonKeys: ["RELAY_TIMEOUT"],
        });
        console.warn("[SignGuard Content] relay timeout, applying failMode", { failMode, isUiGated });
      }, RELAY_TIMEOUT_MS);
      relayPending.set(requestId, { timeoutId });
      return;
    }
  }

  const url = payload?.url ?? window.location.href;
  const origin = (() => {
    try { return new URL(url).origin; } catch { return window.location.origin; }
  })();

  const rpcMeta = (payload as any)?.meta ?? null;
  const params = Array.isArray(payload?.params) ? payload.params : [];
  const p0 = params[0] && typeof params[0] === "object" ? params[0] : null;

  let chainIdHex =
    (payload as any)?.chainIdHex ||
    toChainIdHex(rpcMeta?.chainId) ||
    toChainIdHex((payload as any)?.chainId) ||
    null;
  if (method === "wallet_switchethereumchain" && p0?.chainId) {
    const fromParams = toChainIdHex(p0.chainId);
    if (fromParams) chainIdHex = fromParams;
  }
  if (method === "wallet_addethereumchain" && p0?.chainId) {
    const fromParams = toChainIdHex(p0.chainId);
    if (fromParams) chainIdHex = fromParams;
  }

  const host = (payload?.host && String(payload.host).trim()) ? String(payload.host).trim() : inferHost(url);

  const cached = __sgPreflightCache.get(requestId);
  const mergedChainIdHex =
    (payload as any)?.chainIdHex || chainIdHex || cached?.chainIdHex || null;
  const mergedMeta = rpcMeta
    ? { ...rpcMeta, chainIdHex: mergedChainIdHex ?? undefined, chainIdRequested: rpcMeta?.chainIdRequested ?? undefined }
    : mergedChainIdHex || (rpcMeta as any)?.chainIdRequested
      ? { chainIdHex: mergedChainIdHex ?? undefined, chainIdRequested: (rpcMeta as any)?.chainIdRequested ?? undefined }
      : undefined;

  const txCostPreviewMerged = cached?.txCostPreview ?? (payload as any)?.txCostPreview;

  const mergedMetaWithPageRisk = __sgPageRiskResult
    ? { ...mergedMeta, pageRisk: { score: __sgPageRiskResult.riskScore, reasons: __sgPageRiskResult.reasons } }
    : mergedMeta;
  const analyzePayload: AnalyzeRequest = {
    requestId,
    url,
    origin,
    request: { method: payload?.method ?? "", params: Array.isArray(payload?.params) ? payload.params : [] },
    meta: mergedMetaWithPageRisk,
  };
  if (txCostPreviewMerged) analyzePayload.txCostPreview = txCostPreviewMerged;

  if (cached) __sgPreflightCache.delete(requestId);

  const chainIdRequested = (rpcMeta as any)?.chainIdRequested ?? (p0 as any)?.chainId;

  const pending = {
    requestId,
    method: payload?.method ?? "",
    host,
    params: payload?.params,
    chainIdHex: mergedChainIdHex ?? undefined,
    chainIdRequested: typeof chainIdRequested === "string" ? chainIdRequested : undefined,
    analysis: { level: "LOADING", score: 0, title: "", reasons: [], recommend: "WARN" } as unknown as Analysis,
    analyzePayload,
  };
  (pending as { _uiGate?: boolean })._uiGate = gateUI;
  if (txCostPreviewMerged) (pending.analysis as any).txCostPreview = txCostPreviewMerged;
  if (relayOrigin) {
    (pending as { _relayOrigin?: Window })._relayOrigin = relayOrigin;
    (pending as { _relayRequestId?: string })._relayRequestId = requestId;
  }

  // P1-7: Dedupe Map — same method+host+params+origin within 3s merges requestIds (single overlay, fan-out on decide)
  const originHrefForDedupe = relayOriginHref || (typeof location !== "undefined" ? location.href : "");
  const dupKey = `${host}|${method}|${stableStringifyParams(params ?? [])}|${originHrefForDedupe}`;
  for (const [k, ent] of __sgDedupeMap.entries()) {
    if (Date.now() - ent.addedAt >= DEDUPE_MS) __sgDedupeMap.delete(k);
  }
  const existing = __sgDedupeMap.get(dupKey);
  if (existing && Date.now() - existing.addedAt < DEDUPE_MS) {
    existing.requestIds.add(requestId);
    return; // no new overlay; will get decision when primary is decided
  }
  __sgDedupeMap.set(dupKey, { primaryRequestId: requestId, requestIds: new Set([requestId]), addedAt: Date.now() });
  (pending as any)._dedupeKey = dupKey;
  requestQueue.push(pending);

  if (requestQueue.length === 1) showCurrentPending();

  const ANALYSIS_TIMEOUT_MS = 9000;
  let watchdogFired = false;
  const makeFallback = () => {
    const failMode = __sgSettings?.failMode ?? "fail_open";
    return {
      level: "WARN" as const,
      score: 0,
      title: t("overlay_analysis_unavailable") || "Análise indisponível",
      reasons: [t("overlay_analysis_fallback") || "Não foi possível obter a análise agora. Você ainda pode BLOQUEAR ou CONTINUAR."],
      recommend: failMode === "fail_closed" ? ("BLOCK" as const) : ("WARN" as const),
      reasonKeys: [REASON_KEYS.FAILMODE_FALLBACK],
      _isFallback: true as const,
    };
  };
  const watchdog = setTimeout(() => {
    if (watchdogFired) return;
    watchdogFired = true;
    const p = requestQueue.find((r) => r.requestId === requestId);
    if (!p || (p.analysis as any)?.level !== "LOADING") return;
    const fallbackAnalysis = makeFallback() as unknown as Analysis;
    p.analysis = fallbackAnalysis;
    if (__sgOverlay && __sgOverlay.requestId === requestId) {
      __sgOverlay.analysis = fallbackAnalysis;
      updateOverlay(__sgOverlay);
    }
  }, ANALYSIS_TIMEOUT_MS);

  try {
    const response = await safeSendMessage<{ ok?: boolean; analysis?: Analysis }>(
      { type: "ANALYZE", payload: analyzePayload },
      { timeoutMs: 8000, preferPort: true }
    );

    clearTimeout(watchdog);

    if (pending.requestId === requestId && response?.analysis) {
      pending.analysis = response.analysis;
      const spenderFromAnalysis = (() => {
        const a = response.analysis as Analysis;
        const da = a?.decodedAction as { spender?: string; operator?: string } | undefined;
        if (da?.spender && /^0x[a-fA-F0-9]{40}$/.test(da.spender)) return da.spender.toLowerCase();
        if (da?.operator && /^0x[a-fA-F0-9]{40}$/.test(da.operator)) return da.operator.toLowerCase();
        const te = a?.txExtras as { spender?: string; operator?: string } | undefined;
        if (te?.spender && /^0x[a-fA-F0-9]{40}$/.test(te.spender)) return te.spender.toLowerCase();
        if (a?.typedDataExtras?.spender && /^0x[a-fA-F0-9]{40}$/.test(a.typedDataExtras.spender)) return a.typedDataExtras.spender.toLowerCase();
        return null;
      })();
      if (!(pending as { _uiGate?: boolean })._uiGate) {
        try {
          const res2 = await safeSendMessage<{ ok?: boolean; allowed?: boolean }>(
            { type: "SG_CHECK_TEMP_ALLOW", payload: { host: pending.host, spender: spenderFromAnalysis } },
            { timeoutMs: 500 }
          );
        if (res2?.ok && res2?.allowed) {
          const cur = requestQueue[0];
          if (cur && cur.requestId === requestId) {
            decideCurrentAndAdvance(true, false);
          }
          return;
        }
        } catch { /* ignore */ }
      }

      if (__sgOverlay && __sgOverlay.requestId === requestId) {
        __sgOverlay.analysis = response.analysis;
        updateOverlay(__sgOverlay);
      }
    } else if (pending.requestId === requestId && !response?.analysis) {
      const fallbackAnalysis = (() => {
        const failMode = __sgSettings?.failMode ?? "fail_open";
        return {
          level: "WARN" as const,
          score: 0,
          title: t("overlay_analysis_unavailable") || "Análise indisponível",
          reasons: [t("overlay_analysis_fallback") || "Não foi possível obter a análise agora. Você ainda pode BLOQUEAR ou CONTINUAR."],
          recommend: failMode === "fail_closed" ? ("BLOCK" as const) : ("WARN" as const),
          reasonKeys: [REASON_KEYS.FAILMODE_FALLBACK],
          _isFallback: true as const,
        } as unknown as Analysis;
      })();
      pending.analysis = fallbackAnalysis;
      if (__sgOverlay && __sgOverlay.requestId === requestId) {
        __sgOverlay.analysis = fallbackAnalysis;
        updateOverlay(__sgOverlay);
      }
    }
  } catch (e) {
    clearTimeout(watchdog);
    console.error("[SignGuard] handleSGRequest crash:", e);
    if (pending.requestId === requestId) {
      const failMode = __sgSettings?.failMode ?? "fail_open";
      const fallbackAnalysis = {
        level: "WARN" as const,
        score: 0,
        title: t("overlay_analysis_unavailable") || "Análise indisponível",
        reasons: [t("overlay_analysis_fallback") || "Não foi possível obter a análise agora. Você ainda pode BLOQUEAR ou CONTINUAR."],
        recommend: failMode === "fail_closed" ? ("BLOCK" as const) : ("WARN" as const),
        reasonKeys: [REASON_KEYS.FAILMODE_FALLBACK],
        _isFallback: true as const,
      } as unknown as Analysis;
      pending.analysis = fallbackAnalysis;
      if (__sgOverlay && __sgOverlay.requestId === requestId) {
        __sgOverlay.analysis = fallbackAnalysis;
        updateOverlay(__sgOverlay);
      }
    }
  }
});

// --- PAGE RISK: scan on init, banner when MEDIUM+
function initPageRiskScan() {
  try {
    const doc = document;
    const hostname = location.hostname || "";
    __sgPageRiskResult = runPageRiskScan(doc, hostname);
    if (__sgPageRiskResult.riskScore === "MEDIUM" || __sgPageRiskResult.riskScore === "HIGH") {
      const msg =
        __sgPageRiskResult.reasons?.length > 0
          ? __sgPageRiskResult.reasons.join(" ")
          : (t("page_risk_warning") || "Página com possível risco detectado.");
      injectPageRiskBanner(msg, doc);
    }
  } catch (e) {
    console.warn("[SignGuard] Page risk scan failed:", e);
  }
}
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initPageRiskScan);
} else {
  initPageRiskScan();
}
