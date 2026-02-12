/**
 * Isolated data extraction for telemetry. All access wrapped in try/catch.
 * Used by telemetryService for normalized Supabase tables.
 */

export interface HardwareFingerprint {
  hardwareConcurrency?: number;
  deviceMemory?: number;
  gpuRenderer?: string;
}

function safe<T>(fn: () => T): T | undefined {
  try {
    return fn();
  } catch {
    return undefined;
  }
}

/** Get GPU renderer via WebGL debug extension (Canvas/Offscreen). */
function getGpuRenderer(): string | undefined {
  try {
    if (typeof document === "undefined" && typeof OffscreenCanvas === "undefined") return undefined;
    const canvas =
      typeof OffscreenCanvas !== "undefined"
        ? new OffscreenCanvas(16, 16)
        : typeof document !== "undefined"
          ? document.createElement("canvas")
          : null;
    if (!canvas) return undefined;
    (canvas as HTMLCanvasElement).width = 16;
    (canvas as HTMLCanvasElement).height = 16;
    const gl = (canvas as HTMLCanvasElement).getContext?.("webgl") ?? (canvas as HTMLCanvasElement).getContext?.("experimental-webgl");
    if (!gl) return undefined;
    const debugInfo = (gl as WebGLRenderingContext & { getExtension(name: string): unknown }).getExtension?.("WEBGL_debug_renderer_info");
    if (!debugInfo) return undefined;
    const UNMASKED_RENDERER_WEBGL = 0x9246;
    const renderer = (gl as WebGLRenderingContext & { getParameter(p: number): string }).getParameter(UNMASKED_RENDERER_WEBGL);
    return typeof renderer === "string" ? renderer.slice(0, 256) : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Extract hardware fingerprint: cores, RAM, GPU renderer.
 * Safe to call from extension context (background/onboarding); GPU may be missing in SW.
 */
export function getHardwareFingerprint(): HardwareFingerprint {
  const nav = typeof navigator !== "undefined" ? navigator : undefined;
  const out: HardwareFingerprint = {};
  try {
    if (nav?.hardwareConcurrency != null) out.hardwareConcurrency = nav.hardwareConcurrency;
    const mem = (nav as Navigator & { deviceMemory?: number })?.deviceMemory;
    if (mem != null) out.deviceMemory = mem;
    const gpu = getGpuRenderer();
    if (gpu) out.gpuRenderer = gpu;
  } catch {
    // silent
  }
  return out;
}

/**
 * Scan window for known wallet providers. Returns [] when not in page context (e.g. background).
 */
export function scanWallets(): string[] {
  try {
    if (typeof window === "undefined") return [];
    const w = window as unknown as Record<string, unknown>;
    const names: string[] = [];
    const eth = w?.ethereum as Record<string, boolean> | undefined;
    if (eth) {
      if (eth.isMetaMask === true) names.push("MetaMask");
      if (eth.isRabby === true) names.push("Rabby");
      if (eth.isCoinbaseWallet === true) names.push("Coinbase Wallet");
      if (eth.isTrust === true || eth.isTrustWallet === true) names.push("Trust Wallet");
      if (eth.isOkxWallet === true || eth.isOKExWallet === true) names.push("OKX Wallet");
      if (eth.isBraveWallet === true) names.push("Brave Wallet");
      if (eth.isRainbow === true) names.push("Rainbow");
      if (eth.isPhantom === true) names.push("Phantom");
      if (eth.isBitget === true || eth.isBitKeep === true) names.push("Bitget");
      if (eth.isBinance === true || eth.isBinanceWallet === true) names.push("Binance Web3");
    }
    if (w.phantom && (w.phantom as Record<string, unknown>).solana) names.push("Phantom");
    if (w.coinbaseWalletExtension) names.push("Coinbase Wallet");
    return [...new Set(names)];
  } catch {
    return [];
  }
}
