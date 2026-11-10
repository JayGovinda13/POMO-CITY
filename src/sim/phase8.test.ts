import { describe, expect, it } from "vitest";
import {
  MAX_TRIP,
  applyCommand,
  applyCommands,
  computeDemand,
  computeServices,
  computeTraffic,
  connectedRoads,
  createCity,
  resolveCycle,
  syncCitizens,
  trafficDemand,
  ZONE,
  type CityState,
  type Command,
} from "./index";

const T0 = Date.UTC(2026, 10, 10, 12);
const at = (s: CityState, x: number, y: number) => y * s.width + x;

function base(): CityState {
  const s = createCity(81, T0, "plains");
  s.terrain = s.terrain.map(() => 0);
  s.money = 100_000;
  s.population = 300; // libera aeroporto, porto etc.
  return s;
}

const apply = (s: CityState, cmds: Command[]) => {
  const r = applyCommands(s, cmds);
  expect(r.rejected).toEqual([]);
  return r.state;
};

const roadRow = (y: number, x0: number, x1: number, type: "road" | "highway" | "rail" = "road"): Command[] => {
  const out: Command[] = [];
  for (let x = x0; x <= x1; x++) out.push({ type: "build", building: type, x, y });
  return out;
};

/** Casa (R) em (hx, 11) e trabalho (I) em (jx, 11), ligados pela estrada na linha 12. */
function commute(hx: number, jx: number, dense = false): CityState {
  const s = apply(base(), roadRow(12, 13, Math.max(hx, jx)));
  s.zoneType[at(s, hx, 11)] = ZONE.R;
  s.zoneDensity[at(s, hx, 11)] = dense ? 1 : 0;
  s.zoneLevel[at(s, hx, 11)] = dense ? 4 : 2;
  s.zoneType[at(s, jx, 11)] = ZONE.I;
  s.zoneLevel[at(s, jx, 11)] = 2;
  return s;
}

describe("Fase 8 — viagens e trânsito", () => {
  it("cada lote residencial procura emprego pela estrada e carrega as vias do caminho", () => {
    const s = commute(14, 22);
    const t = computeTraffic(s);
    expect(t.trips).toBe(2);
    expect(t.failedTrips).toBe(0);
    expect(t.load[at(s, 18, 12)]).toBeGreaterThan(0);
    expect(t.avgCommute).toBeGreaterThan(0);
  });

  it("perto do trabalho vai a pé; longe demais, a viagem falha", () => {
    const near = commute(14, 16);
    expect(computeTraffic(near).load.some((v) => v > 0)).toBe(false);
    // Sem estrada até o emprego: falha.
    const s = commute(14, 22);
    s.buildings = s.buildings.filter((b) => !(b.type === "road" && b.x === 18));
    const t = computeTraffic(s);
    expect(t.failed[at(s, 14, 11)]).toBe(1);
    expect(t.failedShare).toBeGreaterThan(0); // população ≥ 60
    expect(trafficDemand(s, t).R).toBeLessThan(0);
  });

  it("estrada acima da capacidade congestiona, polui mais e derruba a demanda", () => {
    let s = apply(base(), roadRow(12, 13, 23));
    for (let x = 13; x <= 16; x++) {
      for (const y of [10, 11]) {
        s.zoneType[at(s, x, y)] = ZONE.R;
        s.zoneDensity[at(s, x, y)] = 1;
        s.zoneLevel[at(s, x, y)] = 4;
      }
    }
    s.zoneType[at(s, 23, 11)] = ZONE.I;
    s.zoneLevel[at(s, 23, 11)] = 2;
    const t = computeTraffic(s);
    expect(t.congestedTiles).toBeGreaterThan(0);
    expect(t.congestionShare).toBeGreaterThan(0);
    const calm = commute(14, 22);
    const p = (c: CityState) => computeServices(c).pollution[at(c, 20, 13)];
    expect(p(s)).toBeGreaterThan(p(calm));
    s = structuredClone(s);
    expect(trafficDemand(s, t).R).toBeLessThan(0);
  });

  it("um par de pontos de ônibus tira parte dos carros da rua", () => {
    const s = commute(14, 22, true);
    const before = computeTraffic(s).load[at(s, 18, 12)];
    const withBus = apply(s, [
      { type: "build", building: "bus_stop", x: 14, y: 13 },
      { type: "build", building: "bus_stop", x: 22, y: 13 },
    ]);
    const t = computeTraffic(withBus);
    expect(t.load[at(s, 18, 12)]).toBeLessThan(before);
    expect(t.busRiders).toBeGreaterThan(0);
    // Um ponto sozinho não faz linha.
    const single = apply(s, [{ type: "build", building: "bus_stop", x: 14, y: 13 }]);
    expect(computeTraffic(single).busRiders).toBe(0);
  });
});

