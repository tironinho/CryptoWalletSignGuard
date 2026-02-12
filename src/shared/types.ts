export type WalletKind = "EVM_INJECTED" | "SOLANA_INJECTED" | "UNKNOWN";
export type WalletName =
  | "MetaMask"
  | "Coinbase Wallet"
  | "Trust"
  | "Rabby"
  | "OKX Wallet"
  | "Binance Web3"
  | "Rainbow"
  | "Phantom"
  | "Phantom EVM"
  | "SafePal"
  | "Bitget Wallet"
  | "Brave Wallet"
  | "Taho"
  | "Ledger"
  | "Frame"
  | "MathWallet"
  | "Solflare"
  | "Backpack"
  | "Injected"
  | "EVM Wallet"
  | "Unknown";

export type WalletMeta = { id: string; name: string; iconHint?: string };

export type WalletBrand =
  | "MetaMask"
  | "Coinbase Wallet"
  | "Rabby"
  | "Trust Wallet"
  | "Brave Wallet"
  | "OKX Wallet"
  | "Binance Web3"
  | "Bitget Wallet"
  | "Phantom EVM"
  | "EVM Wallet";

export type WalletInfo = {
  kind: WalletKind;
  name: WalletName;
  flags?: Record<string, boolean>;
  walletBrand?: WalletBrand;
  /** Display name for overlay (e.g. "MetaMask", "EVM Wallet") */
  walletName?: string;
};

export type EthRequest = {
  method: string;
  params?: any[];
  // optional extra debugging/shape info from legacy provider entrypoints
  rawShape?: string;
  raw?: any;
};

export type PendingRequestPayload = {
  id: string;
  url: string;
  origin: string;
  wallet?: WalletInfo | WalletMeta;
  request: { method: string; params?: any[] };
  providerTag?: string;
  providerKey?: string;
  providerSource?: "window.ethereum" | "ethereum.providers[i]" | "eip6963";
};

export type AnalyzeRequest = {
  requestId: string;
  url: string;
  origin: string;
  request: EthRequest;
  tabId?: number;
  wallet?: WalletInfo;
  providerHint?: { kind: ProviderKind; name?: string };
  txCostPreview?: TxCostPreview;
  meta?: {
    chainId?: string;
    chainIdRequested?: string;
    preflight?: {
      tx?: any;
      valueWei?: string; // decimal
      valueEth?: string; // decimal
      gasEstimate?: string; // hex
      gasPrice?: string; // hex
      feeWeiEstimated?: string; // decimal
      feeEthEstimated?: string; // decimal
      totalEthEstimated?: string; // decimal
    }
  };
};

export type SecurityMode = "STRICT" | "BALANCED" | "RELAXED" | "OFF";
export type ProviderKind = "EIP6963" | "METAMASK" | "RABBY" | "COINBASE" | "PHANTOM" | "UNKNOWN";

export type ChainIdHex = string; // ex "0x1"
export type Address = string; // "0x..." lowercase

export type ThreatIntelAddress = {
  address: Address;
  chainId?: ChainIdHex;
  label: string;
  category: "DRAINER" | "SCAM_TOKEN" | "SCAM_ROUTER" | "MALICIOUS_SPENDER" | "UNKNOWN";
  sourceId: string;
  confidence: 1 | 2 | 3;
  updatedAt: number;
};

export type ThreatIntelBundle = {
  updatedAt: number;
  sources: Array<{ id: string; url?: string; ok: boolean; fetchedAt: number; error?: string }>;
  trustedDomainsSeed: string[];
  blockedDomains: string[];
  blockedAddresses: ThreatIntelAddress[];
};

export type AssetInfo = {
  chainId: ChainIdHex;
  address: Address;
  kind: "ERC20" | "ERC721" | "ERC1155" | "UNKNOWN";
  name?: string;
  symbol?: string;
  decimals?: number;
  fetchedAt: number;
};

