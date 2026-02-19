// src/lists/cryptoTrustedDomainsSeed.ts
var CRYPTO_TRUSTED_DOMAINS_SEED = [
  // Explorers
  "etherscan.io",
  "etherscan.com",
  "arbiscan.io",
  "polygonscan.com",
  "bscscan.com",
  "basescan.org",
  "snowtrace.io",
  "optimistic.etherscan.io",
  // NFTs
  "opensea.io",
  "blur.io",
  "looksrare.org",
  "x2y2.io",
  "rarible.com",
  "magiceden.io",
  // DEX/DeFi
  "uniswap.org",
  "app.uniswap.org",
  "1inch.io",
  "app.1inch.io",
  "aave.com",
  "app.aave.com",
  "curve.fi",
  "app.curve.fi",
  "balancer.fi",
  "app.balancer.fi",
  "sushiswap.fi",
  "matcha.xyz",
  "paraswap.io",
  "cowswap.exchange",
  // Bridges/L2
  "bridge.arbitrum.io",
  "optimism.io",
  "base.org",
  "arbitrum.io",
  "polygon.technology",
  "hop.exchange",
  "stargate.finance",
  "across.to",
  "portalbridge.com",
  "zksync.io",
  // Infra / Wallets
  "chain.link",
  "lido.fi",
  "stake.lido.fi",
  "ens.domains",
  "app.ens.domains",
  "metamask.io",
  "metamask.com",
  "rabby.io",
  "walletconnect.com",
  "walletconnect.org",
  "safe.global",
  "revoke.cash",
  "app.revoke.cash"
];

// src/shared/types.ts
var SUPPORTED_WALLETS = [
  { name: "MetaMask", kind: "EVM" },
  { name: "Coinbase Wallet", kind: "EVM" },
  { name: "Trust Wallet", kind: "EVM" },
  { name: "OKX Wallet", kind: "EVM" },
  { name: "Binance Web3", kind: "EVM" },
  { name: "Rabby", kind: "EVM" },
  { name: "Rainbow", kind: "EVM" },
  { name: "Phantom", kind: "EVM/Solana" },
  { name: "Brave Wallet", kind: "EVM" },
  { name: "Bitget Wallet", kind: "EVM" },
  { name: "MathWallet", kind: "EVM" },
  { name: "Solflare", kind: "Solana" },
  { name: "Backpack", kind: "Solana" }
];
var DEFAULT_SETTINGS = {
  riskWarnings: true,
  showConnectOverlay: true,
  blockHighRisk: true,
  requireTypedOverride: true,
  allowOverrideOnPhishing: false,
  debugMode: false,
  domainChecks: true,
  mode: "BALANCED",
  strictBlockApprovalsUnlimited: true,
  strictBlockSetApprovalForAll: true,
  strictBlockPermitLike: true,
  assetEnrichmentEnabled: true,
  addressIntelEnabled: true,
  cloudIntelOptIn: false,
  telemetryOptIn: false,
  telemetryEnabled: false,
  showUsd: false,
  defaultExpandDetails: true,
  planTier: "FREE",
  licenseKey: "",
  trustedDomains: CRYPTO_TRUSTED_DOMAINS_SEED.slice(0, 24),
  supportedWalletsInfo: SUPPORTED_WALLETS,
  allowlist: CRYPTO_TRUSTED_DOMAINS_SEED.slice(0, 24),
  customBlockedDomains: [],
  customTrustedDomains: [],
  allowlistSpenders: [],
  denylistSpenders: [],
  failMode: "fail_open",
  enableIntel: true,
  vault: {
    enabled: false,
    lockedContracts: [],
    unlockedUntil: 0,
    blockApprovals: false
  },
  simulation: {
    enabled: false,
    tenderlyAccount: "",
    tenderlyProject: "",
    tenderlyKey: ""
  },
  whitelistedDomains: [],
  fortressMode: false
};

// src/runtimeSafe.ts
function hasRuntime(c) {
  try {
    return !!(c?.runtime?.id && typeof c.runtime.sendMessage === "function");
  } catch {
    return false;
  }
}
function getChromeApi() {
  const localChrome = typeof chrome !== "undefined" ? chrome : null;
  if (hasRuntime(localChrome)) return localChrome;
  const globalChrome = typeof globalThis !== "undefined" ? globalThis.chrome : null;
  if (hasRuntime(globalChrome)) return globalChrome;
  return null;
}
async function safeStorageSet(obj) {
  return new Promise((resolve) => {
    try {
      const c = getChromeApi();
      if (!c?.storage?.sync) {
        resolve({ ok: false, error: "storage_unavailable" });
        return;
      }
      c.storage.sync.set(obj, () => {
        try {
          const err = c.runtime?.lastError;
          if (err) {
            resolve({ ok: false, error: err.message || String(err) });
            return;
          }
          resolve({ ok: true, data: true });
        } catch (e) {
          resolve({ ok: false, error: e?.message || String(e) });
        }
      });
    } catch (e) {
      resolve({ ok: false, error: e?.message || String(e) });
    }
  });
}

