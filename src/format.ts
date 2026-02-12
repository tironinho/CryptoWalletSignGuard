export function weiToEthString(wei: bigint, decimals = 6): string {
  const neg = wei < 0n;
  const w = neg ? -wei : wei;
  const ethInt = w / 1_000_000_000_000_000_000n;
  const ethFrac = w % 1_000_000_000_000_000_000n;
  const fracStrFull = ethFrac.toString().padStart(18, "0");
  const frac = fracStrFull.slice(0, Math.max(0, decimals));
  const s = decimals > 0 ? `${ethInt.toString()}.${frac}` : ethInt.toString();
  return neg ? `-${s}` : s;
}

export function hexToBigInt(x?: string): bigint {
  if (!x) return 0n;
  return BigInt(x);
}
