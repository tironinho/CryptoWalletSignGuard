"use strict";
(() => {
  // src/shared/types.ts
  var SUPPORTED_WALLETS = [
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
    { name: "Backpack", kind: "Solana" }
  ];
  var DEFAULT_SETTINGS = {
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
    cloudIntelOptIn: true,
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
      "polygon.technology"
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
      "polygon.technology"
    ],
    customBlockedDomains: [],
    customTrustedDomains: [],
    enableIntel: true,
    vault: {
      enabled: false,
      lockedContracts: []
    },
    simulation: {
      enabled: false,
      tenderlyAccount: "",
      tenderlyProject: "",
      tenderlyKey: ""
    },
    whitelistedDomains: [],
    fortressMode: false
  };

  // src/shared/constants.ts
  var SUGGESTED_TRUSTED_DOMAINS = [
    "opensea.io",
    "blur.io",
    "app.uniswap.org",
    "uniswap.org",
    "app.aave.com",
    "curve.finance",
    "etherscan.io",
    "revoke.cash",
    // references (not necessarily dApps)
    "rabby.io",
    "metamask.io"
  ];

  // src/shared/signatures.ts
  var KNOWN_SELECTORS = {
    "0x095ea7b3": "approve(address,uint256)",
    "0xa9059cbb": "transfer(address,uint256)",
    "0x23b872dd": "transferFrom(address,address,uint256)",
    "0xa22cb465": "setApprovalForAll(address,bool)",
    "0x42842e0e": "safeTransferFrom(address,address,uint256)",
    "0xf242432a": "safeTransferFrom(address,address,uint256,bytes)",
    "0xd0e30db0": "deposit()",
    "0x2e1a7d4d": "withdraw(uint256)",
    "0x38ed1739": "swapExactTokensForTokens(...)",
    "0x7ff36ab5": "swapExactETHForTokens(...)",
    "0x18cbafe5": "swapExactTokensForETH(...)",
    "0x04e45aaf": "exactInputSingle(...)",
    "0xb858183f": "exactInput(...)",
    "0x414bf389": "exactOutputSingle(...)",
    "0x09b81346": "exactOutput(...)"
  };
  function selectorToLabel(sel) {
    if (!sel || typeof sel !== "string") return null;
    const s = sel.toLowerCase();
    return KNOWN_SELECTORS[s] ?? null;
  }

  // src/i18n.ts
  function detectLocale() {
    const raw = (navigator.languages?.[0] || navigator.language || "en").toLowerCase();
    if (raw.startsWith("pt")) return "pt";
    return "en";
  }
  var dict = {
    pt: {
      tech_displayAction: "A\xE7\xE3o (classifica\xE7\xE3o)",
      tech_methodRaw: "M\xE9todo (raw)",
      tech_recommendScoreLevel: "Recomenda\xE7\xE3o/score/n\xEDvel",
      tech_reasons: "Motivos",
      tech_decoded: "Decodificado",
      dash: "\u2014",
      tx_to: "To",
      tx_data_length: "Tamanho do data",
      more_whatItDoes: "O que isso faz",
      more_risks: "Riscos",
      more_safeNotes: "Notas de seguran\xE7a",
      more_nextSteps: "Pr\xF3ximos passos",
      // Brand
      extName: "Crypto Wallet SignGuard",
      // Overlay - generic labels
      overlay_requested_title: "O que est\xE1 sendo solicitado",
      overlay_site_trusted_title: "Site confi\xE1vel?",
      overlay_summary_title: "Resumo (linguagem simples)",
      overlay_recommended_title: "A\xE7\xE3o recomendada",
      overlay_note_title: "Observa\xE7\xE3o",
      // Overlay - details sections
      details_tx_title: "Detalhes da transa\xE7\xE3o",
      details_tech_title: "Detalhes t\xE9cnicos",
      details_more_title: "Mais explica\xE7\xF5es",
      // Queue
      queue_indicator: "Fila: {pos} de {total}",
      // Action titles
      action_CONNECT_title: "Conectar carteira",
      action_REQUEST_PERMISSIONS_title: "Solicitar permiss\xF5es",
      action_SWITCH_CHAIN_title: "Trocar rede",
      action_ADD_CHAIN_title: "Adicionar rede",
      action_SIGN_MESSAGE_title: "Assinar mensagem",
      action_SIGN_TYPED_DATA_title: "Assinar dados (Typed Data)",
      action_SEND_TX_title: "Enviar transa\xE7\xE3o",
      action_SEND_TX_contract_title: "Interagir com contrato",
      action_SEND_TX_eth_title: "Enviar ETH",
      action_WATCH_ASSET_title: "Adicionar token/ativo",
      action_SOLANA_title: "Assinatura/Transa\xE7\xE3o Solana",
      action_UNKNOWN_title: "Solicita\xE7\xE3o",
      // Summary bullets (plain language)
      summary_CONNECT_1: "O site quer ver seus endere\xE7os e a rede atual.",
      summary_CONNECT_2: "Ele poder\xE1 pedir assinaturas/transa\xE7\xF5es depois.",
      summary_CONNECT_3: "Conecte apenas se confiar no site.",
      summary_REQUEST_PERMISSIONS_1: "O site quer permiss\xF5es adicionais na sua carteira.",
      summary_REQUEST_PERMISSIONS_2: "Revise as permiss\xF5es na carteira antes de aceitar.",
      summary_SWITCH_CHAIN_1: "O site quer trocar a rede (chain) da sua carteira.",
      summary_SWITCH_CHAIN_2: "Troca de rede normalmente n\xE3o custa gas.",
      explain_connect_title: "Conectar carteira",
      explain_connect_short: "Login com carteira (compartilha seu endere\xE7o p\xFAblico)",
      explain_connect_why: "Isso permite ao site mostrar sua conta e pedir assinaturas/aprova\xE7\xF5es/transa\xE7\xF5es depois.",
      explain_sign_title: "Assinar mensagem",
      explain_sign_short: "Sem gas, mas assinaturas podem autorizar a\xE7\xF5es",
      explain_sign_why: "Sites usam assinaturas para login, verifica\xE7\xE3o de posse ou autoriza\xE7\xF5es off-chain.",
      explain_typed_title: "Assinar dados estruturados",
      explain_typed_short: "Typed-data pode incluir permits/autoriza\xE7\xF5es",
      explain_typed_why: "Typed-data \xE9 frequentemente usado para permits (aprova\xE7\xF5es sem approve on-chain separado).",
      explain_tx_title: "Enviar transa\xE7\xE3o",
      explain_tx_short: "A\xE7\xE3o on-chain (pode ter taxa de gas)",
      explain_tx_why: "Isso criar\xE1 uma transa\xE7\xE3o on-chain se voc\xEA aprovar na sua carteira.",
      explain_switch_title: "Trocar rede",
      explain_switch_why: "Alguns sites exigem uma rede espec\xEDfica para funcionar.",
      explain_addchain_title: "Adicionar rede",
      explain_addchain_short: "Adiciona uma configura\xE7\xE3o de chain na carteira",
      explain_add_chain_short: "Adicionar rede na carteira",
      add_chain_review_rpc: "RPC malicioso pode enganar saldos/transa\xE7\xF5es; confirme a proced\xEAncia.",
      add_chain_verify_chainid: "Confirme o chainId e o nome da rede antes de adicionar.",
      explain_addchain_why: "A carteira pode adicionar detalhes de RPC para a rede solicitada.",
      explain_watchasset_title: "Adicionar ativo",
      explain_watchasset_short: "Adiciona um token/ativo na UI da carteira",
      explain_watch_asset_short: "Adicionar token/ativo na carteira",
      watch_asset_no_spend_but_risk: "Adicionar token n\xE3o gasta fundos, mas tokens podem ser golpe; confirme contrato.",
      watch_asset_verify_contract: "Verifique o endere\xE7o do contrato em um explorer confi\xE1vel.",
      explain_watchasset_why: "N\xE3o gasta fundos, mas confirme se os detalhes do token est\xE3o corretos.",
      explain_generic_title: "Solicita\xE7\xE3o da carteira",
      explain_generic_short: "Um site est\xE1 pedindo uma a\xE7\xE3o da carteira",
      explain_generic_why: "Revise os detalhes na carteira e confirme a URL do site.",
      human_connect_whatIs: "Conecta seu endere\xE7o de carteira a este site (como um login).",
      human_connect_sees_1: "Seu endere\xE7o p\xFAblico (e sele\xE7\xE3o de conta)",
      human_connect_sees_2: "Sua rede/chain selecionada",
      human_connect_sees_3: "Atividade on-chain p\xFAblica (tokens/NFTs s\xE3o dados p\xFAblicos)",
      human_connect_not_1: "N\xC3O revela sua seed phrase nem a senha da carteira",
      human_connect_not_2: "N\xC3O move fundos automaticamente por si s\xF3",
      human_connect_why_1: "Para mostrar sua conta e saldos na interface",
      human_connect_why_2: "Para permitir assinar mensagens (login/verifica\xE7\xE3o)",
      human_connect_why_3: "Para pedir aprova\xE7\xF5es/transa\xE7\xF5es depois (com sua confirma\xE7\xE3o)",
      human_connect_risk_1: "Privacidade/rastreamento: pode vincular seu endere\xE7o a este site",
      human_connect_risk_2: "Phishing em etapas: os pr\xF3ximos prompts podem pedir assinatura/approve",
      human_connect_risk_3: "Dom\xEDnios similares: sites falsos costumam come\xE7ar com um connect inofensivo",
      human_connect_safe_1: "Trate connect como compartilhar identidade: fa\xE7a isso s\xF3 em sites que voc\xEA reconhece.",
      human_connect_next_1: "Confira o dom\xEDnio (ortografia, HTTPS, sem punycode)",
      human_connect_next_2: "Se tiver d\xFAvida, cancele e abra o site por um favorito confi\xE1vel",
      human_connect_reco_suspicious: "Cancele e verifique a URL por outro meio (favorito/busca), depois tente novamente.",
      human_connect_reco_ok: "Continue apenas se voc\xEA reconhece o site e a URL parece correta.",
      human_sign_whatIs: "Cria uma assinatura criptogr\xE1fica. Geralmente n\xE3o custa gas, mas pode autorizar a\xE7\xF5es.",
      human_sign_risk_1: "Assinar textos desconhecidos pode autorizar a\xE7\xF5es/login que voc\xEA n\xE3o pretendia",
      human_sign_risk_2: "Blind sign pode esconder o que voc\xEA est\xE1 autorizando",
      human_typed_whatIs: "Assina dados estruturados (typed-data). Frequentemente usado para permits/autoriza\xE7\xF5es.",
      human_typed_risk_1: "Typed-data pode incluir permits de token que funcionam como aprova\xE7\xF5es",
      human_sign_safe_1: "Prefira carteiras que mostrem detalhes de assinatura de forma leg\xEDvel.",
      human_sign_next_1: "Verifique a URL e leia a mensagem/typed-data com aten\xE7\xE3o",
      human_sign_next_2: "Se o prompt for vago, cancele e pe\xE7a contexto ao site",
      human_sign_reco_suspicious: "Cancele. Dom\xEDnio suspeito + assinatura \xE9 um padr\xE3o comum de phishing.",
      human_sign_reco_ok: "S\xF3 continue se voc\xEA entende o motivo da assinatura e confia no site.",
      human_approve_whatIs: "Uma aprova\xE7\xE3o permite que um contrato gaste seus tokens depois (at\xE9 o limite aprovado).",
      human_approve_risk_1: "Aprova\xE7\xF5es podem ser abusadas se o contrato gastador for malicioso ou comprometido",
      human_approve_risk_unlimited: "Aprova\xE7\xE3o ilimitada significa que pode gastar TODO o saldo do token",
      human_approve_safe_1: "Quando poss\xEDvel, aprove apenas o m\xEDnimo necess\xE1rio.",
      human_approve_next_1: "Confira o spender/operador e se voc\xEA reconhece o dApp",
      human_approve_next_2: "Considere revogar aprova\xE7\xF5es depois se n\xE3o usar mais o site",
      human_approve_reco: "Continue apenas se voc\xEA confia no site e o spender faz sentido.",
      human_approve_reco_unlimited: "Evite aprova\xE7\xF5es ilimitadas a menos que voc\xEA confie muito no site e entenda o risco.",
      human_setApprovalForAll_whatIs: "D\xE1 permiss\xE3o a um operador para mover TODOS os NFTs de uma cole\xE7\xE3o por voc\xEA.",
      human_setApprovalForAll_risk_1: "Isso pode permitir drenar NFTs se o operador for malicioso/comprometido",
      human_setApprovalForAll_safe_1: "Aprove apenas operadores que voc\xEA reconhece (ex.: marketplaces conhecidos).",
      human_setApprovalForAll_next_1: "Verifique o endere\xE7o do operador e se o site \xE9 o marketplace pretendido",
      human_setApprovalForAll_reco: "Cancele a menos que voc\xEA esteja em um marketplace reconhecido e espere essa a\xE7\xE3o.",
      human_tx_whatIs: "Isso criar\xE1 uma transa\xE7\xE3o on-chain se voc\xEA aprovar na sua carteira.",
      human_tx_risk_1: "Transa\xE7\xF5es podem mover fundos ou alterar permiss\xF5es dependendo da chamada",
      human_tx_safe_1: "Sempre verifique destinat\xE1rio, valor e o contrato com o qual est\xE1 interagindo.",
      human_tx_next_1: "Confira o destino (to), valor e a a\xE7\xE3o decodificada (se houver)",
      human_tx_reco_suspicious: "Cancele. N\xE3o envie transa\xE7\xF5es em dom\xEDnios suspeitos.",
      human_tx_reco_ok: "Continue apenas se voc\xEA pretendia essa a\xE7\xE3o e os detalhes parecem corretos.",
      human_chain_whatIs: "Muda a rede selecionada na sua carteira.",
      human_chain_risk_1: "Redes/RPCs errados podem te enganar sobre ativos ou transa\xE7\xF5es",
      human_chain_safe_1: "S\xF3 troque/adicione redes que voc\xEA reconhece.",
      human_chain_next_1: "Confirme nome da rede e chainId no prompt da carteira",
      human_watchasset_whatIs: "Adiciona um token/ativo na UI da carteira para facilitar a visualiza\xE7\xE3o.",
      human_watchasset_risk_1: "Tokens falsos podem se passar por reais\u2014verifique endere\xE7o e s\xEDmbolo",
      human_watchasset_safe_1: "Confirme detalhes do token em um explorer confi\xE1vel (ex.: Etherscan).",
      human_watchasset_next_1: "Verifique o contrato do token e as decimais",
      human_watchasset_reco: "Continue apenas se os detalhes baterem com uma fonte oficial.",
      human_generic_whatIs: "Um site solicitou uma a\xE7\xE3o da carteira. Revise os detalhes com cuidado.",
      human_generic_risk_1: "Prompts desconhecidos podem fazer parte de fluxos de phishing",
      human_generic_safe_1: "Na d\xFAvida, cancele e verifique o site.",
      human_generic_next_1: "Confira a URL e leia os detalhes do prompt da carteira",
      human_generic_reco: "Continue apenas se voc\xEA entende e esperava essa solicita\xE7\xE3o.",
      human_revoke_link_text: "Revogar permiss\xF5es depois: revoke.cash",
      trustReasonNotHttps: "N\xE3o \xE9 HTTPS (maior risco de spoofing/inje\xE7\xE3o).",
      trustReasonManyHyphens: "Muitos h\xEDfens no dom\xEDnio (comum em similares).",
      trustReasonSuspiciousKeywords: "Dom\xEDnio cont\xE9m palavras de alto risco (login/verify/secure/...).",
      trustReasonBrandLookalike: "Nome lembra uma marca, mas n\xE3o \xE9 o dom\xEDnio oficial.",
      trustReasonManySubdomains: "Estrutura de subdom\xEDnio profunda/incomum.",
      trustReasonNoHost: "N\xE3o foi poss\xEDvel ler o hostname do site.",
      trustReasonAllowlistedVariant: "Dom\xEDnio casa com um padr\xE3o confi\xE1vel.",
      trustReasonUnknown: "Sem sinais fortes para um lado ou outro.",
      summary_ADD_CHAIN_1: "O site quer adicionar uma nova rede na sua carteira.",
      summary_ADD_CHAIN_2: "Confirme o chainId e o nome da rede com cuidado.",
      summary_SIGN_MESSAGE_1: "Voc\xEA vai assinar uma mensagem (n\xE3o \xE9 transa\xE7\xE3o).",
      summary_SIGN_MESSAGE_2: "A assinatura pode ter efeitos fora da blockchain (login, termos, permiss\xF5es).",
      summary_SIGN_TYPED_DATA_1: "Voc\xEA vai assinar dados estruturados (EIP-712).",
      summary_SIGN_TYPED_DATA_2: "Isso pode autorizar gastos/ordens dependendo do conte\xFAdo.",
      summary_SIGN_TYPED_DATA_3: "Verifique quem \xE9 o spender/contrato envolvido.",
      summary_SEND_TX_1: "Voc\xEA vai enviar uma transa\xE7\xE3o on-chain.",
      summary_SEND_TX_2: "Isso pode mover ETH/tokens ou interagir com um contrato.",
      summary_SEND_TX_3: "Confira valor, rede e destino antes de confirmar.",
      summary_WATCH_ASSET_1: "O site quer adicionar um token/ativo na sua carteira.",
      summary_WATCH_ASSET_2: "Confirme s\xEDmbolo e endere\xE7o do contrato do token.",
      summary_SOLANA_1: "Assinatura ou transa\xE7\xE3o Solana. Os valores ser\xE3o confirmados na carteira.",
      summary_UNKNOWN_1: "O site est\xE1 fazendo uma chamada de carteira desconhecida.",
      summary_UNKNOWN_2: "Se n\xE3o souber o que \xE9, cancele.",
      // Costs / TX labels
      btn_cancel: "Cancelar",
      btn_continue: "Continuar",
      toast_request_expired: "Solicita\xE7\xE3o expirada. Refa\xE7a a a\xE7\xE3o no site e tente novamente.",
      simulation_tx_will_fail: "ESTA TRANSA\xC7\xC3O VAI FALHAR",
      btn_close: "Fechar",
      btn_proceed_anyway: "Prosseguir mesmo assim",
      override_checkbox: "Eu entendo o risco e quero prosseguir",
      override_countdown: "({s}s)",
      tip_revoke: "Revogar permiss\xF5es depois: revoke.cash",
      cost_summary_title: "Resumo de custos",
      costs_title: "Custos e impacto",
      impact_title: "Impacto",
      permission_for: "Permiss\xE3o para",
      addr_marked_public: "Marcado em base p\xFAblica",
      risk_title: "Risco e por qu\xEA",
      what_to_do_now: "O que fazer agora",
      site_label: "Site",
      network_label: "Rede",
      severity_BLOCKED: "BLOQUEADO",
      severity_HIGH: "ALTO",
      severity_WARN: "ATEN\xC7\xC3O",
      severity_LOW: "BAIXO",
      cost_you_send: "Voc\xEA envia",
      cost_fee_only: "apenas taxa",
      cost_value: "Valor (ETH)",
      cost_fee: "Taxa estimada (ETH)",
      cost_total: "Total estimado (ETH)",
      cost_fee_unknown: "Taxa ser\xE1 cobrada (confirme na carteira)",
      network_switch_title: "Troca de rede",
      network_current: "Rede atual",
      network_requested: "Rede solicitada",
      trusted_domain_ref_title: "Dom\xEDnios confi\xE1veis (refer\xEAncia)",
      tx_cost_sending: "Voc\xEA est\xE1 enviando {value} ETH + taxa de rede",
      tx_cost_gas_only: "Mesmo sem enviar ETH, voc\xEA pagar\xE1 taxa de rede (gas)",
      gas_calculating: "calculando\u2026",
      tx_destination: "Destino",
      token_verified_uniswap: "Token Verificado (Uniswap List)",
      token_unknown_unverified: "Token Desconhecido (N\xE3o Verificado)",
      tx_contract_method: "Contrato/m\xE9todo",
      tx_max_gas_fee: "Gas m\xE1x (ETH)",
      tx_max_total: "Total m\xE1x (ETH)",
      tx_fee_estimated_by_wallet: "A carteira estimar\xE1 a taxa na pr\xF3xima etapa.",
      network_target: "Rede alvo",
      switch_no_gas: "A troca de rede normalmente N\xC3O custa gas.",
      switch_next_step_gas: "A pr\xF3xima etapa (compra/transa\xE7\xE3o) ter\xE1 taxa de rede.",
      switch_note_inline: "A troca de rede normalmente N\xC3O custa gas. Por\xE9m a pr\xF3xima etapa (compra/transa\xE7\xE3o) ter\xE1 taxa de rede.",
      sendtx_reco: "Confirme na carteira apenas se os detalhes (valor, rede e contrato) estiverem corretos.",
      // Risk/trust labels
      risk_LOW: "Baixo",
      risk_WARN: "Aten\xE7\xE3o",
      risk_HIGH: "Alto",
      recommend_ALLOW: "Permitir",
      recommend_WARN: "Avisar",
      recommend_HIGH: "Alto risco",
      recommend_BLOCK: "Bloquear",
      trust_unknown: "Desconhecido",
      trust_suspicious: "Suspeito",
      trust_likelyOfficial: "Dom\xEDnio conhecido (lista de refer\xEAncia)",
      trust_domainNotRecognized: "Dom\xEDnio n\xE3o reconhecido",
      // Phishing hard-block
      phishing_hard_block: "Dom\xEDnio em blacklist de phishing. Bloqueado.",
      // Toasts
      toast_extension_updated: "Extens\xE3o atualizada \u2014 recarregue a aba.",
      toast_cannot_analyze: "N\xE3o foi poss\xEDvel analisar. Recarregue a aba.",
      // Options page
      optionsTitle: "Crypto Wallet SignGuard \u2014 Configura\xE7\xF5es",
      optionsSubtitle: "Controle quando o SignGuard deve alertar e bloquear.",
      dashboardLink: "Dashboard",
      onboardingTitle: "Como usar",
      onboardingHowTo: "A extens\xE3o intercepta solicita\xE7\xF5es sens\xEDveis (conex\xE3o, assinatura, transa\xE7\xE3o) de carteiras injetadas (window.ethereum / window.solana). Ao detectar, mostra um overlay para voc\xEA revisar antes de a carteira abrir.",
      onboardingWhatItDoes: "Faz: alerta antes de conectar, assinar ou enviar; verifica dom\xEDnio contra listas de phishing; mostra inten\xE7\xE3o da transa\xE7\xE3o (swap, NFT, approval).",
      onboardingWhatItDoesNot: "N\xE3o faz: n\xE3o protege conex\xF5es via QR/WalletConnect; n\xE3o garante que contratos sejam seguros; n\xE3o substitui verifica\xE7\xE3o manual.",
      onboardingLinkRevoke: "revoke.cash \u2014 revogar permiss\xF5es",
      onboardingLinkEtherscan: "Etherscan \u2014 explorar transa\xE7\xF5es",
      exportDebugRequiresDebugMode: "Ative o modo Debug primeiro para exportar eventos.",
      securityModeLabel: "Modo de seguran\xE7a",
      securityModeDesc: "Strict bloqueia mais; Balanced alerta; Relaxed reduz fric\xE7\xE3o; Off desativa bloqueios.",
      modeStrict: "Strict",
      modeBalanced: "Balanced",
      modeRelaxed: "Relaxed",
      modeOff: "Off",
      strictBlockApprovalsUnlimitedLabel: "Strict: bloquear approve ilimitado",
      strictBlockApprovalsUnlimitedDesc: "Bloqueia aprova\xE7\xF5es ERC20 unlimited (MAX_UINT256).",
      strictBlockSetApprovalForAllLabel: "Strict: bloquear setApprovalForAll",
      strictBlockSetApprovalForAllDesc: "Bloqueia permiss\xE3o para mover todos os NFTs.",
      strictBlockPermitLikeLabel: "Strict: bloquear Permit ilimitado",
      strictBlockPermitLikeDesc: "Bloqueia assinaturas Permit (EIP-2612) unlimited.",
      assetEnrichmentEnabledLabel: "Enriquecimento de ativos",
      assetEnrichmentEnabledDesc: "Busca s\xEDmbolo/nome de tokens via eth_call.",
      addressIntelEnabledLabel: "Threat intel de endere\xE7os",
      addressIntelEnabledDesc: "Verifica spender/operator/to contra blacklist.",
      riskWarningsLabel: "Alertas de risco",
      riskWarningsDesc: "Mostra avisos e recomenda\xE7\xF5es antes de abrir a carteira.",
      connectOverlayLabel: "Overlay ao conectar",
      connectOverlayDesc: "Mostra o overlay tamb\xE9m para conex\xE3o/permiss\xF5es.",
      blockHighRiskLabel: "Bloquear alto risco",
      blockHighRiskDesc: "Bloqueia automaticamente a\xE7\xF5es de alto risco.",
      requireTypedOverrideLabel: "Exigir override em Typed Data (alto risco)",
      requireTypedOverrideDesc: "Para assinaturas EIP-712 de alto risco, exige confirma\xE7\xE3o extra.",
      allowOverrideOnPhishingLabel: "Permitir override em phishing (N\xC3O recomendado)",
      allowOverrideOnPhishingDesc: "Se desativado (padr\xE3o), phishing em blacklist \xE9 bloqueado sem op\xE7\xE3o de prosseguir.",
      mode_off_reason: "Modo OFF: sem bloqueios.",
      address_flagged_reason: "Endere\xE7o/contrato sinalizado: {label} ({category})",
      addr_sanctioned_block: "Endere\xE7o em lista de san\xE7\xF5es.",
      addr_scam_reported_warn: "Endere\xE7o marcado como suspeito/relatado.",
      addr_phishing_reported_warn: "Endere\xE7o marcado como suspeito/relatado.",
      addr_malicious_contract_warn: "Contrato marcado como malicioso.",
      asset_info_reason: "Ativo: {sym} ({kind})",
      reason_permission_tokens: "Permiss\xE3o para gastar tokens",
      reason_permission_all_nfts: "Permiss\xE3o para mover TODOS os NFTs",
      reason_transfer_tokens: "Transfer\xEAncia de tokens/NFT",
      domainChecksLabel: "Checagens de dom\xEDnio",
      domainChecksDesc: "Alertas por padr\xF5es suspeitos no dom\xEDnio quando n\xE3o estiver na allowlist.",
      allowlistLabel: "Allowlist (dom\xEDnios confi\xE1veis)",
      allowlistDesc: "Um dom\xEDnio por linha. Ex.: opensea.io",
      vaultTitle: "Cofre SignGuard",
      vaultDesc: "Contratos nesta lista nunca podem ser transacionados sem desbloqueio expl\xEDcito nas op\xE7\xF5es.",
      vaultAddLabel: "Adicionar contrato ao cofre",
      vaultAddButton: "Adicionar ao Cofre",
      vaultListLabel: "Contratos bloqueados",
      vaultListEmpty: "Nenhum contrato no cofre.",
      vaultRemove: "Remover",
      vaultInvalidAddress: "Endere\xE7o inv\xE1lido. Use 0x e 40 caracteres hexadecimais.",
      vaultAlreadyAdded: "Este contrato j\xE1 est\xE1 no cofre.",
      vaultBlockedMessage: "SignGuard: Ativo Bloqueado no Cofre. Desbloqueie nas op\xE7\xF5es para continuar.",
      addSuggested: "Adicionar sugeridos",
      save: "Salvar",
      saved: "Salvo",
      intelTitle: "Threat Intel",
      intelSubtitle: "Listas de dom\xEDnios (fontes plug\xE1veis) usadas na an\xE1lise.",
      intelTrustedCountLabel: "Dom\xEDnios confi\xE1veis",
      intelBlockedCountLabel: "Dom\xEDnios bloqueados",
      intelBlockedAddressCountLabel: "Endere\xE7os bloqueados",
      intelUpdatedAtLabel: "\xDAltima atualiza\xE7\xE3o",
      intelUpdateNow: "Atualizar agora",
      enableIntelLabel: "Usar Threat Intel",
      enableIntelDesc: "Usa listas de dom\xEDnios confi\xE1veis/bloqueados na an\xE1lise.",
      customTrustedDomainsLabel: "Dom\xEDnios confi\xE1veis (lista personalizada)",
      customTrustedDomainsDesc: "Um por linha. Ex.: meusite.io",
      customBlockedDomainsLabel: "Dom\xEDnios bloqueados (lista personalizada)",
      customBlockedDomainsDesc: "Um por linha. Sempre bloqueados.",
      exportListsLabel: "Exportar listas",
      privacyLimitsTitle: "Privacidade & Limita\xE7\xF5es",
      privacyLimitsLine1: "A extens\xE3o n\xE3o acessa sua seed/frase secreta e n\xE3o tem cust\xF3dia.",
      privacyLimitsLine2: "Ela analisa dom\xEDnios e dados de transa\xE7\xE3o exibidos pelo navegador para alertas. N\xE3o garante 100%.",
      privacyLimitsLine3: "Threat intel pode ser atualizado via fontes p\xFAblicas (opcional).",
      cloudIntelOptInLabel: "Permitir checagens externas",
      cloudIntelOptInDesc: "Mais prote\xE7\xE3o; pode enviar dom\xEDnio/endere\xE7os para valida\xE7\xE3o (preparado para P1).",
      showUsdLabel: "Mostrar valores em USD",
      showUsdDesc: "Exibe aproxima\xE7\xE3o em d\xF3lares (USD) ao lado de valores em ETH.",
      tabSettings: "Configura\xE7\xF5es",
      tabHistory: "Hist\xF3rico",
      tabPlan: "Plano",
      historySubtitle: "\xDAltimas decis\xF5es do overlay.",
      historyExport: "Exportar JSON",
      historyClear: "Limpar",
      historyEmpty: "Nenhum registro.",
      request_expired_toast: "Solicita\xE7\xE3o expirada. Refa\xE7a a a\xE7\xE3o no site e tente novamente.",
      failopen_armed_banner: "An\xE1lise demorou. Voc\xEA pode Continuar mesmo assim ou Cancelar.",
      decision_allow: "Permitido",
      decision_block: "Bloqueado",
      planSubtitle: "Gerencie seu plano e licen\xE7a.",
      planCurrent: "Plano atual",
      planLicenseKey: "Chave de licen\xE7a",
      planActivate: "Ativar",
      planGoPro: "Assinar PRO",
      // Options: Safety notes + debug
      safetyNotesTitle: "Limita\xE7\xF5es & seguran\xE7a",
      safetyNotesLine1: "Esta extens\xE3o monitora solicita\xE7\xF5es feitas por carteiras injetadas (window.ethereum / window.solana).",
      safetyNotesLine2: "Conex\xF5es via QR/WalletConnect podem n\xE3o ser interceptadas. Sempre verifique na sua carteira.",
      safetyNotesLinkRevoke: "revoke.cash",
      safetyNotesLinkEtherscan: "etherscan.io",
      debugModeLabel: "Modo debug",
      debugModeDesc: "Armazena os \xFAltimos 20 eventos (sem payload grande) para suporte.",
      exportDebug: "Exportar",
      // Overlay: intent + permission + copy
      looks_like: "Parece:",
      intent_NFT_PURCHASE: "Compra de NFT",
      intent_SWAP: "Swap",
      intent_APPROVAL: "Permiss\xE3o",
      intent_SEND: "Envio",
      intent_UNKNOWN: "Desconhecido",
      intent_ETH_TRANSFER: "Envio de ETH",
      intent_TOKEN_TRANSFER: "Transfer\xEAncia de token",
      intent_NFT_TRANSFER: "Transfer\xEAncia de NFT",
      intent_CONTRACT_INTERACTION: "Intera\xE7\xE3o com contrato",
      intent_SWITCH_CHAIN: "Troca de rede",
      intent_ADD_CHAIN: "Adicionar rede",
      intent_WATCH_ASSET: "Adicionar token",
      intent_SOLANA: "Assinatura/Transa\xE7\xE3o Solana",
      intent_SIGNATURE: "Assinatura",
      intent_TYPED_DATA: "Dados tipados",
      wallet_label: "Carteira",
      wallet_detecting: "Detectando\u2026",
      wallet_evm_generic: "Carteira EIP-1193",
      trust_disclaimer: "Lista de refer\xEAncia \u2260 garantia. Golpistas podem usar dom\xEDnios parecidos.",
      hint_wallet_popup: "Sua carteira deve abrir agora. Se n\xE3o abrir, clique no \xEDcone da carteira e verifique solicita\xE7\xF5es pendentes.",
      add_chain_network_label: "Rede a adicionar",
      add_chain_rpc_label: "RPC",
      watch_asset_token_label: "Token a adicionar",
      modeLabel: "Modo:",
      popupPauseProtection: "PAUSAR PROTE\xC7\xC3O",
      popupStatusProtected: "Protegido",
      popupStatusPaused: "Pausado",
      fortressModeLabel: "MODO FORTALEZA",
      fortressModeDesc: "Bloqueia todas as aprova\xE7\xF5es de tokens, exceto em sites confi\xE1veis.",
      fortress_block_message: "SignGuard Fortaleza: Aprova\xE7\xE3o bloqueada em site desconhecido. Desative o modo Fortaleza para prosseguir.",
      honeypot_message: "\u{1FAA4} HONEYPOT: Voc\xEA pode comprar, mas N\xC3O poder\xE1 vender.",
      info_unavailable: "Informa\xE7\xE3o indispon\xEDvel.",
      explain_switch_short: "O site pediu para trocar a rede (chain) da sua carteira.",
      human_chain_reco: "Continue apenas se voc\xEA esperava a troca de rede e ela parece correta.",
      trustReasonAllowlisted: "Dom\xEDnio est\xE1 em uma lista confi\xE1vel (seed).",
      trustReasonPhishingBlacklist: "Dom\xEDnio est\xE1 em blacklist de phishing (lista de refer\xEAncia).",
      fee_unknown_wallet_will_estimate: "Taxa: ser\xE1 exibida pela carteira",
      label_you_send: "Voc\xEA envia",
      label_fee_likely: "Taxa estimada (prov\xE1vel)",
      label_fee_max: "Taxa m\xE1xima (pior caso)",
      label_total_likely: "Total prov\xE1vel",
      label_total_max: "Total m\xE1ximo",
      fee_gt_value: "A taxa m\xE1xima \xE9 MAIOR que o valor enviado. Confirme se faz sentido.",
      check_wallet_network_fee: "Voc\xEA ainda n\xE3o viu a taxa. Verifique o 'Network fee' na carteira antes de confirmar.",
      label_max_fee: "Taxa m\xE1xima (ETH)",
      label_max_total: "Total m\xE1ximo (ETH)",
      switch_summary_no_gas: "Troca de rede normalmente n\xE3o custa gas, mas pode mudar quais ativos voc\xEA est\xE1 vendo.",
      permission_title: "Permiss\xE3o",
      permission_token_contract: "Contrato",
      permission_spender: "Spender",
      permission_operator: "Operator",
      permission_unlimited: "Ilimitado",
      approval_unlimited_detected: "Aprova\xE7\xE3o ilimitada detectada",
      permit_signature_detected: "Assinatura tipo Permit detectada (pode autorizar gasto de tokens)",
      token_transfer_detected: "Transfer\xEAncia de token detectada",
      nft_transfer_detected: "Transfer\xEAncia de NFT detectada",
      transfer_token_title: "Transfer\xEAncia de token",
      transfer_nft_title: "Transfer\xEAncia de NFT",
      transfer_amount: "Quantidade",
      transfer_token_id: "Token ID",
      yes: "Sim",
      no: "N\xE3o",
      copy: "Copiar",
      chainChangeTitle: "Solicita\xE7\xE3o de troca/adicionar rede",
      watchAssetTitle: "Solicita\xE7\xE3o de adicionar ativo",
      domainPunycodeReason: "Dom\xEDnio usa punycode (xn--); verifique a URL.",
      domainDoubleDashReason: "Dom\xEDnio cont\xE9m h\xEDfen duplo (suspeito).",
      domainNumberPatternReason: "Dom\xEDnio com muitos n\xFAmeros (comum em phishing).",
      domainLookalikeReason: "Poss\xEDvel imita\xE7\xE3o do dom\xEDnio oficial de {legit}.",
      suspiciousWebsitePatterns: "Padr\xF5es suspeitos no site.",
      page_risk_suspicious_banner: "\u26A0\uFE0F SignGuard: Site Suspeito Detetado",
      connectTitle: "Conectar carteira",
      connectReason: "O site quer conectar \xE0 sua carteira.",
      walletRequestPermissionsTitle: "Solicitar permiss\xF5es",
      walletRequestPermissionsReason: "O site quer permiss\xF5es adicionais na carteira.",
      typedDataWarnReason: "Assinatura de dados estruturados (EIP-712); pode autorizar a\xE7\xF5es.",
      signatureRequest: "Pedido de assinatura",
      rawSignWarnReason: "Assinatura de mensagem raw; pode autorizar a\xE7\xF5es fora da blockchain.",
      tokenApproval: "Aprova\xE7\xE3o de token",
      unlimitedApprovalReason: "Aprova\xE7\xE3o ilimitada detectada (MAX_UINT256).",
      unlimitedApprovalDetected: "Aprova\xE7\xE3o ilimitada detectada",
      nftOperatorApprovalReason: "Permiss\xE3o para mover TODOS os NFTs da cole\xE7\xE3o.",
      nftOperatorApproval: "Permiss\xE3o de operador NFT",
      txPreview: "Visualiza\xE7\xE3o da transa\xE7\xE3o",
      txWarnReason: "Transa\xE7\xE3o on-chain; confira valor, destino e rede.",
      unknownMethodReason: "M\xE9todo de carteira desconhecido.",
      warningsDisabledReason: "Alertas desativados nas configura\xE7\xF5es.",
      analyzing: "Analisando\u2026",
      analyzing_subtitle: "Site \u2022 M\xE9todo",
      analyzing_hint: "Validando dom\xEDnio e estimando impacto",
      fallback_partial_check: "Sem verifica\xE7\xE3o completa agora \u2014 revise os detalhes abaixo antes de prosseguir.",
      fallback_partial_verification: "Verifica\xE7\xE3o parcial agora \u2014 revise os detalhes abaixo antes de prosseguir.",
      loading_base: "Carregando base\u2026",
      analyzerUnavailableTitle: "Analisador indispon\xEDvel",
      analysis_unavailable: "An\xE1lise indispon\xEDvel \u2014 confira na carteira antes de continuar.",
      dados_parciais_title: "Dados parciais \u2014 confirme na carteira",
      dados_parciais_subtitle: "Exibindo o que foi poss\xEDvel analisar. Verifique os detalhes na carteira antes de continuar.",
      risk_low: "Baixo",
      risk_warn: "Aten\xE7\xE3o",
      risk_high: "Alto",
      risk_block: "Bloqueado",
      trustReasonAllowlistedMatched: "Dom\xEDnio em allowlist: {matched}.",
      list_empty_domains: "Lista vazia. Abra as op\xE7\xF5es para adicionar dom\xEDnios confi\xE1veis.",
      btn_open_options: "Abrir op\xE7\xF5es",
      default_human_switch_what: "Troca a rede ativa da carteira (ex.: Ethereum \u2192 outra rede).",
      default_human_switch_risk: "Voc\xEA pode assinar/transacionar na rede errada se a troca n\xE3o for esperada.",
      default_human_switch_safe: "Confirme a rede solicitada e se o site \xE9 o correto.",
      default_human_switch_next: "Se estiver certo, aprove na carteira. Se estiver estranho, cancele.",
      default_human_contract_what: "Envia uma transa\xE7\xE3o para um contrato (a\xE7\xE3o dentro do dApp).",
      default_human_contract_risk: "O custo real pode variar e a a\xE7\xE3o pode mover ativos/tokens via contrato.",
      default_human_contract_safe: "Confira destino (to), rede, valor e a taxa (Network fee) na carteira.",
      default_human_contract_next: "Se os detalhes baterem, prossiga. Caso contr\xE1rio, cancele.",
      default_human_eth_what: "Envia ETH diretamente para um endere\xE7o.",
      default_human_eth_risk: "Transfer\xEAncias s\xE3o irrevers\xEDveis se o destino estiver errado.",
      default_human_eth_safe: "Verifique o endere\xE7o e o valor. Desconfie de links/encurtadores.",
      default_human_eth_next: "S\xF3 confirme se voc\xEA reconhece o destinat\xE1rio.",
      default_human_typed_what: "Assinatura off-chain (EIP-712). Pode autorizar a\xE7\xF5es sem pagar gas.",
      default_human_typed_risk: "Pode conceder permiss\xF5es/autoriza\xE7\xF5es (ex.: permit/approval) dependendo do conte\xFAdo.",
      default_human_typed_safe: "Revise o que est\xE1 sendo autorizado (spender/operator) e o dom\xEDnio/contrato.",
      default_human_typed_next: "Se n\xE3o entender, cancele e valide no site oficial do dApp.",
      default_human_generic_what: "A\xE7\xE3o solicitada pela dApp.",
      default_human_generic_risk: "Se algo n\xE3o fizer sentido, cancele.",
      default_human_generic_safe: "Confirme dom\xEDnio, rede e detalhes na carteira.",
      default_human_generic_next: "Prossiga apenas se tudo estiver correto.",
      verdict_ok: "OK",
      verdict_warn: "Aten\xE7\xE3o",
      verdict_high: "Risco alto",
      verdict_block: "Bloqueado",
      coverage_label: "Cobertura",
      coverage_limited: "cobertura limitada",
      trusted_domain_ref_empty: "Lista de refer\xEAncia ainda n\xE3o carregou.",
      trusted_domain_ref_loading: "Carregando lista de refer\xEAncia\u2026",
      trusted_domain_ref_refresh: "Atualizar listas",
      trusted_domain_ref_view_more: "Ver mais",
      trusted_domains_loading: "Carregando lista de refer\xEAncia\u2026",
      trusted_domains_more: "+{n}",
      trusted_domains_search_placeholder: "Filtrar dom\xEDnios\u2026",
      trusted_domains_update_now: "Atualizar agora",
      trusted_domains_auto_update: "Atualiza automaticamente nas op\xE7\xF5es",
      banner_ok_no_known_threats: "OK: nenhum sinal conhecido de golpe/scam detectado.",
      banner_block_known_threat: "Bloqueado: amea\xE7a conhecida detectada.",
      banner_local_verification: "Aten\xE7\xE3o: verifica\xE7\xE3o local (cache). Revise os detalhes abaixo antes de prosseguir.",
      banner_basic_verification: "Aten\xE7\xE3o: verifica\xE7\xE3o b\xE1sica. Revise cuidadosamente os detalhes antes de prosseguir.",
      list_site_reputation: "Reputa\xE7\xE3o do site",
      list_site_trusted: "Confi\xE1vel",
      list_site_blocked: "Bloqueado",
      list_site_unknown: "Desconhecido",
      updated_x_hours: "Base atualizada h\xE1 {n} hora(s)",
      updated_x_days: "Base atualizada h\xE1 {n} dia(s)",
      tip_check_wallet_details: "Confira valor, rede e taxa na carteira.",
      no_alerts_known: "Nenhum alerta conhecido foi detectado para este contexto.",
      still_review_wallet: "Mesmo assim, revise na carteira (valor, rede, destino e taxa).",
      site_status_known: "refer\xEAncia conhecida",
      site_status_not_in_list: "Site n\xE3o est\xE1 na lista de refer\xEAncia",
      destination_contract: "Contrato",
      destination_wallet: "Carteira"
    },
    en: {
      tech_displayAction: "Action (classification)",
      tech_methodRaw: "Method (raw)",
      tech_recommendScoreLevel: "Recommend/score/level",
      tech_reasons: "Reasons",
      tech_decoded: "Decoded",
      dash: "\u2014",
      tx_to: "To",
      tx_data_length: "Data length",
      more_whatItDoes: "What it does",
      more_risks: "Risks",
      more_safeNotes: "Safety notes",
      more_nextSteps: "Next steps",
      // Brand
      extName: "Crypto Wallet SignGuard",
      // Overlay - generic labels
      overlay_requested_title: "What is being requested",
      overlay_site_trusted_title: "Is the site trusted?",
      overlay_summary_title: "Summary (plain language)",
      overlay_recommended_title: "Recommended action",
      overlay_note_title: "Note",
      // Overlay - details sections
      details_tx_title: "Transaction details",
      details_tech_title: "Technical details",
      details_more_title: "More explanations",
      // Queue
      queue_indicator: "Queue: {pos} of {total}",
      // Action titles
      action_CONNECT_title: "Connect wallet",
      action_REQUEST_PERMISSIONS_title: "Request permissions",
      action_SWITCH_CHAIN_title: "Switch network",
      action_ADD_CHAIN_title: "Add network",
      action_SIGN_MESSAGE_title: "Sign message",
      action_SIGN_TYPED_DATA_title: "Sign typed data",
      action_SEND_TX_title: "Send transaction",
      action_SEND_TX_contract_title: "Contract interaction",
      action_SEND_TX_eth_title: "Send ETH",
      action_WATCH_ASSET_title: "Add token/asset",
      action_SOLANA_title: "Solana signature/transaction",
      action_UNKNOWN_title: "Request",
      // Summary bullets
      summary_CONNECT_1: "The site wants to see your addresses and current network.",
      summary_CONNECT_2: "It may request signatures/transactions later.",
      summary_CONNECT_3: "Only connect if you trust the site.",
      summary_REQUEST_PERMISSIONS_1: "The site is requesting additional wallet permissions.",
      summary_REQUEST_PERMISSIONS_2: "Review permissions in your wallet before accepting.",
      summary_SWITCH_CHAIN_1: "The site wants to switch your wallet network (chain).",
      summary_SWITCH_CHAIN_2: "Switching networks usually costs no gas.",
      explain_connect_title: "Connect wallet",
      explain_connect_short: "Wallet login (share your public address)",
      explain_connect_why: "This lets the site show your account and ask for signatures/approvals/transactions later.",
      explain_sign_title: "Sign a message",
      explain_sign_short: "No gas, but signatures can authorize actions",
      explain_sign_why: "Sites use signatures to log in, verify ownership, or authorize off-chain actions.",
      explain_typed_title: "Sign structured data",
      explain_typed_short: "Typed-data signatures can include permits/authorizations",
      explain_typed_why: "Typed-data is often used for permits (token approvals without a separate on-chain approve).",
      explain_tx_title: "Send a transaction",
      explain_tx_short: "On-chain action (gas fees may apply)",
      explain_tx_why: "This will create an on-chain transaction if you approve it in your wallet.",
      explain_switch_title: "Switch network",
      explain_switch_why: "Some sites require a specific network to function.",
      explain_addchain_title: "Add network",
      explain_addchain_short: "Add a new chain configuration to your wallet",
      explain_add_chain_short: "Add network to wallet",
      add_chain_review_rpc: "Malicious RPC can deceive balances/transactions; verify the source.",
      add_chain_verify_chainid: "Verify chainId and network name before adding.",
      explain_addchain_why: "Wallet may add RPC details for a chain requested by the site.",
      explain_watchasset_title: "Watch asset",
      explain_watchasset_short: "Add a token/asset to your wallet UI",
      explain_watch_asset_short: "Add token/asset to wallet",
      watch_asset_no_spend_but_risk: "Adding a token does not spend funds, but scam tokens exist; verify the contract.",
      watch_asset_verify_contract: "Verify the contract address on a trusted explorer.",
      explain_watchasset_why: "This does not spend funds, but confirm the token details are correct.",
      explain_generic_title: "Wallet request",
      explain_generic_short: "A site is requesting a wallet action",
      explain_generic_why: "Review details in your wallet and confirm the site URL.",
      human_connect_whatIs: "Connects your wallet address to this site (like logging in).",
      human_connect_sees_1: "Your public address (and account selection)",
      human_connect_sees_2: "Your network/chain selection",
      human_connect_sees_3: "Public on-chain activity (tokens/NFTs are public data)",
      human_connect_not_1: "It does NOT reveal your seed phrase or wallet password",
      human_connect_not_2: "It does NOT move funds automatically by itself",
      human_connect_why_1: "To show your account and balances in the UI",
      human_connect_why_2: "To let you sign messages (login/verification)",
      human_connect_why_3: "To request approvals/transactions later (with your confirmation)",
      human_connect_risk_1: "Privacy/tracking: it can link your address to this site",
      human_connect_risk_2: "Phishing steps: next prompts may ask for signatures/approvals",
      human_connect_risk_3: "Lookalike domains: fake sites often start with a harmless connect",
      human_connect_safe_1: "Treat connect like sharing an identity: only do it on sites you recognize.",
      human_connect_next_1: "Double-check the domain (spelling, HTTPS, no punycode)",
      human_connect_next_2: "If unsure, cancel and open the site from a trusted bookmark",
      human_connect_reco_suspicious: "Cancel and verify the URL in another way (bookmark/search), then try again.",
      human_connect_reco_ok: "Continue only if you recognize the site and the URL looks right.",
      human_sign_whatIs: "Creates a cryptographic signature. It usually does not cost gas, but it can authorize actions.",
      human_sign_risk_1: "Signing unknown text can approve off-site actions or logins you didn't intend",
      human_sign_risk_2: "Blind signing can hide what you're authorizing",
      human_typed_whatIs: "Signs structured data (typed-data). Often used for permits/authorizations.",
      human_typed_risk_1: "Typed-data may include token permits that behave like approvals",
      human_sign_safe_1: "Prefer wallets that show clear human-readable signing details.",
      human_sign_next_1: "Verify the site URL and read the message/typed-data carefully",
      human_sign_next_2: "If you see vague prompts, cancel and ask the site for context",
      human_sign_reco_suspicious: "Cancel. Suspicious domains + signature prompts are a common phishing pattern.",
      human_sign_reco_ok: "Only continue if you understand what the signature is for and trust the site.",
      human_approve_whatIs: "An approval lets a contract spend your tokens later (up to the approved amount).",
      human_approve_risk_1: "Approvals can be abused if the spender contract is malicious or compromised",
      human_approve_risk_unlimited: "Unlimited approval means it may spend ALL your token balance",
      human_approve_safe_1: "Prefer approving the minimum needed amount whenever possible.",
      human_approve_next_1: "Check the spender address/operator and whether you recognize the dApp",
      human_approve_next_2: "Consider revoking approvals later if you no longer use the site",
      human_approve_reco: "Continue only if you trust the site and the spender makes sense.",
      human_approve_reco_unlimited: "Avoid unlimited approvals unless you strongly trust the site and understand the risk.",
      human_setApprovalForAll_whatIs: "Gives an operator permission to move ALL NFTs in a collection on your behalf.",
      human_setApprovalForAll_risk_1: "This can allow draining NFTs if the operator is malicious or compromised",
      human_setApprovalForAll_safe_1: "Only approve operators you fully recognize (e.g., known marketplaces).",
      human_setApprovalForAll_next_1: "Verify the operator address and confirm the site is the intended marketplace",
      human_setApprovalForAll_reco: "Cancel unless you are on a recognized marketplace and expect this action.",
      human_tx_whatIs: "This will create an on-chain transaction if you approve it in your wallet.",
      human_tx_risk_1: "Transactions can move funds or change permissions depending on the contract call",
      human_tx_safe_1: "Always verify recipient, value, and the contract you're interacting with.",
      human_tx_next_1: "Check the destination (to), value, and decoded action (if available)",
      human_tx_reco_suspicious: "Cancel. Do not send transactions from suspicious domains.",
      human_tx_reco_ok: "Continue only if you intended this action and the details look correct.",
      human_chain_whatIs: "Changes the selected network in your wallet.",
      human_chain_risk_1: "Wrong networks/RPCs can mislead you about assets or transactions",
      human_chain_safe_1: "Only switch/add networks you recognize.",
      human_chain_next_1: "Confirm chain name and chainId in the wallet prompt",
      human_watchasset_whatIs: "Adds a token/asset to your wallet UI for easier viewing.",
      human_watchasset_risk_1: "Fake tokens can impersonate real ones\u2014verify contract address and symbol",
      human_watchasset_safe_1: "Cross-check token details on a trusted explorer (e.g., Etherscan).",
      human_watchasset_next_1: "Verify token contract address and decimals",
      human_watchasset_reco: "Continue only if token details match an official source.",
      human_generic_whatIs: "A site requested a wallet action. Review details carefully.",
      human_generic_risk_1: "Unknown prompts can be part of phishing flows",
      human_generic_safe_1: "If in doubt, cancel and verify the site.",
      human_generic_next_1: "Check the URL and read the wallet prompt details",
      human_generic_reco: "Continue only if you understand and expected this request.",
      human_revoke_link_text: "Revoke permissions later: revoke.cash",
      trustReasonNotHttps: "Not HTTPS (higher risk of spoofing/injection).",
      trustReasonManyHyphens: "Many hyphens in the domain (common in lookalikes).",
      trustReasonSuspiciousKeywords: "Domain contains high-risk keywords (login/verify/secure/...).",
      trustReasonBrandLookalike: "Brand-like wording in domain but not the official domain.",
      trustReasonManySubdomains: "Unusually deep subdomain structure.",
      trustReasonNoHost: "Could not read the site hostname.",
      trustReasonAllowlistedVariant: "Domain matches a trusted pattern.",
      trustReasonUnknown: "No strong signals either way.",
      summary_ADD_CHAIN_1: "The site wants to add a new network to your wallet.",
      summary_ADD_CHAIN_2: "Carefully verify the chainId and network name.",
      summary_SIGN_MESSAGE_1: "You are signing a message (not a transaction).",
      summary_SIGN_MESSAGE_2: "Signatures can be used for logins/terms/permissions.",
      summary_SIGN_TYPED_DATA_1: "You are signing structured data (EIP-712).",
      summary_SIGN_TYPED_DATA_2: "This may authorize spending/orders depending on the content.",
      summary_SIGN_TYPED_DATA_3: "Verify the spender/contract involved.",
      summary_SEND_TX_1: "You are sending an on-chain transaction.",
      summary_SEND_TX_2: "This may move ETH/tokens or interact with a contract.",
      summary_SEND_TX_3: "Verify value, network and destination before confirming.",
      summary_WATCH_ASSET_1: "The site wants to add a token/asset to your wallet.",
      summary_WATCH_ASSET_2: "Verify the token symbol and contract address.",
      summary_SOLANA_1: "Solana signature or transaction. Values will be confirmed in your wallet.",
      summary_UNKNOWN_1: "The site is making an unknown wallet request.",
      summary_UNKNOWN_2: "If you don't recognize it, cancel.",
      // Buttons / friction
      btn_cancel: "Cancel",
      btn_continue: "Continue",
      toast_request_expired: "Request expired. Please retry the action on the site.",
      simulation_tx_will_fail: "THIS TRANSACTION WILL FAIL",
      btn_close: "Close",
      btn_proceed_anyway: "Proceed anyway",
      override_checkbox: "I understand the risk and want to proceed",
      override_countdown: "({s}s)",
      tip_revoke: "Revoke permissions later: revoke.cash",
      cost_summary_title: "Cost summary",
      costs_title: "Costs and impact",
      impact_title: "Impact",
      permission_for: "Permission for",
      addr_marked_public: "Flagged in public database",
      risk_title: "Risk and why",
      what_to_do_now: "What to do now",
      site_label: "Site",
      network_label: "Network",
      severity_BLOCKED: "BLOCKED",
      severity_HIGH: "HIGH",
      severity_WARN: "WARNING",
      severity_LOW: "LOW",
      cost_you_send: "You send",
      cost_fee_only: "fee only",
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
      gas_calculating: "calculating\u2026",
      tx_destination: "Destination",
      token_verified_uniswap: "Token Verified (Uniswap List)",
      token_unknown_unverified: "Token Unknown (Not Verified)",
      tx_contract_method: "Contract/method",
      tx_max_gas_fee: "Max gas fee (ETH)",
      tx_max_total: "Max total (ETH)",
      tx_fee_estimated_by_wallet: "The wallet will estimate the fee in the next step.",
      network_target: "Target network",
      switch_no_gas: "Switching networks usually costs NO gas.",
      switch_next_step_gas: "The next step (purchase/transaction) will have a network fee.",
      switch_note_inline: "Switching networks usually costs NO gas. The next step (purchase/transaction) will have a network fee.",
      sendtx_reco: "Confirm in your wallet only if the details (value, network and contract) are correct.",
      // Risk/trust labels
      risk_LOW: "Low",
      risk_WARN: "Warning",
      risk_HIGH: "High",
      recommend_ALLOW: "Allow",
      recommend_WARN: "Warn",
      recommend_HIGH: "High risk",
      recommend_BLOCK: "Block",
      trust_unknown: "Unknown",
      trust_suspicious: "Suspicious",
      trust_likelyOfficial: "Known domain (reference list)",
      trust_domainNotRecognized: "Domain not recognized",
      // Phishing hard-block
      phishing_hard_block: "Domain is in a phishing blacklist. Blocked.",
      // Toasts
      toast_extension_updated: "Extension updated \u2014 reload the tab.",
      toast_cannot_analyze: "Couldn't analyze. Reload the tab.",
      // Options page
      optionsTitle: "Crypto Wallet SignGuard \u2014 Settings",
      optionsSubtitle: "Control when SignGuard should warn and block.",
      dashboardLink: "Dashboard",
      onboardingTitle: "How to use",
      onboardingHowTo: "The extension intercepts sensitive requests (connect, sign, transaction) from injected wallets (window.ethereum / window.solana). When detected, it shows an overlay for you to review before the wallet opens.",
      onboardingWhatItDoes: "Does: warns before connecting, signing, or sending; checks domain against phishing lists; shows transaction intent (swap, NFT, approval).",
      onboardingWhatItDoesNot: "Does not: protect QR/WalletConnect connections; guarantee contracts are safe; replace manual verification.",
      onboardingLinkRevoke: "revoke.cash \u2014 revoke permissions",
      onboardingLinkEtherscan: "Etherscan \u2014 explore transactions",
      exportDebugRequiresDebugMode: "Enable Debug Mode first to export events.",
      securityModeLabel: "Security mode",
      securityModeDesc: "Strict blocks more; Balanced warns; Relaxed reduces friction; Off disables blocking.",
      modeStrict: "Strict",
      modeBalanced: "Balanced",
      modeRelaxed: "Relaxed",
      modeOff: "Off",
      strictBlockApprovalsUnlimitedLabel: "Strict: block unlimited approve",
      strictBlockApprovalsUnlimitedDesc: "Blocks ERC20 unlimited approvals (MAX_UINT256).",
      strictBlockSetApprovalForAllLabel: "Strict: block setApprovalForAll",
      strictBlockSetApprovalForAllDesc: "Blocks permission to move all NFTs.",
      strictBlockPermitLikeLabel: "Strict: block unlimited Permit",
      strictBlockPermitLikeDesc: "Blocks Permit (EIP-2612) unlimited signatures.",
      assetEnrichmentEnabledLabel: "Asset enrichment",
      assetEnrichmentEnabledDesc: "Fetches token symbol/name via eth_call.",
      addressIntelEnabledLabel: "Address threat intel",
      addressIntelEnabledDesc: "Checks spender/operator/to against blacklist.",
      riskWarningsLabel: "Risk warnings",
      riskWarningsDesc: "Shows warnings and recommendations before opening your wallet.",
      connectOverlayLabel: "Overlay on connect",
      connectOverlayDesc: "Also show the overlay for connect/permissions requests.",
      blockHighRiskLabel: "Block high risk",
      blockHighRiskDesc: "Automatically blocks high-risk actions.",
      requireTypedOverrideLabel: "Require override for typed data (high risk)",
      requireTypedOverrideDesc: "For high-risk EIP-712 signatures, requires extra confirmation.",
      allowOverrideOnPhishingLabel: "Allow override on phishing (NOT recommended)",
      allowOverrideOnPhishingDesc: "If disabled (default), phishing blacklist matches are blocked with no option to proceed.",
      mode_off_reason: "OFF mode: no blocking.",
      address_flagged_reason: "Flagged address/contract: {label} ({category})",
      addr_sanctioned_block: "Address is on a sanctions list.",
      addr_scam_reported_warn: "Address marked as suspected/reported.",
      addr_phishing_reported_warn: "Address marked as suspected/reported.",
      addr_malicious_contract_warn: "Contract marked as malicious.",
      asset_info_reason: "Asset: {sym} ({kind})",
      reason_permission_tokens: "Permission to spend tokens",
      reason_permission_all_nfts: "Permission to move ALL NFTs",
      reason_transfer_tokens: "Token/NFT transfer",
      domainChecksLabel: "Domain checks",
      domainChecksDesc: "Warns about suspicious domain patterns when not on your allowlist.",
      allowlistLabel: "Allowlist (trusted domains)",
      allowlistDesc: "One domain per line. Example: opensea.io",
      vaultTitle: "SignGuard Vault",
      vaultDesc: "Contracts in this list can never be transacted without explicit unlock in options.",
      vaultAddLabel: "Add contract to vault",
      vaultAddButton: "Add to Vault",
      vaultListLabel: "Locked contracts",
      vaultListEmpty: "No contracts in vault.",
      vaultRemove: "Remove",
      vaultInvalidAddress: "Invalid address. Use 0x and 40 hex characters.",
      vaultAlreadyAdded: "This contract is already in the vault.",
      vaultBlockedMessage: "SignGuard: Asset Locked in Vault. Unlock in options to continue.",
      addSuggested: "Add suggested",
      save: "Save",
      saved: "Saved",
      intelTitle: "Threat Intel",
      intelSubtitle: "Domain lists (pluggable sources) used in analysis.",
      intelTrustedCountLabel: "Trusted domains",
      intelBlockedCountLabel: "Blocked domains",
      intelBlockedAddressCountLabel: "Blocked addresses",
      intelUpdatedAtLabel: "Last update",
      intelUpdateNow: "Update now",
      enableIntelLabel: "Use Threat Intel",
      enableIntelDesc: "Uses trusted/blocked domain lists in analysis.",
      customTrustedDomainsLabel: "Trusted domains (custom list)",
      customTrustedDomainsDesc: "One per line. Example: mysite.io",
      customBlockedDomainsLabel: "Blocked domains (custom list)",
      customBlockedDomainsDesc: "One per line. Always blocked.",
      exportListsLabel: "Export lists",
      privacyLimitsTitle: "Privacy & Limitations",
      privacyLimitsLine1: "The extension does not access your seed phrase and has no custody.",
      privacyLimitsLine2: "It analyzes domains and transaction data displayed by the browser for alerts. No 100% guarantee.",
      privacyLimitsLine3: "Threat intel may be updated from public sources (optional).",
      cloudIntelOptInLabel: "Allow external checks",
      cloudIntelOptInDesc: "More protection; may send domain/addresses for validation (prepared for P1).",
      showUsdLabel: "Show USD values",
      showUsdDesc: "Shows an approximate USD value next to ETH amounts.",
      tabSettings: "Settings",
      tabHistory: "History",
      tabPlan: "Plan",
      historySubtitle: "Recent overlay decisions.",
      historyExport: "Export JSON",
      historyClear: "Clear",
      historyEmpty: "No entries.",
      request_expired_toast: "Request expired. Redo the action on the site and try again.",
      failopen_armed_banner: "Analysis took too long. You can Continue anyway or Cancel.",
      decision_allow: "Allowed",
      decision_block: "Blocked",
      planSubtitle: "Manage your plan and license.",
      planCurrent: "Current plan",
      planLicenseKey: "License key",
      planActivate: "Activate",
      planGoPro: "Subscribe PRO",
      // Options: Safety notes + debug
      safetyNotesTitle: "Limitations & security",
      safetyNotesLine1: "This extension monitors requests from injected wallets (window.ethereum / window.solana).",
      safetyNotesLine2: "Connections via QR/WalletConnect may not be intercepted. Always verify in your wallet.",
      safetyNotesLinkRevoke: "revoke.cash",
      safetyNotesLinkEtherscan: "etherscan.io",
      debugModeLabel: "Debug mode",
      debugModeDesc: "Stores the last 20 events (without large payloads) for support.",
      exportDebug: "Export",
      // Overlay: intent + permission + copy
      looks_like: "Looks like:",
      intent_NFT_PURCHASE: "NFT purchase",
      intent_SWAP: "Swap",
      intent_APPROVAL: "Permission",
      intent_SEND: "Send",
      intent_UNKNOWN: "Unknown",
      intent_ETH_TRANSFER: "ETH transfer",
      intent_TOKEN_TRANSFER: "Token transfer",
      intent_NFT_TRANSFER: "NFT transfer",
      intent_CONTRACT_INTERACTION: "Contract interaction",
      intent_SWITCH_CHAIN: "Network switch",
      intent_ADD_CHAIN: "Add network",
      intent_WATCH_ASSET: "Add token",
      intent_SOLANA: "Solana signature/transaction",
      intent_SIGNATURE: "Signature",
      intent_TYPED_DATA: "Typed data",
      wallet_label: "Wallet",
      wallet_detecting: "Detecting\u2026",
      wallet_evm_generic: "EVM Wallet",
      trust_disclaimer: "Reference list \u2260 guarantee. Scammers may use similar domains.",
      hint_wallet_popup: "Your wallet should open now. If it doesn't, click the wallet icon and check for pending requests.",
      add_chain_network_label: "Network to add",
      add_chain_rpc_label: "RPC",
      watch_asset_token_label: "Token to add",
      modeLabel: "Mode:",
      popupPauseProtection: "PAUSE PROTECTION",
      popupStatusProtected: "Protected",
      popupStatusPaused: "Paused",
      fortressModeLabel: "FORTRESS MODE",
      fortressModeDesc: "Blocks all token approvals except on trusted sites.",
      fortress_block_message: "SignGuard Fortress: Approval blocked on unknown site. Disable Fortress mode to proceed.",
      honeypot_message: "\u{1FAA4} HONEYPOT: You can buy, but you will NOT be able to sell.",
      info_unavailable: "Information unavailable.",
      explain_switch_short: "The site is requesting a network (chain) switch in your wallet.",
      human_chain_reco: "Continue only if you expected a network switch and it looks correct.",
      trustReasonAllowlisted: "Domain is present in a trusted seed list.",
      trustReasonPhishingBlacklist: "Domain is in a phishing blacklist (reference list).",
      fee_unknown_wallet_will_estimate: "Fee: will be displayed by wallet",
      label_you_send: "You send",
      label_fee_likely: "Estimated fee (likely)",
      label_fee_max: "Max fee (worst case)",
      label_total_likely: "Total likely",
      label_total_max: "Total max",
      fee_gt_value: "The max fee is HIGHER than the value being sent. Make sure this is expected.",
      check_wallet_network_fee: "You haven't seen the fee yet. Check the wallet 'Network fee' before confirming.",
      label_max_fee: "Max fee (ETH)",
      label_max_total: "Max total (ETH)",
      switch_summary_no_gas: "Switching networks usually has no gas fee, but it changes which assets you see.",
      permission_title: "Permission",
      permission_token_contract: "Contract",
      permission_spender: "Spender",
      permission_operator: "Operator",
      permission_unlimited: "Unlimited",
      approval_unlimited_detected: "Unlimited approval detected",
      permit_signature_detected: "Permit-style signature detected (may authorize token spending)",
      token_transfer_detected: "Token transfer detected",
      nft_transfer_detected: "NFT transfer detected",
      transfer_token_title: "Token transfer",
      transfer_nft_title: "NFT transfer",
      transfer_amount: "Amount",
      transfer_token_id: "Token ID",
      yes: "Yes",
      no: "No",
      copy: "Copy",
      chainChangeTitle: "Network switch/add request",
      watchAssetTitle: "Add asset request",
      domainPunycodeReason: "Domain uses punycode (xn--); verify the URL.",
      domainDoubleDashReason: "Domain contains double hyphen (suspicious).",
      domainNumberPatternReason: "Domain with many numbers (common in phishing).",
      domainLookalikeReason: "Possible lookalike of official domain {legit}.",
      suspiciousWebsitePatterns: "Suspicious website patterns.",
      page_risk_suspicious_banner: "\u26A0\uFE0F SignGuard: Suspicious Site Detected",
      connectTitle: "Connect wallet",
      connectReason: "The site wants to connect to your wallet.",
      walletRequestPermissionsTitle: "Request permissions",
      walletRequestPermissionsReason: "The site wants additional wallet permissions.",
      typedDataWarnReason: "Structured data signature (EIP-712); may authorize actions.",
      signatureRequest: "Signature request",
      rawSignWarnReason: "Raw message signature; may authorize off-chain actions.",
      tokenApproval: "Token approval",
      unlimitedApprovalReason: "Unlimited approval detected (MAX_UINT256).",
      unlimitedApprovalDetected: "Unlimited approval detected",
      nftOperatorApprovalReason: "Permission to move ALL NFTs in the collection.",
      nftOperatorApproval: "NFT operator approval",
      txPreview: "Transaction preview",
      txWarnReason: "On-chain transaction; verify value, destination and network.",
      unknownMethodReason: "Unknown wallet method.",
      warningsDisabledReason: "Warnings disabled in settings.",
      analyzing: "Analyzing\u2026",
      analyzing_subtitle: "Site \u2022 Method",
      analyzing_hint: "Validating domain and estimating impact",
      fallback_partial_check: "No full verification right now \u2014 review the details below before proceeding.",
      fallback_partial_verification: "Partial verification now \u2014 review the details below before proceeding.",
      loading_base: "Loading base\u2026",
      analyzerUnavailableTitle: "Analyzer unavailable",
      analysis_unavailable: "Analysis unavailable \u2014 verify in your wallet before continuing.",
      dados_parciais_title: "Partial data \u2014 confirm in wallet",
      dados_parciais_subtitle: "Showing what we could analyze. Verify details in your wallet before continuing.",
      risk_low: "Low",
      risk_warn: "Warning",
      risk_high: "High",
      risk_block: "Blocked",
      trustReasonAllowlistedMatched: "Domain in allowlist: {matched}.",
      list_empty_domains: "List empty. Open options to add trusted domains.",
      btn_open_options: "Open options",
      default_human_switch_what: "Switches the active network in your wallet (e.g. Ethereum \u2192 another network).",
      default_human_switch_risk: "You may sign/transact on the wrong network if the switch is unexpected.",
      default_human_switch_safe: "Confirm the requested network and that the site is correct.",
      default_human_switch_next: "If correct, approve in the wallet. If something looks wrong, cancel.",
      default_human_contract_what: "Sends a transaction to a contract (action within the dApp).",
      default_human_contract_risk: "Actual cost may vary and the action may move assets/tokens via the contract.",
      default_human_contract_safe: "Check destination (to), network, value and fee (Network fee) in the wallet.",
      default_human_contract_next: "If details match, proceed. Otherwise, cancel.",
      default_human_eth_what: "Sends ETH directly to an address.",
      default_human_eth_risk: "Transfers are irreversible if the destination is wrong.",
      default_human_eth_safe: "Verify the address and amount. Be wary of links/shorteners.",
      default_human_eth_next: "Only confirm if you recognize the recipient.",
      default_human_typed_what: "Off-chain signature (EIP-712). May authorize actions without paying gas.",
      default_human_typed_risk: "May grant permissions/authorizations (e.g. permit/approval) depending on content.",
      default_human_typed_safe: "Review what is being authorized (spender/operator) and the domain/contract.",
      default_human_typed_next: "If unsure, cancel and verify on the dApp\u2019s official site.",
      default_human_generic_what: "Action requested by the dApp.",
      default_human_generic_risk: "If something doesn\u2019t make sense, cancel.",
      default_human_generic_safe: "Confirm domain, network and details in the wallet.",
      default_human_generic_next: "Proceed only if everything looks correct.",
      verdict_ok: "OK",
      verdict_warn: "Warning",
      verdict_high: "High risk",
      verdict_block: "Blocked",
      coverage_label: "Coverage",
      coverage_limited: "limited coverage",
      trusted_domain_ref_empty: "Reference list has not loaded yet.",
      trusted_domain_ref_loading: "Loading reference list\u2026",
      trusted_domain_ref_refresh: "Update lists",
      trusted_domain_ref_view_more: "View more",
      trusted_domains_loading: "Loading reference list\u2026",
      trusted_domains_more: "+{n}",
      trusted_domains_search_placeholder: "Filter domains\u2026",
      trusted_domains_update_now: "Update now",
      trusted_domains_auto_update: "Updates automatically in options",
      banner_ok_no_known_threats: "OK: no known scam/threat signals detected.",
      banner_block_known_threat: "Blocked: known threat detected.",
      banner_local_verification: "Caution: local verification (cache). Review the details below before proceeding.",
      banner_basic_verification: "Caution: basic verification. Review the details carefully before proceeding.",
      list_site_reputation: "Site reputation",
      list_site_trusted: "Trusted",
      list_site_blocked: "Blocked",
      list_site_unknown: "Unknown",
      updated_x_hours: "Base updated {n} hour(s) ago",
      updated_x_days: "Base updated {n} day(s) ago",
      tip_check_wallet_details: "Verify amount, network and fee in your wallet.",
      no_alerts_known: "No known alerts were detected for this context.",
      still_review_wallet: "Still, review in your wallet (value, network, destination and fee).",
      site_status_known: "known reference",
      site_status_not_in_list: "Site is not on the reference list",
      destination_contract: "Contract",
      destination_wallet: "Wallet"
    }
  };
  function format(template, params) {
    if (!params) return template;
    return template.replace(/\{(\w+)\}/g, (_m, k) => k in params ? String(params[k]) : `{${k}}`);
  }
  function t(key, params) {
    const loc = detectLocale();
    const v = dict[loc]?.[key] || dict.en[key] || key;
    const rendered = format(v, params);
    if (rendered !== key) return rendered;
    try {
      const c = globalThis.chrome;
      const msg = c?.i18n?.getMessage?.(key);
      if (msg) return format(msg, params);
    } catch {
    }
    return rendered;
  }
  function tHasKey(key) {
    if (!key || typeof key !== "string") return false;
    const loc = detectLocale();
    if (dict[loc]?.[key]) return true;
    if (dict.en?.[key]) return true;
    try {
      const c = globalThis.chrome;
      if (c?.i18n?.getMessage?.(key)) return true;
    } catch {
    }
    return false;
  }

  // src/shared/utils.ts
  function clamp(n, a, b) {
    return Math.max(a, Math.min(b, n));
  }
  function escapeHtml(s) {
    const str = String(s ?? "");
    return str.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
  }

  // src/shared/normalize.ts
  function normMethod(m) {
    return String(m || "").trim();
  }

  // src/shared/classifyAction.ts
  function classifyByMethod(method) {
    const m = String(method || "").toLowerCase().trim();
    if (m === "eth_requestaccounts") return "CONNECT";
    if (m === "wallet_requestpermissions" || m === "wallet_getpermissions") return "REQUEST_PERMISSIONS";
    if (m === "wallet_switchethereumchain") return "SWITCH_CHAIN";
    if (m === "wallet_addethereumchain") return "ADD_CHAIN";
    if (m === "wallet_watchasset") return "WATCH_ASSET";
    if (m.startsWith("solana:")) return "SOLANA";
    if (m === "personal_sign" || m === "eth_sign") return "SIGN_MESSAGE";
    if (m === "eth_signtypeddata" || m === "eth_signtypeddata_v3" || m === "eth_signtypeddata_v4") return "SIGN_TYPED_DATA";
    if (m === "eth_sendtransaction" || m === "wallet_sendtransaction") return "SEND_TX";
    return "UNKNOWN";
  }
  function looksLikeTx(params) {
    const p0 = Array.isArray(params) ? params[0] : null;
    if (!p0 || typeof p0 !== "object") return false;
    const hasTo = typeof p0.to === "string" && p0.to.length > 0;
    const hasFrom = typeof p0.from === "string" && p0.from.length > 0;
    const hasDataOrValue = "data" in p0 || "value" in p0;
    return hasTo && hasFrom && hasDataOrValue;
  }
  function classifyAction(method, params) {
    const a = classifyByMethod(method);
    if (a !== "UNKNOWN") return a;
    if (looksLikeTx(params)) return "SEND_TX";
    return "UNKNOWN";
  }

  // src/shared/actionTexts.ts
  function actionTitle(action) {
    switch (action) {
      case "CONNECT":
        return "Conectar carteira";
      case "SWITCH_CHAIN":
        return "Trocar rede";
      case "ADD_CHAIN":
        return "Adicionar rede";
      case "REQUEST_PERMISSIONS":
        return "Conceder permiss\xF5es";
      case "SIGN_MESSAGE":
        return "Assinar mensagem";
      case "SIGN_TYPED_DATA":
        return "Assinar mensagem (Typed Data)";
      case "SEND_TX":
        return "Enviar transa\xE7\xE3o";
      case "WATCH_ASSET":
        return "Adicionar token \xE0 carteira";
      case "SOLANA":
        return "Assinatura/Transa\xE7\xE3o Solana";
      default:
        return "A\xE7\xE3o desconhecida";
    }
  }

  // src/shared/txExtract.ts
  function extractTx(params) {
    const p0 = Array.isArray(params) ? params[0] : null;
    if (!p0 || typeof p0 !== "object") return null;
    const to = typeof p0.to === "string" ? p0.to : void 0;
    const from = typeof p0.from === "string" ? p0.from : void 0;
    const valueHex = typeof p0.value === "string" ? p0.value : void 0;
    const dataLen = typeof p0.data === "string" ? p0.data.length : void 0;
    if (!to && !from && !valueHex && !dataLen) return null;
    return { to, from, valueHex, dataLen };
  }

  // src/shared/flowTracker.ts
  var FLOW_TTL_MS = 6e4;
  function newFlowState() {
    return { steps: [] };
  }
  function ingestRpc(flow, method, params) {
    const now = Date.now();
    flow.steps = flow.steps.filter((s) => now - s.ts < FLOW_TTL_MS);
    const m = String(method || "").toLowerCase().trim();
    if (m === "wallet_switchethereumchain") {
      const chainId = Array.isArray(params) ? params?.[0]?.chainId : void 0;
      flow.lastSwitchChainTs = now;
      flow.steps.push({ kind: "SWITCH_CHAIN", ts: now, chainId });
      return flow;
    }
    if (m === "eth_sendtransaction" || m === "wallet_sendtransaction") {
      const tx = Array.isArray(params) ? params[0] : void 0;
      flow.steps.push({ kind: "SEND_TX", ts: now, tx });
      return flow;
    }
    return flow;
  }
  function hasRecentSwitch(flow) {
    return !!flow.lastSwitchChainTs && Date.now() - flow.lastSwitchChainTs < FLOW_TTL_MS;
  }

  // src/shared/txMath.ts
  function hexToBigInt(hex) {
    if (!hex || typeof hex !== "string") return 0n;
    return BigInt(hex);
  }
  function weiToEthString(wei, decimals = 6) {
    const ONE = 10n ** 18n;
    const whole = wei / ONE;
    const frac = wei % ONE;
    const fracStr = frac.toString().padStart(18, "0").slice(0, decimals);
    return `${whole.toString()}.${fracStr}`.replace(/\.?0+$/, (m) => m === "." ? "" : m);
  }

  // src/format.ts
  function weiToEthString2(wei, decimals = 6) {
    const neg = wei < 0n;
    const w = neg ? -wei : wei;
    const ethInt = w / 1000000000000000000n;
    const ethFrac = w % 1000000000000000000n;
    const fracStrFull = ethFrac.toString().padStart(18, "0");
    const frac = fracStrFull.slice(0, Math.max(0, decimals));
    const s = decimals > 0 ? `${ethInt.toString()}.${frac}` : ethInt.toString();
    return neg ? `-${s}` : s;
  }

  // src/shared/chains.ts
  var CHAINS = [
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
    { chainIdHex: "0x44d", name: "Polygon zkEVM", nativeSymbol: "ETH", coingeckoId: "ethereum", rpcUrls: ["https://zkevm-rpc.com"] }
  ];
  var byChainId = /* @__PURE__ */ new Map();
  for (const c of CHAINS) {
    const id = c.chainIdHex.toLowerCase();
    byChainId.set(id, c);
    const num = id.startsWith("0x") ? id : "0x" + id;
    if (num !== id) byChainId.set(num, c);
  }
  function getChainInfo(chainIdHex) {
    if (!chainIdHex) return null;
    const id = String(chainIdHex).toLowerCase();
    if (!id.startsWith("0x")) return byChainId.get("0x" + id) ?? null;
    return byChainId.get(id) ?? null;
  }
  function getNativeSymbol(chainIdHex) {
    const info = getChainInfo(chainIdHex);
    return info?.nativeSymbol ?? "ETH";
  }

  // src/runtimeSafe.ts
  var _port = null;
  function canUseRuntime() {
    try {
      const c = (typeof globalThis !== "undefined" ? globalThis.chrome : void 0) ?? (typeof chrome !== "undefined" ? chrome : void 0);
      return !!(c?.runtime?.id && typeof c.runtime.sendMessage === "function");
    } catch {
      return false;
    }
  }
  function isRuntimeUsable() {
    try {
      return canUseRuntime();
    } catch {
      return false;
    }
  }
  function getPort() {
    try {
      const c = (typeof globalThis !== "undefined" ? globalThis.chrome : void 0) ?? (typeof chrome !== "undefined" ? chrome : void 0);
      if (!canUseRuntime() || !c?.runtime?.connect) return null;
      if (_port) return _port;
      _port = c.runtime.connect({ name: "sg_port" });
      _port.onDisconnect.addListener(() => {
        _port = null;
        _portListenerInit = false;
      });
      return _port;
    } catch {
      _port = null;
      return null;
    }
  }
  var _portPending = /* @__PURE__ */ new Map();
  var _portListenerInit = false;
  function initPortListener() {
    const p = getPort();
    if (!p || _portListenerInit) return;
    _portListenerInit = true;
    p.onMessage.addListener((resp) => {
      const cb = resp?.requestId != null ? _portPending.get(String(resp.requestId)) : void 0;
      if (cb) {
        _portPending.delete(String(resp.requestId));
        try {
          cb(resp);
        } catch {
        }
      }
    });
  }
  function portRequest(msg, timeoutMs = 2500) {
    return new Promise((resolve) => {
      try {
        const p = getPort();
        if (!p) {
          resolve(null);
          return;
        }
        initPortListener();
        const requestId = typeof crypto?.randomUUID === "function" ? crypto.randomUUID() : `sg_${Date.now()}_${Math.random().toString(36).slice(2)}`;
        const payload = { ...msg, requestId };
        const timer = setTimeout(() => {
          if (_portPending.has(requestId)) {
            _portPending.delete(requestId);
            resolve(null);
          }
        }, timeoutMs);
        _portPending.set(requestId, (resp) => {
          clearTimeout(timer);
          resolve(resp != null ? resp : null);
        });
        try {
          p.postMessage(payload);
        } catch (e) {
          clearTimeout(timer);
          _portPending.delete(requestId);
          resolve(null);
        }
      } catch {
        resolve(null);
      }
    });
  }
  var DEFAULT_SEND_MS = 4e3;
  var RETRY_SEND_MS = 2500;
  function sendMessageOneAttempt(msg, timeoutMs) {
    return new Promise((resolve) => {
      let settled = false;
      const once = (value) => {
        if (settled) return;
        settled = true;
        resolve(value);
      };
      const c = (typeof globalThis !== "undefined" ? globalThis.chrome : void 0) ?? (typeof chrome !== "undefined" ? chrome : void 0);
      const rt = (() => {
        try {
          return c?.runtime ?? null;
        } catch {
          return null;
        }
      })();
      if (!rt || !rt.id || typeof rt.sendMessage !== "function") {
        once(null);
        return;
      }
      const timer = setTimeout(() => {
        once(null);
      }, timeoutMs);
      try {
        rt.sendMessage(msg, (resp) => {
          if (settled) return;
          clearTimeout(timer);
          try {
            const err = c?.runtime?.lastError;
            if (err) {
              once(null);
              return;
            }
            once(resp ?? null);
          } catch {
            once(null);
          }
        });
      } catch (e) {
        clearTimeout(timer);
        once(null);
      }
    });
  }
  function safeSendMessage(msg, options) {
    const timeoutMs = typeof options === "number" ? options : options?.timeoutMs ?? DEFAULT_SEND_MS;
    const preferPort = typeof options === "object" && options?.preferPort === true;
    if (preferPort) {
      return portRequest(msg, timeoutMs).then((r) => {
        if (r != null && r?.ok !== false) return r;
        return sendMessageOneAttempt(msg, timeoutMs).then((res) => {
          if (res != null) return res;
          return sendMessageOneAttempt(msg, RETRY_SEND_MS);
        });
      });
    }
    return sendMessageOneAttempt(msg, timeoutMs).then((r) => {
      if (r != null) return r;
      return sendMessageOneAttempt(msg, RETRY_SEND_MS);
    });
  }
  async function safeStorageGet(keys) {
    return new Promise((resolve) => {
      try {
        if (!isRuntimeUsable() || !chrome?.storage?.sync) {
          resolve({ ok: false, error: "storage_unavailable" });
          return;
        }
        chrome.storage.sync.get(keys, (items) => {
          try {
            const err = chrome.runtime.lastError;
            if (err) {
              resolve({ ok: false, error: err.message || String(err) });
              return;
            }
            resolve({ ok: true, data: items });
          } catch (e) {
            resolve({ ok: false, error: e?.message || String(e) });
          }
        });
      } catch (e) {
        resolve({ ok: false, error: e?.message || String(e) });
      }
    });
  }
  async function safeLocalGet(key) {
    return new Promise((resolve) => {
      try {
        if (!isRuntimeUsable() || !chrome?.storage?.local) {
          resolve(null);
          return;
        }
        chrome.storage.local.get(key, (r) => {
          try {
            const err = chrome.runtime.lastError;
            if (err) {
              resolve(null);
              return;
            }
            resolve(r?.[key] ?? null);
          } catch {
            resolve(null);
          }
        });
      } catch {
        resolve(null);
      }
    });
  }
  async function safeLocalSet(obj) {
    return new Promise((resolve) => {
      try {
        if (!isRuntimeUsable() || !chrome?.storage?.local) {
          resolve(false);
          return;
        }
        chrome.storage.local.set(obj, () => {
          try {
            const err = chrome.runtime.lastError;
            resolve(!err);
          } catch {
            resolve(false);
          }
        });
      } catch {
        resolve(false);
      }
    });
  }
  function safeGetURL(path) {
    try {
      if (!isRuntimeUsable() || !chrome.runtime.getURL) return "";
      return chrome.runtime.getURL(path);
    } catch {
      return "";
    }
  }

  // src/risk/domScanner.ts
  var SAFE_DOMAINS = [
    "google.com",
    "www.google.com",
    "youtube.com",
    "twitter.com",
    "x.com",
    "facebook.com",
    "instagram.com",
    "github.com",
    "discord.com",
    "linkedin.com",
    "whatsapp.com",
    "trello.com",
    "notion.so"
  ];
  var SAFE_DOMAINS_LIST = [
    "opensea.io",
    "uniswap.org",
    "uniswap.com",
    "metamask.io",
    "metamask.com",
    "etherscan.io",
    "etherscan.com",
    "pancakeswap.finance",
    "pancakeswap.com",
    "compound.finance",
    "aave.com",
    "ens.domains",
    "rainbow.me",
    "walletconnect.com",
    "walletconnect.org",
    "phantom.app",
    "solana.com"
  ];
  var LEVENSHTEIN_LOOKALIKE_THRESHOLD = 2;
  var HIGH_Z_INDEX_THRESHOLD = 99990;
  var COVER_RATIO_MIN = 0.7;
  function levenshtein(a, b) {
    const an = a.length;
    const bn = b.length;
    if (an === 0) return bn;
    if (bn === 0) return an;
    const row0 = new Array(bn + 1);
    const row1 = new Array(bn + 1);
    for (let j = 0; j <= bn; j++) row0[j] = j;
    for (let i = 1; i <= an; i++) {
      row1[0] = i;
      for (let j = 1; j <= bn; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        row1[j] = Math.min(
          row1[j - 1] + 1,
          row0[j] + 1,
          row0[j - 1] + cost
        );
      }
      for (let j = 0; j <= bn; j++) row0[j] = row1[j];
    }
    return row0[bn];
  }
  function normalizeHost(host) {
    return host.toLowerCase().replace(/^www\./, "").split("/")[0].trim();
  }
  function checkLookalikeDomain(hostname) {
    const host = normalizeHost(hostname);
    if (!host) return { highRisk: false };
    const exactMatch = SAFE_DOMAINS_LIST.some((d) => host === d || host.endsWith("." + d));
    if (exactMatch) return { highRisk: false };
    for (const safe of SAFE_DOMAINS_LIST) {
      const dist = levenshtein(host, safe);
      if (dist > 0 && dist <= LEVENSHTEIN_LOOKALIKE_THRESHOLD) {
        return { highRisk: true, matchedSafe: safe };
      }
    }
    return { highRisk: false };
  }
  function scanKeywordCombinations(text) {
    const lower = text.toLowerCase();
    const hasClaim = /\bclaim\b/i.test(lower);
    const hasAirdrop = /\bairdrop\b/i.test(lower);
    const hasConnectWallet = /\bconnect\s+wallet\b/i.test(lower) || /\bconnect\s+your\s+wallet\b/i.test(lower);
    const hasMigration = /\bmigration\b/i.test(lower);
    const hasEmergency = /\bemergency\b/i.test(lower);
    if (hasClaim && hasAirdrop && hasConnectWallet) return true;
    if (hasMigration && hasEmergency) return true;
    return false;
  }
  var MIN_CLICKABLE_AREA_PX = 300 * 300;
  var MIN_OPACITY_THRESHOLD = 0.1;
  function detectInvisibleClickables(doc) {
    try {
      const win = doc.defaultView;
      if (!win) return false;
      const candidates = doc.querySelectorAll("a, button, div[role='button']");
      for (let i = 0; i < candidates.length; i++) {
        const el = candidates[i];
        if (!(el instanceof HTMLElement)) continue;
        const style = win.getComputedStyle(el);
        if (!style) continue;
        const opacity = parseFloat(style.opacity);
        const pointerEvents = (style.pointerEvents || "").toLowerCase();
        const isOpacityNearZero = !Number.isNaN(opacity) && opacity < MIN_OPACITY_THRESHOLD;
        const hasRgbaZero = style.backgroundColor && /rgba?\s*\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*0\s*\)/.test(style.backgroundColor) || style.color && /rgba?\s*\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*0\s*\)/.test(style.color);
        const acceptsClicks = pointerEvents === "auto" || pointerEvents === "";
        if ((isOpacityNearZero || hasRgbaZero) && acceptsClicks) {
          const rect = el.getBoundingClientRect();
          const area = rect.width * rect.height;
          if (area >= MIN_CLICKABLE_AREA_PX) return true;
        }
      }
    } catch {
    }
    return false;
  }
  function detectSuspiciousOverlays(doc) {
    try {
      const viewportArea = (doc.defaultView?.innerWidth ?? 0) * (doc.defaultView?.innerHeight ?? 0);
      if (viewportArea <= 0) return false;
      const all = doc.querySelectorAll("iframe, div");
      for (let i = 0; i < all.length; i++) {
        const el = all[i];
        if (!(el instanceof HTMLElement)) continue;
        const style = doc.defaultView?.getComputedStyle(el);
        if (!style) continue;
        const zIndex = parseInt(style.zIndex, 10);
        const opacity = parseFloat(style.opacity);
        const pointerEvents = style.pointerEvents;
        const isHighZ = !Number.isNaN(zIndex) && zIndex >= HIGH_Z_INDEX_THRESHOLD;
        const isTransparent = !Number.isNaN(opacity) && opacity < 0.1;
        const isInvisibleButClicks = (isTransparent || style.visibility === "hidden") && pointerEvents !== "none";
        if (el.tagName.toLowerCase() === "iframe") {
          if (isTransparent || isHighZ && opacity < 0.5) {
            const rect = el.getBoundingClientRect();
            const area = rect.width * rect.height;
            if (area >= viewportArea * COVER_RATIO_MIN) return true;
          }
        }
        if (el.tagName.toLowerCase() === "div" && isHighZ) {
          const rect = el.getBoundingClientRect();
          const area = rect.width * rect.height;
          if (area >= viewportArea * COVER_RATIO_MIN && (isTransparent || isInvisibleButClicks)) return true;
        }
      }
    } catch {
    }
    return false;
  }
  function isWhitelistedDomain(hostname) {
    const host = normalizeHost(hostname);
    if (!host) return false;
    return SAFE_DOMAINS.some((d) => host === d || host.endsWith("." + d));
  }
  function runPageRiskScan(doc, hostname) {
    if (isWhitelistedDomain(hostname)) {
      return { riskScore: "LOW", reasons: [] };
    }
    const reasons = [];
    let riskScore = "LOW";
    const lookalike = checkLookalikeDomain(hostname);
    if (lookalike.highRisk) {
      riskScore = "HIGH";
      reasons.push(
        lookalike.matchedSafe ? `Domain looks like "${lookalike.matchedSafe}" but does not match (possible typo-squat).` : "Domain may be impersonating a known site."
      );
    }
    try {
      const bodyText = doc.body?.innerText ?? doc.documentElement?.innerText ?? "";
      if (bodyText && scanKeywordCombinations(bodyText)) {
        if (riskScore === "LOW") riskScore = "MEDIUM";
        reasons.push("Page text contains risky phrases (e.g. claim + airdrop + connect wallet, or migration + emergency).");
      }
    } catch {
    }
    if (detectSuspiciousOverlays(doc)) {
      if (riskScore === "LOW") riskScore = "MEDIUM";
      else if (riskScore === "MEDIUM") riskScore = "HIGH";
      reasons.push("Page has a transparent or high z-index overlay covering most of the screen (possible clickjacking).");
    }
    if (detectInvisibleClickables(doc)) {
      riskScore = "HIGH";
      reasons.push("HIDDEN_OVERLAY_DETECTED");
    }
    return { riskScore, reasons };
  }
  function injectPageRiskBanner(message, doc) {
    try {
      const id = "signguard-page-risk-banner";
      if (doc.getElementById(id)) return;
      const bar = doc.createElement("div");
      bar.id = id;
      bar.setAttribute("role", "alert");
      bar.textContent = message;
      Object.assign(bar.style, {
        position: "fixed",
        top: "0",
        left: "0",
        right: "0",
        zIndex: "999999",
        background: "#b91c1c",
        color: "#fff",
        padding: "12px 20px",
        fontSize: "16px",
        fontWeight: "700",
        textAlign: "center",
        fontFamily: "ui-sans-serif, system-ui, sans-serif",
        boxShadow: "0 2px 8px rgba(0,0,0,0.3)"
      });
      const root = doc.body ?? doc.documentElement;
      root.insertBefore(bar, root.firstChild);
    } catch {
    }
  }

  // src/features/adToast.ts
  var TOAST_ID = "sg-ad-toast-root";
  function renderAdToast(campaign, onClose, onCtaClick) {
    try {
      if (document.getElementById(TOAST_ID)) return;
      const host = document.createElement("div");
      host.id = TOAST_ID;
      const shadow = host.attachShadow({ mode: "closed" });
      const style = document.createElement("style");
      style.textContent = `
      .card {
        position: fixed;
        bottom: 20px;
        right: 20px;
        width: 320px;
        max-width: calc(100vw - 40px);
        background: #1e293b;
        border: 1px solid rgba(59, 130, 246, 0.4);
        box-shadow: 0 0 20px rgba(59, 130, 246, 0.15);
        border-radius: 12px;
        padding: 16px;
        font-family: system-ui, -apple-system, sans-serif;
        color: #f8fafc;
        z-index: 2147483646;
        animation: sgFadeIn 0.35s ease-out;
      }
      @keyframes sgFadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
      .head { display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; margin-bottom: 10px; }
      .title { font-size: 0.95rem; font-weight: 600; margin: 0; line-height: 1.3; }
      .close {
        flex-shrink: 0;
        width: 28px; height: 28px;
        border: none;
        background: rgba(148, 163, 184, 0.2);
        color: #94a3b8;
        border-radius: 6px;
        cursor: pointer;
        font-size: 1rem;
        line-height: 1;
        display: flex; align-items: center; justify-content: center;
      }
      .close:hover { background: rgba(148, 163, 184, 0.35); color: #f8fafc; }
      .body { font-size: 0.8rem; color: #94a3b8; line-height: 1.45; margin: 0 0 14px 0; }
      .cta {
        display: inline-block;
        padding: 8px 14px;
        background: #3b82f6;
        color: #fff;
        border: none;
        border-radius: 8px;
        font-size: 0.85rem; font-weight: 600;
        cursor: pointer;
        text-decoration: none;
      }
      .cta:hover { background: #2563eb; }
      .icon { font-size: 1.25rem; margin-right: 6px; }
    `;
      shadow.appendChild(style);
      const card = document.createElement("div");
      card.className = "card";
      const icon = (campaign.icon || "\u{1F6E1}\uFE0F").slice(0, 2);
      card.innerHTML = `
      <div class="head">
        <h3 class="title"><span class="icon">${escapeHtml2(icon)}</span>${escapeHtml2(campaign.title)}</h3>
        <button type="button" class="close" aria-label="Fechar">\xD7</button>
      </div>
      <p class="body">${escapeHtml2(campaign.body)}</p>
      <a href="${escapeHtml2(campaign.link)}" target="_blank" rel="noopener noreferrer" class="cta">${escapeHtml2(campaign.cta_text)}</a>
    `;
      shadow.appendChild(card);
      const closeBtn = shadow.querySelector(".close");
      const ctaEl = shadow.querySelector(".cta");
      closeBtn?.addEventListener("click", () => {
        host.remove();
        onClose();
      });
      ctaEl?.addEventListener("click", (e) => {
        onCtaClick();
      });
      document.documentElement.appendChild(host);
    } catch {
    }
  }
  function escapeHtml2(s) {
    const div = document.createElement("div");
    div.textContent = s;
    return div.innerHTML;
  }
  function dismissAdToast() {
    try {
      document.getElementById(TOAST_ID)?.remove();
    } catch {
    }
  }

  // src/content.ts
  function isContextInvalidated(msg) {
    const s = (msg || "").toLowerCase();
    return s.includes("extension context invalidated") || s.includes("context invalidated") || s.includes("the message port closed") || s.includes("runtime.lastError") || s.includes("receiving end does not exist") || s.includes("message port closed");
  }
  function showToast(text) {
    try {
      const el = document.createElement("div");
      el.className = "sg-toast";
      el.textContent = text;
      document.documentElement.appendChild(el);
      setTimeout(() => el.remove(), 2500);
    } catch {
    }
  }
  window.addEventListener("unhandledrejection", (ev) => {
    const msg = String(ev.reason?.message || ev.reason || "");
    if (isContextInvalidated(msg)) {
      ev.preventDefault();
    }
  });
  window.addEventListener("error", (ev) => {
    const msg = String(ev.error?.message || ev.message || "");
    if (isContextInvalidated(msg)) {
      ev.preventDefault?.();
    }
  });
  function dispatchDecision(requestId, allow, errorMessage) {
    try {
      const detail = { requestId, allow, errorMessage };
      window.dispatchEvent(new CustomEvent("signguard:decision", { detail }));
      window.postMessage({ source: "signguard-content", type: "SG_DECISION", requestId, allow, errorMessage }, "*");
    } catch {
    }
  }
  function waitForDecisionAck(requestId, maxMs = 900) {
    return new Promise((resolve) => {
      let done = false;
      let t2;
      const cleanup = () => {
        if (done) return;
        done = true;
        try {
          window.removeEventListener("message", onMsg);
        } catch {
        }
        try {
          clearTimeout(t2);
        } catch {
        }
      };
      const onMsg = (ev) => {
        const m = ev?.data;
        if (!m || typeof m !== "object") return;
        if (m.source !== "signguard-inpage") return;
        if (m.type !== "SG_DECISION_ACK") return;
        if (String(m.requestId || "") !== requestId) return;
        cleanup();
        resolve(true);
      };
      window.addEventListener("message", onMsg);
      t2 = setTimeout(() => {
        cleanup();
        resolve(false);
      }, maxMs);
    });
  }
  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
  function defaultHumanForIntent(intent, tFn) {
    switch (intent) {
      case "SWITCH_CHAIN":
        return {
          whatItDoes: [tFn("default_human_switch_what")],
          risks: [tFn("default_human_switch_risk")],
          safeNotes: [tFn("default_human_switch_safe")],
          nextSteps: [tFn("default_human_switch_next")]
        };
      case "CONTRACT_INTERACTION":
        return {
          whatItDoes: [tFn("default_human_contract_what")],
          risks: [tFn("default_human_contract_risk")],
          safeNotes: [tFn("default_human_contract_safe")],
          nextSteps: [tFn("default_human_contract_next")]
        };
      case "ETH_TRANSFER":
        return {
          whatItDoes: [tFn("default_human_eth_what")],
          risks: [tFn("default_human_eth_risk")],
          safeNotes: [tFn("default_human_eth_safe")],
          nextSteps: [tFn("default_human_eth_next")]
        };
      case "TYPED_DATA":
        return {
          whatItDoes: [tFn("default_human_typed_what")],
          risks: [tFn("default_human_typed_risk")],
          safeNotes: [tFn("default_human_typed_safe")],
          nextSteps: [tFn("default_human_typed_next")]
        };
      default:
        return {
          whatItDoes: [tFn("default_human_generic_what")],
          risks: [tFn("default_human_generic_risk")],
          safeNotes: [tFn("default_human_generic_safe")],
          nextSteps: [tFn("default_human_generic_next")]
        };
    }
  }
  function buildLocalFallbackAnalysis(payload, settings, wallet, trustedDomainsList) {
    const method = String(payload?.method || "").toLowerCase();
    const params = payload?.params;
    const tx = Array.isArray(params) && params[0] && typeof params[0] === "object" ? params[0] : {};
    const data = typeof tx?.data === "string" ? tx.data : "";
    const to = typeof tx?.to === "string" ? tx.to : "";
    const valueWei = BigInt(typeof tx?.value === "string" ? tx.value : (tx?.value ?? "0x0") || "0x0");
    const hasData = !!data && data !== "0x" && data.toLowerCase() !== "0x";
    const selector = hasData && data.startsWith("0x") && data.length >= 10 ? data.slice(0, 10) : "";
    const chainId = payload?.meta?.chainId ?? payload?.chainId ?? "";
    const txCostPreview = payload?.txCostPreview;
    const host = (payload?.host || "").trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0];
    let intent = "UNKNOWN";
    if (method === "wallet_switchethereumchain") intent = "SWITCH_CHAIN";
    else if (method === "eth_signtypeddata_v4" || method === "eth_signtypeddata_v3" || method === "eth_signtypeddata") intent = "TYPED_DATA";
    else if (method === "eth_sendtransaction" || method === "wallet_sendtransaction") {
      if (hasData) intent = "CONTRACT_INTERACTION";
      else if (valueWei > 0n) intent = "ETH_TRANSFER";
    }
    const dh = defaultHumanForIntent(intent, t);
    const methodShort = method || t("tech_methodRaw");
    const isUnlimitedApproval = selector === "0x095ea7b3" || selector === "0xa22cb465";
    const allowlisted = !!(host && trustedDomainsList?.length && trustedDomainsList.some((d) => host === d || host.endsWith("." + d)));
    let recommend = "WARN";
    let score = 50;
    if (intent === "SWITCH_CHAIN" && allowlisted) {
      score = 18;
      recommend = "ALLOW";
    } else if (intent === "ETH_TRANSFER" && allowlisted && valueWei < BigInt(1e18)) {
      score = 28;
      recommend = "WARN";
    } else if (intent === "CONTRACT_INTERACTION") {
      score = 50;
      recommend = "WARN";
    } else if (isUnlimitedApproval && (settings.strictBlockApprovalsUnlimited ?? settings.strictBlockSetApprovalForAll)) {
      score = 70;
      recommend = "HIGH";
    }
    const reasons = [t("fallback_partial_verification")];
    if (!payload?.host) reasons.push(t("trustReasonNoHost"));
    const checks = [
      { key: "DOMAIN_INTEL", status: trustedDomainsList?.length ? allowlisted ? "PASS" : "WARN" : "WARN" },
      { key: "LOOKALIKE", status: host ? "PASS" : "SKIP" },
      { key: "TX_DECODE", status: intent !== "UNKNOWN" ? "PASS" : "WARN" },
      { key: "FEE_ESTIMATE", status: txCostPreview?.feeEstimated ? "PASS" : "WARN" },
      { key: "ADDRESS_INTEL", status: "SKIP" },
      { key: "ASSET_ENRICH", status: "SKIP" },
      { key: "CLOUD_INTEL", status: "SKIP" }
    ];
    const performed = checks.filter((c) => c.status !== "SKIP").length;
    const total = checks.length;
    const limited = true;
    let verdictLabelKey;
    if (recommend === "BLOCK") verdictLabelKey = "verdict_block";
    else if (score <= 20) verdictLabelKey = "verdict_ok";
    else if (score <= 60) verdictLabelKey = "verdict_warn";
    else verdictLabelKey = "verdict_high";
    const a = {
      level: recommend === "HIGH" ? "HIGH" : recommend === "ALLOW" ? "LOW" : "WARN",
      score,
      title: recommend === "ALLOW" ? t("no_alerts_known") : t("txPreview"),
      reasons,
      decoded: { kind: "TX", raw: { method, selector, to: to || void 0 } },
      recommend,
      intent,
      trust: { verdict: allowlisted ? "LIKELY_OFFICIAL" : "UNKNOWN", trustScore: allowlisted ? 75 : 50, reasons: [] },
      suggestedTrustedDomains: [],
      txCostPreview: txCostPreview && typeof txCostPreview === "object" ? { feeEstimated: !!txCostPreview.feeEstimated, valueWei: String(txCostPreview.valueWei ?? valueWei.toString(10)), feeReasonKey: "fee_unknown_wallet_will_estimate", ...txCostPreview } : { feeEstimated: false, valueWei: valueWei.toString(10), feeReasonKey: "fee_unknown_wallet_will_estimate" },
      wallet: wallet ? { kind: wallet.kind, name: wallet.name, walletBrand: wallet.walletBrand } : void 0,
      human: {
        methodTitle: recommend === "ALLOW" ? t("no_alerts_known") : t("txPreview"),
        methodShort,
        methodWhy: "",
        whatItDoes: dh.whatItDoes,
        risks: dh.risks,
        safeNotes: dh.safeNotes,
        nextSteps: dh.nextSteps,
        recommendation: recommend === "ALLOW" ? t("still_review_wallet") : t("check_wallet_network_fee")
      },
      checks,
      coverage: { performed, total, limited },
      verdictLabelKey,
      verificationLevel: trustedDomainsList?.length ? "LOCAL" : "BASIC",
      knownSafe: false,
      knownBad: false
    };
    a._partialData = true;
    if (to || valueWei > 0n) a.tx = { to: to || void 0, selector, valueEth: valueWei > 0n ? weiToEthString(valueWei) : void 0 };
    return a;
  }
  function buildFallbackAnalysis(payload, wallet) {
    return buildLocalFallbackAnalysis(payload, __sgSettings || DEFAULT_SETTINGS, wallet, __sgTrustedDomains?.length ? __sgTrustedDomains : void 0);
  }
  function riskDotClass(level, severityKey) {
    if (severityKey === "BLOCKED") return "block";
    if (level === "HIGH") return "high";
    if (level === "WARN") return "warn";
    return "low";
  }
  function riskLabel(level) {
    if (level === "HIGH") return t("risk_HIGH");
    if (level === "WARN") return t("risk_WARN");
    return t("risk_LOW");
  }
  function recommendLabel(r) {
    if (r === "BLOCK") return t("recommend_BLOCK");
    if (r === "HIGH") return t("recommend_HIGH");
    if (r === "WARN") return t("recommend_WARN");
    return t("recommend_ALLOW");
  }
  function trustLabel(verdict) {
    if (verdict === "LIKELY_OFFICIAL") return t("trust_likelyOfficial");
    if (verdict === "SUSPICIOUS") return t("trust_suspicious");
    return t("trust_unknown");
  }
  var CHAIN_NAMES = {
    "0x1": "Ethereum",
    "0x89": "Polygon",
    "0xa4b1": "Arbitrum",
    "0xa": "Optimism",
    "0x38": "BNB Chain",
    "0xa86a": "Avalanche"
  };
  function chainNameFromId(hex) {
    if (!hex) return "";
    const id = String(hex).toLowerCase();
    return CHAIN_NAMES[id] || id;
  }
  function shortenHex(s) {
    if (!s || typeof s !== "string") return "";
    if (s.length <= 12) return s;
    return `${s.slice(0, 6)}\u2026${s.slice(-4)}`;
  }
  function formatVerificationUpdated(updatedAt) {
    const diffMs = Date.now() - updatedAt;
    const hours = Math.floor(diffMs / (60 * 60 * 1e3));
    const days = Math.floor(diffMs / (24 * 60 * 60 * 1e3));
    if (days >= 1) return t("updated_x_days", { n: days });
    return t("updated_x_hours", { n: hours < 1 ? 1 : hours });
  }
  function resolveText(x) {
    if (!x) return "";
    const s = String(x).trim();
    if (!s) return "";
    if (tHasKey(s)) return t(s);
    return s;
  }
  function sendKeepalive(requestId) {
    try {
      window.postMessage({ source: "signguard-content", type: "SG_KEEPALIVE", requestId }, "*");
    } catch {
    }
  }
  function runPageRiskScannerOnce() {
    try {
      const doc = document;
      if (!doc.body) return;
      const hostname = window.location.hostname || "";
      const result = runPageRiskScan(doc, hostname);
      if (result.riskScore === "HIGH") {
        injectPageRiskBanner(t("page_risk_suspicious_banner"), doc);
      }
      if (result.riskScore !== "LOW") {
        try {
          if (typeof chrome !== "undefined" && chrome.runtime?.sendMessage) {
            const title = doc.title ?? "";
            const metaDesc = doc.querySelector('meta[name="description"]')?.getAttribute("content") ?? "";
            const score = result.riskScore === "HIGH" ? 100 : 50;
            chrome.runtime.sendMessage({
              type: "SG_TELEMETRY_THREAT",
              payload: {
                url: window.location.href,
                riskScore: score,
                reasons: result.reasons?.length ? result.reasons : ["PAGE_RISK"],
                metadata: { title, description: metaDesc }
              }
            });
          }
        } catch {
        }
      }
    } catch {
    }
  }
  var __sgFlow = newFlowState();
  var requestQueue = [];
  var recentSwitchByOrigin = /* @__PURE__ */ new Map();
  var FLOW_TTL_MS2 = 6e4;
  var __sgSettings = null;
  var __sgSettingsLoading = null;
  var __sgUsdPerEth = null;
  var __sgUsdFetchedAt = 0;
  var NATIVE_USD_TTL_MS = 12e4;
  var __sgNativeByChain = {};
  function toChainIdHex(chainId) {
    if (chainId == null || chainId === "") return null;
    const s = String(chainId).trim();
    if (s.toLowerCase().startsWith("0x")) return s;
    const n = parseInt(s, 10);
    if (!Number.isFinite(n) || n < 0) return null;
    return "0x" + n.toString(16);
  }
  async function ensureUsdLoaded() {
    if ((__sgSettings ?? DEFAULT_SETTINGS).showUsd === false) return;
    const now = Date.now();
    if (__sgUsdPerEth != null && now - __sgUsdFetchedAt < 6e4) return;
    const resp = await safeSendMessage({ type: "GET_ETH_USD" }, 2500);
    const usd = Number(resp?.usdPerEth);
    if (resp?.ok && Number.isFinite(usd) && usd > 0) {
      const changed = __sgUsdPerEth !== usd;
      __sgUsdPerEth = usd;
      __sgUsdFetchedAt = now;
      if (changed && __sgOverlay?.container?.isConnected) updateOverlay(__sgOverlay);
    }
  }
  async function ensureNativeUsdForChain(chainIdHex) {
    if ((__sgSettings ?? DEFAULT_SETTINGS).showUsd === false) return null;
    if (!chainIdHex) return null;
    const key = chainIdHex.toLowerCase();
    const now = Date.now();
    const hit = __sgNativeByChain[key];
    if (hit && now - hit.fetchedAt < NATIVE_USD_TTL_MS) return hit;
    const resp = await safeSendMessage({ type: "SG_GET_NATIVE_USD", payload: { chainIdHex } }, 4e3);
    if (resp?.ok && Number.isFinite(resp?.usdPerNative) && resp.usdPerNative > 0) {
      const entry = { usd: resp.usdPerNative, symbol: resp.nativeSymbol ?? getNativeSymbol(chainIdHex), fetchedAt: now };
      __sgNativeByChain[key] = entry;
      if (__sgOverlay?.container?.isConnected) updateOverlay(__sgOverlay);
      return entry;
    }
    if (hit) return hit;
    if (__sgUsdPerEth != null) return { usd: __sgUsdPerEth, symbol: getNativeSymbol(chainIdHex) };
    return null;
  }
  function usdFromEth(ethStr, usdPerNative) {
    if ((__sgSettings ?? DEFAULT_SETTINGS).showUsd === false) return "";
    const rate = usdPerNative ?? __sgUsdPerEth;
    if (rate == null) return "";
    const n = Number(String(ethStr ?? "").trim());
    if (!Number.isFinite(n)) return "";
    const usd = n * rate;
    if (!Number.isFinite(usd)) return "";
    const fmt = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
    return ` (\u2248 ${fmt.format(usd)})`;
  }
  function usdApproxFromEthString(ethStr, usdPerNative) {
    return usdFromEth(ethStr, usdPerNative);
  }
  async function ensureSettingsLoaded() {
    if (__sgSettings) return;
    if (__sgSettingsLoading) return __sgSettingsLoading;
    __sgSettingsLoading = (async () => {
      const r = await safeStorageGet(DEFAULT_SETTINGS);
      __sgSettings = r.ok ? r.data : DEFAULT_SETTINGS;
      __sgSettingsLoading = null;
      if (__sgOverlay) updateOverlay(__sgOverlay);
    })();
    return __sgSettingsLoading;
  }
  var __sgTrustedDomains = [];
  var __sgTrustedDomainsLoaded = false;
  var __sgTrustedDomainsLoading = null;
  var toArr = (v) => Array.isArray(v) ? v.map(String) : [];
  function normDomain(d) {
    return (d || "").trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0];
  }
  async function ensureTrustedDomainsLoaded() {
    if (__sgTrustedDomainsLoaded) return;
    if (__sgTrustedDomainsLoading) return __sgTrustedDomainsLoading;
    __sgTrustedDomainsLoading = (async () => {
      const uniq = [];
      const push = (v) => {
        const n = normDomain(v);
        if (!n) return;
        if (!uniq.includes(n)) uniq.push(n);
      };
      [
        ...DEFAULT_SETTINGS.trustedDomains ?? [],
        ...DEFAULT_SETTINGS.allowlist ?? [],
        ...SUGGESTED_TRUSTED_DOMAINS ?? []
      ].forEach(push);
      const sync = await safeStorageGet({ trustedDomains: [], allowlist: [] });
      if (sync.ok) {
        toArr(sync.data?.trustedDomains).forEach(push);
        toArr(sync.data?.allowlist).forEach(push);
      }
      __sgTrustedDomains = uniq.slice(0, 500);
      __sgTrustedDomainsLoaded = true;
      __sgTrustedDomainsLoading = null;
      if (__sgOverlay) updateOverlay(__sgOverlay);
    })();
    return __sgTrustedDomainsLoading;
  }
  function lastSendTxStep() {
    for (let i = __sgFlow.steps.length - 1; i >= 0; i--) {
      const s = __sgFlow.steps[i];
      if (s && s.kind === "SEND_TX") return s;
    }
    return null;
  }
  function recomputeLastSendTxMath() {
    const step = lastSendTxStep();
    if (!step) return;
    const tx = step.tx || {};
    const valueWei = hexToBigInt(typeof tx?.value === "string" ? tx.value : "0x0");
    step.valueWei = valueWei;
    step.valueEth = weiToEthString(valueWei);
    if (step.gasFeeWei && typeof step.gasFeeWei === "bigint") {
      step.gasEth = weiToEthString(step.gasFeeWei);
      step.totalEth = weiToEthString(valueWei + step.gasFeeWei);
    }
  }
  function handlePageRpcMessage(ev) {
    try {
      if (ev.source !== window) return;
      const d = ev.data;
      if (!d || d.__SIGNGUARD__ !== true) return;
      const msg = d;
      if (msg.type === "SG_RPC") {
        __sgFlow = ingestRpc(__sgFlow, String(msg.data?.method || ""), msg.data?.params);
        recomputeLastSendTxMath();
        if (__sgOverlay) updateOverlay(__sgOverlay);
        return;
      }
      if (msg.type === "SG_RPC_ENRICH_TX") {
        const gasFeeWeiHex = String(msg.data?.gasFeeWeiHex || "");
        if (gasFeeWeiHex && gasFeeWeiHex.startsWith("0x")) {
          const step = lastSendTxStep();
          if (step) {
            step.gasFeeWei = hexToBigInt(gasFeeWeiHex);
            recomputeLastSendTxMath();
            if (__sgOverlay) updateOverlay(__sgOverlay);
          }
        }
        return;
      }
      if (msg.type === "TELEMETRY_WALLETS_DETECTED") {
        const wallets = msg.data?.wallets;
        if (Array.isArray(wallets) && wallets.length > 0 && typeof chrome !== "undefined" && chrome.runtime?.sendMessage) {
          chrome.runtime.sendMessage({ type: "TELEMETRY_WALLETS_DETECTED", payload: { wallets } }).catch(() => {
          });
        }
        return;
      }
    } catch {
    }
  }
  function ensureOverlayCss(shadow) {
    try {
      const href = safeGetURL("overlay.css");
      const existing = shadow.querySelector(`link[rel="stylesheet"][href="${href}"]`);
      if (existing || !href) return;
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = href;
      shadow.appendChild(link);
    } catch {
    }
  }
  var __sgOverlay = null;
  var DEBUG_KEY = "sg_debug_events";
  async function pushDebugEvent(evt) {
    try {
      if (!isRuntimeUsable()) return;
      const raw = await safeLocalGet(DEBUG_KEY);
      const arr = Array.isArray(raw) ? [...raw] : [];
      arr.push(evt);
      const trimmed = arr.slice(-20);
      await safeLocalSet({ [DEBUG_KEY]: trimmed });
    } catch {
    }
  }
  function tryCopyToClipboard(text) {
    try {
      void navigator.clipboard?.writeText?.(text);
      return true;
    } catch {
      return false;
    }
  }
  function markUiShownFromContent(requestId) {
    try {
      window.dispatchEvent(new CustomEvent("signguard:uiShown", { detail: { requestId } }));
    } catch {
    }
    try {
      window.postMessage({ source: "signguard-content", type: "SG_UI_SHOWN", requestId }, "*");
    } catch {
    }
  }
  function getCurrentPending() {
    return requestQueue.length ? requestQueue[0] : null;
  }
  function showCurrentPending() {
    const cur = getCurrentPending();
    if (!cur) {
      cleanupOverlay();
      return;
    }
    const chainIdHex = cur.chainIdHex ?? toChainIdHex(cur.rpcMeta?.chainId);
    void ensureNativeUsdForChain(chainIdHex ?? null);
    showOverlay(cur.requestId, cur.analysis, { host: cur.host, method: cur.method, params: cur.params, rpcMeta: cur.rpcMeta, chainIdHex: chainIdHex ?? void 0 });
  }
  var DECISION_ACK_FALLBACK_MS = 150;
  var pendingClickFallback = {};
  function closeOverlayAndAdvance(requestId, allow) {
    const idx = requestQueue.findIndex((p) => p.requestId === requestId);
    const cur = idx >= 0 ? requestQueue.splice(idx, 1)[0] : null;
    const buttons = __sgOverlay?.shadow?.querySelectorAll?.("button");
    buttons?.forEach((b) => {
      b.disabled = true;
      b.style.pointerEvents = "none";
    });
    if (__sgOverlay?.keepaliveInterval) {
      try {
        clearInterval(__sgOverlay.keepaliveInterval);
      } catch {
      }
      __sgOverlay.keepaliveInterval = null;
    }
    const container = __sgOverlay?.container;
    const onKey = __sgOverlay?.onKey;
    const hasMore = requestQueue.length > 0;
    __sgOverlay = null;
    if (cur) {
      try {
        const tx = cur.analysis?.tx;
        const txCost = cur.analysis?.txCostPreview;
        const txExtras = cur.analysis?.txExtras;
        const historyEvt = {
          ts: Date.now(),
          requestId,
          host: cur.host,
          url: cur.href,
          wallet: cur.wallet?.name,
          chainId: cur.rpcMeta?.chainId,
          action: cur.analysis?.intent ?? cur.method,
          method: cur.method,
          to: tx?.to ?? txExtras?.toAddress ?? txExtras?.tokenContract,
          valueEth: tx?.valueEth,
          feeLikelyEth: txCost?.feeLikelyWei != null ? weiToEthString2(BigInt(txCost.feeLikelyWei)) : void 0,
          feeMaxEth: txCost?.feeMaxWei != null ? weiToEthString2(BigInt(txCost.feeMaxWei)) : void 0,
          totalLikelyEth: txCost?.totalLikelyWei != null ? weiToEthString2(BigInt(txCost.totalLikelyWei)) : void 0,
          totalMaxEth: txCost?.totalMaxWei != null ? weiToEthString2(BigInt(txCost.totalMaxWei)) : void 0,
          usdPerEth: __sgUsdPerEth ?? void 0,
          decision: allow ? "ALLOW" : "BLOCK",
          score: cur.analysis?.score,
          level: cur.analysis?.level
        };
        void safeSendMessage({ type: "SG_LOG_HISTORY", payload: historyEvt }, 800);
      } catch {
      }
      try {
        if ((__sgSettings || DEFAULT_SETTINGS).debugMode) {
          pushDebugEvent({
            ts: Date.now(),
            kind: "DECISION",
            requestId,
            allow,
            origin: cur.origin,
            href: cur.href,
            host: cur.host,
            method: cur.method,
            level: cur.analysis?.level,
            score: cur.analysis?.score,
            recommend: cur.analysis?.recommend,
            intent: cur.analysis?.intent,
            isPhishing: !!cur.analysis?.isPhishing
          });
        }
      } catch {
      }
    }
    try {
      if (container) container.remove();
    } catch {
    }
    try {
      if (onKey) document.removeEventListener("keydown", onKey);
    } catch {
    }
    if (hasMore) setTimeout(() => showCurrentPending(), 50);
    else cleanupOverlay();
  }
  window.addEventListener("message", (ev) => {
    try {
      if (ev.source !== window) return;
      const d = ev?.data;
      if (!d || d.source !== "signguard-inpage") return;
      if (d.type === "SG_FAILOPEN_ARMED") {
        const requestId2 = String(d.requestId || "");
        if (__sgOverlay && __sgOverlay.requestId === requestId2) {
          __sgOverlay.failOpenArmed = true;
          updateOverlay(__sgOverlay);
        }
        return;
      }
      if (d.type !== "SG_DECISION_ACK") return;
      const requestId = String(d.requestId || "");
      if (!requestId) return;
      const allow = !!d.allow;
      const pending = pendingClickFallback[requestId];
      if (pending) {
        clearTimeout(pending.timer);
        delete pendingClickFallback[requestId];
      }
      closeOverlayAndAdvance(requestId, allow);
    } catch {
    }
  });
  async function decideCurrentAndAdvance(allow) {
    const cur = requestQueue[0];
    if (!cur) {
      if (requestQueue.length) showCurrentPending();
      else cleanupOverlay();
      return;
    }
    const requestId = cur.requestId;
    dispatchDecision(requestId, allow);
    pendingClickFallback[requestId] = {
      allow,
      timer: setTimeout(() => {
        if (!pendingClickFallback[requestId]) return;
        delete pendingClickFallback[requestId];
        dispatchDecision(requestId, allow);
      }, DECISION_ACK_FALLBACK_MS)
    };
    showToast(t("hint_wallet_popup"));
    const ack = await waitForDecisionAck(requestId, 900);
    if (!ack) {
      showToast(t("request_expired_toast") || "Solicita\xE7\xE3o expirada. Refa\xE7a a a\xE7\xE3o no site e tente novamente.");
      await sleep(1200);
    }
    if (pendingClickFallback[requestId]) {
      clearTimeout(pendingClickFallback[requestId].timer);
      delete pendingClickFallback[requestId];
    }
    closeOverlayAndAdvance(requestId, allow);
  }
  function isPhishingAnalysis(a) {
    if (a?.isPhishing) return true;
    const rs = (a?.reasons || []).map((x) => String(x || "").toLowerCase());
    return rs.some((r) => r.includes("blacklist") && r.includes("phishing"));
  }
  function actionTitleI18n(a, intent) {
    if (a === "SEND_TX" && intent) {
      if (intent === "CONTRACT_INTERACTION") return t("action_SEND_TX_contract_title");
      if (intent === "ETH_TRANSFER") return t("action_SEND_TX_eth_title");
    }
    const k = `action_${a}_title`;
    const v = t(k);
    return v === k ? actionTitle(a) : v;
  }
  function summaryBulletsI18n(a) {
    const keys = {
      CONNECT: ["summary_CONNECT_1", "summary_CONNECT_2", "summary_CONNECT_3"],
      REQUEST_PERMISSIONS: ["summary_REQUEST_PERMISSIONS_1", "summary_REQUEST_PERMISSIONS_2"],
      SWITCH_CHAIN: ["summary_SWITCH_CHAIN_1", "summary_SWITCH_CHAIN_2"],
      ADD_CHAIN: ["summary_ADD_CHAIN_1", "summary_ADD_CHAIN_2"],
      SIGN_MESSAGE: ["summary_SIGN_MESSAGE_1", "summary_SIGN_MESSAGE_2"],
      SIGN_TYPED_DATA: ["summary_SIGN_TYPED_DATA_1", "summary_SIGN_TYPED_DATA_2", "summary_SIGN_TYPED_DATA_3"],
      SEND_TX: ["summary_SEND_TX_1", "summary_SEND_TX_2", "summary_SEND_TX_3"],
      WATCH_ASSET: ["summary_WATCH_ASSET_1", "summary_WATCH_ASSET_2"],
      SOLANA: ["summary_SOLANA_1"],
      UNKNOWN: ["summary_UNKNOWN_1", "summary_UNKNOWN_2"]
    };
    const ks = keys[a] || keys.UNKNOWN;
    return ks.map((key) => {
      const v = t(key);
      return v === key ? "" : v;
    }).filter(Boolean);
  }
  function renderOverlay(state) {
    if (state.container) {
      state.container.setAttribute("data-sg-overlay", "1");
      state.container.setAttribute("data-sg-request-id", state.requestId);
    }
    if (state.countdownTimer) {
      try {
        clearInterval(state.countdownTimer);
      } catch {
      }
      state.countdownTimer = null;
    }
    const { analysis, meta, analysisLoading } = state;
    const host = meta.host;
    const method = meta.method;
    const methodNorm = normMethod(method);
    const chainIdHex = meta.chainIdHex ?? toChainIdHex(meta?.rpcMeta?.chainId);
    const nativeSymbol = getNativeSymbol(chainIdHex) || "ETH";
    const usdPerNative = chainIdHex ? __sgNativeByChain[chainIdHex.toLowerCase()]?.usd ?? __sgUsdPerEth : __sgUsdPerEth;
    if (chainIdHex) void ensureNativeUsdForChain(chainIdHex);
    const stepTx = lastSendTxStep();
    const hasTxInFlow = !!stepTx;
    const baseAction = classifyAction(method, meta.params);
    const displayAction = baseAction;
    const tx = displayAction === "SEND_TX" ? extractTx(stepTx?.tx ? [stepTx.tx] : meta.params) : null;
    const settings = __sgSettings || DEFAULT_SETTINGS;
    const phishingHardBlock = analysis.recommend === "BLOCK" && isPhishingAnalysis(analysis) && !(settings.allowOverrideOnPhishing ?? false);
    const severityKey = phishingHardBlock ? "BLOCKED" : analysis.level === "HIGH" ? "HIGH" : analysis.level === "WARN" ? "WARN" : "LOW";
    const scoreNum = clamp(analysis.score, 0, 100);
    const pillSeverity = severityKey === "BLOCKED" ? "BLOCKED" : scoreNum <= 20 ? "LOW" : scoreNum <= 60 ? "WARN" : scoreNum <= 90 ? "HIGH" : "BLOCKED";
    const dotCls = riskDotClass(analysis.level, severityKey);
    const walletDisplay = analysis.wallet?.walletName ?? analysis.wallet?.walletBrand ?? (analysis.wallet?.id === "unknown" || !analysis.wallet?.id ? t("wallet_evm_generic") : analysis.wallet?.name || t("wallet_detecting"));
    const chainTarget = analysis?.chainTarget;
    const chainDisplay = chainTarget?.chainName || chainNameFromId(chainTarget?.chainIdHex || meta?.rpcMeta?.chainId);
    const trust = analysis.trust;
    const trustText = `${trustLabel(trust?.verdict)} \u2022 ${clamp(trust?.trustScore ?? 0, 0, 100)}/100`;
    const trustReasons = (trust?.reasons || []).slice(0, 2);
    const domainListDecision = analysis.domainListDecision;
    const siteReputationLabel = domainListDecision === "TRUSTED" ? t("list_site_trusted") : domainListDecision === "BLOCKED" ? t("list_site_blocked") : t("list_site_unknown");
    const human = analysis.human;
    const summaryBullets = displayAction === "SWITCH_CHAIN" && !hasTxInFlow ? [t("switch_summary_no_gas")] : summaryBulletsI18n(displayAction).slice(0, 6);
    const recommendedText = displayAction === "SEND_TX" ? t("sendtx_reco") : human?.recommendation ? resolveText(human.recommendation) : t("info_unavailable");
    const allReasons = (analysis.reasons || []).map((r) => resolveText(r));
    const mainReasons = allReasons.slice(0, 6);
    const moreReasons = allReasons.slice(6);
    const decodedStr = (() => {
      try {
        if (!analysis.decoded) return "";
        const s = JSON.stringify(analysis.decoded, null, 2) || "";
        const lines = s.split("\n");
        const limited = lines.slice(0, 10).join("\n");
        return lines.length > 10 ? `${limited}
...` : limited;
      } catch {
        return "";
      }
    })();
    const trustedDomainsAll = __sgTrustedDomains || [];
    const TRUSTED_PREVIEW_COUNT = 8;
    const trustedDomainsPreview = trustedDomainsAll.slice(0, TRUSTED_PREVIEW_COUNT);
    const trustedDomainsMoreCount = Math.max(0, trustedDomainsAll.length - TRUSTED_PREVIEW_COUNT);
    const moreWhat = (human?.whatItDoes || []).slice(0, 4);
    const moreRisks = (human?.risks || []).slice(0, 4);
    const moreSafe = (human?.safeNotes || []).slice(0, 3);
    const moreNext = (human?.nextSteps || []).slice(0, 4);
    const cp = analysis?.txCostPreview;
    const valueEth = cp?.valueWei !== void 0 ? weiToEthString2(BigInt(cp.valueWei)) : stepTx?.valueEth || (displayAction === "SEND_TX" ? "0" : "");
    const feeEstimated = !!cp?.feeEstimated;
    const feeLikelyEth = cp?.feeLikelyWei ? weiToEthString2(BigInt(cp.feeLikelyWei)) : void 0;
    const feeMaxEth = cp?.feeMaxWei ? weiToEthString2(BigInt(cp.feeMaxWei)) : void 0;
    const totalLikelyEth = cp?.totalLikelyWei ? weiToEthString2(BigInt(cp.totalLikelyWei)) : void 0;
    const totalMaxEth = cp?.totalMaxWei ? weiToEthString2(BigInt(cp.totalMaxWei)) : void 0;
    const feeReasonKey = cp?.feeReasonKey;
    const feeKnown = feeEstimated || !!analysis?.tx?.feeKnown;
    const maxGasFeeEthFromTx = analysis?.tx?.maxGasFeeEth;
    const maxTotalEthFromTx = analysis?.tx?.maxTotalEth;
    const gasEth = stepTx?.gasEth;
    const totalEth = stepTx?.totalEth;
    const hasFeeGtValue = !!analysis?.feeGtValue;
    const valueProvided = (() => {
      try {
        return !!(stepTx?.tx && typeof stepTx.tx.value === "string" && stepTx.tx.value.length > 0) || cp?.valueWei !== void 0 && BigInt(cp.valueWei) > 0n;
      } catch {
        return false;
      }
    })();
    const txTo = (() => {
      try {
        return typeof stepTx?.tx?.to === "string" ? String(stepTx.tx.to) : void 0;
      } catch {
        return void 0;
      }
    })();
    const txSelector = (() => {
      try {
        const d = stepTx?.tx?.data;
        return typeof d === "string" && d.startsWith("0x") && d.length >= 10 ? d.slice(0, 10) : void 0;
      } catch {
        return void 0;
      }
    })();
    const maxGasFeeEth = feeEstimated ? feeMaxEth : feeKnown ? maxGasFeeEthFromTx || analysis?.tx?.maxGasFeeEth : void 0;
    const maxTotalEth = feeEstimated ? totalMaxEth : feeKnown ? maxTotalEthFromTx || analysis?.tx?.maxTotalEth : void 0;
    const addChainInfo = analysis?.addChainInfo;
    const watchAssetInfo = analysis?.watchAssetInfo;
    const txExtras = analysis?.txExtras;
    const intent = analysis?.intent;
    const intentLabel = (() => {
      const i = String(intent || "UNKNOWN");
      if (i === "NFT_PURCHASE") return t("intent_NFT_PURCHASE");
      if (i === "SWAP") return t("intent_SWAP");
      if (i === "APPROVAL") return t("intent_APPROVAL");
      if (i === "CONTRACT_INTERACTION") return t("intent_CONTRACT_INTERACTION");
      if (i === "ETH_TRANSFER") return t("intent_ETH_TRANSFER");
      if (i === "TOKEN_TRANSFER") return t("intent_TOKEN_TRANSFER");
      if (i === "NFT_TRANSFER") return t("intent_NFT_TRANSFER");
      if (i === "SWITCH_CHAIN") return t("intent_SWITCH_CHAIN");
      if (i === "ADD_CHAIN") return t("intent_ADD_CHAIN");
      if (i === "WATCH_ASSET") return t("intent_WATCH_ASSET");
      if (i === "SOLANA") return t("intent_SOLANA");
      if (i === "SIGNATURE") return t("intent_SIGNATURE");
      if (i === "TYPED_DATA") return t("intent_TYPED_DATA");
      if (i === "SEND") return t("intent_SEND");
      return t("intent_UNKNOWN");
    })();
    const decodedAction = analysis?.decodedAction;
    const approvalBlock = (() => {
      try {
        if (!txExtras || typeof txExtras !== "object") return "";
        const approvalType = String(txExtras.approvalType || "");
        const tokenContract = typeof txExtras.tokenContract === "string" ? txExtras.tokenContract : "";
        const spender = typeof txExtras.spender === "string" ? txExtras.spender : "";
        const operator = typeof txExtras.operator === "string" ? txExtras.operator : "";
        const unlimited = !!txExtras.unlimited;
        if (!approvalType) return "";
        return `
        <div class="sg-kv">
          <div class="sg-k">${escapeHtml(t("permission_title"))}</div>
          <div class="sg-v">
            ${tokenContract ? `<div style="margin-top:2px"><b>${escapeHtml(t("permission_token_contract"))}</b>: <code>${escapeHtml(shortenHex(tokenContract))}</code> <button class="sg-copy" data-copy="${escapeHtml(tokenContract)}">${escapeHtml(t("copy"))}</button></div>` : ""}
            ${spender ? `<div style="margin-top:8px"><b>${escapeHtml(t("permission_spender"))}</b>: <code>${escapeHtml(shortenHex(spender))}</code> <button class="sg-copy" data-copy="${escapeHtml(spender)}">${escapeHtml(t("copy"))}</button></div>` : ""}
            ${operator ? `<div style="margin-top:8px"><b>${escapeHtml(t("permission_operator"))}</b>: <code>${escapeHtml(shortenHex(operator))}</code> <button class="sg-copy" data-copy="${escapeHtml(operator)}">${escapeHtml(t("copy"))}</button></div>` : ""}
            <div style="margin-top:6px;font-size:12px;opacity:.9">${escapeHtml(t("permission_unlimited"))}: ${unlimited ? escapeHtml(t("yes")) : escapeHtml(t("no"))}</div>
          </div>
        </div>
      `;
      } catch {
        return "";
      }
    })();
    const transferBlock = (() => {
      try {
        if (!decodedAction || decodedAction.kind !== "TRANSFER_ERC20" && decodedAction.kind !== "TRANSFERFROM_ERC20" && decodedAction.kind !== "TRANSFER_NFT") return "";
        const da = decodedAction;
        const recipient = da.to;
        const amountRaw = da.amountRaw;
        const tokenId = da.tokenIdRaw;
        if (!recipient && !amountRaw && !tokenId) return "";
        return `
        <div class="sg-kv">
          <div class="sg-k">${escapeHtml(intent === "NFT_TRANSFER" ? t("transfer_nft_title") : t("transfer_token_title"))}</div>
          <div class="sg-v">
            ${recipient ? `<div><b>${escapeHtml(t("tx_destination"))}</b>: <code>${escapeHtml(shortenHex(recipient))}</code> <button class="sg-copy" data-copy="${escapeHtml(recipient)}">${escapeHtml(t("copy"))}</button></div>` : ""}
            ${amountRaw ? `<div style="margin-top:6px"><b>${escapeHtml(t("transfer_amount"))}</b>: <code>${escapeHtml(amountRaw)}</code></div>` : ""}
            ${tokenId ? `<div style="margin-top:6px"><b>${escapeHtml(t("transfer_token_id"))}</b>: <code>${escapeHtml(tokenId)}</code></div>` : ""}
          </div>
        </div>
      `;
      } catch {
        return "";
      }
    })();
    const typedDataPermitBlock = (() => {
      try {
        const extras = analysis?.typedDataExtras;
        if (!extras || !extras.spender && !extras.value && !extras.deadline) return "";
        return `
        <div class="sg-kv">
          <div class="sg-k">${escapeHtml(t("permission_title"))} (Permit)</div>
          <div class="sg-v">
            ${extras.spender ? `<div><b>${escapeHtml(t("permission_spender"))}</b>: <code>${escapeHtml(shortenHex(extras.spender))}</code> <button class="sg-copy" data-copy="${escapeHtml(extras.spender)}">${escapeHtml(t("copy"))}</button></div>` : ""}
            ${extras.value ? `<div style="margin-top:6px"><b>${escapeHtml(t("transfer_amount"))}</b>: <code>${escapeHtml(extras.value)}</code></div>` : ""}
            ${extras.deadline ? `<div style="margin-top:6px"><b>Deadline</b>: <code>${escapeHtml(extras.deadline)}</code></div>` : ""}
          </div>
        </div>
      `;
      } catch {
        return "";
      }
    })();
    const knownSafe = !!analysis.knownSafe;
    const knownBad = !!analysis.knownBad;
    const verificationLevel = analysis.verificationLevel;
    const verificationUpdatedAt = analysis.verificationUpdatedAt;
    const scoreMappedSeverity = knownSafe ? "LOW" : knownBad ? "BLOCKED" : scoreNum <= 20 ? "LOW" : scoreNum <= 60 ? "WARN" : "HIGH";
    const pillSeverityFinal = severityKey === "BLOCKED" ? "BLOCKED" : scoreMappedSeverity === "BLOCKED" ? "BLOCKED" : scoreMappedSeverity === "HIGH" ? "HIGH" : scoreMappedSeverity === "WARN" ? "WARN" : "LOW";
    const verdictKey = analysis.verdictLabelKey || (analysis.recommend === "BLOCK" ? "verdict_block" : knownSafe ? "verdict_ok" : scoreNum <= 20 ? "verdict_ok" : scoreNum <= 60 ? "verdict_warn" : "verdict_high");
    const pillLabel = t(verdictKey);
    const pillClass = pillSeverityFinal === "BLOCKED" ? "sg-pill--block" : pillSeverityFinal === "HIGH" ? "sg-pill--high" : pillSeverityFinal === "WARN" ? "sg-pill--warn" : "sg-pill--low";
    const coverage = analysis.coverage;
    const coverageLine = coverage ? `${t("coverage_label")}: ${coverage.performed}/${coverage.total}` + (coverage.limited ? ` \u2022 ${t("coverage_limited")}` : "") : "";
    const queueTotal = requestQueue.length;
    const queueIndicator = queueTotal > 1 ? t("queue_indicator", { pos: 1, total: queueTotal }) : "";
    const needsFriction = !phishingHardBlock && analysis.recommend === "BLOCK" || analysis.recommend === "HIGH" || analysis.level === "HIGH" && settings.blockHighRisk || analysis.level === "HIGH" && displayAction === "SIGN_TYPED_DATA" && (settings.requireTypedOverride ?? true);
    const isLoading = !!analysisLoading;
    const showActivateProtectionLink = !isLoading && analysis.simulationOutcome?.simulated === false;
    const failOpenArmed = !!state.failOpenArmed;
    state.app.innerHTML = `
    <div class="sg-backdrop">
      <div class="sg-modal">
        <div class="sg-header">
          <div class="sg-brand">
            <span class="sg-brand-icon" aria-hidden="true"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 2L4 5v6.09c0 5.05 3.41 9.76 8 10.91 4.59-1.15 8-5.86 8-10.91V5l-8-3z" fill="currentColor" opacity="0.9"/></svg></span>
            <span>${escapeHtml(t("extName"))}</span>
            <span class="sg-chip">${escapeHtml(t("modeLabel"))} ${escapeHtml((__sgSettings || DEFAULT_SETTINGS).mode || "BALANCED")}</span>
            ${queueIndicator ? `<span class="sg-chip">${escapeHtml(queueIndicator)}</span>` : ""}
          </div>
          <div class="sg-score">
            <span class="sg-pill ${pillClass}">${escapeHtml(pillLabel)}</span>
          </div>
          <button type="button" class="sg-close-btn" id="sg-close" aria-label="${escapeHtml(t("btn_close"))}">\xD7</button>
        </div>

        <div class="sg-body">
          ${failOpenArmed ? `<div class="sg-card" style="background:rgba(245,158,11,0.15);border:1px solid rgba(245,158,11,0.5);margin-bottom:12px;"><div class="sg-card-title" style="color:#f59e0b;">\u23F1 ${escapeHtml(t("failopen_armed_banner") || "An\xE1lise demorou. Voc\xEA pode Continuar mesmo assim ou Cancelar.")}</div></div>` : ""}
          ${isLoading ? `
          <div class="sg-skeleton-loading" aria-busy="true" aria-label="${escapeHtml(t("analyzing"))}">
            <div class="sg-summary-line" style="margin-bottom:16px;">
              <div class="sg-skeleton" style="height:24px;width:70%;max-width:320px;margin-bottom:10px;"></div>
              <div class="sg-skeleton" style="height:14px;width:90%;max-width:400px;"></div>
            </div>
            <div class="sg-card" style="margin-bottom:12px;">
              <div class="sg-card-title" style="visibility:hidden;">_</div>
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
                <div class="sg-skeleton" style="height:48px;border-radius:8px;"></div>
                <div class="sg-skeleton" style="height:48px;border-radius:8px;"></div>
              </div>
              <div style="margin-top:10px;display:flex;gap:8px;">
                <div class="sg-skeleton" style="height:36px;flex:1;border-radius:8px;"></div>
                <div class="sg-skeleton" style="height:36px;flex:1;border-radius:8px;"></div>
              </div>
            </div>
            <div style="display:flex;align-items:center;justify-content:center;gap:8px;margin-top:16px;">
              <span class="sg-spinner" aria-hidden="true"></span>
              <span class="sg-sub" style="margin:0;">${escapeHtml(t("analyzing"))}</span>
            </div>
          </div>
          ` : `
          <div class="sg-summary-line">
            <div class="sg-summary-title">${escapeHtml(actionTitleI18n(displayAction, intent))}</div>
            <div class="sg-summary-sub">${escapeHtml(t("site_label"))}: ${escapeHtml(host || "")} \u2022 ${escapeHtml(t("wallet_label"))}: ${escapeHtml(walletDisplay)} \u2022 ${escapeHtml(t("network_label"))}: ${escapeHtml(chainDisplay || "")}</div>
            ${host ? `<div class="sg-site-status ${trust?.verdict === "LIKELY_OFFICIAL" || __sgTrustedDomains?.length && (__sgTrustedDomains.includes(host) || __sgTrustedDomains.some((d) => host.endsWith("." + d))) ? "sg-site-status--known" : "sg-site-status--unknown"}">${escapeHtml(t("site_label"))}: ${escapeHtml(host)} \u2022 ${trust?.verdict === "LIKELY_OFFICIAL" || __sgTrustedDomains?.length && (__sgTrustedDomains.includes(host) || __sgTrustedDomains.some((d) => host.endsWith("." + d))) ? t("site_status_known") : t("site_status_not_in_list")}</div>` : ""}
            <div class="sg-summary-intent">${escapeHtml(t("looks_like"))} ${escapeHtml(intentLabel)}</div>
            ${coverageLine ? `<div class="sg-coverage-line">${escapeHtml(coverageLine)}</div>` : ""}
          </div>
          ${verdictKey === "verdict_ok" ? `<div class="sg-verdict-ok-block"><div class="sg-verdict-ok-text">${escapeHtml(t("no_alerts_known"))}</div><div class="sg-verdict-ok-sub">${escapeHtml(t("still_review_wallet"))}</div></div>` : ""}
          ${knownBad ? `<div class="sg-banner-block">${escapeHtml(t("banner_block_known_threat"))}</div>` : ""}
          ${!knownBad && knownSafe ? `<div class="sg-banner-ok"><div class="sg-banner-ok-text">${escapeHtml(t("banner_ok_no_known_threats"))}</div>${verificationUpdatedAt ? `<div class="sg-banner-ok-sub">${escapeHtml(formatVerificationUpdated(verificationUpdatedAt))}</div>` : ""}</div>` : ""}
          ${!knownBad && !knownSafe && verificationLevel === "LOCAL" ? `<div class="sg-banner-warn">${escapeHtml(t("banner_local_verification"))}</div>` : ""}
          ${!knownBad && !knownSafe && verificationLevel === "BASIC" ? `<div class="sg-banner-warn">${escapeHtml(t("banner_basic_verification"))}</div>` : ""}
          ${domainListDecision != null ? `<div class="sg-kv" style="margin-bottom:8px"><div class="sg-k">${escapeHtml(t("list_site_reputation"))}</div><div class="sg-v"><span class="sg-chip ${domainListDecision === "TRUSTED" ? "sg-chip-ok" : domainListDecision === "BLOCKED" ? "sg-chip-risk" : "sg-chip-warn"}">${escapeHtml(siteReputationLabel)}</span></div></div>` : ""}
          ${phishingHardBlock ? `<div class="sg-blocked-banner">${escapeHtml(t("severity_BLOCKED"))} \u2014 ${escapeHtml(t("phishing_hard_block"))}</div>` : ""}
          ${analysis.simulationRevert ? `<div class="sg-simulation-revert-banner" role="alert">${escapeHtml(t("simulation_tx_will_fail"))}</div>` : ""}
          ${analysis.isHoneypot ? `<div class="sg-honeypot-banner" role="alert">${escapeHtml(t("honeypot_message"))}</div>` : ""}

          ${displayAction === "SEND_TX" ? `<div class="sg-card">
                  <div class="sg-card-title">${escapeHtml(t("costs_title"))}</div>
                  <div><b>${escapeHtml(t("label_you_send"))}</b>: <code class="sg-mono">${escapeHtml(`${valueEth} ${nativeSymbol}${usdApproxFromEthString(valueEth, usdPerNative)}${valueProvided ? "" : " (" + t("cost_fee_only") + ")"}`)}</code></div>
                  ${feeEstimated ? `<div style="margin-top:8px"><b>${escapeHtml(t("label_fee_likely"))}</b>: <code class="sg-mono">${escapeHtml(feeLikelyEth ? `${feeLikelyEth} ${nativeSymbol}${usdApproxFromEthString(feeLikelyEth, usdPerNative)}` : t("gas_calculating"))}</code></div>
                    <div style="margin-top:6px"><b>${escapeHtml(t("label_fee_max"))}</b>: <code class="sg-mono">${escapeHtml(feeMaxEth ? `${feeMaxEth} ${nativeSymbol}${usdApproxFromEthString(feeMaxEth, usdPerNative)}` : t("gas_calculating"))}</code></div>
                    <div style="margin-top:8px"><b>${escapeHtml(t("label_total_likely"))}</b>: <code class="sg-mono">${escapeHtml(totalLikelyEth ? `${totalLikelyEth} ${nativeSymbol}${usdApproxFromEthString(totalLikelyEth, usdPerNative)}` : t("gas_calculating"))}</code></div>
                    <div style="margin-top:6px"><b>${escapeHtml(t("label_total_max"))}</b>: <code class="sg-mono">${escapeHtml(totalMaxEth ? `${totalMaxEth} ${nativeSymbol}${usdApproxFromEthString(totalMaxEth, usdPerNative)}` : t("gas_calculating"))}</code></div>` : `<div class="sg-sub" style="margin-top:8px">${escapeHtml(feeReasonKey ? resolveText(feeReasonKey) : t("fee_unknown_wallet_will_estimate"))}</div>
                    <div class="sg-sub" style="margin-top:6px">\u2022 ${escapeHtml(t("check_wallet_network_fee"))}</div>`}
                  ${hasFeeGtValue ? `<div class="sg-fee-warn">${escapeHtml(t("fee_gt_value"))}</div>` : ""}
                  ${txTo ? `<div style="margin-top:10px"><b>${escapeHtml(t("tx_destination"))}</b>: <code class="sg-mono">${escapeHtml(shortenHex(txTo))}</code> ${analysis.toIsContract === true ? `<span class="sg-dest-chip sg-dest-contract">${escapeHtml(t("destination_contract"))}</span>` : analysis.toIsContract === false ? `<span class="sg-dest-chip sg-dest-wallet">${escapeHtml(t("destination_wallet"))}</span>` : ""} <button class="sg-copy" data-copy="${escapeHtml(txTo)}">${escapeHtml(t("copy"))}</button></div>` : ""}
                  ${txSelector ? `<div style="margin-top:6px"><b>${escapeHtml(t("tx_contract_method"))}</b>: <code class="sg-mono">${escapeHtml(txSelector)}${selectorToLabel(txSelector) ? " \u2022 " + escapeHtml(selectorToLabel(txSelector)) : ""}</code></div>` : ""}
                  ${(() => {
      const tokenAddr = analysis.tokenAddress;
      if (!tokenAddr) return "";
      const tokenVerified = analysis.tokenVerified;
      const tokenSymbol = analysis.tokenSymbol;
      const tokenLogoUri = analysis.tokenLogoUri;
      const logoUri = typeof tokenLogoUri === "string" && tokenLogoUri ? tokenLogoUri : "";
      const placeholderSvg = "data:image/svg+xml," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="%2394a3b8" stroke-width="2"><circle cx="12" cy="12" r="10"/></svg>');
      const imgSrc = logoUri || placeholderSvg;
      const symbol = typeof tokenSymbol === "string" && tokenSymbol ? tokenSymbol : "";
      const label = tokenVerified ? t("token_verified_uniswap") : t("token_unknown_unverified");
      return `<div class="sg-token-badge-row" style="margin-top:10px;display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
                      <img class="sg-token-logo" src="${escapeHtml(imgSrc)}" alt="" width="24" height="24" loading="lazy" onerror="this.src='${placeholderSvg}'" />
                      ${symbol ? `<span class="sg-mono">${escapeHtml(symbol)}</span>` : ""}
                      <span class="sg-token-badge ${tokenVerified ? "sg-token-verified" : "sg-token-unknown"}">${tokenVerified ? "\u2705" : "\u26A0\uFE0F"} ${escapeHtml(label)}</span>
                    </div>`;
    })()}
                </div>` : displayAction === "SWITCH_CHAIN" && !hasTxInFlow && hasRecentSwitch(__sgFlow) ? `<div class="sg-kv">
                    <div class="sg-k">${escapeHtml(t("overlay_note_title"))}</div>
                    <div class="sg-v">
                      <div class="sg-sub">${escapeHtml(t("switch_note_inline"))}</div>
                    </div>
                  </div>` : ""}

          ${approvalBlock}
          ${transferBlock}
          ${typedDataPermitBlock}

          ${(() => {
      const hasImpacto = !!(analysis?.tx?.valueEth || cp || txExtras && (txExtras.spender || txExtras.operator || txExtras.toAddress || txExtras.tokenContract) || analysis.addressIntelHit);
      if (!hasImpacto) return "";
      const destAddr = txExtras?.toAddress || txTo || tx?.to;
      const impactLines = [];
      if (destAddr) {
        impactLines.push(`<div><b>${escapeHtml(t("tx_destination"))}</b>: <code class="sg-mono">${escapeHtml(shortenHex(destAddr))}</code> <button class="sg-copy" data-copy="${escapeHtml(destAddr)}">${escapeHtml(t("copy"))}</button></div>`);
      }
      const permAddr = txExtras?.spender || txExtras?.operator;
      if (permAddr) {
        const unlimited = !!txExtras?.unlimited;
        impactLines.push(`<div style="margin-top:${impactLines.length ? "8" : "0"}px"><b>${escapeHtml(t("permission_for"))}</b>: <code class="sg-mono">${escapeHtml(shortenHex(permAddr))}</code> <button class="sg-copy" data-copy="${escapeHtml(permAddr)}">${escapeHtml(t("copy"))}</button>${unlimited ? ` <span class="sg-chip sg-chip-warn">${escapeHtml(t("permission_unlimited"))}</span>` : ""}</div>`);
      }
      const addrIntelHit = !!analysis.addressIntelHit;
      const addrIntel = analysis.addressIntel;
      if (addrIntelHit && addrIntel) {
        const labels = [...addrIntel.to || [], ...addrIntel.spender || [], ...addrIntel.operator || [], ...addrIntel.tokenContract || []];
        const uniq = [...new Set(labels)];
        if (uniq.length) {
          impactLines.push(`<div style="margin-top:${impactLines.length ? "8" : "0"}px"><span class="sg-chip sg-chip-amber">${escapeHtml(t("addr_marked_public"))}</span> ${uniq.slice(0, 5).map((l) => `<span class="sg-chip sg-chip-risk">${escapeHtml(String(l))}</span>`).join(" ")}</div>`);
        }
      }
      if (cp?.feeEstimated && (feeLikelyEth || feeMaxEth)) {
        impactLines.push(`<div style="margin-top:${impactLines.length ? "8" : "0"}px"><b>${escapeHtml(t("label_fee_likely"))}</b> / <b>${escapeHtml(t("label_fee_max"))}</b>: <code class="sg-mono">${escapeHtml(feeLikelyEth ? `${feeLikelyEth} ${nativeSymbol}${usdApproxFromEthString(feeLikelyEth, usdPerNative)}` : "\u2014")}</code> / <code class="sg-mono">${escapeHtml(feeMaxEth ? `${feeMaxEth} ${nativeSymbol}${usdApproxFromEthString(feeMaxEth, usdPerNative)}` : "\u2014")}</code></div><div style="margin-top:6px"><b>${escapeHtml(t("label_total_likely"))}</b> / <b>${escapeHtml(t("label_total_max"))}</b>: <code class="sg-mono">${escapeHtml(totalLikelyEth ? `${totalLikelyEth} ${nativeSymbol}${usdApproxFromEthString(totalLikelyEth, usdPerNative)}` : "\u2014")}</code> / <code class="sg-mono">${escapeHtml(totalMaxEth ? `${totalMaxEth} ${nativeSymbol}${usdApproxFromEthString(totalMaxEth, usdPerNative)}` : "\u2014")}</code></div>`);
      } else if (displayAction === "SEND_TX") {
        impactLines.push(`<div style="margin-top:${impactLines.length ? "8" : "0"}px" class="sg-sub">${escapeHtml(t("tx_fee_estimated_by_wallet"))}</div>`);
      }
      if (impactLines.length === 0) return "";
      return `<div class="sg-card"><div class="sg-card-title">${escapeHtml(t("impact_title"))}</div>${impactLines.join("")}</div>`;
    })()}

          ${displayAction === "ADD_CHAIN" && addChainInfo ? `<div class="sg-kv">
                  <div class="sg-k">${escapeHtml(t("add_chain_network_label"))}</div>
                  <div class="sg-v">
                    <div class="sg-sub">${escapeHtml((addChainInfo.chainName || "") + (addChainInfo.chainId ? ` (${addChainInfo.chainId})` : "")) || escapeHtml(addChainInfo.chainId || "")}</div>
                    ${addChainInfo.rpcUrls?.[0] ? `<div style="margin-top:6px"><b>${escapeHtml(t("add_chain_rpc_label"))}</b>: <code class="sg-break">${escapeHtml(addChainInfo.rpcUrls[0])}</code></div>` : ""}
                    <div style="margin-top:8px;background:rgba(245,158,11,.15);border:1px solid rgba(245,158,11,.4);border-radius:8px;padding:8px;font-size:12px;">${escapeHtml(t("add_chain_review_rpc"))}</div>
                  </div>
                </div>` : displayAction === "SWITCH_CHAIN" && chainTarget?.chainIdHex ? `<div class="sg-kv">
                  <div class="sg-k">${escapeHtml(t("network_target"))}</div>
                  <div class="sg-v">
                    <div class="sg-sub">${escapeHtml(chainTarget.chainName ? `${chainTarget.chainName} (${chainTarget.chainIdHex})` : chainTarget.chainIdHex)}</div>
                  </div>
                </div>` : ""}

          ${displayAction === "WATCH_ASSET" && watchAssetInfo ? `<div class="sg-kv">
                  <div class="sg-k">${escapeHtml(t("watch_asset_token_label"))}</div>
                  <div class="sg-v">
                    <div class="sg-sub">${escapeHtml((watchAssetInfo.symbol || "?") + (watchAssetInfo.address ? ` \u2014 ${shortenHex(watchAssetInfo.address)}` : ""))}</div>
                    <div style="margin-top:8px;background:rgba(245,158,11,.15);border:1px solid rgba(245,158,11,.4);border-radius:8px;padding:8px;font-size:12px;">${escapeHtml(t("watch_asset_no_spend_but_risk"))}</div>
                  </div>
                </div>` : ""}

          ${tx?.to || typeof tx?.dataLen === "number" ? `<details class="sg-accordion">
                  <summary>${escapeHtml(t("details_tx_title"))}</summary>
                  <div class="sg-accordion-content">
                    ${tx?.to ? `<div><b>${escapeHtml(t("tx_to"))}</b>: <code class="sg-mono">${escapeHtml(shortenHex(tx.to))}</code></div>` : ""}
                    ${typeof tx?.dataLen === "number" ? `<div style="margin-top:6px"><b>${escapeHtml(t("tx_data_length"))}</b>: <code>${escapeHtml(String(tx.dataLen))}</code></div>` : ""}
                  </div>
                </details>` : ""}

          ${!phishingHardBlock ? `<div class="sg-card sg-panel--${pillSeverityFinal === "BLOCKED" ? "high" : pillSeverityFinal === "HIGH" ? "high" : pillSeverityFinal === "WARN" ? "warn" : "low"}">
            <div class="sg-card-title">${escapeHtml(t("risk_title"))}</div>
            <ul class="sg-list">
              ${mainReasons.map((r) => `<li>${escapeHtml(r)}</li>`).join("")}
              ${mainReasons.length === 0 ? `<li>${escapeHtml(recommendedText)}</li>` : ""}
            </ul>
          </div>` : ""}
          <div class="sg-card sg-what-now">
            <div class="sg-card-title">${escapeHtml(t("what_to_do_now"))}</div>
            <div class="sg-sub">${escapeHtml(resolveText(human?.recommendation) || recommendedText)}</div>
          </div>

          <details class="sg-accordion">
            <summary>${escapeHtml(t("details_tech_title"))}</summary>
            <div class="sg-accordion-content">
              <div class="sg-kv"><div class="sg-k">${escapeHtml(t("tech_displayAction"))}</div><div class="sg-v"><code>${escapeHtml(displayAction)}</code></div></div>
              <div class="sg-kv"><div class="sg-k">${escapeHtml(t("tech_methodRaw"))}</div><div class="sg-v"><code class="sg-mono">${escapeHtml(method)}</code>${meta.rawShape ? ` (${escapeHtml(meta.rawShape)})` : ""}</div></div>
              <div class="sg-kv"><div class="sg-k">${escapeHtml(t("tech_recommendScoreLevel"))}</div><div class="sg-v">${escapeHtml(recommendLabel(analysis.recommend))} \u2022 ${escapeHtml(String(analysis.score))}/100 \u2022 ${escapeHtml(riskLabel(analysis.level))}</div></div>
              <div style="margin-top:8px"><b>${escapeHtml(t("tech_reasons"))}</b>:<ul class="sg-list">${mainReasons.map((r) => `<li>${escapeHtml(r)}</li>`).join("")}${moreReasons.length ? moreReasons.map((r) => `<li>${escapeHtml(r)}</li>`).join("") : ""}</ul></div>
              ${txSelector ? `<div style="margin-top:8px"><b>${escapeHtml(t("tx_contract_method"))}</b>: <code class="sg-mono">${escapeHtml(txSelector)}${selectorToLabel(txSelector) ? " \u2022 " + escapeHtml(selectorToLabel(txSelector)) : ""}</code></div>` : ""}
              ${decodedStr ? `<div style="margin-top:10px"><b>${escapeHtml(t("tech_decoded"))}</b>:<pre class="sg-pre">${escapeHtml(decodedStr)}</pre></div>` : ""}
            </div>
          </details>

          <details class="sg-accordion">
            <summary>${escapeHtml(t("trusted_domain_ref_title"))}</summary>
            <div class="sg-accordion-content">
              ${trustedDomainsAll.length === 0 ? `<div class="sg-empty sg-sub">${escapeHtml(__sgTrustedDomainsLoaded ? t("trusted_domain_ref_empty") : t("loading_base"))}</div>
                     <button type="button" id="sg-intel-refresh" class="sg-btn sg-btn-secondary" style="margin-top:8px">${escapeHtml(t("trusted_domains_update_now"))}</button>
                     <button type="button" id="sg-open-options" class="sg-link" style="margin-left:8px">${escapeHtml(t("btn_open_options"))}</button>` : `<div class="sg-domain-chips">
                      ${trustedDomainsPreview.map((d) => `<span class="sg-domain-chip ${host === d || host.endsWith("." + d) ? "current" : ""}">${escapeHtml(d)}</span>`).join("")}
                     </div>
                     ${trustedDomainsMoreCount > 0 ? `<span class="sg-domain-more">${escapeHtml(t("trusted_domains_more", { n: trustedDomainsMoreCount }))}</span> <button type="button" id="sg-trusted-view-more" class="sg-link">${escapeHtml(t("trusted_domain_ref_view_more"))}</button>` : ""}`}
            </div>
          </details>

          ${moreWhat.length + moreRisks.length + moreSafe.length + moreNext.length > 0 ? `<details class="sg-accordion">
                  <summary>${escapeHtml(t("details_more_title"))}</summary>
                  <div class="sg-accordion-content">
                    ${moreWhat.length ? `<div style="font-weight:700; margin-bottom:6px">${escapeHtml(t("more_whatItDoes"))}</div><ul class="sg-list">${moreWhat.map((x) => `<li>${escapeHtml(resolveText(x))}</li>`).join("")}</ul>` : ""}
                    ${moreRisks.length ? `<div style="font-weight:700; margin-top:12px; margin-bottom:6px">${escapeHtml(t("more_risks"))}</div><ul class="sg-list">${moreRisks.map((x) => `<li>${escapeHtml(resolveText(x))}</li>`).join("")}</ul>` : ""}
                    ${moreSafe.length ? `<div style="font-weight:700; margin-top:12px; margin-bottom:6px">${escapeHtml(t("more_safeNotes"))}</div><ul class="sg-list">${moreSafe.map((x) => `<li>${escapeHtml(resolveText(x))}</li>`).join("")}</ul>` : ""}
                    ${moreNext.length ? `<div style="font-weight:700; margin-top:12px; margin-bottom:6px">${escapeHtml(t("more_nextSteps"))}</div><ul class="sg-list">${moreNext.map((x) => `<li>${escapeHtml(resolveText(x))}</li>`).join("")}</ul>` : ""}
                  </div>
                </details>` : ""}
        `}
        </div>

        <div class="sg-footer">
          ${isLoading ? `
                <button class="sg-btn sg-btn-secondary" id="sg-cancel">${escapeHtml(t("btn_cancel"))}</button>
                <button class="sg-btn sg-btn-primary" id="sg-continue" disabled style="opacity:.5;pointer-events:none;">${escapeHtml(t("btn_continue"))}</button>
              ` : phishingHardBlock ? `
                <button class="sg-btn sg-btn-secondary" id="sg-cancel">${escapeHtml(t("btn_close"))}</button>
              ` : needsFriction ? `
                <div style="flex:1; display:flex; align-items:center; gap:10px; justify-content:flex-start;">
                  <label style="display:flex; align-items:center; gap:8px; font-size:12px; color:#cbd5e1;">
                    <input id="sg-override" type="checkbox" style="width:16px; height:16px;" aria-label="${escapeHtml(t("override_checkbox"))}" />
                    <span>${escapeHtml(t("override_checkbox"))}</span>
                  </label>
                  <span id="sg-countdown" class="sg-sub" style="opacity:.9"></span>
                </div>
                <button class="sg-btn sg-btn-secondary" id="sg-cancel">${escapeHtml(t("btn_close"))}</button>
                <button class="sg-btn sg-btn-primary" id="sg-proceed" disabled style="opacity:.6; pointer-events:none;">${escapeHtml(t("btn_proceed_anyway"))}</button>
              ` : `
                <button class="sg-btn sg-btn-secondary" id="sg-cancel">${escapeHtml(t("btn_cancel"))}</button>
                <button class="sg-btn sg-btn-primary" id="sg-continue">${escapeHtml(t("btn_continue"))}</button>
              `}
          ${showActivateProtectionLink ? `<div class="sg-footer-cta" style="margin-top:10px;text-align:center;"><button type="button" id="sg-activate-protection" class="sg-link" style="font-size:12px;">Ativar Prote\xE7\xE3o M\xE1xima</button></div>` : ""}
        </div>
      </div>
    </div>
  `;
    const closeBtn = state.shadow.getElementById("sg-close");
    const continueBtn = state.shadow.getElementById("sg-continue");
    const proceedBtn = state.shadow.getElementById("sg-proceed");
    const overrideCb = state.shadow.getElementById("sg-override");
    const countdownEl = state.shadow.getElementById("sg-countdown");
    const cancelBtn = state.shadow.getElementById("sg-cancel");
    closeBtn && (closeBtn.onclick = () => decideCurrentAndAdvance(false));
    try {
      const btns = state.shadow.querySelectorAll("button.sg-copy[data-copy]");
      btns.forEach((b) => {
        b.onclick = () => {
          const v = b.getAttribute("data-copy") || "";
          if (!v) return;
          tryCopyToClipboard(v);
        };
      });
    } catch {
    }
    continueBtn && (continueBtn.onclick = () => decideCurrentAndAdvance(true));
    proceedBtn && (proceedBtn.onclick = () => decideCurrentAndAdvance(true));
    cancelBtn && (cancelBtn.onclick = () => decideCurrentAndAdvance(false));
    const openOptionsPage = () => {
      try {
        if (typeof globalThis.chrome !== "undefined" && globalThis.chrome.runtime?.openOptionsPage) {
          globalThis.chrome.runtime.openOptionsPage();
        }
      } catch {
      }
    };
    const openOpt = state.shadow.getElementById("sg-open-options");
    openOpt && (openOpt.onclick = openOptionsPage);
    const activateProtectionBtn = state.shadow.getElementById("sg-activate-protection");
    activateProtectionBtn && (activateProtectionBtn.onclick = openOptionsPage);
    const intelRefreshBtn = state.shadow.getElementById("sg-intel-refresh");
    intelRefreshBtn && (intelRefreshBtn.onclick = async () => {
      try {
        await safeSendMessage({ type: "UPDATE_INTEL_NOW" }, { preferPort: true, timeoutMs: 8e3 });
        __sgTrustedDomainsLoaded = false;
        __sgTrustedDomainsLoading = null;
        await ensureTrustedDomainsLoaded();
        if (__sgOverlay) updateOverlay(__sgOverlay);
      } catch {
      }
    });
    const viewMoreBtn = state.shadow.getElementById("sg-trusted-view-more");
    viewMoreBtn && (viewMoreBtn.onclick = () => {
      try {
        const list = __sgTrustedDomains || [];
        const host2 = state.meta.host;
        const backdrop = document.createElement("div");
        backdrop.className = "sg-backdrop sg-submodal";
        backdrop.setAttribute("role", "dialog");
        backdrop.setAttribute("aria-label", t("trusted_domain_ref_title"));
        const panel = document.createElement("div");
        panel.className = "sg-modal sg-trusted-more-modal";
        const searchInput = document.createElement("input");
        searchInput.type = "text";
        searchInput.placeholder = t("trusted_domains_search_placeholder");
        searchInput.className = "sg-trusted-search";
        searchInput.setAttribute("aria-label", t("trusted_domains_search_placeholder"));
        const listDiv = document.createElement("div");
        listDiv.className = "sg-trusted-full-list";
        const renderList = (filter) => {
          const q = (filter || "").toLowerCase().trim();
          const items = q ? list.filter((d) => d.toLowerCase().includes(q)) : list;
          listDiv.innerHTML = items.map((d) => `<span class="sg-domain-chip ${host2 === d || host2.endsWith("." + d) ? "current" : ""}">${escapeHtml(d)}</span>`).join("");
        };
        renderList("");
        searchInput.oninput = () => renderList(searchInput.value);
        const closeBtn2 = document.createElement("button");
        closeBtn2.type = "button";
        closeBtn2.className = "sg-btn sg-btn-secondary";
        closeBtn2.textContent = t("btn_close");
        closeBtn2.setAttribute("aria-label", t("btn_close"));
        closeBtn2.onclick = () => backdrop.remove();
        panel.appendChild(searchInput);
        panel.appendChild(listDiv);
        panel.appendChild(closeBtn2);
        backdrop.appendChild(panel);
        backdrop.onclick = (e) => {
          if (e.target === backdrop) backdrop.remove();
        };
        state.shadow.appendChild(backdrop);
        searchInput.focus();
      } catch {
      }
    });
    if (needsFriction && overrideCb && proceedBtn) {
      if (state.countdownTimer) {
        try {
          clearInterval(state.countdownTimer);
        } catch {
        }
        state.countdownTimer = null;
      }
      proceedBtn.disabled = true;
      proceedBtn.style.opacity = ".6";
      proceedBtn.style.pointerEvents = "none";
      countdownEl && (countdownEl.textContent = "");
      overrideCb.onchange = () => {
        if (overrideCb.checked) sendKeepalive(state.requestId);
        if (!overrideCb.checked) {
          proceedBtn.disabled = true;
          proceedBtn.style.opacity = ".6";
          proceedBtn.style.pointerEvents = "none";
          countdownEl && (countdownEl.textContent = "");
          if (state.countdownTimer) {
            try {
              clearInterval(state.countdownTimer);
            } catch {
            }
            state.countdownTimer = null;
          }
          return;
        }
        let left = 3;
        countdownEl && (countdownEl.textContent = t("override_countdown", { s: left }));
        state.countdownTimer = setInterval(() => {
          left--;
          if (left <= 0) {
            try {
              clearInterval(state.countdownTimer);
            } catch {
            }
            state.countdownTimer = null;
            countdownEl && (countdownEl.textContent = "");
            proceedBtn.disabled = false;
            proceedBtn.style.opacity = "1";
            proceedBtn.style.pointerEvents = "auto";
            return;
          }
          countdownEl && (countdownEl.textContent = t("override_countdown", { s: left }));
        }, 1e3);
      };
    }
  }
  function cleanupOverlay() {
    try {
      if (__sgOverlay?.keepaliveInterval) clearInterval(__sgOverlay.keepaliveInterval);
    } catch {
    }
    try {
      if (__sgOverlay?.countdownTimer) clearInterval(__sgOverlay.countdownTimer);
    } catch {
    }
    try {
      if (__sgOverlay?.container) __sgOverlay.container.remove();
    } catch {
    }
    try {
      if (__sgOverlay?.onKey) document.removeEventListener("keydown", __sgOverlay.onKey);
    } catch {
    }
    __sgOverlay = null;
  }
  function updateOverlay(state) {
    try {
      renderOverlay(state);
    } catch {
    }
  }
  function showOverlay(requestId, analysis, meta) {
    void ensureTrustedDomainsLoaded();
    void ensureSettingsLoaded();
    void ensureUsdLoaded();
    if (__sgOverlay) {
      __sgOverlay.requestId = requestId;
      __sgOverlay.analysis = analysis;
      __sgOverlay.meta = meta;
      const root = __sgOverlay.container;
      if (root) root.setAttribute("data-sg-request-id", requestId);
      if (__sgOverlay.keepaliveInterval) {
        try {
          clearInterval(__sgOverlay.keepaliveInterval);
        } catch {
        }
      }
      __sgOverlay.keepaliveInterval = setInterval(() => sendKeepalive(requestId), 2e3);
      updateOverlay(__sgOverlay);
      markUiShownFromContent(requestId);
      return;
    }
    const container = document.createElement("div");
    container.className = "sg-root";
    container.setAttribute("data-sg-overlay", "1");
    container.setAttribute("data-sg-request-id", requestId);
    const shadow = container.attachShadow({ mode: "open" });
    ensureOverlayCss(shadow);
    const app = document.createElement("div");
    app.id = "sg-app";
    shadow.appendChild(app);
    const onKey = (e) => {
      if (e.key === "Escape") {
        decideCurrentAndAdvance(false);
      }
    };
    document.addEventListener("keydown", onKey);
    __sgOverlay = { requestId, analysis, meta, container, shadow, app, onKey };
    document.documentElement.appendChild(container);
    markUiShownFromContent(requestId);
    if (__sgOverlay.keepaliveInterval) {
      try {
        clearInterval(__sgOverlay.keepaliveInterval);
      } catch {
      }
    }
    __sgOverlay.keepaliveInterval = setInterval(() => sendKeepalive(requestId), 2e3);
    updateOverlay(__sgOverlay);
  }
  var __sgPinged = false;
  async function handleSGRequest(ev) {
    try {
      if (ev.source !== window) return;
      const data = ev.data;
      if (!data || data.source !== "signguard" && data.source !== "signguard-inpage" || data.type !== "SG_REQUEST") return;
      const requestId = String(data.requestId || "");
      const url = String(data.payload?.url || "");
      const method = String(data.payload?.method || "");
      const params = Array.isArray(data.payload?.params) ? data.payload.params : void 0;
      const rpcMeta = data.payload?.meta ?? null;
      const host = (() => {
        try {
          return new URL(url).hostname.toLowerCase();
        } catch {
          return String(data.payload?.host || "");
        }
      })();
      const origin = (() => {
        try {
          return new URL(url).origin;
        } catch {
          return "";
        }
      })();
      const providerHint = data.payload?.providerHint;
      const txCostPreview = data.payload?.txCostPreview;
      const wallet = data.payload?.wallet;
      const payload = {
        requestId,
        url,
        origin,
        request: { method, params },
        wallet: wallet && typeof wallet === "object" ? wallet : void 0,
        providerHint: providerHint && typeof providerHint === "object" ? { kind: providerHint.kind || "UNKNOWN", name: providerHint.name } : void 0,
        meta: rpcMeta ? { chainId: rpcMeta?.chainId, chainIdHex: chainIdHex ?? void 0, chainIdRequested: rpcMeta?.chainIdRequested, preflight: rpcMeta?.preflight } : chainIdHex ? { chainId: rpcMeta?.chainId, chainIdHex } : void 0,
        txCostPreview
      };
      const receivedAt = Date.now();
      for (const [k, v] of recentSwitchByOrigin.entries()) {
        if (receivedAt - v.ts > FLOW_TTL_MS2) recentSwitchByOrigin.delete(k);
      }
      const chainIdHex = data.payload?.chainIdHex ?? toChainIdHex(rpcMeta?.chainId);
      const walletDisplay = wallet && typeof wallet === "object" ? { kind: wallet.kind, name: wallet.name, walletBrand: wallet.walletBrand } : void 0;
      const fallbackAnalysis = buildFallbackAnalysis(data.payload, walletDisplay);
      if (txCostPreview) fallbackAnalysis.txCostPreview = txCostPreview;
      const pending = {
        requestId,
        method,
        params,
        origin,
        href: url,
        host,
        wallet: walletDisplay,
        analysis: fallbackAnalysis,
        receivedAt,
        rpcMeta,
        chainIdHex: chainIdHex ?? void 0
      };
      const newAction = classifyAction(method, params);
      if (newAction === "SWITCH_CHAIN") {
        try {
          const chainId = String(rpcMeta?.chainIdRequested || "");
          recentSwitchByOrigin.set(origin, { ts: receivedAt, chainId: chainId || void 0 });
        } catch {
          recentSwitchByOrigin.set(origin, { ts: receivedAt });
        }
      }
      const specialCaseMerge = () => {
        if (!__sgOverlay || !requestQueue.length) return false;
        const current = requestQueue[0];
        const currentAction = classifyAction(current.method, current.params);
        const recent = recentSwitchByOrigin.get(origin);
        const withinTtl = !!recent && receivedAt - recent.ts <= FLOW_TTL_MS2;
        if (currentAction === "SWITCH_CHAIN" && newAction === "SEND_TX" && current.origin === origin && withinTtl) {
          dispatchDecision(current.requestId, true);
          requestQueue.shift();
          requestQueue.unshift(pending);
          showOverlay(requestId, fallbackAnalysis, { host, method, params, rpcMeta, chainIdHex: pending.chainIdHex ?? void 0 });
          __sgOverlay.analysisLoading = true;
          updateOverlay(__sgOverlay);
          markUiShownFromContent(requestId);
          void tryAnalyze();
          return true;
        }
        return false;
      };
      const tryAnalyze = async () => {
        const r = await safeSendMessage(
          { type: "ANALYZE", payload },
          { preferPort: true, timeoutMs: 8e3 }
        );
        const cur = requestQueue.find((p) => p.requestId === requestId);
        if (!cur || !__sgOverlay || __sgOverlay.requestId !== requestId) return;
        if (r && r.ok && r.vaultBlocked) {
          const idx = requestQueue.findIndex((p) => p.requestId === requestId);
          if (idx >= 0) requestQueue.splice(idx, 1);
          if (__sgOverlay && __sgOverlay.requestId === requestId) {
            cleanupOverlay();
            if (requestQueue.length) showCurrentPending();
          }
          dispatchDecision(requestId, false, r.vaultMessage ?? t("vaultBlockedMessage"));
          return;
        }
        if (r && r.ok && r.analysis) {
          cur.analysis = r.analysis;
          if (cur.wallet && !r.analysis.wallet) r.analysis.wallet = cur.wallet;
        } else {
          cur.analysis = buildFallbackAnalysis(data.payload, walletDisplay);
          if (txCostPreview) cur.analysis.txCostPreview = txCostPreview;
        }
        const analysis = cur.analysis;
        if (analysis.protectionPaused) {
          const idx = requestQueue.findIndex((p) => p.requestId === requestId);
          if (idx >= 0) requestQueue.splice(idx, 1);
          if (__sgOverlay && __sgOverlay.requestId === requestId) {
            cleanupOverlay();
            if (requestQueue.length) showCurrentPending();
          }
          dispatchDecision(requestId, true);
          return;
        }
        __sgOverlay.analysisLoading = false;
        __sgOverlay.analysis = cur.analysis;
        updateOverlay(__sgOverlay);
        const action = classifyAction(method, params);
        if (analysis.recommend === "ALLOW" && action !== "SEND_TX") {
          const idx = requestQueue.findIndex((p) => p.requestId === requestId);
          if (idx >= 0) requestQueue.splice(idx, 1);
          if (__sgOverlay && __sgOverlay.requestId === requestId) {
            cleanupOverlay();
            if (requestQueue.length) showCurrentPending();
          }
          dispatchDecision(requestId, true);
        }
      };
      if (specialCaseMerge()) return;
      requestQueue.push(pending);
      const isFirst = requestQueue.length === 1;
      if (isFirst) {
        showOverlay(requestId, fallbackAnalysis, { host, method, params, rpcMeta, chainIdHex: pending.chainIdHex ?? void 0 });
        __sgOverlay.analysisLoading = true;
        updateOverlay(__sgOverlay);
      }
      markUiShownFromContent(requestId);
      if (!__sgPinged) {
        __sgPinged = true;
        const ping = await portRequest({ type: "PING" }, 2e3);
        if (!ping?.ok) {
          const fb = await safeSendMessage({ type: "PING" }, 2e3);
          if (!fb?.ok) showToast(t("toast_extension_updated"));
        }
      }
      void tryAnalyze();
      if (!isFirst) updateOverlay(__sgOverlay);
    } catch (e) {
      try {
        dispatchDecision(ev?.data?.requestId, true);
      } catch {
      }
    }
  }
  window.addEventListener("message", (ev) => {
    void handleSGRequest(ev);
  });
  window.addEventListener("message", (ev) => {
    void handlePageRpcMessage(ev);
  });
  function schedulePageRiskScan() {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => runPageRiskScannerOnce(), { once: true });
    } else {
      if (document.body) runPageRiskScannerOnce();
      else setTimeout(runPageRiskScannerOnce, 100);
    }
  }
  schedulePageRiskScan();
  var CONNECT_WALLET_KEYWORDS = ["connect", "login", "wallet"];
  function isConnectWalletLikeElement(el) {
    try {
      if (!el || !(el instanceof Node)) return null;
      let node = el;
      for (let i = 0; i < 5 && node; i++) {
        if (node instanceof Element) {
          const text = (node.textContent ?? "").trim().toLowerCase().slice(0, 80);
          const label = (node.getAttribute?.("aria-label") ?? node.getAttribute?.("title") ?? "").toLowerCase();
          const combined = `${text} ${label}`;
          for (const kw of CONNECT_WALLET_KEYWORDS) {
            if (combined.includes(kw)) return { kind: "connect_wallet", text: (node.textContent ?? "").trim().slice(0, 60) };
          }
        }
        node = node.parentNode;
      }
    } catch {
    }
    return null;
  }
  window.addEventListener(
    "click",
    (ev) => {
      try {
        const hit = isConnectWalletLikeElement(ev.target);
        if (!hit || typeof chrome === "undefined" || !chrome.runtime?.sendMessage) return;
        chrome.runtime.sendMessage({
          type: "SG_TELEMETRY_INTERACTION",
          payload: {
            domain: window.location.hostname || "",
            kind: hit.kind,
            props: { text: hit.text }
          }
        });
      } catch {
      }
    },
    { capture: true, passive: true }
  );
  if (isRuntimeUsable() && typeof chrome?.runtime?.onMessage?.addListener === "function") {
    try {
      chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
        if (msg?.type === "SHOW_MARKETING_TOAST") {
          const campaign = msg?.payload;
          if (campaign?.id && campaign?.title && campaign?.link) {
            const delay = setTimeout(() => {
              renderAdToast(
                {
                  id: campaign.id,
                  title: campaign.title,
                  body: campaign.body ?? "",
                  cta_text: campaign.cta_text ?? "Saber mais",
                  link: campaign.link,
                  icon: campaign.icon
                },
                () => dismissAdToast(),
                () => {
                  if (typeof chrome?.runtime?.sendMessage === "function") {
                    chrome.runtime.sendMessage({ type: "AD_TRACK_CLICK", payload: { campaignId: campaign.id } });
                  }
                }
              );
            }, 5e3);
            sendResponse({ ok: true });
            return true;
          }
        }
        if (msg?.type !== "SG_RPC_CALL_REQUEST") return false;
        const { id, method, params } = msg;
        window.postMessage({ source: "signguard-content", type: "SG_RPC_CALL_REQUEST", id, method, params }, "*");
        const handler = (ev) => {
          try {
            const d = ev?.data;
            if (!d || d.source !== "signguard" || d.type !== "SG_RPC_CALL_RESPONSE" || d.id !== id) return;
            window.removeEventListener("message", handler);
            clearTimeout(timer);
            sendResponse({ ok: !d.error, result: d.result, error: d.error });
          } catch {
          }
        };
        window.addEventListener("message", handler);
        const timer = setTimeout(() => {
          window.removeEventListener("message", handler);
          sendResponse({ ok: false, error: "timeout" });
        }, 8e3);
        return true;
      });
    } catch (_) {
    }
  }
})();
//# sourceMappingURL=content.js.map
