export type SGAction =
  | "CONNECT"
  | "SWITCH_CHAIN"
  | "ADD_CHAIN"
  | "REQUEST_PERMISSIONS"
  | "SIGN_MESSAGE"
  | "SIGN_TYPED_DATA"
  | "SEND_TX"
  | "WATCH_ASSET"
  | "SOLANA"
  | "UNKNOWN";

export function classifyByMethod(method: string): SGAction {
  const m = String(method || "").toLowerCase().trim();

  if (m === "eth_requestaccounts") return "CONNECT";
  if (m === "wallet_requestpermissions" || m === "wallet_getpermissions") return "REQUEST_PERMISSIONS";
  if (m === "wallet_switchethereumchain") return "SWITCH_CHAIN";
  if (m === "wallet_addethereumchain") return "ADD_CHAIN";
  if (m === "wallet_watchasset") return "WATCH_ASSET";
  if (m.startsWith("solana:")) return "SOLANA";

  if (m === "personal_sign" || m === "eth_sign") return "SIGN_MESSAGE";
  if (m === "eth_signtypeddata" || m === "eth_signtypeddata_v3" || m === "eth_signtypeddata_v4") return "SIGN_TYPED_DATA";

  if (m === "eth_sendtransaction" || m === "wallet_sendtransaction") return "SEND_TX";

  return "UNKNOWN";
}

export function looksLikeTx(params: any): boolean {
  const p0 = Array.isArray(params) ? params[0] : null;
  if (!p0 || typeof p0 !== "object") return false;

  const hasTo = typeof (p0 as any).to === "string" && (p0 as any).to.length > 0;
  const hasFrom = typeof (p0 as any).from === "string" && (p0 as any).from.length > 0;
  const hasDataOrValue = ("data" in (p0 as any)) || ("value" in (p0 as any));
  return hasTo && hasFrom && hasDataOrValue;
}

export function classifyAction(method: string, params: any): SGAction {
  const a = classifyByMethod(method);
  if (a !== "UNKNOWN") return a;
  if (looksLikeTx(params)) return "SEND_TX";
  return "UNKNOWN";
}

