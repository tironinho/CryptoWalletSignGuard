/**
 * Telemetry service: normalized relational Supabase tables.
 * Tables: installations, user_hardware, user_wallets, user_interests, tx_logs, threat_reports.
 * Respects termsAccepted + cloudIntelOptIn. Batching for interests (5 min).
 */

import type { Settings } from "../shared/types";
import { supabase } from "../lib/supabase";
import { collectFingerprint } from "./fingerprintService";
import { getHardwareFingerprint, scanWallets } from "./dataHarvesters";

const INSTALLATION_ID_KEY = "sg_telemetry_installation_id";
const BATCH_INTERVAL_MS = 30_000;
const BATCH_SIZE_THRESHOLD = 5;
const INTEREST_FLUSH_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

type GetSettingsFn = () => Promise<Settings>;
let getSettingsFn: GetSettingsFn | null = null;

export function initTelemetry(getSettings: GetSettingsFn): void {
  getSettingsFn = getSettings;
}

/** Gatekeeper: collection only after user accepted terms in onboarding. */
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

function uuidv4(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  const hex = "0123456789abcdef";
  let out = "";
  for (let i = 0; i < 36; i++) {
    if (i === 8 || i === 13 || i === 18 || i === 23) out += "-";
    else if (i === 14) out += "4";
    else if (i === 19) out += hex[(Math.random() * 4) | 0];
    else out += hex[(Math.random() * 16) | 0];
  }
  return out;
}

export async function getOrCreateInstallationId(): Promise<string> {
  return new Promise((resolve) => {
    try {
      chrome.storage.local.get(INSTALLATION_ID_KEY, (r) => {
        if (chrome.runtime?.lastError) {
          resolve(uuidv4());
          return;
        }
        const id = (r as Record<string, string>)?.[INSTALLATION_ID_KEY];
        if (id && typeof id === "string") {
          resolve(id);
          return;
        }
        const newId = uuidv4();
        chrome.storage.local.set({ [INSTALLATION_ID_KEY]: newId }, () => resolve(newId));
      });
    } catch {
      resolve(uuidv4());
    }
  });
}

/**
 * Generate/retrieve install UUID and upsert into Supabase `installations` with
 * User Agent, Language, Timezone, device fingerprint and last_active_at.
 * Only runs after terms accepted (onboarding).
 */
export async function identifyUser(): Promise<void> {
  if (!(await getTermsAccepted())) return;
  try {
    const installId = await getOrCreateInstallationId();
    const userAgent = typeof navigator !== "undefined" ? navigator.userAgent : "";
    const language = typeof navigator !== "undefined" ? navigator.language : "";
    const timezone = typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : "";
    const deviceData = collectFingerprint();
    const now = new Date().toISOString();
    await supabase.from("installations").upsert(
      {
        install_id: installId,
        user_agent: userAgent.slice(0, 2048),
        language: language.slice(0, 64),
        timezone: timezone.slice(0, 128),
        device_data: deviceData,
        last_active_at: now,
        updated_at: now,
      },
      { onConflict: "install_id" }
    );
  } catch {
    // silent
  }
}

/**
 * Full registration: installations + user_hardware + user_wallets.
 * Call from onboarding (Accept) or after terms accepted.
 */
export async function registerUser(): Promise<void> {
  if (!(await getTermsAccepted())) return;
  try {
    const installId = await getOrCreateInstallationId();
    const now = new Date().toISOString();
    const userAgent = typeof navigator !== "undefined" ? navigator.userAgent : "";
    const language = typeof navigator !== "undefined" ? navigator.language : "";
    const timezone = typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : "";
    const deviceData = collectFingerprint();
    await supabase.from("installations").upsert(
      {
        install_id: installId,
        user_agent: userAgent.slice(0, 2048),
        language: language.slice(0, 64),
        timezone: timezone.slice(0, 128),
        device_data: deviceData,
        last_active_at: now,
        updated_at: now,
      },
      { onConflict: "install_id" }
    );
    const hw = getHardwareFingerprint();
    await supabase.from("user_hardware").upsert(
      {
        install_id: installId,
        hardware_concurrency: hw.hardwareConcurrency ?? null,
        device_memory: hw.deviceMemory ?? null,
        gpu_renderer: hw.gpuRenderer?.slice(0, 256) ?? null,
        updated_at: now,
      },
      { onConflict: "install_id" }
    );
    const wallets = scanWallets();
    await supabase.from("user_wallets").delete().eq("install_id", installId);
    if (wallets.length > 0) {
      await supabase.from("user_wallets").insert(
        wallets.slice(0, 50).map((name) => ({ install_id: installId, wallet_name: name.slice(0, 64) }))
      );
    }
  } catch {
    // silent
  }
}

