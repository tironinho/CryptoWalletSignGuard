/**
 * Transaction Report Card — grades simulation + context into a single score/letter for UI.
 */

import type { SimulationOutcome } from "../services/simulationService";

export type Grade = {
  score: number; // 0–100
  letter: "S" | "A" | "B" | "C" | "D" | "F";
  color: string; // Tailwind class, e.g. 'text-cyan-500', 'text-rose-600'
  reasons: string[]; // e.g. ["Contrato novo (-20)", "Site verificado (+10)"]
};

/** Optional context for grading (e.g. from analysis/overlay). */
export interface GradingContext {
  /** Target contract is new / unknown. */
  isNewContract?: boolean;
  /** Site/domain is verified (trusted list / intel). */
  isVerifiedSite?: boolean;
  /** Simulation reverted. */
  simulationRevert?: boolean;
  /** High outgoing value / many assets. */
  highOutgoingCount?: number;
  /** Domain or address flagged as risky. */
  hasRiskFlags?: boolean;
}

const LETTER_THRESHOLDS: { letter: Grade["letter"]; min: number }[] = [
  { letter: "S", min: 90 },
  { letter: "A", min: 80 },
  { letter: "B", min: 70 },
  { letter: "C", min: 60 },
  { letter: "D", min: 50 },
  { letter: "F", min: 0 },
];

const LETTER_COLORS: Record<Grade["letter"], string> = {
  S: "text-cyan-500",
  A: "text-cyan-500",
  B: "text-cyan-400",
  C: "text-slate-400",
  D: "text-rose-500",
  F: "text-rose-600",
};

function scoreToLetter(score: number): { letter: Grade["letter"]; color: string } {
  const clamped = Math.max(0, Math.min(100, Math.round(score)));
  for (const { letter, min } of LETTER_THRESHOLDS) {
    if (clamped >= min) return { letter, color: LETTER_COLORS[letter] };
  }
  return { letter: "F", color: LETTER_COLORS.F };
}

/**
 * Grade a transaction from simulation outcome and optional context.
 * Returns a Grade suitable for the Transaction Report Card UI.
 */
export function gradeTransaction(
  outcome: SimulationOutcome | null,
  context?: GradingContext
): Grade {
  const reasons: string[] = [];
  let score = 50; // base

  if (!outcome) {
    reasons.push("Simulação indisponível (0)");
    const { letter, color } = scoreToLetter(score);
    return { score, letter, color, reasons };
  }

  switch (outcome.status) {
    case "REVERT":
      score = 0;
      reasons.push("Transação reverte na simulação (-50)");
      break;
    case "RISK":
      score = Math.min(score, 35);
      reasons.push("Simulação em estado de risco (-15)");
      break;
    case "SUCCESS":
      score = 60;
      reasons.push("Simulação sucesso (+10)");
      break;
    default:
      reasons.push("Estado de simulação desconhecido (0)");
  }

  if (context?.simulationRevert) {
    score = Math.min(score, 15);
    if (!reasons.some((r) => r.includes("reverte"))) {
      reasons.push("Transação vai falhar (-50)");
    }
  }

  if (context?.isNewContract) {
    score -= 20;
    reasons.push("Contrato novo (-20)");
  }

  if (context?.isVerifiedSite) {
    score += 10;
    reasons.push("Site verificado (+10)");
  }

  if (context?.hasRiskFlags) {
    score -= 25;
    reasons.push("Domínio ou endereço com risco (-25)");
  }

  if (context?.highOutgoingCount != null && context.highOutgoingCount > 3) {
    score -= 10;
    reasons.push("Muitos ativos a sair (-10)");
  }

  // Cap and derive letter/color
  score = Math.max(0, Math.min(100, Math.round(score)));
  const { letter, color } = scoreToLetter(score);

  return { score, letter, color, reasons };
}
