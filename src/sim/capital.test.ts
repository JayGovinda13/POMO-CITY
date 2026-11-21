import { describe, expect, it } from "vitest";
import {
  BUILDINGS,
  BASE_PRICE,
  LIFE,
  NEUTRAL_EFFECTS,
  RANK_YIELD,
  ageOf,
  applyCommands,
  buildCyclesOf,
  buildingStatus,
  carryingCost,
  createCity,
  cyclesToReady,
  exportPrice,
  importPrice,
  isDown,
  migrateState,
  renewCost,
  resolveCycle,
  stockValue,
  storageCostOf,
  tradeDiscount,
  underConstruction,
  wearFactor,
  type CityState,
  type Command,
} from "./index";

const T0 = Date.UTC(2026, 10, 12, 12);
const at = (s: CityState, x: number, y: number) => y * s.width + x;

/** Cidade com fazenda e estrada ligada à prefeitura, pronta para produzir. */
function farmTown(): CityState {
  const s = createCity(7, T0, "plains");
  s.terrain = s.terrain.map(() => 0);
  s.money = 50_000;
  const cmds: Command[] = [];
  for (let x = 13; x <= 17; x++) cmds.push({ type: "build", building: "road", x, y: 12 });
  cmds.push({ type: "wire", x: 12, y: 11 });
  cmds.push({ type: "zone", zone: "R", dense: false, x0: 13, y0: 11, x1: 14, y1: 11 });
  cmds.push({ type: "build", building: "farm", x: 15, y: 11 });
  const r = applyCommands(s, cmds);
  expect(r.rejected).toEqual([]);
  // Moradia para 16 (2 lotes nível 2): sem moradores a fazenda não tem quem contratar.
  r.state.zoneLevel[at(r.state, 13, 11)] = 2;
  r.state.zoneLevel[at(r.state, 14, 11)] = 2;
  r.state.population = 16;
  return r.state;
}

describe("obras longas", () => {
  it("o tempo de obra segue o custo: casas e estradas na hora, usinas e aeroportos em ciclos", () => {
    expect(buildCyclesOf("road")).toBe(0);
    expect(buildCyclesOf("farm")).toBe(0);
    expect(buildCyclesOf("hydro_plant")).toBe(1);
    expect(buildCyclesOf("solar_plant")).toBe(2);
    expect(buildCyclesOf("airport")).toBe(3);
    expect(buildCyclesOf("nuclear_plant")).toBe(3);
    expect(buildCyclesOf("fusion_plant")).toBe(4);
  });

  it("o comando de construir marca o prédio em obra até o ciclo certo", () => {
    const s = farmTown();
    s.population = 300;
    s.cyclesCompleted = 10;
    const r = applyCommands(s, [{ type: "build", building: "airport", x: 16, y: 13 }]);
    expect(r.rejected).toEqual([]);
    const air = r.state.buildings.find((b) => b.type === "airport")!;
    expect(air.readyAt).toBe(13);
    expect(underConstruction(air, r.state)).toBe(true);
    expect(cyclesToReady(air, r.state)).toBe(3);
    // Prédio comum não tem obra.
    expect(r.state.buildings.find((b) => b.type === "farm")!.readyAt).toBeUndefined();
  });

  it("em obra não opera nem contrata; pronta, passa a operar", () => {
    const s = farmTown();
    const farm = s.buildings.find((b) => b.type === "farm")!;
    farm.readyAt = 3; // simula uma obra de 3 ciclos
    expect(isDown(farm, s)).toBe(true);
    expect(buildingStatus(s).get(farm.id)!.efficiency).toBe(0);
    expect(buildingStatus(s).get(farm.id)!.staffed).toBe(0);
    const early = resolveCycle(s, T0).report.produced["food:D"] ?? 0;
    expect(early).toBe(0);
    s.cyclesCompleted = 3;
    expect(isDown(farm, s)).toBe(false);
    expect(buildingStatus(s).get(farm.id)!.efficiency).toBeGreaterThan(0);
  });

  it("capital parado: a obra paga juros de 2% do custo por ciclo, em vez de manutenção", () => {
    const s = farmTown();
    const farm = s.buildings.find((b) => b.type === "farm")!;
    const normal = resolveCycle(s, T0).report.upkeep;
    farm.readyAt = 5;
    const dentro = resolveCycle(s, T0).report.upkeep;
    expect(carryingCost("farm")).toBe(Math.ceil(BUILDINGS.farm.cost * 0.02));
    expect(dentro).toBe(normal - BUILDINGS.farm.upkeep + carryingCost("farm"));
  });
});

