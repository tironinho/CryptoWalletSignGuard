/**
 * Token metadata (symbol, decimals, name) via page provider (eth_call through content script).
 * No background fetch to RPC URLs; avoids network opt-in leak.
 */

const DECIMALS_SEL = "0x313ce567" + "0".repeat(56);
const SYMBOL_SEL = "0x95d89b41" + "0".repeat(56);
const NAME_SEL = "0x06fdde03" + "0".repeat(56);

const CALL_TIMEOUT_MS = 1200;
const TOTAL_TIMEOUT_MS = 2500;

export type TokenMetaViaProviderOpts = {
  tabId: number;
  chainIdHex: string;
  token: string;
  rpc: (method: string, params: unknown[]) => Promise<{ ok: boolean; result?: unknown; error?: string } | null>;
  timeoutMs?: number;
  totalTimeoutMs?: number;
};

export type TokenMetaViaProviderResult =
  | { ok: true; symbol?: string; decimals?: number; name?: string }
  | { ok: false; meta: { address: string; chainIdHex: string }; reason: string };

function normalizeAddr(addr: string): string {
  const s = (addr || "").trim().toLowerCase();
  return s.startsWith("0x") && s.length === 42 ? s : "";
}

function decodeStringResult(hex: string): string {
  if (!hex || hex.length < 66) return "";
  const data = hex.startsWith("0x") ? hex.slice(2) : hex;
  if (data.length < 64) return "";
  const firstWord = data.slice(0, 64);
  const offset = parseInt(firstWord.slice(0, 16), 16);
  if (offset === 0x20 && data.length >= 128) {
    const lenHex = data.slice(64, 128);
    const len = parseInt(lenHex, 16) * 2;
    const strHex = data.slice(128, 128 + len);
    try {
      return decodeURIComponent(strHex.replace(/(..)/g, "%$1")).replace(/\0/g, "").trim();
    } catch {
      return "";
    }
  }
  const ascii = firstWord.match(/.{2}/g)?.map((b) => String.fromCharCode(parseInt(b, 16))).join("") ?? "";
  return ascii.replace(/\0/g, "").trim();
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, rej) => setTimeout(() => rej(new Error("PROVIDER_CALL_FAILED")), ms)),
  ]);
}

export async function getTokenMetaViaProvider(opts: TokenMetaViaProviderOpts): Promise<TokenMetaViaProviderResult> {
  const addr = normalizeAddr(opts.token);
  if (!addr) return { ok: false, meta: { address: opts.token, chainIdHex: opts.chainIdHex }, reason: "INVALID_ADDRESS" };

  const callTimeout = opts.timeoutMs ?? CALL_TIMEOUT_MS;
  const totalTimeout = opts.totalTimeoutMs ?? TOTAL_TIMEOUT_MS;
  const rpc = opts.rpc;

  const start = Date.now();
  const mustFinishBy = start + totalTimeout;

  const ethCall = async (to: string, data: string): Promise<string | null> => {
    if (Date.now() >= mustFinishBy) throw new Error("PROVIDER_CALL_FAILED");
    const res = await withTimeout(
      rpc("eth_call", [{ to, data, gas: "0x7530" }, "latest"]),
      Math.min(callTimeout, mustFinishBy - Date.now())
    );
    if (!res?.ok || res.result == null) return null;
    return typeof res.result === "string" ? res.result : null;
  };

  try {
    const [decRes, symRes, nameRes] = await Promise.all([
      ethCall(addr, DECIMALS_SEL),
      ethCall(addr, SYMBOL_SEL),
      ethCall(addr, NAME_SEL),
    ]);

    let decimals: number | undefined;
    if (decRes && decRes.length >= 66) {
      const n = parseInt(decRes.slice(2, 66), 16);
      if (Number.isFinite(n)) decimals = n;
    }
    let symbol = "";
    if (symRes && symRes.length >= 66) symbol = decodeStringResult(symRes);
    let name = "";
    if (nameRes && nameRes.length >= 66) name = decodeStringResult(nameRes);

    return { ok: true, symbol: symbol || undefined, decimals, name: name || undefined };
  } catch {
    return { ok: false, meta: { address: addr, chainIdHex: opts.chainIdHex }, reason: "PROVIDER_CALL_FAILED" };
  }
}
