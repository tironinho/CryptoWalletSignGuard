"use strict";
(() => {
  // src/shared/utils.ts
  function escapeHtml(s) {
    const str = String(s ?? "");
    return str.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
  }

  // src/runtimeSafe.ts
  var _port = null;
  function canUseRuntime() {
    try {
      const c = (typeof globalThis !== "undefined" ? globalThis.chrome : void 0) ?? (typeof chrome !== "undefined" ? chrome : void 0);
      return !!(c?.runtime?.id && typeof c.runtime.sendMessage === "function");
    } catch {
      return false;
    }
  }
  function isRuntimeUsable() {
    try {
      return canUseRuntime();
    } catch {
      return false;
    }
  }
  function getPort() {
    try {
      const c = (typeof globalThis !== "undefined" ? globalThis.chrome : void 0) ?? (typeof chrome !== "undefined" ? chrome : void 0);
      if (!canUseRuntime() || !c?.runtime?.connect) return null;
      if (_port) return _port;
      _port = c.runtime.connect({ name: "sg_port" });
      _port?.onDisconnect.addListener(() => {
        _port = null;
        _portListenerInit = false;
      });
      return _port;
    } catch {
      _port = null;
      return null;
    }
  }
  var _portPending = /* @__PURE__ */ new Map();
  var _portListenerInit = false;
  function initPortListener() {
    const p = getPort();
    if (!p || _portListenerInit) return;
    _portListenerInit = true;
    p.onMessage.addListener((resp) => {
      const cb = resp?.requestId != null ? _portPending.get(String(resp.requestId)) : void 0;
      if (cb) {
        _portPending.delete(String(resp.requestId));
        try {
          cb(resp);
        } catch {
        }
      }
    });
  }
  function portRequest(msg, timeoutMs = 2500) {
    return new Promise((resolve) => {
      (async () => {
        try {
          if (!_port) {
            try {
              await new Promise((r) => {
                const c = (typeof globalThis !== "undefined" ? globalThis.chrome : void 0) ?? (typeof chrome !== "undefined" ? chrome : void 0);
                if (!c?.runtime?.sendMessage) return r();
                c.runtime.sendMessage({ type: "PING" }, () => {
                  r();
                });
                setTimeout(() => r(), 600);
              });
            } catch {
            }
          }
          const p = getPort();
          if (!p) {
            resolve(null);
            return;
          }
          initPortListener();
          const requestId = typeof crypto?.randomUUID === "function" ? crypto.randomUUID() : `sg_${Date.now()}_${Math.random().toString(36).slice(2)}`;
          const payload = { ...msg, requestId };
          const timer = setTimeout(() => {
            if (_portPending.has(requestId)) {
              _portPending.delete(requestId);
              resolve(null);
            }
          }, timeoutMs);
          _portPending.set(requestId, (resp) => {
            clearTimeout(timer);
            resolve(resp != null ? resp : null);
          });
          try {
            p.postMessage(payload);
          } catch (e) {
            clearTimeout(timer);
            _portPending.delete(requestId);
            resolve(null);
          }
        } catch {
          resolve(null);
        }
      })();
    });
  }
  var DEFAULT_SEND_MS = 4e3;
  var RETRY_SEND_MS = 2500;
  function sendMessageOneAttempt(msg, timeoutMs) {
    return new Promise((resolve) => {
      let settled = false;
      const once = (value) => {
        if (settled) return;
        settled = true;
        resolve(value);
      };
      const c = (typeof globalThis !== "undefined" ? globalThis.chrome : void 0) ?? (typeof chrome !== "undefined" ? chrome : void 0);
      const rt = (() => {
        try {
          return c?.runtime ?? null;
        } catch {
          return null;
        }
      })();
      if (!rt || !rt.id || typeof rt.sendMessage !== "function") {
        once(null);
        return;
      }
      const timer = setTimeout(() => {
        once(null);
      }, timeoutMs);
      try {
        rt.sendMessage(msg, (resp) => {
          if (settled) return;
          clearTimeout(timer);
          try {
            const err = c?.runtime?.lastError;
            if (err) {
              once(null);
              return;
            }
            once(resp ?? null);
          } catch {
            once(null);
          }
        });
      } catch (e) {
        clearTimeout(timer);
        once(null);
      }
    });
  }
  function safeSendMessage(msg, options) {
    const timeoutMs = typeof options === "number" ? options : options?.timeoutMs ?? DEFAULT_SEND_MS;
    const preferPort = typeof options === "object" && options?.preferPort === true;
    if (preferPort) {
      return portRequest(msg, timeoutMs).then((r) => {
        if (r != null && r?.ok !== false) return r;
        return sendMessageOneAttempt(msg, timeoutMs).then((res) => {
          if (res != null) return res;
          return sendMessageOneAttempt(msg, RETRY_SEND_MS);
        });
      });
    }
    return sendMessageOneAttempt(msg, timeoutMs).then((r) => {
      if (r != null) return r;
      return sendMessageOneAttempt(msg, RETRY_SEND_MS);
    });
  }
  function safeGetURL(path) {
    try {
      if (!isRuntimeUsable() || !chrome.runtime.getURL) return "";
      return chrome.runtime.getURL(path);
    } catch {
      return "";
    }
  }

  // src/content.ts
  console.log("\u{1F4E8} [SignGuard Content] Loaded cleanly (No manual injection).");
  function toChainIdHex(chainId) {
    if (chainId == null || chainId === "") return null;
    const s = String(chainId).trim();
    if (s.toLowerCase().startsWith("0x")) return s;
    const n = parseInt(s, 10);
    if (!Number.isFinite(n) || n < 0) return null;
    return "0x" + n.toString(16);
  }
  var __sgOverlay = null;
  function ensureOverlayCss(shadow) {
    try {
      const href = safeGetURL("overlay.css");
      console.log("\u{1F3A8} [SignGuard UI] CSS path:", href);
      if (!href) return;
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = href;
      shadow.appendChild(link);
    } catch (e) {
      console.error("\u{1F3A8} [SignGuard UI] CSS Error:", e);
    }
  }
  function showOverlay(requestId, analysis, meta) {
    console.log("\u{1F3A8} [SignGuard UI] showOverlay CALLED for:", requestId);
    if (__sgOverlay) {
      console.log("\u{1F3A8} [SignGuard UI] Updating existing overlay");
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
      container.style.cssText = "position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; z-index: 2147483647; pointer-events: none;";
      const shadow = container.attachShadow({ mode: "open" });
      ensureOverlayCss(shadow);
      const app = document.createElement("div");
      app.id = "sg-app";
      app.style.pointerEvents = "auto";
      shadow.appendChild(app);
      const onKey = (e) => {
        if (e.key === "Escape") decideCurrentAndAdvance(false);
      };
      document.addEventListener("keydown", onKey);
      __sgOverlay = { requestId, analysis, meta, container, shadow, app, onKey };
      if (document.documentElement) {
        document.documentElement.appendChild(container);
        console.log("\u{1F3A8} [SignGuard UI] Appended to documentElement");
      } else {
        document.body.appendChild(container);
        console.log("\u{1F3A8} [SignGuard UI] Appended to body");
      }
      updateOverlay(__sgOverlay);
    } catch (e) {
      console.error("\u{1F3A8} [SignGuard UI] FATAL UI ERROR:", e);
    }
  }
  function updateOverlay(state) {
    state.app.innerHTML = `
    <div style="background: #1e293b; color: white; padding: 20px; border-radius: 12px; position: absolute; bottom: 20px; right: 20px; width: 350px; font-family: sans-serif; box-shadow: 0 10px 25px rgba(0,0,0,0.5); border: 1px solid #334155;">
      <h3 style="margin: 0 0 10px 0; color: #38bdf8;">SignGuard Protege</h3>
      <p style="font-size: 14px; margin-bottom: 15px;">M\xE9todo: <b>${escapeHtml(state.meta.method)}</b></p>
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
      try {
        __sgOverlay.container.remove();
      } catch {
      }
      try {
        document.removeEventListener("keydown", __sgOverlay.onKey);
      } catch {
      }
      __sgOverlay = null;
    }
  }
  var requestQueue = [];
  function showCurrentPending() {
    const cur = requestQueue[0];
    if (cur) {
      showOverlay(cur.requestId, cur.analysis, {
        host: cur.host,
        method: cur.method,
        params: cur.params,
        chainIdHex: cur.chainIdHex ?? null
      });
    }
  }
  function decideCurrentAndAdvance(allow) {
    const cur = requestQueue[0];
    if (!cur) return;
    console.log(`\u{1F4E8} [SignGuard Content] User decided: ${allow ? "ALLOW" : "BLOCK"}`);
    window.postMessage(
      {
        source: "signguard-content",
        type: "SG_DECISION",
        requestId: cur.requestId,
        allow
      },
      "*"
    );
    requestQueue.shift();
    cleanupOverlay();
    if (requestQueue.length > 0) setTimeout(showCurrentPending, 100);
  }
  window.addEventListener("message", async (ev) => {
    if (ev.source !== window || !ev.data || ev.data.source !== "signguard") return;
    if (ev.data.type !== "SG_REQUEST") return;
    const { requestId, payload } = ev.data;
    console.log("\u{1F4E8} [SignGuard Content] Request received:", payload?.method);
    const url = payload?.url ?? window.location.href;
    const origin = (() => {
      try {
        return new URL(url).origin;
      } catch {
        return window.location.origin;
      }
    })();
    const rpcMeta = payload?.meta ?? null;
    const chainIdHex = payload?.chainIdHex || toChainIdHex(rpcMeta?.chainId) || toChainIdHex(payload?.chainId) || null;
    const meta = rpcMeta ? { ...rpcMeta, chainIdHex: chainIdHex ?? void 0 } : chainIdHex ? { chainIdHex: chainIdHex ?? void 0 } : void 0;
    const analyzePayload = {
      requestId,
      url,
      origin,
      request: { method: payload?.method ?? "", params: Array.isArray(payload?.params) ? payload.params : [] },
      meta
    };
    const pending = {
      requestId,
      method: payload?.method ?? "",
      host: payload?.host ?? "",
      params: payload?.params,
      chainIdHex: chainIdHex ?? void 0,
      analysis: { level: "LOADING", score: 0, title: "", reasons: [], recommend: "WARN" }
    };
    requestQueue.push(pending);
    if (requestQueue.length === 1) showCurrentPending();
    try {
      const response = await safeSendMessage({
        type: "ANALYZE",
        payload: analyzePayload
      });
      if (pending.requestId === requestId && response?.analysis) {
        pending.analysis = response.analysis;
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
})();
//# sourceMappingURL=content.js.map
