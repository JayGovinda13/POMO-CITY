import type { BiomeId, BuildingType, Rank, ResourceId, ZoneKind } from "./types";

export type BuildCategory = "infra" | "transport" | "energy" | "water" | "services" | "leisure" | "production" | "storage" | "special";

/** Requisitos de desbloqueio (ver unlocks.ts). */
export interface Requirement {
  /** Ano mínimo da cidade (1900 + ciclos concluídos). */
  year?: number;
  population?: number;
}

export interface MaterialCost {
  resource: ResourceId;
  /** Rank mínimo aceito para o material (padrão D). */
  minRank?: Rank;
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
    /** Combustível por ciclo; a geração segue o rendimento do Rank (RANK_YIELD). */
    fuel?: { resource: ResourceId; qty: number };
  };
  /** Precisa estar encostado em água (ex.: hidrelétrica). */
  needsWaterAdjacent?: boolean;
  /** Precisa encostar no mar (água salgada, Fase 9). */
  needsSeaAdjacent?: boolean;
  /** Fase 9: só em terreno alto (nível mínimo). */
  minElevation?: number;
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
  /** Água (Fase 6): bomba, poço da prefeitura, caixa d'água ou estação de tratamento. */
  water?: { kind: "pump" | "well" | "tower" | "treatment" | "desal"; capacity: number };
  /** Serviço público (Fase 7): cobertura em raio ou atendimento por capacidade. */
  service?: {
    kind: "police" | "fire" | "prison" | "hospital" | "school" | "college" | "library" | "museum" | "leisure";
    /** Raio de cobertura (tiles) — polícia, bombeiros e lazer. */
    radius?: number;
    /** Moradores atendidos (hospital, escola, faculdade). */
    capacity?: number;
    /** Valorização do solo ao redor (pontos no centro, caindo até a borda do raio). */
    landValue?: number;
    /** Poluição absorvida ao redor (parques). */
    cleans?: number;
    /** Bônus de demanda residencial e comercial enquanto existir (atrações). */
    demand?: number;
  };
  /** Via pintada arrastando (estrada, rodovia, trilho): sprite plano que se liga aos vizinhos. */
  linear?: boolean;
  /** Transporte (Fase 8): demanda extra para comércio/indústria (aeroporto, porto). */
  transport?: { kind: "bus" | "station" | "airport" | "seaport"; demand?: { C?: number; I?: number } };
  /** Poluição emitida (Fase 7). */
  pollution?: number;
  /** Capacidade extra de estoque por recurso (armazém, silo). */
  storage?: Partial<Record<ResourceId, number>>;
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
    materials: [{ resource: "wood", qty: 1 }],
    upkeep: 1,
    workers: 0,
    needsRoad: false,
    color: 0x4a4a52,
    height: 0,
    linear: true,
  },
  // ── Fase 8: transporte ──
  highway: {
    category: "transport",
    name: "Rodovia",
    description: "Comporta o dobro de carros e as viagens rendem 3× mais. Liga-se às estradas só por acessos.",
    buildable: true,
    cost: 40,
    materials: [{ resource: "wood", qty: 1 }, { resource: "metal", qty: 1 }],
    upkeep: 3,
    workers: 0,
    needsRoad: false,
    color: 0x5a5a66,
    height: 0,
    linear: true,
  },
  tunnel: {
    category: "transport",
    name: "Túnel",
    description: "Estrada que atravessa o morro: liga vias com qualquer desnível. Só em terreno de nível 2+.",
    buildable: true,
    cost: 120,
    materials: [{ resource: "ore", qty: 2 }, { resource: "metal", qty: 1 }],
    upkeep: 2,
    workers: 0,
    needsRoad: false,
    minElevation: 2,
    color: 0x3a3a42,
    height: 0,
  },
  onramp: {
    category: "transport",
    name: "Acesso à rodovia",
    description: "Trevo que liga a estrada à rodovia.",
    buildable: true,
    cost: 60,
    materials: [{ resource: "metal", qty: 1 }],
    upkeep: 2,
    workers: 0,
    needsRoad: false,
    color: 0x6a6a76,
    height: 0,
  },
  rail: {
    category: "transport",
    name: "Trilho",
    description: "Trens levam muitos passageiros sem congestionar. Entra-se pelas estações.",
    buildable: true,
    requires: { year: 1901 },
    cost: 25,
    materials: [{ resource: "wood", qty: 1 }, { resource: "metal", qty: 1 }],
    upkeep: 1,
    workers: 0,
    needsRoad: false,
    color: 0x7a6a5a,
    height: 0,
    linear: true,
  },
  bus_stop: {
    category: "transport",
    name: "Ponto de ônibus",
    description: "Em pares: quem mora e trabalha perto de pontos vai de ônibus e alivia as ruas (raio 4).",
    buildable: true,
    cost: 60,
    materials: [{ resource: "planks", qty: 1 }, { resource: "metal", qty: 1 }],
    upkeep: 2,
    workers: 1,
    needsRoad: true,
    transport: { kind: "bus" },
    color: 0xd8b84a,
    height: 10,
  },
  train_station: {
    category: "transport",
    name: "Estação de trem",
    description: "Liga estrada e trilho. Indústria perto da estação produz 25% mais (frete).",
    buildable: true,
    requires: { year: 1901 },
    cost: 300,
    materials: [{ resource: "planks", qty: 6 }, { resource: "metal", qty: 4 }],
    upkeep: 4,
    workers: 3,
    powerUse: 1,
    needsRoad: true,
    transport: { kind: "station" },
    color: 0xa0603a,
    height: 16,
  },
  airport: {
    category: "transport",
    name: "Aeroporto",
    description: "Impulsiona o comércio (+15% de demanda). Barulhento. Requer 200 habitantes.",
    buildable: true,
    requires: { population: 200 },
    cost: 3000,
    materials: [{ resource: "metal", qty: 20 }, { resource: "planks", qty: 10 }],
    upkeep: 15,
    workers: 8,
    powerUse: 5,
    needsRoad: true,
    pollution: 6,
    transport: { kind: "airport", demand: { C: 0.15 } },
    color: 0xc8c8d0,
    height: 14,
  },
  seaport: {
    category: "transport",
    name: "Porto",
    description: "À beira d'água: impulsiona a indústria (+15% de demanda). Requer 60 habitantes.",
    buildable: true,
    requires: { population: 60 },
    cost: 1500,
    materials: [{ resource: "planks", qty: 12 }, { resource: "metal", qty: 6 }],
    upkeep: 8,
    workers: 6,
    needsRoad: true,
    needsWaterAdjacent: true,
    pollution: 4,
    transport: { kind: "seaport", demand: { I: 0.15 } },
    color: 0x5a7a9a,
    height: 16,
  },
  cityhall: {
    category: "special",
    generates: { capacity: 12 },
    water: { kind: "well", capacity: 20 },
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
    materials: [{ resource: "wood", qty: 4 }],
    upkeep: 2,
    workers: 3,
    needsRoad: true,
    produces: { resource: "food", base: 12 },
    color: 0xc9a94a,
    height: 6,
  },
  lumberyard: {
    pollution: 1,
    category: "production",
    powerUse: 2,
    name: "Madeireira",
    description: "Extrai madeira. Rendimento alto em florestas.",
    buildable: true,
    cost: 100,
    materials: [{ resource: "wood", qty: 2 }],
    upkeep: 3,
    workers: 3,
    needsRoad: true,
    produces: { resource: "wood", base: 8 },
    color: 0x8a5a2b,
    height: 12,
  },
  mine: {
    pollution: 5,
    category: "production",
    powerUse: 3,
    name: "Mina",
    description: "Extrai minério. Rendimento alto em montanhas.",
    buildable: true,
    cost: 150,
    materials: [{ resource: "wood", qty: 4 }, { resource: "planks", qty: 2 }],
    upkeep: 4,
    workers: 4,
    needsRoad: true,
    produces: { resource: "ore", base: 6 },
    color: 0x7d7f8a,
    height: 10,
  },
  sawmill: {
    pollution: 3,
    category: "production",
    powerUse: 3,
    name: "Serraria",
    description: "Madeira → tábuas. Tech Tier limita o rank a B.",
    buildable: true,
    cost: 200,
    materials: [{ resource: "wood", qty: 6 }],
    upkeep: 5,
    workers: 4,
    needsRoad: true,
    processes: { input: "wood", inputQty: 4, output: "planks", outputQty: 4, tierCap: "B" },
    color: 0xb07a3c,
    height: 18,
  },
  smelter: {
    pollution: 10,
    category: "production",
    powerUse: 6,
    name: "Fundição",
    description: "Minério → metal. Tech Tier alto: entrega até rank S.",
    buildable: true,
    cost: 300,
    materials: [{ resource: "planks", qty: 6 }, { resource: "metal", qty: 2 }],
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
    pollution: 14,
    name: "Termelétrica",
    description: "Queima 4 madeiras por ciclo: 30 MW com madeira D, até 42 MW com madeira S.",
    buildable: true,
    category: "energy",
    cost: 600,
    materials: [{ resource: "planks", qty: 8 }, { resource: "metal", qty: 6 }],
    upkeep: 8,
    workers: 3,
    needsRoad: true,
    generates: { capacity: 30, fuel: { resource: "wood", qty: 4 } },
    color: 0x5a4a4a,
    height: 26,
  },
  wind_turbine: {
    name: "Eólica",
    description: "Energia limpa e barata, mas pouca: 6 MW, variando com o vento da estação.",
    buildable: true,
    category: "energy",
    cost: 150,
    materials: [{ resource: "metal", qty: 4 }, { resource: "planks", qty: 2 }],
    upkeep: 1,
    workers: 0,
    needsRoad: false,
    generates: { capacity: 6, climate: "wind" },
    color: 0xdfe8f0,
    height: 34,
  },
  water_pump: {
    name: "Bomba d'água",
    description: "Poço: 25 de água por estação; encostada em lago ou rio, 50. Precisa de energia; a seca reduz.",
    buildable: true,
    category: "water",
    cost: 100,
    materials: [{ resource: "metal", qty: 2 }],
    upkeep: 2,
    workers: 1,
    powerUse: 2,
    needsRoad: false,
    water: { kind: "pump", capacity: 25 },
    color: 0x4a7ab0,
    height: 10,
  },
  water_tower: {
    name: "Caixa d'água",
    description: "Guarda até 60 de água que sobrar e abastece nas estações secas.",
    buildable: true,
    category: "water",
    cost: 250,
    materials: [{ resource: "planks", qty: 4 }, { resource: "metal", qty: 2 }],
    upkeep: 1,
    workers: 0,
    needsRoad: false,
    water: { kind: "tower", capacity: 60 },
    color: 0x8ab0d0,
    height: 30,
  },
  water_treatment: {
    name: "Estação de tratamento",
    description: "Recicla 30% da água consumida na rede (até 40 por estação). Disponível em 1903.",
    buildable: true,
    category: "water",
    requires: { year: 1903 },
    cost: 500,
    materials: [{ resource: "metal", qty: 6 }, { resource: "planks", qty: 4 }],
    upkeep: 4,
    workers: 2,
    powerUse: 3,
    needsRoad: true,
    water: { kind: "treatment", capacity: 40 },
    color: 0x5a8a9a,
    height: 14,
  },
  // ── Fase 9: água salgada e orla ──
  desalination: {
    name: "Dessalinizadora",
    description: "No litoral: transforma água do mar em 80 de água potável (2× uma bomba de rio). Cara e gasta muita energia.",
    buildable: true,
    category: "water",
    requires: { population: 100 },
    cost: 1200,
    materials: [{ resource: "metal", qty: 10 }, { resource: "planks", qty: 4 }],
    upkeep: 10,
    workers: 4,
    powerUse: 6,
    needsRoad: true,
    needsSeaAdjacent: true,
    water: { kind: "desal", capacity: 80 },
    color: 0x7ab0d0,
    height: 14,
  },
  marina: {
    name: "Marina",
    description: "À beira d'água: barcos e passeio. Valoriza muito o entorno e atrai moradores.",
    buildable: true,
    category: "leisure",
    requires: { population: 60 },
    cost: 600,
    materials: [{ resource: "planks", qty: 8 }, { resource: "metal", qty: 2 }],
    upkeep: 4,
    workers: 2,
    needsRoad: true,
    needsWaterAdjacent: true,
    service: { kind: "leisure", radius: 5, landValue: 18, cleans: 3, demand: 0.06 },
    color: 0x4a8ab0,
    height: 10,
  },
  // ── Fase 7: serviços e lazer ──
  police: {
    name: "Delegacia",
    description: "Reduz o crime num raio de 8 tiles e valoriza o bairro.",
    buildable: true,
    category: "services",
    cost: 500,
    materials: [{ resource: "planks", qty: 4 }, { resource: "metal", qty: 2 }],
    upkeep: 6,
    workers: 4,
    powerUse: 2,
    needsRoad: true,
    service: { kind: "police", radius: 8, landValue: 6 },
    color: 0x3a5a9a,
    height: 16,
  },
  fire_station: {
    name: "Bombeiros",
    description: "Protege contra incêndios num raio de 8 tiles e barateia o seguro.",
    buildable: true,
    category: "services",
    cost: 500,
    materials: [{ resource: "planks", qty: 4 }, { resource: "metal", qty: 2 }],
    upkeep: 6,
    workers: 4,
    powerUse: 2,
    needsRoad: true,
    service: { kind: "fire", radius: 8, landValue: 4 },
    color: 0xb03a2a,
    height: 16,
  },
  prison: {
    name: "Prisão",
    description: "Com crime alto, deixa todas as delegacias 30% mais eficientes. Requer 120 habitantes.",
    buildable: true,
    category: "services",
    requires: { population: 120 },
    cost: 1500,
    materials: [{ resource: "metal", qty: 10 }, { resource: "planks", qty: 6 }],
    upkeep: 12,
    workers: 6,
    powerUse: 3,
    needsRoad: true,
    service: { kind: "prison", landValue: -15, radius: 4 },
    color: 0x6a6a6a,
    height: 14,
  },
  hospital: {
    name: "Hospital",
    description: "Atende 150 moradores: a expectativa de vida sobe aos poucos.",
    buildable: true,
    category: "services",
    cost: 600,
    materials: [{ resource: "planks", qty: 6 }, { resource: "metal", qty: 4 }],
    upkeep: 8,
    workers: 6,
    powerUse: 3,
    needsRoad: true,
    service: { kind: "hospital", capacity: 150, radius: 5, landValue: 5 },
    color: 0xe8e8e8,
    height: 22,
  },
  school: {
    name: "Escola",
    description: "Atende 120 moradores e eleva a educação (QE) até 90.",
    buildable: true,
    category: "services",
    cost: 250,
    materials: [{ resource: "planks", qty: 6 }],
    upkeep: 4,
    workers: 3,
    powerUse: 1,
    needsRoad: true,
    service: { kind: "school", capacity: 120, radius: 5, landValue: 6 },
    color: 0xd89a3a,
    height: 14,
  },
  college: {
    name: "Faculdade",
    description: "Atende 300 moradores e leva o QE até 140 (precisa de escolas). Requer 120 habitantes.",
    buildable: true,
    category: "services",
    requires: { population: 120 },
    cost: 1000,
    materials: [{ resource: "planks", qty: 10 }, { resource: "metal", qty: 6 }],
    upkeep: 10,
    workers: 6,
    powerUse: 3,
    needsRoad: true,
    service: { kind: "college", capacity: 300, radius: 6, landValue: 10 },
    color: 0x8a4a3a,
    height: 22,
  },
  library: {
    name: "Biblioteca",
    description: "Impede que o QE dos adultos caia e valoriza o bairro.",
    buildable: true,
    category: "services",
    cost: 500,
    materials: [{ resource: "planks", qty: 8 }],
    upkeep: 3,
    workers: 2,
    powerUse: 1,
    needsRoad: true,
    service: { kind: "library", radius: 5, landValue: 8 },
    color: 0xc8b890,
    height: 14,
  },
  museum: {
    name: "Museu",
    description: "Como a biblioteca, e ainda atrai visitantes. Disponível em 1905.",
    buildable: true,
    category: "services",
    requires: { year: 1905 },
    cost: 1000,
    materials: [{ resource: "planks", qty: 6 }, { resource: "metal", qty: 6 }],
    upkeep: 4,
    workers: 2,
    powerUse: 2,
    needsRoad: true,
    service: { kind: "museum", radius: 6, landValue: 12, demand: 0.05 },
    color: 0xe0d8c8,
    height: 20,
  },
  plaza: {
    name: "Praça",
    description: "Pequena área verde: valoriza o entorno e limpa um pouco o ar.",
    buildable: true,
    category: "leisure",
    cost: 20,
    materials: [{ resource: "wood", qty: 2 }],
    upkeep: 0,
    workers: 0,
    needsRoad: false,
    service: { kind: "leisure", radius: 2, landValue: 8, cleans: 4 },
    color: 0x7ac060,
    height: 0,
  },
  park: {
    name: "Parque",
    description: "Área verde grande: valoriza o dobro da praça e limpa mais o ar.",
    buildable: true,
    category: "leisure",
    cost: 150,
    materials: [{ resource: "wood", qty: 3 }, { resource: "food", qty: 2 }],
    upkeep: 1,
    workers: 0,
    needsRoad: false,
    service: { kind: "leisure", radius: 4, landValue: 16, cleans: 10 },
    color: 0x4a9a40,
    height: 0,
  },
  zoo: {
    name: "Zoológico",
    description: "Grande atração: valoriza a região e aumenta a procura por moradia e comércio.",
    buildable: true,
    category: "leisure",
    requires: { population: 80 },
    cost: 1000,
    materials: [{ resource: "planks", qty: 10 }, { resource: "metal", qty: 4 }],
    upkeep: 6,
    workers: 4,
    needsRoad: true,
    service: { kind: "leisure", radius: 5, landValue: 14, cleans: 6, demand: 0.08 },
    color: 0x9ab04a,
    height: 10,
  },
  stadium: {
    name: "Estádio",
    description: "Atração da cidade (e base para grandes eventos). Requer 150 habitantes.",
    buildable: true,
    category: "leisure",
    requires: { population: 150 },
    cost: 1500,
    materials: [{ resource: "metal", qty: 12 }, { resource: "planks", qty: 10 }],
    upkeep: 10,
    workers: 6,
    powerUse: 4,
    needsRoad: true,
    service: { kind: "leisure", radius: 5, landValue: 6, demand: 0.1 },
    color: 0xb0b0c0,
    height: 18,
  },
  warehouse: {
    name: "Armazém",
    description: "+150 de estoque para madeira, minério, tábuas, metal e bens.",
    buildable: true,
    category: "storage",
    cost: 120,
    materials: [{ resource: "wood", qty: 6 }, { resource: "planks", qty: 2 }],
    upkeep: 1,
    workers: 1,
    needsRoad: true,
    storage: { wood: 150, ore: 150, planks: 150, metal: 150, goods: 150 },
    color: 0x9a7a5a,
    height: 14,
  },
  silo: {
    name: "Silo",
    description: "+200 de estoque de comida e menos comida estragada.",
    buildable: true,
    category: "storage",
    cost: 100,
    materials: [{ resource: "wood", qty: 4 }, { resource: "planks", qty: 2 }],
    upkeep: 1,
    workers: 0,
    needsRoad: true,
    storage: { food: 200 },
    color: 0xc9c2b0,
    height: 22,
  },
  hydro_plant: {
    name: "Hidrelétrica",
    description: "30 MW sem combustível, variando com a chuva da estação. Precisa encostar na água. Disponível em 1902.",
    buildable: true,
    category: "energy",
    requires: { year: 1902 },
    cost: 900,
    materials: [{ resource: "metal", qty: 10 }, { resource: "planks", qty: 10 }],
    upkeep: 4,
    workers: 2,
    needsRoad: false,
    needsWaterAdjacent: true,
    generates: { capacity: 30, climate: "hydro" },
    color: 0x4a7aa0,
    height: 16,
  },
};


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
  /** Materiais consumidos a cada nível novo de um lote: [leve, densa]. */
  growth: [MaterialCost[], MaterialCost[]];
}

