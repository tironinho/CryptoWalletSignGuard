// Runs in the MAIN world (MV3 content script with content_scripts[].world = "MAIN").
// Implements a correct "defer + resume" pipeline:
// - intercept sensitive provider.request calls and DEFER (no wallet popup yet)
// - Content script shows overlay and posts decision
// - MAIN world RESUMES by reexecuting the ORIGINAL request with bypass (no recursion)

type PendingReq = {
  provider: any;
  originalRequest: Function;
  args: any;
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

  const originalRequest = provider.request.bind(provider);

  async function sgRequest(args: any) {
    // bypass para reexecução
    if (args && args[SG_BYPASS]) {
      const clean = { ...args };
      delete clean[SG_BYPASS];
      return originalRequest(clean);
    }

    const method = String(args?.method || "").toLowerCase();
    const sensitive = [
      "eth_requestaccounts",
      "wallet_requestpermissions",
      "personal_sign",
      "eth_sign",
      "eth_signtypeddata_v4",
      "eth_sendtransaction",
      "wallet_switchethereumchain",
      "wallet_addethereumchain",
      "wallet_watchasset"
    ].includes(method);

    if (!sensitive) return originalRequest(args);

    const requestId = sgId();

    return new Promise((resolve, reject) => {
      SG_PENDING.set(requestId, {
        provider,
        originalRequest,
        args,
        resolve,
        reject,
        createdAt: Date.now(),
        method
      });

      window.postMessage({
        source: "signguard",
        type: "SG_REQUEST",
        requestId,
        payload: {
          url: location.href,
          host: location.host,
          method,
          params: args?.params ?? null,
          chainId: provider?.chainId ?? null,
          providerHint: detectProviderHint(provider),
        }
      }, "*");
    });
  }

  (sgRequest as any).__sg_wrapped = true;
  provider.request = sgRequest as any;
}

function rejectEIP1193UserRejected(method: string) {
  return { code: 4001, message: "User rejected the request", data: { method } };
}

function resumeDecision(requestId: string, allow: boolean) {
  try {
    window.dispatchEvent(new CustomEvent("sg:decision", { detail: { requestId, allow } }));
  } catch {}
}

window.addEventListener("sg:decision", async (ev: any) => {
  try {
    const detail = ev?.detail || {};
    const requestId = String(detail.requestId || "");
    const allow = !!detail.allow;

    const pending = SG_PENDING.get(requestId);
    if (!pending) return;

    SG_PENDING.delete(requestId);

    if (!allow) {
      pending.reject({ code: 4001, message: "User rejected the request", data: { method: pending.method } });
      return;
    }

    // RESUME IMEDIATO (precisa ocorrer dentro do user gesture)
    const resumedArgs = { ...(pending.args || {}), [SG_BYPASS]: true };

    try {
      const res = await pending.originalRequest(resumedArgs);
      pending.resolve(res);
    } catch (e) {
      pending.reject(e);
    }
  } catch {}
}, { passive: true });

// Fallback: SG_DECISION via postMessage just funnels into the same logic
window.addEventListener("message", (ev) => {
  try {
    if (ev.source !== window) return;
    const d = (ev as any)?.data;
    if (!d || d.source !== "signguard") return;
    if (d.type !== "SG_DECISION") return;
    resumeDecision(String(d.requestId || ""), !!d.allow);
  } catch {}
});

setInterval(() => {
  const now = Date.now();
  for (const [id, p] of SG_PENDING.entries()) {
    if (now - p.createdAt > 60000) {
      SG_PENDING.delete(id);
      // fail-open: tenta executar
      const resumedArgs = { ...(p.args || {}), [SG_BYPASS]: true };
      Promise.resolve()
        .then(() => p.originalRequest(resumedArgs))
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

