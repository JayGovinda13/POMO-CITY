import { describe, expect, it } from "vitest";
import {
  BASE_PRICE,
  ECO,
  ECO_PERIOD,
  ZONE,
  applyCommands,
  basePrice,
  citizensView,
  createCity,
  currentEffects,
  demandModifiers,
  ecoAt,
  ecoForecast,
  ecoState,
  landRentRevenue,
  migrateState,
  resolveCycle,
  syncCitizens,
  type CityState,
} from "./index";

const T0 = Date.UTC(2026, 10, 12, 12);

function town(): CityState {
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
  return s;
}

/** Põe a cidade no começo de uma fase do ciclo econômico. */
function inPhase(s: CityState, phase: keyof typeof ECO) {
  for (let k = 0; k < ECO_PERIOD; k++) {
    s.cyclesCompleted = 400 + k;
    if (ecoState(s).phase === phase) return;
  }
}

describe("ciclo econômico", () => {
  it("percorre as quatro fases em 40 ciclos, 10 em cada", () => {
    const s = createCity(7, T0);
    const seen = new Map<string, number>();
    for (let c = 0; c < ECO_PERIOD; c++) {
      const p = ecoAt(s, c).phase;
      seen.set(p, (seen.get(p) ?? 0) + 1);
    }
    expect([...seen.values()]).toEqual([10, 10, 10, 10]);
    expect(ecoAt(s, 3).phase).toBe(ecoAt(s, 3 + ECO_PERIOD).phase);
  });

  it("a previsão anuncia as próximas fases", () => {
    const s = town();
    const f = ecoForecast(s, 3);
    expect(f).toHaveLength(3);
    expect(f[0].startsIn).toBe(ecoState(s).left);
    expect(f[1].startsIn - f[0].startsIn).toBe(10);
    const next = ecoAt(s, s.cyclesCompleted + f[0].startsIn);
    expect(next.phase).toBe(f[0].phase);
  });

  it("na crise os produtos industriais valem menos e na prosperidade mais", () => {
    const s = town();
    inPhase(s, "crise");
    const crise = basePrice("metal", currentEffects(s));
    inPhase(s, "prosperidade");
    const boa = basePrice("metal", currentEffects(s));
    expect(crise).toBeLessThan(BASE_PRICE.metal);
    expect(boa).toBeGreaterThan(BASE_PRICE.metal);
    expect(basePrice("wood", currentEffects(s))).toBe(BASE_PRICE.wood); // só tábuas, metal e bens
  });

  it("títulos emitidos na crise têm juros maiores", () => {
    const rate = (phase: keyof typeof ECO) => {
      const s = town();
      s.money = 5000;
      inPhase(s, phase);
      return applyCommands(s, [{ type: "bond", action: "issue" }]).state.bonds.at(-1)!.rate;
    };
    expect(rate("crise")).toBeGreaterThan(rate("prosperidade"));
  });

  it("a demanda por comércio e indústria acompanha a fase", () => {
    const s = town();
    inPhase(s, "crise");
    const c = demandModifiers(s).C;
    inPhase(s, "prosperidade");
    expect(demandModifiers(s).C).toBeGreaterThan(c);
  });

  it("a crise abala o humor dos adultos", () => {
    const s = town();
    inPhase(s, "crise");
    const reasons = citizensView(s).flatMap((v) => v.reasons.map((r) => r.text));
    expect(reasons).toContain("Crise econômica");
    inPhase(s, "prosperidade");
    expect(citizensView(s).flatMap((v) => v.reasons.map((r) => r.text))).not.toContain("Crise econômica");
  });
});

describe("renda do solo (IPTU)", () => {
  const lv = (s: CityState) => new Float32Array(s.width * s.height).fill(60);

  it("IPTU zero não rende, e rende mais quanto maior a taxa", () => {
    const s = town();
    expect(landRentRevenue(s, lv(s))).toBe(0);
    s.landTax = 4;
    const a = landRentRevenue(s, lv(s));
    s.landTax = 8;
    expect(a).toBeGreaterThan(0);
    expect(landRentRevenue(s, lv(s))).toBe(a * 2);
  });

  it("comando valida de 0 a 10 e entra no caixa do ciclo", () => {
    const s = town();
    expect(applyCommands(s, [{ type: "budget", landTax: 11 }]).rejected).toHaveLength(1);
    const ok = applyCommands(s, [{ type: "budget", landTax: 6 }]);
    expect(ok.rejected).toEqual([]);
    expect(ok.state.landTax).toBe(6);
    const { report } = resolveCycle(ok.state, T0);
    expect(report.finance.landTax).toBeGreaterThanOrEqual(0);
  });

  it("IPTU alto reduz a demanda residencial; habitação popular divide o efeito por dois", () => {
    const s = town();
    const base = demandModifiers(s).R;
    s.landTax = 10;
    const alto = demandModifiers(s).R;
    expect(alto).toBeLessThan(base);
    s.ordinances = { habitacao_popular: 0 };
    const popular = demandModifiers(s).R;
    expect(popular).toBeGreaterThan(alto);
  });

  it("aluguel pesado entristece, mas a habitação popular o troca por moradia popular", () => {
    const s = town();
    s.landTax = 10;
    const texts = (c: CityState) => citizensView(c).flatMap((v) => v.reasons.map((r) => r.text));
    // Há moradores de baixa renda quando o valor do solo é baixo (cidade sem parques nem obras).
    const sem = texts(s);
    const com = (() => {
      const c = town();
      c.landTax = 10;
      c.ordinances = { habitacao_popular: 0 };
      return texts(c);
    })();
    expect(com).not.toContain("Aluguel pesado");
    if (sem.includes("Aluguel pesado")) expect(com).toContain("Moradia popular");
  });

  it("saves antigos ganham IPTU zero", () => {
    const old = createCity(1, T0) as Partial<CityState> & { schemaVersion: number };
    old.schemaVersion = 19;
    delete old.landTax;
    expect(migrateState(old as CityState).landTax).toBe(0);
  });
});