export type DecodedAction =
  | { kind: "APPROVE_ERC20"; token: Address; spender: Address; amountType: "LIMITED" | "UNLIMITED"; amountRaw?: string }
  | { kind: "TRANSFER_ERC20"; token: Address; to: Address; amountRaw?: string }
  | { kind: "TRANSFERFROM_ERC20"; token: Address; from: Address; to: Address; amountRaw?: string }
  | { kind: "SET_APPROVAL_FOR_ALL"; token: Address; operator: Address; approved: boolean }
  | { kind: "TRANSFER_NFT"; token: Address; to: Address; from?: Address; tokenIdRaw?: string; amountRaw?: string; standard: "ERC721" | "ERC1155" | "UNKNOWN"; batch?: boolean }
  | { kind: "PERMIT_EIP2612"; token: Address; spender: Address; valueType: "LIMITED" | "UNLIMITED"; valueRaw?: string; deadlineRaw?: string }
  | { kind: "UNKNOWN"; selector?: string };

export type RiskLevel = "LOW" | "WARN" | "HIGH";

export type Recommend = "ALLOW" | "WARN" | "HIGH" | "BLOCK";

export type CheckKey =
  | "DOMAIN_INTEL"
  | "LOOKALIKE"
  | "TX_DECODE"
  | "FEE_ESTIMATE"
  | "ADDRESS_INTEL"
  | "ASSET_ENRICH"
  | "CLOUD_INTEL";

export type CheckStatus = "PASS" | "WARN" | "FAIL" | "SKIP";

export interface CheckResult {
  key: CheckKey;
  status: CheckStatus;
  noteKey?: string;
}

export type DecodedKind =
  | "APPROVE"
  | "SET_APPROVAL_FOR_ALL"
  | "TYPED_DATA"
  | "TX"
  | "CONNECT"
  | "SIGN";

export type Decoded = {
  kind: DecodedKind;
  tokenOrCollection?: string;
  spenderOrOperator?: string;
  amountHuman?: string;
  raw?: any;
};

export type TrustVerdict = "LIKELY_OFFICIAL" | "UNKNOWN" | "SUSPICIOUS";

export type TrustAnalysis = {
  verdict: TrustVerdict;
  trustScore: number; // 0-100
  reasons: string[];
  matchedAllowlistDomain?: string;
};

export type HumanExplanation = {
  methodTitle: string;
  methodShort: string;
  methodWhy: string;
  whatItDoes?: string[];
  siteSees?: string[];
  notHappen?: string[];
  whyAsked?: string[];
  risks: string[];
  safeNotes: string[];
  nextSteps: string[];
  recommendation: string;
  links?: Array<{ text: string; href: string }>;
};

export type ThreatIntel = {
  updatedAt: number;
  sources: Array<{ id: string; url: string; ok: boolean; fetchedAt: number; error?: string }>;
  trustedDomains: string[];
  blockedDomains: string[];
};

export type TxCostPreview = {
  valueWei: string;                 // decimal string
  feeEstimated: boolean;
  gasLimitWei?: string;             // decimal string (gasLimit as bigint)
  feeLikelyWei?: string;            // decimal string
  feeMaxWei?: string;               // decimal string
  totalLikelyWei?: string;          // decimal string
  totalMaxWei?: string;             // decimal string
  feeReasonKey?: string;            // i18n key when feeEstimated=false
};

export type TxSummary = {
  to?: string;
  valueWei?: string;        // decimal
  valueEth?: string;        // formatted
  selector?: string;        // 0x + 8 hex
  gasLimit?: string;        // decimal
  maxFeePerGasWei?: string; // decimal
  maxGasFeeEth?: string;    // ETH
  maxTotalEth?: string;     // ETH (value + maxGasFee)
  feeKnown?: boolean;
  contractNameHint?: string;
};

export type Intent = "NFT_PURCHASE" | "SWAP" | "APPROVAL" | "SEND" | "ETH_TRANSFER" | "TOKEN_TRANSFER" | "NFT_TRANSFER" | "CONTRACT_INTERACTION" | "CONNECT" | "SIGN" | "SIGNATURE" | "TYPED_DATA" | "CHAIN" | "SWITCH_CHAIN" | "ADD_CHAIN" | "WATCH_ASSET" | "SOLANA" | "UNKNOWN";

