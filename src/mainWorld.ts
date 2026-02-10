// Runs in the MAIN world (MV3 content script with content_scripts[].world = "MAIN").
// Implements a correct "defer + resume" pipeline:
// - intercept sensitive provider.request calls and DEFER (no wallet popup yet)
// - Content script shows overlay and posts decision
// - MAIN world RESUMES by reexecuting the ORIGINAL request with bypass (no recursion)

type PendingReq = {
  invoke: () => Promise<any>;
  resolve: (v: any) => void;
  reject: (e: any) => void;
  createdAt: number;
  method: string;
};

const SG_PENDING = new Map<string, PendingReq>();
const SG_BYPASS = Symbol.for("SG_BYPASS"); // evita recursão

function sgId() {
  return (crypto?.randomUUID?.() || (Date.now() + "-" + Math.random().toString(16).slice(2)));
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("timeout")), ms);
    p.then((v) => { clearTimeout(t); resolve(v); }, (e) => { clearTimeout(t); reject(e); });
  });
}

function toBigIntHex(v: any): bigint {
  try {
    const s = String(v || "0x0");
    if (!s.startsWith("0x")) return BigInt(s); // allow decimal strings too
    return BigInt(s);
  } catch {
    return 0n;
  }
}

function weiToEthDecimal18(wei: bigint): string {
  const ONE = 10n ** 18n;
  const whole = wei / ONE;
  const frac = wei % ONE;
  const fracStr = frac.toString().padStart(18, "0");
  const trimmed = fracStr.replace(/0+$/, "");
  return trimmed ? `${whole.toString()}.${trimmed}` : whole.toString();
}

function postMessageSG(type: string, data: any) {
  try {
    window.postMessage(
      { __SIGNGUARD__: true, type, data, href: location.href, origin: location.origin, ts: Date.now() },
      "*"
    );
  } catch {}
}

function buildRpcMeta(methodLower: string, params: any, provider: any) {
  try {
    if (methodLower === "eth_sendtransaction" || methodLower === "wallet_sendtransaction") {
      const tx = Array.isArray(params) ? params[0] : undefined;
      const valueWei = toBigIntHex(tx?.value || "0x0");
      return {
        chainId: provider?.chainId ?? null,
        preflight: {
          tx,
          valueWei: valueWei.toString(10),
          valueEth: weiToEthDecimal18(valueWei),
        }
      };
    }
    if (methodLower === "wallet_switchethereumchain") {
      const chainIdRequested = Array.isArray(params) ? params?.[0]?.chainId : undefined;
      return {
        chainId: provider?.chainId ?? null,
        chainIdRequested: chainIdRequested ?? null,
      };
    }
    return { chainId: provider?.chainId ?? null };
  } catch {
    return { chainId: provider?.chainId ?? null };
  }
}

async function enrichTxFees(rawRequest: Function, tx: any) {
  try {
    const gasLimitHex = await withTimeout(
      Promise.resolve(rawRequest({ method: "eth_estimateGas", params: [tx] })),
      2500
    ) as any;

    let maxFeePerGas: bigint | null = null;
    try {
      const [prioHex, feeHistory] = await Promise.all([
        withTimeout(Promise.resolve(rawRequest({ method: "eth_maxPriorityFeePerGas", params: [] })), 2500),
        withTimeout(Promise.resolve(rawRequest({ method: "eth_feeHistory", params: ["0x1", "latest", [10]] })), 2500),
      ]) as any;
      const baseHex = (feeHistory as any)?.baseFeePerGas?.[0];
      const base = toBigIntHex(baseHex);
      const prio = toBigIntHex(prioHex);
      maxFeePerGas = (base * 2n) + prio;
    } catch {
      const gasPriceHex = await withTimeout(
        Promise.resolve(rawRequest({ method: "eth_gasPrice", params: [] })),
        2500
      ) as any;
      maxFeePerGas = toBigIntHex(gasPriceHex);
    }

    const gasLimit = toBigIntHex(gasLimitHex);
    const gasFeeWei = gasLimit * (maxFeePerGas || 0n);
    const gasFeeWeiHex = "0x" + gasFeeWei.toString(16);
    const maxFeePerGasHex = "0x" + (maxFeePerGas || 0n).toString(16);

    postMessageSG("SG_RPC_ENRICH_TX", {
      gasLimit: String(gasLimitHex),
      maxFeePerGas: maxFeePerGasHex,
      gasFeeWeiHex,
      forHref: location.href
    });
  } catch {}
}

function detectProviderHint(p: any): string {
  try {
    if (p?.isMetaMask) return "metamask";
    if (p?.isCoinbaseWallet) return "coinbase";
    return "unknown";
  } catch { return "unknown"; }
}

