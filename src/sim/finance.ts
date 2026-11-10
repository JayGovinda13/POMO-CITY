// Fase 4 — Orçamento e finanças: impostos por zona, verba por departamento, títulos com rating
// de crédito e decretos municipais. Tudo puro e determinístico (vale no cliente e no servidor).

import { BUILDINGS } from "./catalog";
import { ZONE, type CityState, type ZoneKind } from "./types";

// ───────────────────────── impostos ─────────────────────────

/** Alíquota padrão (%): com ela a arrecadação é a mesma de antes da Fase 4. */
export const DEFAULT_TAX = 9;
export const MAX_TAX = 20;
/** Arrecadação por unidade na alíquota padrão: por morador (R) e por emprego ocupado (C, I). */
export const TAX_BASE: Record<ZoneKind, number> = { R: 3, C: 1, I: 1 };
/** Efeito de cada ponto percentual acima/abaixo do padrão na demanda daquela zona. */
export const TAX_DEMAND_PER_POINT = 0.04;

export const taxRevenue = (kind: ZoneKind, units: number, rate: number) => (units * TAX_BASE[kind] * rate) / DEFAULT_TAX;

// ───────────────────────── departamentos ─────────────────────────

export type Department = "transport" | "energy" | "police" | "fire" | "health" | "education";
export const DEPARTMENTS: Department[] = ["transport", "energy", "police", "fire", "health", "education"];
export const DEPARTMENT_NAMES: Record<Department, string> = {
  transport: "Transportes (vias e transporte público)",
  energy: "Energia (usinas)",
  police: "Polícia (delegacias, prisão)",
  fire: "Bombeiros",
  health: "Saúde (hospitais)",
  education: "Educação (escolas, bibliotecas)",
};

export function departmentOf(type: keyof typeof BUILDINGS): Department | null {
  if (type === "road" || type === "highway" || type === "onramp" || type === "rail" || type === "bus_stop" || type === "train_station") return "transport";
  if (BUILDINGS[type].generates && type !== "cityhall") return "energy";
  const kind = BUILDINGS[type].service?.kind;
  if (kind === "police" || kind === "prison") return "police";
  if (kind === "fire") return "fire";
  if (kind === "hospital") return "health";
  if (kind === "school" || kind === "college" || kind === "library" || kind === "museum") return "education";
  return null;
}

/** Estrada abaixo desta condição está danificada: não conecta nada. */
export const ROAD_BROKEN = 30;
/** Recuperação por ciclo com verba integral e desgaste por ponto de verba que falta. */
export const ROAD_REPAIR = 20;
export const ROAD_WEAR_PER_POINT = 0.3;

/** Usinas com verba reduzida geram menos: 50% de geração com verba zero. */
export const energyFundingFactor = (funding: number) => 0.5 + 0.5 * (funding / 100);

// ───────────────────────── títulos e rating ─────────────────────────

export const BOND_VALUE = 1000;
export const PRIME_RATE = 0.04;

export type CreditRating = "AAA" | "AA" | "A" | "BBB" | "BB" | "B" | "C";
const RATINGS: { max: number; rating: CreditRating; spread: number; maxBonds: number }[] = [
  { max: 0.05, rating: "AAA", spread: 0, maxBonds: 10 },
  { max: 0.15, rating: "AA", spread: 0.01, maxBonds: 8 },
  { max: 0.25, rating: "A", spread: 0.02, maxBonds: 6 },
  { max: 0.4, rating: "BBB", spread: 0.03, maxBonds: 4 },
  { max: 0.6, rating: "BB", spread: 0.05, maxBonds: 2 },
  { max: 0.8, rating: "B", spread: 0.07, maxBonds: 1 },
  { max: Infinity, rating: "C", spread: 0.1, maxBonds: 0 },
];

export const debtOf = (s: CityState) => s.bonds.reduce((acc, b) => acc + b.principal, 0);

/** Valor da cidade: infraestrutura construída + prédios das zonas + caixa positivo. */
export function cityValue(s: CityState): number {
  let v = Math.max(0, s.money);
  for (const b of s.buildings) v += BUILDINGS[b.type].cost;
  for (let i = 0; i < s.zoneLevel.length; i++) if (s.zoneType[i] !== ZONE.NONE) v += s.zoneLevel[i] * 60;
  return Math.round(v);
}

export function creditRating(s: CityState) {
  const ratio = debtOf(s) / Math.max(1, cityValue(s));
  let k = RATINGS.findIndex((r) => ratio < r.max);
  if (s.money < 0) k = Math.min(RATINGS.length - 1, k + 1); // caixa negativo derruba uma nota
  const r = RATINGS[k];
  return { rating: r.rating, rate: PRIME_RATE + r.spread, maxBonds: r.maxBonds, ratio };
}

/** Juros anuais, cobrados no fim de cada ano (a cada 4 ciclos). */
export const annualInterest = (s: CityState) => Math.ceil(s.bonds.reduce((acc, b) => acc + b.principal * b.rate, 0));

