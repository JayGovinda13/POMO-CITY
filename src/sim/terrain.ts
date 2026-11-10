// Fase 9 — Terreno e paisagem.
//
// Gerador de mapas (fictícios) com relevo, costa de água salgada, rio, lagos e floresta, a partir
// da seed da cidade e das opções do editor. Também: regras de altitude (rampas, túneis), árvores
// e o custo de terraplanagem, que fica mais barato com foco de Rank alto ("pago com Rank").

import type { BiomeId, CityState, Rank, Terrain } from "./types";
import { rng } from "./world";

export type Relief = "plano" | "colinas" | "montanhoso";
export type WaterStyle = "seco" | "lagos" | "rio" | "rio_lagos";
export type Coast = "nenhuma" | "norte" | "sul" | "leste" | "oeste";

export interface MapOptions {
  relief: Relief;
  water: WaterStyle;
  coast: Coast;
  /** 0 = sem mata, 1 = pouca, 2 = normal, 3 = densa. */
  forest: 0 | 1 | 2 | 3;
  /** Variação: outro mapa com as mesmas opções. */
  variant: number;
}

export const RELIEF_NAMES: Record<Relief, string> = { plano: "Plano", colinas: "Colinas", montanhoso: "Montanhoso" };
export const WATER_NAMES: Record<WaterStyle, string> = { seco: "Sem água doce", lagos: "Lagos", rio: "Rio", rio_lagos: "Rio e lagos" };
export const COAST_NAMES: Record<Coast, string> = { nenhuma: "Sem mar", norte: "Mar ao norte", sul: "Mar ao sul", leste: "Mar a leste", oeste: "Mar a oeste" };
export const FOREST_NAMES = ["Sem mata", "Pouca mata", "Mata", "Floresta densa"] as const;

/** Altitude máxima (níveis de terreno). */
export const MAX_ELEVATION = 3;
/** Água: 1 = doce (rio, lago), 2 = salgada (mar). */
export const FRESH: Terrain = 1;
export const SEA: Terrain = 2;
export const isWater = (t: number) => t === 1 || t === 2;

/** Densidade base de árvores por bioma (a mesma da antiga decoração). */
export const TREE_DENSITY: Record<BiomeId, number> = { forest: 0.32, plains: 0.07, desert: 0.08, tundra: 0.14, mountains: 0.2 };

/** Opções padrão do editor, pelo bioma e pela chuva da região. */
export function defaultMapOptions(biome: BiomeId, wetness = 0.5): MapOptions {
  return {
    relief: biome === "mountains" ? "montanhoso" : biome === "desert" || biome === "plains" ? "plano" : "colinas",
    water: wetness < 0.2 ? "seco" : wetness > 0.6 ? "rio_lagos" : "lagos",
    coast: "nenhuma",
    forest: biome === "desert" ? 1 : 2,
    variant: 0,
  };
}

/** Hash determinístico por tile (variações de terreno e decoração). */
export function tileHash(seed: number, x: number, y: number) {
  let h = (seed ^ Math.imul(x + 1, 0x27d4eb2d) ^ Math.imul(y + 1, 0x165667b1)) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b) >>> 0;
  return (h ^ (h >>> 13)) >>> 0;
}

export interface GeneratedMap {
  terrain: Terrain[];
  elevation: number[];
  trees: number[];
}

/**
 * Gera o mapa. O centro (prefeitura) é sempre terra plana; o resto segue as opções.
 * `wetness` (0..1) vem da chuva da região e afina o tamanho dos lagos.
 */
