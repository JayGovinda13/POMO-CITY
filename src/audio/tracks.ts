// Trilhas originais do POMO-CITY: 8 faixas de Jazz, Bossa Nova, Tango, Salsa, música árabe e
// música indiana (48 no total). As árabes usam maqamat (com quartos de tom) e as indianas, ragas,
// sobre bordão.
// Cada faixa é um ciclo de 16 compassos (4/4) com harmonia própria. A 1ª faixa de cada gênero
// tem melodia escrita à mão; as outras têm melodia composta de forma determinística
// (forma A–A'–B–A'', notas do acorde nos tempos fortes, movimento por grau e cadência na
// tônica). Baixo, harmonia e percussão seguem o padrão rítmico de cada gênero.
// Puro (sem Web Audio): testável.

import type { InstId } from "./synth";

export interface NoteEvent {
  /** Tempo em batidas (semínimas) dentro do compasso. */
  t: number;
  dur: number;
  inst: InstId;
  midi: number;
  vel: number;
}

export type GenreId = "jazz" | "bossa" | "tango" | "salsa" | "arabe" | "indiana";
/** "jazz-1" … "salsa-8". */
export type TrackId = `${GenreId}-${number}`;

export interface Track {
  id: TrackId;
  genre: GenreId;
  /** Nome do gênero. */
  name: string;
  title: string;
  bpm: number;
  /** Swing: quanto a colcheia do contratempo atrasa (0 = reto; 1/6 ≈ swing de jazz). */
  swing: number;
  bars: number;
  /** Ganho da faixa: equaliza o volume entre gêneros (instrumentação mais rala soa mais baixo). */
  gain: number;
  render(bar: number): NoteEvent[];
}

// ───────────────────────── teoria básica ─────────────────────────

