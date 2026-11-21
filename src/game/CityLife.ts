// Vida na cidade durante o foco: carros nas ruas, pedestres nas calçadas, trens nos trilhos e
// fumaça das fábricas e usinas. Só visual (não mexe na simulação); a quantidade acompanha a
// população e a malha viária. Desenhado por quadro numa Graphics, entre o chão e os prédios.

import Phaser from "phaser";
import { BUILDINGS, ZONE, citizensView, type CityState } from "@/sim";

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

/** Um morador de verdade: mora numa casa, trabalha num emprego e passeia pela cidade. */
interface Person {
  id: number;
  name: string;
  title: string | null;
  place: string | null;
  skin: number;
  hair: number;
  shirt: number;
  home: number;
  homeRoad: number;
  job: number | null;
  jobRoad: number | null;
  /** Onde está (ou saiu) agora, numa rua. */
  at: number;
  state: "home" | "walk" | "work" | "leisure";
  /** Segundos que ainda fica parado (em casa, no trabalho ou no passeio). */
  timer: number;
  goal: "home" | "work" | "leisure";
  route: number[];
  step: number;
  t: number;
  mode: "walk" | "car";
  /** Destino do passeio. */
  spot: { road: number; label: string } | null;
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
const HAIR = [0x1b1630, 0x6e4630, 0xe8c070, 0xb0502a];

const ROADLIKE = new Set(["road", "onramp", "tunnel", "highway"]);

export class CityLife {
  private g: Phaser.GameObjects.Graphics;
  private smoke: Phaser.GameObjects.Graphics;
  private movers: Mover[] = [];
  private puffs: Puff[] = [];
  private roadNb = new Map<number, number[]>();
  /** Ruas onde se anda a pé ou de carro (sem rodovias). */
  private streetNb = new Map<number, number[]>();
  private persons: Person[] = [];
  private spots: { idx: number; label: string }[] = [];
  private cityRef: CityState | null = null;
  private personsDirty = false;
  private routeCache = new Map<string, number[] | null>();
  private accessCache = new Map<number, number | null>();
  private railNb = new Map<number, number[]>();
  private smokers: { x: number; y: number; rate: number; acc: number }[] = [];
  private width = 0;
  private seedKey = "";
  /** Passeio: o carro ou pedestre que a câmera acompanha e a posição dele na tela. */
  private followed: Mover | Person | null = null;
  followPos: { sx: number; sy: number } | null = null;

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
    // Moradores só andam em ruas comuns (e túneis): nada de rodovia a pé.
    this.streetNb = new Map();
    for (const [i, list] of this.roadNb) {
      if (at.get(i) === "highway") continue;
      const ok = list.filter((j) => at.get(j) !== "highway");
      if (ok.length) this.streetNb.set(i, ok);
    }
    // Pontos de passeio: parques, praças, atrações, cultura e o comércio (compras).
    const SPOT_LABEL: Record<string, string> = { park: "Parque", plaza: "Praça", zoo: "Zoológico", stadium: "Estádio", museum: "Museu", library: "Biblioteca" };
    this.spots = [];
    for (const b of city.buildings) {
      if (SPOT_LABEL[b.type] && !b.damaged) this.spots.push({ idx: b.y * W + b.x, label: SPOT_LABEL[b.type] });
    }
    for (let i = 0; i < city.zoneType.length; i++) {
      if (city.zoneType[i] === ZONE.C && city.zoneLevel[i] > 0 && (i % 3 === 0)) this.spots.push({ idx: i, label: "o comércio" });
    }
    this.routeCache.clear();
    this.accessCache.clear();
    this.cityRef = city;
    this.personsDirty = true;

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
    // Pedestres agora são moradores de verdade (ver buildPersons); sobram só os carros e trens genéricos.
    const wantPeds = 0;
    const wantTrains = rails.length < 4 ? 0 : Math.min(3, Math.ceil(rails.length / 12));

    const key = `${city.seed}`;
    if (key !== this.seedKey) {
      this.movers = [];
      this.seedKey = key;
    }
    // Quem ficou sem caminho (rua demolida) é removido; depois completa até a quantidade desejada.
    this.movers = this.movers.filter((m) => (m.kind === "train" ? this.railNb : this.roadNb).has(m.to));
    if (this.followed && !("name" in this.followed) && !this.movers.includes(this.followed)) this.followed = null;
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

  // ───────────────────────── moradores ─────────────────────────

