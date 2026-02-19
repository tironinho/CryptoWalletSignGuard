/**
 * Tenderly transaction simulation service for SignGuard.
 * Simulates transactions before they are sent to detect reverts and asset changes.
 * Uses internal API key (isolated/free account).
 */

import type { Settings } from "../shared/types";

const TENDERLY_API_BASE = "https://api.tenderly.co/api/v1";
const SIMULATE_TIMEOUT_MS = 4000;

/** No hardcoded credentials. Use settings.simulation (tenderlyAccount, tenderlyProject, tenderlyKey). When missing → static-only mode. */

/** Request body for Tenderly simulate endpoint. */
export interface SimulateTransactionBody {
  network_id: string;
  from: string;
  to: string;
  input: string;
  value: string;
  gas?: number;
}

/** Single asset entry for UI. */
export interface SimulationAsset {
  symbol: string;
  amount: string;
  logo?: string;
}

/** Approval decoded from logs. */
export type SimulationApproval = {
  token: string;
  spender: string;
  approved: boolean;
  unlimited?: boolean;
  /** True when from ApprovalForAll event (ERC721/1155). */
  approvalForAll?: boolean;
};

/** Simplified outcome for the overlay UI. */
export type SimulationOutcome = {
  status: "SUCCESS" | "REVERT" | "RISK" | "SKIPPED";
  outgoingAssets: SimulationAsset[];
  incomingAssets: SimulationAsset[];
  /** Approvals detected from simulation logs (ERC20 Approval, ERC721/1155 ApprovalForAll). */
  approvals?: SimulationApproval[];
  gasUsed: string;
  /** True when simulation was skipped (API failure / no credentials). */
  fallback?: boolean;
  /** Estimated gas cost in wei (gas_used * gas_price) when available. */
  gasCostWei?: string;
  /** True when estimated gas cost > $50 and tx value < $50 (set by background). */
  isHighGas?: boolean;
  /** False when running without API (no keys / timeout); show "Modo Estático" CTA. */
  simulated?: boolean;
  /** Message when simulated is false (e.g. "Modo Estático (Adicione chaves para Simulação)"). */
  message?: string;
};

/** Single asset change from Tenderly. */
type AssetChange = {
  asset_info?: { symbol?: string; name?: string; logo?: string; decimals?: number; contract_address?: string };
  type?: string;
  from?: string;
  to?: string;
  amount?: string;
  raw_amount?: string;
  dollar_value?: number;
};

/** Raw Tenderly simulation response (relevant fields). */
interface TenderlySimulationResponse {
  transaction?: {
    status?: number; // 0 = success, 1 = reverted
    transaction_info?: {
      call_trace?: unknown;
      asset_changes?: AssetChange[];
      logs?: Array<{ address?: string; topics?: string[]; data?: string }>;
    };
  };
  simulation?: { id?: string; status?: boolean };
  asset_changes?: AssetChange[];
  gas_used?: string;
  gas_price?: string;
  effective_gas_price?: string;
  [key: string]: unknown;
}

const KECCAK_APPROVAL = "0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925";
const KECCAK_APPROVAL_FOR_ALL = "0x17307eab39ab6107e8899845ad3d59bd9653f200f220920489ca2b5937696c31";

function normAddr(a: string | undefined): string {
  if (!a || typeof a !== "string") return "";
  const s = a.toLowerCase().replace(/^0x/, "").padStart(40, "0");
  return "0x" + s.slice(-40);
}

/** Decode Approval/ApprovalForAll from simulation logs. */
function decodeApprovalsFromLogs(logs: Array<{ address?: string; topics?: string[]; data?: string }> | undefined): SimulationApproval[] {
  const out: SimulationApproval[] = [];
  if (!Array.isArray(logs)) return out;
  for (const log of logs) {
    const t0 = log.topics?.[0];
    if (!t0) continue;
    const t0n = t0.toLowerCase();
    if (t0n === KECCAK_APPROVAL) {
      const owner = log.topics?.[1] ? normAddr("0x" + String(log.topics[1]).slice(-40)) : "";
      const spender = log.topics?.[2] ? normAddr("0x" + String(log.topics[2]).slice(-40)) : "";
      const token = normAddr(log.address);
      let value = 0n;
      try {
        if (log.data && log.data.startsWith("0x")) value = BigInt(log.data);
      } catch {}
      const unlimited = value >= 2n ** 256n - 2n ** 255n;
      out.push({ token, spender, approved: true, unlimited });
    } else if (t0n === KECCAK_APPROVAL_FOR_ALL) {
      const owner = log.topics?.[1] ? normAddr("0x" + String(log.topics[1]).slice(-40)) : "";
      const operator = log.topics?.[2] ? normAddr("0x" + String(log.topics[2]).slice(-40)) : "";
      const token = normAddr(log.address);
      let approved = false;
      try {
        if (log.data && log.data.startsWith("0x")) approved = BigInt(log.data) !== 0n;
      } catch {}
      out.push({ token, spender: operator, approved, approvalForAll: true });
    }
  }
  return out;
}

function getSimulateUrl(settings?: Settings): string | null {
  const account = settings?.simulation?.tenderlyAccount?.trim();
  const project = settings?.simulation?.tenderlyProject?.trim();
  if (!account || !project) return null;
  return `${TENDERLY_API_BASE}/account/${encodeURIComponent(account)}/project/${encodeURIComponent(project)}/simulate`;
}

