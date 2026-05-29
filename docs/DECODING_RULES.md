# SignGuard Decoding Rules

This document describes how SignGuard interprets wallet requests, EVM calldata,
Permit signatures, Permit2 payloads, and the risk groups exposed in `Analysis`.

The decoder is intentionally conservative. It prefers a clear warning or an
`UNKNOWN` result over pretending to understand calldata that does not match a
known selector or typed-data shape.

## Intercepted Methods

SignGuard focuses on wallet methods that can expose identity, change wallet
state, create signatures, move assets, or grant permissions.

Common EVM methods:

- `eth_requestAccounts`
- `wallet_requestPermissions`
- `eth_sendTransaction`
- `wallet_sendTransaction`
- `eth_sign`
- `personal_sign`
- `eth_signTypedData`
- `eth_signTypedData_v3`
- `eth_signTypedData_v4`
- `wallet_switchEthereumChain`
- `wallet_addEthereumChain`
- `wallet_watchAsset`
- `eth_signTransaction`
- `eth_sendRawTransaction`
- `wallet_requestSnaps`
- `wallet_invokeSnap`

Read-only requests can be handled separately and may not show the same risk
surface as signing or transaction requests.

## Recognized Selectors

For EVM transaction calldata, SignGuard recognizes these selectors:

| Selector | Method | Interpretation |
| --- | --- | --- |
| `0x095ea7b3` | `approve(address,uint256)` | ERC20 token permission |
| `0x39509351` | `increaseAllowance(address,uint256)` | ERC20 allowance increase |
| `0xa457c2d7` | `decreaseAllowance(address,uint256)` | ERC20 allowance decrease |
| `0xa9059cbb` | `transfer(address,uint256)` | ERC20 transfer |
| `0x23b872dd` | `transferFrom(address,address,uint256)` | ERC20 delegated transfer |
| `0xa22cb465` | `setApprovalForAll(address,bool)` | ERC721/ERC1155 operator permission |
| `0x42842e0e` | `safeTransferFrom(address,address,uint256)` | ERC721 transfer |
| `0xb88d4fde` | `safeTransferFrom(address,address,uint256,bytes)` | ERC721 transfer with data |
| `0xf242432a` | `safeTransferFrom(address,address,uint256,uint256,bytes)` | ERC1155 transfer |
| `0x2eb2c2d6` | `safeBatchTransferFrom(address,address,uint256[],uint256[],bytes)` | ERC1155 batch transfer |
| `0xd505accf` | `permit(address,address,uint256,uint256,uint8,bytes32,bytes32)` | EIP-2612 permit |
| `0x2b67b570` | Permit2 `AllowanceTransfer.permit(...)` | Permit2 allowance authorization |
| `0x0d58b1db` | Permit2 `SignatureTransfer.permitTransferFrom(...)` | Permit2 transfer authorization |

All fixed-size arguments are read by ABI word index after the 4-byte selector.
Each ABI word is 32 bytes.

## ERC20 `approve`

`approve(address spender,uint256 amount)` is interpreted as:

- `spender`: word `0`
- `amount`: word `1`

If `amount` is `MAX_UINT256`, the permission is treated as unlimited.

Generated capability:

- category: `TOKEN_PERMISSION`
- severity: `WARN` for limited approvals
- severity: `HIGH` for unlimited approvals
- key fields: `spender`, `tokenContract`, `amountRaw`, `unlimited`

Security meaning: the spender can move tokens from the user's wallet up to the
approved amount. Unlimited approval can allow the spender to drain all current
and future balance of that token until revoked.

## Allowance Adjustments

`increaseAllowance(address spender,uint256 addedValue)` is interpreted as:

- `spender`: word `0`
- `addedValue`: word `1`

`decreaseAllowance(address spender,uint256 subtractedValue)` is interpreted as:

- `spender`: word `0`
- `subtractedValue`: word `1`

Increasing allowance is a permission expansion. Decreasing allowance is usually
lower risk, but it is still surfaced as a permission-related capability so the
user can see the spender and token involved.

## NFT `setApprovalForAll`

`setApprovalForAll(address operator,bool approved)` is interpreted as:

- `operator`: word `0`
- `approved`: word `1`

If `approved` is true, SignGuard treats it as a collection-wide NFT permission.
The operator can move all NFTs in that ERC721/ERC1155 collection for the owner.

Generated capability:

- category: `NFT_PERMISSION`
- severity: `HIGH` when `approved` is true
- severity: `INFO` when approval is being revoked or disabled
- key fields: `operator`, `tokenContract`, `unlimited`

Security meaning: a malicious or compromised operator can move NFTs from the
collection. This is one of the most important NFT-drainer patterns.

## EIP-2612 Permit

`permit(address owner,address spender,uint256 value,uint256 deadline,uint8 v,bytes32 r,bytes32 s)`
is interpreted as:

- `owner`: word `0`
- `spender`: word `1`
- `value`: word `2`
- `deadline`: word `3`