  /** Rua mais próxima (até 3 tiles) de um lote ou prédio: a porta de entrada. */
  private accessRoad(tile: number): number | null {
    if (this.accessCache.has(tile)) return this.accessCache.get(tile)!;
    const W = this.width;
    const x0 = tile % W;
    const y0 = Math.floor(tile / W);
    let best: number | null = null;
    let bestD = 99;
    for (let dy = -3; dy <= 3; dy++)
      for (let dx = -3; dx <= 3; dx++) {
        const x = x0 + dx;
        const y = y0 + dy;
        if (x < 0 || y < 0 || x >= W) continue;
        const j = y * W + x;
        if (!this.streetNb.has(j)) continue;
        const d = Math.abs(dx) + Math.abs(dy);
        if (d < bestD) {
          bestD = d;
          best = j;
        }
      }
    this.accessCache.set(tile, best);
    return best;
  }

  /** Caminho mais curto entre duas ruas (busca em largura), com cache. */
  private route(a: number, b: number): number[] | null {
    if (a === b) return [a];
    const key = `${a}>${b}`;
    if (this.routeCache.has(key)) return this.routeCache.get(key)!;
    const rev = this.routeCache.get(`${b}>${a}`);
    if (rev) {
      const r = [...rev].reverse();
      this.routeCache.set(key, r);
      return r;
    }
    const parent = new Map<number, number>([[a, a]]);
    const queue = [a];
    let found = false;
    for (let h = 0; h < queue.length && h < 8000; h++) {
      const cur = queue[h];
      if (cur === b) {
        found = true;
        break;
      }
      for (const n of this.streetNb.get(cur) ?? []) {
        if (parent.has(n)) continue;
        parent.set(n, cur);
        queue.push(n);
      }
    }
    let out: number[] | null = null;
    if (found) {
      out = [b];
      for (let c = b; c !== a; ) {
        c = parent.get(c)!;
        out.push(c);
      }
      out.reverse();
    }
    this.routeCache.set(key, out);
    return out;
  }

  private rand(lo: number, hi: number) {
    return lo + Math.random() * (hi - lo);
  }

  /** Cria os moradores a partir da cidade (casa, emprego, nome e aparência). Feito só quando há foco. */
  private buildPersons() {
    this.personsDirty = false;
    const city = this.cityRef;
    this.persons = [];
    if (!city || this.streetNb.size === 0) return;
    const views = citizensView(city);
    const W = city.width;
    const MAX_PERSONS = 160;
    const stride = Math.max(1, Math.ceil(views.length / MAX_PERSONS));
    for (let k = 0; k < views.length; k += stride) {
      const v = views[k];
      if (!v.home) continue;
      const home = v.home.y * W + v.home.x;
      const homeRoad = this.accessRoad(home);
      if (homeRoad === null) continue;
      const job = v.job ? v.job.y * W + v.job.x : null;
      const jobRoad = job !== null ? this.accessRoad(job) : null;
      const p: Person = {
        id: v.id,
        name: v.name,
        title: v.job?.title ?? null,
        place: v.job?.place ?? null,
        skin: v.look.skin,
        hair: v.look.hairColor,
        shirt: SHIRT_COLORS[(v.id * 7) % SHIRT_COLORS.length],
        home,
        homeRoad,
        job,
        jobRoad,
        at: homeRoad,
        state: "home",
        timer: this.rand(0, 30),
        goal: "home",
        route: [],
        step: 0,
        t: 0,
        mode: "walk",
        spot: null,
      };
      // Cada um começa num ponto diferente do dia: em casa, no trabalho, a caminho ou passeando.
      const r = Math.random();
      if (r < 0.3) p.state = "home";
      else if (r < 0.55 && jobRoad !== null) {
        p.state = "work";
        p.at = jobRoad;
        p.timer = this.rand(0, 50);
      } else if (r < 0.85) {
        this.startTrip(p, jobRoad !== null && Math.random() < 0.6 ? "work" : "leisure");
        if (p.state === "walk" && p.route.length > 1) p.step = Math.floor(Math.random() * (p.route.length - 1));
        p.t = Math.random();
      } else this.startTrip(p, "leisure");
      this.persons.push(p);
    }
  }

