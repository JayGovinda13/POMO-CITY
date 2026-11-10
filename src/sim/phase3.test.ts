import { describe, expect, it } from "vitest";
import {
  BASE_PRICE,
  NEUTRAL_EFFECTS,
  RANK_YIELD,
  applyCommand,
  applyCommands,
  consumeEquivalent,
  createCity,
  exportPrice,
  foodSecure,
  getQty,
  importPrice,
  quoteMaterials,
  resolveCycle,
  stockOf,
  storageCapacity,
  syncCitizens,
  unitsToSell,
  ZONE,
  type CityState,
  type Command,
} from "./index";

const T0 = Date.UTC(2026, 10, 10, 12);
const MIN = 60_000;
const at = (s: CityState, x: number, y: number) => y * s.width + x;

function base(): CityState {
  const s = createCity(21, T0, "plains");
  s.terrain = s.terrain.map(() => 0);
  return s;
}

/** Cidade com moradores prontos (sem produção de comida). */
function village(pop = 16, extra: Command[] = []): CityState {
  let s = base();
  s.money = 5_000;
  const cmds: Command[] = [
    { type: "build", building: "road", x: 13, y: 12 },
    { type: "wire", x: 12, y: 11 },
    { type: "zone", zone: "R", dense: false, x0: 13, y0: 11, x1: 14, y1: 11 },
    ...extra,
  ];
  const r = applyCommands(s, cmds);
  expect(r.rejected).toEqual([]);
  s = r.state;
  s.zoneLevel[at(s, 13, 11)] = 2;
  s.zoneLevel[at(s, 14, 11)] = 2;
  s.population = pop;
  syncCitizens(s);
  return s;
}

describe("Fase 3 — valor e rendimento por Rank", () => {
  it("1 unidade A rende como 1,3 unidade D no consumo", () => {
    const inv = { "food:A": 10 };
    const r = consumeEquivalent(inv, "food", 13);
    expect(r.taken.A).toBe(10);
    expect(r.shortfall).toBe(0);
    expect(consumeEquivalent({ "food:D": 10 }, "food", 13).shortfall).toBe(3);
  });

  it("preço sobe com o Rank e o mercado externo paga no máximo o valor de B", () => {
    expect(importPrice("planks", "B", NEUTRAL_EFFECTS)).toBeCloseTo(BASE_PRICE.planks * 1.25 * 1.2);
    expect(exportPrice("planks", "C", NEUTRAL_EFFECTS)).toBeCloseTo(BASE_PRICE.planks * 0.8 * 1.1);
    expect(exportPrice("planks", "S", NEUTRAL_EFFECTS)).toBe(exportPrice("planks", "B", NEUTRAL_EFFECTS));
    expect(importPrice("food", "D", NEUTRAL_EFFECTS)).toBeGreaterThan(exportPrice("food", "D", NEUTRAL_EFFECTS));
    expect(RANK_YIELD.S).toBe(1.4);
  });

  it("comida encarece quando a colheita da estação é ruim", () => {
    const harsh = { ...NEUTRAL_EFFECTS, farm: 0.3 };
    expect(importPrice("food", "D", harsh)).toBeGreaterThan(importPrice("food", "D", NEUTRAL_EFFECTS));
  });
});

describe("Fase 3 — obras com materiais", () => {
  it("usa o estoque e importa só o que falta", () => {
    const s = base();
    s.inventory = { "wood:C": 2 };
    const quote = quoteMaterials(s, [{ resource: "wood", qty: 4 }]);
    expect(quote.imports).toEqual([{ res: "wood", rank: "D", units: 2 }]); // 2 C rendem 2,2
    const r = applyCommand(s, { type: "build", building: "farm", x: 3, y: 3 });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(getQty(r.state.inventory, "wood", "C")).toBe(0);
    expect(r.state.money).toBe(s.money - 80 - quote.importCost);
  });

  it("jogável só com dinheiro: sem estoque, tudo é importado", () => {
    const s = base();
    s.inventory = {};
    const r = applyCommand(s, { type: "build", building: "thermal_plant", x: 3, y: 3 });
    expect(r.ok).toBe(true);
  });

  it("Rank S não é vendido pelo mercado externo", () => {
    const s = base();
    s.money = 50_000;
    const r = applyCommand(s, { type: "build", building: "monument", x: 3, y: 3 });
    expect(r).toMatchObject({ ok: false });
    if (!r.ok) expect(r.error).toMatch(/só vende até B/);
  });
});

