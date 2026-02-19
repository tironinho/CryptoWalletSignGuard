# SignGuard — Plano de Testes (QA Manual)

## 0) Permissões opcionais (opt-in)

| # | Passo | Aceite |
|---|-------|--------|
| 0.1 | Cloud Intel OFF | Sem request de host externos; nenhum fetch raw/github/cryptoscamdb |
| 0.2 | Cloud Intel ON → pedir permissões | chrome.permissions.request; se negar → toggle OFF, msg clara |
| 0.3 | Simulation OFF | Sem request Tenderly |
| 0.4 | Simulation ON → pedir permissões | idem; se negar → toggle OFF |
| 0.5 | Com permissões concedidas | Cloud Intel / Simulation funcionam normalmente |

---

## 1) Build e Carregamento

| # | Passo | Aceite |
|---|-------|--------|
| 1.1 | `npm run build` | Build conclui sem erros |
| 1.2 | Load unpacked em `chrome://extensions` | Carregar **somente** pasta `/extension` |
| 1.3 | Worlds validation | mainWorld = MAIN; content = ISOLATED (P0-D) |

---

## 2) Testes em dApps

### A) Uniswap
| # | Ação | Aceite |
|---|------|--------|
| 2A.1 | Connect (`eth_requestAccounts`) | Overlay CONNECT com domínio, sinais (confiável/bloqueado) |
| 2A.2 | Swap (sendTransaction) | Overlay SEND_TX com asset diff, gas estimado |
| 2A.3 | Confirmar overlay mostra "Sai" / "Entra" | Simulação legível |

### B) OpenSea
| # | Ação | Aceite |
|---|------|--------|
| 2B.1 | Connect | Overlay CONNECT |
| 2B.2 | Listing (typed data Seaport) | Overlay SIGN_TYPED_DATA com resumo quando aplicável |
| 2B.3 | Compra NFT | Overlay SEND_TX com detalhes |

### C) send/sendAsync bypass
| # | Ação | Aceite |
|---|------|--------|
| 2C.1 | Console: `ethereum.send("wallet_switchEthereumChain", [{chainId:"0x1"}])` | Overlay aparece |
| 2C.2 | Console: `ethereum.sendAsync({jsonrpc:"2.0", id:1, method:"eth_sendTransaction", params:[...]}, cb)` | Overlay aparece |

---

## 3) Policies (allowlist/denylist spenders)

| # | Passo | Aceite |
|---|-------|--------|
| 3.1 | Options → Lists → Adicionar spender em **denylist** | Qualquer approve/permit/setApprovalForAll para ele → BLOCK automático |
| 3.2 | Adicionar spender em **allowlist** | Warnings diminuem; overlay ALLOW/LOW com "KNOWN_SAFE_SPENDER" |
| 3.3 | Bloquear domínio nas opções | Connect/actions nesse domínio → BLOCK default |

---

## 4) failMode (fail_open vs fail_closed)

| # | Passo | Aceite |
|---|-------|--------|
| 4.1 | Options → Security → fail_open | Falha de análise: não auto-permitir; exige "Permitir mesmo assim" |
| 4.2 | fail_closed | Falha de análise: default BLOCK; "Permitir 1 vez (arriscado)" com confirmação |
| 4.3 | Simular falha (recarregar SW / desligar backend) | Comportamento conforme failMode |
| 4.4 | matchedDenySpender = true | Botão "Permitir" escondido (não bypass) |

---

## 5) UI Hardening (Shadow DOM, focus trap, inert)

| # | Passo | Aceite |
|---|-------|--------|
| 5.1 | Tab / Shift+Tab no overlay | Foco circula dentro do modal; não escapa |
| 5.2 | ESC | Ação de bloqueio (exige decisão) |
| 5.3 | Site injeta CSS forte | Overlay permanece por cima; visual intacto |
| 5.3b | safeGetURL falha (frame especial) | CSS inline fallback; overlay legível (botões, fundo, z-index); console: "[SignGuard UI] CSS fallback inline applied" |
| 5.3c | link overlay.css falha ao carregar (onerror) | Fallback CSS inline aplicado; overlay não falha silenciosamente |
| 5.3d | Watchdog 8s sem ANALYZE_RESULT | Overlay em loading mostra "A análise está demorando." + botões "Tentar novamente" e "Fechar" |
| 5.4 | DevTools console | Sem warning "Blocked aria-hidden … descendant retained focus" (ou mínimo) |
| 5.5 | Scroll da página | Bloqueado enquanto overlay aberto |
| 5.6 | Fechar overlay | Restaura foco, overflow, inert |

