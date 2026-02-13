# SignGuard (MVP) — MV3 (TypeScript) / MAIN world hook

This extension intercepts key `window.ethereum.request()` calls **in the MAIN world** (MV3 `content_scripts[].world = "MAIN"`) and shows a risk overlay **before** the wallet popup.

## Build

```bash
npm i
npm run build
```

- **Output:** `dist/` (bundles) and **`extension/`** (ready for Load unpacked). The build flattens `dist/*` into `extension/`, writes `extension/manifest.json` from `src/manifest.template.json`, and keeps `_locales` at the root of `extension/`. **Always load the `extension/` folder** — the project root and `dist/` do not contain `manifest.json`; only `extension/` is valid for "Load unpacked".

## Load unpacked (testar local)

- Open `chrome://extensions`
- Enable **Developer mode**
- Click **Load unpacked**
- **Select the `extension/` folder** (created by `npm run build`). It contains `manifest.json` at the root and all scripts/assets. Do not select the project root or `dist/` — the Chrome unpacked loader requires the folder that contains `manifest.json` (i.e. `extension/`).

## Pack (publicar / loja)

```bash
npm run build
npm run pack
```

- **Pack** zips the **contents** of `extension/` into **`CryptoWalletSignGuard.zip`** with `manifest.json` at the root of the archive, as required for the Chrome Web Store and side-load installs.
- Run `npm run build` before `npm run pack`.

## Quick test checklist

- **Connect overlay**
  - Go to `app.uniswap.org` (or `opensea.io`)
  - Click **Connect**
  - Expected: SignGuard overlay appears **before** MetaMask
  - MetaMask must **NOT** open until you click **Continue**

- **OpenSea 2-step flow (switch chain -> tx)**
  - Trigger a flow that asks to switch chain first, then submits a transaction
  - Expected:
    - Step 1 (`wallet_switchEthereumChain`): overlay shows **Switch network** and the note that switching typically has **no gas**
    - Step 2 (`eth_sendTransaction`): overlay updates in-place to **Send transaction** and shows **value + estimated gas + total** (ETH), with USD optional if available

- **Trust verdict**
  - `opensea.io` should show **"Seems official"** (when allowlisted)
  - Test a fake like `opensea-login.xyz` should show **"Suspicious"** and recommend cancel/verify URL

- **Unlimited approve (HIGH / BLOCK by default)**
  - On a token flow that triggers `approve(spender, MAX_UINT256)`
  - With **Block HIGH risk** enabled in Options:
    - Overlay should show **HIGH**
    - Default recommendation is **BLOCK**
    - Clicking **Cancel** should reject the request (EIP-1193 `4001`)

- **Language auto-switch**
  - Change browser language (pt-BR / en / es)
  - Reload the extension + refresh the page
  - Overlay and Options should follow the browser language automatically

- **CSP / console**
  - On strict-CSP sites (e.g. Uniswap, OpenSea), the overlay should not trigger CSP errors for inline handlers (token logo fallback is attached via JS, not `onerror="..."`).

- **After any change**
  - Go to `chrome://extensions`
  - Click **Reload** on SignGuard
  - Hard refresh the test tab (Ctrl+F5)

## Options

Open extension details → **Extension options**:

- **Risk warnings**: enables/disables all overlays (fail-open)
- **Connect overlay**: whether `eth_requestAccounts` triggers a WARN overlay
- **Block HIGH risk**: sets recommendation to BLOCK for HIGH cases
- **Domain checks**: warns on suspicious host patterns (punycode/lookalikes), unless allowlisted
- **Allowlist**: one domain per line (suppresses domain heuristics for that domain/subdomains)

