import type { AnalyzeRequest, Analysis } from "./shared/types";
import { t } from "./i18n";
import { clamp, escapeHtml } from "./shared/utils";

async function safeSendMessage<T = any>(msg: any): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  try {
    // Se o contexto já foi invalidado, chrome.runtime.id pode falhar/estar vazio
    if (!chrome?.runtime?.id) return { ok: false, error: "runtime_unavailable" };
    const resp = await new Promise<any>((resolve) => {
      chrome.runtime.sendMessage(msg, (r) => {
        const err = chrome.runtime.lastError;
        if (err) return resolve({ __sg_error: err.message || String(err) });
        resolve(r);
      });
    });
    if (resp && resp.__sg_error) return { ok: false, error: String(resp.__sg_error) };
    return { ok: true, data: resp as T };
  } catch (e: any) {
    return { ok: false, error: e?.message ? String(e.message) : String(e) };
  }
}

function showToast(text: string) {
  const el = document.createElement("div");
  el.className = "sg-toast";
  el.textContent = text;
  document.documentElement.appendChild(el);
  setTimeout(() => el.remove(), 2500);
}

type MainWorldRequestMsg = {
  source: "signguard-main";
  type: "SG_REQUEST";
  requestId: string;
  url: string;
  origin: string;
  request: { method: string; params?: any[]; rawShape?: string; raw?: any };
};

// Signal readiness to MAIN world (prevents early message loss).
window.postMessage({ source: "signguard-content", type: "SG_READY" }, "*");

type ContentDecisionMsg = {
  source: "signguard-content";
  type: "SG_DECISION";
  requestId: string;
  allow: boolean;
};

function postDecision(requestId: string, allow: boolean) {
  const msg: ContentDecisionMsg = { source: "signguard-content", type: "SG_DECISION", requestId, allow };
  window.postMessage(msg, "*");
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

async function analyze(req: AnalyzeRequest): Promise<Analysis> {
  const r = await safeSendMessage<any>({ type: "ANALYZE", payload: req });
  if (!r.ok) {
    const err = r.error || "";
    if (err.includes("Extension context invalidated") || err.includes("runtime_unavailable")) {
      showToast("Extensão atualizada — recarregue a aba.");
    } else {
      showToast("Não foi possível analisar. Recarregue a aba.");
    }
    return {
      level: "LOW",
      score: 0,
      title: t("analyzerUnavailableTitle"),
      reasons: [t("analyzerUnavailableReason")],
      recommend: "ALLOW"
    };
  }
  const res = r.data;
  if (!res?.ok) {
    return {
      level: "LOW",
      score: 0,
      title: t("analyzerUnavailableTitle"),
      reasons: [t("analyzerUnavailableReason")],
      recommend: "ALLOW"
    };
  }
  return res.analysis as Analysis;
}

function ensureOverlayCss(shadow: ShadowRoot) {
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = chrome.runtime.getURL("overlay.css");
  shadow.appendChild(link);
}

function createOverlay(analysis: Analysis, meta: { host: string; method: string; rawShape?: string; }): Promise<boolean> {
  return new Promise((resolve) => {
    const host = meta.host;
    const method = meta.method;

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
                  <div style="font-weight:800">${escapeHtml(human?.methodTitle || "")}</div>
                  <div class="sg-sub">${escapeHtml(human?.methodShort || "")}</div>
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

    const cleanup = () => container.remove();

    shadow.getElementById("sg-cancel")?.addEventListener("click", () => { cleanup(); resolve(false); });
    shadow.getElementById("sg-continue")?.addEventListener("click", () => { cleanup(); resolve(true); });

    // ESC closes -> cancel
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        document.removeEventListener("keydown", onKey);
        cleanup();
        resolve(false);
      }
    };
    document.addEventListener("keydown", onKey);
  });
}

window.addEventListener("message", (event) => {
  if (event.source !== window) return;
  const data = event.data as MainWorldRequestMsg;
  if (!data || data.source !== "signguard-main" || data.type !== "SG_REQUEST") return;

  (async () => {
    try {
      const host = (() => { try { return new URL(data.url).hostname.toLowerCase(); } catch { return ""; } })();
      const req: AnalyzeRequest = {
        requestId: data.requestId,
        url: data.url,
        origin: data.origin,
        request: data.request
      };

      const r = await safeSendMessage<any>({ type: "ANALYZE", payload: req });
      if (!r.ok) {
        const err = r.error || "";
        if (err.includes("Extension context invalidated") || err.includes("runtime_unavailable")) {
          postDecision(data.requestId, true);
          showToast("Extensão atualizada — recarregue a aba.");
          return;
        }
        postDecision(data.requestId, true);
        showToast("Não foi possível analisar. Recarregue a aba.");
        return;
      }

      const res = r.data;
      if (!res?.ok) {
        postDecision(data.requestId, true);
        showToast("Não foi possível analisar. Recarregue a aba.");
        return;
      }

      const analysis = res.analysis as Analysis;
      if (analysis.recommend === "ALLOW") {
        postDecision(data.requestId, true);
        return;
      }

      const allow = await createOverlay(analysis, {
        host,
        method: data.request?.method || "unknown",
        rawShape: data.request?.rawShape
      });
      postDecision(data.requestId, allow);
    } catch (_e) {
      postDecision(data.requestId, true);
      showToast("Não foi possível analisar. Recarregue a aba.");
    }
  })();
});
