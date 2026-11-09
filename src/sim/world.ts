import { BIOMES } from "./catalog";
import { MAP_SIZE, STARTING_MONEY } from "./config";
import type { BiomeId, Building, CityState, Terrain } from "./types";

/** PRNG determinístico (mulberry32). */
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const idx = (s: Pick<CityState, "width">, x: number, y: number) => y * s.width + x;
export const inBounds = (s: Pick<CityState, "width" | "height">, x: number, y: number) =>
  x >= 0 && y >= 0 && x < s.width && y < s.height;

export const utcDayKey = (ms: number) => new Date(ms).toISOString().slice(0, 10);

export function createCity(seed: number, now: number, biome?: BiomeId): CityState {
  const rand = rng(seed);
  const biomes = Object.keys(BIOMES) as BiomeId[];
  const chosen = biome ?? biomes[Math.floor(rand() * biomes.length)];
  const width = MAP_SIZE;
  const height = MAP_SIZE;
  const terrain: Terrain[] = new Array(width * height).fill(0);

  // Alguns lagos circulares, longe do centro.
  const cx = Math.floor(width / 2);
  const cy = Math.floor(height / 2);
  const lakes = 2 + Math.floor(rand() * 3);
  for (let l = 0; l < lakes; l++) {
    const lx = Math.floor(rand() * width);
    const ly = Math.floor(rand() * height);
    const r = 1.5 + rand() * 2.5;
    for (let y = 0; y < height; y++)
      for (let x = 0; x < width; x++) {
        const d = Math.hypot(x - lx, y - ly);
        const nearCenter = Math.abs(x - cx) <= 3 && Math.abs(y - cy) <= 3;
        if (d <= r && !nearCenter) terrain[y * width + x] = 1;
      }
  }

  const cityhall: Building = { id: 1, type: "cityhall", x: cx, y: cy };
  return {
    version: 1,
    seed,
    biome: chosen,
    width,
    height,
    terrain,
    buildings: [cityhall],
    nextId: 2,
    money: STARTING_MONEY,
    population: 0,
    inventory: { "food:C": 40 },
    streak: 0,
    cyclesCompleted: 0,
    lastCycleAt: null,
    dayKey: utcDayKey(now),
    cyclesToday: 0,
  };
}

export function buildingAt(s: CityState, x: number, y: number): Building | undefined {
  return s.buildings.find((b) => b.x === x && b.y === y);
}

const DIRS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
] as const;

/**
 * Tiles de estrada alcançáveis a partir das estradas que tocam a prefeitura (BFS).
 * Regra clássica: só produz quem está ligado à malha viária da cidade.
 */
export function connectedRoads(s: CityState): Set<number> {
  const roads = new Set<number>();
  for (const b of s.buildings) if (b.type === "road") roads.add(idx(s, b.x, b.y));
  const hall = s.buildings.find((b) => b.type === "cityhall");
  const seen = new Set<number>();
  if (!hall) return seen;
  const queue: number[] = [];
  for (const [dx, dy] of DIRS) {
    const x = hall.x + dx;
    const y = hall.y + dy;
    if (inBounds(s, x, y) && roads.has(idx(s, x, y))) queue.push(idx(s, x, y));
  }
  while (queue.length) {
    const i = queue.pop()!;
    if (seen.has(i)) continue;
    seen.add(i);
    const x = i % s.width;
    const y = Math.floor(i / s.width);
    for (const [dx, dy] of DIRS) {
      const nx = x + dx;
      const ny = y + dy;
      if (!inBounds(s, nx, ny)) continue;
      const ni = idx(s, nx, ny);
      if (roads.has(ni) && !seen.has(ni)) queue.push(ni);
    }
  }
  return seen;
}

export function isRoadConnected(s: CityState, b: Building, network = connectedRoads(s)): boolean {
  for (const [dx, dy] of DIRS) {
    const x = b.x + dx;
    const y = b.y + dy;
    if (inBounds(s, x, y) && network.has(idx(s, x, y))) return true;
  }
  return false;
}