// src/shared/optionalOrigins.ts
var OPTIONAL_ORIGINS = {
  cloudIntel: [
    "https://raw.githubusercontent.com/*",
    "https://api.cryptoscamdb.org/*",
    "https://gitlab.com/*",
    "https://gateway.ipfs.io/*",
    "https://api.llama.fi/*"
  ],
  pricing: [
    "https://api.coingecko.com/*",
    "https://api.dexscreener.com/*"
  ],
  simulation: ["https://api.tenderly.co/*"],
  telemetry: ["https://cjnzidctntqzamhwmwkt.supabase.co/*"]
};
function getOriginsForFeature(feature) {
  const list = OPTIONAL_ORIGINS[feature];
  return list ? [...list] : [];
}

// src/permissions.ts
async function requestOrigins(origins) {
  if (!origins.length) return true;
  try {
    if (!chrome?.permissions?.request) return false;
    return await chrome.permissions.request({ origins });
  } catch {
    return false;
  }
}
async function requestOptionalHostPermissions(feature) {
  const origins = getOriginsForFeature(feature);
  return requestOrigins(origins);
}

// src/onboarding.ts
var acceptBtn = document.getElementById("sgOnbAccept");
var refuseBtn = document.getElementById("sgOnbRefuse");
var onbCloudIntel = document.getElementById("onbCloudIntel");
var onbTelemetry = document.getElementById("onbTelemetry");
var onbMessage = document.getElementById("onbMessage");
function showMessage(text, isError = false) {
  if (!onbMessage) return;
  onbMessage.textContent = text;
  onbMessage.classList.toggle("sg-onb-message--error", isError);
  onbMessage.style.display = text ? "block" : "none";
}
async function onAccept() {
  if (!acceptBtn) return;
  acceptBtn.disabled = true;
  showMessage("");
  try {
    await new Promise((resolve, reject) => {
      chrome.storage.local.set(
        { termsAccepted: true, installDate: Date.now() },
        () => chrome.runtime?.lastError ? reject(chrome.runtime.lastError) : resolve()
      );
    });
    const cloudIntel = onbCloudIntel?.checked === true;
    const telemetry = onbTelemetry?.checked === true;
    const current = await new Promise((resolve) => {
      chrome.storage.sync.get(DEFAULT_SETTINGS, (r) => {
        resolve(r ?? DEFAULT_SETTINGS);
      });
    });
    let cloudIntelFinal = false;
    if (cloudIntel) {
      const granted = await requestOptionalHostPermissions("cloudIntel");
      if (!granted) {
        showMessage("Sem permiss\xF5es, Cloud Intel permanecer\xE1 desativado. Voc\xEA pode ativar depois em Configura\xE7\xF5es.", true);
      } else {
        cloudIntelFinal = true;
      }
    }
    let telemetryFinal = false;
    if (telemetry) {
      const granted = await requestOptionalHostPermissions("telemetry");
      if (!granted) {
        showMessage("Sem permiss\xF5es, telemetria permanecer\xE1 desativada. Voc\xEA pode ativar depois em Configura\xE7\xF5es.", true);
      } else {
        telemetryFinal = true;
      }
    }
    const next = {
      ...current,
      cloudIntelOptIn: cloudIntelFinal,
      telemetryOptIn: telemetryFinal
    };
    await safeStorageSet(next);
  } catch {
    showMessage("Erro ao salvar. Tente novamente em Configura\xE7\xF5es.", true);
    acceptBtn.disabled = false;
    return;
  }
  try {
    if (typeof chrome.runtime?.openOptionsPage === "function") {
      chrome.runtime.openOptionsPage();
    } else {
      const url = typeof chrome.runtime?.getURL === "function" ? chrome.runtime.getURL("options.html") : "options.html";
      if (typeof chrome?.tabs?.create === "function") {
        chrome.tabs.create({ url });
      } else {
        window.location.href = url;
      }
    }
    try {
      window.close();
    } catch {
    }
  } catch {
    const url = typeof chrome.runtime?.getURL === "function" ? chrome.runtime.getURL("options.html") : "options.html";
    window.location.href = url;
  }
}
function onRefuse() {
  if (!refuseBtn) return;
  refuseBtn.disabled = true;
  try {
    if (typeof chrome?.runtime?.getURL === "function") {
      chrome.tabs.create?.({ url: "chrome://extensions/?id=" + chrome.runtime.id });
    }
  } catch {
    window.open("chrome://extensions/", "_blank");
  }
  try {
    window.close();
  } catch {
  }
}
acceptBtn?.addEventListener("click", () => void onAccept());
refuseBtn?.addEventListener("click", () => onRefuse());
//# sourceMappingURL=onboarding.js.map
