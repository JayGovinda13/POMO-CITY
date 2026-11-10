import { BIOMES } from "./catalog";
import { CYCLES_PER_YEAR, DEFAULT_POLICIES, LEGACY_MAP_SIZE, ROAD_ACCESS_DISTANCE, START_YEAR, STARTING_INVENTORY, STARTING_MONEY, START_EQ, START_LIFE } from "./config";
import { bfsDistances } from "./grid";
import { generateMap, isWater, legacyTrees, viaLinks, type MapOptions } from "./terrain";
import { CURRENT_SCHEMA_VERSION, type BiomeId, type Building, type CityState, type Terrain } from "./types";

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

// ── Calendário: 1 ciclo concluído = 1 estação (trimestre); 4 ciclos = 1 ano ──
// O nome da estação depende do hemisfério da cidade, definido na escolha de localização
// (ver docs/ROADMAP.md, Fase 2). Até lá, o calendário mostra os meses do trimestre.

export const QUARTER_MONTHS = ["Jan–Mar", "Abr–Jun", "Jul–Set", "Out–Dez"] as const;

/** Ano em que a cidade está no ciclo de índice `cycle` (0 = primeiro trimestre de 1900). */
export const yearOfCycle = (cycle: number) => START_YEAR + Math.floor(cycle / CYCLES_PER_YEAR);
/** Trimestre (0..3) do ciclo de índice `cycle`. */
export const quarterOfCycle = (cycle: number) => ((cycle % CYCLES_PER_YEAR) + CYCLES_PER_YEAR) % CYCLES_PER_YEAR;
export const periodLabel = (cycle: number) => `${QUARTER_MONTHS[quarterOfCycle(cycle)]} ${yearOfCycle(cycle)}`;

type CalendarState = Pick<CityState, "cyclesCompleted"> & Partial<Pick<CityState, "calendarOffset">>;
/** Índice do calendário: ciclos concluídos + trimestre em que a cidade foi fundada. */
export const calendarIdx = (s: CalendarState) => s.cyclesCompleted + (s.calendarOffset ?? 0);
/** Ano atual da cidade (o trimestre que o próximo ciclo de foco vai viver). */
export const cityYear = (s: CalendarState) => yearOfCycle(calendarIdx(s));
export const cityQuarter = (s: CalendarState) => quarterOfCycle(calendarIdx(s));
export const cityPeriodLabel = (s: CalendarState) => periodLabel(calendarIdx(s));

/**
 * Cria uma cidade nova. `wetness` (0..1) vem do clima da região: regiões chuvosas
 * geram mais lagos; áridas, menos. O mapa é sempre fictício.
 * - `map`: opções do editor (Fase 9) — relevo, rio, lagos, mar e floresta.
 * - `size`: lado do mapa (40 nas cidades fundadas; 24 na cidade provisória e nos testes).
 * Sem `map`, gera o mapa clássico (só lagos, plano) usado antes da Fase 9.
 */
