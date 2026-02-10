export type SGAction =
  | "CONNECT"
  | "SWITCH_CHAIN"
  | "ADD_CHAIN"
  | "REQUEST_PERMISSIONS"
  | "SIGN_MESSAGE"
  | "SIGN_TYPED_DATA"
  | "SEND_TX"
  | "WATCH_ASSET"
  | "UNKNOWN";

export function classifyAction(method: string, params: any): SGAction {
  const ml = method.toLowerCase();

  if (ml === "eth_requestaccounts") return "CONNECT";
  if (ml === "wallet_requestpermissions" || ml === "wallet_getpermissions") return "REQUEST_PERMISSIONS";
  if (ml === "wallet_switchethereumchain") return "SWITCH_CHAIN";
  if (ml === "wallet_addethereumchain") return "ADD_CHAIN";
  if (ml === "wallet_watchasset") return "WATCH_ASSET";

  if (ml === "personal_sign" || ml === "eth_sign") return "SIGN_MESSAGE";
  if (ml === "eth_signtypeddata" || ml === "eth_signtypeddata_v4" || ml === "eth_signtypeddata_v3") return "SIGN_TYPED_DATA";

  if (ml === "eth_sendtransaction" || ml === "wallet_sendtransaction") return "SEND_TX";

  return "UNKNOWN";
}

export function classifyByShape(params: any): SGAction {
  // se params[0] parece tx (to + from + data/value/gas)
  const p0 = Array.isArray(params) ? params[0] : null;
  if (p0 && typeof p0 === "object") {
    const hasTo = typeof (p0 as any).to === "string";
    const hasFrom = typeof (p0 as any).from === "string";
    const hasDataOrValue = ("data" in (p0 as any)) || ("value" in (p0 as any));
    if (hasTo && hasFrom && hasDataOrValue) return "SEND_TX";
  }
  return "UNKNOWN";
}

export function classifyFinalAction(method: string, params: any): SGAction {
  const action = classifyAction(method, params);
  return action === "UNKNOWN" ? classifyByShape(params) : action;
}

