export function actionTitle(action: string): string {
  switch (action) {
    case "CONNECT": return "Conectar carteira";
    case "SWITCH_CHAIN": return "Trocar rede";
    case "ADD_CHAIN": return "Adicionar rede";
    case "REQUEST_PERMISSIONS": return "Conceder permissões";
    case "SIGN_MESSAGE": return "Assinar mensagem";
    case "SIGN_TYPED_DATA": return "Assinar mensagem (Typed Data)";
    case "SEND_TX": return "Enviar transação";
    case "WATCH_ASSET": return "Adicionar token à carteira";
    case "SOLANA": return "Assinatura/Transação Solana";
    default: return "Ação desconhecida";
  }
}

export function simpleSummary(action: string): string[] {
  switch (action) {
    case "SEND_TX":
      return [
        "Você está prestes a assinar/enviar uma transação on-chain.",
        "Confira valor, rede e o contrato antes de confirmar na carteira."
      ];
    case "SWITCH_CHAIN":
      return [
        "O site pediu para trocar a rede da sua carteira.",
        "Confira se a rede solicitada é a esperada para esta ação."
      ];
    case "CONNECT":
      return [
        "O site quer conectar à sua carteira (como login).",
        "Isso compartilha seu endereço público."
      ];
    case "SIGN_MESSAGE":
    case "SIGN_TYPED_DATA":
      return [
        "O site pediu uma assinatura.",
        "Assinatura pode autorizar ações: leia o texto na carteira."
      ];
    default:
      return [
        "Não foi possível classificar com segurança.",
        "Se estiver em dúvida, cancele."
      ];
  }
}

