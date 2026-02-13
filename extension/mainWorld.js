"use strict";
(() => {
  // src/feeEstimate.ts
  var RPC_TIMEOUT_MS = 2500;
  async function tryRpc(providerRequest, method, params, timeoutMs = RPC_TIMEOUT_MS) {
    let t;
    const timeout = new Promise((res) => {
      t = setTimeout(() => res(null), timeoutMs);
    });
    try {
      const r = await Promise.race([providerRequest({ method, params }).then((x) => x), timeout]);
      clearTimeout(t);
      return r;
    } catch {
      clearTimeout(t);
      return null;
    }
  }
  async function estimateFee(providerRequest, tx) {
    try {
      let gasLimit;
      const gasHex = await tryRpc(providerRequest, "eth_estimateGas", [tx]);
      if (gasHex != null && typeof gasHex === "string") {
        try {
          gasLimit = BigInt(gasHex);
        } catch {
          gasLimit = 150000n;
        }
      } else {
        const hasData = tx?.data && String(tx.data) !== "0x" && String(tx.data).toLowerCase() !== "0x";
        const valueWei = BigInt(tx?.value || "0x0");
        gasLimit = hasData ? 150000n : valueWei > 0n ? 21000n : 150000n;
      }
      const maxFeePerGas = tx?.maxFeePerGas ? BigInt(tx.maxFeePerGas) : void 0;
      const maxPriorityFeePerGas = tx?.maxPriorityFeePerGas ? BigInt(tx.maxPriorityFeePerGas) : void 0;
      const gasPrice = tx?.gasPrice ? BigInt(tx.gasPrice) : void 0;
      let computedMaxFee = maxFeePerGas;
      let computedPriority = maxPriorityFeePerGas;
      if (!computedMaxFee && !gasPrice) {
        const prioHex = await tryRpc(providerRequest, "eth_maxPriorityFeePerGas", []);
        computedPriority = prioHex != null && prioHex !== "" ? BigInt(prioHex) : 1000000000n;
        let baseFee;
        const fh = await tryRpc(providerRequest, "eth_feeHistory", ["0x1", "latest", []]);
        const arr = fh?.baseFeePerGas;
        if (Array.isArray(arr) && arr.length > 0) {
          try {
            baseFee = BigInt(arr[arr.length - 1]);
          } catch {
            baseFee = void 0;
          }
        } else {
          baseFee = void 0;
        }
        if (baseFee != null) {
          computedMaxFee = baseFee * 2n + (computedPriority ?? 0n);
        } else {
          const gpHex = await tryRpc(providerRequest, "eth_gasPrice", []);
          if (gpHex != null && gpHex !== "") return finalizeLegacy(gasLimit, BigInt(gpHex));
          return { ok: false, reason: "fee_unknown_wallet_will_estimate" };
        }
      }
      if (gasPrice) return finalizeLegacy(gasLimit, gasPrice);
      if (!computedMaxFee) {
        return { ok: false, reason: "fee_unknown_wallet_will_estimate" };
      }
      const maxP = computedMaxFee;
      const prio = computedPriority ?? 0n;
      const likelyPerGas = (maxP + prio) / 2n;
      const feeMaxWei = gasLimit * maxP;
      const feeLikelyWei = gasLimit * likelyPerGas;
      return {
        ok: true,
        gasLimit,
        maxFeePerGas: maxP,
        maxPriorityFeePerGas: prio,
        feeMaxWei,
        feeLikelyWei
      };
    } catch {
      return { ok: false, reason: "fee_unknown_wallet_will_estimate" };
    }
  }
  function finalizeLegacy(gasLimit, gasPrice) {
    const feeMaxWei = gasLimit * gasPrice;
    return { ok: true, gasLimit, gasPrice, feeMaxWei, feeLikelyWei: feeMaxWei };
  }

  // src/walletDetect.ts
  function detectWalletBrand(eth, eip6963Name) {
    try {
      if (eip6963Name && typeof eip6963Name === "string" && eip6963Name.trim()) return eip6963Name.trim();
      if (!eth) return "EVM Wallet";
      if (eth?.isMetaMask === true) return "MetaMask";
      if (eth?.isCoinbaseWallet === true || eth?.providerMap?.coinbase) return "Coinbase Wallet";
      if (eth?.isRabby === true) return "Rabby";
      if (eth?.isTrust === true || eth?.isTrustWallet === true) return "Trust Wallet";
      if (eth?.isOkxWallet === true || eth?.isOKExWallet === true) return "OKX Wallet";
      if (eth?.isBinance === true || eth?.isBinanceWallet === true) return "Binance Web3";
      if (eth?.isPhantom === true) return "Phantom EVM";
      if (eth?.isBraveWallet === true) return "Brave Wallet";
      if (eth?.isBitget === true || eth?.isBitKeep === true) return "Bitget Wallet";
      if (eth?.isRainbow === true || eth?.isFrame === true || eth?.isSafePal === true || eth?.isTaho === true || eth?.isLedger === true) return "EVM Wallet";
      return "EVM Wallet";
    } catch {
      return "EVM Wallet";
    }
  }
  function detectWalletFromProvider(p) {
    try {
      if (!p) return { id: "unknown", name: "Unknown" };
      if (p?.isMetaMask === true) return { id: "metamask", name: "MetaMask" };
      if (p?.isCoinbaseWallet === true || p?.providerMap?.coinbase) return { id: "coinbase", name: "Coinbase Wallet" };
      if (p?.isTrust === true || p?.isTrustWallet === true) return { id: "trust", name: "Trust Wallet" };
      if (p?.isOkxWallet === true || p?.isOKExWallet === true) return { id: "okx", name: "OKX Wallet" };
      if (p?.isBinance === true || p?.isBinanceWallet === true) return { id: "binance", name: "Binance Web3 Wallet" };
      if (p?.isRabby === true) return { id: "rabby", name: "Rabby" };
      if (p?.isRainbow === true) return { id: "rainbow", name: "Rainbow" };
      if (p?.isPhantom === true) return { id: "phantom", name: "Phantom" };
      if (p?.isBraveWallet === true) return { id: "brave", name: "Brave Wallet" };
      if (p?.isBitget === true || p?.isBitKeep === true) return { id: "bitget", name: "Bitget Wallet" };
      if (p?.isSafePal === true) return { id: "safepal", name: "SafePal" };
      if (p?.isFrame === true) return { id: "frame", name: "Frame" };
      if (p?.isTaho === true) return { id: "unknown", name: "Taho" };
      if (p?.isLedger === true) return { id: "unknown", name: "Ledger" };
      return { id: "unknown", name: "EIP-1193 Wallet" };
    } catch {
      return { id: "unknown", name: "Unknown" };
    }
  }
  var ID_TO_NAME = {
    metamask: "MetaMask",
    coinbase: "Coinbase Wallet",
    trust: "Trust Wallet",
    okx: "OKX Wallet",
    binance: "Binance Web3",
    rabby: "Rabby",
    rainbow: "EVM Wallet",
    phantom: "Phantom EVM",
    brave: "Brave Wallet",
    bitget: "Bitget Wallet",
    safepal: "EVM Wallet",
    frame: "EVM Wallet",
    unknown: "EVM Wallet"
  };
  function detectEvmWallet(provider, eip6963Name) {
    const meta = detectWalletFromProvider(provider);
    const displayName = eip6963Name && eip6963Name.trim() ? eip6963Name.trim() : ID_TO_NAME[meta.id] || meta.name || "EVM Wallet";
    return {
      kind: "EVM_INJECTED",
      name: displayName,
      walletBrand: detectWalletBrand(provider, eip6963Name),
      walletName: displayName,
      flags: { [meta.id]: true }
    };
  }
  function detectSolWallet(sol) {
    try {
      if (!sol) return { kind: "SOLANA_INJECTED", name: "Unknown", flags: {} };
      if (sol?.isPhantom) return { kind: "SOLANA_INJECTED", name: "Phantom", flags: { isPhantom: true } };
      if (sol?.isSolflare) return { kind: "SOLANA_INJECTED", name: "Solflare", flags: { isSolflare: true } };
      if (sol?.isBackpack) return { kind: "SOLANA_INJECTED", name: "Backpack", flags: { isBackpack: true } };
      return { kind: "SOLANA_INJECTED", name: "Injected", flags: {} };
    } catch {
      return { kind: "SOLANA_INJECTED", name: "Unknown", flags: {} };
    }
  }
  function listEvmProviders() {
    try {
      const eth = typeof window !== "undefined" ? window?.ethereum : null;
      const arr = [];
      if (eth) arr.push(eth);
      if (eth?.providers && Array.isArray(eth.providers)) {
        for (const p of eth.providers) {
          if (p && !arr.includes(p)) arr.push(p);
        }
      }
      return Array.from(new Set(arr));
    } catch {
      return [];
    }
  }

  // src/mainWorld.ts
  window.__signguard_mainworld = true;
  try {
    document.documentElement.setAttribute("data-signguard-mainworld", "1");
    document.documentElement.setAttribute("data-sg-mainworld", "1");
    document.documentElement.dataset.sgMainworld = "1";
    window.postMessage(
      { source: "signguard-inpage", type: "SG_MAINWORLD_READY", version: "1.0.0" },
      "*"
    );
  } catch {
  }
  var TIMEOUT_MS_UI = 6e5;
  var TIMEOUT_MS_FAILOPEN = 3e4;
  var KEEPALIVE_CAP_MS = 9e5;
  var FAILOPEN_WAIT_CAP_MS = 6e5;
  var pendingCalls = /* @__PURE__ */ new Map();
  var SG_BYPASS = Symbol.for("SG_BYPASS");
  function sgId() {
    return crypto?.randomUUID?.() || Date.now() + "-" + Math.random().toString(16).slice(2);
  }
  function toBigIntHex(v) {
    try {
      const s = String(v || "0x0");
      if (!s.startsWith("0x")) return BigInt(s);
      return BigInt(s);
    } catch {
      return 0n;
    }
  }
  function weiToEthDecimal18(wei) {
    const ONE = 10n ** 18n;
    const whole = wei / ONE;
    const frac = wei % ONE;
    const fracStr = frac.toString().padStart(18, "0");
    const trimmed = fracStr.replace(/0+$/, "");
    return trimmed ? `${whole.toString()}.${trimmed}` : whole.toString();
  }
  function postMessageSG(type, data) {
    try {
      window.postMessage(
        { __SIGNGUARD__: true, type, data, href: location.href, origin: location.origin, ts: Date.now() },
        "*"
      );
    } catch {
    }
  }
  function buildRpcMeta(methodLower, params, provider) {
    try {
      if (methodLower === "eth_sendtransaction" || methodLower === "wallet_sendtransaction") {
        const tx = Array.isArray(params) ? params[0] : void 0;
        const valueWei = toBigIntHex(tx?.value || "0x0");
        return {
          chainId: provider?.chainId ?? null,
          preflight: {
            tx,
            valueWei: valueWei.toString(10),
            valueEth: weiToEthDecimal18(valueWei)
          }
        };
      }
      if (methodLower === "wallet_switchethereumchain") {
        const chainIdRequested = Array.isArray(params) ? params?.[0]?.chainId : void 0;
        return {
          chainId: provider?.chainId ?? null,
          chainIdRequested: chainIdRequested ?? null
        };
      }
      return { chainId: provider?.chainId ?? null };
    } catch {
      return { chainId: provider?.chainId ?? null };
    }
  }
  function toChainIdHex(chainId) {
    if (chainId == null || chainId === "") return null;
    const s = String(chainId).trim();
    if (s.toLowerCase().startsWith("0x")) return s;
    const n = parseInt(s, 10);
    if (!Number.isFinite(n) || n < 0) return null;
    return "0x" + n.toString(16);
  }
  var CHAIN_ID_FALLBACK_MS = 800;
  async function resolveChainIdHex(provider, rawRequest) {
    const fromProvider = toChainIdHex(provider?.chainId ?? null);
    if (fromProvider && fromProvider !== "0x0") return fromProvider;
    try {
      const result = await Promise.race([
        rawRequest({ method: "eth_chainId", params: [], [SG_BYPASS]: true }),
        new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), CHAIN_ID_FALLBACK_MS))
      ]);
      return toChainIdHex(result);
    } catch {
      return fromProvider;
    }
  }
  var SG_ANNOUNCED_PROVIDERS = [];
  var SG_ACTIVE_PROVIDER = null;
  function selectActiveProvider() {
    const w = typeof window !== "undefined" ? window : null;
    const eth = w?.ethereum;
    if (eth) return eth;
    const first = SG_ANNOUNCED_PROVIDERS[0]?.providerRef;
    return first || null;
  }
  function applyActiveProvider() {
    const next = selectActiveProvider();
    if (next && next !== SG_ACTIVE_PROVIDER) {
      SG_ACTIVE_PROVIDER = next;
      wrapProvider(next, void 0, "window.ethereum");
    }
  }
  function wrapProvider(provider, providerTag, providerSource, providerIndex, eip6963DisplayName) {
    if (!provider || typeof provider.request !== "function") return;
    if (provider.request.__sg_wrapped) return;
    const eth = provider;
    const rawRequest = eth.request?.bind(eth);
    const rawSend = eth.send?.bind(eth);
    const rawSendAsync = eth.sendAsync?.bind(eth);
    if (typeof rawRequest !== "function") return;
    async function sgRequest(args) {
      if (args && args[SG_BYPASS]) {
        const clean = { ...args };
        delete clean[SG_BYPASS];
        return rawRequest(clean);
      }
      const method = String(args?.method || "").toLowerCase();
      const params = args?.params;
      postMessageSG("SG_RPC", { method, params });
      let txCostPreview = void 0;
      if ((method === "eth_sendtransaction" || method === "wallet_sendtransaction") && Array.isArray(params) && params[0] && typeof params[0] === "object") {
        const tx = params[0];
        const providerRequest = (a) => rawRequest(a);
        const fee = await estimateFee(providerRequest, tx);
        const valueWei = BigInt(typeof tx?.value === "string" ? tx.value : tx?.value ?? "0x0");
        txCostPreview = {
          valueWei: valueWei.toString(10),
          feeEstimated: fee.ok
        };
        if (fee.ok && fee.feeLikelyWei !== void 0 && fee.feeMaxWei !== void 0) {
          if (fee.gasLimit) txCostPreview.gasLimitWei = fee.gasLimit.toString(10);
          txCostPreview.feeLikelyWei = fee.feeLikelyWei.toString(10);
          txCostPreview.feeMaxWei = fee.feeMaxWei.toString(10);
          txCostPreview.totalLikelyWei = (valueWei + fee.feeLikelyWei).toString(10);
          txCostPreview.totalMaxWei = (valueWei + fee.feeMaxWei).toString(10);
        } else {
          txCostPreview.feeReasonKey = "fee_unknown_wallet_will_estimate";
        }
      }
      const sensitive = [
        "eth_requestaccounts",
        "wallet_requestpermissions",
        "wallet_getpermissions",
        "personal_sign",
        "eth_sign",
        "eth_signtypeddata_v4",
        "eth_signtypeddata_v3",
        "eth_signtypeddata",
        "eth_signtransaction",
        "eth_sendtransaction",
        "wallet_sendtransaction",
        "wallet_switchethereumchain",
        "wallet_addethereumchain",
        "wallet_watchasset"
      ].includes(method);
      if (!sensitive) return rawRequest(args);
      const requestId = sgId();
      return new Promise((resolve, reject) => {
        pendingCalls.set(requestId, {
          resolve,
          reject,
          runOriginal: () => rawRequest({ ...args || {}, [SG_BYPASS]: true }),
          createdAt: Date.now(),
          method,
          uiShown: false
        });
        const walletMeta = detectWalletFromProvider(provider);
        const walletInfo = detectEvmWallet(provider, eip6963DisplayName);
        const walletBrand = detectWalletBrand(provider, eip6963DisplayName);
        const providerKey = [providerSource || "window.ethereum", walletMeta.id, providerIndex ?? ""].filter(Boolean).join(":");
        (async () => {
          const chainIdHex = await resolveChainIdHex(provider, (a) => rawRequest(a));
          const meta = buildRpcMeta(method, params, provider);
          if (chainIdHex != null) meta.chainId = chainIdHex;
          try {
            window.postMessage({
              source: "signguard-inpage",
              type: "SG_REQUEST",
              requestId,
              payload: {
                id: requestId,
                url: location.href,
                origin: location.origin,
                host: location.host,
                method,
                params: Array.isArray(params) ? params : params ?? null,
                chainId: chainIdHex ?? provider?.chainId ?? null,
                chainIdHex: chainIdHex ?? toChainIdHex(provider?.chainId ?? null),
                wallet: { ...walletInfo, id: walletMeta.id, walletBrand, walletName: walletInfo.walletName || walletBrand },
                providerKey,
                providerSource: providerSource || "window.ethereum",
                request: { method, params: Array.isArray(params) ? params : void 0 },
                providerTag,
                providerHint: { kind: walletInfo.name, name: walletInfo.name },
                meta,
                txCostPreview
              }
            }, "*");
          } catch {
          }
        })();
      });
    }
    sgRequest.__sg_wrapped = true;
    eth.request = sgRequest;
    if (typeof rawSend === "function") {
      eth.send = function(methodOrPayload, paramsOrCb) {
        const payload = typeof methodOrPayload === "string" ? { method: methodOrPayload, params: Array.isArray(paramsOrCb) ? paramsOrCb : [paramsOrCb] } : methodOrPayload;
        const method = String(payload?.method || "").toLowerCase().trim();
        const params = payload?.params;
        postMessageSG("SG_RPC", { method, params });
        const sensitive = [
          "eth_requestaccounts",
          "wallet_requestpermissions",
          "wallet_getpermissions",
          "personal_sign",
          "eth_sign",
          "eth_signtypeddata_v4",
          "eth_signtypeddata_v3",
          "eth_signtypeddata",
          "eth_signtransaction",
          "eth_sendtransaction",
          "wallet_sendtransaction",
          "wallet_switchethereumchain",
          "wallet_addethereumchain",
          "wallet_watchasset"
        ].includes(method);
        if (!sensitive) return rawSend(methodOrPayload, paramsOrCb);
        const requestId = sgId();
        (async () => {
          let txCostPreview = void 0;
          if ((method === "eth_sendtransaction" || method === "wallet_sendtransaction") && Array.isArray(params) && params[0] && typeof params[0] === "object") {
            const tx = params[0];
            const fee = await estimateFee((a) => rawRequest(a), tx);
            const valueWei = BigInt(typeof tx?.value === "string" ? tx.value : tx?.value ?? "0x0");
            txCostPreview = { valueWei: valueWei.toString(10), feeEstimated: fee.ok };
            if (fee.ok && fee.feeLikelyWei !== void 0 && fee.feeMaxWei !== void 0) {
              if (fee.gasLimit) txCostPreview.gasLimitWei = fee.gasLimit.toString(10);
              txCostPreview.feeLikelyWei = fee.feeLikelyWei.toString(10);
              txCostPreview.feeMaxWei = fee.feeMaxWei.toString(10);
              txCostPreview.totalLikelyWei = (valueWei + fee.feeLikelyWei).toString(10);
              txCostPreview.totalMaxWei = (valueWei + fee.feeMaxWei).toString(10);
            } else {
              txCostPreview.feeReasonKey = "fee_unknown_wallet_will_estimate";
            }
          }
          const walletMetaInner = detectWalletFromProvider(provider);
          const walletInfo = detectEvmWallet(provider, eip6963DisplayName);
          const walletBrandInner = detectWalletBrand(provider, eip6963DisplayName);
          const providerKey = [providerSource || "window.ethereum", walletMetaInner.id, providerIndex ?? ""].filter(Boolean).join(":");
          const chainIdHex = await resolveChainIdHex(provider, (a) => rawRequest(a));
          const meta = buildRpcMeta(method, params, provider);
          if (chainIdHex != null) meta.chainId = chainIdHex;
          try {
            window.postMessage({
              source: "signguard-inpage",
              type: "SG_REQUEST",
              requestId,
              payload: {
                id: requestId,
                url: location.href,
                origin: location.origin,
                host: location.host,
                method,
                params: Array.isArray(params) ? params : params ?? null,
                chainId: chainIdHex ?? provider?.chainId ?? null,
                chainIdHex: chainIdHex ?? toChainIdHex(provider?.chainId ?? null),
                wallet: { ...walletInfo, id: walletMetaInner.id, walletBrand: walletBrandInner, walletName: walletInfo.walletName || walletBrandInner },
                providerKey,
                providerSource: providerSource || "window.ethereum",
                request: { method, params: Array.isArray(params) ? params : void 0 },
                providerTag,
                providerHint: { kind: walletInfo.name, name: walletInfo.name },
                meta,
                txCostPreview
              }
            }, "*");
          } catch {
          }
        })();
        return new Promise((resolve, reject) => {
          pendingCalls.set(requestId, {
            resolve,
            reject,
            runOriginal: () => Promise.resolve(rawSend(methodOrPayload, paramsOrCb)),
            createdAt: Date.now(),
            method,
            uiShown: false
          });
        });
      };
    }
    if (typeof rawSendAsync === "function") {
      eth.sendAsync = function(payload, cb) {
        const method = String(payload?.method || "").toLowerCase().trim();
        const params = payload?.params;
        postMessageSG("SG_RPC", { method, params });
        const sensitive = [
          "eth_requestaccounts",
          "wallet_requestpermissions",
          "wallet_getpermissions",
          "personal_sign",
          "eth_sign",
          "eth_signtypeddata_v4",
          "eth_signtypeddata_v3",
          "eth_signtypeddata",
          "eth_signtransaction",
          "eth_sendtransaction",
          "wallet_sendtransaction",
          "wallet_switchethereumchain",
          "wallet_addethereumchain",
          "wallet_watchasset"
        ].includes(method);
        if (!sensitive) return rawSendAsync(payload, cb);
        const requestId = sgId();
        const doneCb = typeof cb === "function" ? cb : () => {
        };
        (async () => {
          let txCostPreview = void 0;
          if ((method === "eth_sendtransaction" || method === "wallet_sendtransaction") && Array.isArray(params) && params[0] && typeof params[0] === "object") {
            const tx = params[0];
            const fee = await estimateFee((a) => rawRequest(a), tx);
            const valueWei = BigInt(typeof tx?.value === "string" ? tx.value : tx?.value ?? "0x0");
            txCostPreview = { valueWei: valueWei.toString(10), feeEstimated: fee.ok };
            if (fee.ok && fee.feeLikelyWei !== void 0 && fee.feeMaxWei !== void 0) {
              if (fee.gasLimit) txCostPreview.gasLimitWei = fee.gasLimit.toString(10);
              txCostPreview.feeLikelyWei = fee.feeLikelyWei.toString(10);
              txCostPreview.feeMaxWei = fee.feeMaxWei.toString(10);
              txCostPreview.totalLikelyWei = (valueWei + fee.feeLikelyWei).toString(10);
              txCostPreview.totalMaxWei = (valueWei + fee.feeMaxWei).toString(10);
            } else {
              txCostPreview.feeReasonKey = "fee_unknown_wallet_will_estimate";
            }
          }
          const walletMetaAsync = detectWalletFromProvider(provider);
          const walletInfo = detectEvmWallet(provider, eip6963DisplayName);
          const walletBrandAsync = detectWalletBrand(provider, eip6963DisplayName);
          const providerKey = [providerSource || "window.ethereum", walletMetaAsync.id, providerIndex ?? ""].filter(Boolean).join(":");
          const chainIdHex = await resolveChainIdHex(provider, (a) => rawRequest(a));
          const meta = buildRpcMeta(method, params, provider);
          if (chainIdHex != null) meta.chainId = chainIdHex;
          try {
            window.postMessage({
              source: "signguard-inpage",
              type: "SG_REQUEST",
              requestId,
              payload: {
                id: requestId,
                url: location.href,
                origin: location.origin,
                host: location.host,
                method,
                params: Array.isArray(params) ? params : params ?? null,
                chainId: chainIdHex ?? provider?.chainId ?? null,
                chainIdHex: chainIdHex ?? toChainIdHex(provider?.chainId ?? null),
                wallet: { ...walletInfo, id: walletMetaAsync.id, walletBrand: walletBrandAsync, walletName: walletInfo.walletName || walletBrandAsync },
                providerKey,
                providerSource: providerSource || "window.ethereum",
                request: { method, params: Array.isArray(params) ? params : void 0 },
                providerTag,
                providerHint: { kind: walletInfo.name, name: walletInfo.name },
                meta,
                txCostPreview
              }
            }, "*");
          } catch {
          }
        })();
        return new Promise((resolve, reject) => {
          pendingCalls.set(requestId, {
            resolve: (v) => {
              try {
                doneCb(null, v);
              } catch {
              }
              resolve(v);
            },
            reject: (e) => {
              try {
                doneCb(e);
              } catch {
              }
              reject(e);
            },
            runOriginal: () => new Promise((res, rej) => {
              try {
                rawSendAsync(payload, (err, resp) => {
                  if (err) return rej(err);
                  res(resp);
                });
              } catch (e) {
                rej(e);
              }
            }),
            createdAt: Date.now(),
            method,
            uiShown: false
          });
        });
      };
    }
  }
  function resumeDecisionInner(requestId, allow, errorMessage) {
    try {
      const pending = pendingCalls.get(requestId);
      if (!pending) return;
      pendingCalls.delete(requestId);
      if (!allow) {
        const msg = typeof errorMessage === "string" && errorMessage.trim() ? errorMessage.trim() : "User rejected the request";
        pending.reject({ code: 4001, message: msg, data: { method: pending.method } });
        try {
          window.postMessage({ source: "signguard-inpage", type: "SG_DECISION_ACK", requestId, allow: false }, "*");
        } catch {
        }
        return;
      }
      try {
        const promise = pending.runOriginal();
        promise.then(pending.resolve).catch(pending.reject);
        try {
          window.postMessage({ source: "signguard-inpage", type: "SG_DECISION_ACK", requestId, allow: true }, "*");
        } catch {
        }
      } catch (e) {
        pending.reject(e);
        try {
          window.postMessage({ source: "signguard-inpage", type: "SG_DECISION_ACK", requestId, allow: false }, "*");
        } catch {
        }
      }
    } catch {
    }
  }
  function markUiShown(requestId) {
    try {
      const p = pendingCalls.get(requestId);
      if (p) {
        p.uiShown = true;
        p.lastKeepaliveAt = Date.now();
      }
    } catch {
    }
  }
  function handleKeepalive(requestId) {
    try {
      const p = pendingCalls.get(requestId);
      if (!p) return;
      p.lastKeepaliveAt = Date.now();
      if (!p.uiShown) p.uiShown = true;
    } catch {
    }
  }
  window.addEventListener("signguard:uiShown", (ev) => {
    try {
      const detail = ev?.detail || {};
      const requestId = String(detail.requestId || "");
      if (!requestId) return;
      markUiShown(requestId);
    } catch {
    }
  }, true);
  window.addEventListener("message", (ev) => {
    try {
      if (ev.source !== window) return;
      const d = ev?.data;
      if (!d || d.source !== "signguard" && d.source !== "signguard-content") return;
      if (d.type === "SG_UI_SHOWN") markUiShown(String(d.requestId || ""));
      if (d.type === "SG_KEEPALIVE") handleKeepalive(String(d.requestId || ""));
    } catch {
    }
  });
  window.addEventListener("click", (ev) => {
    try {
      const path = ev.composedPath && ev.composedPath();
      if (!path || !Array.isArray(path) || path.length === 0) return;
      let allow = null;
      for (let i = 0; i < path.length; i++) {
        const el = path[i];
        if (!el || typeof el.getAttribute !== "function") continue;
        const id = el.id;
        if (id === "sg-continue" || id === "sg-proceed") {
          allow = true;
          break;
        }
        if (id === "sg-cancel" || id === "sg-close") {
          allow = false;
          break;
        }
      }
      if (allow === null) return;
      let overlayRoot = null;
      for (let i = 0; i < path.length; i++) {
        const el = path[i];
        if (el?.getAttribute?.("data-sg-overlay") === "1") {
          overlayRoot = el;
          break;
        }
      }
      if (!overlayRoot) return;
      const requestId = overlayRoot.getAttribute("data-sg-request-id") || "";
      if (!requestId) return;
      if (!pendingCalls.has(requestId)) return;
      resumeDecisionInner(requestId, allow);
      ev.preventDefault();
      ev.stopImmediatePropagation();
    } catch {
    }
  }, true);
  window.addEventListener("signguard:decision", (ev) => {
    try {
      const detail = ev?.detail || {};
      const requestId = String(detail.requestId || "");
      const allow = !!detail.allow;
      const errorMessage = detail.errorMessage;
      resumeDecisionInner(requestId, allow, errorMessage);
    } catch {
    }
  }, true);
  window.addEventListener("sg:decision", (ev) => {
    try {
      const detail = ev?.detail || {};
      const requestId = String(detail.requestId || "");
      const allow = !!detail.allow;
      const errorMessage = detail.errorMessage;
      resumeDecisionInner(requestId, allow, errorMessage);
    } catch {
    }
  }, true);
  window.addEventListener("message", (ev) => {
    try {
      if (ev.source !== window) return;
      const d = ev?.data;
      if (!d || d.source !== "signguard" && d.source !== "signguard-content") return;
      if (d.type !== "SG_DECISION") return;
      void resumeDecisionInner(String(d.requestId || ""), !!d.allow, d.errorMessage);
    } catch {
    }
  });
  setInterval(() => {
    const now = Date.now();
    for (const [id, p] of pendingCalls.entries()) {
      const base = p.lastKeepaliveAt ?? p.createdAt;
      const timeout = p.uiShown ? TIMEOUT_MS_UI : TIMEOUT_MS_FAILOPEN;
      const expiresAt = p.uiShown ? Math.min(base + timeout, p.createdAt + KEEPALIVE_CAP_MS) : base + timeout;
      if (now <= expiresAt) continue;
      if (p.uiShown) {
        pendingCalls.delete(id);
        p.reject({ code: 4001, message: "SignGuard: timeout" });
        try {
          window.postMessage({ source: "signguard-inpage", type: "SG_DECISION_ACK", requestId: id, allow: false, expired: true }, "*");
        } catch {
        }
        continue;
      }
      if (p.failOpenArmed) {
        if (now > p.createdAt + FAILOPEN_WAIT_CAP_MS) {
          pendingCalls.delete(id);
          p.reject({ code: 4001, message: "SignGuard: timeout" });
          try {
            window.postMessage({ source: "signguard-inpage", type: "SG_DECISION_ACK", requestId: id, allow: false, expired: true }, "*");
          } catch {
          }
        }
        continue;
      }
      p.failOpenArmed = true;
      try {
        window.postMessage({ source: "signguard-inpage", type: "SG_FAILOPEN_ARMED", requestId: id }, "*");
      } catch {
      }
    }
  }, 5e3);
  function tryWrapAll() {
    const providers = listEvmProviders();
    const eth = window?.ethereum;
    for (let i = 0; i < providers.length; i++) {
      const p = providers[i];
      const src = i === 0 && p === eth ? "window.ethereum" : "ethereum.providers[i]";
      wrapProvider(p, i > 0 ? `provider-${i}` : void 0, src, String(i));
    }
    if (providers.length === 0) applyActiveProvider();
    tryWrapSolana();
  }
  function tryWrapSolana() {
    const sol = window.solana;
    if (!sol || sol.__sg_wrapped) return;
    const methods = ["connect", "signMessage", "signTransaction", "signAllTransactions", "signAndSendTransaction"];
    for (const m of methods) {
      if (typeof sol[m] !== "function") continue;
      const raw = sol[m].bind(sol);
      sol[m] = function(...args) {
        const wallet = detectSolWallet(sol);
        const requestId = sgId();
        return new Promise((resolve, reject) => {
          pendingCalls.set(requestId, {
            resolve,
            reject,
            runOriginal: () => Promise.resolve(raw(...args)),
            createdAt: Date.now(),
            method: `solana:${m}`,
            uiShown: false
          });
          try {
            window.postMessage({
              source: "signguard-inpage",
              type: "SG_REQUEST",
              requestId,
              payload: {
                id: requestId,
                url: location.href,
                origin: location.origin,
                host: location.host,
                method: `solana:${m}`,
                params: args?.length ? [{ method: m, argsCount: args.length }] : null,
                wallet,
                request: { method: `solana:${m}`, params: args },
                meta: { chainId: null }
              }
            }, "*");
          } catch {
          }
        });
      };
    }
    sol.__sg_wrapped = true;
  }
  function startWrapRetry() {
    window.addEventListener("ethereum#initialized", () => tryWrapAll(), { once: false });
    window.addEventListener("eip6963:announceProvider", (event) => {
      try {
        const info = event?.detail?.info;
        const provider = event?.detail?.provider;
        if (info && provider) {
          const existing = SG_ANNOUNCED_PROVIDERS.find((p) => p.uuid === info.uuid);
          if (!existing) {
            SG_ANNOUNCED_PROVIDERS.push({
              uuid: info.uuid || "",
              name: info.name || "Unknown",
              icon: info.icon,
              rdns: info.rdns,
              providerRef: provider
            });
            wrapProvider(provider, info.rdns || info.name, "eip6963", info.uuid, info.name);
          }
          applyActiveProvider();
        }
      } catch {
      }
    });
    try {
      window.dispatchEvent(new Event("eip6963:requestProvider"));
    } catch {
    }
    const started = Date.now();
    const interval = setInterval(() => {
      tryWrapAll();
      if (Date.now() - started > 1e4) clearInterval(interval);
    }, 50);
    try {
      const mo = new MutationObserver(() => tryWrapAll());
      mo.observe(document.documentElement, { childList: true, subtree: true });
      setTimeout(() => mo.disconnect(), 1e4);
    } catch {
    }
  }
  function startProviderGuardRewrap() {
    let lastEth = null;
    let lastReqFn = null;
    let lastSolana = null;
    let tries = 0;
    const maxTries = 10;
    const timer = setInterval(() => {
      tries++;
      try {
        const eth = window.ethereum;
        const reqFn = eth?.request;
        const sol = window.solana;
        const ethChanged = !!eth && eth !== lastEth;
        const reqChanged = !!eth && typeof reqFn === "function" && reqFn !== lastReqFn;
        const notWrapped = !!eth && typeof reqFn === "function" && !reqFn.__sg_wrapped;
        const solChanged = !!sol && sol !== lastSolana;
        const solNotWrapped = !!sol && !sol.__sg_wrapped;
        if (ethChanged || reqChanged || notWrapped || solChanged || solNotWrapped) {
          tryWrapAll();
          lastEth = eth || null;
          lastReqFn = eth?.request || null;
          lastSolana = sol || null;
        }
      } catch {
      }
      if (tries >= maxTries) {
        try {
          clearInterval(timer);
        } catch {
        }
      }
    }, 500);
  }
  var ALLOWED_RPC_METHODS = /* @__PURE__ */ new Set(["eth_call", "eth_chainid", "eth_getCode"]);
  window.addEventListener("message", (ev) => {
    try {
      if (ev.source !== window) return;
      const d = ev?.data;
      if (!d || d.source !== "signguard-content" || d.type !== "SG_RPC_CALL_REQUEST") return;
      const { id, method, params } = d;
      const methodNorm = String(method || "").toLowerCase();
      if (!ALLOWED_RPC_METHODS.has(methodNorm)) {
        window.postMessage({ source: "signguard", type: "SG_RPC_CALL_RESPONSE", id, error: "method_not_allowed" }, "*");
        return;
      }
      const eth = window.ethereum || SG_ACTIVE_PROVIDER;
      if (!eth?.request) {
        window.postMessage({ source: "signguard", type: "SG_RPC_CALL_RESPONSE", id, error: "no_provider" }, "*");
        return;
      }
      Promise.resolve(eth.request({ method: methodNorm, params: params || [] })).then((result) => window.postMessage({ source: "signguard", type: "SG_RPC_CALL_RESPONSE", id, result }, "*")).catch((err) => window.postMessage({ source: "signguard", type: "SG_RPC_CALL_RESPONSE", id, error: String(err?.message || err) }, "*"));
    } catch {
    }
  });
  function reportWalletsDetected() {
    try {
      const w = typeof window !== "undefined" ? window : null;
      if (!w) return;
      const names = [];
      if (w.ethereum) {
        if (w.ethereum.isMetaMask === true) names.push("MetaMask");
        if (w.ethereum.isRabby === true) names.push("Rabby");
        if (w.ethereum.isCoinbaseWallet === true) names.push("Coinbase Wallet");
        if (w.ethereum.isTrust === true || w.ethereum.isTrustWallet === true) names.push("Trust Wallet");
        if (w.ethereum.isOkxWallet === true || w.ethereum.isOKExWallet === true) names.push("OKX Wallet");
        if (w.ethereum.isBraveWallet === true) names.push("Brave Wallet");
        if (w.ethereum.isRainbow === true) names.push("Rainbow");
        if (w.ethereum.isPhantom === true) names.push("Phantom");
        if (w.ethereum.isBitget === true || w.ethereum.isBitKeep === true) names.push("Bitget");
        if (w.ethereum.isBinance === true || w.ethereum.isBinanceWallet === true) names.push("Binance Web3");
      }
      if (w.phantom?.solana) names.push("Phantom");
      if (w.coinbaseWalletExtension) names.push("Coinbase Wallet");
      const unique = [...new Set(names)];
      if (unique.length > 0) {
        window.postMessage(
          { __SIGNGUARD__: true, type: "TELEMETRY_WALLETS_DETECTED", data: { wallets: unique }, href: location.href, origin: location.origin, ts: Date.now() },
          "*"
        );
      }
    } catch {
    }
  }
  tryWrapAll();
  startWrapRetry();
  startProviderGuardRewrap();
  setTimeout(reportWalletsDetected, 500);
  setTimeout(reportWalletsDetected, 3e3);
})();
//# sourceMappingURL=mainWorld.js.map