export type TxExtras =
  | {
      approvalType: "ERC20_APPROVE";
      tokenContract?: string;
      spender?: string;
      unlimited?: boolean;
    }
  | {
      approvalType: "NFT_SET_APPROVAL_FOR_ALL";
      tokenContract?: string;
      operator?: string;
      unlimited?: boolean;
    }
  | {
      approvalType?: "NFT_TRANSFER";
      tokenContract?: string;
      toAddress?: string;
    };

export type Analysis = {
  level: RiskLevel;
  score: number; // 0-100
  title: string;
  reasons: string[];
  decoded?: Decoded;
  decodedAction?: DecodedAction;
  recommend: Recommend;
  trust?: TrustAnalysis;
  human?: HumanExplanation;
  suggestedTrustedDomains?: string[];
  tx?: TxSummary;
  txCostPreview?: TxCostPreview;
  txExtras?: TxExtras;
  intent?: Intent;
  chainTarget?: { chainIdHex: string; chainName?: string };
  addChainInfo?: { chainId: string; chainName?: string; rpcUrls?: string[]; nativeCurrencySymbol?: string };
  watchAssetInfo?: { type: string; address?: string; symbol?: string; decimals?: number; image?: string };
  wallet?: WalletInfo;
  safeDomain?: boolean;
  isPhishing?: boolean;
  domainRisk?: { scoreDelta: number; reasons: string[] };
  addressRisk?: { flagged: boolean; reasons: string[]; matches?: string[] };
  method?: string;
  asset?: AssetInfo;
  flaggedAddress?: ThreatIntelAddress;
  provider?: { kind: ProviderKind; name?: string };
  feeGtValue?: boolean;
  /** Checks performed (security coverage). */
  checks?: CheckResult[];
  /** Coverage summary: performed/total, limited when some checks unavailable. */
  coverage?: { performed: number; total: number; limited: boolean };
  /** i18n key for main verdict label (e.g. verdict_ok, verdict_warn, verdict_high, verdict_block). */
  verdictLabelKey?: string;
  /** When tx.to is a contract (eth_getCode !== "0x"). */
  toIsContract?: boolean;
  /** Verification level: FULL = intel fresh, LOCAL = cached, BASIC = no intel. */
  verificationLevel?: "FULL" | "LOCAL" | "BASIC";
  /** Timestamp of cached intel used (if any). */
  verificationUpdatedAt?: number;
  /** true when domain trusted/allowlisted + no flags + no suspicious addr. */
  knownSafe?: boolean;
  /** true when phishing/lookalike HIGH + blacklist. */
  knownBad?: boolean;
  /** Domain-related signals, e.g. METAMASK_SEED, BLACKLIST_HIT, LOOKALIKE, PUNYCODE, SEED_MATCH, SUSPICIOUS_TLD. */
  domainSignals?: string[];
  /** Intel source ids used, e.g. metamask, cryptoscamdb, scamsniffer, local_seed. */
  intelSources?: string[];
  /** Extras from typed-data (e.g. Permit: spender, value, deadline). */
  typedDataExtras?: { spender?: string; value?: string; deadline?: string };
  /** true when any address (to/spender/operator/tokenContract) matched address intel labels. */
  addressIntelHit?: boolean;
  /** Labels per role when address intel hit (human-readable label strings). */
  addressIntel?: {
    to?: string[];
    spender?: string[];
    operator?: string[];
    tokenContract?: string[];
  };
  /** Result of Tenderly simulation (if run). */
  simulationOutcome?: {
    status: "SUCCESS" | "REVERT" | "RISK";
    outgoingAssets: Array<{ symbol: string; amount: string; logo?: string }>;
    incomingAssets: Array<{ symbol: string; amount: string; logo?: string }>;
    gasUsed: string;
  };
  /** True when simulation predicted revert (show "ESTA TRANSAÇÃO VAI FALHAR"). */
  simulationRevert?: boolean;
}

