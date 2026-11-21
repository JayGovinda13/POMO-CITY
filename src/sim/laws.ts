// Leis municipais: a câmara de vereadores propõe, o prefeito aprova ou veta. Cada lei liga a uma
// mecânica que já existe (trabalho, impostos, poluição, saúde, segurança, aposentadoria…).

import type { TechMods } from "./tech";
import type { CityState } from "./types";

/**
 * Espectro político, da esquerda para a direita. O Fascista só entra na disputa em tempos de crise
 * (greve geral, aprovação despencando, caixa no vermelho, desastre, desemprego ou crime altos).
 */
export type PartyId = "esquerda" | "socialdemocrata" | "centro" | "liberal" | "conservador" | "fascista";
export const PARTY_IDS: PartyId[] = ["esquerda", "socialdemocrata", "centro", "liberal", "conservador", "fascista"];

export const PARTIES: Record<PartyId, { name: string; short: string; color: string; ideology: string; position: number; crisisOnly?: boolean }> = {
  esquerda: { name: "Esquerda Radical", short: "ER", color: "#c0392b", ideology: "Os trabalhadores no poder: jornada curta, salário mínimo, fiscalização e imposto sobre os grandes.", position: -2 },
  socialdemocrata: { name: "Social Democrata", short: "SD", color: "#e8708a", ideology: "Estado de bem-estar: saúde, escola, pensão, ar limpo e renda para todos.", position: -1 },
  centro: { name: "Centro", short: "CE", color: "#e8c040", ideology: "Pragmatismo: participação, parcerias, gestão e energia limpa.", position: 0 },
  liberal: { name: "Liberal", short: "LB", color: "#4a8fd8", ideology: "Menos Estado: impostos baixos, livre comércio, jornada flexível e menos burocracia.", position: 1 },
  conservador: { name: "Conservador", short: "CV", color: "#2f4f8f", ideology: "Ordem, família e contas em dia: segurança, austeridade e incentivo à família.", position: 2 },
  fascista: { name: "Fascista", short: "FA", color: "#4a3a32", ideology: "Surge na crise: promete ordem a qualquer custo, com repressão e sem greves.", position: 3, crisisOnly: true },
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
  standing: { esquerda: 0, socialdemocrata: 0, centro: 0, liberal: 0, conservador: 0, fascista: 0 },
  history: [],
};

export const newCouncil = (): CouncilState => structuredClone(EMPTY_COUNCIL);


export type LawId =
  | "jornada_8h"
  | "salario_minimo"
  | "fiscalizacao"
  | "taxar_grandes_empresas"
  | "saude_universal"
  | "merenda_escolar"
  | "pensao_universal"
  | "renda_basica"
  | "arborizacao"
  | "taxa_carbono"
  | "orcamento_participativo"
  | "parceria_publico_privada"
  | "reforma_administrativa"
  | "energia_limpa"
  | "isencao_industria"
  | "jornada_flexivel"
  | "livre_comercio"
  | "desburocratizacao"
  | "toque_recolher"
  | "guarda_municipal"
  | "austeridade"
  | "incentivo_familia"
  | "estado_de_excecao"
  | "proibicao_greves"
  | "milicia_urbana";

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
  /** Mudança do imposto industrial (fração; negativo = imposto maior). */
  taxIndustry?: number;
  /** Desconto de frete (fração). */
  trade?: number;
  /** QE alvo a mais. */
  eq?: number;
  /** Todo aposentado tem renda de aposentadoria. */
  pensionAll?: boolean;
  /** Mais nascimentos (fração a mais na chance de filhos). */
  births?: number;
  /** Greves proibidas: ninguém para de trabalhar por causa. */
  noStrike?: boolean;
  /** Custo por ciclo para o caixa. */
  cost?: (s: Pick<CityState, "population" | "citizens" | "people" | "cyclesCompleted" | "pension">, retirees: number) => number;
}

const perPop = (k: number) => (s: { population: number }) => Math.ceil(s.population * k);

