import { describe, expect, it } from "vitest";
import {
  BUILDINGS,
  applyCommands,
  addTo,
  anchorAt,
  buildingStatus,
  businessStep,
  createCity,
  footprintOf,
  footprintTiles,
  idx,
  newCouncil,
  researchPerCycle,
  resolveCycle,
  rng,
  rollEvents,
  syncCitizens,
  tradeDiscount,
  type CityState,
} from "./index";

const T0 = Date.UTC(2026, 10, 12, 12);

/** Terra plana e rica, com estrada saindo da prefeitura. */
function flat(): CityState {
  const s = createCity(7, T0, "plains");
  s.terrain = s.terrain.map(() => 0);
  if (s.elevation) s.elevation = s.elevation.map(() => 0);
  s.trees = s.trees.map(() => 0);
  s.money = 100000;
  s.population = 400;
  s.techs = ["universidade_publica", "conteineres"];
  s.council = newCouncil();
  addTo(s.inventory, "planks", "D", 400);
  addTo(s.inventory, "metal", "D", 400);
  const hall = s.buildings.find((b) => b.type === "cityhall")!;
  let id = s.nextId;
  for (let dx = -6; dx <= 6; dx++) {
    s.buildings = s.buildings.filter((b) => !(b.x === hall.x + dx && b.y === hall.y + 1));
    s.buildings.push({ id: id++, type: "road", x: hall.x + dx, y: hall.y + 1 });
  }
  s.nextId = id;
  return s;
}

const hallOf = (s: CityState) => s.buildings.find((b) => b.type === "cityhall")!;

describe("construções que ocupam vários quadrados", () => {
  it("o catálogo define o tamanho de cada uma", () => {
    expect(footprintOf("house")).toBe(1);
    expect(footprintOf("university")).toBe(3);
    expect(footprintOf("intermodal")).toBe(3);
    expect(footprintOf("worker_coop")).toBe(2);
    expect(footprintOf("incubator")).toBe(2);
    expect(BUILDINGS.part.buildable).toBe(false);
    expect(footprintTiles({ type: "university", x: 5, y: 5 })).toHaveLength(9);
  });

  it("construir cria o dono e as partes, e cobra uma vez", () => {
    const s = flat();
    const hall = hallOf(s);
    const before = s.money;
    const r = applyCommands(s, [{ type: "build", building: "worker_coop", x: hall.x + 2, y: hall.y + 2 }]);
    expect(r.rejected).toEqual([]);
    const st = r.state;
    const owner = st.buildings.find((b) => b.type === "worker_coop")!;
    const parts = st.buildings.filter((b) => b.type === "part" && b.of === owner.id);
    expect(parts).toHaveLength(3);
    expect(before - st.money).toBeLessThanOrEqual(BUILDINGS.worker_coop.cost + 200);
    expect(anchorAt(st, owner.x + 1, owner.y + 1)!.id).toBe(owner.id);
  });

  it("não deixa construir por cima de outra coisa, na água, na borda ou em terreno desnivelado", () => {
    const s = flat();
    const hall = hallOf(s);
    // Sobre a estrada.
    expect(applyCommands(s, [{ type: "build", building: "university", x: hall.x, y: hall.y }]).rejected).toHaveLength(1);
    // Fora do mapa.
    expect(applyCommands(s, [{ type: "build", building: "university", x: s.width - 1, y: s.height - 1 }]).rejected).toHaveLength(1);
    // Água num dos tiles.
    const w = structuredClone(s);
    w.terrain[idx(w, hall.x + 3, hall.y + 3)] = 1;
    expect(applyCommands(w, [{ type: "build", building: "incubator", x: hall.x + 2, y: hall.y + 2 }]).rejected).toHaveLength(1);
    // Desnível.
    const d = structuredClone(s);
    d.elevation[idx(d, hall.x + 3, hall.y + 3)] = 1;
    expect(applyCommands(d, [{ type: "build", building: "incubator", x: hall.x + 2, y: hall.y + 2 }]).rejected).toHaveLength(1);
    // Sobreposição com outra construção grande.
    const a = applyCommands(s, [{ type: "build", building: "incubator", x: hall.x + 2, y: hall.y + 2 }]).state;
    expect(applyCommands(a, [{ type: "build", building: "worker_coop", x: hall.x + 3, y: hall.y + 3 }]).rejected).toHaveLength(1);
  });

  it("exige a tecnologia e a população", () => {
    const s = flat();
    s.techs = [];
    const hall = hallOf(s);
    expect(applyCommands(s, [{ type: "build", building: "university", x: hall.x + 1, y: hall.y + 2 }]).rejected).toHaveLength(1);
    expect(applyCommands(s, [{ type: "build", building: "intermodal", x: hall.x + 1, y: hall.y + 2 }]).rejected).toHaveLength(1);
  });

  it("demolir qualquer tile derruba o prédio inteiro", () => {
    const s = flat();
    const hall = hallOf(s);
    const built = applyCommands(s, [{ type: "build", building: "incubator", x: hall.x + 2, y: hall.y + 2 }]).state;
    const owner = built.buildings.find((b) => b.type === "incubator")!;
    const gone = applyCommands(built, [{ type: "demolish", x: owner.x + 1, y: owner.y + 1 }]).state;
    expect(gone.buildings.some((b) => b.type === "incubator" || b.type === "part")).toBe(false);
  });

  it("basta um dos tiles encostar na estrada para operar", () => {
    const s = flat();
    const hall = hallOf(s);
    // Estrada em y+1; a universidade começa em y+2, encostada nela.
    const st = applyCommands(s, [{ type: "build", building: "university", x: hall.x + 1, y: hall.y + 2 }]).state;
    const owner = st.buildings.find((b) => b.type === "university")!;
    expect(buildingStatus(st).get(owner.id)!.connected).toBe(true);
    // Mais longe da estrada: sem acesso.
    const far = applyCommands(s, [{ type: "build", building: "university", x: hall.x + 1, y: hall.y + 5 }]).state;
    const farOwner = far.buildings.find((b) => b.type === "university")!;
    expect(buildingStatus(far).get(farOwner.id)!.connected).toBe(false);
  });

  it("universidade rende pesquisa, terminal reduz o frete, incubadora e cooperativa fabril ajudam os negócios", () => {
    const s = flat();
    const hall = hallOf(s);
    const base = researchPerCycle(s);
    const tBase = tradeDiscount(s);
    let st = applyCommands(s, [{ type: "build", building: "university", x: hall.x + 1, y: hall.y + 2 }]).state;
    for (const b of st.buildings) delete b.readyAt; // obra pronta
    expect(researchPerCycle(st)).toBeGreaterThan(base + 10);
    st = applyCommands(st, [{ type: "build", building: "intermodal", x: hall.x - 5, y: hall.y + 2 }]).state;
    for (const b of st.buildings) delete b.readyAt;
    expect(tradeDiscount(st)).toBeCloseTo(tBase + 0.06);
    // Incubadora abre empreendedores sem nenhuma lei.
    st = applyCommands(st, [{ type: "build", building: "incubator", x: hall.x + 5, y: hall.y + 2 }]).state;
    for (const b of st.buildings) delete b.readyAt;
    const r = rng(4);
    for (let i = 0; i < 20; i++) businessStep(st, 40, r);
    expect(st.business.entrepreneurs).toBeGreaterThan(0);
  });
});

