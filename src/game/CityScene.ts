import Phaser from "phaser";
import { BIOMES, BUILDINGS, ZONE_KINDS, ZONES, buildingStatus, computePower, computeServices, computeTraffic, computeWater, type CityState } from "@/sim";
import { isAreaTool, useGame } from "@/store/game";
import { bus } from "./bus";

const TW = 32; // largura do tile isométrico
const TH = 16; // altura do tile isométrico
const ZOOMS = [1, 2, 3, 4];
const V = Phaser.Math.Vector2;

/** Pixels por nível de altitude (Fase 9). */
const EH = 8;
/** Altitude do mapa atual (definida a cada redesenho); iso() já devolve o tile na altura certa. */
let ELEV: { w: number; h: number; e: number[] } | null = null;
const elevAt = (x: number, y: number) => {
  if (!ELEV) return 0;
  const xi = Math.round(x);
  const yi = Math.round(y);
  if (xi < 0 || yi < 0 || xi >= ELEV.w || yi >= ELEV.h) return 0;
  return ELEV.e[yi * ELEV.w + xi] ?? 0;
};
const setElevation = (city: CityState) => {
  ELEV = city.elevation?.length ? { w: city.width, h: city.height, e: city.elevation } : null;
};
const iso = (x: number, y: number) => ({ sx: ((x - y) * TW) / 2, sy: ((x + y) * TH) / 2 - elevAt(x, y) * EH });

function shade(color: number, f: number) {
  const r = Math.min(255, Math.round(((color >> 16) & 0xff) * f));
  const g = Math.min(255, Math.round(((color >> 8) & 0xff) * f));
  const b = Math.min(255, Math.round((color & 0xff) * f));
  return (r << 16) | (g << 8) | b;
}

type Tile = { x: number; y: number };

/** Tiles de uma linha na grade (Bresenham), de `a` até `b`, inclusive. */
function gridLine(a: Tile, b: Tile): Tile[] {
  const out: Tile[] = [];
  let { x, y } = a;
  const dx = Math.abs(b.x - x);
  const dy = -Math.abs(b.y - y);
  const sx = x < b.x ? 1 : -1;
  const sy = y < b.y ? 1 : -1;
  let err = dx + dy;
  for (;;) {
    out.push({ x, y });
    if (x === b.x && y === b.y) return out;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y += sy;
    }
  }
}

/** Hash determinístico por tile (variações de terreno e decoração). */
function tileHash(seed: number, x: number, y: number) {
  let h = (seed ^ Math.imul(x + 1, 0x27d4eb2d) ^ Math.imul(y + 1, 0x165667b1)) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b) >>> 0;
  return (h ^ (h >>> 13)) >>> 0;
}

/** Motor gráfico: apenas renderiza o estado do Zustand e traduz o mouse em tiles/áreas. */
export class CityScene extends Phaser.Scene {
  private terrainG!: Phaser.GameObjects.Graphics;
  private buildG!: Phaser.GameObjects.Graphics;
  private overlayG!: Phaser.GameObjects.Graphics;
  private hoverG!: Phaser.GameObjects.Graphics;
  /** Camadas da renderização por sprites. */
  private terrainRT?: Phaser.GameObjects.RenderTexture;
  private lotG!: Phaser.GameObjects.Graphics;
  private flatLayer!: Phaser.GameObjects.Container;
  private spriteLayer!: Phaser.GameObjects.Container;
  private fxG!: Phaser.GameObjects.Graphics;
  private zoomIdx = 1;
  private lastTerrainKey = "";
  private hover: Tile | null = null;
  private painting = false;
  private painted = new Set<string>();
  private lastPainted: Tile | null = null;
  private areaFrom: Tile | null = null;
  private panFrom: { x: number; y: number; sx: number; sy: number } | null = null;
  private unsubscribe?: () => void;

  constructor() {
    super("city");
  }

  preload() {
    // Folha de sprites gerada com pxl (art/city.px.js → npm run art).
    this.load.atlas("city", "/sprites/city.png", "/sprites/city.json");
  }

