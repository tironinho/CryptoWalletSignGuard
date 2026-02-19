# SignGuard — Privacidade e Dados

## Princípios

O SignGuard foi desenhado para **minimizar coleta de dados** e respeitar a privacidade do usuário.

## O que NÃO é coletado

- **Seed / chave privada**: Nunca lidos, enviados ou armazenados fora da carteira.
- **Mnemonic / recovery phrase**: Nunca acessados.
- **Transações raw / assinaturas completas**: Não enviadas para servidores externos.
- **Histórico de navegação**: Não monitorado.

## Dados locais (navegador)

Armazenados apenas em `chrome.storage` (local/sync):

- Configurações do usuário (modo, allowlists, denylists, Vault)
- Histórico de decisões (allow/block) — cap 200 entradas, exportável
- Cache de listas (domínios bloqueados/confiáveis, endereços)
- Overrides temporários (Vault unlock, temp allow)

Nenhum destes é enviado automaticamente para fora.

## Opt-in explícito

### Cloud Intel (`cloudIntelOptIn`)

- **Default: DESLIGADO**
- Quando ligado: consultas remotas para reputação de domínios/endereços/contratos.
- Não envia seed, nem transações raw, nem assinaturas.

### Telemetria (`telemetryEnabled`)

- **Default: DESLIGADO**
- Quando ligado: eventos de uso, ameaças detectadas e métricas agregadas.
- Usado apenas para melhorar o produto; sem identificadores pessoais.

## Permissões da extensão

- `storage`, `alarms`, `tabs`: configuração e funcionalidade da extensão.
- `<all_urls>`: injetar script no contexto da página para interceptar `window.ethereum`.
- `https://api.tenderly.co/*`: simulação de transações (apenas se configurado pelo usuário).
- `https://raw.githubusercontent.com/*`, etc.: atualização de listas de reputação (phishing, scam).

## Contato

Para dúvidas sobre privacidade: [inserir contacto do projeto].
