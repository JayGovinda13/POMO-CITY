// Tipos centrais da simulação. Este pacote é TypeScript puro e determinístico:
// roda igual no cliente (previsão otimista) e no servidor (validação autoritativa).

export const RANKS = ["D", "C", "B", "A", "S"] as const;
export type Rank = (typeof RANKS)[number];

export type ResourceId = "food" | "wood" | "ore" | "planks" | "metal";
export type BiomeId = "plains" | "forest" | "mountains" | "desert" | "tundra";

export type BuildingType =
  | "road"
  | "cityhall"
  /** Legado (v1): casas viraram zonas residenciais na migração para v2. */
  | "house"
  | "farm"
  | "lumberyard"
  | "mine"
  | "sawmill"
  | "smelter"
  | "monument"
  | "thermal_plant"
  | "wind_turbine"
  | "hydro_plant";

/** 0 = terra, 1 = água */
export type Terrain = 0 | 1;

/** Camada de zoneamento: 0 = sem zona, 1 = residencial, 2 = comercial, 3 = industrial. */
export const ZONE = { NONE: 0, R: 1, C: 2, I: 3 } as const;
export type ZoneCode = (typeof ZONE)[keyof typeof ZONE];
export type ZoneKind = "R" | "C" | "I";
export const ZONE_KINDS: ZoneKind[] = ["R", "C", "I"];

export interface Building {
  id: number;
  type: BuildingType;
  x: number;
  y: number;
}

/** Chave no formato "recurso:rank", ex.: "wood:A" */
export type InventoryKey = `${ResourceId}:${Rank}`;
export type Inventory = Partial<Record<InventoryKey, number>>;

export const CURRENT_SCHEMA_VERSION = 3;

export interface CityState {
  /** Versão do formato do estado; ver migrate.ts. */
  schemaVersion: number;
  /** Incrementa a cada mutação aceita; usado para detectar estado obsoleto. */
  version: number;
  seed: number;
  biome: BiomeId;
  /** Região climática escolhida na fundação (id da tabela em climate.ts); null = ainda não escolhida. */
  regionId: string | null;
  /**
   * Trimestre real em que a cidade foi fundada (0..3). O calendário da cidade começa
   * nessa estação: índice do calendário = ciclos concluídos + calendarOffset.
   */
  calendarOffset: number;
  width: number;
  height: number;
  terrain: Terrain[];
  buildings: Building[];
  nextId: number;

  // ── Camadas por tile (arrays paralelos de width*height) ──
  /** ZoneCode por tile. */
  zoneType: ZoneCode[];
  /** 0 = leve, 1 = densa. */
  zoneDensity: (0 | 1)[];
  /** Nível de desenvolvimento do lote (0 = terreno vazio). */
  zoneLevel: number[];
  /** 1 = linha de transmissão no tile (pode coexistir com estrada). */
  wires: (0 | 1)[];

  money: number;
  population: number;
  inventory: Inventory;
  /** Ciclos de foco consecutivos (com decaimento, nunca zera de uma vez). */
  streak: number;
  /** true depois de sair pelo menu: a sequência fica guardada (sem decair) até o próximo ciclo. */
  streakFrozen: boolean;
  /** Quantos desastres a cidade já sofreu (varia o sorteio do próximo). */
  disasterCount: number;
  cyclesCompleted: number;
  /** Timestamp (ms) da última conclusão de ciclo. */
  lastCycleAt: number | null;
  /** Data UTC (YYYY-MM-DD) usada para o limite diário de recompensas. */
  dayKey: string;
  cyclesToday: number;
}

export type Command =
  | { type: "build"; building: BuildingType; x: number; y: number }
  | { type: "demolish"; x: number; y: number }
  | { type: "wire"; x: number; y: number }
  | {
      type: "zone";
      /** "none" remove o zoneamento de lotes vazios. */
      zone: ZoneKind | "none";
      dense: boolean;
      x0: number;
      y0: number;
      x1: number;
      y1: number;
    };

export interface CycleReport {
  rank: Rank;
  streak: number;
  /** Ano e trimestre (0..3) da estação que este ciclo de foco viveu. */
  year: number;
  quarter: number;
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
  power: { capacity: number; demand: number; brownout: boolean };
  /** Clima da estação vivida (null se a cidade ainda não escolheu a região). */
  weather: WeatherSummary | null;
  zones: { grown: number; declined: number };
  jobs: { total: number; filled: number; unemployed: number };
}

export interface WeatherSummary {
  season: string;
  label: string;
  temp: number;
  rain: number;
  wind: number;
  effects: ClimateEffects;
}

/** Multiplicadores do clima sobre a simulação (1 = neutro). */
export interface ClimateEffects {
  /** Produção das fazendas. */
  farm: number;
  /** Geração eólica. */
  wind: number;
  /** Geração hidrelétrica. */
  hydro: number;
  /** Consumo de energia de lotes R/C (aquecimento ou refrigeração). */
  demand: number;
}
