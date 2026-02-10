# SignGuard (MVP) — MV3 (TypeScript) / MAIN world hook

This extension intercepts key `window.ethereum.request()` calls **in the MAIN world** (MV3 `content_scripts[].world = "MAIN"`) and shows a risk overlay **before** the wallet popup.

## Build

```bash
npm i
npm run build
```

Output: `dist/` (load this folder in Chrome/Brave).

## Load unpacked

- Open `chrome://extensions`
- Enable **Developer mode**
- Click **Load unpacked**
- Select the folder `extension/dist`

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

