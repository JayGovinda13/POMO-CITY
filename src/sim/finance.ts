// Fase 4 — Orçamento e finanças: impostos por zona, verba por departamento, títulos com rating
// de crédito e decretos municipais. Tudo puro e determinístico (vale no cliente e no servidor).

import { BUILDINGS } from "./catalog";
import { ZONE, type CityState, type ZoneKind } from "./types";
import { ecoDemand } from "./ecocycle";
import type { PartyId } from "./laws";
import type { TechMods } from "./tech";

// ───────────────────────── impostos ─────────────────────────

/** Alíquota padrão (%): com ela a arrecadação é a mesma de antes da Fase 4. */
export const DEFAULT_TAX = 9;
export const MAX_TAX = 20;
/** Arrecadação por unidade na alíquota padrão: por morador (R) e por emprego ocupado (C, I). */
// Balanceamento: R 3 → 2,5 (a cidade média sobrava dinheiro demais; ver docs/BALANCO.md).
export const TAX_BASE: Record<ZoneKind, number> = { R: 2.2, C: 1, I: 1 };

/**
 * Administração municipal: o custo de tocar a cidade cresce com ela (folha, papelada, serviços
 * gerais). Zero até 60 moradores, para não apertar o começo; depois, $1 por morador a mais.
 */
export const ADMIN_FREE_POPULATION = 60;
export const ADMIN_PER_RESIDENT = 1;
export const adminCost = (population: number) => Math.ceil(Math.max(0, population - ADMIN_FREE_POPULATION) * ADMIN_PER_RESIDENT);
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
  | "premio_produtividade"
  | "escola_fabrica"
  | "habitacao_popular"
  | "tarifa_social_energia"
  | "cozinha_comunitaria"
  | "feriado_trabalhador"
  | "mutirao_saude"
  | "campanha_leitura"
  | "ciclo_cultural"
  | "mutirao_limpeza"
  | "pregao_eletronico"
  | "balcao_empresas"
  | "feirao_ofertas"
  | "isencao_iptu_novos"
  | "patrulha_escolar"
  | "dia_da_familia"
  | "cortes_gabinete"
  | "parada_civica"
  | "censura_jornais"
  | "alistamento_obrigatorio";

export interface OrdinanceDef {
  name: string;
  category: "Finanças" | "Energia" | "Comunidade" | "Foco" | "Trabalho" | "Segurança" | "Saúde e educação";
  description: string;
  /** Receita (+) ou custo (−) por ciclo, em função do estado. */
  money: (s: CityState) => number;
  /** Ajustes na demanda R/C/I enquanto ativo. */
  demand?: Partial<Record<ZoneKind, number>>;
  /** Ajuste no humor dos moradores (motivo exibido na ficha). */
  mood?: { delta: number; text: string };
  /** Efeitos numéricos (somados aos das tecnologias e leis) enquanto ativo. */
  mods?: Partial<TechMods>;
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
  escola_fabrica: {
    name: "Escola-fábrica",
    category: "Trabalho",
    description: "Aprendizes dividem o dia entre a escola e a oficina: o QE alvo sobe 10 pontos e a cidade realoca mais gente da automação, mas as fábricas produzem 8% menos.",
    money: (s) => -Math.ceil(pop(s) * 0.12),
  },
  premio_produtividade: {
    name: "Prêmio de produtividade",
    category: "Foco",
    description: "Em ciclos de Rank A ou S, a extração rende 15% a mais (os trabalhadores ganham bônus).",
    money: (s) => -Math.ceil(pop(s) * 0.2),
  },
  habitacao_popular: {
    name: "Habitação popular",
    category: "Comunidade",
    description: "A prefeitura banca moradia para quem tem pouco: o aluguel pesado (IPTU alto) não derruba o humor dos mais pobres e a demanda residencial sofre metade.",
    money: (s) => -Math.ceil(pop(s) * 0.25),
  },