const NOTE: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/** "C#5" → 73. */
export function midi(name: string): number {
  const m = /^([A-G])([#b]?)(-?\d)$/.exec(name);
  if (!m) throw new Error(`nota inválida: ${name}`);
  return 12 * (Number(m[3]) + 1) + NOTE[m[1]] + (m[2] === "#" ? 1 : m[2] === "b" ? -1 : 0);
}

const QUALITY: Record<string, number[]> = {
  /** Bordão (tônica e quinta): base das músicas modais. */
  "5": [0, 7],
  maj: [0, 4, 7],
  m: [0, 3, 7],
  "7": [0, 4, 7, 10],
  m7: [0, 3, 7, 10],
  m7b5: [0, 3, 6, 10],
  maj7: [0, 4, 7, 11],
  maj9: [0, 4, 7, 11, 14],
  m9: [0, 3, 7, 10, 14],
  "9": [0, 4, 7, 10, 14],
  "13": [0, 4, 10, 14, 21],
  "7b9": [0, 4, 7, 10, 13],
  "6": [0, 4, 7, 9],
  m6: [0, 3, 7, 9],
};

export interface Chord {
  root: number; // classe de altura 0..11
  tones: number[]; // intervalos
}

/** "Gm7" → acorde. */
export function chord(sym: string): Chord {
  const m = /^([A-G][#b]?)(.*)$/.exec(sym)!;
  const root = (midi(`${m[1]}4`) - 60 + 12) % 12;
  const q = m[2] === "" ? "maj" : m[2];
  if (!QUALITY[q]) throw new Error(`acorde inválido: ${sym}`);
  return { root, tones: QUALITY[q] };
}

/** Fundamental na região do baixo (E2..D#3, MIDI 40..51), audível em alto-falantes pequenos. */
const bassRoot = (c: Chord) => 48 + ((c.root + 8) % 12) - 8;

/** Voicing fechado a partir de `low` (sem a fundamental se `rootless`). */
function voicing(c: Chord, low: number, max = 4, rootless = false): number[] {
  const out: number[] = [];
  for (const iv of c.tones) {
    if (rootless && iv === 0) continue;
    let n = c.root + iv;
    while (n < low) n += 12;
    while (n >= low + 12) n -= 12;
    out.push(n);
  }
  return [...new Set(out)].sort((a, b) => a - b).slice(0, max);
}

/** "A4:1.5 r:.5 C5:1" → notas a partir do início do compasso. */
function line(spec: string, inst: InstId, vel = 1): NoteEvent[] {
  const out: NoteEvent[] = [];
  let t = 0;
  for (const tok of spec.trim().split(/\s+/)) {
    const [n, d] = tok.split(":");
    const dur = Number(d);
    if (n !== "r") out.push({ t, dur: dur * 0.95, inst, midi: midi(n), vel });
    t += dur;
  }
  if (Math.abs(t - 4) > 1e-6) throw new Error(`compasso com ${t} batidas: ${spec}`);
  return out;
}

type Chords = (bar: number, beat: number) => Chord;

/** Progressão: um ou dois acordes por compasso ("Am7 D7" = meio compasso cada). */
function progression(bars: string[]): Chords {
  if (bars.length !== 16) throw new Error(`progressão com ${bars.length} compassos`);
  const parsed = bars.map((b) => b.split(" ").map(chord));
  return (bar, beat) => {
    const cs = parsed[bar % parsed.length];
    return cs.length === 1 ? cs[0] : cs[beat < 2 ? 0 : 1];
  };
}

const hit = (t: number, inst: InstId, vel = 1, dur = 0.1): NoteEvent => ({ t, dur, inst, midi: 60, vel });

/** Gerador pseudoaleatório com seed (mulberry32): a mesma faixa sempre soa igual. */
function seeded(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ───────────────────────── compositor de melodias ─────────────────────────

type Mode = "major" | "minor" | "harmonic" | "blues";
const MODES: Record<Mode, number[]> = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  harmonic: [0, 2, 3, 5, 7, 8, 11],
  blues: [0, 2, 3, 4, 5, 7, 9, 10],
};

/** Célula rítmica de um compasso: duração positiva = nota, negativa = pausa (soma 4). */
type Cell = number[];

const CELLS: Record<GenreId, Cell[]> = {
  jazz: [
    [1.5, 0.5, 1, 1],
    [0.5, 0.5, 0.5, 0.5, 1, 1],
    [2, -0.5, 0.5, 0.5, 0.5],
    [1, 0.5, 0.5, 1, 1],
    [-0.5, 0.5, 0.5, 0.5, 1, 1],
    [0.5, 0.5, 1, 0.5, 0.5, 1],
    [1, 1, 0.5, 0.5, 1],
  ],
  bossa: [
    [2.5, 0.5, 1],
    [1.5, 0.5, 1, 1],
    [-0.5, 1, 0.5, 1, 1],
    [1.5, 1.5, 1],
    [2, -1, 1],
    [1, 0.5, 1, 1.5],
  ],
  tango: [
    [1.5, 0.5, 0.5, 0.5, 0.5, 0.5],
    [2, 2],
    [1, 1, 1, 1],
    [0.5, 0.5, 0.5, 0.5, 2],
    [-0.5, 0.5, 0.5, 0.5, 1, 0.5, 0.5],
    [1.5, 0.5, 2],
  ],
  arabe: [
    [1, 0.5, 0.5, 1, 1],
    [0.5, 0.5, 0.5, 0.5, 2],
    [1.5, 0.5, 1, 1],
    [0.25, 0.25, 0.25, 0.25, 1, 2],
    [2, 1, 1],
    [-1, 0.5, 0.5, 1, 1],
    [0.5, 0.5, 1, 0.5, 0.5, 1],
  ],
  indiana: [
    [2, 1, 1],
    [1, 0.5, 0.5, 2],
    [0.5, 0.5, 1, 2],
    [3, 1],
    [0.25, 0.25, 0.5, 1, 1, 1],
    [1, 1, 0.5, 0.5, 1],
  ],
  salsa: [
    [0.5, 0.5, -0.5, 0.5, -0.5, 1, -0.5],
    [0.5, -0.5, 0.5, 0.5, -0.5, 0.5, 1],
    [0.5, 0.5, 0.5, 0.5, -0.5, 0.5, 1],
    [1.5, 0.5, -2],
    [0.5, 0.5, 0.5, 1, 0.5, 1],
    [-0.5, 0.5, 0.5, 0.5, 1, 1],
  ],
};

interface Composition {
  chords: Chords;
  key: number;
  mode: Mode;
  /** Escala explícita (intervalos, aceita quartos de tom: 1.5, 3.5…) — maqam ou raga. */
  scale?: number[];
  /** Música modal: tempos fortes também podem cair na 3ª e na 5ª da escala (não só no bordão). */
  modal?: boolean;
  genre: GenreId;
  seed: number;
  /** Centro da tessitura (MIDI). */
  center: number;
}

/**
 * Compõe 16 compassos de melodia: seções A (0–3), A' (4–7, mesmo ritmo e contorno sobre a
 * harmonia nova), B (8–11, material novo) e A'' (12–15). Compasso 7 respira; o 14 cadencia
 * na fundamental do acorde e o 15 traz a anacruse de volta ao início.
 */
export function composeMelody(c: Composition): { t: number; dur: number; midi: number }[][] {
  const r = seeded(c.seed);
  const cells = CELLS[c.genre];
  const pick = () => [0, 1, 2, 3].map(() => cells[Math.floor(r() * cells.length)]);
  const A = pick();
  const B = pick();
  const ivs = c.scale ?? MODES[c.mode];
  const pc = (x: number) => ((x % 12) + 12) % 12;
  const scale = ivs.map((i) => pc(c.key + i));
  const lo = c.center - 9;
  const hi = c.center + 9;
  const samePc = (a: number, b: number) => Math.abs(pc(a) - pc(b)) < 1e-6;

  const allowed = (ch: Chord, strong: boolean) => {
    const tones = ch.tones.map((t) => pc(ch.root + t));
    if (c.modal && strong) tones.push(pc(c.key + ivs[2]), pc(c.key + ivs[4]));
    const pcs = strong ? tones : [...scale, ...tones];
    const out: number[] = [];
    for (let o = Math.floor(lo / 12) - 1; o <= Math.ceil(hi / 12); o++)
      for (const p of pcs) {
        const m = o * 12 + p;
        if (m >= lo && m <= hi && !out.some((x) => Math.abs(x - m) < 1e-6)) out.push(m);
      }
    return out.sort((a, b) => a - b);
  };
  const nearest = (cands: number[], target: number) =>
    cands.reduce((best, m) => (Math.abs(m - target) < Math.abs(best - target) || (Math.abs(m - target) === Math.abs(best - target) && r() < 0.5) ? m : best), cands[0]);
  const walk = (cands: number[], prev: number) => {
    const weights = cands.map((m) => {
      const d = Math.abs(m - prev);
      let w = d === 0 ? 1 : d <= 2 ? 6 : d <= 4 ? 3 : d <= 7 ? 1.5 : 0.2;
      if (Math.abs(m - c.center) > 6) w *= 0.4;
      return w;
    });
    let x = r() * weights.reduce((a, b) => a + b, 0);
    for (let k = 0; k < cands.length; k++) if ((x -= weights[k]) <= 0) return cands[k];
    return cands[cands.length - 1];
  };

  const bars: { t: number; dur: number; midi: number }[][] = [];
  let prev = nearest(allowed(c.chords(0, 0), true), c.center);
  // Contorno (intervalos) da seção A, reaproveitado em A' e A''.
  const contour: number[][] = [];
  for (let bar = 0; bar < 16; bar++) {
    const section = Math.floor(bar / 4);
    const inSection = bar % 4;
    let cell = (section === 2 ? B : A)[inSection];
    if (bar === 7) cell = [2, -2];
    if (bar === 14) cell = [3, -1];
    if (bar === 15) cell = [-2, 1, 1];
    const notes: { t: number; dur: number; midi: number }[] = [];
    let t = 0;
    let k = 0;
    for (const d of cell) {
      const dur = Math.abs(d);
      if (d > 0) {
        const ch = c.chords(bar, t);
        const strong = t % 1 === 0 && (t % 2 === 0 || dur >= 1);
        const cands = allowed(ch, strong);
        let m: number;
        if (bar === 14) m = nearest(cands.filter((x) => samePc(x, ch.root)), prev);
        else if ((section === 1 || section === 3) && contour[inSection]?.[k] !== undefined) m = nearest(cands, prev + contour[inSection][k]);
        else m = walk(cands, prev);
        if (section === 0) (contour[inSection] ??= [])[k] = m - prev;
        notes.push({ t, dur: dur * 0.95, midi: m });
        prev = m;
        k++;
      }
      t += dur;
    }
    if (Math.abs(t - 4) > 1e-6) throw new Error(`célula com ${t} batidas`);
    bars.push(notes);
  }
  return bars;
}

// ───────────────────────── catálogo de faixas ─────────────────────────

interface Song {
  title: string;
  bpm: number;
  /** Harmonia (16 compassos). Nas músicas modais, use `drones`. */
  chords?: string[];
  /** Música modal: grau da escala do bordão em cada compasso (16 valores; 0 = tônica). */
  drones?: number[];
  /** Escala explícita (maqam/raga), em semitons a partir da tônica; aceita quartos de tom. */
  scale?: number[];
  /** Tonalidade (para a melodia composta): "F", "Am"… */
  key: string;
  mode?: Mode;
  /** Melodia escrita à mão (16 compassos); sem ela, o compositor cria uma. */
  melody?: string[];
  lead?: InstId;
  /** Variação do acompanhamento — muda batida, comping, montuno ou ritmo (iqa'/tala). */
  variant?: number;
}

const GENRE_NAMES: Record<GenreId, string> = {
  jazz: "Jazz",
  bossa: "Bossa Nova",
  tango: "Tango",
  salsa: "Salsa",
  arabe: "Música Árabe",
  indiana: "Música Indiana",
};

// Maqamat (quartos de tom em .5) e ragas.
const MAQAM = {
  hijaz: [0, 1, 4, 5, 7, 8, 10],
  rast: [0, 2, 3.5, 5, 7, 9, 10.5],
  bayati: [0, 1.5, 3, 5, 7, 8, 10],
  nahawand: [0, 2, 3, 5, 7, 8, 11],
  kurd: [0, 1, 3, 5, 7, 8, 10],
  ajam: [0, 2, 4, 5, 7, 9, 11],
  saba: [0, 1.5, 3, 4, 7, 8, 10],
};
const RAGA = {
  yaman: [0, 2, 4, 6, 7, 9, 11],
  kafi: [0, 2, 3, 5, 7, 9, 10],
  khamaj: [0, 2, 4, 5, 7, 9, 10],
  bhairav: [0, 1, 4, 5, 7, 8, 11],
  desh: [0, 2, 4, 5, 7, 9, 10],
  bhairavi: [0, 1, 3, 5, 7, 8, 10],
  todi: [0, 1, 3, 6, 7, 8, 11],
  marwa: [0, 1, 4, 6, 7, 9, 11],
};
/** Bordões típicos: tônica com idas à 4ª (grau 3) e à 5ª (grau 4). */
const DRONE_A = [0, 0, 0, 0, 0, 3, 0, 0, 3, 3, 0, 0, 4, 3, 0, 0];
const DRONE_B = [0, 0, 3, 0, 0, 0, 4, 0, 3, 3, 4, 4, 0, 3, 0, 0];
const DRONE_TONIC = new Array(16).fill(0);
const DRONE_PA = [0, 0, 0, 0, 0, 0, 0, 0, 4, 4, 0, 0, 4, 4, 0, 0];

const SONGS: Record<GenreId, Song[]> = {
  jazz: [
    {
      title: "Café da Prefeitura",
      bpm: 132,
      key: "F",
      chords: ["Fmaj7", "D7", "Gm7", "C7", "Am7 D7", "Gm7 C7", "Fmaj7", "Cm7 F7", "Bbmaj7", "Bbm7 Eb7", "Am7", "D7", "Gm7", "C7", "Fmaj7 D7", "Gm7 C7"],
      melody: [
        "A4:1.5 C5:.5 E5:1 D5:1",
        "C5:.5 A4:.5 F#4:1 A4:1 r:1",
        "Bb4:.5 D5:.5 F5:.5 D5:.5 G5:1 F5:1",
        "E5:2 r:.5 C5:.5 D5:.5 E5:.5",
        "G5:1 E5:.5 C5:.5 F#5:1 D5:1",
        "F5:.5 D5:.5 Bb4:1 E5:.5 C5:.5 Bb4:1",
        "A4:3 r:1",
        "r:.5 Eb5:.5 D5:.5 C5:.5 Eb5:1 A4:1",
        "D5:1.5 F5:.5 A5:1 F5:1",
        "Db5:.5 F5:.5 Ab5:1 G5:1 Db5:1",
        "E5:1 C5:.5 A4:.5 G5:1 E5:1",
        "F#5:1.5 D5:.5 C5:1 A4:1",
        "Bb4:.5 C5:.5 D5:.5 F5:.5 A5:1 G5:1",
        "E5:1 G5:.5 Bb5:.5 A5:1 G5:1",
        "F5:2 F#5:1 D5:1",
        "D5:.5 Bb4:.5 G4:1 E4:1 C5:1",
      ],
    },
    { title: "Blues do Pedágio", bpm: 126, key: "Bb", mode: "blues", chords: ["Bb7", "Eb7", "Bb7", "Bb7", "Eb7", "Eb7", "Bb7", "G7", "Cm7", "F7", "Bb7", "G7", "Cm7", "F7", "Bb7", "F7"] },
    { title: "Hora do Rush", bpm: 168, key: "C", chords: ["Cmaj7", "A7", "Dm7", "G7", "Em7", "A7", "Dm7", "G7", "Fmaj7", "Fm6", "Em7", "A7", "Dm7", "G7", "Cmaj7", "G7"] },
    { title: "Neblina no Viaduto", bpm: 84, key: "Eb", lead: "flute", variant: 1, chords: ["Ebmaj7", "Cm7", "Fm7", "Bb7", "Gm7", "C7", "Fm7", "Bb7", "Abmaj7", "Abm7", "Gm7", "C7", "Fm7", "Bb7", "Ebmaj7", "Bb7"] },
    { title: "Prefeito Distraído", bpm: 140, key: "Dm", mode: "minor", chords: ["Dm7", "Em7b5 A7", "Dm7", "Dm7", "Gm7", "C7", "Fmaj7", "Bbmaj7", "Em7b5", "A7", "Dm7", "Dm7", "Gm7", "A7", "Dm7", "Em7b5 A7"] },
    { title: "Bonde das Seis", bpm: 150, key: "G", chords: ["Gmaj7", "Em7", "Am7", "D7", "Bm7", "E7", "Am7", "D7", "Cmaj7", "Cm6", "Bm7", "E7", "Am7", "D7", "Gmaj7", "D7"] },
    { title: "Lâmpadas de Gás", bpm: 118, key: "Ab", lead: "rhodes", variant: 1, chords: ["Abmaj7", "F7", "Bbm7", "Eb7", "Cm7", "F7", "Bbm7", "Eb7", "Dbmaj7", "Gb7", "Cm7", "F7", "Bbm7", "Eb7", "Abmaj7", "Eb7"] },
    { title: "Ponte Levadiça", bpm: 176, key: "G", chords: ["Am7", "D7", "Gmaj7", "Cmaj7", "F#m7b5", "B7", "Em7", "E7", "Am7", "D7", "Gmaj7", "Cmaj7", "F#m7b5", "B7", "Em7", "B7"] },
  ],
  bossa: [
    {
      title: "Garoa de Setembro",
      bpm: 136,
      key: "C",
      chords: ["Cmaj9", "Cmaj9", "D9", "D9", "Dm9", "G13", "Em7 A7b9", "Dm9 G13", "Cmaj9", "C6", "Fmaj7", "Fm6", "Em7", "A7b9", "Dm9 G13", "Cmaj9"],
      melody: [
        "G5:2.5 E5:.5 D5:1",
        "E5:3 r:1",
        "F#5:1.5 E5:.5 D5:1 E5:1",
        "F#5:2 r:1 A4:1",
        "F5:1.5 E5:.5 D5:1 C5:1",
        "B4:2 A4:1 G4:1",
        "G4:1.5 B4:.5 C#5:1 Bb4:1",
        "A4:1.5 C5:.5 F5:1 E5:1",
        "E5:1.5 D5:.5 G5:1 B4:1",
        "A4:3 r:.5 G4:.5",
        "A4:1.5 C5:.5 E5:1 G5:1",
        "Ab5:2 F5:1 D5:1",
        "G5:1.5 E5:.5 D5:1 B4:1",
        "C#5:1.5 Bb4:.5 G4:1 E4:1",
        "F4:1 A4:.5 C5:.5 F5:1 E5:1",
        "E5:3 r:1",
      ],
    },
    { title: "Varanda ao Entardecer", bpm: 132, key: "F", chords: ["Fmaj7", "Fmaj7", "G7", "G7", "Gm7", "C7", "Fmaj7", "C7", "Fmaj7", "Fmaj7", "G7", "G7", "Gm7", "C7", "Fmaj7", "C7"] },
    { title: "Mar de Prédios", bpm: 128, key: "D", variant: 1, chords: ["Dmaj7", "Bm7", "Em7", "A7", "F#m7", "B7", "Em7", "A7", "Gmaj7", "Gm6", "F#m7", "B7", "Em7", "A7", "Dmaj7", "A7"] },
    { title: "Café com Chuva", bpm: 126, key: "Am", mode: "minor", chords: ["Am9", "Am9", "Dm9", "Dm9", "G13", "G13", "Cmaj7", "Cmaj7", "Fmaj7", "Bm7b5", "E7b9", "E7b9", "Am9", "Dm9", "Am9", "E7b9"] },
    { title: "Feira de Domingo", bpm: 140, key: "G", lead: "lead", chords: ["Gmaj9", "Gmaj9", "Am7", "D9", "Bm7", "E7b9", "Am7", "D9", "Cmaj7", "Cm6", "Bm7", "E7b9", "Am7", "D9", "Gmaj9", "D9"] },
    { title: "Sombra do Coqueiro", bpm: 130, key: "Em", mode: "minor", variant: 1, chords: ["Em9", "A13", "Em9", "A13", "Am9", "D13", "Gmaj7", "Cmaj7", "F#m7b5", "B7b9", "Em9", "Em9", "Am9", "B7b9", "Em9", "B7b9"] },
    { title: "Bonde Azul", bpm: 134, key: "Bb", chords: ["Bbmaj7", "G7", "Cm7", "F7", "Dm7", "G7b9", "Cm7", "F7", "Ebmaj7", "Ebm6", "Dm7", "G7", "Cm7", "F7", "Bbmaj7", "F7"] },
    { title: "Luz de Poste", bpm: 124, key: "Eb", lead: "rhodes", variant: 1, chords: ["Ebmaj9", "Ebmaj9", "Fm9", "Bb13", "Gm7", "C7b9", "Fm9", "Bb13", "Abmaj7", "Db9", "Gm7", "C7b9", "Fm9", "Bb13", "Ebmaj9", "Bb13"] },
  ],
  tango: [
    {
      title: "Bandoneón do Porto",
      bpm: 116,
      key: "Am",
      mode: "harmonic",
      chords: ["Am", "Am", "E7", "E7", "E7", "E7", "Am", "Am", "Dm", "Am", "B7", "E7", "Am", "Dm E7", "Am F", "E7"],
      melody: [
        "E5:1.5 E5:.5 E5:.5 F5:.5 E5:.5 D5:.5",
        "C5:2 A4:2",
        "G#4:1 B4:1 D5:1 F5:1",
        "E5:3 r:1",
        "r:.5 D5:.5 E5:.5 F5:.5 G#5:1 F5:.5 E5:.5",
        "D5:1.5 C5:.5 B4:2",
        "A4:.5 B4:.5 C5:.5 E5:.5 A5:2",
        "G#5:.5 A5:.5 B5:.5 A5:.5 E5:2",
        "F5:1.5 E5:.5 D5:1 A4:1",
        "C5:1.5 B4:.5 A4:1 E5:1",
        "D#5:1 F#5:1 A5:1 F#5:1",
        "G#5:2 B4:1 D5:1",
        "C5:1.5 B4:.5 A4:.5 B4:.5 C5:.5 E5:.5",
        "F5:1 D5:1 E5:1 G#4:1",
        "A4:1 C5:1 C5:.5 A4:.5 F4:1",
        "E4:.5 G#4:.5 B4:.5 D5:.5 E5:1 r:1",
      ],
    },
    { title: "Calle del Reloj", bpm: 118, key: "Dm", mode: "harmonic", chords: ["Dm", "Dm", "A7", "A7", "A7", "A7", "Dm", "Dm", "Gm", "Dm", "E7", "A7", "Dm", "Gm", "Dm", "A7"] },
    { title: "Último Bonde", bpm: 112, key: "Em", mode: "harmonic", variant: 1, chords: ["Em", "Em", "B7", "B7", "Em", "E7", "Am", "Am", "Am", "Em", "B7", "B7", "Em", "Am", "Em", "B7"] },
    { title: "Garoa Portenha", bpm: 120, key: "Gm", mode: "harmonic", chords: ["Gm", "Gm", "Cm", "Cm", "D7", "D7", "Gm", "G7", "Cm", "Gm", "A7", "D7", "Gm", "Cm", "Gm", "D7"] },
    { title: "Milonga da Fábrica", bpm: 132, key: "Cm", mode: "harmonic", lead: "lead", variant: 1, chords: ["Cm", "G7", "Cm", "G7", "Cm", "C7", "Fm", "Fm", "Ab", "G7", "Cm", "Ab", "Fm", "G7", "Cm", "G7"] },
    { title: "Esquina Escura", bpm: 108, key: "Bm", mode: "harmonic", chords: ["Bm", "Bm", "F#7", "F#7", "F#7", "F#7", "Bm", "B7", "Em", "Bm", "C#7", "F#7", "Bm", "Em", "Bm", "F#7"] },
    { title: "Lua no Cais", bpm: 116, key: "Fm", mode: "harmonic", lead: "flute", chords: ["Fm", "Fm", "C7", "C7", "C7", "C7", "Fm", "F7", "Bbm", "Fm", "G7", "C7", "Fm", "Bbm", "Fm", "C7"] },
    { title: "Fole e Ferrugem", bpm: 122, key: "Am", mode: "harmonic", variant: 1, chords: ["Am", "E7", "Am", "A7", "Dm", "Am", "E7", "E7", "F", "Dm", "E7", "Am", "Dm", "E7", "Am", "E7"] },
  ],
  salsa: [
    {
      title: "Noite no Mercado",
      bpm: 188,
      key: "Cm",
      mode: "harmonic",
      chords: ["Cm", "Fm", "G7", "Cm", "Cm", "Fm", "G7", "Cm", "Ab", "Bb", "G7", "Cm", "Abmaj7", "Bb7", "G7", "G7"],
      melody: [
        "G5:.5 G5:.5 r:.5 Eb5:.5 r:.5 G5:1 r:.5",
        "Ab5:.5 r:.5 F5:.5 C5:.5 r:.5 Ab4:.5 C5:1",
        "B4:.5 D5:.5 F5:.5 G5:.5 r:.5 F5:.5 D5:1",
        "Eb5:1.5 C5:.5 r:2",
        "C5:.5 Eb5:.5 G5:.5 C6:1 Bb5:.5 G5:1",
        "Ab5:1 F5:.5 Ab5:.5 C6:1 r:1",
        "B5:.5 r:.5 G5:.5 F5:.5 D5:.5 B4:.5 G4:1",
        "C5:2 r:2",
        "Eb5:.5 Eb5:.5 r:.5 C5:.5 Ab4:1 C5:1",
        "D5:.5 D5:.5 r:.5 Bb4:.5 F4:1 Bb4:1",
        "D5:.5 F5:.5 G5:.5 B5:.5 r:.5 G5:.5 F5:1",
        "Eb5:3 r:1",
        "C6:.5 Bb5:.5 Ab5:.5 G5:.5 Eb5:1 C5:1",
        "D5:.5 F5:.5 Bb5:1 Ab5:.5 F5:.5 D5:1",
        "G5:1 F5:1 D5:1 B4:1",
        "G4:.5 B4:.5 D5:.5 F5:.5 G5:1 r:1",
      ],
    },
    { title: "Mercado de Peixe", bpm: 190, key: "Am", mode: "harmonic", chords: ["Am", "Dm", "E7", "Am", "Am", "Dm", "E7", "Am", "F", "G", "E7", "Am", "F", "G", "Am", "E7"] },
    { title: "Ladeira do Sol", bpm: 184, key: "Dm", mode: "harmonic", variant: 1, chords: ["Dm", "Gm", "A7", "Dm", "Dm", "Gm", "A7", "Dm", "Bb", "C", "A7", "Dm", "Gm", "A7", "Dm", "A7"] },
    { title: "Calor de Janeiro", bpm: 196, key: "F", lead: "flute", chords: ["F", "Bb", "C7", "F", "F", "Bb", "C7", "F", "Dm", "Gm", "C7", "F", "Bb", "C7", "F", "C7"] },
    { title: "Rumba da Obra", bpm: 188, key: "Gm", mode: "harmonic", chords: ["Gm", "Cm", "D7", "Gm", "Gm", "Cm", "D7", "Gm", "Eb", "F", "D7", "Gm", "Cm", "D7", "Gm", "D7"] },
    { title: "Prefeitura en Clave", bpm: 192, key: "Em", mode: "harmonic", variant: 1, chords: ["Em", "Am", "B7", "Em", "Em", "Am", "B7", "Em", "C", "D", "B7", "Em", "Am", "B7", "Em", "B7"] },
    { title: "Noche de Feria", bpm: 186, key: "Bb", lead: "lead", chords: ["Bb", "Eb", "F7", "Bb", "Gm", "Cm", "F7", "Bb", "Eb", "F7", "Dm", "Gm", "Cm", "F7", "Bb", "F7"] },
    { title: "Guaguancó do Porto", bpm: 194, key: "Fm", mode: "harmonic", variant: 1, chords: ["Fm", "Bbm", "C7", "Fm", "Fm", "Bbm", "C7", "Fm", "Db", "Eb", "C7", "Fm", "Bbm", "C7", "Fm", "C7"] },
  ],
  // Ritmos (variant): 0 = maqsum, 1 = baladi, 2 = saidi.
  arabe: [
    { title: "Café no Souk", bpm: 100, key: "D", scale: MAQAM.hijaz, drones: DRONE_A, lead: "oud", variant: 0 },
    { title: "Lanternas de Latão", bpm: 92, key: "C", scale: MAQAM.rast, drones: DRONE_B, lead: "ney", variant: 1 },
    { title: "Areia na Avenida", bpm: 104, key: "D", scale: MAQAM.bayati, drones: DRONE_A, lead: "lead", variant: 2 },
    { title: "Minarete ao Pôr do Sol", bpm: 84, key: "G", scale: MAQAM.nahawand, drones: DRONE_B, lead: "ney", variant: 0 },
    { title: "Caravana da Periferia", bpm: 110, key: "A", scale: MAQAM.kurd, drones: DRONE_A, lead: "oud", variant: 1 },
    { title: "Jardim de Tâmaras", bpm: 96, key: "F", scale: MAQAM.ajam, drones: DRONE_B, lead: "lead", variant: 0 },
    { title: "Noite no Bazar", bpm: 88, key: "D", scale: MAQAM.saba, drones: DRONE_TONIC, lead: "ney", variant: 2 },
    { title: "Dança do Mercado", bpm: 118, key: "G", scale: MAQAM.hijaz, drones: DRONE_B, lead: "oud", variant: 1 },
  ],
  // Talas (variant): 0 = teental (16 tempos), 1 = keherwa (8).
  indiana: [
    { title: "Monção no Bairro", bpm: 84, key: "D", scale: RAGA.yaman, drones: DRONE_PA, lead: "sitar", variant: 0 },
    { title: "Chá de Gengibre", bpm: 100, key: "E", scale: RAGA.kafi, drones: DRONE_PA, lead: "flute", variant: 1 },
    { title: "Riquixá da Prefeitura", bpm: 120, key: "D", scale: RAGA.khamaj, drones: DRONE_PA, lead: "sitar", variant: 1 },
    { title: "Templo de Pedra", bpm: 72, key: "C#", scale: RAGA.bhairav, drones: DRONE_TONIC, lead: "sitar", variant: 0 },
    { title: "Pipas no Telhado", bpm: 108, key: "F", scale: RAGA.desh, drones: DRONE_PA, lead: "flute", variant: 1 },
    { title: "Lua de Diwali", bpm: 90, key: "E", scale: RAGA.bhairavi, drones: DRONE_PA, lead: "sitar", variant: 0 },
    { title: "Feira de Especiarias", bpm: 96, key: "D", scale: RAGA.todi, drones: DRONE_TONIC, lead: "ney", variant: 1 },
    { title: "Rio Sagrado", bpm: 78, key: "C", scale: RAGA.marwa, drones: DRONE_TONIC, lead: "flute", variant: 0 },
  ],
};

const GENRE_GAIN: Record<GenreId, number> = { jazz: 1, bossa: 1, tango: 1.2, salsa: 1.1, arabe: 1.35, indiana: 1.45 };
const DEFAULT_LEAD: Record<GenreId, InstId> = { jazz: "lead", bossa: "flute", tango: "bandoneon", salsa: "brass", arabe: "oud", indiana: "sitar" };
/** Centro da tessitura da melodia por gênero (perto de G5/A5). */
const CENTER: Record<GenreId, number> = { jazz: 74, bossa: 74, tango: 74, salsa: 76, arabe: 70, indiana: 72 };

// ───────────────────────── acompanhamento por gênero ─────────────────────────

/** Baixo caminhante: fundamental, notas do acorde e aproximação cromática do próximo. */
function walkingBass(bar: number, chords: Chords): NoteEvent[] {
  const out: NoteEvent[] = [];
  const next = bassRoot(chords(bar + 1, 0));
  for (let beat = 0; beat < 4; beat++) {
    const c = chords(bar, beat);
    const root = bassRoot(c);
    let n: number;
    if (beat === 0 || (beat === 2 && chords(bar, 2) !== chords(bar, 0))) n = root;
    else if (beat === 3) n = next + (bar % 2 ? -1 : 1); // aproximação por semitom
    else n = root + c.tones[beat === 1 ? 1 : 2];
    out.push({ t: beat, dur: 0.9, inst: "bass", midi: n, vel: beat === 0 ? 1 : 0.85 });
  }
  return out;
}

function jazzBand(bar: number, chords: Chords, variant: number): NoteEvent[] {
  const ev: NoteEvent[] = [];
  ev.push(...walkingBass(bar, chords));
  if (variant === 1) {
    // Balada: acordes longos e vassourinha.
    for (const t of [0, 2]) for (const n of voicing(chords(bar, t), 53, 4, true)) ev.push({ t, dur: 1.8, inst: "rhodes", midi: n, vel: 0.8 });
    for (let k = 0; k < 8; k++) ev.push(hit(k / 2, "shaker", k % 2 ? 0.5 : 0.8));
    ev.push(hit(1, "hat", 0.6), hit(3, "hat", 0.6), hit(0, "kick", 0.25));
    return ev;
  }
  // Comping "Charleston": 1 e 2-e.
  for (const [t, d] of [[0, 1.2], [1.5, 0.4]] as const) {
    for (const n of voicing(chords(bar, t), 53, 4, true)) ev.push({ t, dur: d, inst: "rhodes", midi: n, vel: t ? 0.8 : 1 });
  }
  if (bar % 2) for (const n of voicing(chords(bar, 3), 53, 4, true)) ev.push({ t: 3.5, dur: 0.4, inst: "rhodes", midi: n, vel: 0.7 });
  // Prato de condução: 1, 2, 2-a, 3, 4, 4-a. Chimbal no 2 e no 4.
  for (const t of [0, 1, 1.5, 2, 3, 3.5]) ev.push(hit(t, "ride", t % 1 ? 0.7 : 1));
  ev.push(hit(1, "hat", 0.8), hit(3, "hat", 0.8));
  ev.push(hit(0, "kick", 0.35));
  if (bar % 4 === 3) ev.push(hit(2.5, "snare", 0.5), hit(3.5, "snare", 0.7));
  return ev;
}

function bossaBand(bar: number, chords: Chords, variant: number): NoteEvent[] {
  const ev: NoteEvent[] = [];
  // Baixo: fundamental no 1, quinta no 3, antecipação no 4-e.
  const c0 = chords(bar, 0);
  const c2 = chords(bar, 2);
  const r0 = bassRoot(c0);
  ev.push({ t: 0, dur: 1.4, inst: "bass", midi: r0, vel: 1 });
  ev.push({ t: 1.5, dur: 0.4, inst: "bass", midi: r0 + 7, vel: 0.6 });
  ev.push({ t: 2, dur: 1.4, inst: "bass", midi: c2 === c0 ? r0 + 7 : bassRoot(c2), vel: 0.9 });
  ev.push({ t: 3.5, dur: 0.4, inst: "bass", midi: bassRoot(chords(bar + 1, 0)), vel: 0.6 });
  // Violão: batida de bossa em dois compassos (colcheias sincopadas).
  const patterns = variant === 1 ? [[0, 1, 2.5], [0.5, 2, 3]] : [[0, 1.5, 3], [1, 2.5, 3.5]];
  const pattern = patterns[bar % 2];
  for (const t of pattern) for (const n of voicing(chords(bar, t), 52, 4, true)) ev.push({ t, dur: 0.45, inst: "guitar", midi: n, vel: 0.8 });
  // Aro da caixa no mesmo desenho, chocalho em colcheias e surdo leve.
  for (const t of pattern.slice(0, bar % 2 ? 2 : 3)) ev.push(hit(t, "rim", 0.7));
  for (let k = 0; k < 8; k++) ev.push(hit(k / 2, "shaker", k % 2 ? 0.6 : 1));
  for (const t of [0, 1.5, 2, 3.5]) ev.push(hit(t, "kick", t % 2 === 0 ? 0.45 : 0.3));
  return ev;
}

function tangoBand(bar: number, chords: Chords, variant: number): NoteEvent[] {
  const ev: NoteEvent[] = [];
  // Marcato em 4 e síncopa 3-3-2 alternando (variante 1: síncopa só a cada 4 compassos).
  const syncopa = variant === 1 ? bar % 4 === 3 : bar % 2 === 1;
  const beats = syncopa ? [0, 1.5, 3] : [0, 1, 2, 3];
  for (const t of beats) {
    const c = chords(bar, t);
    const root = bassRoot(c);
    const strong = t === 0 || t === 3 || (!syncopa && t === 2);
    ev.push({ t, dur: 0.3, inst: "bass", midi: t === 0 || t === 3 ? root : root + 7, vel: strong ? 1 : 0.75 });
    for (const n of voicing(c, 57, 3)) ev.push({ t, dur: 0.25, inst: "piano", midi: n, vel: strong ? 1 : 0.7 });
    ev.push(hit(t, "kick", strong ? 0.4 : 0.2));
  }
  // "Arrastre": arrasto cromático para o 1 a cada 4 compassos.
  if (bar % 4 === 3) {
    const next = bassRoot(chords(bar + 1, 0)) + 12;
    for (let k = 0; k < 3; k++) ev.push({ t: 3.25 + k * 0.25, dur: 0.2, inst: "piano", midi: next - 3 + k, vel: 0.6 });
  }
  return ev;
}

function salsaBand(bar: number, chords: Chords, variant: number): NoteEvent[] {
  const ev: NoteEvent[] = [];
  // Tumbao: antecipa o acorde seguinte no 2-e e no 4.
  const next = chords(bar + 1, 0);
  ev.push({ t: 1.5, dur: 1.4, inst: "bass", midi: bassRoot(next), vel: 1 });
  ev.push({ t: 3, dur: 0.9, inst: "bass", midi: bassRoot(next) + 7, vel: 0.85 });
  // Montuno de piano (dois compassos): oitavas e terças sincopadas.
  const montunos = variant === 1 ? [[0.5, 1.5, 2, 3, 3.5], [0, 1, 1.5, 2.5, 3.5]] : [[0, 1, 1.5, 2.5, 3], [0.5, 1, 2, 2.5, 3.5]];
  montunos[bar % 2].forEach((t, k) => {
    const v = voicing(chords(bar, t), 60, 3);
    const notes = k % 2 === 0 ? [v[0], v[0] + 12] : [v[1], v[2] ?? v[1], v[0] + 12];
    for (const n of notes) ev.push({ t, dur: 0.35, inst: "piano", midi: n, vel: 0.85 });
  });
  // Clave 2-3 (o lado "2" nos compassos pares).
  for (const t of bar % 2 === 0 ? [1, 2] : [0, 1.5, 3]) ev.push(hit(t, "clave", 0.9));
  // Campana em semínimas, congas no tumbao, chocalho e bongô.
  for (let k = 0; k < 4; k++) ev.push(hit(k, "cowbell", k % 2 === 0 ? 1 : 0.7));
  ev.push(hit(1, "congaSlap", 0.9), hit(3, "conga", 1), hit(3.5, "conga", 0.9));
  for (const t of [0.5, 2.5]) ev.push(hit(t, "bongo", 0.6));
  for (let k = 0; k < 8; k++) ev.push(hit(k / 2, "shaker", 0.5));
  return ev;
}

/** Iqa'at (D = doum grave, T = tek seco) em colcheias: maqsum, baladi e saidi. */
const IQA: [number, "doum" | "tek"][][] = [
  [[0, "doum"], [0.5, "tek"], [1.5, "tek"], [2, "doum"], [3, "tek"]],
  [[0, "doum"], [0.5, "doum"], [1.5, "tek"], [2, "doum"], [3, "tek"]],
  [[0, "doum"], [0.5, "tek"], [1.5, "doum"], [2, "doum"], [3, "tek"]],
];

function arabBand(bar: number, chords: Chords, variant: number): NoteEvent[] {
  const ev: NoteEvent[] = [];
  const c = chords(bar, 0);
  const root = bassRoot(c);
  for (const [t, kind] of IQA[variant % IQA.length]) {
    ev.push(hit(t, kind, kind === "doum" ? 1 : 0.85));
    // O alaúde acompanha o ritmo: tônica nos golpes graves, quinta nos secos.
    ev.push({ t, dur: 0.45, inst: "oud", midi: kind === "doum" ? root : root + 7, vel: kind === "doum" ? 0.75 : 0.55 });
  }
  // Recheios suaves (ka) e platinelas do riq em colcheias.
  for (const t of [1, 2.5, 3.5]) ev.push(hit(t, "tek", 0.35));
  for (let k = 0; k < 8; k++) ev.push(hit(k / 2, "riq", k % 4 === 0 ? 1 : 0.55));
  if (bar % 4 === 3) for (const t of [3.25, 3.75]) ev.push(hit(t, "tek", 0.6));
  // Baixo: tônica longa no início do compasso.
  ev.push({ t: 0, dur: 1.8, inst: "bass", midi: root, vel: 0.7 });
  return ev;
}

/** Bols do tabla: o que cada sílaba toca (bayan = grave, dayan = agudo afinado na tônica). */
const BOLS: Record<string, ("tablaGe" | "tablaNa" | "tablaTin" | "tek")[]> = {
  dha: ["tablaGe", "tablaNa"],
  dhin: ["tablaGe", "tablaTin"],
  dhi: ["tablaGe", "tablaTin"],
  tin: ["tablaTin"],
  ta: ["tablaNa"],
  na: ["tablaNa"],
  ti: ["tablaTin"],
  ge: ["tablaGe"],
  ka: ["tek"],
};
/** Teental: 16 tempos em 4 compassos (dha dhin dhin dha | … | dha tin tin ta | ta dhin dhin dha). */
const TEENTAL = ["dha", "dhin", "dhin", "dha", "dha", "dhin", "dhin", "dha", "dha", "tin", "tin", "ta", "ta", "dhin", "dhin", "dha"];
/** Keherwa: 8 tempos em colcheias por compasso. */
const KEHERWA = ["dha", "ge", "na", "ti", "na", "ka", "dhi", "na"];

function indianBand(bar: number, chords: Chords, variant: number): NoteEvent[] {
  const ev: NoteEvent[] = [];
  const c = chords(bar, 0);
  const sa = bassRoot(c) + 12;
  // Tanpura: Pa – Sa – Sa – Sa grave, soando o compasso inteiro.
  ([[0, sa - 5], [1, sa], [2, sa], [3, sa - 12]] as const).forEach(([t, m]) =>
    ev.push({ t, dur: 1.6, inst: "tanpura", midi: Math.max(36, m), vel: t === 0 ? 1 : 0.8 }),
  );
  const tablaSa = sa + 12;
  const strokes =
    variant === 1
      ? KEHERWA.map((bol, k) => [k / 2, bol] as const)
      : TEENTAL.slice((bar % 4) * 4, (bar % 4) * 4 + 4).map((bol, k) => [k, bol] as const);
  for (const [t, bol] of strokes) {
    for (const inst of BOLS[bol]) ev.push({ t, dur: 0.3, inst, midi: tablaSa, vel: t === 0 ? 1 : 0.75 });
  }
  // Teental: recheio "tirakita" no fim do ciclo.
  if (variant !== 1 && bar % 4 === 3) for (const t of [3.25, 3.5, 3.75]) ev.push({ t, dur: 0.2, inst: "tablaTin", midi: tablaSa, vel: 0.5 });
  ev.push({ t: 0, dur: 3.5, inst: "bass", midi: bassRoot(c), vel: 0.45 });
  return ev;
}

const BANDS: Record<GenreId, (bar: number, chords: Chords, variant: number) => NoteEvent[]> = {
  jazz: jazzBand,
  bossa: bossaBand,
  tango: tangoBand,
  salsa: salsaBand,
  arabe: arabBand,
  indiana: indianBand,
};

// ───────────────────────── montagem ─────────────────────────

function hashTitle(s: string) {
  let h = 2166136261;
  for (const ch of s) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return h >>> 0;
}

/** Bordão de cada compasso a partir dos graus da escala (sempre tônica + quinta). */
function droneProgression(key: number, scale: number[], degrees: number[]): Chords {
  if (degrees.length !== 16) throw new Error(`bordão com ${degrees.length} compassos`);
  const chords = degrees.map((d) => ({ root: Math.round(key + scale[d]) % 12, tones: QUALITY["5"] }));
  return (bar) => chords[bar % 16];
}

function buildTrack(genre: GenreId, song: Song, n: number): Track {
  const keyM = /^([A-G][#b]?)(m?)$/.exec(song.key)!;
  const key = (midi(`${keyM[1]}4`) - 60 + 12) % 12;
  const chords = song.drones ? droneProgression(key, song.scale ?? MODES.major, song.drones) : progression(song.chords!);
  const lead = song.lead ?? DEFAULT_LEAD[genre];
  const variant = song.variant ?? 0;
  let melody: NoteEvent[][];
  if (song.melody) {
    melody = song.melody.map((m) => line(m, lead, 1));
  } else {
    const mode: Mode = song.mode ?? (keyM[2] ? "minor" : "major");
    melody = composeMelody({
      chords,
      key,
      mode,
      scale: song.scale,
      modal: !!song.drones,
      genre,
      seed: hashTitle(song.title),
      center: CENTER[genre],
    }).map((bar) =>
      bar.map((x) => ({ ...x, inst: lead, vel: 1 })),
    );
  }
  return {
    id: `${genre}-${n}` as TrackId,
    genre,
    name: GENRE_NAMES[genre],
    title: song.title,
    bpm: song.bpm,
    swing: genre === "jazz" ? 1 / 6 : 0,
    bars: 16,
    gain: GENRE_GAIN[genre],
    render: (bar) => [...melody[bar % 16], ...BANDS[genre](bar, chords, variant)],
  };
}

export const GENRES: { id: GenreId; name: string }[] = (Object.keys(GENRE_NAMES) as GenreId[]).map((id) => ({ id, name: GENRE_NAMES[id] }));
export const GENRE_IDS = GENRES.map((g) => g.id);

export const TRACKS: Record<TrackId, Track> = Object.fromEntries(
  GENRE_IDS.flatMap((g) => SONGS[g].map((song, i) => [`${g}-${i + 1}`, buildTrack(g, song, i + 1)] as const)),
) as Record<TrackId, Track>;
export const TRACK_IDS = Object.keys(TRACKS) as TrackId[];
export const tracksOf = (g: GenreId) => TRACK_IDS.filter((id) => TRACKS[id].genre === g);
