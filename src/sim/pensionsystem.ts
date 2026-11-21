// Contas da aposentadoria: previdência pública (os trabalhadores contribuem, a prefeitura cobre o
// déficit) e previdência privada (poupança de cada um, com subsídio opcional da prefeitura).

import { START_LIFE } from "./config";
import { ageYears, retireAgeOf } from "./people";
import type { CityState } from "./types";

/** Salário de referência por ciclo: base da contribuição pública. */
export const WAGE = 10;
/** Benefício público por aposentado e por ciclo, pelo nível (básico, médio, generoso). */
export const BENEFIT: Record<1 | 2 | 3, number> = { 1: 2, 2: 4, 3: 6 };
/** Aporte privado por trabalhador inscrito, por ciclo. */
export const PRIVATE_CONTRIBUTION = 0.6;
/** Rendimento da poupança privada por ciclo. */
export const PRIVATE_RETURN = 0.015;
/** Chance de um trabalhador aderir à previdência privada oferecida, por ciclo. */
export const ENROLL_CHANCE = 0.08;

export interface PensionReport {
  retirees: number;
  /** Arrecadado dos trabalhadores (público). */
  contributions: number;
  /** Pago aos aposentados (público). */
  publicPaid: number;
  /** Pago pela poupança privada. */
  privatePaid: number;
  /** Déficit coberto pelo caixa da prefeitura. */
  deficit: number;
  /** Subsídio da prefeitura ao aporte privado. */
  subsidy: number;
  /** Custo para o caixa neste ciclo (déficit + subsídio, em dinheiro inteiro). */
  cost: number;
  /** Aposentados sem nenhuma renda de aposentadoria. */
  withoutIncome: number;
  /** Trabalhadores inscritos na previdência privada. */
  enrolled: number;
  fund: number;
}

export const EMPTY_PENSION_REPORT: PensionReport = {
  retirees: 0, contributions: 0, publicPaid: 0, privatePaid: 0, deficit: 0, subsidy: 0, cost: 0, withoutIncome: 0, enrolled: 0, fund: 0,
};

/** O aposentado tem renda de aposentadoria? (benefício público ligado ou poupança privada.) */
export function hasPensionIncome(s: Pick<CityState, "pension" | "people">, id: number): boolean {
  return !!s.pension?.publicOn || (s.people?.[id]?.savings ?? 0) > 0.5;
}

/**
 * Um ciclo de aposentadoria. Muta `s` (caixa, fundo e poupanças) e devolve o relatório.
 * `employed` = trabalhadores empregados (quem contribui).
 */
export function pensionStep(s: CityState, rand: () => number, employed: number): PensionReport {
  const out: PensionReport = { ...EMPTY_PENSION_REPORT };
  const p = s.pension;
  if (!p || !s.people) return out;
  const retire = retireAgeOf(s);
  const now = s.cyclesCompleted;
  const lifeExp = s.lifeExpectancy ?? START_LIFE;
  const ids = [...s.citizens].sort((a, b) => a - b);

  // ── Previdência privada: adesão, aportes, rendimento e pagamento ──
  for (const id of ids) {
    const l = s.people[id];
    if (!l) continue;
    const age = ageYears(l, now);
    if (age >= retire) continue;
    if (age < 18) continue;
    if (p.privateOn && l.savings === undefined && rand() < ENROLL_CHANCE) l.savings = 0;
    if (l.savings !== undefined && p.privateOn) {
      const match = (PRIVATE_CONTRIBUTION * p.privateSubsidy) / 100;
      l.savings += PRIVATE_CONTRIBUTION + match;
      out.subsidy += match;
      out.enrolled++;
    }
  }
  for (const id of ids) {
    const l = s.people[id];
    if (!l || l.savings === undefined) continue;
    l.savings *= 1 + PRIVATE_RETURN;
    const age = ageYears(l, now);
    if (age >= retire && l.savings > 0) {
      // Renda mensal: a poupança dividida pelos ciclos que faltam (no mínimo 8).
      const pay = Math.min(l.savings, l.savings / Math.max(8, (lifeExp - age) * 4));
      l.savings -= pay;
      out.privatePaid += pay;
    }
  }

  // ── Aposentados e previdência pública ──
  let retirees = 0;
  let without = 0;
  for (const id of ids) {
    const l = s.people[id];
    if (!l || ageYears(l, now) < retire) continue;
    retirees++;
    if (!hasPensionIncome(s, id)) without++;
  }
  out.retirees = retirees;
  out.withoutIncome = without;
  if (p.publicOn) {
    out.contributions = employed * WAGE * (p.publicRate / 100);
    out.publicPaid = retirees * BENEFIT[p.publicLevel];
    p.fund += out.contributions - out.publicPaid;
    if (p.fund < 0) {
      out.deficit = -p.fund;
      p.fund = 0;
    }
  }
  out.fund = p.fund;

  out.cost = Math.max(0, Math.ceil(out.deficit + out.subsidy - 1e-9)) || 0;
  s.money -= out.cost;
  return out;
}
