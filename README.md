# SignGuard (MVP) — MV3 (TypeScript) / MAIN world hook

This extension intercepts key `window.ethereum.request()` calls **in the MAIN world** (MV3 `content_scripts[].world = "MAIN"`) and shows a risk overlay **before** the wallet popup.

## Build

```bash
npm i
npm run build
```

- **Output:** `dist/` (intermediate) and **`extension/`** (final). The build copies everything from `dist/` into `extension/` so that `manifest.json`, `background.js`, `content.js`, `mainWorld.js`, and HTML/icons all live in one folder.

## Load unpacked (testar local)

- Open `chrome://extensions`
- Enable **Developer mode**
- Click **Load unpacked**
- **Select the folder `extension/`** (not the repo root and not `dist/`). The extension only works when the folder you load contains `manifest.json` and the built JS/HTML at the same level.

## Pack (publicar / loja)

```bash
npm run pack
```

- Produces **`crypto-wallet-signguard.zip`** in the repo root.
- The ZIP contains the **contents** of `extension/` (e.g. `manifest.json` at the **root of the ZIP**), as required for the Chrome Web Store and side-load installs.
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

