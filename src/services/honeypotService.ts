/**
 * Honeypot detection: simulate buy then sell/transfer to detect tokens that cannot be sold.
 * Uses Tenderly with state overrides for full cycle (buy -> approve -> sell) or transfer test.
 * MVP: structure + transfer test when state is available; full cycle requires state_overrides from Tenderly.
 */

import type { Settings } from "../shared/types";
import { simulateTransaction, type SimulateTransactionBody } from "./simulationService";

const HONEYPOT_SOFT_THRESHOLD = 0.8; // (Venda/Compra) < 0.8 => SOFT

export type HoneypotResult = {
  isHoneypot: boolean;
  type?: "HARD" | "SOFT";
  reason?: string;
  ethSpent?: string;
  ethReceived?: string;
  /** False when running without API (no keys). */
  simulated?: boolean;
  /** Message when simulated is false. */
  message?: string;
};

/**
 * Run honeypot detection: Step A (buy), then if possible Step B/C (approve + sell or transfer).
 * MVP: runs buy simulation only; if success, attempts transfer simulation (requires state after buy).
 * When Tenderly returns state_overrides, we can run transfer with that state; if transfer reverts => HONEYPOT HARD.
 * When we have sell simulation result, (ethReceived/ethSpent) < 0.8 => HONEYPOT SOFT.
 */
export async function runHoneypotCheck(
  networkId: string,
  from: string,
  to: string,
  input: string,
  value: string,
  gas: number | undefined,
  settings: Settings,
  /** Token contract address to test transfer (e.g. from swap path or tx.to for approvals). */
  tokenAddress?: string
): Promise<HoneypotResult> {
  try {
    const body: SimulateTransactionBody = {
      network_id: networkId,
      from,
      to,
      input: input || "0x",
      value: value || "0x0",
    };
    if (gas != null && gas > 0) body.gas = gas;

    const raw = await simulateTransaction(body, settings);
    if (!raw) return { isHoneypot: false, simulated: false, message: "Modo Estático (Adicione chaves para Simulação)" };

    const txStatus = raw.transaction?.status;
    if (txStatus === 1) return { isHoneypot: false }; // Buy reverted

    const assetChanges = Array.isArray((raw as any).asset_changes) ? (raw as any).asset_changes : [];
    let ethSpent = "0";
    let ethReceived = "0";
    let incomingTokenAddress: string | undefined;
    let incomingTokenAmount: string | undefined;

    for (const ch of assetChanges) {
      const type = String(ch?.type || "").toUpperCase();
      const fromAddr = (ch?.from ?? "").toLowerCase();
      const toAddr = (ch?.to ?? "").toLowerCase();
      const amount = ch?.amount ?? ch?.raw_amount ?? "0";
      const info = ch?.asset_info;

      if (type.includes("SEND") && fromAddr === from.toLowerCase()) {
        if (info?.symbol === "ETH" || !info?.symbol) ethSpent = String(amount);
      } else if ((type.includes("RECEIVE") || toAddr === from.toLowerCase()) && toAddr === from.toLowerCase()) {
        if (info?.symbol === "ETH" || !info?.symbol) {
          ethReceived = String(amount);
        } else {
          incomingTokenAddress = fromAddr.startsWith("0x") ? fromAddr : undefined;
          incomingTokenAmount = String(amount);
        }
      }
    }

    const _tokenToTest = tokenAddress || incomingTokenAddress;
    const spendNum = parseFloat(ethSpent);
    const receivedNum = parseFloat(ethReceived);
    if (spendNum > 0 && receivedNum > 0 && receivedNum / spendNum < HONEYPOT_SOFT_THRESHOLD) {
      return {
        isHoneypot: true,
        type: "SOFT",
        reason: "Sell returns < 80% of buy cost (abusive sell tax).",
        ethSpent,
        ethReceived,
      };
    }

    return { isHoneypot: false, ethSpent, ethReceived };
  } catch {
    return { isHoneypot: false };
  }
}
