// Árvore de tecnologia: 200 anos de avanço (1900 → 2100).
//
// A cidade gera PONTOS DE PESQUISA a cada ciclo concluído (educação, escolas, faculdades,
// bibliotecas, museus) — multiplicados pelo Rank do foco. O jogador escolhe o que pesquisar;
// cada tecnologia tem ano mínimo, pré-requisitos e custo. Ao concluir, ela dá modificadores
// permanentes (produção, energia, poluição, crime, impostos…) ou libera construções novas.

import type { BuildingType, CityState, Rank } from "./types";
import { RANK_YIELD } from "./config";
import { cityYear } from "./world";

/** Modificadores somados de todas as tecnologias pesquisadas (frações: 0,15 = +15%). */
export interface TechMods {
  farm: number;
  wood: number;
  ore: number;
  /** Serraria e fundição. */
  refine: number;
  /** Bens da indústria. */
  goods: number;
  /** Geração de todas as usinas. */
  power: number;
  water: number;
  /** Negativo = menos poluição. */
  pollution: number;
  /** Negativo = menos crime. */
  crime: number;
  /** Negativo = manutenção mais barata. */
  upkeep: number;
  tax: number;
  research: number;
  /** Capacidade das vias. */
  traffic: number;
  /** Capacidade dos hospitais. */
  health: number;
  /** Negativo = desastres mais fracos. */
  disaster: number;
  /** Lotes a mais que crescem por ciclo. */
  growth: number;
}

export const NO_MODS: TechMods = {
  farm: 0, wood: 0, ore: 0, refine: 0, goods: 0, power: 0, water: 0, pollution: 0, crime: 0,
  upkeep: 0, tax: 0, research: 0, traffic: 0, health: 0, disaster: 0, growth: 0,
};

export type EraId = "industrial" | "eletrica" | "atomica" | "digital" | "verde" | "futuro";

export const ERAS: { id: EraId; name: string; from: number }[] = [
  { id: "industrial", name: "Era Industrial", from: 1900 },
  { id: "eletrica", name: "Era Elétrica", from: 1930 },
  { id: "atomica", name: "Era Atômica", from: 1960 },
  { id: "digital", name: "Era Digital", from: 1990 },
  { id: "verde", name: "Era Verde", from: 2030 },
  { id: "futuro", name: "Era do Futuro", from: 2070 },
];

export interface TechDef {
  name: string;
  era: EraId;
  /** Ano mínimo da cidade para pesquisar. */
  year: number;
  cost: number;
  requires: string[];
  description: string;
  mods?: Partial<TechMods>;
  /** Construções que a tecnologia libera. */
  unlocks?: BuildingType[];
}

