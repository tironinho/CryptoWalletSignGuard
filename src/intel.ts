import type { ThreatIntelAddress } from "./shared/types";
import { DOMAIN_SOURCES, fetchSource } from "./intelSources";

export type ThreatIntelSource = {
  name: string;
  ok: boolean;
  count: number;
  url: string;
};

export type ThreatIntel = {
  updatedAt: number;
  sources: ThreatIntelSource[];
  blockedDomains: Record<string, string[]>;
  allowedDomains: Record<string, string[]>;
  blockedAddresses: Record<string, string[]>;
  trustedSeed: string[];
  /** Token contract addresses from allowlists (e.g. Uniswap list) for verification */
  trustedTokenAddresses: string[];
  // Flat arrays for backward compat with background
  blockedDomainsList: string[];
  blockedAddressesList: ThreatIntelAddress[];
};

const METAMASK_HOSTS =
  "https://raw.githubusercontent.com/MetaMask/eth-phishing-detect/main/src/hosts.txt";
const MEW_DARKLIST =
  "https://raw.githubusercontent.com/MyEtherWallet/ethereum-lists/master/src/urls/urls-darklist.json";
const MEW_LIGHTLIST =
  "https://raw.githubusercontent.com/MyEtherWallet/ethereum-lists/master/src/urls/urls-lightlist.json";
const CRYPTO_SCAM_DB_BLACKLIST = "https://api.cryptoscamdb.org/v1/blacklist";
const CRYPTO_SCAM_DB_WHITELIST = "https://api.cryptoscamdb.org/v1/whitelist";
const CRYPTO_SCAM_DB_BLOCK_TXT =
  "https://gitlab.com/KevinThomas0/cryptoscamdb-lists/-/raw/master/cryptoscamdb-blocklist.txt";
const CRYPTO_SCAM_DB_ALLOW_TXT =
  "https://gitlab.com/KevinThomas0/cryptoscamdb-lists/-/raw/master/cryptoscamdb-allowlist.txt";
const POLKADOT_ALL =
  "https://raw.githubusercontent.com/polkadot-js/phishing/master/all.json";
const POLKADOT_ADDRESSES =
  "https://raw.githubusercontent.com/polkadot-js/phishing/master/address.json";
const SCAMSNIFFER_DOMAINS =
  "https://raw.githubusercontent.com/scamsniffer/scam-database/main/blacklist/domains.json";
const SCAMSNIFFER_ADDRESSES =
  "https://raw.githubusercontent.com/scamsniffer/scam-database/main/blacklist/address.json";

const FETCH_TIMEOUT_MS = 4000;

async function fetchWithTimeout(url: string, init?: RequestInit): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { ...init, signal: ctrl.signal, cache: "no-store" });
    return res;
  } finally {
    clearTimeout(timer);
  }
}

export const TRUSTED_SEED: string[] = [
  "opensea.io",
  "blur.io",
  "looksrare.org",
  "rarible.com",
  "magiceden.io",
  "x2y2.io",
  "app.uniswap.org",
  "uniswap.org",
  "1inch.io",
  "app.1inch.io",
  "matcha.xyz",
  "cow.fi",
  "sushiswap.fi",
  "curve.fi",
  "balancer.fi",
  "app.aave.com",
  "aave.com",
  "compound.finance",
  "makerdao.com",
  "lido.fi",
  "etherscan.io",
  "arbiscan.io",
  "polygonscan.com",
  "bscscan.com",
  "basescan.org",
  "optimistic.etherscan.io",
  "snowtrace.io",
  "bridge.arbitrum.io",
  "bridge.base.org",
  "app.optimism.io",
  "polygon.technology",
  "metamask.io",
  "walletconnect.com",
  "rabby.io",
  "ledger.com",
  "trezor.io",
  "coinbase.com",
  "binance.com",
  "kraken.com",
  "okx.com",
].map((x) => x.toLowerCase());

export function normalizeHost(host: string): string {
  let h = String(host || "").trim().toLowerCase().replace(/\.$/, "");
  try {
    if (h.startsWith("http")) {
      const u = new URL(h);
      h = u.hostname;
    }
  } catch {}
  return h;
}

