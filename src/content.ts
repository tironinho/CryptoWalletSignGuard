import type { AnalyzeRequest, Analysis } from "./shared/types";
import { t } from "./i18n";
import { clamp, escapeHtml } from "./shared/utils";
import { normMethod } from "./shared/normalize";
import { classifyAction, type SGAction } from "./shared/classifyAction";
import { actionTitle, simpleSummary } from "./shared/actionTexts";
import { extractTx } from "./shared/txExtract";
import { ingestRpc, hasRecentSwitch, newFlowState, type FlowState } from "./shared/flowTracker";
import { hexToBigInt, weiToEthString } from "./shared/txMath";

(function injectMainWorld() {
  try {
    const id = "sg-mainworld-injected";
    if (document.getElementById(id)) return;

    const s = document.createElement("script");
    s.id = id;
    s.src = chrome.runtime.getURL("mainWorld.js");
    s.type = "text/javascript";
    (document.documentElement || document.head).appendChild(s);
    s.onload = () => { try { s.remove(); } catch {} };
  } catch {}
})();

type SGResult<T> = { ok: true; data: T } | { ok: false; error: string };

function isContextInvalidated(msg: string) {
  const s = (msg || "").toLowerCase();
  return s.includes("extension context invalidated") ||
         s.includes("context invalidated") ||
         s.includes("the message port closed") ||
         s.includes("runtime.lastError") ||
         s.includes("receiving end does not exist") ||
         s.includes("message port closed");
}

function canUseRuntime() {
  return typeof chrome !== "undefined" && !!chrome.runtime && typeof chrome.runtime.sendMessage === "function";
}

async function safeSendMessage(msg:any): Promise<{ok:true;data:any}|{ok:false;error:string}> {
  return new Promise((resolve) => {
    try {
      if (!canUseRuntime()) return resolve({ ok:false, error:"runtime_unavailable" });
      chrome.runtime.sendMessage(msg, (resp) => {
        const err = chrome.runtime.lastError;
        if (err) return resolve({ ok:false, error: err.message || String(err) });
        resolve({ ok:true, data: resp });
      });
    } catch (e:any) {
      resolve({ ok:false, error: e?.message ? String(e.message) : String(e) });
    }
  });
}

function safeStorageGet<T = any>(keys: any): Promise<SGResult<T>> {
  return new Promise((resolve) => {
    try {
      if (!chrome?.storage?.sync) return resolve({ ok: false, error: "storage_unavailable" });
      chrome.storage.sync.get(keys, (items) => {
        const err = chrome.runtime?.lastError;
        if (err) return resolve({ ok: false, error: err.message || String(err) });
        resolve({ ok: true, data: items as T });
      });
    } catch (e: any) {
      resolve({ ok: false, error: e?.message ? String(e.message) : String(e) });
    }
  });
}

function safeStorageSet(obj: any): Promise<SGResult<true>> {
  return new Promise((resolve) => {
    try {
      if (!chrome?.storage?.sync) return resolve({ ok: false, error: "storage_unavailable" });
      chrome.storage.sync.set(obj, () => {
        const err = chrome.runtime?.lastError;
        if (err) return resolve({ ok: false, error: err.message || String(err) });
        resolve({ ok: true, data: true });
      });
    } catch (e: any) {
      resolve({ ok: false, error: e?.message ? String(e.message) : String(e) });
    }
  });
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
    providerHint: "metamask" | "coinbase" | "unknown";
    meta?: any;
  };
};

type DecisionDetail = { requestId: string; allow: boolean };

function dispatchDecision(requestId: string, allow: boolean) {
  try {
    const detail: DecisionDetail = { requestId, allow };
    // SÍNCRONO (preserva gesto do clique)
    window.dispatchEvent(new CustomEvent("signguard:decision", { detail }));
    // Fallback assíncrono
    window.postMessage({ source:"signguard-content", type:"SG_DECISION", requestId, allow }, "*");
  } catch {}
}

function riskDotClass(level: string) {
  if (level === "HIGH") return "high";
  if (level === "WARN") return "warn";
  return "";
}

