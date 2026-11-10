import { describe, expect, it } from "vitest";
import {
  applyCommand,
  applyCommands,
  bfsDistances,
  components,
  computeDemand,
  computePower,
  createCity,
  cityYear,
  developZones,
  migrateState,
  periodLabel,
  plantCapacities,
  resolveCycle,
  rng,
  roadAccess,
  CURRENT_SCHEMA_VERSION,
  ZONE,
  type CityState,
  type Command,
} from "./index";

const T0 = Date.UTC(2026, 10, 10, 12, 0, 0);
const MIN = 60_000;
const HALL = { x: 12, y: 12 };

function city(): CityState {
  const s = createCity(7, T0, "plains");
  s.terrain = s.terrain.map(() => 0);
  s.money = 100_000;
  return s;
}

const at = (s: CityState, x: number, y: number) => y * s.width + x;
const road = (x: number, y: number): Command => ({ type: "build", building: "road", x, y });
const zone = (z: "R" | "C" | "I" | "none", x0: number, y0: number, x1: number, y1: number, dense = false): Command => ({
  type: "zone",
  zone: z,
  dense,
  x0,
  y0,
  x1,
  y1,
});

function apply(s: CityState, cmds: Command[]) {
  const r = applyCommands(s, cmds);
  expect(r.rejected).toEqual([]);
  return r.state;
}

// ───────────────────────────── Fase 0 ─────────────────────────────

