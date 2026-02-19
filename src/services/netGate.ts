/**
 * Central gate: "may this feature use the network?" No fetch unless (a) feature ON and (b) permissions granted.
 * No fail-open: if gate fails, caller must use cache/seed/preflight only.
 */
import type { Settings } from "../shared/types";
import type { OptionalFeature } from "../shared/optionalOrigins";
import { OPTIONAL_ORIGINS, getOriginsForFeatures } from "../shared/optionalOrigins";
import { hasOptionalHostPermissions } from "../permissions";

export type NetGateResult = { ok: boolean; reason?: string };

async function hasOriginsForFeature(feature: OptionalFeature): Promise<boolean> {
  return hasOptionalHostPermissions(feature);
}

/**
 * Returns whether the given feature may use the network.
 * - cloudIntel: settings.cloudIntelOptIn === true AND permissions for cloudIntel.
 * - pricing: settings.showUsd === true AND permissions for pricing.
 * - simulation: settings.simulation?.enabled === true AND permissions for simulation.
 * - telemetry: termsAccepted (from storage/caller) AND settings.telemetryOptIn AND permissions for telemetry.
 */
export async function canUseNetwork(
  feature: OptionalFeature,
  settings: Settings | null,
  opts?: { termsAccepted?: boolean }
): Promise<NetGateResult> {
  const origins = OPTIONAL_ORIGINS[feature];
  if (!origins?.length) return { ok: false, reason: "no origins defined" };

  const granted = await hasOriginsForFeature(feature);
  if (!granted) return { ok: false, reason: "permissions not granted" };

  switch (feature) {
    case "cloudIntel":
      if (settings?.cloudIntelOptIn !== true) return { ok: false, reason: "Cloud Intel disabled" };
      return { ok: true };
    case "pricing":
      if (settings?.showUsd !== true) return { ok: false, reason: "USD/pricing disabled" };
      return { ok: true };
    case "simulation":
      if (settings?.simulation?.enabled !== true) return { ok: false, reason: "Simulation disabled" };
      return { ok: true };
    case "telemetry":
      if (opts?.termsAccepted !== true) return { ok: false, reason: "terms not accepted" };
      if (settings?.telemetryOptIn !== true) return { ok: false, reason: "telemetry disabled" };
      return { ok: true };
    default:
      return { ok: false, reason: "unknown feature" };
  }
}

/** Check if network is allowed for any of the given features (each checked independently; first OK wins). For "all must be OK" use sequential canUseNetwork. */
export async function canUseNetworkForAny(
  features: OptionalFeature[],
  settings: Settings | null,
  opts?: { termsAccepted?: boolean }
): Promise<NetGateResult> {
  const origins = getOriginsForFeatures(features);
  if (!origins.length) return { ok: true };
  for (const f of features) {
    const r = await canUseNetwork(f, settings, opts);
    if (r.ok) return r;
  }
  return { ok: false, reason: "no feature allowed" };
}
