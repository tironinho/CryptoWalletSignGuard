# Como instalar a extensão SignGuard (Load unpacked)

## Passos

1. **Instale as dependências e gere a pasta da extensão:**
   ```bash
   npm i
   npm run build
   ```
   Ou, se você já rodou o build antes:
   ```bash
   npm run build-extension
   ```

2. **No Chrome:**
   - Abra `chrome://extensions`
   - Ative o **Modo do desenvolvedor**
   - Clique em **Carregar sem compactação**
   - **Selecione a pasta `extension`** do projeto (caminho: `./extension` ou `CryptoWalletSignGuard/extension`).

## Atenção: qual pasta carregar

- **Use a pasta `./extension`** — ela contém o `manifest.json` e todos os arquivos necessários.
- **Não use a pasta `./dist`** — ela não contém `manifest.json` e o Chrome mostrará erro "Manifest could not be loaded" ou similar.
- **Não use a raiz do projeto** — use apenas a pasta `extension` gerada pelo build.

Resumo: depois de rodar `npm run build`, a pasta correta para "Carregar sem compactação" é **`./extension`**.