describe("desgaste e renovação", () => {
  it("rendimento: 100% até a vida útil e cai até 50% em 1,5× a vida", () => {
    const s = createCity(1, T0);
    const farm = { type: "farm" as const, builtAt: 0 };
    const at_ = (age: number) => wearFactor(farm, { ...s, cyclesCompleted: age });
    expect(LIFE.farm).toBe(80);
    expect(at_(0)).toBe(1);
    expect(at_(80)).toBe(1);
    expect(at_(100)).toBeCloseTo(0.75);
    expect(at_(120)).toBeCloseTo(0.5);
    expect(at_(400)).toBeCloseTo(0.5);
    // Sem vida útil (estrada, escola) não envelhece.
    expect(wearFactor({ type: "road", builtAt: 0 }, { cyclesCompleted: 999 })).toBe(1);
  });

  it("a fazenda velha colhe menos e renovar devolve o rendimento", () => {
    const s = farmTown();
    const food = (c: CityState) => resolveCycle(c, T0).report.produced["food:D"] ?? 0;
    const nova = food(s);
    expect(nova).toBeGreaterThan(0);
    const velha = structuredClone(s);
    velha.cyclesCompleted = 130; // 50 ciclos além da vida útil (80)
    velha.buildings.find((b) => b.type === "farm")!.builtAt = 0;
    expect(ageOf(velha.buildings.find((b) => b.type === "farm")!, velha)).toBe(130);
    expect(food(velha)).toBeLessThan(nova);

    const r = applyCommands(velha, [{ type: "renew", x: 15, y: 11 }]);
    expect(r.rejected).toEqual([]);
    expect(r.state.money).toBe(velha.money - renewCost("farm"));
    expect(r.state.buildings.find((b) => b.type === "farm")!.builtAt).toBe(130);
    expect(food(r.state)).toBeGreaterThanOrEqual(nova - 1);
  });

  it("não renova o que é novo, o que não envelhece ou o que está danificado", () => {
    const s = farmTown();
    const bad = (cmd: Command, c = s) => applyCommands(c, [cmd]).rejected.length === 1;
    expect(bad({ type: "renew", x: 15, y: 11 })).toBe(true); // nova
    expect(bad({ type: "renew", x: 13, y: 12 })).toBe(true); // estrada
    const velha = structuredClone(s);
    velha.cyclesCompleted = 100;
    velha.buildings.find((b) => b.type === "farm")!.builtAt = 0;
    expect(bad({ type: "renew", x: 15, y: 11 }, velha)).toBe(false);
    velha.buildings.find((b) => b.type === "farm")!.damaged = true;
    expect(bad({ type: "renew", x: 15, y: 11 }, velha)).toBe(true);
    const pobre = structuredClone(velha);
    pobre.buildings.find((b) => b.type === "farm")!.damaged = false;
    pobre.money = 0;
    expect(bad({ type: "renew", x: 15, y: 11 }, pobre)).toBe(true);
  });
});

describe("armazenagem", () => {
  it("estoque de trabalho é grátis; o que passa disso paga 1% por ciclo", () => {
    expect(storageCostOf(0)).toBe(0);
    expect(storageCostOf(300)).toBe(0);
    expect(storageCostOf(1300)).toBe(10);
    expect(stockValue({ "food:D": 10, "planks:B": 5 }, BASE_PRICE, RANK_YIELD)).toBeCloseTo(10 * 3 + 5 * 5 * RANK_YIELD.B);
  });

  it("o ciclo cobra e o saldo bate com o caixa", () => {
    const s = farmTown();
    s.inventory = { "metal:D": 500, "goods:D": 500 }; // valor 7.000
    const { state, report } = resolveCycle(s, T0);
    expect(report.finance.storage).toBeGreaterThan(40);
    expect(state.money).toBe(s.money + report.netMoney);
    const sem = resolveCycle({ ...structuredClone(s), inventory: {} }, T0).report;
    expect(sem.finance.storage).toBe(0);
  });
});

describe("frete", () => {
  const withPorts = (s: CityState) => {
    const c = structuredClone(s);
    for (const type of ["seaport", "airport", "train_station", "train_station", "train_station"] as const) c.buildings.push({ id: c.nextId++, type, x: 1, y: 1 });
    return c;
  };
  it("porto, aeroporto e estações baixam o custo de importar e sobem o preço de vender (máx. 20%)", () => {
    const s = createCity(1, T0);
    expect(tradeDiscount(s)).toBe(0);
    const d = tradeDiscount(withPorts(s));
    expect(d).toBeCloseTo(0.19); // 8% + 5% + 2 estações × 3%
    const e = { ...NEUTRAL_EFFECTS, trade: d };
    expect(importPrice("goods", "D", e)).toBeLessThan(importPrice("goods", "D", NEUTRAL_EFFECTS));
    expect(exportPrice("goods", "D", e)).toBeGreaterThan(exportPrice("goods", "D", NEUTRAL_EFFECTS));
    const muito = withPorts(withPorts(s));
    expect(tradeDiscount(muito)).toBe(0.2);
  });
  it("obra em andamento ou prédio danificado não conta", () => {
    const s = withPorts(createCity(1, T0));
    for (const b of s.buildings) if (b.type === "seaport") b.readyAt = 5;
    for (const b of s.buildings) if (b.type === "airport") b.damaged = true;
    expect(tradeDiscount(s)).toBeCloseTo(0.06);
  });
});

describe("migração v14", () => {
  it("construções de saves antigos começam novas", () => {
    const old = farmTown() as Partial<CityState> & { schemaVersion: number };
    old.schemaVersion = 13;
    old.cyclesCompleted = 42;
    for (const b of old.buildings!) delete b.builtAt;
    const m = migrateState(old as CityState);
    expect(m.buildings.every((b) => b.builtAt === 42)).toBe(true);
    expect(wearFactor(m.buildings.find((b) => b.type === "farm")!, m)).toBe(1);
  });
});
