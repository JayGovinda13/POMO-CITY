export const MAP_SIZE = 24;
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
/** 1 ciclo concluído = 1 ano da cidade. */
export const START_YEAR = 1900;
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
