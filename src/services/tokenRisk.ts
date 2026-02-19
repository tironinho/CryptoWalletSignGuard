/**
 * Token risk analysis for swap/approve/permit flows.
 * Extracts token candidates and returns confidence (HIGH/MEDIUM/LOW).
 */

import type { DecodedAction } from "../shared/types";
import { getTokenInfo, getTokenFirstSeen, markTokenSeen } from "./tokenSecurity";
import { getTokenAddressForTx } from "./tokenSecurity";
import type { ListsCacheV1 } from "../shared/types";
import { isScamToken, isTrustedToken } from "./listManager";

export type TokenConfidence = "HIGH" | "MEDIUM" | "LOW";

export type TokenRiskResult = {
  confidence: TokenConfidence;
  signals: string[];
  isNew?: boolean;
  symbol?: string;
};

const SWAP_PATH_SELECTORS = new Set([
  "0x38ed1739", "0x7ff36ab5", "0x18cbafe5", "0x04e45aaf", "0xb858183f", "0x5023b4df", "0x09b81346",
]);

function normalizeAddr(a: string): string {
  const s = String(a || "").trim().toLowerCase();
  return s.startsWith("0x") && s.length === 42 ? s : "";
}

/** Decode Uniswap V2–style swap path from calldata (address[] path). */
function decodeSwapPath(data: string): string[] {
  const addrs: string[] = [];
  if (!data || typeof data !== "string" || !data.startsWith("0x") || data.length < 10) return addrs;
  const body = data.slice(10).toLowerCase();
  if (body.length < 192) return addrs; // selector(4) + 3 words min (amountIn, amountOutMin, pathOffset)
  const pathOffsetHex = body.slice(128, 192); // word index 2 = path offset
  const pathOffset = parseInt(pathOffsetHex, 16);
  if (!Number.isFinite(pathOffset) || pathOffset < 0 || pathOffset * 2 > body.length) return addrs;
  const pathStart = pathOffset * 2;
  if (body.length < pathStart + 64) return addrs;
  const lenHex = body.slice(pathStart, pathStart + 64);
  const len = parseInt(lenHex, 16);
  if (!Number.isFinite(len) || len <= 0 || len > 20) return addrs;
  for (let i = 0; i < len; i++) {
    const addrStart = pathStart + 64 + i * 64;
    const addrEnd = addrStart + 64;
    if (body.length < addrEnd) break;
    const word = body.slice(addrStart, addrEnd);
    const addr = "0x" + (word.length >= 40 ? word.slice(24) : word.padStart(40, "0"));
    const n = normalizeAddr(addr);
    if (n && !addrs.includes(n)) addrs.push(n);
  }
  return addrs;
}

/**
 * Extract token addresses involved in the tx (approve/permit/swap).
 */
export function extractTokenCandidates(
  txTo: string | undefined,
  data: string,
  decodedAction: DecodedAction | null,
  _simulation?: { outgoingAssets?: { symbol: string }[]; incomingAssets?: { symbol: string }[] }
): string[] {
  const candidates: string[] = [];
  const to = (txTo ?? "").trim().toLowerCase();
  const dataStr = typeof data === "string" ? data : "";

  if (decodedAction) {
    if ("token" in decodedAction && decodedAction.token) {
      const t = normalizeAddr(decodedAction.token);
      if (t) candidates.push(t);
    }
    if ("spender" in decodedAction && decodedAction.spender) {
      const s = normalizeAddr(decodedAction.spender);
      if (s && !candidates.includes(s)) candidates.push(s);
    }
  }

  if (dataStr.length >= 10) {
    const sel = dataStr.slice(0, 10).toLowerCase();
    if (SWAP_PATH_SELECTORS.has(sel)) {
      const path = decodeSwapPath(dataStr);
      for (const p of path) {
        if (p && !candidates.includes(p)) candidates.push(p);
      }
    }
  }

  const fromTo = getTokenAddressForTx(txTo, decodedAction);
  if (fromTo && !candidates.includes(fromTo)) candidates.push(fromTo);

  if (to && to.startsWith("0x") && to.length === 42 && !candidates.includes(to)) {
    candidates.push(to);
  }

  return [...new Set(candidates)];
}

const NEW_TOKEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Get token risk (confidence + signals).
 * Uses tokenSecurity (Uniswap list), listManager (scam/trusted), and first-seen.
 */
export async function getTokenRisk(
  address: string,
  chainIdHex: string,
  listCache: ListsCacheV1 | null
): Promise<TokenRiskResult> {
  const addr = normalizeAddr(address);
  if (!addr) return { confidence: "LOW", signals: ["Endereço inválido."] };

  const chainId = String(chainIdHex || "0x1").toLowerCase();
  const ch = chainId.startsWith("0x") ? chainId : "0x" + parseInt(chainId || "0", 10).toString(16);

  await markTokenSeen(ch, addr);
  const firstSeen = await getTokenFirstSeen(ch, addr);
  const tokenInfo = getTokenInfo(addr);
  const tokenScam = listCache ? isScamToken(ch, addr, listCache) : false;
  const tokenTrusted = listCache ? isTrustedToken(ch, addr, listCache) : false;
  const verified = tokenInfo?.v ?? false;

  const signals: string[] = [];
  let confidence: TokenConfidence = "MEDIUM";

  if (tokenScam) {
    return {
      confidence: "LOW",
      signals: ["Token em lista de scam/bloqueado."],
      symbol: tokenInfo?.s,
    };
  }

  if (tokenTrusted || verified) {
    return {
      confidence: "HIGH",
      signals: ["Token em lista confiável ou verificado."],
      symbol: tokenInfo?.s,
    };
  }

  const isNew = !firstSeen || Date.now() - firstSeen < NEW_TOKEN_DAYS_MS;
  if (isNew) {
    signals.push("Token recém-visto ou sem histórico.");
    confidence = "LOW";
  } else {
    signals.push("Sem lista de reputação conhecida.");
    confidence = "MEDIUM";
  }

  return {
    confidence,
    signals,
    isNew,
    symbol: tokenInfo?.s,
  };
}