export const ZONES: Record<ZoneKind, ZoneDef> = {
  R: { name: "Residencial", short: "R", cost: [5, 10], maxLevel: [2, 4], perLevel: 4, powerPerLevel: 0.5, color: 0x5fbf5a, denseRequires: { population: 40 }, growth: [[{ resource: "planks", qty: 1 }], [{ resource: "planks", qty: 2 }]] },
  C: { name: "Comercial", short: "C", cost: [5, 10], maxLevel: [2, 4], perLevel: 3, powerPerLevel: 0.75, color: 0x4a8fd8, denseRequires: { population: 40 }, growth: [[{ resource: "planks", qty: 1 }], [{ resource: "planks", qty: 1 }, { resource: "metal", qty: 1 }]] },
  I: { name: "Industrial", short: "I", cost: [5, 10], maxLevel: [2, 4], perLevel: 4, powerPerLevel: 1, color: 0xd8b84a, denseRequires: { population: 40 }, growth: [[{ resource: "planks", qty: 1 }], [{ resource: "planks", qty: 1 }, { resource: "metal", qty: 1 }]] },
};

export const WIRE_COST = 2;
export const PIPE_COST = 3;

export const RESOURCES: Record<ResourceId, { name: string; color: number; icon: string; use: string }> = {
  food: { name: "Comida", color: 0xc9a94a, icon: "🌾", use: "Moradores comem 0,5 por pessoa a cada estação; parques usam um pouco." },
  wood: { name: "Madeira", color: 0x8a5a2b, icon: "🪵", use: "Estradas, praças, aquecimento no frio e a serraria (vira tábuas)." },
  ore: { name: "Minério", color: 0x7d7f8a, icon: "🪨", use: "A fundição transforma em metal; túneis usam direto." },
  planks: { name: "Tábuas", color: 0xb07a3c, icon: "🪚", use: "Quase toda construção e o crescimento dos lotes." },
  metal: { name: "Metal", color: 0xa34a3a, icon: "⚙️", use: "Construções grandes, prédios densos, rodovias e trilhos." },
  goods: { name: "Bens", color: 0x6a7ad0, icon: "🛍️", use: "Moradores consomem a partir de 30 habitantes; a indústria fabrica." },
};

/** Produção assimétrica: cada bioma favorece matérias-primas diferentes. */
export const BIOMES: Record<BiomeId, { name: string; yield: Record<ResourceId, number>; grass: number }> = {
  plains: {
    name: "Planície",
    yield: { food: 1.5, wood: 0.75, ore: 0.5, planks: 1, metal: 1, goods: 1 },
    grass: 0x5d8a3a,
  },
  forest: {
    name: "Floresta",
    yield: { food: 1.0, wood: 1.5, ore: 0.5, planks: 1, metal: 1, goods: 1 },
    grass: 0x3f6e34,
  },
  desert: {
    name: "Deserto",
    yield: { food: 0.6, wood: 0.5, ore: 1.3, planks: 1, metal: 1, goods: 1 },
    grass: 0xc2a46a,
  },
  tundra: {
    name: "Tundra",
    yield: { food: 0.5, wood: 1.1, ore: 1.1, planks: 1, metal: 1, goods: 1 },
    grass: 0x8a9a8a,
  },
  mountains: {
    name: "Montanhas",
    yield: { food: 0.5, wood: 1.0, ore: 1.5, planks: 1, metal: 1, goods: 1 },
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
