const fallbackDict: Record<string, string> = {};

export function t(key: string, substitutions?: string | string[]): string {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const c: any = (globalThis as any).chrome;
    const msg = c?.i18n?.getMessage?.(key, substitutions);
    return msg || fallbackDict[key] || key;
  } catch {
    return fallbackDict[key] || key;
  }
}

