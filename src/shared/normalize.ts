export function normMethod(m: any) {
  return String(m || "").trim();
}

export function normMethodLower(m: any) {
  return normMethod(m).toLowerCase();
}

export type TypedDataNormalized = {
  address?: string;
  typedDataRaw?: string;
  typedDataObj?: any;
  rawShape: "string" | "object" | "unknown";
};

/** Centralized parsing for eth_signTypedData* variants. Handles string/object and param order. */
export function normalizeTypedDataParams(method: string, params: any): TypedDataNormalized {
  const result: TypedDataNormalized = { rawShape: "unknown" };
  if (!params || !Array.isArray(params) || params.length === 0) return result;

  let address: string | undefined;
  let typedData: string | object | undefined;

  const p0 = params[0];
  const p1 = params[1];

  // Detect: [address, typedData] vs [typedData, address]
  const p0IsAddr = typeof p0 === "string" && /^0x[a-fA-F0-9]{40}$/.test(p0);
  const p1IsAddr = typeof p1 === "string" && /^0x[a-fA-F0-9]{40}$/.test(p1);
  const p0IsTypedData = typeof p0 === "string" && (p0.startsWith("{") || p0.startsWith("["))
    || (typeof p0 === "object" && p0 !== null && (p0.domain || p0.types || p0.primaryType || p0.message));
  const p1IsTypedData = typeof p1 === "string" && (p1.startsWith("{") || p1.startsWith("["))
    || (typeof p1 === "object" && p1 !== null && (p1.domain || p1.types || p1.primaryType || p1.message));

  if (p0IsAddr && p1IsTypedData) {
    address = p0;
    typedData = p1;
  } else if (p0IsTypedData && p1IsAddr) {
    typedData = p0;
    address = p1;
  } else if (p0IsTypedData) {
    typedData = p0;
    address = p1IsAddr ? p1 : undefined;
  } else if (p1IsTypedData) {
    typedData = p1;
    address = p0IsAddr ? p0 : undefined;
  }

  if (typeof typedData === "string") {
    result.typedDataRaw = typedData;
    result.rawShape = "string";
    try {
      result.typedDataObj = JSON.parse(typedData);
    } catch {
      result.typedDataObj = undefined;
    }
  } else if (typedData && typeof typedData === "object") {
    result.typedDataObj = typedData;
    result.typedDataRaw = JSON.stringify(typedData);
    result.rawShape = "object";
  }

  if (address) result.address = address.trim().toLowerCase();
  return result;
}

const TYPED_DATA_METHODS = new Set([
  "eth_signtypeddata",
  "eth_signtypeddata_v3",
  "eth_signtypeddata_v4",
]);

export function isTypedDataMethod(method: string): boolean {
  return TYPED_DATA_METHODS.has(String(method || "").toLowerCase());
}

