import { isHexString } from "./utils";
import type { DecodedAction, Address } from "./types";

export const SELECTOR_ERC20_APPROVE = "0x095ea7b3";
export const SELECTOR_INCREASE_ALLOWANCE = "0x39509351";
export const SELECTOR_DECREASE_ALLOWANCE = "0xa457c2d7";
export const SELECTOR_SET_APPROVAL_FOR_ALL = "0xa22cb465";
export const SELECTOR_TRANSFER = "0xa9059cbb";
export const SELECTOR_TRANSFER_FROM = "0x23b872dd";
export const SELECTOR_SAFE_TRANSFER_FROM_1 = "0x42842e0e";
export const SELECTOR_SAFE_TRANSFER_FROM_2 = "0xb88d4fde";
export const SELECTOR_ERC1155_SAFE_TRANSFER = "0xf242432a";
export const SELECTOR_ERC1155_SAFE_BATCH_TRANSFER = "0x2eb2c2d6";
export const SELECTOR_PERMIT = "0xd505accf";

/** Permit2 AllowanceTransfer.permit(address,PermitSingle,bytes) - Uniswap Permit2 */
export const SELECTOR_PERMIT2_ALLOWANCE = "0x2b67b570";
/** Permit2 SignatureTransfer.permitTransferFrom(single) - Uniswap Permit2 */
export const SELECTOR_PERMIT2_SIGNATURE_TRANSFER = "0x0d58b1db";

/** Canonical Permit2 contract (Uniswap) - same address on mainnet, Arbitrum, Base, etc. */
export const PERMIT2_ADDRESS = "0x000000000022d473030f116ddee9f6b43ac78ba3";
/** Seaport 1.5 (OpenSea) - NFT marketplace. */
export const SEAPORT_ADDRESS = "0x00000000000000adc04c56bf30ac9d3c0aaf14dc";
/** Blur Marketplace. */
export const BLUR_MARKETPLACE = "0x000000000000ad05ccc4f10045630fb830b95127";

/** Known marketplace/approval contracts (canonical addresses, lowercase 40 hex). */
const KNOWN_MARKETPLACES: Record<string, string> = {
  [PERMIT2_ADDRESS.toLowerCase().replace(/^0x/, "").slice(-40)]: "PERMIT2",
  [SEAPORT_ADDRESS.toLowerCase().replace(/^0x/, "").slice(-40)]: "SEAPORT",
  [BLUR_MARKETPLACE.toLowerCase().replace(/^0x/, "").slice(-40)]: "BLUR",
};

/** multicall(uint256,bytes[]) - 0x5ae401dc (Uniswap Universal Router, etc.). */
export const SELECTOR_MULTICALL = "0x5ae401dc";

const MAX_UINT256 = 2n ** 256n - 1n;

export function getKnownMarketplace(addr: string): string | null {
  if (!addr || typeof addr !== "string") return null;
  const a = addr.toLowerCase().replace(/^0x/, "").padStart(40, "0").slice(-40);
  return KNOWN_MARKETPLACES[a] ?? null;
}

function isPermit2Contract(addr: string): boolean {
  if (!addr || typeof addr !== "string") return false;
  const a = addr.toLowerCase().replace(/^0x/, "").padStart(40, "0").slice(-40);
  const b = PERMIT2_ADDRESS.toLowerCase().replace(/^0x/, "").padStart(40, "0").slice(-40);
  return a === b;
}

function isMaxUint256Word(word64: string) {
  return /^[fF]{64}$/.test(word64);
}

function wordAt(dataNo0x: string, wordIndex: number) {
  const start = wordIndex * 64;
  const end = start + 64;
  if (dataNo0x.length < end) return null;
  return dataNo0x.slice(start, end);
}

function readWord(dataHex: string, wordIndex: number): string {
  const data = dataHex.startsWith("0x") ? dataHex.slice(2) : dataHex;
  const start = wordIndex * 64;
  return data.slice(start, start + 64);
}

function readAddress(dataHex: string, wordIndex: number): Address {
  const word = readWord(dataHex, wordIndex);
  return ("0x" + (word.length >= 40 ? word.slice(24) : word.padStart(40, "0"))).toLowerCase();
}

