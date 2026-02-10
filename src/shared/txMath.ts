export function hexToBigInt(hex?: string): bigint {
  if (!hex || typeof hex !== "string") return 0n;
  return BigInt(hex);
}

export function weiToEthString(wei: bigint, decimals = 6): string {
  // ETH = wei / 1e18
  const ONE = 10n ** 18n;
  const whole = wei / ONE;
  const frac = wei % ONE;
  const fracStr = frac.toString().padStart(18, "0").slice(0, decimals);
  return `${whole.toString()}.${fracStr}`.replace(/\.?0+$/, (m) => (m === "." ? "" : m));
}