export function generateMap(seed: number, size: number, biome: BiomeId, opts: MapOptions, wetness = 0.5): GeneratedMap {
  const r = rng((seed ^ Math.imul(opts.variant + 1, 0x51ed270b)) >>> 0);
  const W = size;
  const n = W * W;
  const c = Math.floor(W / 2);
  const terrain: Terrain[] = new Array(n).fill(0);
  const height = new Float32Array(n);
  const at = (x: number, y: number) => y * W + x;
  const inside = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < W;
  const nearCenter = (x: number, y: number, rad = 4) => Math.max(Math.abs(x - c), Math.abs(y - c)) <= rad;

  // ── Relevo: soma de morros (gaussianas) ──
  const hills = opts.relief === "plano" ? 0 : opts.relief === "colinas" ? 6 + Math.floor(r() * 4) : 9 + Math.floor(r() * 5);
  const peak = opts.relief === "montanhoso" ? 4.2 : 2.4;
  for (let k = 0; k < hills; k++) {
    const hx = r() * W;
    const hy = r() * W;
    const rad = 3 + r() * (W / 6);
    const amp = (0.6 + r() * 0.6) * peak;
    for (let y = 0; y < W; y++)
      for (let x = 0; x < W; x++) {
        const d2 = (x - hx) ** 2 + (y - hy) ** 2;
        height[at(x, y)] += amp * Math.exp(-d2 / (2 * rad * rad));
      }
  }

  // ── Mar: faixa ondulada num dos lados ──
  if (opts.coast !== "nenhuma") {
    const depth = Math.round(W * 0.12) + Math.floor(r() * 3);
    const phase = r() * 6.28;
    for (let y = 0; y < W; y++)
      for (let x = 0; x < W; x++) {
        const along = opts.coast === "norte" || opts.coast === "sul" ? x : y;
        const from = opts.coast === "norte" ? y : opts.coast === "sul" ? W - 1 - y : opts.coast === "oeste" ? x : W - 1 - x;
        const edge = depth + Math.round(2 * Math.sin(along * 0.35 + phase) + Math.sin(along * 0.9 + phase * 2));
        if (from < edge && !nearCenter(x, y, 5)) terrain[at(x, y)] = SEA;
        // Litoral baixo.
        else if (from < edge + 4) height[at(x, y)] *= (from - edge) / 4;
      }
  }

  // ── Rio: caminhada de uma borda à oposta, contornando o centro ──
  if (opts.water === "rio" || opts.water === "rio_lagos") {
    const vertical = r() < 0.5;
    let p = Math.floor(W * (0.2 + r() * 0.2)) * (r() < 0.5 ? 1 : -1) + c;
    p = Math.max(2, Math.min(W - 3, p));
    for (let t = 0; t < W; t++) {
      p += Math.floor(r() * 3) - 1;
      p = Math.max(1, Math.min(W - 2, p));
      for (let w = 0; w < 2; w++) {
        const x = vertical ? p + w : t;
        const y = vertical ? t : p + w;
        if (!inside(x, y) || nearCenter(x, y, 4)) continue;
        if (terrain[at(x, y)] === 0) terrain[at(x, y)] = FRESH;
      }
    }
  }

  // ── Lagos ──
  if (opts.water === "lagos" || opts.water === "rio_lagos") {
    const lakes = 2 + Math.round(wetness * 3) + Math.floor(r() * 2);
    for (let l = 0; l < lakes; l++) {
      const lx = Math.floor(r() * W);
      const ly = Math.floor(r() * W);
      const rad = 1.5 + r() * (1.5 + wetness * 2.5);
      for (let y = 0; y < W; y++)
        for (let x = 0; x < W; x++) {
          if (Math.hypot(x - lx, y - ly) <= rad && !nearCenter(x, y, 5) && terrain[at(x, y)] === 0) terrain[at(x, y)] = FRESH;
        }
    }
  }

  // ── Altitude inteira; água no nível 0; centro plano ──
  const elevation = new Array<number>(n).fill(0);
  for (let i = 0; i < n; i++) {
    const x = i % W;
    const y = Math.floor(i / W);
    if (isWater(terrain[i]) || nearCenter(x, y, 3)) continue;
    elevation[i] = Math.max(0, Math.min(MAX_ELEVATION, Math.floor(height[i])));
  }
  // Suaviza: nas colinas, vizinhos diferem no máximo 1 nível (sempre há rampa). No montanhoso,
  // só perto da água e do centro; o resto pode ter penhascos (pedem túnel).
  for (let pass = 0; pass < MAX_ELEVATION + 1; pass++) {
    for (let i = 0; i < n; i++) {
      const x = i % W;
      const y = Math.floor(i / W);
      const strict = opts.relief !== "montanhoso" || nearCenter(x, y, 6);
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        const nx = x + dx;
        const ny = y + dy;
        if (!inside(nx, ny)) continue;
        const j = at(nx, ny);
        const lim = isWater(terrain[j]) ? 1 : strict ? 1 : 2;
        if (elevation[i] > elevation[j] + lim) elevation[i] = elevation[j] + lim;
      }
    }
  }

  // ── Árvores em manchas (mais no alto e longe da água salgada) ──
  const density = TREE_DENSITY[biome] * [0, 0.5, 1, 2][opts.forest];
  const trees = new Array<number>(n).fill(0);
  if (density > 0) {
    const blobs = Array.from({ length: 6 + Math.floor(r() * 6) }, () => ({ x: r() * W, y: r() * W, rad: 3 + r() * 6 }));
    for (let i = 0; i < n; i++) {
      const x = i % W;
      const y = Math.floor(i / W);
      if (isWater(terrain[i]) || nearCenter(x, y, 3)) continue;
      const inBlob = blobs.some((b) => Math.hypot(x - b.x, y - b.y) < b.rad);
      // Bosques em manchas, com clareiras: nunca mais que ~55% dos tiles.
      const p = Math.min(0.55, density * (inBlob ? 1.6 : 0.35) * (1 + elevation[i] * 0.15));
      if ((tileHash(seed + opts.variant, x, y) % 1000) / 1000 < p) trees[i] = 1;
    }
  }

  return { terrain, elevation, trees };
}

