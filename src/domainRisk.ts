export function normalizeHost(host: string): string {
  return String(host || "").trim().toLowerCase().replace(/\.$/, "");
}

function getTld(host: string) {
  const parts = normalizeHost(host).split(".").filter(Boolean);
  return parts.length ? parts[parts.length - 1] : "";
}

function getLabels(host: string) {
  return normalizeHost(host).split(".").filter(Boolean);
}

// Approximation: registrable domain label (2nd-level) using last 2 labels.
function getRegistrableLabel(host: string) {
  const parts = getLabels(host);
  if (parts.length < 2) return parts[0] || "";
  return parts[parts.length - 2] || "";
}

function hasPunycode(host: string) {
  const h = normalizeHost(host);
  return h.startsWith("xn--") || h.includes(".xn--");
}

function levenshtein(a: string, b: string) {
  const s = String(a || "");
  const t = String(b || "");
  const n = s.length;
  const m = t.length;
  if (n === 0) return m;
  if (m === 0) return n;

  const v0 = new Array(m + 1).fill(0);
  const v1 = new Array(m + 1).fill(0);

  for (let i = 0; i <= m; i++) v0[i] = i;
  for (let i = 0; i < n; i++) {
    v1[0] = i + 1;
    for (let j = 0; j < m; j++) {
      const cost = s[i] === t[j] ? 0 : 1;
      v1[j + 1] = Math.min(
        v1[j] + 1,        // insertion
        v0[j + 1] + 1,    // deletion
        v0[j] + cost      // substitution
      );
    }
    for (let j = 0; j <= m; j++) v0[j] = v1[j];
  }
  return v0[m];
}

function isSuspiciousSubdomain(host: string, brands: string[]) {
  const labels = getLabels(host);
  if (labels.length < 3) return false;
  const registrable = getRegistrableLabel(host);
  const sub = labels.slice(0, -2).join(".");
  if (!sub) return false;
  for (const b of brands) {
    if (!b) continue;
    const hitInSub = labels.slice(0, -2).some((x) => x.includes(b));
    if (hitInSub && !registrable.includes(b)) return true;
  }
  return false;
}

function findBrandTypo(host: string, brands: string[]) {
  const reg = getRegistrableLabel(host);
  const clean = reg.replace(/[^a-z0-9]/g, "");
  const segments = reg.split(/[-_]/g).filter(Boolean);
  const candidates = Array.from(new Set([reg, clean, ...segments].filter(Boolean)));

  let best: { brand: string; cand: string; dist: number } | null = null;
  for (const b of brands) {
    const brand = String(b || "").toLowerCase();
    if (!brand) continue;
    for (const cand of candidates) {
      const c = String(cand || "").toLowerCase();
      if (!c) continue;
      // quick: exact brand in label is also a lookalike signal
      if (c.includes(brand) && c !== brand) {
        return { brand, cand: c, dist: 0 };
      }
      const d = levenshtein(c, brand);
      if (d <= 2 && c !== brand) {
        if (!best || d < best.dist) best = { brand, cand: c, dist: d };
      }
    }
  }
  return best;
}

export function assessDomainRisk(host: string, brandSeeds: string[]) {
  const reasons: string[] = [];
  let scoreDelta = 0;

  const h = normalizeHost(host);
  if (!h) return { scoreDelta, reasons };

  const suspiciousTlds = new Set(["zip", "mov", "top", "xyz", "click", "fit"]);
  const tld = getTld(h);

  if (hasPunycode(h)) {
    scoreDelta += 30;
    reasons.push("Lookalike: punycode (xn--) detectado.");
  }

  if (isSuspiciousSubdomain(h, brandSeeds)) {
    scoreDelta += 35;
    reasons.push("Lookalike: marca aparece no subdomínio (não no domínio registrável).");
  }

  const typo = findBrandTypo(h, brandSeeds);
  if (typo) {
    scoreDelta += 40;
    reasons.push(`Lookalike: possível typo/variação de "${typo.brand}".`);
  }

  if (tld && suspiciousTlds.has(tld)) {
    scoreDelta += 10;
    reasons.push(`TLD suspeito (.${tld}).`);
  }

  // Clamp
  scoreDelta = Math.max(0, Math.min(80, scoreDelta));
  return { scoreDelta, reasons };
}

