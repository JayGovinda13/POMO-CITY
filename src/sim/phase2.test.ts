import { describe, expect, it } from "vitest";
import {
  REGIONS,
  REGION_BY_ID,
  CLIMATE_TYPES,
  applyCommands,
  applyDisaster,
  cityPeriodLabel,
  climateEffects,
  computePower,
  createCity,
  effectiveStreak,
  foundCity,
  migrateState,
  nearestRegion,
  newGame,
  plantCapacities,
  realQuarter,
  resolveCycle,
  searchRegions,
  seasonName,
  weatherAt,
  ZONE,
  SESSION_GAP_MS,
  type CityState,
  type Command,
} from "./index";

const T0 = Date.UTC(2026, 10, 10, 12, 0, 0); // novembro → 4º trimestre
const at = (s: CityState, x: number, y: number) => y * s.width + x;

function founded(regionId: string): CityState {
  const r = foundCity(createCity(99, T0), regionId, T0);
  if (!r.ok) throw new Error(r.error);
  return r.state;
}

describe("Fase 2 — tabela de climas", () => {
  it("tem ~40+ regiões completas e válidas", () => {
    expect(REGIONS.length).toBeGreaterThanOrEqual(40);
    const ids = new Set(REGIONS.map((r) => r.id));
    expect(ids.size).toBe(REGIONS.length);
    for (const r of REGIONS) {
      expect(r.type in CLIMATE_TYPES).toBe(true);
      expect(r.quarters).toHaveLength(4);
      for (const q of r.quarters) {
        expect(Number.isFinite(q.t) && q.rain >= 0 && q.sun >= 0 && q.wind > 0).toBe(true);
      }
    }
  });

  it("encontra a região mais próxima e busca por nome sem acentos", () => {
    expect(nearestRegion(-22.9, -47.06).id).toBe("sao-paulo"); // Campinas
    expect(nearestRegion(51.45, -2.6).id).toBe("londres"); // Bristol
    expect(searchRegions("sao paulo").map((r) => r.id)).toContain("sao-paulo");
    expect(searchRegions("Bombaim").map((r) => r.id)).toEqual(["mumbai"]);
  });

  it("estações seguem o hemisfério; perto do Equador valem chuva e seca", () => {
    expect(seasonName(REGION_BY_ID["sao-paulo"], 0)).toBe("Verão");
    expect(seasonName(REGION_BY_ID["londres"], 0)).toBe("Inverno");
    expect(seasonName(REGION_BY_ID["londres"], 2)).toBe("Verão");
    expect(seasonName(REGION_BY_ID["manaus"], 0)).toBe("Estação chuvosa");
    expect(seasonName(REGION_BY_ID["manaus"], 2)).toBe("Estação seca");
  });
});

describe("Fase 2 — fundar a cidade", () => {
  it("cidade nova: bioma vem do clima e o calendário começa na estação real", () => {
    const s = founded("cairo");
    expect(s.biome).toBe("desert");
    expect(s.regionId).toBe("cairo");
    expect(s.calendarOffset).toBe(realQuarter(T0));
    expect(cityPeriodLabel(s)).toBe("Out–Dez 1900");
    expect(founded("manaus").biome).toBe("forest");
    expect(founded("anchorage").biome).toBe("tundra");
  });

  it("região chuvosa gera mais água no mapa que região árida", () => {
    const water = (s: CityState) => s.terrain.filter((t) => t === 1).length;
    let wet = 0;
    let dry = 0;
    for (let seed = 1; seed <= 20; seed++) {
      const a = foundCity(createCity(seed, T0), "belem", T0);
      const b = foundCity(createCity(seed, T0), "cairo", T0);
      if (a.ok && b.ok) {
        wet += water(a.state);
        dry += water(b.state);
      }
    }
    expect(wet).toBeGreaterThan(dry);
  });

  it("cidade já construída mantém mapa, bioma e calendário", () => {
    let s = createCity(5, T0, "plains");
    s = applyCommands(s, [{ type: "build", building: "road", x: 13, y: 12 }]).state;
    const r = foundCity(s, "moscou", T0);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.state.biome).toBe("plains");
    expect(r.state.terrain).toEqual(s.terrain);
    expect(r.state.calendarOffset).toBe(0);
    expect(r.state.buildings).toHaveLength(2);
  });

  it("a região só é escolhida uma vez e precisa existir", () => {
    expect(foundCity(createCity(1, T0), "atlantida", T0)).toMatchObject({ ok: false });
    expect(foundCity(founded("lisboa"), "madrid", T0)).toMatchObject({ ok: false });
  });

  it("migração v2 → v3 pede a região de novo", () => {
    const v2 = createCity(3, T0) as Partial<CityState>;
    v2.schemaVersion = 2;
    delete v2.regionId;
    delete v2.calendarOffset;
    const m = migrateState(v2 as CityState);
    expect(m.regionId).toBeNull();
    expect(m.calendarOffset).toBe(0);
    expect(m.streakFrozen).toBe(false);
  });
});

