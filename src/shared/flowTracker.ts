export type FlowStep =
  | { kind: "SWITCH_CHAIN"; ts: number; chainId?: string }
  | { kind: "SEND_TX"; ts: number; tx?: any; valueWei?: bigint; valueEth?: string; gasEth?: string; totalEth?: string };

export type FlowState = {
  steps: FlowStep[];
  lastSwitchChainTs?: number;
};

const FLOW_TTL_MS = 60_000;

export function newFlowState(): FlowState {
  return { steps: [] };
}

export function ingestRpc(flow: FlowState, method: string, params: any): FlowState {
  const now = Date.now();
  // limpar steps velhos
  flow.steps = flow.steps.filter(s => now - s.ts < FLOW_TTL_MS);

  const m = String(method || "").toLowerCase().trim();

  if (m === "wallet_switchethereumchain") {
    const chainId = Array.isArray(params) ? params?.[0]?.chainId : undefined;
    flow.lastSwitchChainTs = now;
    flow.steps.push({ kind: "SWITCH_CHAIN", ts: now, chainId });
    return flow;
  }

  if (m === "eth_sendtransaction" || m === "wallet_sendtransaction") {
    const tx = Array.isArray(params) ? params[0] : undefined;
    flow.steps.push({ kind: "SEND_TX", ts: now, tx });
    return flow;
  }

  return flow;
}

export function hasRecentSwitch(flow: FlowState): boolean {
  return !!flow.lastSwitchChainTs && (Date.now() - flow.lastSwitchChainTs) < FLOW_TTL_MS;
}

