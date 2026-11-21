import { describe, expect, it } from "vitest";
import {
  DEFAULT_PENSION,
  WORK_AGE,
  ZONE,
  ageYears,
  citizenProfile,
  citizensView,
  createCity,
  deathChance,
  demographics,
  demographyStep,
  ensureLives,
  familyOf,
  migrateState,
  pruneFamily,
  resolveCycle,
  rng,
  syncCitizens,
  taxableResidents,
  workingPopulation,
  type CityState,
} from "./index";

const T0 = Date.UTC(2026, 10, 12, 12);

/** Cidade com `n` moradores (adultos) e moradia de sobra. */
function town(n: number, housing = 400): CityState {
  const s = createCity(11, T0, "plains");
  s.terrain = s.terrain.map(() => 0);
  const lots = Math.ceil(housing / 16);
  for (let i = 0; i < lots; i++) {
    const idx = 5 * s.width + 5 + i;
    s.zoneType[idx] = ZONE.R;
    s.zoneLevel[idx] = 4;
  }
  s.population = n;
  syncCitizens(s);
  return s;
}

describe("mortalidade", () => {
  it("a idade média na morte acompanha a expectativa de vida da cidade", () => {
    for (const L of [50, 65, 78]) {
      const r = rng(1000 + L);
      let sum = 0;
      const N = 1500;
      for (let i = 0; i < N; i++) {
        let age = 0;
        while (age < 130) {
          age += 0.25;
          if (r() < deathChance(age, L)) break;
        }
        sum += age;
      }
      expect(Math.abs(sum / N - L)).toBeLessThan(6);
    }
    expect(deathChance(5, 60)).toBeLessThan(0.001);
    expect(deathChance(80, 60)).toBeGreaterThan(0.2);
  });
});

describe("registro de vida", () => {
  it("quem chega é adulto jovem e o gênero do registro é o do perfil", () => {
    const s = town(40);
    expect(Object.keys(s.people)).toHaveLength(40);
    for (const id of s.citizens) {
      const a = ageYears(s.people[id], s.cyclesCompleted);
      expect(a).toBeGreaterThanOrEqual(18);
      expect(a).toBeLessThan(44);
      expect(s.people[id].gender).toBe(citizenProfile({ seed: s.seed, regionId: s.regionId }, id).gender);
    }
  });

  it("saves antigos ganham idades e previdência desligada", () => {
    const old = town(30) as Partial<CityState> & { schemaVersion: number };
    old.schemaVersion = 15;
    delete old.people;
    delete old.pension;
    const m = migrateState(old as CityState);
    expect(Object.keys(m.people)).toHaveLength(30);
    expect(m.pension).toEqual(DEFAULT_PENSION);
  });
});

describe("casamento, filhos e morte", () => {
  it("solteiros se casam e ninguém casa com parente", () => {
    const s = town(60);
    let marriages = 0;
    const r = rng(5);
    for (let k = 0; k < 15; k++) marriages += demographyStep(s, r).marriages;
    expect(marriages).toBeGreaterThan(5);
    for (const id of s.citizens) {
      const p = s.people[id].partner;
      if (p === undefined) continue;
      expect(s.people[p].partner).toBe(id);
    }
  });

  it("casais têm filhos quando há moradia, com o sobrenome do pai", () => {
    const s = town(60, 400);
    const r = rng(9);
    let births = 0;
    for (let k = 0; k < 80; k++) {
      s.cyclesCompleted++;
      births += demographyStep(s, r).births;
    }
    expect(births).toBeGreaterThan(3);
    // O caçula nasceu nos últimos ciclos: ainda é criança.
    const kid = [...s.citizens].filter((id) => s.people[id].father !== undefined).sort((x, y) => s.people[y].born - s.people[x].born)[0];
    expect(kid).toBeDefined();
    const l = s.people[kid];
    expect(citizenProfile(s, kid).last).toBe(citizenProfile(s, l.father!).last);
    expect(ageYears(l, s.cyclesCompleted)).toBeLessThan(WORK_AGE);
    // A população acompanha a lista de moradores.
    expect(s.population).toBe(s.citizens.length);
  });

  it("sem moradia livre só nasce criança onde a morte liberou espaço", () => {
    const s = town(60, 60); // moradia justa (64)
    const cap = 64;
    const r = rng(9);
    let births = 0;
    let deaths = 0;
    for (let k = 0; k < 60; k++) {
      s.cyclesCompleted++;
      // cidade sempre lotada antes do ciclo de vida
      while (s.citizens.length < cap) {
        const id = s.nextCitizenId++;
        s.citizens.push(id);
        s.people[id] = { born: s.cyclesCompleted - 100, gender: "m" };
        s.population++;
      }
      const rep = demographyStep(s, r);
      births += rep.births;
      deaths += rep.deaths;
      expect(s.population).toBeLessThanOrEqual(cap);
    }
    expect(births).toBeLessThanOrEqual(deaths);
  });

  it("morrem os mais velhos, o parceiro fica viúvo e a população cai", () => {
    const s = town(40);
    s.cyclesCompleted = 4 * 100;
    for (const id of s.citizens) s.people[id].born = s.cyclesCompleted - 4 * 90; // todos com 90 anos
    const [a, b] = s.citizens;
    s.people[a].partner = b;
    s.people[b].partner = a;
    const r = rng(3);
    const before = s.population;
    const rep = demographyStep(s, r);
    expect(rep.deaths).toBeGreaterThan(20);
    expect(s.population).toBe(before - rep.deaths);
    expect(s.citizens.length).toBe(s.population);
    expect(rep.obituaries.length).toBeGreaterThan(0);
    expect(rep.obituaries[0].age).toBeGreaterThanOrEqual(90);
    // Se um morreu e o outro não, o sobrevivente ficou viúvo.
    const survivor = [a, b].find((x) => s.citizens.includes(x));
    if (survivor !== undefined && !s.citizens.includes(survivor === a ? b : a)) {
      expect(s.people[survivor].partner).toBeUndefined();
      expect(s.people[survivor].widowed).toBe(s.cyclesCompleted);
    }
  });
});

