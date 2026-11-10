// Fase 7 — Serviços e qualidade de vida.
//
// Campos espaciais recalculados a partir do estado (nada disso fica salvo, só eq e expectativa
// de vida): poluição, crime, valor do solo e cobertura de polícia/bombeiros. Cada fonte afeta
// os tiles ao redor com decaimento linear pela distância (Chebyshev). Hospital, escola e
// faculdade atendem por capacidade (moradores atendidos), não por raio.

import { BUILDINGS } from "./catalog";
import { buildingStatus, laborStats, type BuildingStatus } from "./status";
import { computeTraffic, type TrafficResult } from "./traffic";
import { START_EQ, START_LIFE } from "./config";
import { ZONE, type CityState } from "./types";

export type ServiceKind = NonNullable<(typeof BUILDINGS)[keyof typeof BUILDINGS]["service"]>["kind"];

/** Raio de espalhamento da poluição (tiles). */
export const POLLUTION_RADIUS = 5;
/** Crime acima disso: lote não cresce (e as prisões passam a ajudar a polícia). */
export const CRIME_HIGH = 60;
/** Poluição acima disso: residência não cresce. */
export const POLLUTION_HIGH = 55;
export const EQ_SCHOOL_CAP = 90;
export const EQ_COLLEGE_CAP = 140;
export const EQ_MAX = 150;
export { START_EQ, START_LIFE };

export interface ServiceFields {
  /** 0..100 por tile. */
  pollution: Float32Array;
  crime: Float32Array;
  landValue: Float32Array;
  /** 0..1 por tile. */
  police: Float32Array;
  fire: Float32Array;
  /** Proximidade de lazer (0..1) e de escola/hospital (0..1), para o humor. */
  leisure: Float32Array;
  school: Float32Array;
  health: Float32Array;
  /** Fração dos moradores atendida (0..1). */
  healthServed: number;
  schoolServed: number;
  collegeServed: number;
  /** Biblioteca/museu: o QE não cai. */
  eqProtected: boolean;
  /** Bônus de demanda das atrações (zoológico, estádio, museu). */
  attraction: number;
  prisonBoost: boolean;
  /** Médias nos lotes ocupados. */
  avg: { crime: number; pollution: number; landValue: number; fire: number; police: number };
}

const clamp = (v: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, v));

/** Fator da verba do departamento: 50% de efeito com verba zero. */
export const serviceFundingFactor = (funding: number) => 0.5 + 0.5 * (funding / 100);

export function serviceFunding(s: CityState, kind: ServiceKind): number {
  const f = s.funding;
  switch (kind) {
    case "police":
    case "prison":
      return f.police ?? 100;
    case "fire":
      return f.fire ?? 100;
    case "hospital":
      return f.health ?? 100;
    case "school":
    case "college":
    case "library":
    case "museum":
      return f.education ?? 100;
    default:
      return 100;
  }
}

/** Espalha `value` em volta de (x, y) num raio `r`, com queda linear até a borda. `op` combina. */
function spread(s: CityState, field: Float32Array, x: number, y: number, r: number, value: number, op: "add" | "max") {
  for (let dy = -r; dy <= r; dy++) {
    const ny = y + dy;
    if (ny < 0 || ny >= s.height) continue;
    for (let dx = -r; dx <= r; dx++) {
      const nx = x + dx;
      if (nx < 0 || nx >= s.width) continue;
      const d = Math.max(Math.abs(dx), Math.abs(dy));
      const v = value * (1 - d / (r + 1));
      const i = ny * s.width + nx;
      field[i] = op === "add" ? field[i] + v : Math.max(field[i], v);
    }
  }
}

