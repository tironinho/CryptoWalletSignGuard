// ARQUIVO: src/content.ts
import type { AnalyzeRequest, Analysis, Settings, CheckResult } from "./shared/types";
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

// --- VISUALIZAÇÃO (UI) ---
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
  meta: { host: string; method: string; params?: any; rawShape?: string; rpcMeta?: any; chainIdHex?: string | null }
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
  if ((a as { level?: string }).level === "LOADING") {
    state.app.innerHTML = `
    <div class="sg-backdrop">
      <div class="sg-modal" style="max-width:380px;">
        <header class="sg-header"><div class="sg-brand">🛡️ SignGuard</div></header>
        <div class="sg-body">
          <p class="sg-summary-sub">${escapeHtml(t("gas_calculating") || "Analisando…")}</p>
          <p><strong>${escapeHtml(state.meta.method)}</strong></p>
        </div>
        <footer class="sg-footer">
          <button type="button" id="sg-deny" class="sg-btn sg-btn-secondary">${t("recommend_BLOCK") || "Bloquear"}</button>
          <button type="button" id="sg-allow" class="sg-btn sg-btn-primary">${t("recommend_ALLOW") || "Permitir"}</button>
        </footer>
      </div>
    </div>`;
    state.shadow.getElementById("sg-deny")?.addEventListener("click", () => decideCurrentAndAdvance(false));
    state.shadow.getElementById("sg-allow")?.addEventListener("click", () => decideCurrentAndAdvance(true));
    return;
  }

  const settings = __sgSettings ?? DEFAULT_SETTINGS;
  const openByDefault =
    !!settings.defaultExpandDetails ||
    state.meta.method === "eth_sendTransaction" ||
    state.meta.method === "eth_signTypedData_v4" ||
    state.meta.method === "eth_signTypedData_v3";
  const chainIdHex = state.meta.chainIdHex ?? null;
  const chainKey = chainIdHex ? String(chainIdHex).toLowerCase() : "";
  const chainInfo = chainIdHex ? getChainInfo(chainIdHex) : null;
  const nativeSymbol = chainInfo?.nativeSymbol ?? getNativeSymbol(chainIdHex ?? undefined);
  const chainName = chainInfo?.name ?? (chainIdHex ? (t("chain_not_recognized") || "Chain not recognized") : "—");
  const usdPerNative =
    (a.txCostPreview as { usdPerNative?: number } | undefined)?.usdPerNative ?? __sgNativeUsd[chainKey]?.usd;
  const showUsd = settings.showUsd !== false && usdPerNative != null && usdPerNative > 0;

  fetchNativeUsdAndRerender(chainIdHex);

  const cost = a.txCostPreview;
  const valueWei = cost?.valueWei ?? a.tx?.valueWei ?? "0";
  const valueEth = cost?.valueWei
    ? weiToEthFmt(BigInt(cost.valueWei))
    : (a.tx?.valueEth ?? (valueWei ? weiToEthFmt(BigInt(valueWei)) : "0"));
  const feeLikely = cost?.feeLikelyWei ? weiToEthFmt(BigInt(cost.feeLikelyWei)) : (a.tx?.maxGasFeeEth ?? "—");
  const feeMax = cost?.feeMaxWei ? weiToEthFmt(BigInt(cost.feeMaxWei)) : (a.tx?.maxGasFeeEth ?? "—");
  const totalLikely = cost?.totalLikelyWei ? weiToEthFmt(BigInt(cost.totalLikelyWei)) : (a.tx?.maxTotalEth ?? "—");
  const totalMax = cost?.totalMaxWei ? weiToEthFmt(BigInt(cost.totalMaxWei)) : (a.tx?.maxTotalEth ?? "—");
  const valueUsd = showUsd && usdPerNative ? (Number(valueWei) / 1e18) * usdPerNative : null;
  const toAddr = a.tx?.to ?? (a.decoded as { to?: string } | undefined)?.to ?? "";
  const selector = a.tx?.selector ?? "";
  const contractMethod =
    selector && a.tx?.contractNameHint
      ? `${a.tx.contractNameHint} (${selector})`
      : selector
        ? selector
        : "";

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

  const decodedRaw = a.decoded?.raw;
  const decodedStr =
    decodedRaw != null
      ? (typeof decodedRaw === "string" ? decodedRaw : JSON.stringify(decodedRaw, null, 2))
      : "";

  const action = classifyAction(state.meta.method, state.meta.params);
  const actionTitleStr = actionTitle(action);
  const summaryArr = simpleSummary(action);
  const summaryStr = Array.isArray(summaryArr) ? summaryArr.join(" ") : String(summaryArr);

  const modeLabel = (settings.mode ?? "BALANCED").toString();
  const walletName = (a.wallet as { walletName?: string } | undefined)?.walletName ?? "MetaMask";
  const host = state.meta.host ?? "";
  const pillKey = a.recommend === "BLOCK" ? "block" : a.recommend === "WARN" ? "warn" : a.recommend === "HIGH" ? "high" : "low";
  const pillText = a.recommend === "BLOCK" ? (t("severity_BLOCKED") || "BLOQUEADO") : a.recommend === "WARN" ? (t("severity_WARN") || "ATENÇÃO") : a.recommend === "HIGH" ? (t("severity_HIGH") || "ALTO") : (t("severity_LOW") || "OK");
  const statusLine = a.knownSafe ? `${t("site_label") || "Site"}: ${escapeHtml(host)} • ${t("site_status_known") || "referência conhecida"}` : "";
  const bannerLocal = verLevel === "LOCAL" ? (t("banner_local_verification") || "Atenção: verificação local (cache). Revise os detalhes abaixo antes de prosseguir.") : "";
  const bannerBasic = verLevel === "BASIC" ? (t("banner_basic_verification") || "Atenção: verificação básica. Revise cuidadosamente os detalhes antes de prosseguir.") : "";

  const suggestedDomains = [...SUGGESTED_TRUSTED_DOMAINS];
  const domainChipsHtml = suggestedDomains
    .map((d) => {
      const active = host && (d === host || host.endsWith("." + d));
      return `<span class="sg-domain-chip${active ? " sg-domain-chip-active" : ""}">${escapeHtml(d)}</span>`;
    })
    .join("");

  const feeLikelyUsd = showUsd && cost?.feeLikelyWei && usdPerNative ? ((Number(cost.feeLikelyWei) / 1e18) * usdPerNative).toFixed(2) : null;
  const valueRow = valueUsd != null ? `<div class="sg-kv-stack"><span class="sg-kv-value">${escapeHtml(valueEth)} ${nativeSymbol}</span><span class="sg-kv-sub">≈ US$ ${valueUsd.toFixed(2)}</span></div>` : `<span class="sg-kv-value">${escapeHtml(valueEth)} ${nativeSymbol}</span>`;
  const feeLikelyRow = feeLikelyUsd ? `<div class="sg-kv-stack"><span class="sg-kv-value">${escapeHtml(feeLikely)} ${nativeSymbol}</span><span class="sg-kv-sub">≈ US$ ${feeLikelyUsd}</span></div>` : `<span class="sg-kv-value">${escapeHtml(feeLikely)} ${nativeSymbol}</span>`;

  const html = `
<div class="sg-backdrop">
  <div class="sg-modal">
    <header class="sg-header">
      <div class="sg-brand"><span class="sg-brand-dot">🛡️</span> Crypto Wallet SignGuard</div>
      <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
        <span class="sg-chip">Modo: ${escapeHtml(modeLabel)}</span>
        <span class="sg-pill sg-pill-${pillKey}">${escapeHtml(pillText)}</span>
        <button type="button" class="sg-close-btn" id="sg-close" aria-label="Close">×</button>
      </div>
    </header>
    <div class="sg-body">
      <h2 class="sg-summary-title">${escapeHtml(actionTitleStr)}</h2>
      <p class="sg-summary-sub">${t("site_label") || "Site"}: ${escapeHtml(host)} • Carteira: ${escapeHtml(walletName)} • ${t("network_label") || "Rede"}: ${escapeHtml(chainName)}</p>
      ${statusLine ? `<p class="sg-summary-sub" style="color:var(--sg-success);">${statusLine}</p>` : ""}
      <p class="sg-summary-sub"><strong>Parecer:</strong> ${escapeHtml(actionTitleStr)}</p>
      ${covStr ? `<p class="sg-summary-sub">${t("coverage_label") || "Cobertura"}: ${escapeHtml(covStr)}${coverage?.limited ? " • " + (t("coverage_limited") || "cobertura limitada") : ""}</p>` : ""}
      ${bannerLocal ? `<div class="sg-banner-warn">${escapeHtml(bannerLocal)}</div>` : ""}
      ${bannerBasic ? `<div class="sg-banner-warn">${escapeHtml(bannerBasic)}</div>` : ""}

      <div class="sg-card">
        <div class="sg-card-title">${t("costs_title") || "CUSTOS E IMPACTO"}</div>
        <div class="sg-kv"><span class="sg-kv-label">${t("cost_you_send") || "Você envia"}</span>${valueRow}</div>
        <div class="sg-kv"><span class="sg-kv-label">${t("cost_fee") || "Taxa estimada (provável)"}</span>${feeLikelyRow}</div>
        <div class="sg-kv"><span class="sg-kv-label">${t("tx_max_gas_fee") || "Taxa máxima (pior caso)"}</span><span class="sg-kv-value">${escapeHtml(feeMax)} ${nativeSymbol}</span></div>
        <div class="sg-kv"><span class="sg-kv-label">${t("cost_total") || "Total provável"}</span><span class="sg-kv-value">${escapeHtml(totalLikely)} ${nativeSymbol}</span></div>
        <div class="sg-kv"><span class="sg-kv-label">${t("tx_max_total") || "Total máximo"}</span><span class="sg-kv-value">${escapeHtml(totalMax)} ${nativeSymbol}</span></div>
        ${toAddr ? `<div class="sg-kv" style="margin-top:8px;"><span class="sg-kv-label">${t("tx_destination") || "Destino"}</span><div class="sg-actions-inline"><code class="sg-mono">${escapeHtml(toAddr.slice(0, 10) + "…" + toAddr.slice(-8))}</code><button type="button" class="sg-copy" data-sg-copy="${escapeHtml(toAddr)}">${t("btn_copy") || "Copiar"}</button></div></div>` : ""}
      </div>
      ${contractMethod ? `<div class="sg-card"><div class="sg-card-title">${t("tx_contract_method") || "Contrato/método"}</div><div class="sg-actions-inline"><code class="sg-mono">${escapeHtml(contractMethod)}</code><button type="button" class="sg-copy" data-sg-copy="${escapeHtml(contractMethod)}">${t("btn_copy") || "Copiar"}</button></div></div>` : ""}

      ${checks.length ? `<div class="sg-card"><div class="sg-card-title">${t("overlay_coverage_title") || "Cobertura de segurança"}</div><div class="sg-grid" style="margin-top:8px;">${checkChips}</div></div>` : ""}
      ${sim || simRevert ? `<div class="sg-card"><div class="sg-card-title">${t("overlay_simulation_title") || "Simulação"}</div>${simRevert ? `<div class="sg-simulation-revert-banner">${escapeHtml(t("simulation_tx_will_fail") || "ESTA TRANSAÇÃO DEVE FALHAR (REVERT)")}</div>` : ""}${sim ? `<p><strong>Status:</strong> ${escapeHtml(simStatus)}</p><p><strong>${t("cost_you_send") || "Você envia"}:</strong> ${escapeHtml(simOutgoing)}</p><p><strong>Recebe:</strong> ${escapeHtml(simIncoming)}</p><p><strong>Gas usado:</strong> ${escapeHtml(simGas)}</p>${sim?.gasCostWei ? `<p>Gas cost: ${weiToEthFmt(BigInt(sim.gasCostWei))} ${nativeSymbol}</p>` : ""}${(sim as { isHighGas?: boolean }).isHighGas ? `<p class="sg-chip sg-chip-warn">${escapeHtml(t("cost_fee_unknown") || "Taxa alta")}</p>` : ""}${simStatus === "SKIPPED" && simMessage ? `<p class="sg-summary-sub">${escapeHtml(simMessage)}. ${t("simulation_skipped_caution") || "Sem simulação — valide com mais cautela."}</p>` : ""}` : ""}</div>` : ""}
      ${addrIntelLines.length ? `<div class="sg-card"><div class="sg-card-title">${t("overlay_address_intel_title") || "Intel de endereços"}</div><div class="sg-list">${addrIntelLines.map((line) => `<div class="sg-summary-sub">${line}</div>`).join("")}</div></div>` : ""}

      <details class="sg-details" ${openByDefault ? "open" : ""}>
        <summary>${t("details_tx_title") || "Detalhes da transação"}</summary>
        <div class="sg-details-body">${escapeHtml(a.reasons?.length ? a.reasons.join("\n") : "—")}</div>
      </details>
      <details class="sg-details" ${openByDefault ? "open" : ""}>
        <summary>${t("details_tech_title") || "Detalhes técnicos"}</summary>
        <div class="sg-details-body">Método: ${escapeHtml(state.meta.method)}${decodedStr ? `<pre id="sg-decoded-json" class="sg-code">${escapeHtml(decodedStr)}</pre><button type="button" class="sg-copy" data-sg-copy-target="sg-decoded-json">${t("btn_copy_json") || "Copiar JSON"}</button>` : ""}</div>
      </details>
      <details class="sg-details" ${openByDefault ? "open" : ""}>
        <summary>${t("trusted_domain_ref_title") || "Domínios confiáveis (referência)"}</summary>
        <div class="sg-details-body"><div class="sg-domain-chips">${domainChipsHtml}</div></div>
      </details>
      <details class="sg-details" ${openByDefault ? "open" : ""}>
        <summary>${t("details_more_title") || "Mais explicações"}</summary>
        <div class="sg-details-body">${escapeHtml(summaryStr)}</div>
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

// --- LISTENER DE MENSAGENS ---

window.addEventListener("message", async (ev) => {
  if (ev.source !== window || !ev.data || ev.data.source !== "signguard") return;
  if (ev.data.type !== "SG_REQUEST") return;

  const { requestId, payload } = ev.data;
  console.log("📨 [SignGuard Content] Request received:", payload?.method);

  const url = payload?.url ?? window.location.href;
  const origin = (() => {
    try { return new URL(url).origin; } catch { return window.location.origin; }
  })();

  const rpcMeta = (payload as any)?.meta ?? null;
  const chainIdHex =
    (payload as any)?.chainIdHex ||
    toChainIdHex(rpcMeta?.chainId) ||
    toChainIdHex((payload as any)?.chainId) ||
    null;

  const meta = rpcMeta
    ? { ...rpcMeta, chainIdHex: chainIdHex ?? undefined }
    : chainIdHex
      ? { chainIdHex: chainIdHex ?? undefined }
      : undefined;

  const analyzePayload: AnalyzeRequest = {
    requestId,
    url,
    origin,
    request: { method: payload?.method ?? "", params: Array.isArray(payload?.params) ? payload.params : [] },
    meta,
  };

  const pending = {
    requestId,
    method: payload?.method ?? "",
    host: payload?.host ?? "",
    params: payload?.params,
    chainIdHex: chainIdHex ?? undefined,
    analysis: { level: "LOADING", score: 0, title: "", reasons: [], recommend: "WARN" } as unknown as Analysis,
  };
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