function riskLabel(level: Analysis["level"]) {
  if (level === "HIGH") return t("risk_HIGH");
  if (level === "WARN") return t("risk_WARN");
  return t("risk_LOW");
}

function recommendLabel(r: Analysis["recommend"]) {
  if (r === "BLOCK") return t("recommend_BLOCK");
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

function shortenHex(s: string | undefined) {
  if (!s || typeof s !== "string") return "";
  if (s.length <= 12) return s;
  return `${s.slice(0, 6)}…${s.slice(-4)}`;
}

function fmtUsd(n: number) {
  try {
    return n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 2 });
  } catch {
    return `$${n.toFixed(2)}`;
  }
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
    };

let __sgFlow: FlowState = newFlowState();

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
  } catch {}
}

// NOTE: intentionally no chrome.* Promise usage in this file.

function ensureOverlayCss(shadow: ShadowRoot) {
  try {
    const href = chrome.runtime.getURL("overlay.css");
    const existing = shadow.querySelector(`link[rel="stylesheet"][href="${href}"]`);
    if (existing) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = href;
    shadow.appendChild(link);
  } catch {}
}

type OverlayState = {
  requestId: string;
  analysis: Analysis;
  meta: { host: string; method: string; params?: any; rawShape?: string; rpcMeta?: any };
  container: HTMLDivElement;
  shadow: ShadowRoot;
  app: HTMLDivElement;
  onKey: (e: KeyboardEvent) => void;
};

let __sgOverlay: OverlayState | null = null;

