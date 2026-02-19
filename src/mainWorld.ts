// ARQUIVO: src/mainWorld.ts
import { estimateFee } from "./feeEstimate";
import type { TxCostPreview } from "./shared/types";
import { shouldGateUI } from "./shared/uiGate";

const DEBUG_PREFIX = "🚀 [SignGuard MainWorld]";
/** CustomEvent name for decision (synchronous → preserves user activation for MetaMask). */
const SG_DECISION_EVENT = "__sg_decision__";

function log(msg: string, ...args: any[]) {
  console.log(`%c${DEBUG_PREFIX} ${msg}`, "color: #00ff00; font-weight: bold;", ...args);
}

function postToContent(type: "SG_REQUEST" | "SG_PREVIEW", requestId: string, payload: any) {
  window.postMessage({ source: "signguard", type, requestId, payload }, "*");
}

function toDecStringWei(v: any): string {
  try { return BigInt(v ?? "0x0").toString(10); } catch { return "0"; }
}

async function buildTxCostPreview(
  providerRequest: (args: any) => Promise<any>,
  tx: any
): Promise<TxCostPreview> {
  const valueWeiDec = toDecStringWei(tx?.value ?? "0x0");
  try {
    const fee = await estimateFee(providerRequest, tx);

    if (!fee.ok) {
      return {
        valueWei: valueWeiDec,
        feeEstimated: false,
        feeReasonKey: fee.reason ?? "fee_unknown_wallet_will_estimate",
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
      totalMaxWei: (valueWei + feeMaxWei).toString(10),
    };
  } catch {
    return {
      valueWei: valueWeiDec,
      feeEstimated: false,
      feeReasonKey: "fee_unknown_wallet_will_estimate",
    };
  }
}

function parseHexOrDecToBigInt(v: any): bigint {
  try {
    if (typeof v === "bigint") return v;
    if (typeof v === "number" && Number.isFinite(v)) return BigInt(Math.trunc(v));
    if (typeof v === "string") {
      if (v.startsWith("0x")) return BigInt(v);
      if (/^\d+$/.test(v)) return BigInt(v);
    }
  } catch {}
  return 0n;
}

async function safeGetChainIdHex(provider: any): Promise<string | null> {
  try {
    const direct = provider?.chainId;
    if (typeof direct === "string" && direct.startsWith("0x")) return direct;
  } catch {}
  try {
    const cid = await provider?.request?.({ method: "eth_chainId", params: [] });
    if (typeof cid === "string" && cid.startsWith("0x")) return cid;
  } catch {}
  return null;
}

log("Script injected and started.");

const SENSITIVE_METHODS_LIST = [
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
  "eth_signTypedData_v4",
];

const SENSITIVE_METHODS = new Set(SENSITIVE_METHODS_LIST.map((m) => String(m).toLowerCase()));

function normalizeMethod(m: any): string {
  if (m == null) return "";
  if (typeof m === "string") return m;
  if (typeof m === "object" && typeof (m as { method?: string }).method === "string") return (m as { method: string }).method;
  return String(m);
}

function isSensitive(method: string): boolean {
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

/** Unified handler: HOLDING + SG_REQUEST + await decision for sensitive methods. */
async function handleSensitiveRpc(
  method: string,
  params: any[],
  provider: any,
  originalRequest: (args: any) => Promise<any>,
  buildArgs: () => any
): Promise<any> {
  const requestId = crypto.randomUUID();
  const m = String(method || "").toLowerCase();
  const isUiGated = shouldGateUI(m);
  const tx = Array.isArray(params) ? params[0] : undefined;

  const DEFAULT_FAIL_MODE: "fail_open" | "fail_closed" = isUiGated ? "fail_closed" : "fail_open";
  const DECISION_TIMEOUT_MS = isUiGated ? 60000 : 2500;

  let chainIdHex: string | null = null;
  try {
    const direct = provider?.chainId;
    if (typeof direct === "string" && direct.startsWith("0x")) chainIdHex = direct;
  } catch {}
  if (!chainIdHex) chainIdHex = await safeGetChainIdHex(provider);

  let chainIdRequested: string | undefined;
  if (m === "wallet_switchethereumchain" || m === "wallet_addethereumchain") {
    const p0 = params?.[0];
    if (p0 && typeof p0 === "object") {
      const cidReq = (p0 as any).chainId;
      if (typeof cidReq === "string") chainIdRequested = cidReq;
    }
  }

  const initialPreview =
    (m === "eth_sendtransaction" || m === "wallet_sendtransaction") && tx && typeof tx === "object"
      ? { valueWei: toDecStringWei(tx?.value ?? "0x0"), feeEstimated: false, feeReasonKey: "fee_calculating" as const }
      : undefined;

  /** failMode per requestId (content sends SG_SETTINGS); UI-gated defaults to fail_closed. */
  const pendingFailMode: Record<string, "fail_open" | "fail_closed"> = {};
  pendingFailMode[requestId] = DEFAULT_FAIL_MODE;

  log(`📨 Sending SG_REQUEST to content: ${method} requestId=${requestId}`);
  postToContent("SG_REQUEST", requestId, {
    method,
    params,
    host: window.location.hostname,
    url: window.location.href,
    chainIdHex: chainIdHex ?? undefined,
    txCostPreview: initialPreview,
    meta: chainIdRequested ? { chainIdRequested } : undefined,
  });

  if (m === "eth_sendtransaction" || m === "wallet_sendtransaction") {
    if (tx && typeof tx === "object") {
      (async () => {
        let cid: string | null = null;
        try { cid = await originalRequest({ method: "eth_chainId", params: [] }); } catch {}
        const txCostPreview = await buildTxCostPreview(originalRequest, tx);
        postToContent("SG_PREVIEW", requestId, { chainIdHex: cid ?? undefined, txCostPreview });
      })();
    }
  }

  return new Promise((resolve, reject) => {
    let resolved = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    const args = buildArgs();

    const cleanup = () => {
      if (timeoutId != null) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      window.removeEventListener(SG_DECISION_EVENT, onDecision as EventListener);
      window.removeEventListener("message", onMessage);
      delete pendingFailMode[requestId];
    };

    const applyDecision = (allow: boolean, meta?: { uiConfirmed?: boolean; uiGate?: boolean; reasonKeys?: string[] }) => {
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
        log("Decision timeout on UI-gated method — blocking (never fail-open):", m);
        reject(new Error("SignGuard: aguardando confirmação no overlay (timeout)."));
        return;
      }

      if (failMode === "fail_open") {
        log("Decision timeout: fail_open — releasing request");
        originalRequest(args).then(resolve).catch(reject);
      } else {
        log("Decision timeout: fail_closed — blocking request");
        reject(new Error("SignGuard: request timed out; reload the page and try again."));
      }
    };

    const onDecision = (ev: Event) => {
      const ce = ev as CustomEvent;
      const data = ce?.detail ?? null;
      if (!data || data.type !== "SG_DECISION" || data.requestId !== requestId) return;
      applyDecision(!!data.allow, data.meta);
    };
    const onMessage = (ev: MessageEvent) => {
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
    window.addEventListener(SG_DECISION_EVENT, onDecision as EventListener);
    window.addEventListener("message", onMessage);
  });
}

// Função para patchear o provider
function patchProvider(provider: any) {
  if (!provider || provider._sg_patched) return;

  log("Patching found provider:", provider);

  const originalRequest = provider.request?.bind?.(provider);
  if (!originalRequest) return;
  (provider as any).__sg_originalRequest = originalRequest;

  // (1) Intercept .request
  Object.defineProperty(provider, "request", {
    value: async (args: any) => {
      const method = normalizeMethod(args?.method ?? args);
      const sensitive = isSensitive(method);
      log(`Intercepted request: ${method} (isSensitive=${sensitive})`, args);
      if (!sensitive) {
        log(`➡️ PASS-THROUGH: ${method}`);
        return originalRequest(args);
      }
      log(`🛑 HOLDING request: ${method} (reason: sensitive)`);
      return handleSensitiveRpc(method, args.params ?? [], provider, originalRequest, () => args);
    },
    configurable: true,
    writable: true
  });

  // (2) Intercept .send — assinaturas: send(method, params?) | send(payload, callback?)
  const origSend = provider.send?.bind?.(provider);
  if (origSend) {
    Object.defineProperty(provider, "send", {
      value: function (a: any, b?: any) {
        let method: string;
        let params: any[];
        let callback: (err: any, result?: any) => void | undefined;
        if (typeof a === "string") {
          method = normalizeMethod(a);
          params = Array.isArray(b) ? b : [];
          return new Promise((resolve, reject) => {
            if (!isSensitive(method)) {
              log(`➡️ PASS-THROUGH: ${method}`);
              origSend(method, params).then(resolve).catch(reject);
              return;
            }
            log(`🛑 HOLDING send: ${method} (reason: sensitive)`);
            handleSensitiveRpc(method, params, provider, originalRequest, () => ({ method, params }))
              .then(resolve)
              .catch(reject);
          });
        }
        if (a && typeof a === "object" && typeof b === "function") {
          callback = b;
          method = normalizeMethod(a.method ?? a);
          params = a.params ?? [];
          if (!isSensitive(method)) {
            log(`➡️ PASS-THROUGH: ${method}`);
            return origSend(a, callback);
          }
          log(`🛑 HOLDING send(payload,cb): ${method} (reason: sensitive)`);
          handleSensitiveRpc(method, params, provider, originalRequest, () => a)
            .then((res) => callback(null, res))
            .catch((err) => callback(err, undefined));
          return;
        }
        return origSend(a, b);
      },
      configurable: true,
      writable: true
    });
  }

  // (3) Intercept .sendAsync — sendAsync(payload, callback)
  const origSendAsync = provider.sendAsync?.bind?.(provider);
  if (origSendAsync) {
    Object.defineProperty(provider, "sendAsync", {
      value: function (payload: any, callback: (err: any, result?: any) => void) {
        const method = normalizeMethod(payload?.method ?? payload);
        const params = payload?.params ?? [];
        if (!isSensitive(method)) {
          log(`➡️ PASS-THROUGH: ${method}`);
          return origSendAsync(payload, callback);
        }
        log(`🛑 HOLDING sendAsync: ${method} (reason: sensitive)`);
        handleSensitiveRpc(method, params, provider, originalRequest, () => payload)
          .then((res) => callback(null, res))
          .catch((err) => callback(err, undefined));
      },
      configurable: true,
      writable: true
    });
  }

  (provider as any)._sg_patched = true;
  log("Provider patched successfully.");
}

/** Patch all providers in ethereum.providers array (multi-wallet). */
function patchProvidersArray(providers: any[]): void {
  if (!Array.isArray(providers)) return;
  for (let i = 0; i < providers.length; i++) {
    const p = providers[i];
    if (p && !(p as any)._sg_patched) {
      patchProvider(p);
    }
  }
}

// Inicialização com múltiplas tentativas
function init() {
  log("Initializing...");

  const ensureEthPatched = (eth: any) => {
    if (!eth) return;
    if (!(eth as any)._sg_patched) patchProvider(eth);
    const providers = eth?.providers;
    if (Array.isArray(providers)) patchProvidersArray(providers);
  };

  if ((window as any).ethereum) {
    ensureEthPatched((window as any).ethereum);
  }

  // Monitora injeção do MetaMask / multi-provider
  let storedEth = (window as any).ethereum;
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
    // Some pages may lock ethereum
  }

  // EIP-6963: intercept announced providers
  window.addEventListener("eip6963:announceProvider", ((ev: CustomEvent) => {
    const detail = ev?.detail;
    if (!detail || typeof detail !== "object") return;
    const provider = detail.provider ?? detail;
    if (provider && !(provider as any)._sg_patched) {
      log("EIP-6963: Patching announced provider", detail.info?.name ?? "?");
      patchProvider(provider);
    }
  }) as EventListener);

  // EIP-6963: request providers early + retry for late-announcing wallets
  const requestProviders = () => {
    try { window.dispatchEvent(new Event("eip6963:requestProvider")); } catch {}
  };
  requestProviders();
  setTimeout(requestProviders, 2000);
  setTimeout(requestProviders, 5000);

  // MutationObserver: re-patch when ethereum/providers change (injected late)
  try {
    const observer = new MutationObserver(() => {
      const eth = (window as any).ethereum;
      if (eth && !(eth as any)._sg_patched) {
        log("MutationObserver: unpatched provider detected. Patching...");
        patchProvider(eth);
        if (Array.isArray(eth?.providers)) patchProvidersArray(eth.providers);
      }
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
  } catch {}

  // Poll 3-5s pós-load para capturar providers que surgem depois (e EIP-6963 late)
  const pollMs = 4000;
  setInterval(() => {
    const eth = (window as any).ethereum;
    if (!eth) return;
    if (!(eth as any)._sg_patched) {
      log("Poll: unpatched provider. Patching now...");
      patchProvider(eth);
    }
    if (Array.isArray(eth?.providers)) patchProvidersArray(eth.providers);
  }, pollMs);
}

init();

const RPC_ALLOWED = new Set(["eth_call", "eth_chainid", "eth_getcode", "eth_getblockbynumber", "eth_getlogs", "eth_estimategas", "eth_gasprice", "eth_getbalance", "eth_gettransactioncount", "eth_accounts"]);

/** Canonical method names for provider (do not send lowercased to provider). */
const METHOD_CANONICAL: Record<string, string> = {
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
  wallet_addethereumchain: "wallet_addEthereumChain",
};

window.addEventListener("message", async (ev: MessageEvent) => {
  if (ev.source !== window || ev.data?.source !== "signguard-content") return;

  if (ev.data?.type === "SG_RPC_CALL_REQ") {
    const { requestId, method, params } = ev.data;
    if (!requestId || !method) return;
    const requested = String(method).trim();
    const key = requested.toLowerCase();
    if (!RPC_ALLOWED.has(key)) {
      window.postMessage({ source: "signguard-mainworld", type: "SG_RPC_CALL_RES", requestId, ok: false, error: "method_not_allowed" }, "*");
      return;
    }
    const canonical = METHOD_CANONICAL[key] ?? requested;
    const eth = (window as any).ethereum;
    const orig = eth?.__sg_originalRequest ?? eth?.request?.bind?.(eth);
    if (!orig) {
      window.postMessage({ source: "signguard-mainworld", type: "SG_RPC_CALL_RES", requestId, ok: false, error: "no_provider" }, "*");
      return;
    }
    try {
      const result = await orig({ method: canonical, params: params ?? [] });
      window.postMessage({ source: "signguard-mainworld", type: "SG_RPC_CALL_RES", requestId, ok: true, result }, "*");
    } catch (e) {
      window.postMessage({ source: "signguard-mainworld", type: "SG_RPC_CALL_RES", requestId, ok: false, error: String((e as Error)?.message ?? e) }, "*");
    }
    return;
  }

  if (ev.data?.type !== "SG_FEE_ESTIMATE_REQ") return;
  const { requestId, tx } = ev.data?.payload ?? {};
  if (!requestId || !tx) return;
  const eth = (window as any).ethereum;
  const orig = eth?.__sg_originalRequest ?? eth?.request?.bind?.(eth);
  if (!orig) {
    window.postMessage({ source: "signguard", type: "SG_FEE_ESTIMATE_RES", requestId, feeEstimate: { ok: false, feeEstimated: false, error: "no_provider" } }, "*");
    return;
  }
  try {
    const fee = await estimateFee((args: any) => orig(args), tx);
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
        gasLimitHex: fee.ok && gasLimit ? "0x" + gasLimit.toString(16) : undefined,
        feeLikelyWeiHex: fee.ok && feeLikelyWei ? "0x" + feeLikelyWei.toString(16) : undefined,
        feeMaxWeiHex: fee.ok && feeMaxWei ? "0x" + feeMaxWei.toString(16) : undefined,
        feeEstimated: fee.ok,
        feeReasonKey: fee.reason,
      },
    }, "*");
  } catch (e) {
    window.postMessage({ source: "signguard", type: "SG_FEE_ESTIMATE_RES", requestId, feeEstimate: { ok: false, feeEstimated: false, error: String((e as Error)?.message ?? e) } }, "*");
  }
});
