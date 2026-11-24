import { describe, expect, it } from "vitest";
import { LAWS, LAW_IDS, PARTY_IDS, lawMoodScore, lawProductionScore, lawMoods } from "./index";

describe("leis: humor e produção metade-metade", () => {
  for (const p of PARTY_IDS) {
    const ids = LAW_IDS.filter((id) => LAWS[id].party === p);
    it(`${p}: 10 leis alegram e 10 desagradam`, () => {
      for (const id of ids) expect(lawMoodScore(id), id).not.toBe(0);
      expect(ids.filter((id) => lawMoodScore(id) > 0).length).toBe(10);
    });
    it(`${p}: 10 leis aumentam e 10 reduzem a produção`, () => {
      for (const id of ids) expect(lawProductionScore(id), id).not.toBe(0);
      expect(ids.filter((id) => lawProductionScore(id) > 0).length).toBe(10);
    });
  }
  it("perdas de humor das leis têm teto de −4", () => {
    const neg = LAW_IDS.filter((id) => (LAWS[id].moodAll?.delta ?? 0) < 0);
    const s = { council: { laws: neg } } as never;
    const total = lawMoods(s, false).reduce((a, m) => a + m.delta, 0);
    expect(total).toBe(-4);
  });
});
