// Runs in the MAIN world (MV3 content script with content_scripts[].world = "MAIN").
// Universal wrapper for EIP-1193 + legacy entrypoints so no call path "escapes"
// (request/send/sendAsync/enable + EIP-6963 announced providers).

type EthRequest = { method: string; params?: any[]; rawShape?: string; raw?: any };

type MainToContentMsg = {
  source: "signguard-main";
  type: "SG_REQUEST";
  requestId: string;
  url: string;
  origin: string;
  request: EthRequest;
};

type ContentToMainMsg =
  | { source: "signguard-content"; type: "SG_READY" }
  | { source: "signguard-content"; type: "SG_DECISION"; requestId: string; allow: boolean };

type JsonRpcPayload = {
  id?: unknown;
  jsonrpc?: string;
  method: string;
  params?: any;
};

type JsonRpcCallback = (err: any, result?: any) => void;

function randomId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function userRejectedError() {
  const err: any = new Error("SignGuard: request cancelled by user");
  err.code = 4001; // EIP-1193 user rejected request
  return err;
}

const pending = new Map<string, { resolve: (v: boolean) => void }>();
let contentReady = false;
let readyResolver: (() => void) | null = null;

function waitForContentReady(timeoutMs = 500): Promise<void> {
  if (contentReady) return Promise.resolve();
  if (readyResolver) {
    return new Promise((resolve) => {
      const prev = readyResolver;
      readyResolver = () => {
        prev?.();
        resolve();
      };
      setTimeout(resolve, timeoutMs);
    });
  }
  return new Promise((resolve) => {
    readyResolver = () => resolve();
    setTimeout(resolve, timeoutMs);
  });
}

window.addEventListener("message", (event) => {
  if (event.source !== window) return;
  const data = event.data as ContentToMainMsg;
  if (!data || data.source !== "signguard-content") return;

  if (data.type === "SG_READY") {
    contentReady = true;
    const r = readyResolver;
    readyResolver = null;
    r?.();
    return;
  }

  if (data.type === "SG_DECISION") {
    const p = pending.get(data.requestId);
    if (!p) return;
    pending.delete(data.requestId);
    p.resolve(!!data.allow);
  }
});

function shouldIntercept(methodLower: string) {
  return (
    methodLower === "eth_requestaccounts" ||
    methodLower === "wallet_requestpermissions" ||
    methodLower === "eth_sendtransaction" ||
    methodLower === "eth_signtypeddata_v4" ||
    methodLower === "personal_sign" ||
    methodLower === "eth_sign" ||
    // bonus (WARN)
    methodLower === "wallet_switchethereumchain" ||
    methodLower === "wallet_addethereumchain" ||
    methodLower === "wallet_watchasset"
  );
}

function normalizeCall(args: any[]): { method: string; params?: any[]; raw: any; rawShape: string; cb?: JsonRpcCallback } | null {
  // request({method, params})
  if (args.length === 1 && args[0] && typeof args[0] === "object" && typeof args[0].method === "string") {
    const req = args[0] as { method: string; params?: any };
    return {
      method: req.method,
      params: Array.isArray(req.params) ? req.params : req.params !== undefined ? [req.params] : undefined,
      raw: req,
      rawShape: "request(object)",
    };
  }

  // send(method, params?) => Promise
  if (typeof args[0] === "string") {
    const method = args[0] as string;
    const p = args.length >= 2 ? args[1] : undefined;
    const params = Array.isArray(p) ? p : p !== undefined ? [p] : undefined;
    return { method, params, raw: { method, params: p }, rawShape: "send(method, params)" };
  }

  // send(payload, cb) / sendAsync(payload, cb)
  if (args[0] && typeof args[0] === "object" && typeof (args[0] as any).method === "string" && typeof args[1] === "function") {
    const payload = args[0] as JsonRpcPayload;
    const cb = args[1] as JsonRpcCallback;
    const params = Array.isArray(payload.params) ? payload.params : payload.params !== undefined ? [payload.params] : undefined;
    return { method: payload.method, params, raw: payload, rawShape: "send(payload, cb)", cb };
  }

  // send(payload) => Promise (some providers support this)
  if (args[0] && typeof args[0] === "object" && typeof (args[0] as any).method === "string") {
    const payload = args[0] as JsonRpcPayload;
    const params = Array.isArray(payload.params) ? payload.params : payload.params !== undefined ? [payload.params] : undefined;
    return { method: payload.method, params, raw: payload, rawShape: "send(payload)" };
  }

  // enable()
  if (args.length === 0) {
    return { method: "eth_requestAccounts", params: undefined, raw: null, rawShape: "enable()" };
  }

  return null;
}

