/**
 * Telemetry: REST-only Supabase (no @supabase/supabase-js) to avoid Service Worker crash in MV3.
 * Tables: installations, tx_logs, threat_reports. All failures are silent.
 */

const SUPABASE_URL = "https://cjnzidctntqzamhwmwkt.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNqbnppZGN0bnRxemFtaHdtd2t0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5MzIzNzQsImV4cCI6MjA4NjUwODM3NH0.NyUvGRPY1psOwpJytWG_d3IXwCwPxLtuSG6V1uX13mc";

const INSTALL_ID_KEY = "installId";

type GetSettingsFn = () => Promise<import("../shared/types").Settings>;
let getSettingsFn: GetSettingsFn | null = null;

export function initTelemetry(getSettings: GetSettingsFn): void {
  getSettingsFn = getSettings;
}

async function getTermsAccepted(): Promise<boolean> {
  try {
    const r = await new Promise<Record<string, boolean>>((resolve) => {
      if (typeof chrome?.storage?.local?.get !== "function") return resolve({});
      chrome.storage.local.get("termsAccepted", (res) => {
        resolve((res as Record<string, boolean>) ?? {});
      });
    });
    return r?.termsAccepted === true;
  } catch {
    return false;
  }
}

async function getOptIn(): Promise<boolean> {
  if (!(await getTermsAccepted())) return false;
  if (!getSettingsFn) return true;
  try {
    const s = await getSettingsFn();
    return s?.cloudIntelOptIn !== false;
  } catch {
    return true;
  }
}

/** Helper: POST to Supabase REST (no SDK). Fails silently. */
async function sendToSupabase(table: string, data: Record<string, unknown>): Promise<void> {
  try {
    if (typeof navigator !== "undefined" && !navigator.onLine) return;
    await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify(data),
    });
  } catch {
    // silent
  }
}

export async function getOrCreateInstallationId(): Promise<string> {
  return new Promise((resolve) => {
    try {
      if (typeof chrome?.storage?.local?.get !== "function") {
        resolve(typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : "unknown");
        return;
      }
      chrome.storage.local.get(INSTALL_ID_KEY, (r) => {
        if (chrome.runtime?.lastError) {
          const id = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : "unknown";
          chrome.storage.local.set({ [INSTALL_ID_KEY]: id }, () => resolve(id));
          return;
        }
        const id = (r as Record<string, string>)?.[INSTALL_ID_KEY];
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

export async function identifyUser(): Promise<string> {
  try {
    if (!(await getTermsAccepted())) return await getOrCreateInstallationId();
    let uuid = await getOrCreateInstallationId();
    if (uuid === "unknown") {
      uuid = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : "unknown";
      await new Promise<void>((resolve) => {
        chrome.storage.local.set({ [INSTALL_ID_KEY]: uuid }, () => resolve());
      });
    }
    if (await getOptIn()) {
      await sendToSupabase("installations", {
        install_id: uuid,
        user_agent: typeof navigator !== "undefined" ? navigator.userAgent : "",
        language: typeof navigator !== "undefined" ? navigator.language : "",
        timezone: typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : "",
        last_active_at: new Date().toISOString(),
      });
    }
    return uuid;
  } catch {
    return "unknown";
  }
}

export async function registerUser(): Promise<void> {
  await identifyUser();
}

export async function syncUserWallets(_wallets: string[]): Promise<void> {
  // Optional: send to user_wallets table via sendToSupabase; no-op for stability
}

export async function trackInterest(_category: string): Promise<void> {
  if (!(await getOptIn())) return;
  // Optional: batch to user_interests; no-op for stability
}

export async function trackTransaction(txData: {
  chain_id?: string;
  chainId?: string;
  asset_address?: string;
  contractAddress?: string;
  method?: string;
  status?: string;
  [k: string]: unknown;
}): Promise<void> {
  if (!(await getOptIn())) return;
  try {
    const installId = await getOrCreateInstallationId();
    await sendToSupabase("tx_logs", {
      install_id: installId,
      created_at: new Date().toISOString(),
      chain_id: txData.chain_id ?? txData.chainId ? String(txData.chain_id ?? txData.chainId) : null,
      asset_address: txData.asset_address ?? txData.contractAddress ?? null,
      method: txData.method ?? "unknown",
      status: txData.status ?? "simulated",
    });
  } catch {
    // silent
  }
}

export async function trackTx(payload: {
  chainId: string;
  contractAddress: string;
  method: string;
  valueUsd?: number;
}): Promise<void> {
  await trackTransaction({
    chain_id: payload.chainId,
    asset_address: payload.contractAddress,
    method: payload.method,
    status: "simulated",
  });
}

export async function trackThreat(
  url: string,
  score: number,
  reasons: string[],
  metadata?: Record<string, unknown>
): Promise<void> {
  if (!(await getOptIn())) return;
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
      created_at: new Date().toISOString(),
      ...(metadata && typeof metadata === "object" ? metadata : {}),
    });
  } catch {
    // silent
  }
}

export async function reportThreat(threatData: {
  url?: string;
  score?: number;
  reasons?: string[];
  metadata?: Record<string, unknown>;
}): Promise<void> {
  await trackThreat(
    threatData.url ?? "",
    threatData.score ?? 100,
    Array.isArray(threatData.reasons) ? threatData.reasons : [],
    threatData.metadata
  );
}

export async function trackEvent(_eventName: string, _props?: Record<string, unknown>): Promise<void> {
  if (!(await getOptIn())) return;
  // Optional: usage_events; no-op for stability
}

export async function trackSession(_data: { domain: string; referrer?: string; durationSec: number }): Promise<void> {
  if (!(await getOptIn())) return;
  // Optional: web3_sessions; no-op for stability
}

export async function trackInteraction(_data: {
  domain: string;
  kind?: string;
  props?: Record<string, unknown>;
}): Promise<void> {
  if (!(await getOptIn())) return;
  // Optional: ui_interactions; no-op for stability
}

export async function updateExtendedProfile(_data: Record<string, unknown>): Promise<void> {
  // Placeholder to avoid callers breaking
}

export const telemetry = {
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
  updateExtendedProfile,
};
