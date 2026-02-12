export function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

export function hostFromUrl(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return "";
  }
}

export function normalizeDomainLine(s: string) {
  return (s || "").trim().toLowerCase().replace(/^\.+/, "").replace(/\.+$/, "");
}

export function isAllowlisted(host: string, allowlist: string[]) {
  const h = (host || "").toLowerCase();
  return allowlist.some((d) => {
    const dom = normalizeDomainLine(d);
    if (!dom) return false;
    return h === dom || h.endsWith("." + dom);
  });
}

/** Normalize host for comparison: lowercase, trim trailing dot. Do NOT strip www when storing. */
export function normalizeHost(host: string): string {
  return (host || "").toLowerCase().replace(/\.+$/, "").trim();
}

/** Match host to domain: exact or subdomain. Do NOT use endsWith(domain) without dot. */
export function isHostMatch(host: string, domain: string): boolean {
  const h = normalizeHost(host);
  const d = (domain || "").toLowerCase().trim();
  if (!d) return false;
  return h === d || h.endsWith("." + d);
}

/** Normalize address: lowercase 0x + 40 hex. Returns "" if invalid. */
export function normalizeAddress(addr: string): string {
  const s = (addr || "").trim();
  const hex = s.startsWith("0x") ? s.slice(2) : s;
  if (hex.length !== 40 || !/^[a-fA-F0-9]{40}$/.test(hex)) return "";
  return "0x" + hex.toLowerCase();
}

/** Build cache key for token (chainId:addressLower). */
export function normalizeTokenKey(chainId: string, addr: string): string {
  const a = normalizeAddress(addr);
  const c = (chainId || "").toLowerCase().replace(/^0x/, "") || "0";
  return `${c}:${a}`;
}

export function isHexString(v: any): v is string {
  return typeof v === "string" && /^0x[0-9a-fA-F]*$/.test(v);
}

export function hexSelector(data: string) {
  if (!isHexString(data) || data.length < 10) return null;
  return data.slice(0, 10).toLowerCase();
}

export function escapeHtml(s: any) {
  const str = String(s ?? "");
  return str
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

