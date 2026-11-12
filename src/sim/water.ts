// Fase 6 — Água. Bombas (poço ou à beira d'água), caixas d'água, estação de tratamento e canos
// numa camada subterrânea. A água passa por canos, construções e lotes zoneados adjacentes
// ("os moradores instalam o encanamento"); estradas interrompem a rede, a menos que um cano
// passe por baixo. O tempo da estação define quanto as bombas tiram.

import { BUILDINGS } from "./catalog";
import { techMods } from "./tech";
import { effectsOf, weatherAt } from "./climate";
import { bfsDistances, components, DIRS4 } from "./grid";
import { buildingStatus } from "./status";
import { ZONE, ZONE_KINDS, type Building, type CityState, type ClimateEffects } from "./types";

/** Água por nível de lote (R/C/I) e por construção, em unidades por estação. */
export const WATER_PER_LEVEL: Record<"R" | "C" | "I", number> = { R: 1, C: 0.75, I: 1.5 };
export const WATER_BUILDING_USE: Partial<Record<keyof typeof BUILDINGS, number>> = {
  farm: 3,
  lumberyard: 1,
  mine: 2,
  sawmill: 2,
  smelter: 3,
  thermal_plant: 4,
};
/** Capacidade de cada caixa d'água. */
export const TOWER_CAPACITY = 60;
/** A estação de tratamento recicla esta fração da água consumida na sua rede (até o limite). */
export const TREATMENT_SHARE = 0.3;
export const TREATMENT_MAX = 40;

const near = (s: CityState, x: number, y: number, pred: (i: number) => boolean) =>
  DIRS4.some(([dx, dy]) => {
    const nx = x + dx;
    const ny = y + dy;
    return nx >= 0 && ny >= 0 && nx < s.width && ny < s.height && pred(ny * s.width + nx);
  });

/** Perto de água doce (rio, lago): a bomba rende o dobro. Água do mar não serve para bomba. */
export const isNearWater = (s: CityState, b: Pick<Building, "x" | "y">) => near(s, b.x, b.y, (i) => s.terrain[i] === 1);

export function tileWaterDemand(s: CityState, i: number, buildingAtTile: Map<number, Building>): number {
  const b = buildingAtTile.get(i);
  if (b) return b.damaged ? 0 : (WATER_BUILDING_USE[b.type] ?? 0);
  const z = s.zoneType[i];
  if (z === ZONE.NONE || !s.zoneLevel[i]) return 0;
  return WATER_PER_LEVEL[ZONE_KINDS[z - 1]] * s.zoneLevel[i];
}

export interface WaterResult {
  /** Água produzida pelas fontes (bombas, prefeitura, tratamento). */
  produced: number;
  /** Água guardada nas caixas d'água no início. */
  stored: number;
  demand: number;
  supplied: number;
  shortage: boolean;
  /** 1 = tile abastecido. */
  watered: Uint8Array;
  conductive: Uint8Array;
  /** Por componente da rede: produção, consumo atendido e caixas d'água (para a atualização no ciclo). */
  networks: { produced: number; used: number; towers: number[] }[];
}

