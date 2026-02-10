import type { AnalyzeRequest, Analysis, Settings, ThreatIntel, TxSummary } from "./shared/types";
import { DEFAULT_SETTINGS } from "./shared/types";
import { decodeErc20Approve, decodeSetApprovalForAll } from "./shared/decode";
import { hostFromUrl, isAllowlisted, hexSelector, isHexString } from "./shared/utils";
import { t } from "./i18n";
import { computeTrustVerdict } from "./shared/trust";
import { buildHumanLists, explainMethod } from "./shared/explain";
import { SUGGESTED_TRUSTED_DOMAINS as SUGGESTED_TRUSTED_DOMAINS_SHARED } from "./shared/constants";
import { fetchThreatIntel, hostMatchesDomain, normalizeHost, TRUSTED_DOMAINS_SEED } from "./intel";

export const SUGGESTED_TRUSTED_DOMAINS = SUGGESTED_TRUSTED_DOMAINS_SHARED;

const INTEL_KEY = "sg_threat_intel";
const INTEL_TTL_MS = 24 * 60 * 60 * 1000;

async function loadIntel(): Promise<ThreatIntel | null> {
  return await new Promise((resolve) => {
    try {
      chrome.storage.local.get([INTEL_KEY], (r) => {
        const err = chrome.runtime.lastError;
        if (err) return resolve(null);
        resolve((r as any)?.[INTEL_KEY] ?? null);
      });
    } catch {
      resolve(null);
    }
  });
}

async function saveIntel(intel: ThreatIntel) {
  await new Promise<void>((resolve) => {
    try {
      chrome.storage.local.set({ [INTEL_KEY]: intel }, () => resolve());
    } catch {
      resolve();
    }
  });
}

async function getIntelFresh(): Promise<ThreatIntel> {
  try {
    const cached = await loadIntel();
    if (cached && Date.now() - cached.updatedAt < INTEL_TTL_MS) return cached;
    const fresh = await fetchThreatIntel();
    await saveIntel(fresh);
    return fresh;
  } catch {
    const now = Date.now();
    return {
      updatedAt: now,
      sources: [{ id: "fallback", url: "", ok: false, fetchedAt: now, error: "intel_unavailable" }],
      trustedDomains: TRUSTED_DOMAINS_SEED.map((x) => normalizeHost(x.domain)),
      blockedDomains: [],
    };
  }
}

async function updateIntelNow(): Promise<ThreatIntel> {
  const fresh = await fetchThreatIntel();
  await saveIntel(fresh);
  return fresh;
}

try {
  chrome.runtime.onInstalled.addListener(async () => {
    try { await updateIntelNow(); } catch {}
    try { chrome.alarms.create("sg_intel_daily", { periodInMinutes: 24 * 60 }); } catch {}
  });
} catch {}

try {
  chrome.alarms.onAlarm.addListener(async (a) => {
    if (a.name !== "sg_intel_daily") return;
    try { await updateIntelNow(); } catch {}
  });
} catch {}

let __ethUsdCache: { usdPerEth: number; fetchedAt: number } | null = null;

async function getEthUsdPriceCached(): Promise<number | null> {
  const now = Date.now();
  if (__ethUsdCache && (now - __ethUsdCache.fetchedAt) < 60_000) return __ethUsdCache.usdPerEth;

  try {
    const resp = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd", {
      method: "GET",
      headers: { "accept": "application/json" },
    });
    if (!resp.ok) return null;
    const j: any = await resp.json();
    const usd = Number(j?.ethereum?.usd);
    if (!Number.isFinite(usd) || usd <= 0) return null;
    __ethUsdCache = { usdPerEth: usd, fetchedAt: now };
    return usd;
  } catch {
    return null;
  }
}

async function getSettings(): Promise<Settings> {
  return await new Promise((resolve) => {
    try {
      chrome.storage.sync.get(DEFAULT_SETTINGS, (got) => {
        const err = chrome.runtime.lastError;
        if (err) return resolve(DEFAULT_SETTINGS);
        resolve(got as Settings);
      });
    } catch {
      resolve(DEFAULT_SETTINGS);
    }
  });
}

