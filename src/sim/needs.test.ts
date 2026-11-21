import { describe, expect, it } from "vitest";
import {
  AGE_GROUPS,
  LAWS,
  ZONE,
  ageGroupOf,
  applyCommands,
  citizensView,
  computeStrike,
  createCity,
  lawBirths,
  lawNoStrike,
  lawTaxIndustry,
  migrateState,
  needsFor,
  needsSummary,
  newCouncil,
  resolveCycle,
  rng,
  syncCitizens,
  demographyStep,
  type CityState,
  type LawId,
} from "./index";

const T0 = Date.UTC(2026, 10, 12, 12);

/** Cidade com 60 moradores, sem hospital, escola nem parque. */
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

const setAge = (s: CityState, id: number, years: number) => {
  s.people[id].born = s.cyclesCompleted - years * 4;
};

describe("faixas de idade e necessidades", () => {
  it("cada faixa de idade tem necessidades próprias", () => {
    expect(ageGroupOf(5, 65)).toBe("crianca");
    expect(ageGroupOf(15, 65)).toBe("crianca");
    expect(ageGroupOf(16, 65)).toBe("jovem");
    expect(ageGroupOf(24, 65)).toBe("jovem");
    expect(ageGroupOf(25, 65)).toBe("adulto");
    expect(ageGroupOf(64, 65)).toBe("adulto");
    expect(ageGroupOf(65, 65)).toBe("idoso");
    expect(ageGroupOf(62, 62)).toBe("idoso"); // a idade de aposentar muda a faixa
    const ctx = { hasHome: true, school: false, leisure: false, safe: true, health: false, transport: true, job: false, income: false };
    const ids = (g: (typeof AGE_GROUPS)[number]) => needsFor(g, ctx).map((n) => n.id);
    expect(ids("crianca")).toEqual(["escola", "brincar", "seguranca"]);
    expect(ids("jovem")).toEqual(["estudo_emprego", "lazer", "moradia"]);
    expect(ids("adulto")).toEqual(["emprego", "saude", "transporte", "seguranca"]);
    expect(ids("idoso")).toEqual(["saude", "renda", "lazer"]);
    // Atendimento: o jovem que estuda (escola por perto) cumpre a necessidade de estudo ou emprego.
    expect(needsFor("jovem", { ...ctx, school: true }).find((n) => n.id === "estudo_emprego")!.met).toBe(true);
  });

  it("falta de escola pesa para a criança e de hospital para o idoso, no humor", () => {
    const s = town();
    const [kid, old, adult] = s.citizens;
    setAge(s, kid, 8);
    setAge(s, old, 72);
    setAge(s, adult, 40);
    const v = citizensView(s);
    const get = (id: number) => v.find((x) => x.id === id)!;
    expect(get(kid).group).toBe("crianca");
    expect(get(kid).reasons.some((r) => r.text === "Criança sem escola por perto")).toBe(true);
    expect(get(kid).reasons.some((r) => r.text.startsWith("Sem lugar para as crianças"))).toBe(true);
    expect(get(old).group).toBe("idoso");
    expect(get(old).reasons.some((r) => r.text === "Idoso sem hospital por perto" && r.delta === -2)).toBe(true);
    expect(get(adult).reasons.some((r) => r.text.startsWith("Criança sem") || r.text.startsWith("Idoso sem"))).toBe(false);
  });

  it("cidade pequena não cobra serviços que ainda não existem", () => {
    const s = town();
    s.population = 20;
    s.citizens = s.citizens.slice(0, 20);
    setAge(s, s.citizens[0], 8);
    const kid = citizensView(s).find((x) => x.id === s.citizens[0])!;
    expect(kid.reasons.some((r) => r.text === "Criança sem escola por perto")).toBe(false);
  });

  it("o resumo diz quantos de cada idade têm cada necessidade atendida", () => {
    const s = town();
    s.citizens.forEach((id, i) => setAge(s, id, i < 10 ? 7 : i < 15 ? 20 : i < 50 ? 40 : 70));
    const sum = needsSummary(citizensView(s));
    expect(sum.map((g) => g.total)).toEqual([10, 5, 35, 10]);
    const escola = sum[0].needs.find((n) => n.id === "escola")!;
    expect(escola.met).toBe(0);
    expect(sum[3].needs.map((n) => n.id)).toEqual(["saude", "renda", "lazer"]);
  });
});

