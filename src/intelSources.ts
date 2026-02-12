/** Pluggable threat intel sources — blocklists, allowlists, multiple formats */

export type IntelSource = {
  id: string;
  kind: "blocklist" | "allowlist";
  url: string;
  format: "hosts" | "txt" | "json-array" | "defillama" | "uniswap-tokens";
};

export const DOMAIN_SOURCES: IntelSource[] = [
  // Blocklists (Anti-Phishing)
  {
    id: "metamask-phishing",
    kind: "blocklist",
    url: "https://raw.githubusercontent.com/MetaMask/eth-phishing-detect/main/src/hosts.txt",
    format: "hosts",
  },
  {
    id: "phishdestroy",
    kind: "blocklist",
    url: "https://raw.githubusercontent.com/phishdestroy/destroylist/main/rootlist/formats/primary/domains.txt",
    format: "txt",
  },
  {
    id: "cryptoscamdb",
    kind: "blocklist",
    url: "https://raw.githubusercontent.com/CryptoScamDB/blacklist/master/data/urls.txt",
    format: "txt",
  },
  {
    id: "409h",
    kind: "blocklist",
    url: "https://raw.githubusercontent.com/409H/EtherAddressLookup/master/blacklists/domains.json",
    format: "json-array",
  },
  // Allowlists (Legítimos)
  {
    id: "defillama",
    kind: "allowlist",
    url: "https://api.llama.fi/protocols",
    format: "defillama",
  },
  {
    id: "uniswap-tokens",
    kind: "allowlist",
    url: "https://gateway.ipfs.io/ipns/tokens.uniswap.org",
    format: "uniswap-tokens",
  },
];

function normalizeDomain(raw: string): string {
  let s = String(raw || "").trim().toLowerCase();
  if (!s) return "";
  if (s.startsWith("#")) return "";
  try {
    if (s.startsWith("http://") || s.startsWith("https://")) {
      const u = new URL(s);
      s = u.hostname;
    }
  } catch {}
  if (s.startsWith("www.")) s = s.slice(4);
  if (s.startsWith("0.0.0.0 ") || s.startsWith("127.0.0.1 ")) {
    s = s.replace(/^(0\.0\.0\.0|127\.0\.0\.1)\s+/, "");
  }
  if (s.startsWith("*.")) s = s.slice(2);
  s = s.replace(/\.+$/, "").split("/")[0] || "";
  return s;
}

function normalizeAddress(raw: string): string {
  const s = String(raw || "").trim().toLowerCase();
  if (s.startsWith("0x") && s.length === 42 && /^0x[a-f0-9]{40}$/.test(s)) return s;
  return "";
}

/** hosts file: one host per line, optional 0.0.0.0 prefix */
export function parseHostsFormat(text: string): string[] {
  const out: string[] = [];
  for (const line of text.split("\n")) {
    const h = normalizeDomain(line);
    if (h) out.push(h);
  }
  return [...new Set(out)];
}

/** plain txt: one domain per line */
export function parseTxtFormat(text: string): string[] {
  return parseHostsFormat(text);
}

/** JSON array of strings (e.g. ["evil.com", "phish.site"]) */
export function parseJsonArray(data: unknown): string[] {
  const out: string[] = [];
  if (!Array.isArray(data)) return out;
  for (const item of data) {
    const s = typeof item === "string" ? item : String((item as any)?.id ?? (item as any)?.domain ?? "");
    const h = normalizeDomain(s);
    if (h) out.push(h);
  }
  return [...new Set(out)];
}

/** DeFi Llama protocols: extract homepage/url from each protocol */
export function parseDefiLlama(data: unknown): string[] {
  const out: string[] = [];
  if (!data || typeof data !== "object") return out;
  const list = Array.isArray(data) ? data : Array.isArray((data as any).protocols) ? (data as any).protocols : [];
  for (const p of list) {
    const obj = typeof p === "object" && p !== null ? p : {};
    const url = (obj as any).url ?? (obj as any).homepage ?? (obj as any).website ?? "";
    if (typeof url === "string" && url) {
      const h = normalizeDomain(url);
      if (h) out.push(h);
    }
    const gecko = (obj as any).gecko_id;
    if (gecko && typeof (obj as any).name === "string") {
      const slug = String((obj as any).slug || (obj as any).name || "").toLowerCase().replace(/\s+/g, "-");
      if (slug) out.push(normalizeDomain(slug + ".com"));
    }
  }
  return [...new Set(out)];
}

/** Uniswap token list: extract token addresses (for token verification, not domains) */
export function parseUniswapTokens(data: unknown): string[] {
  const out: string[] = [];
  if (!data || typeof data !== "object") return out;
  const tokens = Array.isArray((data as any).tokens) ? (data as any).tokens : [];
  for (const t of tokens) {
    const addr = (t as any)?.address;
    const a = normalizeAddress(typeof addr === "string" ? addr : "");
    if (a) out.push(a);
  }
  return [...new Set(out)];
}

export type FetchSourceResult = {
  ok: boolean;
  domains: string[];
  addresses?: string[];
  error?: string;
};

export async function fetchSource(source: IntelSource, timeoutMs = 8000): Promise<FetchSourceResult> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    const res = await fetch(source.url, { cache: "no-store", signal: ctrl.signal });
    clearTimeout(t);
    if (!res.ok) return { ok: false, domains: [], error: `HTTP ${res.status}` };
    const text = await res.text();
    let domains: string[] = [];
    let addresses: string[] | undefined;

    switch (source.format) {
      case "hosts":
      case "txt":
        domains = parseHostsFormat(text);
        break;
      case "json-array": {
        try {
          domains = parseJsonArray(JSON.parse(text));
        } catch {
          return { ok: false, domains: [], error: "JSON parse failed" };
        }
        break;
      }
      case "defillama": {
        try {
          domains = parseDefiLlama(JSON.parse(text));
        } catch {
          return { ok: false, domains: [], error: "JSON parse failed" };
        }
        break;
      }
      case "uniswap-tokens": {
        try {
          const parsed = JSON.parse(text);
          addresses = parseUniswapTokens(parsed);
        } catch {
          return { ok: false, domains: [], addresses: [], error: "JSON parse failed" };
        }
        break;
      }
      default:
        return { ok: false, domains: [], error: "Unknown format" };
    }

    return { ok: true, domains, addresses };
  } catch (e: any) {
    return { ok: false, domains: [], error: e?.message || String(e) };
  }
}
