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
const TIMEOUT_MS_FAILOPEN = 30_000; // Se após 30s não houver SG_UI_SHOWN nem SG_DECISION, rejeitar (não executar runOriginal)

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

        // Retorna uma Promise que espera a decisão do utilizador (ou timeout se UI não aparecer)
        return new Promise((resolve, reject) => {
          let uiShown = false;
          let settled = false;
          let timeoutId: ReturnType<typeof setTimeout> | null = null;

          const cleanup = () => {
            if (timeoutId != null) {
              clearTimeout(timeoutId);
              timeoutId = null;
            }
            window.removeEventListener("message", handler);
          };

          const handler = (ev: MessageEvent) => {
            if (ev.source !== window || !ev.data || typeof ev.data !== "object") return;
            const d = ev.data as { source?: string; type?: string; requestId?: string; allow?: boolean; errorMessage?: string };
            if (d.source !== "signguard-content") return;
            if (d.requestId !== requestId) return;

            if (d.type === "SG_UI_SHOWN") {
              uiShown = true;
              if (timeoutId != null) {
                clearTimeout(timeoutId);
                timeoutId = null;
              }
              return;
            }
            if (d.type === "SG_DECISION") {
              if (settled) return;
              settled = true;
              cleanup();

              const { allow, errorMessage } = d;
              log(`Decision received for ${requestId}: ${allow ? "ALLOW" : "BLOCK"}`);

              if (allow) {
                originalRequest(args).then(resolve).catch(reject);
              } else {
                reject({
                  code: 4001,
                  message: errorMessage || "SignGuard: Transaction blocked by user security settings.",
                });
              }
            }
          };

          window.addEventListener("message", handler);

          // Se após TIMEOUT_MS_FAILOPEN não tiver SG_UI_SHOWN nem SG_DECISION: NÃO executar runOriginal; rejeitar
          timeoutId = setTimeout(() => {
            if (settled) return;
            if (uiShown) return; // UI mostrou; continua à espera de decisão (sem timeout extra)
            settled = true;
            cleanup();
            log(`Timeout ${requestId}: UI not available, rejecting`);
            reject({
              code: 4001,
              message: "SignGuard: UI not available",
            });
          }, TIMEOUT_MS_FAILOPEN);
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