describe("Fase 2 — clima na simulação", () => {
  it("o tempo é determinístico e varia em torno da normal", () => {
    const s = founded("londres");
    const a = weatherAt(s, 8)!;
    expect(weatherAt(structuredClone(s), 8)).toEqual(a);
    expect(Math.abs(a.temp - a.normal.t)).toBeLessThanOrEqual(5);
    expect(weatherAt(createCity(1, T0))).toBeNull(); // sem região = neutro
  });

  it("lavoura: inverno e seca derrubam; estação quente e chuvosa favorece", () => {
    expect(climateEffects({ temp: -5, rain: 100, wind: 4 }).farm).toBeLessThan(0.2);
    expect(climateEffects({ temp: 24, rain: 10, wind: 4 }).farm).toBeLessThan(0.5);
    expect(climateEffects({ temp: 24, rain: 400, wind: 4 }).farm).toBeGreaterThan(1);
  });

  it("fazenda colhe mais no verão que no inverno (mesma cidade)", () => {
    const food = (index: number) => {
      const s = founded("moscou");
      s.calendarOffset = 0;
      s.cyclesCompleted = index;
      s.terrain = s.terrain.map(() => 0);
      const cmds: Command[] = [
        { type: "build", building: "road", x: 13, y: 12 },
        { type: "build", building: "farm", x: 13, y: 11 },
        { type: "wire", x: 12, y: 11 },
      ];
      const built = applyCommands(s, cmds).state;
      built.zoneType[at(built, 11, 12)] = ZONE.R;
      built.zoneLevel[at(built, 11, 12)] = 2;
      built.population = 8;
      return resolveCycle(built, T0).report.produced["food:D"] ?? 0;
    };
    // índice 2 = Jul–Set (verão em Moscou); índice 0 = Jan–Mar (inverno)
    expect(food(2)).toBeGreaterThan(food(0));
  });

  it("vento e chuva da estação mudam eólica e hidrelétrica; frio aumenta o consumo", () => {
    const s = createCity(1, T0, "plains");
    s.terrain = s.terrain.map(() => 0);
    s.money = 10_000;
    const st = applyCommands(s, [
      { type: "build", building: "wind_turbine", x: 13, y: 12 },
      { type: "zone", zone: "R", dense: false, x0: 11, y0: 12, x1: 11, y1: 12 },
    ]).state;
    st.zoneLevel[at(st, 11, 12)] = 2;
    const turbine = st.buildings.find((b) => b.type === "wind_turbine")!;
    const calm = climateEffects({ temp: 20, rain: 200, wind: 2 });
    const windy = climateEffects({ temp: 20, rain: 200, wind: 7 });
    expect(plantCapacities(st, undefined, windy).get(turbine.id)!).toBeGreaterThan(
      plantCapacities(st, undefined, calm).get(turbine.id)!,
    );
    const mild = computePower(st, undefined, climateEffects({ temp: 20, rain: 200, wind: 4 }));
    const cold = computePower(st, undefined, climateEffects({ temp: -10, rain: 200, wind: 4 }));
    expect(cold.demand).toBeGreaterThan(mild.demand);
  });

  it("relatório traz a estação vivida e o tempo", () => {
    const s = founded("sao-paulo");
    const { report } = resolveCycle(s, T0);
    expect(report.weather?.season).toBe(seasonName(REGION_BY_ID["sao-paulo"], realQuarter(T0)));
  });
});

describe("Sessão — novo jogo, sequência guardada e desastres", () => {
  it("novo jogo preserva sequência e limite diário; região volta a ser escolhida", () => {
    const old = founded("lisboa");
    old.streak = 4;
    old.cyclesToday = 9;
    old.money = 5;
    const g = newGame(old, 1234, T0);
    expect(g.streak).toBe(4);
    expect(g.cyclesToday).toBe(9);
    expect(g.money).toBe(1000);
    expect(g.regionId).toBeNull();
  });

  it("sequência guardada (saída pelo menu) não decai com o tempo", () => {
    const s = createCity(1, T0);
    s.streak = 4;
    s.lastCycleAt = T0;
    expect(effectiveStreak(s, T0 + SESSION_GAP_MS * 10)).toBe(2);
    s.streakFrozen = true;
    expect(effectiveStreak(s, T0 + SESSION_GAP_MS * 10)).toBe(4);
    const r = resolveCycle(s, T0 + SESSION_GAP_MS * 10);
    expect(r.state.streak).toBe(5);
    expect(r.state.streakFrozen).toBe(false);
  });

  it("desastre normal é pior que o leve; o tipo segue a estação", () => {
    const base = founded("cairo"); // árido: incêndio
    base.terrain = base.terrain.map(() => 0);
    for (let x = 0; x < 10; x++) {
      base.zoneType[at(base, x, 0)] = ZONE.R;
      base.zoneLevel[at(base, x, 0)] = 2;
    }
    base.inventory = { "wood:C": 100, "food:C": 100 };
    base.money = 2000;
    const light = applyDisaster(base, "light", "closed_without_exit");
    const heavy = applyDisaster(base, "normal", "closed_during_focus");
    expect(heavy.report.kind).toBe("incendio");
    expect(heavy.report.lotsDamaged).toBeGreaterThan(light.report.lotsDamaged);
    expect(heavy.report.moneyLost).toBeGreaterThan(light.report.moneyLost);
    expect(heavy.report.resourcesLost["wood:C"]).toBe(30);
    expect(light.report.resourcesLost["wood:C"]).toBe(10);
    expect(heavy.state.disasterCount).toBe(1);
    // Determinístico: o mesmo estado sempre gera o mesmo desastre.
    expect(applyDisaster(structuredClone(base), "normal", "closed_during_focus")).toEqual(heavy);
  });
});