describe("Fase 8 — rodovias, trilhos e portos", () => {
  it("rodovia só se liga à estrada por acesso", () => {
    const cmds: Command[] = [
      { type: "build", building: "road", x: 13, y: 12 },
      ...roadRow(12, 14, 18, "highway"),
      { type: "build", building: "road", x: 19, y: 12 },
      { type: "build", building: "road", x: 20, y: 12 },
    ];
    let s = apply(base(), cmds);
    expect(connectedRoads(s).has(at(s, 20, 12))).toBe(false);
    s = apply(s, [{ type: "demolish", x: 14, y: 12 }, { type: "demolish", x: 18, y: 12 }]);
    s = apply(s, [
      { type: "build", building: "onramp", x: 14, y: 12 },
      { type: "build", building: "onramp", x: 18, y: 12 },
    ]);
    expect(connectedRoads(s).has(at(s, 20, 12))).toBe(true);
    // Lotes não usam a rodovia como acesso.
    expect(connectedRoads(s).has(at(s, 16, 12))).toBe(false);
  });

  it("rodovia permite viagens 3× mais longas", () => {
    // Casa na esquerda, trabalho a ~16 tiles: só por estrada passa do tempo-limite.
    const long = (hw: boolean) => {
      const cmds: Command[] = [...roadRow(5, 2, 3)];
      cmds.push(hw ? { type: "build", building: "onramp", x: 4, y: 5 } : { type: "build", building: "road", x: 4, y: 5 });
      cmds.push(...roadRow(5, 5, 19, hw ? "highway" : "road"));
      cmds.push(hw ? { type: "build", building: "onramp", x: 20, y: 5 } : { type: "build", building: "road", x: 20, y: 5 });
      cmds.push(...roadRow(5, 21, 22));
      const s = apply(base(), cmds);
      s.zoneType[at(s, 2, 4)] = ZONE.R;
      s.zoneLevel[at(s, 2, 4)] = 1;
      s.zoneType[at(s, 22, 4)] = ZONE.I;
      s.zoneLevel[at(s, 22, 4)] = 1;
      return computeTraffic(s);
    };
    expect(long(false).failedTrips).toBe(1);
    const hw = long(true);
    expect(hw.failedTrips).toBe(0);
    expect(hw.avgCommute).toBeLessThan(MAX_TRIP);
  });

  it("trem leva passageiros entre estações", () => {
    const s = base();
    s.cyclesCompleted = 4; // 1901
    const cmds: Command[] = [
      { type: "build", building: "road", x: 3, y: 5 },
      { type: "build", building: "train_station", x: 4, y: 5 },
      ...roadRow(5, 5, 19, "rail"),
      { type: "build", building: "train_station", x: 20, y: 5 },
      { type: "build", building: "road", x: 21, y: 5 },
    ];
    const st = apply(s, cmds);
    st.zoneType[at(st, 2, 4)] = ZONE.R;
    st.zoneLevel[at(st, 2, 4)] = 1;
    st.zoneType[at(st, 22, 4)] = ZONE.C;
    st.zoneLevel[at(st, 22, 4)] = 1;
    const t = computeTraffic(st);
    expect(t.failedTrips).toBe(0);
    expect(t.railRiders).toBeGreaterThan(0);
  });

  it("indústria perto de estação produz mais (frete)", () => {
    const make = (station: boolean) => {
      const s = base();
      s.cyclesCompleted = 4;
      const cmds: Command[] = [...roadRow(12, 13, 18)];
      for (let x = 13; x <= 18; x++) cmds.push({ type: "wire", x, y: 12 });
      if (station) cmds.push({ type: "build", building: "train_station", x: 16, y: 13 }, { type: "build", building: "rail", x: 16, y: 14 });
      const st = apply(s, cmds);
      for (let x = 14; x <= 18; x++) {
        st.zoneType[at(st, x, 11)] = ZONE.I;
        st.zoneLevel[at(st, x, 11)] = 2;
      }
      st.zoneType[at(st, 13, 11)] = ZONE.R;
      st.zoneLevel[at(st, 13, 11)] = 2;
      st.population = 60;
      syncCitizens(st);
      st.inventory = { "food:C": 500, "planks:C": 100 };
      return resolveCycle(st, T0).report.ledger.goods?.produced ?? 0;
    };
    expect(make(true)).toBeGreaterThan(make(false));
  });

  it("aeroporto impulsiona o comércio; porto (à beira d'água) a indústria", () => {
    const s = apply(base(), roadRow(12, 13, 15));
    const before = computeDemand(s);
    const air = apply(s, [{ type: "build", building: "airport", x: 14, y: 13 }]);
    expect(trafficDemand(air, computeTraffic(air)).C).toBeCloseTo(0.15);
    // Em cidade pequena (demanda longe do teto), o aeroporto aparece na demanda comercial.
    const small = (c: CityState) => ({ ...structuredClone(c), population: 10 });
    expect(computeDemand(small(air)).C).toBeGreaterThan(computeDemand(small(s)).C);
    expect(applyCommand(s, { type: "build", building: "seaport", x: 14, y: 11 }).ok).toBe(false); // sem água
    s.terrain[at(s, 14, 10)] = 1;
    const port = apply(s, [{ type: "build", building: "seaport", x: 14, y: 11 }]);
    expect(computeDemand(port).I).toBeGreaterThanOrEqual(before.I);
    expect(trafficDemand(port, computeTraffic(port)).I).toBeCloseTo(0.15);
  });

  it("o relatório do ciclo traz o trânsito", () => {
    const s = commute(14, 22);
    s.population = 8;
    syncCitizens(s);
    const { report } = resolveCycle(s, T0);
    expect(report.traffic?.trips).toBeGreaterThan(0);
  });
});