---

## 6) UX por Tipo de Request

| Tipo | Aceite |
|------|--------|
| CONNECT | Domínio, eTLD+1, sinais (trusted/blocked/punycode), botões Permitir/Bloquear |
| REQUEST_PERMISSIONS | Lista de permissões solicitadas |
| ADD_CHAIN | chainId, chainName, nativeCurrency, rpcUrls, blockExplorerUrls |
| SWITCH_CHAIN | chainId + nome conhecido (Ethereum, Polygon, etc.) |
| WATCH_ASSET | type, address, symbol, decimals, image; warn decimals fora [0..18] |
| SIGN_MESSAGE | Preview do texto com truncation |
| SIGN_TYPED_DATA | primaryType, verifyingContract, domain |
| SEND_TX | to, value, gas estimado, USD se disponível, função (selector), asset diff |

---

## 7) Simulação e Asset Diff

| # | Passo | Aceite |
|---|-------|--------|
| 7.1 | Swap/transfer | "Você envia" / "Você recebe" por endereço da carteira |
| 7.2 | Approval via logs | Approval/ApprovalForAll decodificados aparecem no painel |
| 7.3 | UNLIMITED_APPROVAL | Exibido quando value ~ maxUint256 |
| 7.4 | Simulação: approvals no score | Unlimited → reasonKeys.UNLIMITED_APPROVAL, HIGH; ApprovalForAll → SET_APPROVAL_FOR_ALL, HIGH |
| 7.5 | Net effect no overlay | outgoingAssets / incomingAssets + approvals (token, spender, unlimited?) |

---

## 8) Gas e Fiat

| # | Passo | Aceite |
|---|-------|--------|
| 8.1 | Transação com fee | "Gas estimado: X ETH (~$Y)" |
| 8.2 | gasUSD alto vs valueUSD baixo | HIGH_GAS reason e WARN |
| 8.3 | gasUSD > $80 | WARN/HIGH |

---

## 9) Heurísticas

| # | Heurística | Aceite |
|---|------------|--------|
| 9.1 | Domínio punycode (xn--) | PUNYCODE_DOMAIN reason |
| 9.2 | Spender novo | NEW_SPENDER reason, score aumentado |
| 9.3 | tx.to = contrato (eth_getCode) | CONTRACT_TARGET sinal |
| 9.4 | EOA vs contrato | Diferenciação correta |

---

## 10) Decoders (Permit2, Seaport, Blur, Permit EIP-2612)

| # | Tipo | Aceite |
|---|------|--------|
| 10.1 | Permit2 typed data | PERMIT2_GRANT com spender, tokens, amounts; card "Assinatura (EIP-712)" com aviso de gasto futuro |
| 10.2 | EIP-2612 permit via typed data | PERMIT_GRANT; overlay mostra spender, valor, deadline; aviso "Assinar isso pode permitir gasto futuro sem nova confirmação." |
| 10.3 | Permit2 AllowanceTransfer (calldata) | sendTransaction para contrato Permit2 com selector 0x2b67b570 → PERMIT2_ALLOWANCE; spender, token, amount/unlimited, deadline |
| 10.4 | Permit2 SignatureTransfer (calldata) | sendTransaction para Permit2 com selector permitTransferFrom → PERMIT2_TRANSFER; token, to, amount |
| 10.5 | EIP-2612 permit() em sendTransaction | Calldata 0xd505accf (permit) → PERMIT_EIP2612; reason PERMIT_GRANT; STRICT bloqueia unlimited |
| 10.6 | Seaport typed data | offer/consideration resumido; MARKETPLACE_LISTING |
| 10.7 | Blur heurístico | "Assinatura de marketplace (Blur)" quando detectado |

---

## 11) Interceptação (métodos sensíveis)

| # | Método | Aceite |
|---|--------|--------|
| 11.1 | eth_requestAccounts | Overlay CONNECT |
| 11.2 | wallet_requestPermissions | Overlay aparece |
| 11.3 | wallet_addEthereumChain | Overlay ADD_CHAIN |
| 11.4 | wallet_switchEthereumChain | Overlay SWITCH_CHAIN |
| 11.5 | wallet_sendTransaction / eth_sendTransaction | Overlay SEND_TX |
| 11.6 | personal_sign | Overlay SIGN_MESSAGE |
| 11.7 | eth_signTypedData / eth_signTypedData_v3 / eth_signTypedData_v4 | Overlay SIGN_TYPED_DATA (parsing robusto: objeto vs string, ordem params) |

---

## 12) Overlay — Dedupe e Tentar novamente

