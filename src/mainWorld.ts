// ARQUIVO: src/mainWorld.ts
const DEBUG_PREFIX = "🚀 [SignGuard MainWorld]";
/** CustomEvent name for decision (synchronous → preserves user activation for MetaMask). */
const SG_DECISION_EVENT = "__sg_decision__";

function log(msg: string, ...args: any[]) {
  console.log(`%c${DEBUG_PREFIX} ${msg}`, "color: #00ff00; font-weight: bold;", ...args);
}

log("Script injected and started.");

// Função para patchear o provider
function patchProvider(provider: any) {
  if (!provider || provider._sg_patched) return;

  log("Patching found provider:", provider);

  const originalRequest = provider.request.bind(provider);

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

      // Envia para o content.ts
      window.postMessage({
        source: "signguard",
        type: "SG_REQUEST",
        requestId,
        payload: {
          method,
          params: args.params,
          host: window.location.hostname,
          url: window.location.href
        }
      }, "*");

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