describe("Fase 0 — migração de estado", () => {
  it("converte cidades v1: casas viram lotes R desenvolvidos e ruas ganham rede elétrica", () => {
    const v2 = city();
    const v1 = structuredClone(v2) as Partial<CityState> & Record<string, unknown>;
    delete v1.schemaVersion;
    delete v1.zoneType;
    delete v1.zoneDensity;
    delete v1.zoneLevel;
    delete v1.wires;
    v1.buildings = [
      ...v2.buildings,
      { id: 2, type: "road", x: 13, y: 12 },
      { id: 3, type: "house", x: 14, y: 12 },
    ];
    const m = migrateState(v1 as CityState);
    expect(m.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(m.buildings.some((b) => b.type === "house")).toBe(false);
    expect(m.zoneType[at(m, 14, 12)]).toBe(ZONE.R);
    expect(m.zoneLevel[at(m, 14, 12)]).toBe(2);
    expect(m.wires[at(m, 13, 12)]).toBe(1);
    expect(migrateState(m)).toBe(m); // idempotente
  });
});

describe("Fase 0 — utilitários de grade", () => {
  const g = { width: 4, height: 3 };
  it("BFS com limite de distância", () => {
    const { dist } = bfsDistances(g, [0], () => true, 2);
    expect(dist[0]).toBe(0);
    expect(dist[2]).toBe(2);
    expect(dist[3]).toBe(-1);
  });
  it("componentes conectados", () => {
    const comp = components(g, (i) => i % 4 !== 1); // coluna x = 1 bloqueada
    expect(comp[0]).toBe(comp[4]);
    expect(comp[0]).not.toBe(comp[2]);
  });
});

describe("Fase 0 — calendário e desbloqueios", () => {
  it("1 ciclo = 1 estação; 4 ciclos = 1 ano", () => {
    const s = city();
    expect(cityYear(s)).toBe(1900);
    expect(periodLabel(s.cyclesCompleted)).toBe("Jan–Mar 1900");
    s.cyclesCompleted = 3;
    expect(periodLabel(s.cyclesCompleted)).toBe("Out–Dez 1900");
    s.cyclesCompleted = 13;
    expect(cityYear(s)).toBe(1903);
    expect(periodLabel(s.cyclesCompleted)).toBe("Abr–Jun 1903");
  });

  it("relatório indica a estação vivida no ciclo", () => {
    const s = city();
    s.cyclesCompleted = 6;
    const { report, state } = resolveCycle(s, T0);
    expect([report.year, report.quarter]).toEqual([1901, 2]);
    expect(periodLabel(state.cyclesCompleted)).toBe("Out–Dez 1901");
  });

  it("hidrelétrica só a partir de 1902 e encostada na água", () => {
    const s = city();
    s.terrain[at(s, 2, 3)] = 1;
    expect(applyCommand(s, { type: "build", building: "hydro_plant", x: 2, y: 2 })).toMatchObject({
      ok: false,
      error: "Disponível em 1902",
    });
    s.cyclesCompleted = 8;
    expect(applyCommand(s, { type: "build", building: "hydro_plant", x: 6, y: 6 })).toMatchObject({
      error: "Precisa encostar na água",
    });
    expect(applyCommand(s, { type: "build", building: "hydro_plant", x: 2, y: 2 }).ok).toBe(true);
  });

  it("zona densa exige 40 habitantes", () => {
    const s = city();
    expect(applyCommand(s, zone("R", 1, 1, 2, 2, true)).ok).toBe(false);
    s.population = 40;
    expect(applyCommand(s, zone("R", 1, 1, 2, 2, true)).ok).toBe(true);
  });
});

// ───────────────────────────── Fase 1 ─────────────────────────────

describe("Fase 1 — zoneamento", () => {
  it("cobra por tile alterado e pula água, construções e tiles iguais", () => {
    const s = city();
    s.terrain[at(s, 1, 1)] = 1;
    const a = apply(s, [road(2, 1), zone("R", 0, 0, 2, 1)]); // 6 tiles − água − estrada = 4
    expect(a.money).toBe(s.money - 10 - 4 * 5);
    expect(a.zoneType[at(a, 0, 0)]).toBe(ZONE.R);
    expect(a.zoneType[at(a, 2, 1)]).toBe(ZONE.NONE);
    // Repetir a mesma zona não custa nada (e não há o que fazer).
    expect(applyCommand(a, zone("R", 0, 0, 1, 0))).toMatchObject({ ok: false });
    // Mudar o tipo custa de novo.
    const b = apply(a, [zone("I", 0, 0, 1, 0)]);
    expect(b.money).toBe(a.money - 2 * 5);
  });

  it("lote desenvolvido não é rezoneado nem recebe obra; demolição é em camadas", () => {
    let s = apply(city(), [zone("C", 4, 4, 4, 4)]);
    s.zoneLevel[at(s, 4, 4)] = 2;
    expect(applyCommand(s, zone("R", 4, 4, 4, 4)).ok).toBe(false);
    expect(applyCommand(s, { type: "build", building: "farm", x: 4, y: 4 }).ok).toBe(false);
    s = apply(s, [{ type: "demolish", x: 4, y: 4 }]); // derruba o prédio
    expect(s.zoneLevel[at(s, 4, 4)]).toBe(0);
    expect(s.zoneType[at(s, 4, 4)]).toBe(ZONE.C);
    s = apply(s, [{ type: "demolish", x: 4, y: 4 }]); // remove o zoneamento
    expect(s.zoneType[at(s, 4, 4)]).toBe(ZONE.NONE);
  });

  it("obra pública em lote vazio desfaz o zoneamento", () => {
    const s = apply(city(), [zone("R", 4, 4, 4, 4), { type: "build", building: "farm", x: 4, y: 4 }]);
    expect(s.zoneType[at(s, 4, 4)]).toBe(ZONE.NONE);
  });

  it("linhas cruzam estradas, mas não construções", () => {
    const s = apply(city(), [road(5, 5), { type: "wire", x: 5, y: 5 }, { type: "build", building: "farm", x: 6, y: 5 }]);
    expect(s.wires[at(s, 5, 5)]).toBe(1);
    expect(applyCommand(s, { type: "wire", x: 6, y: 5 }).ok).toBe(false);
  });
});

describe("Fase 1 — energia", () => {
  it("energia passa por lotes e linhas, não por estradas", () => {
    const s = apply(city(), [road(13, 12), zone("R", 14, 12, 14, 12)]);
    let p = computePower(s);
    expect(p.powered[at(s, 14, 12)]).toBe(0); // separado da prefeitura pela estrada
    const wired = apply(s, [{ type: "wire", x: 13, y: 12 }]);
    p = computePower(wired);
    expect(p.powered[at(wired, 14, 12)]).toBe(1);
  });

  it("apagão: quando a capacidade acaba, os mais distantes ficam sem luz", () => {
    // Fileira encostada na prefeitura: 6 lotes densos × 4 MW = 24 MW > 20 MW da prefeitura.
    let s = apply(city(), [zone("I", 13, 12, 18, 12)]);
    for (let x = 13; x <= 18; x++) {
      s.zoneDensity[at(s, x, 12)] = 1;
      s.zoneLevel[at(s, x, 12)] = 4;
    }
    const p = computePower(s);
    expect(p.capacity).toBe(20);
    expect(p.demand).toBe(24);
    expect(p.brownout).toBe(true);
    expect(p.powered[at(s, 13, 12)]).toBe(1);
    expect(p.powered[at(s, 18, 12)]).toBe(0);
    // Uma eólica no fim da linha resolve.
    s = apply(s, [{ type: "build", building: "wind_turbine", x: 19, y: 12 }]);
    expect(computePower(s).brownout).toBe(false);
  });

  it("termelétrica: geração segue o rendimento do Rank da madeira (30 MW × rendimento)", () => {
    const s = apply(city(), [road(13, 12), { type: "build", building: "thermal_plant", x: 13, y: 13 }]);
    s.population = 3;
    const plant = s.buildings.find((b) => b.type === "thermal_plant")!;
    s.inventory = {};
    expect(plantCapacities(s).get(plant.id)).toBe(0); // sem combustível
    s.inventory = { "wood:D": 4 };
    expect(plantCapacities(s).get(plant.id)).toBe(30);
    s.inventory = { "wood:S": 4 };
    expect(plantCapacities(s).get(plant.id)).toBe(42);
  });

  it("ciclo queima o combustível e reporta a energia", () => {
    const s = apply(city(), [road(13, 12), { type: "build", building: "thermal_plant", x: 13, y: 13 }]);
    s.population = 3;
    // Um lote residencial encostado na prefeitura abriga os 3 operários da usina.
    s.zoneType[at(s, 11, 12)] = ZONE.R;
    s.zoneLevel[at(s, 11, 12)] = 1;
    s.inventory = { "wood:A": 10, "food:C": 50 };
    const { report } = resolveCycle(s, T0);
    expect(report.consumed["wood:A"]).toBe(4);
    expect(report.power.capacity).toBe(20 + 39); // prefeitura 20 + madeira A: 30 × 1,3
  });
});

describe("Fase 1 — crescimento das zonas", () => {
  function grid() {
    // Estrada horizontal ligada à prefeitura + linha sob ela; zona R logo abaixo.
    const cmds: Command[] = [];
    for (let x = 13; x <= 22; x++) cmds.push(road(x, 12), { type: "wire", x, y: 12 });
    cmds.push(zone("R", 13, 13, 22, 17));
    return apply(city(), cmds);
  }

  it("regra dos 3 tiles: só cresce perto da estrada", () => {
    const s = grid();
    const access = roadAccess(s);
    expect(access[at(s, 13, 15)]).toBe(3);
    expect(access[at(s, 13, 16)]).toBe(-1);
    const powered = new Uint8Array(s.width * s.height).fill(1);
    for (let c = 0; c < 10; c++) developZones(s, { rank: "S", rand: rng(c), powered, access });
    expect(s.zoneLevel[at(s, 13, 13)]).toBeGreaterThan(0);
    expect(s.zoneLevel[at(s, 13, 16)]).toBe(0);
    expect(s.zoneLevel[at(s, 13, 17)]).toBe(0);
  });

  it("sem energia não cresce e lotes desenvolvidos declinam", () => {
    const s = grid();
    s.zoneLevel[at(s, 13, 13)] = 2;
    const powered = new Uint8Array(s.width * s.height); // tudo apagado
    // O declínio sem energia é gradual (1 chance em 3 por ciclo): em alguns ciclos o lote cai.
    const rand = rng(1);
    let declined = 0;
    for (let k = 0; k < 12; k++) {
      const r = developZones(s, { rank: "S", rand, powered, access: roadAccess(s) });
      expect(r.grown).toBe(0);
      declined += r.declined;
    }
    expect(declined).toBe(2);
    expect(s.zoneLevel[at(s, 13, 13)]).toBe(0);
  });

  it("foco melhor (Rank S) desenvolve mais lotes que Rank D", () => {
    const powered = new Uint8Array(24 * 24).fill(1);
    const a = grid();
    const b = grid();
    const ra = developZones(a, { rank: "D", rand: rng(5), powered, access: roadAccess(a) });
    const rb = developZones(b, { rank: "S", rand: rng(5), powered, access: roadAccess(b) });
    expect(rb.grown).toBeGreaterThan(ra.grown);
  });

  it("demanda: cidade vazia quer moradores e indústria; comércio vem com a população", () => {
    const s = city();
    const d0 = computeDemand(s);
    expect(d0.R).toBeGreaterThan(0);
    expect(d0.I).toBeGreaterThan(0);
    expect(d0.C).toBe(0);
    s.population = 100;
    expect(computeDemand(s).C).toBeGreaterThan(0);
  });
});

describe("Fase 1 — cidade nova de ponta a ponta", () => {
  it("zonear + estrada + fazenda: a cidade cresce sozinha e dá lucro", () => {
    const cmds: Command[] = [];
    for (let x = 13; x <= 20; x++) cmds.push(road(x, 12));
    cmds.push({ type: "wire", x: HALL.x, y: HALL.y - 1 });
    cmds.push(zone("R", 12, 10, 16, 11));
    cmds.push(zone("I", 17, 10, 20, 11));
    cmds.push({ type: "build", building: "farm", x: 14, y: 13 });
    cmds.push({ type: "wire", x: 13, y: 12 }, { type: "wire", x: 14, y: 12 });
    // Cidade feliz cresce mais rápido: uma eólica garante energia para a expansão.
    cmds.push({ type: "build", building: "wind_turbine", x: 15, y: 13 }, { type: "build", building: "wind_turbine", x: 16, y: 13 });
    let s = apply(createCity(7, T0, "plains"), cmds);
    s.terrain = s.terrain.map(() => 0);
    const start = s.money;
    let net = 0;
    for (let i = 0; i < 6; i++) {
      const r = resolveCycle(s, T0 + i * 30 * MIN);
      s = r.state;
      net += r.report.netMoney;
      expect(r.report.power.brownout).toBe(false);
    }
    expect(s.population).toBeGreaterThan(20);
    expect(s.zoneLevel.some((l, i) => l > 0 && s.zoneType[i] === ZONE.I)).toBe(true);
    expect(net).toBeGreaterThan(0);
    expect(s.money).toBeGreaterThan(start);
  });

  it("ciclo é determinístico (cliente = servidor)", () => {
    const cmds: Command[] = [road(13, 12), { type: "wire", x: 13, y: 12 }, zone("R", 13, 13, 16, 14)];
    const s = apply(city(), cmds);
    expect(resolveCycle(s, T0)).toEqual(resolveCycle(structuredClone(s), T0));
  });
});
