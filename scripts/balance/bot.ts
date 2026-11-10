// Robô de balanceamento: joga a cidade como um jogador cuidadoso e devolve métricas por ciclo.
// Não faz parte do jogo; serve para medir o equilíbrio (npm run balance).

import {
  BUILDINGS,
  applyCommand,
  applyDisaster,
  abandonCycle,
  computePower,
  computeWater,
  connectedRoads,
  createCity,
  foundCity,
  laborStats,
  resolveCycle,
  stockOf,
  ZONE,
  type BuildingType,
  type CityState,
  type Command,
  type CycleReport,
  type MapOptions,
} from "../../src/sim";
import { computeDemand } from "../../src/sim";
import { resourceOutlook } from "../../src/components/ResourcesButton";

export interface BotOptions {
  region: string;
  difficulty?: "facil" | "medio" | "dificil";
  cycles: number;
  /** Ciclos de foco por dia (o resto do dia é pausa longa: a sequência decai se passar de 90 min). */
  perDay: number;
  /** Probabilidade de abandonar um ciclo (quebra a sequência). */
  breakChance?: number;
  /** Não produzir recursos (só importar): mede o custo de depender do mercado. */
  noProduction?: boolean;
  seed?: number;
  map?: MapOptions;
}

export interface CycleRow {
  cycle: number;
  year: number;
  quarter: number;
  rank: string;
  pop: number;
  housing: number;
  money: number;
  net: number;
  taxes: number;
  upkeep: number;
  imports: number;
  sales: number;
  food: number;
  wood: number;
  planks: number;
  metal: number;
  goods: number;
  powerCap: number;
  powerDemand: number;
  water: string;
  unemployed: number;
  jobs: number;
  approval: number;
  eq: number;
  crime: number;
  pollution: number;
  landValue: number;
  congested: number;
  failedTrips: number;
  builds: string[];
  demand: string;
  starving: boolean;
  brownout: boolean;
  weather: string;
}

const MIN = 60_000;
const T0 = Date.UTC(2026, 0, 5, 8);

