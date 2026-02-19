/**
 * Optional host permissions by feature. Uses optionalOrigins as single source of truth.
 */

import type { OptionalFeature } from "./shared/optionalOrigins";
import { getOriginsForFeature, getAllOptionalOrigins } from "./shared/optionalOrigins";

async function hasOrigins(origins: string[]): Promise<boolean> {
  if (!origins.length) return true;
  try {
    if (!chrome?.permissions?.contains) return false;
    return await chrome.permissions.contains({ origins });
  } catch {
    return false;
  }
}

async function requestOrigins(origins: string[]): Promise<boolean> {
  if (!origins.length) return true;
  try {
    if (!chrome?.permissions?.request) return false;
    return await chrome.permissions.request({ origins });
  } catch {
    return false;
  }
}

async function removeOrigins(origins: string[]): Promise<boolean> {
  if (!origins.length) return true;
  try {
    if (!chrome?.permissions?.remove) return false;
    return await chrome.permissions.remove({ origins });
  } catch {
    return false;
  }
}

export async function hasOptionalHostPermissions(feature: OptionalFeature): Promise<boolean> {
  const origins = getOriginsForFeature(feature);
  return hasOrigins(origins);
}

export async function requestOptionalHostPermissions(feature: OptionalFeature): Promise<boolean> {
  const origins = getOriginsForFeature(feature);
  return requestOrigins(origins);
}

export async function removeOptionalHostPermissions(feature: OptionalFeature): Promise<boolean> {
  const origins = getOriginsForFeature(feature);
  return removeOrigins(origins);
}

/** Legacy: pass explicit origins (e.g. from getOriginsForFeatures). */
export async function hasOptionalHostPermissionsOrigins(origins: string[]): Promise<boolean> {
  return hasOrigins(origins);
}

export async function requestOptionalHostPermissionsOrigins(origins: string[]): Promise<boolean> {
  return requestOrigins(origins);
}

export async function removeOptionalHostPermissionsOrigins(origins: string[]): Promise<boolean> {
  return removeOrigins(origins);
}

/** True only if all optional origins (all features) are granted. Used by legacy handlers. */
export async function hasOptionalHostPermissionsAll(): Promise<boolean> {
  return hasOrigins(getAllOptionalOrigins());
}
