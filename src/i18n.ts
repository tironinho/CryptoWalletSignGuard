export type Locale = "pt" | "en";

export function detectLocale(): Locale {
  const raw = (navigator.languages?.[0] || navigator.language || "en").toLowerCase();
  if (raw.startsWith("pt")) return "pt";
  return "en";
}

const dict: Record<Locale, Record<string, string>> = {
  pt: {
    title_brand: "Crypto Wallet SignGuard",
    btn_cancel: "Cancelar",
    btn_continue: "Continuar",
    tip_revoke: "Revogar permissões depois: revoke.cash",
    cost_summary_title: "Resumo de custos",
    cost_value: "Valor (ETH)",
    cost_fee: "Taxa estimada (ETH)",
    cost_total: "Total estimado (ETH)",
    cost_fee_unknown: "Taxa será cobrada (confirme na carteira)",
    network_switch_title: "Troca de rede",
    network_current: "Rede atual",
    network_requested: "Rede solicitada",
    trusted_domain_ref_title: "Domínios confiáveis (referência)",
    tx_cost_sending: "Você está enviando {value} ETH + taxa de rede",
    tx_cost_gas_only: "Mesmo sem enviar ETH, você pagará taxa de rede (gas)",
    gas_calculating: "calculando…",
  },
  en: {
    title_brand: "Crypto Wallet SignGuard",
    btn_cancel: "Cancel",
    btn_continue: "Continue",
    tip_revoke: "Revoke permissions later: revoke.cash",
    cost_summary_title: "Cost summary",
    cost_value: "Value (ETH)",
    cost_fee: "Estimated fee (ETH)",
    cost_total: "Estimated total (ETH)",
    cost_fee_unknown: "A network fee will be charged (confirm in wallet)",
    network_switch_title: "Network switch",
    network_current: "Current network",
    network_requested: "Requested network",
    trusted_domain_ref_title: "Trusted domains (reference)",
    tx_cost_sending: "You are sending {value} ETH + network fee",
    tx_cost_gas_only: "Even with 0 ETH, you will pay a network fee (gas)",
    gas_calculating: "calculating…",
  }
};

function format(template: string, params?: Record<string, string | number>) {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (_m, k) => (k in params ? String(params[k]) : `{${k}}`));
}

export function t(key: string, params?: Record<string, string | number>): string {
  try {
    // Keep compatibility with existing chrome.i18n keys in the project.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const c: any = (globalThis as any).chrome;
    const msg = c?.i18n?.getMessage?.(key);
    if (msg) return msg;
  } catch {}

  const loc = detectLocale();
  const v = dict[loc]?.[key] || dict.en[key] || key;
  return format(v, params);
}