function readUint256(dataHex: string, wordIndex: number): bigint {
  const word = readWord(dataHex, wordIndex);
  if (!word) return 0n;
  return BigInt("0x" + word);
}

const permit2Flag = (txTo?: string) => (isPermit2Contract(txTo || "") ? { permit2: true as const } : {});

export function decodeTx(data: string, txTo?: string): DecodedAction | null {
  if (!isHexString(data) || data.length < 10) return null;
  const lower = data.toLowerCase();
  const selector = lower.slice(0, 10);
  const body = lower.slice(10);
  const token = (txTo || "").toLowerCase();

  if (selector === SELECTOR_ERC20_APPROVE) {
    const spender = readAddress(body, 0);
    const amount = readUint256(body, 2);
    const amountType = amount === MAX_UINT256 ? "UNLIMITED" : "LIMITED";
    return { kind: "APPROVE_ERC20", token, spender, amountType, amountRaw: amount.toString(), ...permit2Flag(txTo) };
  }
  if (selector === SELECTOR_INCREASE_ALLOWANCE) {
    const spender = readAddress(body, 0);
    const addedValue = readUint256(body, 2);
    const amountType = addedValue === MAX_UINT256 ? "UNLIMITED" : "LIMITED";
    return { kind: "INCREASE_ALLOWANCE", token, spender, amountType, amountRaw: addedValue.toString(), ...permit2Flag(txTo) };
  }
  if (selector === SELECTOR_DECREASE_ALLOWANCE) {
    const spender = readAddress(body, 0);
    const subtractedValue = readUint256(body, 2);
    return { kind: "DECREASE_ALLOWANCE", token, spender, amountRaw: subtractedValue.toString(), ...permit2Flag(txTo) };
  }
  if (selector === SELECTOR_TRANSFER) {
    const to = readAddress(body, 0);
    const amount = readUint256(body, 2);
    return { kind: "TRANSFER_ERC20", token, to, amountRaw: amount.toString(), ...permit2Flag(txTo) };
  }
  if (selector === SELECTOR_TRANSFER_FROM) {
    const from = readAddress(body, 0);
    const to = readAddress(body, 1);
    const amount = readUint256(body, 2);
    return { kind: "TRANSFERFROM_ERC20", token, from, to, amountRaw: amount.toString(), ...permit2Flag(txTo) };
  }
  if (selector === SELECTOR_SET_APPROVAL_FOR_ALL) {
    const operator = readAddress(body, 0);
    const approved = readUint256(body, 2) !== 0n;
    return { kind: "SET_APPROVAL_FOR_ALL", token, operator, approved, ...permit2Flag(txTo) };
  }
  if (selector === SELECTOR_SAFE_TRANSFER_FROM_1 || selector === SELECTOR_SAFE_TRANSFER_FROM_2) {
    const from = readAddress(body, 0);
    const to = readAddress(body, 2);
    const tokenId = readUint256(body, 4);
    return { kind: "TRANSFER_NFT", token, to, tokenIdRaw: tokenId.toString(), standard: "ERC721", ...permit2Flag(txTo) };
  }
  if (selector === SELECTOR_ERC1155_SAFE_TRANSFER) {
    const from = readAddress(body, 0);
    const to = readAddress(body, 1);
    const id = readUint256(body, 2);
    const amount = readUint256(body, 3);
    return { kind: "TRANSFER_NFT", token, from, to, tokenIdRaw: id.toString(), amountRaw: amount.toString(), standard: "ERC1155", ...permit2Flag(txTo) };
  }
  if (selector === SELECTOR_ERC1155_SAFE_BATCH_TRANSFER) {
    const from = readAddress(body, 0);
    const to = readAddress(body, 1);
    return { kind: "TRANSFER_NFT", token, from, to, standard: "ERC1155", batch: true, ...permit2Flag(txTo) };
  }
  if (selector === SELECTOR_PERMIT) {
    const spender = readAddress(body, 1);
    const value = readUint256(body, 2);
    const deadline = readUint256(body, 3);
    const valueType = value === MAX_UINT256 ? "UNLIMITED" : "LIMITED";
    return { kind: "PERMIT_EIP2612", token, spender, valueType, valueRaw: value.toString(), deadlineRaw: deadline.toString(), ...permit2Flag(txTo) };
  }
  // Permit2 AllowanceTransfer.permit(owner, PermitSingle, signature) — struct starts at offset 0x60 (word 3)
  if (isPermit2Contract(txTo || "") && selector === SELECTOR_PERMIT2_ALLOWANCE) {
    if (body.length >= 9 * 64) {
      const tokenAddr = readAddress(body, 3);
      const amount = readUint256(body, 4);
      const spenderAddr = readAddress(body, 7);
      const sigDeadline = readUint256(body, 8);
      const amountType = amount === MAX_UINT256 || amount >= 2n ** 160n - 1n ? "UNLIMITED" : "LIMITED";
      return { kind: "PERMIT2_ALLOWANCE", token: tokenAddr, spender: spenderAddr, amountType, amountRaw: amount.toString(), deadlineRaw: sigDeadline.toString(), ...permit2Flag(txTo) };
    }
    return { kind: "PERMIT2_ALLOWANCE", token: "", spender: "", amountType: "LIMITED" as const, amountRaw: "0", deadlineRaw: "0", ...permit2Flag(txTo) };
  }
  // Permit2 SignatureTransfer.permitTransferFrom(permit, transferDetails, owner, signature) — token/amount in permit struct
  if (isPermit2Contract(txTo || "") && selector === SELECTOR_PERMIT2_SIGNATURE_TRANSFER) {
    if (body.length >= 8 * 64) {
      const tokenAddr = readAddress(body, 3);
      const amount = readUint256(body, 4);
      const toAddr = readAddress(body, 6);
      const amountType = amount === MAX_UINT256 ? "UNLIMITED" : "LIMITED";
      return { kind: "PERMIT2_TRANSFER", token: tokenAddr, to: toAddr, amountType, amountRaw: amount.toString(), ...permit2Flag(txTo) };
    }
    return { kind: "PERMIT2_TRANSFER", token: "", to: "", amountType: "LIMITED" as const, amountRaw: "0", ...permit2Flag(txTo) };
  }
  const mh = getKnownMarketplace(txTo || "");
  const marketplaceHint = mh ? { marketplaceHint: mh } : {};
  if (selector === SELECTOR_MULTICALL) {
    return { kind: "MULTICALL", selector, ...marketplaceHint, ...permit2Flag(txTo) };
  }
  return { kind: "UNKNOWN", selector, ...marketplaceHint, ...permit2Flag(txTo) };
}

