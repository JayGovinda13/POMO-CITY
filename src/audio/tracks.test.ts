import { describe, expect, it } from "vitest";
import { TRACKS, TRACK_IDS, chord, midi } from "./tracks";

describe("trilhas sonoras", () => {
  it("notas e acordes", () => {
    expect(midi("A4")).toBe(69);
    expect(midi("C#5")).toBe(73);
    expect(midi("Bb3")).toBe(58);
    expect(chord("Gm7")).toEqual({ root: 7, tones: [0, 3, 7, 10] });
  });

  it.each(TRACK_IDS)("%s: 16 compassos completos, notas no tempo e na tessitura", (id) => {
    const tr = TRACKS[id];
    expect(tr.bars).toBe(16);
    for (let bar = 0; bar < tr.bars * 2; bar++) {
      const ev = tr.render(bar);
      expect(ev.length).toBeGreaterThan(5);
      for (const e of ev) {
        expect(e.t).toBeGreaterThanOrEqual(0);
        expect(e.t).toBeLessThan(4);
        expect(e.midi).toBeGreaterThanOrEqual(36);
        expect(e.midi).toBeLessThanOrEqual(96);
      }
      // Há melodia e baixo em todo compasso que não é pausa total.
      expect(ev.some((e) => e.inst === "bass")).toBe(true);
    }
  });
});
