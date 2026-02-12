import { t } from "../i18n";
import { isAllowlisted } from "./utils";

function safeUrl(url: string) {
  try {
    return new URL(url);
  } catch {
    return null;
  }
}

function getTld(host: string) {
  const parts = (host || "").split(".").filter(Boolean);
  return parts.length ? parts[parts.length - 1] : "";
}

function countChar(haystack: string, ch: string) {
  return (haystack.match(new RegExp(`\\${ch}`, "g")) || []).length;
}

function hasSuspiciousKeywords(host: string) {
  const h = host.toLowerCase();
  return /(login|secure|verify|account|wallet|airdrop|claim|support|auth)/.test(h);
}

function hasBrandLookalike(host: string) {
  const h = host.toLowerCase();
  const brands = ["opensea", "uniswap", "blur", "metamask", "aave", "etherscan", "revoke"];
  return brands.some((b) => h.includes(b)) && !/(opensea\.io|uniswap\.org|blur\.io|metamask\.io|aave\.com|etherscan\.io|revoke\.cash)$/.test(h);
}

export function getDomainInfo(url: string): {
  host: string;
  normalizedHost: string;
  isHttps: boolean;
  isPunycode: boolean;
  hasMixedScripts: boolean;
  hasConfusablesHint: boolean;
  hasDoubleDash: boolean;
  hasWeirdSubdomain: boolean;
  tld: string;
  reasons: string[];
} {
  const u = safeUrl(url);
  const host = (u?.hostname || "").toLowerCase();
  const normalizedHost = host.replace(/\.+$/, "");
  const isHttps = (u?.protocol || "").toLowerCase() === "https:";
  const isPunycode = normalizedHost.startsWith("xn--") || normalizedHost.includes(".xn--");
  const hasDoubleDash = normalizedHost.includes("--");
  const hyphens = countChar(normalizedHost, "-");
  const dots = countChar(normalizedHost, ".");
  const digits = (normalizedHost.match(/\d/g) || []).length;

  // Lightweight hints only (URL.hostname is typically punycode already).
  const hasConfusablesHint = isPunycode || /[^a-z0-9.-]/.test(normalizedHost);
  const hasMixedScripts = false; // kept for API shape; hostname already normalized to ASCII in most cases

  const parts = normalizedHost.split(".").filter(Boolean);
  const subdomainParts = Math.max(0, parts.length - 2);
  const hasWeirdSubdomain = subdomainParts >= 3;
  const tld = getTld(normalizedHost);

  const reasons: string[] = [];
  if (!isHttps && host) reasons.push(t("trustReasonNotHttps"));
  if (isPunycode) reasons.push(t("domainPunycodeReason"));
  if (hasDoubleDash) reasons.push(t("domainDoubleDashReason"));
  if (digits >= 4) reasons.push(t("domainNumberPatternReason"));
  if (hyphens >= 3) reasons.push(t("trustReasonManyHyphens"));
  if (hasSuspiciousKeywords(normalizedHost)) reasons.push(t("trustReasonSuspiciousKeywords"));
  if (hasBrandLookalike(normalizedHost)) reasons.push(t("trustReasonBrandLookalike"));
  if (hasWeirdSubdomain && dots >= 4) reasons.push(t("trustReasonManySubdomains"));

  return {
    host,
    normalizedHost,
    isHttps,
    isPunycode,
    hasMixedScripts,
    hasConfusablesHint,
    hasDoubleDash,
    hasWeirdSubdomain,
    tld,
    reasons,
  };
}

export function computeTrustVerdict(host: string, allowlist: string[]): {
  verdict: "LIKELY_OFFICIAL" | "UNKNOWN" | "SUSPICIOUS";
  trustScore: number;
  reasons: string[];
  matchedAllowlistDomain?: string;
} {
  const h = (host || "").toLowerCase();
  if (!h) {
    return { verdict: "UNKNOWN", trustScore: 50, reasons: [t("trustReasonNoHost")] };
  }

  let trustScore = 55;
  const reasons: string[] = [];

  // Allowlist match => likely official (heuristic / user-config)
  const matched = allowlist.find((d) => {
    const dom = (d || "").toLowerCase().trim();
    if (!dom) return false;
    return h === dom || h.endsWith("." + dom);
  });
  if (matched) {
    trustScore = 92;
    reasons.push(t("trustReasonAllowlistedMatched", { matched }));
    return { verdict: "LIKELY_OFFICIAL", trustScore, reasons, matchedAllowlistDomain: matched };
  }

  const isPunycode = h.startsWith("xn--") || h.includes(".xn--");
  const hasDoubleDash = h.includes("--");
  const digits = (h.match(/\d/g) || []).length;
  const hyphens = countChar(h, "-");
  const dots = countChar(h, ".");
  const parts = h.split(".").filter(Boolean);
  const subdomainParts = Math.max(0, parts.length - 2);

  const suspicious = [];
  if (isPunycode) suspicious.push(t("domainPunycodeReason"));
  if (hasDoubleDash) suspicious.push(t("domainDoubleDashReason"));
  if (digits >= 4) suspicious.push(t("domainNumberPatternReason"));
  if (hyphens >= 3) suspicious.push(t("trustReasonManyHyphens"));
  if (hasSuspiciousKeywords(h)) suspicious.push(t("trustReasonSuspiciousKeywords"));
  if (hasBrandLookalike(h)) suspicious.push(t("trustReasonBrandLookalike"));
  if (subdomainParts >= 3 && dots >= 4) suspicious.push(t("trustReasonManySubdomains"));

  // If user already allowlisted parent domains elsewhere, lower suspicion in general.
  // (Still keep allowlist as the only "likely official" signal.)
  const allowlistedElsewhere = isAllowlisted(h, allowlist);
  if (allowlistedElsewhere) {
    trustScore = Math.max(trustScore, 70);
    reasons.push(t("trustReasonAllowlistedVariant"));
  }

  if (suspicious.length) {
    trustScore = 22;
    reasons.push(...suspicious.slice(0, 4));
    return { verdict: "SUSPICIOUS", trustScore, reasons };
  }

  reasons.push(t("trustReasonUnknown"));
  return { verdict: "UNKNOWN", trustScore, reasons };
}

