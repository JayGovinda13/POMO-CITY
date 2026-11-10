import { BIOMES, BUILDINGS, WASTE_BY_RANK } from "./catalog";
import {
  DAILY_REWARD_CAP,
  FOOD_PER_RESIDENT,
  SESSION_GAP_MS,
  STREAK_PENALTY,
  TAX_PER_JOB,
  TAX_PER_RESIDENT,
} from "./config";
import { cloneState } from "./commands";
import { addTo, averageRank, minRank, take, totalAtLeast } from "./inventory";
import { effectsOf, weatherAt, type Weather } from "./climate";
import { computePower, plantCapacities, type PowerResult } from "./power";
import { buildingStatus, laborStats } from "./status";
import { RANKS, type Building, type CityState, type ClimateEffects, type CycleReport, type Rank } from "./types";
import { calendarIdx, quarterOfCycle, rng, roadAccess, utcDayKey, yearOfCycle } from "./world";
import { developZones } from "./zones";
import { citizensView, moodSummary, syncCitizens } from "./citizens";

/** Sequência → Rank: 1 ciclo = D, 2 = C, 3 = B, 4 = A, 5+ = S. */
export function rankForStreak(streak: number): Rank {
  return RANKS[Math.max(0, Math.min(streak, RANKS.length) - 1)];
}

/** Sequência efetiva no momento `now`, já aplicando o decaimento por inatividade. */
export function effectiveStreak(s: CityState, now: number): number {
  // Saiu pelo menu: a sequência está guardada e não decai.
  if (s.streakFrozen) return s.streak;
  if (s.lastCycleAt !== null && now - s.lastCycleAt > SESSION_GAP_MS) {
    return Math.max(0, s.streak - STREAK_PENALTY);
  }
  return s.streak;
}

/** Capacidade de moradia. */
export const housingCapacity = (s: CityState) => laborStats(s).housing;

const addTaken = (inv: CycleReport["consumed"], res: Parameters<typeof addTo>[1], taken: Partial<Record<Rank, number>>) => {
  for (const r of RANKS) addTo(inv, res, r, taken[r] ?? 0);
};

const byId = (bs: Building[]) => [...bs].sort((a, b) => a.id - b.id);

// ───────────────────────── Pipeline de sistemas ─────────────────────────
// Cada fase do roadmap acrescenta sistemas aqui. A ordem importa e é documentada.

interface CycleContext {
  s: CityState;
  report: CycleReport;
  rank: Rank;
  rand: () => number;
  /** Tempo da estação que este ciclo viveu (null = sem região: clima neutro). */
  weather: Weather | null;
  effects: ClimateEffects;
  power?: PowerResult;
  status?: ReturnType<typeof buildingStatus>;
}

type CycleSystem = (ctx: CycleContext) => void;

/** 1) Lotes crescem/declinam com base em energia, acesso viário e demanda (estimativa pré-ciclo). */
const zoneGrowthSystem: CycleSystem = (ctx) => {
  const power = computePower(ctx.s, undefined, ctx.effects);
  const approval = moodSummary(citizensView(ctx.s)).approval;
  const r = developZones(ctx.s, { rank: ctx.rank, rand: ctx.rand, powered: power.powered, access: roadAccess(ctx.s), approval });
  ctx.report.zones = { grown: r.grown, declined: r.declined };
};

/** 2) Mudança: com comida no armazém (ou cidade vazia), moradores chegam antes do turno de trabalho. */
const moveInSystem: CycleSystem = ({ s }) => {
  const cap = laborStats(s).housing;
  const hasFood = totalAtLeast(s.inventory, "food") >= Math.ceil(s.population * FOOD_PER_RESIDENT) + 1;
  if (s.population === 0 || hasFood) {
    s.population = Math.min(cap, s.population + Math.max(8, Math.ceil(cap * 0.5)));
  }
  s.population = Math.min(s.population, cap);
};

/** 3) Usinas queimam combustível (o Rank define a eficiência) e a rede é distribuída. */
const powerSystem: CycleSystem = (ctx) => {
  const { s, report } = ctx;
  const status = buildingStatus(s);
  const fuelRanks = new Map<number, Rank | null>();
  for (const b of byId(s.buildings)) {
    const fuel = BUILDINGS[b.type].generates?.fuel;
    if (!fuel) continue;
    if ((status.get(b.id)?.efficiency ?? 0) <= 0) {
      fuelRanks.set(b.id, null);
      continue;
    }
    const taken = take(s.inventory, fuel.resource, fuel.qty, { prefer: "high" });
    fuelRanks.set(b.id, taken ? averageRank(taken) : null);
    if (taken) addTaken(report.consumed, fuel.resource, taken);
  }
  ctx.power = computePower(s, plantCapacities(s, fuelRanks, ctx.effects), ctx.effects);
  ctx.status = buildingStatus(s, ctx.power.powered);
  report.power = { capacity: ctx.power.capacity, demand: ctx.power.demand, brownout: ctx.power.brownout };
};

/** 4) Extração: a pureza do lote vem da qualidade do foco. */
const extractionSystem: CycleSystem = ({ s, report, rank, status, effects }) => {
  const biome = BIOMES[s.biome];
  for (const b of byId(s.buildings)) {
    const def = BUILDINGS[b.type];
    const eff = status!.get(b.id)!.efficiency;
    if (!def.produces || eff <= 0) continue;
    // A colheita depende do tempo da estação (Fase 2).
    const climate = def.produces.resource === "food" ? effects.farm : 1;
    const qty = Math.floor(def.produces.base * biome.yield[def.produces.resource] * eff * climate);
    addTo(s.inventory, def.produces.resource, rank, qty);
    addTo(report.produced, def.produces.resource, rank, qty);
  }
};

