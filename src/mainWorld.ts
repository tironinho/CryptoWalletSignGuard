// Runs in the MAIN world (MV3 content script with content_scripts[].world = "MAIN").
(window as any).__signguard_mainworld = true;
// Implements a correct "defer + resume" pipeline:
import { estimateFee } from "./feeEstimate";
import { detectEvmWallet, detectSolWallet, detectWalletFromProvider, detectWalletBrand, listEvmProviders } from "./walletDetect";
// - intercept sensitive provider.request calls and DEFER (no wallet popup yet)
// - Content script shows overlay and posts decision
// - MAIN world RESUMES by reexecuting the ORIGINAL request with bypass (no recursion)

const TIMEOUT_MS_UI = 480000;     // 8 min when UI shown; keepalive resets
const TIMEOUT_MS_FAILOPEN = 5000; // 5s when no UI yet (fail-open)
const KEEPALIVE_CAP_MS = 900000;  // 15 min max lifetime from creation when UI shown

type PendingReq = {
  resolve: (v: any) => void;
  reject: (e: any) => void;
  runOriginal: () => Promise<any>;
  createdAt: number;
  lastKeepaliveAt?: number;
  method: string;
  uiShown?: boolean;
};

const pendingCalls = new Map<string, PendingReq>();
const SG_BYPASS = Symbol.for("SG_BYPASS"); // evita recursão