| # | Passo | Aceite |
|---|-------|--------|
| 12.0 | Burst de 5 requests idênticos em 1s | 1 overlay; decisão aplicada a todos (dedupe Map) |
| 12.1 | dApp faz 2 chamadas idênticas em <3s | Overlay aparece 1 vez (dedupe ok) |
| 12.2 | Clicar "Tentar novamente" | Reanalisa sem recarregar página; overlay atualiza |
| 12.3 | Fallback (_isFallback) | Botão "Tentar novamente" visível |

---

## 13) Quick-actions (spender / domínio)

| # | Passo | Aceite |
|---|-------|--------|
| 13.1 | Bloquear domínio | Próxima tentativa já recomenda BLOCK |
| 13.2 | Confiar domínio | Risco reduzido |
| 13.3 | Bloquear spender | hideAllow; forte bloqueio |
| 13.4 | Confiar spender | Spender na allowlist; risco reduzido |
| 13.5 | Após quick-action | retryAnalyze executa; overlay reflete |
| 13.6 | "Permitir por X min" (spender) | SG_ADD_TEMP_ALLOW(host, spender); próximas com mesmo spender → auto ALLOW |

---

## 14) Vault

| # | Passo | Aceite |
|---|-------|--------|
| 14.1 | vault.enabled + contrato em lockedContracts | Bloqueia; overlay mostra "Vault bloqueou" |
| 14.2 | Botões "Desbloquear 5 min" / "Desbloquear 30 min" | Unlock temporário (chrome.storage.local) |
| 14.3 | Após unlock + "Tentar novamente" | Permite seguir por X min |
| 14.4 | Após expiração | Volta a bloquear |
| 14.5 | "Abrir configurações" | Abre options.html#security |

---

## 15) Page Risk

| # | Passo | Aceite |
|---|-------|--------|
| 15.1 | Site com sinais (lookalike, claim+airdrop+connect) | Banner vermelho no topo |
| 15.2 | pageRisk HIGH no ANALYZE | reasonKey PAGE_RISK_HIGH; score elevado |
| 15.3 | Sites normais | Sem banner; não quebra |

---

## 16) Privacidade e opt-in (Store ready)

| # | Passo | Aceite |
|---|-------|--------|
| 16.1 | Options → Privacidade | Seção com: Aceito os termos; Permitir telemetria anônima (telemetryOptIn, default off); Permitir Cloud Intel (default off) |
| 16.2 | Telemetria | Nenhum envio sem termsAccepted + telemetryOptIn; getOptIn() independente de cloudIntelOptIn |
| 16.3 | Cloud Intel | Fetch externo só com cloudIntelOptIn; optional_host_permissions pedidas ao ativar |

---

## 17.4) Top-frame overlay (iframe broker)

Quando o RPC é disparado dentro de um iframe (all_frames=true), o overlay deve aparecer no **top frame** e a decisão deve voltar ao frame de origem.

| # | Passo | Aceite |
|---|-------|--------|
| 17.4.1 | **Iframe overlay visibility** | Abrir um site que use iframe e dispare provider.request dentro dele (ou HTML local com iframe que chama ethereum.request("eth_requestAccounts") / eth_sendTransaction). **Esperado:** overlay aparece no TOP (página principal), não dentro do iframe. |
| 17.4.2 | **Decisão retorna ao frame** | No mesmo cenário, clicar "Continuar" ou "Bloquear". **Esperado:** Promise no frame de origem resolve/rejeita corretamente; carteira abre só após ALLOW no top. |
| 17.4.3 | **Relay fallback** | Simular top frame não respondendo (ex.: desativar content no top) e disparar request no iframe. Após ~15s **esperado:** fallback aplica failMode (fail_open => ALLOW, fail_closed => BLOCK); console: "[SignGuard Content] relay timeout, applying failMode". |
| 17.4.4 | **Vault / summary / diag** | Com overlay top-frame ativo, vault unlock, summary e export de diagnóstico continuam a funcionar como antes. |

---

## 17.5) P0 — UI Gate (confirmação antes da carteira)

Métodos sensíveis (connect, permissões, assinaturas, tx, snaps) **nunca** devem bypassar o overlay com TEMP ALLOW; o usuário deve sempre ver o SignGuard e clicar "Continuar" antes da carteira abrir. Exceção: extensão **pausada**.