/** 5) Refino: rank de saída = min(rank médio do insumo, Tech Tier); insumo ruim gera perda. */
const refiningSystem: CycleSystem = ({ s, report, status }) => {
  for (const b of byId(s.buildings)) {
    const p = BUILDINGS[b.type].processes;
    const eff = status!.get(b.id)!.efficiency;
    if (!p || eff <= 0) continue;
    const inputQty = Math.max(1, Math.floor(p.inputQty * eff));
    const taken = take(s.inventory, p.input, inputQty, { prefer: "high" });
    if (!taken) continue;
    addTaken(report.consumed, p.input, taken);
    const inRank = averageRank(taken);
    const gross = Math.round((p.outputQty * inputQty) / p.inputQty);
    const out = Math.round(gross * (1 - WASTE_BY_RANK[inRank]));
    const outRank = minRank(inRank, p.tierCap);
    addTo(s.inventory, p.output, outRank, out);
    addTo(report.produced, p.output, outRank, out);
    addTo(report.wasted, p.output, outRank, gross - out);
  }
};

/** 6) População come (ranks baixos primeiro); moradores e empregos de C/I pagam impostos. */
const economySystem: CycleSystem = ({ s, report, status }) => {
  const foodNeeded = Math.ceil(s.population * FOOD_PER_RESIDENT);
  const available = totalAtLeast(s.inventory, "food");
  const fed = foodNeeded === 0 || available >= foodNeeded;
  if (foodNeeded > 0) {
    const eaten = take(s.inventory, "food", Math.min(foodNeeded, available), { prefer: "low" });
    if (eaten) addTaken(report.consumed, "food", eaten);
  }
  report.starving = !fed;

  const labor = laborStats(s, status);
  report.jobs = {
    total: labor.totalJobs,
    filled: labor.publicFilled + labor.zoneFilled,
    unemployed: labor.unemployed,
  };
  const taxBonus = s.buildings.reduce((acc, b) => {
    const bonus = BUILDINGS[b.type].taxBonus ?? 0;
    return acc + (status!.get(b.id)!.connected ? bonus : 0);
  }, 0);
  const base = s.population * TAX_PER_RESIDENT * (fed ? 1 : 0.5) + labor.zoneFilled * TAX_PER_JOB;
  report.taxes = Math.floor(base * (1 + taxBonus));
};

/** 7) Manutenção: estradas e construções custam a cada ciclo concluído. */
const upkeepSystem: CycleSystem = ({ s, report }) => {
  report.upkeep = s.buildings.reduce((acc, b) => acc + BUILDINGS[b.type].upkeep, 0);
  report.netMoney = report.taxes - report.upkeep;
  s.money += report.netMoney;
};

/** 8) Fome: parte dos moradores vai embora. */
const starvationSystem: CycleSystem = ({ s, report }) => {
  if (report.starving) s.population = Math.floor(s.population * 0.9);
  report.populationAfter = s.population;
};

/** 9) Moradores: chegam novos (ids novos) ou vão embora os mais tristes; humor final no relatório. */
const citizensSystem: CycleSystem = ({ s, report }) => {
  const before = new Set(s.citizens);
  syncCitizens(s);
  const after = new Set(s.citizens);
  const m = moodSummary(citizensView(s));
  report.citizens = {
    feliz: m.feliz,
    ok: m.ok,
    triste: m.triste,
    arrived: [...after].filter((id) => !before.has(id)).length,
    left: [...before].filter((id) => !after.has(id)).length,
  };
};

export const CYCLE_SYSTEMS: CycleSystem[] = [
  zoneGrowthSystem,
  moveInSystem,
  powerSystem,
  extractionSystem,
  refiningSystem,
  economySystem,
  upkeepSystem,
  starvationSystem,
  citizensSystem,
];

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
  next.streakFrozen = false;
  next.cyclesCompleted++;
  next.cyclesToday++;
  next.lastCycleAt = now;
  next.version++;

  const rank = rankForStreak(next.streak);
  const rewarded = next.cyclesToday <= DAILY_REWARD_CAP;
  const report: CycleReport = {
    rank,
    streak: next.streak,
    // A estação vivida é a do ciclo que acabou de ser concluído.
    year: yearOfCycle(calendarIdx(s)),
    quarter: quarterOfCycle(calendarIdx(s)),
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
    power: { capacity: 0, demand: 0, brownout: false },
    weather: null,
    zones: { grown: 0, declined: 0 },
    jobs: { total: 0, filled: 0, unemployed: 0 },
  };
  // Acima do limite diário: o ciclo conta, mas a cidade não roda (nem cobra manutenção).
  if (!rewarded) return { state: next, report };

  // Seed por cidade + ciclo: o mesmo ciclo sempre gera o mesmo resultado (cliente = servidor).
  const rand = rng((next.seed ^ Math.imul(next.cyclesCompleted, 0x9e3779b1)) >>> 0);
  // O tempo é o da estação vivida, calculado sobre o estado ANTES do ciclo avançar.
  const weather = weatherAt(s);
  if (weather) {
    const { season, label, temp, rain, wind, effects } = weather;
    report.weather = { season, label, temp, rain, wind, effects };
  }
  const ctx: CycleContext = { s: next, report, rank, rand, weather, effects: effectsOf(weather) };
  for (const system of CYCLE_SYSTEMS) system(ctx);
  return { state: next, report };
}

/** Penalidade por abandonar o ciclo: a sequência decai em vez de zerar. */
export function abandonCycle(s: CityState): CityState {
  const next = cloneState(s);
  next.streak = Math.max(0, next.streak - STREAK_PENALTY);
  next.version++;
  return next;
}
