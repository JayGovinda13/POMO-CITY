import type { BiomeId, BuildingType, Rank, ResourceId } from "./types";

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
    name: "Prefeitura",
    description: "Coração da cidade. A malha viária parte daqui.",
    buildable: false,
    cost: 0,
    upkeep: 0,
    workers: 0,
    needsRoad: false,
    color: 0xd9c27a,
    height: 30,
  },
  house: {
    name: "Casa",
    description: "Abriga 8 moradores que trabalham e pagam impostos.",
    buildable: true,
    cost: 50,
    upkeep: 0,
    workers: 0,
    needsRoad: true,
    housing: 8,
    color: 0x6fae5a,
    height: 14,
  },
  farm: {
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
};

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
