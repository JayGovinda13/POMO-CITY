import { describe, expect, it } from "vitest";
import {
  BUILDINGS,
  ERAS,
  EVENT_CHANCE,
  TECHS,
  TECH_IDS,
  activeEvents,
  advanceResearch,
  advancementScore,
  applyCommands,
  applyDisaster,
  cityYear,
  createCity,
  eventMods,
  foundCity,
  roadAccess,
  zoneMaxLevel,
  lockReason,
  migrateState,
  rankEligible,
  researchPerCycle,
  resolveCycle,
  rng,
  rollEvents,
  techLock,
  techMods,
  type CityState,
} from "./index";

const T0 = Date.UTC(2026, 10, 12, 12);
const city = () => {
  const s = createCity(7, T0, "plains");
  s.population = 100;
  return s;
};

describe("árvore tecnológica", () => {
  it("cobre 200 anos, sem pré-requisito quebrado nem ciclo", () => {
    const years = TECH_IDS.map((id) => TECHS[id].year);
    expect(Math.min(...years)).toBe(1900);
    expect(Math.max(...years)).toBeGreaterThanOrEqual(2090);
    expect(Math.max(...years)).toBeLessThanOrEqual(2100);
    for (const id of TECH_IDS) {
      const t = TECHS[id];
      expect(ERAS.some((e) => e.id === t.era)).toBe(true);
      for (const r of t.requires) {
        expect(TECHS[r], `${id} requer ${r}`).toBeDefined();
        // O pré-requisito nunca é de uma época posterior.
        expect(TECHS[r].year).toBeLessThanOrEqual(t.year);
      }
    }
  });

  it("trava por ano e por pré-requisito", () => {
    const s = city();
    expect(cityYear(s)).toBe(1900);
    expect(techLock(s, "maquina_vapor")).toBeNull();
    expect(techLock(s, "aco")).toMatch(/Requer/);
    s.techs = ["maquina_vapor"];
    expect(techLock(s, "aco")).toMatch(/Disponível em 1912/);
    expect(techLock(s, "maquina_vapor")).toBe("Já pesquisada");
  });

  it("o comando de pesquisa só aceita tecnologia disponível", () => {
    const s = city();
    const ok = applyCommands(s, [{ type: "research", tech: "maquina_vapor" }]);
    expect(ok.rejected).toHaveLength(0);
    expect(ok.state.research.target).toBe("maquina_vapor");
    const bad = applyCommands(s, [{ type: "research", tech: "aco" }]);
    expect(bad.rejected).toHaveLength(1);
    const stop = applyCommands(ok.state, [{ type: "research", tech: null }]);
    expect(stop.state.research.target).toBeNull();
  });

  it("pontos sem alvo ficam guardados e completam a tecnologia depois", () => {
    const s = city();
    expect(advanceResearch(s, 10)).toEqual([]);
    expect(s.research.progress).toBe(10);
    s.research.target = "maquina_vapor"; // custa 15
    expect(advanceResearch(s, 4)).toEqual([]);
    expect(advanceResearch(s, 4)).toEqual(["maquina_vapor"]);
    expect(s.techs).toEqual(["maquina_vapor"]);
    expect(s.research.target).toBeNull();
    expect(s.research.progress).toBe(3);
  });

  it("o ciclo de foco gera pesquisa e conclui a tecnologia", () => {
    let s = city();
    s.research = { target: "agricultura_moderna", progress: 11.5 };
    const r = resolveCycle(s, T0);
    s = r.state;
    expect(r.report.research?.points).toBeGreaterThan(0);
    expect(r.report.research?.done).toEqual(["agricultura_moderna"]);
    expect(techMods(s).farm).toBeCloseTo(0.15);
  });

  it("escolas e tecnologias aumentam a pesquisa; os modificadores somam", () => {
    const s = city();
    const base = researchPerCycle(s, "D");
    s.techs = ["imprensa", "radio"];
    expect(researchPerCycle(s, "D")).toBeCloseTo(base * 1.2, 0);
    expect(researchPerCycle(s, "D")).toBeGreaterThan(base);
    expect(researchPerCycle(s, "S")).toBeGreaterThan(researchPerCycle(s, "D"));
    expect(techMods(s).tax).toBeCloseTo(0.05);
  });

  it("construções avançadas exigem a tecnologia", () => {
    const s = city();
    s.population = 100_000;
    s.cyclesCompleted = 800;
    expect(lockReason(BUILDINGS.nuclear_plant.requires, s)).toMatch(/tecnologia/);
    s.techs = ["energia_nuclear"];
    expect(lockReason(BUILDINGS.nuclear_plant.requires, s)).toBeNull();
  });

  it("migra um save antigo (v10) com os campos novos", () => {
    const old = city() as Partial<CityState> & { schemaVersion: number };
    old.schemaVersion = 10;
    delete old.techs;
    delete old.research;
    delete old.events;
    const m = migrateState(old as CityState);
    expect(m.techs).toEqual([]);
    expect(m.research).toEqual({ target: null, progress: 0 });
    expect(m.events).toEqual([]);
  });
});

