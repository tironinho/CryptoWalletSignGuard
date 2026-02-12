export type FeeEstimate = {
  ok: boolean;
  gasLimit?: bigint;
  maxFeePerGas?: bigint;        // wei
  maxPriorityFeePerGas?: bigint;// wei
  gasPrice?: bigint;            // wei (legacy)
  feeMaxWei?: bigint;           // wei
  feeLikelyWei?: bigint;        // wei (baseFee + priority) * gas
  reason?: string;
};

const RPC_TIMEOUT_MS = 2500;

/** Call RPC once; returns null on any error or timeout. Never throws, no console.error. */
async function tryRpc<T>(providerRequest: (a: any) => Promise<any>, method: string, params: any[], timeoutMs = RPC_TIMEOUT_MS): Promise<T | null> {
  let t: ReturnType<typeof setTimeout>;
  const timeout = new Promise<null>((res) => { t = setTimeout(() => res(null), timeoutMs); });
  try {
    const r = await Promise.race([providerRequest({ method, params }).then((x) => x as T), timeout]);
    clearTimeout(t!);
    return r;
  } catch {
    clearTimeout(t!);
    return null;
  }
}

export async function estimateFee(providerRequest: (args: any) => Promise<any>, tx: any): Promise<FeeEstimate> {
  try {
    // 1) gasLimit (estimateGas) - fallback for simple transfers
    let gasLimit: bigint;
    const gasHex = await tryRpc<string>(providerRequest, "eth_estimateGas", [tx]);
    if (gasHex != null && typeof gasHex === "string") {
      try { gasLimit = BigInt(gasHex); } catch { gasLimit = 150000n; }
    } else {
      const hasData = tx?.data && String(tx.data) !== "0x" && String(tx.data).toLowerCase() !== "0x";
      const valueWei = BigInt(tx?.value || "0x0");
      gasLimit = hasData ? 150000n : valueWei > 0n ? 21000n : 150000n;
    }

    // 2) Prefer dapp-provided EIP-1559 fields if present
    const maxFeePerGas = tx?.maxFeePerGas ? BigInt(tx.maxFeePerGas) : undefined;
    const maxPriorityFeePerGas = tx?.maxPriorityFeePerGas ? BigInt(tx.maxPriorityFeePerGas) : undefined;
    const gasPrice = tx?.gasPrice ? BigInt(tx.gasPrice) : undefined;

    // 3) If no fees provided, compute from feeHistory + priority (or gasPrice fallback)
    let computedMaxFee: bigint | undefined = maxFeePerGas;
    let computedPriority: bigint | undefined = maxPriorityFeePerGas;

    if (!computedMaxFee && !gasPrice) {
      const prioHex = await tryRpc<string>(providerRequest, "eth_maxPriorityFeePerGas", []);
      computedPriority = prioHex != null && prioHex !== "" ? BigInt(prioHex) : 1_000_000_000n;

      let baseFee: bigint | undefined;
      const fh = await tryRpc<{ baseFeePerGas?: string[] }>(providerRequest, "eth_feeHistory", ["0x1", "latest", []]);
      const arr = fh?.baseFeePerGas;
      if (Array.isArray(arr) && arr.length > 0) {
        try { baseFee = BigInt(arr[arr.length - 1]); } catch { baseFee = undefined; }
      } else {
        baseFee = undefined;
      }

      if (baseFee != null) {
        computedMaxFee = baseFee * 2n + (computedPriority ?? 0n);
      } else {
        const gpHex = await tryRpc<string>(providerRequest, "eth_gasPrice", []);
        if (gpHex != null && gpHex !== "") return finalizeLegacy(gasLimit, BigInt(gpHex));
        return { ok: false, reason: "fee_unknown_wallet_will_estimate" };
      }
    }

    if (gasPrice) return finalizeLegacy(gasLimit, gasPrice);

    if (!computedMaxFee) {
      return { ok: false, reason: "fee_unknown_wallet_will_estimate" };
    }

    const maxP = computedMaxFee;
    const prio = computedPriority ?? 0n;
    const likelyPerGas = (maxP + prio) / 2n;

    const feeMaxWei = gasLimit * maxP;
    const feeLikelyWei = gasLimit * likelyPerGas;

    return {
      ok: true,
      gasLimit,
      maxFeePerGas: maxP,
      maxPriorityFeePerGas: prio,
      feeMaxWei,
      feeLikelyWei
    };
  } catch {
    return { ok: false, reason: "fee_unknown_wallet_will_estimate" };
  }
}

function finalizeLegacy(gasLimit: bigint, gasPrice: bigint): FeeEstimate {
  const feeMaxWei = gasLimit * gasPrice;
  return { ok: true, gasLimit, gasPrice, feeMaxWei, feeLikelyWei: feeMaxWei };
}
