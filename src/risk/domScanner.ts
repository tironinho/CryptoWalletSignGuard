/**
 * Page Risk Scanner — DOM-based heuristics for drainer/phishing detection.
 * Runs in content script context; does not require background.
 */

export type PageRiskLevel = "LOW" | "MEDIUM" | "HIGH";

export interface PageRiskResult {
  riskScore: PageRiskLevel;
  reasons: string[];
}

/** Domains considered "safe" — typo-squatting against these triggers HIGH. */
const SAFE_DOMAINS_LIST: string[] = [
  "opensea.io",
  "uniswap.org",
  "uniswap.com",
  "metamask.io",
  "metamask.com",
  "etherscan.io",
  "etherscan.com",
  "pancakeswap.finance",
  "pancakeswap.com",
  "compound.finance",
  "aave.com",
  "ens.domains",
  "rainbow.me",
  "walletconnect.com",
  "walletconnect.org",
  "phantom.app",
  "solana.com",
];

/** Threshold: if edit distance (Levenshtein) <= this and host is not in safe list, treat as lookalike. */
const LEVENSHTEIN_LOOKALIKE_THRESHOLD = 2;

/** Z-index above this is considered "full-page overlay" territory. */
const HIGH_Z_INDEX_THRESHOLD = 99990;

/** Minimum area ratio (0–1) for an element to be considered "covering" the viewport. */
const COVER_RATIO_MIN = 0.7;

/**
 * Levenshtein (edit) distance between two strings.
 */
function levenshtein(a: string, b: string): number {
  const an = a.length;
  const bn = b.length;
  if (an === 0) return bn;
  if (bn === 0) return an;

  const row0 = new Array<number>(bn + 1);
  const row1 = new Array<number>(bn + 1);
  for (let j = 0; j <= bn; j++) row0[j] = j;

  for (let i = 1; i <= an; i++) {
    row1[0] = i;
    for (let j = 1; j <= bn; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      row1[j] = Math.min(
        row1[j - 1] + 1,
        row0[j] + 1,
        row0[j - 1] + cost
      );
    }
    for (let j = 0; j <= bn; j++) row0[j] = row1[j];
  }
  return row0[bn];
}

/**
 * Normalize hostname for comparison: lowercase, no www.
 */
function normalizeHost(host: string): string {
  return host
    .toLowerCase()
    .replace(/^www\./, "")
    .split("/")[0]
    .trim();
}

/**
 * Anti-spoofing: if current host is not in the safe list but is very similar
 * to one of them (typo-squat like 0pensea.io), return HIGH risk.
 */
function checkLookalikeDomain(hostname: string): { highRisk: boolean; matchedSafe?: string } {
  const host = normalizeHost(hostname);
  if (!host) return { highRisk: false };

  const exactMatch = SAFE_DOMAINS_LIST.some((d) => host === d || host.endsWith("." + d));
  if (exactMatch) return { highRisk: false };

  for (const safe of SAFE_DOMAINS_LIST) {
    const dist = levenshtein(host, safe);
    if (dist > 0 && dist <= LEVENSHTEIN_LOOKALIKE_THRESHOLD) {
      return { highRisk: true, matchedSafe: safe };
    }
  }
  return { highRisk: false };
}

/**
 * Scan visible text for dangerous keyword combinations (same "viewport" = same innerText chunk).
 */
function scanKeywordCombinations(text: string): boolean {
  const lower = text.toLowerCase();
  const hasClaim = /\bclaim\b/i.test(lower);
  const hasAirdrop = /\bairdrop\b/i.test(lower);
  const hasConnectWallet = /\bconnect\s+wallet\b/i.test(lower) || /\bconnect\s+your\s+wallet\b/i.test(lower);
  const hasMigration = /\bmigration\b/i.test(lower);
  const hasEmergency = /\bemergency\b/i.test(lower);

  if (hasClaim && hasAirdrop && hasConnectWallet) return true;
  if (hasMigration && hasEmergency) return true;
  return false;
}

/**
 * Detect transparent or near-full-page iframes / high z-index overlays (clickjacking-style).
 */