describe("ranking", () => {
  it("tecnologia pesa na pontuação", () => {
    const s = city();
    const before = advancementScore(s, 1000);
    s.techs = ["maquina_vapor"];
    expect(advancementScore(s, 1000)).toBe(before + 500 + 15 * 2);
  });

  it("cidade que sofreu catástrofe sai do ranking para sempre", () => {
    const s = city();
    expect(rankEligible(s)).toBe(true);
    const hit = applyDisaster(s, "normal", "abandoned").state;
    expect(rankEligible(hit)).toBe(false);
    // Continua jogando, mas não volta a ser elegível.
    expect(rankEligible(resolveCycle(hit, T0).state)).toBe(false);
  });
});

describe("eventos aleatórios", () => {
  it("são determinísticos para a mesma semente", () => {
    const run = () => {
      const s = city();
      const rand = rng(1234);
      const titles: string[] = [];
      for (let i = 0; i < 80; i++) {
        s.cyclesCompleted++;
        titles.push(...rollEvents(s, rand, { healthServed: 1 }).map((e) => e.title));
        s.population = Math.max(s.population, 100);
      }
      return titles;
    };
    const a = run();
    expect(a).toEqual(run());
    expect(a.length).toBeGreaterThan(0);
  });

  it("não acontecem em vila pequena e respeitam a chance", () => {
    const tiny = city();
    tiny.population = 5;
    expect(rollEvents(tiny, () => 0, { healthServed: 1 })).toEqual([]);
    const s = city();
    expect(rollEvents(s, () => EVENT_CHANCE, { healthServed: 1 })).toEqual([]);
    expect(rollEvents(s, () => 0, { healthServed: 1 })).toHaveLength(1);
  });

  it("evento com duração vale por alguns ciclos e depois some", () => {
    const s = city();
    s.events = [{ id: "feira", start: 0, until: 2 }];
    expect(eventMods(s).tax).toBeGreaterThan(0);
    expect(activeEvents(s)[0].left).toBe(3);
    s.cyclesCompleted = 3;
    expect(eventMods(s).tax).toBe(0);
    rollEvents(s, () => 0.99, { healthServed: 1 });
    expect(s.events).toEqual([]);
  });

  it("desafio de população paga o prêmio ao bater a meta e expira sem ela", () => {
    const s = city();
    s.events = [{ id: "desafio_populacao", start: 0, until: 8, target: 100 }];
    const money = s.money;
    const news = rollEvents(s, () => 0.99, { healthServed: 1 });
    expect(news[0].title).toBe("Desafio cumprido!");
    expect(s.money).toBe(money + 600);
    expect(s.events).toEqual([]);

    const f = city();
    f.events = [{ id: "desafio_populacao", start: 0, until: 8, target: 5000 }];
    f.cyclesCompleted = 9;
    expect(rollEvents(f, rng(1), { healthServed: 1 })[0].title).toBe("Desafio não cumprido");
  });
});

describe("palácio da prefeitura e níveis por era", () => {
  it("na cidade fundada a prefeitura ocupa 3 tiles e não pode ser demolida nem coberta", () => {
    const r = foundCity(createCity(5, T0), "sao-paulo", T0);
    if (!r.ok) throw new Error(r.error);
    const s = r.state;
    const hall = s.buildings.find((b) => b.type === "cityhall")!;
    const wings = s.buildings.filter((b) => b.type === "cityhall_wing");
    expect(wings.map((b) => [b.x - hall.x, b.y - hall.y])).toEqual([[-1, 0], [1, 0]]);
    const e = s.elevation[hall.y * s.width + hall.x];
    for (const w of wings) {
      const i = w.y * s.width + w.x;
      expect(s.terrain[i]).toBe(0);
      expect(s.elevation[i]).toBe(e);
      expect(s.trees[i]).toBe(0);
    }
    const tries = applyCommands(s, [
      { type: "demolish", x: hall.x + 1, y: hall.y },
      { type: "build", building: "road", x: hall.x - 1, y: hall.y },
    ]);
    expect(tries.rejected).toHaveLength(2);
    // A malha viária parte também das alas.
    const road = applyCommands(s, [{ type: "build", building: "road", x: hall.x + 2, y: hall.y }]).state;
    expect(roadAccess(road)[hall.y * s.width + hall.x + 2]).toBe(0);
  });

  it("cada era libera 1 nível novo nas zonas densas", () => {
    const s = city();
    expect(zoneMaxLevel(s, "R", 1)).toBe(4);
    expect(zoneMaxLevel(s, "R", 0)).toBe(2);
    s.cyclesCompleted = (1930 - 1900) * 4; // Era Elétrica
    expect(zoneMaxLevel(s, "R", 1)).toBe(5);
    s.cyclesCompleted = (2070 - 1900) * 4; // Era do Futuro
    expect(zoneMaxLevel(s, "C", 1)).toBe(9);
    expect(zoneMaxLevel(s, "I", 0)).toBe(2);
  });
});
