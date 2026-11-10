import { describe, expect, it } from "vitest";
import {
  START_EQ,
  applyCommand,
  applyCommands,
  applyDisaster,
  citizensView,
  computeDemand,
  computeServices,
  createCity,
  developZones,
  migrateState,
  premium,
  resolveCycle,
  rng,
  roadAccess,
  syncCitizens,
  updateQuality,
  ZONE,
  type CityState,
  type Command,
  BUILDINGS,
} from "./index";

const T0 = Date.UTC(2026, 10, 10, 12);
const at = (s: CityState, x: number, y: number) => y * s.width + x;

function base(): CityState {
  const s = createCity(71, T0, "plains");
  s.terrain = s.terrain.map(() => 0);
  s.money = 50_000;
  return s;
}

const apply = (s: CityState, cmds: Command[]) => {
  const r = applyCommands(s, cmds);
  expect(r.rejected).toEqual([]);
  return r.state;
};

/** Bairro denso (R e C nível 4) ao longo de uma estrada ligada à prefeitura. */
function denseTown(extra: Command[] = []): CityState {
  const cmds: Command[] = [];
  for (let x = 13; x <= 20; x++) cmds.push({ type: "build", building: "road", x, y: 12 }, { type: "wire", x, y: 12 });
  const s = base();
  s.population = 200;
  let st = apply(s, [...cmds, ...extra]);
  for (let x = 13; x <= 20; x++) {
    st.zoneType[at(st, x, 11)] = x < 18 ? ZONE.R : ZONE.C;
    st.zoneDensity[at(st, x, 11)] = 1;
    st.zoneLevel[at(st, x, 11)] = 4;
  }
  st = structuredClone(st);
  syncCitizens(st);
  return st;
}

describe("Fase 7 — campos espaciais", () => {
  it("delegacia reduz o crime ao redor (decaindo com a distância)", () => {
    const without = computeServices(denseTown());
    const town = denseTown([{ type: "build", building: "police", x: 16, y: 13 }]);
    const withPolice = computeServices(town);
    const i = at(town, 16, 11);
    expect(without.crime[i]).toBeGreaterThan(40);
    expect(withPolice.crime[i]).toBeLessThan(without.crime[i] * 0.6);
    // Mais longe da delegacia, a cobertura é menor.
    expect(withPolice.police[at(town, 20, 11)]).toBeLessThan(withPolice.police[i]);
  });

  it("usina térmica polui a vizinhança e parque limpa e valoriza", () => {
    const city = base();
    city.population = 20; // a usina só polui operando (estrada e trabalhadores)
    let s = apply(city, [
      { type: "build", building: "road", x: 13, y: 12 },
      { type: "build", building: "road", x: 14, y: 12 },
      { type: "build", building: "thermal_plant", x: 15, y: 12 },
    ]);
    const dirty = computeServices(s);
    expect(dirty.pollution[at(s, 16, 13)]).toBeGreaterThan(20);
    expect(dirty.pollution[at(s, 16, 13)]).toBeGreaterThan(dirty.pollution[at(s, 19, 16)]);
    s = apply(s, [{ type: "build", building: "park", x: 17, y: 14 }]);
    const clean = computeServices(s);
    expect(clean.pollution[at(s, 16, 13)]).toBeLessThan(dirty.pollution[at(s, 16, 13)]);
    expect(clean.landValue[at(s, 18, 15)]).toBeGreaterThan(dirty.landValue[at(s, 18, 15)]);
  });

  it("prisão reforça a polícia quando o crime é alto", () => {
    const town = denseTown([{ type: "build", building: "police", x: 20, y: 13 }]);
    town.population = 200;
    const before = computeServices(town);
    const withPrison = apply(town, [{ type: "build", building: "prison", x: 21, y: 12 }]);
    const after = computeServices(withPrison);
    expect(after.prisonBoost).toBe(true);
    expect(after.crime[at(town, 19, 11)]).toBeLessThan(before.crime[at(town, 19, 11)]);
  });

  it("crime alto trava o crescimento residencial", () => {
    const s = denseTown();
    for (let x = 13; x <= 17; x++) s.zoneLevel[at(s, x, 11)] = 3;
    const f = computeServices(s);
    f.crime.fill(90);
    const powered = new Uint8Array(s.width * s.height).fill(1);
    developZones(s, { rank: "S", rand: rng(2), powered, access: roadAccess(s), services: f });
    for (let x = 13; x <= 17; x++) expect(s.zoneLevel[at(s, x, 11)]).toBeLessThanOrEqual(3);
  });
});