function domainHeuristicsLocalized(host: string): { level: "LOW" | "WARN"; reasons: string[] } {
  const h = (host || "").toLowerCase();
  const reasons: string[] = [];
  if (!h) return { level: "LOW", reasons };

  if (h.startsWith("xn--") || h.includes(".xn--")) reasons.push(t("domainPunycodeReason"));
  if (h.includes("--")) reasons.push(t("domainDoubleDashReason"));
  if (/\d{2,}/.test(h)) reasons.push(t("domainNumberPatternReason"));

  const suspects = [
    { legit: "uniswap.org", typos: ["uniswa", "un1swap", "unlswap", "uniswap-app"] },
    { legit: "opensea.io", typos: ["opensea-", "open-sea", "0pensea"] },
  ];
  for (const s of suspects) {
    if (s.typos.some((tt) => h.includes(tt))) reasons.push(t("domainLookalikeReason", s.legit));
  }

  return { level: reasons.length ? "WARN" : "LOW", reasons };
}

function hexToBigInt(hex?: string): bigint | null {
  if (!hex) return null;
  try {
    const h = String(hex).startsWith("0x") ? String(hex) : "0x" + String(hex);
    return BigInt(h);
  } catch { return null; }
}

function weiToEthString(wei: bigint, decimals = 6): string {
  // 1 ETH = 1e18 wei
  const base = 10n ** 18n;
  const whole = wei / base;
  const frac = wei % base;
  const fracStr = frac.toString().padStart(18, "0").slice(0, decimals);
  return `${whole.toString()}.${fracStr}`.replace(/\.?0+$/, (m) => (m.startsWith(".") ? "" : m));
}

function buildTxSummary(method: string, params: any[] | undefined): TxSummary | undefined {
  if (method !== "eth_sendtransaction") return undefined;
  const tx = params?.[0];
  if (!tx || typeof tx !== "object") return undefined;

  const to = typeof (tx as any).to === "string" ? (tx as any).to : undefined;

  const valueWeiBI = hexToBigInt((tx as any).value);
  const gasLimitBI = hexToBigInt((tx as any).gas ?? (tx as any).gasLimit);
  const maxFeePerGasBI = hexToBigInt((tx as any).maxFeePerGas);

  const valueWei = valueWeiBI ? valueWeiBI.toString(10) : undefined;
  const valueEth = valueWeiBI ? weiToEthString(valueWeiBI) : undefined;

  const selector =
    typeof (tx as any).data === "string" && (tx as any).data.startsWith("0x") && (tx as any).data.length >= 10
      ? (tx as any).data.slice(0, 10)
      : undefined;

  let maxGasFeeEth: string | undefined;
  if (gasLimitBI && maxFeePerGasBI) {
    const maxGasFeeWei = gasLimitBI * maxFeePerGasBI;
    maxGasFeeEth = weiToEthString(maxGasFeeWei);
  }

  let maxTotalEth: string | undefined;
  if (valueWeiBI && gasLimitBI && maxFeePerGasBI) {
    const maxGasFeeWei = gasLimitBI * maxFeePerGasBI;
    maxTotalEth = weiToEthString(valueWeiBI + maxGasFeeWei);
  }

  return {
    to,
    valueWei,
    valueEth,
    selector,
    gasLimit: gasLimitBI ? gasLimitBI.toString(10) : undefined,
    maxFeePerGasWei: maxFeePerGasBI ? maxFeePerGasBI.toString(10) : undefined,
    maxGasFeeEth,
    maxTotalEth,
  };
}

function chainName(chainIdHex: string): string | undefined {
  const id = String(chainIdHex || "").toLowerCase();
  const map: Record<string, string> = {
    "0x1": "Ethereum Mainnet",
    "0x89": "Polygon",
    "0xa4b1": "Arbitrum One",
    "0xa": "Optimism",
    "0x38": "BNB Chain (BSC)",
    "0xa86a": "Avalanche C-Chain",
  };
  return map[id];
}

