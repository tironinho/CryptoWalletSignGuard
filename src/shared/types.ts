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

/** P0 UI Gate: meta sent with SG_DECISION to ensure wallet is only forwarded after user confirmed in overlay. */
export type DecisionMeta = {
  uiConfirmed?: boolean;
  uiGate?: boolean;
  reasonKeys?: string[];
  method?: string;
};

export type FeeEstimateWire = {
  ok: boolean;
  gasLimitHex?: string;
  feeLikelyWeiHex?: string;
  feeMaxWeiHex?: string;
  feeEstimated?: boolean;
  feeReasonKey?: string;
  error?: string;
};

export type TxContextKind = "SWITCH_NETWORK" | "NFT_PURCHASE" | "TOKEN_SWAP" | "VALUE_TRANSFER" | "CONTRACT_CALL" | "APPROVAL";

export type AnalyzeRequest = {
  requestId: string;
  url: string;
  origin: string;
  request: EthRequest;
  tabId?: number;
  wallet?: WalletInfo;
  providerHint?: { kind: ProviderKind; name?: string };
  txCostPreview?: TxCostPreview;
  feeEstimate?: FeeEstimateWire;
  meta?: {
    chainId?: string;
    chainIdHex?: string;
    chainIdRequested?: string;
    txContext?: { kind: TxContextKind };
    pageRisk?: { score: "LOW" | "MEDIUM" | "HIGH"; reasons: string[] };
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

/** Domain list decision for risk/UX (whitelist never auto-allows tx). */
export type DomainDecision = "TRUSTED" | "BLOCKED" | "UNKNOWN";

/** Cache key for scam token: chainId:tokenAddressLower */
export type ScamTokenKey = `${string}:${string}`;

export type ListSourceName = "metamask" | "scamsniffer" | "cryptoscamdb" | "dappradar" | "mew" | "seed" | "user";

export type ListsCacheV1 = {
  version: 1;
  updatedAt: number;
  sources: Record<ListSourceName, { updatedAt?: number; etag?: string; ok?: boolean; error?: string }>;
  trustedDomains: string[];
  blockedDomains: string[];
  blockedAddresses: string[];
  scamTokens: Array<{ chainId: string; address: string; symbol?: string; name?: string; source?: ListSourceName }>;
  userTrustedDomains: string[];
  userBlockedDomains: string[];
  userBlockedAddresses: string[];
  userScamTokens: Array<{ chainId: string; address: string; symbol?: string; name?: string }>;
  userTrustedTokens: Array<{ chainId: string; address: string }>;
};

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

export type DecodedAction = (
  | { kind: "APPROVE_ERC20"; token: Address; spender: Address; amountType: "LIMITED" | "UNLIMITED"; amountRaw?: string }
  | { kind: "INCREASE_ALLOWANCE"; token: Address; spender: Address; amountType: "LIMITED" | "UNLIMITED"; amountRaw?: string }
  | { kind: "DECREASE_ALLOWANCE"; token: Address; spender: Address; amountRaw?: string }
  | { kind: "TRANSFER_ERC20"; token: Address; to: Address; amountRaw?: string }
  | { kind: "TRANSFERFROM_ERC20"; token: Address; from: Address; to: Address; amountRaw?: string }
  | { kind: "SET_APPROVAL_FOR_ALL"; token: Address; operator: Address; approved: boolean }
  | { kind: "TRANSFER_NFT"; token: Address; to: Address; from?: Address; tokenIdRaw?: string; amountRaw?: string; standard: "ERC721" | "ERC1155" | "UNKNOWN"; batch?: boolean }
  | { kind: "PERMIT_EIP2612"; token: Address; spender: Address; valueType: "LIMITED" | "UNLIMITED"; valueRaw?: string; deadlineRaw?: string }
  | { kind: "PERMIT2_ALLOWANCE"; token: Address; spender: Address; amountType: "LIMITED" | "UNLIMITED"; amountRaw?: string; deadlineRaw?: string }
  | { kind: "PERMIT2_TRANSFER"; token: Address; to: Address; amountType: "LIMITED" | "UNLIMITED"; amountRaw?: string }
  | { kind: "UNKNOWN"; selector?: string }
  | { kind: "MULTICALL"; selector: string; raw?: string }
  )
  & { permit2?: boolean; marketplaceHint?: string };

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
  safe?: string[];
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
  /** USD per 1 unit of native token (for overlay). */
  usdPerNative?: number;
};

export type TxSummary = {
  to?: string;
  valueWei?: string;        // decimal
  valueEth?: string;        // formatted
  selector?: string;        // 0x + 8 hex
  gasLimit?: string;        // decimal
  maxFeePerGasWei?: string; // decimal
  maxPriorityFeePerGasWei?: string; // decimal (EIP-1559 tip)
  maxGasFeeEth?: string;    // ETH
  maxTotalEth?: string;     // ETH (value + maxGasFee)
  feeKnown?: boolean;
  contractNameHint?: string;
  dataLen?: number;         // raw data length
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

/** P1: Transaction summary v1 for overlay (give/get, approvals, nfts, flags). */
export type TxSummaryV1 = {
  title: string;
  subtitle?: string;
  give?: Array<{ amount?: string; symbol?: string; kind: "NATIVE" | "ERC20" | "NFT" | "UNKNOWN"; tokenAddress?: string; tokenId?: string; to?: string }>;
  get?: Array<{ amount?: string; symbol?: string; kind: "NATIVE" | "ERC20" | "NFT" | "UNKNOWN"; tokenAddress?: string; tokenId?: string; to?: string }>;
  approvals?: Array<{ kind: "ERC20" | "ERC721_ALL" | "ERC1155_ALL" | "PERMIT" | "PERMIT2"; tokenAddress?: string; tokenSymbol?: string; spender?: string; amount?: string; unlimited?: boolean; deadline?: string }>;
  nfts?: Array<{ collection?: string; tokenAddress?: string; tokenId?: string; amount?: string; to?: string; marketplace?: string }>;
  flags?: string[]; // reasonKeys
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
  txContext?: { kind: TxContextKind };
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
  /** Spender matched denylistSpenders → BLOCK. */
  matchedDenySpender?: boolean;
  /** Spender matched allowlistSpenders → reduce score. */
  matchedAllowSpender?: boolean;
  /** Domain-related signals, e.g. METAMASK_SEED, BLACKLIST_HIT, LOOKALIKE, PUNYCODE, SEED_MATCH, SUSPICIOUS_TLD. */
  domainSignals?: string[];
  /** Intel source ids used, e.g. metamask, cryptoscamdb, scamsniffer, local_seed. */
  intelSources?: string[];
  /** List manager domain decision: TRUSTED / BLOCKED / UNKNOWN (for site reputation badge). */
  domainListDecision?: DomainDecision;
  /** Extras from typed-data (e.g. Permit: spender, value, deadline). */
  typedDataExtras?: { spender?: string; value?: string; deadline?: string };
  /** Structured decode for Permit2 / Seaport / Blur typed data (human overlay). */
  typedDataDecoded?: {
    permit2?: { spender: string; tokens: string[]; amounts: string[]; unlimited?: boolean; sigDeadline?: string };
    seaport?: { offerSummary: string; considerationSummary: string; primaryType?: string };
    isBlur?: boolean;
  };
  /** true when any address (to/spender/operator/tokenContract) matched address intel labels. */
  addressIntelHit?: boolean;
  /** Labels per role when address intel hit (human-readable label strings). */
  addressIntel?: {
    to?: string[];
    spender?: string[];
    operator?: string[];
    tokenContract?: string[];
  };
  /** Result of Tenderly simulation (if run). SKIPPED when API failed (fallback). */
  simulationOutcome?: {
    status: "SUCCESS" | "REVERT" | "RISK" | "SKIPPED";
    outgoingAssets: Array<{ symbol: string; amount: string; logo?: string }>;
    incomingAssets: Array<{ symbol: string; amount: string; logo?: string }>;
    approvals?: Array<{ token: string; spender: string; approved: boolean; unlimited?: boolean; approvalForAll?: boolean }>;
    gasUsed: string;
    fallback?: boolean;
    gasCostWei?: string;
    isHighGas?: boolean;
    simulated?: boolean;
    message?: string;
  };
  /** True when simulation predicted revert (show "ESTA TRANSAÇÃO VAI FALHAR"). */
  simulationRevert?: boolean;
  /** Token confidence: SCAM, TRUSTED, LOW (new/unverified), UNKNOWN. */
  tokenConfidence?: "SCAM" | "TRUSTED" | "LOW" | "UNKNOWN";
  /** First-seen timestamp for token (when LOW/UNKNOWN). */
  tokenFirstSeenAt?: number;
  /** True when honeypot detected (buy but cannot sell / transfer). */
  isHoneypot?: boolean;
  /** True when protection is temporarily paused (allow without showing overlay). */
  protectionPaused?: boolean;
  /** True when vault blocks this request (Cofre). */
  vaultBlocked?: boolean;
  /** Locked contract address when vaultBlocked. */
  vaultLockedTo?: string;
  /** ChainId for vault override (VAULT_UNLOCK). */
  vaultChainIdHex?: string;
  /** Standardized reason keys for consistency (maps to i18n). */
  reasonKeys?: string[];
  /** P1: Structured summary for overlay (title, give/get, approvals, nfts, flags). */
  summary?: TxSummaryV1;
  /** P1: Alias for summary (spec name summaryV1). */
  summaryV1?: TxSummaryV1;
}

export type SupportedWalletEntry = { name: string; kind: string };

/** User-configurable settings (spec name: UserSettings). */
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
  /** P0-C: User allow/deny by spender address (for approvals). */
  allowlistSpenders?: string[];
  denylistSpenders?: string[];
  /** fail_open: allow when runtime unavailable; fail_closed: block on high risk. */
  failMode?: "fail_open" | "fail_closed";
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
  /** Telemetry/analytics opt-in. Default false. Requires termsAccepted. Independent of cloudIntelOptIn. */
  telemetryOptIn?: boolean;
  /** @deprecated Use telemetryOptIn. Kept for migration. */
  telemetryEnabled?: boolean;
  showUsd?: boolean;
  planTier?: "FREE" | "PRO";
  licenseKey?: string;
  /** Cofre SignGuard: contracts that must not be transacted without explicit unlock. */
  vault?: {
    enabled: boolean;
    lockedContracts: string[];
    /** Timestamp until which vault is temporarily unlocked (Date.now() + ms). */
    unlockedUntil?: number;
    /** Also block approvals/permits when spender is in lockedContracts. */
    blockApprovals?: boolean;
  };
  /** Tenderly simulation (no hardcoded keys). */
  simulation?: {
    enabled: boolean;
    tenderlyAccount: string;
    tenderlyProject: string;
    tenderlyKey: string;
  };
  /** Pause protection until this timestamp (Date.now() + ms). */
  pausedUntil?: number;
  /** Domains that bypass overlay when protection is active (e.g. trusted tools). */
  whitelistedDomains?: string[];
  /** Modo Fortaleza: bloqueia todas as aprovações de tokens exceto em sites confiáveis. */
  fortressMode?: boolean;
  /** Expandir seções detalhadas (accordions) do overlay por padrão. */
  defaultExpandDetails?: boolean;
};

/** Alias for Settings (spec: UserSettings). */
export type UserSettings = Settings;

/** Stored in chrome.storage.local key "sg_plan". */
export type PlanState = {
  tier: "FREE" | "PRO";
  keyMasked?: string;
  activatedAt?: number;
  expiresAt?: number;
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

import { CRYPTO_TRUSTED_DOMAINS_SEED } from "../lists/cryptoTrustedDomainsSeed";

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
  telemetryOptIn: false,
  telemetryEnabled: false,
  showUsd: false,
  defaultExpandDetails: true,
  planTier: "FREE",
  licenseKey: "",
  trustedDomains: CRYPTO_TRUSTED_DOMAINS_SEED.slice(0, 24),
  supportedWalletsInfo: SUPPORTED_WALLETS,
  allowlist: CRYPTO_TRUSTED_DOMAINS_SEED.slice(0, 24),
  customBlockedDomains: [],
  customTrustedDomains: [],
  allowlistSpenders: [],
  denylistSpenders: [],
  failMode: "fail_open",
  enableIntel: true,
  vault: {
    enabled: false,
    lockedContracts: [],
    unlockedUntil: 0,
    blockApprovals: false,
  },
  simulation: {
    enabled: false,
    tenderlyAccount: "",
    tenderlyProject: "",
    tenderlyKey: "",
  },
  whitelistedDomains: [],
  fortressMode: false,
};