function rand(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Estado final da cidade do robô (para depuração). */
export function runBotState(o: BotOptions): CityState {
  let last: CityState | null = null;
  runBot(o, (s) => (last = s));
  return last!;
}

export function runBot(o: BotOptions, onEnd?: (s: CityState) => void): CycleRow[] {
  const r = rand(o.seed ?? 7);
  const map: MapOptions = o.map ?? { relief: "plano", water: "lagos", coast: "nenhuma", forest: 1, variant: 0 };
  const founded = foundCity(createCity(o.seed ?? 7, T0), o.region, T0, o.difficulty ?? "medio", "Robô", map);
  if (!founded.ok) throw new Error(founded.error);
  let s = founded.state;
  const hall = s.buildings[0];
  const cx = hall.x;
  const cy = hall.y;
  const rows: CycleRow[] = [];
  const disasters: number[] = [];

  const tryCmd = (cmd: Command): boolean => {
    const res = applyCommand(s, cmd);
    if (res.ok) s = res.state;
    return res.ok;
  };
  const at = (x: number, y: number) => y * s.width + x;

  // Plano urbano: ruas paralelas (a principal passa pela prefeitura), abertas aos poucos.
  // Residencial a oeste; a leste, comércio ao norte e indústria ao sul. As zonas encostam
  // umas nas outras e na prefeitura (a energia passa pelos lotes); fios nas ruas fazem o resto.
  const road = (x0: number, y0: number, x1: number, y1: number) => {
    const cmds: Command[] = [];
    for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++)
      for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++) if (!(x === cx && y === cy)) cmds.push({ type: "build", building: "road", x, y });
    return cmds;
  };
  const zone = (kind: "R" | "C" | "I", x0: number, y0: number, x1: number, y1: number): Command => ({ type: "zone", zone: kind, dense: false, x0, y0, x1, y1 });
  const ROWS = [0, -3, 3, -6, 6, -9, 9, -12, 12];
  const segments: Command[][] = ROWS.map((o, k) => {
    const L = k < 3 ? 6 : k < 5 ? 10 : 14;
    const y = cy + o;
    const cmds: Command[] = [...road(cx - L, y, cx + L, y)];
    // Ligações verticais nas pontas, até a rua anterior.
    if (o !== 0) {
      const prev = o < 0 ? y + 3 : y - 3;
      cmds.push(...road(cx - L - 1, Math.min(y, prev), cx - L - 1, Math.max(y, prev)));
      cmds.push(...road(cx + L + 1, Math.min(y, prev), cx + L + 1, Math.max(y, prev)));
    }
    const sides = o === 0 ? [-1, 1] : [Math.sign(o)];
    for (const side of sides) {
      const ya = side < 0 ? y - 2 : y + 1;
      const yb = side < 0 ? y - 1 : y + 2;
      cmds.push(zone("R", cx - L, ya, cx - 1, yb));
      cmds.push(zone(side < 0 ? "C" : "I", cx + 1, ya, cx + L, yb));
    }
    // Ruas mais longas: aumenta também as anteriores.
    if (L > 6) {
      cmds.push(...road(cx - L, cy, cx + L, cy));
      cmds.push(zone("R", cx - L, cy - 2, cx - 7, cy - 1), zone("R", cx - L, cy + 1, cx - 7, cy + 2));
      cmds.push(zone("C", cx + 7, cy - 2, cx + L, cy - 1), zone("I", cx + 7, cy + 1, cx + L, cy + 2));
    }
    return cmds;
  });
  let ringsOpened = 0;
  // Tiles reservados para as ruas planejadas: o robô não constrói prédios neles.
  const reserved = new Set<number>();
  for (const seg of segments) for (const c of seg) if (c.type === "build") reserved.add(at(c.x, c.y));
  /** Obras que falharam por falta de dinheiro: o robô tenta de novo nos próximos ciclos. */
  let todo: Command[] = [];
  const attempt = (cmds: Command[], builds: string[]) => {
    const left: Command[] = [];
    for (const cmd of cmds) {
      const res = applyCommand(s, cmd);
      if (res.ok) {
        s = res.state;
        builds.push(cmd.type === "zone" ? `zona ${cmd.zone}` : "via");
      } else if (/Dinheiro/.test(res.error)) left.push(cmd);
    }
    return left;
  };

  /** Lugar livre encostado numa estrada ligada (prefere tile sem zona). */
  const spot = (): { x: number; y: number } | null => {
    const net = connectedRoads(s);
    let best: { x: number; y: number; score: number } | null = null;
    for (const i of net) {
      const x = i % s.width;
      const y = Math.floor(i / s.width);
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= s.width || ny >= s.height) continue;
        const j = at(nx, ny);
        if (reserved.has(j) || s.terrain[j] || s.buildings.some((b) => b.x === nx && b.y === ny) || s.zoneLevel[j] > 0 || s.wires[j]) continue;
        const score = (s.zoneType[j] ? 100 : 0) + Math.abs(nx - cx) + Math.abs(ny - cy);
        if (!best || score < best.score) best = { x: nx, y: ny, score };
      }
    }
    return best;
  };
  /** Sem espaço livre: abre um toco de rua para o lado de terreno vazio (como um jogador faria). */
  const stub = (): boolean => {
    const net = [...connectedRoads(s)].sort((a, b) => {
      const da = Math.abs((a % s.width) - cx) + Math.abs(Math.floor(a / s.width) - cy);
      const db = Math.abs((b % s.width) - cx) + Math.abs(Math.floor(b / s.width) - cy);
      return da - db;
    });
    for (const i of net) {
      const x = i % s.width;
      const y = Math.floor(i / s.width);
      for (const [dx, dy] of [
        [0, -1],
        [0, 1],
        [-1, 0],
        [1, 0],
      ]) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 1 || ny < 1 || nx >= s.width - 1 || ny >= s.height - 1) continue;
        const j = at(nx, ny);
        if (reserved.has(j) || s.terrain[j] || s.zoneType[j] || s.buildings.some((b) => b.x === nx && b.y === ny)) continue;
        if (tryCmd({ type: "build", building: "road", x: nx, y: ny })) {
          tryCmd({ type: "wire", x: nx, y: ny });
          return true;
        }
      }
    }
    return false;
  };
  const build = (type: BuildingType): boolean => {
    let p = spot();
    if (!p && stub()) p = spot();
    return !!p && tryCmd({ type: "build", building: type, x: p.x, y: p.y });
  };
  const count = (type: BuildingType) => s.buildings.filter((b) => b.type === type).length;

  let now = T0;
  let cyclesToday = 0;
  for (let c = 0; c < o.cycles; c++) {
    const builds: string[] = [];
    // ── Pausa: o robô planeja ──
    const reserve = 100;
    const lots = (code: number) => {
      let total = 0;
      let built = 0;
      for (let i = 0; i < s.zoneType.length; i++) {
        if (s.zoneType[i] !== code) continue;
        total++;
        if (s.zoneLevel[i] > 0) built++;
      }
      return { total, built };
    };
    const R = lots(ZONE.R);
    const Cz = lots(ZONE.C);
    const I = lots(ZONE.I);
    // Abre rua nova quando o residencial está quase todo ocupado (a cidade precisa de casas).
    const housingFull = s.population >= laborStats(s).housing - 4;
    const rFill = R.built / Math.max(1, R.total);
    todo = attempt(todo, builds);
    if (!todo.length && ringsOpened < segments.length && (ringsOpened === 0 || (rFill > 0.8 && housingFull)) && s.money > 300) {
      todo = attempt(segments[ringsOpened], builds);
      ringsOpened++;
    }
    const pop = s.population;
    const power = computePower(s);
    const water = computeWater(s);
    const want = (cond: boolean, type: BuildingType) => {
      if (cond && s.money - BUILDINGS[type].cost > reserve && build(type)) builds.push(type);
    };
    if (!o.noProduction) {
      // Comida: fazendas até a previsão fechar no azul.
      const food = resourceOutlook(s).find((x) => x.res === "food")!;
      want(food.net < 0 || count("farm") === 0, "farm");
      const out = resourceOutlook(s);
      const net = (res: string) => out.find((x) => x.res === res)!.net;
      want(net("wood") < 0 || count("lumberyard") === 0, "lumberyard");
      want(pop >= 30 && (count("sawmill") === 0 || (net("planks") < 0 && net("wood") > 4)), "sawmill");
      want(pop >= 80 && count("mine") < 1 + Math.floor(pop / 250), "mine");
      want(pop >= 80 && count("smelter") < Math.floor(pop / 250) + 1 && count("mine") > 0, "smelter");
    }
    // Reparos primeiro (como um jogador faria depois de um desastre).
    for (const b of s.buildings) if (b.damaged && tryCmd({ type: "repair", x: b.x, y: b.y })) builds.push(`reparo ${b.type}`);
    // Energia e água são prioridade: sem elas nada cresce (ignora a reserva de caixa).
    const urgent = (cond: boolean, type: BuildingType) => {
      if (cond && s.money >= BUILDINGS[type].cost && build(type)) builds.push(type);
    };
    // Térmica quando dá; senão, eólica (barata) para não ficar no escuro.
    const short = power.demand > power.capacity * 0.85;
    if (short && pop >= 40 && s.money >= 750) urgent(true, "thermal_plant");
    else urgent(short, "wind_turbine");
    urgent(water.demand > (water.produced + water.stored) * 0.85, "water_pump");
    want(pop >= 60 && count("school") < 1 + Math.floor(pop / 150), "school");
    want(pop >= 90 && count("police") < 1 + Math.floor(pop / 200), "police");
    want(pop >= 90 && count("fire_station") < 1 + Math.floor(pop / 250), "fire_station");
    want(pop >= 120 && count("hospital") < Math.floor(pop / 150), "hospital");
    want(pop >= 60 && count("park") < Math.floor(pop / 80), "park");
    // Linhas: liga tudo com fio ao longo das ruas (barato).
    for (const b of s.buildings) {
      if (b.type !== "road") continue;
      const i = at(b.x, b.y);
      if (!s.wires[i] && s.money > reserve && tryCmd({ type: "wire", x: b.x, y: b.y })) {
        /* fio */
      }
    }
    // Canos sob as ruas (água chega aos lotes).
    if (pop >= 20)
      for (const b of s.buildings) {
        if (b.type !== "road" || s.pipes[at(b.x, b.y)] || s.money <= reserve) continue;
        tryCmd({ type: "pipe", x: b.x, y: b.y });
      }

    // ── Foco: o ciclo é concluído (ou abandonado) ──
    if (cyclesToday >= o.perDay) {
      now += 14 * 60 * MIN; // noite: a sequência decai
      cyclesToday = 0;
    }
    if (o.breakChance && r() < o.breakChance) {
      now += 30 * MIN;
      cyclesToday++;
      const d = applyDisaster(abandonCycle(s), "normal", "abandoned");
      s = d.state;
      disasters.push(d.report.damageValue);
      continue;
    }
    now += 30 * MIN;
    const res = resolveCycle(s, now);
    s = res.state;
    cyclesToday++;
    const rep: CycleReport = res.report;
    const labor = laborStats(s);
    rows.push({
      cycle: c + 1,
      year: rep.year,
      quarter: rep.quarter,
      rank: rep.rank,
      pop: s.population,
      housing: labor.housing,
      money: s.money,
      net: rep.netMoney,
      taxes: rep.taxes,
      upkeep: rep.upkeep,
      imports: rep.importCost,
      sales: rep.salesRevenue,
      food: stockOf(s.inventory, "food"),
      wood: stockOf(s.inventory, "wood"),
      planks: stockOf(s.inventory, "planks"),
      metal: stockOf(s.inventory, "metal"),
      goods: stockOf(s.inventory, "goods"),
      powerCap: rep.power.capacity,
      powerDemand: rep.power.demand,
      water: rep.water ? `${rep.water.supplied}/${rep.water.demand}` : "-",
      unemployed: rep.jobs.unemployed,
      jobs: rep.jobs.total,
      approval: rep.citizens ? Math.round(((rep.citizens.feliz - rep.citizens.triste) / Math.max(1, rep.citizens.feliz + rep.citizens.ok + rep.citizens.triste)) * 100) : 0,
      eq: Math.round(s.eq),
      crime: Math.round(rep.services?.crime ?? 0),
      pollution: Math.round(rep.services?.pollution ?? 0),
      landValue: Math.round(rep.services?.landValue ?? 0),
      congested: rep.traffic?.congested ?? 0,
      failedTrips: rep.traffic?.failed ?? 0,
      builds,
      demand: (() => {
        const d = computeDemand(s);
        return `${d.R.toFixed(1)}/${d.C.toFixed(1)}/${d.I.toFixed(1)}`;
      })(),
      starving: rep.starving,
      brownout: rep.power.brownout,
      weather: rep.weather?.label ?? "",
    });
  }
  if (disasters.length) console.log(`desastres: ${disasters.length}, prejuízo total $${disasters.reduce((a, b) => a + b, 0)}`);
  onEnd?.(s);
  return rows;
}
