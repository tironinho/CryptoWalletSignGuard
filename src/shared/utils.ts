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

