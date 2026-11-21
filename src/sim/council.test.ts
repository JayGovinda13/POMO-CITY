import { describe, expect, it } from "vitest";
import {
  DEFAULT_LABOR,
  LAWS,
  LAW_IDS,
  MAX_PENDING_BILLS,
  PARTY_IDS,
  TERM_CYCLES,
  ZONE,
  applyCommands,
  councilStep,
  createCity,
  cyclesToElection,
  hasLaw,
  hasPensionIncome,
  holdElection,
  isCoup,
  rankEligible,
  generateNewspaper,
  leaning,
  ballot,
  crisisLevel,
  signalsOf,
  relevance,
  PARTIES,
  citizensView,
  inspected,
  lawMods,
  migrateState,
  newCouncil,
  resolveCycle,
  rng,
  seatsFor,
  syncCitizens,
  techMods,
  type CitizenView,
  type CityState,
  type Command,
} from "./index";

const T0 = Date.UTC(2026, 10, 12, 12);

function town(n = 80): CityState {
  const s = createCity(31, T0, "plains");
  s.terrain = s.terrain.map(() => 0);
  s.cyclesCompleted = 100;
  s.money = 50_000;
  for (let i = 0; i < 30; i++) {
    const idx = 5 * s.width + 5 + i;
    s.zoneType[idx] = ZONE.R;
    s.zoneLevel[idx] = 4;
  }
  s.population = n;
  syncCitizens(s);
  return s;
}

