import Phaser from "phaser";
import { BIOMES, BUILDINGS, buildingStatus, type CityState } from "@/sim";
import { useGame } from "@/store/game";
import { bus } from "./bus";

const TW = 32; // largura do tile isométrico
const TH = 16; // altura do tile isométrico
const ZOOMS = [1, 2, 3, 4];

const iso = (x: number, y: number) => ({ sx: ((x - y) * TW) / 2, sy: ((x + y) * TH) / 2 });

function shade(color: number, f: number) {
  const r = Math.min(255, Math.round(((color >> 16) & 0xff) * f));
  const g = Math.min(255, Math.round(((color >> 8) & 0xff) * f));
  const b = Math.min(255, Math.round((color & 0xff) * f));
  return (r << 16) | (g << 8) | b;
}

/** Motor gráfico: apenas renderiza o estado do Zustand e traduz cliques em tiles. */
export class CityScene extends Phaser.Scene {
  private terrainG!: Phaser.GameObjects.Graphics;
  private buildG!: Phaser.GameObjects.Graphics;
  private hoverG!: Phaser.GameObjects.Graphics;
  private zoomIdx = 1;
  private lastTerrainKey = "";
  private hover: { x: number; y: number } | null = null;
  private painting = false;
  private painted = new Set<string>();
  private panFrom: { x: number; y: number; sx: number; sy: number } | null = null;
  private unsubscribe?: () => void;

  constructor() {
    super("city");
  }

  create() {
    this.terrainG = this.add.graphics();
    this.buildG = this.add.graphics();
    this.hoverG = this.add.graphics();
    this.cameras.main.setBackgroundColor("#1b1f3a");
    this.cameras.main.setZoom(ZOOMS[this.zoomIdx]);
    this.input.mouse?.disableContextMenu();

    const city = useGame.getState().city;
    if (city) this.centerOn(city);
    this.redraw();
    this.unsubscribe = useGame.subscribe((s, prev) => {
      if (s.city !== prev.city || s.tool !== prev.tool || s.phase !== prev.phase) {
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
      this.painting = true;
      this.painted.clear();
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
      this.painting = false;
      this.panFrom = null;
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

  private tileAt(p: Phaser.Input.Pointer) {
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
    const k = `${t.x},${t.y}`;
    if (this.painted.has(k)) return;
    // Só estrada e demolição podem ser "pintadas" arrastando; o resto é um clique.
    const tool = useGame.getState().tool;
    if (this.painted.size > 0 && tool !== "road" && tool !== "demolish") return;
    this.painted.add(k);
    bus.emit("tile:click", t);
  }

  private diamond(g: Phaser.GameObjects.Graphics, sx: number, sy: number, s = 1, lift = 0) {
    const w = (TW / 2) * s;
    const h = (TH / 2) * s;
    g.fillPoints(
      [
        new Phaser.Math.Vector2(sx, sy - h - lift),
        new Phaser.Math.Vector2(sx + w, sy - lift),
        new Phaser.Math.Vector2(sx, sy + h - lift),
        new Phaser.Math.Vector2(sx - w, sy - lift),
      ],
      true,
    );
  }

  private box(g: Phaser.GameObjects.Graphics, sx: number, sy: number, color: number, height: number, alpha: number) {
    const s = 0.78;
    const w = (TW / 2) * s;
    const h = (TH / 2) * s;
    const V = Phaser.Math.Vector2;
    g.fillStyle(shade(color, 0.7), alpha);
    g.fillPoints([new V(sx - w, sy), new V(sx, sy + h), new V(sx, sy + h - height), new V(sx - w, sy - height)], true);
    g.fillStyle(shade(color, 0.5), alpha);
    g.fillPoints([new V(sx, sy + h), new V(sx + w, sy), new V(sx + w, sy - height), new V(sx, sy + h - height)], true);
    g.fillStyle(color, alpha);
    this.diamond(g, sx, sy, s, height);
  }

  private redraw() {
    const { city, serverState } = useGame.getState();
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

    const status = buildingStatus(city);
    const syncedMaxId = (serverState?.nextId ?? 1) - 1;
    const g = this.buildG.clear();
    const sorted = [...city.buildings].sort((a, b) => a.x + a.y - (b.x + b.y) || a.x - b.x);
    for (const b of sorted) {
      const def = BUILDINGS[b.type];
      const { sx, sy } = iso(b.x, b.y);
      const pendingSync = b.id > syncedMaxId;
      const alpha = pendingSync ? 0.75 : 1;
      if (b.type === "road") {
        g.fillStyle(def.color, alpha);
        this.diamond(g, sx, sy, 0.98);
        g.fillStyle(0xd8c04a, alpha);
        g.fillRect(sx - 1, sy - 1, 2, 2);
        continue;
      }
      this.box(g, sx, sy, def.color, def.height, alpha);
      const st = status.get(b.id);
      if (st && st.efficiency < 1) {
        // Alerta: sem estrada (vermelho) ou faltando trabalhadores (laranja).
        g.fillStyle(st.connected ? 0xf0a030 : 0xe03030, 1);
        g.fillRect(sx - 2, sy - def.height - 12, 4, 6);
        g.fillRect(sx - 2, sy - def.height - 4, 4, 2);
      }
    }
    this.drawHover();
  }

  private drawHover() {
    const g = this.hoverG.clear();
    if (!this.hover) return;
    const { phase } = useGame.getState();
    const { sx, sy } = iso(this.hover.x, this.hover.y);
    g.lineStyle(1, phase === "focus" ? 0xff6060 : 0xffffff, 0.9);
    const w = TW / 2;
    const h = TH / 2;
    g.strokePoints(
      [
        new Phaser.Math.Vector2(sx, sy - h),
        new Phaser.Math.Vector2(sx + w, sy),
        new Phaser.Math.Vector2(sx, sy + h),
        new Phaser.Math.Vector2(sx - w, sy),
      ],
      true,
    );
  }
}
