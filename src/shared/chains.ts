/**
 * V2: Chain registry — native symbol and CoinGecko id for USD pricing.
 */

export type ChainInfo = {
  chainIdHex: string;
  name: string;
  nativeSymbol: string;
  coingeckoId: string;
  rpcUrls: string[];
};

const CHAINS: ChainInfo[] = [
  { chainIdHex: "0x1", name: "Ethereum", nativeSymbol: "ETH", coingeckoId: "ethereum", rpcUrls: ["https://eth.llamarpc.com"] },
  { chainIdHex: "0xa", name: "Optimism", nativeSymbol: "ETH", coingeckoId: "ethereum", rpcUrls: ["https://mainnet.optimism.io"] },
  { chainIdHex: "0xa4b1", name: "Arbitrum One", nativeSymbol: "ETH", coingeckoId: "ethereum", rpcUrls: ["https://arb1.arbitrum.io/rpc"] },
  { chainIdHex: "0x2105", name: "Base", nativeSymbol: "ETH", coingeckoId: "ethereum", rpcUrls: ["https://mainnet.base.org"] },
  { chainIdHex: "0x89", name: "Polygon", nativeSymbol: "MATIC", coingeckoId: "matic-network", rpcUrls: ["https://polygon-rpc.com"] },
  { chainIdHex: "0x38", name: "BNB Smart Chain", nativeSymbol: "BNB", coingeckoId: "binancecoin", rpcUrls: ["https://bsc-dataseed.binance.org"] },
  { chainIdHex: "0xa86a", name: "Avalanche C-Chain", nativeSymbol: "AVAX", coingeckoId: "avalanche-2", rpcUrls: ["https://api.avax.network/ext/bc/C/rpc"] },
  { chainIdHex: "0xfa", name: "Fantom", nativeSymbol: "FTM", coingeckoId: "fantom", rpcUrls: ["https://rpc.ftm.tools"] },
  { chainIdHex: "0x64", name: "Gnosis", nativeSymbol: "xDAI", coingeckoId: "xdai", rpcUrls: ["https://rpc.gnosischain.com"] },
  { chainIdHex: "0xa4ec", name: "Celo", nativeSymbol: "CELO", coingeckoId: "celo", rpcUrls: ["https://forno.celo.org"] },
  { chainIdHex: "0x82750", name: "Scroll", nativeSymbol: "ETH", coingeckoId: "ethereum", rpcUrls: ["https://rpc.scroll.io"] },
  { chainIdHex: "0xe708", name: "Linea", nativeSymbol: "ETH", coingeckoId: "ethereum", rpcUrls: ["https://rpc.linea.build"] },
  { chainIdHex: "0x144", name: "zkSync Era", nativeSymbol: "ETH", coingeckoId: "ethereum", rpcUrls: ["https://mainnet.era.zksync.io"] },
  { chainIdHex: "0x44d", name: "Polygon zkEVM", nativeSymbol: "ETH", coingeckoId: "ethereum", rpcUrls: ["https://zkevm-rpc.com"] },
];

const byChainId = new Map<string, ChainInfo>();
for (const c of CHAINS) {
  const id = c.chainIdHex.toLowerCase();
  byChainId.set(id, c);
  const num = id.startsWith("0x") ? id : "0x" + id;
  if (num !== id) byChainId.set(num, c);
}

export function getChainInfo(chainIdHex: string | undefined): ChainInfo | null {
  if (!chainIdHex) return null;
  const id = String(chainIdHex).toLowerCase();
  if (!id.startsWith("0x")) return byChainId.get("0x" + id) ?? null;
  return byChainId.get(id) ?? null;
}

export function getNativeSymbol(chainIdHex: string | undefined): string {
  const info = getChainInfo(chainIdHex);
  return info?.nativeSymbol ?? "ETH";
}

export function getAllChains(): ChainInfo[] {
  return [...CHAINS];
}