function renderOverlay(state: OverlayState) {
  const { analysis, meta } = state;
  const host = meta.host;
  const method = meta.method;
  const methodNorm = normMethod(method);

  const stepTx = lastSendTxStep();
  const hasTxInFlow = !!stepTx;
  const baseAction: SGAction = classifyAction(method, meta.params);
  const displayAction: SGAction = baseAction;

  const tx = displayAction === "SEND_TX"
    ? extractTx(stepTx?.tx ? [stepTx.tx] : meta.params)
    : null;

  const riskText = `${riskLabel(analysis.level)} • ${clamp(analysis.score, 0, 100)}/100`;
  const dotCls = riskDotClass(analysis.level);

  const trust = analysis.trust;
  const trustText = `${trustLabel(trust?.verdict)} • ${clamp(trust?.trustScore ?? 0, 0, 100)}/100`;
  const trustReasons = (trust?.reasons || []).slice(0, 2);

  const human = analysis.human;

  const summaryBullets =
    displayAction === "SWITCH_CHAIN" && !hasTxInFlow
      ? [
          "A troca de rede normalmente NÃO custa gas.",
          "A próxima etapa (compra/transação) terá taxa de rede."
        ]
      : simpleSummary(displayAction).slice(0, 6);

  const recommendedText =
    displayAction === "SEND_TX"
      ? "Confirme na carteira apenas se os detalhes (valor, rede e contrato) estiverem corretos."
      : (human?.recommendation || "");

  const techReasons = (analysis.reasons || []).slice(0, 6);
  const techReasonsMore = Math.max(0, (analysis.reasons || []).length - techReasons.length);

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

  const suggested = (analysis.suggestedTrustedDomains || []).slice(0, 10);

  const moreWhat = (human?.whatItDoes || []).slice(0, 4);
  const moreRisks = (human?.risks || []).slice(0, 4);
  const moreSafe = (human?.safeNotes || []).slice(0, 3);
  const moreNext = (human?.nextSteps || []).slice(0, 4);

  const valueEth = stepTx?.valueEth || (displayAction === "SEND_TX" ? "0" : "");
  const gasEth = stepTx?.gasEth;
  const totalEth = stepTx?.totalEth;
  const valueProvided = (() => {
    try { return !!(stepTx?.tx && typeof stepTx.tx.value === "string" && stepTx.tx.value.length > 0); } catch { return false; }
  })();

  state.app.innerHTML = `
    <div class="sg-backdrop">
      <div class="sg-modal">
        <div class="sg-header">
          <div class="sg-brand">
            <span style="display:inline-flex; align-items:center; gap:8px;">
              <span style="width:10px; height:10px; border-radius:999px; background:#f97316;"></span>
              <span>SignGuard</span>
            </span>
            <span class="sg-pill">${escapeHtml(t("mvpPill"))}</span>
          </div>
          <div class="sg-risk">
            <span class="sg-dot ${dotCls}"></span>
            <span>${escapeHtml(riskText)}</span>
          </div>
        </div>

        <div class="sg-body">
          <div class="sg-grid">
            <div class="sg-kv">
              <div class="sg-k">${escapeHtml("O que está sendo solicitado")}</div>
              <div class="sg-v">
                <div style="font-weight:800">${escapeHtml(displayAction === "SEND_TX" ? "Enviar transação" : actionTitle(displayAction))}</div>
                <div class="sg-sub">${escapeHtml(human?.methodShort || methodNorm)}</div>
              </div>
            </div>

            <div class="sg-kv">
              <div class="sg-k">${escapeHtml("Site confiável?")}</div>
              <div class="sg-v">
                <span style="display:inline-flex; align-items:center; gap:8px;">
                  <span class="sg-dot ${trustDotClass(trust?.verdict)}"></span>
                  <span>${escapeHtml(trustText)}</span>
                </span>
                ${
                  trustReasons.length
                    ? `<div class="sg-sub" style="margin-top:8px">${trustReasons
                        .map((r) => `• ${escapeHtml(r)}`)
                        .join("<br/>")}</div>`
                    : ""
                }
              </div>
            </div>
          </div>

          ${
            displayAction === "SEND_TX"
              ? `<div class="sg-kv">
                  <div class="sg-k">${escapeHtml(t("cost_summary_title"))}</div>
                  <div class="sg-v">
                    <div style="margin-top:2px"><b>${escapeHtml("Você envia")}</b>: <code>${escapeHtml(`${valueEth} ETH${valueProvided ? "" : " (apenas taxa)"}`)}</code></div>
                    <div style="margin-top:6px"><b>${escapeHtml(t("cost_fee"))}</b>: <code>${escapeHtml(gasEth ? `${gasEth} ETH` : t("gas_calculating"))}</code> <span class="sg-sub" id="sg-usd-gas" style="margin-left:6px"></span></div>
                    <div style="margin-top:6px"><b>${escapeHtml(t("cost_total"))}</b>: <code>${escapeHtml(totalEth ? `${totalEth} ETH` : t("gas_calculating"))}</code> <span class="sg-sub" id="sg-usd-total" style="margin-left:6px"></span></div>
                  </div>
                </div>`
              : (displayAction === "SWITCH_CHAIN" && !hasTxInFlow && hasRecentSwitch(__sgFlow))
                ? `<div class="sg-kv">
                    <div class="sg-k">${escapeHtml("Observação")}</div>
                    <div class="sg-v">
                      <div class="sg-sub">A troca de rede normalmente <b>NÃO</b> custa gas. Porém a próxima etapa (compra/transação) terá taxa de rede.</div>
                    </div>
                  </div>`
                : ""
          }

          ${
            tx?.to || typeof tx?.dataLen === "number"
              ? `<details class="sg-details">
                  <summary>Detalhes da transação</summary>
                  <div class="sg-sub">
                    ${tx?.to ? `<div><b>To</b>: <code>${escapeHtml(shortenHex(tx.to))}</code></div>` : ""}
                    ${typeof tx?.dataLen === "number" ? `<div style="margin-top:6px"><b>Data length</b>: <code>${escapeHtml(String(tx.dataLen))}</code></div>` : ""}
                  </div>
                </details>`
              : ""
          }

          <div class="sg-kv">
            <div class="sg-k">${escapeHtml("Resumo (linguagem simples)")}</div>
            <div class="sg-v">
              <div class="sg-sub">${summaryBullets.map((x) => `• ${escapeHtml(x)}`).join("<br/>")}</div>
            </div>
          </div>

          <div class="sg-kv">
            <div class="sg-k">${escapeHtml("Ação recomendada")}</div>
            <div class="sg-v">
              <div class="sg-sub">${escapeHtml(recommendedText)}</div>
            </div>
          </div>

          <details id="sgDetailsTech" class="sg-details">
            <summary>Detalhes técnicos</summary>
            <div class="sg-sub">
              <div><b>displayAction</b>: <code>${escapeHtml(displayAction)}</code></div>
              <div><b>method raw</b>: <code>${escapeHtml(method)}</code>${meta.rawShape ? ` <span style="opacity:.9">(${escapeHtml(meta.rawShape)})</span>` : ""}</div>
              <div style="margin-top:6px"><b>recommend/score/level</b>: ${escapeHtml(recommendLabel(analysis.recommend))} • ${escapeHtml(String(analysis.score))}/100 • ${escapeHtml(riskLabel(analysis.level))}</div>
              <div style="margin-top:8px"><b>reasons</b>:<br/>${techReasons.map((r) => `• ${escapeHtml(r)}`).join("<br/>")}${techReasonsMore ? `<br/>… (+${techReasonsMore})` : ""}</div>
              ${
                decodedStr
                  ? `<div style="margin-top:10px"><b>decoded</b>:<pre class="sg-pre">${escapeHtml(decodedStr)}</pre></div>`
                  : ""
              }
            </div>
          </details>

          <details id="sgDetailsTrusted" class="sg-details">
            <summary>Domínios confiáveis (referência)</summary>
            <div class="sg-sub">
              <div class="sg-domain-cols">
                ${suggested
                  .map((d) => `<div class="sg-domain-item ${(host === d || host.endsWith("." + d)) ? "current" : ""}">${escapeHtml(d)}</div>`)
                  .join("")}
              </div>
            </div>
          </details>

          <details id="sgDetailsMore" class="sg-details">
            <summary>Mais explicações</summary>
            <div class="sg-sub">
              ${
                moreWhat.length
                  ? `<div style="font-weight:800; margin-top:6px">whatItDoes</div>
                     <div class="sg-sub">${moreWhat.map((x) => `• ${escapeHtml(x)}`).join("<br/>")}</div>`
                  : ""
              }
              ${
                moreRisks.length
                  ? `<div style="font-weight:800; margin-top:10px">risks</div>
                     <div class="sg-sub">${moreRisks.map((x) => `• ${escapeHtml(x)}`).join("<br/>")}</div>`
                  : ""
              }
              ${
                moreSafe.length
                  ? `<div style="font-weight:800; margin-top:10px">safeNotes</div>
                     <div class="sg-sub">${moreSafe.map((x) => `• ${escapeHtml(x)}`).join("<br/>")}</div>`
                  : ""
              }
              ${
                moreNext.length
                  ? `<div style="font-weight:800; margin-top:10px">nextSteps</div>
                     <div class="sg-sub">${moreNext.map((x) => `• ${escapeHtml(x)}`).join("<br/>")}</div>`
                  : ""
              }
            </div>
          </details>
        </div>

        <div class="sg-footer">
          <button class="sg-btn sg-btn-secondary" id="sg-cancel">${escapeHtml(t("btn_cancel"))}</button>
          <button class="sg-btn sg-btn-primary" id="sg-continue">${escapeHtml(t("btn_continue"))}</button>
        </div>
      </div>
    </div>
  `;

  // Bind buttons (requestId may change on update)
  const continueBtn = state.shadow.getElementById("sg-continue") as HTMLElement | null;
  const cancelBtn = state.shadow.getElementById("sg-cancel") as HTMLElement | null;

  continueBtn && (continueBtn.onclick = () => {
    cleanupOverlay();
    dispatchDecision(state.requestId, true);
  });
  cancelBtn && (cancelBtn.onclick = () => {
    cleanupOverlay();
    dispatchDecision(state.requestId, false);
  });

  // Optional USD display (best-effort, hides if price unavailable)
  if (displayAction === "SEND_TX" && gasEth && totalEth) {
    void (async () => {
      const r = await safeSendMessage({ type: "GET_ETH_USD" });
      if (!r.ok) return;
      const usdPerEth = Number((r.data as any)?.usdPerEth);
      if (!Number.isFinite(usdPerEth) || usdPerEth <= 0) return;
      const gasUsd = parseFloat(gasEth) * usdPerEth;
      const totalUsd = parseFloat(totalEth) * usdPerEth;
      if (!Number.isFinite(gasUsd) || !Number.isFinite(totalUsd)) return;
      try {
        const gasEl = state.shadow.getElementById("sg-usd-gas");
        const totalEl = state.shadow.getElementById("sg-usd-total");
        gasEl && (gasEl.textContent = `(~${fmtUsd(gasUsd)})`);
        totalEl && (totalEl.textContent = `(~${fmtUsd(totalUsd)})`);
      } catch {}
    })();
  }
}