/** Calcula todos os campos de serviço. `status` informa eficiência (trabalhadores, energia, estrada). */
export function computeServices(
  s: CityState,
  status: Map<number, BuildingStatus> = buildingStatus(s),
  traffic: TrafficResult = computeTraffic(s),
): ServiceFields {
  const n = s.width * s.height;
  const pollution = new Float32Array(n);
  const crime = new Float32Array(n);
  const landValue = new Float32Array(n);
  const police = new Float32Array(n);
  const fire = new Float32Array(n);
  const leisure = new Float32Array(n);
  const school = new Float32Array(n);
  const health = new Float32Array(n);
  const lvBonus = new Float32Array(n);
  const cleaning = new Float32Array(n);
  const eff = (id: number) => status.get(id)?.efficiency ?? 1;

  let attraction = 0;
  let eqProtected = false;
  let healthCap = 0;
  let schoolCap = 0;
  let collegeCap = 0;
  let prisons = 0;

  // ── Fontes: poluição, serviços em raio, valorização ──
  for (const b of s.buildings) {
    const def = BUILDINGS[b.type];
    const e = eff(b.id);
    if (def.pollution && e > 0) spread(s, pollution, b.x, b.y, POLLUTION_RADIUS, def.pollution * 4 * e, "add");
    const sv = def.service;
    if (!sv) continue;
    // Áreas verdes funcionam sozinhas; os demais precisam operar (estrada e trabalhadores).
    const op = sv.kind === "leisure" && def.workers === 0 ? 1 : e * serviceFundingFactor(serviceFunding(s, sv.kind));
    if (sv.landValue && op > 0) spread(s, lvBonus, b.x, b.y, sv.radius ?? 3, sv.landValue * (sv.landValue > 0 ? op : 1), "add");
    if (op <= 0) continue;
    if (sv.cleans) spread(s, cleaning, b.x, b.y, sv.radius ?? 3, sv.cleans * 3, "add");
    if (sv.demand) attraction += sv.demand * op;
    switch (sv.kind) {
      case "police":
        spread(s, police, b.x, b.y, sv.radius ?? 8, op, "max");
        break;
      case "fire":
        spread(s, fire, b.x, b.y, sv.radius ?? 8, op, "max");
        break;
      case "prison":
        prisons++;
        break;
      case "hospital":
        healthCap += (sv.capacity ?? 0) * op;
        spread(s, health, b.x, b.y, sv.radius ?? 5, 1, "max");
        break;
      case "school":
        schoolCap += (sv.capacity ?? 0) * op;
        spread(s, school, b.x, b.y, sv.radius ?? 5, 1, "max");
        break;
      case "college":
        collegeCap += (sv.capacity ?? 0) * op;
        spread(s, school, b.x, b.y, sv.radius ?? 6, 1, "max");
        break;
      case "library":
      case "museum":
        eqProtected = true;
        break;
      case "leisure":
        spread(s, leisure, b.x, b.y, sv.radius ?? 3, 1, "max");
        break;
    }
  }
  // Indústria e tráfego também poluem.
  for (let i = 0; i < n; i++) {
    const x = i % s.width;
    const y = Math.floor(i / s.width);
    if (s.zoneType[i] === ZONE.I && s.zoneLevel[i] > 0) spread(s, pollution, x, y, 3, s.zoneLevel[i] * (s.zoneDensity[i] ? 5 : 3), "add");
  }
  // Tráfego (Fase 8): via vazia polui pouco; congestionada, muito.
  for (let i = 0; i < n; i++) {
    if (!traffic.capacity[i]) continue;
    const ratio = Math.min(2, traffic.load[i] / traffic.capacity[i]);
    spread(s, pollution, i % s.width, Math.floor(i / s.width), 1, 1 + ratio * 6, "add");
  }
  for (let i = 0; i < n; i++) pollution[i] = clamp(pollution[i] - cleaning[i]);

  // ── Crime: densidade e desemprego aumentam; polícia derruba. Prisão reforça com crime alto. ──
  const labor = laborStats(s, status);
  const unemployment = s.population > 0 ? labor.unemployed / s.population : 0;
  // Cidade grande tem mais crime: até +15 pontos a partir de 200 moradores.
  const cityFactor = Math.min(1, s.population / 200) * 15;
  const raw = new Float32Array(n);
  let rawSum = 0;
  let occupied = 0;
  for (let i = 0; i < n; i++) {
    const z = s.zoneType[i];
    if (z === ZONE.NONE || s.zoneLevel[i] <= 0 || z === ZONE.I) continue;
    raw[i] = cityFactor + s.zoneLevel[i] * (s.zoneDensity[i] ? 9 : 4) + unemployment * 25 + (z === ZONE.C ? 6 : 0);
    rawSum += raw[i];
    occupied++;
  }
  const prisonBoost = prisons > 0 && occupied > 0 && rawSum / occupied > CRIME_HIGH * 0.6;
  const policePower = prisonBoost ? 1.3 : 1;
  for (let i = 0; i < n; i++) crime[i] = clamp(raw[i] * (1 - Math.min(0.95, police[i] * 0.75 * policePower)));

  // ── Valor do solo: centro, água perto, serviços e lazer; poluição e crime desvalorizam. ──
  const hall = s.buildings.find((b) => b.type === "cityhall");
  for (let i = 0; i < n; i++) {
    const x = i % s.width;
    const y = Math.floor(i / s.width);
    const center = hall ? Math.max(0, 20 - Math.max(Math.abs(x - hall.x), Math.abs(y - hall.y)) * 1.5) : 0;
    let water = 0;
    for (let dy = -2; dy <= 2 && !water; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx >= 0 && ny >= 0 && nx < s.width && ny < s.height && s.terrain[ny * s.width + nx] === 1) {
          water = 10;
          break;
        }
      }
    }
    landValue[i] = clamp(35 + center + water + lvBonus[i] - pollution[i] * 0.5 - crime[i] * 0.3);
  }

  const pop = Math.max(1, s.population);
  const schoolServed = Math.min(1, schoolCap / pop);
  // Faculdade só forma quem passou pela escola.
  const collegeServed = Math.min(schoolServed, collegeCap / pop);

  let sc = 0;
  let sp = 0;
  let sl = 0;
  let sf = 0;
  let spo = 0;
  let cnt = 0;
  for (let i = 0; i < n; i++) {
    if (s.zoneType[i] === ZONE.NONE || s.zoneLevel[i] <= 0) continue;
    sc += crime[i];
    sp += pollution[i];
    sl += landValue[i];
    sf += fire[i];
    spo += police[i];
    cnt++;
  }
  const avg = (v: number) => (cnt ? Math.round((v / cnt) * 10) / 10 : 0);
  return {
    pollution,
    crime,
    landValue,
    police,
    fire,
    leisure,
    school,
    health,
    healthServed: Math.min(1, healthCap / pop),
    schoolServed,
    collegeServed,
    eqProtected,
    attraction: Math.round(attraction * 100) / 100,
    prisonBoost,
    avg: {
      crime: avg(sc),
      pollution: avg(sp),
      landValue: avg(sl),
      fire: cnt ? Math.round((sf / cnt) * 100) / 100 : 0,
      police: cnt ? Math.round((spo / cnt) * 100) / 100 : 0,
    },
  };
}

