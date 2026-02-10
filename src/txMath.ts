export function hexToBigInt(hex?: string): bigint {
  if (!hex) return 0n;
  try { return BigInt(hex); } catch { return 0n; }
}

export function weiToEth(wei: bigint, decimals = 6): string {
  const base = 10n ** 18n;
  const whole = wei / base;
  const frac = wei % base;
  const fracStr = frac.toString().padStart(18, "0").slice(0, decimals);
  const s = `${whole}.${fracStr}`;
  return s.replace(/\.?0+$/, (m) => (m === "." ? "" : m));
}

export function shortAddr(addr?: string): string {
  if (!addr || typeof addr !== "string") return "";
  if (addr.length <= 12) return addr;
  return addr.slice(0, 6) + "…" + addr.slice(-4);
}