  // ── Esquerda Radical ──
  tarifa_social_energia: {
    name: "Tarifa social de energia",
    category: "Energia",
    description: "Conta de luz barata para as famílias pobres: moradores mais contentes (+1), com uma verba por ciclo.",
    money: (s) => -Math.ceil(pop(s) * 0.15),
    mood: { delta: 1, text: "Tarifa social de energia" },
  },
  cozinha_comunitaria: {
    name: "Cozinhas comunitárias",
    category: "Comunidade",
    description: "Refeição coletiva nos bairros: +1 de humor para todos, com uma verba por ciclo.",
    money: (s) => -Math.ceil(pop(s) * 0.2),
    mood: { delta: 1, text: "Cozinha comunitária" },
  },
  feriado_trabalhador: {
    name: "Feriado do trabalhador",
    category: "Trabalho",
    description: "Um dia de folga paga por ciclo: +1 de humor, mas 2% menos bens.",
    money: () => 0,
    mood: { delta: 1, text: "Feriado do trabalhador" },
    mods: { goods: -0.02 },
  },
  // ── Social Democrata ──
  mutirao_saude: {
    name: "Mutirão de saúde",
    category: "Saúde e educação",
    description: "Equipes de saúde nos bairros: os hospitais atendem 8% mais gente, com uma verba por ciclo.",
    money: (s) => -Math.ceil(pop(s) * 0.12),
    mods: { health: 0.08 },
  },
  campanha_leitura: {
    name: "Campanha de leitura",
    category: "Saúde e educação",
    description: "Livros e saraus em toda a cidade: 5% mais pesquisa, com uma pequena verba por ciclo.",
    money: (s) => -Math.ceil(pop(s) * 0.08),
    mods: { research: 0.05 },
  },
  // ── Centro ──
  ciclo_cultural: {
    name: "Ciclo cultural",
    category: "Comunidade",
    description: "Cinema, teatro e música em praça pública: +1 de humor e mais comércio (+5% de demanda).",
    money: (s) => -Math.ceil(pop(s) * 0.1),
    demand: { C: 0.05 },
    mood: { delta: 1, text: "Ciclo cultural" },
  },
  mutirao_limpeza: {
    name: "Mutirão de limpeza",
    category: "Comunidade",
    description: "Todo mundo limpa o bairro: 6% menos poluição, com uma pequena verba por ciclo.",
    money: (s) => -Math.ceil(pop(s) * 0.06),
    mods: { pollution: -0.06 },
  },
  pregao_eletronico: {
    name: "Pregão eletrônico",
    category: "Finanças",
    description: "Compras públicas por leilão: manutenção 3% mais barata.",
    money: () => 0,
    mods: { upkeep: -0.03 },
  },
  // ── Liberal ──
  balcao_empresas: {
    name: "Balcão de empresas",
    category: "Finanças",
    description: "Alvará em um dia: +8% de demanda de comércio e +5% de indústria, com uma verba por ciclo.",
    money: (s) => -Math.ceil(pop(s) * 0.05),
    demand: { C: 0.08, I: 0.05 },
  },
  feirao_ofertas: {
    name: "Feirão de ofertas",
    category: "Finanças",
    description: "Liquidação na cidade inteira: +10% de demanda de comércio, ao custo da divulgação.",
    money: (s) => -Math.ceil(pop(s) * 0.1),
    demand: { C: 0.1 },
  },
  isencao_iptu_novos: {
    name: "Isenção de imposto para novos moradores",
    category: "Finanças",
    description: "Quem chega não paga nos primeiros ciclos: +10% de demanda residencial, mas a prefeitura perde receita.",
    money: (s) => -Math.ceil(pop(s) * 0.15),
    demand: { R: 0.1 },
  },
  // ── Conservador ──
  patrulha_escolar: {
    name: "Patrulha escolar",
    category: "Segurança",
    description: "Policiais na porta das escolas: 6% menos crime, com uma verba por ciclo.",
    money: (s) => -Math.ceil(pop(s) * 0.1),
    mods: { crime: -0.06 },
  },
  dia_da_familia: {
    name: "Dia da família",
    category: "Comunidade",
    description: "Almoço e missa aos domingos: +1 de humor, com uma verba por ciclo.",
    money: (s) => -Math.ceil(pop(s) * 0.08),
    mood: { delta: 1, text: "Dia da família" },
  },
  cortes_gabinete: {
    name: "Corte nos gabinetes",
    category: "Finanças",
    description: "A prefeitura corta regalias: manutenção 3% mais barata e uma economia por ciclo.",
    money: (s) => Math.ceil(pop(s) * 0.06),
    mods: { upkeep: -0.03 },
  },
  // ── Fascista ──
  parada_civica: {
    name: "Parada cívica",
    category: "Segurança",
    description: "Desfile militar com bandeiras: +1 de humor, ao custo de uma verba por ciclo. Os fascistas adoram.",
    money: (s) => -Math.ceil(pop(s) * 0.15),
    mood: { delta: 1, text: "Parada cívica" },
  },
  censura_jornais: {
    name: "Censura de jornais",
    category: "Segurança",
    description: "Só circula o que o governo aprova: 5% menos crime e 5% menos pesquisa.",
    money: () => 0,
    mods: { crime: -0.05, research: -0.05 },
  },
  alistamento_obrigatorio: {
    name: "Alistamento obrigatório",
    category: "Trabalho",
    description: "Todo jovem serve ao Estado: 3% mais bens, mas −1 de humor.",
    money: () => 0,
    mood: { delta: -1, text: "Alistamento obrigatório" },
    mods: { goods: 0.03 },
  },
};