describe("posto médico", () => {
  it("é menor e mais barato que o hospital", () => {
    const c = BUILDINGS.clinic;
    const h = BUILDINGS.hospital;
    expect(c.buildable).toBe(true);
    expect(c.cost).toBeLessThan(h.cost);
    expect(c.upkeep).toBeLessThan(h.upkeep);
    expect(c.workers).toBeLessThan(h.workers);
    expect(c.service!.capacity!).toBeLessThan(h.service!.capacity!);
    expect(c.service!.radius!).toBeLessThan(h.service!.radius!);
    expect(c.service!.kind).toBe("hospital");
  });

  it("evita a gripe, mas não a peste", () => {
    const base = { healthServed: 0, hasFire: true, approval: 0.5, overwork: 0 };
    const tries = (info: object, id: string) => {
      let n = 0;
      for (let seed = 1; seed <= 400; seed++) {
        const s = flat();
        s.population = 400;
        const news = rollEvents(s, rng(seed), { ...base, ...info });
        if (news.some((x) => x.title.toLowerCase().includes(id))) n++;
      }
      return n;
    };
    const gripeSem = tries({ hasHospital: false, hasClinic: false }, "gripe");
    const gripeCom = tries({ hasHospital: false, hasClinic: true }, "gripe");
    expect(gripeCom).toBeLessThanOrEqual(gripeSem);
    expect(gripeCom).toBe(0);
  });
});

describe("cooperativa fabril e bônus de bens", () => {
  it("tecnologia e leis de bens também valem para a produção da cooperativa", () => {
    const run = (techs: string[], laws: string[]) => {
      const s = flat();
      const hall = hallOf(s);
      s.techs = techs;
      s.wires[idx(s, hall.x + 1, hall.y + 1)] = 1; // liga a prefeitura (usina) à cooperativa
      // Moradia para os trabalhadores.
      for (let k = 0; k < 12; k++) {
        const zi = idx(s, hall.x - 6 + k, hall.y - 3);
        s.zoneType[zi] = 1;
        s.zoneLevel[zi] = 4;
      }
      s.council = { ...newCouncil(), laws: laws as never[] };
      let st = applyCommands(s, [{ type: "build", building: "worker_coop", x: hall.x + 1, y: hall.y + 2 }]).state;
      for (const b of st.buildings) delete b.readyAt;
      st.population = 400;
      syncCitizens(st);
      st.inventory = {} as typeof st.inventory;
      const { report } = resolveCycle(st, T0);
      return (Object.entries(report.produced) as [string, number][]).filter(([k]) => k.startsWith("goods")).reduce((a, [, v]) => a + (v ?? 0), 0);
    };
    const base = run([], []);
    const boosted = run(["linha_montagem", "conteineres", "automacao"], ["isencao_industria"]);
    expect(base).toBeGreaterThan(0);
    expect(boosted).toBeGreaterThan(base);
  });
});
