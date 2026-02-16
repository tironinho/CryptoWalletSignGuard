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
  function patchProvider(provider) {
    if (!provider || provider._sg_patched) return;
    log("Patching found provider:", provider);
    const originalRequest = provider.request.bind(provider);
    provider.__sg_originalRequest = originalRequest;
    Object.defineProperty(provider, "request", {
      value: async (args) => {
        const method = args?.method;
        log(`Intercepted call to: ${method}`, args);
        const methodsToIntercept = [
          "eth_sendTransaction",
          "eth_signTypedData",
          "eth_signTypedData_v3",
          "eth_signTypedData_v4",
          "personal_sign",
          "wallet_switchEthereumChain"
        ];
        if (!methodsToIntercept.includes(method)) {
          log(`Passthrough method: ${method}`);
          return originalRequest(args);
        }
        log(`\u{1F6D1} HOLDING Request: ${method}. Sending to Content Script...`);
        const requestId = crypto.randomUUID();
        const m = String(method || "").toLowerCase();
        const tx = Array.isArray(args.params) ? args.params[0] : void 0;
        const isTx = m === "eth_sendtransaction" || m === "wallet_sendtransaction";
        let chainIdHex = null;
        try {
          const direct = provider?.chainId;
          if (typeof direct === "string" && direct.startsWith("0x")) chainIdHex = direct;
        } catch {
        }
        if (!chainIdHex) {
          chainIdHex = await safeGetChainIdHex(provider);
        }
        let chainIdRequested;
        if (m === "wallet_switchethereumchain" || m === "wallet_addethereumchain") {
          const p0 = Array.isArray(args.params) ? args.params[0] : void 0;
          if (p0 && typeof p0 === "object") {
            const cidReq = p0.chainId;
            if (typeof cidReq === "string") chainIdRequested = cidReq;
          }
        }
        const initialPreview = method === "eth_sendTransaction" && tx && typeof tx === "object" ? { valueWei: toDecStringWei(tx?.value ?? "0x0"), feeEstimated: false, feeReasonKey: "fee_calculating" } : void 0;
        postToContent("SG_REQUEST", requestId, {
          method,
          params: args.params,
          host: window.location.hostname,
          url: window.location.href,
          chainIdHex: chainIdHex ?? void 0,
          txCostPreview: initialPreview,
          meta: chainIdRequested ? { chainIdRequested } : void 0
        });
        if (method === "eth_sendTransaction" && tx && typeof tx === "object") {
          (async () => {
            let chainIdHexPreview = null;
            try {
              const cid = await originalRequest({ method: "eth_chainId" });
              if (typeof cid === "string") chainIdHexPreview = cid;
            } catch {
            }
            const txCostPreview = await buildTxCostPreview(originalRequest, tx);
            postToContent("SG_PREVIEW", requestId, {
              chainIdHex: chainIdHexPreview ?? void 0,
              txCostPreview
            });
            log("SG_PREVIEW posted");
          })();
        }
        return new Promise((resolve, reject) => {
          let resolved = false;
          const onDecision = (ev) => {
            const ce = ev;
            const data = ce?.detail ?? null;
            if (!data || data.type !== "SG_DECISION" || data.requestId !== requestId) return;
            if (resolved) return;
            resolved = true;
            window.removeEventListener(SG_DECISION_EVENT, onDecision);
            window.removeEventListener("message", onMessage);
            log(`\u2705 Decision received for ${requestId}: ${data.allow}`);
            if (data.allow) {
              log("Executing original request...");
              originalRequest(args).then(resolve).catch(reject);
            } else {
              log("Rejecting request (User Blocked).");
              reject({ code: 4001, message: "SignGuard: Blocked by user" });
            }
          };
          const onMessage = (ev) => {
            if (resolved) return;
            if (ev.data?.source !== "signguard-content" || ev.data?.type !== "SG_DECISION" || ev.data?.requestId !== requestId) return;
            resolved = true;
            window.removeEventListener(SG_DECISION_EVENT, onDecision);
            window.removeEventListener("message", onMessage);
            log(`\u2705 Decision (fallback postMessage) for ${requestId}: ${ev.data.allow}`);
            if (ev.data.allow) originalRequest(args).then(resolve).catch(reject);
            else reject({ code: 4001, message: "SignGuard: Blocked by user" });
          };
          window.addEventListener(SG_DECISION_EVENT, onDecision);
          window.addEventListener("message", onMessage);
          setTimeout(() => {
            if (!resolved) {
            }
          }, 3e3);
        });
      },
      configurable: true,
      writable: true
    });
    provider._sg_patched = true;
    log("Provider patched successfully.");
  }
  function init() {
    log("Initializing...");
    if (window.ethereum) {
      patchProvider(window.ethereum);
    }
    let storedEth = window.ethereum;
    Object.defineProperty(window, "ethereum", {
      get: () => storedEth,
      set: (val) => {
        log("window.ethereum was set externally!");
        storedEth = val;
        patchProvider(val);
      },
      configurable: true
    });
    setInterval(() => {
      const eth = window.ethereum;
      if (eth && !eth._sg_patched) {
        log("Polling found unpatched provider. Patching now...");
        patchProvider(eth);
      }
    }, 1e3);
  }
  init();
  window.addEventListener("message", async (ev) => {
    if (ev.source !== window || ev.data?.source !== "signguard-content" || ev.data?.type !== "SG_FEE_ESTIMATE_REQ") return;
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
