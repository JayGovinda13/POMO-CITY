import { BIOMES, BUILDINGS, WASTE_BY_RANK, ZONES } from "./catalog";
import {
  DAILY_REWARD_CAP,
  FOOD_PER_RESIDENT,
  GOODS_MIN_POPULATION,
  GOODS_PER_INDUSTRY_JOB,
  GOODS_PER_RESIDENT,
  HEATING_WOOD_PER_RESIDENT,
  SESSION_GAP_MS,
  STREAK_PENALTY,
  TAX_PER_JOB,
  TAX_PER_RESIDENT,
} from "./config";
import { cloneState } from "./commands";
import { addTo, averageRank, getQty, minRank, take } from "./inventory";
import { effectsOf, weatherAt, type Weather } from "./climate";
import {
  RESOURCE_IDS,
  consumeEquivalent,
  importQuote,
  payMaterials,
  quoteMaterials,
  sellUnits,
  stockOf,
  storageCapacity,
  unitsToSell,
} from "./economy";
import { computePower, plantCapacities, type PowerResult } from "./power";
import {
  ORDINANCES,
  ORDINANCE_IDS,
  ROAD_REPAIR,
  ROAD_WEAR_PER_POINT,
  annualInterest,
  departmentOf,
  isActive,
  taxRevenue,
} from "./finance";
import { buildingStatus, laborStats } from "./status";
import { RANKS, type Building, type CityState, type ClimateEffects, type CycleReport, type Inventory, type Rank, type ResourceId } from "./types";
import { calendarIdx, quarterOfCycle, rng, roadAccess, utcDayKey, yearOfCycle } from "./world";
import { developZones } from "./zones";
import { BONUS_MIN, premium } from "./insurance";
import { computeWater, updateTowers, type WaterResult } from "./water";
import { citizensView, moodSummary, syncCitizens } from "./citizens";
import { computeServices, landValueTaxFactor, updateQuality, type ServiceFields } from "./services";

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

const addTaken = (inv: Inventory, res: ResourceId, taken: Partial<Record<Rank, number>>) => {
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
  water?: WaterResult;
  services?: ServiceFields;
  /** Estoque no início do ciclo (para o balanço por recurso). */
  startStock: Record<ResourceId, number>;
}

type CycleSystem = (ctx: CycleContext) => void;

/**
 * Consumo com importação automática: usa o estoque (ranks baixos primeiro) e compra o que faltar.
 * Devolve o que ficou faltando (só quando nem o dinheiro cobre).
 */
function consumeOrImport(ctx: CycleContext, res: ResourceId, need: number): number {
  const { s, report, effects } = ctx;
  if (need <= 0) return 0;
  const { taken, shortfall } = consumeEquivalent(s.inventory, res, need, { prefer: "low" });
  addTaken(report.consumed, res, taken);
  if (shortfall <= 0) return 0;
  const q = importQuote(res, shortfall, "D", effects);
  if (!q.rank) return shortfall;
  // Compra o que o dinheiro alcança.
  const unitPrice = q.units ? q.cost / q.units : 0;
  const units = unitPrice > 0 ? Math.min(q.units, Math.floor(Math.max(0, s.money) / unitPrice)) : q.units;
  const cost = Math.ceil(units * unitPrice);
  s.money -= cost;
  report.importCost += cost;
  addTo(report.bought, res, q.rank, units);
  addTo(report.consumed, res, q.rank, units);
  return Math.max(0, shortfall - units);
}