export const TECHS: Record<string, TechDef> = {
  // ── Era Industrial ──
  agricultura_moderna: { name: "Agricultura moderna", era: "industrial", year: 1900, cost: 12, requires: [], description: "Arado de ferro e rotação de culturas: +15% de comida.", mods: { farm: 0.15 } },
  maquina_vapor: { name: "Máquina a vapor", era: "industrial", year: 1900, cost: 15, requires: [], description: "Serraria e fundição a vapor: +15% de produção refinada.", mods: { refine: 0.15 } },
  imprensa: { name: "Imprensa popular", era: "industrial", year: 1903, cost: 20, requires: [], description: "Jornais e bibliotecas: +10% de pesquisa.", mods: { research: 0.1 } },
  saneamento: { name: "Saneamento básico", era: "industrial", year: 1905, cost: 25, requires: [], description: "Esgoto e água tratada: +15% de água e +10% de saúde.", mods: { water: 0.15, health: 0.1 } },
  aco: { name: "Aço Bessemer", era: "industrial", year: 1912, cost: 45, requires: ["maquina_vapor"], description: "Minas mais fundas e aço barato: +15% de minério e +10% de refino.", mods: { ore: 0.15, refine: 0.1 } },
  locomotiva: { name: "Locomotiva moderna", era: "industrial", year: 1915, cost: 40, requires: ["maquina_vapor"], description: "Frete rápido: +10% de bens e +10% de capacidade das vias.", mods: { goods: 0.1, traffic: 0.1 } },
  // ── Era Elétrica ──
  eletrificacao: { name: "Eletrificação", era: "eletrica", year: 1930, cost: 70, requires: ["maquina_vapor"], description: "Redes e turbinas melhores: +15% de energia.", mods: { power: 0.15 } },
  fertilizantes: { name: "Fertilizantes", era: "eletrica", year: 1935, cost: 80, requires: ["agricultura_moderna"], description: "Adubo químico: +20% de comida.", mods: { farm: 0.2 } },
  linha_montagem: { name: "Linha de montagem", era: "eletrica", year: 1935, cost: 90, requires: ["aco"], description: "Produção em série: +20% de bens.", mods: { goods: 0.2 } },
  radio: { name: "Rádio", era: "eletrica", year: 1940, cost: 80, requires: ["imprensa"], description: "Educação e comércio no ar: +10% de pesquisa e +5% de impostos.", mods: { research: 0.1, tax: 0.05 } },
  antibioticos: { name: "Antibióticos", era: "eletrica", year: 1945, cost: 110, requires: ["saneamento"], description: "Hospitais atendem 20% mais gente.", mods: { health: 0.2 } },
  policia_cientifica: { name: "Polícia científica", era: "eletrica", year: 1950, cost: 110, requires: ["radio"], description: "Perícia e rádio-patrulha: −15% de crime.", mods: { crime: -0.15 } },
  // ── Era Atômica ──
  energia_nuclear: { name: "Energia nuclear", era: "atomica", year: 1960, cost: 220, requires: ["eletrificacao"], description: "Libera a usina nuclear (120 MW).", unlocks: ["nuclear_plant"] },
  revolucao_verde: { name: "Revolução verde", era: "atomica", year: 1965, cost: 200, requires: ["fertilizantes"], description: "Sementes melhoradas: +25% de comida.", mods: { farm: 0.25 } },
  engenharia_trafego: { name: "Engenharia de tráfego", era: "atomica", year: 1965, cost: 180, requires: ["locomotiva"], description: "Semáforos e viadutos: +25% de capacidade das vias.", mods: { traffic: 0.25 } },
  conteineres: { name: "Contêineres", era: "atomica", year: 1968, cost: 200, requires: ["linha_montagem"], description: "Logística padronizada: +10% de bens e +5% de impostos.", mods: { goods: 0.1, tax: 0.05 } },
  televisao: { name: "Televisão", era: "atomica", year: 1970, cost: 180, requires: ["radio"], description: "Propaganda e consumo: +5% de impostos.", mods: { tax: 0.05 } },
  computadores: { name: "Computadores", era: "atomica", year: 1975, cost: 260, requires: ["televisao"], description: "Prefeitura informatizada: +20% de pesquisa e −5% de manutenção.", mods: { research: 0.2, upkeep: -0.05 } },
  // ── Era Digital ──
  internet: { name: "Internet", era: "digital", year: 1990, cost: 400, requires: ["computadores"], description: "+20% de pesquisa e +5% de impostos.", mods: { research: 0.2, tax: 0.05 } },
  reciclagem: { name: "Reciclagem", era: "digital", year: 1990, cost: 350, requires: ["conteineres"], description: "Libera o centro de reciclagem e reduz 10% da poluição.", mods: { pollution: -0.1 }, unlocks: ["recycling_center"] },
  energia_solar: { name: "Energia solar", era: "digital", year: 1995, cost: 420, requires: ["eletrificacao", "computadores"], description: "Libera a usina solar (limpa).", unlocks: ["solar_plant"] },
  automacao: { name: "Automação industrial", era: "digital", year: 2000, cost: 480, requires: ["linha_montagem", "computadores"], description: "Robôs nas fábricas: +25% de bens e +15% de refino.", mods: { goods: 0.25, refine: 0.15 } },
  biotecnologia: { name: "Biotecnologia", era: "digital", year: 2005, cost: 500, requires: ["antibioticos", "revolucao_verde"], description: "+20% de comida e +15% de saúde.", mods: { farm: 0.2, health: 0.15 } },
  cidade_inteligente: { name: "Cidade inteligente", era: "digital", year: 2015, cost: 650, requires: ["internet"], description: "Sensores e dados: −10% de manutenção, +15% nas vias, −10% de crime.", mods: { upkeep: -0.1, traffic: 0.15, crime: -0.1 } },
  // ── Era Verde ──
  carros_eletricos: { name: "Carros elétricos", era: "verde", year: 2030, cost: 900, requires: ["cidade_inteligente"], description: "−20% de poluição.", mods: { pollution: -0.2 } },
  baterias: { name: "Baterias de grafeno", era: "verde", year: 2035, cost: 950, requires: ["energia_solar"], description: "Energia guardada: +20% de energia.", mods: { power: 0.2 } },
  agricultura_vertical: { name: "Agricultura vertical", era: "verde", year: 2040, cost: 1000, requires: ["biotecnologia"], description: "Fazendas em prédios: +30% de comida e +10% de água.", mods: { farm: 0.3, water: 0.1 } },
  agua_do_futuro: { name: "Água do futuro", era: "verde", year: 2045, cost: 1100, requires: ["baterias"], description: "Captação e reúso total: +30% de água.", mods: { water: 0.3 } },
  inteligencia_artificial: { name: "Inteligência artificial", era: "verde", year: 2050, cost: 1400, requires: ["internet", "automacao"], description: "+30% de pesquisa e −10% de manutenção.", mods: { research: 0.3, upkeep: -0.1 } },
  medicina_regenerativa: { name: "Medicina regenerativa", era: "verde", year: 2055, cost: 1300, requires: ["biotecnologia"], description: "Hospitais atendem 30% mais gente.", mods: { health: 0.3 } },
  // ── Era do Futuro ──
  fusao: { name: "Fusão nuclear", era: "futuro", year: 2070, cost: 2500, requires: ["energia_nuclear", "inteligencia_artificial"], description: "Libera o reator de fusão (400 MW, sem combustível).", unlocks: ["fusion_plant"] },
  nanotecnologia: { name: "Nanotecnologia", era: "futuro", year: 2075, cost: 2600, requires: ["automacao", "inteligencia_artificial"], description: "+30% de refino e +20% de minério.", mods: { refine: 0.3, ore: 0.2 } },
  engenharia_climatica: { name: "Engenharia climática", era: "futuro", year: 2080, cost: 3000, requires: ["carros_eletricos", "fusao"], description: "Desastres 40% mais fracos e −20% de poluição.", mods: { disaster: -0.4, pollution: -0.2 } },
  logistica_quantica: { name: "Logística quântica", era: "futuro", year: 2085, cost: 3200, requires: ["nanotecnologia"], description: "+20% de bens e +30% nas vias.", mods: { goods: 0.2, traffic: 0.3 } },
  pos_escassez: { name: "Economia pós-escassez", era: "futuro", year: 2095, cost: 4500, requires: ["fusao", "nanotecnologia", "engenharia_climatica"], description: "+15% de impostos e −15% de manutenção.", mods: { tax: 0.15, upkeep: -0.15 } },
  arcologias: { name: "Arcologias", era: "futuro", year: 2100, cost: 6000, requires: ["pos_escassez"], description: "Cidades verticais: +3 lotes crescem por ciclo.", mods: { growth: 3 } },
};

