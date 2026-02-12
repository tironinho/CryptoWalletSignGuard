/**
 * Human-readable EVM tx decoding (selectors only, no ABI). Used for overlay labels and reasons.
 */

export type DecodedEvmTxKind =
  | "ERC20_TRANSFER"
  | "ERC20_APPROVE"
  | "ERC20_TRANSFER_FROM"
  | "ERC721_TRANSFER"
  | "NFT_APPROVAL_ALL"
  | "ERC1155_TRANSFER"
  | "ERC1155_BATCH_TRANSFER"
  | "UNKNOWN";

export type DecodedEvmTx = {
  kind: DecodedEvmTxKind;
  tokenContract?: string;
  toAddress?: string;
  fromAddress?: string;
  spender?: string;
  amountRaw?: string;
  isUnlimited?: boolean;
  selector?: string;
  tokenIdRaw?: string;
};

const SELECTOR_TRANSFER = "0xa9059cbb";
const SELECTOR_APPROVE = "0x095ea7b3";
const SELECTOR_TRANSFER_FROM = "0x23b872dd";
const SELECTOR_SET_APPROVAL_FOR_ALL = "0xa22cb465";
const SELECTOR_SAFE_TRANSFER_FROM_1 = "0x42842e0e";
const SELECTOR_SAFE_TRANSFER_FROM_2 = "0xb88d4fde";
const SELECTOR_ERC1155_SAFE_TRANSFER = "0xf242432a";
const SELECTOR_ERC1155_SAFE_BATCH_TRANSFER = "0x2eb2c2d6";
const MAX_UINT256 = 2n ** 256n - 1n;

function readWord(dataHex: string, wordIndex: number): string {
  const data = dataHex.startsWith("0x") ? dataHex.slice(2) : dataHex;
  const start = wordIndex * 64;
  return data.slice(start, start + 64);
}

function readAddress(dataHex: string, wordIndex: number): string {
  const word = readWord(dataHex, wordIndex);
  return ("0x" + (word.length >= 40 ? word.slice(24) : word.padStart(40, "0"))).toLowerCase();
}

function readUint256(dataHex: string, wordIndex: number): bigint {
  const word = readWord(dataHex, wordIndex);
  if (!word) return 0n;
  return BigInt("0x" + word);
}

export function decodeEvmTx(
  tx: { to?: string; data?: string; value?: string },
  _chainId?: string
): DecodedEvmTx {
  const to = (tx.to || "").toLowerCase();
  const data = typeof tx.data === "string" ? tx.data.toLowerCase() : "";
  if (!data || !data.startsWith("0x") || data.length < 10) {
    return { kind: "UNKNOWN", selector: undefined };
  }
  const selector = data.slice(0, 10);
  const body = data.slice(10);

  if (selector === SELECTOR_APPROVE) {
    const spender = readAddress(body, 0);
    const amount = readUint256(body, 2);
    const isUnlimited = amount === MAX_UINT256;
    return {
      kind: "ERC20_APPROVE",
      tokenContract: to,
      spender,
      amountRaw: amount.toString(),
      isUnlimited,
      selector,
    };
  }
  if (selector === SELECTOR_TRANSFER) {
    const toAddress = readAddress(body, 0);
    const amount = readUint256(body, 2);
    return {
      kind: "ERC20_TRANSFER",
      tokenContract: to,
      toAddress,
      amountRaw: amount.toString(),
      selector,
    };
  }
  if (selector === SELECTOR_TRANSFER_FROM) {
    const fromAddress = readAddress(body, 0);
    const toAddress = readAddress(body, 1);
    const amount = readUint256(body, 2);
    return {
      kind: "ERC20_TRANSFER_FROM",
      tokenContract: to,
      fromAddress,
      toAddress,
      amountRaw: amount.toString(),
      selector,
    };
  }
  if (selector === SELECTOR_SET_APPROVAL_FOR_ALL) {
    const operator = readAddress(body, 0);
    const approved = readUint256(body, 2) !== 0n;
    return {
      kind: "NFT_APPROVAL_ALL",
      tokenContract: to,
      spender: operator,
      isUnlimited: approved,
      selector,
    };
  }
  if (selector === SELECTOR_ERC1155_SAFE_TRANSFER) {
    const fromAddress = readAddress(body, 0);
    const toAddress = readAddress(body, 1);
    const id = readUint256(body, 2);
    const amount = readUint256(body, 3);
    return {
      kind: "ERC1155_TRANSFER",
      tokenContract: to,
      fromAddress,
      toAddress,
      amountRaw: amount.toString(),
      tokenIdRaw: id.toString(),
      selector,
    };
  }
  if (selector === SELECTOR_ERC1155_SAFE_BATCH_TRANSFER) {
    const fromAddress = readAddress(body, 0);
    const toAddress = readAddress(body, 1);
    return {
      kind: "ERC1155_BATCH_TRANSFER",
      tokenContract: to,
      fromAddress,
      toAddress,
      selector,
    };
  }
  if (selector === SELECTOR_SAFE_TRANSFER_FROM_1 || selector === SELECTOR_SAFE_TRANSFER_FROM_2) {
    const fromAddress = readAddress(body, 0);
    const toAddress = readAddress(body, 2);
    const tokenId = readUint256(body, 4);
    return {
      kind: "ERC721_TRANSFER",
      tokenContract: to,
      fromAddress,
      toAddress,
      tokenIdRaw: tokenId.toString(),
      selector,
    };
  }
  return { kind: "UNKNOWN", selector };
}

export type TypedDataPermitExtras = {
  spender?: string;
  value?: string;
  deadline?: string;
};

/** Extract Permit-like fields from EIP-712 typed data (primaryType / message). */
export function extractTypedDataPermitExtras(raw: string): TypedDataPermitExtras | null {
  try {
    if (!raw || raw.length > 200_000) return null;
    const j: any = JSON.parse(raw);
    const domainName = String(j?.domain?.name || "").toLowerCase();
    const primaryType = String(j?.primaryType || "").toLowerCase();
    const msg = j?.message || {};
    const looksPermit = domainName.includes("permit") || primaryType.includes("permit") || (!!msg?.permitted && !!msg?.spender);
    const looksApproveLike = !!msg?.spender && (("value" in msg) || ("amount" in msg));
    if (!looksPermit && !looksApproveLike) return null;
    const spender = typeof msg?.spender === "string" ? msg.spender.trim() : undefined;
    const value = typeof msg?.value === "string" ? msg.value : (typeof msg?.amount === "string" ? msg.amount : undefined);
    const deadline = typeof msg?.deadline === "string" ? msg.deadline : (typeof msg?.expiry === "string" ? msg.expiry : undefined);
    if (!spender && !value && !deadline) return null;
    return { spender: spender || undefined, value, deadline };
  } catch {
    return null;
  }
}
