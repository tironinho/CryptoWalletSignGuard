// ARQUIVO: src/mainWorld.ts
const DEBUG_PREFIX = "🚀 [SignGuard MainWorld]";

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

      // Espera resposta
      return new Promise((resolve, reject) => {
        const handler = (ev: MessageEvent) => {
          if (ev.data?.source === "signguard-content" &&
              ev.data?.type === "SG_DECISION" &&
              ev.data?.requestId === requestId) {

            log(`✅ Decision received for ${requestId}: ${ev.data.allow}`);
            window.removeEventListener("message", handler);

            if (ev.data.allow) {
              log("Executing original request...");
              originalRequest(args).then(resolve).catch(reject);
            } else {
              log("Rejecting request (User Blocked).");
              reject({ code: 4001, message: "SignGuard: Blocked by user" });
            }
          }
        };
        window.addEventListener("message", handler);
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