describe("Fase 3 — cidadãos vivem dos recursos", () => {
  it("falta de comida é comprada; só há fome quando o dinheiro acaba", () => {
    const s = village(16);
    s.inventory = {};
    const { report } = resolveCycle(s, T0);
    // Compra exatamente a comida de quem ficou (0,5 por morador).
    expect(report.bought["food:D"]).toBe(Math.ceil(report.populationAfter * 0.5));
    expect(report.importCost).toBeGreaterThan(0);
    expect(report.starving).toBe(false);

    const broke = village(16);
    broke.inventory = {};
    broke.money = 0;
    expect(foodSecure(broke)).toBe(false);
    expect(resolveCycle(broke, T0).report.starving).toBe(true);
  });

  it("produzir localmente sai mais barato que importar", () => {
    const run = (withFarms: boolean) => {
      // Fazendas encostadas na estrada (13,12).
      let s = village(16, withFarms ? [{ type: "build", building: "farm", x: 14, y: 12 }, { type: "build", building: "farm", x: 13, y: 13 }] : []);
      let spent = 0;
      for (let i = 0; i < 4; i++) {
        const r = resolveCycle(s, T0 + i * 30 * MIN);
        s = r.state;
        spent += r.report.bought["food:D"] ?? 0;
      }
      return spent;
    };
    expect(run(true)).toBeLessThan(run(false));
  });

  it("lenha para aquecer no frio e bens de consumo a partir de 30 moradores", () => {
    const s = village(16);
    s.regionId = "moscou";
    s.calendarOffset = 0; // Jan–Mar: inverno
    s.inventory = { "wood:C": 50, "food:C": 50 };
    const cold = resolveCycle(s, T0).report;
    expect((cold.consumed["wood:C"] ?? 0) + (cold.bought["wood:D"] ?? 0)).toBeGreaterThan(0);

    // 4 lotes R densos (64 vagas) e um lote I com empregos: a população fica acima de 30.
    const city = village(40);
    for (const x of [11, 13, 14, 15]) {
      city.zoneType[at(city, x, 11)] = ZONE.R;
      city.zoneDensity[at(city, x, 11)] = 1;
      city.zoneLevel[at(city, x, 11)] = 4;
    }
    city.zoneType[at(city, 12, 13)] = ZONE.I;
    city.zoneDensity[at(city, 12, 13)] = 1;
    city.zoneLevel[at(city, 12, 13)] = 4;
    city.inventory = { "food:C": 100 };
    const r = resolveCycle(city, T0).report;
    expect(r.ledger.goods?.consumed).toBeGreaterThan(0);
  });

  it("indústria fabrica bens", () => {
    const s = village(16, [{ type: "zone", zone: "I", dense: false, x0: 12, y0: 13, x1: 12, y1: 13 }]);
    s.zoneLevel[at(s, 12, 13)] = 2; // 8 empregos industriais
    expect(s.zoneType[at(s, 12, 13)]).toBe(ZONE.I);
    const { report } = resolveCycle(s, T0);
    expect(report.ledger.goods?.produced).toBeGreaterThan(0);
  });
});

describe("Fase 3 — estoque e excedente", () => {
  it("políticas: estocar, vender excedente, % e reserva", () => {
    expect(unitsToSell({ mode: "stock", value: 0 }, 100, 10)).toBe(0);
    expect(unitsToSell({ mode: "sell_surplus", value: 0 }, 100, 10)).toBe(90);
    expect(unitsToSell({ mode: "sell_percent", value: 50 }, 100, 10)).toBe(45);
    expect(unitsToSell({ mode: "reserve", value: 2 }, 100, 10)).toBe(80);
  });

  it("cidade nova, sem moradores, não vende a comida inicial", () => {
    const s = base();
    const { state, report } = resolveCycle(s, T0);
    expect(report.salesRevenue).toBe(0);
    expect(stockOf(state.inventory, "food")).toBeGreaterThan(30);
  });

  it("vender o excedente rende dinheiro e nunca vende A/S", () => {
    const s = village(16);
    s.inventory = { "wood:C": 60, "wood:A": 20, "food:C": 80 };
    const r = applyCommand(s, { type: "policy", resource: "wood", mode: "sell_surplus", value: 0 });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const { state, report } = resolveCycle(r.state, T0);
    expect(report.sold["wood:C"]).toBe(60);
    expect(report.sold["wood:A"]).toBeUndefined();
    expect(getQty(state.inventory, "wood", "A")).toBe(20);
    expect(report.salesRevenue).toBeGreaterThan(0);
  });

  it("acima da capacidade o excesso é vendido; armazém amplia o limite", () => {
    const s = village(16);
    s.inventory = { "ore:D": 160, "food:C": 50 };
    const { state, report } = resolveCycle(s, T0);
    expect(stockOf(state.inventory, "ore")).toBe(100);
    expect(report.sold["ore:D"]).toBe(60);
    const w = applyCommand(s, { type: "build", building: "warehouse", x: 15, y: 12 });
    expect(w.ok).toBe(true);
    if (w.ok) expect(storageCapacity(w.state).ore).toBe(250);
  });

  it("comida estraga; com silo estraga menos", () => {
    const s = village(4);
    s.inventory = { "food:C": 100 };
    const without = resolveCycle(s, T0).report.lost["food:C"] ?? 0;
    const silo = applyCommand(s, { type: "build", building: "silo", x: 15, y: 12 });
    expect(silo.ok).toBe(true);
    if (!silo.ok) return;
    silo.state.inventory = { "food:C": 100 };
    const withSilo = resolveCycle(silo.state, T0).report.lost["food:C"] ?? 0;
    expect(without).toBeGreaterThan(withSilo);
  });

  it("relatório traz o balanço por recurso e o saldo bate com o dinheiro", () => {
    const s = village(16);
    s.inventory = { "food:C": 20 };
    const { state, report } = resolveCycle(s, T0);
    const food = report.ledger.food!;
    expect(food.stock).toBe(stockOf(state.inventory, "food"));
    expect(food.bought).toBeGreaterThanOrEqual(0);
    expect(state.money).toBe(s.money + report.netMoney);
  });
});
