/** Token verification (inverted whitelist): Uniswap list = verified, else unknown */

import type { ThreatIntel } from "../intel";

export function isTokenVerified(intel: ThreatIntel | null, address: string): boolean {
  if (!address || typeof address !== "string") return false;
  const list = (intel as any)?.trustedTokenAddresses as string[] | undefined;
  if (!Array.isArray(list) || list.length === 0) return false;
  const a = address.trim().toLowerCase();
  if (!a.startsWith("0x") || a.length !== 42) return false;
  return list.includes(a);
}

/** Resolve token address for a tx: contract (to) for ERC20, or from decoded action */
export function getTokenAddressForTx(
  txTo: string | undefined,
  decodedAction: { kind: string; token?: string } | null
): string | undefined {
  const to = (txTo ?? "").trim().toLowerCase();
  if (decodedAction && "token" in decodedAction && decodedAction.token) {
    return decodedAction.token.trim().toLowerCase();
  }
  if (to && to.startsWith("0x") && to.length === 42) return to;
  return undefined;
}
