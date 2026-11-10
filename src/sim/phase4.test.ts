import { describe, expect, it } from "vitest";
import {
  TAX_BASE,
  BOND_VALUE,
  applyCommand,
  applyCommands,
  computeDemand,
  computePower,
  connectedRoads,
  createCity,
  creditRating,
  foundCity,
  migrateState,
  plantCapacities,
  resolveCycle,
  syncCitizens,
  citizensView,
  ZONE,
  type CityState,
  type Command,
} from "./index";

const T0 = Date.UTC(2026, 10, 10, 12);
const MIN = 60_000;
const at = (s: CityState, x: number, y: number) => y * s.width + x;

/** Cidade com moradores, comércio e indústria desenvolvidos, ligada por estrada e linha. */
function town(): CityState {
  let s = createCity(31, T0, "plains");
  s.terrain = s.terrain.map(() => 0);
  s.money = 5_000;
  const cmds: Command[] = [];
  for (let x = 13; x <= 18; x++) cmds.push({ type: "build", building: "road", x, y: 12 }, { type: "wire", x, y: 12 });
  cmds.push({ type: "zone", zone: "R", dense: false, x0: 13, y0: 11, x1: 16, y1: 11 });
  cmds.push({ type: "zone", zone: "C", dense: false, x0: 17, y0: 11, x1: 17, y1: 11 });
  cmds.push({ type: "zone", zone: "I", dense: false, x0: 18, y0: 11, x1: 18, y1: 11 });
  const r = applyCommands(s, cmds);
  expect(r.rejected).toEqual([]);
  s = r.state;
  for (let x = 13; x <= 18; x++) s.zoneLevel[at(s, x, 11)] = 2;
  s.population = 32;
  syncCitizens(s);
  s.inventory = { "food:C": 200, "planks:C": 50 };
  return s;
}

const budget = (s: CityState, cmd: Partial<Extract<Command, { type: "budget" }>>) => {
  const r = applyCommand(s, { type: "budget", ...cmd });
  if (!r.ok) throw new Error(r.error);
  return r.state;
};

describe("Fase 4 — impostos por zona", () => {
  it("alíquota padrão (9%) arrecada como antes; mais imposto rende mais e derruba a demanda", () => {
    const s = town();
    const base = resolveCycle(s, T0).report;
    expect(base.finance.taxR).toBe(Math.floor(base.populationAfter * TAX_BASE.R));
    const high = budget(s, { taxes: { R: 18, C: 9, I: 9 } });
    const r = resolveCycle(high, T0).report;
    expect(r.finance.taxR).toBeGreaterThan(base.finance.taxR);
    expect(computeDemand(high).R).toBeLessThan(computeDemand(s).R);
    expect(computeDemand(budget(s, { taxes: { R: 9, C: 0, I: 9 } })).C).toBeGreaterThan(computeDemand(s).C);
  });

  it("valida a faixa de 0 a 20%", () => {
    expect(applyCommand(town(), { type: "budget", taxes: { R: 25, C: 9, I: 9 } }).ok).toBe(false);
  });
});

describe("Fase 4 — verbas dos departamentos", () => {
  it("sem verba de transporte, estradas desgastam até desconectar; com verba, recuperam", () => {
    let s = budget(town(), { funding: { transport: 0, energy: 100 } });
    const before = resolveCycle(s, T0).report.finance.upkeepTransport;
    expect(before).toBe(0);
    for (let i = 0; i < 4; i++) s = resolveCycle(s, T0 + i * 30 * MIN).state;
    expect(connectedRoads(s).size).toBe(0);
    s = budget(s, { funding: { transport: 100, energy: 100 } });
    for (let i = 0; i < 4; i++) s = resolveCycle(s, T0 + (10 + i) * 30 * MIN).state;
    expect(connectedRoads(s).size).toBeGreaterThan(0);
  });

  it("usinas com menos verba geram menos (a prefeitura não depende de verba)", () => {
    const s = applyCommands(town(), [{ type: "build", building: "wind_turbine", x: 19, y: 12 }]).state;
    const turbine = s.buildings.find((b) => b.type === "wind_turbine")!;
    const full = plantCapacities(s).get(turbine.id)!;
    const half = plantCapacities(budget(s, { funding: { transport: 100, energy: 0 } })).get(turbine.id)!;
    expect(half).toBeCloseTo(full / 2);
    const hall = s.buildings.find((b) => b.type === "cityhall")!;
    expect(plantCapacities(budget(s, { funding: { transport: 100, energy: 0 } })).get(hall.id)).toBe(20);
  });
});

