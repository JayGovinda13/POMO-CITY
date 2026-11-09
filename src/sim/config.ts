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
