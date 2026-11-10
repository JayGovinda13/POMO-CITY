import { describe, expect, it } from "vitest";
import {
  BRIDGE_MONEY,
  MAP_SIZE,
  NEUTRAL_EFFECTS,
  applyCommand,
  applyCommands,
  buildingStatus,
  computeServices,
  computeWater,
  connectedRoads,
  createCity,
  defaultMapOptions,
  foundCity,
  generateMap,
  migrateState,
  sanitizeMapOptions,
  terraformCost,
  ZONE,
  type CityState,
  type Command,
  type MapOptions,
} from "./index";
import { resourceOutlook } from "../components/ResourcesButton";

const T0 = Date.UTC(2026, 10, 10, 12);
const at = (s: CityState, x: number, y: number) => y * s.width + x;

function flat(): CityState {
  const s = createCity(91, T0, "plains");
  s.terrain = s.terrain.map(() => 0);
  s.elevation = s.elevation.map(() => 0);
  s.trees = s.trees.map(() => 0);
  s.money = 100_000;
  s.population = 150;
  return s;
}

const apply = (s: CityState, cmds: Command[]) => {
  const r = applyCommands(s, cmds);
  expect(r.rejected).toEqual([]);
  return r.state;
};

const opts = (o: Partial<MapOptions> = {}): MapOptions => ({ relief: "colinas", water: "rio_lagos", coast: "nenhuma", forest: 2, variant: 0, ...o });

describe("Fase 9 — gerador de mapas", () => {
  it("é determinístico, 40×40, com centro plano e em terra", () => {
    const a = generateMap(7, MAP_SIZE, "forest", opts());
    const b = generateMap(7, MAP_SIZE, "forest", opts());
    expect(a).toEqual(b);
    expect(a.terrain).toHaveLength(1600);
    const c = MAP_SIZE / 2;
    for (let dy = -3; dy <= 3; dy++)
      for (let dx = -3; dx <= 3; dx++) {
        const i = (c + dy) * MAP_SIZE + c + dx;
        expect(a.terrain[i]).toBe(0);
        expect(a.elevation[i]).toBe(0);
      }
    expect(generateMap(7, MAP_SIZE, "forest", opts({ variant: 1 }))).not.toEqual(a);
  });

  it("mar no lado escolhido, rio de água doce e relevo de colinas sem penhascos", () => {
    const m = generateMap(3, MAP_SIZE, "plains", opts({ coast: "oeste", water: "rio" }));
    const sea = (x: number) => Array.from({ length: MAP_SIZE }, (_, y) => m.terrain[y * MAP_SIZE + x] === 2).filter(Boolean).length;
    expect(sea(0)).toBeGreaterThan(MAP_SIZE * 0.7);
    expect(sea(MAP_SIZE - 1)).toBe(0);
    expect(m.terrain.some((t) => t === 1)).toBe(true);
    expect(Math.max(...m.elevation)).toBeGreaterThan(0);
    for (let y = 0; y < MAP_SIZE; y++)
      for (let x = 0; x + 1 < MAP_SIZE; x++) {
        expect(Math.abs(m.elevation[y * MAP_SIZE + x] - m.elevation[y * MAP_SIZE + x + 1])).toBeLessThanOrEqual(1);
      }
  });

  it("a quantidade de mata segue o editor", () => {
    const count = (forest: MapOptions["forest"]) => generateMap(5, MAP_SIZE, "forest", opts({ forest })).trees.filter(Boolean).length;
    expect(count(0)).toBe(0);
    expect(count(3)).toBeGreaterThan(count(1));
  });

  it("fundar cria cidade 40×40 com o mapa escolhido; opções inválidas viram o padrão", () => {
    const r = foundCity(createCity(5, T0), "salvador", T0, "medio", "Teste", { relief: "plano", water: "seco", coast: "leste", forest: 0, variant: 2 });
    if (!r.ok) throw new Error(r.error);
    expect(r.state.width).toBe(40);
    expect(r.state.terrain.some((t) => t === 2)).toBe(true);
    expect(r.state.trees.every((t) => t === 0)).toBe(true);
    expect(r.state.buildings[0]).toMatchObject({ type: "cityhall", x: 20, y: 20 });
    expect(sanitizeMapOptions({ relief: "lua", forest: 9 }, "desert", 0.1)).toEqual(defaultMapOptions("desert", 0.1));
  });

  it("migração v9 → v10: relevo plano e as árvores da decoração viram camada (fora das construções)", () => {
    const v9 = createCity(1, T0) as Partial<CityState>;
    v9.schemaVersion = 9;
    delete v9.elevation;
    delete v9.trees;
    const m = migrateState(v9 as CityState);
    expect(m.elevation.every((e) => e === 0)).toBe(true);
    expect(m.trees).toHaveLength(m.width * m.height);
    const hall = m.buildings[0];
    expect(m.trees[at(m, hall.x, hall.y)]).toBe(0);
  });
});