describe("Fase 4 — títulos e rating", () => {
  it("emitir dá dinheiro; juros saem uma vez por ano; quitar começa pelo mais antigo", () => {
    let s = town();
    const before = s.money;
    for (let k = 0; k < 2; k++) {
      const r = applyCommand(s, { type: "bond", action: "issue" });
      if (!r.ok) throw new Error(r.error);
      s = r.state;
    }
    expect(s.money).toBe(before + 2 * BOND_VALUE);
    const interests: number[] = [];
    for (let i = 0; i < 4; i++) {
      const c = resolveCycle(s, T0 + i * 30 * MIN);
      interests.push(c.report.finance.interest);
      s = c.state;
    }
    expect(interests.filter((v) => v > 0)).toHaveLength(1);
    const firstId = s.bonds[0].id;
    const paid = applyCommand(s, { type: "bond", action: "repay" });
    expect(paid.ok).toBe(true);
    if (paid.ok) expect(paid.state.bonds.map((b) => b.id)).not.toContain(firstId);
  });

  it("mais dívida derruba o rating e o banco para de emprestar", () => {
    let s = town();
    const ratings = [creditRating(s).rating];
    for (let i = 0; i < 12; i++) {
      const r = applyCommand(s, { type: "bond", action: "issue" });
      if (!r.ok) {
        expect(r.error).toMatch(/não empresta/);
        break;
      }
      s = r.state;
      ratings.push(creditRating(s).rating);
    }
    expect(ratings[0]).toBe("AAA");
    expect(ratings.at(-1)).not.toBe("AAA");
    expect(s.bonds.length).toBeLessThan(12);
  });
});

describe("Fase 4 — decretos", () => {
  const on = (s: CityState, id: Extract<Command, { type: "ordinance" }>["id"]) => {
    const r = applyCommand(s, { type: "ordinance", id, active: true });
    if (!r.ok) throw new Error(r.error);
    return r.state;
  };

  it("impostos extras rendem e custos aparecem no livro-caixa", () => {
    const s = on(on(town(), "imposto_renda"), "embelezamento");
    const f = resolveCycle(s, T0).report.finance;
    expect(f.ordinanceRevenue).toBeGreaterThan(0);
    expect(f.ordinanceCost).toBeGreaterThan(0);
  });

  it("conservação de energia chega a +15% em 4 ciclos", () => {
    let s = on(town(), "conservacao_energia");
    const hall = s.buildings.find((b) => b.type === "cityhall")!;
    expect(plantCapacities(s).get(hall.id)).toBe(20);
    s.cyclesCompleted += 4;
    expect(plantCapacities(s).get(hall.id)).toBeCloseTo(23);
  });

  it("embelezamento alegra os moradores; jogos entristecem", () => {
    const s = town();
    const score = (st: CityState) => citizensView(st).reduce((a, v) => a + v.score, 0);
    expect(score(on(s, "embelezamento"))).toBeGreaterThan(score(s));
    expect(score(on(s, "jogos"))).toBeLessThan(score(s));
  });

  it("prêmio de produtividade rende +15% em ciclos A/S", () => {
    const farm = applyCommands(town(), [{ type: "build", building: "farm", x: 14, y: 13 }]).state;
    farm.streak = 4; // próximo ciclo é S
    const plain = resolveCycle(farm, T0).report.ledger.food!.produced;
    const prize = resolveCycle(on(farm, "premio_produtividade"), T0).report.ledger.food!.produced;
    expect(prize).toBeGreaterThan(plain);
  });

  it("não ativa duas vezes", () => {
    const s = on(town(), "festival");
    expect(applyCommand(s, { type: "ordinance", id: "festival", active: true }).ok).toBe(false);
  });
});

describe("Fase 4 — dificuldade, saldo e migração", () => {
  it("difícil começa com um título a pagar; fácil com mais dinheiro", () => {
    const hard = foundCity(createCity(1, T0), "lisboa", T0, "dificil");
    const easy = foundCity(createCity(1, T0), "lisboa", T0, "facil");
    expect(hard.ok && easy.ok).toBe(true);
    if (!hard.ok || !easy.ok) return;
    expect(hard.state.bonds).toHaveLength(1);
    expect(hard.state.money).toBe(BOND_VALUE);
    expect(easy.state.money).toBe(2000);
    expect(computeDemand(easy.state).I).toBeGreaterThan(computeDemand(hard.state).I);
  });

  it("o saldo do ciclo bate com o dinheiro, inclusive com juros e decretos", () => {
    let s = applyCommand(town(), { type: "ordinance", id: "jogos", active: true });
    if (!s.ok) throw new Error();
    let st = (applyCommand(s.state, { type: "bond", action: "issue" }) as { state: CityState }).state;
    for (let i = 0; i < 4; i++) {
      const r = resolveCycle(st, T0 + i * 30 * MIN);
      expect(r.state.money).toBe(st.money + r.report.netMoney);
      st = r.state;
    }
  });

  it("migração v5 → v6 usa os valores padrão", () => {
    const v5 = createCity(1, T0) as Partial<CityState>;
    v5.schemaVersion = 5;
    delete v5.taxes;
    delete v5.bonds;
    const m = migrateState(v5 as CityState);
    expect(m.taxes).toEqual({ R: 9, C: 9, I: 9 });
    expect(m.bonds).toEqual([]);
    expect(m.difficulty).toBe("medio");
    expect(m.zoneType[0]).toBe(ZONE.NONE);
    expect(computePower(m).capacity).toBe(20);
  });
});