  create() {
    // Ordem de desenho: terreno → lotes/estradas → construções → efeitos → overlays → cursor.
    this.terrainG = this.add.graphics().setDepth(1);
    this.lotG = this.add.graphics().setDepth(2);
    this.flatLayer = this.add.container(0, 0).setDepth(3);
    this.buildG = this.add.graphics().setDepth(4);
    this.spriteLayer = this.add.container(0, 0).setDepth(5);
    this.fxG = this.add.graphics().setDepth(6);
    this.overlayG = this.add.graphics().setDepth(7);
    this.hoverG = this.add.graphics().setDepth(8);
    this.cameras.main.setBackgroundColor("#1b1f3a");
    this.cameras.main.setZoom(ZOOMS[this.zoomIdx]);
    this.input.mouse?.disableContextMenu();

    const city = useGame.getState().city;
    if (city) this.centerOn(city);
    this.redraw();
    this.unsubscribe = useGame.subscribe((s, prev) => {
      if (s.city !== prev.city || s.tool !== prev.tool || s.phase !== prev.phase || s.overlay !== prev.overlay) {
        if (!prev.city && s.city) this.centerOn(s.city);
        this.redraw();
      }
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.unsubscribe?.());

    this.input.on("pointerdown", (p: Phaser.Input.Pointer) => {
      if (p.rightButtonDown() || p.middleButtonDown() || useGame.getState().tool === "pan") {
        const cam = this.cameras.main;
        this.panFrom = { x: p.x, y: p.y, sx: cam.scrollX, sy: cam.scrollY };
        return;
      }
      if (isAreaTool(useGame.getState().tool)) {
        this.areaFrom = this.tileAt(p);
        this.drawHover();
        return;
      }
      this.painting = true;
      this.painted.clear();
      this.lastPainted = null;
      this.paintAt(p);
    });
    this.input.on("pointermove", (p: Phaser.Input.Pointer) => {
      if (this.panFrom) {
        const cam = this.cameras.main;
        cam.scrollX = this.panFrom.sx - (p.x - this.panFrom.x) / cam.zoom;
        cam.scrollY = this.panFrom.sy - (p.y - this.panFrom.y) / cam.zoom;
        return;
      }
      const t = this.tileAt(p);
      if (t?.x !== this.hover?.x || t?.y !== this.hover?.y) {
        this.hover = t;
        bus.emit("tile:hover", t);
        this.drawHover();
      }
      if (this.painting) this.paintAt(p);
    });
    const stop = () => {
      if (this.areaFrom && this.hover) {
        bus.emit("area:select", { x0: this.areaFrom.x, y0: this.areaFrom.y, x1: this.hover.x, y1: this.hover.y });
      }
      this.areaFrom = null;
      this.painting = false;
      this.panFrom = null;
      this.drawHover();
    };
    this.input.on("pointerup", stop);
    this.input.on("pointerupoutside", stop);
    this.input.on("wheel", (_p: unknown, _o: unknown, _dx: number, dy: number) => {
      this.zoomIdx = Phaser.Math.Clamp(this.zoomIdx + (dy > 0 ? -1 : 1), 0, ZOOMS.length - 1);
      this.cameras.main.setZoom(ZOOMS[this.zoomIdx]); // zoom inteiro mantém o pixel art nítido
    });
    // Câmera só pelo mouse (sem teclado): arrastar com o botão direito/do meio ou com a ferramenta Mover.
  }

  private centerOn(city: CityState) {
    const { sx, sy } = iso(city.width / 2, city.height / 2);
    this.cameras.main.centerOn(sx, sy);
  }

  private tileAt(p: Phaser.Input.Pointer): Tile | null {
    const city = useGame.getState().city;
    if (!city) return null;
    setElevation(city);
    const w = this.cameras.main.getWorldPoint(p.x, p.y);
    const pick = (k: number) => {
      const wy = w.y + k * EH;
      const fx = (w.x / (TW / 2) + wy / (TH / 2)) / 2;
      const fy = (wy / (TH / 2) - w.x / (TW / 2)) / 2;
      return { x: Math.floor(fx + 0.5), y: Math.floor(fy + 0.5) };
    };
    let best = pick(0);
    let bestDepth = -Infinity;
    for (let k = 0; k <= 3; k++) {
      const c = pick(k);
      if (c.x < 0 || c.y < 0 || c.x >= city.width || c.y >= city.height) continue;
      if (elevAt(c.x, c.y) !== k) continue;
      const depth = c.x + c.y + k * 0.01;
      if (depth > bestDepth) {
        bestDepth = depth;
        best = c;
      }
    }
    const { x, y } = best;
    if (x < 0 || y < 0 || x >= city.width || y >= city.height) return null;
    return { x, y };
  }

  private paintAt(p: Phaser.Input.Pointer) {
    const t = this.tileAt(p);
    if (!t) return;
    // Estrada, linha e demolição podem ser "pintadas" arrastando; o resto é um clique.
    const tool = useGame.getState().tool;
    const paintable =
      tool === "road" || tool === "highway" || tool === "rail" || tool === "wire" || tool === "pipe" || tool === "demolish" || !!tool?.startsWith("terra-");
    if (this.painted.size > 0 && !paintable) return;
    // Mouse rápido pula tiles entre dois eventos: preenche o caminho (Bresenham na grade),
    // para uma estrada arrastada nunca ficar com buracos.
    const from = this.lastPainted && paintable ? this.lastPainted : t;
    for (const step of gridLine(from, t)) {
      const k = `${step.x},${step.y}`;
      if (this.painted.has(k)) continue;
      this.painted.add(k);
      bus.emit("tile:click", step);
    }
    this.lastPainted = t;
  }

  private diamond(g: Phaser.GameObjects.Graphics, sx: number, sy: number, s = 1, lift = 0) {
    const w = (TW / 2) * s;
    const h = (TH / 2) * s;
    g.fillPoints([new V(sx, sy - h - lift), new V(sx + w, sy - lift), new V(sx, sy + h - lift), new V(sx - w, sy - lift)], true);
  }

  private diamondOutline(g: Phaser.GameObjects.Graphics, sx: number, sy: number, s = 1) {
    const w = (TW / 2) * s;
    const h = (TH / 2) * s;
    g.strokePoints([new V(sx, sy - h), new V(sx + w, sy), new V(sx, sy + h), new V(sx - w, sy)], true);
  }

  private box(g: Phaser.GameObjects.Graphics, sx: number, sy: number, color: number, height: number, alpha: number, s = 0.78) {
    const w = (TW / 2) * s;
    const h = (TH / 2) * s;
    g.fillStyle(shade(color, 0.7), alpha);
    g.fillPoints([new V(sx - w, sy), new V(sx, sy + h), new V(sx, sy + h - height), new V(sx - w, sy - height)], true);
    g.fillStyle(shade(color, 0.5), alpha);
    g.fillPoints([new V(sx, sy + h), new V(sx + w, sy), new V(sx + w, sy - height), new V(sx, sy + h - height)], true);
    g.fillStyle(color, alpha);
    this.diamond(g, sx, sy, s, height);
  }

  /** Marcador de alerta acima de um objeto. */
  private alert(g: Phaser.GameObjects.Graphics, sx: number, top: number, color: number) {
    g.fillStyle(color, 1);
    g.fillRect(sx - 2, top - 12, 4, 6);
    g.fillRect(sx - 2, top - 4, 4, 2);
  }

  /** Desenha o estado atual: sprites da folha "city" (gerada com pxl) ou, sem ela, formas simples. */
  private redraw() {
    const { city } = useGame.getState();
    if (!city) return;
    setElevation(city);
    if (!this.textures.exists("city")) return this.redrawShapes();
    this.terrainG.clear();
    this.buildG.clear();
    this.redrawSprites(city);
    this.drawOverlay(city);
    this.drawHover();
  }

  private frame(name: string) {
    return this.textures.get("city").has(name) ? name : null;
  }

  private redrawSprites(city: CityState) {
    const { serverState } = useGame.getState();
    this.terrainRT?.destroy();
    this.terrainRT = undefined;

    const power = computePower(city);
    const status = buildingStatus(city, power.powered);
    const syncedMaxId = (serverState?.nextId ?? 1) - 1;
    const buildingAt = new Map(city.buildings.map((b) => [b.y * city.width + b.x, b]));
    // Vias se ligam a vizinhos compatíveis: estrada ↔ estrada/acesso/estação; rodovia ↔ rodovia/acesso;
    // trilho ↔ trilho/estação.
    const LINKS: Record<string, string[]> = {
      road: ["road", "onramp", "bus_stop", "tunnel"],
      highway: ["highway", "onramp"],
      rail: ["rail", "train_station"],
    };
    const E = (x: number, y: number) => city.elevation?.[y * city.width + x] ?? 0;
    /** Vias se ligam se o desnível é vencível por rampa (≤ 1) ou se uma delas é túnel (Fase 9). */
    const linked = (type: string, x: number, y: number, nx: number, ny: number) => {
      if (nx < 0 || ny < 0 || nx >= city.width || ny >= city.height) return false;
      const other = buildingAt.get(ny * city.width + nx)?.type ?? "";
      if (!LINKS[type]?.includes(other)) return false;
      return Math.abs(E(x, y) - E(nx, ny)) <= 1 || other === "tunnel";
    };
    const linkMask = (type: string, x: number, y: number) =>
      (linked(type, x, y, x - 1, y) ? 1 : 0) | (linked(type, x, y, x, y - 1) ? 2 : 0) | (linked(type, x, y, x + 1, y) ? 4 : 0) | (linked(type, x, y, x, y + 1) ? 8 : 0);
    const SOIL = 0x7a5a3a;
    const grass = BIOMES[city.biome].grass;
    const RAMP: Record<string, number> = { road: 0x4d4d57, highway: 0x7b796f, rail: 0xa9a37e };

    this.flatLayer.removeAll(true);
    this.spriteLayer.removeAll(true);
    this.lotG.clear();
    const fx = this.fxG.clear();
    // 2,5D: sombra projetada no chão (luz vindo de cima-esquerda), proporcional à altura.
    const shadows = this.buildG.clear();
    shadows.fillStyle(0x0b0820, 0.28);
    const castShadow = (sx: number, sy: number, height: number, scale = 0.85) => {
      const hw = (TW / 2) * scale;
      const hh = (TH / 2) * scale;
      const len = Math.min(26, Math.max(3, height * 0.55));
      const dx = len;
      const dy = len / 2;
      const T = [sx, sy - hh];
      const R = [sx + hw, sy];
      const B = [sx, sy + hh];
      shadows.fillPoints(
        [
          new V(T[0], T[1]),
          new V(R[0], R[1]),
          new V(B[0], B[1]),
          new V(B[0] + dx, B[1] + dy),
          new V(R[0] + dx, R[1] + dy),
          new V(T[0] + dx, T[1] + dy),
        ],
        true,
      );
    };
    // Ordem de profundidade: diagonais (x + y) crescentes. Na camada de chão, cada diagonal desenha
    // terreno, paredões (penhascos e rampas) e lotes antes da seguinte — morros escondem o que há atrás.
    for (let d = 0; d <= city.width + city.height - 2; d++) {
      const x0 = Math.max(0, d - city.height + 1);
      const x1 = Math.min(d, city.width - 1);
      for (let x = x0; x <= x1; x++) {
        const y = d - x;
        const i = y * city.width + x;
        const { sx, sy } = iso(x, y);
        const v = tileHash(city.seed, x, y) & 1;
        const t = city.terrain[i];
        const name = (t ? this.frame(`water_${v}`) : this.frame(`ground_${city.biome}_${v}`)) ?? "ground_plains_0";
        const img = this.add.image(sx, sy, "city", name);
        if (t === 2) img.setTint(0x8ab0d8); // mar: azul mais profundo
        this.flatLayer.add(img);
      }
      const g = this.add.graphics();
      this.flatLayer.add(g);
      for (let x = x0; x <= x1; x++) {
        const y = d - x;
        const i = y * city.width + x;
        const { sx, sy } = iso(x, y);
        const e = E(x, y);
        const here = buildingAt.get(i);
        const water = city.terrain[i] !== 0;
        // Paredões: faces de frente (+x à direita, +y à esquerda) até a altura do vizinho; na borda
        // do mapa, até a base (efeito maquete).
        for (const [nx, ny, side] of [
          [x + 1, y, "R"],
          [x, y + 1, "L"],
        ] as const) {
          const edge = nx >= city.width || ny >= city.height;
          const en = edge ? -0.75 : E(nx, ny);
          if (e <= en) continue;
          const dh = (e - en) * EH;
          const A = side === "R" ? [sx + TW / 2, sy] : [sx - TW / 2, sy];
          const B = [sx, sy + TH / 2];
          const other = edge ? undefined : buildingAt.get(ny * city.width + nx);
          const ramp = here && other && Math.abs(e - en) === 1 && RAMP[here.type] && linked(here.type, x, y, nx, ny);
          const base = water ? 0x2f558f : ramp ? RAMP[here!.type] : SOIL;
          g.fillStyle(shade(base, side === "R" ? 0.95 : 0.75), 1);
          g.fillPoints([new V(A[0], A[1]), new V(B[0], B[1]), new V(B[0], B[1] + dh), new V(A[0], A[1] + dh)], true);
          if (ramp && here!.type !== "rail") {
            // Faixa central da rampa.
            g.lineStyle(1, here!.type === "road" ? 0xe8c94a : 0xf4f1e8, 1);
            g.lineBetween((A[0] + B[0]) / 2, (A[1] + B[1]) / 2, (A[0] + B[0]) / 2, (A[1] + B[1]) / 2 + dh);
          } else if (!water && !ramp) {
            // Beirada de grama e estratos do solo.
            g.lineStyle(1, grass, 1);
            g.lineBetween(A[0], A[1] + 1, B[0], B[1] + 1);
            g.lineStyle(1, shade(base, 0.6), 0.6);
            for (let k = EH; k < dh; k += EH) g.lineBetween(A[0], A[1] + k, B[0], B[1] + k);
          }
        }
        // Pilares da ponte (via sobre a água).
        if (here && water && BUILDINGS[here.type].linear) {
          g.fillStyle(0x5a4a3a, 1);
          g.fillRect(sx - 9, sy + 2, 2, 4);
          g.fillRect(sx + 7, sy + 2, 2, 4);
        }
      }
      for (let x = x0; x <= x1; x++) {
        const y = d - x;
        const i = y * city.width + x;
        const { sx, sy } = iso(x, y);
        const b = buildingAt.get(i);
        const zone = city.zoneType[i];
        const baseY = sy + TH / 2 + 1; // vértice inferior do tile + 1 px do contorno

        if (b && (BUILDINGS[b.type].linear || b.type === "onramp")) {
          const frame = b.type === "onramp" ? "onramp" : `${b.type}_${linkMask(b.type, x, y)}`;
          const img = this.add.image(sx, sy, "city", this.frame(frame) ?? `road_0`).setAlpha(b.id > syncedMaxId ? 0.75 : 1);
          // Estrada sem verba: desgaste (marrom) e danificada (avermelhada, sem conexão).
          const cond = b.condition ?? 100;
          if (cond < 30) img.setTint(0xb05a40);
          else if (cond < 70) img.setTint(0xc8a888);
          this.flatLayer.add(img);
          if (city.terrain[i] !== 0) img.setTint(0xd8d0c0); // ponte: tabuleiro mais claro
        } else if (b) {
          const name = this.frame(b.type) ?? "farm";
          const img = this.add.image(sx, baseY, "city", name).setOrigin(0.5, 1).setAlpha(b.id > syncedMaxId ? 0.75 : 1);
          this.spriteLayer.add(img);
          castShadow(sx, sy, img.height - TH);
          const st = status.get(b.id);
          const top = baseY - img.height;
          // Danificada por desastre: escurecida e com alerta cinza até o reparo.
          if (b.damaged) {
            img.setTint(0x6a5a5a);
            this.alert(fx, sx, top, 0xb0b0b0);
          } else if (st && !st.connected) this.alert(fx, sx, top, 0xe03030);
          else if (st && !st.powered) this.alert(fx, sx, top, 0xf5e04a);
          else if (st && st.efficiency < 1) this.alert(fx, sx, top, 0xf0a030);
        } else if (zone) {
          const kind = ZONE_KINDS[zone - 1];
          const lvl = city.zoneLevel[i];
          const dense = city.zoneDensity[i] === 1;
          if (lvl === 0) {
            // Lote vazio: terreno tingido com a cor da zona (mais forte se denso).
            const color = ZONES[kind].color;
            const lg = this.add.graphics();
            this.flatLayer.add(lg);
            lg.fillStyle(color, dense ? 0.5 : 0.32);
            this.diamond(lg, sx, sy, 0.9);
            lg.lineStyle(1, shade(color, 0.6), 0.85);
            this.diamondOutline(lg, sx, sy, 0.9);
          } else {
            const name = this.frame(`zone_${kind}_${dense ? "D" : "L"}${lvl}`) ?? `zone_${kind}_L1`;
            const img = this.add.image(sx, baseY, "city", name).setOrigin(0.5, 1);
            this.spriteLayer.add(img);
            castShadow(sx, sy, img.height - TH);
            if (!power.powered[i]) this.alert(fx, sx, baseY - img.height, 0xf5e04a);
          }
        }
        // Árvores (Fase 9): camada real; somem quando o tile é ocupado.
        if (!b && city.trees?.[i] && !city.zoneLevel[i] && !city.wires[i] && city.terrain[i] === 0) {
          const name = this.frame(`decor_${city.biome}_${tileHash(city.seed ^ 0x9e37, x, y) & 1}`);
          if (name) {
            this.spriteLayer.add(this.add.image(sx, baseY, "city", name).setOrigin(0.5, 1));
            castShadow(sx, sy, 12, 0.5);
          }
        }

        if (city.wires[i]) {
          this.spriteLayer.add(this.add.image(sx, sy + 3, "city", "power_pole").setOrigin(0.5, 1));
        }
      }
    }

    // Cabos entre postes vizinhos (por cima das construções).
    fx.lineStyle(1, 0x1a1a1a, 0.85);
    for (let y = 0; y < city.height; y++)
      for (let x = 0; x < city.width; x++) {
        if (!city.wires[y * city.width + x]) continue;
        const a = iso(x, y);
        for (const [dx, dy] of [
          [1, 0],
          [0, 1],
        ] as const) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < city.width && ny < city.height && city.wires[ny * city.width + nx]) {
            const n = iso(nx, ny);
            fx.lineBetween(a.sx - 3, a.sy - 11, n.sx - 3, n.sy - 11);
            fx.lineBetween(a.sx + 3, a.sy - 11, n.sx + 3, n.sy - 11);
          }
        }
      }
  }

  /** Camadas de visualização (energia, zonas) por cima de tudo. */
  private drawOverlay(city: CityState) {
    const { overlay } = useGame.getState();
    const o = this.overlayG.clear();
    // Visão subterrânea: a cidade fica translúcida para mostrar os canos e o abastecimento.
    const underground = overlay === "water";
    this.spriteLayer.setAlpha(underground ? 0.3 : 1);
    this.flatLayer.setAlpha(underground ? 0.45 : 1);
    if (underground) {
      const water = computeWater(city);
      for (let i = 0; i < water.conductive.length; i++) {
        if (!water.conductive[i]) continue;
        const { sx, sy } = iso(i % city.width, Math.floor(i / city.width));
        o.fillStyle(water.watered[i] ? 0x3a8ad8 : 0xb04a3a, water.watered[i] ? 0.35 : 0.3);
        this.diamond(o, sx, sy, 0.95);
      }
      // Canos: linhas grossas entre vizinhos (e um ponto em cano isolado).
      o.lineStyle(3, 0x9ad0ff, 1);
      for (let y = 0; y < city.height; y++)
        for (let x = 0; x < city.width; x++) {
          if (!city.pipes[y * city.width + x]) continue;
          const a = iso(x, y);
          o.fillStyle(0x9ad0ff, 1);
          o.fillRect(a.sx - 2, a.sy - 1, 4, 3);
          for (const [dx, dy] of [
            [1, 0],
            [0, 1],
          ] as const) {
            const nx = x + dx;
            const ny = y + dy;
            if (nx < city.width && ny < city.height && city.pipes[ny * city.width + nx]) {
              const n = iso(nx, ny);
              o.lineBetween(a.sx, a.sy, n.sx, n.sy);
            }
          }
        }
    } else if (overlay === "power") {
      const power = computePower(city);
      for (let i = 0; i < power.conductive.length; i++) {
        if (!power.conductive[i]) continue;
        const { sx, sy } = iso(i % city.width, Math.floor(i / city.width));
        o.fillStyle(power.powered[i] ? 0xf5e04a : 0xe03030, 0.45);
        this.diamond(o, sx, sy, 0.95);
      }
    } else if (overlay === "zones") {
      for (let i = 0; i < city.zoneType.length; i++) {
        const z = city.zoneType[i];
        const { sx, sy } = iso(i % city.width, Math.floor(i / city.width));
        o.fillStyle(z ? ZONES[ZONE_KINDS[z - 1]].color : 0x000000, z ? 0.6 : 0.35);
        this.diamond(o, sx, sy, 0.95);
      }
    } else this.drawHeatmap(city, o, overlay);
  }

  /** Mapas de calor da Fase 7: crime, poluição, valor do solo e cobertura de serviços. */
  private drawHeatmap(city: CityState, o: Phaser.GameObjects.Graphics, overlay: string) {
    if (overlay === "traffic") {
      // Trânsito: vias por carga (verde → amarelo → vermelho) e lotes sem emprego ao alcance (roxo).
      const t = computeTraffic(city);
      for (let i = 0; i < city.zoneType.length; i++) {
        const { sx, sy } = iso(i % city.width, Math.floor(i / city.width));
        if (t.capacity[i]) {
          const r = t.load[i] / t.capacity[i];
          o.fillStyle(r >= 1 ? 0xe03030 : r >= 0.5 ? 0xf0c040 : 0x40c060, r > 0 ? 0.65 : 0.25);
          this.diamond(o, sx, sy, 0.95);
        } else if (t.failed[i]) {
          o.fillStyle(0xa040d0, 0.5);
          this.diamond(o, sx, sy, 0.95);
        }
      }
      return;
    }
    if (overlay !== "crime" && overlay !== "pollution" && overlay !== "landValue" && overlay !== "coverage") return;
    const f = computeServices(city, buildingStatus(city, computePower(city).powered));
    const lerp = (a: number, b: number, t: number) => {
      const ch = (sh: number) => Math.round(((a >> sh) & 255) + (((b >> sh) & 255) - ((a >> sh) & 255)) * t);
      return (ch(16) << 16) | (ch(8) << 8) | ch(0);
    };
    for (let i = 0; i < city.zoneType.length; i++) {
      const { sx, sy } = iso(i % city.width, Math.floor(i / city.width));
      let color = 0;
      let alpha = 0;
      if (overlay === "crime" || overlay === "pollution") {
        const v = (overlay === "crime" ? f.crime[i] : f.pollution[i]) / 100;
        if (v < 0.03) continue;
        color = overlay === "crime" ? lerp(0xf0d040, 0xd02020, v) : lerp(0xb0a070, 0x5a3a1a, v);
        alpha = 0.25 + v * 0.5;
      } else if (overlay === "landValue") {
        const v = f.landValue[i] / 100;
        color = lerp(0xa03a2a, 0x40d070, v);
        alpha = 0.45;
      } else {
        // Cobertura: polícia (azul) e bombeiros (vermelho) somados.
        const p = f.police[i];
        const fi = f.fire[i];
        if (p < 0.05 && fi < 0.05) continue;
        color = p >= fi ? 0x3a6ad8 : 0xd84a3a;
        if (p > 0.05 && fi > 0.05) color = 0xa050c8;
        alpha = 0.2 + Math.max(p, fi) * 0.45;
      }
      o.fillStyle(color, alpha);
      this.diamond(o, sx, sy, 0.95);
    }
  }

  /** Renderização por formas (usada só se a folha de sprites não carregar). */
  private redrawShapes() {
    const { city, serverState, overlay } = useGame.getState();
    if (!city) return;
    const biome = BIOMES[city.biome];

    const terrainKey = `${city.seed}:${city.biome}`;
    if (terrainKey !== this.lastTerrainKey) {
      this.lastTerrainKey = terrainKey;
      const g = this.terrainG.clear();
      for (let y = 0; y < city.height; y++)
        for (let x = 0; x < city.width; x++) {
          const { sx, sy } = iso(x, y);
          const water = city.terrain[y * city.width + x] !== 0;
          const base = water ? 0x2f5f9e : biome.grass;
          g.fillStyle((x + y) % 2 === 0 ? base : shade(base, 0.92), 1);
          this.diamond(g, sx, sy);
        }
    }

    const power = computePower(city);
    const status = buildingStatus(city, power.powered);
    const syncedMaxId = (serverState?.nextId ?? 1) - 1;
    const buildingAt = new Map(city.buildings.map((b) => [b.y * city.width + b.x, b]));
    const g = this.buildG.clear();

    // Desenha em ordem de profundidade (x + y crescente) para a sobreposição isométrica correta.
    for (let d = 0; d <= city.width + city.height - 2; d++) {
      for (let x = Math.max(0, d - city.height + 1); x <= Math.min(d, city.width - 1); x++) {
        const y = d - x;
        const i = y * city.width + x;
        const { sx, sy } = iso(x, y);
        const b = buildingAt.get(i);
        const zone = city.zoneType[i];

        if (b) {
          const def = BUILDINGS[b.type];
          const alpha = b.id > syncedMaxId ? 0.75 : 1;
          if (def.linear || b.type === "onramp") {
            g.fillStyle(def.color, alpha);
            this.diamond(g, sx, sy, 0.98);
            g.fillStyle(0xd8c04a, alpha);
            g.fillRect(sx - 1, sy - 1, 2, 2);
          } else {
            this.box(g, sx, sy, def.color, def.height, alpha);
            const st = status.get(b.id);
            // Alerta: sem estrada (vermelho), sem energia (amarelo) ou faltando trabalhadores (laranja).
            if (st && !st.connected) this.alert(g, sx, sy - def.height, 0xe03030);
            else if (st && !st.powered) this.alert(g, sx, sy - def.height, 0xf5e04a);
            else if (st && st.efficiency < 1) this.alert(g, sx, sy - def.height, 0xf0a030);
          }
        } else if (zone) {
          const zdef = ZONES[ZONE_KINDS[zone - 1]];
          const lvl = city.zoneLevel[i];
          const dense = city.zoneDensity[i] === 1;
          if (lvl === 0) {
            // Lote vazio: terreno tingido com a cor da zona (mais forte se denso).
            g.fillStyle(zdef.color, dense ? 0.55 : 0.35);
            this.diamond(g, sx, sy, 0.9);
            g.lineStyle(1, shade(zdef.color, 0.6), 0.8);
            this.diamondOutline(g, sx, sy, 0.9);
          } else {
            const h = 4 + lvl * (dense ? 7 : 5);
            this.box(g, sx, sy, zdef.color, h, 1, dense ? 0.86 : 0.7);
            // Janelinhas para dar textura de prédio.
            g.fillStyle(0xfff2b0, 0.8);
            for (let k = 0; k < lvl; k++) g.fillRect(sx - 6, sy - 5 - k * (dense ? 7 : 5), 2, 2);
            if (!power.powered[i]) this.alert(g, sx, sy - h, 0xf5e04a);
          }
        }

        if (city.wires[i]) {
          // Poste + cabos até os vizinhos com linha.
          g.fillStyle(0x3a2a1a, 1);
          g.fillRect(sx - 1, sy - 12, 2, 12);
          g.lineStyle(1, 0x1a1a1a, 0.9);
          for (const [dx, dy] of [
            [1, 0],
            [0, 1],
          ] as const) {
            const nx = x + dx;
            const ny = y + dy;
            if (nx < city.width && ny < city.height && city.wires[ny * city.width + nx]) {
              const n = iso(nx, ny);
              g.lineBetween(sx, sy - 11, n.sx, n.sy - 11);
            }
          }
        }
      }
    }

    const o = this.overlayG.clear();
    if (overlay === "power") {
      for (let i = 0; i < power.conductive.length; i++) {
        if (!power.conductive[i]) continue;
        const { sx, sy } = iso(i % city.width, Math.floor(i / city.width));
        o.fillStyle(power.powered[i] ? 0xf5e04a : 0xe03030, 0.45);
        this.diamond(o, sx, sy, 0.95);
      }
    } else if (overlay === "zones") {
      for (let i = 0; i < city.zoneType.length; i++) {
        const z = city.zoneType[i];
        const { sx, sy } = iso(i % city.width, Math.floor(i / city.width));
        o.fillStyle(z ? ZONES[ZONE_KINDS[z - 1]].color : 0x000000, z ? 0.6 : 0.35);
        this.diamond(o, sx, sy, 0.95);
      }
    } else this.drawHeatmap(city, o, overlay);
    this.drawHover();
  }

  private drawHover() {
    const g = this.hoverG.clear();
    const { phase, tool } = useGame.getState();
    const color = phase === "focus" ? 0xff6060 : 0xffffff;
    if (this.areaFrom && this.hover && isAreaTool(tool)) {
      // Prévia do retângulo de zoneamento.
      const [ax, bx] = [Math.min(this.areaFrom.x, this.hover.x), Math.max(this.areaFrom.x, this.hover.x)];
      const [ay, by] = [Math.min(this.areaFrom.y, this.hover.y), Math.max(this.areaFrom.y, this.hover.y)];
      g.fillStyle(color, 0.25);
      g.lineStyle(1, color, 0.9);
      for (let y = ay; y <= by; y++)
        for (let x = ax; x <= bx; x++) {
          const { sx, sy } = iso(x, y);
          this.diamond(g, sx, sy, 0.95);
        }
      return;
    }
    if (!this.hover) return;
    const { sx, sy } = iso(this.hover.x, this.hover.y);
    g.lineStyle(1, color, 0.9);
    this.diamondOutline(g, sx, sy);
  }
}
