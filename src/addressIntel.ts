/**
 * Address/contract/token intel (no-custody). Load from cache only on critical path; refresh async.
 */

export type AddressLabel =
  | "SANCTIONED"
  | "SCAM_REPORTED"
  | "PHISHING_REPORTED"
  | "MALICIOUS_CONTRACT"
  | "UNVERIFIED_TOKEN"
  | "KNOWN_MARKETPLACE"
  | "KNOWN_DEX"
  | "KNOWN_BRIDGE"
  | "KNOWN_EXPLORER"
  | "KNOWN_WALLET_VENDOR";

export type AddressIntel = {
  updatedAt: number;
  sources: { name: string; ok: boolean; count: number; url: string }[];
  labelsByAddress: Record<string, AddressLabel[]>;
  tokenFlagsByContract: Record<string, ("SCAM_TOKEN" | "IMPERSONATOR" | "HONEY_POT_SUSPECT")[]>;
};

const STORAGE_ADDR_INTEL_KEY = "sg_addr_intel";
const ADDR_INTEL_VERSION = 1;
const ADDR_INTEL_TTL_MS = 24 * 60 * 60 * 1000;
const FETCH_TIMEOUT_MS = 6000;

const EVM_ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/;

export function normalizeAddr(addr: string): string {
  const s = String(addr || "").trim();
  if (!s.startsWith("0x")) return "";
  const hex = s.slice(2).toLowerCase().replace(/^0x/, "");
  if (hex.length !== 40 || !/^[a-f0-9]{40}$/.test(hex)) return "";
  return "0x" + hex;
}

export function mergeLabels(dst: Record<string, AddressLabel[]>, addr: string, labels: AddressLabel[]): void {
  const a = normalizeAddr(addr);
  if (!a || !labels.length) return;
  if (!dst[a]) dst[a] = [];
  for (const l of labels) {
    if (!dst[a].includes(l)) dst[a].push(l);
  }
}

function fetchWithTimeout(url: string): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    return fetch(url, { signal: ctrl.signal, cache: "no-store" }).finally(() => clearTimeout(timer));
  } catch {
    clearTimeout(timer);
    throw new Error("timeout");
  }
}

const SCAMSNIFFER_ADDRESSES = "https://raw.githubusercontent.com/scamsniffer/scam-database/main/blacklist/address.json";

async function fetchScamSnifferAddresses(labelsByAddress: Record<string, AddressLabel[]>, sources: AddressIntel["sources"]): Promise<void> {
  try {
    const res = await fetchWithTimeout(SCAMSNIFFER_ADDRESSES);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as unknown;
    const rawList = Array.isArray(data) ? data : (data && typeof data === "object" ? Object.keys(data as Record<string, unknown>) : []);
    let count = 0;
    for (const item of rawList) {
      const s = String(item || "").trim().toLowerCase();
      if (EVM_ADDRESS_REGEX.test(s)) {
        mergeLabels(labelsByAddress, s, ["SCAM_REPORTED"]);
        count++;
      }
    }
    sources.push({ name: "scamsniffer-addresses", ok: true, count, url: SCAMSNIFFER_ADDRESSES });
  } catch {
    sources.push({ name: "scamsniffer-addresses", ok: false, count: 0, url: SCAMSNIFFER_ADDRESSES });
  }
}

export function seedKnownAddresses(): { labelsByAddress: Record<string, AddressLabel[]> } {
  return { labelsByAddress: {} };
}

function getMinimalAddressIntel(): AddressIntel {
  return {
    updatedAt: 0,
    sources: [{ name: "local_seed", ok: true, count: 0, url: "" }],
    labelsByAddress: {},
    tokenFlagsByContract: {},
  };
}

function isValidIntelShape(r: unknown): r is AddressIntel {
  if (!r || typeof r !== "object") return false;
  const o = r as Record<string, unknown>;
  return (
    typeof o.updatedAt === "number" &&
    Array.isArray(o.sources) &&
    typeof o.labelsByAddress === "object" &&
    o.labelsByAddress !== null &&
    typeof o.tokenFlagsByContract === "object" &&
    o.tokenFlagsByContract !== null
  );
}

export async function loadAddressIntelCachedFast(): Promise<{
  intel: AddressIntel;
  isMissing: boolean;
  isStale: boolean;
}> {
  try {
    const r = await (chrome.storage.local.get as (key: string) => Promise<Record<string, unknown>>)(STORAGE_ADDR_INTEL_KEY);
    const raw = r?.[STORAGE_ADDR_INTEL_KEY];
    if (!raw || !isValidIntelShape(raw)) {
      const minimal = getMinimalAddressIntel();
      return { intel: minimal, isMissing: true, isStale: true };
    }
    const intel = raw as AddressIntel;
    const isStale = Date.now() - intel.updatedAt > ADDR_INTEL_TTL_MS;
    return { intel, isMissing: false, isStale };
  } catch {
    const minimal = getMinimalAddressIntel();
    return { intel: minimal, isMissing: true, isStale: true };
  }
}

export async function saveAddressIntel(intel: AddressIntel): Promise<void> {
  try {
    await (chrome.storage.local.set as (obj: Record<string, unknown>) => Promise<void>)({ [STORAGE_ADDR_INTEL_KEY]: intel });
  } catch {}
}

export async function refreshAddressIntel(): Promise<AddressIntel> {
  const now = Date.now();
  const labelsByAddress: Record<string, AddressLabel[]> = {};
  const tokenFlagsByContract: Record<string, ("SCAM_TOKEN" | "IMPERSONATOR" | "HONEY_POT_SUSPECT")[]> = {};
  const sources: AddressIntel["sources"] = [];

  await fetchScamSnifferAddresses(labelsByAddress, sources);

  const seed = seedKnownAddresses();
  for (const [addr, labels] of Object.entries(seed.labelsByAddress)) {
    if (addr && labels?.length) mergeLabels(labelsByAddress, addr, labels);
  }

  return {
    updatedAt: now,
    sources,
    labelsByAddress,
    tokenFlagsByContract,
  };
}