// ───────────────────────── decretos ─────────────────────────

export type OrdinanceId =
  | "imposto_vendas"
  | "imposto_renda"
  | "jogos"
  | "conservacao_energia"
  | "embelezamento"
  | "festival"
  | "premio_produtividade";

export interface OrdinanceDef {
  name: string;
  category: "Finanças" | "Energia" | "Comunidade" | "Foco";
  description: string;
  /** Receita (+) ou custo (−) por ciclo, em função do estado. */
  money: (s: CityState) => number;
  /** Ajustes na demanda R/C/I enquanto ativo. */
  demand?: Partial<Record<ZoneKind, number>>;
  /** Ajuste no humor dos moradores (motivo exibido na ficha). */
  mood?: { delta: number; text: string };
}

const pop = (s: CityState) => s.population;

export const ORDINANCES: Record<OrdinanceId, OrdinanceDef> = {
  imposto_vendas: {
    name: "Imposto sobre vendas (1%)",
    category: "Finanças",
    description: "Receita extra do comércio, mas inibe o crescimento comercial.",
    money: (s) => Math.ceil(s.population * 0.15),
    demand: { C: -0.15 },
  },
  imposto_renda: {
    name: "Imposto de renda (1%)",
    category: "Finanças",
    description: "Receita extra dos moradores, mas desestimula novos moradores.",
    money: (s) => Math.ceil(pop(s) * 0.3),
    demand: { R: -0.15 },
  },
  jogos: {
    name: "Jogos legalizados",
    category: "Finanças",
    description: "Boa receita, mas parte dos moradores reprova.",
    money: (s) => Math.ceil(pop(s) * 0.4),
    mood: { delta: -1, text: "Reprova a jogatina" },
  },
  conservacao_energia: {
    name: "Conservação de energia",
    category: "Energia",
    description: "Campanha educativa: em 4 ciclos, as usinas passam a atender 15% a mais.",
    money: (s) => -Math.ceil(pop(s) * 0.1),
  },
  embelezamento: {
    name: "Embelezamento urbano",
    category: "Comunidade",
    description: "Praças e jardins: moradores mais felizes e mais gente querendo morar aqui.",
    money: (s) => -(2 + Math.ceil(pop(s) * 0.2)),
    demand: { R: 0.1 },
    mood: { delta: 1, text: "Cidade bonita" },
  },
  festival: {
    name: "Festival anual",
    category: "Comunidade",
    description: "Atrai visitantes para o comércio e anima os moradores.",
    money: (s) => -Math.ceil(pop(s) * 0.15),
    demand: { C: 0.1 },
    mood: { delta: 1, text: "Festival da cidade" },
  },
  premio_produtividade: {
    name: "Prêmio de produtividade",
    category: "Foco",
    description: "Em ciclos de Rank A ou S, a extração rende 15% a mais (os trabalhadores ganham bônus).",
    money: (s) => -Math.ceil(pop(s) * 0.2),
  },
};

export const ORDINANCE_IDS = Object.keys(ORDINANCES) as OrdinanceId[];
export const isActive = (s: CityState, id: OrdinanceId) => s.ordinances[id] !== undefined;

/** Fator de capacidade da conservação de energia (rampa de 4 ciclos até +15%). */
export function conservationFactor(s: CityState): number {
  const since = s.ordinances.conservacao_energia;
  if (since === undefined) return 1;
  return 1 + 0.15 * Math.min(1, (s.cyclesCompleted - since) / 4);
}

/** Soma dos ajustes de demanda: impostos, decretos e dificuldade. */
export function demandModifiers(s: CityState): Record<ZoneKind, number> {
  const out: Record<ZoneKind, number> = { R: 0, C: 0, I: 0 };
  for (const k of ["R", "C", "I"] as ZoneKind[]) out[k] -= (s.taxes[k] - DEFAULT_TAX) * TAX_DEMAND_PER_POINT;
  for (const id of ORDINANCE_IDS) {
    if (!isActive(s, id)) continue;
    for (const [k, v] of Object.entries(ORDINANCES[id].demand ?? {})) out[k as ZoneKind] += v;
  }
  out.I += DIFFICULTY[s.difficulty].industryDemand;
  return out;
}

// ───────────────────────── dificuldade ─────────────────────────

export type Difficulty = "facil" | "medio" | "dificil";
export const DIFFICULTY: Record<Difficulty, { name: string; money: number; bonds: number; industryDemand: number; description: string }> = {
  facil: { name: "Fácil", money: 2000, bonds: 0, industryDemand: 0.15, description: "$2.000 e economia aquecida (mais demanda pela indústria)." },
  medio: { name: "Médio", money: 1000, bonds: 0, industryDemand: 0, description: "$1.000 e economia estável." },
  dificil: { name: "Difícil", money: 0, bonds: 1, industryDemand: -0.15, description: "$1.000 vindos de um título a pagar, e economia em recessão." },
};
