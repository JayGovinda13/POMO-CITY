// Leis municipais: a câmara de vereadores propõe, o prefeito aprova ou veta. Cada lei liga a uma
// mecânica que já existe (trabalho, impostos, poluição, saúde, segurança, aposentadoria…).

import type { TechMods } from "./tech";
import type { CityState } from "./types";

export type PartyId = "trabalho" | "empresas" | "verde" | "social" | "ordem";
export const PARTY_IDS: PartyId[] = ["trabalho", "empresas", "verde", "social", "ordem"];

export const PARTIES: Record<PartyId, { name: string; short: string; color: string; ideology: string }> = {
  trabalho: { name: "Partido do Trabalho", short: "PT", color: "#e05a4a", ideology: "Defende os trabalhadores: jornada, salário e fiscalização." },
  empresas: { name: "União Empresarial", short: "UE", color: "#4a8fd8", ideology: "Defende a indústria e o comércio: impostos baixos e produção." },
  verde: { name: "Partido Verde", short: "PV", color: "#4fbf6a", ideology: "Defende o ar limpo, as árvores e a energia limpa." },
  social: { name: "Aliança Social", short: "AS", color: "#d8a84a", ideology: "Defende saúde, educação e os aposentados." },
  ordem: { name: "Ordem e Progresso", short: "OP", color: "#8a8fa0", ideology: "Defende a segurança e as contas equilibradas." },
};

export interface Councillor {
  id: number;
  party: PartyId;
}

export interface Bill {
  id: number;
  law: LawId;
  party: PartyId;
  /** Vereador que propôs. */
  proposer: number;
  /** Ciclo da proposta. */
  cycle: number;
}

export interface CouncilState {
  members: Councillor[];
  /** Ciclo da última eleição. */
  electedAt: number;
  laws: LawId[];
  bills: Bill[];
  nextBillId: number;
  /** Prestígio de cada partido com o prefeito: +1 por lei aprovada, −1 por veto (−5..5). */
  standing: Record<PartyId, number>;
  /** Últimas decisões e eleições (mais recentes por último). */
  history: { cycle: number; text: string }[];
}

export const EMPTY_COUNCIL: CouncilState = {
  members: [],
  electedAt: 0,
  laws: [],
  bills: [],
  nextBillId: 1,
  standing: { trabalho: 0, empresas: 0, verde: 0, social: 0, ordem: 0 },
  history: [],
};

export const newCouncil = (): CouncilState => structuredClone(EMPTY_COUNCIL);


export type LawId =
  | "jornada_8h"
  | "salario_minimo"
  | "fiscalizacao"
  | "isencao_industria"
  | "jornada_flexivel"
  | "livre_comercio"
  | "taxa_carbono"
  | "energia_limpa"
  | "arborizacao"
  | "saude_universal"
  | "merenda_escolar"
  | "pensao_universal"
  | "toque_recolher"
  | "guarda_municipal"
  | "austeridade";

export interface LawDef {
  party: PartyId;
  name: string;
  description: string;
  /** Efeitos somados aos das tecnologias (frações). */
  mods?: Partial<TechMods>;
  /** Humor: dos trabalhadores empregados e de todos. */
  moodWorkers?: { text: string; delta: number };
  moodAll?: { text: string; delta: number };
  /** Jornada máxima (horas): aprovar leva todos os setores a, no máximo, esse valor. */
  hoursCap?: 8;
  /** Fiscais de fábrica em toda a cidade, sem precisar do prédio. */
  inspection?: boolean;
  /** Redução do imposto industrial (fração). */
  taxIndustry?: number;
  /** Desconto de frete (fração). */
  trade?: number;
  /** QE alvo a mais. */
  eq?: number;
  /** Todo aposentado tem renda de aposentadoria. */
  pensionAll?: boolean;
  /** Custo por ciclo para o caixa. */
  cost?: (s: Pick<CityState, "population" | "citizens" | "people" | "cyclesCompleted" | "pension">, retirees: number) => number;
}

const perPop = (k: number) => (s: { population: number }) => Math.ceil(s.population * k);

