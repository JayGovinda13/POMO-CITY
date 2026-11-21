import { describe, expect, it } from "vitest";
import {
  MAX_STRIKE,
  NO_STRIKE,
  activeWorkers,
  applyCommands,
  buildingStatus,
  computeStrike,
  computeTraffic,
  createCity,
  educationProductivity,
  educationStrikeFactor,
  laborStats,
  migrateState,
  outputFactor,
  resolveCycle,
  type CityState,
  type Command,
} from "./index";

const T0 = Date.UTC(2026, 10, 12, 12);

/** Cidade com estrada, moradia e fazenda: já tem emprego, mas nenhum hospital, escola ou polícia. */
function town(population = 100): CityState {
  const s = createCity(7, T0, "plains");
  s.terrain = s.terrain.map(() => 0);
  s.money = 50_000;
  const cmds: Command[] = [];
  for (let x = 13; x <= 20; x++) cmds.push({ type: "build", building: "road", x, y: 12 });
  cmds.push({ type: "wire", x: 12, y: 11 });
  cmds.push({ type: "zone", zone: "R", dense: false, x0: 13, y0: 11, x1: 18, y1: 11 });
  cmds.push({ type: "build", building: "farm", x: 19, y: 11 });
  const r = applyCommands(s, cmds);
  expect(r.rejected).toEqual([]);
  for (let x = 13; x <= 18; x++) r.state.zoneLevel[11 * r.state.width + x] = 2;
  r.state.population = population;
  return r.state;
}

describe("educação, greve e produtividade", () => {
  it("quanto mais educação, maior a chance de greve e a produtividade", () => {
    expect(educationStrikeFactor(0)).toBeCloseTo(0.75);
    expect(educationStrikeFactor(120)).toBeGreaterThan(educationStrikeFactor(40));
    expect(educationProductivity(40)).toBe(1);
    expect(educationProductivity(20)).toBe(1); // abaixo de 40 não pune
    expect(educationProductivity(140)).toBeCloseTo(1.25);
    const s = createCity(1, T0);
    s.eq = 40;
    const base = outputFactor(s, "campo");
    s.eq = 140;
    expect(outputFactor(s, "campo")).toBeCloseTo(base * 1.25);
  });
});

describe("causas de greve", () => {
  it("cidade pequena não faz greve", () => {
    expect(computeStrike(town(10))).toEqual(NO_STRIKE);
  });

  it("sem hospital e sem escola a população reclama", () => {
    const st = computeStrike(town(100));
    const ids = st.causes.map((c) => c.id);
    expect(ids).toContain("saude");
    expect(ids).toContain("escola");
    expect(st.share).toBeGreaterThan(0.05);
    expect(st.share).toBeLessThanOrEqual(MAX_STRIKE);
  });

  it("sem caminho até o trabalho, quem não chega para de trabalhar", () => {
    const s = town(100);
    const t = { ...computeTraffic(s), failedShare: 0.3 };
    const st = computeStrike(s, t);
    const c = st.causes.find((x) => x.id === "caminho")!;
    expect(c).toBeDefined();
    expect(c.share).toBeCloseTo(0.3 * educationStrikeFactor(s.eq), 2);
  });

  it("trânsito parado só gera greve se não houver transporte público", () => {
    const s = town(100);
    const jam = computeTraffic(s);
    const sem = computeStrike(s, { ...jam, congestionShare: 0.5, transit: new Uint8Array(jam.transit.length) });
    expect(sem.causes.some((c) => c.id === "transito")).toBe(true);
    const com = computeStrike(s, { ...jam, congestionShare: 0.5, transit: new Uint8Array(jam.transit.length).fill(1) });
    expect(com.causes.some((c) => c.id === "transito")).toBe(false);
  });

  it("a educação alta amplia a greve pelas mesmas causas", () => {
    const pouca = town(100);
    pouca.eq = 0;
    const muita = town(100);
    muita.eq = 120;
    expect(computeStrike(muita).share).toBeGreaterThan(computeStrike(pouca).share);
  });

  it("tem teto, e as causas somam o teto", () => {
    const s = town(100);
    const st = computeStrike(s, { ...computeTraffic(s), failedShare: 1 });
    expect(st.share).toBe(MAX_STRIKE);
    const soma = st.causes.reduce((a, c) => a + c.share, 0);
    expect(soma).toBeCloseTo(MAX_STRIKE, 1);
  });
});

describe("efeito da greve", () => {
  it("grevistas não preenchem vagas nem contam como desempregados", () => {
    const s = town(100);
    expect(activeWorkers(s)).toBe(100);
    const striking = { ...s, strike: { share: 0.5, causes: [] } };
    expect(activeWorkers(striking)).toBe(50);
    const l0 = laborStats(s);
    const l1 = laborStats(striking);
    expect(l1.striking).toBe(50);
    expect(l1.unemployed).toBeLessThanOrEqual(l0.unemployed);
    const farm = striking.buildings.find((b) => b.type === "farm")!;
    expect(buildingStatus(striking).get(farm.id)!.staffed).toBeLessThanOrEqual(buildingStatus(s).get(farm.id)!.staffed);
  });

  it("o ciclo calcula a greve, guarda no estado e põe no relatório", () => {
    const s = town(100);
    const { state, report } = resolveCycle(s, T0);
    expect(report.strike).toBeDefined();
    expect(state.strike.share).toBe(report.strike!.share);
  });

  it("migra um save antigo sem greve", () => {
    const old = createCity(1, T0) as Partial<CityState> & { schemaVersion: number };
    old.schemaVersion = 14;
    delete old.strike;
    expect(migrateState(old as CityState).strike).toEqual(NO_STRIKE);
  });
});
