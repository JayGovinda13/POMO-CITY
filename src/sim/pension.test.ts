import { describe, expect, it } from "vitest";
import {
  BENEFIT,
  DEFAULT_PENSION,
  PRIVATE_CONTRIBUTION,
  WAGE,
  ZONE,
  applyCommands,
  citizensView,
  createCity,
  hasPensionIncome,
  pensionStep,
  resolveCycle,
  rng,
  syncCitizens,
  type CityState,
  type Command,
} from "./index";

const T0 = Date.UTC(2026, 10, 12, 12);

/** Cidade com `adults` trabalhadores e `old` aposentados (todos com 70 anos). */
function town(adults: number, old: number): CityState {
  const s = createCity(21, T0, "plains");
  s.terrain = s.terrain.map(() => 0);
  s.cyclesCompleted = 400;
  s.money = 10_000;
  for (let i = 0; i < 40; i++) {
    const idx = 5 * s.width + 5 + i;
    s.zoneType[idx] = ZONE.R;
    s.zoneLevel[idx] = 4;
  }
  s.population = adults + old;
  syncCitizens(s);
  s.citizens.forEach((id, k) => {
    s.people[id].born = k < old ? s.cyclesCompleted - 70 * 4 : s.cyclesCompleted - 35 * 4;
    delete s.people[id].partner;
  });
  return s;
}

const set = (s: CityState, patch: Partial<typeof DEFAULT_PENSION>): CityState => ({ ...s, pension: { ...s.pension, ...patch } });

describe("previdência pública", () => {
  it("desligada: ninguém paga nem recebe, e o aposentado fica sem renda", () => {
    const s = town(50, 10);
    const r = pensionStep(s, rng(1), 50);
    expect(r.retirees).toBe(10);
    expect(r.contributions).toBe(0);
    expect(r.publicPaid).toBe(0);
    expect(r.cost).toBe(0);
    expect(r.withoutIncome).toBe(10);
  });

  it("os trabalhadores contribuem e o fundo paga os benefícios", () => {
    const s = set(town(50, 10), { publicOn: true, publicRate: 10, publicLevel: 2 });
    const r = pensionStep(s, rng(1), 50);
    expect(r.contributions).toBeCloseTo(50 * WAGE * 0.1); // 50
    expect(r.publicPaid).toBe(10 * BENEFIT[2]); // 40
    expect(r.deficit).toBe(0);
    expect(s.pension.fund).toBeCloseTo(10);
    expect(r.withoutIncome).toBe(0);
    expect(r.cost).toBe(0);
  });

  it("sem fundo, o déficit sai do caixa da prefeitura", () => {
    const s = set(town(20, 30), { publicOn: true, publicRate: 5, publicLevel: 3 });
    const money = s.money;
    const r = pensionStep(s, rng(1), 20);
    // arrecada 20×10×5% = 10; paga 30×6 = 180 → déficit 170
    expect(r.deficit).toBeCloseTo(170);
    expect(r.cost).toBe(170);
    expect(s.money).toBe(money - 170);
    expect(s.pension.fund).toBe(0);
  });

  it("o fundo acumula nos bons tempos e cobre os maus", () => {
    const s = set(town(80, 5), { publicOn: true, publicRate: 12, publicLevel: 1 });
    pensionStep(s, rng(1), 80);
    pensionStep(s, rng(2), 80);
    const fund = s.pension.fund;
    expect(fund).toBeGreaterThan(150);
    // Ficam poucos trabalhadores: o fundo cobre sem tirar do caixa.
    const money = s.money;
    const r = pensionStep(s, rng(3), 5);
    expect(r.cost).toBe(0);
    expect(s.money).toBe(money);
    expect(s.pension.fund).toBeLessThan(fund + 100);
  });
});

