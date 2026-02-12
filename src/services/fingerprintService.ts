/**
 * Browser fingerprint for telemetry (device_data). Robust try/catch; must not break extension.
 * Used once per install/update in identifyUser().
 */

export interface DeviceFingerprint {
  hardware?: {
    hardwareConcurrency?: number;
    deviceMemory?: number;
    screenWidth?: number;
    screenHeight?: number;
    colorDepth?: number;
  };
  connection?: {
    effectiveType?: string;
    downlink?: number;
    rtt?: number;
  };
  gpu?: string;
  timezone?: string;
  locale?: string;
  localeLanguage?: string;
}

function safe<T>(fn: () => T): T | undefined {
  try {
    return fn();
  } catch {
    return undefined;
  }
}

/** Fast canvas fingerprint for GPU renderer hint (offscreen, minimal). No document in SW. */
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
    const ctx = (canvas as HTMLCanvasElement).getContext?.("2d");
    if (!ctx) return undefined;
    ctx.fillStyle = "#f00";
    ctx.fillRect(0, 0, 4, 4);
    const dataUrl = (canvas as HTMLCanvasElement).toDataURL?.();
    if (!dataUrl) return undefined;
    const gl = (canvas as HTMLCanvasElement).getContext?.("webgl") ?? (canvas as HTMLCanvasElement).getContext?.("experimental-webgl");
    if (!gl) return "unknown";
    const debugInfo = (gl as WebGLRenderingContext & { getExtension(name: string): unknown }).getExtension?.("WEBGL_debug_renderer_info");
    if (debugInfo) {
      const UNMASKED_RENDERER_WEBGL = 0x9246;
      const renderer = (gl as WebGLRenderingContext & { getParameter(p: number): string }).getParameter(UNMASKED_RENDERER_WEBGL);
      return typeof renderer === "string" ? renderer.slice(0, 256) : "unknown";
    }
    return "webgl";
  } catch {
    return undefined;
  }
}

/**
 * Collect fingerprint data. All access wrapped in try/catch.
 */
export function collectFingerprint(): DeviceFingerprint {
  const nav = typeof navigator !== "undefined" ? navigator : undefined;
  const screenObj = typeof screen !== "undefined" ? screen : undefined;

  const hardware = safe(() => ({
    hardwareConcurrency: nav?.hardwareConcurrency,
    deviceMemory: (nav as Navigator & { deviceMemory?: number })?.deviceMemory,
    screenWidth: screenObj?.width,
    screenHeight: screenObj?.height,
    colorDepth: screenObj?.colorDepth,
  }));

  const connection = safe(() => {
    const conn = (nav as Navigator & { connection?: { effectiveType?: string; downlink?: number; rtt?: number } })?.connection;
    if (!conn) return undefined;
    return {
      effectiveType: conn.effectiveType,
      downlink: conn.downlink,
      rtt: conn.rtt,
    };
  });

  const gpu = safe(() => getGpuRenderer());

  const timezone = safe(() => (typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : undefined));
  const localeOpts = safe(() => (typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions() : undefined));
  const locale = localeOpts ? `${(localeOpts as Intl.ResolvedDateTimeFormatOptions).locale ?? ""}` : undefined;
  const localeLanguage = nav?.language ?? undefined;

  return {
    hardware: hardware && Object.keys(hardware).length ? hardware : undefined,
    connection: connection && Object.keys(connection).length ? connection : undefined,
    gpu,
    timezone,
    locale,
    localeLanguage,
  };
}
