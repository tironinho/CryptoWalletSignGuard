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
  cloudIntelOptIn: true,
  showUsd: true,
  planTier: "FREE",
  licenseKey: "",
  trustedDomains: [
    "opensea.io",
    "blur.io",
    "app.uniswap.org",
    "uniswap.org",
    "looksrare.org",
    "x2y2.io",
    "etherscan.io",
    "arbitrum.io",
    "polygon.technology"
  ],
  supportedWalletsInfo: SUPPORTED_WALLETS,
  allowlist: [
    "opensea.io",
    "blur.io",
    "app.uniswap.org",
    "uniswap.org",
    "looksrare.org",
    "x2y2.io",
    "etherscan.io",
    "arbitrum.io",
    "polygon.technology"
  ],
  customBlockedDomains: [],
  customTrustedDomains: [],
  enableIntel: true,
  vault: {
    enabled: false,
    lockedContracts: []
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

// src/services/telemetryService.ts
var SUPABASE_URL = "https://cjnzidctntqzamhwmwkt.supabase.co";
var SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNqbnppZGN0bnRxemFtaHdtd2t0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5MzIzNzQsImV4cCI6MjA4NjUwODM3NH0.NyUvGRPY1psOwpJytWG_d3IXwCwPxLtuSG6V1uX13mc";
var INSTALL_ID_KEY = "installId";
var getSettingsFn = null;
async function getTermsAccepted() {
  try {
    const r = await new Promise((resolve) => {
      if (typeof chrome?.storage?.local?.get !== "function") return resolve({});
      chrome.storage.local.get("termsAccepted", (res) => {
        resolve(res ?? {});
      });
    });
    return r?.termsAccepted === true;
  } catch {
    return false;
  }
}
async function getOptIn() {
  if (!await getTermsAccepted()) return false;
  if (!getSettingsFn) return true;
  try {
    const s = await getSettingsFn();
    return s?.cloudIntelOptIn !== false;
  } catch {
    return true;
  }
}
async function sendToSupabase(table, data) {
  try {
    if (typeof navigator !== "undefined" && !navigator.onLine) return;
    await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal"
      },
      body: JSON.stringify(data)
    });
  } catch {
  }
}
async function getOrCreateInstallationId() {
  return new Promise((resolve) => {
    try {
      if (typeof chrome?.storage?.local?.get !== "function") {
        resolve(typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : "unknown");
        return;
      }
      chrome.storage.local.get(INSTALL_ID_KEY, (r) => {
        if (chrome.runtime?.lastError) {
          const id2 = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : "unknown";
          chrome.storage.local.set({ [INSTALL_ID_KEY]: id2 }, () => resolve(id2));
          return;
        }
        const id = r?.[INSTALL_ID_KEY];
        if (id && typeof id === "string") {
          resolve(id);
          return;
        }
        const newId = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : "unknown";
        chrome.storage.local.set({ [INSTALL_ID_KEY]: newId }, () => resolve(newId));
      });
    } catch {
      resolve("unknown");
    }
  });
}
async function identifyUser() {
  try {
    if (!await getTermsAccepted()) return await getOrCreateInstallationId();
    let uuid = await getOrCreateInstallationId();
    if (uuid === "unknown") {
      uuid = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : "unknown";
      await new Promise((resolve) => {
        chrome.storage.local.set({ [INSTALL_ID_KEY]: uuid }, () => resolve());
      });
    }
    if (await getOptIn()) {
      await sendToSupabase("installations", {
        install_id: uuid,
        user_agent: typeof navigator !== "undefined" ? navigator.userAgent : "",
        language: typeof navigator !== "undefined" ? navigator.language : "",
        timezone: typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : "",
        last_active_at: (/* @__PURE__ */ new Date()).toISOString()
      });
    }
    return uuid;
  } catch {
    return "unknown";
  }
}
async function registerUser() {
  await identifyUser();
}
async function syncUserWallets(_wallets) {
}
async function trackInterest(_category) {
  if (!await getOptIn()) return;
}
async function trackTransaction(txData) {
  if (!await getOptIn()) return;
  try {
    const installId = await getOrCreateInstallationId();
    await sendToSupabase("tx_logs", {
      install_id: installId,
      created_at: (/* @__PURE__ */ new Date()).toISOString(),
      chain_id: txData.chain_id ?? txData.chainId ? String(txData.chain_id ?? txData.chainId) : null,
      asset_address: txData.asset_address ?? txData.contractAddress ?? null,
      method: txData.method ?? "unknown",
      status: txData.status ?? "simulated"
    });
  } catch {
  }
}
async function trackTx(payload) {
  await trackTransaction({
    chain_id: payload.chainId,
    asset_address: payload.contractAddress,
    method: payload.method,
    status: "simulated"
  });
}
async function trackThreat(url, score, reasons, metadata) {
  if (!await getOptIn()) return;
  try {
    const installId = await getOrCreateInstallationId();
    let domain = "";
    try {
      domain = new URL(url).hostname;
    } catch {
      domain = url?.slice(0, 256) ?? "";
    }
    await sendToSupabase("threat_reports", {
      install_id: installId,
      url: url?.slice(0, 2048) ?? "",
      domain,
      risk_score: score,
      risk_reason: Array.isArray(reasons) ? reasons.join(", ") : "Unknown",
      created_at: (/* @__PURE__ */ new Date()).toISOString(),
      ...metadata && typeof metadata === "object" ? metadata : {}
    });
  } catch {
  }
}
async function reportThreat(threatData) {
  await trackThreat(
    threatData.url ?? "",
    threatData.score ?? 100,
    Array.isArray(threatData.reasons) ? threatData.reasons : [],
    threatData.metadata
  );
}
async function trackEvent(_eventName, _props) {
  if (!await getOptIn()) return;
}
async function trackSession(_data) {
  if (!await getOptIn()) return;
}
async function trackInteraction(_data) {
  if (!await getOptIn()) return;
}
async function updateExtendedProfile(_data) {
}
var telemetry = {
  identifyUser,
  registerUser,
  syncUserWallets,
  trackInterest,
  trackThreat,
  reportThreat,
  trackTransaction,
  trackEvent,
  trackTx,
  trackSession,
  trackInteraction,
  updateExtendedProfile
};

