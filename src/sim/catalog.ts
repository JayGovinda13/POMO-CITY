import type { BiomeId, BuildingType, Rank, ResourceId, ZoneKind } from "./types";

export type BuildCategory = "infra" | "energy" | "production" | "special";

/** Requisitos de desbloqueio (ver unlocks.ts). */
export interface Requirement {
  /** Ano mínimo da cidade (1900 + ciclos concluídos). */
  year?: number;
  population?: number;
}

export interface MaterialCost {
  resource: ResourceId;
  /** Rank mínimo aceito para o material. */
  minRank: Rank;
  qty: number;
}

export interface BuildingDef {
  name: string;
  description: string;
  buildable: boolean;
  category: BuildCategory;
  requires?: Requirement;
  /** Consumo de energia em MW quando operando. */
  powerUse?: number;
  /** Geração de energia. */
  generates?: {
    capacity: number;
    /** A geração varia com o tempo da estação (Fase 2). */
    climate?: "wind" | "hydro";
    /** Combustível por ciclo; a eficiência depende do Rank (FUEL_EFFICIENCY). */
    fuel?: { resource: ResourceId; qty: number };
  };
  /** Precisa estar encostado em água (ex.: hidrelétrica). */
  needsWaterAdjacent?: boolean;
  cost: number;
  materials?: MaterialCost[];
  /** Custo de manutenção cobrado a cada ciclo concluído. */
  upkeep: number;
  workers: number;
  /** Precisa tocar uma estrada conectada à prefeitura para operar. */
  needsRoad: boolean;
  housing?: number;
  produces?: { resource: ResourceId; base: number };
  processes?: {
    input: ResourceId;
    inputQty: number;
    output: ResourceId;
    outputQty: number;
    /** Tech Tier: rank máximo que este processador consegue entregar. */
    tierCap: Rank;
  };
  /** Multiplicador de impostos da cidade (ex.: monumentos). */
  taxBonus?: number;
  color: number;
  height: number;
}

export const BUILDINGS: Record<BuildingType, BuildingDef> = {
  road: {
    category: "infra",
    name: "Estrada",
    description: "Asfalto. Conecta construções à prefeitura.",
    buildable: true,
    cost: 10,
    upkeep: 1,
    workers: 0,
    needsRoad: false,
    color: 0x4a4a52,
    height: 0,
  },
  cityhall: {
    category: "special",
    generates: { capacity: 12 },
    name: "Prefeitura",
    description: "Coração da cidade. A malha viária parte daqui e um gerador de 12 MW dá a partida.",
    buildable: false,
    cost: 0,
    upkeep: 0,
    workers: 0,
    needsRoad: false,
    color: 0xd9c27a,
    height: 30,
  },
  house: {
    category: "special",
    name: "Casa",
    description: "Legado: casas antigas viraram zonas residenciais.",
    buildable: false,
    cost: 50,
    upkeep: 0,
    workers: 0,
    needsRoad: true,
    housing: 8,
    color: 0x6fae5a,
    height: 14,
  },
  farm: {
    category: "production",
    powerUse: 1,
    name: "Fazenda",
    description: "Produz comida. Rendimento alto em planícies.",
    buildable: true,
    cost: 80,
    upkeep: 2,
    workers: 3,
    needsRoad: true,
    produces: { resource: "food", base: 12 },
    color: 0xc9a94a,
    height: 6,
  },
  lumberyard: {
    category: "production",
    powerUse: 2,
    name: "Madeireira",
    description: "Extrai madeira. Rendimento alto em florestas.",
    buildable: true,
    cost: 100,
    upkeep: 3,
    workers: 3,
    needsRoad: true,
    produces: { resource: "wood", base: 8 },
    color: 0x8a5a2b,
    height: 12,
  },
  mine: {
    category: "production",
    powerUse: 3,
    name: "Mina",
    description: "Extrai minério. Rendimento alto em montanhas.",
    buildable: true,
    cost: 150,
    upkeep: 4,
    workers: 4,
    needsRoad: true,
    produces: { resource: "ore", base: 6 },
    color: 0x7d7f8a,
    height: 10,
  },
  sawmill: {
    category: "production",
    powerUse: 3,
    name: "Serraria",
    description: "Madeira → tábuas. Tech Tier limita o rank a B.",
    buildable: true,
    cost: 200,
    upkeep: 5,
    workers: 4,
    needsRoad: true,
    processes: { input: "wood", inputQty: 4, output: "planks", outputQty: 4, tierCap: "B" },
    color: 0xb07a3c,
    height: 18,
  },
  smelter: {
    category: "production",
    powerUse: 6,
    name: "Fundição",
    description: "Minério → metal. Tech Tier alto: entrega até rank S.",
    buildable: true,
    cost: 300,
    upkeep: 6,
    workers: 5,
    needsRoad: true,
    processes: { input: "ore", inputQty: 4, output: "metal", outputQty: 2, tierCap: "S" },
    color: 0xa34a3a,
    height: 24,
  },
  monument: {
    category: "special",
    powerUse: 2,
    name: "Monumento",
    description: "Exige metal rank S. Aumenta os impostos em 25%.",
    buildable: true,
    cost: 1000,
    materials: [
      { resource: "metal", minRank: "S", qty: 10 },
      { resource: "planks", minRank: "B", qty: 20 },
    ],
    upkeep: 0,
    workers: 0,
    needsRoad: true,
    taxBonus: 0.25,
    color: 0xe8e0ff,
    height: 44,
  },
  thermal_plant: {
    name: "Termelétrica",
    description: "Queima 4 madeiras por ciclo. Madeira de Rank alto rende mais energia.",
    buildable: true,
    category: "energy",
    cost: 600,
    upkeep: 8,
    workers: 3,
    needsRoad: true,
    generates: { capacity: 40, fuel: { resource: "wood", qty: 4 } },
    color: 0x5a4a4a,
    height: 26,
  },
  wind_turbine: {
    name: "Eólica",
    description: "Energia limpa e barata, mas pouca: 6 MW, variando com o vento da estação.",
    buildable: true,
    category: "energy",
    cost: 150,
    upkeep: 1,
    workers: 0,
    needsRoad: false,
    generates: { capacity: 6, climate: "wind" },
    color: 0xdfe8f0,
    height: 34,
  },
  hydro_plant: {
    name: "Hidrelétrica",
    description: "30 MW sem combustível, variando com a chuva da estação. Precisa encostar na água. Disponível em 1902.",
    buildable: true,
    category: "energy",
    requires: { year: 1902 },
    cost: 900,
    upkeep: 4,
    workers: 2,
    needsRoad: false,
    needsWaterAdjacent: true,
    generates: { capacity: 30, climate: "hydro" },
    color: 0x4a7aa0,
    height: 16,
  },
};