describe("eleição", () => {
  it("o número de cadeiras cresce com a cidade", () => {
    expect(seatsFor(50)).toBe(5);
    expect(seatsFor(200)).toBe(7);
    expect(seatsFor(500)).toBe(9);
    expect(seatsFor(5000)).toBe(11);
  });

  it("a primeira eleição forma a câmara com moradores de verdade", () => {
    const s = town(80);
    const r = councilStep(s, rng(1));
    expect(r.election).toBeDefined();
    expect(s.council.members).toHaveLength(5);
    const ids = new Set(s.council.members.map((m) => m.id));
    expect(ids.size).toBe(5);
    for (const m of s.council.members) {
      expect(s.citizens).toContain(m.id);
      expect(PARTY_IDS).toContain(m.party);
    }
    const seats = Object.values(r.election!.seats).reduce((a, b) => a + b, 0);
    expect(seats).toBe(5);
    expect(s.council.electedAt).toBe(100);
  });

  it("cidade muito pequena não tem câmara", () => {
    const s = town(10);
    councilStep(s, rng(1));
    expect(s.council.members).toHaveLength(0);
  });

  it("o mandato dura 16 ciclos (4 anos) e depois há nova eleição", () => {
    const s = town(80);
    const r = rng(2);
    councilStep(s, r);
    expect(cyclesToElection(s)).toBe(TERM_CYCLES);
    s.cyclesCompleted += TERM_CYCLES - 1;
    expect(councilStep(s, r).election).toBeUndefined();
    expect(cyclesToElection(s)).toBe(1);
    s.cyclesCompleted += 1;
    expect(councilStep(s, r).election).toBeDefined();
    expect(s.council.electedAt).toBe(s.cyclesCompleted);
  });

  it("os eleitores votam pelo que vivem: cada situação pesa num ponto do espectro", () => {
    const base = { age: 40, stage: "adulto", group: "adulto", needs: [], children: 0, mood: "ok", wealth: "baixa", job: null, reasons: [] } as unknown as CitizenView;
    const w = (patch: Partial<CitizenView>, crisis = 0) => leaning({ ...base, ...patch } as CitizenView, { council: newCouncil() }, crisis);
    const maior = (x: Record<string, number>) => Object.entries(x).sort((a, b) => b[1] - a[1])[0][0];
    const emprego = { title: "x", category: "servicos", place: "y", x: 0, y: 0 } as CitizenView["job"];
    expect(maior(w({ job: null }))).toBe("esquerda"); // desempregado
    expect(maior(w({ wealth: "alta", job: { ...emprego!, category: "comercio" } }))).toBe("liberal");
    expect(maior(w({ job: emprego, reasons: [{ text: "Aposentado(a) sem renda", delta: -3 }], group: "idoso", stage: "aposentado" }))).toBe("socialdemocrata");
    expect(maior(w({ job: emprego, reasons: [{ text: "Bairro perigoso", delta: -2 }] }))).toBe("conservador");
    expect(maior(w({ job: emprego, mood: "feliz", wealth: "media" }))).toBe("centro");
    // O Fascista não pesa sem crise; na crise, os descontentes e inseguros migram para ele.
    expect(w({ job: null, mood: "triste", reasons: [{ text: "Bairro perigoso", delta: -2 }] }).fascista).toBe(0);
    expect(maior(w({ job: emprego, mood: "triste", reasons: [{ text: "Bairro perigoso", delta: -2 }] }, 1.6))).toBe("fascista");
    // O prefeito que aprova leis de um partido o fortalece na eleição.
    const forte = leaning({ ...base } as CitizenView, { council: { ...newCouncil(), standing: { ...newCouncil().standing, esquerda: 5 } } });
    expect(forte.esquerda).toBeGreaterThan(w({}).esquerda);
  });

  it("o Fascista só disputa a eleição em tempos de crise", () => {
    expect(ballot(0)).not.toContain("fascista");
    expect(ballot(1.6)).toContain("fascista");
    const normal = town(120);
    expect(holdElection(normal, rng(3))!.votes.fascista).toBe(0);
    const crise = town(120);
    crise.money = -500; // caixa no vermelho
    crise.strike = { share: 0.3, causes: [] }; // greve geral
    crise.lastDisasterCycle = crise.cyclesCompleted - 2; // desastre recente
    const e = holdElection(crise, rng(3))!;
    expect(e.crisis).toBeGreaterThanOrEqual(3);
    expect(e.votes.fascista).toBeGreaterThan(0);
    expect(crisisLevel(crise, signalsOf(citizensView(crise), crise))).toBe(e.crisis);
  });

  it("cada partido propõe leis do próprio espectro, favorecendo o que a cidade precisa", () => {
    for (const id of LAW_IDS) expect(PARTY_IDS).toContain(LAWS[id].party);
    // Espectro: cada partido tem ao menos uma lei, da esquerda para a direita.
    for (const p of PARTY_IDS) expect(LAW_IDS.some((id) => LAWS[id].party === p)).toBe(true);
    expect(PARTY_IDS.map((p) => PARTIES[p].position)).toEqual([-2, -1, 0, 1, 2, 3]);
    const sinais = { unemployed: 0, fatigue: 0, poor: 0, unsafe: 1, polluted: 0, nohospital: 0, noincome: 0, kids: 0, fewkids: 0, unhappy: 0, deficit: 0, strike: 0 };
    expect(relevance("guarda_municipal", sinais)).toBeGreaterThan(relevance("austeridade", sinais));
    expect(relevance("austeridade", { ...sinais, unsafe: 0, deficit: 1 })).toBeGreaterThan(relevance("guarda_municipal", { ...sinais, unsafe: 0, deficit: 1 }));
  });

  it("a eleição reparte exatamente as cadeiras entre os partidos mais votados", () => {
    const e = holdElection(town(120), rng(3))!;
    expect(Object.values(e.seats).reduce((a, b) => a + b, 0)).toBe(seatsFor(120));
    expect(e.members).toHaveLength(seatsFor(120));
    // Mais votos, mais cadeiras (ou iguais).
    const ranking = PARTY_IDS.slice().sort((a, b) => e.votes[b] - e.votes[a]);
    expect(e.seats[ranking[0]]).toBeGreaterThanOrEqual(e.seats[ranking[ranking.length - 1]]);
  });

  it("vereador que morre é substituído por um suplente do mesmo partido", () => {
    const s = town(80);
    const r = rng(5);
    councilStep(s, r);
    const dead = { ...s.council.members[0] }; // cópia: o registro é trocado pelo suplente
    s.citizens = s.citizens.filter((id) => id !== dead.id);
    s.population--;
    const rep = councilStep(s, r);
    expect(rep.replaced).toBe(1);
    expect(s.council.members[0].party).toBe(dead.party);
    expect(s.council.members[0].id).not.toBe(dead.id);
  });
});

