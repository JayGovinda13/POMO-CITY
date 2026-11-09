// Tipos centrais da simulação. Este pacote é TypeScript puro e determinístico:
// roda igual no cliente (previsão otimista) e no servidor (validação autoritativa).

export const RANKS = ["D", "C", "B", "A", "S"] as const;
export type Rank = (typeof RANKS)[number];

export type ResourceId = "food" | "wood" | "ore" | "planks" | "metal";
export type BiomeId = "plains" | "forest" | "mountains";

export type BuildingType =
  | "road"
  | "cityhall"
  | "house"
  | "farm"
  | "lumberyard"
  | "mine"
  | "sawmill"
  | "smelter"
  | "monument";

/** 0 = terra, 1 = água */
export type Terrain = 0 | 1;

export interface Building {
  id: number;
  type: BuildingType;
  x: number;
  y: number;
}

/** Chave no formato "recurso:rank", ex.: "wood:A" */
export type InventoryKey = `${ResourceId}:${Rank}`;
export type Inventory = Partial<Record<InventoryKey, number>>;

export interface CityState {
  /** Incrementa a cada mutação aceita; usado para detectar estado obsoleto. */
  version: number;
  seed: number;
  biome: BiomeId;
  width: number;
  height: number;
  terrain: Terrain[];
  buildings: Building[];
  nextId: number;
  money: number;
  population: number;
  inventory: Inventory;
  /** Ciclos de foco consecutivos (com decaimento, nunca zera de uma vez). */
  streak: number;
  cyclesCompleted: number;
  /** Timestamp (ms) da última conclusão de ciclo. */
  lastCycleAt: number | null;
  /** Data UTC (YYYY-MM-DD) usada para o limite diário de recompensas. */
  dayKey: string;
  cyclesToday: number;
}

export type Command =
  | { type: "build"; building: BuildingType; x: number; y: number }
  | { type: "demolish"; x: number; y: number };

export interface CycleReport {
  rank: Rank;
  streak: number;
  rewarded: boolean;
  produced: Inventory;
  consumed: Inventory;
  wasted: Inventory;
  taxes: number;
  upkeep: number;
  populationBefore: number;
  populationAfter: number;
  starving: boolean;
  netMoney: number;
}
