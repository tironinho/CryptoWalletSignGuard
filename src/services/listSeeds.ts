/**
 * V2: Seed data for lists (trusted/blocked domains). Short bootstrap — external feeds cover volume.
 */

export const TRUSTED_DOMAINS_SEED: string[] = [
  // Wallets / infra
  "metamask.io",
  "metamask.com",
  "rabby.io",
  "rainbow.me",
  "walletconnect.com",
  "walletconnect.org",
  "phantom.app",
  "solana.com",
  "safe.global",
  "ledger.com",
  "trezor.io",
  // Explorers
  "etherscan.io",
  "etherscan.com",
  "polygonscan.com",
  "arbiscan.io",
  "optimistic.etherscan.io",
  "basescan.org",
  "bscscan.com",
  "snowtrace.io",
  // DEX / DeFi
  "app.uniswap.org",
  "uniswap.org",
  "1inch.io",
  "matcha.xyz",
  "paraswap.io",
  "cowswap.exchange",
  "sushi.com",
  "curve.fi",
  "aave.com",
  "app.aave.com",
  "compound.finance",
  "makerdao.com",
  "lido.fi",
  "rocketpool.net",
  "app.1inch.io",
  "balancer.fi",
  "sushiswap.fi",
  "pancakeswap.finance",
  "pancakeswap.com",
  // L2 / bridges
  "optimism.io",
  "base.org",
  "bridge.arbitrum.io",
  "across.to",
  "hop.exchange",
  "stargate.finance",
  "portalbridge.com",
  "zksync.io",
  "scroll.io",
  "lineascan.build",
  "bridge.base.org",
  "portal.polygon.technology",
  "arbitrum.io",
  "polygon.technology",
  "avax.network",
  "bnbchain.org",
  // NFT
  "opensea.io",
  "blur.io",
  "rarible.com",
  "magiceden.io",
  "looksrare.org",
  "x2y2.io",
  // Analytics
  "defillama.com",
  "dune.com",
  "debank.com",
  "zapper.xyz",
  "zerion.io",
  "coinmarketcap.com",
  "coingecko.com",
  "dexscreener.com",
  // Other crypto
  "ens.domains",
  "revoke.cash",
];

export const BLOCKED_DOMAINS_SEED: string[] = [
  // Minimal seed; feeds will add more
];
