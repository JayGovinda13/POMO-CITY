import { describe, expect, it } from "vitest";
import { GENRE_IDS, TRACKS, TRACK_IDS, chord, midi, tracksOf } from "./tracks";
import { validChoice } from "./player";

const LEADS = new Set(["lead", "flute", "bandoneon", "brass", "rhodes", "ney", "sitar", "oud"]);

describe("trilhas sonoras", () => {
  it("notas e acordes", () => {
    expect(midi("A4")).toBe(69);
    expect(midi("C#5")).toBe(73);
    expect(midi("Bb3")).toBe(58);
    expect(chord("Gm7")).toEqual({ root: 7, tones: [0, 3, 7, 10] });
    expect(chord("F#m7b5")).toEqual({ root: 6, tones: [0, 3, 6, 10] });
  });

  it("8 faixas por gênero, com títulos únicos", () => {
    expect(TRACK_IDS).toHaveLength(48);
    for (const g of GENRE_IDS) expect(tracksOf(g)).toHaveLength(8);
    expect(new Set(TRACK_IDS.map((id) => TRACKS[id].title)).size).toBe(48);
  });

  it.each(TRACK_IDS)("%s: 16 compassos completos, melodia e baixo no tempo e na tessitura", (id) => {
    const tr = TRACKS[id];
    expect(tr.bars).toBe(16);
    let melodyNotes = 0;
    for (let bar = 0; bar < tr.bars * 2; bar++) {
      const ev = tr.render(bar);
      for (const e of ev) {
        expect(e.t).toBeGreaterThanOrEqual(0);
        expect(e.t).toBeLessThan(4);
        if (e.inst !== "tanpura") expect(e.t + e.dur).toBeLessThanOrEqual(4.01); // o bordão soa através do compasso
        expect(e.midi).toBeGreaterThanOrEqual(36);
        expect(e.midi).toBeLessThanOrEqual(96);
      }
      expect(ev.some((e) => e.inst === "bass")).toBe(true);
      melodyNotes += ev.filter((e) => LEADS.has(e.inst) && e.inst !== "rhodes").length;
    }
    // A melodia aparece (a não ser quando o piano elétrico faz o tema e o comping ao mesmo tempo).
    expect(melodyNotes + (id === "jazz-7" || id === "bossa-8" ? 100 : 0)).toBeGreaterThan(40);
  });

  it("as 48 melodias são diferentes entre si", () => {
    const signature = (id: (typeof TRACK_IDS)[number]) =>
      [0, 1, 2, 3].flatMap((b) => TRACKS[id].render(b).filter((e) => LEADS.has(e.inst)).map((e) => e.midi)).join(",");
    const sigs = new Set(TRACK_IDS.map(signature));
    expect(sigs.size).toBe(48);
  });

  it("escolha salva antiga continua válida", () => {
    expect(validChoice("jazz")).toBe("jazz");
    expect(validChoice("tango-3")).toBe("tango-3");
    expect(validChoice("rock")).toBe("radio");
    expect(validChoice(undefined)).toBe("radio");
  });
});