function buildReqObject(method: string, params: any[] | undefined, raw: any, rawShape: string): EthRequest {
  return { method, params, raw, rawShape };
}

async function gateRequest(method: string, params: any[] | undefined, raw: any, rawShape: string): Promise<boolean> {
  const methodLower = (method || "").toLowerCase();
  if (!shouldIntercept(methodLower)) return true;

  console.debug("[SignGuard] intercept", methodLower);

  await waitForContentReady(500);
  const requestId = randomId();
  const msg: MainToContentMsg = {
    source: "signguard-main",
    type: "SG_REQUEST",
    requestId,
    url: location.href,
    origin: location.origin,
    request: buildReqObject(method, params, raw, rawShape),
  };

  window.postMessage(msg, "*");

  // fail-open timeout
  return new Promise((resolve) => {
    pending.set(requestId, { resolve });
    setTimeout(() => {
      if (!pending.has(requestId)) return;
      pending.delete(requestId);
      resolve(true);
    }, 12_000);
  });
}

function markWrapped(provider: any) {
  try {
    Object.defineProperty(provider, "__signguardWrapped", {
      value: true,
      configurable: true,
      enumerable: false,
      writable: false,
    });
  } catch {
    provider.__signguardWrapped = true;
  }
}

function wrapProvider(provider: any) {
  if (!provider || provider.__signguardWrapped) return;

  const originalRequest = typeof provider.request === "function" ? provider.request.bind(provider) : null;
  const originalSend = typeof provider.send === "function" ? provider.send.bind(provider) : null;
  const originalSendAsync = typeof provider.sendAsync === "function" ? provider.sendAsync.bind(provider) : null;
  const originalEnable = typeof provider.enable === "function" ? provider.enable.bind(provider) : null;

  if (originalRequest) {
    provider.request = async (...args: any[]) => {
      const norm = normalizeCall(args);
      if (!norm) return originalRequest(...args);
      const allow = await gateRequest(norm.method, norm.params, norm.raw, norm.rawShape);
      if (!allow) throw userRejectedError();
      return originalRequest(...args);
    };
  }

  if (originalEnable) {
    provider.enable = async (...args: any[]) => {
      const norm = normalizeCall([]); // enable() => eth_requestAccounts
      const allow = await gateRequest(norm!.method, norm!.params, norm!.raw, norm!.rawShape);
      if (!allow) throw userRejectedError();
      return originalEnable(...args);
    };
  }

  if (originalSend) {
    provider.send = (...args: any[]) => {
      const norm = normalizeCall(args);
      if (!norm) return originalSend(...args);

      // callback signature: send(payload, cb)
      if (norm.cb) {
        gateRequest(norm.method, norm.params, norm.raw, norm.rawShape)
          .then((allow) => {
            if (!allow) return norm.cb!(userRejectedError());
            return originalSend(...args);
          })
          .catch((e) => norm.cb!(e));
        return;
      }

      // promise-ish signature: send(method, params?)
      return (async () => {
        const allow = await gateRequest(norm.method, norm.params, norm.raw, norm.rawShape);
        if (!allow) throw userRejectedError();
        return originalSend(...args);
      })();
    };
  }

  if (originalSendAsync) {
    provider.sendAsync = (...args: any[]) => {
      const norm = normalizeCall(args);
      if (!norm || !norm.cb) return originalSendAsync(...args);

      gateRequest(norm.method, norm.params, norm.raw, "sendAsync(payload, cb)")
        .then((allow) => {
          if (!allow) return norm.cb!(userRejectedError());
          return originalSendAsync(...args);
        })
        .catch((e) => norm.cb!(e));
      return;
    };
  }

  markWrapped(provider);
  console.debug("[SignGuard] wrapped provider", provider);
}

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
  // MetaMask fires this event when it injects the provider
  window.addEventListener("ethereum#initialized", () => tryWrapAll(), { once: false } as any);

  // EIP-6963 discovery
  window.addEventListener("eip6963:announceProvider", (event: any) => {
    try {
      const provider = event?.detail?.provider;
      wrapProvider(provider);
    } catch {
      // ignore
    }
  });
  try {
    window.dispatchEvent(new Event("eip6963:requestProvider"));
  } catch {
    // ignore
  }

  // Poll for late provider / provider replacement (10s)
  const started = Date.now();
  const interval = setInterval(() => {
    tryWrapAll();
    if (Date.now() - started > 10_000) clearInterval(interval);
  }, 50);

  // Also react to DOM changes early in document_start
  try {
    const mo = new MutationObserver(() => tryWrapAll());
    mo.observe(document.documentElement, { childList: true, subtree: true });
    setTimeout(() => mo.disconnect(), 10_000);
  } catch {
    // ignore
  }
}

// document_start
tryWrapAll();
startWrapRetry();

