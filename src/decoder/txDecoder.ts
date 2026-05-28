/**
 * V2: Decode ERC-20 / ERC-721 / ERC-1155 calldata (transfer, approve, setApprovalForAll).
 * No external libs — simple ABI slice parsing.
 */

export type DecodedTx = {
  selector: string;
  kind: "transfer" | "approve" | "transferFrom" | "setApprovalForAll" | "permit" | "unknown";
  to?: string;
  amountRaw?: string;
  from?: string;
  spender?: string;
  operator?: string;
  approved?: boolean;
  tokenContract?: string;
  unlimitedApproval?: boolean;
};

const TRANSFER = "0xa9059cbb";
const APPROVE = "0x095ea7b3";
const TRANSFER_FROM = "0x23b872dd";
const SET_APPROVAL_FOR_ALL = "0xa22cb465";
const PERMIT = "0xd505accf";
const MAX_UINT256 = BigInt("0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff");
const HALF_MAX = MAX_UINT256 / 2n;

function wordToAddress(dataHex: string, wordIndex: number): string {
  const data = dataHex.startsWith("0x") ? dataHex.slice(2) : dataHex;
  const start = wordIndex * 64;
  const word = data.slice(start, start + 64);
  return "0x" + word.slice(24, 64).toLowerCase();
}

function wordToUint256(dataHex: string, wordIndex: number): bigint {
  const data = dataHex.startsWith("0x") ? dataHex.slice(2) : dataHex;
  const start = wordIndex * 64;
  const word = data.slice(start, start + 64);
  return BigInt("0x" + word);
}

export function decodeTxData(to: string, data: string): DecodedTx {
  const d = (data || "").toLowerCase();
  const sel = d.length >= 10 ? d.slice(0, 10) : "";
  const payload = d.length > 10 ? d.slice(10) : "";
  const tokenContract = to && to.startsWith("0x") && to.length === 42 ? to.toLowerCase() : undefined;

  if (sel === TRANSFER) {
    if (payload.length >= 128) {
      const toAddr = wordToAddress(payload, 0);
      const amount = wordToUint256(payload, 1);
      return {
        selector: sel,
        kind: "transfer",
        tokenContract,
        to: toAddr,
        amountRaw: amount.toString(10),
        unlimitedApproval: amount >= HALF_MAX,
      };
    }
    return { selector: sel, kind: "transfer", tokenContract };
  }

  if (sel === APPROVE) {
    if (payload.length >= 128) {
      const spender = wordToAddress(payload, 0);
      const amount = wordToUint256(payload, 1);
      return {
        selector: sel,
        kind: "approve",
        tokenContract,
        spender,
        amountRaw: amount.toString(10),
        unlimitedApproval: amount >= HALF_MAX,
      };
    }
    return { selector: sel, kind: "approve", tokenContract };
  }

  if (sel === TRANSFER_FROM) {
    if (payload.length >= 192) {
      const from = wordToAddress(payload, 0);
      const toAddr = wordToAddress(payload, 1);
      const amount = wordToUint256(payload, 2);
      return {
        selector: sel,
        kind: "transferFrom",
        tokenContract,
        from,
        to: toAddr,
        amountRaw: amount.toString(10),
      };
    }
    return { selector: sel, kind: "transferFrom", tokenContract };
  }

  if (sel === SET_APPROVAL_FOR_ALL) {
    if (payload.length >= 128) {
      const operator = wordToAddress(payload, 0);
      const approvedWord = payload.slice(64, 128);
      const approved = approvedWord !== "0".repeat(64);
      return {
        selector: sel,
        kind: "setApprovalForAll",
        tokenContract,
        operator,
        approved,
      };
    }
    return { selector: sel, kind: "setApprovalForAll", tokenContract };
  }

  if (sel === PERMIT) {
    return { selector: sel, kind: "permit", tokenContract };
  }

  return { selector: sel || "0x", kind: "unknown", tokenContract };
}