describe("leis dos partidos novos", () => {
  const withLaws = (ids: LawId[]): CityState => {
    const s = town();
    s.council = { ...newCouncil(), laws: ids };
    return s;
  };

  it("incentivo à família aumenta os nascimentos", () => {
    expect(lawBirths(withLaws(["incentivo_familia"]))).toBeCloseTo(0.4);
    const births = (s: CityState) => {
      const r = rng(77);
      let n = 0;
      for (let k = 0; k < 120; k++) {
        s.cyclesCompleted++;
        n += demographyStep(s, r).births;
      }
      return n;
    };
    const base = town();
    const fam = withLaws(["incentivo_familia"]);
    expect(births(fam)).toBeGreaterThanOrEqual(births(base));
  });

  it("proibição de greves zera a greve, mesmo com todos os motivos", () => {
    const s = town();
    s.population = 100;
    expect(computeStrike(s).share).toBeGreaterThan(0);
    const proibida = withLaws(["proibicao_greves"]);
    proibida.population = 100;
    expect(lawNoStrike(proibida)).toBe(true);
    expect(computeStrike(proibida).share).toBe(0);
  });

  it("imposto sobre grandes empresas é o contrário da isenção", () => {
    expect(lawTaxIndustry(withLaws(["taxar_grandes_empresas"]))).toBeCloseTo(-0.25);
    expect(lawTaxIndustry(withLaws(["isencao_industria"]))).toBeCloseTo(0.25);
    expect(lawTaxIndustry(withLaws(["taxar_grandes_empresas", "isencao_industria"]))).toBeCloseTo(0);
  });

  it("o estado de exceção troca crime por medo: o bairro fica seguro, mas o humor de todos cai", () => {
    expect(LAWS.estado_de_excecao.party).toBe("fascista");
    expect(LAWS.proibicao_greves.party).toBe("fascista");
    const calma = citizensView(town())[0];
    const repressao = citizensView(withLaws(["estado_de_excecao"]))[0];
    expect(calma.reasons.some((r) => r.text === "Bairro perigoso")).toBe(true);
    expect(repressao.reasons.some((r) => r.text === "Bairro perigoso")).toBe(false); // −35% de crime
    expect(repressao.reasons.find((r) => r.text === "Estado de exceção")!.delta).toBe(-2);
    // Leis sem efeito colateral no crime mexem só no humor.
    const milicia = citizensView(withLaws(["renda_basica"]))[0];
    expect(milicia.score).toBe(calma.score + 1);
  });

  it("aprovar um projeto fascista funciona como qualquer outro", () => {
    const s = town();
    s.council = { ...newCouncil(), bills: [{ id: 5, law: "milicia_urbana", party: "fascista", proposer: s.citizens[0], cycle: 400 }] };
    const ok = applyCommands(s, [{ type: "bill", id: 5, approve: true }]);
    expect(ok.rejected).toEqual([]);
    expect(ok.state.council.laws).toContain("milicia_urbana");
    expect(ok.state.council.standing.fascista).toBe(1);
  });
});

describe("migração v18", () => {
  it("câmaras salvas com os cinco partidos antigos passam para o espectro novo", () => {
    const old = createCity(1, T0) as Partial<CityState> & { schemaVersion: number };
    old.schemaVersion = 17;
    old.council = {
      members: [
        { id: 1, party: "trabalho" },
        { id: 2, party: "empresas" },
        { id: 3, party: "verde" },
        { id: 4, party: "social" },
        { id: 5, party: "ordem" },
      ],
      electedAt: 0,
      laws: ["salario_minimo"],
      bills: [{ id: 1, law: "arborizacao", party: "verde", proposer: 3, cycle: 0 }],
      nextBillId: 2,
      standing: { trabalho: 2, empresas: -1, verde: 1, social: 1, ordem: 0 },
      history: [],
    } as unknown as CityState["council"];
    const m = migrateState(old as CityState);
    expect(m.council.members.map((x) => x.party)).toEqual(["esquerda", "liberal", "socialdemocrata", "socialdemocrata", "conservador"]);
    expect(m.council.bills[0].party).toBe("socialdemocrata");
    expect(m.council.standing.esquerda).toBe(2);
    expect(m.council.standing.socialdemocrata).toBe(2); // verde + social
    expect(m.council.standing.fascista).toBe(0);
    expect(m.council.laws).toEqual(["salario_minimo"]);
  });

  it("o ciclo continua funcionando com a câmara nova", () => {
    const { report } = resolveCycle(town(), T0);
    expect(report.council).toBeDefined();
  });
});
