// ARQUIVO: src/content.ts
import type { AnalyzeRequest, Analysis, Settings, CheckResult, TxCostPreview, FeeEstimateWire } from "./shared/types";
import { DEFAULT_SETTINGS } from "./shared/types";
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
import { runPageRiskScan, injectPageRiskBanner } from "./risk/domScanner";
import { renderAdToast, dismissAdToast } from "./features/adToast";

console.log("📨 [SignGuard Content] Loaded cleanly (No manual injection).");

/** CustomEvent name for decision (synchronous → preserves user activation for MetaMask). */
const SG_DECISION_EVENT = "__sg_decision__";

/** Cache de preflight (SG_PREVIEW) por requestId — pode chegar antes do SG_REQUEST. */
const __sgPreflightCache = new Map<string, { chainIdHex?: string; txCostPreview?: TxCostPreview }>();

function sendDecisionToMainWorld(requestId: string, allow: boolean) {
  window.dispatchEvent(
    new CustomEvent(SG_DECISION_EVENT, { detail: { type: "SG_DECISION", requestId, allow } })
  );
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

// --- VISUALIZAÇÃO (UI) ---
type OverlayState = {
  requestId: string;
  analysis: Analysis;
  meta: { host: string; method: string; params?: any; rawShape?: string; rpcMeta?: any; chainIdHex?: string | null; chainIdRequested?: string };
  container: HTMLDivElement;
  shadow: ShadowRoot;
  app: HTMLDivElement;
  onKey: (e: KeyboardEvent) => void;
  countdownTimer?: number | null;
  keepaliveInterval?: number | null;
  analysisLoading?: boolean;
  /** Domínios confiáveis: expandir lista (+N Ver mais). */
  domainsExpanded?: boolean;
};

let __sgOverlay: OverlayState | null = null;

function ensureOverlayCss(shadow: ShadowRoot) {
  try {
    const href = safeGetURL("overlay.css"); // O build move isso para a raiz
    console.log("🎨 [SignGuard UI] CSS path:", href);
    if (!href) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = href;
    shadow.appendChild(link);
  } catch (e) {
    console.error("🎨 [SignGuard UI] CSS Error:", e);
  }
}

function showOverlay(
  requestId: string,
  analysis: Analysis,
  meta: { host: string; method: string; params?: any; rawShape?: string; rpcMeta?: any; chainIdHex?: string | null; chainIdRequested?: string }
) {
  console.log("🎨 [SignGuard UI] showOverlay CALLED for:", requestId);

  if (__sgOverlay) {
    console.log("🎨 [SignGuard UI] Updating existing overlay");
    __sgOverlay.requestId = requestId;
    __sgOverlay.analysis = analysis;
    __sgOverlay.meta = meta;
    updateOverlay(__sgOverlay);
    return;
  }

  try {
    const container = document.createElement("div");
    container.className = "sg-root";
    container.setAttribute("data-sg-overlay", "1");
    // Força visibilidade máxima
    container.style.cssText = "position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; z-index: 2147483647; pointer-events: none;";

    const shadow = container.attachShadow({ mode: "open" });
    ensureOverlayCss(shadow);

    const app = document.createElement("div");
    app.id = "sg-app";
    // Habilita pointer-events no conteúdo
    app.style.pointerEvents = "auto";
    shadow.appendChild(app);

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") decideCurrentAndAdvance(false);
    };
    document.addEventListener("keydown", onKey);

    __sgOverlay = { requestId, analysis, meta, container, shadow, app, onKey };

    if (document.documentElement) {
      document.documentElement.appendChild(container);
      console.log("🎨 [SignGuard UI] Appended to documentElement");
    } else {
      document.body.appendChild(container);
      console.log("🎨 [SignGuard UI] Appended to body");
    }

    updateOverlay(__sgOverlay);
  } catch (e) {
    console.error("🎨 [SignGuard UI] FATAL UI ERROR:", e);
  }
}

