import { describe, expect, it } from "vitest";
import {
  LAWS,
  LAW_IDS,
  ORDINANCES,
  ORDINANCE_IDS,
  ORDINANCE_POLITICS,
  PARTY_IDS,
  ZONE,
  applyCommands,
  citizensView,
  createCity,
  leaning,
  newCouncil,
  syncCitizens,
  techMods,
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
  s.council = newCouncil();
  return s;
}

describe("decretos políticos", () => {
  it("há muitos decretos e todos têm um partido", () => {
    expect(ORDINANCE_IDS.length).toBeGreaterThanOrEqual(26);
    for (const id of ORDINANCE_IDS) {
      expect(ORDINANCE_POLITICS[id], id).toBeDefined();
      expect(PARTY_IDS).toContain(ORDINANCE_POLITICS[id].party);
      expect(ORDINANCES[id].description.length).toBeGreaterThan(20);
    }
    for (const p of PARTY_IDS) expect(ORDINANCE_IDS.filter((id) => ORDINANCE_POLITICS[id].party === p).length, p).toBeGreaterThanOrEqual(2);
    expect(LAW_IDS.length).toBeGreaterThanOrEqual(95);
  });

  it("assinar favorece o partido e prejudica os adversários; revogar faz o contrário", () => {
    const s = town();
    const sign = applyCommands(s, [{ type: "ordinance", id: "balcao_empresas", active: true }]);
    expect(sign.rejected).toEqual([]);
    const c = sign.state.council.standing;
    expect(c.liberal).toBe(1);
    expect(c.esquerda).toBe(-1);
    expect(sign.state.council.history.at(-1)!.text).toContain("Decreto assinado");
    const rev = applyCommands(sign.state, [{ type: "ordinance", id: "balcao_empresas", active: false }]);
    expect(rev.state.council.standing.liberal).toBe(0);
    expect(rev.state.council.standing.esquerda).toBe(0);
    // Revogar um decreto de esquerda favorece quem era contra.
    const left = applyCommands(town(), [{ type: "ordinance", id: "habitacao_popular", active: true }]).state;
    const undo = applyCommands(left, [{ type: "ordinance", id: "habitacao_popular", active: false }]).state;
    expect(undo.council.standing.esquerda).toBe(0);
    const twice = applyCommands(undo, [{ type: "ordinance", id: "habitacao_popular", active: true }, { type: "ordinance", id: "habitacao_popular", active: false }]).state;
    expect(twice.council.standing.liberal).toBe(0);
  });

  it("o prestígio e os decretos ativos mudam o voto na eleição", () => {
    const s = town();
    const v = citizensView(s)[0];
    const base = leaning(v, s);
    s.council.standing.liberal = 4;
    s.ordinances = { balcao_empresas: 0, feirao_ofertas: 0 };
    const after = leaning(v, s);
    expect(after.liberal).toBeGreaterThan(base.liberal + 0.9);
    expect(after.esquerda).toBe(base.esquerda);
  });

  it("decretos com efeitos numéricos somam aos das tecnologias", () => {
    const s = town();
    const before = techMods(s).health;
    s.ordinances = { mutirao_saude: 0 };
    expect(techMods(s).health).toBeCloseTo(before + 0.08);
    s.ordinances = { censura_jornais: 0 };
    expect(techMods(s).crime).toBeCloseTo(techMods(town()).crime - 0.05);
  });

  it("as leis novas têm efeitos e partido válidos", () => {
    for (const p of PARTY_IDS) expect(LAW_IDS.filter((id) => LAWS[id].party === p).length, p).toBeGreaterThanOrEqual(p === "fascista" ? 10 : 15);
  });
});