/** Eficiência da termelétrica conforme a pureza do combustível. */
export const FUEL_EFFICIENCY: Record<Rank, number> = { D: 0.6, C: 0.7, B: 0.8, A: 0.9, S: 1 };

export interface ZoneDef {
  name: string;
  short: string;
  /** Custo por tile: [leve, densa]. */
  cost: [number, number];
  /** Nível máximo: [leve, densa]. */
  maxLevel: [number, number];
  /** Moradores (R) ou empregos (C/I) por nível. */
  perLevel: number;
  /** MW por nível desenvolvido. */
  powerPerLevel: number;
  color: number;
  denseRequires: Requirement;
}

export const ZONES: Record<ZoneKind, ZoneDef> = {
  R: { name: "Residencial", short: "R", cost: [5, 10], maxLevel: [2, 4], perLevel: 4, powerPerLevel: 0.5, color: 0x5fbf5a, denseRequires: { population: 40 } },
  C: { name: "Comercial", short: "C", cost: [5, 10], maxLevel: [2, 4], perLevel: 3, powerPerLevel: 0.75, color: 0x4a8fd8, denseRequires: { population: 40 } },
  I: { name: "Industrial", short: "I", cost: [5, 10], maxLevel: [2, 4], perLevel: 4, powerPerLevel: 1, color: 0xd8b84a, denseRequires: { population: 40 } },
};

export const WIRE_COST = 2;

export const RESOURCES: Record<ResourceId, { name: string; color: number }> = {
  food: { name: "Comida", color: 0xc9a94a },
  wood: { name: "Madeira", color: 0x8a5a2b },
  ore: { name: "Minério", color: 0x7d7f8a },
  planks: { name: "Tábuas", color: 0xb07a3c },
  metal: { name: "Metal", color: 0xa34a3a },
};

/** Produção assimétrica: cada bioma favorece matérias-primas diferentes. */
export const BIOMES: Record<BiomeId, { name: string; yield: Record<ResourceId, number>; grass: number }> = {
  plains: {
    name: "Planície",
    yield: { food: 1.5, wood: 0.75, ore: 0.5, planks: 1, metal: 1 },
    grass: 0x5d8a3a,
  },
  forest: {
    name: "Floresta",
    yield: { food: 1.0, wood: 1.5, ore: 0.5, planks: 1, metal: 1 },
    grass: 0x3f6e34,
  },
  desert: {
    name: "Deserto",
    yield: { food: 0.6, wood: 0.5, ore: 1.3, planks: 1, metal: 1 },
    grass: 0xc2a46a,
  },
  tundra: {
    name: "Tundra",
    yield: { food: 0.5, wood: 1.1, ore: 1.1, planks: 1, metal: 1 },
    grass: 0x8a9a8a,
  },
  mountains: {
    name: "Montanhas",
    yield: { food: 0.5, wood: 1.0, ore: 1.5, planks: 1, metal: 1 },
    grass: 0x6e6a4a,
  },
};

/** Desperdício industrial conforme a pureza do insumo. */
export const WASTE_BY_RANK: Record<Rank, number> = {
  D: 0.4,
  C: 0.25,
  B: 0.15,
  A: 0.05,
  S: 0,
};