/**
 * Call Tenderly simulate API. Returns null when no credentials (static-only) or on any error/timeout.
 * Uses only settings.simulation (tenderlyAccount, tenderlyProject, tenderlyKey); no hardcoded keys.
 */
export async function simulateTransaction(
  body: SimulateTransactionBody,
  settings?: Settings
): Promise<TenderlySimulationResponse | null> {
  const key = settings?.simulation?.tenderlyKey?.trim();
  const url = getSimulateUrl(settings);
  if (!url || !key) return null;

  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  try {
    const controller = new AbortController();
    timeoutId = setTimeout(() => controller.abort(), SIMULATE_TIMEOUT_MS);

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Access-Key": key,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    timeoutId = undefined;
    if (!res.ok) return null;
    const data = (await res.json()) as TenderlySimulationResponse;
    return data;
  } catch {
    if (timeoutId != null) try { clearTimeout(timeoutId); } catch {}
    return null;
  }
}

/** Build a SKIPPED outcome when API fails (network, 401/403, etc.). */
export function makeSkippedOutcome(): SimulationOutcome {
  return {
    status: "SKIPPED",
    outgoingAssets: [],
    incomingAssets: [],
    gasUsed: "0",
    fallback: true,
  };
}

/** Neutral outcome when credentials missing or timeout — graceful degradation, no throw. */
export function makeStaticModeOutcome(): SimulationOutcome {
  return {
    status: "SKIPPED",
    outgoingAssets: [],
    incomingAssets: [],
    gasUsed: "0",
    fallback: true,
    simulated: false,
    message: "Modo Estático (Adicione chaves para Simulação)",
  };
}

/**
 * Transform Tenderly simulation JSON into a simple outcome for the UI.
 * Classifies outgoing/incoming by wallet address (from tx.from).
 */
export function parseSimulationResult(
  data: TenderlySimulationResponse | null,
  walletAddress?: string
): SimulationOutcome | null {
  if (!data || typeof data !== "object") return null;

  const txStatus = data.transaction?.status;
  const status: SimulationOutcome["status"] =
    txStatus === 1 ? "REVERT" : txStatus === 0 ? "SUCCESS" : "RISK";

  const wallet = normAddr(walletAddress);
  const outgoingAssets: SimulationAsset[] = [];
  const incomingAssets: SimulationAsset[] = [];

  const assetChangesRaw =
    data.transaction?.transaction_info?.asset_changes ?? data.asset_changes;
  const assetChanges = Array.isArray(assetChangesRaw) ? assetChangesRaw : [];
  for (const change of assetChanges) {
    const info = change?.asset_info;
    const symbol = (info?.symbol || info?.name || "?").toString();
    const amount = (change?.amount ?? change?.raw_amount ?? "0").toString();
    const logo = typeof info?.logo === "string" ? info.logo : undefined;
    const entry: SimulationAsset = { symbol, amount, logo };

    const fromNorm = normAddr(change?.from);
    const toNorm = normAddr(change?.to);
    const type = String(change?.type || "").toUpperCase();

    if (wallet) {
      if (fromNorm === wallet) outgoingAssets.push(entry);
      else if (toNorm === wallet) incomingAssets.push(entry);
      else if (type.includes("SEND") || fromNorm) outgoingAssets.push(entry);
      else if (type.includes("RECEIVE") || toNorm) incomingAssets.push(entry);
      else outgoingAssets.push(entry);
    } else {
      if (type.includes("SEND") || change?.from) outgoingAssets.push(entry);
      else if (type.includes("RECEIVE") || change?.to) incomingAssets.push(entry);
      else outgoingAssets.push(entry);
    }
  }

  const logs = (data as any).transaction?.transaction_info?.logs;
  const approvals = decodeApprovalsFromLogs(Array.isArray(logs) ? logs : undefined);

  const gasUsed = typeof data.gas_used === "string" ? data.gas_used : (data.gas_used != null ? String(data.gas_used) : "0");

  let gasCostWei: string | undefined;
  try {
    const gasPrice =
      data.effective_gas_price ?? data.gas_price ?? (data as any).transaction?.gas_price;
    const gasPriceStr = typeof gasPrice === "string" ? gasPrice : gasPrice != null ? String(gasPrice) : "";
    const usedNum = BigInt(gasUsed);
    const priceNum = gasPriceStr ? BigInt(gasPriceStr) : 0n;
    if (usedNum > 0n && priceNum > 0n) {
      gasCostWei = (usedNum * priceNum).toString();
    }
  } catch {
    // ignore
  }

  const out: SimulationOutcome = {
    status,
    outgoingAssets,
    incomingAssets,
    gasUsed,
    gasCostWei,
    simulated: true,
  };
  if (approvals.length > 0) out.approvals = approvals;
  return out;
}

/**
 * Run simulation and return parsed outcome. On API failure (network, timeout), returns static-mode outcome.
 */
export async function runSimulation(
  networkId: string,
  from: string,
  to: string,
  input: string,
  value: string,
  gas: number | undefined,
  settings?: Settings
): Promise<SimulationOutcome | null> {
  try {
    const body: SimulateTransactionBody = {
      network_id: networkId,
      from,
      to,
      input: input || "0x",
      value: value || "0x0",
    };
    if (gas != null && gas > 0) body.gas = gas;

    const raw = await simulateTransaction(body, settings);
    if (raw) return parseSimulationResult(raw, from);
    return makeStaticModeOutcome();
  } catch {
    return makeStaticModeOutcome();
  }
}