/**
 * Política dos decretos: quem se favorece ao assinar (ganha +1 de prestígio com o prefeito) e quem se
 * desfavorece (−1). Revogar faz o contrário. O prestígio pesa nas eleições (ver council.ts).
 */
export const ORDINANCE_POLITICS: Record<OrdinanceId, { party: PartyId; foes?: PartyId[] }> = {
  imposto_vendas: { party: "conservador", foes: ["liberal"] },
  imposto_renda: { party: "socialdemocrata", foes: ["liberal"] },
  jogos: { party: "liberal", foes: ["conservador"] },
  conservacao_energia: { party: "centro" },
  embelezamento: { party: "centro" },
  festival: { party: "socialdemocrata" },
  premio_produtividade: { party: "liberal", foes: ["esquerda"] },
  escola_fabrica: { party: "conservador" },
  habitacao_popular: { party: "esquerda", foes: ["liberal"] },
  tarifa_social_energia: { party: "esquerda", foes: ["liberal"] },
  cozinha_comunitaria: { party: "esquerda" },
  feriado_trabalhador: { party: "esquerda", foes: ["liberal", "conservador"] },
  mutirao_saude: { party: "socialdemocrata" },
  campanha_leitura: { party: "socialdemocrata" },
  ciclo_cultural: { party: "centro" },
  mutirao_limpeza: { party: "centro" },
  pregao_eletronico: { party: "centro", foes: ["fascista"] },
  balcao_empresas: { party: "liberal", foes: ["esquerda"] },
  feirao_ofertas: { party: "liberal" },
  isencao_iptu_novos: { party: "liberal", foes: ["esquerda"] },
  patrulha_escolar: { party: "conservador" },
  dia_da_familia: { party: "conservador", foes: ["esquerda"] },
  cortes_gabinete: { party: "conservador", foes: ["socialdemocrata"] },
  parada_civica: { party: "fascista", foes: ["esquerda", "socialdemocrata"] },
  censura_jornais: { party: "fascista", foes: ["centro", "socialdemocrata"] },
  alistamento_obrigatorio: { party: "fascista", foes: ["esquerda"] },
};

