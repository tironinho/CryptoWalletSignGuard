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

// src/runtimeSafe.ts
function canUseRuntime() {
  try {
    const c = (typeof globalThis !== "undefined" ? globalThis.chrome : void 0) ?? (typeof chrome !== "undefined" ? chrome : void 0);
    return !!(c?.runtime?.id && typeof c.runtime.sendMessage === "function");
  } catch {
    return false;
  }
}
function isRuntimeUsable() {
  try {
    return canUseRuntime();
  } catch {
    return false;
  }
}
async function safeStorageGet(keys) {
  return new Promise((resolve) => {
    try {
      if (!isRuntimeUsable() || !chrome?.storage?.sync) {
        resolve({ ok: false, error: "storage_unavailable" });
        return;
      }
      chrome.storage.sync.get(keys, (items) => {
        try {
          const err = chrome.runtime.lastError;
          if (err) {
            resolve({ ok: false, error: err.message || String(err) });
            return;
          }
          resolve({ ok: true, data: items });
        } catch (e) {
          resolve({ ok: false, error: e?.message || String(e) });
        }
      });
    } catch (e) {
      resolve({ ok: false, error: e?.message || String(e) });
    }
  });
}

// src/dashboard/dashboard.ts
var LAST_VERIFICATION_KEY = "sg_lastVerification";
var INTEL_KEY = "sg_intel";
var $ = (id) => document.getElementById(id);
async function getStorageSync() {
  const r = await safeStorageGet(DEFAULT_SETTINGS);
  return r.ok ? r.data : {};
}
function getStorageLocal(keys) {
  return new Promise((resolve) => {
    try {
      if (!chrome?.storage?.local) return resolve({});
      const keyObj = keys.length ? keys.reduce((o, k) => ({ ...o, [k]: null }), {}) : {};
      chrome.storage.local.get(keyObj, (r) => {
        if (chrome.runtime?.lastError) return resolve({});
        resolve(r || {});
      });
    } catch {
      resolve({});
    }
  });
}
function setLastVerification(ts) {
  try {
    chrome?.storage?.local?.set?.({ [LAST_VERIFICATION_KEY]: ts }, () => void 0);
  } catch {
  }
}
function formatDate(ts) {
  if (!ts || !Number.isFinite(ts)) return "\u2014";
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return String(ts);
  }
}
var HISTORY_KEY = "sg_history_v1";
async function renderHealthCheck() {
  const settings = await getStorageSync();
  const local = await getStorageLocal([LAST_VERIFICATION_KEY, INTEL_KEY, HISTORY_KEY]);
  const lastVerificationTs = local[LAST_VERIFICATION_KEY] ?? (typeof local[INTEL_KEY]?.updatedAt === "number" ? local[INTEL_KEY].updatedAt : null);
  const lastEl = $("lastVerification");
  if (lastEl) lastEl.textContent = formatDate(lastVerificationTs);
  const mode = settings.mode ?? DEFAULT_SETTINGS.mode ?? "BALANCED";
  const isPaused = mode === "OFF";
  const levelEl = $("protectionLevel");
  if (levelEl) {
    levelEl.textContent = isPaused ? "Pausado" : "Ativo";
    levelEl.className = isPaused ? "sg-badge-paused" : "sg-badge-active";
  }
  const history = local[HISTORY_KEY];
  const historyArr = Array.isArray(history) ? history : [];
  const risksBlocked = historyArr.filter((e) => e?.verdict === "deny" || e?.verdict === "block").length;
  const risksEl = $("statRisksBlocked");
  if (risksEl) risksEl.textContent = String(risksBlocked);
  const valueSavedEl = $("statValueSaved");
  if (valueSavedEl) valueSavedEl.textContent = "\u2014";
}
function fetchAllowances(_address) {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve([
        {
          tokenSymbol: "USDC",
          tokenAddress: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
          amount: "Unlimited",
          amountRaw: "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
          spenderAddress: "0x1234567890123456789012345678901234567890",
          spenderLabel: "0x123...890"
        },
        {
          tokenSymbol: "WETH",
          tokenAddress: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
          amount: "500.0",
          amountRaw: "500000000000000000000",
          spenderAddress: "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D",
          spenderLabel: "Uniswap Router"
        }
      ]);
    }, 300);
  });
}
function openRevokeCash(walletAddress) {
  const base = "https://revoke.cash/address/";
  const url = walletAddress ? base + encodeURIComponent(walletAddress) : "https://revoke.cash/";
  try {
    chrome.tabs.create({ url });
  } catch {
    window.open(url, "_blank");
  }
}
function shortenAddr(addr) {
  if (!addr || addr.length < 12) return addr;
  return `${addr.slice(0, 6)}\u2026${addr.slice(-4)}`;
}
function renderAllowances(list, walletAddressForRevoke) {
  const listEl = $("allowancesList");
  const emptyEl = $("allowancesEmpty");
  if (!list.length) {
    listEl.innerHTML = "";
    if (emptyEl) emptyEl.classList.remove("hidden");
    return;
  }
  if (emptyEl) emptyEl.classList.add("hidden");
  listEl.innerHTML = `
    <table class="sg-allowances-table" role="grid">
      <thead>
        <tr>
          <th>Token</th>
          <th>Montante</th>
          <th>Spender</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        ${list.map(
    (a) => `
        <tr>
          <td><span class="sg-mono">${escapeHtml(a.tokenSymbol)}</span></td>
          <td>${escapeHtml(a.amount)}</td>
          <td class="sg-mono">${escapeHtml(a.spenderLabel ?? shortenAddr(a.spenderAddress))}</td>
          <td><button type="button" class="sg-btn-revoke revoke-btn">Revoke.cash</button></td>
        </tr>`
  ).join("")}
      </tbody>
    </table>`;
  listEl.querySelectorAll(".revoke-btn").forEach((btn) => {
    btn.addEventListener("click", () => openRevokeCash(walletAddressForRevoke));
  });
}
function escapeHtml(s) {
  const div = document.createElement("div");
  div.textContent = s;
  return div.innerHTML;
}
var cachedAllowances = [];
async function loadAllowances() {
  const input = $("walletAddress");
  const address = (input?.value ?? "").trim();
  const errEl = $("allowancesError");
  errEl.classList.add("hidden");
  errEl.textContent = "";
  if (!address) {
    cachedAllowances = [];
    renderAllowances([], "");
    return;
  }
  try {
    const list = await fetchAllowances(address);
    cachedAllowances = list;
    renderAllowances(list, address);
  } catch (e) {
    errEl.textContent = e?.message ?? "Erro ao carregar aprova\xE7\xF5es.";
    errEl.classList.remove("hidden");
    cachedAllowances = [];
    renderAllowances([], "");
  }
}
function init() {
  const configLink = $("configLink");
  if (configLink && typeof chrome?.runtime?.getURL === "function") {
    configLink.href = chrome.runtime.getURL("options.html");
  }
  renderHealthCheck();
  setLastVerification(Date.now());
  $("loadAllowances")?.addEventListener("click", loadAllowances);
  $("refreshAllowances")?.addEventListener("click", () => {
    if (cachedAllowances.length) loadAllowances();
  });
}
init();
export {
  fetchAllowances
};
//# sourceMappingURL=dashboard.js.map
