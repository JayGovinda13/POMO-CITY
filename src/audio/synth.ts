// Sintetizador "16 bits" (estilo chip de som dos consoles dos anos 90): ondas de pulso,
// FM simples, ruído para a percussão e um eco com realimentação na saída — o eco e o filtro
// passa-baixa dão o timbre característico. Tudo gerado na hora com Web Audio, sem arquivos.

export type InstId =
  | "lead"
  | "flute"
  | "bandoneon"
  | "brass"
  | "rhodes"
  | "guitar"
  | "piano"
  | "bass"
  | "kick"
  | "snare"
  | "rim"
  | "hat"
  | "ride"
  | "shaker"
  | "cowbell"
  | "clave"
  | "conga"
  | "congaSlap"
  | "bongo";

export const midiFreq = (m: number) => 440 * 2 ** ((m - 69) / 12);

export class Synth {
  readonly ctx: BaseAudioContext;
  /** Entrada do mixer (as faixas ligam aqui através do próprio ganho). */
  readonly input: GainNode;
  readonly master: GainNode;
  private noise: AudioBuffer;
  private waves = new Map<number, PeriodicWave>();

  /** `ctx` opcional: um OfflineAudioContext permite renderizar as trilhas (prévias e testes). */
  constructor(offline?: BaseAudioContext) {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.ctx = offline ?? new Ctx();
    const ctx = this.ctx;
    this.input = ctx.createGain();
    this.master = ctx.createGain();
    // Chip de 32 kHz com interpolação: agudos abafados.
    const tone = ctx.createBiquadFilter();
    tone.type = "lowpass";
    tone.frequency.value = 9000;
    // Eco com realimentação (o "reverb" dos consoles).
    const delay = ctx.createDelay(1);
    delay.delayTime.value = 0.21;
    const fb = ctx.createGain();
    fb.gain.value = 0.32;
    const echoTone = ctx.createBiquadFilter();
    echoTone.type = "lowpass";
    echoTone.frequency.value = 2600;
    const wet = ctx.createGain();
    wet.gain.value = 0.28;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 4;

    this.input.connect(tone);
    tone.connect(comp);
    tone.connect(delay);
    delay.connect(echoTone);
    echoTone.connect(fb);
    fb.connect(delay);
    echoTone.connect(wet);
    wet.connect(comp);
    comp.connect(this.master);
    this.master.connect(ctx.destination);

    this.noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    let seed = 12345;
    for (let i = 0; i < d.length; i++) {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      d[i] = (seed / 0x7fffffff) * 2 - 1;
    }
  }

  /** Onda de pulso com ciclo de trabalho `duty` (0.125, 0.25, 0.5…), como nos chips. */
  private pulse(duty: number): PeriodicWave {
    const key = Math.round(duty * 1000);
    let w = this.waves.get(key);
    if (!w) {
      const N = 48;
      const real = new Float32Array(N);
      const imag = new Float32Array(N);
      for (let n = 1; n < N; n++) real[n] = ((2 / (n * Math.PI)) * Math.sin(n * Math.PI * duty)) * 0.8;
      w = this.ctx.createPeriodicWave(real, imag);
      this.waves.set(key, w);
    }
    return w;
  }

  private osc(type: OscillatorType | number, freq: number, t: number, end: number): OscillatorNode {
    const o = this.ctx.createOscillator();
    if (typeof type === "number") o.setPeriodicWave(this.pulse(type));
    else o.type = type;
    o.frequency.setValueAtTime(freq, t);
    o.start(t);
    o.stop(end);
    return o;
  }