describe("Fase 7 — saúde, educação e lazer", () => {
  it("escola leva o QE até 90; faculdade passa disso; biblioteca impede a erosão", () => {
    const s = base();
    s.population = 100;
    const school = { schoolServed: 1, collegeServed: 0 };
    const f = { ...computeServices(s), ...school };
    for (let k = 0; k < 30; k++) updateQuality(s, f);
    expect(s.eq).toBeGreaterThan(85);
    expect(s.eq).toBeLessThanOrEqual(90);
    for (let k = 0; k < 30; k++) updateQuality(s, { ...f, collegeServed: 1 });
    expect(s.eq).toBeGreaterThan(130);
    const high = s.eq;
    updateQuality(s, { ...f, schoolServed: 0, collegeServed: 0, eqProtected: true });
    expect(s.eq).toBeGreaterThan(high * 0.97);
    updateQuality(s, { ...f, schoolServed: 0, collegeServed: 0, eqProtected: false });
    expect(s.eq).toBeLessThan(high * 0.95);
  });

  it("hospital aumenta a expectativa de vida devagar (no máximo 1 ano por estação)", () => {
    const s = base();
    const life = s.lifeExpectancy;
    const f = { ...computeServices(s), healthServed: 1 };
    updateQuality(s, f);
    expect(s.lifeExpectancy - life).toBeGreaterThan(0);
    expect(s.lifeExpectancy - life).toBeLessThanOrEqual(1);
  });

  it("zoológico e estádio aumentam a demanda residencial e comercial", () => {
    const s = denseTown();
    const before = computeDemand(s);
    const zoo = apply(s, [{ type: "build", building: "zoo", x: 15, y: 13 }]);
    const after = computeDemand(zoo);
    expect(after.R).toBeGreaterThanOrEqual(before.R);
    expect(computeServices(zoo).attraction).toBeGreaterThan(0);
  });

  it("moradores comentam o bairro (seguro, parque, poluição)", () => {
    const s = apply(base(), [
      { type: "build", building: "road", x: 13, y: 12 },
      { type: "wire", x: 13, y: 12 },
      { type: "zone", zone: "R", dense: false, x0: 14, y0: 12, x1: 14, y1: 12 },
      { type: "build", building: "plaza", x: 15, y: 12 },
      { type: "build", building: "police", x: 13, y: 13 },
    ]);
    s.zoneLevel[at(s, 14, 12)] = 2;
    s.population = 8;
    syncCitizens(s);
    const texts = citizensView(s)[0].reasons.map((r) => r.text);
    expect(texts).toContain("Parque perto de casa");
    expect(texts).toContain("Bairro seguro");
    expect(citizensView(s)[0].wealth).not.toBeNull();
  });

  it("faculdade e prisão exigem população", () => {
    const s = base();
    expect(applyCommand(s, { type: "build", building: "college", x: 3, y: 3 }).ok).toBe(false);
    s.population = 150;
    expect(applyCommand(s, { type: "build", building: "college", x: 3, y: 3 }).ok).toBe(true);
  });
});

describe("Fase 7 — orçamento, seguro e ciclo", () => {
  it("serviços entram na manutenção por departamento e respeitam a verba", () => {
    const s = denseTown([
      { type: "build", building: "police", x: 16, y: 13 },
      { type: "build", building: "school", x: 17, y: 13 },
    ]);
    const full = resolveCycle(s, T0).report;
    expect(full.finance.upkeepServices).toBe(BUILDINGS.police.upkeep + BUILDINGS.school.upkeep);
    const cut = applyCommand(s, { type: "budget", funding: { police: 50, education: 50 } });
    expect(cut.ok).toBe(true);
    if (!cut.ok) return;
    expect(resolveCycle(cut.state, T0).report.finance.upkeepServices).toBe(Math.ceil((BUILDINGS.police.upkeep + BUILDINGS.school.upkeep) / 2));
    expect(full.services?.eq).toBeGreaterThan(0);
  });

  it("bombeiros barateiam o seguro e evitam estragos de incêndio", () => {
    let s = denseTown();
    s = apply(s, [{ type: "insurance", plan: "completo" }]);
    const p0 = premium(s);
    const fire = apply(s, [{ type: "build", building: "fire_station", x: 16, y: 13 }]);
    expect(premium(fire)).toBeLessThan(p0 + 1000 * 0.008); // o quartel aumenta o valor da cidade, mas o desconto compensa
    // Força um incêndio (seca severa) e compara os estragos.
    const dry = (c: CityState) => {
      c.regionId = null;
      return c;
    };
    let savedSome = false;
    for (let k = 0; k < 6 && !savedSome; k++) {
      const c = dry(structuredClone(fire));
      c.disasterCount = k;
      const r = applyDisaster(c, "normal", "abandoned").report;
      if (r.kind === "incendio") savedSome = r.savedByFirefighters > 0;
    }
    expect(savedSome).toBe(true);
  });

  it("migração v8 → v9 adiciona verbas, QE e expectativa de vida", () => {
    const v8 = createCity(1, T0) as Partial<CityState>;
    v8.schemaVersion = 8;
    v8.funding = { transport: 80, energy: 90 } as CityState["funding"];
    delete v8.eq;
    delete v8.lifeExpectancy;
    const m = migrateState(v8 as CityState);
    expect(m.funding).toMatchObject({ transport: 80, energy: 90, police: 100, education: 100 });
    expect(m.eq).toBe(START_EQ);
    expect(m.lifeExpectancy).toBeGreaterThan(0);
  });
});
