import { describe, expect, it } from "vitest";
import {
  INSURANCE_WAITING,
  applyCommand,
  applyCommands,
  applyDisaster,
  buildingStatus,
  createCity,
  disasterIntensity,
  isCovered,
  migrateState,
  premium,
  resolveCycle,
  syncCitizens,
  waitingLeft,
  ZONE,
  type CityState,
  type Command,
} from "./index";

const T0 = Date.UTC(2026, 10, 10, 12);
const MIN = 60_000;
const at = (s: CityState, x: number, y: number) => y * s.width + x;

function town(): CityState {
  let s = createCity(51, T0, "plains");
  s.terrain = s.terrain.map(() => 0);
  s.money = 8_000;
  const cmds: Command[] = [
    { type: "build", building: "road", x: 13, y: 12 },
    { type: "wire", x: 12, y: 11 },
    { type: "zone", zone: "R", dense: false, x0: 13, y0: 11, x1: 18, y1: 11 },
    { type: "build", building: "farm", x: 14, y: 12 },
    { type: "build", building: "lumberyard", x: 13, y: 13 },
  ];
  const r = applyCommands(s, cmds);
  expect(r.rejected).toEqual([]);
  s = r.state;
  for (let x = 13; x <= 18; x++) s.zoneLevel[at(s, x, 11)] = 2;
  s.population = 40;
  syncCitizens(s);
  s.inventory = { "food:C": 100, "wood:C": 100 };
  return s;
}

const insure = (s: CityState, plan: "basico" | "completo" | "none") => {
  const r = applyCommand(s, { type: "insurance", plan });
  if (!r.ok) throw new Error(r.error);
  return r.state;
};

/** Avança `n` ciclos concluídos. */
function cycles(s: CityState, n: number, from = 0): CityState {
  for (let i = 0; i < n; i++) s = resolveCycle(s, T0 + (from + i) * 30 * MIN).state;
  return s;
}

describe("Fase 5 — seguro", () => {
  it("prêmio por estação; carência de 4 ciclos antes de cobrir", () => {
    let s = insure(town(), "basico");
    expect(premium(s)).toBeGreaterThan(0);
    expect(isCovered(s)).toBe(false);
    expect(waitingLeft(s)).toBe(INSURANCE_WAITING);
    const r = resolveCycle(s, T0);
    // O prêmio é calculado no ciclo, sobre o valor da cidade naquele momento.
    expect(r.report.finance.insurance).toBeGreaterThan(0);
    expect(Math.abs(r.report.finance.insurance - premium(s))).toBeLessThanOrEqual(2);
    s = cycles(s, INSURANCE_WAITING);
    expect(isCovered(s)).toBe(true);
  });

  it("completo indeniza mais que o básico; sem cobertura não paga nada", () => {
    const base = town();
    const basic = cycles(insure(base, "basico"), 4);
    const full = cycles(insure(base, "completo"), 4);
    const none = cycles(base, 4);
    const pb = applyDisaster(basic, "normal", "abandoned").report;
    const pf = applyDisaster(full, "normal", "abandoned").report;
    const pn = applyDisaster(none, "normal", "abandoned").report;
    expect(pb.insurance.payout).toBeGreaterThan(0);
    expect(pf.insurance.payout).toBeGreaterThan(pb.insurance.payout);
    expect(pn.insurance.payout).toBe(0);
    expect(pf.insurance.payout).toBeLessThan(pf.damageValue); // franquia + 90%
  });

  it("durante a carência, o desastre não é coberto", () => {
    const s = insure(town(), "completo");
    const r = applyDisaster(s, "normal", "abandoned").report;
    expect(r.insurance.covered).toBe(false);
    expect(r.insurance.payout).toBe(0);
    expect(r.insurance.waitingLeft).toBe(INSURANCE_WAITING);
  });

  it("trocar de plano reinicia a carência", () => {
    let s = cycles(insure(town(), "basico"), 4);
    expect(isCovered(s)).toBe(true);
    s = insure(s, "completo");
    expect(isCovered(s)).toBe(false);
  });

  it("bônus/malus: sinistro encarece; ano sem sinistro barateia", () => {
    let s = cycles(insure(town(), "completo"), 4);
    const before = s.insurance.bonusMalus;
    s = applyDisaster(s, "normal", "abandoned").state;
    expect(s.insurance.bonusMalus).toBeGreaterThan(before);
    let clean = cycles(insure(town(), "completo"), 8);
    expect(clean.insurance.bonusMalus).toBeLessThan(1);
  });

  it("sem dinheiro para o prêmio, a apólice é cancelada", () => {
    const s = insure(town(), "completo");
    s.money = -2000; // nem os impostos do ciclo cobrem o prêmio
    s.inventory = {};
    const r = resolveCycle(s, T0);
    expect(r.state.insurance.plan).toBe("none");
    expect(r.report.insuranceLapsed).toBe(true);
  });
});

describe("Fase 5 — desastres mais duros", () => {
  it("quebras seguidas e sequência longa agravam; ciclo concluído zera a contagem", () => {
    const s = town();
    expect(disasterIntensity(s, "normal")).toBe(1);
    const twice = applyDisaster(s, "normal", "abandoned").state;
    expect(twice.breaks).toBe(1);
    expect(disasterIntensity(twice, "normal")).toBe(1.5);
    const longStreak = { ...s, streak: 6 };
    expect(disasterIntensity(longStreak, "normal")).toBe(1.25);
    expect(disasterIntensity(s, "light")).toBe(1);
    expect(applyDisaster(s, "light", "closed_without_exit").state.breaks).toBe(0);
    expect(resolveCycle(twice, T0).state.breaks).toBe(0);
  });

  it("construção danificada para de operar até ser reparada", () => {
    const s = town();
    const { state, report } = applyDisaster(s, "normal", "abandoned");
    expect(report.buildingsDamaged).toHaveLength(1);
    const hit = report.buildingsDamaged[0];
    const b = state.buildings.find((x) => x.x === hit.x && x.y === hit.y)!;
    expect(b.damaged).toBe(true);
    expect(buildingStatus(state).get(b.id)!.efficiency).toBe(0);
    const fixed = applyCommand(state, { type: "repair", x: hit.x, y: hit.y });
    expect(fixed.ok).toBe(true);
    if (!fixed.ok) return;
    expect(fixed.state.money).toBe(state.money - hit.repair);
    expect(buildingStatus(fixed.state).get(b.id)!.efficiency).toBeGreaterThan(0);
    expect(applyCommand(fixed.state, { type: "repair", x: hit.x, y: hit.y }).ok).toBe(false);
  });

  it("prejuízo soma lotes, estoque, limpeza e reparos", () => {
    const r = applyDisaster(town(), "normal", "abandoned").report;
    expect(r.damageValue).toBeGreaterThanOrEqual(r.moneyLost + r.buildingsDamaged.reduce((a, b) => a + b.repair, 0));
  });

  it("migração v6 → v7: sem seguro e sem quebras", () => {
    const v6 = createCity(1, T0) as Partial<CityState>;
    v6.schemaVersion = 6;
    delete v6.insurance;
    delete v6.breaks;
    const m = migrateState(v6 as CityState);
    expect(m.insurance.plan).toBe("none");
    expect(m.breaks).toBe(0);
    expect(m.zoneType[0]).toBe(ZONE.NONE);
  });
});
