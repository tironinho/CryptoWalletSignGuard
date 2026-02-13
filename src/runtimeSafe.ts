/**
 * Centralized runtime/storage wrappers to avoid "Cannot read properties of undefined"
 * and "Extension context invalidated" errors. Use in content and options scripts only.
 * Uses Port (long-lived) to reduce runtime.lastError / SW sleeping issues.
 */

let _port: chrome.runtime.Port | null = null;

/** Safe check: avoid crash when context invalidated. Use globalThis.chrome when available. */
export function canUseRuntime(): boolean {
  try {
    const c = (typeof globalThis !== "undefined" ? (globalThis as any).chrome : undefined) ?? (typeof chrome !== "undefined" ? chrome : undefined);
    return !!(c?.runtime?.id && typeof c.runtime.sendMessage === "function");
  } catch {
    return false;
  }
}

export function isRuntimeUsable(): boolean {
  try {
    return canUseRuntime();
  } catch {
    return false;
  }
}

const CONTEXT_INVALID_TERMS = [
  "extension context invalidated",
  "context invalidated",
  "message port closed",
  "receiving end does not exist",
  "runtime.lastError",
];

function isContextInvalidError(e: unknown): boolean {
  const msg = String((e as Error)?.message ?? e ?? "").toLowerCase();
  return CONTEXT_INVALID_TERMS.some((t) => msg.includes(t));
}

function getPort(): chrome.runtime.Port | null {
  try {
    const c = (typeof globalThis !== "undefined" ? (globalThis as any).chrome : undefined) ?? (typeof chrome !== "undefined" ? chrome : undefined);
    if (!canUseRuntime() || !c?.runtime?.connect) return null;
    if (_port) return _port;
    _port = c.runtime.connect({ name: "sg_port" });
    _port.onDisconnect.addListener(() => {
      _port = null;
      _portListenerInit = false;
    });
    return _port;
  } catch {
    _port = null;
    return null;
  }
}

const _portPending = new Map<string, (r: any) => void>();
let _portListenerInit = false;

function initPortListener() {
  const p = getPort();
  if (!p || _portListenerInit) return;
  _portListenerInit = true;
  p.onMessage.addListener((resp: any) => {
    const cb = resp?.requestId != null ? _portPending.get(String(resp.requestId)) : undefined;
    if (cb) {
      _portPending.delete(String(resp.requestId));
      try { cb(resp); } catch {}
    }
  });
}

/** Port-based request (preferred over sendMessage to avoid runtime.lastError). Sends PING via sendMessage first if port not yet connected (wakes SW). */
export function portRequest<T = any>(msg: unknown, timeoutMs = 2500): Promise<T | null> {
  return new Promise((resolve) => {
    (async () => {
      try {
        if (!_port) {
          try {
            await new Promise<void>((r) => {
              const c = (typeof globalThis !== "undefined" ? (globalThis as any).chrome : undefined) ?? (typeof chrome !== "undefined" ? chrome : undefined);
              if (!c?.runtime?.sendMessage) return r();
              c.runtime.sendMessage({ type: "PING" }, () => {
                r();
              });
              setTimeout(() => r(), 600);
            });
          } catch {
            // ignore
          }
        }
        const p = getPort();
        if (!p) {
          resolve(null);
          return;
        }
        initPortListener();
        const requestId = typeof crypto?.randomUUID === "function" ? crypto.randomUUID() : `sg_${Date.now()}_${Math.random().toString(36).slice(2)}`;
        const payload = { ...(msg as object), requestId };

        const timer = setTimeout(() => {
          if (_portPending.has(requestId)) {
            _portPending.delete(requestId);
            resolve(null);
          }
        }, timeoutMs);

        _portPending.set(requestId, (resp: any) => {
          clearTimeout(timer);
          resolve(resp != null ? (resp as T) : null);
        });

        try {
          p.postMessage(payload);
        } catch (e) {
          clearTimeout(timer);
          _portPending.delete(requestId);
          resolve(null);
        }
      } catch {
        resolve(null);
      }
    })();
  });
}

const DEFAULT_SEND_MS = 4000;
const RETRY_SEND_MS = 2500;
const LOG_PREFIX = "[SignGuard]";

export type SafeSendMessageOptions = {
  timeoutMs?: number;
  preferPort?: boolean;
};

