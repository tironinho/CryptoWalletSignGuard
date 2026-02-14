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
    defaultExpandDetails: true,
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
    "looksrare.org",
    "x2y2.io",
    "etherscan.io",
    "arbitrum.io",
    "app.aave.com",
    "curve.finance",
    "revoke.cash",
    "rabby.io",
    "metamask.io"
  ];

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
      cost_value: "Valor",
      cost_fee: "Taxa estimada",
      cost_total: "Total estimado",
      cost_fee_unknown: "Taxa ser\xE1 cobrada (confirme na carteira)",
      network_switch_title: "Troca de rede",
      network_current: "Rede atual",
      network_requested: "Rede solicitada",
      trusted_domain_ref_title: "Dom\xEDnios confi\xE1veis (refer\xEAncia)",
      tx_cost_sending: "Voc\xEA est\xE1 enviando {value} + taxa de rede",
      tx_cost_gas_only: "Mesmo sem enviar moeda nativa, voc\xEA pagar\xE1 taxa de rede (gas)",
      gas_calculating: "calculando\u2026",
      tx_destination: "Destino",
      token_verified_uniswap: "Token Verificado (Uniswap List)",
      token_unknown_unverified: "Token Desconhecido (N\xE3o Verificado)",
      tx_contract_method: "Contrato/m\xE9todo",
      tx_max_gas_fee: "Taxa m\xE1xima (gas)",
      tx_max_total: "Total m\xE1ximo",
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
      showUsdLabel: "Exibir valores em USD",
      showUsdDesc: "Converte valores da moeda nativa e tokens para d\xF3lar (quando dispon\xEDvel).",
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
      label_max_fee: "Taxa m\xE1xima",
      label_max_total: "Total m\xE1ximo",
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
      destination_wallet: "Carteira",
      overlay_coverage_title: "Cobertura de seguran\xE7a",
      overlay_simulation_title: "Simula\xE7\xE3o",
      overlay_address_intel_title: "Intel de endere\xE7os",
      btn_copy: "Copiar",
      btn_copy_json: "Copiar JSON",
      chain_not_recognized: "Rede n\xE3o reconhecida",
      simulation_skipped_caution: "Sem simula\xE7\xE3o \u2014 valide com mais cautela.",
      toast_copied: "Copiado",
      btn_ver_menos: "Ver menos"
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
      cost_value: "Value",
      cost_fee: "Estimated fee",
      cost_total: "Estimated total",
      cost_fee_unknown: "A network fee will be charged (confirm in wallet)",
      network_switch_title: "Network switch",
      network_current: "Current network",
      network_requested: "Requested network",
      trusted_domain_ref_title: "Trusted domains (reference)",
      tx_cost_sending: "You are sending {value} + network fee",
      tx_cost_gas_only: "Even with no native currency sent, you will pay a network fee (gas)",
      gas_calculating: "calculating\u2026",
      tx_destination: "Destination",
      token_verified_uniswap: "Token Verified (Uniswap List)",
      token_unknown_unverified: "Token Unknown (Not Verified)",
      tx_contract_method: "Contract/method",
      tx_max_gas_fee: "Max gas fee",
      tx_max_total: "Max total",
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
      showUsdDesc: "Converts native and token amounts to USD when available.",
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
      label_max_fee: "Max fee",
      label_max_total: "Max total",
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
      destination_wallet: "Wallet",
      overlay_coverage_title: "Security coverage",
      overlay_simulation_title: "Simulation",
      overlay_address_intel_title: "Address intel",
      btn_copy: "Copy",
      btn_copy_json: "Copy JSON",
      chain_not_recognized: "Chain not recognized",
      simulation_skipped_caution: "No simulation \u2014 validate with extra care.",
      toast_copied: "Copied",
      btn_ver_menos: "Show less"
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

  // src/shared/utils.ts
  function escapeHtml(s) {
    const str = String(s ?? "");
    return str.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
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
  function simpleSummary(action) {
    switch (action) {
      case "SEND_TX":
        return [
          "Voc\xEA est\xE1 prestes a assinar/enviar uma transa\xE7\xE3o on-chain.",
          "Confira valor, rede e o contrato antes de confirmar na carteira."
        ];
      case "SWITCH_CHAIN":
        return [
          "O site pediu para trocar a rede da sua carteira.",
          "Confira se a rede solicitada \xE9 a esperada para esta a\xE7\xE3o."
        ];
      case "CONNECT":
        return [
          "O site quer conectar \xE0 sua carteira (como login).",
          "Isso compartilha seu endere\xE7o p\xFAblico."
        ];
      case "SIGN_MESSAGE":
      case "SIGN_TYPED_DATA":
        return [
          "O site pediu uma assinatura.",
          "Assinatura pode autorizar a\xE7\xF5es: leia o texto na carteira."
        ];
      default:
        return [
          "N\xE3o foi poss\xEDvel classificar com seguran\xE7a.",
          "Se estiver em d\xFAvida, cancele."
        ];
    }
  }

  // src/format.ts
  function weiToEthString(wei, decimals = 6) {
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
    { chainIdHex: "0x2a", name: "zkSync", nativeSymbol: "ETH", coingeckoId: "ethereum", rpcUrls: ["https://mainnet.zksync.io"] },
    { chainIdHex: "0x44d", name: "Polygon zkEVM", nativeSymbol: "ETH", coingeckoId: "ethereum", rpcUrls: ["https://zkevm-rpc.com"] },
    { chainIdHex: "0x13e31", name: "Polygon zkEVM (Chain 81489)", nativeSymbol: "ETH", coingeckoId: "ethereum", rpcUrls: ["https://zkevm-rpc.com"] }
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
      _port?.onDisconnect.addListener(() => {
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
      (async () => {
        try {
          if (!_port) {
            try {
              await new Promise((r) => {
                const c = (typeof globalThis !== "undefined" ? globalThis.chrome : void 0) ?? (typeof chrome !== "undefined" ? chrome : void 0);
                if (!c?.runtime?.sendMessage) return r();
                c.runtime.sendMessage({ type: "PING" }, () => {
                  r();
                });
                setTimeout(() => r(), 600);
              });
            } catch {
            }
          }
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
      })();
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
  function safeGetURL(path) {
    try {
      if (!isRuntimeUsable() || !chrome.runtime.getURL) return "";
      return chrome.runtime.getURL(path);
    } catch {
      return "";
    }
  }

  // src/content.ts
  console.log("\u{1F4E8} [SignGuard Content] Loaded cleanly (No manual injection).");
  var SG_DECISION_EVENT = "__sg_decision__";
  function sendDecisionToMainWorld(requestId, allow) {
    window.dispatchEvent(
      new CustomEvent(SG_DECISION_EVENT, { detail: { type: "SG_DECISION", requestId, allow } })
    );
  }
  function toChainIdHex(chainId) {
    if (chainId == null || chainId === "") return null;
    const s = String(chainId).trim();
    if (s.toLowerCase().startsWith("0x")) return s;
    const n = parseInt(s, 10);
    if (!Number.isFinite(n) || n < 0) return null;
    return "0x" + n.toString(16);
  }
  function inferHost(url) {
    try {
      const u = new URL(url);
      let h = u.hostname || "";
      if (h.toLowerCase().startsWith("www.")) h = h.slice(4);
      return h;
    } catch {
      return "";
    }
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
  var __sgSettings = null;
  var __sgNativeUsd = {};
  function loadSettings() {
    return new Promise((resolve) => {
      try {
        if (typeof chrome !== "undefined" && chrome.storage?.sync?.get) {
          chrome.storage.sync.get(DEFAULT_SETTINGS, (r) => {
            __sgSettings = r && typeof r === "object" ? r : DEFAULT_SETTINGS;
            resolve();
          });
        } else {
          __sgSettings = DEFAULT_SETTINGS;
          resolve();
        }
      } catch {
        __sgSettings = DEFAULT_SETTINGS;
        resolve();
      }
    });
  }
  function fetchNativeUsdAndRerender(chainIdHex) {
    if (!chainIdHex) return;
    const key = String(chainIdHex).toLowerCase();
    if (__sgNativeUsd[key]) return;
    safeSendMessage({
      type: "SG_GET_NATIVE_USD",
      payload: { chainIdHex }
    }).then((res) => {
      if (res?.ok && res.usdPerNative != null) {
        __sgNativeUsd[key] = { usd: res.usdPerNative, symbol: res.nativeSymbol ?? getNativeSymbol(chainIdHex) };
        if (__sgOverlay) updateOverlay(__sgOverlay);
      }
    }).catch(() => {
    });
  }
  function tryCopy(text) {
    try {
      if (navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(text);
        showToast(typeof t === "function" ? t("toast_copied") || "Copied" : "Copied");
        return true;
      }
    } catch {
    }
    return false;
  }
  function renderMoreExplanationsHtml(action, isContractInteraction) {
    const what = t("more_whatItDoes") || "O que isso faz";
    const risks = t("more_risks") || "Riscos";
    const safe = t("more_safeNotes") || "Notas de seguran\xE7a";
    const next = t("more_nextSteps") || "Pr\xF3ximos passos";
    let whatItems;
    let riskItems;
    let safeItems;
    let nextItems;
    if (isContractInteraction || action === "SEND_TX") {
      whatItems = [t("default_human_contract_what") || "Envia uma transa\xE7\xE3o para um contrato (a\xE7\xE3o dentro do dApp)."];
      riskItems = [t("default_human_contract_risk") || "O custo real pode variar e a a\xE7\xE3o pode mover ativos/tokens via contrato."];
      safeItems = [t("default_human_contract_safe") || "Confira destino (to), rede, valor e a taxa (Network fee) na carteira."];
      nextItems = [t("default_human_contract_next") || "Se os detalhes baterem, prossiga. Caso contr\xE1rio, cancele."];
    } else if (action === "SWITCH_CHAIN" || action === "ADD_CHAIN") {
      whatItems = [t("explain_switch_why") || "Alguns sites exigem uma rede espec\xEDfica para funcionar."];
      riskItems = [t("switch_note_inline") || "Trocar rede normalmente n\xE3o custa gas."];
      safeItems = [t("default_human_generic_safe") || "Confirme dom\xEDnio, rede e detalhes na carteira."];
      nextItems = [t("human_connect_next_2") || "Confirme se a rede solicitada \xE9 a esperada. Se n\xE3o, cancele."];
    } else if (action === "SIGN_MESSAGE" || action === "SIGN_TYPED_DATA") {
      whatItems = [t("human_sign_whatIs") || "Cria uma assinatura criptogr\xE1fica. Geralmente n\xE3o custa gas, mas pode autorizar a\xE7\xF5es."];
      riskItems = [t("human_sign_risk_1") || "Assinar textos desconhecidos pode autorizar a\xE7\xF5es/login que voc\xEA n\xE3o pretendia."];
      safeItems = [t("human_sign_safe_1") || "Prefira carteiras que mostrem detalhes de assinatura de forma leg\xEDvel."];
      nextItems = [t("human_sign_next_1") || "Verifique a URL e leia a mensagem/typed-data com aten\xE7\xE3o."];
    } else if (action === "CONNECT") {
      whatItems = [t("human_connect_whatIs") || "Conecta seu endere\xE7o de carteira a este site (como um login)."];
      riskItems = [t("human_connect_risk_1") || "Privacidade/rastreamento: pode vincular seu endere\xE7o a este site."];
      safeItems = [t("human_connect_safe_1") || "Trate connect como compartilhar identidade: fa\xE7a isso s\xF3 em sites que voc\xEA reconhece."];
      nextItems = [t("human_connect_next_1") || "Confira o dom\xEDnio (ortografia, HTTPS, sem punycode)."];
    } else {
      whatItems = [t("default_human_generic_what") || "A\xE7\xE3o solicitada pela dApp."];
      riskItems = [t("default_human_generic_risk") || "Se algo n\xE3o fizer sentido, cancele."];
      safeItems = [t("default_human_generic_safe") || "Confirme dom\xEDnio, rede e detalhes na carteira."];
      nextItems = [t("default_human_generic_next") || "Prossiga apenas se tudo estiver correto."];
    }
    const ul = (items) => `<ul><li>${items.map((x) => escapeHtml(x)).join("</li><li>")}</li></ul>`;
    return `<p><strong>${escapeHtml(what)}</strong></p>${ul(whatItems)}<p><strong>${escapeHtml(risks)}</strong></p>${ul(riskItems)}<p><strong>${escapeHtml(safe)}</strong></p>${ul(safeItems)}<p><strong>${escapeHtml(next)}</strong></p>${ul(nextItems)}`;
  }
  var __sgOverlay = null;
  function ensureOverlayCss(shadow) {
    try {
      const href = safeGetURL("overlay.css");
      console.log("\u{1F3A8} [SignGuard UI] CSS path:", href);
      if (!href) return;
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = href;
      shadow.appendChild(link);
    } catch (e) {
      console.error("\u{1F3A8} [SignGuard UI] CSS Error:", e);
    }
  }
  function showOverlay(requestId, analysis, meta) {
    console.log("\u{1F3A8} [SignGuard UI] showOverlay CALLED for:", requestId);
    if (__sgOverlay) {
      console.log("\u{1F3A8} [SignGuard UI] Updating existing overlay");
      __sgOverlay.requestId = requestId;
      __sgOverlay.analysis = analysis;
      __sgOverlay.meta = meta;
      updateOverlay(__sgOverlay);
      return;
    }
    try {
      const container = document.createElement("div");
      container.className = "sg-root";
      container.setAttribute("data-sg-overlay", "1");
      container.style.cssText = "position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; z-index: 2147483647; pointer-events: none;";
      const shadow = container.attachShadow({ mode: "open" });
      ensureOverlayCss(shadow);
      const app = document.createElement("div");
      app.id = "sg-app";
      app.style.pointerEvents = "auto";
      shadow.appendChild(app);
      const onKey = (e) => {
        if (e.key === "Escape") decideCurrentAndAdvance(false);
      };
      document.addEventListener("keydown", onKey);
      __sgOverlay = { requestId, analysis, meta, container, shadow, app, onKey };
      if (document.documentElement) {
        document.documentElement.appendChild(container);
        console.log("\u{1F3A8} [SignGuard UI] Appended to documentElement");
      } else {
        document.body.appendChild(container);
        console.log("\u{1F3A8} [SignGuard UI] Appended to body");
      }
      updateOverlay(__sgOverlay);
    } catch (e) {
      console.error("\u{1F3A8} [SignGuard UI] FATAL UI ERROR:", e);
    }
  }
  function updateOverlay(state) {
    const a = state.analysis;
    const isLoading = a.level === "LOADING";
    const settings = __sgSettings ?? DEFAULT_SETTINGS;
    const openByDefault = !!settings.defaultExpandDetails || state.meta.method === "eth_sendTransaction" || state.meta.method === "eth_signTypedData_v4" || state.meta.method === "eth_signTypedData_v3";
    const displayChainIdHex = state.meta.chainIdHex ?? a.chainTarget?.chainIdHex ?? toChainIdHex(a.addChainInfo?.chainId) ?? null;
    const chainTarget = a.chainTarget;
    const addChainInfo = a.addChainInfo;
    const displayChainName = chainTarget?.chainName ?? addChainInfo?.chainName ?? (displayChainIdHex ? getChainInfo(displayChainIdHex)?.name ?? (t("chain_not_recognized") || "Chain not recognized") : "\u2014");
    const chainKey = displayChainIdHex ? String(displayChainIdHex).toLowerCase() : "";
    const chainInfo = displayChainIdHex ? getChainInfo(displayChainIdHex) : null;
    const nativeSymbol = chainInfo?.nativeSymbol ?? getNativeSymbol(displayChainIdHex ?? void 0);
    const chainName = displayChainName;
    const usdPerNative = a.txCostPreview?.usdPerNative ?? __sgNativeUsd[chainKey]?.usd;
    const showUsd = !isLoading && settings.showUsd !== false && usdPerNative != null && usdPerNative > 0;
    fetchNativeUsdAndRerender(displayChainIdHex);
    const cost = a.txCostPreview;
    const valueWei = cost?.valueWei ?? a.tx?.valueWei ?? "0";
    const valueEth = isLoading ? "\u2014" : cost?.valueWei ? weiToEthString(BigInt(cost.valueWei)) : a.tx?.valueEth ?? (valueWei ? weiToEthString(BigInt(valueWei)) : "0");
    const feeLikely = isLoading ? "\u2014" : cost?.feeLikelyWei ? weiToEthString(BigInt(cost.feeLikelyWei)) : a.tx?.maxGasFeeEth ?? "\u2014";
    const feeMax = isLoading ? "\u2014" : cost?.feeMaxWei ? weiToEthString(BigInt(cost.feeMaxWei)) : a.tx?.maxGasFeeEth ?? "\u2014";
    const totalLikely = isLoading ? "\u2014" : cost?.totalLikelyWei ? weiToEthString(BigInt(cost.totalLikelyWei)) : a.tx?.maxTotalEth ?? "\u2014";
    const totalMax = isLoading ? "\u2014" : cost?.totalMaxWei ? weiToEthString(BigInt(cost.totalMaxWei)) : a.tx?.maxTotalEth ?? "\u2014";
    const valueUsd = !isLoading && showUsd && usdPerNative ? Number(valueWei) / 1e18 * usdPerNative : null;
    const toAddr = isLoading ? "" : a.tx?.to ?? a.decoded?.to ?? "";
    const selector = a.tx?.selector ?? "";
    const contractMethod = isLoading ? "" : selector && a.tx?.contractNameHint ? `${a.tx.contractNameHint} (${selector})` : selector || "";
    const coverage = a.coverage;
    const covStr = coverage != null ? `${coverage.performed}/${coverage.total}${coverage.limited ? " " + (t("coverage_limited") || "limited") : ""}` : "";
    const verLevel = a.verificationLevel ?? "";
    const intelSources = a.intelSources ?? [];
    const checks = a.checks ?? [];
    const checkChips = checks.map(
      (c) => `<span class="sg-chip sg-chip-${c.status.toLowerCase()}" title="${c.noteKey ? escapeHtml(t(c.noteKey) || c.noteKey) : ""}">${escapeHtml(c.key)}: ${c.status}</span>`
    ).join("");
    const sim = a.simulationOutcome;
    const simRevert = a.simulationRevert === true;
    const simStatus = sim?.status ?? "\u2014";
    const simOutgoing = (sim?.outgoingAssets?.length ?? 0) > 0 ? sim.outgoingAssets.map((x) => `${x.symbol} ${x.amount}`).join(", ") : "\u2014";
    const simIncoming = (sim?.incomingAssets?.length ?? 0) > 0 ? sim.incomingAssets.map((x) => `${x.symbol} ${x.amount}`).join(", ") : "\u2014";
    const simGas = sim?.gasUsed ?? "\u2014";
    const simMessage = sim?.message ?? "";
    const addrIntel = a.addressIntel;
    const addrIntelLines = [];
    if (a.addressIntelHit && addrIntel) {
      if (addrIntel.to?.length) addrIntelLines.push(`to: ${addrIntel.to.map((l) => `[${escapeHtml(l)}]`).join(" ")}`);
      if (addrIntel.spender?.length) addrIntelLines.push(`spender: ${addrIntel.spender.map((l) => `[${escapeHtml(l)}]`).join(" ")}`);
      if (addrIntel.operator?.length) addrIntelLines.push(`operator: ${addrIntel.operator.map((l) => `[${escapeHtml(l)}]`).join(" ")}`);
      if (addrIntel.tokenContract?.length)
        addrIntelLines.push(`tokenContract: ${addrIntel.tokenContract.map((l) => `[${escapeHtml(l)}]`).join(" ")}`);
    }
    const decodedRaw = isLoading ? null : a.decoded?.raw ?? null;
    const decodedStr = decodedRaw != null ? typeof decodedRaw === "string" ? decodedRaw : JSON.stringify(decodedRaw, null, 2) : "";
    const action = classifyAction(state.meta.method, state.meta.params);
    const txData = a.tx?.data;
    const isContractInteraction = action === "SEND_TX" && Boolean(a.toIsContract === true || selector || contractMethod || txData && txData !== "0x");
    const actionTitleStr = isContractInteraction ? t("action_SEND_TX_contract_title") || "Interagir com contrato" : actionTitle(action);
    const verdictText = isContractInteraction ? t("intent_CONTRACT_INTERACTION") || "Intera\xE7\xE3o com contrato" : actionTitleStr;
    const summaryArr = simpleSummary(action);
    const summaryStr = Array.isArray(summaryArr) ? summaryArr.join(" ") : String(summaryArr);
    const modeLabel = (settings.mode ?? "BALANCED").toString();
    const walletName = a.wallet?.walletName ?? "MetaMask";
    const host = state.meta.host ?? "";
    const pillKey = a.recommend === "BLOCK" ? "block" : a.recommend === "WARN" ? "warn" : a.recommend === "HIGH" ? "high" : "low";
    const pillText = a.recommend === "BLOCK" ? t("severity_BLOCKED") || "BLOQUEADO" : a.recommend === "WARN" ? t("severity_WARN") || "ATEN\xC7\xC3O" : a.recommend === "HIGH" ? t("severity_HIGH") || "ALTO" : t("severity_LOW") || "OK";
    const statusLine = !isLoading && a.knownSafe ? `${t("site_label") || "Site"}: ${escapeHtml(host)} \u2022 ${t("site_status_known") || "refer\xEAncia conhecida"}` : "";
    const bannerLocal = verLevel === "LOCAL" ? t("banner_local_verification") || "Aten\xE7\xE3o: verifica\xE7\xE3o local (cache). Revise os detalhes abaixo antes de prosseguir." : "";
    const bannerBasic = verLevel === "BASIC" ? t("banner_basic_verification") || "Aten\xE7\xE3o: verifica\xE7\xE3o b\xE1sica. Revise cuidadosamente os detalhes antes de prosseguir." : "";
    const riskReasons = [];
    if (verLevel === "LOCAL") riskReasons.push(t("banner_local_verification") || "Verifica\xE7\xE3o local (cache) \u2014 revise os detalhes abaixo.");
    if (verLevel === "BASIC") riskReasons.push(t("banner_basic_verification") || "Verifica\xE7\xE3o parcial \u2014 revise com cuidado.");
    if (a.knownBad || a.isPhishing) riskReasons.push(t("banner_block_known_threat") || "Amea\xE7a conhecida detectada.");
    if (a.addressRisk?.flagged) riskReasons.push(t("addr_marked_public") || "Endere\xE7o marcado em base p\xFAblica.");
    if (a.reasons?.length) riskReasons.push(...a.reasons.slice(0, 3));
    const feeUnavailable = feeLikely === "\u2014" || feeMax === "\u2014";
    const whatToDoNowText = action === "SEND_TX" ? feeUnavailable ? t("check_wallet_network_fee") || "Voc\xEA ainda n\xE3o viu a taxa. Verifique o 'Network fee' na carteira antes de confirmar." : t("default_human_contract_safe") || "Confira destino (to), rede, valor e taxa na carteira." : action === "SWITCH_CHAIN" || action === "ADD_CHAIN" ? t("default_human_switch_safe") || "Confirme a rede solicitada e se o site \xE9 o correto." : t("still_review_wallet") || "Mesmo assim, revise na carteira (valor, rede, destino e taxa).";
    const suggestedDomains = [...SUGGESTED_TRUSTED_DOMAINS];
    const maxDomainsShown = 8;
    const domainsExpanded = !!state.domainsExpanded;
    const domainsShown = domainsExpanded ? suggestedDomains : suggestedDomains.slice(0, maxDomainsShown);
    const domainsRestCount = suggestedDomains.length - domainsShown.length;
    const domainChipsHtml = domainsShown.map((d) => {
      const active = host && (d === host || host.endsWith("." + d));
      return `<span class="sg-domain-chip${active ? " sg-domain-chip-active" : ""}">${escapeHtml(d)}</span>`;
    }).join("");
    const domainToggleHtml = !domainsExpanded && domainsRestCount > 0 ? `<button type="button" id="sg-domains-toggle" class="sg-link sg-domain-more">+${domainsRestCount} ${t("trusted_domain_ref_view_more") || "Ver mais"}</button>` : domainsExpanded ? `<button type="button" id="sg-domains-toggle" class="sg-link sg-domain-more">${t("btn_ver_menos") || "Ver menos"}</button>` : "";
    const feeLikelyUsd = showUsd && cost?.feeLikelyWei && usdPerNative ? (Number(cost.feeLikelyWei) / 1e18 * usdPerNative).toFixed(2) : null;
    const valueRow = isLoading ? `<div class="sg-kv-stack"><div class="sg-skeleton" style="height:16px;width:100px;"></div><div class="sg-skeleton" style="height:12px;width:70px;margin-top:6px;"></div></div>` : valueUsd != null ? `<div class="sg-kv-stack"><span class="sg-kv-value">${escapeHtml(valueEth)} ${nativeSymbol}</span><span class="sg-kv-sub">\u2248 US$ ${valueUsd.toFixed(2)}</span></div>` : `<span class="sg-kv-value">${escapeHtml(valueEth)} ${nativeSymbol}</span>`;
    const feeLikelyRow = isLoading ? `<div class="sg-skeleton" style="height:16px;width:90px;"></div>` : feeLikelyUsd ? `<div class="sg-kv-stack"><span class="sg-kv-value">${escapeHtml(feeLikely)} ${nativeSymbol}</span><span class="sg-kv-sub">\u2248 US$ ${feeLikelyUsd}</span></div>` : `<span class="sg-kv-value">${escapeHtml(feeLikely)} ${nativeSymbol}</span>`;
    const moreExplanationsHtml = renderMoreExplanationsHtml(action, isContractInteraction);
    const html = `
<div class="sg-backdrop">
  <div class="sg-modal">
    <header class="sg-header">
      <div class="sg-brand"><span class="sg-brand-dot">\u{1F6E1}\uFE0F</span> Crypto Wallet SignGuard</div>
      <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
        <span class="sg-chip">Modo: ${escapeHtml(modeLabel)}</span>
        <span class="sg-pill sg-pill-${pillKey}">${escapeHtml(pillText)}</span>
        <button type="button" class="sg-close-btn" id="sg-close" aria-label="Close">\xD7</button>
      </div>
    </header>
    <div class="sg-body">
      ${isLoading ? `<p class="sg-summary-sub" style="margin-bottom:12px;">${escapeHtml(t("gas_calculating") || "calculando\u2026")}</p>` : ""}
      <h2 class="sg-summary-title">${escapeHtml(actionTitleStr)}</h2>
      <p class="sg-summary-sub">${t("site_label") || "Site"}: ${escapeHtml(host)} \u2022 Carteira: ${escapeHtml(walletName)} \u2022 ${t("network_label") || "Rede"}: ${escapeHtml(chainName)}</p>
      ${statusLine ? `<p class="sg-summary-sub" style="color:var(--sg-success);">${statusLine}</p>` : ""}
      <p class="sg-summary-sub"><strong>Parecer:</strong> ${escapeHtml(verdictText)}</p>
      ${!isLoading && covStr ? `<p class="sg-summary-sub">${t("coverage_label") || "Cobertura"}: ${escapeHtml(covStr)}${coverage?.limited ? " \u2022 " + (t("coverage_limited") || "cobertura limitada") : ""}</p>` : ""}
      ${bannerLocal ? `<div class="sg-banner-warn">${escapeHtml(bannerLocal)}</div>` : ""}
      ${bannerBasic ? `<div class="sg-banner-warn">${escapeHtml(bannerBasic)}</div>` : ""}
      ${action === "SWITCH_CHAIN" || action === "ADD_CHAIN" ? `<div class="sg-card"><div class="sg-card-title">${t("network_requested") || "Rede solicitada"}</div><p class="sg-summary-sub">${escapeHtml(displayChainName)}</p></div>` : ""}

      <div class="sg-card">
        <div class="sg-card-title">${t("costs_title") || "CUSTOS E IMPACTO"}</div>
        <div class="sg-kv"><span class="sg-kv-label">${t("cost_you_send") || "Voc\xEA envia"}</span>${valueRow}</div>
        <div class="sg-kv"><span class="sg-kv-label">${t("cost_fee") || "Taxa estimada (prov\xE1vel)"}</span>${feeLikelyRow}</div>
        <div class="sg-kv"><span class="sg-kv-label">${t("tx_max_gas_fee") || "Taxa m\xE1xima (pior caso)"}</span><span class="sg-kv-value">${escapeHtml(feeMax)} ${nativeSymbol}</span></div>
        <div class="sg-kv"><span class="sg-kv-label">${t("cost_total") || "Total prov\xE1vel"}</span><span class="sg-kv-value">${escapeHtml(totalLikely)} ${nativeSymbol}</span></div>
        <div class="sg-kv"><span class="sg-kv-label">${t("tx_max_total") || "Total m\xE1ximo"}</span><span class="sg-kv-value">${escapeHtml(totalMax)} ${nativeSymbol}</span></div>
        ${toAddr ? `<div class="sg-kv" style="margin-top:8px;"><span class="sg-kv-label">${t("tx_destination") || "Destino"}</span><div class="sg-actions-inline"><code class="sg-mono">${escapeHtml(toAddr.slice(0, 10) + "\u2026" + toAddr.slice(-8))}</code><button type="button" class="sg-copy" data-sg-copy="${escapeHtml(toAddr)}">${t("btn_copy") || "Copiar"}</button></div></div>` : ""}
      </div>
      ${contractMethod ? `<div class="sg-card"><div class="sg-card-title">${t("tx_contract_method") || "Contrato/m\xE9todo"}</div><div class="sg-actions-inline"><code class="sg-mono">${escapeHtml(contractMethod)}</code><button type="button" class="sg-copy" data-sg-copy="${escapeHtml(contractMethod)}">${t("btn_copy") || "Copiar"}</button></div></div>` : ""}
      <div class="sg-card">
        <div class="sg-card-title">${t("risk_title") || "RISCO E POR QU\xCA"}</div>
        <div class="sg-details-body">${riskReasons.length ? riskReasons.map((r) => `<p>${escapeHtml(r)}</p>`).join("") : "\u2014"}</div>
      </div>
      <div class="sg-card">
        <div class="sg-card-title">${t("what_to_do_now") || "O QUE FAZER AGORA"}</div>
        <div class="sg-details-body"><p>${escapeHtml(whatToDoNowText)}</p></div>
      </div>

      ${checks.length ? `<div class="sg-card"><div class="sg-card-title">${t("overlay_coverage_title") || "Cobertura de seguran\xE7a"}</div><div class="sg-grid" style="margin-top:8px;">${checkChips}</div></div>` : ""}
      ${sim || simRevert ? `<div class="sg-card"><div class="sg-card-title">${t("overlay_simulation_title") || "Simula\xE7\xE3o"}</div>${simRevert ? `<div class="sg-simulation-revert-banner">${escapeHtml(t("simulation_tx_will_fail") || "ESTA TRANSA\xC7\xC3O DEVE FALHAR (REVERT)")}</div>` : ""}${sim ? `<p><strong>Status:</strong> ${escapeHtml(simStatus)}</p><p><strong>${t("cost_you_send") || "Voc\xEA envia"}:</strong> ${escapeHtml(simOutgoing)}</p><p><strong>Recebe:</strong> ${escapeHtml(simIncoming)}</p><p><strong>Gas usado:</strong> ${escapeHtml(simGas)}</p>${sim?.gasCostWei ? `<p>Gas cost: ${weiToEthString(BigInt(sim.gasCostWei))} ${nativeSymbol}</p>` : ""}${sim.isHighGas ? `<p class="sg-chip sg-chip-warn">${escapeHtml(t("cost_fee_unknown") || "Taxa alta")}</p>` : ""}${simStatus === "SKIPPED" && simMessage ? `<p class="sg-summary-sub">${escapeHtml(simMessage)}. ${t("simulation_skipped_caution") || "Sem simula\xE7\xE3o \u2014 valide com mais cautela."}</p>` : ""}` : ""}</div>` : ""}
      ${addrIntelLines.length ? `<div class="sg-card"><div class="sg-card-title">${t("overlay_address_intel_title") || "Intel de endere\xE7os"}</div><div class="sg-list">${addrIntelLines.map((line) => `<div class="sg-summary-sub">${line}</div>`).join("")}</div></div>` : ""}

      <details class="sg-details" ${openByDefault ? "open" : ""}>
        <summary>${t("details_tx_title") || "Detalhes da transa\xE7\xE3o"}</summary>
        <div class="sg-details-body">${escapeHtml(a.reasons?.length ? a.reasons.join("\n") : "\u2014")}</div>
      </details>
      <details class="sg-details" ${openByDefault ? "open" : ""}>
        <summary>${t("details_tech_title") || "Detalhes t\xE9cnicos"}</summary>
        <div class="sg-details-body">M\xE9todo: ${escapeHtml(state.meta.method)}${decodedStr ? `<pre id="sg-decoded-json" class="sg-code">${escapeHtml(decodedStr)}</pre><button type="button" class="sg-copy" data-sg-copy-target="sg-decoded-json">${t("btn_copy_json") || "Copiar JSON"}</button>` : ""}</div>
      </details>
      <details class="sg-details" ${openByDefault ? "open" : ""}>
        <summary>${t("trusted_domain_ref_title") || "Dom\xEDnios confi\xE1veis (refer\xEAncia)"}</summary>
        <div class="sg-details-body"><div class="sg-domain-chips">${domainChipsHtml}</div>${domainToggleHtml}</div>
      </details>
      <details class="sg-details" ${openByDefault ? "open" : ""}>
        <summary>${t("details_more_title") || "Mais explica\xE7\xF5es"}</summary>
        <div class="sg-details-body">${moreExplanationsHtml}</div>
      </details>
    </div>
    <footer class="sg-footer">
      <button type="button" id="sg-deny" class="sg-btn sg-btn-secondary">${t("btn_cancel") || "Cancelar"}</button>
      <button type="button" id="sg-allow" class="sg-btn sg-btn-primary">${t("btn_continue") || "Continuar"}</button>
    </footer>
  </div>
</div>
`;
    state.app.innerHTML = html;
    const closeBtn = state.shadow.getElementById("sg-close");
    if (closeBtn) closeBtn.addEventListener("click", () => decideCurrentAndAdvance(false));
    const denyBtn = state.shadow.getElementById("sg-deny");
    const allowBtn = state.shadow.getElementById("sg-allow");
    if (denyBtn) denyBtn.addEventListener("click", () => decideCurrentAndAdvance(false));
    if (allowBtn) allowBtn.addEventListener("click", () => decideCurrentAndAdvance(true));
    state.shadow.querySelectorAll("[data-sg-copy]").forEach((el) => {
      el.addEventListener("click", () => {
        const v = el.getAttribute("data-sg-copy");
        if (v) tryCopy(v);
      });
    });
    state.shadow.querySelectorAll("[data-sg-copy-target]").forEach((el) => {
      el.addEventListener("click", () => {
        const id = el.getAttribute("data-sg-copy-target");
        const pre = id ? state.shadow.getElementById(id) : null;
        if (pre?.textContent) tryCopy(pre.textContent);
      });
    });
    const domainsToggle = state.shadow.getElementById("sg-domains-toggle");
    if (domainsToggle) {
      domainsToggle.addEventListener("click", () => {
        state.domainsExpanded = !state.domainsExpanded;
        updateOverlay(state);
      });
    }
  }
  function cleanupOverlay() {
    if (__sgOverlay) {
      try {
        __sgOverlay.container.remove();
      } catch {
      }
      try {
        document.removeEventListener("keydown", __sgOverlay.onKey);
      } catch {
      }
      __sgOverlay = null;
    }
  }
  var requestQueue = [];
  function showCurrentPending() {
    const cur = requestQueue[0];
    if (cur) {
      showOverlay(cur.requestId, cur.analysis, {
        host: cur.host,
        method: cur.method,
        params: cur.params,
        chainIdHex: cur.chainIdHex ?? null
      });
    }
  }
  function decideCurrentAndAdvance(allow) {
    const cur = requestQueue[0];
    if (!cur) return;
    console.log(`\u{1F4E8} [SignGuard Content] User decided: ${allow ? "ALLOW" : "BLOCK"}`);
    const analysis = cur.analysis;
    const chainKey = cur.chainIdHex ? String(cur.chainIdHex).toLowerCase() : "";
    const nativeInfo = chainKey ? __sgNativeUsd[chainKey] : null;
    const nativeSymbol = nativeInfo?.symbol ?? (cur.chainIdHex ? getNativeSymbol(cur.chainIdHex) : "ETH");
    const usdPerNative = nativeInfo?.usd ?? analysis.txCostPreview?.usdPerNative;
    const tx = analysis.tx ?? analysis.txCostPreview;
    const valueEth = analysis.tx?.valueEth ?? (tx && tx.valueWei ? weiToEthString(BigInt(tx.valueWei)) : void 0);
    const feeLikely = analysis.txCostPreview?.feeLikelyWei ? weiToEthString(BigInt(analysis.txCostPreview.feeLikelyWei)) : analysis.tx?.maxGasFeeEth;
    const feeMax = analysis.txCostPreview?.feeMaxWei ? weiToEthString(BigInt(analysis.txCostPreview.feeMaxWei)) : analysis.tx?.maxGasFeeEth;
    const totalLikely = analysis.txCostPreview?.totalLikelyWei ? weiToEthString(BigInt(analysis.txCostPreview.totalLikelyWei)) : analysis.tx?.maxTotalEth;
    const totalMax = analysis.txCostPreview?.totalMaxWei ? weiToEthString(BigInt(analysis.txCostPreview.totalMaxWei)) : analysis.tx?.maxTotalEth;
    const historyEvt = {
      ts: Date.now(),
      requestId: cur.requestId,
      host: cur.host,
      method: cur.method,
      to: analysis.tx?.to,
      valueEth,
      feeLikelyEth: feeLikely,
      feeMaxEth: feeMax,
      totalLikelyEth: totalLikely,
      totalMaxEth: totalMax,
      nativeSymbol,
      usdPerNative: usdPerNative ?? void 0,
      decision: allow ? "ALLOW" : "BLOCK",
      score: analysis.score,
      level: analysis.level
    };
    safeSendMessage({ type: "SG_LOG_HISTORY", payload: historyEvt }).catch(() => {
    });
    sendDecisionToMainWorld(cur.requestId, allow);
    requestQueue.shift();
    cleanupOverlay();
    if (requestQueue.length > 0) setTimeout(showCurrentPending, 100);
  }
  window.addEventListener("message", async (ev) => {
    if (ev.source !== window || !ev.data || ev.data.source !== "signguard") return;
    if (ev.data.type !== "SG_REQUEST") return;
    const { requestId, payload } = ev.data;
    console.log("\u{1F4E8} [SignGuard Content] Request received:", payload?.method);
    const url = payload?.url ?? window.location.href;
    const origin = (() => {
      try {
        return new URL(url).origin;
      } catch {
        return window.location.origin;
      }
    })();
    const rpcMeta = payload?.meta ?? null;
    const method = (payload?.method ?? "").toLowerCase();
    const params = Array.isArray(payload?.params) ? payload.params : [];
    const p0 = params[0] && typeof params[0] === "object" ? params[0] : null;
    let chainIdHex = payload?.chainIdHex || toChainIdHex(rpcMeta?.chainId) || toChainIdHex(payload?.chainId) || null;
    if (method === "wallet_switchethereumchain" && p0?.chainId) {
      const fromParams = toChainIdHex(p0.chainId);
      if (fromParams) chainIdHex = fromParams;
    }
    if (method === "wallet_addethereumchain" && p0?.chainId) {
      const fromParams = toChainIdHex(p0.chainId);
      if (fromParams) chainIdHex = fromParams;
    }
    const host = payload?.host && String(payload.host).trim() ? String(payload.host).trim() : inferHost(url);
    const meta = rpcMeta ? { ...rpcMeta, chainIdHex: chainIdHex ?? void 0 } : chainIdHex ? { chainIdHex: chainIdHex ?? void 0 } : void 0;
    const analyzePayload = {
      requestId,
      url,
      origin,
      request: { method: payload?.method ?? "", params },
      meta
    };
    const pending = {
      requestId,
      method: payload?.method ?? "",
      host,
      params: payload?.params,
      chainIdHex: chainIdHex ?? void 0,
      analysis: { level: "LOADING", score: 0, title: "", reasons: [], recommend: "WARN" }
    };
    requestQueue.push(pending);
    if (requestQueue.length === 1) {
      loadSettings().then(() => showCurrentPending());
    }
    try {
      const response = await safeSendMessage({
        type: "ANALYZE",
        payload: analyzePayload
      });
      if (pending.requestId === requestId && response?.analysis) {
        pending.analysis = response.analysis;
        if (__sgOverlay && __sgOverlay.requestId === requestId) {
          __sgOverlay.analysis = response.analysis;
          updateOverlay(__sgOverlay);
        }
      }
    } catch (e) {
      console.error("[SignGuard] handleSGRequest crash:", e);
      console.error("[SignGuard] Background comms failed", e);
    }
  });
})();
//# sourceMappingURL=content.js.map