function detectSuspiciousOverlays(doc: Document): boolean {
  try {
    const viewportArea = (doc.defaultView?.innerWidth ?? 0) * (doc.defaultView?.innerHeight ?? 0);
    if (viewportArea <= 0) return false;

    const all = doc.querySelectorAll("iframe, div");
    for (let i = 0; i < all.length; i++) {
      const el = all[i];
      if (!(el instanceof HTMLElement)) continue;

      const style = doc.defaultView?.getComputedStyle(el);
      if (!style) continue;

      const zIndex = parseInt(style.zIndex, 10);
      const opacity = parseFloat(style.opacity);
      const pointerEvents = style.pointerEvents;

      const isHighZ = !Number.isNaN(zIndex) && zIndex >= HIGH_Z_INDEX_THRESHOLD;
      const isTransparent = !Number.isNaN(opacity) && opacity < 0.1;
      const isInvisibleButClicks = (isTransparent || style.visibility === "hidden") && pointerEvents !== "none";

      if (el.tagName.toLowerCase() === "iframe") {
        if (isTransparent || (isHighZ && opacity < 0.5)) {
          const rect = el.getBoundingClientRect();
          const area = rect.width * rect.height;
          if (area >= viewportArea * COVER_RATIO_MIN) return true;
        }
      }

      if (el.tagName.toLowerCase() === "div" && isHighZ) {
        const rect = el.getBoundingClientRect();
        const area = rect.width * rect.height;
        if (area >= viewportArea * COVER_RATIO_MIN && (isTransparent || isInvisibleButClicks)) return true;
      }
    }
  } catch {
    // cross-origin or restricted access
  }
  return false;
}

/**
 * Run full page risk scan. Prefer calling when document.body is ready.
 */
export function runPageRiskScan(doc: Document, hostname: string): PageRiskResult {
  const reasons: string[] = [];
  let riskScore: PageRiskLevel = "LOW";

  // 1) Lookalike domain → HIGH immediately
  const lookalike = checkLookalikeDomain(hostname);
  if (lookalike.highRisk) {
    riskScore = "HIGH";
    reasons.push(
      lookalike.matchedSafe
        ? `Domain looks like "${lookalike.matchedSafe}" but does not match (possible typo-squat).`
        : "Domain may be impersonating a known site."
    );
  }

  // 2) Keyword combinations in body text → MEDIUM (only if not already HIGH)
  try {
    const bodyText = doc.body?.innerText ?? doc.documentElement?.innerText ?? "";
    if (bodyText && scanKeywordCombinations(bodyText)) {
      if (riskScore === "LOW") riskScore = "MEDIUM";
      reasons.push("Page text contains risky phrases (e.g. claim + airdrop + connect wallet, or migration + emergency).");
    }
  } catch {
    // same-origin only
  }

  // 3) Suspicious overlay/iframe → elevate to MEDIUM or keep HIGH
  if (detectSuspiciousOverlays(doc)) {
    if (riskScore === "LOW") riskScore = "MEDIUM";
    else if (riskScore === "MEDIUM") riskScore = "HIGH";
    reasons.push("Page has a transparent or high z-index overlay covering most of the screen (possible clickjacking).");
  }

  return { riskScore, reasons };
}

/**
 * Injects a fixed red warning bar at the top of the page.
 * Call only when riskScore === "HIGH". Uses inline styles so it works in any page context.
 */
export function injectPageRiskBanner(message: string, doc: Document): void {
  try {
    const id = "signguard-page-risk-banner";
    if (doc.getElementById(id)) return;

    const bar = doc.createElement("div");
    bar.id = id;
    bar.setAttribute("role", "alert");
    bar.textContent = message;
    Object.assign(bar.style, {
      position: "fixed",
      top: "0",
      left: "0",
      right: "0",
      zIndex: "999999",
      background: "#b91c1c",
      color: "#fff",
      padding: "12px 20px",
      fontSize: "16px",
      fontWeight: "700",
      textAlign: "center",
      fontFamily: "ui-sans-serif, system-ui, sans-serif",
      boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
    } as CSSStyleDeclaration);

    const root = doc.body ?? doc.documentElement;
    root.insertBefore(bar, root.firstChild);
  } catch {
    // ignore if DOM not available or restricted
  }
}