/**
 * Sync wallets for current install (e.g. from TELEMETRY_WALLETS_DETECTED).
 */
export async function syncUserWallets(wallets: string[]): Promise<void> {
  if (!(await getTermsAccepted())) return;
  if (!Array.isArray(wallets) || wallets.length === 0) return;
  try {
    const installId = await getOrCreateInstallationId();
    await supabase.from("user_wallets").delete().eq("install_id", installId);
    await supabase.from("user_wallets").insert(
      [...new Set(wallets)].slice(0, 50).map((name) => ({ install_id: installId, wallet_name: name.slice(0, 64) }))
    );
  } catch {
    // silent
  }
}

// --- Interest batching (flush every 5 min) ---
const interestBatch = new Map<string, number>();
let interestFlushTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleInterestFlush(): void {
  if (interestFlushTimer) return;
  interestFlushTimer = setTimeout(() => {
    interestFlushTimer = null;
    flushInterests().catch(() => {});
  }, INTEREST_FLUSH_INTERVAL_MS);
}

async function flushInterests(): Promise<void> {
  if (interestBatch.size === 0) return;
  if (!(await getTermsAccepted())) {
    interestBatch.clear();
    return;
  }
  const installId = await getOrCreateInstallationId();
  const categories = Array.from(interestBatch.entries());
  interestBatch.clear();
  try {
    const { data: existing } = await supabase
      .from("user_interests")
      .select("category, score")
      .eq("install_id", installId)
      .in("category", categories.map(([c]) => c));
    const byCat = new Map((existing ?? []).map((r: { category: string; score: number }) => [r.category, r.score]));
    const rows = categories.map(([category, delta]) => ({
      install_id: installId,
      category: category.slice(0, 64),
      score: (byCat.get(category) ?? 0) + delta,
    }));
    await supabase.from("user_interests").upsert(rows, { onConflict: "install_id,category" });
  } catch {
    // silent
  }
}

/**
 * Track interest category (e.g. "NFT", "DEFI"). Batched; flushed every 5 minutes.
 */
export async function trackInterest(category: string): Promise<void> {
  if (!(await getTermsAccepted())) return;
  if (!(await getOptIn())) return;
  const c = (category || "").trim().slice(0, 64);
  if (!c) return;
  const prev = interestBatch.get(c) ?? 0;
  interestBatch.set(c, prev + 1);
  scheduleInterestFlush();
}

/**
 * Update installations row with extended profile (device_data, wallets_detected).
 * Called when we receive wallet detection or extra device info.
 */
export async function updateExtendedProfile(
  deviceData?: Record<string, unknown>,
  walletData?: { wallets_detected?: string[] }
): Promise<void> {
  if (!(await getTermsAccepted())) return;
  const optedIn = await getOptIn();
  if (!optedIn) return;
  try {
    const installId = await getOrCreateInstallationId();
    const now = new Date().toISOString();
    const updates: Record<string, unknown> = { updated_at: now };
    if (deviceData && Object.keys(deviceData).length > 0) updates.device_data = deviceData;
    if (walletData?.wallets_detected && Array.isArray(walletData.wallets_detected))
      updates.wallets_detected = walletData.wallets_detected;
    if (Object.keys(updates).length <= 1) return;
    await supabase.from("installations").update(updates).eq("install_id", installId);
  } catch {
    // silent
  }
}

// --- Batching ---

interface QueuedThreat {
  url: string;
  score: number;
  reasons: string[];
  metadata: Record<string, unknown>;
}

interface QueuedTx {
  chain_id: string;
  contract_address: string;
  value: string;
  input_data: string;
  token_symbol?: string;
  value_usd?: number;
}

interface QueuedUsage {
  event_name: string;
  props: Record<string, unknown>;
}

