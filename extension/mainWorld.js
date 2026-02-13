"use strict";
(() => {
  // src/mainWorld.ts
  var DEBUG_PREFIX = "\u{1F680} [SignGuard MainWorld]";
  function log(msg, ...args) {
    console.log(`%c${DEBUG_PREFIX} ${msg}`, "color: #00ff00; font-weight: bold;", ...args);
  }
  log("Script injected and started.");
  function patchProvider(provider) {
    if (!provider || provider._sg_patched) return;
    log("Patching found provider:", provider);
    const originalRequest = provider.request.bind(provider);
    Object.defineProperty(provider, "request", {
      value: async (args) => {
        const method = args?.method;
        log(`Intercepted call to: ${method}`, args);
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
        log(`\u{1F6D1} HOLDING Request: ${method}. Sending to Content Script...`);
        const requestId = crypto.randomUUID();
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
        return new Promise((resolve, reject) => {
          const handler = (ev) => {
            if (ev.data?.source === "signguard-content" && ev.data?.type === "SG_DECISION" && ev.data?.requestId === requestId) {
              log(`\u2705 Decision received for ${requestId}: ${ev.data.allow}`);
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
  function init() {
    log("Initializing...");
    if (window.ethereum) {
      patchProvider(window.ethereum);
    }
    let storedEth = window.ethereum;
    Object.defineProperty(window, "ethereum", {
      get: () => storedEth,
      set: (val) => {
        log("window.ethereum was set externally!");
        storedEth = val;
        patchProvider(val);
      },
      configurable: true
    });
    setInterval(() => {
      const eth = window.ethereum;
      if (eth && !eth._sg_patched) {
        log("Polling found unpatched provider. Patching now...");
        patchProvider(eth);
      }
    }, 1e3);
  }
  init();
})();
//# sourceMappingURL=mainWorld.js.map
