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

/** Health check: last verification date and protection level from storage. */
async function renderHealthCheck() {
  const settings = await getStorageSync();
  const local = await getStorageLocal([LAST_VERIFICATION_KEY, INTEL_KEY]);

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
    levelEl.className = `font-semibold rounded-full px-3 py-1 ${isPaused ? "sg-badge-paused" : "sg-badge-active"}`;
  }
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

/** Build ABI-encoded calldata for ERC20 approve(spender, 0). */
function encodeApproveZero(spenderAddress: string): string {
  const selector = "0x095ea7b3";
  const addr = spenderAddress.replace(/^0x/i, "").padStart(64, "0");
  const amount = "0".padStart(64, "0");
  return selector + addr + amount;
}

/** Send approve(spender, 0) via the user's wallet. */
async function revokeAllowance(allowance: Allowance): Promise<{ success: boolean; error?: string }> {
  const ethereum = (window as any).ethereum;
  if (!ethereum?.request) {
    return { success: false, error: "Carteira não detetada (window.ethereum)." };
  }
  const data = encodeApproveZero(allowance.spenderAddress);
  try {
    await ethereum.request({
      method: "eth_sendTransaction",
      params: [
        {
          to: allowance.tokenAddress,
          data,
          value: "0x0",
          gas: "0x0", // let wallet estimate
        },
      ],
    });
    return { success: true };
  } catch (e: any) {
    const msg = e?.message || String(e);
    if (msg.includes("User rejected") || msg.includes("user rejected") || msg.includes("4001")) {
      return { success: false, error: "Pedido cancelado pelo utilizador." };
    }
    return { success: false, error: msg || "Erro ao enviar transação." };
  }
}

function shortenAddr(addr: string): string {
  if (!addr || addr.length < 12) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function renderAllowances(list: Allowance[]) {
  const listEl = $("allowancesList");
  const emptyEl = $("allowancesEmpty");
  if (!list.length) {
    listEl.innerHTML = "";
    if (emptyEl) emptyEl.classList.remove("hidden");
    return;
  }
  if (emptyEl) emptyEl.classList.add("hidden");
  listEl.innerHTML = list
    .map(
      (a, i) => `
    <div class="sg-panel p-4 flex flex-wrap items-center justify-between gap-3 allowance-row" data-index="${i}">
      <div class="min-w-0">
        <div class="font-semibold text-white">${escapeHtml(a.tokenSymbol)}</div>
        <div class="sg-muted text-xs mt-0.5">${escapeHtml(a.amount)} · Spender: ${escapeHtml(a.spenderLabel ?? shortenAddr(a.spenderAddress))}</div>
      </div>
      <button type="button" class="sg-btn-revoke rounded-lg px-3 py-1.5 text-sm font-semibold revoke-btn" data-index="${i}">REVOGAR</button>
    </div>
  `
    )
    .join("");

  listEl.querySelectorAll(".revoke-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const index = parseInt((btn as HTMLElement).getAttribute("data-index") ?? "-1", 10);
      const allowance = list[index];
      if (!allowance) return;
      (btn as HTMLButtonElement).disabled = true;
      (btn as HTMLButtonElement).textContent = "A enviar…";
      const result = await revokeAllowance(allowance);
      if (result.success) {
        (btn as HTMLButtonElement).textContent = "Enviado";
      } else {
        (btn as HTMLButtonElement).textContent = "REVOGAR";
        (btn as HTMLButtonElement).disabled = false;
        alert(result.error ?? "Erro ao revogar.");
      }
    });
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
    renderAllowances([]);
    return;
  }
  try {
    const list = await fetchAllowances(address);
    cachedAllowances = list;
    renderAllowances(list);
  } catch (e: any) {
    errEl.textContent = e?.message ?? "Erro ao carregar aprovações.";
    errEl.classList.remove("hidden");
    cachedAllowances = [];
    renderAllowances([]);
  }
}

function init() {
  renderHealthCheck();
  setLastVerification(Date.now());

  $("loadAllowances")?.addEventListener("click", loadAllowances);
  $("refreshAllowances")?.addEventListener("click", () => {
    if (cachedAllowances.length) loadAllowances();
  });
}

init();