function updateOverlay(state: OverlayState) {
  const a = state.analysis;
  const isLoading = (a as { level?: string }).level === "LOADING";

  const settings = __sgSettings ?? DEFAULT_SETTINGS;
  const openByDefault =
    !!settings.defaultExpandDetails ||
    state.meta.method === "eth_sendTransaction" ||
    state.meta.method === "eth_signTypedData_v4" ||
    state.meta.method === "eth_signTypedData_v3";

  const displayChainIdHex =
    state.meta.chainIdHex ??
    (a as { chainIdHex?: string }).chainIdHex ??
    (a as { chainTarget?: { chainIdHex: string } }).chainTarget?.chainIdHex ??
    toChainIdHex((a as { addChainInfo?: { chainId: string } }).addChainInfo?.chainId) ??
    null;
  const priceChainIdHex = displayChainIdHex ?? "0x1";
  const chainKey = displayChainIdHex ? String(displayChainIdHex).toLowerCase() : "";
  const priceChainKey = String(priceChainIdHex).toLowerCase();

  fetchNativeUsdAndRerender(priceChainIdHex);

  const chainTarget = (a as { chainTarget?: { chainName?: string } }).chainTarget;
  const addChainInfo = (a as { addChainInfo?: { chainName?: string } }).addChainInfo;
  const displayChainName =
    chainTarget?.chainName ??
    addChainInfo?.chainName ??
    (displayChainIdHex ? (getChainInfo(displayChainIdHex)?.name ?? (t("chain_not_recognized") || "Chain not recognized")) : "—");

  const chainInfo = displayChainIdHex ? getChainInfo(displayChainIdHex) : null;
  const nativeSymbol = chainInfo?.nativeSymbol ?? getNativeSymbol(displayChainIdHex ?? undefined);
  const chainName = displayChainName;
  const usdPerNative =
    (a.txCostPreview as { usdPerNative?: number } | undefined)?.usdPerNative ?? __sgNativeUsd[priceChainKey]?.usd;
  const showUsd = !isLoading && settings.showUsd !== false && usdPerNative != null && usdPerNative > 0;

  const cost = a.txCostPreview;
  const rawTx = extractTx(state.meta.params);
  const rawValueWeiBI = rawTx?.valueHex ? hexToBigInt(rawTx.valueHex) : 0n;

  const valueWeiStr =
    (cost as any)?.valueWei ??
    (a.tx as any)?.valueWei ??
    (rawValueWeiBI ? rawValueWeiBI.toString() : "0");

  const valueWeiBI = (() => {
    try { return BigInt(valueWeiStr); } catch { return rawValueWeiBI; }
  })();

  const valueEth =
    isLoading && !(cost as any)?.valueWei
      ? "—"
      : (() => {
          const fromWei = weiToEthFmt(valueWeiBI);
          if (fromWei && fromWei !== "0" && fromWei !== "0.000000") return fromWei;
          const fromSummary = (a.tx as any)?.valueEth;
          return typeof fromSummary === "string" && fromSummary.length ? fromSummary : fromWei;
        })();

  const hasFeeData = !!(cost as any)?.feeLikelyWei || !!(cost as any)?.feeMaxWei;
  const isFeeCalculating = (cost as any)?.feeReasonKey === "fee_calculating";
  const feeFallbackText = !hasFeeData && (cost as any)?.feeReasonKey && !isFeeCalculating
    ? (t((cost as any).feeReasonKey) || (cost as any).feeReasonKey)
    : null;

  const feeLikely = isLoading && !hasFeeData && !feeFallbackText ? "—" : (cost?.feeLikelyWei ? weiToEthFmt(BigInt(cost.feeLikelyWei)) : (a.tx as { maxGasFeeEth?: string } | undefined)?.maxGasFeeEth ?? (isFeeCalculating ? "…" : feeFallbackText ?? "—"));
  const feeMax = isLoading && !hasFeeData && !feeFallbackText ? "—" : (cost?.feeMaxWei ? weiToEthFmt(BigInt(cost.feeMaxWei)) : (a.tx as { maxGasFeeEth?: string } | undefined)?.maxGasFeeEth ?? (isFeeCalculating ? "…" : feeFallbackText ?? "—"));
  const totalLikely = isLoading && !hasFeeData && !feeFallbackText ? "—" : (cost?.totalLikelyWei ? weiToEthFmt(BigInt(cost.totalLikelyWei)) : (a.tx as { maxTotalEth?: string } | undefined)?.maxTotalEth ?? (isFeeCalculating ? "…" : feeFallbackText ?? "—"));
  const totalMax = isLoading && !hasFeeData && !feeFallbackText ? "—" : (cost?.totalMaxWei ? weiToEthFmt(BigInt(cost.totalMaxWei)) : (a.tx as { maxTotalEth?: string } | undefined)?.maxTotalEth ?? (isFeeCalculating ? "…" : feeFallbackText ?? "—"));

  const valueUsd = showUsd && usdPerNative ? (Number(valueWeiStr) / 1e18) * usdPerNative : null;
  const feeLikelyUsd = showUsd && usdPerNative && (cost as any)?.feeLikelyWei ? (Number((cost as any).feeLikelyWei) / 1e18) * usdPerNative : null;
  const feeMaxUsd = showUsd && usdPerNative && (cost as any)?.feeMaxWei ? (Number((cost as any).feeMaxWei) / 1e18) * usdPerNative : null;
  const totalLikelyUsd = showUsd && usdPerNative && (cost as any)?.totalLikelyWei ? (Number((cost as any).totalLikelyWei) / 1e18) * usdPerNative : null;
  const totalMaxUsd = showUsd && usdPerNative && (cost as any)?.totalMaxWei ? (Number((cost as any).totalMaxWei) / 1e18) * usdPerNative : null;

  const rawTxObj = Array.isArray(state.meta.params) ? state.meta.params[0] : null;
  const toAddr =
    (a.tx as any)?.to ??
    (a.decoded as any)?.to ??
    (rawTx as any)?.to ??
    (rawTxObj && typeof rawTxObj === "object" ? (rawTxObj as any).to : undefined) ??
    "";
  const selector = (a.tx as { selector?: string } | undefined)?.selector ?? "";
  const contractMethod = isLoading
    ? ""
    : selector && (a.tx as { contractNameHint?: string })?.contractNameHint
      ? `${(a.tx as { contractNameHint: string }).contractNameHint} (${selector})`
      : selector || "";

  const coverage = a.coverage;
  const covStr =
    coverage != null
      ? `${coverage.performed}/${coverage.total}${coverage.limited ? " " + (t("coverage_limited") || "limited") : ""}`
      : "";
  const verLevel = a.verificationLevel ?? "";
  const intelSources = a.intelSources ?? [];
  const checks = a.checks ?? [];
  const checkChips = checks
    .map(
      (c: CheckResult) =>
        `<span class="sg-chip sg-chip-${c.status.toLowerCase()}" title="${c.noteKey ? escapeHtml(t(c.noteKey) || c.noteKey) : ""}">${escapeHtml(c.key)}: ${c.status}</span>`
    )
    .join("");

  const sim = a.simulationOutcome;
  const simRevert = a.simulationRevert === true;
  const simStatus = sim?.status ?? "—";
  const simOutgoing =
    (sim?.outgoingAssets?.length ?? 0) > 0
      ? (sim!.outgoingAssets!.map((x: { symbol: string; amount: string }) => `${x.symbol} ${x.amount}`).join(", "))
      : "—";
  const simIncoming =
    (sim?.incomingAssets?.length ?? 0) > 0
      ? (sim!.incomingAssets!.map((x: { symbol: string; amount: string }) => `${x.symbol} ${x.amount}`).join(", "))
      : "—";
  const simGas = sim?.gasUsed ?? "—";
  const simMessage = sim?.message ?? "";

  const addrIntel = a.addressIntel;
  const addrIntelLines: string[] = [];
  if (a.addressIntelHit && addrIntel) {
    if (addrIntel.to?.length) addrIntelLines.push(`to: ${addrIntel.to.map((l) => `[${escapeHtml(l)}]`).join(" ")}`);
    if (addrIntel.spender?.length) addrIntelLines.push(`spender: ${addrIntel.spender.map((l) => `[${escapeHtml(l)}]`).join(" ")}`);
    if (addrIntel.operator?.length) addrIntelLines.push(`operator: ${addrIntel.operator.map((l) => `[${escapeHtml(l)}]`).join(" ")}`);
    if (addrIntel.tokenContract?.length)
      addrIntelLines.push(`tokenContract: ${addrIntel.tokenContract.map((l) => `[${escapeHtml(l)}]`).join(" ")}`);
  }

  const decodedRaw = isLoading ? null : (a.decoded?.raw ?? null);
  const decodedStr =
    decodedRaw != null
      ? (typeof decodedRaw === "string" ? decodedRaw : JSON.stringify(decodedRaw, null, 2))
      : "";

  const action = classifyAction(state.meta.method, state.meta.params);
  const txData = (a.tx as { data?: string } | undefined)?.data;
  const isContractInteraction =
    action === "SEND_TX" &&
    Boolean(a.toIsContract === true || selector || contractMethod || (txData && txData !== "0x"));
  const actionTitleStr = (a as { title?: string }).title ||
    (isContractInteraction ? (t("action_SEND_TX_contract_title") || "Interagir com contrato") : actionTitle(action));
  const verdictText = isContractInteraction
    ? (t("intent_CONTRACT_INTERACTION") || "Interação com contrato")
    : actionTitleStr;
  const summaryArr = simpleSummary(action);
  const summaryStr = Array.isArray(summaryArr) ? summaryArr.join(" ") : String(summaryArr);

  const modeLabel = (settings.mode ?? "BALANCED").toString();
  const walletName = (a.wallet as { walletName?: string } | undefined)?.walletName ?? "MetaMask";
  const host = state.meta.host ?? "";
  const pillKey = a.recommend === "BLOCK" ? "block" : a.recommend === "WARN" ? "warn" : a.recommend === "HIGH" ? "high" : "low";
  const pillText = a.recommend === "BLOCK" ? (t("severity_BLOCKED") || "BLOQUEADO") : a.recommend === "WARN" ? (t("severity_WARN") || "ATENÇÃO") : a.recommend === "HIGH" ? (t("severity_HIGH") || "ALTO") : (t("severity_LOW") || "OK");
  const tokenConf = (a as { tokenConfidence?: "SCAM" | "TRUSTED" | "LOW" | "UNKNOWN" }).tokenConfidence;
  const tokenBadgeHtml = tokenConf === "TRUSTED" ? `<span class="sg-chip sg-banner-ok" style="display:inline-block;padding:4px 8px;margin-left:8px;">Confiável</span>` : tokenConf === "LOW" ? `<span class="sg-chip sg-banner-warn" style="display:inline-block;padding:4px 8px;margin-left:8px;">Baixa confiança</span>` : tokenConf === "SCAM" ? `<span class="sg-chip sg-banner-bad" style="display:inline-block;padding:4px 8px;margin-left:8px;">Scam</span>` : "";
  const statusLine = !isLoading && a.knownSafe ? `${t("site_label") || "Site"}: ${escapeHtml(host)} • ${t("site_status_known") || "referência conhecida"}` : "";
  const bannerLocal = verLevel === "LOCAL" ? (t("banner_local_verification") || "Atenção: verificação local (cache). Revise os detalhes abaixo antes de prosseguir.") : "";
  const bannerBasic = verLevel === "BASIC" ? (t("banner_basic_verification") || "Atenção: verificação básica. Revise cuidadosamente os detalhes antes de prosseguir.") : "";

  const isCostCalculating = (action === "SEND_TX") && (isFeeCalculating);

  const riskReasons: string[] = [];
  const human = a.human as { risks?: string[]; safeNotes?: string[]; safe?: string[]; nextSteps?: string[] } | undefined;
  if (human?.risks?.length) {
    riskReasons.push(...human.risks.slice(0, 5));
  } else if (a.reasons?.length) {
    riskReasons.push(...a.reasons.slice(0, 5));
  } else {
    if (verLevel === "LOCAL") riskReasons.push(t("banner_local_verification") || "Verificação local (cache) — revise os detalhes abaixo.");
    if (verLevel === "BASIC") riskReasons.push(t("banner_basic_verification") || "Verificação parcial — revise com cuidado.");
    if (a.knownBad || a.isPhishing) riskReasons.push(t("banner_block_known_threat") || "Ameaça conhecida detectada.");
    if ((a as { addressRisk?: { flagged?: boolean } }).addressRisk?.flagged) riskReasons.push(t("addr_marked_public") || "Endereço marcado em base pública.");
    if (action === "SWITCH_CHAIN" || action === "ADD_CHAIN") riskReasons.push("Trocar rede normalmente não transfere fundos. Confirme se a rede solicitada é a esperada.");
    if (action === "SEND_TX" || isContractInteraction) riskReasons.push("Transação on-chain: confira destino, valor e taxa antes de confirmar.");
    if (riskReasons.length === 0) riskReasons.push("Revise os detalhes na carteira antes de prosseguir.");
  }

  const safeNotesForDisplay = human?.safe ?? human?.safeNotes ?? [];
  const isVerdictSafe = (a.recommend === "ALLOW" || (a.recommend === "WARN" && a.knownSafe)) && !a.knownBad && !a.isPhishing && !(a as { maybeSpoofed?: boolean }).maybeSpoofed;

  const intent = (a as { intent?: string }).intent;
  const txCtx = (a as { txContext?: { kind?: string } }).txContext?.kind;
  const isNftPurchase = intent === "NFT_PURCHASE" || txCtx === "NFT_PURCHASE";
  const isTokenSwap = txCtx === "TOKEN_SWAP";
  const feeUnavailable = feeLikely === "—" || feeMax === "—";
  let whatToDoNowText: string;
  if (action === "SWITCH_CHAIN" || action === "ADD_CHAIN") {
    whatToDoNowText = "Trocar rede NÃO transfere fundos. Apenas muda a rede ativa na carteira. Confirme se a rede solicitada é a esperada pelo site.";
  } else if (action === "SEND_TX" && (isNftPurchase || isTokenSwap)) {
    whatToDoNowText = "Se confirmar, os valores serão transferidos e a aquisição será realizada (NFT/Token). Revise destino (to), rede, valor e taxa na carteira; se bater com o esperado, prossiga.";
  } else if (action === "SEND_TX") {
    whatToDoNowText = feeUnavailable
      ? (t("check_wallet_network_fee") || "Você ainda não viu a taxa. Verifique o 'Network fee' na carteira antes de confirmar.")
      : "Se confirmar, a transação será enviada on-chain e não pode ser desfeita. Confira destino (to), rede, valor e taxa na carteira.";
  } else {
    whatToDoNowText = (t("still_review_wallet") || "Mesmo assim, revise na carteira (valor, rede, destino e taxa).");
  }

  const suggestedDomains = [...SUGGESTED_TRUSTED_DOMAINS];
  const maxDomainsShown = 8;
  const domainsExpanded = !!state.domainsExpanded;
  const domainsShown = domainsExpanded ? suggestedDomains : suggestedDomains.slice(0, maxDomainsShown);
  const domainsRestCount = suggestedDomains.length - domainsShown.length;
  const domainChipsHtml = domainsShown
    .map((d) => {
      const active = host && (d === host || host.endsWith("." + d));
      return `<span class="sg-domain-chip${active ? " sg-domain-chip-active" : ""}">${escapeHtml(d)}</span>`;
    })
    .join("");
  const domainToggleHtml =
    !domainsExpanded && domainsRestCount > 0
      ? `<button type="button" id="sg-domains-toggle" class="sg-link sg-domain-more">+${domainsRestCount} ${t("trusted_domain_ref_view_more") || "Ver mais"}</button>`
      : domainsExpanded
        ? `<button type="button" id="sg-domains-toggle" class="sg-link sg-domain-more">${t("btn_ver_menos") || "Ver menos"}</button>`
        : "";

  const chainIdRequested =
    (state.meta as any)?.chainIdRequested ?? (state.meta as any)?.rpcMeta?.chainIdRequested;

  const tokenRiskHigh = (a as { tokenRisk?: { level?: string } }).tokenRisk?.level === "HIGH";
  const showWarnBanner = !cost?.feeEstimated || (a.simulationOutcome?.status === "SKIPPED");
  const verdictBanner = isVerdictSafe
    ? `<div class="sg-banner-ok"><strong>✅ Seguro:</strong> ação comum em domínio confiável. Revise valor e taxa na carteira antes de confirmar.</div>`
    : (pillKey === "block" || pillKey === "high" || a.knownBad || a.isPhishing || tokenRiskHigh)
      ? `<div class="sg-banner-bad"><strong>⛔ Atenção:</strong> há sinais de risco. Revise destino/contrato e valores — se algo não bater, cancele.</div>`
      : showWarnBanner
        ? `<div class="sg-banner-warn"><strong>⚠ Atenção:</strong> ${!cost?.feeEstimated ? "Taxa ainda sendo calculada. " : ""}Revise destino, valor e rede antes de confirmar.</div>`
        : "";

  const okBanner =
    pillKey === "low" && a.knownSafe
      ? `<div class="sg-banner-ok"><div class="sg-banner-ok-text">OK: ação comum neste site.</div><div class="sg-banner-ok-sub">Se destino, rede e valores baterem com o esperado, pode continuar.</div></div>`
      : "";

  const riskBanner =
    pillKey === "block" || pillKey === "high"
      ? `<div class="sg-blocked-banner sg-banner-risk">RISCO: esta ação pode permitir movimentação de fundos ou permissões perigosas. Revise com atenção.</div>`
      : "";

  const requestedChainCard =
    action === "SWITCH_CHAIN" || action === "ADD_CHAIN"
      ? `<div class="sg-card"><div class="sg-card-title">REDE SOLICITADA</div><div class="sg-kv"><span class="sg-kv-label">ChainId</span><span class="sg-kv-value">${escapeHtml(String(chainIdRequested || "—"))}</span></div><div class="sg-summary-sub" style="margin-top:8px;color:var(--sg-success);">Isso não envia fundos. Normalmente não há gas nesta etapa.</div></div>`
      : "";

  const feeLikelyRow = isFeeCalculating
    ? `<div class="sg-skeleton" style="height:16px;width:90px;"></div>`
    : feeFallbackText && !hasFeeData
      ? `<span class="sg-kv-value sg-kv-sub">${escapeHtml(feeFallbackText)}</span>`
      : feeLikelyUsd != null
        ? `<div class="sg-kv-stack"><span class="sg-kv-value">${escapeHtml(feeLikely)} ${nativeSymbol}</span><span class="sg-kv-sub">≈ US$ ${feeLikelyUsd.toFixed(2)}</span></div>`
        : `<span class="sg-kv-value">${escapeHtml(feeLikely)} ${nativeSymbol}</span>`;
  const feeMaxRow = isFeeCalculating
    ? `<div class="sg-skeleton" style="height:16px;width:90px;"></div>`
    : feeFallbackText && !hasFeeData
      ? `<span class="sg-kv-value sg-kv-sub">${escapeHtml(feeFallbackText)}</span>`
      : feeMaxUsd != null
        ? `<div class="sg-kv-stack"><span class="sg-kv-value">${escapeHtml(feeMax)} ${nativeSymbol}</span><span class="sg-kv-sub">≈ US$ ${feeMaxUsd.toFixed(2)}</span></div>`
        : `<span class="sg-kv-value">${escapeHtml(feeMax)} ${nativeSymbol}</span>`;
  const totalLikelyRow = isFeeCalculating
    ? `<div class="sg-skeleton" style="height:16px;width:90px;"></div>`
    : feeFallbackText && !hasFeeData
      ? `<span class="sg-kv-value sg-kv-sub">${escapeHtml(feeFallbackText)}</span>`
      : totalLikelyUsd != null
        ? `<div class="sg-kv-stack"><span class="sg-kv-value">${escapeHtml(totalLikely)} ${nativeSymbol}</span><span class="sg-kv-sub">≈ US$ ${totalLikelyUsd.toFixed(2)}</span></div>`
        : `<span class="sg-kv-value">${escapeHtml(totalLikely)} ${nativeSymbol}</span>`;
  const totalMaxRow = isFeeCalculating
    ? `<div class="sg-skeleton" style="height:16px;width:90px;"></div>`
    : feeFallbackText && !hasFeeData
      ? `<span class="sg-kv-value sg-kv-sub">${escapeHtml(feeFallbackText)}</span>`
      : totalMaxUsd != null
        ? `<div class="sg-kv-stack"><span class="sg-kv-value">${escapeHtml(totalMax)} ${nativeSymbol}</span><span class="sg-kv-sub">≈ US$ ${totalMaxUsd.toFixed(2)}</span></div>`
        : `<span class="sg-kv-value">${escapeHtml(totalMax)} ${nativeSymbol}</span>`;

  const costsCardHtml =
    action === "SWITCH_CHAIN" || action === "ADD_CHAIN"
      ? ""
      : `
      <div class="sg-card">
        <div class="sg-card-title">${t("costs_title") || "CUSTOS E IMPACTO"}</div>
        <div class="sg-kv"><span class="sg-kv-label">${t("cost_you_send") || "Você envia"}</span>${isLoading && !(cost as any)?.valueWei ? `<div class="sg-kv-stack"><div class="sg-skeleton" style="height:16px;width:100px;"></div><div class="sg-skeleton" style="height:12px;width:70px;margin-top:6px;"></div></div>` : valueUsd != null ? `<div class="sg-kv-stack"><span class="sg-kv-value">${escapeHtml(valueEth)} ${nativeSymbol}</span><span class="sg-kv-sub">≈ US$ ${valueUsd.toFixed(2)}</span></div>` : `<span class="sg-kv-value">${escapeHtml(valueEth)} ${nativeSymbol}</span>`}</div>
        <div class="sg-kv"><span class="sg-kv-label">${t("cost_fee") || "Taxa estimada (provável)"}</span>${feeLikelyRow}</div>
        <div class="sg-kv"><span class="sg-kv-label">${t("tx_max_gas_fee") || "Taxa máxima (pior caso)"}</span>${feeMaxRow}</div>
        <div class="sg-kv"><span class="sg-kv-label">${t("cost_total") || "Total provável"}</span>${totalLikelyRow}</div>
        <div class="sg-kv"><span class="sg-kv-label">${t("tx_max_total") || "Total máximo"}</span>${totalMaxRow}</div>
        ${toAddr ? `<div class="sg-kv" style="margin-top:8px;"><span class="sg-kv-label">${t("tx_destination") || "Destino"}</span><div class="sg-actions-inline"><code class="sg-mono">${escapeHtml(toAddr.slice(0, 10) + "…" + toAddr.slice(-8))}</code><button type="button" class="sg-copy" data-sg-copy="${escapeHtml(toAddr)}">${t("btn_copy") || "Copiar"}</button></div></div>` : ""}
      </div>`;

  const txDetailsLines: string[] = [];
  txDetailsLines.push(`Tipo: ${action}`);
  if (displayChainIdHex) txDetailsLines.push(`Rede atual: ${chainName} (${displayChainIdHex})`);
  if (action === "SWITCH_CHAIN" || action === "ADD_CHAIN") {
    if (chainIdRequested) txDetailsLines.push(`Rede solicitada: ${chainIdRequested}`);
    txDetailsLines.push("O que isso faz: apenas muda a rede da carteira. Não envia fundos.");
    txDetailsLines.push("Custo: normalmente sem gas. A próxima transação pode ter taxa de rede.");
  } else if (action === "SEND_TX" || isContractInteraction) {
    const dec = a.decodedAction as { kind?: string } | undefined;
    const isApproval = dec?.kind === "APPROVE_ERC20" || dec?.kind === "SET_APPROVAL_FOR_ALL";
    if (action === "SEND_TX" || isContractInteraction || isApproval) {
      if (toAddr) txDetailsLines.push(`Destino (to): ${toAddr}`);
      txDetailsLines.push(`Você envia: ${valueEth} ${nativeSymbol}${valueUsd != null ? ` (≈ US$ ${valueUsd.toFixed(2)})` : ""}`);
      if ((cost as any)?.feeLikelyWei) txDetailsLines.push(`Taxa provável: ${feeLikely} ${nativeSymbol}${feeLikelyUsd != null ? ` (≈ US$ ${feeLikelyUsd.toFixed(2)})` : ""}`);
      if ((cost as any)?.totalLikelyWei) txDetailsLines.push(`Total provável: ${totalLikely} ${nativeSymbol}${totalLikelyUsd != null ? ` (≈ US$ ${totalLikelyUsd.toFixed(2)})` : ""}`);
    }
  }
  const txDetailsBodyHtml =
    txDetailsLines.length ? txDetailsLines.map((l) => escapeHtml(l)).join("<br/>") : "—";

  const moreExplainLines = (() => {
    if (action === "SWITCH_CHAIN" || action === "ADD_CHAIN")
      return [
        "O que isso faz:",
        "• Troca a rede da carteira para o site funcionar corretamente.",
        "Riscos:",
        "• Normalmente baixo risco (não move fundos).",
        "Próximos passos:",
        "• Confirme se a rede solicitada faz sentido para este site.",
      ];
    const dec = a.decodedAction as { kind?: string } | undefined;
    if (action === "SEND_TX" || isContractInteraction) {
      if (dec?.kind === "APPROVE_ERC20" || dec?.kind === "SET_APPROVAL_FOR_ALL")
        return [
          "O que isso faz:",
          "• Concede permissão para um contrato gastar seus tokens/NFTs.",
          "Riscos:",
          "• Pode permitir drenagem se o spender for malicioso.",
          "Próximos passos:",
          "• Só aprove se reconhecer o contrato/spender e o site for confiável.",
        ];
      return [
        "O que isso faz:",
        "• Envia uma transação on-chain (pode mover ETH/tokens via contrato).",
        "Riscos:",
        "• Se o destino (to) ou valor estiverem diferentes do esperado, cancele.",
        "Próximos passos:",
        "• Confira destino (to), rede, valor e a taxa (Network fee) na carteira antes de confirmar.",
      ];
    }
    return summaryArr;
  })();
  const moreExplainHtml = escapeHtml(moreExplainLines.join("\n")).replaceAll("\n", "<br/>");

  const html = `
<div class="sg-backdrop">
  <div class="sg-modal">
    <header class="sg-header">
      <div class="sg-brand"><span class="sg-brand-dot">🛡️</span> Crypto Wallet SignGuard</div>
      <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
        <span class="sg-chip">Modo: ${escapeHtml(modeLabel)}</span>
        <span class="sg-pill sg-pill-${pillKey}">${escapeHtml(pillText)}</span>
        ${tokenBadgeHtml}
        <button type="button" class="sg-close-btn" id="sg-close" aria-label="Close">×</button>
      </div>
    </header>
    <div class="sg-body">
      ${isCostCalculating ? `<p class="sg-summary-sub" style="margin-bottom:12px;">${escapeHtml(t("gas_calculating") || "calculando…")}</p>` : ""}
      <h2 class="sg-summary-title">${escapeHtml(actionTitleStr)}</h2>
      <p class="sg-summary-sub">${t("site_label") || "Site"}: ${escapeHtml(host)} • Carteira: ${escapeHtml(walletName)} • ${t("network_label") || "Rede"}: ${escapeHtml(chainName)}</p>
      ${statusLine ? `<p class="sg-summary-sub" style="color:var(--sg-success);">${statusLine}</p>` : ""}
      ${verdictBanner}
      ${(isNftPurchase || isTokenSwap) ? `<div class="sg-summary-sub" style="margin-top:8px;color:var(--sg-muted);">Se confirmar, os valores serão transferidos e a aquisição será realizada (NFT/Token).</div>` : ""}
      ${!verdictBanner ? riskBanner : ""}
      ${okBanner}
      <p class="sg-summary-sub"><strong>Parecer:</strong> ${escapeHtml(verdictText)}</p>
      ${!isLoading && covStr ? `<p class="sg-summary-sub">${t("coverage_label") || "Cobertura"}: ${escapeHtml(covStr)}${coverage?.limited ? " • " + (t("coverage_limited") || "cobertura limitada") : ""}</p>` : ""}
      ${bannerLocal ? `<div class="sg-banner-warn">${escapeHtml(bannerLocal)}</div>` : ""}
      ${bannerBasic ? `<div class="sg-banner-warn">${escapeHtml(bannerBasic)}</div>` : ""}
      ${requestedChainCard}
      ${costsCardHtml}
      ${contractMethod ? `<div class="sg-card"><div class="sg-card-title">${t("tx_contract_method") || "Contrato/método"}</div><div class="sg-actions-inline"><code class="sg-mono">${escapeHtml(contractMethod)}</code><button type="button" class="sg-copy" data-sg-copy="${escapeHtml(contractMethod)}">${t("btn_copy") || "Copiar"}</button></div></div>` : ""}
      <div class="sg-card">
        <div class="sg-card-title">${t("risk_title") || "RISCO E POR QUÊ"}</div>
        <div class="sg-details-body">${riskReasons.length ? riskReasons.map((r) => `<p class="${!isVerdictSafe ? "sg-text-risk" : ""}">• ${escapeHtml(r)}</p>`).join("") : "—"}${safeNotesForDisplay.length && isVerdictSafe ? safeNotesForDisplay.map((n) => `<p class="sg-text-ok">• ${escapeHtml(n)}</p>`).join("") : ""}</div>
      </div>
      <div class="sg-card">
        <div class="sg-card-title">${t("what_to_do_now") || "O QUE FAZER AGORA"}</div>
        <div class="sg-details-body"><p>${escapeHtml(whatToDoNowText)}</p>${human?.nextSteps?.length ? human.nextSteps.map((s) => `<p>• ${escapeHtml(s)}</p>`).join("") : ""}</div>
      </div>

      ${checks.length ? `<div class="sg-card"><div class="sg-card-title">${t("overlay_coverage_title") || "Cobertura de segurança"}</div><div class="sg-grid" style="margin-top:8px;">${checkChips}</div></div>` : ""}
      ${sim || simRevert ? `<div class="sg-card"><div class="sg-card-title">${t("overlay_simulation_title") || "Simulação"}</div>${simRevert ? `<div class="sg-simulation-revert-banner">${escapeHtml(t("simulation_tx_will_fail") || "ESTA TRANSAÇÃO DEVE FALHAR (REVERT)")}</div>` : ""}${sim ? `<p><strong>Status:</strong> ${escapeHtml(simStatus)}</p><p><strong>${t("cost_you_send") || "Você envia"}:</strong> ${escapeHtml(simOutgoing)}</p><p><strong>Recebe:</strong> ${escapeHtml(simIncoming)}</p><p><strong>Gas usado:</strong> ${escapeHtml(simGas)}</p>${sim?.gasCostWei ? `<p>Gas cost: ${weiToEthFmt(BigInt(sim.gasCostWei))} ${nativeSymbol}</p>` : ""}${(sim as { isHighGas?: boolean }).isHighGas ? `<p class="sg-chip sg-chip-warn">${escapeHtml(t("cost_fee_unknown") || "Taxa alta")}</p>` : ""}${simStatus === "SKIPPED" && simMessage ? `<p class="sg-summary-sub">${escapeHtml(simMessage)}. ${t("simulation_skipped_caution") || "Sem simulação — valide com mais cautela."}</p>` : ""}` : ""}</div>` : ""}
      ${addrIntelLines.length ? `<div class="sg-card"><div class="sg-card-title">${t("overlay_address_intel_title") || "Intel de endereços"}</div><div class="sg-list">${addrIntelLines.map((line) => `<div class="sg-summary-sub">${line}</div>`).join("")}</div></div>` : ""}

      <details class="sg-details" ${openByDefault ? "open" : ""}>
        <summary>${t("details_tx_title") || "Detalhes da transação"}</summary>
        <div class="sg-details-body">${txDetailsBodyHtml}</div>
      </details>
      <details class="sg-details" ${openByDefault ? "open" : ""}>
        <summary>${t("details_tech_title") || "Detalhes técnicos"}</summary>
        <div class="sg-details-body">Método: ${escapeHtml(state.meta.method)}${decodedStr ? `<pre id="sg-decoded-json" class="sg-code">${escapeHtml(decodedStr)}</pre><button type="button" class="sg-copy" data-sg-copy-target="sg-decoded-json">${t("btn_copy_json") || "Copiar JSON"}</button>` : ""}</div>
      </details>
      <details class="sg-details" ${openByDefault ? "open" : ""}>
        <summary>${t("trusted_domain_ref_title") || "Domínios confiáveis (referência)"}</summary>
        <div class="sg-details-body"><div class="sg-domain-chips">${domainChipsHtml}</div>${domainToggleHtml}</div>
      </details>
      <details class="sg-details" ${openByDefault ? "open" : ""}>
        <summary>${t("details_more_title") || "Mais explicações"}</summary>
        <div class="sg-details-body">${moreExplainHtml}</div>
      </details>
    </div>
    <footer class="sg-footer">
      <button type="button" id="sg-deny" class="sg-btn sg-btn-secondary">${t("btn_cancel") || "Cancelar"}</button>
      <button type="button" id="sg-allow" class="sg-btn sg-btn-primary">${t("btn_continue") || "Continuar"}</button>
    </footer>
  </div>
</div>
`;
  state.app.innerHTML = html;

  const closeBtn = state.shadow.getElementById("sg-close");
  if (closeBtn) closeBtn.addEventListener("click", () => decideCurrentAndAdvance(false));
  const denyBtn = state.shadow.getElementById("sg-deny");
  const allowBtn = state.shadow.getElementById("sg-allow");
  if (denyBtn) denyBtn.addEventListener("click", () => decideCurrentAndAdvance(false));
  if (allowBtn) allowBtn.addEventListener("click", () => decideCurrentAndAdvance(true));

  state.shadow.querySelectorAll("[data-sg-copy]").forEach((el) => {
    el.addEventListener("click", () => {
      const v = (el as HTMLElement).getAttribute("data-sg-copy");
      if (v) tryCopy(v);
    });
  });
  state.shadow.querySelectorAll("[data-sg-copy-target]").forEach((el) => {
    el.addEventListener("click", () => {
      const id = (el as HTMLElement).getAttribute("data-sg-copy-target");
      const pre = id ? state.shadow.getElementById(id) : null;
      if (pre?.textContent) tryCopy(pre.textContent);
    });
  });
  const domainsToggle = state.shadow.getElementById("sg-domains-toggle");
  if (domainsToggle) {
    domainsToggle.addEventListener("click", () => {
      state.domainsExpanded = !state.domainsExpanded;
      updateOverlay(state);
    });
  }
}

