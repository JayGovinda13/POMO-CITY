// Ciclo econômico (Livro 3 de O Capital): "o ciclo decenal de estagnação, prosperidade, superprodução e
// crise". Dura 10 anos (40 ciclos), e cada fase mexe nos preços dos produtos industriais, nos juros
// dos títulos e na demanda por empregos e comércio. É determinístico: dá para ver a fase que vem.

import type { CityState } from "./types";

export type EcoPhase = "estagnacao" | "prosperidade" | "superproducao" | "crise";
export const ECO_PHASES: EcoPhase[] = ["estagnacao", "prosperidade", "superproducao", "crise"];
export const PHASE_CYCLES = 10;
export const ECO_PERIOD = PHASE_CYCLES * ECO_PHASES.length;

export interface EcoDef {
  name: string;
  description: string;
  /** Preço dos produtos industriais (tábuas, metal e bens) no mercado externo. */
  price: number;
  /** Juros dos títulos novos (soma à taxa; 0,01 = 1 ponto percentual ao ano). */
  spread: number;
  /** Demanda por comércio e indústria. */
  demand: number;
}

export const ECO: Record<EcoPhase, EcoDef> = {
  estagnacao: { name: "Estagnação", description: "Negócios parados: preços um pouco abaixo e pouca procura por emprego e comércio.", price: 0.95, spread: 0, demand: -0.05 },
  prosperidade: { name: "Prosperidade", description: "Tudo vende: preços 15% acima, crédito barato e comércio e indústria em expansão.", price: 1.15, spread: -0.01, demand: 0.1 },
  superproducao: { name: "Superprodução", description: "As fábricas produzem mais do que o mercado compra: preços caem e o crédito encarece. A crise vem aí.", price: 0.9, spread: 0.01, demand: 0 },
  crise: { name: "Crise", description: "Preços 35% abaixo, juros altos, comércio e indústria encolhendo e os trabalhadores com medo do desemprego.", price: 0.65, spread: 0.03, demand: -0.2 },
};

export interface EcoState {
  phase: EcoPhase;
  /** Ciclos que faltam para a fase acabar (1 = é o último). */
  left: number;
  /** Posição dentro do ciclo de 40 (0..39). */
  index: number;
}

/** Cada cidade começa numa fase diferente (a semente decide). */
const offset = (seed: number): number => (seed >>> 3) % ECO_PERIOD;

/** Fase do ciclo econômico num ciclo qualquer (`cyclesCompleted`). */
export function ecoAt(s: Pick<CityState, "seed">, cycle: number): EcoState {
  const index = (((cycle + offset(s.seed)) % ECO_PERIOD) + ECO_PERIOD) % ECO_PERIOD;
  return { phase: ECO_PHASES[Math.floor(index / PHASE_CYCLES)], left: PHASE_CYCLES - (index % PHASE_CYCLES), index };
}

export const ecoState = (s: Pick<CityState, "seed" | "cyclesCompleted">): EcoState => ecoAt(s, s.cyclesCompleted);
export const ecoMarket = (s: Pick<CityState, "seed" | "cyclesCompleted">): number => ECO[ecoState(s).phase].price;
export const ecoSpread = (s: Pick<CityState, "seed" | "cyclesCompleted">): number => ECO[ecoState(s).phase].spread;
export const ecoDemand = (s: Pick<CityState, "seed" | "cyclesCompleted">): number => ECO[ecoState(s).phase].demand;

/** As próximas fases: [{ fase, em quantos ciclos começa }]. */
export function ecoForecast(s: Pick<CityState, "seed" | "cyclesCompleted">, n = 3): { phase: EcoPhase; startsIn: number }[] {
  const cur = ecoState(s);
  const out: { phase: EcoPhase; startsIn: number }[] = [];
  let at = cur.left;
  let i = ECO_PHASES.indexOf(cur.phase);
  for (let k = 0; k < n; k++) {
    i = (i + 1) % ECO_PHASES.length;
    out.push({ phase: ECO_PHASES[i], startsIn: at });
    at += PHASE_CYCLES;
  }
  return out;
}
