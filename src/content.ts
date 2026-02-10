import type { AnalyzeRequest, Analysis } from "./shared/types";
import { t } from "./i18n";
import { clamp, escapeHtml } from "./shared/utils";
import { normMethod, normMethodLower } from "./shared/normalize";
import { classifyFinalAction } from "./shared/classify";
import { actionTitle, walletExpectation } from "./shared/explain";

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
  };
};

function sendDecision(requestId: string, allow: boolean) {
  window.postMessage({ source: "signguard", type: "SG_DECISION", requestId, allow }, "*");
}

function emitDecisionSync(requestId: string, allow: boolean) {
  try {
    window.dispatchEvent(new CustomEvent("sg:decision", {
      detail: { requestId, allow }
    }));
  } catch {}
}

function emitDecisionAsync(requestId: string, allow: boolean) {
  window.postMessage({ source: "signguard", type: "SG_DECISION", requestId, allow }, "*");
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

// NOTE: intentionally no chrome.* Promise usage in this file.

function ensureOverlayCss(shadow: ShadowRoot) {
  try {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = chrome.runtime.getURL("overlay.css");
    shadow.appendChild(link);
  } catch {}
}

function showOverlay(requestId: string, analysis: Analysis, meta: { host: string; method: string; params?: any; rawShape?: string; }) {
    const host = meta.host;
    const method = meta.method;
    const methodNorm = normMethod(method);
    const methodLower = normMethodLower(method);
    const finalAction = classifyFinalAction(methodLower, meta.params);

    const container = document.createElement("div");
    container.className = "sg-root";
    const shadow = container.attachShadow({ mode: "open" });
    ensureOverlayCss(shadow);

    const riskText = `${riskLabel(analysis.level)} • ${clamp(analysis.score, 0, 100)}/100`;
    const dotCls = riskDotClass(analysis.level);

    const trust = analysis.trust;
    const trustText = `${trustLabel(trust?.verdict)} • ${clamp(trust?.trustScore ?? 0, 0, 100)}/100`;
    const trustReasons = (trust?.reasons || []).slice(0, 2);

    const human = analysis.human;
    const summaryBullets = [
      ...((human?.whatItDoes || []).slice(0, 2)),
      ...((human?.risks || []).slice(0, 2)),
      ...((human?.nextSteps || []).slice(0, 2)),
    ].slice(0, 6);

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

    shadow.innerHTML += `
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
                  <div style="font-weight:800">${escapeHtml(actionTitle(finalAction))}</div>
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

            <div class="sg-kv">
              <div class="sg-k">${escapeHtml("O que a carteira deve mostrar")}</div>
              <div class="sg-v">
                <div class="sg-sub">${escapeHtml(walletExpectation(finalAction))}</div>
              </div>
            </div>

            <div class="sg-kv">
              <div class="sg-k">${escapeHtml("Resumo (linguagem simples)")}</div>
              <div class="sg-v">
                <div class="sg-sub">${summaryBullets.map((x) => `• ${escapeHtml(x)}`).join("<br/>")}</div>
              </div>
            </div>

            <div class="sg-kv">
              <div class="sg-k">${escapeHtml("Ação recomendada")}</div>
              <div class="sg-v">
                <div class="sg-sub">${escapeHtml(human?.recommendation || "")}</div>
              </div>
            </div>

            <details id="sgDetailsTech" class="sg-details">
              <summary>Detalhes técnicos</summary>
              <div class="sg-sub">
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
            <button class="sg-btn sg-btn-secondary" id="sg-cancel">${escapeHtml(t("cancel"))}</button>
            <button class="sg-btn sg-btn-primary" id="sg-continue">${escapeHtml(t("continue"))}</button>
          </div>
        </div> 
      </div>
    `;

    document.documentElement.appendChild(container);

    const cleanupOverlay = () => {
      try { container.remove(); } catch {}
    };

    const continueBtn = shadow.getElementById("sg-continue") as HTMLElement | null;
    const cancelBtn = shadow.getElementById("sg-cancel") as HTMLElement | null;

    const currentRequestId = requestId;

    continueBtn && (continueBtn.onclick = () => {
      cleanupOverlay();                 // remove overlay antes
      emitDecisionSync(currentRequestId, true);   // SÍNCRONO (mantém user gesture)
      emitDecisionAsync(currentRequestId, true);  // fallback
    });

    cancelBtn && (cancelBtn.onclick = () => {
      cleanupOverlay();
      emitDecisionSync(currentRequestId, false);
      emitDecisionAsync(currentRequestId, false);
    });

    // ESC closes -> cancel
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        document.removeEventListener("keydown", onKey);
        cleanupOverlay();
        emitDecisionSync(requestId, false);
        emitDecisionAsync(requestId, false);
      }
    };
    document.addEventListener("keydown", onKey);
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
        sendDecision(requestId, true);
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
      sendDecision(requestId, true);
      return;
    }

    const res = r.data;
    if (!res?.ok) {
      showToast("Não foi possível analisar. Recarregue a aba.");
      sendDecision(requestId, true);
      return;
    }

    const analysis = res.analysis as Analysis;
    if (analysis.recommend === "ALLOW") {
      sendDecision(requestId, true);
      return;
    }

    // Show overlay; buttons will cleanup overlay and sendDecision.
    void showOverlay(requestId, analysis, { host, method, params });
  } catch (e: any) {
    try { sendDecision((ev as any).data?.requestId, true); } catch {}
  }
}

window.addEventListener("message", (ev) => { void handleSGRequest(ev); });
