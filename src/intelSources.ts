/** Pluggable threat intel sources (no external deps) */

export type IntelSource = {
  id: string;
  kind: "domains";
  url: string;
  format: "hosts" | "txt" | "json";
};

export const DOMAIN_SOURCES: IntelSource[] = [
  {
    id: "metamask-phishing",
    kind: "domains",
    url: "https://raw.githubusercontent.com/MetaMask/eth-phishing-detect/main/src/hosts.txt",
    format: "hosts",
  },
  {
    id: "phishdestroy",
    kind: "domains",
    url: "https://raw.githubusercontent.com/phishdestroy/destroylist/main/rootlist/formats/primary/domains.txt",
    format: "txt",
  },
];

function normalizeHostLine(line: string): string {
  let s = String(line || "").trim().toLowerCase();
  if (!s) return "";
  if (s.startsWith("#")) return "";
  if (s.startsWith("0.0.0.0 ") || s.startsWith("127.0.0.1 ")) {
    s = s.replace(/^(0\.0\.0\.0|127\.0\.0\.1)\s+/, "");
  }
  if (s.startsWith("*.")) s = s.slice(2);
  s = s.replace(/\.+$/, "");
  return s;
}

export function parseHostsFormat(text: string): string[] {
  const out: string[] = [];
  for (const line of text.split("\n")) {
    const h = normalizeHostLine(line);
    if (h) out.push(h);
  }
  return [...new Set(out)];
}

export function parseTxtFormat(text: string): string[] {
  return parseHostsFormat(text);
}

export function parseJsonDomains(data: unknown): string[] {
  const out: string[] = [];
  if (Array.isArray(data)) {
    for (const item of data) {
      const s = typeof item === "string" ? item : (item as any)?.id ?? (item as any)?.domain ?? "";
      const h = normalizeHostLine(s);
      if (h) out.push(h);
    }
  } else if (data && typeof data === "object" && "deny" in (data as object)) {
    const deny = (data as any).deny;
    if (Array.isArray(deny)) {
      for (const d of deny) {
        const h = normalizeHostLine(typeof d === "string" ? d : String(d));
        if (h) out.push(h);
      }
    }
  }
  return [...new Set(out)];
}

export async function fetchSource(source: IntelSource): Promise<{ ok: boolean; domains: string[]; error?: string }> {
  try {
    const res = await fetch(source.url, { cache: "no-store" });
    if (!res.ok) return { ok: false, domains: [], error: `HTTP ${res.status}` };
    const text = await res.text();
    let domains: string[] = [];
    if (source.format === "hosts" || source.format === "txt") {
      domains = parseHostsFormat(text);
    } else if (source.format === "json") {
      try {
        domains = parseJsonDomains(JSON.parse(text));
      } catch {
        return { ok: false, domains: [], error: "JSON parse failed" };
      }
    }
    return { ok: true, domains };
  } catch (e: any) {
    return { ok: false, domains: [], error: e?.message || String(e) };
  }
}
