import { t } from "../i18n";
import type { HumanExplanation, TrustVerdict } from "./types";
import type { SGAction } from "./classify";

export function explainMethod(method: string): { title: string; short: string; why: string } {
  const m = (method || "").toLowerCase();

  if (m === "eth_requestaccounts" || m === "wallet_requestpermissions") {
    return {
      title: t("explain_connect_title"),
      short: t("explain_connect_short"),
      why: t("explain_connect_why"),
    };
  }

  if (m === "personal_sign" || m === "eth_sign") {
    return {
      title: t("explain_sign_title"),
      short: t("explain_sign_short"),
      why: t("explain_sign_why"),
    };
  }

  if (m === "eth_signtypeddata_v4") {
    return {
      title: t("explain_typed_title"),
      short: t("explain_typed_short"),
      why: t("explain_typed_why"),
    };
  }

  if (m === "eth_sendtransaction") {
    return {
      title: t("explain_tx_title"),
      short: t("explain_tx_short"),
      why: t("explain_tx_why"),
    };
  }

  if (m === "wallet_switchethereumchain") {
    return {
      title: t("explain_switch_title"),
      short: t("explain_switch_short"),
      why: t("explain_switch_why"),
    };
  }

  if (m === "wallet_addethereumchain") {
    return {
      title: t("explain_addchain_title"),
      short: t("explain_addchain_short"),
      why: t("explain_addchain_why"),
    };
  }

  if (m === "wallet_watchasset") {
    return {
      title: t("explain_watchasset_title"),
      short: t("explain_watchasset_short"),
      why: t("explain_watchasset_why"),
    };
  }

  return {
    title: t("explain_generic_title"),
    short: t("explain_generic_short"),
    why: t("explain_generic_why"),
  };
}

export function actionTitle(action: SGAction): string {
  if (action === "CONNECT") return "Conectar carteira";
  if (action === "SWITCH_CHAIN") return "Trocar rede";
  if (action === "ADD_CHAIN") return "Adicionar rede";
  if (action === "REQUEST_PERMISSIONS") return "Conceder permissões";
  if (action === "SIGN_MESSAGE") return "Assinar mensagem";
  if (action === "SIGN_TYPED_DATA") return "Assinar mensagem (Typed Data)";
  if (action === "SEND_TX") return "Enviar transação";
  if (action === "WATCH_ASSET") return "Adicionar token à carteira";
  return "Ação desconhecida";
}

export function walletExpectation(action: SGAction): string {
  if (action === "SEND_TX") return "Você deve ver um pedido de transação (Transaction request) com valor, taxa e contrato.";
  if (action === "SWITCH_CHAIN") return "Você deve ver um pedido de troca de rede.";
  if (action === "CONNECT" || action === "REQUEST_PERMISSIONS") return "Você deve ver um pedido de conexão/seleção de conta.";
  if (action === "SIGN_MESSAGE" || action === "SIGN_TYPED_DATA") return "Você deve ver um pedido de assinatura.";
  if (action === "WATCH_ASSET") return "Você deve ver um pedido para adicionar token à carteira.";
  return "Você deve ver um pedido na carteira compatível com a ação solicitada.";
}

// Reduced default arrays (to avoid UI bloat):
// - CONNECT: whatItDoes max 2, risks max 3, safeNotes max 2, nextSteps max 3
// - SIGN: max 2/3/2/3
// - APPROVE/TX: max 2/3/1/3
export function buildHumanLists(method: string, trustVerdict: TrustVerdict): Pick<HumanExplanation, "whatItDoes" | "risks" | "safeNotes" | "nextSteps"> {
  const m = (method || "").toLowerCase();

  const suspicious = trustVerdict === "SUSPICIOUS";

  if (m === "eth_requestaccounts" || m === "wallet_requestpermissions") {
    return {
      whatItDoes: [t("human_connect_whatIs"), t("human_connect_why_1")].slice(0, 2),
      risks: [t("human_connect_risk_1"), t("human_connect_risk_2"), t("human_connect_risk_3")].slice(0, 3),
      safeNotes: [t("human_connect_safe_1")].slice(0, 2),
      nextSteps: [t("human_connect_next_1"), t("human_connect_next_2")].slice(0, 3),
    };
  }

  if (m === "personal_sign" || m === "eth_sign" || m === "eth_signtypeddata_v4") {
    const risks = [t("human_sign_risk_1"), t("human_sign_risk_2")];
    if (m === "eth_signtypeddata_v4") risks.push(t("human_typed_risk_1"));
    return {
      whatItDoes: [t(m === "eth_signtypeddata_v4" ? "human_typed_whatIs" : "human_sign_whatIs"), t("explain_sign_why")].slice(0, 2),
      risks: risks.slice(0, 3),
      safeNotes: [t("human_sign_safe_1")].slice(0, 2),
      nextSteps: [t("human_sign_next_1"), t("human_sign_next_2")].slice(0, 3),
    };
  }

  if (m === "eth_sendtransaction") {
    return {
      whatItDoes: [t("human_tx_whatIs")].slice(0, 2),
      risks: [t("human_tx_risk_1")].slice(0, 3),
      safeNotes: [t("human_tx_safe_1")].slice(0, 1),
      nextSteps: [t("human_tx_next_1")].slice(0, 3),
    };
  }

  if (m === "wallet_switchethereumchain" || m === "wallet_addethereumchain") {
    return {
      whatItDoes: [t("human_chain_whatIs")].slice(0, 2),
      risks: [t("human_chain_risk_1")].slice(0, 3),
      safeNotes: [t("human_chain_safe_1")].slice(0, 1),
      nextSteps: [t("human_chain_next_1")].slice(0, 3),
    };
  }

  if (m === "wallet_watchasset") {
    return {
      whatItDoes: [t("human_watchasset_whatIs")].slice(0, 2),
      risks: [t("human_watchasset_risk_1")].slice(0, 3),
      safeNotes: [t("human_watchasset_safe_1")].slice(0, 1),
      nextSteps: [t("human_watchasset_next_1")].slice(0, 3),
    };
  }

  // Generic
  return {
    whatItDoes: [t("human_generic_whatIs")].slice(0, 2),
    risks: [t("human_generic_risk_1")].slice(0, 3),
    safeNotes: [t("human_generic_safe_1")].slice(0, 1),
    nextSteps: [t("human_generic_next_1")].slice(0, 3),
  };
}