export function createCity(
  seed: number,
  now: number,
  biome?: BiomeId,
  opts: { wetness?: number; map?: MapOptions; size?: number } = {},
): CityState {
  const rand = rng(seed);
  const biomes = Object.keys(BIOMES) as BiomeId[];
  const chosen = biome ?? biomes[Math.floor(rand() * biomes.length)];
  const width = opts.size ?? LEGACY_MAP_SIZE;
  const height = width;
  let terrain: Terrain[] = new Array(width * height).fill(0);
  let elevation: number[] = new Array(width * height).fill(0);
  let trees: number[] | null = null;
  const cx = Math.floor(width / 2);
  const cy = Math.floor(height / 2);

  if (opts.map) {
    const m = generateMap(seed, width, chosen, opts.map, opts.wetness ?? 0.5);
    terrain = m.terrain;
    elevation = m.elevation;
    trees = m.trees;
  } else {
    // Mapa clássico: alguns lagos circulares, longe do centro.
    const wet = opts.wetness;
    const lakes = wet === undefined ? 2 + Math.floor(rand() * 3) : Math.round(wet * 4) + Math.floor(rand() * 2);
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
  }
  trees ??= legacyTrees({ seed, width, height, terrain, biome: chosen });

  const cityhall: Building = { id: 1, type: "cityhall", x: cx, y: cy };
  const n = width * height;
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    version: 1,
    seed,
    biome: chosen,
    regionId: null,
    calendarOffset: 0,
    width,
    height,
    terrain,
    elevation,
    trees,
    buildings: [cityhall],
    nextId: 2,
    zoneType: new Array(n).fill(0),
    zoneDensity: new Array(n).fill(0),
    zoneLevel: new Array(n).fill(0),
    wires: new Array(n).fill(0),
    pipes: new Array(n).fill(0),
    money: STARTING_MONEY,
    population: 0,
    citizens: [],
    nextCitizenId: 1,
    lastDisasterCycle: null,
    inventory: { ...STARTING_INVENTORY },
    policies: structuredClone(DEFAULT_POLICIES),
    taxes: { R: 9, C: 9, I: 9 },
    funding: { transport: 100, energy: 100, police: 100, fire: 100, health: 100, education: 100 },
    eq: START_EQ,
    lifeExpectancy: START_LIFE,
    bonds: [],
    nextBondId: 1,
    ordinances: {},
    difficulty: "medio",
    insurance: { plan: "none", since: 0, bonusMalus: 1, lastClaimCycle: null },
    breaks: 0,
    streak: 0,
    streakFrozen: false,
    disasterCount: 0,
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
  // Rodovias e acessos (Fase 8) levam a malha a outros bairros; só estrada e acesso dão acesso a lotes.
  const highway = new Set<number>();
  const ramps = new Set<number>();
  const tunnels = new Set<number>();
  // Estradas danificadas (conservação abaixo de 30, por falta de verba) não conectam.
  for (const b of s.buildings) {
    if (b.type === "road" && (b.condition ?? 100) >= 30) roads.add(idx(s, b.x, b.y));
    else if (b.type === "tunnel") {
      roads.add(idx(s, b.x, b.y));
      tunnels.add(idx(s, b.x, b.y));
    }
    else if (b.type === "onramp") {
      roads.add(idx(s, b.x, b.y));
      ramps.add(idx(s, b.x, b.y));
    } else if (b.type === "highway") highway.add(idx(s, b.x, b.y));
  }
  const hall = s.buildings.find((b) => b.type === "cityhall");
  const seen = new Set<number>();
  if (!hall) return seen;
  const queue: number[] = [];
  for (const [dx, dy] of DIRS) {
    const x = hall.x + dx;
    const y = hall.y + dy;
    if (inBounds(s, x, y) && roads.has(idx(s, x, y)) && viaLinks(s, idx(s, hall.x, hall.y), idx(s, x, y), (k) => tunnels.has(k)))
      queue.push(idx(s, x, y));
  }
  const viaHighway = new Set<number>();
  while (queue.length) {
    const i = queue.pop()!;
    if (seen.has(i) || viaHighway.has(i)) continue;
    const onHighway = highway.has(i);
    if (onHighway) viaHighway.add(i);
    else seen.add(i);
    const x = i % s.width;
    const y = Math.floor(i / s.width);
    for (const [dx, dy] of DIRS) {
      const nx = x + dx;
      const ny = y + dy;
      if (!inBounds(s, nx, ny)) continue;
      const ni = idx(s, nx, ny);
      if (seen.has(ni) || viaHighway.has(ni)) continue;
      // Altitude (Fase 9): rampa vence 1 nível; mais que isso, só por túnel.
      if (!viaLinks(s, i, ni, (k) => tunnels.has(k))) continue;
      // Estrada ↔ estrada/acesso; acesso ↔ rodovia; rodovia ↔ rodovia/acesso.
      if (onHighway ? highway.has(ni) || ramps.has(ni) : roads.has(ni) || (ramps.has(i) && highway.has(ni))) queue.push(ni);
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

/**
 * Distância de cada tile até a malha viária ligada à prefeitura (por terra), limitada a
 * ROAD_ACCESS_DISTANCE. Regra clássica: só se constrói perto de um sistema de transporte.
 */
export function roadAccess(s: CityState, network = connectedRoads(s)): Int32Array {
  return bfsDistances(s, network, (i) => !isWater(s.terrain[i]), ROAD_ACCESS_DISTANCE).dist;
}
