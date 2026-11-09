import { BIOMES, BUILDINGS, WASTE_BY_RANK } from "./catalog";
import {
  DAILY_REWARD_CAP,
  FOOD_PER_RESIDENT,
  SESSION_GAP_MS,
  STREAK_PENALTY,
  TAX_PER_RESIDENT,
} from "./config";
import { cloneState } from "./commands";
import { addTo, averageRank, minRank, take, totalAtLeast } from "./inventory";
import { RANKS, type Building, type CityState, type CycleReport, type Inventory, type Rank } from "./types";
import { connectedRoads, isRoadConnected, utcDayKey } from "./world";

/** Sequência → Rank: 1 ciclo = D, 2 = C, 3 = B, 4 = A, 5+ = S. */
export function rankForStreak(streak: number): Rank {
  return RANKS[Math.max(0, Math.min(streak, RANKS.length) - 1)];
}

/** Sequência efetiva no momento `now`, já aplicando o decaimento por inatividade. */
export function effectiveStreak(s: CityState, now: number): number {
  if (s.lastCycleAt !== null && now - s.lastCycleAt > SESSION_GAP_MS) {
    return Math.max(0, s.streak - STREAK_PENALTY);
  }
  return s.streak;
}

export interface BuildingStatus {
  connected: boolean;
  staffed: number;
  required: number;
  /** 0..1 — fração de operação (precisa de estrada e trabalhadores). */
  efficiency: number;
}

/** Status de cada construção: conexão viária e alocação de trabalhadores (por ordem de id). */
export function buildingStatus(s: CityState): Map<number, BuildingStatus> {
  const network = connectedRoads(s);
  const out = new Map<number, BuildingStatus>();
  let freeWorkers = s.population;
  const ordered = [...s.buildings].sort((a, b) => a.id - b.id);
  for (const b of ordered) {
    const def = BUILDINGS[b.type];
    const connected = !def.needsRoad || isRoadConnected(s, b, network);
    let staffed = 0;
    if (connected && def.workers > 0) {
      staffed = Math.min(def.workers, freeWorkers);
      freeWorkers -= staffed;
    }
    const efficiency = !connected ? 0 : def.workers === 0 ? 1 : staffed / def.workers;
    out.set(b.id, { connected, staffed, required: def.workers, efficiency });
  }
  return out;
}

export function housingCapacity(s: CityState, status = buildingStatus(s)): number {
  let cap = 0;
  for (const b of s.buildings) {
    const h = BUILDINGS[b.type].housing;
    if (h && status.get(b.id)?.connected) cap += h;
  }
  return cap;
}

const addInv = (inv: Inventory, res: Parameters<typeof addTo>[1], taken: Partial<Record<Rank, number>>) => {
  for (const r of RANKS) addTo(inv, res, r, taken[r] ?? 0);
};

/**
 * Resolve um ciclo de foco concluído. Função pura: (estado, agora) → novo estado + relatório.
 * O servidor só a chama depois de validar que o tempo do ciclo realmente passou.
 */
