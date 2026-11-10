// Fase 8 — Transporte e trânsito.
//
// Geração de viagens simplificada (no espírito dos city-builders clássicos): cada lote
// residencial desenvolvido procura o emprego mais perto (comércio, indústria ou construção com
// vagas) pela malha de transporte, dentro de um tempo-limite. O caminho mais curto (Dijkstra)
// soma carga em cada via; via acima da capacidade fica congestionada.
//
// Custo de cada passo: estrada 1, acesso 1, rodovia 1/3 (viagens 3× mais longas), estação 1,
// trilho 1/4. Transições: estrada↔estrada/acesso/estação, acesso↔rodovia, estação↔trilho.
// Rodovia não liga direto na estrada: só pelos acessos.

import { BUILDINGS } from "./catalog";
import { ROAD_ACCESS_DISTANCE } from "./config";
import { ZONE, type Building, type CityState } from "./types";
import { viaLinks } from "./terrain";

/** Tempo-limite da viagem (em "quadras de estrada"). */
export const MAX_TRIP = 14;
/** Capacidade (viagens por ciclo) de cada tile de via. */
export const CAPACITY = { road: 10, onramp: 10, highway: 20 } as const;
/** Raio de atendimento do ponto de ônibus e alcance do frete das estações. */
export const BUS_RADIUS = 4;
export const FREIGHT_RADIUS = 5;
/** Fração das viagens de ônibus que sai das ruas. */
export const BUS_SHARE = 0.6;
/** A partir desta população, quem não acha emprego por perto não cresce. */
export const TRIP_LIMIT_POPULATION = 60;

type Node = "road" | "onramp" | "highway" | "rail" | "station";
const COST: Record<Node, number> = { road: 1, onramp: 1, highway: 1 / 3, rail: 1 / 4, station: 1 };
const LINKS: Record<Node, Node[]> = {
  road: ["road", "onramp", "station"],
  onramp: ["road", "onramp", "highway"],
  highway: ["highway", "onramp"],
  rail: ["rail", "station"],
  station: ["road", "station", "rail"],
};

export interface TrafficResult {
  /** Viagens por tile de via (estrada, acesso, rodovia). */
  load: Float32Array;
  /** Capacidade por tile (0 = não é via de carros). */
  capacity: Float32Array;
  /** 1 = congestionado. */
  congested: Uint8Array;
  /** 1 = lote residencial cujos moradores não acham emprego dentro do tempo-limite. */
  failed: Uint8Array;
  /** 1 = tile perto de transporte público (ponto de ônibus em par ou estação). */
  transit: Uint8Array;
  trips: number;
  failedTrips: number;
  busRiders: number;
  railRiders: number;
  /** Tempo médio de viagem. */
  avgCommute: number;
  congestedTiles: number;
  /** Fração das vias com carros que está congestionada (0..1). */
  congestionShare: number;
  /** Fração dos lotes residenciais sem destino (0..1), só conta com população ≥ 60. */
  failedShare: number;
  /** Fração dos níveis industriais perto de uma estação (frete). */
  freightShare: number;
}

/** Fila de prioridade mínima simples (heap binário). */
class Heap {
  private k: number[] = [];
  private v: number[] = [];
  get size() {
    return this.k.length;
  }
  push(key: number, val: number) {
    const k = this.k;
    const v = this.v;
    let i = k.length;
    k.push(key);
    v.push(val);
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (k[p] <= key) break;
      k[i] = k[p];
      v[i] = v[p];
      i = p;
    }
    k[i] = key;
    v[i] = val;
  }
  pop(): [number, number] {
    const k = this.k;
    const v = this.v;
    const top: [number, number] = [k[0], v[0]];
    const lk = k.pop()!;
    const lv = v.pop()!;
    if (k.length) {
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        if (l >= k.length) break;
        const c = l + 1 < k.length && k[l + 1] < k[l] ? l + 1 : l;
        if (k[c] >= lk) break;
        k[i] = k[c];
        v[i] = v[c];
        i = c;
      }
      k[i] = lk;
      v[i] = lv;
    }
    return top;
  }
}