  private env(t: number, peak: number, a: number, sustain: number, dur: number, release: number): GainNode {
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + a);
    g.gain.setTargetAtTime(peak * sustain, t + a, Math.max(0.02, dur * 0.4));
    g.gain.setTargetAtTime(0.0001, t + dur, release / 3);
    return g;
  }

  private vibrato(o: OscillatorNode, t: number, end: number, rate: number, cents: number, delay = 0.15) {
    const lfo = this.ctx.createOscillator();
    lfo.frequency.value = rate;
    const depth = this.ctx.createGain();
    depth.gain.setValueAtTime(0, t);
    depth.gain.linearRampToValueAtTime(cents, t + delay + 0.2);
    lfo.connect(depth);
    depth.connect(o.detune);
    lfo.start(t);
    lfo.stop(end);
  }

  private lowpass(freq: number, q = 0.7): BiquadFilterNode {
    const f = this.ctx.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = freq;
    f.Q.value = q;
    return f;
  }

  private noiseSrc(t: number, end: number): AudioBufferSourceNode {
    const s = this.ctx.createBufferSource();
    s.buffer = this.noise;
    s.loop = true;
    s.start(t, Math.random() * 0.5);
    s.stop(end);
    return s;
  }

  /** Toca uma nota/golpe. `dest` é o ganho da faixa atual. */
  play(dest: AudioNode, inst: InstId, t: number, midi: number, dur: number, vel = 1) {
    const ctx = this.ctx;
    const f = midiFreq(midi);
    const v = vel;
    switch (inst) {
      case "lead": {
        // Sax/trompete com surdina: pulso 25% com vibrato.
        const end = t + dur + 0.2;
        const o = this.osc(0.25, f, t, end);
        this.vibrato(o, t, end, 5.2, 14);
        const lp = this.lowpass(2800);
        const g = this.env(t, 0.13 * v, 0.03, 0.75, dur, 0.12);
        o.connect(lp).connect(g).connect(dest);
        break;
      }
      case "flute": {
        const end = t + dur + 0.3;
        const o = this.osc("triangle", f, t, end);
        const o2 = this.osc("sine", f * 2, t, end);
        this.vibrato(o, t, end, 4.8, 12, 0.25);
        const g2 = ctx.createGain();
        g2.gain.value = 0.25;
        const g = this.env(t, 0.22 * v, 0.06, 0.8, dur, 0.2);
        o.connect(g);
        o2.connect(g2).connect(g);
        g.connect(dest);
        break;
      }
      case "bandoneon": {
        // Duas palhetas levemente desafinadas + fole (vibrato).
        const end = t + dur + 0.2;
        const lp = this.lowpass(2300);
        const g = this.env(t, 0.09 * v, 0.05, 0.85, dur, 0.12);
        for (const det of [-7, 7]) {
          const o = this.osc(0.3, f, t, end);
          o.detune.value = det;
          this.vibrato(o, t, end, 5.8, 10, 0.2);
          o.connect(lp);
        }
        const oct = this.osc(0.5, f / 2, t, end);
        const og = ctx.createGain();
        og.gain.value = 0.35;
        oct.connect(og).connect(lp);
        lp.connect(g).connect(dest);
        break;
      }
      case "brass": {
        const end = t + dur + 0.15;
        const lp = ctx.createBiquadFilter();
        lp.type = "lowpass";
        lp.Q.value = 2;
        lp.frequency.setValueAtTime(500, t);
        lp.frequency.linearRampToValueAtTime(3200, t + 0.04);
        lp.frequency.setTargetAtTime(1600, t + 0.05, 0.1);
        const g = this.env(t, 0.08 * v, 0.015, 0.7, dur, 0.08);
        for (const det of [-6, 6]) {
          const o = this.osc("sawtooth", f, t, end);
          o.detune.value = det;
          o.connect(lp);
        }
        lp.connect(g).connect(dest);
        break;
      }
      case "rhodes": {
        // Piano elétrico em FM: modulador com índice que decai (ataque de sino).
        const end = t + dur + 0.6;
        const car = this.osc("sine", f, t, end);
        const mod = this.osc("sine", f, t, end);
        const idx = ctx.createGain();
        idx.gain.setValueAtTime(f * 1.6, t);
        idx.gain.setTargetAtTime(f * 0.2, t, 0.12);
        mod.connect(idx).connect(car.frequency);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(0.07 * v, t + 0.008);
        g.gain.setTargetAtTime(0.03 * v, t + 0.01, 0.4);
        g.gain.setTargetAtTime(0.0001, t + dur, 0.12);
        car.connect(g).connect(dest);
        break;
      }
      case "guitar": {
        // Violão de nylon: pinçado, filtro que fecha rápido.
        const end = t + dur + 0.8;
        const o = this.osc("triangle", f, t, end);
        const o2 = this.osc(0.5, f, t, end);
        const mix = ctx.createGain();
        mix.gain.value = 0.2;
        const lp = ctx.createBiquadFilter();
        lp.type = "lowpass";
        lp.frequency.setValueAtTime(3000, t);
        lp.frequency.setTargetAtTime(900, t, 0.08);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(0.11 * v, t + 0.004);
        g.gain.setTargetAtTime(0.0001, t + 0.01, 0.35 + dur * 0.15);
        o.connect(lp);
        o2.connect(mix).connect(lp);
        lp.connect(g).connect(dest);
        break;
      }
      case "piano": {
        const end = t + dur + 0.5;
        const o = this.osc("triangle", f, t, end);
        const o2 = this.osc(0.125, f, t, end);
        const mix = ctx.createGain();
        mix.gain.value = 0.18;
        const lp = ctx.createBiquadFilter();
        lp.type = "lowpass";
        lp.frequency.setValueAtTime(4000, t);
        lp.frequency.setTargetAtTime(1400, t, 0.12);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(0.1 * v, t + 0.004);
        g.gain.setTargetAtTime(0.04 * v, t + 0.01, 0.25);
        g.gain.setTargetAtTime(0.0001, t + dur, 0.06);
        o.connect(lp);
        o2.connect(mix).connect(lp);
        lp.connect(g).connect(dest);
        break;
      }
      case "bass": {
        // Baixo acústico: triângulo com corpo e ataque de dedo.
        const end = t + dur + 0.3;
        const o = this.osc("triangle", f, t, end);
        const o2 = this.osc("sine", f, t, end);
        const lp = this.lowpass(900);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(0.32 * v, t + 0.006);
        g.gain.setTargetAtTime(0.18 * v, t + 0.01, 0.15);
        g.gain.setTargetAtTime(0.0001, t + dur, 0.04);
        o.connect(lp);
        o2.connect(lp);
        lp.connect(g).connect(dest);
        break;
      }
      case "kick": {
        const o = this.osc("sine", 120, t, t + 0.3);
        o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.5 * v, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
        o.connect(g).connect(dest);
        break;
      }
      case "conga":
      case "congaSlap":
      case "bongo": {
        const base = inst === "bongo" ? 380 : inst === "congaSlap" ? 300 : 210;
        const o = this.osc("sine", base * 1.3, t, t + 0.3);
        o.frequency.exponentialRampToValueAtTime(base, t + 0.03);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.25 * v, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + (inst === "conga" ? 0.22 : 0.1));
        o.connect(g).connect(dest);
        if (inst === "congaSlap") this.hit(dest, t, 0.04, 2500, "bandpass", 0.15 * v);
        break;
      }
      case "snare":
        this.hit(dest, t, 0.16, 1800, "bandpass", 0.22 * v);
        break;
      case "rim":
        this.hit(dest, t, 0.03, 2200, "bandpass", 0.25 * v, 6);
        break;
      case "hat":
        this.hit(dest, t, 0.05, 8000, "highpass", 0.08 * v);
        break;
      case "ride":
        this.hit(dest, t, 0.35, 6500, "bandpass", 0.07 * v, 1.5);
        break;
      case "shaker":
        this.hit(dest, t, 0.04, 6000, "highpass", 0.05 * v);
        break;
      case "clave": {
        const o = this.osc("sine", 2500, t, t + 0.08);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.18 * v, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
        o.connect(g).connect(dest);
        break;
      }
      case "cowbell": {
        const bp = ctx.createBiquadFilter();
        bp.type = "bandpass";
        bp.frequency.value = 800;
        bp.Q.value = 3;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.16 * v, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
        for (const fr of [560, 845]) this.osc(0.5, fr, t, t + 0.2).connect(bp);
        bp.connect(g).connect(dest);
        break;
      }
    }
  }

  /** Golpe de ruído filtrado (caixa, chimbal, prato, chocalho). */
  private hit(dest: AudioNode, t: number, len: number, freq: number, type: BiquadFilterType, peak: number, q = 1) {
    const s = this.noiseSrc(t, t + len + 0.05);
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(peak, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + len);
    s.connect(f).connect(g).connect(dest);
  }
}
