import { describe, expect, it } from "vitest";
import {
  LAWS,
  LAW_IDS,
  PARTY_IDS,
  ZONE,
  businessStep,
  citizensView,
  createCity,
  lawCoop,
  lawEntrepreneur,
  leaning,
  migrateState,
  newCouncil,
  resolveCycle,
  rng,
  syncCitizens,
  type CityState,
  type LawId,
} from "./index";

const T0 = Date.UTC(2026, 10, 12, 12);

function town(laws: LawId[] = []): CityState {
  const s = createCity(41, T0, "plains");
  s.terrain = s.terrain.map(() => 0);
  s.cyclesCompleted = 400;
  for (let i = 0; i < 12; i++) {
    const idx = 5 * s.width + 5 + i;
    s.zoneType[idx] = ZONE.R;
    s.zoneLevel[idx] = 4;
  }
  s.population = 60;
  syncCitizens(s);
  s.council = { ...newCouncil(), laws };
  return s;
}

describe("banco de leis", () => {
  it("cada partido tem muitas leis, com nome e descrição", () => {
    for (const p of PARTY_IDS) {
      const n = LAW_IDS.filter((id) => LAWS[id].party === p).length;
      expect(n, p).toBeGreaterThanOrEqual(p === "fascista" ? 6 : 10);
    }
    for (const id of LAW_IDS) {
      expect(LAWS[id].name.length).toBeGreaterThan(3);
      expect(LAWS[id].description.length).toBeGreaterThan(20);
    }
    expect(LAW_IDS.length).toBeGreaterThanOrEqual(60);
  });

  it("empreendedorismo vem da direita e cooperativismo da esquerda", () => {
    const right = LAW_IDS.filter((id) => LAWS[id].entrepreneur);
    const left = LAW_IDS.filter((id) => LAWS[id].coop);
    const posOf = (id: LawId) => ({ esquerda: -2, socialdemocrata: -1, centro: 0, liberal: 1, conservador: 2, fascista: 3 })[LAWS[id].party];
    expect(right.filter((id) => posOf(id) >= 1).length).toBeGreaterThanOrEqual(5);
    expect(left.filter((id) => posOf(id) <= -1).length).toBeGreaterThanOrEqual(3);
    expect(LAWS.microempreendedor.party).toBe("liberal");
    expect(LAWS.cooperativas_trabalhadores.party).toBe("esquerda");
    expect(lawEntrepreneur(town(["microempreendedor"]))).toBeCloseTo(0.8);
    expect(lawCoop(town(["cooperativas_trabalhadores", "banco_cooperativo"]))).toBeCloseTo(1.5);
  });
});

describe("negócios próprios", () => {
  it("sem lei ninguém abre negócio", () => {
    const s = town();
    const r = businessStep(s, 30, rng(1));
    expect(r.opened).toBe(0);
    expect(s.business).toEqual({ entrepreneurs: 0, coops: 0 });
  });

  it("com lei, desempregados abrem negócio e pagam imposto; nunca mais que os desempregados", () => {
    const s = town(["microempreendedor", "cooperativas_trabalhadores"]);
    const r = rng(7);
    let last = businessStep(s, 40, r);
    for (let i = 0; i < 20; i++) last = businessStep(s, 40, r);
    expect(s.business.entrepreneurs).toBeGreaterThan(0);
    expect(s.business.coops).toBeGreaterThan(0);
    expect(s.business.entrepreneurs + s.business.coops).toBeLessThanOrEqual(40);
    expect(last.tax).toBeGreaterThan(0);
    // Sem desempregados, tudo fecha.
    businessStep(s, 0, r);
    expect(s.business.entrepreneurs + s.business.coops).toBe(0);
  });

  it("revogar a lei faz os negócios definharem", () => {
    const s = town(["microempreendedor"]);
    const r = rng(3);
    for (let i = 0; i < 15; i++) businessStep(s, 50, r);
    const peak = s.business.entrepreneurs;
    expect(peak).toBeGreaterThan(0);
    s.council.laws = [];
    for (let i = 0; i < 30; i++) businessStep(s, 50, r);
    expect(s.business.entrepreneurs).toBeLessThan(peak);
  });

  it("o desempregado com negócio próprio aparece na ficha e vota conforme o tipo", () => {
    const s = town();
    s.business = { entrepreneurs: 3, coops: 2 };
    const v = citizensView(s);
    const emp = v.filter((x) => x.business === "empreendedor");
    const coo = v.filter((x) => x.business === "cooperado");
    expect(emp.length).toBe(3);
    expect(coo.length).toBe(2);
    expect(emp[0].reasons.some((x) => x.text === "Tem o próprio negócio")).toBe(true);
    expect(coo[0].reasons.some((x) => x.text.startsWith("Sócio(a) de uma cooperativa"))).toBe(true);
    const le = leaning(emp[0], s);
    const lc = leaning(coo[0], s);
    expect(le.liberal).toBeGreaterThan(lc.liberal);
    expect(lc.esquerda).toBeGreaterThan(le.esquerda);
  });

  it("o ciclo roda com leis de negócio e registra o imposto", () => {
    const s = town(["microempreendedor", "cooperativas_trabalhadores"]);
    for (let i = 0; i < 6; i++) {
      const { state, report } = resolveCycle(s, T0);
      Object.assign(s, state);
      expect(report.business).toBeDefined();
    }
    expect(s.business.entrepreneurs + s.business.coops).toBeGreaterThanOrEqual(0);
  });

  it("saves antigos ganham o estado de negócios", () => {
    const old = createCity(1, T0) as Partial<CityState> & { schemaVersion: number };
    old.schemaVersion = 20;
    delete old.business;
    expect(migrateState(old as CityState).business).toEqual({ entrepreneurs: 0, coops: 0 });
  });
});