/** Classe dos moradores pelo valor do solo: baixa (<35), média, alta (>65). */
export type WealthClass = "baixa" | "media" | "alta";
export const wealthOf = (landValue: number): WealthClass => (landValue < 35 ? "baixa" : landValue > 65 ? "alta" : "media");
export const WEALTH_NAMES: Record<WealthClass, string> = { baixa: "Baixa renda", media: "Classe média", alta: "Alta renda" };
const WEALTH_TAX: Record<WealthClass, number> = { baixa: 0.8, media: 1, alta: 1.25 };

/** Multiplicador do imposto residencial: a riqueza dos moradores vem do valor do solo. */
export const landValueTaxFactor = (avgLandValue: number) => WEALTH_TAX[wealthOf(avgLandValue)];

/** QE alvo do ciclo: escola leva até 90, faculdade até 140. */
export function eqTarget(f: Pick<ServiceFields, "schoolServed" | "collegeServed">): number {
  return f.schoolServed * EQ_SCHOOL_CAP + f.collegeServed * (EQ_COLLEGE_CAP - EQ_SCHOOL_CAP);
}

/** Atualiza QE e expectativa de vida (mudam devagar). Muta `s`. */
export function updateQuality(s: CityState, f: ServiceFields): void {
  const target = eqTarget(f);
  const eq = s.eq ?? START_EQ;
  let next: number;
  if (target >= eq) next = eq + (target - eq) * 0.25;
  else next = eq - (eq - target) * (f.eqProtected ? 0.02 : 0.1);
  s.eq = Math.round(clamp(next, 0, EQ_MAX) * 10) / 10;

  // Expectativa de vida: hospitais sobem, poluição derruba. Anda no máximo 1 ano por estação.
  const lifeTarget = 50 + f.healthServed * 30 - f.avg.pollution * 0.25 + (s.eq ?? 0) * 0.03;
  const life = s.lifeExpectancy ?? START_LIFE;
  const step = Math.max(-1, Math.min(1, (lifeTarget - life) * 0.2));
  s.lifeExpectancy = Math.round(clamp(life + step, 30, 95) * 10) / 10;
}

/** Ajustes de demanda por qualidade de vida (somados à demanda R/C). */
export function serviceDemand(s: CityState, f: ServiceFields): { R: number; C: number } {
  if (s.population <= 0) return { R: 0, C: 0 };
  const quality = (f.healthServed + f.schoolServed) * 0.05 - (f.avg.pollution > 40 ? 0.1 : 0) - (f.avg.crime > 50 ? 0.1 : 0);
  return { R: f.attraction + quality + ((s.lifeExpectancy ?? START_LIFE) - START_LIFE) * 0.005, C: f.attraction };
}

/** Bombeiros por perto: a fração do estrago de incêndio que é evitada (0..0.7). */
export const fireProtection = (coverage: number) => Math.min(0.7, coverage * 0.7);