export const LAWS: Record<LawId, LawDef> = {
  jornada_8h: {
    party: "trabalho",
    name: "Jornada máxima de 8 horas",
    description: "Nenhum setor passa de 8 horas por dia (jornadas longas voltam a 8 h). Os trabalhadores ficam mais contentes, mas o ganho de produção de jornadas longas some.",
    hoursCap: 8,
    moodWorkers: { text: "Jornada limitada por lei", delta: 1 },
  },
  salario_minimo: {
    party: "trabalho",
    name: "Salário mínimo municipal",
    description: "Piso salarial: trabalhadores contentes (+1 de humor), mas as fábricas produzem 5% menos bens.",
    mods: { goods: -0.05 },
    moodWorkers: { text: "Salário mínimo", delta: 1 },
  },
  fiscalizacao: {
    party: "trabalho",
    name: "Fiscalização obrigatória do trabalho",
    description: "Fiscais em toda a cidade, sem precisar do prédio: humor e desgaste dos trabalhadores pela metade, e o ganho de jornada longa também.",
    inspection: true,
  },
  isencao_industria: {
    party: "empresas",
    name: "Isenção para a indústria",
    description: "Imposto industrial 25% menor e 8% mais bens, pensando em atrair fábricas.",
    taxIndustry: 0.25,
    mods: { goods: 0.08 },
  },
  jornada_flexivel: {
    party: "empresas",
    name: "Jornada flexível",
    description: "Empresas negociam horários: +4% de bens e de refino, mas os trabalhadores ficam mais cansados (−1 de humor).",
    mods: { goods: 0.04, refine: 0.04 },
    moodWorkers: { text: "Jornada flexível (banco de horas)", delta: -1 },
  },
  livre_comercio: {
    party: "empresas",
    name: "Zona de livre comércio",
    description: "O frete fica 6% mais barato nas importações e sobe o preço de venda.",
    trade: 0.06,
  },
  taxa_carbono: {
    party: "verde",
    name: "Taxa de carbono",
    description: "A indústria paga para poluir: 20% menos poluição e 4% menos bens.",
    mods: { pollution: -0.2, goods: -0.04 },
  },
  energia_limpa: {
    party: "verde",
    name: "Incentivo à energia limpa",
    description: "As usinas geram 6% a mais, com um pequeno custo por ciclo em subsídios.",
    mods: { power: 0.06 },
    cost: perPop(0.1),
  },
  arborizacao: {
    party: "verde",
    name: "Arborização urbana",
    description: "Ruas e praças cheias de árvores: todos ficam um pouco mais felizes (+1), ao custo de uma verba por ciclo.",
    moodAll: { text: "Cidade arborizada", delta: 1 },
    cost: perPop(0.15),
  },
  saude_universal: {
    party: "social",
    name: "Saúde universal",
    description: "Os hospitais atendem 25% mais gente, ao custo de uma verba por ciclo.",
    mods: { health: 0.25 },
    cost: perPop(0.2),
  },
  merenda_escolar: {
    party: "social",
    name: "Merenda escolar",
    description: "Alunos bem alimentados aprendem mais: QE alvo +5, ao custo de uma verba por ciclo.",
    eq: 5,
    cost: perPop(0.12),
  },
  pensao_universal: {
    party: "social",
    name: "Pensão universal",
    description: "Todo aposentado recebe uma renda mínima ($3 por ciclo), mesmo sem previdência. Evita a tristeza dos sem renda, mas custa por aposentado.",
    pensionAll: true,
    cost: (_s, retirees) => retirees * 3,
  },
  toque_recolher: {
    party: "ordem",
    name: "Toque de recolher",
    description: "20% menos crime, mas ninguém gosta de ser vigiado (−1 de humor para todos).",
    mods: { crime: -0.2 },
    moodAll: { text: "Toque de recolher", delta: -1 },
  },
  guarda_municipal: {
    party: "ordem",
    name: "Guarda municipal",
    description: "Patrulhas nas ruas: 15% menos crime, ao custo de uma verba por ciclo.",
    mods: { crime: -0.15 },
    cost: perPop(0.15),
  },
  austeridade: {
    party: "ordem",
    name: "Lei de austeridade",
    description: "Cortes em toda a máquina: manutenção 10% mais barata, mas os hospitais atendem 10% menos.",
    mods: { upkeep: -0.1, health: -0.1 },
  },
};

export const LAW_IDS = Object.keys(LAWS) as LawId[];

/** Leis em vigor. */
export const activeLaws = (s: Partial<Pick<CityState, "council">>): LawId[] => s.council?.laws ?? [];
export const hasLaw = (s: Partial<Pick<CityState, "council">>, id: LawId): boolean => activeLaws(s).includes(id);

/** Soma dos efeitos numéricos das leis em vigor (somados aos das tecnologias). */
export function lawMods(s: Partial<Pick<CityState, "council">>): Partial<TechMods> {
  const out: Partial<TechMods> = {};
  for (const id of activeLaws(s)) {
    const m = LAWS[id]?.mods;
    if (!m) continue;
    for (const k of Object.keys(m) as (keyof TechMods)[]) out[k] = (out[k] ?? 0) + (m[k] ?? 0);
  }
  return out;
}

const sumOf = (s: Partial<Pick<CityState, "council">>, pick: (d: LawDef) => number | undefined): number => activeLaws(s).reduce((a, id) => a + (pick(LAWS[id]) ?? 0), 0);
export const lawTaxIndustry = (s: Partial<Pick<CityState, "council">>) => Math.min(0.9, sumOf(s, (d) => d.taxIndustry));
export const lawTrade = (s: Partial<Pick<CityState, "council">>) => sumOf(s, (d) => d.trade);
export const lawEq = (s: Partial<Pick<CityState, "council">>) => sumOf(s, (d) => d.eq);

/** Humor das leis para um morador (trabalhador empregado ou qualquer um). */
export function lawMoods(s: Partial<Pick<CityState, "council">>, worker: boolean): { text: string; delta: number }[] {
  const out: { text: string; delta: number }[] = [];
  for (const id of activeLaws(s)) {
    const d = LAWS[id];
    if (d.moodAll) out.push(d.moodAll);
    if (worker && d.moodWorkers) out.push(d.moodWorkers);
  }
  return out;
}

/** Custo por ciclo das leis em vigor (inteiro). */
export function lawCost(s: Pick<CityState, "population" | "citizens" | "people" | "cyclesCompleted" | "pension"> & Partial<Pick<CityState, "council">>, retirees: number): number {
  return activeLaws(s).reduce((a, id) => a + (LAWS[id].cost?.(s, retirees) ?? 0), 0);
}