describe("Fase 9 — pontes, rampas e túneis", () => {
  it("via sobre a água vira ponte (mais cara); prédio não", () => {
    const s = flat();
    s.terrain[at(s, 13, 12)] = 1;
    const before = s.money;
    const r = applyCommand(s, { type: "build", building: "road", x: 13, y: 12 });
    expect(r.ok).toBe(true);
    if (r.ok) expect(before - r.state.money).toBe(10 * BRIDGE_MONEY);
    expect(applyCommand(s, { type: "build", building: "farm", x: 13, y: 12 }).ok).toBe(false);
  });

  it("rampa vence 1 nível; 2 níveis só com túnel (em morro)", () => {
    let s = flat();
    s.elevation[at(s, 14, 12)] = 1;
    s.elevation[at(s, 15, 12)] = 3;
    s.elevation[at(s, 16, 12)] = 3;
    s = apply(s, [
      { type: "build", building: "road", x: 13, y: 12 },
      { type: "build", building: "road", x: 14, y: 12 },
      { type: "build", building: "road", x: 16, y: 12 },
    ]);
    const net = connectedRoads(s);
    expect(net.has(at(s, 14, 12))).toBe(true); // rampa de 1 nível
    // Desnível de 2 (14 → 15): estrada comum não sobe.
    const blocked = apply(s, [{ type: "build", building: "road", x: 15, y: 12 }]);
    expect(connectedRoads(blocked).has(at(s, 16, 12))).toBe(false);
    // Túnel no morro liga.
    expect(applyCommand(s, { type: "build", building: "tunnel", x: 13, y: 13 }).ok).toBe(false); // terreno baixo
    const tunnel = apply(s, [{ type: "build", building: "tunnel", x: 15, y: 12 }]);
    expect(connectedRoads(tunnel).has(at(s, 16, 12))).toBe(true);
  });
});

describe("Fase 9 — terraplanagem e árvores", () => {
  it("elevar, rebaixar, criar água e aterrar respeitam as regras", () => {
    let s = flat();
    s = apply(s, [{ type: "terraform", action: "raise", x: 5, y: 5 }]);
    expect(s.elevation[at(s, 5, 5)]).toBe(1);
    expect(applyCommand(s, { type: "terraform", action: "water", x: 5, y: 5 }).ok).toBe(false); // precisa nível 0
    s = apply(s, [
      { type: "terraform", action: "lower", x: 5, y: 5 },
      { type: "terraform", action: "water", x: 5, y: 5 },
    ]);
    expect(s.terrain[at(s, 5, 5)]).toBe(1);
    s = apply(s, [{ type: "terraform", action: "land", x: 5, y: 5 }]);
    expect(s.terrain[at(s, 5, 5)]).toBe(0);
    s.terrain[at(s, 6, 6)] = 2;
    expect(applyCommand(s, { type: "terraform", action: "land", x: 6, y: 6 }).ok).toBe(false); // mar não
  });

  it("criar água fica mais barato com Rank alto", () => {
    const s = flat();
    s.streak = 1;
    const d = terraformCost(s, "water");
    s.streak = 5;
    expect(terraformCost(s, "water")).toBeLessThan(d);
    expect(terraformCost(s, "water")).toBe(Math.ceil(d * 0.6));
  });

  it("árvore valoriza o solo; construir em cima ou cortar rende madeira", () => {
    let s = flat();
    const before = computeServices(s).landValue[at(s, 8, 8)];
    s = apply(s, [
      { type: "terraform", action: "tree", x: 8, y: 9 },
      { type: "terraform", action: "tree", x: 9, y: 8 },
    ]);
    expect(computeServices(s).landValue[at(s, 8, 8)]).toBeGreaterThan(before);
    const wood = (c: CityState) => Object.entries(c.inventory).filter(([k]) => k.startsWith("wood")).reduce((a, [, v]) => a + (v ?? 0), 0);
    const w0 = wood(s);
    s = apply(s, [{ type: "demolish", x: 8, y: 9 }]);
    expect(s.trees[at(s, 8, 9)]).toBe(0);
    expect(wood(s)).toBe(w0 + 1);
  });
});

describe("Fase 9 — mar, orla e recursos", () => {
  it("dessalinizadora precisa encostar no mar e não depende da chuva", () => {
    let s = flat();
    expect(applyCommand(s, { type: "build", building: "desalination", x: 14, y: 13 }).ok).toBe(false);
    s.terrain[at(s, 14, 14)] = 2;
    s = apply(s, [
      { type: "build", building: "road", x: 13, y: 12 },
      { type: "build", building: "road", x: 14, y: 12 },
      { type: "build", building: "desalination", x: 14, y: 13 },
    ]);
    const status = buildingStatus(s);
    const dry = computeWater(s, { ...NEUTRAL_EFFECTS, water: 0.3 }, status);
    const wet = computeWater(s, { ...NEUTRAL_EFFECTS, water: 1.5 }, status);
    const desal = (w: typeof dry) => w.produced - 20 * (w === dry ? 0.3 : 1.5); // tira o poço da prefeitura
    expect(desal(dry)).toBeCloseTo(desal(wet), 0);
    expect(desal(dry)).toBeGreaterThan(0);
  });

  it("marina só à beira d'água", () => {
    const s = flat();
    expect(applyCommand(s, { type: "build", building: "marina", x: 14, y: 13 }).ok).toBe(false);
    s.terrain[at(s, 14, 14)] = 1;
    expect(applyCommand(s, { type: "build", building: "marina", x: 14, y: 13 }).ok).toBe(true);
  });

  it("previsão de recursos: sem fazendas, a comida acaba e a falta tem preço", () => {
    const s = flat();
    s.population = 40;
    s.zoneType[at(s, 14, 11)] = ZONE.R;
    s.inventory = { "food:C": 30 };
    const food = resourceOutlook(s).find((o) => o.res === "food")!;
    expect(food.needs).toBe(20);
    expect(food.net).toBeLessThan(0);
    expect(food.lasts).toBeCloseTo(1.5);
    expect(food.deficitCost).toBeGreaterThan(0);
  });
});