describe("previdência privada", () => {
  it("trabalhadores aderem, poupam com rendimento e a prefeitura pode subsidiar", () => {
    let s = set(town(60, 0), { privateOn: true, privateSubsidy: 50 });
    const r = rng(7);
    let subsidy = 0;
    for (let k = 0; k < 20; k++) {
      s.cyclesCompleted++;
      subsidy += pensionStep(s, r, 60).subsidy;
    }
    const enrolled = s.citizens.filter((id) => s.people[id].savings !== undefined);
    expect(enrolled.length).toBeGreaterThan(30);
    expect(subsidy).toBeGreaterThan(0);
    const one = s.people[enrolled[0]].savings!;
    expect(one).toBeGreaterThan(0);
    expect(one).toBeLessThan(25 * PRIVATE_CONTRIBUTION * 1.5 * 1.4);
    s = set(s, { privateOn: false });
    expect(pensionStep(s, rng(8), 60).subsidy).toBe(0);
  });

  it("quem se aposenta recebe da própria poupança, sem custo para a prefeitura", () => {
    const s = town(0, 6);
    s.pension.privateOn = true;
    for (const id of s.citizens) s.people[id].savings = 400;
    expect(hasPensionIncome(s, s.citizens[0])).toBe(true);
    const before = s.people[s.citizens[0]].savings!;
    const r = pensionStep(s, rng(1), 0);
    expect(r.privatePaid).toBeGreaterThan(5);
    expect(r.cost).toBe(0);
    expect(r.withoutIncome).toBe(0);
    expect(s.people[s.citizens[0]].savings!).toBeLessThan(before * 1.015);
  });

  it("poupança acabada deixa o aposentado sem renda de novo", () => {
    const s = town(0, 3);
    for (const id of s.citizens) s.people[id].savings = 0.2;
    expect(hasPensionIncome(s, s.citizens[0])).toBe(false);
  });
});

describe("idade de aposentar, humor e comando", () => {
  it("aumentar a idade de aposentar devolve gente ao trabalho", () => {
    const s = town(20, 0);
    s.people[s.citizens[0]].born = s.cyclesCompleted - 4 * 63;
    expect(pensionStep(s, rng(1), 20).retirees).toBe(0);
    s.pension.retireAge = 62;
    expect(pensionStep(s, rng(1), 20).retirees).toBe(1);
  });

  it("aposentado com renda fica contente; sem renda, triste", () => {
    const s = town(10, 2);
    const [a, b] = s.citizens;
    s.people[a].savings = 500;
    const views = citizensView(s);
    const get = (id: number) => views.find((v) => v.id === id)!;
    expect(get(a).reasons.some((r) => r.text === "Aposentadoria garantida")).toBe(true);
    expect(get(b).reasons.some((r) => r.text === "Aposentado(a) sem renda")).toBe(true);
    s.pension.publicOn = true;
    expect(citizensView(s).find((v) => v.id === b)!.reasons.some((r) => r.text === "Aposentadoria garantida")).toBe(true);
  });

  it("contribuição pesada incomoda os trabalhadores", () => {
    const s = town(10, 0);
    s.pension = { ...s.pension, publicOn: true, publicRate: 14 };
    const v = citizensView(s)[0];
    expect(v.reasons.some((r) => r.text.startsWith("Contribuição pesada"))).toBe(true);
  });

  it("comando valida os limites e aplica por partes", () => {
    const s = createCity(1, T0);
    const ok = applyCommands(s, [
      { type: "pension", publicOn: true, publicRate: 12 },
      { type: "pension", retireAge: 62, privateOn: true, privateSubsidy: 30 },
    ]);
    expect(ok.rejected).toEqual([]);
    expect(ok.state.pension).toMatchObject({ publicOn: true, publicRate: 12, retireAge: 62, privateOn: true, privateSubsidy: 30, publicLevel: 2 });
    const bad = (cmd: unknown) => applyCommands(s, [cmd as Command]).rejected.length === 1;
    expect(bad({ type: "pension", retireAge: 50 })).toBe(true);
    expect(bad({ type: "pension", publicRate: 20 })).toBe(true);
    expect(bad({ type: "pension", publicLevel: 4 })).toBe(true);
    expect(bad({ type: "pension", privateSubsidy: 150 })).toBe(true);
    expect(bad({ type: "pension" })).toBe(true); // nada a mudar
    expect(bad({ type: "pension", retireAge: 65 })).toBe(true); // já é 65
  });
});

describe("no ciclo", () => {
  it("o déficit entra no livro-caixa e o saldo continua batendo com o caixa", () => {
    const s = set(town(30, 40), { publicOn: true, publicRate: 3, publicLevel: 3 });
    s.money = 20_000;
    const { state, report } = resolveCycle(s, T0);
    expect(report.pension).toBeDefined();
    expect(report.finance.pension).toBeGreaterThan(0);
    expect(state.money).toBe(s.money + report.netMoney);
  });
});