export const LAWS: Record<LawId, LawDef> = {
  // ── Esquerda Radical ──
  jornada_8h: {
    party: "esquerda",
    name: "Jornada máxima de 8 horas",
    description: "Nenhum setor passa de 8 horas por dia (jornadas longas voltam a 8 h). Os trabalhadores ficam mais contentes, mas o ganho de produção de jornadas longas some.",
    hoursCap: 8,
    moodWorkers: { text: "Jornada limitada por lei", delta: 1 },
  },
  salario_minimo: {
    party: "esquerda",
    name: "Salário mínimo municipal",
    description: "Piso salarial: trabalhadores contentes (+1 de humor), mas as fábricas produzem 5% menos bens.",
    mods: { goods: -0.05 },
    moodWorkers: { text: "Salário mínimo", delta: 1 },
  },
  fiscalizacao: {
    party: "esquerda",
    name: "Fiscalização obrigatória do trabalho",
    description: "Fiscais em toda a cidade, sem precisar do prédio: humor e desgaste dos trabalhadores pela metade, e o ganho de jornada longa também.",
    inspection: true,
  },
  taxar_grandes_empresas: {
    party: "esquerda",
    name: "Imposto sobre grandes empresas",
    description: "A indústria paga 25% a mais de imposto, mas produz 4% menos bens.",
    taxIndustry: -0.25,
    mods: { goods: -0.04 },
  },
  // ── Social Democrata ──
  saude_universal: {
    party: "socialdemocrata",
    name: "Saúde universal",
    description: "Os hospitais atendem 25% mais gente, ao custo de uma verba por ciclo.",
    mods: { health: 0.25 },
    cost: perPop(0.2),
  },
  merenda_escolar: {
    party: "socialdemocrata",
    name: "Merenda escolar",
    description: "Alunos bem alimentados aprendem mais: QE alvo +5, ao custo de uma verba por ciclo.",
    eq: 5,
    cost: perPop(0.12),
  },
  pensao_universal: {
    party: "socialdemocrata",
    name: "Pensão universal",
    description: "Todo aposentado recebe uma renda mínima ($3 por ciclo), mesmo sem previdência. Evita a tristeza dos sem renda, mas custa por aposentado.",
    pensionAll: true,
    cost: (_s, retirees) => retirees * 3,
  },
  renda_basica: {
    party: "socialdemocrata",
    name: "Renda básica",
    description: "Uma renda mínima para todos: +1 de humor para todos, ao custo de uma verba por ciclo.",
    moodAll: { text: "Renda básica", delta: 1 },
    cost: perPop(0.25),
  },
  arborizacao: {
    party: "socialdemocrata",
    name: "Arborização urbana",
    description: "Ruas e praças cheias de árvores: todos ficam um pouco mais felizes (+1), ao custo de uma verba por ciclo.",
    moodAll: { text: "Cidade arborizada", delta: 1 },
    cost: perPop(0.15),
  },
  taxa_carbono: {
    party: "socialdemocrata",
    name: "Taxa de carbono",
    description: "A indústria paga para poluir: 20% menos poluição e 4% menos bens.",
    mods: { pollution: -0.2, goods: -0.04 },
  },
  // ── Centro ──
  orcamento_participativo: {
    party: "centro",
    name: "Orçamento participativo",
    description: "Os moradores decidem parte das obras: +1 de humor para todos, com uma pequena verba por ciclo.",
    moodAll: { text: "Orçamento participativo", delta: 1 },
    cost: perPop(0.08),
  },
  parceria_publico_privada: {
    party: "centro",
    name: "Parcerias público-privadas",
    description: "A iniciativa privada ajuda a tocar obras: manutenção 6% mais barata e vias 10% mais fluidas.",
    mods: { upkeep: -0.06, traffic: 0.1 },
  },
  reforma_administrativa: {
    party: "centro",
    name: "Reforma administrativa",
    description: "Prefeitura mais enxuta e moderna: manutenção 5% mais barata e 5% mais pesquisa.",
    mods: { upkeep: -0.05, research: 0.05 },
  },
  energia_limpa: {
    party: "centro",
    name: "Incentivo à energia limpa",
    description: "As usinas geram 6% a mais, com um pequeno custo por ciclo em subsídios.",
    mods: { power: 0.06 },
    cost: perPop(0.1),
  },
  // ── Liberal ──
  isencao_industria: {
    party: "liberal",
    name: "Isenção para a indústria",
    description: "Imposto industrial 25% menor e 8% mais bens, pensando em atrair fábricas.",
    taxIndustry: 0.25,
    mods: { goods: 0.08 },
  },
  jornada_flexivel: {
    party: "liberal",
    name: "Jornada flexível",
    description: "Empresas negociam horários: +4% de bens e de refino, mas os trabalhadores ficam mais cansados (−1 de humor).",
    mods: { goods: 0.04, refine: 0.04 },
    moodWorkers: { text: "Jornada flexível (banco de horas)", delta: -1 },
  },
  livre_comercio: {
    party: "liberal",
    name: "Zona de livre comércio",
    description: "O frete fica 6% mais barato nas importações e sobe o preço de venda.",
    trade: 0.06,
  },
  desburocratizacao: {
    party: "liberal",
    name: "Desburocratização",
    description: "Alvarás rápidos: um lote a mais cresce por ciclo e a manutenção cai 3%.",
    mods: { growth: 1, upkeep: -0.03 },
  },
  // ── Conservador ──
  toque_recolher: {
    party: "conservador",
    name: "Toque de recolher",
    description: "20% menos crime, mas ninguém gosta de ser vigiado (−1 de humor para todos).",
    mods: { crime: -0.2 },
    moodAll: { text: "Toque de recolher", delta: -1 },
  },
  guarda_municipal: {
    party: "conservador",
    name: "Guarda municipal",
    description: "Patrulhas nas ruas: 15% menos crime, ao custo de uma verba por ciclo.",
    mods: { crime: -0.15 },
    cost: perPop(0.15),
  },
  austeridade: {
    party: "conservador",
    name: "Lei de austeridade",
    description: "Cortes em toda a máquina: manutenção 10% mais barata, mas os hospitais atendem 10% menos.",
    mods: { upkeep: -0.1, health: -0.1 },
  },
  incentivo_familia: {
    party: "conservador",
    name: "Incentivo à família",
    description: "Benefício para famílias com filhos: 40% mais nascimentos, ao custo de uma verba por ciclo.",
    births: 0.4,
    cost: perPop(0.1),
  },
  // ── Fascista (só surge em crise) ──
  estado_de_excecao: {
    party: "fascista",
    name: "Estado de exceção",
    description: "Repressão total: 35% menos crime, mas o medo derruba o humor de todos (−2).",
    mods: { crime: -0.35 },
    moodAll: { text: "Estado de exceção", delta: -2 },
  },
  proibicao_greves: {
    party: "fascista",
    name: "Proibição de greves",
    description: "Ninguém para de trabalhar, nem com motivo. Os trabalhadores ficam revoltados (−2) e o problema continua embaixo do tapete.",
    noStrike: true,
    moodWorkers: { text: "Greves proibidas", delta: -2 },
  },
  milicia_urbana: {
    party: "fascista",
    name: "Milícia urbana",
    description: "Grupos armados patrulham as ruas: 25% menos crime e −1 de humor para todos, com uma verba por ciclo.",
    mods: { crime: -0.25 },
    moodAll: { text: "Milícia nas ruas", delta: -1 },
    cost: perPop(0.2),
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
export const lawTaxIndustry = (s: Partial<Pick<CityState, "council">>) => Math.max(-0.5, Math.min(0.9, sumOf(s, (d) => d.taxIndustry)));
export const lawBirths = (s: Partial<Pick<CityState, "council">>) => sumOf(s, (d) => d.births);
export const lawNoStrike = (s: Partial<Pick<CityState, "council">>): boolean => activeLaws(s).some((id) => LAWS[id].noStrike);
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
