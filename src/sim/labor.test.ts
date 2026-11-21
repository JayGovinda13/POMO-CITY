import { describe, expect, it } from "vitest";
import {
  DEFAULT_LABOR,
  MAX_DISPLACED,
  ZONE,
  applyCommands,
  cityFatigue,
  citizensView,
  createCity,
  displacedJobs,
  educationRelief,
  jobFactor,
  laborStats,
  migrateState,
  outputFactor,
  resolveCycle,
  rollEvents,
  rng,
  type CityState,
  type Command,
  type Hours,
  type Pay,
  type Sector,
} from "./index";

const T0 = Date.UTC(2026, 10, 12, 12);
const road = (x: number, y: number): Command => ({ type: "build", building: "road", x, y });
const at = (s: CityState, x: number, y: number) => y * s.width + x;

/** Cidade pequena com fazenda, serraria, madeireira e moradores (mesmo formato dos outros testes). */
function productive(): CityState {
  const s = createCity(7, T0, "plains");
  s.terrain = s.terrain.map(() => 0);
  s.money = 10_000;
  const cmds: Command[] = [];
  for (let x = 13; x <= 20; x++) cmds.push(road(x, 12));
  cmds.push({ type: "wire", x: 12, y: 11 });
  cmds.push({ type: "zone", zone: "R", dense: false, x0: 13, y0: 11, x1: 14, y1: 11 });
  cmds.push({ type: "build", building: "farm", x: 17, y: 11 });
  const r = applyCommands(s, cmds);
  expect(r.rejected).toEqual([]);
  r.state.zoneLevel[at(r.state, 13, 11)] = 2;
  r.state.zoneLevel[at(r.state, 14, 11)] = 2;
  r.state.population = 16;
  return r.state;
}

const withLabor = (s: CityState, sector: Sector, hours: Hours, pay: Pay = "tempo"): CityState => {
  const c = structuredClone(s);
  c.labor = { ...DEFAULT_LABOR, [sector]: { hours, pay } };
  return c;
};

describe("jornada e pagamento", () => {
  it("o padrão é 8 horas por tempo, sem efeito", () => {
    const s = createCity(1, T0);
    expect(s.labor).toEqual(DEFAULT_LABOR);
    expect(outputFactor(s, "campo")).toBe(1);
    expect(cityFatigue(s)).toBe(0);
  });

  it("jornada longa e pagamento por peça produzem mais; jornada curta produz menos", () => {
    const s = createCity(1, T0);
    expect(outputFactor(withLabor(s, "campo", 12), "campo")).toBeCloseTo(1.22);
    expect(outputFactor(withLabor(s, "campo", 10, "peca"), "campo")).toBeCloseTo(1.12 * 1.08);
    expect(outputFactor(withLabor(s, "campo", 6), "campo")).toBeCloseTo(0.88);
    // O efeito é só do setor mexido.
    expect(outputFactor(withLabor(s, "campo", 12), "fabrica")).toBe(1);
  });

  it("a fazenda colhe mais com jornada longa (e menos com jornada curta)", () => {
    const base = productive();
    const food = (s: CityState) => resolveCycle(s, T0).report.produced["food:D"] ?? 0;
    expect(food(withLabor(base, "campo", 12))).toBeGreaterThan(food(base));
    expect(food(withLabor(base, "campo", 6))).toBeLessThan(food(base));
  });

  it("jornada longa deixa os trabalhadores do setor tristes; jornada curta anima", () => {
    const base = productive();
    base.citizens = Array.from({ length: base.population }, (_, i) => i + 1);
    base.nextCitizenId = base.population + 1;
    const farmers = (s: CityState) => citizensView(s).filter((c) => c.job?.place === "Fazenda");
    const score = (s: CityState) => farmers(s).reduce((a, c) => a + c.score, 0) / Math.max(1, farmers(s).length);
    expect(farmers(base).length).toBeGreaterThan(0);
    expect(score(withLabor(base, "campo", 12))).toBeLessThan(score(base) - 2);
    expect(score(withLabor(base, "campo", 6))).toBeGreaterThan(score(base));
    const c = farmers(withLabor(base, "campo", 12, "peca"))[0];
    expect(c.reasons.some((r) => r.text.includes("peça"))).toBe(true);
    expect(c.reasons.some((r) => r.text.includes("exaustiva"))).toBe(true);
  });

  it("o desgaste da cidade derruba a expectativa de vida e aumenta a chance de greve", () => {
    const base = productive();
    const tired = withLabor(base, "campo", 12, "peca");
    expect(cityFatigue(tired)).toBeGreaterThan(0.5);
    expect(resolveCycle(tired, T0).state.lifeExpectancy).toBeLessThan(resolveCycle(base, T0).state.lifeExpectancy);

    // Greve: com a população feliz nunca; com exaustão passa a entrar no sorteio.
    const picked = (overwork: number) => {
      const got = new Set<string>();
      for (let k = 0; k < 500; k++) {
        const c = createCity(5, T0);
        c.population = 100;
        const r = rng(k + 3);
        let first = true;
        for (const n of rollEvents(c, () => (first ? ((first = false), 0.01) : r()), { healthServed: 1, approval: 0.4, overwork })) got.add(n.id);
      }
      return got;
    };
    expect(picked(0).has("greve")).toBe(false);
    expect(picked(0.8).has("greve")).toBe(true);
  });
});