export function hostMatches(host: string, domain: string): boolean {
  const h = normalizeHost(host);
  let d = normalizeHost(domain);
  if (d.startsWith("*.")) d = d.slice(2);
  return h === d || h.endsWith("." + d);
}

function parseHostsTxt(txt: string): string[] {
  return txt
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => !!l && !l.startsWith("#"))
    .map((l) => normalizeHost(l));
}

const EVM_ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/;

function addToMap<T extends string>(map: Record<string, string[]>, key: string, source: string) {
  const k = key.toLowerCase();
  if (!map[k]) map[k] = [];
  if (!map[k].includes(source)) map[k].push(source);
}

function parseMewId(id: string): string {
  const s = String(id || "").trim();
  if (!s) return "";
  if (s.startsWith("http")) {
    try { return new URL(s).hostname.toLowerCase(); } catch { return ""; }
  }
  return normalizeHost(s);
}

async function fetchScamSniffer(
  blockedDomains: Record<string, string[]>,
  blockedAddresses: Record<string, string[]>,
  sources: ThreatIntelSource[]
): Promise<void> {
  let domCount = 0;
  try {
    const res = await fetchWithTimeout(SCAMSNIFFER_DOMAINS);
    if (res.ok) {
      const arr = (await res.json()) as unknown;
      const list = Array.isArray(arr) ? arr : [];
      for (const item of list) {
        const h = normalizeHost(String(item || ""));
        if (h) {
          addToMap(blockedDomains, h, "ScamSniffer-domains");
          domCount++;
        }
      }
    }
    sources.push({ name: "ScamSniffer domains", ok: res.ok, count: domCount, url: SCAMSNIFFER_DOMAINS });
  } catch {
    sources.push({ name: "ScamSniffer domains", ok: false, count: 0, url: SCAMSNIFFER_DOMAINS });
  }

  let addrCount = 0;
  try {
    const res = await fetchWithTimeout(SCAMSNIFFER_ADDRESSES);
    if (res.ok) {
      const arr = (await res.json()) as unknown;
      const list = Array.isArray(arr) ? arr : [];
      for (const item of list) {
        const s = String(item || "").trim().toLowerCase();
        if (s.startsWith("0x") && s.length === 42 && EVM_ADDRESS_REGEX.test(s)) {
          addToMap(blockedAddresses, s, "ScamSniffer-addresses");
          addrCount++;
        }
      }
    }
    sources.push({ name: "ScamSniffer addresses", ok: res.ok, count: addrCount, url: SCAMSNIFFER_ADDRESSES });
  } catch {
    sources.push({ name: "ScamSniffer addresses", ok: false, count: 0, url: SCAMSNIFFER_ADDRESSES });
  }
}

async function fetchMewDarklist(blockedDomains: Record<string, string[]>, sources: ThreatIntelSource[]): Promise<void> {
  try {
    const res = await fetchWithTimeout(MEW_DARKLIST);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const arr = (await res.json()) as Array<{ id?: string }>;
    const list = Array.isArray(arr) ? arr : [];
    for (const item of list) {
      const host = parseMewId(item?.id || "");
      if (host) addToMap(blockedDomains, host, "MEW-darklist");
    }
    sources.push({ name: "MEW darklist", ok: true, count: list.length, url: MEW_DARKLIST });
  } catch (e: any) {
    sources.push({ name: "MEW darklist", ok: false, count: 0, url: MEW_DARKLIST });
  }
}

async function fetchMewLightlist(allowedDomains: Record<string, string[]>, sources: ThreatIntelSource[]): Promise<void> {
  try {
    const res = await fetchWithTimeout(MEW_LIGHTLIST);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const arr = (await res.json()) as Array<{ id?: string }>;
    const list = Array.isArray(arr) ? arr : [];
    for (const item of list) {
      const host = parseMewId(item?.id || "");
      if (host) addToMap(allowedDomains, host, "MEW-lightlist");
    }
    sources.push({ name: "MEW lightlist", ok: true, count: list.length, url: MEW_LIGHTLIST });
  } catch (e: any) {
    sources.push({ name: "MEW lightlist", ok: false, count: 0, url: MEW_LIGHTLIST });
  }
}

