import * as esbuild from "esbuild";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(fileURLToPath(new URL("..", import.meta.url)));

async function loadTsModule(relativePath) {
  const result = await esbuild.build({
    absWorkingDir: rootDir,
    entryPoints: [relativePath],
    bundle: true,
    format: "esm",
    platform: "node",
    target: "es2020",
    write: false,
    logLevel: "silent",
  });
  const code = result.outputFiles[0].text;
  const url = `data:text/javascript;base64,${Buffer.from(code).toString("base64")}`;
  return import(url);
}

function strip0x(value) {
  return String(value).replace(/^0x/i, "");
}

function addressWord(address) {
  return strip0x(address).toLowerCase().padStart(64, "0");
}

function uintWord(value) {
  return BigInt(value).toString(16).padStart(64, "0");
}

function boolWord(value) {
  return uintWord(value ? 1n : 0n);
}

function call(selector, words) {
  return selector + words.join("");
}

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${expected}, got ${actual}`);
  }
}

function assertTrue(value, label) {
  if (value !== true) {
    throw new Error(`${label}: expected true, got ${value}`);
  }
}

const shared = await loadTsModule("src/shared/decode.ts");
const humanize = await loadTsModule("src/txHumanize.ts");
const txDecoder = await loadTsModule("src/decoder/txDecoder.ts");

const SELECTOR_APPROVE = "0x095ea7b3";
const SELECTOR_INCREASE_ALLOWANCE = "0x39509351";
const SELECTOR_DECREASE_ALLOWANCE = "0xa457c2d7";
const SELECTOR_TRANSFER = "0xa9059cbb";
const SELECTOR_TRANSFER_FROM = "0x23b872dd";
const SELECTOR_SET_APPROVAL_FOR_ALL = "0xa22cb465";
const SELECTOR_SAFE_TRANSFER_FROM = "0x42842e0e";
const SELECTOR_PERMIT = "0xd505accf";
const SELECTOR_PERMIT2_ALLOWANCE = "0x2b67b570";
const SELECTOR_PERMIT2_SIGNATURE_TRANSFER = "0x0d58b1db";

const MAX_UINT256 = (1n << 256n) - 1n;
const PERMIT2_ADDRESS = "0x000000000022d473030f116ddee9f6b43ac78ba3";
const token = "0x1111111111111111111111111111111111111111";
const nft = "0x1212121212121212121212121212121212121212";
const owner = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const spender = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const receiver = "0xcccccccccccccccccccccccccccccccccccccccc";
const from = "0xdddddddddddddddddddddddddddddddddddddddd";
const operator = "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";

function validateApproveLimited() {
  const data = call(SELECTOR_APPROVE, [addressWord(spender), uintWord(123n)]);

  const decoded = shared.decodeTx(data, token);
  assertEqual(decoded.kind, "APPROVE_ERC20", "shared approve kind");
  assertEqual(decoded.spender, spender, "shared approve spender");
  assertEqual(decoded.amountRaw, "123", "shared approve amountRaw");

  const approve = shared.decodeErc20Approve(data);
  assertEqual(approve.spender, spender, "shared approve helper spender");
  assertEqual(approve.value.toString(), "123", "shared approve helper value");

  const human = humanize.decodeEvmTx({ to: token, data });
  assertEqual(human.kind, "ERC20_APPROVE", "human approve kind");
  assertEqual(human.spender, spender, "human approve spender");
  assertEqual(human.amountRaw, "123", "human approve amountRaw");

  const tx = txDecoder.decodeTxData(token, data);
  assertEqual(tx.kind, "approve", "txDecoder approve kind");
  assertEqual(tx.spender, spender, "txDecoder approve spender");
  assertEqual(tx.amountRaw, "123", "txDecoder approve amountRaw");
}

function validateApproveUnlimited() {
  const data = call(SELECTOR_APPROVE, [addressWord(spender), uintWord(MAX_UINT256)]);

  const decoded = shared.decodeTx(data, token);
  assertEqual(decoded.amountType, "UNLIMITED", "shared approve max amountType");

  const approve = shared.decodeErc20Approve(data);
  assertTrue(approve.isMax, "shared approve helper max");

  const human = humanize.decodeEvmTx({ to: token, data });
  assertTrue(human.isUnlimited, "human approve max");

  const tx = txDecoder.decodeTxData(token, data);
  assertTrue(tx.unlimitedApproval, "txDecoder approve max");
}

function validateAllowanceAdjustments() {
  const increase = call(SELECTOR_INCREASE_ALLOWANCE, [addressWord(spender), uintWord(234n)]);
  const increaseDecoded = shared.decodeTx(increase, token);
  assertEqual(increaseDecoded.kind, "INCREASE_ALLOWANCE", "shared increaseAllowance kind");
  assertEqual(increaseDecoded.spender, spender, "shared increaseAllowance spender");
  assertEqual(increaseDecoded.amountRaw, "234", "shared increaseAllowance amountRaw");

  const decrease = call(SELECTOR_DECREASE_ALLOWANCE, [addressWord(spender), uintWord(45n)]);
  const decreaseDecoded = shared.decodeTx(decrease, token);
  assertEqual(decreaseDecoded.kind, "DECREASE_ALLOWANCE", "shared decreaseAllowance kind");
  assertEqual(decreaseDecoded.spender, spender, "shared decreaseAllowance spender");
  assertEqual(decreaseDecoded.amountRaw, "45", "shared decreaseAllowance amountRaw");
}

function validateTransfer() {
  const data = call(SELECTOR_TRANSFER, [addressWord(receiver), uintWord(456n)]);

  const decoded = shared.decodeTx(data, token);
  assertEqual(decoded.kind, "TRANSFER_ERC20", "shared transfer kind");
  assertEqual(decoded.to, receiver, "shared transfer to");
  assertEqual(decoded.amountRaw, "456", "shared transfer amountRaw");

  const human = humanize.decodeEvmTx({ to: token, data });
  assertEqual(human.kind, "ERC20_TRANSFER", "human transfer kind");
  assertEqual(human.toAddress, receiver, "human transfer to");
  assertEqual(human.amountRaw, "456", "human transfer amountRaw");

  const tx = txDecoder.decodeTxData(token, data);
  assertEqual(tx.kind, "transfer", "txDecoder transfer kind");
  assertEqual(tx.to, receiver, "txDecoder transfer to");
  assertEqual(tx.amountRaw, "456", "txDecoder transfer amountRaw");
}

function validateTransferFrom() {
  const data = call(SELECTOR_TRANSFER_FROM, [addressWord(from), addressWord(receiver), uintWord(789n)]);

  const decoded = shared.decodeTx(data, token);
  assertEqual(decoded.kind, "TRANSFERFROM_ERC20", "shared transferFrom kind");
  assertEqual(decoded.from, from, "shared transferFrom from");
  assertEqual(decoded.to, receiver, "shared transferFrom to");
  assertEqual(decoded.amountRaw, "789", "shared transferFrom amountRaw");

  const human = humanize.decodeEvmTx({ to: token, data });
  assertEqual(human.kind, "ERC20_TRANSFER_FROM", "human transferFrom kind");
  assertEqual(human.fromAddress, from, "human transferFrom from");
  assertEqual(human.toAddress, receiver, "human transferFrom to");
  assertEqual(human.amountRaw, "789", "human transferFrom amountRaw");

  const tx = txDecoder.decodeTxData(token, data);
  assertEqual(tx.kind, "transferFrom", "txDecoder transferFrom kind");
  assertEqual(tx.from, from, "txDecoder transferFrom from");
  assertEqual(tx.to, receiver, "txDecoder transferFrom to");
  assertEqual(tx.amountRaw, "789", "txDecoder transferFrom amountRaw");
}

function validateSetApprovalForAll() {
  const data = call(SELECTOR_SET_APPROVAL_FOR_ALL, [addressWord(operator), boolWord(true)]);

  const decoded = shared.decodeTx(data, nft);
  assertEqual(decoded.kind, "SET_APPROVAL_FOR_ALL", "shared setApprovalForAll kind");
  assertEqual(decoded.operator, operator, "shared setApprovalForAll operator");
  assertTrue(decoded.approved, "shared setApprovalForAll approved");

  const approval = shared.decodeSetApprovalForAll(data);
  assertEqual(approval.operator, operator, "shared setApprovalForAll helper operator");
  assertTrue(approval.approved, "shared setApprovalForAll helper approved");

  const human = humanize.decodeEvmTx({ to: nft, data });
  assertEqual(human.kind, "NFT_APPROVAL_ALL", "human setApprovalForAll kind");
  assertEqual(human.spender, operator, "human setApprovalForAll operator");
  assertTrue(human.isUnlimited, "human setApprovalForAll approved");

  const tx = txDecoder.decodeTxData(nft, data);
  assertEqual(tx.kind, "setApprovalForAll", "txDecoder setApprovalForAll kind");
  assertEqual(tx.operator, operator, "txDecoder setApprovalForAll operator");
  assertTrue(tx.approved, "txDecoder setApprovalForAll approved");
}

function validateErc721SafeTransferFrom() {
  const tokenId = 987654321n;
  const data = call(SELECTOR_SAFE_TRANSFER_FROM, [addressWord(from), addressWord(receiver), uintWord(tokenId)]);

  const decoded = shared.decodeTx(data, nft);
  assertEqual(decoded.kind, "TRANSFER_NFT", "shared ERC721 safeTransferFrom kind");
  assertEqual(decoded.from, from, "shared ERC721 safeTransferFrom from");
  assertEqual(decoded.to, receiver, "shared ERC721 safeTransferFrom to");
  assertEqual(decoded.tokenIdRaw, tokenId.toString(), "shared ERC721 safeTransferFrom tokenId");

  const human = humanize.decodeEvmTx({ to: nft, data });
  assertEqual(human.kind, "ERC721_TRANSFER", "human ERC721 safeTransferFrom kind");
  assertEqual(human.fromAddress, from, "human ERC721 safeTransferFrom from");
  assertEqual(human.toAddress, receiver, "human ERC721 safeTransferFrom to");
  assertEqual(human.tokenIdRaw, tokenId.toString(), "human ERC721 safeTransferFrom tokenId");
}

function validatePermitEip2612() {
  const value = 321n;
  const deadline = 9999999999n;
  const data = call(SELECTOR_PERMIT, [
    addressWord(owner),
    addressWord(spender),
    uintWord(value),
    uintWord(deadline),
    uintWord(27n),
    uintWord(0n),
    uintWord(0n),
  ]);

  const decoded = shared.decodeTx(data, token);
  assertEqual(decoded.kind, "PERMIT_EIP2612", "shared permit kind");
  assertEqual(decoded.spender, spender, "shared permit spender");
  assertEqual(decoded.valueRaw, value.toString(), "shared permit valueRaw");
  assertEqual(decoded.deadlineRaw, deadline.toString(), "shared permit deadlineRaw");
}

function validatePermit2Allowance() {
  const amount = 654n;
  const sigDeadline = 1111111111n;
  const data = call(SELECTOR_PERMIT2_ALLOWANCE, [
    addressWord(owner),
    addressWord(token),
    uintWord(amount),
    uintWord(2222222222n),
    uintWord(333n),
    addressWord(spender),
    uintWord(sigDeadline),
    uintWord(256n),
    uintWord(65n),
    uintWord(0n),
    uintWord(0n),
    uintWord(0n),
  ]);

  const decoded = shared.decodeTx(data, PERMIT2_ADDRESS);
  assertEqual(decoded.kind, "PERMIT2_ALLOWANCE", "shared Permit2 allowance kind");
  assertEqual(decoded.token, token, "shared Permit2 allowance token");
  assertEqual(decoded.spender, spender, "shared Permit2 allowance spender");
  assertEqual(decoded.amountRaw, amount.toString(), "shared Permit2 allowance amountRaw");
  assertEqual(decoded.deadlineRaw, sigDeadline.toString(), "shared Permit2 allowance deadlineRaw");
}

function validatePermit2Transfer() {
  const amount = 765n;
  const data = call(SELECTOR_PERMIT2_SIGNATURE_TRANSFER, [
    addressWord(token),
    uintWord(amount),
    uintWord(444n),
    uintWord(5555555555n),
    addressWord(receiver),
    uintWord(700n),
    addressWord(owner),
    uintWord(256n),
    uintWord(65n),
    uintWord(0n),
    uintWord(0n),
    uintWord(0n),
  ]);

  const decoded = shared.decodeTx(data, PERMIT2_ADDRESS);
  assertEqual(decoded.kind, "PERMIT2_TRANSFER", "shared Permit2 transfer kind");
  assertEqual(decoded.token, token, "shared Permit2 transfer token");
  assertEqual(decoded.to, receiver, "shared Permit2 transfer to");
  assertEqual(decoded.amountRaw, amount.toString(), "shared Permit2 transfer amountRaw");
}

validateApproveLimited();
validateApproveUnlimited();
validateAllowanceAdjustments();
validateTransfer();
validateTransferFrom();
validateSetApprovalForAll();
validateErc721SafeTransferFrom();
validatePermitEip2612();
validatePermit2Allowance();
validatePermit2Transfer();

console.log("decoder validation passed");