/** Árvores das cidades antigas: as mesmas da decoração que o jogo já desenhava (migração v10). */
export function legacyTrees(s: Pick<CityState, "seed" | "width" | "height" | "terrain" | "biome">): number[] {
  const out = new Array<number>(s.width * s.height).fill(0);
  for (let y = 0; y < s.height; y++)
    for (let x = 0; x < s.width; x++) {
      const i = y * s.width + x;
      if (s.terrain[i] !== 0) continue;
      if ((tileHash(s.seed, x, y) % 1000) / 1000 < TREE_DENSITY[s.biome]) out[i] = 1;
    }
  return out;
}

// ───────────────────────── regras de altitude ─────────────────────────

/** Diferença de altitude que uma via vence com rampa (sem túnel). */
export const RAMP_MAX = 1;

/** Duas vias vizinhas se ligam? Rampa até 1 nível; túnel liga qualquer desnível. */
export function viaLinks(s: Pick<CityState, "elevation" | "buildings" | "width">, i: number, j: number, tunnelAt?: (k: number) => boolean): boolean {
  const e = s.elevation;
  if (!e) return true;
  if (Math.abs((e[i] ?? 0) - (e[j] ?? 0)) <= RAMP_MAX) return true;
  return tunnelAt ? tunnelAt(i) || tunnelAt(j) : false;
}

// ───────────────────────── terraplanagem ─────────────────────────

export type TerraformAction = "raise" | "lower" | "water" | "land" | "tree";

export const TERRAFORM: Record<TerraformAction, { name: string; cost: number; description: string; wood?: number }> = {
  raise: { name: "Elevar terreno", cost: 40, description: "Sobe o tile um nível (até 3). Morros valorizam a vista." },
  lower: { name: "Rebaixar terreno", cost: 40, description: "Desce o tile um nível." },
  water: { name: "Criar água", cost: 300, description: "Cava um lago (o tile precisa estar no nível 0). Caro: fica mais barato com foco de Rank alto." },
  land: { name: "Aterrar", cost: 250, wood: 3, description: "Transforma água doce em terra. Gasta madeira." },
  tree: { name: "Plantar árvore", cost: 5, description: "Árvores valorizam o solo e limpam o ar. Cortar (demolir) rende 1 madeira." },
};

/** Desconto de terraplanagem pelo Rank atual do foco ("pago com Rank"). */
export const RANK_TERRAFORM: Record<Rank, number> = { D: 1, C: 0.9, B: 0.8, A: 0.7, S: 0.6 };