describe("propostas de lei", () => {
  it("cada ciclo a câmara propõe uma lei do partido de algum vereador", () => {
    const s = town(80);
    const r = rng(6);
    councilStep(s, r); // eleição
    s.cyclesCompleted++;
    const rep = councilStep(s, r);
    expect(rep.proposal).toBeDefined();
    const bill = s.council.bills.at(-1)!;
    expect(LAWS[bill.law].party).toBe(bill.party);
    expect(s.council.members.some((m) => m.party === bill.party && m.id === bill.proposer)).toBe(true);
  });

  it("a pauta tem limite: as mais antigas são arquivadas e leis em vigor não voltam", () => {
    const s = town(80);
    const r = rng(7);
    councilStep(s, r);
    let expired = 0;
    for (let k = 0; k < 8; k++) {
      s.cyclesCompleted++;
      expired += councilStep(s, r).expired;
    }
    expect(s.council.bills.length).toBeLessThanOrEqual(MAX_PENDING_BILLS);
    expect(expired).toBeGreaterThan(0);
    const laws = s.council.bills.map((b) => b.law);
    expect(new Set(laws).size).toBe(laws.length);
  });

  it("aprovar põe a lei em vigor e dá prestígio; vetar tira", () => {
    const s = town(80);
    const r = rng(8);
    councilStep(s, r);
    s.cyclesCompleted++;
    councilStep(s, r);
    s.cyclesCompleted++;
    councilStep(s, r);
    const [a, b] = s.council.bills;
    const ok = applyCommands(s, [
      { type: "bill", id: a.id, approve: true },
      { type: "bill", id: b.id, approve: false },
    ]);
    expect(ok.rejected).toEqual([]);
    expect(hasLaw(ok.state, a.law)).toBe(true);
    expect(hasLaw(ok.state, b.law)).toBe(false);
    expect(ok.state.council.standing[a.party]).toBeGreaterThanOrEqual(0);
    expect(ok.state.council.bills.find((x) => x.id === a.id)).toBeUndefined();
    // Proposta que já saiu da pauta é rejeitada.
    expect(applyCommands(ok.state, [{ type: "bill", id: a.id, approve: true }]).rejected).toHaveLength(1);
  });

  it("revogar tira a lei de vigor", () => {
    const s = town(80);
    s.council = { ...newCouncil(), laws: ["salario_minimo"] };
    const ok = applyCommands(s, [{ type: "repeal", law: "salario_minimo" }]);
    expect(ok.rejected).toEqual([]);
    expect(hasLaw(ok.state, "salario_minimo")).toBe(false);
    expect(applyCommands(ok.state, [{ type: "repeal", law: "salario_minimo" }]).rejected).toHaveLength(1);
  });
});

describe("efeitos das leis", () => {
  const withLaws = (ids: (typeof LAW_IDS)[number][]): CityState => {
    const s = town(60);
    s.council = { ...newCouncil(), laws: ids };
    return s;
  };

  it("os efeitos numéricos se somam aos das tecnologias", () => {
    const s = withLaws(["saude_universal", "austeridade"]);
    expect(lawMods(s).health).toBeCloseTo(0.15);
    s.techs = ["antibioticos"]; // +20% de saúde
    expect(techMods(s).health).toBeCloseTo(0.35);
    expect(lawMods(withLaws(["taxa_carbono"])).pollution).toBeCloseTo(-0.2);
  });

  it("jornada de 8 horas leva todos os setores a 8 h e barra jornadas maiores", () => {
    const s = town(80);
    s.labor = { campo: { hours: 12, pay: "peca" }, oficina: { hours: 10, pay: "tempo" }, fabrica: { hours: 8, pay: "tempo" } };
    const r = rng(9);
    councilStep(s, r);
    s.council.bills.push({ id: 99, law: "jornada_8h", party: "esquerda", proposer: s.council.members[0].id, cycle: 100 });
    const ok = applyCommands(s, [{ type: "bill", id: 99, approve: true }]);
    expect(ok.state.labor.campo).toEqual({ hours: 8, pay: "peca" });
    expect(ok.state.labor.oficina.hours).toBe(8);
    const bad = applyCommands(ok.state, [{ type: "labor", sector: "campo", hours: 12 }]);
    expect(bad.rejected).toHaveLength(1);
    expect(applyCommands(ok.state, [{ type: "labor", sector: "campo", hours: 6 }] as Command[]).rejected).toHaveLength(0);
    expect(DEFAULT_LABOR.campo.hours).toBe(8);
  });

  it("fiscalização e pensão universal valem na cidade toda", () => {
    const s = withLaws(["fiscalizacao", "pensao_universal"]);
    expect(inspected(s)).toBe(true);
    expect(hasPensionIncome(s, s.citizens[0])).toBe(true);
  });

  it("as verbas das leis saem do caixa e o saldo continua batendo", () => {
    const s = withLaws(["arborizacao", "saude_universal"]);
    s.money = 20_000;
    const { state, report } = resolveCycle(s, T0);
    expect(report.finance.laws).toBeGreaterThan(0);
    expect(state.money).toBe(s.money + report.netMoney);
  });

  it("isenção industrial reduz o imposto industrial", () => {
    const base = withLaws([]);
    const iso = withLaws(["isencao_industria"]);
    expect(lawMods(iso).goods).toBeCloseTo(0.08);
    expect(hasLaw(base, "isencao_industria")).toBe(false);
  });
});

