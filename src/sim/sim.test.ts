import { describe, expect, it } from "vitest";
import {
  abandonCycle,
  applyCommands,
  buildingStatus,
  createCity,
  getQty,
  rankForStreak,
  resolveCycle,
  SESSION_GAP_MS,
  DAILY_REWARD_CAP,
  type CityState,
  type Command,
} from "./index";

const T0 = Date.UTC(2026, 10, 9, 12, 0, 0);
const MIN = 60_000;

function city(): CityState {
  const s = createCity(42, T0, "forest");
  // Mapa limpo para testes determinísticos.
  s.terrain = s.terrain.map(() => 0);
  return s;
}

const road = (x: number, y: number): Command => ({ type: "build", building: "road", x, y });

describe("commands", () => {
  it("cria construções e debita o custo", () => {
    const s = city();
    const { state, rejected } = applyCommands(s, [road(13, 12), { type: "build", building: "house", x: 14, y: 12 }]);
    expect(rejected).toEqual([]);
    expect(state.money).toBe(s.money - 10 - 50);
    expect(state.buildings).toHaveLength(3);
    expect(s.buildings).toHaveLength(1); // original intacto
  });

  it("rejeita tile ocupado, água, falta de dinheiro e prefeitura", () => {
    const s = city();
    s.terrain[0] = 1;
    s.money = 15;
    const { rejected } = applyCommands(s, [
      road(12, 12), // prefeitura
      road(0, 0), // água
      { type: "build", building: "mine", x: 3, y: 3 }, // caro
      { type: "demolish", x: 12, y: 12 },
      { type: "build", building: "cityhall", x: 5, y: 5 },
    ]);
    expect(rejected.map((r) => r.index)).toEqual([0, 1, 2, 3, 4]);
  });

  it("monumento exige metal rank S", () => {
    const s = city();
    s.money = 5000;
    s.inventory = { "metal:A": 50, "planks:B": 20 };
    expect(applyCommands(s, [{ type: "build", building: "monument", x: 1, y: 1 }]).rejected).toHaveLength(1);
    s.inventory["metal:S"] = 10;
    const r = applyCommands(s, [{ type: "build", building: "monument", x: 1, y: 1 }]);
    expect(r.rejected).toHaveLength(0);
    expect(getQty(r.state.inventory, "metal", "S")).toBe(0);
    expect(getQty(r.state.inventory, "metal", "A")).toBe(50);
  });
});

describe("adjacência de estradas", () => {
  it("só opera quem toca estrada ligada à prefeitura", () => {
    const s = city();
    const { state } = applyCommands(s, [
      road(13, 12),
      { type: "build", building: "house", x: 14, y: 12 }, // ligada
      road(2, 2),
      { type: "build", building: "house", x: 3, y: 2 }, // estrada isolada
    ]);
    const st = buildingStatus(state);
    const [, , h1, , h2] = state.buildings;
    expect(st.get(h1.id)!.connected).toBe(true);
    expect(st.get(h2.id)!.connected).toBe(false);
  });
});

describe("ranks e sequência", () => {
  it("mapeia sequência para rank", () => {
    expect([1, 2, 3, 4, 5, 9].map(rankForStreak)).toEqual(["D", "C", "B", "A", "S", "S"]);
  });

  it("sobe a cada ciclo, decai com abandono e com intervalo longo", () => {
    let s = city();
    for (let i = 0; i < 3; i++) s = resolveCycle(s, T0 + i * 30 * MIN).state;
    expect(s.streak).toBe(3);
    s = abandonCycle(s);
    expect(s.streak).toBe(1);
    const r = resolveCycle(s, s.lastCycleAt! + SESSION_GAP_MS + 1);
    expect(r.report.streak).toBe(1); // 1 - 2 → 0, +1
  });

  it("limite diário: ciclo conta mas não gera recompensa", () => {
    let s = city();
    s.cyclesToday = DAILY_REWARD_CAP;
    s.dayKey = new Date(T0).toISOString().slice(0, 10);
    const { report, state } = resolveCycle(s, T0);
    expect(report.rewarded).toBe(false);
    expect(state.money).toBe(s.money);
  });
});

describe("economia do ciclo", () => {
  function productiveCity() {
    const s = city();
    s.money = 10_000;
    const cmds: Command[] = [];
    for (let x = 13; x <= 20; x++) cmds.push(road(x, 12));
    cmds.push({ type: "build", building: "house", x: 13, y: 11 });
    cmds.push({ type: "build", building: "house", x: 14, y: 11 });
    cmds.push({ type: "build", building: "lumberyard", x: 15, y: 11 });
    cmds.push({ type: "build", building: "sawmill", x: 16, y: 11 });
    cmds.push({ type: "build", building: "farm", x: 17, y: 11 });
    const st = applyCommands(s, cmds);
    expect(st.rejected).toEqual([]);
    return st.state;
  }

  it("extrai com o rank do foco, aplica bioma e cobra manutenção", () => {
    let s = productiveCity();
    s.population = 16;
    s.streak = 4; // próximo ciclo = S
    const { state, report } = resolveCycle(s, T0);
    expect(report.rank).toBe("S");
    // floresta: madeira 8 × 1.5 = 12 (serraria consome 4 do topo)
    expect(report.produced["wood:S"]).toBe(12);
    // tábuas limitadas pelo Tech Tier B, sem desperdício (insumo S)
    expect(report.produced["planks:B"]).toBe(4);
    expect(report.wasted["planks:B"] ?? 0).toBe(0);
    expect(report.upkeep).toBe(8 * 1 + 3 + 5 + 2);
    expect(report.taxes).toBe(16 * 3);
    expect(state.money).toBe(s.money + report.taxes - report.upkeep);
  });

  it("insumo de baixa pureza gera desperdício", () => {
    let s = productiveCity();
    s.population = 16;
    s.inventory = { "food:C": 100, "wood:D": 50 };
    s.biome = "plains";
    // Sem a madeireira operando, só a madeira D estocada chega à serraria.
    s.buildings = s.buildings.filter((b) => b.type !== "lumberyard");
    const { report } = resolveCycle(s, T0);
    expect(report.consumed["wood:D"]).toBe(4);
    expect(report.produced["planks:D"]).toBe(2); // 4 × (1 - 0.4) = 2.4 → 2
    expect(report.wasted["planks:D"]).toBe(2);
  });

  it("primeiros ciclos de uma cidade nova dão lucro ou empatam", () => {
    let s = productiveCity();
    let money = s.money;
    for (let i = 0; i < 4; i++) {
      const r = resolveCycle(s, T0 + i * 30 * MIN);
      s = r.state;
      expect(r.report.netMoney).toBeGreaterThan(0);
      money = s.money;
    }
    expect(money).toBeGreaterThan(0);
    expect(s.population).toBe(16);
  });

  it("é determinístico", () => {
    const a = resolveCycle(productiveCity(), T0);
    const b = resolveCycle(productiveCity(), T0);
    expect(a).toEqual(b);
  });
});
