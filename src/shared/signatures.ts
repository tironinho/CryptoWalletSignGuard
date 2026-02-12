/** Known selectors for human-readable labels (no network). */
export const KNOWN_SELECTORS: Record<string, string> = {
  "0x095ea7b3": "approve(address,uint256)",
  "0xa9059cbb": "transfer(address,uint256)",
  "0x23b872dd": "transferFrom(address,address,uint256)",
  "0xa22cb465": "setApprovalForAll(address,bool)",
  "0x42842e0e": "safeTransferFrom(address,address,uint256)",
  "0xf242432a": "safeTransferFrom(address,address,uint256,bytes)",
  "0xd0e30db0": "deposit()",
  "0x2e1a7d4d": "withdraw(uint256)",
  "0x38ed1739": "swapExactTokensForTokens(...)",
  "0x7ff36ab5": "swapExactETHForTokens(...)",
  "0x18cbafe5": "swapExactTokensForETH(...)",
  "0x04e45aaf": "exactInputSingle(...)",
  "0xb858183f": "exactInput(...)",
  "0x414bf389": "exactOutputSingle(...)",
  "0x09b81346": "exactOutput(...)",
};

export function selectorToLabel(sel?: string | null): string | null {
  if (!sel || typeof sel !== "string") return null;
  const s = sel.toLowerCase();
  return KNOWN_SELECTORS[s] ?? null;
}