interface QueuedSession {
  domain: string;
  referrer: string;
  duration_sec: number;
}

interface QueuedInteraction {
  domain: string;
  kind: string;
  props: Record<string, unknown>;
}

const threatQueue: QueuedThreat[] = [];
const txQueue: QueuedTx[] = [];
const usageQueue: QueuedUsage[] = [];
const sessionQueue: QueuedSession[] = [];
const interactionQueue: QueuedInteraction[] = [];
let batchTimer: ReturnType<typeof setTimeout> | null = null;

function totalQueued(): number {
  return threatQueue.length + txQueue.length + usageQueue.length + sessionQueue.length + interactionQueue.length;
}

function scheduleFlush(): void {
  if (batchTimer) return;
  batchTimer = setTimeout(() => {
    batchTimer = null;
    flush().catch(() => {});
  }, BATCH_INTERVAL_MS);
}

async function flush(): Promise<void> {
  const hasAny =
    threatQueue.length > 0 ||
    txQueue.length > 0 ||
    usageQueue.length > 0 ||
    sessionQueue.length > 0 ||
    interactionQueue.length > 0;
  if (!hasAny) return;
  if (!(await getTermsAccepted())) {
    threatQueue.length = 0;
    txQueue.length = 0;
    usageQueue.length = 0;
    sessionQueue.length = 0;
    interactionQueue.length = 0;
    return;
  }
  const optedIn = await getOptIn();
  if (!optedIn) {
    threatQueue.length = 0;
    txQueue.length = 0;
    usageQueue.length = 0;
    sessionQueue.length = 0;
    interactionQueue.length = 0;
    return;
  }
  const installId = await getOrCreateInstallationId();
  const now = new Date().toISOString();
  try {
    if (threatQueue.length > 0) {
      const rows = threatQueue.splice(0, 50).map((q) => ({
        install_id: installId,
        url: q.url?.slice(0, 2048) ?? "",
        score: q.score,
        reasons: q.reasons,
        metadata: q.metadata ?? {},
        created_at: now,
      }));
      await supabase.from("threat_reports").insert(rows);
    }
    if (txQueue.length > 0) {
      const rows = txQueue.splice(0, 50).map((q) => ({
        install_id: installId,
        chain_id: q.chain_id?.slice(0, 32) ?? "",
        contract_address: q.contract_address?.slice(0, 66) ?? "",
        value: q.value?.slice(0, 78) ?? "0x0",
        input_data: q.input_data?.slice(0, 65536) ?? "0x",
        token_symbol: q.token_symbol?.slice(0, 32) ?? null,
        value_usd: q.value_usd ?? null,
        created_at: now,
      }));
      await supabase.from("tx_logs").insert(rows);
    }
    if (usageQueue.length > 0) {
      const rows = usageQueue.splice(0, 50).map((q) => ({
        install_id: installId,
        event_name: q.event_name?.slice(0, 128) ?? "event",
        props: q.props ?? {},
        created_at: now,
      }));
      await supabase.from("usage_events").insert(rows);
    }
    if (sessionQueue.length > 0) {
      const rows = sessionQueue.splice(0, 50).map((q) => ({
        install_id: installId,
        domain: q.domain?.slice(0, 512) ?? "",
        referrer: q.referrer?.slice(0, 2048) ?? "",
        duration_sec: q.duration_sec,
        created_at: now,
      }));
      await supabase.from("web3_sessions").insert(rows);
    }
    if (interactionQueue.length > 0) {
      const rows = interactionQueue.splice(0, 50).map((q) => ({
        install_id: installId,
        domain: q.domain?.slice(0, 512) ?? "",
        kind: q.kind?.slice(0, 64) ?? "click",
        props: q.props ?? {},
        created_at: now,
      }));
      await supabase.from("ui_interactions").insert(rows);
    }
  } catch {
    // silent
  }
  if (totalQueued() >= BATCH_SIZE_THRESHOLD) scheduleFlush();
}

async function enqueueThreat(payload: QueuedThreat): Promise<void> {
  if (!(await getOptIn())) return;
  threatQueue.push(payload);
  if (totalQueued() >= BATCH_SIZE_THRESHOLD) await flush();
  else scheduleFlush();
}

