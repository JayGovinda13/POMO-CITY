import { describe, expect, it } from "vitest";
import {
  applyCommands,
  applyDisaster,
  citizenProfile,
  citizensView,
  createCity,
  laborStats,
  migrateState,
  moodSummary,
  resolveCycle,
  syncCitizens,
  ZONE,
  type CityState,
  type Command,
} from "./index";

const T0 = Date.UTC(2026, 10, 10, 12);
const at = (s: CityState, x: number, y: number) => y * s.width + x;

/** Cidade com 2 lotes R (16 vagas de moradia), fazenda e linha até a prefeitura. */
function town(population: number): CityState {
  let s = createCity(11, T0, "plains");
  s.terrain = s.terrain.map(() => 0);
  s.money = 10_000;
  const cmds: Command[] = [
    { type: "build", building: "road", x: 13, y: 12 },
    { type: "wire", x: 12, y: 11 },
    { type: "zone", zone: "R", dense: false, x0: 13, y0: 11, x1: 14, y1: 11 },
    { type: "build", building: "farm", x: 14, y: 12 },
  ];
  s = applyCommands(s, cmds).state;
  s.zoneLevel[at(s, 13, 11)] = 2;
  s.zoneLevel[at(s, 14, 11)] = 2;
  s.population = population;
  syncCitizens(s);
  s.inventory = { "food:C": 100 };
  return s;
}

describe("cidadãos", () => {
  it("perfil é determinístico e usa nomes da região", () => {
    const s = { seed: 5, regionId: "sao-paulo" };
    expect(citizenProfile(s, 7)).toEqual(citizenProfile(s, 7));
    expect(citizenProfile(s, 7).name).not.toBe(citizenProfile(s, 8).name);
    const names = Array.from({ length: 60 }, (_, i) => citizenProfile(s, i + 1).name);
    const local = names.filter((n) => /(Silva|Santos|Oliveira|Souza|Pereira|Costa|Rodrigues|Almeida|Nascimento|Lima|Araújo|Fernandes|Carvalho|Gomes|Martins|Rocha|Ribeiro|González|Ramírez|Torres)$/.test(n));
    expect(local.length).toBeGreaterThan(40);
  });

  it("cada morador tem casa e o emprego bate com a contratação da economia", () => {
    const s = town(10);
    const views = citizensView(s);
    expect(views).toHaveLength(10);
    expect(views.every((v) => v.home)).toBe(true);
    const employed = views.filter((v) => v.job);
    const labor = laborStats(s);
    expect(employed).toHaveLength(labor.publicFilled + labor.zoneFilled);
    expect(employed.map((v) => v.job!.place)).toEqual(["Fazenda", "Fazenda", "Fazenda"]);
    expect(["Agricultor", "Agricultora"]).toContain(employed[0].job!.title);
  });

  it("humor: emprego, energia e comida deixam feliz; o contrário entristece", () => {
    const s = town(10);
    s.streak = 4;
    const happy = citizensView(s).find((v) => v.job)!;
    expect(happy.reasons.map((r) => r.text)).toEqual(expect.arrayContaining(["Tem emprego", "Casa com energia", "Comida na mesa"]));
    expect(["feliz", "ok"]).toContain(happy.mood);

    s.inventory = {};
    s.wires = s.wires.map(() => 0); // corta a energia das casas
    s.streak = 0;
    const jobless = citizensView(s).find((v) => !v.job)!;
    expect(jobless.mood).toBe("triste");
  });

  it("desastre recente pesa no humor", () => {
    const s = town(10);
    const before = moodSummary(citizensView(s)).approval;
    const after = moodSummary(citizensView(applyDisaster(s, "light", "closed_without_exit").state)).approval;
    expect(after).toBeLessThan(before);
  });

  it("quando a população cai, vão embora os mais tristes", () => {
    const s = town(10);
    const views = citizensView(s);
    const saddest = [...views].sort((a, b) => a.score - b.score || b.id - a.id)[0];
    s.population = 9;
    syncCitizens(s);
    expect(s.citizens).not.toContain(saddest.id);
    s.population = 12;
    syncCitizens(s);
    expect(s.citizens.slice(-3)).toEqual([11, 12, 13]); // gente nova, ids novos
  });

  it("o ciclo mantém moradores = população e relata o humor", () => {
    const s = town(0);
    const { state, report } = resolveCycle(s, T0);
    expect(state.citizens).toHaveLength(state.population);
    expect(report.citizens!.arrived).toBe(state.population);
    expect(report.citizens!.feliz + report.citizens!.ok + report.citizens!.triste).toBe(state.population);
  });

  it("migração v3 → v4 cria moradores para a população existente", () => {
    const v3 = createCity(1, T0) as Partial<CityState>;
    v3.schemaVersion = 3;
    v3.population = 5;
    delete v3.citizens;
    const m = migrateState(v3 as CityState);
    expect(m.citizens).toEqual([1, 2, 3, 4, 5]);
    expect(m.nextCitizenId).toBe(6);
    expect(m.zoneType[0]).toBe(ZONE.NONE);
  });
});