  /** Sai para o próximo destino: o emprego, a casa ou um passeio. */
  private startTrip(p: Person, goal: Person["goal"]) {
    let target: number | null = null;
    p.spot = null;
    if (goal === "work") target = p.jobRoad;
    else if (goal === "home") target = p.homeRoad;
    else {
      // Passeio: um dos pontos mais perto de casa.
      const W = this.width;
      const hx = p.home % W;
      const hy = Math.floor(p.home / W);
      const near = [...this.spots]
        .map((s) => ({ s, d: Math.abs((s.idx % W) - hx) + Math.abs(Math.floor(s.idx / W) - hy) }))
        .sort((a, b) => a.d - b.d)
        .slice(0, 6);
      const pickSpot = near.length ? near[Math.floor(Math.random() * near.length)].s : null;
      const road = pickSpot ? this.accessRoad(pickSpot.idx) : null;
      if (pickSpot && road !== null) {
        target = road;
        p.spot = { road, label: pickSpot.label };
      }
    }
    const route = target === null ? null : this.route(p.at, target);
    if (!route) {
      // Sem caminho (rua cortada) ou sem destino: fica em casa um pouco.
      p.state = "home";
      p.goal = "home";
      p.at = p.homeRoad;
      p.timer = this.rand(8, 20);
      return;
    }
    p.goal = goal;
    p.route = route;
    p.step = 0;
    p.t = 0;
    p.state = route.length > 1 ? "walk" : goal === "work" ? "work" : goal === "leisure" ? "leisure" : "home";
    p.mode = route.length >= 14 ? "car" : "walk";
    if (p.state !== "walk") this.arrive(p);
  }

  private arrive(p: Person) {
    p.at = p.route[p.route.length - 1] ?? p.at;
    p.route = [];
    if (p.goal === "work") {
      p.state = "work";
      p.timer = this.rand(35, 80);
    } else if (p.goal === "leisure") {
      p.state = "leisure";
      p.timer = this.rand(14, 30);
    } else {
      p.state = "home";
      p.timer = this.rand(15, 40);
    }
  }

  /** O que fazer depois de ficar parado. */
  private nextGoal(p: Person) {
    if (p.state === "home") this.startTrip(p, p.jobRoad !== null && Math.random() < 0.85 ? "work" : "leisure");
    else if (p.state === "work") this.startTrip(p, Math.random() < 0.4 ? "leisure" : "home");
    else this.startTrip(p, "home");
  }

  /** Texto do que o morador está fazendo (para a legenda do passeio). */
  private describe(p: Person): string {
    const car = p.mode === "car" && p.state === "walk" ? "de carro, " : "";
    if (p.state === "walk") {
      if (p.goal === "work") return `${car}indo para o trabalho${p.place ? ` (${p.place})` : ""}`;
      if (p.goal === "home") return `${car}voltando para casa`;
      return `${car}indo para ${p.spot?.label ?? "um passeio"}`;
    }
    if (p.state === "leisure") return `aproveitando ${p.spot?.label ?? "o passeio"}`;
    if (p.state === "work") return `trabalhando${p.place ? ` (${p.place})` : ""}`;
    return "em casa";
  }

  /** Legenda de quem a câmera está acompanhando. */
  followInfo(): string | null {
    const f = this.followed;
    if (!f) return null;
    if ("name" in f) return `${f.name}${f.title ? ` · ${f.title}` : ""} — ${this.describe(f)}`;
    return f.kind === "car" ? "Um carro pela cidade" : "Um pedestre pela cidade";
  }

  /** Escolhe o carro ou pedestre a seguir (se não houver do tipo pedido, usa o outro). null = sem passeio. */
  setFollow(kind: "car" | "ped" | null) {
    if (!kind) {
      this.followed = null;
      this.followPos = null;
      return;
    }
    // Já segue alguém que continua na rua e é do tipo pedido: mantém.
    const f = this.followed;
    if (f && "name" in f && this.persons.includes(f) && f.state === "walk" && (kind === "car") === (f.mode === "car")) return;
    if (f && !("name" in f) && this.movers.includes(f) && f.kind === kind) return;
    // Primeiro um morador de verdade que está andando (a pé ou de carro, como pedido); senão um carro genérico.
    const walking = this.persons.filter((p) => p.state === "walk" && (kind === "car" ? p.mode === "car" : p.mode === "walk"));
    const generic = this.movers.filter((m) => m.kind === "car");
    const anyWalking = this.persons.filter((p) => p.state === "walk");
    this.followed = walking.length
      ? walking[Math.floor(Math.random() * walking.length)]
      : kind === "car" && generic.length
        ? generic[Math.floor(Math.random() * generic.length)]
        : anyWalking.length
          ? anyWalking[Math.floor(Math.random() * anyWalking.length)]
          : generic.length
            ? generic[Math.floor(Math.random() * generic.length)]
            : null;
    if (!this.followed) this.followPos = null;
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
      this.followPos = null;
      return;
    }
    const dt = Math.min(0.1, dtMs / 1000);
    if (this.personsDirty) this.buildPersons();
    this.updatePersons(dt, g);

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
      if (m === this.followed) {
        const lift = m.kind === "car" ? 2 : 3;
        this.followPos = { sx: x + (m.kind === "car" ? px * 2.5 : px * 6 * m.side), sy: y + (m.kind === "car" ? py * 2.5 : py * 6 * m.side) - lift };
        // Marcador sobre quem a câmera acompanha.
        const mx = Math.round(this.followPos.sx);
        const my = Math.round(this.followPos.sy) - 9;
        g.fillStyle(0x1b1630, 1);
        g.fillTriangle(mx - 3, my - 1, mx + 3, my - 1, mx, my + 4);
        g.fillStyle(0xffe14a, 1);
        g.fillTriangle(mx - 2, my, mx + 2, my, mx, my + 3);
      }
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