/** 1) Lotes crescem/declinam (energia, acesso viário, demanda). Cada nível novo consome materiais. */
const zoneGrowthSystem: CycleSystem = (ctx) => {
  const { s, report, effects } = ctx;
  const power = computePower(s, undefined, effects);
  const water = computeWater(s, effects, buildingStatus(s, power.powered));
  const approval = moodSummary(citizensView(s)).approval;
  const r = developZones(s, {
    rank: ctx.rank,
    rand: ctx.rand,
    powered: power.powered,
    access: roadAccess(s),
    approval,
    watered: water.watered,
    services: computeServices(s, buildingStatus(s, power.powered)),
    pay: (kind, dense) => {
      const mats = ZONES[kind].growth[dense ? 1 : 0];
      const quote = quoteMaterials(s, mats, effects);
      if (quote.impossible || s.money < quote.importCost) return false;
      report.importCost += payMaterials(s, mats, effects, { consumed: report.consumed, bought: report.bought });
      return true;
    },
  });
  report.zones = { grown: r.grown, declined: r.declined };
};

/** 2) Mudança: novos moradores chegam antes do turno de trabalho (a comida pode ser importada). */
const moveInSystem: CycleSystem = ({ s }) => {
  const cap = laborStats(s).housing;
  s.population = Math.min(cap, s.population + Math.max(8, Math.ceil(cap * 0.5)));
};

/** 3) Usinas queimam combustível (comprado se faltar); a geração segue o rendimento do Rank. */
const powerSystem: CycleSystem = (ctx) => {
  const { s, report, effects } = ctx;
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
    if (taken) {
      fuelRanks.set(b.id, averageRank(taken));
      addTaken(report.consumed, fuel.resource, taken);
      continue;
    }
    // Sem combustível no estoque: compra no mercado (qualidade D).
    const q = importQuote(fuel.resource, fuel.qty, "D", effects);
    if (q.rank && s.money >= q.cost) {
      s.money -= q.cost;
      report.importCost += q.cost;
      addTo(report.bought, fuel.resource, q.rank, q.units);
      addTo(report.consumed, fuel.resource, q.rank, q.units);
      fuelRanks.set(b.id, q.rank);
    } else fuelRanks.set(b.id, null);
  }
  ctx.power = computePower(s, plantCapacities(s, fuelRanks, effects), effects);
  ctx.status = buildingStatus(s, ctx.power.powered);
  report.power = { capacity: ctx.power.capacity, demand: ctx.power.demand, brownout: ctx.power.brownout };
};

/** 3b) Água: bombas (com energia), poço da prefeitura, tratamento e caixas d'água (Fase 6). */
const waterSystem: CycleSystem = (ctx) => {
  const { s, report, effects, status } = ctx;
  const w = computeWater(s, effects, status);
  ctx.water = w;
  report.water = { produced: w.produced, stored: w.stored, demand: w.demand, supplied: w.supplied, shortage: w.shortage };
  updateTowers(s, w);
};

/** 3c) Serviços (Fase 7): crime, poluição, valor do solo e coberturas; QE e expectativa de vida. */
const servicesSystem: CycleSystem = (ctx) => {
  const { s, report, status } = ctx;
  const f = computeServices(s, status);
  ctx.services = f;
  updateQuality(s, f);
  report.services = {
    crime: f.avg.crime,
    pollution: f.avg.pollution,
    landValue: f.avg.landValue,
    eq: s.eq,
    lifeExpectancy: s.lifeExpectancy,
  };
};