function sendMessageOneAttempt<T>(msg: unknown, timeoutMs: number): Promise<T | null> {
  return new Promise((resolve) => {
    let settled = false;
    const once = (value: T | null) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };

    const c = (typeof globalThis !== "undefined" ? (globalThis as any).chrome : undefined) ?? (typeof chrome !== "undefined" ? chrome : undefined);
    const rt = (() => {
      try {
        return c?.runtime ?? null;
      } catch {
        return null;
      }
    })();
    if (!rt || !rt.id || typeof rt.sendMessage !== "function") {
      once(null);
      return;
    }

    const timer = setTimeout(() => {
      once(null);
    }, timeoutMs);

    try {
      rt.sendMessage(msg, (resp: T) => {
        if (settled) return;
        clearTimeout(timer);
        try {
          const err = (c?.runtime as any)?.lastError;
          if (err) {
            once(null);
            return;
          }
          once(resp ?? null);
        } catch {
          once(null);
        }
      });
    } catch (e) {
      clearTimeout(timer);
      // Production: no console.warn; keep only console.error in critical catch blocks
      once(null);
    }
  });
}

export function safeSendMessage<T = any>(msg: unknown, options?: number | SafeSendMessageOptions): Promise<T | null> {
  const timeoutMs = typeof options === "number" ? options : (options?.timeoutMs ?? DEFAULT_SEND_MS);
  const preferPort = typeof options === "object" && options?.preferPort === true;

  if (preferPort) {
    return portRequest<T>(msg, timeoutMs).then((r) => {
      if (r != null && (r as any)?.ok !== false) return r as T;
      return sendMessageOneAttempt<T>(msg, timeoutMs).then((res) => {
        if (res != null) return res;
        return sendMessageOneAttempt<T>(msg, RETRY_SEND_MS);
      });
    });
  }

  return sendMessageOneAttempt<T>(msg, timeoutMs).then((r) => {
    if (r != null) return r;
    return sendMessageOneAttempt<T>(msg, RETRY_SEND_MS);
  });
}

export type StorageResult<T> = { ok: true; data: T } | { ok: false; error: string };

export async function safeStorageGet<T = any>(keys: unknown): Promise<StorageResult<T>> {
  return new Promise((resolve) => {
    try {
      if (!isRuntimeUsable() || !chrome?.storage?.sync) {
        resolve({ ok: false, error: "storage_unavailable" });
        return;
      }
      chrome.storage.sync.get(keys, (items: T) => {
        try {
          const err = chrome.runtime.lastError;
          if (err) {
            resolve({ ok: false, error: err.message || String(err) });
            return;
          }
          resolve({ ok: true, data: items });
        } catch (e) {
          resolve({ ok: false, error: (e as Error)?.message || String(e) });
        }
      });
    } catch (e) {
      resolve({ ok: false, error: (e as Error)?.message || String(e) });
    }
  });
}

export async function safeStorageSet(obj: Record<string, unknown>): Promise<StorageResult<true>> {
  return new Promise((resolve) => {
    try {
      if (!isRuntimeUsable() || !chrome?.storage?.sync) {
        resolve({ ok: false, error: "storage_unavailable" });
        return;
      }
      chrome.storage.sync.set(obj, () => {
        try {
          const err = chrome.runtime.lastError;
          if (err) {
            resolve({ ok: false, error: err.message || String(err) });
            return;
          }
          resolve({ ok: true, data: true });
        } catch (e) {
          resolve({ ok: false, error: (e as Error)?.message || String(e) });
        }
      });
    } catch (e) {
      resolve({ ok: false, error: (e as Error)?.message || String(e) });
    }
  });
}

export async function safeLocalGet<T = any>(key: string): Promise<T | null> {
  return new Promise((resolve) => {
    try {
      if (!isRuntimeUsable() || !chrome?.storage?.local) {
        resolve(null);
        return;
      }
      chrome.storage.local.get(key, (r: Record<string, T>) => {
        try {
          const err = chrome.runtime.lastError;
          if (err) {
            resolve(null);
            return;
          }
          resolve(((r as any)?.[key] as T) ?? null);
        } catch {
          resolve(null);
        }
      });
    } catch {
      resolve(null);
    }
  });
}

export async function safeLocalSet(obj: Record<string, unknown>): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      if (!isRuntimeUsable() || !chrome?.storage?.local) {
        resolve(false);
        return;
      }
      chrome.storage.local.set(obj, () => {
        try {
          const err = chrome.runtime.lastError;
          resolve(!err);
        } catch {
          resolve(false);
        }
      });
    } catch {
      resolve(false);
    }
  });
}

/** Safe getURL - returns empty string if runtime unusable */
export function safeGetURL(path: string): string {
  try {
    if (!isRuntimeUsable() || !chrome.runtime.getURL) return "";
    return chrome.runtime.getURL(path);
  } catch {
    return "";
  }
}