function cleanupOverlay() {
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
  // If an overlay is already open, update it in place (no close/reopen).
  if (__sgOverlay) {
    // Avoid being stuck on a previous pending request
    if (__sgOverlay.requestId && __sgOverlay.requestId !== requestId) {
      dispatchDecision(__sgOverlay.requestId, true);
    }
    __sgOverlay.requestId = requestId;
    __sgOverlay.analysis = analysis;
    __sgOverlay.meta = meta;
    updateOverlay(__sgOverlay);
    return;
  }

  const container = document.createElement("div");
  container.className = "sg-root";
  const shadow = container.attachShadow({ mode: "open" });
  ensureOverlayCss(shadow);
  const app = document.createElement("div");
  app.id = "sg-app";
  shadow.appendChild(app);

  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      cleanupOverlay();
      dispatchDecision(requestId, false);
    }
  };
  document.addEventListener("keydown", onKey);

  __sgOverlay = { requestId, analysis, meta, container, shadow, app, onKey };
  document.documentElement.appendChild(container);
  updateOverlay(__sgOverlay);
}

let __sgPinged = false;

async function handleSGRequest(ev: MessageEvent) {
  try {
    // ... validação do ev.data ...
    if (ev.source !== window) return;
    const data = ev.data as MainWorldRequestMsg;
    if (!data || data.source !== "signguard" || data.type !== "SG_REQUEST") return;

    const requestId = String(data.requestId || "");
    const url = String(data.payload?.url || "");
    const method = String(data.payload?.method || "");
    const params = Array.isArray(data.payload?.params) ? data.payload.params : undefined;
    const rpcMeta = (data.payload as any)?.meta ?? null;

    const host = (() => { try { return new URL(url).hostname.toLowerCase(); } catch { return String(data.payload?.host || ""); } })();
    const origin = (() => { try { return new URL(url).origin; } catch { return ""; } })();

    const payload: AnalyzeRequest = {
      requestId,
      url,
      origin,
      request: { method, params }
    };

    // Optional sanity ping (do it once per session)
    if (!__sgPinged) {
      __sgPinged = true;
      const p = await safeSendMessage({ type: "PING" });
      if (!p.ok) {
        if (isContextInvalidated(p.error) || p.error === "runtime_unavailable") {
          showToast("Extensão atualizada — recarregue a aba.");
        } else {
          showToast("Não foi possível analisar. Recarregue a aba.");
        }
        dispatchDecision(requestId, true);
        return;
      }
    }

    const r = await safeSendMessage({ type: "ANALYZE", payload });
    if (!r.ok) {
      if (isContextInvalidated(r.error) || r.error === "runtime_unavailable") {
        showToast("Extensão atualizada — recarregue a aba.");
      } else {
        showToast("Não foi possível analisar. Recarregue a aba.");
      }
      dispatchDecision(requestId, true);
      return;
    }

    const res = r.data;
    if (!res?.ok) {
      showToast("Não foi possível analisar. Recarregue a aba.");
      dispatchDecision(requestId, true);
      return;
    }

    const analysis = res.analysis as Analysis;
    const action = classifyAction(method, params);
    if (analysis.recommend === "ALLOW" && action !== "SEND_TX") {
      dispatchDecision(requestId, true);
      return;
    }

    // Show overlay; buttons will cleanup overlay and sendDecision.
    void showOverlay(requestId, analysis, { host, method, params, rpcMeta });
  } catch (e: any) {
    try { dispatchDecision((ev as any).data?.requestId, true); } catch {}
  }
}

window.addEventListener("message", (ev) => { void handleSGRequest(ev); });

// Also listen to MAIN-world non-blocking RPC telemetry for 2-step flows.
window.addEventListener("message", (ev) => { void handlePageRpcMessage(ev); });