export type SupportedWalletEntry = { name: string; kind: string };

export type Settings = {
  riskWarnings: boolean;
  showConnectOverlay: boolean;
  blockHighRisk: boolean;
  requireTypedOverride?: boolean;
  allowOverrideOnPhishing?: boolean;
  debugMode?: boolean;
  domainChecks: boolean;
  allowlist: string[];
  trustedDomains?: string[];
  customBlockedDomains?: string[];
  customTrustedDomains?: string[];
  enableIntel?: boolean;
  mode?: SecurityMode;
  supportedWalletsInfo?: SupportedWalletEntry[];
  strictBlockApprovalsUnlimited?: boolean;
  strictBlockSetApprovalForAll?: boolean;
  strictBlockPermitLike?: boolean;
  assetEnrichmentEnabled?: boolean;
  addressIntelEnabled?: boolean;
  /** P0-E: Allow external checks (more protection; may send domain/address for validation). Default false. */
  cloudIntelOptIn?: boolean;
  showUsd?: boolean;
  planTier?: "FREE" | "PRO";
  licenseKey?: string;
  /** Cofre SignGuard: contracts that must not be transacted without explicit unlock. */
  vault?: {
    enabled: boolean;
    lockedContracts: string[];
  };
  /** Tenderly simulation (no hardcoded keys). */
  simulation?: {
    enabled: boolean;
    tenderlyAccount: string;
    tenderlyProject: string;
    tenderlyKey: string;
  };
};

export const SUPPORTED_WALLETS: SupportedWalletEntry[] = [
  { name: "MetaMask", kind: "EVM" },
  { name: "Coinbase Wallet", kind: "EVM" },
  { name: "Trust Wallet", kind: "EVM" },
  { name: "OKX Wallet", kind: "EVM" },
  { name: "Binance Web3", kind: "EVM" },
  { name: "Rabby", kind: "EVM" },
  { name: "Rainbow", kind: "EVM" },
  { name: "Phantom", kind: "EVM/Solana" },
  { name: "Brave Wallet", kind: "EVM" },
  { name: "Bitget Wallet", kind: "EVM" },
  { name: "MathWallet", kind: "EVM" },
  { name: "Solflare", kind: "Solana" },
  { name: "Backpack", kind: "Solana" },
];

export const DEFAULT_SETTINGS: Settings = {
  riskWarnings: true,
  showConnectOverlay: true,
  blockHighRisk: true,
  requireTypedOverride: true,
  allowOverrideOnPhishing: false,
  debugMode: false,
  domainChecks: true,
  mode: "BALANCED",
  strictBlockApprovalsUnlimited: true,
  strictBlockSetApprovalForAll: true,
  strictBlockPermitLike: true,
  assetEnrichmentEnabled: true,
  addressIntelEnabled: true,
  cloudIntelOptIn: false,
  showUsd: true,
  planTier: "FREE",
  licenseKey: "",
  trustedDomains: [
    "opensea.io",
    "blur.io",
    "app.uniswap.org",
    "uniswap.org",
    "looksrare.org",
    "x2y2.io",
    "etherscan.io",
    "arbitrum.io",
    "polygon.technology",
  ],
  supportedWalletsInfo: SUPPORTED_WALLETS,
  allowlist: [
    "opensea.io",
    "blur.io",
    "app.uniswap.org",
    "uniswap.org",
    "looksrare.org",
    "x2y2.io",
    "etherscan.io",
    "arbitrum.io",
    "polygon.technology",
  ],
  customBlockedDomains: [],
  customTrustedDomains: [],
  enableIntel: true,
  vault: {
    enabled: false,
    lockedContracts: [],
  },
  simulation: {
    enabled: false,
    tenderlyAccount: "",
    tenderlyProject: "",
    tenderlyKey: "",
  },
};

