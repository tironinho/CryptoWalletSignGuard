/**
 * Single source of truth for optional host origins per feature.
 * No fetch to these domains without (a) feature ON in settings and (b) user-granted permissions.
 */

export type OptionalFeature = "cloudIntel" | "pricing" | "simulation" | "telemetry";

export const OPTIONAL_ORIGINS: Record<OptionalFeature, string[]> = {
  cloudIntel: [
    "https://raw.githubusercontent.com/*",
    "https://api.cryptoscamdb.org/*",
    "https://gitlab.com/*",
    "https://gateway.ipfs.io/*",
    "https://api.llama.fi/*",
  ],
  pricing: [
    "https://api.coingecko.com/*",
    "https://api.dexscreener.com/*",
  ],
  simulation: ["https://api.tenderly.co/*"],
  telemetry: ["https://cjnzidctntqzamhwmwkt.supabase.co/*"],
};

/** Returns origins for a single feature. */
export function getOriginsForFeature(feature: OptionalFeature): string[] {
  const list = OPTIONAL_ORIGINS[feature];
  return list ? [...list] : [];
}

/** Returns origins for multiple features (deduplicated). */
export function getOriginsForFeatures(features: OptionalFeature[]): string[] {
  const set = new Set<string>();
  for (const f of features) {
    const list = OPTIONAL_ORIGINS[f];
    if (list) for (const o of list) set.add(o);
  }
  return [...set];
}

/** Union of all optional origins (deduplicated). */
export function getAllOptionalOrigins(): string[] {
  return normalizeOrigins(
    ([] as string[]).concat(
      ...Object.keys(OPTIONAL_ORIGINS).map((k) => OPTIONAL_ORIGINS[k as OptionalFeature])
    )
  );
}

/** Dedupe and sort for stable manifest/validation. */
export function normalizeOrigins(origins: string[]): string[] {
  return [...new Set(origins)].filter(Boolean).sort();
}