function analyze(req: AnalyzeRequest, settings: Settings, intel: ThreatIntel | null): Analysis {
  const host = hostFromUrl(req.url);
  const reasons: string[] = [];
  let level: Analysis["level"] = "LOW";
  let score = 0;
  let title = "Looks OK";

  const trust = computeTrustVerdict(host, settings.allowlist);
  const explain = explainMethod(req.request?.method || "");
  const lists = buildHumanLists(req.request?.method || "", trust.verdict);

  // Domain checks (optional)
  if (settings.domainChecks && host && !isAllowlisted(host, settings.allowlist)) {
    const d = domainHeuristicsLocalized(host);
    if (d.level === "WARN") {
      reasons.push(...d.reasons);
      level = "WARN";
      score = Math.max(score, 45);
      title = t("suspiciousWebsitePatterns");
    }
  }

  const method = (req.request?.method || "").toLowerCase();

  // Threat intel (blocked/trusted seed)
  try {
    const h = normalizeHost(host || "");
    const isBlocked = !!intel?.blockedDomains?.some((d) => hostMatchesDomain(h, d));
    const isTrustedSeed = !!intel?.trustedDomains?.some((d) => hostMatchesDomain(h, d));

    if (isBlocked) {
      reasons.push("Domínio está em blacklist de phishing.");
      level = "HIGH";
      score = Math.max(score, 95);
      title = t("suspiciousWebsitePatterns");
    } else if (isTrustedSeed) {
      reasons.push("Domínio está na lista seed de sites oficiais conhecidos.");
      score = Math.max(0, score - 15);
    }
  } catch {}

  // Connect / permissions
  if (method === "eth_requestaccounts" || method === "wallet_requestpermissions") {
    const isPerms = method === "wallet_requestpermissions";
    const baseTitle = isPerms ? t("walletRequestPermissionsTitle") : t("connectTitle");
    const baseReason = isPerms ? t("walletRequestPermissionsReason") : t("connectReason");
    const connectReasons = reasons.length ? reasons.slice() : [baseReason];
    if (settings.showConnectOverlay) {
      // SPEC: if showConnectOverlay=true -> WARN (score >= 30)
      return {
        level: "WARN",
        score: Math.max(score, 30),
        title: level === "WARN" ? title : baseTitle,
        reasons: connectReasons,
        decoded: { kind: "CONNECT", raw: { host } },
        recommend: "WARN",
        trust,
        suggestedTrustedDomains: [...SUGGESTED_TRUSTED_DOMAINS],
        human: {
          methodTitle: explain.title,
          methodShort: explain.short,
          methodWhy: explain.why,
          whatItDoes: lists.whatItDoes,
          siteSees: [t("human_connect_sees_1"), t("human_connect_sees_2"), t("human_connect_sees_3")],
          notHappen: [t("human_connect_not_1"), t("human_connect_not_2")],
          whyAsked: [t("human_connect_why_1"), t("human_connect_why_2"), t("human_connect_why_3")],
          risks: lists.risks,
          safeNotes: lists.safeNotes,
          nextSteps: lists.nextSteps,
          recommendation:
            trust.verdict === "SUSPICIOUS"
              ? t("human_connect_reco_suspicious")
              : t("human_connect_reco_ok"),
        },
      };
    }
    return {
      level,
      score,
      title: level === "WARN" ? title : baseTitle,
      reasons: connectReasons,
      decoded: { kind: "CONNECT", raw: { host } },
      recommend: level === "WARN" ? "WARN" : "ALLOW",
      trust,
      suggestedTrustedDomains: [...SUGGESTED_TRUSTED_DOMAINS],
      human: {
        methodTitle: explain.title,
        methodShort: explain.short,
        methodWhy: explain.why,
        whatItDoes: lists.whatItDoes,
        siteSees: [t("human_connect_sees_1"), t("human_connect_sees_2"), t("human_connect_sees_3")],
        notHappen: [t("human_connect_not_1"), t("human_connect_not_2")],
        whyAsked: [t("human_connect_why_1"), t("human_connect_why_2"), t("human_connect_why_3")],
        risks: lists.risks,
        safeNotes: lists.safeNotes,
        nextSteps: lists.nextSteps,
        recommendation:
          trust.verdict === "SUSPICIOUS"
            ? t("human_connect_reco_suspicious")
            : t("human_connect_reco_ok"),
      },
    };
  }

  // Typed data signatures
  if (method === "eth_signtypeddata_v4") {
    reasons.push(t("typedDataWarnReason"));
    level = "WARN";
    score = Math.max(score, 60);
    title = t("signatureRequest");
    return {
      level,
      score,
      title,
      reasons,
      decoded: { kind: "TYPED_DATA", raw: { params: req.request.params } },
      recommend: "WARN",
      trust,
      suggestedTrustedDomains: [...SUGGESTED_TRUSTED_DOMAINS],
      human: {
        methodTitle: explain.title,
        methodShort: explain.short,
        methodWhy: explain.why,
        whatItDoes: lists.whatItDoes,
        risks: lists.risks,
        safeNotes: lists.safeNotes,
        nextSteps: lists.nextSteps,
        recommendation:
          trust.verdict === "SUSPICIOUS" ? t("human_sign_reco_suspicious") : t("human_sign_reco_ok"),
      }
    };
  }

  if (method === "personal_sign" || method === "eth_sign") {
    reasons.push(t("rawSignWarnReason"));
    level = "WARN";
    score = Math.max(score, 55);
    title = t("signatureRequest");
    return {
      level,
      score,
      title,
      reasons,
      decoded: { kind: "SIGN", raw: { params: req.request.params } },
      recommend: "WARN",
      trust,
      suggestedTrustedDomains: [...SUGGESTED_TRUSTED_DOMAINS],
      human: {
        methodTitle: explain.title,
        methodShort: explain.short,
        methodWhy: explain.why,
        whatItDoes: lists.whatItDoes,
        risks: lists.risks,
        safeNotes: lists.safeNotes,
        nextSteps: lists.nextSteps,
        recommendation:
          trust.verdict === "SUSPICIOUS" ? t("human_sign_reco_suspicious") : t("human_sign_reco_ok"),
      }
    };
  }

  // Bonus: wallet methods that often pop UI
  if (
    method === "wallet_switchethereumchain" ||
    method === "wallet_addethereumchain"
  ) {
    reasons.push(t("chainChangeReason"));
    level = "WARN";
    score = Math.max(score, 45);
    title = t("chainChangeTitle");
    return {
      level,
      score,
      title,
      reasons,
      decoded: { kind: "TX", raw: { params: req.request.params } },
      recommend: "WARN",
      trust,
      suggestedTrustedDomains: [...SUGGESTED_TRUSTED_DOMAINS],
      chainTarget: (() => {
        try {
          const p0 = (req.request.params as any)?.[0];
          const chainIdHex = String(p0?.chainId || "");
          if (!chainIdHex) return undefined;
          return { chainIdHex, chainName: chainName(chainIdHex) };
        } catch { return undefined; }
      })(),
      human: {
        methodTitle: explain.title,
        methodShort: explain.short,
        methodWhy: explain.why,
        whatItDoes: lists.whatItDoes,
        risks: lists.risks,
        safeNotes: lists.safeNotes,
        nextSteps: lists.nextSteps,
        recommendation: t("human_chain_reco"),
      }
    };
  }

  if (method === "wallet_watchasset") {
    reasons.push(t("watchAssetReason"));
    level = "WARN";
    score = Math.max(score, 40);
    title = t("watchAssetTitle");
    return {
      level,
      score,
      title,
      reasons,
      decoded: { kind: "TX", raw: { params: req.request.params } },
      recommend: "WARN",
      trust,
      suggestedTrustedDomains: [...SUGGESTED_TRUSTED_DOMAINS],
      human: {
        methodTitle: explain.title,
        methodShort: explain.short,
        methodWhy: explain.why,
        whatItDoes: lists.whatItDoes,
        risks: lists.risks,
        safeNotes: lists.safeNotes,
        nextSteps: lists.nextSteps,
        recommendation: t("human_watchasset_reco"),
      }
    };
  }

  // Transactions
  if (method === "eth_sendtransaction") {
    const tx = (req.request.params?.[0] ?? {}) as any;
    const to = (tx.to ?? "").toLowerCase();
    const data = typeof tx.data === "string" ? tx.data : "";
    const value = tx.value ?? "0x0";
    const txSummary = buildTxSummary(method, (req.request.params || []) as any);

    if (isHexString(data) && data.startsWith("0x")) {
      const ap = decodeErc20Approve(data.toLowerCase());
      if (ap) {
        if (ap.isMax) {
          reasons.push(t("unlimitedApprovalReason"));
          level = "HIGH";
          score = Math.max(score, 90);
          title = t("unlimitedApprovalDetected");
          return {
            level,
            score,
            title,
            reasons,
            decoded: {
              kind: "APPROVE",
              spenderOrOperator: ap.spender,
              amountHuman: "UNLIMITED",
              raw: { to, value, selector: hexSelector(data) }
            },
            recommend: settings.blockHighRisk ? "BLOCK" : "WARN"
            ,
            trust,
            suggestedTrustedDomains: [...SUGGESTED_TRUSTED_DOMAINS],
            tx: txSummary,
            human: {
              methodTitle: explain.title,
              methodShort: explain.short,
              methodWhy: explain.why,
              whatItDoes: [t("human_approve_whatIs"), t("human_approve_safe_1")].slice(0, 2),
              risks: [t("human_approve_risk_1"), t("human_approve_risk_unlimited")].slice(0, 3),
              safeNotes: [t("human_approve_safe_1")].slice(0, 1),
              nextSteps: [t("human_approve_next_1"), t("human_approve_next_2")].slice(0, 3),
              recommendation: t("human_approve_reco_unlimited"),
              links: [{ text: t("human_revoke_link_text"), href: "https://revoke.cash" }],
            }
          };
        } else {
          reasons.push(t("tokenApproval"));
          level = "WARN";
          score = Math.max(score, 40);
          title = t("tokenApproval");
          return {
            level,
            score,
            title,
            reasons,
            decoded: {
              kind: "APPROVE",
              spenderOrOperator: ap.spender,
              amountHuman: ap.value ? ap.value.toString() : "UNKNOWN",
              raw: { to, value, selector: hexSelector(data) }
            },
            recommend: "WARN"
            ,
            trust,
            suggestedTrustedDomains: [...SUGGESTED_TRUSTED_DOMAINS],
            tx: txSummary,
            human: {
              methodTitle: explain.title,
              methodShort: explain.short,
              methodWhy: explain.why,
              whatItDoes: [t("human_approve_whatIs"), t("human_approve_safe_1")].slice(0, 2),
              risks: [t("human_approve_risk_1")].slice(0, 3),
              safeNotes: [t("human_approve_safe_1")].slice(0, 1),
              nextSteps: [t("human_approve_next_1"), t("human_approve_next_2")].slice(0, 3),
              recommendation: t("human_approve_reco"),
              links: [{ text: t("human_revoke_link_text"), href: "https://revoke.cash" }],
            }
          };
        }
      }

      const sa = decodeSetApprovalForAll(data.toLowerCase());
      if (sa && sa.approved) {
        reasons.push(t("nftOperatorApprovalReason"));
        level = "HIGH";
        score = Math.max(score, 95);
        title = t("nftOperatorApproval");
        return {
          level,
          score,
          title,
          reasons,
          decoded: {
            kind: "SET_APPROVAL_FOR_ALL",
            spenderOrOperator: sa.operator,
            raw: { to, value, selector: hexSelector(data) }
          },
          recommend: settings.blockHighRisk ? "BLOCK" : "WARN"
          ,
          trust,
          suggestedTrustedDomains: [...SUGGESTED_TRUSTED_DOMAINS],
          tx: txSummary,
          human: {
            methodTitle: explain.title,
            methodShort: explain.short,
            methodWhy: explain.why,
            whatItDoes: [t("human_setApprovalForAll_whatIs")].slice(0, 2),
            risks: [t("human_setApprovalForAll_risk_1")].slice(0, 3),
            safeNotes: [t("human_setApprovalForAll_safe_1")].slice(0, 1),
            nextSteps: [t("human_setApprovalForAll_next_1")].slice(0, 3),
            recommendation: t("human_setApprovalForAll_reco"),
            links: [{ text: t("human_revoke_link_text"), href: "https://revoke.cash" }],
          }
        };
      }
    }

    // Default tx
    if (level === "LOW") {
      title = t("txPreview");
      score = 20;
      reasons.push(t("txWarnReason"));
    }
    if (txSummary?.valueEth) reasons.push(`Transação envia ~${txSummary.valueEth} ETH (valor).`);
    if (!txSummary?.maxGasFeeEth) reasons.push("Taxa de rede (gas) será estimada pela carteira.");
    if (txSummary?.maxTotalEth) reasons.push(`Custo máximo (valor + gas): ~${txSummary.maxTotalEth} ETH.`);
    return {
      level,
      score,
      title,
      reasons,
      decoded: { kind: "TX", raw: { to, value, selector: hexSelector(data) } },
      recommend: level === "HIGH" ? (settings.blockHighRisk ? "BLOCK" : "WARN") : (level === "WARN" ? "WARN" : "ALLOW")
      ,
      trust,
      suggestedTrustedDomains: [...SUGGESTED_TRUSTED_DOMAINS],
      tx: txSummary,
      human: {
        methodTitle: explain.title,
        methodShort: explain.short,
        methodWhy: explain.why,
        whatItDoes: lists.whatItDoes,
        risks: lists.risks,
        safeNotes: lists.safeNotes,
        nextSteps: lists.nextSteps,
        recommendation: trust.verdict === "SUSPICIOUS" ? t("human_tx_reco_suspicious") : t("human_tx_reco_ok"),
      }
    };
  }

  // Unknown method: allow
  return {
    level,
    score,
    title: level === "WARN" ? title : "Request",
    reasons: reasons.length ? reasons : [t("unknownMethodReason")],
    decoded: { kind: "TX", raw: { method: req.request.method } },
    recommend: level === "WARN" ? "WARN" : "ALLOW"
    ,
    trust,
    suggestedTrustedDomains: [...SUGGESTED_TRUSTED_DOMAINS],
    human: {
      methodTitle: explain.title,
      methodShort: explain.short,
      methodWhy: explain.why,
      whatItDoes: lists.whatItDoes,
      risks: lists.risks,
      safeNotes: lists.safeNotes,
      nextSteps: lists.nextSteps,
      recommendation: t("human_generic_reco"),
    }
  };
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  (async () => {
    if (msg?.type === "PING") {
      sendResponse({ ok: true });
      return;
    }
    if (msg?.type === "GET_ETH_USD") {
      const usdPerEth = await getEthUsdPriceCached();
      sendResponse({ ok: true, usdPerEth });
      return;
    }
    if (msg?.type === "SG_INTEL_SUMMARY") {
      const intel = await getIntelFresh();
      sendResponse({
        ok: true,
        intelUpdatedAt: intel.updatedAt,
        trustedCount: intel.trustedDomains?.length || 0,
        blockedCount: intel.blockedDomains?.length || 0,
        sources: intel.sources || [],
      });
      return;
    }
    if (msg?.type === "SG_INTEL_UPDATE_NOW") {
      let intel: ThreatIntel;
      try {
        intel = await updateIntelNow();
      } catch {
        intel = await getIntelFresh();
      }
      sendResponse({
        ok: true,
        intelUpdatedAt: intel.updatedAt,
        trustedCount: intel.trustedDomains?.length || 0,
        blockedCount: intel.blockedDomains?.length || 0,
        sources: intel.sources || [],
      });
      return;
    }
    if (!msg || msg.type !== "ANALYZE") return;
    const settings = await getSettings();
    const intel = await getIntelFresh();
    const req = msg.payload as AnalyzeRequest;
    const analysis = analyze(req, settings, intel);

    // If warnings disabled, don't block or warn — just allow
    if (!settings.riskWarnings) {
      analysis.recommend = "ALLOW";
      analysis.level = "LOW";
      analysis.score = 0;
      analysis.reasons = [t("warningsDisabledReason")];
      analysis.title = t("analyzerUnavailableTitle");
    }

    sendResponse({ ok: true, analysis });
  })();
  return true;
});
