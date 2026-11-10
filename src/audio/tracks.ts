// Trilhas originais do POMO-CITY: Jazz, Bossa Nova, Tango e Salsa.
// Cada faixa é um ciclo de 16 compassos (4/4). Melodia escrita à mão; baixo, harmonia e
// percussão seguem o padrão rítmico de cada gênero. Puro (sem Web Audio): testável.

import type { InstId } from "./synth";

export interface NoteEvent {
  /** Tempo em batidas (semínimas) dentro do compasso. */
  t: number;
  dur: number;
  inst: InstId;
  midi: number;
  vel: number;
}

export type TrackId = "jazz" | "bossa" | "tango" | "salsa";

export interface Track {
  id: TrackId;
  name: string;
  title: string;
  bpm: number;
  /** Swing: quanto a colcheia do contratempo atrasa (0 = reto; 1/6 ≈ swing de jazz). */
  swing: number;
  bars: number;
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
  maj: [0, 4, 7],
  m: [0, 3, 7],
  "7": [0, 4, 7, 10],
  m7: [0, 3, 7, 10],
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

/** Progressão: um ou dois acordes por compasso ("Am7 D7" = meio compasso cada). */
function progression(bars: string[]): (bar: number, beat: number) => Chord {
  const parsed = bars.map((b) => b.split(" ").map(chord));
  return (bar, beat) => {
    const cs = parsed[bar % parsed.length];
    return cs.length === 1 ? cs[0] : cs[beat < 2 ? 0 : 1];
  };
}

const hit = (t: number, inst: InstId, vel = 1, dur = 0.1): NoteEvent => ({ t, dur, inst, midi: 60, vel });

// ───────────────────────── Jazz: "Café da Prefeitura" ─────────────────────────

const JAZZ_CHORDS = progression([
  "Fmaj7", "D7", "Gm7", "C7", "Am7 D7", "Gm7 C7", "Fmaj7", "Cm7 F7",
  "Bbmaj7", "Bbm7 Eb7", "Am7", "D7", "Gm7", "C7", "Fmaj7 D7", "Gm7 C7",
]);
const JAZZ_MELODY = [
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
];

/** Baixo caminhante: fundamental, notas do acorde e aproximação cromática do próximo. */
function walkingBass(bar: number, chords: (b: number, beat: number) => Chord): NoteEvent[] {
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

const jazz: Track = {
  id: "jazz",
  name: "Jazz",
  title: "Café da Prefeitura",
  bpm: 132,
  swing: 1 / 6,
  bars: 16,
  render(bar) {
    const ev: NoteEvent[] = [];
    ev.push(...line(JAZZ_MELODY[bar % 16], "lead", 1));
    ev.push(...walkingBass(bar, JAZZ_CHORDS));
    // Comping "Charleston": 1 e 2-e.
    for (const [t, d] of [[0, 1.2], [1.5, 0.4]] as const) {
      for (const n of voicing(JAZZ_CHORDS(bar, t), 53, 4, true)) ev.push({ t, dur: d, inst: "rhodes", midi: n, vel: t ? 0.8 : 1 });
    }
    if (bar % 2) for (const n of voicing(JAZZ_CHORDS(bar, 3), 53, 4, true)) ev.push({ t: 3.5, dur: 0.4, inst: "rhodes", midi: n, vel: 0.7 });
    // Prato de condução: 1, 2, 2-a, 3, 4, 4-a. Chimbal no 2 e no 4.
    for (const t of [0, 1, 1.5, 2, 3, 3.5]) ev.push(hit(t, "ride", t % 1 ? 0.7 : 1));
    ev.push(hit(1, "hat", 0.8), hit(3, "hat", 0.8));
    ev.push(hit(0, "kick", 0.35));
    if (bar % 4 === 3) ev.push(hit(2.5, "snare", 0.5), hit(3.5, "snare", 0.7));
    return ev;
  },
};

// ───────────────────────── Bossa Nova: "Garoa de Setembro" ─────────────────────────

const BOSSA_CHORDS = progression([
  "Cmaj9", "Cmaj9", "D9", "D9", "Dm9", "G13", "Em7 A7b9", "Dm9 G13",
  "Cmaj9", "C6", "Fmaj7", "Fm6", "Em7", "A7b9", "Dm9 G13", "Cmaj9",
]);
const BOSSA_MELODY = [
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
];

const bossa: Track = {
  id: "bossa",
  name: "Bossa Nova",
  title: "Garoa de Setembro",
  bpm: 136,
  swing: 0,
  bars: 16,
  render(bar) {
    const ev: NoteEvent[] = [];
    ev.push(...line(BOSSA_MELODY[bar % 16], "flute", 0.9));
    // Baixo: fundamental no 1, quinta no 3, antecipação no 4-e.
    const c0 = BOSSA_CHORDS(bar, 0);
    const c2 = BOSSA_CHORDS(bar, 2);
    const r0 = bassRoot(c0);
    ev.push({ t: 0, dur: 1.4, inst: "bass", midi: r0, vel: 1 });
    ev.push({ t: 1.5, dur: 0.4, inst: "bass", midi: r0 + 7, vel: 0.6 });
    ev.push({ t: 2, dur: 1.4, inst: "bass", midi: c2 === c0 ? r0 + 7 : bassRoot(c2), vel: 0.9 });
    ev.push({ t: 3.5, dur: 0.4, inst: "bass", midi: bassRoot(BOSSA_CHORDS(bar + 1, 0)), vel: 0.6 });
    // Violão: batida de bossa em dois compassos (colcheias sincopadas).
    const pattern = bar % 2 === 0 ? [0, 1.5, 3] : [1, 2.5, 3.5];
    for (const t of pattern) for (const n of voicing(BOSSA_CHORDS(bar, t), 52, 4, true)) ev.push({ t, dur: 0.45, inst: "guitar", midi: n, vel: 0.8 });
    // Aro da caixa no mesmo desenho, chocalho em colcheias e surdo leve.
    for (const t of bar % 2 === 0 ? [0, 1.5, 3] : [1, 2.5]) ev.push(hit(t, "rim", 0.7));
    for (let k = 0; k < 8; k++) ev.push(hit(k / 2, "shaker", k % 2 ? 0.6 : 1));
    for (const t of [0, 1.5, 2, 3.5]) ev.push(hit(t, "kick", t % 2 === 0 ? 0.45 : 0.3));
    return ev;
  },
};

// ───────────────────────── Tango: "Bandoneón do Porto" ─────────────────────────

const TANGO_CHORDS = progression([
  "Am", "Am", "E7", "E7", "E7", "E7", "Am", "Am",
  "Dm", "Am", "B7", "E7", "Am", "Dm E7", "Am F", "E7",
]);
const TANGO_MELODY = [
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
];

const tango: Track = {
  id: "tango",
  name: "Tango",
  title: "Bandoneón do Porto",
  bpm: 116,
  swing: 0,
  bars: 16,
  render(bar) {
    const ev: NoteEvent[] = [];
    ev.push(...line(TANGO_MELODY[bar % 16], "bandoneon", 1));
    // Marcato em 4 (compassos ímpares) e síncopa 3-3-2 (pares).
    const beats = bar % 2 === 0 ? [0, 1, 2, 3] : [0, 1.5, 3];
    for (const t of beats) {
      const c = TANGO_CHORDS(bar, t);
      const root = bassRoot(c);
      const strong = t === 0 || t === 3 || (bar % 2 === 0 && t === 2);
      ev.push({ t, dur: 0.3, inst: "bass", midi: t === 0 || t === 3 ? root : root + 7, vel: strong ? 1 : 0.75 });
      for (const n of voicing(c, 57, 3)) ev.push({ t, dur: 0.25, inst: "piano", midi: n, vel: strong ? 1 : 0.7 });
      ev.push(hit(t, "kick", strong ? 0.4 : 0.2));
    }
    // "Arrastre": arrasto cromático para o 1 a cada 4 compassos.
    if (bar % 4 === 3) {
      const next = bassRoot(TANGO_CHORDS(bar + 1, 0)) + 12;
      for (let k = 0; k < 3; k++) ev.push({ t: 3.25 + k * 0.25, dur: 0.2, inst: "piano", midi: next - 3 + k, vel: 0.6 });
    }
    return ev;
  },
};

// ───────────────────────── Salsa: "Noite no Mercado" ─────────────────────────

const SALSA_CHORDS = progression([
  "Cm", "Fm", "G7", "Cm", "Cm", "Fm", "G7", "Cm",
  "Ab", "Bb", "G7", "Cm", "Abmaj7", "Bb7", "G7", "G7",
]);
const SALSA_MELODY = [
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
];

const salsa: Track = {
  id: "salsa",
  name: "Salsa",
  title: "Noite no Mercado",
  bpm: 188,
  swing: 0,
  bars: 16,
  render(bar) {
    const ev: NoteEvent[] = [];
    // Metais tocam o mambo.
    ev.push(...line(SALSA_MELODY[bar % 16], "brass", 1));
    // Tumbao: antecipa o acorde seguinte no 2-e e no 4.
    const next = SALSA_CHORDS(bar + 1, 0);
    ev.push({ t: 1.5, dur: 1.4, inst: "bass", midi: bassRoot(next), vel: 1 });
    ev.push({ t: 3, dur: 0.9, inst: "bass", midi: bassRoot(next) + 7, vel: 0.85 });
    // Montuno de piano (dois compassos): oitavas e terças sincopadas.
    const slots = bar % 2 === 0 ? [0, 1, 1.5, 2.5, 3] : [0.5, 1, 2, 2.5, 3.5];
    slots.forEach((t, k) => {
      const c = SALSA_CHORDS(bar, t);
      const v = voicing(c, 60, 3);
      const notes = k % 2 === 0 ? [v[0], v[0] + 12] : [v[1], v[2], v[0] + 12];
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
  },
};

export const TRACKS: Record<TrackId, Track> = { jazz, bossa, tango, salsa };
export const TRACK_IDS = Object.keys(TRACKS) as TrackId[];
