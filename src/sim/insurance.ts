// Fase 5 — Seguro da cidade. Opcional: prêmio por estação proporcional ao valor da cidade,
// carência de 4 ciclos concluídos, franquia, cobertura de 50% ou 90% e bônus/malus.

import { BUILDINGS } from "./catalog";
import { cityValue } from "./finance";
import type { CityState } from "./types";

export type InsurancePlan = "none" | "basico" | "completo";

export interface InsurancePolicy {
  plan: InsurancePlan;
  /** Ciclo (concluídos) em que a apólice atual foi contratada; a carência conta daqui. */
  since: number;
  /** Multiplicador do prêmio: cai com anos sem sinistro e sequências longas; sobe após sinistros. */
  bonusMalus: number;
  lastClaimCycle: number | null;
}

export const NO_INSURANCE: InsurancePolicy = { plan: "none", since: 0, bonusMalus: 1, lastClaimCycle: null };

export const PLANS: Record<Exclude<InsurancePlan, "none">, { name: string; coverage: number; deductible: number; rate: number; description: string }> = {
  basico: { name: "Básico", coverage: 0.5, deductible: 100, rate: 0.004, description: "Cobre 50% dos prejuízos, com franquia de $100." },
  completo: { name: "Completo", coverage: 0.9, deductible: 50, rate: 0.008, description: "Cobre 90% dos prejuízos, com franquia de $50." },
};

/** A cobertura só começa depois de N ciclos concluídos desde a contratação. */
export const INSURANCE_WAITING = 4;
export const BONUS_MIN = 0.6;
export const BONUS_MAX = 2;

/** Prêmio por estação (ciclo concluído). */
export function premium(s: CityState): number {
  const p = s.insurance;
  if (p.plan === "none") return 0;
  return Math.max(1, Math.ceil(cityValue(s) * PLANS[p.plan].rate * p.bonusMalus));
}

/** Ciclos de carência que ainda faltam (0 = coberto). */
export const waitingLeft = (s: CityState) =>
  s.insurance.plan === "none" ? INSURANCE_WAITING : Math.max(0, INSURANCE_WAITING - (s.cyclesCompleted - s.insurance.since));

export const isCovered = (s: CityState) => s.insurance.plan !== "none" && waitingLeft(s) === 0;

/** Custo de reparo de uma construção danificada. */
export const repairCost = (type: keyof typeof BUILDINGS) => Math.max(10, Math.ceil(BUILDINGS[type].cost * 0.3));

/** Indenização para um prejuízo (já descontada a franquia). Não muta o estado. */
export function payoutFor(s: CityState, damage: number): number {
  if (!isCovered(s) || s.insurance.plan === "none") return 0;
  const plan = PLANS[s.insurance.plan];
  return Math.max(0, Math.floor((damage - plan.deductible) * plan.coverage));
}