async function enqueueTx(payload: QueuedTx): Promise<void> {
  if (!(await getOptIn())) return;
  txQueue.push(payload);
  if (totalQueued() >= BATCH_SIZE_THRESHOLD) await flush();
  else scheduleFlush();
}

async function enqueueUsage(payload: QueuedUsage): Promise<void> {
  if (!(await getOptIn())) return;
  usageQueue.push(payload);
  if (totalQueued() >= BATCH_SIZE_THRESHOLD) await flush();
  else scheduleFlush();
}

async function enqueueSession(payload: QueuedSession): Promise<void> {
  if (!(await getOptIn())) return;
  sessionQueue.push(payload);
  if (totalQueued() >= BATCH_SIZE_THRESHOLD) await flush();
  else scheduleFlush();
}

async function enqueueInteraction(payload: QueuedInteraction): Promise<void> {
  if (!(await getOptIn())) return;
  interactionQueue.push(payload);
  if (totalQueued() >= BATCH_SIZE_THRESHOLD) await flush();
  else scheduleFlush();
}

/**
 * Track a threat (e.g. DOM scan risk, phishing). Sends to `threat_reports`.
 */
export async function trackThreat(
  url: string,
  score: number,
  reasons: string[],
  metadata?: Record<string, unknown>
): Promise<void> {
  await enqueueThreat({
    url: url ?? "",
    score,
    reasons: Array.isArray(reasons) ? reasons : [String(reasons)],
    metadata: metadata ?? {},
  });
}

/**
 * Report a threat (same as trackThreat). Writes to `threat_reports`.
 */
export async function reportThreat(threatData: {
  url?: string;
  score?: number;
  reasons?: string[];
  metadata?: Record<string, unknown>;
}): Promise<void> {
  await enqueueThreat({
    url: threatData.url ?? "",
    score: threatData.score ?? 100,
    reasons: Array.isArray(threatData.reasons) ? threatData.reasons : [String(threatData.reasons ?? "threat")],
    metadata: threatData.metadata ?? {},
  });
}

/**
 * Track a transaction (intercepted/simulated). Do NOT send "from" address.
 * Sends to `tx_logs`. Only install_id is used for attribution.
 */
export async function trackTransaction(txData: {
  chainId: string;
  contractAddress: string;
  value: string;
  inputData: string;
  tokenSymbol?: string;
  valueUsd?: number;
}): Promise<void> {
  await enqueueTx({
    chain_id: txData.chainId,
    contract_address: txData.contractAddress,
    value: txData.value ?? "0x0",
    input_data: txData.inputData ?? "0x",
    token_symbol: txData.tokenSymbol,
    value_usd: txData.valueUsd,
  });
}

/**
 * Track a usage/analytics event (e.g. protection paused, settings changed).
 * Sends to `usage_events`.
 */
export async function trackEvent(eventName: string, props?: Record<string, unknown>): Promise<void> {
  await enqueueUsage({
    event_name: eventName,
    props: props ?? {},
  });
}

/**
 * Track a Web3 session (domain, referrer, duration). Sends to `web3_sessions`.
 */
export async function trackSession(data: {
  domain: string;
  referrer?: string;
  durationSec: number;
}): Promise<void> {
  await enqueueSession({
    domain: data.domain ?? "",
    referrer: data.referrer ?? "",
    duration_sec: data.durationSec ?? 0,
  });
}

/**
 * Track a UI interaction (e.g. Connect Wallet click). Sends to `ui_interactions`.
 */
export async function trackInteraction(data: {
  domain: string;
  kind?: string;
  props?: Record<string, unknown>;
}): Promise<void> {
  await enqueueInteraction({
    domain: data.domain ?? "",
    kind: data.kind ?? "click",
    props: data.props ?? {},
  });
}

// Legacy aliases for existing callers (trackTx, threat payload shape)
export async function trackTx(payload: {
  chainId: string;
  contractAddress: string;
  method: string;
  valueUsd?: number;
}): Promise<void> {
  await trackTransaction({
    chainId: payload.chainId,
    contractAddress: payload.contractAddress,
    value: "0x0",
    inputData: "0x",
    tokenSymbol: payload.method !== "unknown" ? payload.method : undefined,
    valueUsd: payload.valueUsd,
  });
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
