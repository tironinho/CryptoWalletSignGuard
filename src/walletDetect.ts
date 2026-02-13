import type { WalletBrand as SharedWalletBrand, WalletName } from "./shared/types";

export type WalletId =
  | "metamask"
  | "coinbase"
  | "trust"
  | "okx"
  | "binance"
  | "rabby"
  | "rainbow"
  | "phantom"
  | "brave"
  | "bitget"
  | "safepal"
  | "frame"
  | "unknown";

export type WalletBrand = SharedWalletBrand;

export type WalletMeta = { id: WalletId; name: string; iconHint?: string };

/** Returns display brand string for overlay. Prefers EIP-6963 info when available. Fallback: "EVM Wallet". */
export function detectWalletBrand(eth: any, eip6963Name?: string): WalletBrand {
  try {
    if (eip6963Name && typeof eip6963Name === "string" && eip6963Name.trim()) return eip6963Name.trim() as WalletBrand;
    if (!eth) return "EVM Wallet";
    if (eth?.isMetaMask === true) return "MetaMask";
    if (eth?.isCoinbaseWallet === true || (eth as any)?.providerMap?.coinbase) return "Coinbase Wallet";
    if (eth?.isRabby === true) return "Rabby";
    if (eth?.isTrust === true || eth?.isTrustWallet === true) return "Trust Wallet";
    if (eth?.isOkxWallet === true || eth?.isOKExWallet === true) return "OKX Wallet";
    if (eth?.isBinance === true || eth?.isBinanceWallet === true) return "Binance Web3";
    if (eth?.isPhantom === true) return "Phantom EVM";
    if (eth?.isBraveWallet === true) return "Brave Wallet";
    if (eth?.isBitget === true || eth?.isBitKeep === true) return "Bitget Wallet";
    if (eth?.isRainbow === true || eth?.isFrame === true || eth?.isSafePal === true || (eth as any)?.isTaho === true || (eth as any)?.isLedger === true) return "EVM Wallet";
    return "EVM Wallet";
  } catch {
    return "EVM Wallet";
  }
}

/** Detection order: first match wins. Compatible with multi-provider and EIP-6963. */
export function detectWalletFromProvider(p: any): WalletMeta {
  try {
    if (!p) return { id: "unknown", name: "Unknown" };

    if (p?.isMetaMask === true) return { id: "metamask", name: "MetaMask" };
    if (p?.isCoinbaseWallet === true || (p as any)?.providerMap?.coinbase) return { id: "coinbase", name: "Coinbase Wallet" };
    if (p?.isTrust === true || p?.isTrustWallet === true) return { id: "trust", name: "Trust Wallet" };
    if (p?.isOkxWallet === true || p?.isOKExWallet === true) return { id: "okx", name: "OKX Wallet" };
    if (p?.isBinance === true || p?.isBinanceWallet === true) return { id: "binance", name: "Binance Web3 Wallet" };
    if (p?.isRabby === true) return { id: "rabby", name: "Rabby" };
    if (p?.isRainbow === true) return { id: "rainbow", name: "Rainbow" };
    if (p?.isPhantom === true) return { id: "phantom", name: "Phantom" };
    if (p?.isBraveWallet === true) return { id: "brave", name: "Brave Wallet" };
    if (p?.isBitget === true || p?.isBitKeep === true) return { id: "bitget", name: "Bitget Wallet" };
    if (p?.isSafePal === true) return { id: "safepal", name: "SafePal" };
    if (p?.isFrame === true) return { id: "frame", name: "Frame" };
    if ((p as any)?.isTaho === true) return { id: "unknown", name: "Taho" };
    if ((p as any)?.isLedger === true) return { id: "unknown", name: "Ledger" };

    return { id: "unknown", name: "EIP-1193 Wallet" };
  } catch {
    return { id: "unknown", name: "Unknown" };
  }
}

import type { WalletInfo, WalletKind } from "./shared/types";

const ID_TO_NAME: Record<WalletId, WalletName> = {
  metamask: "MetaMask",
  coinbase: "Coinbase Wallet",
  trust: "Trust Wallet" as WalletName,
  okx: "OKX Wallet",
  binance: "Binance Web3",
  rabby: "Rabby",
  rainbow: "EVM Wallet",
  phantom: "Phantom EVM",
  brave: "Brave Wallet",
  bitget: "Bitget Wallet",
  safepal: "EVM Wallet",
  frame: "EVM Wallet",
  unknown: "EVM Wallet",
};

export function detectEvmWallet(provider: any, eip6963Name?: string): WalletInfo {
  const meta = detectWalletFromProvider(provider);
  const displayName = eip6963Name && eip6963Name.trim() ? eip6963Name.trim() : (ID_TO_NAME[meta.id] || meta.name || "EVM Wallet");
  return {
    kind: "EVM_INJECTED",
    name: displayName as WalletName,
    walletBrand: detectWalletBrand(provider, eip6963Name),
    walletName: displayName,
    flags: { [meta.id]: true },
  };
}

export function detectSolWallet(sol: any): WalletInfo {
  try {
    if (!sol) return { kind: "SOLANA_INJECTED", name: "Unknown", flags: {} };
    if (sol?.isPhantom) return { kind: "SOLANA_INJECTED", name: "Phantom", flags: { isPhantom: true } };
    if (sol?.isSolflare) return { kind: "SOLANA_INJECTED", name: "Solflare", flags: { isSolflare: true } };
    if (sol?.isBackpack) return { kind: "SOLANA_INJECTED", name: "Backpack", flags: { isBackpack: true } };
    return { kind: "SOLANA_INJECTED", name: "Injected", flags: {} };
  } catch {
    return { kind: "SOLANA_INJECTED", name: "Unknown", flags: {} };
  }
}

export function listEvmProviders(): any[] {
  try {
    const eth = (typeof window !== "undefined" ? (window as any)?.ethereum : null) as any;
    const arr: any[] = [];
    if (eth) arr.push(eth);
    if (eth?.providers && Array.isArray(eth.providers)) {
      for (const p of eth.providers) {
        if (p && !arr.includes(p)) arr.push(p);
      }
    }
    return Array.from(new Set(arr));
  } catch {
    return [];
  }
}
