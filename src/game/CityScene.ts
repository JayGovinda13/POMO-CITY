import Phaser from "phaser";
import { BIOMES, BUILDINGS, ZONE_KINDS, ZONES, buildingStatus, computePower, type CityState } from "@/sim";
import { isAreaTool, useGame } from "@/store/game";
import { bus } from "./bus";

const TW = 32; // largura do tile isométrico
const TH = 16; // altura do tile isométrico
const ZOOMS = [1, 2, 3, 4];
const V = Phaser.Math.Vector2;

const iso = (x: number, y: number) => ({ sx: ((x - y) * TW) / 2, sy: ((x + y) * TH) / 2 });

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
      if (p.rightButtonDown() || p.middleButtonDown()) {
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

    const keys = this.input.keyboard?.addKeys("W,A,S,D,UP,DOWN,LEFT,RIGHT") as
      | Record<string, Phaser.Input.Keyboard.Key>
      | undefined;
    if (keys) {
      this.events.on(Phaser.Scenes.Events.UPDATE, (_t: number, dt: number) => {
        const cam = this.cameras.main;
        const v = (0.4 * dt) / cam.zoom;
        if (keys.A.isDown || keys.LEFT.isDown) cam.scrollX -= v;
        if (keys.D.isDown || keys.RIGHT.isDown) cam.scrollX += v;
        if (keys.W.isDown || keys.UP.isDown) cam.scrollY -= v;
        if (keys.S.isDown || keys.DOWN.isDown) cam.scrollY += v;
      });
    }
  }

  private centerOn(city: CityState) {
    const { sx, sy } = iso(city.width / 2, city.height / 2);
    this.cameras.main.centerOn(sx, sy);
  }

  private tileAt(p: Phaser.Input.Pointer): Tile | null {
    const city = useGame.getState().city;
    if (!city) return null;
    const w = this.cameras.main.getWorldPoint(p.x, p.y);
    const fx = (w.x / (TW / 2) + w.y / (TH / 2)) / 2;
    const fy = (w.y / (TH / 2) - w.x / (TW / 2)) / 2;
    const x = Math.floor(fx + 0.5);
    const y = Math.floor(fy + 0.5);
    if (x < 0 || y < 0 || x >= city.width || y >= city.height) return null;
    return { x, y };
  }

  private paintAt(p: Phaser.Input.Pointer) {
    const t = this.tileAt(p);
    if (!t) return;
    // Estrada, linha e demolição podem ser "pintadas" arrastando; o resto é um clique.
    const tool = useGame.getState().tool;
    const paintable = tool === "road" || tool === "wire" || tool === "demolish";
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

  /** Terreno: desenhado uma vez numa RenderTexture (refeito só se o mapa mudar). */
  private drawTerrain(city: CityState) {
    const key = `${city.seed}:${city.biome}:${city.terrain.join("")}`;
    if (key === this.lastTerrainKey) return;
    this.lastTerrainKey = key;
    this.terrainRT?.destroy();
    const minX = -city.height * (TW / 2);
    const width = (city.width + city.height) * (TW / 2);
    const height = (city.width + city.height) * (TH / 2);
    const rt = this.add.renderTexture(minX, -TH / 2, width, height).setOrigin(0, 0).setDepth(0);
    for (let y = 0; y < city.height; y++)
      for (let x = 0; x < city.width; x++) {
        const { sx, sy } = iso(x, y);
        const v = tileHash(city.seed, x, y) & 1;
        const water = city.terrain[y * city.width + x] === 1;
        const name = (water ? this.frame(`water_${v}`) : this.frame(`ground_${city.biome}_${v}`)) ?? "ground_plains_0";
        rt.drawFrame("city", name, sx - TW / 2 - minX, sy - TH / 2 + TH / 2);
      }
    this.terrainRT = rt;
  }

  private redrawSprites(city: CityState) {
    const { serverState } = useGame.getState();
    this.drawTerrain(city);

    const power = computePower(city);
    const status = buildingStatus(city, power.powered);
    const syncedMaxId = (serverState?.nextId ?? 1) - 1;
    const buildingAt = new Map(city.buildings.map((b) => [b.y * city.width + b.x, b]));
    const isRoad = (x: number, y: number) =>
      x >= 0 && y >= 0 && x < city.width && y < city.height && buildingAt.get(y * city.width + x)?.type === "road";

    this.flatLayer.removeAll(true);
    this.spriteLayer.removeAll(true);
    const lots = this.lotG.clear();
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
    const decorDensity: Record<string, number> = { forest: 0.32, plains: 0.07, desert: 0.08, tundra: 0.14, mountains: 0.2 };

    // Ordem de profundidade: diagonais (x + y) crescentes.
    for (let d = 0; d <= city.width + city.height - 2; d++) {
      for (let x = Math.max(0, d - city.height + 1); x <= Math.min(d, city.width - 1); x++) {
        const y = d - x;
        const i = y * city.width + x;
        const { sx, sy } = iso(x, y);
        const b = buildingAt.get(i);
        const zone = city.zoneType[i];
        const baseY = sy + TH / 2 + 1; // vértice inferior do tile + 1 px do contorno

        if (b?.type === "road") {
          const mask = (isRoad(x - 1, y) ? 1 : 0) | (isRoad(x, y - 1) ? 2 : 0) | (isRoad(x + 1, y) ? 4 : 0) | (isRoad(x, y + 1) ? 8 : 0);
          const img = this.add.image(sx, sy, "city", `road_${mask}`).setAlpha(b.id > syncedMaxId ? 0.75 : 1);
          this.flatLayer.add(img);
        } else if (b) {
          const name = this.frame(b.type) ?? "farm";
          const img = this.add.image(sx, baseY, "city", name).setOrigin(0.5, 1).setAlpha(b.id > syncedMaxId ? 0.75 : 1);
          this.spriteLayer.add(img);
          castShadow(sx, sy, img.height - TH);
          const st = status.get(b.id);
          const top = baseY - img.height;
          if (st && !st.connected) this.alert(fx, sx, top, 0xe03030);
          else if (st && !st.powered) this.alert(fx, sx, top, 0xf5e04a);
          else if (st && st.efficiency < 1) this.alert(fx, sx, top, 0xf0a030);
        } else if (zone) {
          const kind = ZONE_KINDS[zone - 1];
          const lvl = city.zoneLevel[i];
          const dense = city.zoneDensity[i] === 1;
          if (lvl === 0) {
            // Lote vazio: terreno tingido com a cor da zona (mais forte se denso).
            const color = ZONES[kind].color;
            lots.fillStyle(color, dense ? 0.5 : 0.32);
            this.diamond(lots, sx, sy, 0.9);
            lots.lineStyle(1, shade(color, 0.6), 0.85);
            this.diamondOutline(lots, sx, sy, 0.9);
          } else {
            const name = this.frame(`zone_${kind}_${dense ? "D" : "L"}${lvl}`) ?? `zone_${kind}_L1`;
            const img = this.add.image(sx, baseY, "city", name).setOrigin(0.5, 1);
            this.spriteLayer.add(img);
            castShadow(sx, sy, img.height - TH);
            if (!power.powered[i]) this.alert(fx, sx, baseY - img.height, 0xf5e04a);
          }
        } else if (city.terrain[i] === 0 && !city.wires[i]) {
          // Vegetação decorativa em terreno livre (determinística; some quando o tile é usado).
          const h = tileHash(city.seed ^ 0x9e37, x, y);
          if ((h % 1000) / 1000 < (decorDensity[city.biome] ?? 0.1)) {
            const name = this.frame(`decor_${city.biome}_${(h >> 10) & 1}`);
            if (name) {
              this.spriteLayer.add(this.add.image(sx, baseY, "city", name).setOrigin(0.5, 1));
              castShadow(sx, sy, 12, 0.5);
            }
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
    if (overlay === "power") {
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
          const water = city.terrain[y * city.width + x] === 1;
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
          if (b.type === "road") {
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
    }
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