export const TECH_IDS = Object.keys(TECHS);

/** Soma dos modificadores das tecnologias pesquisadas. */
export function techMods(s: Pick<CityState, "techs">): TechMods {
  const out: TechMods = { ...NO_MODS };
  for (const id of s.techs ?? []) {
    const m = TECHS[id]?.mods;
    if (!m) continue;
    for (const k of Object.keys(m) as (keyof TechMods)[]) out[k] += m[k] ?? 0;
  }
  return out;
}

export const hasTech = (s: Pick<CityState, "techs">, id: string) => (s.techs ?? []).includes(id);

/** Por que a tecnologia não pode ser pesquisada agora (null = pode). */
export function techLock(s: CityState, id: string): string | null {
  const t = TECHS[id];
  if (!t) return "Tecnologia desconhecida";
  if (hasTech(s, id)) return "Já pesquisada";
  const missing = t.requires.filter((r) => !hasTech(s, r));
  if (missing.length) return `Requer: ${missing.map((r) => TECHS[r].name).join(", ")}`;
  if (cityYear(s) < t.year) return `Disponível em ${t.year}`;
  return null;
}

/**
 * Pontos de pesquisa por ciclo: educação da população, escolas, faculdades, bibliotecas e
 * museus, multiplicados pelo Rank do foco e pelas tecnologias de pesquisa.
 */
export function researchPerCycle(s: CityState, rank: Rank = "D"): number {
  const count = (t: BuildingType) => s.buildings.filter((b) => b.type === t && !b.damaged).length;
  const base =
    1 +
    s.population * ((s.eq ?? 40) / 100) * 0.04 +
    count("school") * 1.5 +
    count("college") * 5 +
    count("library") * 1 +
    count("museum") * 2;
  return Math.round(base * RANK_YIELD[rank] * (1 + techMods(s).research) * 10) / 10;
}

/** Adiciona os pontos do ciclo à pesquisa em andamento e conclui o que der. Muta `s`. */
export function advanceResearch(s: CityState, points: number): string[] {
  s.research ??= { target: null, progress: 0 };
  s.research.progress = Math.round((s.research.progress + points) * 10) / 10;
  const done: string[] = [];
  // Pontos sem alvo ficam guardados (são usados quando o jogador escolher o que pesquisar).
  while (s.research.target) {
    const t = TECHS[s.research.target];
    if (!t || hasTech(s, s.research.target)) {
      s.research.target = null;
      break;
    }
    if (s.research.progress < t.cost) break;
    s.research.progress = Math.round((s.research.progress - t.cost) * 10) / 10;
    s.techs = [...(s.techs ?? []), s.research.target];
    done.push(s.research.target);
    s.research.target = null;
  }
  return done;
}

/** Pontuação de avanço (ranking online): tecnologia pesa mais; população e valor também contam. */
export function advancementScore(s: CityState, cityValue: number): number {
  const techPoints = (s.techs ?? []).reduce((acc, id) => acc + (TECHS[id]?.cost ?? 0), 0);
  return Math.round((s.techs?.length ?? 0) * 500 + techPoints * 2 + s.population * 3 + cityValue / 20);
}

/** Era atual da cidade (pela tecnologia mais avançada ou pelo ano). */
export function currentEra(s: CityState): (typeof ERAS)[number] {
  const year = cityYear(s);
  let era = ERAS[0];
  for (const e of ERAS) if (year >= e.from) era = e;
  return era;
}
