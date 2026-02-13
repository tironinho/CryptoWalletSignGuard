"use strict";
(() => {
  // src/mainWorld.ts
  try {
    document.documentElement.dataset.sgMainworld = "1";
    window.postMessage({ source: "signguard-inpage", type: "SG_MAINWORLD_READY", version: "1.0.0" }, "*");
  } catch {
  }
  function log(...args) {
  }
  function patchProvider(provider) {
    if (!provider || provider._sg_patched) return;
    log("Patching Provider:", provider);
    const originalRequest = provider.request.bind(provider);
    provider.request = async (args) => {
      const method = args?.method;
      const criticalMethods = [
        "eth_sendTransaction",
        "eth_signTypedData_v4",
        "eth_signTypedData_v3",
        "personal_sign",
        "wallet_switchEthereumChain"
      ];
      if (!criticalMethods.includes(method)) {
        return originalRequest(args);
      }
      log("Intercepted:", method);
      const requestId = crypto.randomUUID();
      window.postMessage(
        {
          source: "signguard",
          type: "SG_REQUEST",
          requestId,
          payload: {
            method,
            params: args?.params,
            host: window.location.hostname,
            url: window.location.href
          }
        },
        "*"
      );
      return new Promise((resolve, reject) => {
        const handler = (ev) => {
          const d = ev?.data;
          if (d?.requestId !== requestId || d?.type !== "SG_DECISION") return;
          if (d?.source !== "signguard-content") return;
          window.removeEventListener("message", handler);
          if (d.allow) {
            originalRequest(args).then(resolve).catch(reject);
          } else {
            reject({ code: 4001, message: "SignGuard: Blocked by user" });
          }
        };
        window.addEventListener("message", handler);
      });
    };
    provider._sg_patched = true;
  }
  function init() {
    if (window.ethereum) {
      patchProvider(window.ethereum);
    }
    let storedEth = window.ethereum;
    try {
      Object.defineProperty(window, "ethereum", {
        get: () => storedEth,
        set: (val) => {
          storedEth = val;
          patchProvider(val);
        },
        configurable: true
      });
    } catch {
    }
    setInterval(() => {
      const eth = window.ethereum;
      if (eth && !eth._sg_patched) {
        patchProvider(eth);
      }
    }, 100);
  }
  init();
})();
//# sourceMappingURL=mainWorld.js.map