function sgId() {
  return (crypto?.randomUUID?.() || (Date.now() + "-" + Math.random().toString(16).slice(2)));
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

type EIP6963Provider = { uuid: string; name: string; icon?: string; rdns?: string; providerRef: any };

const SG_ANNOUNCED_PROVIDERS: EIP6963Provider[] = [];
let SG_ACTIVE_PROVIDER: any = null;

function selectActiveProvider(): any {
  const w = typeof window !== "undefined" ? (window as any) : null;
  const eth = w?.ethereum;
  if (eth) return eth;
  const first = SG_ANNOUNCED_PROVIDERS[0]?.providerRef;
  return first || null;
}

function applyActiveProvider() {
  const next = selectActiveProvider();
  if (next && next !== SG_ACTIVE_PROVIDER) {
    SG_ACTIVE_PROVIDER = next;
    wrapProvider(next, undefined, "window.ethereum");
  }
}

function wrapProvider(provider: any, providerTag?: string, providerSource?: "window.ethereum" | "ethereum.providers[i]" | "eip6963", providerIndex?: number | string, eip6963DisplayName?: string) {
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

    // For send tx: estimate fees BEFORE opening overlay (read-only, no wallet popup)
    let txCostPreview: any = undefined;
    if ((method === "eth_sendtransaction" || method === "wallet_sendtransaction") && Array.isArray(params) && params[0] && typeof params[0] === "object") {
      const tx = params[0];
      const providerRequest = (a: any) => rawRequest(a);
      const fee = await estimateFee(providerRequest, tx);
      const valueWei = BigInt(typeof tx?.value === "string" ? tx.value : (tx?.value ?? "0x0"));
      txCostPreview = {
        valueWei: valueWei.toString(10),
        feeEstimated: fee.ok,
      };
      if (fee.ok && fee.feeLikelyWei !== undefined && fee.feeMaxWei !== undefined) {
        if (fee.gasLimit) txCostPreview.gasLimitWei = fee.gasLimit.toString(10);
        txCostPreview.feeLikelyWei = fee.feeLikelyWei.toString(10);
        txCostPreview.feeMaxWei = fee.feeMaxWei.toString(10);
        txCostPreview.totalLikelyWei = (valueWei + fee.feeLikelyWei).toString(10);
        txCostPreview.totalMaxWei = (valueWei + fee.feeMaxWei).toString(10);
      } else {
        txCostPreview.feeReasonKey = "fee_unknown_wallet_will_estimate";
      }
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
      "eth_signtransaction",
      "eth_sendtransaction",
      "wallet_sendtransaction",
      "wallet_switchethereumchain",
      "wallet_addethereumchain",
      "wallet_watchasset"
    ].includes(method);

    if (!sensitive) return rawRequest(args);

    const requestId = sgId();

    return new Promise((resolve, reject) => {
      pendingCalls.set(requestId, {
        resolve,
        reject,
        runOriginal: () => rawRequest({ ...(args || {}), [SG_BYPASS]: true }),
        createdAt: Date.now(),
        method,
        uiShown: false
      });

      const walletMeta = detectWalletFromProvider(provider);
      const walletInfo = detectEvmWallet(provider, eip6963DisplayName);
      const walletBrand = detectWalletBrand(provider, eip6963DisplayName);
      const providerKey = [providerSource || "window.ethereum", walletMeta.id, providerIndex ?? ""].filter(Boolean).join(":");
      try {
        window.postMessage({
          source: "signguard-inpage",
          type: "SG_REQUEST",
          requestId,
          payload: {
            id: requestId,
            url: location.href,
            origin: location.origin,
            host: location.host,
            method,
            params: Array.isArray(params) ? params : (params ?? null),
            chainId: provider?.chainId ?? null,
            wallet: { ...walletInfo, id: walletMeta.id, walletBrand, walletName: walletInfo.walletName || walletBrand },
            providerKey,
            providerSource: providerSource || "window.ethereum",
            request: { method, params: Array.isArray(params) ? params : undefined },
            providerTag,
            providerHint: { kind: walletInfo.name, name: walletInfo.name },
            meta: buildRpcMeta(method, params, provider),
            txCostPreview,
          }
        }, "*");
      } catch {}
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

      const sensitive = [
        "eth_requestaccounts",
        "wallet_requestpermissions",
        "wallet_getpermissions",
        "personal_sign",
        "eth_sign",
        "eth_signtypeddata_v4",
        "eth_signtypeddata_v3",
        "eth_signtypeddata",
        "eth_signtransaction",
        "eth_sendtransaction",
        "wallet_sendtransaction",
        "wallet_switchethereumchain",
        "wallet_addethereumchain",
        "wallet_watchasset"
      ].includes(method);

      if (!sensitive) return rawSend(methodOrPayload, paramsOrCb);

      const requestId = sgId();
      (async () => {
        let txCostPreview: any = undefined;
        if ((method === "eth_sendtransaction" || method === "wallet_sendtransaction") && Array.isArray(params) && params[0] && typeof params[0] === "object") {
          const tx = params[0];
          const fee = await estimateFee((a: any) => rawRequest(a), tx);
          const valueWei = BigInt(typeof tx?.value === "string" ? tx.value : (tx?.value ?? "0x0"));
          txCostPreview = { valueWei: valueWei.toString(10), feeEstimated: fee.ok };
          if (fee.ok && fee.feeLikelyWei !== undefined && fee.feeMaxWei !== undefined) {
            if (fee.gasLimit) txCostPreview.gasLimitWei = fee.gasLimit.toString(10);
            txCostPreview.feeLikelyWei = fee.feeLikelyWei.toString(10);
            txCostPreview.feeMaxWei = fee.feeMaxWei.toString(10);
            txCostPreview.totalLikelyWei = (valueWei + fee.feeLikelyWei).toString(10);
            txCostPreview.totalMaxWei = (valueWei + fee.feeMaxWei).toString(10);
          } else {
            txCostPreview.feeReasonKey = "fee_unknown_wallet_will_estimate";
          }
        }
        const walletMetaInner = detectWalletFromProvider(provider);
        const walletInfo = detectEvmWallet(provider, eip6963DisplayName);
        const walletBrandInner = detectWalletBrand(provider, eip6963DisplayName);
        const providerKey = [providerSource || "window.ethereum", walletMetaInner.id, providerIndex ?? ""].filter(Boolean).join(":");
        try {
          window.postMessage({
            source: "signguard-inpage",
            type: "SG_REQUEST",
            requestId,
            payload: {
              id: requestId,
              url: location.href,
              origin: location.origin,
              host: location.host,
              method,
              params: Array.isArray(params) ? params : (params ?? null),
              chainId: provider?.chainId ?? null,
              wallet: { ...walletInfo, id: walletMetaInner.id, walletBrand: walletBrandInner, walletName: walletInfo.walletName || walletBrandInner },
              providerKey,
              providerSource: providerSource || "window.ethereum",
              request: { method, params: Array.isArray(params) ? params : undefined },
              providerTag,
              providerHint: { kind: walletInfo.name, name: walletInfo.name },
              meta: buildRpcMeta(method, params, provider),
              txCostPreview,
            }
          }, "*");
        } catch {}
      })();
      return new Promise((resolve, reject) => {
        pendingCalls.set(requestId, {
          resolve,
          reject,
          runOriginal: () => Promise.resolve(rawSend(methodOrPayload, paramsOrCb)),
          createdAt: Date.now(),
          method,
          uiShown: false,
        });
      });
    } as any;
  }

  // Wrap sendAsync(payload, cb)
  if (typeof rawSendAsync === "function") {
    eth.sendAsync = function(payload: any, cb: any) {
      const method = String(payload?.method || "").toLowerCase().trim();
      const params = payload?.params;
      postMessageSG("SG_RPC", { method, params });

      const sensitive = [
        "eth_requestaccounts",
        "wallet_requestpermissions",
        "wallet_getpermissions",
        "personal_sign",
        "eth_sign",
        "eth_signtypeddata_v4",
        "eth_signtypeddata_v3",
        "eth_signtypeddata",
        "eth_signtransaction",
        "eth_sendtransaction",
        "wallet_sendtransaction",
        "wallet_switchethereumchain",
        "wallet_addethereumchain",
        "wallet_watchasset"
      ].includes(method);

      if (!sensitive) return rawSendAsync(payload, cb);

      const requestId = sgId();
      const doneCb = (typeof cb === "function") ? cb : (() => {});

      (async () => {
        let txCostPreview: any = undefined;
        if ((method === "eth_sendtransaction" || method === "wallet_sendtransaction") && Array.isArray(params) && params[0] && typeof params[0] === "object") {
          const tx = params[0];
          const fee = await estimateFee((a: any) => rawRequest(a), tx);
          const valueWei = BigInt(typeof tx?.value === "string" ? tx.value : (tx?.value ?? "0x0"));
          txCostPreview = { valueWei: valueWei.toString(10), feeEstimated: fee.ok };
          if (fee.ok && fee.feeLikelyWei !== undefined && fee.feeMaxWei !== undefined) {
            if (fee.gasLimit) txCostPreview.gasLimitWei = fee.gasLimit.toString(10);
            txCostPreview.feeLikelyWei = fee.feeLikelyWei.toString(10);
            txCostPreview.feeMaxWei = fee.feeMaxWei.toString(10);
            txCostPreview.totalLikelyWei = (valueWei + fee.feeLikelyWei).toString(10);
            txCostPreview.totalMaxWei = (valueWei + fee.feeMaxWei).toString(10);
          } else {
            txCostPreview.feeReasonKey = "fee_unknown_wallet_will_estimate";
          }
        }
        const walletMetaAsync = detectWalletFromProvider(provider);
        const walletInfo = detectEvmWallet(provider, eip6963DisplayName);
        const walletBrandAsync = detectWalletBrand(provider, eip6963DisplayName);
        const providerKey = [providerSource || "window.ethereum", walletMetaAsync.id, providerIndex ?? ""].filter(Boolean).join(":");
        try {
          window.postMessage({
            source: "signguard-inpage",
            type: "SG_REQUEST",
            requestId,
            payload: {
              id: requestId,
              url: location.href,
              origin: location.origin,
              host: location.host,
              method,
              params: Array.isArray(params) ? params : (params ?? null),
              chainId: provider?.chainId ?? null,
              wallet: { ...walletInfo, id: walletMetaAsync.id, walletBrand: walletBrandAsync, walletName: walletInfo.walletName || walletBrandAsync },
              providerKey,
              providerSource: providerSource || "window.ethereum",
              request: { method, params: Array.isArray(params) ? params : undefined },
              providerTag,
              providerHint: { kind: walletInfo.name, name: walletInfo.name },
              meta: buildRpcMeta(method, params, provider),
              txCostPreview,
            }
          }, "*");
        } catch {}
      })();
      return new Promise((resolve, reject) => {
        pendingCalls.set(requestId, {
          resolve: (v) => { try { doneCb(null, v); } catch {} resolve(v); },
          reject: (e) => { try { doneCb(e); } catch {} reject(e); },
          runOriginal: () =>
            new Promise((res, rej) => {
              try {
                rawSendAsync(payload, (err: any, resp: any) => {
                  if (err) return rej(err);
                  res(resp);
                });
              } catch (e) { rej(e); }
            }),
          createdAt: Date.now(),
          method,
          uiShown: false,
        });
      });
    } as any;
  }
}

function rejectEIP1193UserRejected(method: string) {
  return { code: 4001, message: "User rejected the request", data: { method } };
}

function resumeDecisionInner(requestId: string, allow: boolean, errorMessage?: string) {
  try {
    const pending = pendingCalls.get(requestId);
    if (!pending) return;

    pendingCalls.delete(requestId);

    if (!allow) {
      const msg = typeof errorMessage === "string" && errorMessage.trim() ? errorMessage.trim() : "User rejected the request";
      pending.reject({ code: 4001, message: msg, data: { method: pending.method } });
      try {
        window.postMessage({ source: "signguard", type: "SG_DECISION_ACK", requestId, allow: false }, "*");
      } catch {}
      return;
    }

    try {
      const promise = pending.runOriginal();
      promise.then(pending.resolve).catch(pending.reject);
      try {
        window.postMessage({ source: "signguard", type: "SG_DECISION_ACK", requestId, allow: true }, "*");
      } catch {}
    } catch (e) {
      pending.reject(e);
      try {
        window.postMessage({ source: "signguard", type: "SG_DECISION_ACK", requestId, allow: false }, "*");
      } catch {}
    }
  } catch {}
}

function markUiShown(requestId: string) {
  try {
    const p = pendingCalls.get(requestId);
    if (p) {
      p.uiShown = true;
      p.lastKeepaliveAt = Date.now();
    }
  } catch {}
}

function handleKeepalive(requestId: string) {
  try {
    const p = pendingCalls.get(requestId);
    if (p) p.lastKeepaliveAt = Date.now();
  } catch {}
}

// Content marks overlay shown (affects timeout: uiShown => reject on timeout, else fail-open)
window.addEventListener("signguard:uiShown", (ev: any) => {
  try {
    const detail = ev?.detail || {};
    const requestId = String(detail.requestId || "");
    if (!requestId) return;
    markUiShown(requestId);
  } catch {}
}, true);

window.addEventListener("message", (ev) => {
  try {
    if (ev.source !== window) return;
    const d = (ev as any)?.data;
    if (!d || (d.source !== "signguard" && d.source !== "signguard-content")) return;
    if (d.type === "SG_UI_SHOWN") markUiShown(String(d.requestId || ""));
    if (d.type === "SG_KEEPALIVE") handleKeepalive(String(d.requestId || ""));
  } catch {}
});

// CRITICAL: Click capture in MAIN world so resume runs in same user-activation stack (MetaMask opens 100%)
window.addEventListener("click", (ev: MouseEvent) => {
  try {
    const path = ev.composedPath && ev.composedPath();
    if (!path || !Array.isArray(path) || path.length === 0) return;
    let allow: boolean | null = null;
    for (let i = 0; i < path.length; i++) {
      const el = path[i] as Element | undefined;
      if (!el || typeof el.getAttribute !== "function") continue;
      const id = el.id;
      if (id === "sg-continue" || id === "sg-proceed") { allow = true; break; }
      if (id === "sg-cancel" || id === "sg-close") { allow = false; break; }
    }
    if (allow === null) return;
    let overlayRoot: Element | null = null;
    for (let i = 0; i < path.length; i++) {
      const el = path[i] as Element | undefined;
      if (el?.getAttribute?.("data-sg-overlay") === "1") {
        overlayRoot = el;
        break;
      }
    }
    if (!overlayRoot) return;
    const requestId = overlayRoot.getAttribute("data-sg-request-id") || "";
    if (!requestId) return;
    if (!pendingCalls.has(requestId)) return;
    resumeDecisionInner(requestId, allow);
    ev.preventDefault();
    ev.stopImmediatePropagation();
  } catch {}
}, true);

// Fallback path: CustomEvent from content (when click capture did not run)
window.addEventListener("signguard:decision", (ev: any) => {
  try {
    const detail = ev?.detail || {};
    const requestId = String(detail.requestId || "");
    const allow = !!detail.allow;
    const errorMessage = detail.errorMessage;
    resumeDecisionInner(requestId, allow, errorMessage);
  } catch {}
}, true);

// Back-compat: previous event name
window.addEventListener("sg:decision", (ev: any) => {
  try {
    const detail = ev?.detail || {};
    const requestId = String(detail.requestId || "");
    const allow = !!detail.allow;
    const errorMessage = detail.errorMessage;
    resumeDecisionInner(requestId, allow, errorMessage);
  } catch {}
}, true);

// Fallback: SG_DECISION via postMessage funnels into same logic
window.addEventListener("message", (ev) => {
  try {
    if (ev.source !== window) return;
    const d = (ev as any)?.data;
    if (!d || (d.source !== "signguard" && d.source !== "signguard-content")) return;
    if (d.type !== "SG_DECISION") return;
    void resumeDecisionInner(String(d.requestId || ""), !!d.allow, d.errorMessage);
  } catch {}
});

setInterval(() => {
  const now = Date.now();
  for (const [id, p] of pendingCalls.entries()) {
    const base = p.lastKeepaliveAt ?? p.createdAt;
    const timeout = p.uiShown ? TIMEOUT_MS_UI : TIMEOUT_MS_FAILOPEN;
    const expiresAt = p.uiShown
      ? Math.min(base + timeout, p.createdAt + KEEPALIVE_CAP_MS)
      : base + timeout;
    if (now > expiresAt) {
      pendingCalls.delete(id);
      if (p.uiShown) {
        p.reject({ code: 4001, message: "SignGuard: timeout" });
        continue;
      }
      try {
        const promise = p.runOriginal();
        promise.then(p.resolve).catch(p.reject);
      } catch (e) {
        p.reject(e);
      }
    }
  }
}, 5000);

function tryWrapAll() {
  const providers = listEvmProviders();
  const eth = (window as any)?.ethereum;
  for (let i = 0; i < providers.length; i++) {
    const p = providers[i];
    const src: "window.ethereum" | "ethereum.providers[i]" = (i === 0 && p === eth) ? "window.ethereum" : "ethereum.providers[i]";
    wrapProvider(p, i > 0 ? `provider-${i}` : undefined, src, String(i));
  }
  if (providers.length === 0) applyActiveProvider();
  tryWrapSolana();
}

function tryWrapSolana() {
  const sol: any = (window as any).solana;
  if (!sol || (sol as any).__sg_wrapped) return;
  const methods = ["connect", "signMessage", "signTransaction", "signAllTransactions", "signAndSendTransaction"];
  for (const m of methods) {
    if (typeof sol[m] !== "function") continue;
    const raw = sol[m].bind(sol);
    (sol as any)[m] = function (...args: any[]) {
      const wallet = detectSolWallet(sol);
      const requestId = sgId();
      return new Promise((resolve, reject) => {
        pendingCalls.set(requestId, {
          resolve,
          reject,
          runOriginal: () => Promise.resolve(raw(...args)),
          createdAt: Date.now(),
          method: `solana:${m}`,
          uiShown: false,
        });
        try {
          window.postMessage({
            source: "signguard-inpage",
            type: "SG_REQUEST",
            requestId,
            payload: {
              id: requestId,
              url: location.href,
              origin: location.origin,
              host: location.host,
              method: `solana:${m}`,
              params: args?.length ? [{ method: m, argsCount: args.length }] : null,
              wallet,
              request: { method: `solana:${m}`, params: args },
              meta: { chainId: null },
            }
          }, "*");
        } catch {}
      });
    };
  }
  (sol as any).__sg_wrapped = true;
}

function startWrapRetry() {
  window.addEventListener("ethereum#initialized", () => tryWrapAll(), { once: false } as any);

  window.addEventListener("eip6963:announceProvider", (event: any) => {
    try {
      const info = event?.detail?.info;
      const provider = event?.detail?.provider;
      if (info && provider) {
        const existing = SG_ANNOUNCED_PROVIDERS.find((p) => p.uuid === info.uuid);
        if (!existing) {
          SG_ANNOUNCED_PROVIDERS.push({
            uuid: info.uuid || "",
            name: info.name || "Unknown",
            icon: info.icon,
            rdns: info.rdns,
            providerRef: provider,
          });
          wrapProvider(provider, info.rdns || info.name, "eip6963", info.uuid, info.name);
        }
        applyActiveProvider();
      }
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

// REWRAP guard: window.ethereum and window.solana can change after load
function startProviderGuardRewrap() {
  let lastEth: any = null;
  let lastReqFn: any = null;
  let lastSolana: any = null;
  let tries = 0;
  const maxTries = 10;
  const timer = setInterval(() => {
    tries++;
    try {
      const eth: any = (window as any).ethereum;
      const reqFn = eth?.request;
      const sol: any = (window as any).solana;

      const ethChanged = !!eth && eth !== lastEth;
      const reqChanged = !!eth && typeof reqFn === "function" && reqFn !== lastReqFn;
      const notWrapped = !!eth && typeof reqFn === "function" && !(reqFn as any).__sg_wrapped;
      const solChanged = !!sol && sol !== lastSolana;
      const solNotWrapped = !!sol && !(sol as any).__sg_wrapped;

      if (ethChanged || reqChanged || notWrapped || solChanged || solNotWrapped) {
        tryWrapAll();
        lastEth = eth || null;
        lastReqFn = eth?.request || null;
        lastSolana = sol || null;
      }
    } catch {}

    if (tries >= maxTries) {
      try { clearInterval(timer); } catch {}
    }
  }, 500);
}

// RPC bridge: readonly eth_call / eth_chainId for asset lookup
const ALLOWED_RPC_METHODS = new Set(["eth_call", "eth_chainid", "eth_getCode"]);
window.addEventListener("message", (ev: MessageEvent) => {
  try {
    if (ev.source !== window) return;
    const d = (ev as any)?.data;
    if (!d || d.source !== "signguard-content" || d.type !== "SG_RPC_CALL_REQUEST") return;
    const { id, method, params } = d;
    const methodNorm = String(method || "").toLowerCase();
    if (!ALLOWED_RPC_METHODS.has(methodNorm)) {
      window.postMessage({ source: "signguard", type: "SG_RPC_CALL_RESPONSE", id, error: "method_not_allowed" }, "*");
      return;
    }
    const eth = (window as any).ethereum || SG_ACTIVE_PROVIDER;
    if (!eth?.request) {
      window.postMessage({ source: "signguard", type: "SG_RPC_CALL_RESPONSE", id, error: "no_provider" }, "*");
      return;
    }
    Promise.resolve(eth.request({ method: methodNorm, params: params || [] }))
      .then((result: any) => window.postMessage({ source: "signguard", type: "SG_RPC_CALL_RESPONSE", id, result }, "*"))
      .catch((err: any) => window.postMessage({ source: "signguard", type: "SG_RPC_CALL_RESPONSE", id, error: String(err?.message || err) }, "*"));
  } catch {}
});

// document_start
tryWrapAll();
startWrapRetry();
startProviderGuardRewrap();

