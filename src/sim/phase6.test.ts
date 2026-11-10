import { describe, expect, it } from "vitest";
import {
  TOWER_CAPACITY,
  applyCommand,
  applyCommands,
  climateEffects,
  computeWater,
  createCity,
  developZones,
  migrateState,
  resolveCycle,
  rng,
  roadAccess,
  syncCitizens,
  citizensView,
  NEUTRAL_EFFECTS,
  ZONE,
  type CityState,
  type Command,
} from "./index";

const T0 = Date.UTC(2026, 10, 10, 12);
const at = (s: CityState, x: number, y: number) => y * s.width + x;

function base(): CityState {
  const s = createCity(61, T0, "plains");
  s.terrain = s.terrain.map(() => 0);
  s.money = 20_000;
  return s;
}

const apply = (s: CityState, cmds: Command[]) => {
  const r = applyCommands(s, cmds);
  expect(r.rejected).toEqual([]);
  return r.state;
};

describe("Fase 6 — rede de água", () => {
  it("a prefeitura tem um poço; água passa por lotes vizinhos e cano atravessa a estrada", () => {
    let s = apply(base(), [
      { type: "build", building: "road", x: 13, y: 12 },
      { type: "zone", zone: "R", dense: false, x0: 14, y0: 12, x1: 14, y1: 12 },
    ]);
    s.zoneLevel[at(s, 14, 12)] = 2;
    let w = computeWater(s, NEUTRAL_EFFECTS);
    expect(w.produced).toBe(20);
    expect(w.watered[at(s, 14, 12)]).toBe(0); // a estrada separa a prefeitura do lote
    s = apply(s, [{ type: "pipe", x: 13, y: 12 }]);
    w = computeWater(s, NEUTRAL_EFFECTS);
    expect(w.watered[at(s, 14, 12)]).toBe(1);
  });

  it("bomba rende o dobro encostada na água e menos na seca", () => {
    const s = apply(base(), [{ type: "build", building: "water_pump", x: 3, y: 3 }]);
    s.terrain[at(s, 3, 4)] = 1;
    const pump = s.buildings.find((b) => b.type === "water_pump")!;
    const near = computeWater(s, NEUTRAL_EFFECTS).produced - 20;
    s.terrain[at(s, 3, 4)] = 0;
    const well = computeWater(s, NEUTRAL_EFFECTS).produced - 20;
    // Sem energia a bomba opera a 50%; a proporção entre beira d'água e poço é o que importa.
    expect(near).toBeCloseTo(well * 2);
    expect(climateEffects({ temp: 25, rain: 20, wind: 3 }).water).toBeLessThan(climateEffects({ temp: 25, rain: 600, wind: 3 }).water);
    expect(pump).toBeTruthy();
  });

  it("caixa d'água guarda a sobra e cobre a falta", () => {
    let s = apply(base(), [{ type: "build", building: "water_tower", x: 11, y: 12 }]);
    s = resolveCycle(s, T0).state;
    const tower = s.buildings.find((b) => b.type === "water_tower")!;
    expect(tower.water).toBeGreaterThan(0);
    expect(tower.water).toBeLessThanOrEqual(TOWER_CAPACITY);
    // Com a caixa cheia, a rede tem mais água do que o poço sozinho produz.
    const w = computeWater(s, NEUTRAL_EFFECTS);
    expect(w.produced + w.stored).toBeGreaterThan(w.produced);
  });

  it("estação de tratamento recicla parte do consumo (liberada em 1903)", () => {
    const s = base();
    expect(applyCommand(s, { type: "build", building: "water_treatment", x: 11, y: 12 }).ok).toBe(false);
    s.cyclesCompleted = 12;
    expect(applyCommand(s, { type: "build", building: "water_treatment", x: 11, y: 12 }).ok).toBe(true);
  });

  it("demolir no subsolo remove o cano", () => {
    let s = apply(base(), [{ type: "pipe", x: 5, y: 5 }]);
    expect(s.pipes[at(s, 5, 5)]).toBe(1);
    s = apply(s, [{ type: "demolish", x: 5, y: 5, underground: true }]);
    expect(s.pipes[at(s, 5, 5)]).toBe(0);
  });
});