function cleanupOverlay() {
  if (__sgOverlay) {
    try { __sgOverlay.container.remove(); } catch {}
    try { document.removeEventListener("keydown", __sgOverlay.onKey); } catch {}
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
  analysis: Analysis | { level: string };
}> = [];

function showCurrentPending() {
  const cur = requestQueue[0];
  if (cur) {
    showOverlay(cur.requestId, cur.analysis as Analysis, {
      host: cur.host,
      method: cur.method,
      params: cur.params,
      chainIdHex: cur.chainIdHex ?? null,
      chainIdRequested: (cur as { chainIdRequested?: string }).chainIdRequested,
    });
  }
}

function decideCurrentAndAdvance(allow: boolean) {
  const cur = requestQueue[0];
  if (!cur) return;

  console.log(`📨 [SignGuard Content] User decided: ${allow ? "ALLOW" : "BLOCK"}`);

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

  sendDecisionToMainWorld(cur.requestId, allow);

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
  if (ev.source !== window || !ev.data || ev.data.source !== "signguard") return;

  const { requestId, payload, type } = ev.data;

  if (type === "SG_PREVIEW") {
    const chainIdHex = payload?.chainIdHex;
    const txCostPreview = payload?.txCostPreview;

    __sgPreflightCache.set(requestId, { chainIdHex, txCostPreview });
    console.log("📨 [SignGuard Content] SG_PREVIEW received");

    const cur = requestQueue.find((r) => r.requestId === requestId);
    if (cur) {
      if (chainIdHex) cur.chainIdHex = chainIdHex;
      if (txCostPreview) (cur.analysis as any).txCostPreview = txCostPreview;

      if (requestQueue[0]?.requestId === requestId) showCurrentPending();
    }
    return;
  }

  if (type !== "SG_REQUEST") return;

  console.log("📨 [SignGuard Content] Request received:", payload?.method);

  const url = payload?.url ?? window.location.href;
  const origin = (() => {
    try { return new URL(url).origin; } catch { return window.location.origin; }
  })();

  const rpcMeta = (payload as any)?.meta ?? null;
  const method = (payload?.method ?? "").toLowerCase();
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

  const analyzePayload: AnalyzeRequest = {
    requestId,
    url,
    origin,
    request: { method: payload?.method ?? "", params: Array.isArray(payload?.params) ? payload.params : [] },
    meta: mergedMeta,
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
  };
  if (txCostPreviewMerged) (pending.analysis as any).txCostPreview = txCostPreviewMerged;
  requestQueue.push(pending);

  if (requestQueue.length === 1) {
    loadSettings().then(() => showCurrentPending());
  }

  try {
    const response = await safeSendMessage<{ ok?: boolean; analysis?: Analysis }>({
      type: "ANALYZE",
      payload: analyzePayload,
    });

    if (pending.requestId === requestId && response?.analysis) {
      pending.analysis = response.analysis;

      // --- AUTO-APROVAÇÃO DESABILITADA (PARA TESTE) ---
      // if (response.analysis.recommend === "ALLOW") {
      //   decideCurrentAndAdvance(true);
      //   return;
      // }
      // ------------------------------------------------

      if (__sgOverlay && __sgOverlay.requestId === requestId) {
        __sgOverlay.analysis = response.analysis;
        updateOverlay(__sgOverlay);
      }
    }
  } catch (e) {
    console.error("[SignGuard] handleSGRequest crash:", e);
    console.error("[SignGuard] Background comms failed", e);
  }
});
