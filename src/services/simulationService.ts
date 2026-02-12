/**
 * Tenderly transaction simulation service for SignGuard.
 * Simulates transactions before they are sent to detect reverts and asset changes.
 */

const TENDERLY_API_BASE = "https://api.tenderly.co/api/v1";
const TENDERLY_ACCESS_TOKEN = "gO4ionqLICPca6aXwUkp0TY36VIClptr";

// TODO: Replace with your Tenderly Account Slug (dashboard URL: https://dashboard.tenderly.co/<ACCOUNT_SLUG>/)
const TENDERLY_ACCOUNT_SLUG = "YOUR_ACCOUNT_SLUG";

// TODO: Replace with your Tenderly Project Slug (dashboard URL: .../<ACCOUNT_SLUG>/<PROJECT_SLUG>/)
const TENDERLY_PROJECT_SLUG = "YOUR_PROJECT_SLUG";

const SIMULATE_TIMEOUT_MS = 8000;

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

/** Simplified outcome for the overlay UI. */
export type SimulationOutcome = {
  status: "SUCCESS" | "REVERT" | "RISK";
  outgoingAssets: SimulationAsset[];
  incomingAssets: SimulationAsset[];
  gasUsed: string;
};

/** Raw Tenderly simulation response (relevant fields). */
interface TenderlySimulationResponse {
  transaction?: {
    status?: number; // 0 = success, 1 = reverted
    transaction_info?: {
      call_trace?: unknown;
    };
  };
  simulation?: {
    id?: string;
    status?: boolean;
  };
  asset_changes?: Array<{
    asset_info?: {
      symbol?: string;
      name?: string;
      logo?: string;
      decimals?: number;
    };
    type?: string;
    from?: string;
    to?: string;
    amount?: string;
    raw_amount?: string;
    dollar_value?: number;
  }>;
  gas_used?: string;
  [key: string]: unknown;
}

function getSimulateUrl(): string {
  return `${TENDERLY_API_BASE}/account/${TENDERLY_ACCOUNT_SLUG}/project/${TENDERLY_PROJECT_SLUG}/simulate`;
}

/**
 * Call Tenderly simulate API. Returns null on any error or timeout.
 */
export async function simulateTransaction(
  body: SimulateTransactionBody
): Promise<TenderlySimulationResponse | null> {
  const url = getSimulateUrl();
  if (TENDERLY_ACCOUNT_SLUG === "YOUR_ACCOUNT_SLUG" || TENDERLY_PROJECT_SLUG === "YOUR_PROJECT_SLUG") {
    return null;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), SIMULATE_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Access-Key": TENDERLY_ACCESS_TOKEN,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    if (!res.ok) return null;
    const data = (await res.json()) as TenderlySimulationResponse;
    return data;
  } catch {
    clearTimeout(timeoutId);
    return null;
  }
}

/**
 * Transform Tenderly simulation JSON into a simple outcome for the UI.
 */
export function parseSimulationResult(data: TenderlySimulationResponse | null): SimulationOutcome | null {
  if (!data || typeof data !== "object") return null;

  const txStatus = data.transaction?.status;
  const status: SimulationOutcome["status"] =
    txStatus === 1 ? "REVERT" : txStatus === 0 ? "SUCCESS" : "RISK";

  const outgoingAssets: SimulationAsset[] = [];
  const incomingAssets: SimulationAsset[] = [];

  const assetChanges = Array.isArray(data.asset_changes) ? data.asset_changes : [];
  for (const change of assetChanges) {
    const info = change?.asset_info;
    const symbol = (info?.symbol || info?.name || "?").toString();
    const amount = (change?.amount ?? change?.raw_amount ?? "0").toString();
    const logo = typeof info?.logo === "string" ? info.logo : undefined;
    const entry: SimulationAsset = { symbol, amount, logo };

    // Heuristic: "from" is often the user (outgoing), "to" is recipient (incoming for recipient).
    // For a single user simulation, outgoing = assets leaving from, incoming = assets arriving to.
    const type = String(change?.type || "").toUpperCase();
    if (type.includes("SEND") || change?.from) {
      outgoingAssets.push(entry);
    } else if (type.includes("RECEIVE") || change?.to) {
      incomingAssets.push(entry);
    } else {
      outgoingAssets.push(entry);
    }
  }

  const gasUsed = typeof data.gas_used === "string" ? data.gas_used : (data.gas_used != null ? String(data.gas_used) : "0");

  return {
    status,
    outgoingAssets,
    incomingAssets,
    gasUsed,
  };
}

/**
 * Run simulation and return parsed outcome. Returns null if simulation is skipped or fails.
 */
export async function runSimulation(
  networkId: string,
  from: string,
  to: string,
  input: string,
  value: string,
  gas?: number
): Promise<SimulationOutcome | null> {
  const body: SimulateTransactionBody = {
    network_id: networkId,
    from,
    to,
    input: input || "0x",
    value: value || "0x0",
  };
  if (gas != null && gas > 0) body.gas = gas;

  const raw = await simulateTransaction(body);
  return parseSimulationResult(raw);
}