/** 4) Extração e fábricas: a pureza do lote vem da qualidade do foco. */
const extractionSystem: CycleSystem = ({ s, report, rank, status, effects, water }) => {
  const biome = BIOMES[s.biome];
  for (const b of byId(s.buildings)) {
    const def = BUILDINGS[b.type];
    const eff = status!.get(b.id)!.efficiency;
    if (!def.produces || eff <= 0) continue;
    // A colheita depende do tempo da estação (Fase 2).
    // Fazenda irrigada (com água) segura a colheita na seca e no frio (Fase 6).
    const irrigated = water?.watered[b.y * s.width + b.x] === 1;
    const climate = def.produces.resource === "food" ? (irrigated ? Math.max(effects.farm, 0.85) : effects.farm) : 1;
    // Decreto "Prêmio de produtividade": +15% em ciclos de Rank A ou S (Fase 4).
    const bonus = isActive(s, "premio_produtividade") && (rank === "A" || rank === "S") ? 1.15 : 1;
    const qty = Math.floor(def.produces.base * biome.yield[def.produces.resource] * eff * climate * bonus);
    addTo(s.inventory, def.produces.resource, rank, qty);
    addTo(report.produced, def.produces.resource, rank, qty);
  }
  // Zonas industriais fabricam bens de consumo (empregos industriais ocupados).
  const labor = laborStats(s, status);
  const industryFilled = Math.max(0, labor.zoneFilled - labor.commercialJobs);
  const goods = Math.floor(industryFilled * GOODS_PER_INDUSTRY_JOB);
  addTo(s.inventory, "goods", rank, goods);
  addTo(report.produced, "goods", rank, goods);
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

/**
 * 6) Os moradores vivem dos recursos: comida, lenha no frio e bens de consumo. O que faltar a
 * cidade compra; só passa fome quem nem o dinheiro alcança. Moradores e empregos pagam impostos.
 */
const economySystem: CycleSystem = (ctx) => {
  const { s, report, status, weather } = ctx;
  const pop = s.population;
  const hungry = consumeOrImport(ctx, "food", pop * FOOD_PER_RESIDENT);
  report.starving = hungry > 0;
  if (weather && weather.temp < 10) consumeOrImport(ctx, "wood", pop * HEATING_WOOD_PER_RESIDENT);
  if (pop >= GOODS_MIN_POPULATION) consumeOrImport(ctx, "goods", pop * GOODS_PER_RESIDENT);

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
  // Impostos por zona (Fase 4): moradores (R), empregos do comércio (C) e da indústria (I).
  const f = report.finance;
  const m = 1 + taxBonus;
  // Valor do solo define a riqueza dos moradores e o imposto residencial (Fase 7).
  const lv = ctx.services && ctx.services.avg.landValue > 0 ? landValueTaxFactor(ctx.services.avg.landValue) : 1;
  f.taxR = Math.floor(taxRevenue("R", pop * (report.starving ? 0.5 : 1), s.taxes.R) * m * lv);
  f.taxC = Math.floor(taxRevenue("C", labor.commercialFilled, s.taxes.C) * m);
  f.taxI = Math.floor(taxRevenue("I", labor.industrialFilled, s.taxes.I) * m);
  report.taxes = f.taxR + f.taxC + f.taxI;
  // Decretos: receita ou custo por ciclo.
  for (const id of ORDINANCE_IDS) {
    if (!isActive(s, id)) continue;
    const v = ORDINANCES[id].money(s);
    if (v >= 0) f.ordinanceRevenue += v;
    else f.ordinanceCost += -v;
  }
  s.money += report.taxes + f.ordinanceRevenue - f.ordinanceCost;
};

/** 7) Manutenção: estradas e construções custam a cada ciclo concluído. */
const upkeepSystem: CycleSystem = ({ s, report }) => {
  // A verba de cada departamento (Fase 4) reduz a manutenção paga — e cobra o preço depois.
  const f = report.finance;
  let transport = 0;
  let energy = 0;
  let other = 0;
  let services = 0;
  for (const b of s.buildings) {
    const cost = BUILDINGS[b.type].upkeep;
    const dept = departmentOf(b.type);
    if (dept === "transport") transport += cost;
    else if (dept === "energy") energy += cost;
    else if (dept) services += (cost * (s.funding[dept] ?? 100)) / 100;
    else other += cost;
  }
  f.upkeepTransport = Math.ceil((transport * s.funding.transport) / 100);
  f.upkeepEnergy = Math.ceil((energy * s.funding.energy) / 100);
  f.upkeepServices = Math.ceil(services);
  f.upkeepOther = other;
  report.upkeep = f.upkeepTransport + f.upkeepEnergy + f.upkeepServices + f.upkeepOther;
  s.money -= report.upkeep;
};

/** 7b) Conservação das estradas: verba integral recupera; verba reduzida desgasta até danificar. */
const roadsSystem: CycleSystem = ({ s }) => {
  const fund = s.funding.transport;
  for (const b of s.buildings) {
    if (b.type !== "road") continue;
    const c = b.condition ?? 100;
    const next = fund >= 100 ? Math.min(100, c + ROAD_REPAIR) : Math.max(0, c - (100 - fund) * ROAD_WEAR_PER_POINT);
    if (next >= 100) delete b.condition;
    else b.condition = Math.round(next);
  }
};

/** 7c) Juros dos títulos: cobrados uma vez por ano, ao fim do 4º trimestre. */
const interestSystem: CycleSystem = ({ s, report }) => {
  if (s.cyclesCompleted % 4 !== 0 || !s.bonds.length) return;
  report.finance.interest = annualInterest(s);
  s.money -= report.finance.interest;
};

/**
 * 8) Estoque: comida estraga (menos com silo; mais no calor úmido), a política de cada recurso
 * vende o excedente (só até o Rank B) e o que passar da capacidade é vendido.
 */
const storageSystem: CycleSystem = ({ s, report, effects, weather }) => {
  // Comida estragada.
  const hasSilo = s.buildings.some((b) => b.type === "silo");
  const humidHeat = weather && weather.temp > 22 && weather.rain > 300;
  const spoil = (humidHeat ? 0.15 : 0.08) * (hasSilo ? 0.4 : 1);
  for (const r of RANKS) {
    const have = getQty(s.inventory, "food", r);
    const lost = Math.floor(have * spoil);
    if (lost <= 0) continue;
    take(s.inventory, "food", lost, { minRank: r, prefer: "low" });
    addTo(report.lost, "food", r, lost);
  }

  const capacity = storageCapacity(s);
  // Comida: a reserva considera quem já mora e quem vai morar nas casas construídas.
  const housing = laborStats(s).housing;
  for (const res of RESOURCE_IDS) {
    // Política: demanda estimada = o que a cidade consumiu neste ciclo (comida: no mínimo a
    // necessidade dos moradores atuais e das casas prontas).
    let demand = RANKS.reduce((acc, r) => acc + getQty(report.consumed, res, r), 0);
    if (res === "food") demand = Math.max(demand, Math.ceil(Math.max(s.population, housing) * FOOD_PER_RESIDENT));
    const sellable = RANKS.slice(0, 3).reduce((acc, r) => acc + getQty(s.inventory, res, r), 0);
    // Cidade ainda sem moradores não vende nada pela política (só o excesso de estoque).
    const units = s.population > 0 ? unitsToSell(s.policies[res], sellable, demand) : 0;
    if (units > 0) {
      const sale = sellUnits(s.inventory, res, units, effects);
      addTaken(report.sold, res, sale.sold);
      report.salesRevenue += sale.revenue;
    }
    // Excesso de estoque: vendido (inclusive A/S, pelo preço de B, se só sobrar premium).
    const excess = stockOf(s.inventory, res) - capacity[res];
    if (excess > 0) {
      let sale = sellUnits(s.inventory, res, excess, effects);
      let soldUnits = RANKS.reduce((acc, r) => acc + (sale.sold[r] ?? 0), 0);
      addTaken(report.sold, res, sale.sold);
      report.salesRevenue += sale.revenue;
      if (soldUnits < excess) {
        sale = sellUnits(s.inventory, res, excess - soldUnits, effects, { allowPremium: true });
        addTaken(report.sold, res, sale.sold);
        report.salesRevenue += sale.revenue;
      }
    }
  }
  s.money += report.salesRevenue;
};

/** 9) Fome: parte dos moradores vai embora. */
const starvationSystem: CycleSystem = ({ s, report }) => {
  if (report.starving) s.population = Math.floor(s.population * 0.9);
  report.populationAfter = s.population;
};

/** 10) Moradores: chegam novos (ids novos) ou vão embora os mais tristes; humor final no relatório. */
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

/** 11) Balanço por recurso e saldo final do ciclo. */
const ledgerSystem: CycleSystem = ({ s, report, startStock }) => {
  const sum = (inv: Inventory, res: ResourceId) => RANKS.reduce((acc, r) => acc + getQty(inv, res, r), 0);
  const capacity = storageCapacity(s);
  for (const res of RESOURCE_IDS) {
    const row = {
      produced: sum(report.produced, res),
      consumed: sum(report.consumed, res),
      bought: sum(report.bought, res),
      sold: sum(report.sold, res),
      lost: sum(report.lost, res),
      stock: stockOf(s.inventory, res),
      capacity: capacity[res],
    };
    if (row.produced || row.consumed || row.bought || row.sold || row.lost || row.stock || startStock[res]) report.ledger[res] = row;
  }
  const f = report.finance;
  f.imports = report.importCost;
  f.sales = report.salesRevenue;
  report.netMoney =
    report.taxes +
    f.ordinanceRevenue -
    f.ordinanceCost -
    report.upkeep -
    f.interest -
    f.insurance -
    report.importCost +
    report.salesRevenue;
};

/**
 * 7d) Seguro: cobra o prêmio da estação (sem dinheiro, a apólice é cancelada) e, a cada ano
 * sem sinistro, dá bônus no prêmio — maior para quem mantém sequências longas de foco.
 */
const insuranceSystem: CycleSystem = ({ s, report }) => {
  if (s.insurance.plan === "none") return;
  const p = premium(s);
  if (s.money < p) {
    s.insurance = { ...s.insurance, plan: "none" };
    report.insuranceLapsed = true;
    return;
  }
  s.money -= p;
  report.finance.insurance = p;
  if (s.cyclesCompleted % 4 === 0) {
    const last = s.insurance.lastClaimCycle;
    const claimedThisYear = last !== null && s.cyclesCompleted - last <= 4;
    if (!claimedThisYear) {
      const bonus = 0.05 + (s.streak >= 8 ? 0.02 : 0);
      s.insurance = { ...s.insurance, bonusMalus: Math.max(BONUS_MIN, Math.round((s.insurance.bonusMalus - bonus) * 100) / 100) };
    }
  }
};

export const CYCLE_SYSTEMS: CycleSystem[] = [
  zoneGrowthSystem,
  moveInSystem,
  powerSystem,
  waterSystem,
  servicesSystem,
  extractionSystem,
  refiningSystem,
  economySystem,
  upkeepSystem,
  roadsSystem,
  interestSystem,
  insuranceSystem,
  storageSystem,
  starvationSystem,
  citizensSystem,
  ledgerSystem,
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
  // Ciclo concluído: zera a contagem de ciclos quebrados seguidos (Fase 5).
  next.breaks = 0;
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
    bought: {},
    importCost: 0,
    sold: {},
    salesRevenue: 0,
    lost: {},
    ledger: {},
    taxes: 0,
    upkeep: 0,
    finance: {
      taxR: 0,
      taxC: 0,
      taxI: 0,
      ordinanceRevenue: 0,
      ordinanceCost: 0,
      sales: 0,
      imports: 0,
      upkeepTransport: 0,
      upkeepEnergy: 0,
      upkeepServices: 0,
      upkeepOther: 0,
      interest: 0,
      insurance: 0,
    },
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

  // O tempo é o da estação vivida, calculado sobre o estado ANTES do ciclo avançar.
  const weather = weatherAt(s);
  if (weather) {
    const { season, label, temp, rain, wind, effects } = weather;
    report.weather = { season, label, temp, rain, wind, effects };
  }
  const startStock = Object.fromEntries(RESOURCE_IDS.map((r) => [r, stockOf(s.inventory, r)])) as Record<ResourceId, number>;
  // Seed por cidade + ciclo: o mesmo ciclo sempre gera o mesmo resultado (cliente = servidor).
  const rand = rng((next.seed ^ Math.imul(next.cyclesCompleted, 0x9e3779b1)) >>> 0);
  const ctx: CycleContext = { s: next, report, rank, rand, weather, effects: effectsOf(weather), startStock };
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
