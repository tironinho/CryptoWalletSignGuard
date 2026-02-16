// ARQUIVO: src/mainWorld.ts
import { estimateFee } from "./feeEstimate";
import type { TxCostPreview } from "./shared/types";

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

// Função para patchear o provider
function patchProvider(provider: any) {
  if (!provider || provider._sg_patched) return;

  log("Patching found provider:", provider);

  const originalRequest = provider.request.bind(provider);
  (provider as any).__sg_originalRequest = originalRequest;

  // Define um Proxy para interceptar .request
  Object.defineProperty(provider, "request", {
    value: async (args: any) => {
      const method = args?.method;
      log(`Intercepted call to: ${method}`, args);

      // Lista de métodos que queremos parar
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

      log(`🛑 HOLDING Request: ${method}. Sending to Content Script...`);

      const requestId = crypto.randomUUID();
      const m = String(method || "").toLowerCase();
      const tx = Array.isArray(args.params) ? args.params[0] : undefined;
      const isTx = m === "eth_sendtransaction" || m === "wallet_sendtransaction";

      // chainIdHex síncrono quando possível (provider.chainId)
      let chainIdHex: string | null = null;
      try {
        const direct = provider?.chainId;
        if (typeof direct === "string" && direct.startsWith("0x")) chainIdHex = direct;
      } catch {}
      if (!chainIdHex) {
        chainIdHex = await safeGetChainIdHex(provider);
      }

      let chainIdRequested: string | undefined;
      if (m === "wallet_switchethereumchain" || m === "wallet_addethereumchain") {
        const p0 = Array.isArray(args.params) ? args.params[0] : undefined;
        if (p0 && typeof p0 === "object") {
          const cidReq = (p0 as any).chainId;
          if (typeof cidReq === "string") chainIdRequested = cidReq;
        }
      }

      // (1) SG_REQUEST imediato (preview mínimo para value + "calculando" nos fees)
      const initialPreview =
        method === "eth_sendTransaction" && tx && typeof tx === "object"
          ? { valueWei: toDecStringWei(tx?.value ?? "0x0"), feeEstimated: false, feeReasonKey: "fee_calculating" as const }
          : undefined;

      postToContent("SG_REQUEST", requestId, {
        method,
        params: args.params,
        host: window.location.hostname,
        url: window.location.href,
        chainIdHex: chainIdHex ?? undefined,
        txCostPreview: initialPreview,
        meta: chainIdRequested ? { chainIdRequested } : undefined,
      });

      // (2) PRE-FLIGHT em paralelo (eth_sendTransaction): estima fee e posta SG_PREVIEW
      if (method === "eth_sendTransaction" && tx && typeof tx === "object") {
        (async () => {
          let chainIdHexPreview: string | null = null;
          try {
            const cid = await originalRequest({ method: "eth_chainId" });
            if (typeof cid === "string") chainIdHexPreview = cid;
          } catch {}

          const txCostPreview = await buildTxCostPreview(originalRequest, tx);
          postToContent("SG_PREVIEW", requestId, {
            chainIdHex: chainIdHexPreview ?? undefined,
            txCostPreview,
          });
          log("SG_PREVIEW posted");
        })();
      }

      // Espera resposta — via CustomEvent (síncrono) para manter user activation e MetaMask abrir
      return new Promise((resolve, reject) => {
        let resolved = false;
        const onDecision = (ev: Event) => {
          const ce = ev as CustomEvent;
          const data = ce?.detail ?? null;
          if (!data || data.type !== "SG_DECISION" || data.requestId !== requestId) return;
          if (resolved) return;
          resolved = true;
          window.removeEventListener(SG_DECISION_EVENT, onDecision as EventListener);
          window.removeEventListener("message", onMessage);

          log(`✅ Decision received for ${requestId}: ${data.allow}`);
          if (data.allow) {
            log("Executing original request...");
            originalRequest(args).then(resolve).catch(reject);
          } else {
            log("Rejecting request (User Blocked).");
            reject({ code: 4001, message: "SignGuard: Blocked by user" });
          }
        };
        const onMessage = (ev: MessageEvent) => {
          if (resolved) return;
          if (ev.data?.source !== "signguard-content" || ev.data?.type !== "SG_DECISION" || ev.data?.requestId !== requestId) return;
          resolved = true;
          window.removeEventListener(SG_DECISION_EVENT, onDecision as EventListener);
          window.removeEventListener("message", onMessage);
          log(`✅ Decision (fallback postMessage) for ${requestId}: ${ev.data.allow}`);
          if (ev.data.allow) originalRequest(args).then(resolve).catch(reject);
          else reject({ code: 4001, message: "SignGuard: Blocked by user" });
        };
        window.addEventListener(SG_DECISION_EVENT, onDecision as EventListener);
        window.addEventListener("message", onMessage);
        // Fallback: se em 3s não chegou por CustomEvent, postMessage ainda pode chegar
        setTimeout(() => {
          if (!resolved) {
            // opcional: poderia remover só o listener de CustomEvent e deixar message
          }
        }, 3000);
      });
    },
    configurable: true,
    writable: true
  });

  provider._sg_patched = true;
  log("Provider patched successfully.");
}

// Inicialização com múltiplas tentativas
function init() {
  log("Initializing...");

  if ((window as any).ethereum) {
    patchProvider((window as any).ethereum);
  }

  // Monitora injeção do MetaMask
  let storedEth = (window as any).ethereum;
  Object.defineProperty(window, "ethereum", {
    get: () => storedEth,
    set: (val) => {
      log("window.ethereum was set externally!");
      storedEth = val;
      patchProvider(val);
    },
    configurable: true
  });

  // Polling de segurança (caso o defineProperty falhe)
  setInterval(() => {
    const eth = (window as any).ethereum;
    if (eth && !eth._sg_patched) {
      log("Polling found unpatched provider. Patching now...");
      patchProvider(eth);
    }
  }, 1000);
}

init();

window.addEventListener("message", async (ev: MessageEvent) => {
  if (ev.source !== window || ev.data?.source !== "signguard-content" || ev.data?.type !== "SG_FEE_ESTIMATE_REQ") return;
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
