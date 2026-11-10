import { BUILDINGS, FUEL_EFFICIENCY, ZONES } from "./catalog";
import { bfsDistances, components } from "./grid";
import { averageRank, getQty } from "./inventory";
import { effectsOf, weatherAt } from "./climate";
import { RANKS, ZONE, ZONE_KINDS, type Building, type CityState, type ClimateEffects, type Rank } from "./types";
import { buildingStatus } from "./status";

export interface PowerResult {
  /** Capacidade total gerada (MW). */
  capacity: number;
  /** Consumo total pedido (MW). */
  demand: number;
  /** Consumo efetivamente atendido (MW). */
  supplied: number;
  /** 1 = tile energizado. */
  powered: Uint8Array;
  /** 1 = tile conduz energia (linha, construção, lote zoneado). */
  conductive: Uint8Array;
  /** Capacidade de cada usina (id → MW). */
  plantOutput: Map<number, number>;
  brownout: boolean;
}

/** Consumo do tile em MW (construção operando ou lote desenvolvido). */
export function tileDemand(
  s: CityState,
  i: number,
  buildingAtTile: Map<number, Building>,
  connected: (b: Building) => boolean,
  effects: ClimateEffects = effectsOf(null),
) {
  const b = buildingAtTile.get(i);
  if (b) {
    const use = BUILDINGS[b.type].powerUse ?? 0;
    return use > 0 && connected(b) ? use : 0;
  }
  const z = s.zoneType[i];
  if (z === 0 || s.zoneLevel[i] === 0) return 0;
  const base = ZONES[ZONE_KINDS[z - 1]].powerPerLevel * s.zoneLevel[i];
  // Aquecimento/refrigeração pesam em casas e comércio; a indústria consome o mesmo o ano todo.
  return z === ZONE.I ? base : Math.round(base * effects.demand * 100) / 100;
}

/** Rank médio do combustível que seria queimado agora (maiores ranks primeiro), sem consumi-lo. */
export function bestFuelRank(s: CityState, resource: Parameters<typeof getQty>[1], qty: number): Rank | null {
  let left = qty;
  const taken: Partial<Record<Rank, number>> = {};
  for (const r of [...RANKS].reverse()) {
    const t = Math.min(left, getQty(s.inventory, resource, r));
    if (t > 0) {
      taken[r] = t;
      left -= t;
    }
  }
  return left > 0 ? null : averageRank(taken);
}

/**
 * Capacidade de cada usina. Por padrão estima a termelétrica com o combustível em estoque;
 * o ciclo passa `fuelRanks` com o Rank do combustível realmente queimado.
 */
export function plantCapacities(
  s: CityState,
  fuelRanks?: Map<number, Rank | null>,
  effects: ClimateEffects = effectsOf(weatherAt(s)),
): Map<number, number> {
  const status = buildingStatus(s);
  const out = new Map<number, number>();
  for (const b of s.buildings) {
    const gen = BUILDINGS[b.type].generates;
    if (!gen) continue;
    const st = status.get(b.id)!;
    let cap = gen.capacity * st.efficiency;
    if (gen.fuel) {
      const rank = fuelRanks ? (fuelRanks.get(b.id) ?? null) : bestFuelRank(s, gen.fuel.resource, gen.fuel.qty);
      cap = rank ? cap * FUEL_EFFICIENCY[rank] : 0;
    }
    if (gen.climate) cap *= effects[gen.climate];
    out.set(b.id, Math.round(cap * 10) / 10);
  }
  return out;
}

/**
 * Distribui energia pela rede. Energia percorre linhas, construções e lotes zoneados adjacentes.
 * Em cada componente, os consumidores são atendidos em ordem de distância às usinas;
 * quando a capacidade acaba, os mais distantes ficam sem luz (apagão).
 */
export function computePower(
  s: CityState,
  capacities?: Map<number, number>,
  effects: ClimateEffects = effectsOf(weatherAt(s)),
): PowerResult {
  capacities ??= plantCapacities(s, undefined, effects);
  const n = s.width * s.height;
  const buildingAtTile = new Map<number, Building>();
  for (const b of s.buildings) buildingAtTile.set(b.y * s.width + b.x, b);

  const conductive = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const b = buildingAtTile.get(i);
    if (s.wires[i] === 1 || s.zoneType[i] !== 0 || (b && b.type !== "road")) conductive[i] = 1;
  }

  const status = buildingStatus(s);
  const connected = (b: Building) => status.get(b.id)?.connected ?? false;
  const comp = components(s, (i) => conductive[i] === 1);

  const sources: number[] = [];
  const supplyByComp = new Map<number, number>();
  let capacity = 0;
  for (const b of [...s.buildings].sort((a, c) => a.id - c.id)) {
    const cap = capacities.get(b.id);
    if (cap === undefined) continue;
    const i = b.y * s.width + b.x;
    sources.push(i);
    capacity += cap;
    supplyByComp.set(comp[i], (supplyByComp.get(comp[i]) ?? 0) + cap);
  }

  const powered = new Uint8Array(n);
  let demand = 0;
  let supplied = 0;
  for (let i = 0; i < n; i++) if (conductive[i]) demand += tileDemand(s, i, buildingAtTile, connected, effects);

  const { order } = bfsDistances(s, sources, (i) => conductive[i] === 1);
  const remaining = new Map(supplyByComp);
  for (const i of order) {
    const c = comp[i];
    const left = remaining.get(c) ?? 0;
    const need = tileDemand(s, i, buildingAtTile, connected, effects);
    if (need === 0) {
      if (left > 0) powered[i] = 1;
      continue;
    }
    if (left >= need) {
      powered[i] = 1;
      remaining.set(c, left - need);
      supplied += need;
    }
  }

  const round = (v: number) => Math.round(v * 10) / 10;
  return {
    capacity: round(capacity),
    demand: round(demand),
    supplied: round(supplied),
    powered,
    conductive,
    plantOutput: capacities,
    brownout: supplied + 1e-9 < demand,
  };
}
