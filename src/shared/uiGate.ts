/**
 * P0 UI Gate: methods that must NEVER bypass the SignGuard overlay (TEMP ALLOW, etc.)
 * User must always see and confirm in SignGuard before the wallet popup opens.
 */

const UI_GATED_METHODS_LIST = [
  "eth_requestAccounts",
  "wallet_requestPermissions",
  "wallet_addEthereumChain",
  "wallet_switchEthereumChain",
  "wallet_watchAsset",
  "wallet_sendTransaction",
  "eth_sendTransaction",
  "eth_signTransaction",
  "eth_sendRawTransaction",
  "wallet_invokeSnap",
  "wallet_requestSnaps",
  "personal_sign",
  "eth_sign",
  "eth_signTypedData",
  "eth_signTypedData_v3",
  "eth_signTypedData_v4",
];

const UI_GATED_METHODS = new Set(UI_GATED_METHODS_LIST.map((m) => m.toLowerCase()));

export { UI_GATED_METHODS };

export function shouldGateUI(method: string): boolean {
  return UI_GATED_METHODS.has(String(method || "").toLowerCase());
}