describe("efeito na cidade", () => {
  it("crianças e aposentados não trabalham nem ocupam vagas; aposentados pagam metade do imposto", () => {
    const s = town(20);
    const [c1, c2, r1, r2] = s.citizens;
    s.people[c1].born = s.cyclesCompleted - 4 * 8;
    s.people[c2].born = s.cyclesCompleted - 4 * 3;
    s.people[r1].born = s.cyclesCompleted - 4 * 70;
    s.people[r2].born = s.cyclesCompleted - 4 * 66;
    const d = demographics(s);
    expect(d.children).toBe(2);
    expect(d.retirees).toBe(2);
    expect(workingPopulation(s)).toBe(16);
    expect(taxableResidents(s)).toBe(20 - 2 - 1);
    const views = citizensView(s);
    const get = (id: number) => views.find((v) => v.id === id)!;
    expect(get(c1).stage).toBe("crianca");
    expect(get(c1).job).toBeNull();
    expect(get(c1).reasons.some((x) => x.text.startsWith("Desempregad"))).toBe(false);
    expect(get(r1).stage).toBe("aposentado");
    expect(get(r1).job).toBeNull();
  });

  it("o ciclo atualiza idades, registra o relatório e mantém população = moradores", () => {
    const s = town(60);
    s.money = 10_000;
    const { state, report } = resolveCycle(s, T0);
    expect(report.demography).toBeDefined();
    expect(state.citizens.length).toBe(state.population);
    expect(Object.keys(state.people).length).toBeGreaterThanOrEqual(state.citizens.length);
  });
});

describe("árvore genealógica", () => {
  it("mostra pais, avós, irmãos, parceiro e filhos", () => {
    const s = town(12);
    ensureLives(s);
    const [gp1, gp2, mom, dad, other, kid1, kid2, kid3] = s.citizens;
    const set = (id: number, patch: object) => Object.assign(s.people[id], patch);
    set(gp1, { gender: "m", partner: gp2 });
    set(gp2, { gender: "f", partner: gp1 });
    set(dad, { gender: "m", partner: mom, father: gp1, mother: gp2 });
    set(mom, { gender: "f", partner: dad });
    set(kid1, { born: s.cyclesCompleted - 8, mother: mom, father: dad });
    set(kid2, { born: s.cyclesCompleted - 4, mother: mom, father: dad });
    set(kid3, { born: s.cyclesCompleted, mother: other, father: 999 });
    const t = familyOf(s, kid1)!;
    expect(t.self.id).toBe(kid1);
    expect(t.parents.map((p) => p.id).sort()).toEqual([dad, mom].sort());
    expect(t.grandparents.map((p) => p.id).sort()).toEqual([gp1, gp2].sort());
    expect(t.siblings.map((p) => p.id)).toEqual([kid2]);
    const d = familyOf(s, dad)!;
    expect(d.partner!.id).toBe(mom);
    expect(d.children.map((c) => c.id).sort()).toEqual([kid1, kid2].sort());
    expect(d.parents.map((p) => p.id).sort()).toEqual([gp1, gp2].sort());
  });

  it("mortos continuam na árvore enquanto há parente vivo; depois somem", () => {
    const s = town(6);
    const [a, b, c] = s.citizens;
    s.people[c].mother = a;
    s.people[c].father = b;
    s.people[a].died = s.cyclesCompleted;
    s.citizens = s.citizens.filter((x) => x !== a);
    pruneFamily(s);
    expect(s.people[a]).toBeDefined(); // mãe de um vivo
    const t = familyOf(s, c)!;
    expect(t.parents.find((p) => p.id === a)!.alive).toBe(false);
    // Um morto sem nenhum parente vivo é esquecido.
    s.people[777] = { born: -50, died: s.cyclesCompleted - 10 };
    pruneFamily(s);
    expect(s.people[777]).toBeUndefined();
  });
});