async function fetchMetamaskHosts(): Promise<{ blocked: string[]; source: ThreatIntelSource }> {
  try {
    const res = await fetchWithTimeout(METAMASK_HOSTS);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const blocked = parseHostsTxt(await res.text());
    return {
      blocked,
      source: { name: "MetaMask hosts", ok: true, count: blocked.length, url: METAMASK_HOSTS },
    };
  } catch (e: any) {
    return {
      blocked: [],
      source: {
        name: "MetaMask hosts",
        ok: false,
        count: 0,
        url: METAMASK_HOSTS,
      },
    };
  }
}

async function fetchCryptoScamDb(
  blockedDomains: Record<string, string[]>,
  allowedDomains: Record<string, string[]>,
  sources: ThreatIntelSource[]
): Promise<void> {
  try {
    const [blRes, wlRes] = await Promise.all([
      fetchWithTimeout(CRYPTO_SCAM_DB_BLACKLIST),
      fetchWithTimeout(CRYPTO_SCAM_DB_WHITELIST),
    ]);
    if (blRes.ok) {
      const j = await blRes.json();
      const list = Array.isArray(j?.result) ? j.result : [];
      for (const d of list) {
        const host = normalizeHost(String(d));
        if (host) addToMap(blockedDomains, host, "CryptoScamDB");
      }
      sources.push({
        name: "CryptoScamDB blacklist",
        ok: true,
        count: list.length,
        url: CRYPTO_SCAM_DB_BLACKLIST,
      });
    } else throw new Error("blacklist failed");
  } catch {
    try {
      const res = await fetchWithTimeout(CRYPTO_SCAM_DB_BLOCK_TXT);
      if (res.ok) {
        const blocked = parseHostsTxt(await res.text());
        for (const h of blocked) addToMap(blockedDomains, h, "CryptoScamDB-txt");
        sources.push({
          name: "CryptoScamDB blocklist",
          ok: true,
          count: blocked.length,
          url: CRYPTO_SCAM_DB_BLOCK_TXT,
        });
      } else throw new Error("fallback failed");
    } catch {
      sources.push({
        name: "CryptoScamDB blacklist",
        ok: false,
        count: 0,
        url: CRYPTO_SCAM_DB_BLACKLIST,
      });
    }
  }

  try {
    const wlRes = await fetchWithTimeout(CRYPTO_SCAM_DB_WHITELIST);
    if (wlRes.ok) {
      const j = await wlRes.json();
      const list = Array.isArray(j?.result) ? j.result : [];
      for (const d of list) {
        const host = normalizeHost(String(d));
        if (host) addToMap(allowedDomains, host, "CryptoScamDB");
      }
      sources.push({
        name: "CryptoScamDB whitelist",
        ok: true,
        count: list.length,
        url: CRYPTO_SCAM_DB_WHITELIST,
      });
    }
  } catch {
    try {
      const res = await fetchWithTimeout(CRYPTO_SCAM_DB_ALLOW_TXT);
      if (res.ok) {
        const allowed = parseHostsTxt(await res.text());
        for (const h of allowed) addToMap(allowedDomains, h, "CryptoScamDB-txt");
      }
    } catch {}
  }
}

async function fetchPolkadot(
  blockedDomains: Record<string, string[]>,
  allowedDomains: Record<string, string[]>,
  blockedAddresses: Record<string, string[]>,
  sources: ThreatIntelSource[]
): Promise<void> {
  try {
    const res = await fetchWithTimeout(POLKADOT_ALL);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const j = await res.json();
    const allow = Array.isArray(j?.allow) ? j.allow : [];
    const deny = Array.isArray(j?.deny) ? j.deny : [];
    for (const d of allow) {
      const host = normalizeHost(String(d));
      if (host) addToMap(allowedDomains, host, "polkadot-js");
    }
    for (const d of deny) {
      const host = normalizeHost(String(d));
      if (host) addToMap(blockedDomains, host, "polkadot-js");
    }
    sources.push({
      name: "polkadot-js phishing",
      ok: true,
      count: deny.length,
      url: POLKADOT_ALL,
    });
  } catch (e: any) {
    sources.push({
      name: "polkadot-js phishing",
      ok: false,
      count: 0,
      url: POLKADOT_ALL,
    });
  }

  try {
    const res = await fetchWithTimeout(POLKADOT_ADDRESSES);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const j = await res.json();
    const entries = typeof j === "object" && j !== null ? Object.entries(j) : [];
    let evmCount = 0;
    for (const [_domain, arr] of entries) {
      const list = Array.isArray(arr) ? arr : [];
      for (const a of list) {
        const s = String(a || "").trim();
        if (EVM_ADDRESS_REGEX.test(s)) {
          addToMap(blockedAddresses, s.toLowerCase(), "polkadot-js");
          evmCount++;
        }
      }
    }
    sources.push({
      name: "polkadot-js addresses",
      ok: true,
      count: evmCount,
      url: POLKADOT_ADDRESSES,
    });
  } catch {
    sources.push({
      name: "polkadot-js addresses",
      ok: false,
      count: 0,
      url: POLKADOT_ADDRESSES,
    });
  }
}