describe("no ciclo", () => {
  it("o ciclo faz a eleição, registra no relatório e a migração cria a câmara", () => {
    const s = town(80);
    const { state, report } = resolveCycle(s, T0);
    expect(report.council).toBeDefined();
    expect(state.council.members.length).toBeGreaterThan(0);
    const old = createCity(1, T0) as Partial<CityState> & { schemaVersion: number };
    old.schemaVersion = 16;
    delete old.council;
    expect(migrateState(old as CityState).council).toEqual(newCouncil());
  });
});

describe("golpe fascista", () => {
  it("o Fascista com 2/3 da câmara dá o golpe; menos que isso, não", () => {
    const mk = (fa: number, total: number) => ({ members: Array.from({ length: total }, (_, i) => ({ id: i + 1, party: (i < fa ? "fascista" : "centro") as "fascista" | "centro" })) });
    expect(isCoup(mk(5, 7))).toBe(true); // 71%
    expect(isCoup(mk(4, 7))).toBe(false); // 57%
    expect(isCoup(mk(4, 5))).toBe(true);
    expect(isCoup(mk(3, 5))).toBe(false); // 60%
    expect(isCoup(mk(6, 9))).toBe(true); // exatamente 2/3
    expect(isCoup(mk(5, 9))).toBe(false);
    expect(isCoup(mk(0, 7))).toBe(false);
  });

  it("numa crise profunda os fascistas ganham a câmara, o jogo acaba e tudo para", () => {
    const s = town(120);
    s.money = -800; // caixa no vermelho
    s.strike = { share: 0.4, causes: [] }; // greve geral
    s.lastDisasterCycle = s.cyclesCompleted - 1; // desastre
    // Todos desempregados, tristes e em bairro perigoso: cenário de crise total.
    const rep = councilStep(s, rng(11));
    expect(rep.election?.crisis).toBeGreaterThanOrEqual(5);
    expect(rep.election!.seats.fascista).toBeGreaterThan(0);
    expect(rep.coup).toBe(true);
    expect(s.ended).toEqual({ cause: "golpe", cycle: s.cyclesCompleted });
    // Depois do golpe, nenhum comando vale e a cidade fica fora do ranking.
    const r = applyCommands(s, [{ type: "research", tech: "maquina_vapor" }]);
    expect(r.rejected).toHaveLength(1);
    expect(r.rejected[0].error).toMatch(/golpe/);
    expect(rankEligible(s)).toBe(false);
    expect(councilStep(s, rng(12))).toEqual({ expired: 0, replaced: 0 });
  });

  it("o golpe sai na manchete do jornal", () => {
    const s = town(80);
    s.cyclesCompleted = 101;
    const { report } = resolveCycle(s, T0);
    const fake = { ...report, council: { ...report.council!, coup: true } };
    const n = generateNewspaper({ ...s, ended: { cause: "golpe", cycle: 101 } }, fake);
    expect(n.headline.title).toMatch(/GOLPE/);
  });

  it("migração v19 cria o campo de fim de jogo", () => {
    const old = createCity(1, T0) as Partial<CityState> & { schemaVersion: number };
    old.schemaVersion = 18;
    delete old.ended;
    expect(migrateState(old as CityState).ended).toBeNull();
  });
});
