import { describe, expect, it } from "vitest";
import { applyCommands, createCity, foundCity, generateNewspaper, resolveCycle, syncCitizens, type CityState, type Command } from "./index";

const T0 = Date.UTC(2026, 10, 10, 12);
const at = (s: CityState, x: number, y: number) => y * s.width + x;

function town(): CityState {
  const f = foundCity(createCity(41, T0), "recife", T0);
  if (!f.ok) throw new Error(f.error);
  let s = f.state;
  s.terrain = s.terrain.map(() => 0);
  s.money = 3000;
  const cmds: Command[] = [
    { type: "build", building: "road", x: 13, y: 12 },
    { type: "wire", x: 12, y: 11 },
    { type: "zone", zone: "R", dense: false, x0: 13, y0: 11, x1: 15, y1: 11 },
  ];
  s = applyCommands(s, cmds).state;
  for (const x of [13, 14, 15]) s.zoneLevel[at(s, x, 11)] = 2;
  s.population = 24;
  syncCitizens(s);
  return s;
}

describe("jornal da cidade", () => {
  it("tem nome da região, data, manchete, notícias e a fala de um morador", () => {
    const { state, report } = resolveCycle(town(), T0);
    const paper = generateNewspaper(state, report);
    expect(paper.name).toBe("Gazeta Recife");
    expect(paper.date).toMatch(/de 1900$/);
    expect(paper.headline.title.length).toBeGreaterThan(5);
    expect(paper.stories.length).toBeGreaterThanOrEqual(2);
    expect(paper.stories.length).toBeLessThanOrEqual(5);
    expect(paper.quote?.citizen.name).toBeTruthy();
    expect(paper.quote?.text.length).toBeGreaterThan(5);
  });

  it("é determinístico", () => {
    const { state, report } = resolveCycle(town(), T0);
    expect(generateNewspaper(state, report)).toEqual(generateNewspaper(structuredClone(state), structuredClone(report)));
  });

  it("apagão e fome viram manchete", () => {
    const s = town();
    s.inventory = {};
    s.money = 0;
    const { state, report } = resolveCycle(s, T0);
    expect(report.starving).toBe(true);
    expect(generateNewspaper(state, report).headline.title).toMatch(/FOME/);

    const dark = town();
    dark.zoneLevel = dark.zoneLevel.map((l) => (l ? 2 : 0));
    for (let x = 16; x < 24; x++) {
      dark.zoneType[at(dark, x, 11)] = 1;
      dark.zoneLevel[at(dark, x, 11)] = 4;
      dark.zoneDensity[at(dark, x, 11)] = 1;
    }
    const r2 = resolveCycle(dark, T0);
    if (r2.report.power.brownout) expect(generateNewspaper(r2.state, r2.report).headline.title).toMatch(/APAGÃO|FOME/);
  });
});