// src/onboarding.ts
var acceptBtn = document.getElementById("sgOnbAccept");
var refuseBtn = document.getElementById("sgOnbRefuse");
async function onAccept() {
  if (!acceptBtn) return;
  acceptBtn.disabled = true;
  try {
    await new Promise((resolve, reject) => {
      chrome.storage.local.set(
        { termsAccepted: true, installDate: Date.now() },
        () => chrome.runtime?.lastError ? reject(chrome.runtime.lastError) : resolve()
      );
    });
    const current = await new Promise((resolve) => {
      chrome.storage.sync.get(DEFAULT_SETTINGS, (r) => {
        resolve(r ?? DEFAULT_SETTINGS);
      });
    });
    await new Promise((resolve, reject) => {
      chrome.storage.sync.set(
        { ...current, cloudIntelOptIn: true },
        () => chrome.runtime?.lastError ? reject(chrome.runtime.lastError) : resolve()
      );
    });
    await telemetry.registerUser();
  } catch {
  }
  try {
    const url = typeof chrome.runtime?.getURL === "function" ? chrome.runtime.getURL("options.html") : "options.html";
    if (typeof chrome?.tabs?.getCurrent === "function") {
      chrome.tabs.getCurrent((tab) => {
        if (tab?.id != null && chrome.tabs?.update) {
          chrome.tabs.update(tab.id, { url });
        } else {
          window.location.href = url;
        }
      });
    } else {
      window.location.href = url;
    }
  } catch {
    window.location.href = "options.html";
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