/** Rede de água: componentes conectados, fontes, caixas d'água e distribuição por proximidade. */
export function computeWater(
  s: CityState,
  effects: ClimateEffects = effectsOf(weatherAt(s)),
  status: ReturnType<typeof buildingStatus> = buildingStatus(s),
): WaterResult {
  const n = s.width * s.height;
  const buildingAtTile = new Map<number, Building>();
  for (const b of s.buildings) buildingAtTile.set(b.y * s.width + b.x, b);

  const conductive = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const b = buildingAtTile.get(i);
    if (s.pipes[i] === 1 || s.zoneType[i] !== ZONE.NONE || (b && b.type !== "road")) conductive[i] = 1;
  }
  const comp = components(s, (i) => conductive[i] === 1);

  // Demanda por componente (a estação de tratamento recicla parte dela).
  const demandByComp = new Map<number, number>();
  let demand = 0;
  for (let i = 0; i < n; i++) {
    if (!conductive[i]) continue;
    const d = tileWaterDemand(s, i, buildingAtTile);
    if (!d) continue;
    demand += d;
    demandByComp.set(comp[i], (demandByComp.get(comp[i]) ?? 0) + d);
  }

  const sources: number[] = [];
  const nets = new Map<number, { produced: number; stored: number; towers: number[] }>();
  const net = (c: number) => {
    let v = nets.get(c);
    if (!v) nets.set(c, (v = { produced: 0, stored: 0, towers: [] }));
    return v;
  };
  let produced = 0;
  let stored = 0;
  for (const b of [...s.buildings].sort((a, c) => a.id - c.id)) {
    const def = BUILDINGS[b.type].water;
    if (!def) continue;
    const i = b.y * s.width + b.x;
    const eff = status.get(b.id)?.efficiency ?? 0;
    let out = 0;
    if (def.kind === "pump") out = def.capacity * (isNearWater(s, b) ? 2 : 1) * effects.water * eff;
    else if (def.kind === "treatment") out = Math.min(TREATMENT_MAX, (demandByComp.get(comp[i]) ?? 0) * TREATMENT_SHARE) * eff;
    else if (def.kind === "well") out = def.capacity * effects.water;
    // Dessalinizadora (Fase 9): a água do mar não depende de chuva.
    else if (def.kind === "desal") out = def.capacity * eff;
    else if (def.kind === "tower") {
      const st = b.damaged ? 0 : (b.water ?? 0);
      net(comp[i]).towers.push(b.id);
      net(comp[i]).stored += st;
      stored += st;
      sources.push(i);
      continue;
    }
    // Tecnologia (saneamento, água do futuro…): fontes rendem mais.
    out = Math.round(out * (1 + techMods(s).water) * 10) / 10;
    sources.push(i);
    net(comp[i]).produced += out;
    produced += out;
  }

  // Distribuição: mais perto das fontes primeiro; faltando água, os mais distantes ficam secos.
  const watered = new Uint8Array(n);
  const remaining = new Map([...nets].map(([c, v]) => [c, v.produced + v.stored]));
  const used = new Map<number, number>();
  let supplied = 0;
  const { order } = bfsDistances(s, sources, (i) => conductive[i] === 1);
  for (const i of order) {
    const c = comp[i];
    const left = remaining.get(c) ?? 0;
    const need = tileWaterDemand(s, i, buildingAtTile);
    if (need === 0) {
      if (left > 0) watered[i] = 1;
      continue;
    }
    if (left >= need) {
      watered[i] = 1;
      remaining.set(c, left - need);
      used.set(c, (used.get(c) ?? 0) + need);
      supplied += need;
    }
  }

  const round = (v: number) => Math.round(v * 10) / 10;
  return {
    produced: round(produced),
    stored: round(stored),
    demand: round(demand),
    supplied: round(supplied),
    shortage: supplied + 1e-9 < demand,
    watered,
    conductive,
    networks: [...nets].map(([c, v]) => ({ produced: v.produced, used: used.get(c) ?? 0, towers: v.towers })),
  };
}

/**
 * Fim do ciclo: as caixas d'água guardam a sobra (até a capacidade) ou cobrem a falta.
 * Muta os edifícios de `s`.
 */
export function updateTowers(s: CityState, result: WaterResult): void {
  const byId = new Map(s.buildings.map((b) => [b.id, b]));
  for (const net of result.networks) {
    if (!net.towers.length) continue;
    const towers = net.towers.map((id) => byId.get(id)!).filter((b) => !b.damaged);
    const before = towers.reduce((acc, b) => acc + (b.water ?? 0), 0);
    const after = Math.max(0, Math.min(towers.length * TOWER_CAPACITY, before + net.produced - net.used));
    // Reparte igualmente entre as caixas da mesma rede.
    for (const b of towers) b.water = Math.round((after / towers.length) * 10) / 10;
  }
}

/** Lote denso sem água não passa do nível 2. */
export const DRY_DENSE_MAX_LEVEL = 2;
