import * as esbuild from "esbuild";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(fileURLToPath(new URL("..", import.meta.url)));

async function loadSharedDecoder() {
  const result = await esbuild.build({
    absWorkingDir: rootDir,
    entryPoints: ["src/shared/decode.ts"],
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

function assertSupported(decoded, expectedKind, label) {
  if (!decoded || decoded.kind === "UNKNOWN") {
    console.log(`skipped ${label}: selector not supported`);
    return false;
  }
  assertEqual(decoded.kind, expectedKind, `${label} kind`);
  return true;
}

const shared = await loadSharedDecoder();

const SELECTOR_APPROVE = "0x095ea7b3";
const SELECTOR_TRANSFER = "0xa9059cbb";
const SELECTOR_SET_APPROVAL_FOR_ALL = "0xa22cb465";
const SELECTOR_SAFE_TRANSFER_FROM = "0x42842e0e";
const SELECTOR_PERMIT = "0xd505accf";
const SELECTOR_PERMIT2_ALLOWANCE = "0x2b67b570";
const SELECTOR_PERMIT2_SIGNATURE_TRANSFER = "0x0d58b1db";

const MAX_UINT256 = (1n << 256n) - 1n;
const PERMIT2_ADDRESS = "0x000000000022d473030f116ddee9f6b43ac78ba3";

const token = "0x1111111111111111111111111111111111111111";
const nft = "0x2222222222222222222222222222222222222222";
const owner = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const spender = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const receiver = "0xcccccccccccccccccccccccccccccccccccccccc";
const from = "0xdddddddddddddddddddddddddddddddddddddddd";
const operator = "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";

function validateApproveLimited() {
  const data = call(SELECTOR_APPROVE, [addressWord(spender), uintWord(123n)]);
  const decoded = shared.decodeTx(data, token);

  assertEqual(decoded.kind, "APPROVE_ERC20", "approve limited kind");
  assertEqual(decoded.spender, spender, "approve limited spender");
  assertEqual(decoded.amountRaw, "123", "approve limited amountRaw");
}

function validateApproveUnlimited() {
  const data = call(SELECTOR_APPROVE, [addressWord(spender), uintWord(MAX_UINT256)]);
  const decoded = shared.decodeTx(data, token);

  assertEqual(decoded.kind, "APPROVE_ERC20", "approve unlimited kind");
  assertEqual(decoded.spender, spender, "approve unlimited spender");
  assertEqual(decoded.amountType, "UNLIMITED", "approve unlimited amountType");
}

function validateTransfer() {
  const data = call(SELECTOR_TRANSFER, [addressWord(receiver), uintWord(456n)]);
  const decoded = shared.decodeTx(data, token);

  assertEqual(decoded.kind, "TRANSFER_ERC20", "transfer kind");
  assertEqual(decoded.to, receiver, "transfer to");
  assertEqual(decoded.amountRaw, "456", "transfer amountRaw");
}

function validateSetApprovalForAll() {
  const data = call(SELECTOR_SET_APPROVAL_FOR_ALL, [addressWord(operator), boolWord(true)]);
  const decoded = shared.decodeTx(data, nft);

  assertEqual(decoded.kind, "SET_APPROVAL_FOR_ALL", "setApprovalForAll kind");
  assertEqual(decoded.operator, operator, "setApprovalForAll operator");
  assertTrue(decoded.approved, "setApprovalForAll approved");
}

function validateErc721SafeTransferFrom() {
  const tokenId = 987654321n;
  const data = call(SELECTOR_SAFE_TRANSFER_FROM, [addressWord(from), addressWord(receiver), uintWord(tokenId)]);
  const decoded = shared.decodeTx(data, nft);

  assertEqual(decoded.kind, "TRANSFER_NFT", "ERC721 safeTransferFrom kind");
  assertEqual(decoded.from, from, "ERC721 safeTransferFrom from");
  assertEqual(decoded.to, receiver, "ERC721 safeTransferFrom to");
  assertEqual(decoded.tokenIdRaw, tokenId.toString(), "ERC721 safeTransferFrom tokenId");
}

function validatePermitEip2612IfSupported() {
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
  if (!assertSupported(decoded, "PERMIT_EIP2612", "EIP-2612 permit")) return;

  assertEqual(decoded.spender, spender, "EIP-2612 permit spender");
  assertEqual(decoded.valueRaw, value.toString(), "EIP-2612 permit valueRaw");
  assertEqual(decoded.deadlineRaw, deadline.toString(), "EIP-2612 permit deadlineRaw");
}

function validatePermit2AllowanceIfSupported() {
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
  if (!assertSupported(decoded, "PERMIT2_ALLOWANCE", "Permit2 allowance")) return;

  assertEqual(decoded.token, token, "Permit2 allowance token");
  assertEqual(decoded.spender, spender, "Permit2 allowance spender");
  assertEqual(decoded.amountRaw, amount.toString(), "Permit2 allowance amountRaw");
}

function validatePermit2TransferIfSupported() {
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
  if (!assertSupported(decoded, "PERMIT2_TRANSFER", "Permit2 transfer")) return;

  assertEqual(decoded.token, token, "Permit2 transfer token");
  assertEqual(decoded.to, receiver, "Permit2 transfer to");
  assertEqual(decoded.amountRaw, amount.toString(), "Permit2 transfer amountRaw");
}

validateApproveLimited();
validateApproveUnlimited();
validateTransfer();
validateSetApprovalForAll();
validateErc721SafeTransferFrom();
validatePermitEip2612IfSupported();
validatePermit2AllowanceIfSupported();
validatePermit2TransferIfSupported();

console.log("decoder validation passed");