| # | Passo | Aceite |
|---|-------|--------|
| 17.5.1 | **TEMP ALLOW (domínio) + eth_requestAccounts** | Adicionar domínio a "Permitir por 10 min" (quick-action ou trusted). Em seguida chamar connect (eth_requestAccounts). **Esperado:** overlay do SignGuard aparece; callout "Confirme aqui antes de abrir a carteira." visível; carteira (MetaMask) só abre após clique em "Continuar". |
| 17.5.2 | **TEMP ALLOW (spender) + personal_sign / eth_signTypedData_v4** | Ter spender em temp allow (ou allowlist). Disparar personal_sign ou eth_signTypedData_v4 no mesmo domínio. **Esperado:** overlay aparece (não bypassa); usuário precisa clicar "Continuar" para a carteira abrir. |
| 17.5.3 | **Extensão pausada** | Pausar extensão por X minutos (Options ou popup). Chamar eth_sendTransaction (ou eth_requestAccounts). **Esperado:** overlay **não** aparece; carteira abre direto; em diagnóstico/log: meta contém reasonKeys incl. EXTENSION_PAUSED. |
| 17.5.4 | **Regressão: ALLOW sem uiConfirmed** | Simular no console da **página** (mainWorld): disparar CustomEvent `__sg_decision__` com detail `{ type: "SG_DECISION", requestId: "<id de um request gateUI em espera>", allow: true }` **sem** `meta.uiConfirmed`. **Esperado:** mainWorld **não** encaminha para a carteira; Promise rejeita com "SignGuard: UI confirmation required before forwarding to wallet"; console: "[SignGuard MainWorld] BLOCKED forward: uiConfirmed missing for gated method ...". |

---

## 17) Simulação sem Tenderly (preflight)

| # | Passo | Aceite |
|---|-------|--------|
| 17.1 | Sem chave Tenderly | Modo estático; outcome.fallback; fee estimate continua (mainWorld) |
| 17.2 | eth_call preflight (revert) | Quando simulação skipped/fallback, background chama eth_call com params da tx; se erro contém "revert" → HIGH/BLOCK, SIM_FAILED |
| 17.3 | Decode approval/permit em calldata | Overlay mostra o que vai acontecer (approve, permit, permit2) mesmo sem simulação |

---

## P1 — Intercept extra, A11y, Summary, Diagnóstico

| # | Passo | Aceite |
|---|-------|--------|
| P1.0 | **wallet_getPermissions** | Chamada não mostra overlay; auto-allow; evento registado no diagnóstico (REQ + ALLOW). ANALYZE existe (title "Leitura de permissões", LOW, READ_PERMISSIONS) para consistência. |
| P1.1 | **Intercept eth_sendRawTransaction** | Overlay aparece; analysis HIGH; reason RAW_TX_BROADCAST; card Resumo "Broadcast de transação assinada" com subtitle (EIP-1559 / EIP-2930 / bytes). |
| P1.2 | **Intercept eth_signTransaction** | Overlay aparece HIGH; card Resumo "Assinatura de transação"; reasonKeys SIGN_TRANSACTION. |
| P1.3 | **Snaps (wallet_invokeSnap / wallet_requestSnaps)** | STRICT => BLOCK; BALANCED => HIGH warn; card Resumo "Snaps / Extensões da carteira"; reasonKeys SNAP_INVOKE / REQUEST_SNAPS. |
| P1.4 | **Focus trap** | Tab/Shift+Tab não escapa do overlay; foco circula entre botões/elementos focáveis. |
| P1.5 | **inert/restore** | Fechar overlay restaura foco no elemento anterior; irmãos do overlay com inert. |
| P1.6 | **Export diagnóstico** | Options → Diagnóstico → "Exportar diagnóstico (JSON)" gera JSON com extensionVersion, exportedAt, settingsSnapshot (redacted), lastDiagEvents; sem segredos (tenderlyKey etc. [REDACTED]); payloads > 500 chars truncados com "...TRUNCATED". |

---

## Release checklist (Store)

**Nota:** O manifest não deve incluir a permissão inválida `"permissions"` (o Chrome mostra "Permission 'permissions' is unknown."). Use apenas permissões da allowlist validada por `validate-manifest-permissions.mjs` (ex.: storage, alarms, tabs).

Antes de subir para Chrome Web Store, executar na ordem:

| # | Passo | Aceite |
|---|-------|--------|
| R.1 | `npm run build` | Conclui sem erros |
| R.2 | `npm run pack` | Gera **somente** `dist/store/CryptoWalletSignGuard.zip`; console mostra "UPLOAD PARA CHROME WEB STORE: dist/store/..." |
| R.3 | Validar artefato | Não deve existir `node_modules/` no root nem `.zip` no root (validate falha se houver) |
| R.4 | Load unpacked | Em `chrome://extensions` carregar **somente** a pasta `extension/` |
| R.5 | Intercept + overlay | Em site qualquer com wallet: disparar sendTransaction → overlay aparece; Permitir/Bloquear funcionam |
| R.6 | Options → Cloud Intel | Ligar toggle Cloud Intel → pede permissões opcionais; negar → toggle volta e mensagem clara |
| R.7 | Popup → links | Clicar "Ver histórico" abre Options na aba correta (#history); "Diagnóstico" abre Options (#diagnostics) |
| R.8 | Onboarding | Instalar extensão → onboarding aparece; **sem marcar** Cloud Intel → Aceitar termos → cloudIntelOptIn e telemetryOptIn permanecem false; Cloud Intel não é ativado sozinho |

---

## Network opt-in audit

Garantir que **nenhum** fetch para domínios externos ocorre com todos os toggles OFF.

| # | Passo | Aceite |
|---|-------|--------|
| N.1 | Instalar unpacked | Carregar extensão a partir de `extension/` |
| N.2 | Abrir Service Worker | chrome://extensions → SignGuard → "Service Worker" → Inspect |
| N.3 | Aba Network | No DevTools do SW, abrir aba Network; filtro opcional por domínio |
| N.4 | Tudo OFF | Garantir Cloud Intel OFF, Exibir USD OFF (showUsd), Simulação OFF, Telemetria OFF (e sem permissões concedidas) |
| N.5 | Navegar em 3 dApps | Conectar carteira / trocar rede em 3 sites (ex.: Uniswap, OpenSea, Revoke) |
| N.6 | Verificar rede | **Nenhum** request para: raw.githubusercontent.com, api.cryptoscamdb.org, gitlab.com, gateway.ipfs.io, api.llama.fi, api.coingecko.com, api.dexscreener.com, api.tenderly.co, cjnzidctntqzamhwmwkt.supabase.co, **e nenhum RPC de chain** (token meta é via provider da página, não fetch do background) |
| N.6b | **Network OFF + Token meta** | Com tudo OFF: fazer uma tx ERC20 (approve/transfer) em um dApp. **Background** não deve fazer fetch para URLs de RPC. A **página** (provider/wallet) pode fazer chamadas normais — isso é esperado. Overlay deve mostrar token (address ou symbol se já em cache) e não ficar em loading infinito se meta falhar. |
| N.7 | Ligar Cloud Intel + conceder | Options → Segurança → Cloud Intel ON → conceder permissões → requests github/cryptoscamdb/etc. só depois |
| N.8 | Atualizar feeds | Options → Listas → "Atualizar feeds" → na aba Network do SW aparecem requests para feeds; caches preenchidos |
| N.9 | Ligar USD + conceder | Options → Geral: "Exibir valores em USD" ON → conceder permissões (Preços) → requests coingecko/dexscreener só depois |
| N.10 | Ligar Simulação + conceder | Options → Segurança → Habilitar simulação + Conceder (Tenderly) → requests api.tenderly.co só depois |
| N.11 | Ligar Telemetria + conceder | Options → Telemetria ON + Conceder → requests supabase só depois |
| N.12 | Desligar Cloud Intel | Options → Cloud Intel OFF → navegar de novo; **nenhum** novo request para domínios de Cloud Intel |

---

## Checklist Rápido (smoke)

- [ ] Build OK (`npm run build`); `npm run pack` gera zip em `dist/store/CryptoWalletSignGuard.zip`
- [ ] Load unpacked /extension
- [ ] Connect em dApp → overlay CONNECT
- [ ] Swap/send → overlay SEND_TX com simulação (ou preflight quando sem Tenderly)
- [ ] denylist spender → BLOCK automático
- [ ] fail_closed em falha → BLOCK default
- [ ] Tab não escapa do modal
- [ ] "Tentar novamente" reanalisa sem reload; watchdog 8s mostra "Tentar novamente" / "Fechar"
- [ ] Quick-actions (confiar/bloquear domínio/spender) → persist + retry
- [ ] Vault: unlock 5/30 min → libera temporariamente
- [ ] Page Risk: banner em site suspeito
- [ ] **Permit/Permit2:** typed data EIP-2612 ou Permit2 → card "Assinatura (EIP-712)", PERMIT_GRANT/PERMIT2_GRANT; calldata permit() ou Permit2 → decoded action + reasonKeys
- [ ] **CSS fallback:** forçar safeGetURL("overlay.css") vazio ou falha de carga → overlay ainda renderiza com CSS inline
- [ ] **Privacidade:** telemetryOptIn e cloudIntelOptIn default off; termos em Options
