// Vida na cidade durante o foco: carros nas ruas, pedestres nas calçadas, trens nos trilhos e
// fumaça das fábricas e usinas. Só visual (não mexe na simulação); a quantidade acompanha a
// população e a malha viária. Desenhado por quadro numa Graphics, entre o chão e os prédios.

import Phaser from "phaser";
import { BUILDINGS, ZONE, type CityState } from "@/sim";

type Iso = (x: number, y: number) => { sx: number; sy: number };

interface Mover {
  kind: "car" | "ped" | "train";
  from: number;
  to: number;
  t: number;
  /** tiles por segundo */
  speed: number;
  color: number;
  /** pedestre: lado da calçada (−1/1) */
  side: number;
}

interface Puff {
  x: number;
  y: number;
  age: number;
  life: number;
  drift: number;
}

const CAR_COLORS = [0xd84a3a, 0x3a6ad8, 0xf0c040, 0xe8e8e8, 0x40a060, 0x2a2a30, 0xe07a30, 0x8a5ac8];
const SHIRT_COLORS = [0xd84a3a, 0x3a6ad8, 0xf0c040, 0x40a060, 0xe07a30, 0x8a5ac8, 0xe8e8e8];
const SKIN = [0xf2c9a0, 0xd9a27a, 0xa86f4a, 0x6e4630];

const ROADLIKE = new Set(["road", "onramp", "tunnel", "highway"]);

export class CityLife {
  private g: Phaser.GameObjects.Graphics;
  private smoke: Phaser.GameObjects.Graphics;
  private movers: Mover[] = [];
  private puffs: Puff[] = [];
  private roadNb = new Map<number, number[]>();
  private railNb = new Map<number, number[]>();
  private smokers: { x: number; y: number; rate: number; acc: number }[] = [];
  private width = 0;
  private seedKey = "";

  constructor(
    scene: Phaser.Scene,
    private iso: Iso,
  ) {
    // Depth 3,5: acima do chão e das ruas, abaixo das sombras e dos prédios.
    this.g = scene.add.graphics().setDepth(3.5);
    this.smoke = scene.add.graphics().setDepth(6.5);
  }

