"use strict";
(() => {
  // src/feeEstimate.ts
  var RPC_TIMEOUT_MS = 2500;
  async function tryRpc(providerRequest, method, params, timeoutMs = RPC_TIMEOUT_MS) {
    let t;
    const timeout = new Promise((res) => {
      t = setTimeout(() => res(null), timeoutMs);
    });
    try {
      const r = await Promise.race([providerRequest({ method, params }).then((x) => x), timeout]);
      clearTimeout(t);
      return r;
    } catch {
      clearTimeout(t);
      return null;
    }
  }
  async function estimateFee(providerRequest, tx) {
    try {
      let gasLimit;
      const gasHex = await tryRpc(providerRequest, "eth_estimateGas", [tx]);
      if (gasHex != null && typeof gasHex === "string") {
        try {
          gasLimit = BigInt(gasHex);
        } catch {
          gasLimit = 150000n;
        }
      } else {
        const hasData = tx?.data && String(tx.data) !== "0x" && String(tx.data).toLowerCase() !== "0x";
        const valueWei = BigInt(tx?.value || "0x0");
        gasLimit = hasData ? 150000n : valueWei > 0n ? 21000n : 150000n;
      }
      const maxFeePerGas = tx?.maxFeePerGas ? BigInt(tx.maxFeePerGas) : void 0;
      const maxPriorityFeePerGas = tx?.maxPriorityFeePerGas ? BigInt(tx.maxPriorityFeePerGas) : void 0;
      const gasPrice = tx?.gasPrice ? BigInt(tx.gasPrice) : void 0;
      let computedMaxFee = maxFeePerGas;
      let computedPriority = maxPriorityFeePerGas;
      if (!computedMaxFee && !gasPrice) {
        let baseFee;
        const fh = await tryRpc(providerRequest, "eth_feeHistory", ["0x1", "latest", []]);
        const arr = fh?.baseFeePerGas;
        if (Array.isArray(arr) && arr.length > 0) {
          try {
            baseFee = BigInt(arr[arr.length - 1]);
          } catch {
            baseFee = void 0;
          }
        } else {
          baseFee = void 0;
        }
        if (baseFee != null) {
          computedPriority = computedPriority ?? 1000000000n;
          computedMaxFee = baseFee * 2n + computedPriority;
        } else {
          const gpHex = await tryRpc(providerRequest, "eth_gasPrice", []);
          if (gpHex != null && gpHex !== "") return finalizeLegacy(gasLimit, BigInt(gpHex));
          return { ok: false, reason: "fee_unknown_wallet_will_estimate" };
        }
      }
      if (gasPrice) return finalizeLegacy(gasLimit, gasPrice);
      if (!computedMaxFee) {
        return { ok: false, reason: "fee_unknown_wallet_will_estimate" };
      }
      const maxP = computedMaxFee;
      const prio = computedPriority ?? 0n;
      const likelyPerGas = (maxP + prio) / 2n;
      const feeMaxWei = gasLimit * maxP;
      const feeLikelyWei = gasLimit * likelyPerGas;
      return {
        ok: true,
        gasLimit,
        maxFeePerGas: maxP,
        maxPriorityFeePerGas: prio,
        feeMaxWei,
        feeLikelyWei
      };
    } catch {
      return { ok: false, reason: "fee_unknown_wallet_will_estimate" };
    }
  }
  function finalizeLegacy(gasLimit, gasPrice) {
    const feeMaxWei = gasLimit * gasPrice;
    return { ok: true, gasLimit, gasPrice, feeMaxWei, feeLikelyWei: feeMaxWei };
  }

  // src/shared/uiGate.ts
  var UI_GATED_METHODS_LIST = [
    "eth_requestAccounts",
    "wallet_requestPermissions",
    "wallet_addEthereumChain",
    "wallet_switchEthereumChain",
    "wallet_watchAsset",
    "wallet_sendTransaction",
    "eth_sendTransaction",
    "eth_signTransaction",
    "eth_sendRawTransaction",
    "wallet_invokeSnap",
    "wallet_requestSnaps",
    "personal_sign",
    "eth_sign",
    "eth_signTypedData",
    "eth_signTypedData_v3",
    "eth_signTypedData_v4"
  ];
  var UI_GATED_METHODS = new Set(UI_GATED_METHODS_LIST.map((m) => m.toLowerCase()));
  function shouldGateUI(method) {
    return UI_GATED_METHODS.has(String(method || "").toLowerCase());
  }

  // src/mainWorld.ts
  var DEBUG_PREFIX = "\u{1F680} [SignGuard MainWorld]";
  var SG_DECISION_EVENT = "__sg_decision__";
  function log(msg, ...args) {
    console.log(`%c${DEBUG_PREFIX} ${msg}`, "color: #00ff00; font-weight: bold;", ...args);
  }
  function postToContent(type, requestId, payload) {
    window.postMessage({ source: "signguard", type, requestId, payload }, "*");
  }
  function toDecStringWei(v) {
    try {
      return BigInt(v ?? "0x0").toString(10);
    } catch {
      return "0";
    }
  }
  async function buildTxCostPreview(providerRequest, tx) {
    const valueWeiDec = toDecStringWei(tx?.value ?? "0x0");
    try {
      const fee = await estimateFee(providerRequest, tx);
      if (!fee.ok) {
        return {
          valueWei: valueWeiDec,
          feeEstimated: false,
          feeReasonKey: fee.reason ?? "fee_unknown_wallet_will_estimate"
        };
      }
      const valueWei = BigInt(valueWeiDec);
      const feeLikelyWei = BigInt(fee.feeLikelyWei ?? 0n);
      const feeMaxWei = BigInt(fee.feeMaxWei ?? 0n);
      return {
        valueWei: valueWeiDec,
        feeEstimated: true,
        gasLimitWei: (fee.gasLimit ?? 0n).toString(10),
        feeLikelyWei: feeLikelyWei.toString(10),
        feeMaxWei: feeMaxWei.toString(10),
        totalLikelyWei: (valueWei + feeLikelyWei).toString(10),
        totalMaxWei: (valueWei + feeMaxWei).toString(10)
      };
    } catch {
      return {
        valueWei: valueWeiDec,
        feeEstimated: false,
        feeReasonKey: "fee_unknown_wallet_will_estimate"
      };
    }
  }
  async function safeGetChainIdHex(provider) {
    try {
      const direct = provider?.chainId;
      if (typeof direct === "string" && direct.startsWith("0x")) return direct;
    } catch {
    }
    try {
      const cid = await provider?.request?.({ method: "eth_chainId", params: [] });
      if (typeof cid === "string" && cid.startsWith("0x")) return cid;
    } catch {
    }
    return null;
  }
  log("Script injected and started.");
  var SENSITIVE_METHODS_LIST = [
    "eth_requestAccounts",
    "wallet_requestPermissions",
    "wallet_addEthereumChain",
    "wallet_switchEthereumChain",
    "wallet_watchAsset",
    "eth_sendTransaction",
    "wallet_sendTransaction",
    "eth_sendRawTransaction",
    "eth_signTransaction",
    "wallet_getPermissions",
    "wallet_invokeSnap",
    "wallet_requestSnaps",
    "personal_sign",
    "eth_sign",
    "eth_signTypedData",
    "eth_signTypedData_v3",
    "eth_signTypedData_v4"
  ];
  var SENSITIVE_METHODS = new Set(SENSITIVE_METHODS_LIST.map((m) => String(m).toLowerCase()));
  function normalizeMethod(m) {
    if (m == null) return "";
    if (typeof m === "string") return m;
    if (typeof m === "object" && typeof m.method === "string") return m.method;
    return String(m);
  }
  function isSensitive(method) {
    return SENSITIVE_METHODS.has(String(method || "").toLowerCase());
  }
  if (typeof window !== "undefined") {
    try {
      if (!isSensitive("wallet_switchEthereumChain") || !isSensitive("wallet_switchethereumchain") || !isSensitive("eth_sendTransaction")) {
        console.error(DEBUG_PREFIX, "Sensitive method self-check FAIL: gate methods must be detected");
      } else if (isSensitive("eth_accounts")) {
        console.error(DEBUG_PREFIX, "Sensitive method self-check: eth_accounts is not in gate list (read-only)");
      } else {
        log("Sensitive method self-check OK");
      }
    } catch (e) {
      console.error(DEBUG_PREFIX, "Sensitive method self-check failed", e);
    }
  }
  async function handleSensitiveRpc(method, params, provider, originalRequest, buildArgs) {
    const requestId = crypto.randomUUID();
    const m = String(method || "").toLowerCase();
    const isUiGated = shouldGateUI(m);
    const tx = Array.isArray(params) ? params[0] : void 0;
    const DEFAULT_FAIL_MODE = isUiGated ? "fail_closed" : "fail_open";
    const DECISION_TIMEOUT_MS = isUiGated ? 6e4 : 2500;
    let chainIdHex = null;
    try {
      const direct = provider?.chainId;
      if (typeof direct === "string" && direct.startsWith("0x")) chainIdHex = direct;
    } catch {
    }
    if (!chainIdHex) chainIdHex = await safeGetChainIdHex(provider);
    let chainIdRequested;
    if (m === "wallet_switchethereumchain" || m === "wallet_addethereumchain") {
      const p0 = params?.[0];
      if (p0 && typeof p0 === "object") {
        const cidReq = p0.chainId;
        if (typeof cidReq === "string") chainIdRequested = cidReq;
      }
    }
    const initialPreview = (m === "eth_sendtransaction" || m === "wallet_sendtransaction") && tx && typeof tx === "object" ? { valueWei: toDecStringWei(tx?.value ?? "0x0"), feeEstimated: false, feeReasonKey: "fee_calculating" } : void 0;
    const pendingFailMode = {};
    pendingFailMode[requestId] = DEFAULT_FAIL_MODE;
    log(`\u{1F4E8} Sending SG_REQUEST to content: ${method} requestId=${requestId}`);
    postToContent("SG_REQUEST", requestId, {
      method,
      params,
      host: window.location.hostname,
      url: window.location.href,
      chainIdHex: chainIdHex ?? void 0,
      txCostPreview: initialPreview,
      meta: chainIdRequested ? { chainIdRequested } : void 0
    });
    if (m === "eth_sendtransaction" || m === "wallet_sendtransaction") {
      if (tx && typeof tx === "object") {
        (async () => {
          let cid = null;
          try {
            cid = await originalRequest({ method: "eth_chainId", params: [] });
          } catch {
          }
          const txCostPreview = await buildTxCostPreview(originalRequest, tx);
          postToContent("SG_PREVIEW", requestId, { chainIdHex: cid ?? void 0, txCostPreview });
        })();
      }
    }
    return new Promise((resolve, reject) => {
      let resolved = false;
      let timeoutId = null;
      const args = buildArgs();
      const cleanup = () => {
        if (timeoutId != null) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }
        window.removeEventListener(SG_DECISION_EVENT, onDecision);
        window.removeEventListener("message", onMessage);
        delete pendingFailMode[requestId];
      };
      const applyDecision = (allow, meta) => {
        if (resolved) return;
        resolved = true;
        cleanup();
        if (!allow) {
          reject({ code: 4001, message: "SignGuard: Blocked by user" });
          return;
        }
        const gated = shouldGateUI(m);
        const uiConfirmed = meta?.uiConfirmed === true;
        const reasonKeys = meta?.reasonKeys ?? [];
        const extensionPaused = reasonKeys.includes("EXTENSION_PAUSED");
        if (gated && !uiConfirmed && !extensionPaused) {
          log("BLOCKED forward: uiConfirmed missing for gated method", m);
          reject(new Error("SignGuard: UI confirmation required before forwarding to wallet"));
          return;
        }
        window.postMessage({ source: "signguard-mainworld", type: "SG_RELEASED", requestId, method: m }, "*");
        originalRequest(args).then(resolve).catch(reject);
      };
      const onTimeout = () => {
        if (resolved) return;
        resolved = true;
        cleanup();
        const failMode = pendingFailMode[requestId] ?? DEFAULT_FAIL_MODE;
        window.postMessage({ source: "signguard-mainworld", type: "SG_DIAG_TIMEOUT", requestId, failMode, method: m }, "*");
        if (isUiGated) {
          log("Decision timeout on UI-gated method \u2014 blocking (never fail-open):", m);
          reject(new Error("SignGuard: aguardando confirma\xE7\xE3o no overlay (timeout)."));
          return;
        }
        if (failMode === "fail_open") {
          log("Decision timeout: fail_open \u2014 releasing request");
          originalRequest(args).then(resolve).catch(reject);
        } else {
          log("Decision timeout: fail_closed \u2014 blocking request");
          reject(new Error("SignGuard: request timed out; reload the page and try again."));
        }
      };
      const onDecision = (ev) => {
        const ce = ev;
        const data = ce?.detail ?? null;
        if (!data || data.type !== "SG_DECISION" || data.requestId !== requestId) return;
        applyDecision(!!data.allow, data.meta);
      };
      const onMessage = (ev) => {
        if (resolved) return;
        const d = ev.data;
        if (d?.source === "signguard-content" && d?.type === "SG_SETTINGS" && d?.requestId === requestId) {
          const fm = d.failMode === "fail_closed" ? "fail_closed" : "fail_open";
          pendingFailMode[requestId] = isUiGated ? "fail_closed" : fm;
          return;
        }
        if (d?.source !== "signguard-content" || d?.type !== "SG_DECISION" || d?.requestId !== requestId) return;
        applyDecision(!!d.allow, d.meta);
      };
      timeoutId = setTimeout(onTimeout, DECISION_TIMEOUT_MS);
      window.addEventListener(SG_DECISION_EVENT, onDecision);
      window.addEventListener("message", onMessage);
    });
  }
  function patchProvider(provider) {
    if (!provider || provider._sg_patched) return;
    log("Patching found provider:", provider);
    const originalRequest = provider.request?.bind?.(provider);
    if (!originalRequest) return;
    provider.__sg_originalRequest = originalRequest;
    Object.defineProperty(provider, "request", {
      value: async (args) => {
        const method = normalizeMethod(args?.method ?? args);
        const sensitive = isSensitive(method);
        log(`Intercepted request: ${method} (isSensitive=${sensitive})`, args);
        if (!sensitive) {
          log(`\u27A1\uFE0F PASS-THROUGH: ${method}`);
          return originalRequest(args);
        }
        log(`\u{1F6D1} HOLDING request: ${method} (reason: sensitive)`);
        return handleSensitiveRpc(method, args.params ?? [], provider, originalRequest, () => args);
      },
      configurable: true,
      writable: true
    });
    const origSend = provider.send?.bind?.(provider);
    if (origSend) {
      Object.defineProperty(provider, "send", {
        value: function(a, b) {
          let method;
          let params;
          let callback;
          if (typeof a === "string") {
            method = normalizeMethod(a);
            params = Array.isArray(b) ? b : [];
            return new Promise((resolve, reject) => {
              if (!isSensitive(method)) {
                log(`\u27A1\uFE0F PASS-THROUGH: ${method}`);
                origSend(method, params).then(resolve).catch(reject);
                return;
              }
              log(`\u{1F6D1} HOLDING send: ${method} (reason: sensitive)`);
              handleSensitiveRpc(method, params, provider, originalRequest, () => ({ method, params })).then(resolve).catch(reject);
            });
          }
          if (a && typeof a === "object" && typeof b === "function") {
            callback = b;
            method = normalizeMethod(a.method ?? a);
            params = a.params ?? [];
            if (!isSensitive(method)) {
              log(`\u27A1\uFE0F PASS-THROUGH: ${method}`);
              return origSend(a, callback);
            }
            log(`\u{1F6D1} HOLDING send(payload,cb): ${method} (reason: sensitive)`);
            handleSensitiveRpc(method, params, provider, originalRequest, () => a).then((res) => callback(null, res)).catch((err) => callback(err, void 0));
            return;
          }
          return origSend(a, b);
        },
        configurable: true,
        writable: true
      });
    }
    const origSendAsync = provider.sendAsync?.bind?.(provider);
    if (origSendAsync) {
      Object.defineProperty(provider, "sendAsync", {
        value: function(payload, callback) {
          const method = normalizeMethod(payload?.method ?? payload);
          const params = payload?.params ?? [];
          if (!isSensitive(method)) {
            log(`\u27A1\uFE0F PASS-THROUGH: ${method}`);
            return origSendAsync(payload, callback);
          }
          log(`\u{1F6D1} HOLDING sendAsync: ${method} (reason: sensitive)`);
          handleSensitiveRpc(method, params, provider, originalRequest, () => payload).then((res) => callback(null, res)).catch((err) => callback(err, void 0));
        },
        configurable: true,
        writable: true
      });
    }
    provider._sg_patched = true;
    log("Provider patched successfully.");
  }
  function patchProvidersArray(providers) {
    if (!Array.isArray(providers)) return;
    for (let i = 0; i < providers.length; i++) {
      const p = providers[i];
      if (p && !p._sg_patched) {
        patchProvider(p);
      }
    }
  }
  function init() {
    log("Initializing...");
    const ensureEthPatched = (eth) => {
      if (!eth) return;
      if (!eth._sg_patched) patchProvider(eth);
      const providers = eth?.providers;
      if (Array.isArray(providers)) patchProvidersArray(providers);
    };
    if (window.ethereum) {
      ensureEthPatched(window.ethereum);
    }
    let storedEth = window.ethereum;
    try {
      Object.defineProperty(window, "ethereum", {
        get: () => storedEth,
        set: (val) => {
          log("window.ethereum was set externally!");
          storedEth = val;
          ensureEthPatched(val);
        },
        configurable: true
      });
    } catch {
    }
    window.addEventListener("eip6963:announceProvider", (ev) => {
      const detail = ev?.detail;
      if (!detail || typeof detail !== "object") return;
      const provider = detail.provider ?? detail;
      if (provider && !provider._sg_patched) {
        log("EIP-6963: Patching announced provider", detail.info?.name ?? "?");
        patchProvider(provider);
      }
    });
    const requestProviders = () => {
      try {
        window.dispatchEvent(new Event("eip6963:requestProvider"));
      } catch {
      }
    };
    requestProviders();
    setTimeout(requestProviders, 2e3);
    setTimeout(requestProviders, 5e3);
    try {
      const observer = new MutationObserver(() => {
        const eth = window.ethereum;
        if (eth && !eth._sg_patched) {
          log("MutationObserver: unpatched provider detected. Patching...");
          patchProvider(eth);
          if (Array.isArray(eth?.providers)) patchProvidersArray(eth.providers);
        }
      });
      observer.observe(document.documentElement, { childList: true, subtree: true });
    } catch {
    }
    const pollMs = 4e3;
    setInterval(() => {
      const eth = window.ethereum;
      if (!eth) return;
      if (!eth._sg_patched) {
        log("Poll: unpatched provider. Patching now...");
        patchProvider(eth);
      }
      if (Array.isArray(eth?.providers)) patchProvidersArray(eth.providers);
    }, pollMs);
  }
  init();
  var RPC_ALLOWED = /* @__PURE__ */ new Set(["eth_call", "eth_chainid", "eth_getcode", "eth_getblockbynumber", "eth_getlogs", "eth_estimategas", "eth_gasprice", "eth_getbalance", "eth_gettransactioncount", "eth_accounts"]);
  var METHOD_CANONICAL = {
    eth_chainid: "eth_chainId",
    eth_accounts: "eth_accounts",
    eth_requestaccounts: "eth_requestAccounts",
    eth_getlogs: "eth_getLogs",
    eth_call: "eth_call",
    eth_estimategas: "eth_estimateGas",
    eth_gasprice: "eth_gasPrice",
    eth_getbalance: "eth_getBalance",
    eth_gettransactioncount: "eth_getTransactionCount",
    eth_getblockbynumber: "eth_getBlockByNumber",
    eth_getcode: "eth_getCode",
    wallet_switchethereumchain: "wallet_switchEthereumChain",
    wallet_addethereumchain: "wallet_addEthereumChain"
  };
  window.addEventListener("message", async (ev) => {
    if (ev.source !== window || ev.data?.source !== "signguard-content") return;
    if (ev.data?.type === "SG_RPC_CALL_REQ") {
      const { requestId: requestId2, method, params } = ev.data;
      if (!requestId2 || !method) return;
      const requested = String(method).trim();
      const key = requested.toLowerCase();
      if (!RPC_ALLOWED.has(key)) {
        window.postMessage({ source: "signguard-mainworld", type: "SG_RPC_CALL_RES", requestId: requestId2, ok: false, error: "method_not_allowed" }, "*");
        return;
      }
      const canonical = METHOD_CANONICAL[key] ?? requested;
      const eth2 = window.ethereum;
      const orig2 = eth2?.__sg_originalRequest ?? eth2?.request?.bind?.(eth2);
      if (!orig2) {
        window.postMessage({ source: "signguard-mainworld", type: "SG_RPC_CALL_RES", requestId: requestId2, ok: false, error: "no_provider" }, "*");
        return;
      }
      try {
        const result = await orig2({ method: canonical, params: params ?? [] });
        window.postMessage({ source: "signguard-mainworld", type: "SG_RPC_CALL_RES", requestId: requestId2, ok: true, result }, "*");
      } catch (e) {
        window.postMessage({ source: "signguard-mainworld", type: "SG_RPC_CALL_RES", requestId: requestId2, ok: false, error: String(e?.message ?? e) }, "*");
      }
      return;
    }
    if (ev.data?.type !== "SG_FEE_ESTIMATE_REQ") return;
    const { requestId, tx } = ev.data?.payload ?? {};
    if (!requestId || !tx) return;
    const eth = window.ethereum;
    const orig = eth?.__sg_originalRequest ?? eth?.request?.bind?.(eth);
    if (!orig) {
      window.postMessage({ source: "signguard", type: "SG_FEE_ESTIMATE_RES", requestId, feeEstimate: { ok: false, feeEstimated: false, error: "no_provider" } }, "*");
      return;
    }
    try {
      const fee = await estimateFee((args) => orig(args), tx);
      const valueWei = typeof tx?.value === "string" ? BigInt(tx.value) : BigInt(tx?.value || "0x0");
      const gasLimit = fee.gasLimit ?? 150000n;
      const feeLikelyWei = fee.feeLikelyWei ?? 0n;
      const feeMaxWei = fee.feeMaxWei ?? 0n;
      window.postMessage({
        source: "signguard",
        type: "SG_FEE_ESTIMATE_RES",
        requestId,
        feeEstimate: {
          ok: fee.ok,
          gasLimitHex: fee.ok && gasLimit ? "0x" + gasLimit.toString(16) : void 0,
          feeLikelyWeiHex: fee.ok && feeLikelyWei ? "0x" + feeLikelyWei.toString(16) : void 0,
          feeMaxWeiHex: fee.ok && feeMaxWei ? "0x" + feeMaxWei.toString(16) : void 0,
          feeEstimated: fee.ok,
          feeReasonKey: fee.reason
        }
      }, "*");
    } catch (e) {
      window.postMessage({ source: "signguard", type: "SG_FEE_ESTIMATE_RES", requestId, feeEstimate: { ok: false, feeEstimated: false, error: String(e?.message ?? e) } }, "*");
    }
  });
})();
//# sourceMappingURL=mainWorld.js.map
