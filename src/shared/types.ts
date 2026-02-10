export type EthRequest = {
  method: string;
  params?: any[];
  // optional extra debugging/shape info from legacy provider entrypoints
  rawShape?: string;
  raw?: any;
};

export type AnalyzeRequest = {
  requestId: string;
  url: string;
  origin: string;
  request: EthRequest;
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

export type RiskLevel = "LOW" | "WARN" | "HIGH";

export type Recommend = "ALLOW" | "WARN" | "BLOCK";

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

export type Analysis = {
  level: RiskLevel;
  score: number; // 0-100
  title: string;
  reasons: string[];
  decoded?: Decoded;
  recommend: Recommend;
  trust?: TrustAnalysis;
  human?: HumanExplanation;
  suggestedTrustedDomains?: string[];
};

export type Settings = {
  riskWarnings: boolean;
  showConnectOverlay: boolean;
  blockHighRisk: boolean;
  domainChecks: boolean;
  allowlist: string[];
  trustedDomains?: string[];
};

export const DEFAULT_SETTINGS: Settings = {
  riskWarnings: true,
  showConnectOverlay: true,
  blockHighRisk: true,
  domainChecks: true,
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
};

