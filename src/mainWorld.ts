// ARQUIVO: src/mainWorld.ts

/**
 * SignGuard - Main World Script (Interceção Agressiva)
 * Injetado via manifest.json com world: "MAIN"
 */

// Mark ready for content script handshake
try {
  document.documentElement.dataset.sgMainworld = "1";
  window.postMessage({ source: "signguard-inpage", type: "SG_MAINWORLD_READY", version: "1.0.0" }, "*");
} catch {}

const LOG_PREFIX = "[SignGuard 🛡️]";
const DEBUG = true; // Altere para false em produção se desejar menos logs

function log(...args: any[]) {
  if (DEBUG) console.log(LOG_PREFIX, ...args);
}

function err(...args: any[]) {
  console.error(LOG_PREFIX, ...args);
}

// Interfaces básicas para evitar erros de TS
interface RequestArguments {
  method: string;
  params?: unknown[] | object;
}

interface EIP6963ProviderDetail {
  info: {
    uuid: string;
    name: string;
    icon: string;
    rdns: string;
  };
  provider: any;
}

// --- CORE: Lógica de Interceção ---

/**
 * Aplica o patch no método .request do provider
 */
function patchProvider(provider: any, walletName: string = "Unknown") {
  if (!provider || provider._sg_patched) return; // Já patcheado

  log(`Patching provider: ${walletName}`);

  // Tenta manter a referência original
  const originalRequest = provider.request.bind(provider);

  // Sobrescreve o método .request
  try {
    Object.defineProperty(provider, "request", {
      value: async function (args: RequestArguments) {
        // Filtra apenas métodos críticos
        const method = args.method;
        const isCritical =
          method === "eth_sendTransaction" ||
          method === "eth_signTypedData_v4" ||
          method === "eth_signTypedData_v3" ||
          method === "eth_sign" ||
          method === "personal_sign" ||
          method === "wallet_switchEthereumChain" ||
          method === "wallet_addEthereumChain";

        if (!isCritical) {
          return originalRequest(args);
        }

        log(`Intercepted Call: ${method}`, args);

        // Gera ID único para rastreio
        const requestId = crypto.randomUUID();

        // Envia para o Content Script (Isolado)
        // Usa "*" para evitar erros de 'target origin mismatch' em iframes
        window.postMessage(
          {
            source: "signguard",
            type: "SG_REQUEST",
            requestId,
            payload: {
              method,
              params: (args as any).params,
              host: window.location.hostname,
              url: window.location.href,
              wallet: { name: walletName },
            },
          },
          "*"
        );

        // Retorna uma Promise que espera a decisão do utilizador
        return new Promise((resolve, reject) => {
          const handler = (ev: MessageEvent) => {
            if (
              ev.source === window &&
              ev.data?.source === "signguard-content" &&
              ev.data?.type === "SG_DECISION" &&
              ev.data?.requestId === requestId
            ) {
              window.removeEventListener("message", handler);

              const { allow, errorMessage } = ev.data;
              log(`Decision received for ${requestId}: ${allow ? "ALLOW" : "BLOCK"}`);

              if (allow) {
                // Se permitido, chama o original
                originalRequest(args)
                  .then(resolve)
                  .catch(reject);
              } else {
                // Se bloqueado, rejeita a transação (simula rejeição do utilizador)
                reject({
                  code: 4001,
                  message: errorMessage || "SignGuard: Transaction blocked by user security settings.",
                });
              }
            }
          };

          window.addEventListener("message", handler);
        });
      },
      configurable: true,
      writable: true,
    });

    // Marca como patcheado para não repetir
    provider._sg_patched = true;
  } catch (e) {
    err("Failed to overwrite provider.request", e);
  }
}

// --- INIT: Estratégias de Captura ---

function init() {
  log("Initializing interception...");

  // 1. Captura Imediata (se já existir)
  if ((window as any).ethereum) {
    patchProvider((window as any).ethereum, "window.ethereum");
  }

  // 2. Hook no Object.defineProperty (Para capturar quando o MetaMask injetar)
  let storedEthereum = (window as any).ethereum;
  try {
    Object.defineProperty(window, "ethereum", {
      get() {
        return storedEthereum;
      },
      set(val) {
        storedEthereum = val;
        patchProvider(val, "window.ethereum (Setter)");
      },
      configurable: true, // Permite que o MetaMask sobrescreva, mas nós já pegámos a referência no Setter
    });
  } catch (e) {
    // Se falhar (ex: já definido como não-configurável), fallback para polling
    log("Hook defineProperty failed, relying on polling.");
  }

  // 3. EIP-6963 (Multi-Wallet Discovery) - O standard moderno
  window.addEventListener("eip6963:announceProvider", (event: any) => {
    const detail = event.detail as EIP6963ProviderDetail;
    if (detail && detail.provider) {
      patchProvider(detail.provider, detail.info.name || "EIP-6963 Wallet");
    }
  });
  // Dispara pedido para as carteiras se anunciarem
  window.dispatchEvent(new Event("eip6963:requestProvider"));

  // 4. Polling de Segurança (Sledgehammer)
  // Verifica a cada 100ms se surgiu um novo provider não patcheado
  // (Resolve casos onde o MetaMask sobrescreve o objeto window.ethereum completamente)
  const interval = setInterval(() => {
    const eth = (window as any).ethereum;
    if (eth && !eth._sg_patched) {
      patchProvider(eth, "Polling Detected");
    }
  }, 100);

  // Para o polling após 5 segundos (a maioria das injeções ocorre no início)
  setTimeout(() => clearInterval(interval), 5000);
}

// Inicia imediatamente
init();
