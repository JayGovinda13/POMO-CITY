/** Tamanho dos mapas fundados a partir da Fase 9 (40×40). Cidades antigas mantêm o tamanho. */
export const MAP_SIZE = 40;
/** Tamanho padrão de createCity sem opções (cidade provisória antes da fundação e testes). */
export const LEGACY_MAP_SIZE = 24;
export const STARTING_MONEY = 1000;

/** Ciclos acima deste limite no mesmo dia contam, mas não geram recompensa. */
export const DAILY_REWARD_CAP = 16;
/** Sem concluir um ciclo por mais que isso, a sequência decai. */
export const SESSION_GAP_MS = 90 * 60 * 1000;
/** Quanto a sequência perde ao abandonar um ciclo ou ao estourar o intervalo. */
export const STREAK_PENALTY = 2;

export const TAX_PER_RESIDENT = 3;
export const FOOD_PER_RESIDENT = 0.5;

export const DEFAULT_FOCUS_SECONDS = 25 * 60;
export const BREAK_SECONDS = 5 * 60;
export const LONG_BREAK_SECONDS = 20 * 60;
/** A cada N ciclos, a pausa é longa (turno de gestão pesada). */
export const LONG_BREAK_EVERY = 4;

// ── Fase 0/1 ──────────────────────────────────────────────────────────────
/** 1 ciclo concluído = 1 estação (3 meses); 4 ciclos = 1 ano da cidade. */
export const START_YEAR = 1900;
export const CYCLES_PER_YEAR = 4;
/** Lotes só se desenvolvem a até N tiles de uma estrada ligada à prefeitura. */
export const ROAD_ACCESS_DISTANCE = 3;
/** Lotes que podem crescer por ciclo, por tipo de zona, antes do bônus de foco. */
export const BASE_GROWTH_SLOTS = 3;
/** Bônus de crescimento por Rank do lote (o foco acelera a cidade). */
export const RANK_GROWTH_BONUS = { D: 0, C: 1, B: 2, A: 3, S: 4 } as const;
/** Construções sem energia operam com esta eficiência. */
export const UNPOWERED_EFFICIENCY = 0.5;
/** Imposto por emprego preenchido em zonas comerciais e industriais. */
export const TAX_PER_JOB = 1;
/** Máximo de tiles num único comando de zoneamento. */
export const MAX_ZONE_AREA = 256;

// ── Fase 3: economia ───────────────────────────────────────────────────────
import type { Rank, ResourceId } from "./types";

/** Valor e rendimento por Rank: 1 unidade A rende como 1,3 unidade D. */
export const RANK_YIELD: Record<Rank, number> = { D: 1, C: 1.1, B: 1.2, A: 1.3, S: 1.4 };

export const DEFAULT_POLICIES: Record<ResourceId, { mode: "stock" | "sell_surplus" | "sell_percent" | "reserve"; value: number }> = {
  food: { mode: "reserve", value: 2 },
  wood: { mode: "stock", value: 0 },
  ore: { mode: "stock", value: 0 },
  planks: { mode: "stock", value: 0 },
  metal: { mode: "stock", value: 0 },
  goods: { mode: "sell_surplus", value: 0 },
};

/** Estoque inicial: o suficiente para as primeiras obras sem importar. */
export const STARTING_INVENTORY = { "food:C": 40, "wood:C": 20, "planks:C": 10 } as const;
/** Lenha por morador por estação quando a temperatura cai abaixo de 10 °C. */
export const HEATING_WOOD_PER_RESIDENT = 0.25;
/** Bens de consumo por morador por estação, a partir de GOODS_MIN_POPULATION. */
export const GOODS_PER_RESIDENT = 0.2;
export const GOODS_MIN_POPULATION = 30;
/** Bens produzidos por emprego industrial ocupado. */
export const GOODS_PER_INDUSTRY_JOB = 0.5;

/** Fase 7: quociente educacional e expectativa de vida de uma cidade nova. */
export const START_EQ = 40;
export const START_LIFE = 55;
