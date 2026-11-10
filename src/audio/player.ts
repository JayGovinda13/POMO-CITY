// Tocador das trilhas: agenda os compassos com antecedência no relógio do Web Audio (preciso,
// sem depender do setTimeout) e troca de faixa com fade. Modos: "Rádio" (qualquer faixa),
// um gênero (as 8 faixas dele em sequência) ou uma faixa específica (repete). No rádio e no
// gênero, a faixa muda a cada duas voltas da música.

import { Synth } from "./synth";
import { GENRE_IDS, TRACKS, TRACK_IDS, tracksOf, type GenreId, type TrackId } from "./tracks";

export type MusicChoice = TrackId | GenreId | "radio" | "off";

/** Escolha salva válida (versões antigas e ids removidos voltam ao rádio). */
export function validChoice(c: unknown): MusicChoice {
  if (c === "radio" || c === "off") return c;
  if (typeof c === "string" && (GENRE_IDS.includes(c as GenreId) || c in TRACKS)) return c as MusicChoice;
  return "radio";
}
const isGenre = (c: MusicChoice): c is GenreId => GENRE_IDS.includes(c as GenreId);

export interface MusicSettings {
  choice: MusicChoice;
  /** 0..1 */
  volume: number;
  /** Silenciar durante o foco (só toca no intervalo e no planejamento). */
  muteInFocus: boolean;
}

export const DEFAULT_MUSIC: MusicSettings = { choice: "radio", volume: 0.5, muteInFocus: false };

const LOOKAHEAD = 0.35;
const LOOPS_PER_TRACK = 2;

class MusicPlayer {
  private synth: Synth | null = null;
  private bus: GainNode | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private track: TrackId | null = null;
  private bar = 0;
  private barTime = 0;
  private loops = 0;
  private volume = DEFAULT_MUSIC.volume;
  private ducked = false;
  private listeners = new Set<(id: TrackId | null) => void>();
  choice: MusicChoice = "off";

  /** Faixa tocando agora (null = silêncio). */
  get current() {
    return this.track;
  }

  onTrack(fn: (id: TrackId | null) => void) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit() {
    for (const fn of this.listeners) fn(this.track);
  }

  /** Precisa ser chamado a partir de um gesto do usuário (política de autoplay). */
  unlock() {
    if (typeof window === "undefined") return;
    if (!this.synth) {
      try {
        this.synth = new Synth();
      } catch {
        return;
      }
      this.applyVolume();
    }
    if (this.synth.ctx.state === "suspended") void (this.synth.ctx as AudioContext).resume();
    if (this.choice !== "off" && !this.track) this.start(this.pick());
  }

  get unlocked() {
    return !!this.synth && this.synth.ctx.state === "running";
  }

  setChoice(choice: MusicChoice) {
    this.choice = choice;
    if (!this.synth) return;
    if (choice === "off") this.stop();
    else if (choice === "radio") {
      if (!this.track) this.start(this.pick());
    } else if (isGenre(choice)) {
      if (!this.track || TRACKS[this.track].genre !== choice) this.start(this.pick());
    } else if (choice !== this.track) this.start(choice);
  }

  setVolume(v: number) {
    this.volume = Math.max(0, Math.min(1, v));
    this.applyVolume();
  }

  /** Abaixa a música (ex.: durante o foco, se o jogador preferir). */
  setDucked(d: boolean) {
    this.ducked = d;
    this.applyVolume();
  }

  private applyVolume() {
    if (!this.synth) return;
    const g = this.synth.master.gain;
    const target = this.ducked ? 0 : this.volume * this.volume; // curva perceptiva
    g.setTargetAtTime(target, this.synth.ctx.currentTime, 0.3);
  }

  private pick(): TrackId {
    const c = this.choice;
    if (isGenre(c)) {
      // Gênero: segue a ordem das faixas; ao entrar no gênero, começa numa faixa aleatória.
      const list = tracksOf(c);
      const at = this.track ? list.indexOf(this.track) : -1;
      return at >= 0 ? list[(at + 1) % list.length] : list[Math.floor(Math.random() * list.length)];
    }
    if (c !== "radio" && c !== "off") return c;
    const others = TRACK_IDS.filter((t) => t !== this.track);
    return others[Math.floor(Math.random() * others.length)];
  }

  private start(id: TrackId) {
    const synth = this.synth!;
    this.fadeOut();
    this.bus = synth.ctx.createGain();
    this.bus.connect(synth.input);
    this.track = id;
    this.bar = 0;
    this.loops = 0;
    this.barTime = synth.ctx.currentTime + 0.15;
    if (!this.timer) this.timer = setInterval(() => this.tick(), 50);
    this.emit();
  }

  private fadeOut() {
    if (!this.bus || !this.synth) return;
    const old = this.bus;
    const t = this.synth.ctx.currentTime;
    old.gain.setTargetAtTime(0, t, 0.25);
    setTimeout(() => old.disconnect(), 2500);
    this.bus = null;
  }

  stop() {
    this.fadeOut();
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.track = null;
    this.emit();
  }

  private tick() {
    const synth = this.synth;
    if (!synth || !this.bus || !this.track) return;
    const now = synth.ctx.currentTime;
    // Aba em segundo plano: se ficou para trás, recomeça do compasso atual sem rajada de notas.
    if (this.barTime < now - 1) this.barTime = now + 0.05;
    while (this.barTime < now + LOOKAHEAD) {
      const tr = TRACKS[this.track];
      const beat = 60 / tr.bpm;
      for (const e of tr.render(this.bar)) {
        // Swing: colcheia do contratempo atrasa.
        const frac = e.t % 1;
        const t = e.t + (tr.swing && Math.abs(frac - 0.5) < 1e-6 ? tr.swing : 0);
        synth.play(this.bus, e.inst, this.barTime + t * beat, e.midi, e.dur * beat, e.vel);
      }
      this.barTime += 4 * beat;
      this.bar++;
      if (this.bar >= tr.bars) {
        this.bar = 0;
        this.loops++;
        if ((this.choice === "radio" || isGenre(this.choice)) && this.loops >= LOOPS_PER_TRACK) {
          const startAt = this.barTime;
          this.start(this.pick());
          this.barTime = startAt;
          return;
        }
      }
    }
  }
}

export const music = new MusicPlayer();

const KEY = "pomo-city:music";

export function loadMusicSettings(): MusicSettings {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const saved = { ...DEFAULT_MUSIC, ...(JSON.parse(raw) as Partial<MusicSettings>) };
      return { ...saved, choice: validChoice(saved.choice) };
    }
  } catch {
    /* sem armazenamento: usa o padrão */
  }
  return { ...DEFAULT_MUSIC };
}

export function saveMusicSettings(s: MusicSettings) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* ignora */
  }
}