describe("comando de trabalho", () => {
  const s = createCity(2, T0);
  it("muda jornada e pagamento do setor", () => {
    const r = applyCommands(s, [
      { type: "labor", sector: "fabrica", hours: 10 },
      { type: "labor", sector: "fabrica", pay: "peca" },
    ]);
    expect(r.rejected).toEqual([]);
    expect(r.state.labor.fabrica).toEqual({ hours: 10, pay: "peca" });
    expect(r.state.labor.campo).toEqual({ hours: 8, pay: "tempo" });
  });
  it("rejeita valores inválidos e mudanças que não mudam nada", () => {
    const bad = (cmd: unknown) => applyCommands(s, [cmd as Command]).rejected.length === 1;
    expect(bad({ type: "labor", sector: "fabrica", hours: 9 })).toBe(true);
    expect(bad({ type: "labor", sector: "mar", hours: 8 })).toBe(true);
    expect(bad({ type: "labor", sector: "campo", pay: "bonus" })).toBe(true);
    expect(bad({ type: "labor", sector: "campo" })).toBe(true);
    expect(bad({ type: "labor", sector: "campo", hours: 8, pay: "tempo" })).toBe(true);
  });
});

describe("automação", () => {
  const industrial = () => {
    const c = createCity(3, T0, "plains");
    c.zoneType[at(c, 15, 15)] = ZONE.I;
    c.zoneLevel[at(c, 15, 15)] = 4;
    c.zoneType[at(c, 16, 15)] = ZONE.I;
    c.zoneLevel[at(c, 16, 15)] = 4;
    c.population = 100;
    return c;
  };

  it("máquinas eliminam empregos industriais, e a educação reduz o estrago", () => {
    const s = industrial();
    expect(jobFactor(s)).toBe(1);
    const before = laborStats(s).industrialJobs;
    expect(before).toBe(32);
    s.techs = ["linha_montagem", "automacao"]; // 8% + 20%
    s.eq = 40;
    expect(displacedJobs(s)).toBeCloseTo(0.28);
    const after = laborStats(s).industrialJobs;
    expect(after).toBeLessThan(before);
    s.eq = 140; // educação alta realoca metade
    expect(educationRelief(s)).toBe(0.5);
    expect(displacedJobs(s)).toBeCloseTo(0.14);
    expect(laborStats(s).industrialJobs).toBeGreaterThan(after);
  });

  it("o desemprego sobe com a automação, e o teto é respeitado", () => {
    const s = industrial();
    s.eq = 0;
    const un0 = laborStats(s).unemployed;
    s.techs = ["linha_montagem", "conteineres", "computadores", "automacao", "inteligencia_artificial"];
    expect(displacedJobs(s)).toBeLessThanOrEqual(MAX_DISPLACED);
    expect(laborStats(s).unemployed).toBeGreaterThan(un0);
  });

  it("menos operários, mesma produção de bens (só o bônus da tecnologia sobra)", () => {
    const base = productive();
    for (const x of [15, 16]) {
      base.zoneType[at(base, x, 11)] = ZONE.I;
      base.zoneLevel[at(base, x, 11)] = 4;
    }
    for (let x = 12; x <= 16; x++) base.wires[at(base, x, 11)] = 1; // luz até as fábricas
    // Mão de obra de sobra (moradia para 64 e só 32 vagas): o que importa é o emprego, não o trabalhador.
    for (let x = 13; x <= 20; x++) {
      base.zoneType[at(base, x, 13)] = ZONE.R;
      base.zoneLevel[at(base, x, 13)] = 2;
      base.wires[at(base, x, 13)] = 1;
    }
    base.wires[at(base, 12, 12)] = 1;
    base.wires[at(base, 12, 13)] = 1;
    base.population = 70;
    base.eq = 40;
    const auto = structuredClone(base);
    auto.techs = ["automacao"]; // +25% de bens e −20% de empregos industriais
    const goods = (s: CityState) => {
      const r = resolveCycle(s, T0).report;
      return Object.entries(r.produced).filter(([k]) => k.startsWith("goods")).reduce((a, [, v]) => a + (v ?? 0), 0);
    };
    expect(laborStats(auto).industrialJobs).toBeLessThan(laborStats(base).industrialJobs);
    expect(goods(base)).toBeGreaterThan(8);
    // Cada empregado rende 1/fator: com o bônus de 25% da tecnologia, a produção total sobe 25% e não cai.
    expect(goods(auto) / goods(base)).toBeGreaterThan(1.15);
    expect(goods(auto) / goods(base)).toBeLessThan(1.35);
  });
});

describe("migração v13", () => {
  it("save antigo ganha a jornada padrão", () => {
    const old = createCity(4, T0) as Partial<CityState> & { schemaVersion: number };
    old.schemaVersion = 12;
    delete old.labor;
    const m = migrateState(old as CityState);
    expect(m.labor).toEqual(DEFAULT_LABOR);
  });
});
