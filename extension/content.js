"use strict";
(() => {
  // src/lists/cryptoTrustedDomainsSeed.ts
  var CRYPTO_TRUSTED_DOMAINS_SEED = [
    // Explorers
    "etherscan.io",
    "etherscan.com",
    "arbiscan.io",
    "polygonscan.com",
    "bscscan.com",
    "basescan.org",
    "snowtrace.io",
    "optimistic.etherscan.io",
    // NFTs
    "opensea.io",
    "blur.io",
    "looksrare.org",
    "x2y2.io",
    "rarible.com",
    "magiceden.io",
    // DEX/DeFi
    "uniswap.org",
    "app.uniswap.org",
    "1inch.io",
    "app.1inch.io",
    "aave.com",
    "app.aave.com",
    "curve.fi",
    "app.curve.fi",
    "balancer.fi",
    "app.balancer.fi",
    "sushiswap.fi",
    "matcha.xyz",
    "paraswap.io",
    "cowswap.exchange",
    // Bridges/L2
    "bridge.arbitrum.io",
    "optimism.io",
    "base.org",
    "arbitrum.io",
    "polygon.technology",
    "hop.exchange",
    "stargate.finance",
    "across.to",
    "portalbridge.com",
    "zksync.io",
    // Infra / Wallets
    "chain.link",
    "lido.fi",
    "stake.lido.fi",
    "ens.domains",
    "app.ens.domains",
    "metamask.io",
    "metamask.com",
    "rabby.io",
    "walletconnect.com",
    "walletconnect.org",
    "safe.global",
    "revoke.cash",
    "app.revoke.cash"
  ];

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
      blockApprovals: false
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

  // src/shared/uiGate.ts
  var UI_GATED_METHODS_LIST = [
    "eth_requestAccounts",
    "wallet_requestPermissions",
    "wallet_addEthereumChain",
    "wallet_switchEthereumChain",
    "wallet_watchAsset",
    "wallet_sendTransaction",
    "eth_sendTransaction",
    "eth_signTransaction",
    "eth_sendRawTransaction",
    "wallet_invokeSnap",
    "wallet_requestSnaps",
    "personal_sign",
    "eth_sign",
    "eth_signTypedData",
    "eth_signTypedData_v3",
    "eth_signTypedData_v4"
  ];
  var UI_GATED_METHODS = new Set(UI_GATED_METHODS_LIST.map((m) => m.toLowerCase()));
  function shouldGateUI(method) {
    return UI_GATED_METHODS.has(String(method || "").toLowerCase());
  }

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
      overlay_analyzing: "Analisando Transa\xE7\xE3o...",
      overlay_simulating: "O SignGuard est\xE1 a simular o resultado.",
      overlay_safe: "Parece Seguro",
      overlay_attention: "Aten\xE7\xE3o Detectada",
      overlay_action: "A\xE7\xE3o",
      overlay_simulation_balance: "Simula\xE7\xE3o de Balan\xE7o",
      overlay_approvals_detected: "Aprova\xE7\xF5es detectadas",
      overlay_confirm_allow_msg: "Tem certeza? Isso ignora prote\xE7\xE3o.",
      overlay_confirm_allow: "Confirmar permitir 1 vez",
      overlay_try_again: "Tentar novamente",
      overlay_analysis_taking_long: "A an\xE1lise est\xE1 demorando.",
      overlay_fee_calculated: "Taxas calculadas.",
      overlay_finishing: "Finalizando an\xE1lise...",
      overlay_typed_data_card_title: "Assinatura (EIP-712)",
      overlay_typed_data_sign_warning: "Assinar isso pode permitir gasto futuro sem nova confirma\xE7\xE3o.",
      overlay_allowance_loading: "Allowance atual: \u2026",
      overlay_allowance_current: "Allowance atual: ",
      overlay_allowance_approved: "Aprovado",
      overlay_allowance_not_approved: "N\xE3o aprovado",
      overlay_allowance_unlimited: "Ilimitado",
      simulation_no_changes: "Nenhuma mudan\xE7a de saldo detetada.",
      tx_unknown: "Transa\xE7\xE3o Desconhecida",
      dapp_unknown: "DApp Desconhecido",
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
      btn_block: "Bloquear",
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
      cost_you_receive: "Voc\xEA recebe",
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
      vaultBlockedTitle: "Cofre bloqueou esta a\xE7\xE3o",
      vaultBlockedReason: "O contrato/ativo est\xE1 no Cofre. Desbloqueie temporariamente para prosseguir.",
      vault_unlock_5min: "Desbloquear 5 min",
      vault_unlock_30min: "Desbloquear 30 min",
      vault_unlocked_toast: "Desbloqueado por {n} min",
      overlay_temp_allow_10min: "Permitir por 10 min",
      overlay_temp_allow_toast: "Permitido por 10 min",
      page_risk_warning: "P\xE1gina com poss\xEDvel risco detectado.",
      reason_page_risk_high: "P\xE1gina com risco alto detectado (ex.: lookalike, clickjacking).",
      reason_page_risk_medium: "P\xE1gina com risco m\xE9dio (ex.: frases suspeitas, overlay).",
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
      reason_high_gas: "Taxa de gas alta em rela\xE7\xE3o ao valor.",
      reason_new_spender: "Novo spender \u2014 verifique.",
      reason_contract_target: "Destino \xE9 contrato.",
      reason_known_bad_spender: "Spender bloqueado.",
      reason_known_safe_spender: "Spender na allowlist.",
      reason_unlimited_approval: "Simula\xE7\xE3o: aprova\xE7\xE3o ilimitada detectada.",
      reason_set_approval_for_all: "Simula\xE7\xE3o: ApprovalForAll (permite mover todos os NFTs).",
      reason_snap_invoke: "Snaps podem executar c\xF3digo na carteira. Confirme a origem.",
      reason_sign_tx: "Assinatura de transa\xE7\xE3o sem envio imediato. Pode ser usada depois para broadcast.",
      reason_raw_broadcast: "Broadcast de transa\xE7\xE3o j\xE1 assinada. N\xE3o h\xE1 confirma\xE7\xE3o visual pr\xE9via do conte\xFAdo.",
      reason_read_permissions: "O site est\xE1 a ler as permiss\xF5es j\xE1 concedidas \xE0 carteira.",
      summary_title_snaps: "Snaps / Extens\xF5es da carteira",
      summary_title_read_permissions: "Leitura de permiss\xF5es",
      summary_title_sign_tx: "Assinatura de transa\xE7\xE3o",
      summary_title_raw_tx: "Broadcast de transa\xE7\xE3o assinada",
      summary_title_switch_chain: "Troca de rede",
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
      overlay_analyzing: "Analyzing Transaction...",
      overlay_simulating: "SignGuard is simulating the outcome.",
      overlay_safe: "Looks Safe",
      overlay_attention: "Attention Detected",
      overlay_action: "Action",
      overlay_simulation_balance: "Balance Simulation",
      overlay_approvals_detected: "Approvals detected",
      overlay_confirm_allow_msg: "Are you sure? This bypasses protection.",
      overlay_confirm_allow: "Confirm allow once",
      overlay_try_again: "Try again",
      overlay_analysis_taking_long: "Analysis is taking too long.",
      overlay_fee_calculated: "Fees calculated.",
      overlay_finishing: "Finishing analysis...",
      overlay_typed_data_card_title: "Signature (EIP-712)",
      overlay_typed_data_sign_warning: "Signing this may allow future spending without another confirmation.",
      overlay_allowance_loading: "Current allowance: \u2026",
      overlay_allowance_current: "Current allowance: ",
      overlay_allowance_approved: "Approved",
      overlay_allowance_not_approved: "Not approved",
      overlay_allowance_unlimited: "Unlimited",
      simulation_no_changes: "No balance changes detected.",
      tx_unknown: "Unknown Transaction",
      dapp_unknown: "Unknown DApp",
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
      btn_block: "Block",
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
      cost_you_receive: "You receive",
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
      vaultBlockedTitle: "Vault blocked this action",
      vaultBlockedReason: "The contract/asset is in the Vault. Unlock temporarily to proceed.",
      vault_unlock_5min: "Unlock 5 min",
      vault_unlock_30min: "Unlock 30 min",
      vault_unlocked_toast: "Unlocked for {n} min",
      overlay_temp_allow_10min: "Allow for 10 min",
      overlay_temp_allow_toast: "Allowed for 10 min",
      page_risk_warning: "Possible risk detected on this page.",
      reason_page_risk_high: "High-risk page detected (e.g. lookalike, clickjacking).",
      reason_page_risk_medium: "Medium-risk page (e.g. suspicious phrases, overlay).",
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
      reason_high_gas: "High gas fee relative to value.",
      reason_new_spender: "New spender \u2014 verify.",
      reason_contract_target: "Destination is a contract.",
      reason_known_bad_spender: "Spender blocked.",
      reason_known_safe_spender: "Spender on allowlist.",
      reason_unlimited_approval: "Simulation: unlimited approval detected.",
      reason_set_approval_for_all: "Simulation: ApprovalForAll (allows moving all NFTs).",
      reason_snap_invoke: "Snaps can run code in your wallet. Confirm the source.",
      reason_sign_tx: "Transaction signature without immediate send. May be used later for broadcast.",
      reason_raw_broadcast: "Broadcast of already-signed transaction. No prior visual confirmation of content.",
      reason_read_permissions: "The site is reading the permissions already granted to the wallet.",
      summary_title_snaps: "Snaps / Wallet extensions",
      summary_title_read_permissions: "Read permissions",
      summary_title_sign_tx: "Transaction signature",
      summary_title_raw_tx: "Signed transaction broadcast",
      summary_title_switch_chain: "Switch network",
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
  function hasRuntime(c) {
    try {
      return !!(c?.runtime?.id && typeof c.runtime.sendMessage === "function");
    } catch {
      return false;
    }
  }
  function getChromeApi() {
    const localChrome = typeof chrome !== "undefined" ? chrome : null;
    if (hasRuntime(localChrome)) return localChrome;
    const globalChrome = typeof globalThis !== "undefined" ? globalThis.chrome : null;
    if (hasRuntime(globalChrome)) return globalChrome;
    return null;
  }
  function getPort() {
    try {
      const c = getChromeApi();
      if (!c?.runtime?.connect) return null;
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
                const c = getChromeApi();
                if (!c?.runtime?.sendMessage) return r();
                c.runtime.sendMessage({ type: "PING" }, () => {
                  void c?.runtime?.lastError;
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
      const c = getChromeApi();
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
      const c = getChromeApi();
      if (!c?.runtime?.getURL) return "";
      return c.runtime.getURL(path);
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

  // src/shared/reasonKeys.ts
  var REASON_KEYS = {
    NEW_DOMAIN: "NEW_DOMAIN",
    KNOWN_BAD_DOMAIN: "KNOWN_BAD_DOMAIN",
    KNOWN_SAFE_DOMAIN: "KNOWN_SAFE_DOMAIN",
    UNLIMITED_APPROVAL: "UNLIMITED_APPROVAL",
    SET_APPROVAL_FOR_ALL: "SET_APPROVAL_FOR_ALL",
    PERMIT_GRANT: "PERMIT_GRANT",
    PERMIT2_GRANT: "PERMIT2_GRANT",
    HIGH_VALUE_TRANSFER: "HIGH_VALUE_TRANSFER",
    NEW_SPENDER: "NEW_SPENDER",
    FRESH_DEPLOY: "FRESH_DEPLOY",
    SIM_FAILED: "SIM_FAILED",
    TOKEN_LOW_CONFIDENCE: "TOKEN_LOW_CONFIDENCE",
    ADDRESS_BLOCKLIST: "ADDRESS_BLOCKLIST",
    KNOWN_BAD_SPENDER: "KNOWN_BAD_SPENDER",
    KNOWN_SAFE_SPENDER: "KNOWN_SAFE_SPENDER",
    TOKEN_SCAM: "TOKEN_SCAM",
    PHISHING: "PHISHING",
    PUNYCODE_DOMAIN: "PUNYCODE_DOMAIN",
    LOOKALIKE: "LOOKALIKE",
    NFT_PURCHASE: "NFT_PURCHASE",
    TOKEN_SWAP: "TOKEN_SWAP",
    MARKETPLACE_SIGNATURE: "MARKETPLACE_SIGNATURE",
    MARKETPLACE_LISTING: "MARKETPLACE_LISTING",
    HIGH_GAS: "HIGH_GAS",
    CONTRACT_TARGET: "CONTRACT_TARGET",
    VAULT_LOCKED: "VAULT_LOCKED",
    SPENDER_DENYLIST: "SPENDER_DENYLIST",
    SPENDER_ALLOWLIST: "SPENDER_ALLOWLIST",
    PAGE_RISK_HIGH: "PAGE_RISK_HIGH",
    PAGE_RISK_MEDIUM: "PAGE_RISK_MEDIUM",
    FAILMODE_FALLBACK: "FAILMODE_FALLBACK",
    SIMULATION_TIMEOUT: "SIMULATION_TIMEOUT",
    SNAP_INVOKE: "SNAP_INVOKE",
    REQUEST_SNAPS: "REQUEST_SNAPS",
    SIGN_TRANSACTION: "SIGN_TRANSACTION",
    RAW_TX_BROADCAST: "RAW_TX_BROADCAST",
    READ_PERMISSIONS: "READ_PERMISSIONS"
  };

  // src/content.ts
  var IS_TOP_FRAME = (() => {
    try {
      return typeof window !== "undefined" && window.top === window;
    } catch {
      return true;
    }
  })();
  console.log("[SignGuard Content] loaded", { top: IS_TOP_FRAME, href: location.href });
  var __sgPageRiskResult = null;
  var SG_DECISION_EVENT = "__sg_decision__";
  var __sgPreflightCache = /* @__PURE__ */ new Map();
  var __sgDedupeMap = /* @__PURE__ */ new Map();
  var DEDUPE_MS = 3e3;
  var RELAY_TIMEOUT_MS = 15e3;
  var relayPending = /* @__PURE__ */ new Map();
  function stableStringifyParams(val) {
    if (val === null) return "null";
    if (val === void 0) return "undefined";
    if (typeof val !== "object") return String(val);
    if (Array.isArray(val)) return "[" + val.map(stableStringifyParams).join(",") + "]";
    const obj = val;
    const keys = Object.keys(obj).sort();
    return "{" + keys.map((k) => JSON.stringify(k) + ":" + stableStringifyParams(obj[k])).join(",") + "}";
  }
  var RPC_ALLOWED = /* @__PURE__ */ new Set(["eth_call", "eth_chainid", "eth_getcode", "eth_getblockbynumber", "eth_getlogs", "eth_estimategas"]);
  var AUTO_ALLOW_METHODS = /* @__PURE__ */ new Set(["wallet_getPermissions"]);
  var __allowanceCache = /* @__PURE__ */ new Map();
  var ALLOWANCE_CACHE_TTL_MS = 15e3;
  function padAddr(addr) {
    const a = String(addr).toLowerCase().replace(/^0x/, "");
    return a.padStart(64, "0");
  }
  function encodeAllowanceCall(token, owner, spender) {
    return {
      to: token,
      data: "0xdd62ed3e" + padAddr(owner) + padAddr(spender)
    };
  }
  function encodeIsApprovedForAllCall(token, owner, operator) {
    return {
      to: token,
      data: "0xe985e9c5" + padAddr(owner) + padAddr(operator)
    };
  }
  function decodeUint256Hex(hex) {
    try {
      const h = String(hex || "").replace(/^0x/, "");
      if (h.length < 64) return 0n;
      return BigInt("0x" + h);
    } catch {
      return 0n;
    }
  }
  function decodeBoolHex(hex) {
    try {
      const h = String(hex || "").replace(/^0x/, "");
      if (h.length < 64) return false;
      return BigInt("0x" + h.slice(-64)) !== 0n;
    } catch {
      return false;
    }
  }
  async function fetchCurrentAllowance(chainIdHex, token, owner, spender, isNft) {
    if (!token || !owner || !spender || !/^0x[a-fA-F0-9]{40}$/.test(token) || !/^0x[a-fA-F0-9]{40}$/.test(owner) || !/^0x[a-fA-F0-9]{40}$/.test(spender))
      return null;
    const key = `${chainIdHex ?? ""}:${token}:${owner}:${spender}:${isNft}`;
    const cached = __allowanceCache.get(key);
    if (cached && Date.now() - cached.ts < ALLOWANCE_CACHE_TTL_MS) return cached.value;
    const { to, data } = isNft ? encodeIsApprovedForAllCall(token, owner, spender) : encodeAllowanceCall(token, owner, spender);
    try {
      const timeoutMs = 1500;
      const res = await Promise.race([
        rpcViaMainWorld("eth_call", [{ to, data }]),
        new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), timeoutMs))
      ]);
      if (!res || typeof res !== "object" || !res.ok) return null;
      const result = res.result;
      if (typeof result !== "string") return null;
      const MAX_U256 = 2n ** 256n - 1n;
      const value = isNft ? decodeBoolHex(result) ? t("overlay_allowance_approved") || "Aprovado" : t("overlay_allowance_not_approved") || "N\xE3o aprovado" : (() => {
        const v = decodeUint256Hex(result);
        return v >= MAX_U256 ? t("overlay_allowance_unlimited") || "Ilimitado" : v.toString();
      })();
      __allowanceCache.set(key, { value, ts: Date.now() });
      return value;
    } catch {
      return null;
    }
  }
  function rpcViaMainWorld(method, params) {
    return new Promise((resolve) => {
      const requestId = typeof crypto?.randomUUID === "function" ? crypto.randomUUID() : `rpc_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      const timeout = setTimeout(() => {
        window.removeEventListener("message", handler);
        resolve({ ok: false, error: "timeout" });
      }, 2e3);
      const handler = (ev) => {
        if (ev.source !== window || ev.data?.source !== "signguard-mainworld" || ev.data?.type !== "SG_RPC_CALL_RES" || ev.data?.requestId !== requestId) return;
        clearTimeout(timeout);
        window.removeEventListener("message", handler);
        resolve({ ok: ev.data.ok ?? false, result: ev.data.result, error: ev.data.error });
      };
      window.addEventListener("message", handler);
      window.postMessage({ source: "signguard-content", type: "SG_RPC_CALL_REQ", requestId, method, params: params ?? [] }, "*");
    });
  }
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg?.type !== "SG_RPC_CALL_REQUEST") return false;
    const method = msg?.method ?? msg?.payload?.method;
    const params = msg?.params ?? msg?.payload?.params ?? [];
    if (!method || !RPC_ALLOWED.has(String(method).toLowerCase())) {
      sendResponse({ ok: false, error: "method_not_allowed" });
      return false;
    }
    rpcViaMainWorld(String(method), Array.isArray(params) ? params : []).then((r) => {
      sendResponse(r);
    });
    return true;
  });
  function sendDecisionToMainWorld(requestId, allow, meta) {
    const detail = { type: "SG_DECISION", requestId, allow, meta };
    window.dispatchEvent(new CustomEvent(SG_DECISION_EVENT, { detail }));
    window.postMessage({ source: "signguard-content", type: "SG_DECISION", requestId, allow, meta }, "*");
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
  function getRiskColor(level) {
    if (level === "HIGH" || level === "CRITICAL" || level === "BLOCK") return "#ef4444";
    if (level === "WARN") return "#f59e0b";
    return "#22c55e";
  }
  function renderAssetChanges(changes) {
    if (!changes || changes.length === 0)
      return `<div style="opacity:0.6; font-size:12px;">${escapeHtml(t("simulation_no_changes") || "Nenhuma mudan\xE7a de saldo detetada.")}</div>`;
    return changes.map(
      (c) => `
    <div style="display:flex; justify-content:space-between; font-size:13px; margin-bottom:4px; padding:4px; background:rgba(255,255,255,0.05); border-radius:4px;">
      <span style="color:${c.type === "OUT" ? "#ef4444" : "#22c55e"}">${c.type === "OUT" ? "\u{1F4E4} Sai" : "\u{1F4E5} Entra"}</span>
      <span>${escapeHtml(c.amount)} <b>${escapeHtml(c.symbol)}</b></span>
    </div>
  `
    ).join("");
  }
  function renderTypeSpecificPanel(action, meta, analysis) {
    const host = meta.host || "";
    const params = meta.params ?? [];
    const p0 = Array.isArray(params) && params[0] && typeof params[0] === "object" ? params[0] : null;
    if (action === "CONNECT") {
      const dd = analysis.domainListDecision;
      const signals = analysis.domainSignals ?? [];
      const puny = host.includes("xn--");
      const trustBadge = dd === "TRUSTED" ? '<span style="color:#22c55e;">\u2713 Dom\xEDnio confi\xE1vel</span>' : dd === "BLOCKED" ? '<span style="color:#ef4444;">\u26A0 Dom\xEDnio bloqueado</span>' : puny ? '<span style="color:#f59e0b;">\u26A0 Dom\xEDnio punycode (poss\xEDvel lookalike)</span>' : '<span style="color:#94a3b8;">Dom\xEDnio n\xE3o verificado</span>';
      return `
      <div style="margin-bottom:15px; background:#1e293b; padding:12px; border-radius:8px;">
        <p style="font-size:11px; text-transform:uppercase; color:#64748b; font-weight:bold; margin:0 0 6px 0;">${escapeHtml(t("overlay_action") || "A\xE7\xE3o")}</p>
        <p style="margin:0 0 6px 0; font-size:14px;">\u{1F517} ${escapeHtml(actionTitle("CONNECT"))}</p>
        <p style="margin:0 0 6px 0; font-size:12px;">${escapeHtml(host)}</p>
        <p style="margin:0; font-size:12px;">${trustBadge}</p>
        ${signals.length ? `<p style="margin:6px 0 0 0; font-size:11px; color:#94a3b8;">${escapeHtml(signals.join(", "))}</p>` : ""}
      </div>`;
    }
    if (action === "REQUEST_PERMISSIONS") {
      const perms = p0 && typeof p0 === "object" ? Array.isArray(p0) ? p0 : Object.keys(p0) : [];
      const permList = perms.length ? perms.map((x) => escapeHtml(typeof x === "string" ? x : JSON.stringify(x))).join(", ") : escapeHtml(JSON.stringify(p0 ?? "{}"));
      return `
      <div style="margin-bottom:15px; background:#1e293b; padding:12px; border-radius:8px;">
        <p style="font-size:11px; text-transform:uppercase; color:#64748b; font-weight:bold; margin:0 0 6px 0;">${escapeHtml(t("overlay_action") || "A\xE7\xE3o")}</p>
        <p style="margin:0 0 6px 0; font-size:14px;">\u{1F510} ${escapeHtml(actionTitle("REQUEST_PERMISSIONS"))}</p>
        <p style="margin:0; font-size:12px; color:#94a3b8;">Site poder\xE1 ver/solicitar contas. Permiss\xF5es: ${permList}</p>
      </div>`;
    }
    if (action === "ADD_CHAIN") {
      const info = analysis.addChainInfo ?? p0;
      const chainId = info?.chainId ?? meta.chainIdRequested ?? "?";
      const chainName = info?.chainName ?? "?";
      const native = info?.nativeCurrency ?? p0?.nativeCurrency;
      const symbol = native?.symbol ?? native?.name ?? "?";
      const decimals = native?.decimals ?? 18;
      const rpcUrls = info?.rpcUrls ?? p0?.rpcUrls ?? [];
      const rpc0 = Array.isArray(rpcUrls) ? rpcUrls[0] : typeof rpcUrls === "string" ? rpcUrls : "";
      const explorerUrls = info?.blockExplorerUrls ?? p0?.blockExplorerUrls ?? [];
      const exp0 = Array.isArray(explorerUrls) ? explorerUrls[0] : typeof explorerUrls === "string" ? explorerUrls : "";
      const chainIdHex = String(chainId).startsWith("0x") ? chainId : "0x" + parseInt(String(chainId), 10).toString(16);
      const chainInfo = getChainInfo(chainIdHex);
      const knownChain = chainInfo ? `${chainInfo.name} (conhecida)` : "Rede n\xE3o reconhecida";
      return `
      <div style="margin-bottom:15px; background:#1e293b; padding:12px; border-radius:8px;">
        <p style="font-size:11px; text-transform:uppercase; color:#64748b; font-weight:bold; margin:0 0 6px 0;">${escapeHtml(t("overlay_action") || "A\xE7\xE3o")}</p>
        <p style="margin:0 0 6px 0; font-size:14px;">\u2795 ${escapeHtml(actionTitle("ADD_CHAIN"))}</p>
        <p style="margin:0 0 4px 0; font-size:12px;"><b>chainId:</b> ${escapeHtml(String(chainId))} (${escapeHtml(knownChain)})</p>
        <p style="margin:0 0 4px 0; font-size:12px;"><b>Nome:</b> ${escapeHtml(String(chainName))}</p>
        <p style="margin:0 0 4px 0; font-size:12px;"><b>Moeda:</b> ${escapeHtml(symbol)} (decimals: ${decimals})</p>
        ${rpc0 ? `<p style="margin:0 0 4px 0; font-size:11px; color:#94a3b8;"><b>RPC:</b> ${escapeHtml(String(rpc0).slice(0, 50))}\u2026</p>` : ""}
        ${exp0 ? `<p style="margin:0; font-size:11px; color:#94a3b8;"><b>Explorer:</b> ${escapeHtml(String(exp0).slice(0, 50))}\u2026</p>` : ""}
      </div>`;
    }
    if (action === "SWITCH_CHAIN") {
      const chainId = p0?.chainId ?? meta.chainIdRequested ?? "?";
      const chainIdHex = String(chainId).startsWith("0x") ? chainId : "0x" + parseInt(String(chainId), 10).toString(16);
      const chainInfo = getChainInfo(chainIdHex);
      const name = chainInfo?.name ?? analysis.chainTarget?.chainName ?? "Rede desconhecida";
      return `
      <div style="margin-bottom:15px; background:#1e293b; padding:12px; border-radius:8px;">
        <p style="font-size:11px; text-transform:uppercase; color:#64748b; font-weight:bold; margin:0 0 6px 0;">${escapeHtml(t("overlay_action") || "A\xE7\xE3o")}</p>
        <p style="margin:0 0 6px 0; font-size:14px;">\u{1F504} ${escapeHtml(actionTitle("SWITCH_CHAIN"))}</p>
        <p style="margin:0; font-size:12px;"><b>chainId:</b> ${escapeHtml(String(chainId))} \u2014 ${escapeHtml(name)}</p>
      </div>`;
    }
    if (action === "WATCH_ASSET") {
      const info = analysis.watchAssetInfo ?? p0?.options ?? p0;
      const type_ = info?.type ?? p0?.type ?? "ERC20";
      const addr = info?.address ?? info?.token_address ?? "?";
      const symbol = info?.symbol ?? "?";
      const decimals = info?.decimals ?? 18;
      const image = info?.image ?? "";
      const decimalsWarn = decimals < 0 || decimals > 18 ? '<span style="color:#f59e0b;">\u26A0 decimals fora de [0..18]</span>' : "";
      return `
      <div style="margin-bottom:15px; background:#1e293b; padding:12px; border-radius:8px;">
        <p style="font-size:11px; text-transform:uppercase; color:#64748b; font-weight:bold; margin:0 0 6px 0;">${escapeHtml(t("overlay_action") || "A\xE7\xE3o")}</p>
        <p style="margin:0 0 6px 0; font-size:14px;">\u{1F441} ${escapeHtml(actionTitle("WATCH_ASSET"))}</p>
        <p style="margin:0 0 4px 0; font-size:12px;"><b>Tipo:</b> ${escapeHtml(String(type_))}</p>
        <p style="margin:0 0 4px 0; font-size:11px; word-break:break-all;"><b>Endere\xE7o:</b> ${escapeHtml(String(addr).slice(0, 20))}\u2026</p>
        <p style="margin:0; font-size:12px;"><b>Symbol:</b> ${escapeHtml(String(symbol))} (decimals: ${decimals}) ${decimalsWarn}</p>
        ${image ? `<p style="margin:4px 0 0 0; font-size:11px; color:#94a3b8;">Imagem: ${escapeHtml(String(image).slice(0, 40))}\u2026</p>` : ""}
      </div>`;
    }
    if (action === "SIGN_MESSAGE") {
      const msg = Array.isArray(params) && typeof params[0] === "string" ? params[0] : p0 ? JSON.stringify(p0).slice(0, 200) : "";
      const preview = msg ? msg.length > 120 ? msg.slice(0, 120) + "\u2026" : msg : "\u2014";
      return `
      <div style="margin-bottom:15px; background:#1e293b; padding:12px; border-radius:8px;">
        <p style="font-size:11px; text-transform:uppercase; color:#64748b; font-weight:bold; margin:0 0 6px 0;">${escapeHtml(t("overlay_action") || "A\xE7\xE3o")}</p>
        <p style="margin:0 0 6px 0; font-size:14px;">\u270D\uFE0F ${escapeHtml(actionTitle("SIGN_MESSAGE"))}</p>
        <p style="margin:0; font-size:12px; word-break:break-word; max-height:80px; overflow-y:auto;">${escapeHtml(preview)}</p>
      </div>`;
    }
    if (action === "SIGN_TYPED_DATA") {
      const decoded = analysis.typedDataDecoded;
      const permit2 = decoded?.permit2;
      const seaport = decoded?.seaport;
      const isBlur = decoded?.isBlur;
      const extras = analysis.typedDataExtras;
      const raw = analysis.decoded?.raw ?? p0;
      const domain = typeof raw === "object" && raw?.domain ? raw.domain : {};
      const primaryType = raw?.primaryType ?? raw?.types?.EIP712Domain ? "EIP712" : "?";
      const contract = domain?.verifyingContract ?? domain?.name ?? "?";
      const isPermitLike = !!(permit2 || extras?.spender && (extras?.value != null || extras?.deadline != null));
      const signWarning = t("overlay_typed_data_sign_warning") || "Assinar isso pode permitir gasto futuro sem nova confirma\xE7\xE3o.";
      let body = "";
      if (isPermitLike) {
        body += `<p style="margin:0 0 8px 0; font-size:11px; text-transform:uppercase; color:#f59e0b; font-weight:bold;">${escapeHtml(t("overlay_typed_data_card_title") || "Assinatura (EIP-712)")}</p>`;
        if (permit2) {
          body += `<p style="margin:0 0 4px 0; font-size:12px;"><b>Spender/Operator:</b> <code style="word-break:break-all;">${escapeHtml(permit2.spender.slice(0, 14))}\u2026</code></p>`;
          if (permit2.tokens?.length) body += `<p style="margin:0 0 4px 0; font-size:11px;">Token(s): ${permit2.tokens.length} \u2014 ${permit2.unlimited ? "\u221E Ilimitado" : "valor limitado"}</p>`;
          if (permit2.sigDeadline) body += `<p style="margin:0 0 4px 0; font-size:11px;">Deadline: ${escapeHtml(permit2.sigDeadline)}</p>`;
        }
        if (extras?.spender) {
          body += `<p style="margin:0 0 4px 0; font-size:12px;"><b>Spender:</b> <code style="word-break:break-all;">${escapeHtml(extras.spender.slice(0, 14))}\u2026</code></p>`;
          if (extras.value != null) body += `<p style="margin:0 0 4px 0; font-size:11px;">Valor: ${escapeHtml(extras.value)}</p>`;
          if (extras.deadline) body += `<p style="margin:0 0 4px 0; font-size:11px;">Deadline: ${escapeHtml(extras.deadline)}</p>`;
        }
        body += `<p style="margin:8px 0 0 0; font-size:11px; color:#fcd34d;">\u26A0\uFE0F ${escapeHtml(signWarning)}</p>`;
      }
      if (seaport) {
        body += `<p style="margin:0 0 4px 0; font-size:12px;"><b>Seaport:</b> Voc\xEA oferece ${escapeHtml(seaport.offerSummary)} \u2192 Recebe ${escapeHtml(seaport.considerationSummary)}</p>`;
      }
      if (isBlur) {
        body += `<p style="margin:0 0 4px 0; font-size:12px; color:#f59e0b;"><b>Blur:</b> Assinatura de marketplace \u2014 revise com cuidado</p>`;
      }
      body += `<p style="margin:0 0 4px 0; font-size:12px;"><b>primaryType:</b> ${escapeHtml(String(primaryType))}</p>`;
      body += `<p style="margin:0 0 4px 0; font-size:11px; word-break:break-all;"><b>Contract:</b> ${escapeHtml(String(contract).slice(0, 24))}\u2026</p>`;
      body += `<p style="margin:0; font-size:11px; color:#94a3b8;">Leia o que voc\xEA est\xE1 autorizando na carteira.</p>`;
      return `
      <div style="margin-bottom:15px; background:#1e293b; padding:12px; border-radius:8px;">
        <p style="font-size:11px; text-transform:uppercase; color:#64748b; font-weight:bold; margin:0 0 6px 0;">${escapeHtml(t("overlay_action") || "A\xE7\xE3o")}</p>
        <p style="margin:0 0 6px 0; font-size:14px;">\u270D\uFE0F ${escapeHtml(actionTitle("SIGN_TYPED_DATA"))}</p>
        ${body}
      </div>`;
    }
    if (action === "SEND_TX") {
      const tx = analysis.tx ?? p0;
      const to = tx?.to ?? "?";
      const value = tx?.valueEth ?? tx?.valueWei ?? (tx?.value != null ? String(tx.value) : "?");
      const gasFmt = analysis.txCostPreview?.feeLikelyWei ? weiToEthString(BigInt(analysis.txCostPreview.feeLikelyWei)) + " " + getNativeSymbol(meta.chainIdHex ?? void 0) : t("overlay_calculating") || "Calculando...";
      const usd = analysis.txCostPreview?.usdPerNative && analysis.txCostPreview?.feeLikelyWei ? ` (~$${(parseFloat(analysis.txCostPreview.feeLikelyWei) / 1e18 * analysis.txCostPreview.usdPerNative).toFixed(2)} USD)` : "";
      const selector = tx?.selector ?? "";
      const selLabel = selector ? selectorToLabel(selector) : null;
      const da = analysis.decodedAction;
      const te = analysis.txExtras;
      const isNftTransfer = da?.kind === "TRANSFER_NFT";
      const nftInfo = isNftTransfer && da ? `<p style="margin:0 0 4px 0; font-size:12px;">\u{1F5BC}\uFE0F ${escapeHtml(da.standard ?? "NFT")} transfer ${da.tokenIdRaw ? `#${da.tokenIdRaw}` : ""} \u2192 ${escapeHtml((da.to ?? "?").slice(0, 12))}\u2026</p>` : "";
      const isApproval = te?.approvalType === "ERC20_APPROVE" || te?.approvalType === "NFT_SET_APPROVAL_FOR_ALL" || da?.kind === "APPROVE_ERC20" || da?.kind === "INCREASE_ALLOWANCE" || da?.kind === "SET_APPROVAL_FOR_ALL";
      const allowanceBlock = isApproval && to && /^0x[a-fA-F0-9]{40}$/.test(String(to)) ? `<div id="sg-allowance-block" style="margin:8px 0 0 0; font-size:11px; color:#94a3b8;">${escapeHtml(t("overlay_allowance_loading") || "Allowance atual: \u2026")}</div>` : "";
      return `
      <div style="margin-bottom:15px; background:#1e293b; padding:12px; border-radius:8px;">
        <p style="font-size:11px; text-transform:uppercase; color:#64748b; font-weight:bold; margin:0 0 6px 0;">${escapeHtml(t("overlay_action") || "A\xE7\xE3o")}</p>
        <p style="margin:0 0 6px 0; font-size:14px;">\u{1F4E4} ${escapeHtml(actionTitle("SEND_TX"))}</p>
        <p style="margin:0 0 4px 0; font-size:11px; word-break:break-all;"><b>Para:</b> ${escapeHtml(String(to).slice(0, 24))}\u2026</p>
        ${nftInfo}
        <p style="margin:0 0 4px 0; font-size:12px;"><b>Valor:</b> ${escapeHtml(String(value))} ${getNativeSymbol(meta.chainIdHex ?? void 0)}</p>
        <p style="margin:0 0 4px 0; font-size:12px;"><b>Gas estimado:</b> ${escapeHtml(gasFmt)}${usd}</p>
        ${selLabel ? `<p style="margin:0; font-size:11px; color:#38bdf8;"><b>Fun\xE7\xE3o:</b> ${escapeHtml(selLabel)}</p>` : ""}
        ${allowanceBlock}
      </div>`;
    }
    return `
    <div style="margin-bottom:15px;">
      <p style="font-size:11px; text-transform:uppercase; color:#64748b; font-weight:bold; margin-bottom:5px;">${escapeHtml(t("overlay_action") || "A\xE7\xE3o")}</p>
      <code style="background:#1e293b; padding:4px 8px; border-radius:4px; color:#38bdf8; font-size:12px;">${escapeHtml(meta.method)}</code>
    </div>`;
  }
  var __sgOverlay = null;
  var OVERLAY_CSS_FALLBACK = `
*{box-sizing:border-box}
.sg-backdrop{position:fixed;inset:0;background:rgba(15,23,42,0.6);z-index:2147483647;display:flex;align-items:center;justify-content:center;padding:16px;pointer-events:auto}
.sg-modal{width:min(820px,100vw);max-height:85vh;background:rgba(15,23,42,0.95);border:1px solid #334155;border-radius:14px;box-shadow:0 20px 50px rgba(0,0,0,0.5);display:flex;flex-direction:column;overflow:hidden;pointer-events:auto}
.sg-header,.sg-body,.sg-footer{pointer-events:auto}
.sg-header{padding:12px 16px;border-bottom:1px solid rgba(148,163,184,0.18)}
.sg-body{flex:1;overflow-y:auto;padding:16px}
.sg-footer{display:flex;gap:12px;justify-content:flex-end;padding:14px 16px;border-top:1px solid rgba(255,255,255,0.06);background:rgba(8,12,20,0.92)}
.sg-card{background:rgba(2,6,23,0.5);border:1px solid rgba(148,163,184,0.18);border-radius:10px;padding:12px 16px;margin-bottom:12px}
.sg-btn,.sg-btn-primary,.sg-btn-secondary{all:unset;cursor:pointer;padding:10px 18px;border-radius:10px;font-weight:700;font-size:13px}
.sg-btn-primary{background:#f97316;color:#0b1220}
.sg-btn-secondary{background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);color:#e5e7eb}
.sg-close-btn{all:unset;cursor:pointer;width:32px;height:32px;display:flex;align-items:center;justify-content:center}
input,textarea{background:#020617;border:1px solid rgba(148,163,184,0.2);color:#f8fafc;border-radius:8px;padding:10px}
body,.sg-root{font-family:system-ui,sans-serif;color:#f8fafc;background:transparent}
`;
  function ensureOverlayCss(shadow) {
    const applyFallback = (reason) => {
      try {
        const style = document.createElement("style");
        style.textContent = OVERLAY_CSS_FALLBACK;
        shadow.appendChild(style);
        console.warn("[SignGuard UI] CSS fallback inline applied:", reason);
      } catch {
        console.warn("[SignGuard UI] CSS fallback failed:", reason);
      }
    };
    try {
      let href = safeGetURL("overlay.css");
      if (!href && typeof chrome?.runtime?.getURL === "function") {
        try {
          href = chrome.runtime.getURL("overlay.css");
        } catch {
        }
      }
      if (!href) {
        applyFallback("getURL returned empty");
        return;
      }
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = href;
      link.onerror = () => applyFallback("overlay.css failed to load");
      shadow.appendChild(link);
    } catch (e) {
      applyFallback(String(e?.message ?? e));
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
      try {
        safeSendMessage({ type: "SG_DIAG_PUSH", payload: { kind: "OVERLAY_SHOWN", requestId, method: meta.method } }, 500);
      } catch {
      }
      return;
    }
    try {
      const container = document.createElement("div");
      container.id = "__sg_host";
      container.className = "sg-root";
      container.setAttribute("data-sg-overlay", "1");
      container.style.cssText = "position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; z-index: 2147483647; pointer-events: none;";
      const shadow = container.attachShadow({ mode: "open" });
      ensureOverlayCss(shadow);
      const app = document.createElement("div");
      app.id = "sg-app";
      app.style.pointerEvents = "auto";
      shadow.appendChild(app);
      const previousActive = document.activeElement;
      const prevOverflow = document.documentElement.style.overflow;
      document.documentElement.style.overflow = "hidden";
      const onKey = (e) => {
        if (e.key === "Escape") {
          decideCurrentAndAdvance(false);
          return;
        }
        if (e.key === "Tab") {
          const focusables = shadow.querySelectorAll("button, [tabindex]:not([tabindex='-1'])");
          const arr = Array.from(focusables);
          if (arr.length === 0) return;
          const idx = arr.indexOf(document.activeElement);
          if (e.shiftKey) {
            const next = idx <= 0 ? arr[arr.length - 1] : arr[idx - 1];
            next?.focus();
            e.preventDefault();
          } else {
            const next = idx < 0 || idx >= arr.length - 1 ? arr[0] : arr[idx + 1];
            next?.focus();
            e.preventDefault();
          }
        }
      };
      document.addEventListener("keydown", onKey);
      __sgOverlay = {
        requestId,
        analysis,
        meta,
        container,
        shadow,
        app,
        onKey,
        prevFocus: previousActive,
        _inertTargets: [],
        _restore: () => {
          const state2 = __sgOverlay;
          if (state2?._inertTargets) {
            for (const el of state2._inertTargets) {
              try {
                el.removeAttribute("inert");
                el.removeAttribute("aria-hidden");
              } catch {
              }
            }
          }
          document.documentElement.style.overflow = prevOverflow;
          try {
            if (previousActive && typeof previousActive.focus === "function" && document.body?.contains(previousActive)) {
              previousActive.focus();
            } else {
              document.body?.focus?.();
            }
          } catch {
          }
        }
      };
      if (document.documentElement) {
        document.documentElement.appendChild(container);
      } else {
        document.body.appendChild(container);
      }
      const state = __sgOverlay;
      const inertTargets = [];
      for (const el of Array.from(document.documentElement.children)) {
        if (el !== container) {
          el.setAttribute("inert", "");
          el.setAttribute("aria-hidden", "true");
          inertTargets.push(el);
        }
      }
      state._inertTargets = inertTargets;
      if (state) updateOverlay(state);
      try {
        safeSendMessage({ type: "SG_DIAG_PUSH", payload: { kind: "OVERLAY_SHOWN", requestId, method: meta.method } }, 500);
      } catch {
      }
      setTimeout(() => {
        const toFocus = shadow.querySelector("[data-sg-initial-focus]") ?? shadow.querySelector("button, [tabindex]:not([tabindex='-1'])");
        toFocus?.focus?.();
      }, 50);
    } catch (e) {
      console.error("\u{1F3A8} [SignGuard UI] FATAL UI ERROR:", e);
    }
  }
  function updateOverlay(state) {
    if (!state?.app) return;
    const analysis = state.analysis;
    const cost = analysis?.txCostPreview;
    const feeEstimated = cost?.feeEstimated === true;
    const showLoading = !analysis || analysis.level === "LOADING" && !feeEstimated;
    if (showLoading) {
      if (state._watchdogId != null) clearTimeout(state._watchdogId);
      state._watchdogId = setTimeout(() => {
        state._watchdogId = null;
        if (__sgOverlay?.requestId !== state.requestId || !state.app) return;
        const tryAgainLabel = t("overlay_try_again") || "Tentar novamente";
        const closeLabel = t("btn_close") || "Fechar";
        state.app.innerHTML = `
        <div class="sg-card" style="background:#0f172a; padding:30px; border-radius:16px; color:white; width:360px; text-align:center; font-family:sans-serif; border:1px solid #334155; box-shadow:0 20px 50px rgba(0,0,0,0.5);">
          <h3 style="margin:0; font-size:16px;">${escapeHtml(t("overlay_analyzing") || "Analisando Transa\xE7\xE3o...")}</h3>
          <p style="opacity:0.8; font-size:13px; margin-top:12px;">${escapeHtml(t("overlay_analysis_taking_long") || "A an\xE1lise est\xE1 demorando.")}</p>
          <div style="display:flex; gap:12px; margin-top:20px; justify-content:center;">
            <button id="sg-btn-retry-loading" style="flex:1; background:#f59e0b; color:black; border:none; padding:12px; border-radius:8px; font-weight:600; cursor:pointer;">${escapeHtml(tryAgainLabel)}</button>
            <button id="sg-btn-close-loading" style="flex:1; background:#334155; color:white; border:none; padding:12px; border-radius:8px; font-weight:600; cursor:pointer;">${escapeHtml(closeLabel)}</button>
          </div>
        </div>
      `;
        state.shadow.getElementById("sg-btn-retry-loading")?.addEventListener("click", () => retryAnalyze());
        state.shadow.getElementById("sg-btn-close-loading")?.addEventListener("click", () => decideCurrentAndAdvance(false));
      }, 8e3);
      state.app.innerHTML = `
      <div class="sg-card" style="background:#0f172a; padding:30px; border-radius:16px; color:white; width:360px; text-align:center; font-family:sans-serif; border:1px solid #334155; box-shadow:0 20px 50px rgba(0,0,0,0.5);">
        <div class="sg-spinner" style="border:3px solid rgba(255,255,255,0.3); border-top:3px solid #38bdf8; border-radius:50%; width:30px; height:30px; animation:sg-spin 1s linear infinite; margin:0 auto 15px;"></div>
        <h3 style="margin:0; font-size:16px;">${escapeHtml(t("overlay_analyzing") || "Analisando Transa\xE7\xE3o...")}</h3>
        <p style="opacity:0.6; font-size:12px; margin-top:5px;">${feeEstimated ? escapeHtml(t("overlay_fee_calculated") || "Taxas calculadas.") + " " + (t("overlay_finishing") || "Finalizando an\xE1lise...") : escapeHtml(t("overlay_simulating") || "O SignGuard est\xE1 a simular o resultado.")}</p>
        <div style="display:flex; gap:12px; margin-top:20px; justify-content:center;">
          <button id="sg-btn-block-loading" style="flex:1; background:#334155; color:white; border:none; padding:12px; border-radius:8px; font-weight:600; cursor:pointer;">${escapeHtml(t("btn_block") || "Bloquear")}</button>
          <button id="sg-btn-allow-loading" style="flex:1; background:#f59e0b; color:black; border:none; padding:12px; border-radius:8px; font-weight:bold; cursor:pointer;">${escapeHtml(t("overlay_continue_no_analysis") || "Continuar (sem an\xE1lise)")}</button>
        </div>
        <style>@keyframes sg-spin {0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}}</style>
      </div>
    `;
      setTimeout(() => {
        state.shadow.getElementById("sg-btn-block-loading")?.addEventListener("click", () => decideCurrentAndAdvance(false));
        state.shadow.getElementById("sg-btn-allow-loading")?.addEventListener("click", () => {
          if (confirm(t("overlay_confirm_allow_msg") || "Tem certeza? Isso ignora prote\xE7\xE3o.")) {
            decideCurrentAndAdvance(true);
          }
        });
      }, 0);
      return;
    }
    if (state._watchdogId != null) {
      clearTimeout(state._watchdogId);
      state._watchdogId = null;
    }
    const level = analysis.level || (analysis.recommend === "ALLOW" ? "LOW" : analysis.recommend === "WARN" ? "WARN" : "HIGH");
    const recommend = analysis.recommend ?? "WARN";
    const score = analysis.score ?? 0;
    const color = getRiskColor(level);
    const method = state.meta?.method || (t("tx_unknown") || "Transa\xE7\xE3o Desconhecida");
    const host = state.meta?.host || (t("dapp_unknown") || "DApp Desconhecido");
    const rawReasons = analysis.reasons ?? [];
    const sim = analysis.simulationOutcome;
    const intent = analysis.intent ?? analysis.txContext?.kind;
    const isNftPurchase = intent === "NFT_PURCHASE";
    const isTokenSwap = intent === "SWAP" || intent === "TOKEN_SWAP";
    const assetChanges = [];
    const outgoing = sim?.outgoingAssets ?? [];
    const incoming = sim?.incomingAssets ?? [];
    for (const o of outgoing)
      assetChanges.push({ type: "OUT", amount: o.amount ?? "", symbol: o.symbol ?? "?" });
    for (const i of incoming)
      assetChanges.push({ type: "IN", amount: i.amount ?? "", symbol: i.symbol ?? "?" });
    const approvals = sim?.approvals ?? [];
    const tokenConf = analysis.tokenConfidence;
    const tokenSymbol = analysis.asset?.symbol ?? analysis.asset?.name ?? analysis.tokenSymbol ?? "?";
    const reasons = rawReasons.length > 0 ? rawReasons : ["Sem sinais fortes, mas confirme destino, valor e rede."];
    const showTokenLowConf = (tokenConf === "LOW" || tokenConf === "UNKNOWN") && (isTokenSwap || analysis.intent === "APPROVAL");
    const bannerColor = recommend === "ALLOW" ? "#22c55e" : recommend === "WARN" ? "#f59e0b" : "#ef4444";
    const bannerText = recommend === "ALLOW" ? t("overlay_safe_continue") || "Seguro para continuar" : recommend === "WARN" ? t("overlay_attention") || "Aten\xE7\xE3o" : t("overlay_danger") || "Perigoso / prov\xE1vel golpe";
    const intentMsg = isNftPurchase ? t("overlay_nft_purchase_msg") || "Se confirmar, os valores ser\xE3o transferidos e a aquisi\xE7\xE3o do NFT ser\xE1 realizada." : isTokenSwap ? t("overlay_swap_msg") || "Voc\xEA est\xE1 prestes a trocar tokens. Confirme token recebido e liquidez." : "";
    const feeStatusText = feeEstimated ? t("overlay_fee_calculated") || "Taxas calculadas." : t("overlay_calculating") || "Calculando...";
    const isFallback = !!analysis._isFallback;
    const failMode = __sgSettings?.failMode ?? "fail_open";
    const vaultBlocked = analysis.vaultBlocked === true;
    const hideAllow = analysis.matchedDenySpender === true || vaultBlocked;
    const fallbackFailClosed = isFallback && failMode === "fail_closed";
    const allowLabel = fallbackFailClosed ? t("overlay_allow_once_risky") || "Permitir 1 vez (arriscado)" : isFallback && failMode === "fail_open" ? t("overlay_allow_anyway") || "Permitir mesmo assim" : t("btn_continue") || "Continuar";
    const action = classifyAction(method, state.meta?.params ?? []);
    const typePanel = renderTypeSpecificPanel(action, state.meta, analysis);
    const showSimulation = action === "SEND_TX";
    function getSpenderFromAnalysis(a) {
      const da = a.decodedAction;
      if (da?.spender && /^0x[a-fA-F0-9]{40}$/.test(da.spender)) return da.spender.toLowerCase();
      if (da?.operator && /^0x[a-fA-F0-9]{40}$/.test(da.operator)) return da.operator.toLowerCase();
      const te = a.txExtras;
      if (te?.spender && /^0x[a-fA-F0-9]{40}$/.test(te.spender)) return te.spender.toLowerCase();
      if (te?.operator) return te.operator.toLowerCase();
      if (a.typedDataExtras?.spender && /^0x[a-fA-F0-9]{40}$/.test(a.typedDataExtras.spender)) return a.typedDataExtras.spender.toLowerCase();
      return null;
    }
    const overlaySpender = getSpenderFromAnalysis(analysis);
    const quickSpenderBlock = overlaySpender ? `
        <div style="margin-bottom:15px; background:#1e293b; padding:10px; border-radius:8px;">
          <p style="font-size:11px; color:#64748b; margin:0 0 6px 0;">Spender: <code style="word-break:break-all;">${escapeHtml(overlaySpender.slice(0, 10))}\u2026</code></p>
          <div style="display:flex; gap:8px; flex-wrap:wrap;">
            <button id="sg-btn-allow-spender" style="background:#22c55e; color:black; border:none; padding:6px 12px; border-radius:6px; font-size:12px; cursor:pointer;">Sempre permitir</button>
            <button id="sg-btn-deny-spender" style="background:#ef4444; color:white; border:none; padding:6px 12px; border-radius:6px; font-size:12px; cursor:pointer;">Sempre bloquear</button>
          </div>
        </div>` : "";
    const quickDomainBlock = `
        <div style="margin-bottom:15px; background:#1e293b; padding:10px; border-radius:8px;">
          <p style="font-size:11px; color:#64748b; margin:0 0 6px 0;">Dom\xEDnio: ${escapeHtml(host)}</p>
          <div style="display:flex; gap:8px; flex-wrap:wrap;">
            <button id="sg-btn-trust-domain" style="background:#22c55e; color:black; border:none; padding:6px 12px; border-radius:6px; font-size:12px; cursor:pointer;">Adicionar a Trusted</button>
            <button id="sg-btn-block-domain" style="background:#ef4444; color:white; border:none; padding:6px 12px; border-radius:6px; font-size:12px; cursor:pointer;">Adicionar a Blocked</button>
            <button id="sg-btn-temp-allow-10" style="background:#334155; color:white; border:none; padding:6px 12px; border-radius:6px; font-size:12px; cursor:pointer;">${escapeHtml(t("overlay_temp_allow_10min") || "Permitir por 10 min")}</button>
          </div>
        </div>`;
    state.app.innerHTML = `
    <div class="sg-card" role="dialog" aria-labelledby="sg-overlay-title" aria-describedby="sg-overlay-desc" aria-modal="true" style="background:#0f172a; color:white; width:380px; font-family:'Inter', sans-serif; border-radius:16px; overflow:hidden; box-shadow:0 25px 50px -12px rgba(0,0,0,0.7); border:1px solid ${color}; position:fixed; bottom:30px; right:30px; z-index:999999;">
      
      <div style="background:${bannerColor}; padding:10px 16px; text-align:center;">
        <span style="font-weight:800; font-size:13px; text-transform:uppercase; color:${recommend === "ALLOW" ? "black" : "white"}; letter-spacing:0.5px;">${escapeHtml(bannerText)}</span>
      </div>
      <div style="background:${color}; padding:10px 20px; display:flex; justify-content:space-between; align-items:center;">
        <span style="font-weight:700; font-size:13px; color:${level === "HIGH" || level === "BLOCK" ? "white" : "black"}; letter-spacing:0.5px;">\u{1F6E1}\uFE0F SignGuard</span>
        <span style="background:rgba(0,0,0,0.2); color:white; padding:2px 8px; border-radius:12px; font-size:11px; font-weight:bold;">SCORE ${score}/100</span>
      </div>

      <div style="padding:20px;">
        ${state.meta.gateUI ? `<div style="margin-bottom:15px; background:#1e3a5f; border:1px solid #38bdf8; padding:10px 14px; border-radius:8px; font-size:13px; color:#e0f2fe;">${escapeHtml(t("overlay_confirm_before_wallet") || "Confirme aqui antes de abrir a carteira.")}</div>` : ""}
        <div id="sg-overlay-desc" style="margin-bottom:15px; border-bottom:1px solid #334155; padding-bottom:15px;">
          <h2 id="sg-overlay-title" style="margin:0 0 5px 0; font-size:18px; color:#f8fafc;">${escapeHtml(host)}</h2>
          <p style="margin:0; font-size:13px; color:#94a3b8;">${escapeHtml(method)}</p>
        </div>

        ${intentMsg ? `
        <div style="margin-bottom:15px; background:rgba(56,189,248,0.1); border:1px solid rgba(56,189,248,0.3); padding:10px; border-radius:8px;">
          <p style="margin:0; font-size:12px; color:#93c5fd;">\u2139\uFE0F ${escapeHtml(intentMsg)}</p>
        </div>
        ` : ""}

        ${(() => {
      const sum = analysis.summaryV1 ?? analysis.summary;
      if (!sum?.title) return "";
      const giveList = (sum.give ?? []).map((g) => `${g.amount ?? "?"} ${g.symbol ?? ""}`.trim()).filter(Boolean);
      const getList = (sum.get ?? []).map((g) => `${g.amount ?? "?"} ${g.symbol ?? ""}`.trim()).filter(Boolean);
      const approvalLines = (sum.approvals ?? []).map((a) => `${a.tokenSymbol || a.tokenAddress?.slice(0, 8) || "?"} \u2192 ${a.spender?.slice(0, 10) ?? "?"}\u2026 ${a.unlimited ? "\u221E" : a.amount ?? ""}`.trim());
      const nftLines = (sum.nfts ?? []).map((n) => `${n.collection || n.tokenAddress?.slice(0, 8) || "NFT"} ${n.tokenId ? "#" + n.tokenId : ""}`.trim()).filter(Boolean);
      const flagPills = (sum.flags ?? []).map((f) => {
        const label = t("reason_" + String(f).toLowerCase()) || f;
        return `<span style="display:inline-block;background:rgba(245,158,11,0.2);color:#fcd34d;padding:2px 8px;border-radius:6px;font-size:11px;margin:2px 4px 2px 0;">${escapeHtml(label)}</span>`;
      }).join("");
      return `
        <div style="margin-bottom:15px; background:#1e293b; border:1px solid #334155; padding:12px; border-radius:8px;">
          <p style="font-size:11px; text-transform:uppercase; color:#64748b; font-weight:bold; margin:0 0 6px 0;">${escapeHtml(t("overlay_summary_title") || "Resumo")}</p>
          <p style="margin:0 0 4px 0; font-size:14px; font-weight:600; color:#f8fafc;">${escapeHtml(sum.title)}</p>
          ${sum.subtitle ? `<p style="margin:0 0 8px 0; font-size:12px; color:#94a3b8;">${escapeHtml(sum.subtitle)}</p>` : ""}
          ${giveList.length ? `<p style="margin:4px 0; font-size:12px; color:#fca5a5;">${escapeHtml(t("cost_you_send") || "Voc\xEA envia")}: ${escapeHtml(giveList.join(", "))}</p>` : ""}
          ${getList.length ? `<p style="margin:4px 0; font-size:12px; color:#86efac;">${escapeHtml(t("cost_you_receive") || "Voc\xEA recebe")}: ${escapeHtml(getList.join(", "))}</p>` : ""}
          ${approvalLines.length ? `<p style="margin:4px 0; font-size:11px; color:#fcd34d;">${escapeHtml(t("overlay_approvals_detected") || "Aprova\xE7\xF5es")}: ${escapeHtml(approvalLines.join("; "))}</p>` : ""}
          ${nftLines.length ? `<p style="margin:4px 0; font-size:11px; color:#93c5fd;">NFT: ${escapeHtml(nftLines.join(", "))}</p>` : ""}
          ${flagPills ? `<div style="margin-top:8px;">${flagPills}</div>` : ""}
        </div>`;
    })()}

        ${typePanel}
        ${quickSpenderBlock}
        ${quickDomainBlock}

        ${showSimulation ? `
        <div style="margin-bottom:20px;">
          <p style="font-size:11px; text-transform:uppercase; color:#64748b; font-weight:bold; margin-bottom:5px;">${escapeHtml(t("overlay_simulation_balance") || "Simula\xE7\xE3o de Balan\xE7o")}</p>
          <div style="background:#1e293b; padding:10px; border-radius:8px; max-height:100px; overflow-y:auto;">
            ${renderAssetChanges(assetChanges)}
          </div>
          ${approvals.length > 0 ? `
          <p style="font-size:11px; text-transform:uppercase; color:#f59e0b; font-weight:bold; margin:10px 0 4px 0;">${escapeHtml(t("overlay_approvals_detected") || "Aprova\xE7\xF5es detectadas")}</p>
          <div style="background:rgba(245,158,11,0.1); padding:8px; border-radius:6px; font-size:11px;">
            ${approvals.map((a) => `<p style="margin:0 0 4px 0;">${a.unlimited ? "\u221E" : ""} ${escapeHtml(a.spender.slice(0, 10))}\u2026</p>`).join("")}
          </div>
          ` : ""}
          ${feeEstimated ? `<p style="margin:8px 0 0 0; font-size:11px; color:#64748b;">\u2713 ${escapeHtml(feeStatusText)}</p>` : `<p style="margin:8px 0 0 0; font-size:11px; color:#94a3b8;">${escapeHtml(feeStatusText)}</p>`}
        </div>
        ` : ""}

        <div style="margin-bottom:20px;">
          <p style="font-size:11px; text-transform:uppercase; color:#64748b; font-weight:bold; margin-bottom:5px;">${escapeHtml(t("overlay_risk_why") || "RISCO E POR QU\xCA")}</p>
          ${showTokenLowConf ? `
          <div style="background:rgba(245,158,11,0.15); border:1px solid rgba(245,158,11,0.4); padding:10px; border-radius:8px; margin-bottom:10px;">
            <p style="margin:0; font-size:12px; color:#fcd34d;">Token analisado: ${escapeHtml(tokenSymbol)} \u2014 Confian\xE7a: BAIXA (rec\xE9m-lan\xE7ado / pouca liquidez / sem reputa\xE7\xE3o)</p>
          </div>
          ` : ""}
          <div style="background:rgba(239,68,68,0.1); border:1px solid rgba(239,68,68,0.3); padding:10px; border-radius:8px;">
            ${reasons.map((r) => `<p style="margin:0 0 6px 0; color:#fca5a5; font-size:12px;">\u26A0\uFE0F ${escapeHtml(r)}</p>`).join("")}
          </div>
        </div>

        ${vaultBlocked ? `
        <div style="margin-bottom:15px; background:rgba(245,158,11,0.15); border:1px solid rgba(245,158,11,0.4); padding:12px; border-radius:8px;">
          <p style="margin:0 0 10px 0; font-size:12px; color:#fcd34d;">Este contrato est\xE1 bloqueado pelo Vault.</p>
          <div style="display:flex; gap:8px; flex-wrap:wrap;">
            <button id="sg-btn-vault-unlock-5" style="background:#f59e0b; color:black; border:none; padding:8px 14px; border-radius:6px; font-weight:600; cursor:pointer; font-size:12px;">${escapeHtml(t("vault_unlock_5min") || "Desbloquear 5 min")}</button>
            <button id="sg-btn-vault-unlock-30" style="background:#eab308; color:black; border:none; padding:8px 14px; border-radius:6px; font-weight:600; cursor:pointer; font-size:12px;">${escapeHtml(t("vault_unlock_30min") || "Desbloquear 30 min")}</button>
            <a id="sg-btn-vault-settings" href="${escapeHtml((typeof chrome !== "undefined" && chrome?.runtime?.getURL ? chrome.runtime.getURL("options.html") : "") + "#vault")}" target="_blank" rel="noopener" style="display:inline-block; background:#334155; color:white; padding:8px 14px; border-radius:6px; font-size:12px; text-decoration:none;">Abrir configura\xE7\xF5es</a>
          </div>
        </div>
        ` : ""}
        <div style="display:flex; gap:12px;">
          ${vaultBlocked ? `
          <button id="sg-btn-block" data-sg-initial-focus="1" data-sg-secondary="1" style="flex:1; background:#ef4444; color:white; border:none; padding:12px; border-radius:8px; font-weight:600; cursor:pointer;">${escapeHtml(t("btn_block") || "Manter bloqueado")}</button>
          ` : fallbackFailClosed ? `
          <button id="sg-btn-block" ${recommend === "BLOCK" ? 'data-sg-initial-focus="1" data-sg-secondary="1"' : 'data-sg-primary="1"'} style="flex:1; background:#ef4444; color:white; border:none; padding:12px; border-radius:8px; font-weight:600; cursor:pointer;">${escapeHtml(t("btn_block") || "Bloquear")}</button>
          <button id="sg-btn-allow" ${recommend !== "BLOCK" ? 'data-sg-initial-focus="1" data-sg-primary="1"' : 'data-sg-secondary="1"'} style="flex:1; background:#334155; color:white; border:none; padding:12px; border-radius:8px; font-weight:600; cursor:pointer;">${escapeHtml(allowLabel)}</button>
          ` : `
          <button id="sg-btn-block" ${hideAllow || recommend === "BLOCK" ? 'data-sg-initial-focus="1" data-sg-secondary="1"' : 'data-sg-secondary="1"'} style="flex:1; background:#334155; color:white; border:none; padding:12px; border-radius:8px; font-weight:600; cursor:pointer;">${escapeHtml(t("btn_block") || "Bloquear")}</button>
          ${hideAllow ? "" : `<button id="sg-btn-allow" ${!hideAllow && recommend !== "BLOCK" ? 'data-sg-initial-focus="1" data-sg-primary="1"' : 'data-sg-primary="1"'} style="flex:1; background:${color}; color:${level === "HIGH" || level === "BLOCK" ? "white" : "black"}; border:none; padding:12px; border-radius:8px; font-weight:bold; cursor:pointer;">${escapeHtml(allowLabel)}</button>`}
          `}
        </div>
        <div style="margin-top:12px;">
          <button id="sg-btn-retry" style="width:100%; background:transparent; color:#64748b; border:1px solid #334155; padding:8px; border-radius:6px; font-size:12px; cursor:pointer;">${escapeHtml(t("overlay_try_again") || "Tentar novamente")}</button>
        </div>

      </div>
    </div>
  `;
    const needsAllowFriction = fallbackFailClosed || isFallback && failMode === "fail_open";
    setTimeout(() => {
      state.shadow.getElementById("sg-btn-block")?.addEventListener("click", () => decideCurrentAndAdvance(false));
      const allowBtn = state.shadow.getElementById("sg-btn-allow");
      if (allowBtn) {
        allowBtn.addEventListener("click", () => {
          if (needsAllowFriction && !state.__sgAllowConfirmed) {
            const parent = allowBtn.closest("div");
            if (parent) {
              const confirmDiv = document.createElement("div");
              confirmDiv.id = "sg-confirm-allow";
              confirmDiv.style.cssText = "margin-top:12px; padding:12px; background:rgba(239,68,68,0.15); border:1px solid rgba(239,68,68,0.4); border-radius:8px;";
              confirmDiv.innerHTML = `<p style="margin:0 0 10px 0; font-size:12px; color:#fca5a5;">${escapeHtml(t("overlay_confirm_allow_msg") || "Tem certeza? Isso ignora prote\xE7\xE3o.")}</p>
              <div style="display:flex; gap:8px;">
                <button id="sg-btn-confirm-allow" style="background:#f59e0b; color:black; border:none; padding:8px 14px; border-radius:6px; font-weight:600; cursor:pointer;">${escapeHtml(t("overlay_confirm_allow") || "Confirmar permitir 1 vez")}</button>
                <button id="sg-btn-cancel-allow" style="background:#334155; color:white; border:none; padding:8px 14px; border-radius:6px; cursor:pointer;">${escapeHtml(t("btn_cancel") || "Cancelar")}</button>
              </div>`;
              parent.appendChild(confirmDiv);
              state.__sgAllowConfirmed = true;
              state.shadow.getElementById("sg-btn-confirm-allow")?.addEventListener("click", () => {
                decideCurrentAndAdvance(true);
              });
              state.shadow.getElementById("sg-btn-cancel-allow")?.addEventListener("click", () => {
                confirmDiv.remove();
                state.__sgAllowConfirmed = false;
              });
            }
            return;
          }
          decideCurrentAndAdvance(true);
        });
      }
      state.shadow.getElementById("sg-btn-retry")?.addEventListener("click", () => retryAnalyze());
      state.shadow.getElementById("sg-btn-allow-spender")?.addEventListener("click", async () => {
        if (!overlaySpender) return;
        try {
          await safeSendMessage({ type: "SG_UPDATE_SPENDERS", payload: { addToAllow: overlaySpender } }, 3e3);
          await loadSettings();
          retryAnalyze();
        } catch {
        }
      });
      state.shadow.getElementById("sg-btn-deny-spender")?.addEventListener("click", async () => {
        if (!overlaySpender) return;
        try {
          await safeSendMessage({ type: "SG_UPDATE_SPENDERS", payload: { addToDeny: overlaySpender } }, 3e3);
          await loadSettings();
          retryAnalyze();
        } catch {
        }
      });
      state.shadow.getElementById("sg-btn-trust-domain")?.addEventListener("click", async () => {
        try {
          await safeSendMessage({ type: "SG_LISTS_OVERRIDE_ADD", payload: { type: "trusted_domain", payload: { value: host } } }, 3e3);
          retryAnalyze();
        } catch {
        }
      });
      state.shadow.getElementById("sg-btn-block-domain")?.addEventListener("click", async () => {
        try {
          await safeSendMessage({ type: "SG_LISTS_OVERRIDE_ADD", payload: { type: "blocked_domain", payload: { value: host } } }, 3e3);
          retryAnalyze();
        } catch {
        }
      });
      state.shadow.getElementById("sg-btn-temp-allow-10")?.addEventListener("click", async () => {
        try {
          await safeSendMessage({ type: "SG_ADD_TEMP_ALLOW", payload: { host, spender: overlaySpender ?? null, ttlMs: 10 * 60 * 1e3 } }, 3e3);
          showToast(t("overlay_temp_allow_toast") || "Permitido por 10 min");
          decideCurrentAndAdvance(true);
        } catch {
        }
      });
      const doVaultUnlock = async (ttlMs) => {
        const contract = analysis.vaultLockedTo;
        const chainIdHex = analysis.vaultChainIdHex ?? state.meta?.chainIdHex ?? requestQueue[0]?.chainIdHex ?? "0x0";
        if (!contract) return;
        try {
          const res = await safeSendMessage({ type: "VAULT_UNLOCK", payload: { chainIdHex, contract, ttlMs } }, 3e3);
          if (res?.ok) {
            const mins = Math.round(ttlMs / 6e4);
            showToast(t("vault_unlocked_toast")?.replace("{n}", String(mins)) || `Desbloqueado por ${mins} min`);
            await loadSettings();
            retryAnalyze();
          }
        } catch {
        }
      };
      state.shadow.getElementById("sg-btn-vault-unlock-5")?.addEventListener("click", () => doVaultUnlock(5 * 60 * 1e3));
      state.shadow.getElementById("sg-btn-vault-unlock-30")?.addEventListener("click", () => doVaultUnlock(30 * 60 * 1e3));
      const initialFocusBtn = state.shadow.querySelector("[data-sg-initial-focus]");
      if (initialFocusBtn) initialFocusBtn.focus();
      const allowanceEl = state.shadow.getElementById("sg-allowance-block");
      if (allowanceEl && overlaySpender) {
        const token = analysis.tx?.to;
        const p0 = state.meta?.params?.[0];
        const owner = p0 && typeof p0 === "object" ? p0.from : void 0;
        const chainIdHex = state.meta?.chainIdHex ?? requestQueue[0]?.chainIdHex;
        const isNft = analysis.txExtras?.approvalType === "NFT_SET_APPROVAL_FOR_ALL" || analysis.decodedAction?.kind === "SET_APPROVAL_FOR_ALL";
        if (token && owner && /^0x[a-fA-F0-9]{40}$/.test(token) && /^0x[a-fA-F0-9]{40}$/.test(owner)) {
          fetchCurrentAllowance(chainIdHex, token, owner, overlaySpender, isNft).then((val) => {
            if (val != null && __sgOverlay?.requestId === state.requestId) {
              const el = state.shadow.getElementById("sg-allowance-block");
              if (el) el.textContent = (t("overlay_allowance_current") || "Allowance atual: ") + val;
            }
          }).catch(() => {
          });
        }
      }
    }, 0);
  }
  function cleanupOverlay() {
    if (__sgOverlay) {
      try {
        if (__sgOverlay._watchdogId != null) clearTimeout(__sgOverlay._watchdogId);
      } catch {
      }
      try {
        __sgOverlay._restore?.();
      } catch {
      }
      try {
        document.removeEventListener("keydown", __sgOverlay.onKey);
      } catch {
      }
      try {
        __sgOverlay.container.remove();
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
        chainIdHex: cur.chainIdHex ?? null,
        chainIdRequested: cur.chainIdRequested,
        gateUI: cur._uiGate ?? false
      });
    }
  }
  async function retryAnalyze() {
    const cur = requestQueue[0];
    if (!cur?.analyzePayload) return;
    const loadingAnalysis = { level: "LOADING", score: 0, title: "", reasons: [], recommend: "WARN" };
    cur.analysis = loadingAnalysis;
    if (__sgOverlay && __sgOverlay.requestId === cur.requestId) {
      __sgOverlay.analysis = loadingAnalysis;
      updateOverlay(__sgOverlay);
    }
    try {
      const resp = await safeSendMessage(
        { type: "ANALYZE", payload: cur.analyzePayload },
        { timeoutMs: 8e3, preferPort: true }
      );
      if (resp?.analysis) {
        cur.analysis = resp.analysis;
        if (__sgOverlay && __sgOverlay.requestId === cur.requestId) {
          __sgOverlay.analysis = resp.analysis;
          updateOverlay(__sgOverlay);
        }
      }
    } catch {
      const fallback = {
        level: "WARN",
        score: 0,
        title: t("overlay_analysis_unavailable") || "An\xE1lise indispon\xEDvel",
        reasons: [t("overlay_analysis_fallback") || "N\xE3o foi poss\xEDvel obter a an\xE1lise."],
        recommend: "WARN"
      };
      cur.analysis = fallback;
      if (__sgOverlay && __sgOverlay.requestId === cur.requestId) {
        __sgOverlay.analysis = fallback;
        updateOverlay(__sgOverlay);
      }
    }
  }
  function decideCurrentAndAdvance(allow, userTriggered = true) {
    const cur = requestQueue[0];
    if (!cur) return;
    try {
      safeSendMessage({ type: "SG_DIAG_PUSH", payload: { kind: "DECISION", requestId: cur.requestId, decision: allow ? "ALLOW" : "BLOCK", method: cur.method, host: cur.host } }, 500);
    } catch {
    }
    console.log(`\u{1F4E8} [SignGuard Content] ${userTriggered ? "User decided" : "Auto"}: ${allow ? "ALLOW" : "BLOCK"}`);
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
    const uiGate = cur._uiGate ?? false;
    const meta = { uiConfirmed: userTriggered, uiGate, method: cur.method };
    if (userTriggered) {
      try {
        safeSendMessage({ type: "SG_DIAG_PUSH", payload: { kind: "DECISION_SENT", requestId: cur.requestId, method: cur.method, decision: allow ? "ALLOW" : "BLOCK" } }, 500);
      } catch {
      }
    }
    const dedupeKey = cur._dedupeKey;
    const entry = dedupeKey ? __sgDedupeMap.get(dedupeKey) : void 0;
    const relayOrigin = cur._relayOrigin;
    if (relayOrigin) {
      const rids = entry ? Array.from(entry.requestIds) : [cur.requestId];
      for (const rid of rids) {
        try {
          relayOrigin.postMessage(
            {
              source: "signguard",
              type: "SG_RELAY_DECISION",
              relay: { requestId: rid, ts: Date.now() },
              decision: { allow, analysis: cur.analysis, meta }
            },
            "*"
          );
        } catch (e) {
          console.warn("[SignGuard Content] relay decision postMessage failed", rid, e);
        }
      }
      if (dedupeKey) __sgDedupeMap.delete(dedupeKey);
    } else {
      if (entry && dedupeKey) {
        for (const rid of entry.requestIds) sendDecisionToMainWorld(rid, allow, meta);
        __sgDedupeMap.delete(dedupeKey);
      } else {
        sendDecisionToMainWorld(cur.requestId, allow, meta);
      }
    }
    requestQueue.shift();
    cleanupOverlay();
    if (requestQueue.length > 0) setTimeout(showCurrentPending, 100);
  }
  window.addEventListener("message", async (ev) => {
    if (ev.source !== window || !ev.data) return;
    if (ev.data.source === "signguard-mainworld") {
      const d = ev.data;
      if (d.type === "SG_DIAG_TIMEOUT") {
        try {
          safeSendMessage({ type: "SG_DIAG_PUSH", payload: { kind: d.failMode === "fail_closed" ? "FAILCLOSED_TIMEOUT" : "FAILOPEN_TIMEOUT", requestId: d.requestId, method: d.method } }, 500);
        } catch {
        }
      } else if (d.type === "SG_RELEASED") {
        try {
          safeSendMessage({ type: "SG_DIAG_PUSH", payload: { kind: "MAINWORLD_RELEASE", requestId: d.requestId, method: d.method } }, 500);
        } catch {
        }
      }
      return;
    }
    if (ev.data.source !== "signguard") return;
    const type = ev.data.type;
    let requestId;
    let payload;
    let relayOrigin = null;
    let relayOriginHref = "";
    if (type === "SG_RELAY_DECISION") {
      const relay = ev.data.relay;
      const decision = ev.data.decision;
      const rid = relay?.requestId;
      const allow = decision?.allow === true;
      const meta = decision?.meta;
      const rec = rid != null ? relayPending.get(rid) : void 0;
      if (rec?.timeoutId) clearTimeout(rec.timeoutId);
      if (rid != null) relayPending.delete(rid);
      if (rid != null) sendDecisionToMainWorld(rid, allow, meta);
      return;
    }
    if (type === "SG_RELAY_REQUEST") {
      if (!IS_TOP_FRAME) return;
      requestId = ev.data.relay?.requestId ?? "";
      payload = ev.data.req ?? {};
      relayOrigin = ev.source;
      relayOriginHref = ev.data.relay?.originHref ?? "";
      console.log("[SignGuard Content] top received relay", { requestId, method: payload?.method, origin: relayOriginHref });
    } else if (type === "SG_REQUEST") {
      requestId = ev.data.requestId;
      payload = ev.data.payload ?? {};
    } else {
      if (type === "SG_PREVIEW") {
        const pid = ev.data.requestId;
        const ppayload = ev.data.payload;
        const chainIdHex2 = ppayload?.chainIdHex;
        const txCostPreview = ppayload?.txCostPreview;
        __sgPreflightCache.set(pid, { chainIdHex: chainIdHex2, txCostPreview });
        console.log("\u{1F4E8} [SignGuard Content] SG_PREVIEW received");
        const cur = requestQueue.find((r) => r.requestId === pid);
        if (cur) {
          if (chainIdHex2) cur.chainIdHex = chainIdHex2;
          if (txCostPreview) cur.analysis.txCostPreview = txCostPreview;
          if (requestQueue[0]?.requestId === pid) showCurrentPending();
        }
        return;
      }
      return;
    }
    await loadSettings();
    const method = (payload?.method ?? "").toLowerCase();
    const gateUI = shouldGateUI(method);
    const failMode = gateUI ? "fail_closed" : __sgSettings?.failMode ?? "fail_open";
    if (!relayOrigin) {
      window.postMessage({ source: "signguard-content", type: "SG_SETTINGS", requestId, failMode }, "*");
      try {
        safeSendMessage({ type: "SG_DIAG_PUSH", payload: { kind: "MAINWORLD_HOLD_START", requestId, method: payload?.method, host: payload?.host && String(payload.host).trim() ? String(payload.host).trim() : "" } }, 500);
      } catch {
      }
      console.log("\u{1F4E8} [SignGuard Content] Request received:", payload?.method, "requestId=" + requestId);
      const hostForCheck = payload?.host && String(payload.host).trim() ? String(payload.host).trim() : (() => {
        try {
          return new URL(payload?.url ?? window.location.href).hostname || "";
        } catch {
          return "";
        }
      })();
      const paused = typeof __sgSettings?.pausedUntil === "number" && Date.now() < __sgSettings.pausedUntil;
      if (paused) {
        console.log("[SignGuard UI] UI gate bypassed due to EXTENSION_PAUSED");
        sendDecisionToMainWorld(requestId, true, { uiConfirmed: false, uiGate: true, reasonKeys: ["EXTENSION_PAUSED"], method });
        return;
      }
      if (!gateUI) {
        try {
          const res = await safeSendMessage(
            { type: "SG_CHECK_TEMP_ALLOW", payload: { host: hostForCheck, spender: null } },
            { timeoutMs: 500 }
          );
          if (res?.ok && res?.allowed) {
            sendDecisionToMainWorld(requestId, true, { uiConfirmed: false, uiGate: false, method });
            return;
          }
        } catch {
        }
      }
      const methodForAuto = method;
      if (AUTO_ALLOW_METHODS.has(methodForAuto)) {
        try {
          safeSendMessage({ type: "SG_DIAG_PUSH", payload: { kind: "REQ", requestId, method: methodForAuto, host: hostForCheck } }, 500);
        } catch {
        }
        sendDecisionToMainWorld(requestId, true, { uiConfirmed: false, uiGate: false, method });
        return;
      }
      if (!IS_TOP_FRAME) {
        const meth = String(payload?.method ?? "").toLowerCase();
        const isUiGated = shouldGateUI(meth);
        const allowOnTimeout = !isUiGated && failMode === "fail_open";
        console.log("[SignGuard Content] iframe request -> relaying to top", { requestId, method: payload?.method, href: location.href });
        try {
          window.top?.postMessage(
            { source: "signguard", type: "SG_RELAY_REQUEST", relay: { requestId, originHref: location.href, ts: Date.now() }, req: payload },
            "*"
          );
        } catch (e) {
          console.warn("[SignGuard Content] relay postMessage failed", e);
        }
        const timeoutId = setTimeout(() => {
          relayPending.delete(requestId);
          sendDecisionToMainWorld(requestId, allowOnTimeout, {
            uiConfirmed: false,
            uiGate: isUiGated,
            method: payload?.method,
            reasonKeys: ["RELAY_TIMEOUT"]
          });
          console.warn("[SignGuard Content] relay timeout, applying failMode", { failMode, isUiGated });
        }, RELAY_TIMEOUT_MS);
        relayPending.set(requestId, { timeoutId });
        return;
      }
    }
    const url = payload?.url ?? window.location.href;
    const origin = (() => {
      try {
        return new URL(url).origin;
      } catch {
        return window.location.origin;
      }
    })();
    const rpcMeta = payload?.meta ?? null;
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
    const cached = __sgPreflightCache.get(requestId);
    const mergedChainIdHex = payload?.chainIdHex || chainIdHex || cached?.chainIdHex || null;
    const mergedMeta = rpcMeta ? { ...rpcMeta, chainIdHex: mergedChainIdHex ?? void 0, chainIdRequested: rpcMeta?.chainIdRequested ?? void 0 } : mergedChainIdHex || rpcMeta?.chainIdRequested ? { chainIdHex: mergedChainIdHex ?? void 0, chainIdRequested: rpcMeta?.chainIdRequested ?? void 0 } : void 0;
    const txCostPreviewMerged = cached?.txCostPreview ?? payload?.txCostPreview;
    const mergedMetaWithPageRisk = __sgPageRiskResult ? { ...mergedMeta, pageRisk: { score: __sgPageRiskResult.riskScore, reasons: __sgPageRiskResult.reasons } } : mergedMeta;
    const analyzePayload = {
      requestId,
      url,
      origin,
      request: { method: payload?.method ?? "", params: Array.isArray(payload?.params) ? payload.params : [] },
      meta: mergedMetaWithPageRisk
    };
    if (txCostPreviewMerged) analyzePayload.txCostPreview = txCostPreviewMerged;
    if (cached) __sgPreflightCache.delete(requestId);
    const chainIdRequested = rpcMeta?.chainIdRequested ?? p0?.chainId;
    const pending = {
      requestId,
      method: payload?.method ?? "",
      host,
      params: payload?.params,
      chainIdHex: mergedChainIdHex ?? void 0,
      chainIdRequested: typeof chainIdRequested === "string" ? chainIdRequested : void 0,
      analysis: { level: "LOADING", score: 0, title: "", reasons: [], recommend: "WARN" },
      analyzePayload
    };
    pending._uiGate = gateUI;
    if (txCostPreviewMerged) pending.analysis.txCostPreview = txCostPreviewMerged;
    if (relayOrigin) {
      pending._relayOrigin = relayOrigin;
      pending._relayRequestId = requestId;
    }
    const originHrefForDedupe = relayOriginHref || (typeof location !== "undefined" ? location.href : "");
    const dupKey = `${host}|${method}|${stableStringifyParams(params ?? [])}|${originHrefForDedupe}`;
    for (const [k, ent] of __sgDedupeMap.entries()) {
      if (Date.now() - ent.addedAt >= DEDUPE_MS) __sgDedupeMap.delete(k);
    }
    const existing = __sgDedupeMap.get(dupKey);
    if (existing && Date.now() - existing.addedAt < DEDUPE_MS) {
      existing.requestIds.add(requestId);
      return;
    }
    __sgDedupeMap.set(dupKey, { primaryRequestId: requestId, requestIds: /* @__PURE__ */ new Set([requestId]), addedAt: Date.now() });
    pending._dedupeKey = dupKey;
    requestQueue.push(pending);
    if (requestQueue.length === 1) showCurrentPending();
    const ANALYSIS_TIMEOUT_MS = 9e3;
    let watchdogFired = false;
    const makeFallback = () => {
      const failMode2 = __sgSettings?.failMode ?? "fail_open";
      return {
        level: "WARN",
        score: 0,
        title: t("overlay_analysis_unavailable") || "An\xE1lise indispon\xEDvel",
        reasons: [t("overlay_analysis_fallback") || "N\xE3o foi poss\xEDvel obter a an\xE1lise agora. Voc\xEA ainda pode BLOQUEAR ou CONTINUAR."],
        recommend: failMode2 === "fail_closed" ? "BLOCK" : "WARN",
        reasonKeys: [REASON_KEYS.FAILMODE_FALLBACK],
        _isFallback: true
      };
    };
    const watchdog = setTimeout(() => {
      if (watchdogFired) return;
      watchdogFired = true;
      const p = requestQueue.find((r) => r.requestId === requestId);
      if (!p || p.analysis?.level !== "LOADING") return;
      const fallbackAnalysis = makeFallback();
      p.analysis = fallbackAnalysis;
      if (__sgOverlay && __sgOverlay.requestId === requestId) {
        __sgOverlay.analysis = fallbackAnalysis;
        updateOverlay(__sgOverlay);
      }
    }, ANALYSIS_TIMEOUT_MS);
    try {
      const response = await safeSendMessage(
        { type: "ANALYZE", payload: analyzePayload },
        { timeoutMs: 8e3, preferPort: true }
      );
      clearTimeout(watchdog);
      if (pending.requestId === requestId && response?.analysis) {
        pending.analysis = response.analysis;
        const spenderFromAnalysis = (() => {
          const a = response.analysis;
          const da = a?.decodedAction;
          if (da?.spender && /^0x[a-fA-F0-9]{40}$/.test(da.spender)) return da.spender.toLowerCase();
          if (da?.operator && /^0x[a-fA-F0-9]{40}$/.test(da.operator)) return da.operator.toLowerCase();
          const te = a?.txExtras;
          if (te?.spender && /^0x[a-fA-F0-9]{40}$/.test(te.spender)) return te.spender.toLowerCase();
          if (a?.typedDataExtras?.spender && /^0x[a-fA-F0-9]{40}$/.test(a.typedDataExtras.spender)) return a.typedDataExtras.spender.toLowerCase();
          return null;
        })();
        if (!pending._uiGate) {
          try {
            const res2 = await safeSendMessage(
              { type: "SG_CHECK_TEMP_ALLOW", payload: { host: pending.host, spender: spenderFromAnalysis } },
              { timeoutMs: 500 }
            );
            if (res2?.ok && res2?.allowed) {
              const cur = requestQueue[0];
              if (cur && cur.requestId === requestId) {
                decideCurrentAndAdvance(true, false);
              }
              return;
            }
          } catch {
          }
        }
        if (__sgOverlay && __sgOverlay.requestId === requestId) {
          __sgOverlay.analysis = response.analysis;
          updateOverlay(__sgOverlay);
        }
      } else if (pending.requestId === requestId && !response?.analysis) {
        const fallbackAnalysis = (() => {
          const failMode2 = __sgSettings?.failMode ?? "fail_open";
          return {
            level: "WARN",
            score: 0,
            title: t("overlay_analysis_unavailable") || "An\xE1lise indispon\xEDvel",
            reasons: [t("overlay_analysis_fallback") || "N\xE3o foi poss\xEDvel obter a an\xE1lise agora. Voc\xEA ainda pode BLOQUEAR ou CONTINUAR."],
            recommend: failMode2 === "fail_closed" ? "BLOCK" : "WARN",
            reasonKeys: [REASON_KEYS.FAILMODE_FALLBACK],
            _isFallback: true
          };
        })();
        pending.analysis = fallbackAnalysis;
        if (__sgOverlay && __sgOverlay.requestId === requestId) {
          __sgOverlay.analysis = fallbackAnalysis;
          updateOverlay(__sgOverlay);
        }
      }
    } catch (e) {
      clearTimeout(watchdog);
      console.error("[SignGuard] handleSGRequest crash:", e);
      if (pending.requestId === requestId) {
        const failMode2 = __sgSettings?.failMode ?? "fail_open";
        const fallbackAnalysis = {
          level: "WARN",
          score: 0,
          title: t("overlay_analysis_unavailable") || "An\xE1lise indispon\xEDvel",
          reasons: [t("overlay_analysis_fallback") || "N\xE3o foi poss\xEDvel obter a an\xE1lise agora. Voc\xEA ainda pode BLOQUEAR ou CONTINUAR."],
          recommend: failMode2 === "fail_closed" ? "BLOCK" : "WARN",
          reasonKeys: [REASON_KEYS.FAILMODE_FALLBACK],
          _isFallback: true
        };
        pending.analysis = fallbackAnalysis;
        if (__sgOverlay && __sgOverlay.requestId === requestId) {
          __sgOverlay.analysis = fallbackAnalysis;
          updateOverlay(__sgOverlay);
        }
      }
    }
  });
  function initPageRiskScan() {
    try {
      const doc = document;
      const hostname = location.hostname || "";
      __sgPageRiskResult = runPageRiskScan(doc, hostname);
      if (__sgPageRiskResult.riskScore === "MEDIUM" || __sgPageRiskResult.riskScore === "HIGH") {
        const msg = __sgPageRiskResult.reasons?.length > 0 ? __sgPageRiskResult.reasons.join(" ") : t("page_risk_warning") || "P\xE1gina com poss\xEDvel risco detectado.";
        injectPageRiskBanner(msg, doc);
      }
    } catch (e) {
      console.warn("[SignGuard] Page risk scan failed:", e);
    }
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initPageRiskScan);
  } else {
    initPageRiskScan();
  }
})();
//# sourceMappingURL=content.js.map
