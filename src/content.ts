// ARQUIVO: src/content.ts
import type { AnalyzeRequest, Analysis, Settings } from "./shared/types";
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
import { getNativeSymbol } from "./shared/chains";
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
  // Renderização básica para garantir que vemos algo
  state.app.innerHTML = `
    <div style="background: #1e293b; color: white; padding: 20px; border-radius: 12px; position: absolute; bottom: 20px; right: 20px; width: 350px; font-family: sans-serif; box-shadow: 0 10px 25px rgba(0,0,0,0.5); border: 1px solid #334155;">
      <h3 style="margin: 0 0 10px 0; color: #38bdf8;">SignGuard Protege</h3>
      <p style="font-size: 14px; margin-bottom: 15px;">Método: <b>${escapeHtml(state.meta.method)}</b></p>
      <div style="display: flex; gap: 10px;">
        <button id="sg-deny" style="flex: 1; padding: 8px; border: none; background: #ef4444; color: white; border-radius: 6px; cursor: pointer;">Bloquear</button>
        <button id="sg-allow" style="flex: 1; padding: 8px; border: none; background: #22c55e; color: white; border-radius: 6px; cursor: pointer;">Permitir</button>
      </div>
    </div>
  `;

  const denyBtn = state.shadow.getElementById("sg-deny");
  const allowBtn = state.shadow.getElementById("sg-allow");
  if (denyBtn) denyBtn.addEventListener("click", () => decideCurrentAndAdvance(false));
  if (allowBtn) allowBtn.addEventListener("click", () => decideCurrentAndAdvance(true));
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

  window.postMessage(
    {
      source: "signguard-content",
      type: "SG_DECISION",
      requestId: cur.requestId,
      allow,
    },
    "*"
  );

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

  if (requestQueue.length === 1) showCurrentPending();

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