/** Tipo de nó de transporte em cada tile (null = não é via). */
export function transportNodes(s: CityState): (Node | null)[] {
  const out: (Node | null)[] = new Array(s.width * s.height).fill(null);
  for (const b of s.buildings) {
    const i = b.y * s.width + b.x;
    if (b.type === "road") out[i] = (b.condition ?? 100) >= 30 ? "road" : null;
    else if (b.type === "tunnel") out[i] = "road";
    else if (b.type === "onramp") out[i] = "onramp";
    else if (b.type === "highway") out[i] = "highway";
    else if (b.type === "rail") out[i] = "rail";
    else if (b.type === "train_station" && !b.damaged) out[i] = "station";
  }
  return out;
}

/** Destino de viagem: construção com vagas (pontos e estações são meio de transporte, não destino). */
const isJobSite = (b: Building) =>
  BUILDINGS[b.type].workers > 0 && !b.damaged && b.type !== "bus_stop" && b.type !== "train_station";

export function computeTraffic(s: CityState): TrafficResult {
  const W = s.width;
  const n = W * s.height;
  const nodes = transportNodes(s);
  const tunnelSet = new Set(s.buildings.filter((b) => b.type === "tunnel").map((b) => b.y * W + b.x));
  const isTunnel = (k: number) => tunnelSet.has(k);
  const load = new Float32Array(n);
  const capacity = new Float32Array(n);
  const congested = new Uint8Array(n);
  const failed = new Uint8Array(n);
  const transit = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const t = nodes[i];
    if (t === "road" || t === "onramp" || t === "highway") capacity[i] = CAPACITY[t];
  }

  // ── Destinos: lotes C/I desenvolvidos e construções com vagas ──
  const jobTile = new Uint8Array(n);
  for (let i = 0; i < n; i++) if ((s.zoneType[i] === ZONE.C || s.zoneType[i] === ZONE.I) && s.zoneLevel[i] > 0) jobTile[i] = 1;
  for (const b of s.buildings) if (isJobSite(b)) jobTile[b.y * W + b.x] = 1;
  // Para cada tile de rua: distância a pé (Chebyshev ≤ 3) até o emprego mais perto.
  const R = ROAD_ACCESS_DISTANCE;
  const destWalk = new Int8Array(n).fill(-1);
  const nearJob = (x: number, y: number, exclude = -1) => {
    let best = -1;
    for (let dy = -R; dy <= R; dy++)
      for (let dx = -R; dx <= R; dx++) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= s.height) continue;
        const j = ny * W + nx;
        if (!jobTile[j] || j === exclude) continue;
        const d = Math.max(Math.abs(dx), Math.abs(dy));
        if (best < 0 || d < best) best = d;
      }
    return best;
  };
  for (let i = 0; i < n; i++) if (nodes[i] === "road" || nodes[i] === "onramp") destWalk[i] = nearJob(i % W, Math.floor(i / W));
  const anyJobs = jobTile.some((v) => v === 1);

  // ── Transporte público ──
  const stops = s.buildings.filter((b) => b.type === "bus_stop" && !b.damaged);
  const busOn = stops.length >= 2;
  const stations = s.buildings.filter((b) => b.type === "train_station" && !b.damaged);
  const near = (list: Building[], x: number, y: number, r: number) => list.some((b) => Math.max(Math.abs(b.x - x), Math.abs(b.y - y)) <= r);
  for (let i = 0; i < n; i++) {
    const x = i % W;
    const y = Math.floor(i / W);
    if ((busOn && near(stops, x, y, BUS_RADIUS)) || near(stations, x, y, BUS_RADIUS)) transit[i] = 1;
  }

  // ── Viagens ──
  const dist = new Float64Array(n);
  const prev = new Int32Array(n);
  let trips = 0;
  let failedTrips = 0;
  let busRiders = 0;
  let railRiders = 0;
  let commuteSum = 0;
  let commuteTrips = 0;
  let resLots = 0;
  let failedLots = 0;

  for (let o = 0; o < n; o++) {
    if (s.zoneType[o] !== ZONE.R || s.zoneLevel[o] <= 0) continue;
    const ox = o % W;
    const oy = Math.floor(o / W);
    const t = s.zoneLevel[o] * (s.zoneDensity[o] ? 2 : 1);
    trips += t;
    resLots++;
    if (!anyJobs) continue;
    // Trabalha a pé: emprego a até 3 tiles da casa.
    const walk = nearJob(ox, oy, o);
    if (walk >= 0) {
      commuteSum += walk * t;
      commuteTrips += t;
      continue;
    }
    // Dijkstra a partir das ruas a até 3 tiles da casa.
    dist.fill(Infinity);
    prev.fill(-1);
    const heap = new Heap();
    for (let dy = -R; dy <= R; dy++)
      for (let dx = -R; dx <= R; dx++) {
        const x = ox + dx;
        const y = oy + dy;
        if (x < 0 || y < 0 || x >= W || y >= s.height) continue;
        const i = y * W + x;
        const node = nodes[i];
        if (node !== "road" && node !== "onramp") continue;
        const d0 = Math.max(Math.abs(dx), Math.abs(dy)) - 1;
        if (d0 < dist[i]) {
          dist[i] = d0;
          heap.push(d0, i);
        }
      }
    let best = Infinity;
    let bestNode = -1;
    while (heap.size) {
      const [d, u] = heap.pop();
      if (d > dist[u] || d >= best || d > MAX_TRIP) continue;
      if (destWalk[u] >= 0 && d + destWalk[u] < best) {
        best = d + destWalk[u];
        bestNode = u;
      }
      const ux = u % W;
      const uy = Math.floor(u / W);
      const from = nodes[u]!;
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ] as const) {
        const x = ux + dx;
        const y = uy + dy;
        if (x < 0 || y < 0 || x >= W || y >= s.height) continue;
        const v = y * W + x;
        const to = nodes[v];
        if (!to || !LINKS[from].includes(to)) continue;
        // Altitude (Fase 9): desnível maior que 1 só por túnel.
        if (!viaLinks(s, u, v, isTunnel)) continue;
        const nd = d + COST[to];
        if (nd < dist[v]) {
          dist[v] = nd;
          prev[v] = u;
          heap.push(nd, v);
        }
      }
    }
    if (bestNode < 0 || best > MAX_TRIP) {
      failedTrips += t;
      failedLots++;
      failed[o] = 1;
      continue;
    }
    commuteSum += best * t;
    commuteTrips += t;
    // Ônibus: casa e destino perto de pontos (há pelo menos um par de pontos).
    const bx = bestNode % W;
    const by = Math.floor(bestNode / W);
    const byBus = busOn && near(stops, ox, oy, BUS_RADIUS) && near(stops, bx, by, BUS_RADIUS);
    const carShare = byBus ? 1 - BUS_SHARE : 1;
    if (byBus) busRiders += t * BUS_SHARE;
    let usedRail = false;
    for (let u = bestNode; u >= 0; u = prev[u]) {
      if (nodes[u] === "rail") usedRail = true;
      else if (capacity[u] > 0) load[u] += t * carShare;
    }
    if (usedRail) railRiders += t;
  }

  let congestedTiles = 0;
  let usedTiles = 0;
  for (let i = 0; i < n; i++) {
    if (!capacity[i]) continue;
    if (load[i] > 0) usedTiles++;
    if (load[i] > capacity[i]) {
      congested[i] = 1;
      congestedTiles++;
    }
  }

  // Frete: níveis industriais a até 5 tiles de uma estação ligada ao trilho.
  let ind = 0;
  let indNear = 0;
  for (let i = 0; i < n; i++) {
    if (s.zoneType[i] !== ZONE.I || s.zoneLevel[i] <= 0) continue;
    ind += s.zoneLevel[i];
    if (near(stations, i % W, Math.floor(i / W), FREIGHT_RADIUS)) indNear += s.zoneLevel[i];
  }

  return {
    load,
    capacity,
    congested,
    failed,
    transit,
    trips,
    failedTrips,
    busRiders: Math.round(busRiders),
    railRiders: Math.round(railRiders),
    avgCommute: commuteTrips ? Math.round((commuteSum / commuteTrips) * 10) / 10 : 0,
    congestedTiles,
    congestionShare: usedTiles ? congestedTiles / usedTiles : 0,
    failedShare: s.population >= TRIP_LIMIT_POPULATION && resLots ? failedLots / resLots : 0,
    freightShare: ind ? indNear / ind : 0,
  };
}

/** Ajuste de demanda pelo transporte: congestionamento e viagens impossíveis derrubam; portos impulsionam. */
export function trafficDemand(s: CityState, t: TrafficResult): { R: number; C: number; I: number } {
  let C = 0;
  let I = 0;
  for (const b of s.buildings) {
    const d = BUILDINGS[b.type].transport?.demand;
    if (!d || b.damaged) continue;
    C += d.C ?? 0;
    I += d.I ?? 0;
  }
  const jam = t.congestionShare * 0.25;
  return { R: -jam - t.failedShare * 0.25, C: C - jam, I };
}
