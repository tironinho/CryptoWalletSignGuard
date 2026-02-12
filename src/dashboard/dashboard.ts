import type { Settings } from "../shared/types";
import { DEFAULT_SETTINGS } from "../shared/types";
import { safeStorageGet } from "../runtimeSafe";

const LAST_VERIFICATION_KEY = "sg_lastVerification";
const INTEL_KEY = "sg_intel";

export interface Allowance {
  tokenSymbol: string;
  tokenAddress: string;
  amount: string;
  amountRaw?: string;
  spenderAddress: string;
  spenderLabel?: string;
}

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

async function getStorageSync(): Promise<Partial<Settings>> {
  const r = await safeStorageGet<Record<string, unknown>>(DEFAULT_SETTINGS as unknown as Record<string, unknown>);
  return r.ok ? (r.data as Partial<Settings>) : {};
}

function getStorageLocal(keys: string[]): Promise<Record<string, unknown>> {
  return new Promise((resolve) => {
    try {
      if (!chrome?.storage?.local) return resolve({});
      const keyObj = keys.length ? keys.reduce<Record<string, unknown>>((o, k) => ({ ...o, [k]: null }), {}) : {};
      chrome.storage.local.get(keyObj, (r: Record<string, unknown>) => {
        if (chrome.runtime?.lastError) return resolve({});
        resolve(r || {});
      });
    } catch {
      resolve({});
    }
  });
}

function setLastVerification(ts: number) {
  try {
    chrome?.storage?.local?.set?.({ [LAST_VERIFICATION_KEY]: ts }, () => void 0);
  } catch {}
}

function formatDate(ts: number | null | undefined): string {
  if (!ts || !Number.isFinite(ts)) return "—";
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return String(ts);
  }
}

const HISTORY_KEY = "sg_history_v1";

/** Health check: last verification date and protection level from storage. */
async function renderHealthCheck() {
  const settings = await getStorageSync();
  const local = await getStorageLocal([LAST_VERIFICATION_KEY, INTEL_KEY, HISTORY_KEY]);

  const lastVerificationTs =
    (local[LAST_VERIFICATION_KEY] as number) ??
    (typeof (local[INTEL_KEY] as any)?.updatedAt === "number" ? (local[INTEL_KEY] as any).updatedAt : null);
  const lastEl = $("lastVerification");
  if (lastEl) lastEl.textContent = formatDate(lastVerificationTs);

  const mode = settings.mode ?? DEFAULT_SETTINGS.mode ?? "BALANCED";
  const isPaused = mode === "OFF";
  const levelEl = $("protectionLevel");
  if (levelEl) {
    levelEl.textContent = isPaused ? "Pausado" : "Ativo";
    levelEl.className = isPaused ? "sg-badge-paused" : "sg-badge-active";
  }

  const history = local[HISTORY_KEY] as unknown[] | undefined;
  const historyArr = Array.isArray(history) ? history : [];
  const risksBlocked = historyArr.filter((e: any) => e?.verdict === "deny" || e?.verdict === "block").length;
  const risksEl = $("statRisksBlocked");
  if (risksEl) risksEl.textContent = String(risksBlocked);

  const valueSavedEl = $("statValueSaved");
  if (valueSavedEl) valueSavedEl.textContent = "—";
}

/** Mock data for Token Allowances (no Covalent/Etherscan key yet). */
export function fetchAllowances(_address: string): Promise<Allowance[]> {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve([
        {
          tokenSymbol: "USDC",
          tokenAddress: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
          amount: "Unlimited",
          amountRaw: "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
          spenderAddress: "0x1234567890123456789012345678901234567890",
          spenderLabel: "0x123...890",
        },
        {
          tokenSymbol: "WETH",
          tokenAddress: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
          amount: "500.0",
          amountRaw: "500000000000000000000",
          spenderAddress: "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D",
          spenderLabel: "Uniswap Router",
        },
      ]);
    }, 300);
  });
}

/** Open Revoke.cash for the given address (extension pages have no window.ethereum). */
function openRevokeCash(walletAddress: string) {
  const base = "https://revoke.cash/address/";
  const url = walletAddress ? base + encodeURIComponent(walletAddress) : "https://revoke.cash/";
  try {
    chrome.tabs.create({ url });
  } catch {
    window.open(url, "_blank");
  }
}

function shortenAddr(addr: string): string {
  if (!addr || addr.length < 12) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function renderAllowances(list: Allowance[], walletAddressForRevoke: string) {
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
        ${list
          .map(
            (a) => `
        <tr>
          <td><span class="sg-mono">${escapeHtml(a.tokenSymbol)}</span></td>
          <td>${escapeHtml(a.amount)}</td>
          <td class="sg-mono">${escapeHtml(a.spenderLabel ?? shortenAddr(a.spenderAddress))}</td>
          <td><button type="button" class="sg-btn-revoke revoke-btn">Revoke.cash</button></td>
        </tr>`
          )
          .join("")}
      </tbody>
    </table>`;

  listEl.querySelectorAll(".revoke-btn").forEach((btn) => {
    btn.addEventListener("click", () => openRevokeCash(walletAddressForRevoke));
  });
}

function escapeHtml(s: string): string {
  const div = document.createElement("div");
  div.textContent = s;
  return div.innerHTML;
}

let cachedAllowances: Allowance[] = [];

async function loadAllowances() {
  const input = $<HTMLInputElement>("walletAddress");
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
  } catch (e: any) {
    errEl.textContent = e?.message ?? "Erro ao carregar aprovações.";
    errEl.classList.remove("hidden");
    cachedAllowances = [];
    renderAllowances([], "");
  }
}

function init() {
  const configLink = $("configLink");
  if (configLink && typeof chrome?.runtime?.getURL === "function") {
    (configLink as HTMLAnchorElement).href = chrome.runtime.getURL("options.html");
  }

  renderHealthCheck();
  setLastVerification(Date.now());

  $("loadAllowances")?.addEventListener("click", loadAllowances);
  $("refreshAllowances")?.addEventListener("click", () => {
    if (cachedAllowances.length) loadAllowances();
  });
}

init();
