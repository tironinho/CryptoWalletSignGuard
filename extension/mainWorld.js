"use strict";
(() => {
  // src/mainWorld.ts
  try {
    document.documentElement.dataset.sgMainworld = "1";
    window.postMessage({ source: "signguard-inpage", type: "SG_MAINWORLD_READY", version: "1.0.0" }, "*");
  } catch {
  }
  var LOG_PREFIX = "[SignGuard \u{1F6E1}\uFE0F]";
  var DEBUG = true;
  function log(...args) {
    if (DEBUG) console.log(LOG_PREFIX, ...args);
  }
  function err(...args) {
    console.error(LOG_PREFIX, ...args);
  }
  function patchProvider(provider, walletName = "Unknown") {
    if (!provider || provider._sg_patched) return;
    log(`Patching provider: ${walletName}`);
    const originalRequest = provider.request.bind(provider);
    try {
      Object.defineProperty(provider, "request", {
        value: async function(args) {
          const method = args.method;
          const isCritical = method === "eth_sendTransaction" || method === "eth_signTypedData_v4" || method === "eth_signTypedData_v3" || method === "eth_sign" || method === "personal_sign" || method === "wallet_switchEthereumChain" || method === "wallet_addEthereumChain";
          if (!isCritical) {
            return originalRequest(args);
          }
          log(`Intercepted Call: ${method}`, args);
          const requestId = crypto.randomUUID();
          window.postMessage(
            {
              source: "signguard",
              type: "SG_REQUEST",
              requestId,
              payload: {
                method,
                params: args.params,
                host: window.location.hostname,
                url: window.location.href,
                wallet: { name: walletName }
              }
            },
            "*"
          );
          return new Promise((resolve, reject) => {
            const handler = (ev) => {
              if (ev.source === window && ev.data?.source === "signguard-content" && ev.data?.type === "SG_DECISION" && ev.data?.requestId === requestId) {
                window.removeEventListener("message", handler);
                const { allow, errorMessage } = ev.data;
                log(`Decision received for ${requestId}: ${allow ? "ALLOW" : "BLOCK"}`);
                if (allow) {
                  originalRequest(args).then(resolve).catch(reject);
                } else {
                  reject({
                    code: 4001,
                    message: errorMessage || "SignGuard: Transaction blocked by user security settings."
                  });
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
    } catch (e) {
      err("Failed to overwrite provider.request", e);
    }
  }
  function init() {
    log("Initializing interception...");
    if (window.ethereum) {
      patchProvider(window.ethereum, "window.ethereum");
    }
    let storedEthereum = window.ethereum;
    try {
      Object.defineProperty(window, "ethereum", {
        get() {
          return storedEthereum;
        },
        set(val) {
          storedEthereum = val;
          patchProvider(val, "window.ethereum (Setter)");
        },
        configurable: true
        // Permite que o MetaMask sobrescreva, mas nós já pegámos a referência no Setter
      });
    } catch (e) {
      log("Hook defineProperty failed, relying on polling.");
    }
    window.addEventListener("eip6963:announceProvider", (event) => {
      const detail = event.detail;
      if (detail && detail.provider) {
        patchProvider(detail.provider, detail.info.name || "EIP-6963 Wallet");
      }
    });
    window.dispatchEvent(new Event("eip6963:requestProvider"));
    const interval = setInterval(() => {
      const eth = window.ethereum;
      if (eth && !eth._sg_patched) {
        patchProvider(eth, "Polling Detected");
      }
    }, 100);
    setTimeout(() => clearInterval(interval), 5e3);
  }
  init();
})();
//# sourceMappingURL=mainWorld.js.map