  /** Recalcula a malha (ruas e trilhos), as chaminés e a quantidade de veículos e pessoas. */
  rebuild(city: CityState) {
    const W = city.width;
    this.width = W;
    const at = new Map(city.buildings.map((b) => [b.y * W + b.x, b.type]));
    const elev = (i: number) => city.elevation?.[i] ?? 0;
    const graph = (ok: (t: string | undefined) => boolean) => {
      const nb = new Map<number, number[]>();
      for (const [i, t] of at) {
        if (!ok(t)) continue;
        const x = i % W;
        const y = Math.floor(i / W);
        const list: number[] = [];
        for (const [dx, dy] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ]) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= W || ny >= city.height) continue;
          const j = ny * W + nx;
          const tj = at.get(j);
          if (!ok(tj)) continue;
          // Rampa vence 1 nível; mais que isso só por túnel (igual à simulação).
          if (Math.abs(elev(i) - elev(j)) > 1 && t !== "tunnel" && tj !== "tunnel") continue;
          // Rodovia só se liga à estrada pelo acesso.
          if ((t === "highway") !== (tj === "highway") && t !== "onramp" && tj !== "onramp") continue;
          list.push(j);
        }
        if (list.length) nb.set(i, list);
      }
      return nb;
    };
    this.roadNb = graph((t) => !!t && ROADLIKE.has(t));
    this.railNb = graph((t) => t === "rail" || t === "train_station");

    // Chaminés: usinas, fundição, serraria e indústria desenvolvida.
    this.smokers = [];
    for (const b of city.buildings) {
      const def = BUILDINGS[b.type];
      if (b.damaged || !(def.pollution && def.pollution >= 3)) continue;
      this.smokers.push({ x: b.x, y: b.y, rate: 1.2 + def.pollution / 6, acc: 0 });
    }
    for (let i = 0; i < city.zoneType.length; i++) {
      // Metade dos lotes industriais solta fumaça, mais forte quanto maior o prédio.
      if (city.zoneType[i] === ZONE.I && city.zoneLevel[i] >= 1 && (i % W) % 2 === Math.floor(i / W) % 2) {
        this.smokers.push({ x: i % W, y: Math.floor(i / W), rate: 0.8 * city.zoneLevel[i], acc: 0 });
      }
    }

    // Quantidade: carros pela malha e população; pedestres pela população; um trem a cada ~12 trilhos.
    const roads = [...this.roadNb.keys()];
    const rails = [...this.railNb.keys()];
    const wantCars = roads.length < 2 ? 0 : Math.min(90, Math.round(roads.length * 0.2 + city.population / 8));
    const wantPeds = roads.length < 1 ? 0 : Math.min(120, Math.round(city.population / 3));
    const wantTrains = rails.length < 4 ? 0 : Math.min(3, Math.ceil(rails.length / 12));

    const key = `${city.seed}`;
    if (key !== this.seedKey) {
      this.movers = [];
      this.seedKey = key;
    }
    // Quem ficou sem caminho (rua demolida) é removido; depois completa até a quantidade desejada.
    this.movers = this.movers.filter((m) => (m.kind === "train" ? this.railNb : this.roadNb).has(m.to));
    const count = (k: Mover["kind"]) => this.movers.filter((m) => m.kind === k).length;
    const spawn = (kind: Mover["kind"], pool: number[], n: number) => {
      for (let k = count(kind); k < n && pool.length; k++) {
        const from = pool[Math.floor(Math.random() * pool.length)];
        const nb = (kind === "train" ? this.railNb : this.roadNb).get(from)!;
        this.movers.push({
          kind,
          from,
          to: nb[Math.floor(Math.random() * nb.length)],
          t: Math.random(),
          speed: kind === "car" ? 1.3 + Math.random() * 0.8 : kind === "ped" ? 0.35 + Math.random() * 0.25 : 2.2,
          color: kind === "car" ? CAR_COLORS[Math.floor(Math.random() * CAR_COLORS.length)] : SHIRT_COLORS[Math.floor(Math.random() * SHIRT_COLORS.length)],
          side: Math.random() < 0.5 ? -1 : 1,
        });
      }
    };
    // Excesso (cidade encolheu): corta do fim.
    const trim = (kind: Mover["kind"], n: number) => {
      let extra = count(kind) - n;
      this.movers = this.movers.filter((m) => !(m.kind === kind && extra-- > 0));
    };
    trim("car", wantCars);
    trim("ped", wantPeds);
    trim("train", wantTrains);
    spawn("car", roads, wantCars);
    spawn("ped", roads, wantPeds);
    spawn("train", rails, wantTrains);
  }

  private next(m: Mover) {
    const nb = (m.kind === "train" ? this.railNb : this.roadNb).get(m.to) ?? [];
    const options = nb.filter((n) => n !== m.from);
    const pick = options.length ? options : nb;
    m.from = m.to;
    m.to = pick.length ? pick[Math.floor(Math.random() * pick.length)] : m.from;
  }

  private pos(i: number) {
    return this.iso(i % this.width, Math.floor(i / this.width));
  }

  /** Avança e desenha um quadro. `active` = foco em andamento (fora dele a cidade "dorme"). */
  update(dtMs: number, active: boolean) {
    const g = this.g.clear();
    const sm = this.smoke.clear();
    if (!active) {
      this.puffs = [];
      return;
    }
    const dt = Math.min(0.1, dtMs / 1000);

    for (const m of this.movers) {
      m.t += m.speed * dt;
      while (m.t >= 1) {
        m.t -= 1;
        this.next(m);
      }
      const a = this.pos(m.from);
      const b = this.pos(m.to);
      const dx = b.sx - a.sx;
      const dy = b.sy - a.sy;
      const len = Math.hypot(dx, dy) || 1;
      const ux = dx / len;
      const uy = dy / len;
      // Perpendicular na tela (mão direita para carros; calçadas para pedestres).
      const px = -uy;
      const py = ux;
      const x = a.sx + dx * m.t;
      const y = a.sy + dy * m.t;
      if (m.kind === "car") {
        const cx = x + px * 2.5;
        const cy = y + py * 2.5;
        const quad = (l: number, w: number, color: number, lift = 0) => {
          g.fillStyle(color, 1);
          g.fillPoints(
            [
              new Phaser.Math.Vector2(cx + ux * l + px * w, cy + uy * l + py * w - lift),
              new Phaser.Math.Vector2(cx + ux * l - px * w, cy + uy * l - py * w - lift),
              new Phaser.Math.Vector2(cx - ux * l - px * w, cy - uy * l - py * w - lift),
              new Phaser.Math.Vector2(cx - ux * l + px * w, cy - uy * l + py * w - lift),
            ],
            true,
          );
        };
        quad(3, 1.6, 0x1b1630); // sombra/contorno
        quad(2.6, 1.2, m.color, 1);
        quad(1.2, 0.9, 0x9ad0ff, 2); // para-brisa/teto
      } else if (m.kind === "ped") {
        const sx = Math.round(x + px * 6 * m.side);
        const sy = Math.round(y + py * 6 * m.side);
        // Passo: as pernas alternam.
        const step = Math.floor((m.t * 8) % 2);
        g.fillStyle(0x1b1630, 1);
        g.fillRect(sx - 1 + step, sy, 1, 1);
        g.fillStyle(m.color, 1);
        g.fillRect(sx - 1, sy - 3, 2, 3);
        g.fillStyle(SKIN[m.color % SKIN.length], 1);
        g.fillRect(sx - 1, sy - 5, 2, 2);
      } else {
        // Trem: locomotiva e dois vagões atrás, ao longo do trecho.
        for (let k = 0; k < 3; k++) {
          const tx = x - ux * k * 7;
          const ty = y - uy * k * 7;
          g.fillStyle(0x1b1630, 1);
          g.fillRect(tx - 3.5, ty - 4.5, 7, 5);
          g.fillStyle(k === 0 ? 0xa83a2a : 0x3a5a8a, 1);
          g.fillRect(tx - 3, ty - 4, 6, 4);
          if (k === 0) {
            g.fillStyle(0xffe9a0, 1);
            g.fillRect(tx + ux * 3 - 0.5, ty - 2.5, 1.5, 1.5);
          }
        }
      }
    }

    // Fumaça: baforadas sobem, crescem e somem.
    for (const s of this.smokers) {
      s.acc += s.rate * dt;
      while (s.acc >= 1) {
        s.acc -= 1;
        const p = this.iso(s.x, s.y);
        this.puffs.push({ x: p.sx - 4 + Math.random() * 6, y: p.sy - 20, age: 0, life: 2.2 + Math.random(), drift: 2 + Math.random() * 3 });
      }
    }
    this.puffs = this.puffs.filter((p) => (p.age += dt) < p.life);
    if (this.puffs.length > 300) this.puffs.splice(0, this.puffs.length - 300);
    for (const p of this.puffs) {
      const k = p.age / p.life;
      sm.fillStyle(k < 0.3 ? 0x9a9aa8 : 0xc8c8d4, 0.8 * (1 - k));
      sm.fillCircle(p.x + p.drift * k * 4, p.y - k * 18, 1.5 + k * 3.5);
    }
  }

  setVisible(v: boolean) {
    this.g.setVisible(v);
    this.smoke.setVisible(v);
  }
}