export function resolveCycle(s: CityState, now: number): { state: CityState; report: CycleReport } {
  const next = cloneState(s);

  const today = utcDayKey(now);
  if (next.dayKey !== today) {
    next.dayKey = today;
    next.cyclesToday = 0;
  }
  next.streak = effectiveStreak(next, now) + 1;
  next.cyclesCompleted++;
  next.cyclesToday++;
  next.lastCycleAt = now;
  next.version++;

  const rank = rankForStreak(next.streak);
  const rewarded = next.cyclesToday <= DAILY_REWARD_CAP;
  const report: CycleReport = {
    rank,
    streak: next.streak,
    rewarded,
    produced: {},
    consumed: {},
    wasted: {},
    taxes: 0,
    upkeep: 0,
    populationBefore: s.population,
    populationAfter: s.population,
    starving: false,
    netMoney: 0,
  };
  // Acima do limite diário: o ciclo conta, mas a cidade não roda (nem cobra manutenção).
  if (!rewarded) return { state: next, report };

  // 0) Mudança: com comida no armazém (ou cidade vazia), novos moradores chegam
  //    ANTES do turno de trabalho — assim o primeiro ciclo já produz.
  const cap = housingCapacity(next);
  const hasFood = totalAtLeast(next.inventory, "food") >= Math.ceil(next.population * FOOD_PER_RESIDENT) + 1;
  if (next.population === 0 || hasFood) {
    next.population = Math.min(cap, next.population + Math.max(8, Math.ceil(cap * 0.5)));
  }
  next.population = Math.min(next.population, cap);

  const status = buildingStatus(next);
  const ordered: Building[] = [...next.buildings].sort((a, b) => a.id - b.id);
  const biome = BIOMES[next.biome];

  // 1) Extração: a pureza do lote vem da qualidade do foco.
  for (const b of ordered) {
    const def = BUILDINGS[b.type];
    const eff = status.get(b.id)!.efficiency;
    if (!def.produces || eff <= 0) continue;
    const qty = Math.floor(def.produces.base * biome.yield[def.produces.resource] * eff);
    addTo(next.inventory, def.produces.resource, rank, qty);
    addTo(report.produced, def.produces.resource, rank, qty);
  }

  // 2) Refino: rank de saída = min(rank médio do insumo, Tech Tier); insumo ruim gera perda.
  for (const b of ordered) {
    const p = BUILDINGS[b.type].processes;
    const eff = status.get(b.id)!.efficiency;
    if (!p || eff <= 0) continue;
    const inputQty = Math.max(1, Math.floor(p.inputQty * eff));
    const taken = take(next.inventory, p.input, inputQty, { prefer: "high" });
    if (!taken) continue;
    addInv(report.consumed, p.input, taken);
    const inRank = averageRank(taken);
    const gross = Math.round((p.outputQty * inputQty) / p.inputQty);
    const out = Math.round(gross * (1 - WASTE_BY_RANK[inRank]));
    const outRank = minRank(inRank, p.tierCap);
    addTo(next.inventory, p.output, outRank, out);
    addTo(report.produced, p.output, outRank, out);
    addTo(report.wasted, p.output, outRank, gross - out);
  }

  // 3) População consome comida (ranks baixos primeiro) e paga impostos.
  const foodNeeded = Math.ceil(next.population * FOOD_PER_RESIDENT);
  const fed = foodNeeded === 0 || totalAtLeast(next.inventory, "food") >= foodNeeded;
  if (foodNeeded > 0) {
    const eaten = take(next.inventory, "food", Math.min(foodNeeded, totalAtLeast(next.inventory, "food")), {
      prefer: "low",
    });
    if (eaten) addInv(report.consumed, "food", eaten);
  }
  report.starving = !fed;
  const taxBonus = ordered.reduce((acc, b) => {
    const bonus = BUILDINGS[b.type].taxBonus ?? 0;
    return acc + (status.get(b.id)!.connected ? bonus : 0);
  }, 0);
  report.taxes = Math.floor(next.population * TAX_PER_RESIDENT * (fed ? 1 : 0.5) * (1 + taxBonus));

  // 4) Manutenção: estradas e construções custam a cada ciclo concluído.
  report.upkeep = ordered.reduce((acc, b) => acc + BUILDINGS[b.type].upkeep, 0);
  next.money += report.taxes - report.upkeep;
  report.netMoney = report.taxes - report.upkeep;

  // 5) Fome: parte dos moradores vai embora.
  if (!fed) next.population = Math.floor(next.population * 0.9);
  report.populationAfter = next.population;

  return { state: next, report };
}

/** Penalidade por abandonar o ciclo: a sequência decai em vez de zerar. */
export function abandonCycle(s: CityState): CityState {
  const next = cloneState(s);
  next.streak = Math.max(0, next.streak - STREAK_PENALTY);
  next.version++;
  return next;
}