/** Soma dos efeitos numéricos dos decretos ativos. */
export function ordinanceMods(s: Partial<Pick<CityState, "ordinances">>): Partial<TechMods> {
  const out: Partial<TechMods> = {};
  for (const id of Object.keys(s.ordinances ?? {}) as OrdinanceId[]) {
    const m = ORDINANCES[id]?.mods;
    if (!m) continue;
    for (const k of Object.keys(m) as (keyof TechMods)[]) out[k] = (out[k] ?? 0) + (m[k] ?? 0);
  }
  return out;
}

export const ORDINANCE_IDS = Object.keys(ORDINANCES) as OrdinanceId[];
export const isActive = (s: CityState, id: OrdinanceId) => s.ordinances[id] !== undefined;

/** Fator de capacidade da conservação de energia (rampa de 4 ciclos até +15%). */
export function conservationFactor(s: CityState): number {
  const since = s.ordinances.conservacao_energia;
  if (since === undefined) return 1;
  return 1 + 0.15 * Math.min(1, (s.cyclesCompleted - since) / 4);
}

/** IPTU máximo (%). */
export const MAX_LAND_TAX = 10;
/** Moradores por lote residencial por nível. */
const RENT_BASE = 12;

/** Renda do solo: IPTU sobre o valor da terra dos lotes residenciais (quanto mais valorizado o bairro, mais rende). */
export function landRentRevenue(s: CityState, landValue: ArrayLike<number>): number {
  if (!s.landTax) return 0;
  let total = 0;
  for (let i = 0; i < s.zoneType.length; i++) {
    if (s.zoneType[i] !== ZONE.R) continue;
    total += s.zoneLevel[i] * 4 * (landValue[i] / 100) * RENT_BASE * (s.landTax / 100);
  }
  return Math.floor(total);
}

/** Aluguel pesado: o IPTU alto vira aluguel e espanta moradores. */
export const rentPressure = (s: Pick<CityState, "landTax">): number => Math.max(0, (s.landTax ?? 0) - 2);

/** Soma dos ajustes de demanda: impostos, decretos, IPTU, ciclo econômico e dificuldade. */
export function demandModifiers(s: CityState): Record<ZoneKind, number> {
  const out: Record<ZoneKind, number> = { R: 0, C: 0, I: 0 };
  for (const k of ["R", "C", "I"] as ZoneKind[]) out[k] -= (s.taxes[k] - DEFAULT_TAX) * TAX_DEMAND_PER_POINT;
  for (const id of ORDINANCE_IDS) {
    if (!isActive(s, id)) continue;
    for (const [k, v] of Object.entries(ORDINANCES[id].demand ?? {})) out[k as ZoneKind] += v;
  }
  out.I += DIFFICULTY[s.difficulty].industryDemand;
  out.R -= rentPressure(s) * 0.02 * (isActive(s, "habitacao_popular") ? 0.5 : 1);
  // Empreendedores abrem lojas e oficinas: mais demanda de comércio.
  out.C += Math.min(0.15, (s.business?.entrepreneurs ?? 0) * 0.005);
  const eco = ecoDemand(s);
  out.C += eco;
  out.I += eco;
  return out;
}

// ───────────────────────── dificuldade ─────────────────────────

export type Difficulty = "facil" | "medio" | "dificil";
export const DIFFICULTY: Record<
  Difficulty,
  { name: string; money: number; bonds: number; industryDemand: number; upkeep: number; description: string }
> = {
  facil: { name: "Fácil", money: 2000, bonds: 0, industryDemand: 0.15, upkeep: 0.85, description: "$2.000, economia aquecida e manutenção 15% mais barata." },
  medio: { name: "Médio", money: 1000, bonds: 0, industryDemand: 0, upkeep: 1, description: "$1.000 e economia estável." },
  dificil: {
    name: "Difícil",
    money: 0,
    bonds: 1,
    industryDemand: -0.15,
    upkeep: 1.25,
    description: "$1.000 vindos de um título a pagar, economia em recessão e manutenção 25% mais cara.",
  },
};