  /** Avança a rotina de cada morador e desenha quem está na rua. */
  private updatePersons(dt: number, g: Phaser.GameObjects.Graphics) {
    for (const p of this.persons) {
      if (p.state !== "walk") {
        p.timer -= dt;
        if (p.timer <= 0) this.nextGoal(p);
      } else {
        p.t += (p.mode === "car" ? 1.7 : 0.5) * dt;
        while (p.t >= 1 && p.state === "walk") {
          p.t -= 1;
          p.step++;
          if (p.step >= p.route.length - 1) {
            this.arrive(p);
            break;
          }
        }
      }
      // Quem entrou num prédio some; quem estava sendo seguido e entrou em casa ou no trabalho é trocado.
      const outside = p.state === "walk" || p.state === "leisure";
      if (!outside) {
        if (this.followed === p) {
          this.followed = null;
          this.followPos = null;
        }
        continue;
      }
      let x: number;
      let y: number;
      let ux = 1;
      let uy = 0;
      if (p.state === "walk" && p.route.length > 1) {
        const a = this.pos(p.route[p.step]);
        const b = this.pos(p.route[Math.min(p.step + 1, p.route.length - 1)]);
        const dx = b.sx - a.sx;
        const dy = b.sy - a.sy;
        const len = Math.hypot(dx, dy) || 1;
        ux = dx / len;
        uy = dy / len;
        x = a.sx + dx * p.t;
        y = a.sy + dy * p.t;
      } else {
        const a = this.pos(p.at);
        x = a.sx + 3;
        y = a.sy;
      }
      const px = -uy;
      const py = ux;
      if (p.mode === "car" && p.state === "walk") {
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
        quad(3, 1.6, 0x1b1630);
        quad(2.6, 1.2, p.shirt, 1);
        quad(1.2, 0.9, 0x9ad0ff, 2);
        if (this.followed === p) this.followPos = { sx: cx, sy: cy - 2 };
      } else {
        const side = p.id % 2 ? 1 : -1;
        const sx = Math.round(x + (p.state === "walk" ? px * 6 * side : 0));
        const sy = Math.round(y + (p.state === "walk" ? py * 6 * side : 0));
        const step = p.state === "walk" ? Math.floor((p.t * 8) % 2) : 0;
        g.fillStyle(0x1b1630, 1);
        g.fillRect(sx - 1 + step, sy, 1, 1);
        g.fillStyle(p.shirt, 1);
        g.fillRect(sx - 1, sy - 3, 2, 3);
        g.fillStyle(SKIN[p.skin % SKIN.length], 1);
        g.fillRect(sx - 1, sy - 5, 2, 2);
        g.fillStyle(HAIR[p.hair % HAIR.length], 1);
        g.fillRect(sx - 1, sy - 6, 2, 1);
        if (this.followed === p) this.followPos = { sx, sy: sy - 3 };
      }
      if (this.followed === p && this.followPos) {
        const mx = Math.round(this.followPos.sx);
        const my = Math.round(this.followPos.sy) - 9;
        g.fillStyle(0x1b1630, 1);
        g.fillTriangle(mx - 3, my - 1, mx + 3, my - 1, mx, my + 4);
        g.fillStyle(0xffe14a, 1);
        g.fillTriangle(mx - 2, my, mx + 2, my, mx, my + 3);
      }
    }
  }

  setVisible(v: boolean) {
    this.g.setVisible(v);
    this.smoke.setVisible(v);
  }
}