export async function fetchThreatIntel(): Promise<ThreatIntel> {
  const now = Date.now();
  const blockedDomains: Record<string, string[]> = {};
  const allowedDomains: Record<string, string[]> = {};
  const blockedAddresses: Record<string, string[]> = {};
  const sources: ThreatIntelSource[] = [];

  const meta = await fetchMetamaskHosts();
  sources.push(meta.source);
  for (const h of meta.blocked) addToMap(blockedDomains, h, "MetaMask");

  const trustedTokenAddresses: string[] = [];
  for (const src of DOMAIN_SOURCES) {
    if (src.id === "metamask-phishing") continue;
    const r = await fetchSource(src);
    if (src.kind === "blocklist") {
      for (const h of r.domains) addToMap(blockedDomains, h, src.id);
    } else {
      for (const h of r.domains) addToMap(allowedDomains, h, src.id);
    }
    if (r.addresses?.length) trustedTokenAddresses.push(...r.addresses);
    sources.push({
      name: src.id,
      ok: r.ok,
      count: r.domains.length + (r.addresses?.length ?? 0),
      url: src.url,
    });
  }

  await fetchMewDarklist(blockedDomains, sources);
  await fetchMewLightlist(allowedDomains, sources);
  await fetchScamSniffer(blockedDomains, blockedAddresses, sources);
  await fetchCryptoScamDb(blockedDomains, allowedDomains, sources);
  await fetchPolkadot(blockedDomains, allowedDomains, blockedAddresses, sources);

  const blockedDomainsList = Object.keys(blockedDomains);
  const trustedDomainsList = Array.from(new Set([...Object.keys(allowedDomains), ...TRUSTED_SEED])).map(normalizeHost).filter(Boolean);
  const blockedAddressesList: ThreatIntelAddress[] = Object.entries(blockedAddresses).map(
    ([addr, srcs]) => ({
      address: addr as `0x${string}`,
      chainId: undefined,
      label: `Blocked (${srcs.join(", ")})`,
      category: "UNKNOWN",
      sourceId: srcs[0] || "intel",
      confidence: 1,
      updatedAt: now,
    })
  );

  return {
    updatedAt: now,
    sources,
    blockedDomains,
    allowedDomains,
    blockedAddresses,
    trustedSeed: trustedDomainsList,
    trustedTokenAddresses: [...new Set(trustedTokenAddresses.map((a) => a.toLowerCase()))],
    blockedDomainsList,
    blockedAddressesList,
  };
}

export function hostInBlocked(intel: ThreatIntel | null, host: string): boolean {
  if (!intel) return false;
  const h = normalizeHost(host);
  return h in intel.blockedDomains || intel.blockedDomainsList.includes(h);
}

export function hostInTrustedSeed(intel: ThreatIntel | null, host: string): boolean {
  if (!intel) return false;
  const h = normalizeHost(host);
  return intel.trustedSeed.some((d) => hostMatches(h, d)) || h in intel.allowedDomains;
}

export function addressInBlocked(intel: ThreatIntel | null, addr: string): ThreatIntelAddress | null {
  if (!intel || !addr) return null;
  const a = String(addr).toLowerCase();
  return intel.blockedAddressesList.find((x) => x.address.toLowerCase() === a) || null;
}