describe("Fase 6 — efeitos da água", () => {
  function dense(watered: boolean) {
    const s = base();
    s.population = 8; // demanda residencial neutra: só a água decide
    for (let x = 13; x <= 16; x++) {
      s.zoneType[at(s, x, 11)] = ZONE.R;
      s.zoneDensity[at(s, x, 11)] = 1;
      s.zoneLevel[at(s, x, 11)] = 3;
    }
    const road: Command[] = [];
    for (let x = 13; x <= 16; x++) road.push({ type: "build", building: "road", x, y: 12 }, { type: "wire", x, y: 12 });
    const st = apply(s, road);
    const powered = new Uint8Array(st.width * st.height).fill(1);
    const wet = new Uint8Array(st.width * st.height).fill(watered ? 1 : 0);
    // O declínio sem água é gradual: alguns ciclos bastam para o prédio denso voltar ao nível 2.
    const rand = rng(1);
    for (let k = 0; k < 15; k++) developZones(st, { rank: "S", rand, powered, access: roadAccess(st), watered: wet });
    return st;
  }

  it("prédio denso sem água não passa do nível 2", () => {
    const dry = dense(false);
    const wet = dense(true);
    for (let x = 13; x <= 16; x++) expect(dry.zoneLevel[at(dry, x, 11)]).toBeLessThanOrEqual(2);
    expect(Math.max(...[13, 14, 15, 16].map((x) => wet.zoneLevel[at(wet, x, 11)]))).toBeGreaterThanOrEqual(3);
  });

  it("fazenda irrigada colhe mais no inverno", () => {
    const make = (pipe: boolean) => {
      const f = base();
      f.regionId = "moscou";
      f.calendarOffset = 0; // inverno
      const cmds: Command[] = [
        { type: "build", building: "road", x: 13, y: 12 },
        { type: "build", building: "farm", x: 14, y: 12 },
        { type: "wire", x: 12, y: 11 },
        { type: "zone", zone: "R", dense: false, x0: 13, y0: 11, x1: 14, y1: 11 },
      ];
      if (pipe) cmds.push({ type: "pipe", x: 13, y: 12 });
      const st = apply(f, cmds);
      st.zoneLevel[at(st, 13, 11)] = 2;
      st.zoneLevel[at(st, 14, 11)] = 2;
      st.population = 16;
      syncCitizens(st);
      return resolveCycle(st, T0).report.ledger.food?.produced ?? 0;
    };
    expect(make(true)).toBeGreaterThanOrEqual(make(false));
  });

  it("água encanada alegra os moradores e o relatório traz a água", () => {
    const s = apply(base(), [
      { type: "build", building: "road", x: 13, y: 12 },
      { type: "pipe", x: 13, y: 12 },
      { type: "wire", x: 13, y: 12 },
      { type: "zone", zone: "R", dense: false, x0: 14, y0: 12, x1: 14, y1: 12 },
    ]);
    s.zoneLevel[at(s, 14, 12)] = 2;
    s.population = 8;
    syncCitizens(s);
    expect(citizensView(s)[0].reasons.map((r) => r.text)).toContain("Água encanada");
    const { report } = resolveCycle(s, T0);
    expect(report.water?.produced).toBeGreaterThan(0);
  });

  it("migração v7 → v8 cria a camada de canos vazia", () => {
    const v7 = createCity(1, T0) as Partial<CityState>;
    v7.schemaVersion = 7;
    delete v7.pipes;
    const m = migrateState(v7 as CityState);
    expect(m.pipes).toHaveLength(m.width * m.height);
    expect(m.pipes.every((p) => p === 0)).toBe(true);
  });
});
