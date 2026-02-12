/**
 * Maps partial domain patterns to interest categories for behavioral profiling.
 * Used to attribute tags and spending metrics before sending to Supabase.
 */

export const INTEREST_MAP: Record<string, string> = {
  "opensea.io": "NFT",
  "blur.io": "NFT",
  "magiceden.io": "NFT",
  "uniswap.org": "DEFI",
  "aave.com": "DEFI",
  "curve.fi": "DEFI",
  "1inch.io": "DEFI",
  "pump.fun": "MEMECOINS",
  "dexscreener.com": "TRADING",
  "galxe.com": "AIRDROP",
  "layer3.xyz": "AIRDROP",
};