SignGuard focuses on the spender, value, deadline, and token contract. The
signature fields are not used to score risk directly.

Generated capability:

- category: `SIGNATURE_PERMISSION`
- severity: `WARN` for limited permit values
- severity: `HIGH` for unlimited permit values
- key fields: `spender`, `tokenContract`, `amountRaw`, `deadline`, `unlimited`

Security meaning: Permit can grant token allowance through a signature without
a separate on-chain `approve` transaction. Users should treat it like an
approval even if no gas fee is shown.

## Permit2 Typed Data

Permit2 typed data is detected from EIP-712 structures, domain names, and common
fields such as:

- domain name containing `Permit2`
- `message.permitted`
- `message.spender`
- permit-like fields such as `token`, `amount`, `amountMax`, `sigDeadline`

Generated capability:

- category: `SIGNATURE_PERMISSION`
- severity: `WARN` or `HIGH` depending on amount/unlimited status
- key fields: `spender`, `token`, `amountRaw`, `deadline`, `unlimited`

SignGuard treats Permit2 typed data conservatively because it can authorize
future token movement without an immediate token transfer in the current wallet
prompt.

## Permit2 Calldata

Permit2 calldata is recognized only when the transaction target is the known
Permit2 contract address:

`0x000000000022d473030f116ddee9f6b43ac78ba3`

Supported selectors:

- `0x2b67b570`: Permit2 allowance flow
- `0x0d58b1db`: Permit2 signature transfer flow

Generated capability:

- category: `SIGNATURE_PERMISSION`
- severity: `HIGH`
- reason: `PERMIT2_GRANT`
- metadata includes `conservative: true`

Security meaning: Permit2 can centralize or reuse token permissions across
dApps. Even when the calldata is valid, users should verify spender, token,
amount, deadline, and the requesting site.

## Typed Data Contract and Chain Checks

For typed-data signatures, SignGuard extracts EIP-712 domain fields when
available:

- `domain.verifyingContract`
- `domain.chainId`
- `primaryType`
- `domain.name`

If the typed-data chain ID differs from the active/requested chain ID, SignGuard
adds a `CONTRACT_MISMATCH` capability. If a verifying contract is present, it is
shown as evidence even when no mismatch is detected.

## Risk Groups

Capabilities are grouped into high-level UX risk groups.

### `permissionRisk`

Contains capabilities that directly permit asset movement or transfer:

- `TOKEN_PERMISSION`
- `NFT_PERMISSION`
- `SIGNATURE_PERMISSION`
- `TRANSFER`

Examples:

- ERC20 approval
- NFT approval for all
- Permit signature
- Permit2 authorization
- Token/NFT transfer

### `domainRisk`

Contains only domain reputation capabilities:

- `DOMAIN_REPUTATION`

Examples:

- known bad domain
- phishing or blocked domain
- trusted domain reference

Important: trusted domain status never hides dangerous permission capabilities.
A trusted site can still request an unlimited approval, Permit2 authorization,
or NFT operator approval.

### `contractRisk`

Contains only contract or EIP-712 domain mismatch capabilities:

- `CONTRACT_MISMATCH`

Examples:

- EIP-712 `chainId` mismatch
- typed-data verifying contract mismatch

Domain risk is not mixed with permission risk. Permission risk is not mixed with
contract mismatch risk.

## Known Limitations

- SignGuard does not perform full ABI decoding for arbitrary contracts.
- Unknown selectors are reported as unknown or generic contract interaction.
- Static decoding cannot prove that a contract is safe.
- Token decimals, token symbols, and collection names may require enrichment and
  can be unavailable.
- Proxy contracts, routers, multicalls, and custom Permit-like schemes may hide
  the final effect.
- Permit2 has multiple flows and struct variants. Unsupported variants may be
  treated conservatively or shown as unknown.
- EIP-712 typed data can be malformed, overly large, or wallet-specific.
- Domain allowlists and blocklists are reference signals, not guarantees.
- Simulation, pricing, and asset enrichment can be unavailable or incomplete.
- WalletConnect QR flows and external wallet flows may not be intercepted by the
  injected-provider path.

## Reporting False Positives

When reporting a false positive, include enough detail to reproduce the case,
but never include private keys, seed phrases, wallet passwords, or sensitive
session tokens.

Useful information:

- Site URL and domain
- Wallet method, for example `eth_sendTransaction` or `eth_signTypedData_v4`
- Chain ID
- Transaction target address
- Calldata selector and calldata, if safe to share
- Decoded capability shown by SignGuard
- Expected behavior and why the warning seems wrong
- Token or NFT contract address
- Spender or operator address
- Screenshot of the SignGuard overlay, with sensitive account data redacted
- Transaction hash, only if the transaction was actually sent

Recommended report format:

```text
False positive: short title

Site:
Method:
Chain ID:
Token/contract:
Spender/operator:
Selector or typed-data primaryType:
What SignGuard showed:
Expected interpretation:
Why this is safe or should be lower severity:
```

Report the issue through the project issue tracker or the maintainers' preferred
support channel.
