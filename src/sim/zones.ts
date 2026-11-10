import { ZONES } from "./catalog";
import { BASE_GROWTH_SLOTS, RANK_GROWTH_BONUS } from "./config";
import { laborStats, type LaborStats } from "./status";
import { demandModifiers } from "./finance";
import { CRIME_HIGH, POLLUTION_HIGH, computeServices, serviceDemand, type ServiceFields } from "./services";
import { TRIP_LIMIT_POPULATION, computeTraffic, trafficDemand, type TrafficResult } from "./traffic";
import { ZONE_KINDS, type CityState, type Rank, type ZoneKind } from "./types";

export type Demand = Record<ZoneKind, number>;

const clamp = (v: number) => Math.max(-1, Math.min(1, v));
const round2 = (v: number) => Math.round(v * 100) / 100;

/**
 * Indicador de demanda R/C/I em [-1, 1].
 * - R: sobe quando há mais empregos do que trabalhadores (e um pouco de imigração natural).
 * - C: comércio acompanha a população (clientes).
 * - I: indústria exporta; é forte em cidades pequenas.
 */
export function computeDemand(
  s: CityState,
  labor: LaborStats = laborStats(s),
  approval = 0,
  services?: ServiceFields,
  traffic: TrafficResult = computeTraffic(s),
): Demand {
  services ??= computeServices(s, undefined, traffic);
  const workers = s.population;
  const commerceTarget = workers * 0.35;
  const industryTarget = workers * 0.45 + 6;
  // Impostos, decretos e dificuldade (Fase 4).
  const mod = demandModifiers(s);
  // Qualidade de vida e atrações (Fase 7).
  const q = serviceDemand(s, services);
  // Transporte (Fase 8): congestionamento, viagens impossíveis e portos.
  const tr = trafficDemand(s, traffic);
  return {
    // Cidade feliz atrai moradores; cidade triste espanta (aprovação em [−1, 1]).
    R: round2(clamp((labor.totalJobs - workers + 8) / Math.max(16, workers) + approval * 0.25 + mod.R + q.R + tr.R)),
    C: round2(clamp((commerceTarget - labor.commercialJobs) / Math.max(8, commerceTarget) + mod.C + q.C + tr.C)),
    I: round2(clamp((industryTarget - labor.industrialJobs) / Math.max(8, industryTarget) + mod.I + tr.I)),
  };
}

export const maxLevel = (s: CityState, i: number) => {
  const kind = ZONE_KINDS[s.zoneType[i] - 1];
  return kind ? ZONES[kind].maxLevel[s.zoneDensity[i]] : 0;
};

function shuffle<T>(arr: T[], rand: () => number): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export interface GrowthResult {
  grown: number;
  declined: number;
  demand: Demand;
}

/**
 * Desenvolvimento orgânico dos lotes (muta `s`).
 * 1. Lotes sem energia ou sem acesso viário perdem um nível.
 * 2. Para cada tipo com demanda positiva, até `slots × demanda` lotes elegíveis sobem um nível;
 *    `slots` cresce com o Rank do foco.
 * 3. Demanda muito negativa faz alguns lotes perderem nível.
 */
export function developZones(
  s: CityState,
  opts: {
    rank: Rank;
    rand: () => number;
    powered: Uint8Array;
    access: Int32Array;
    approval?: number;
    /** 1 = lote com água (Fase 6). Lote denso sem água não passa do nível 2. */
    watered?: Uint8Array;
    /** Campos de serviço (Fase 7): crime/poluição altos travam o lote; valor do solo dá a ordem. */
    services?: ServiceFields;
    /** Trânsito (Fase 8): com 60+ habitantes, lote residencial sem emprego ao alcance não cresce. */
    traffic?: TrafficResult;
    /** Paga os materiais de um nível novo; false = não há material nem dinheiro (o lote não cresce). */
    pay?: (kind: ZoneKind, dense: boolean) => boolean;
  },
): GrowthResult {
  const traffic = opts.traffic ?? computeTraffic(s);
  const services = opts.services ?? computeServices(s, undefined, traffic);
  const demand = computeDemand(s, undefined, opts.approval ?? 0, services, traffic);
  const tooFar = (i: number) => s.population >= TRIP_LIMIT_POPULATION && traffic.failed[i] === 1;
  /** Lote travado pela qualidade de vida: crime alto (R, C) ou poluição alta (R). */
  const blocked = (kind: ZoneKind, i: number) =>
    (kind !== "I" && services.crime[i] > CRIME_HIGH + (kind === "C" ? 10 : 0)) ||
    (kind === "R" && (services.pollution[i] > POLLUTION_HIGH || tooFar(i)));
  const slots = BASE_GROWTH_SLOTS + RANK_GROWTH_BONUS[opts.rank];
  let grown = 0;
  let declined = 0;
  const n = s.zoneType.length;

  // Sem água, prédio denso não se sustenta acima do nível 2 (Fase 6).
  const dryCap = (i: number) => (opts.watered && s.zoneDensity[i] === 1 && !opts.watered[i] ? 2 : Infinity);
  for (let i = 0; i < n; i++) {
    if (!s.zoneType[i] || s.zoneLevel[i] <= 0) continue;
    if (!opts.powered[i] || opts.access[i] < 0 || s.zoneLevel[i] > dryCap(i)) {
      s.zoneLevel[i]--;
      declined++;
    }
  }

  ZONE_KINDS.forEach((kind, k) => {
    const code = k + 1;
    const d = demand[kind];
    if (d > 0) {
      const candidates: number[] = [];
      for (let i = 0; i < n; i++) {
        if (s.zoneType[i] !== code || s.zoneLevel[i] >= Math.min(maxLevel(s, i), dryCap(i))) continue;
        if (opts.powered[i] && opts.access[i] >= 0 && !blocked(kind, i)) candidates.push(i);
      }
      // Os lotes mais valorizados crescem primeiro (desempate aleatório; indústria não liga).
      const ordered = shuffle(candidates, opts.rand);
      if (kind !== "I") ordered.sort((a, b) => Math.floor(services.landValue[b] / 10) - Math.floor(services.landValue[a] / 10));
      for (const i of ordered.slice(0, Math.ceil(slots * d))) {
        if (opts.pay && !opts.pay(kind, s.zoneDensity[i] === 1)) continue;
        s.zoneLevel[i]++;
        grown++;
      }
    } else if (d < -0.3) {
      const developed: number[] = [];
      for (let i = 0; i < n; i++) if (s.zoneType[i] === code && s.zoneLevel[i] > 0) developed.push(i);
      for (const i of shuffle(developed, opts.rand).slice(0, Math.ceil((slots * -d) / 2))) {
        s.zoneLevel[i]--;
        declined++;
      }
    }
  });

  return { grown, declined, demand };
}
