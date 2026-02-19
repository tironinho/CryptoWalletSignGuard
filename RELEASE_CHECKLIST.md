# SignGuard — Release Checklist (v1)

## Pré-build

- [ ] `npm install` executado
- [ ] Sem dependências pesadas ou não utilizadas
- [ ] `npm run typecheck` passa
- [ ] `npm run build` passa
- [ ] Validação de worlds OK (mainWorld=MAIN, content=ISOLATED)

## Funcionalidade

- [ ] Interceptação: `eth_requestAccounts`, `wallet_requestPermissions`, `wallet_addEthereumChain`, `wallet_switchEthereumChain`, `wallet_watchAsset`, `eth_sendTransaction`, `wallet_sendTransaction`, `personal_sign`, `eth_sign`, `eth_signTypedData` (v3/v4)
- [ ] Multi-provider: `window.ethereum.providers`, EIP-6963
- [ ] Overlay: dedupe, retry, timeout, failMode (fail_open/fail_closed)
- [ ] Spenders: allowlist/denylist aplicados
- [ ] Vault: bloqueio + unlock temporário (5/30 min)
- [ ] Page Risk: banner para risco MEDIUM+
- [ ] Temp allow: "Permitir por 10 min" funcional
- [ ] Simulação: cache 30s, timeout 2.2s, SIMULATION_TIMEOUT

## Privacidade

- [ ] `cloudIntelOptIn` default false
- [ ] `telemetryEnabled` default false
- [ ] PRIVACY.md atualizado e publicado

## Pack / distribuição

- [ ] `npm run pack` gera zip limpo
- [ ] Zip não contém `node_modules/`
- [ ] Zip não contém zips antigos nem arquivos de build desnecessários
- [ ] `manifest.json` na raiz do zip

## Testes manuais

- [ ] Connect em dapp (ex: Uniswap)
- [ ] Switch chain
- [ ] Approve unlimited
- [ ] Permit typed data
- [ ] Dedupe (2 requests rápidos → 1 overlay)
- [ ] Retry "Tentar novamente"
- [ ] failMode: fail_open e fail_closed
- [ ] Vault unlock 5/30 min
- [ ] EIP-6963 (se disponível)
- [ ] Temp allow 10 min