export function decodeErc20Approve(data: string) {
  // approve(address spender, uint256 value)
  if (!isHexString(data)) return null;
  const lower = data.toLowerCase();
  if (!lower.startsWith(SELECTOR_ERC20_APPROVE)) return null;
  const body = lower.slice(10); // strip selector
  const spenderWord = wordAt(body, 0);
  const valueWord = wordAt(body, 1);
  if (!spenderWord || !valueWord) return null;

  const spender = ("0x" + spenderWord.slice(24)).toLowerCase();
  let value: bigint | null = null;
  try {
    value = BigInt("0x" + valueWord);
  } catch {
    value = null;
  }

  return {
    spender,
    isMax: isMaxUint256Word(valueWord),
    value,
  };
}

export function decodeSetApprovalForAll(data: string) {
  // setApprovalForAll(address operator, bool approved)
  if (!isHexString(data)) return null;
  const lower = data.toLowerCase();
  if (!lower.startsWith(SELECTOR_SET_APPROVAL_FOR_ALL)) return null;
  const body = lower.slice(10);
  const operatorWord = wordAt(body, 0);
  const approvedWord = wordAt(body, 1);
  if (!operatorWord || !approvedWord) return null;

  const operator = ("0x" + operatorWord.slice(24)).toLowerCase();
  const approved = /^0{63}1$/.test(approvedWord);

  return { operator, approved };
}

