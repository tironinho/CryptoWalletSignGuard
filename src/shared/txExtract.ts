export type TxEssentials = {
  to?: string;
  from?: string;
  valueHex?: string;
  dataLen?: number;
};

export function extractTx(params: any): TxEssentials | null {
  const p0 = Array.isArray(params) ? params[0] : null;
  if (!p0 || typeof p0 !== "object") return null;

  const to = typeof (p0 as any).to === "string" ? (p0 as any).to : undefined;
  const from = typeof (p0 as any).from === "string" ? (p0 as any).from : undefined;
  const valueHex = typeof (p0 as any).value === "string" ? (p0 as any).value : undefined;
  const dataLen = typeof (p0 as any).data === "string" ? (p0 as any).data.length : undefined;

  if (!to && !from && !valueHex && !dataLen) return null;
  return { to, from, valueHex, dataLen };
}

