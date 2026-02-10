import { isHexString } from "./utils";

export const SELECTOR_ERC20_APPROVE = "0x095ea7b3";
export const SELECTOR_SET_APPROVAL_FOR_ALL = "0xa22cb465";

function isMaxUint256Word(word64: string) {
  return /^[fF]{64}$/.test(word64);
}

function wordAt(dataNo0x: string, wordIndex: number) {
  const start = wordIndex * 64;
  const end = start + 64;
  if (dataNo0x.length < end) return null;
  return dataNo0x.slice(start, end);
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