function wrapProvider(provider: any) {
  if (!provider || typeof provider.request !== "function") return;
  if ((provider.request as any).__sg_wrapped) return;

  const eth = provider;
  const rawRequest = eth.request?.bind(eth);
  const rawSend = eth.send?.bind(eth);
  const rawSendAsync = eth.sendAsync?.bind(eth);

  if (typeof rawRequest !== "function") return;

  async function sgRequest(args: any) {
    // bypass para reexecução
    if (args && args[SG_BYPASS]) {
      const clean = { ...args };
      delete clean[SG_BYPASS];
      return rawRequest(clean);
    }

    const method = String(args?.method || "").toLowerCase();
    const params = args?.params;

    // Non-blocking telemetry for flow tracking (content script)
    postMessageSG("SG_RPC", { method, params });

    // Async enrich for TX fees (no wallet popup)
    if ((method === "eth_sendtransaction" || method === "wallet_sendtransaction") && Array.isArray(params) && params[0] && typeof params[0] === "object") {
      void enrichTxFees(rawRequest, params[0]);
    }

    const sensitive = [
      "eth_requestaccounts",
      "wallet_requestpermissions",
      "wallet_getpermissions",
      "personal_sign",
      "eth_sign",
      "eth_signtypeddata_v4",
      "eth_signtypeddata_v3",
      "eth_signtypeddata",
      "eth_sendtransaction",
      "wallet_sendtransaction",
      "wallet_switchethereumchain",
      "wallet_addethereumchain",
      "wallet_watchasset"
    ].includes(method);

    if (!sensitive) return rawRequest(args);

    const requestId = sgId();

    return new Promise((resolve, reject) => {
      SG_PENDING.set(requestId, {
        invoke: () => Promise.resolve(rawRequest({ ...(args || {}), [SG_BYPASS]: true })),
        resolve,
        reject,
        createdAt: Date.now(),
        method
      });

      // Post request immediately (overlay can show "calculando..." and update when enrich arrives)
      window.postMessage({
        source: "signguard",
        type: "SG_REQUEST",
        requestId,
        payload: {
          url: location.href,
          host: location.host,
          method,
          params: Array.isArray(params) ? params : (params ?? null),
          chainId: provider?.chainId ?? null,
          providerHint: detectProviderHint(provider),
          meta: buildRpcMeta(method, params, provider),
        }
      }, "*");
    });
  }

  (sgRequest as any).__sg_wrapped = true;
  eth.request = sgRequest as any;

  // Wrap send (method, params) or send(payload)
  if (typeof rawSend === "function") {
    eth.send = function(methodOrPayload: any, paramsOrCb: any) {
      const payload =
        typeof methodOrPayload === "string"
          ? { method: methodOrPayload, params: Array.isArray(paramsOrCb) ? paramsOrCb : [paramsOrCb] }
          : methodOrPayload;

      const method = String(payload?.method || "").toLowerCase().trim();
      const params = payload?.params;
      postMessageSG("SG_RPC", { method, params });

      if ((method === "eth_sendtransaction" || method === "wallet_sendtransaction") && Array.isArray(params) && params[0] && typeof params[0] === "object") {
        void enrichTxFees(rawRequest, params[0]);
      }

      const sensitive = [
        "eth_requestaccounts",
        "wallet_requestpermissions",
        "wallet_getpermissions",
        "personal_sign",
        "eth_sign",
        "eth_signtypeddata_v4",
        "eth_signtypeddata_v3",
        "eth_signtypeddata",
        "eth_sendtransaction",
        "wallet_sendtransaction",
        "wallet_switchethereumchain",
        "wallet_addethereumchain",
        "wallet_watchasset"
      ].includes(method);

      if (!sensitive) return rawSend(methodOrPayload, paramsOrCb);

      const requestId = sgId();
      return new Promise((resolve, reject) => {
        SG_PENDING.set(requestId, {
          invoke: () => Promise.resolve(rawSend(methodOrPayload, paramsOrCb)),
          resolve,
          reject,
          createdAt: Date.now(),
          method,
        });

        window.postMessage({
          source: "signguard",
          type: "SG_REQUEST",
          requestId,
          payload: {
            url: location.href,
            host: location.host,
            method,
            params: Array.isArray(params) ? params : (params ?? null),
            chainId: provider?.chainId ?? null,
            providerHint: detectProviderHint(provider),
            meta: buildRpcMeta(method, params, provider),
          }
        }, "*");
      });
    } as any;
  }

  // Wrap sendAsync(payload, cb)
  if (typeof rawSendAsync === "function") {
    eth.sendAsync = function(payload: any, cb: any) {
      const method = String(payload?.method || "").toLowerCase().trim();
      const params = payload?.params;
      postMessageSG("SG_RPC", { method, params });

      if ((method === "eth_sendtransaction" || method === "wallet_sendtransaction") && Array.isArray(params) && params[0] && typeof params[0] === "object") {
        void enrichTxFees(rawRequest, params[0]);
      }

      const sensitive = [
        "eth_requestaccounts",
        "wallet_requestpermissions",
        "wallet_getpermissions",
        "personal_sign",
        "eth_sign",
        "eth_signtypeddata_v4",
        "eth_signtypeddata_v3",
        "eth_signtypeddata",
        "eth_sendtransaction",
        "wallet_sendtransaction",
        "wallet_switchethereumchain",
        "wallet_addethereumchain",
        "wallet_watchasset"
      ].includes(method);

      if (!sensitive) return rawSendAsync(payload, cb);

      const requestId = sgId();
      const doneCb = (typeof cb === "function") ? cb : (() => {});

      return new Promise((resolve, reject) => {
        SG_PENDING.set(requestId, {
          invoke: () =>
            new Promise((res, rej) => {
              try {
                rawSendAsync(payload, (err: any, resp: any) => {
                  if (err) return rej(err);
                  res(resp);
                });
              } catch (e) { rej(e); }
            }),
          resolve: (v) => { try { doneCb(null, v); } catch {} resolve(v); },
          reject: (e) => { try { doneCb(e); } catch {} reject(e); },
          createdAt: Date.now(),
          method,
        });

        window.postMessage({
          source: "signguard",
          type: "SG_REQUEST",
          requestId,
          payload: {
            url: location.href,
            host: location.host,
            method,
            params: Array.isArray(params) ? params : (params ?? null),
            chainId: provider?.chainId ?? null,
            providerHint: detectProviderHint(provider),
            meta: buildRpcMeta(method, params, provider),
          }
        }, "*");
      });
    } as any;
  }
}

function rejectEIP1193UserRejected(method: string) {
  return { code: 4001, message: "User rejected the request", data: { method } };
}

async function resumeDecisionInner(requestId: string, allow: boolean) {
  try {
    const pending = SG_PENDING.get(requestId);
    if (!pending) return;

    SG_PENDING.delete(requestId);

    if (!allow) {
      pending.reject({ code: 4001, message: "User rejected the request", data: { method: pending.method } });
      return;
    }

    // RESUME IMEDIATO (precisa ocorrer dentro do user gesture)
    try {
      const res = await pending.invoke();
      pending.resolve(res);
    } catch (e) {
      pending.reject(e);
    }
  } catch {}
}

// Primary path: synchronous CustomEvent (preserves user gesture)
window.addEventListener("signguard:decision", async (ev: any) => {
  try {
    const detail = ev?.detail || {};
    const requestId = String(detail.requestId || "");
    const allow = !!detail.allow;
    await resumeDecisionInner(requestId, allow);
  } catch {}
}, { passive: true });

// Back-compat: previous event name
window.addEventListener("sg:decision", async (ev: any) => {
  try {
    const detail = ev?.detail || {};
    const requestId = String(detail.requestId || "");
    const allow = !!detail.allow;
    await resumeDecisionInner(requestId, allow);
  } catch {}
}, { passive: true });

// Fallback: SG_DECISION via postMessage funnels into same logic
window.addEventListener("message", (ev) => {
  try {
    if (ev.source !== window) return;
    const d = (ev as any)?.data;
    if (!d || (d.source !== "signguard" && d.source !== "signguard-content")) return;
    if (d.type !== "SG_DECISION") return;
    void resumeDecisionInner(String(d.requestId || ""), !!d.allow);
  } catch {}
});

setInterval(() => {
  const now = Date.now();
  for (const [id, p] of SG_PENDING.entries()) {
    if (now - p.createdAt > 60000) {
      SG_PENDING.delete(id);
      // fail-open: tenta executar
      Promise.resolve()
        .then(() => p.invoke())
        .then(p.resolve)
        .catch(p.reject);
    }
  }
}, 5000);

function tryWrapAll() {
  const eth: any = (window as any).ethereum;
  if (eth) {
    wrapProvider(eth);
    if (Array.isArray(eth.providers)) {
      for (const p of eth.providers) wrapProvider(p);
    }
  }
}

function startWrapRetry() {
  window.addEventListener("ethereum#initialized", () => tryWrapAll(), { once: false } as any);

  window.addEventListener("eip6963:announceProvider", (event: any) => {
    try {
      const provider = event?.detail?.provider;
      wrapProvider(provider);
    } catch {}
  });
  try { window.dispatchEvent(new Event("eip6963:requestProvider")); } catch {}

  const started = Date.now();
  const interval = setInterval(() => {
    tryWrapAll();
    if (Date.now() - started > 10_000) clearInterval(interval);
  }, 50);

  try {
    const mo = new MutationObserver(() => tryWrapAll());
    mo.observe(document.documentElement, { childList: true, subtree: true });
    setTimeout(() => mo.disconnect(), 10_000);
  } catch {}
}

// document_start
tryWrapAll();
startWrapRetry();

