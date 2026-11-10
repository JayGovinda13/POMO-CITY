import { ZONES } from "./catalog";
import { BASE_GROWTH_SLOTS, RANK_GROWTH_BONUS } from "./config";
import { laborStats, type LaborStats } from "./status";
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
export function computeDemand(s: CityState, labor: LaborStats = laborStats(s), approval = 0): Demand {
  const workers = s.population;
  const commerceTarget = workers * 0.35;
  const industryTarget = workers * 0.45 + 6;
  return {
    // Cidade feliz atrai moradores; cidade triste espanta (aprovação em [−1, 1]).
    R: round2(clamp((labor.totalJobs - workers + 8) / Math.max(16, workers) + approval * 0.25)),
    C: round2(clamp((commerceTarget - labor.commercialJobs) / Math.max(8, commerceTarget))),
    I: round2(clamp((industryTarget - labor.industrialJobs) / Math.max(8, industryTarget))),
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
  opts: { rank: Rank; rand: () => number; powered: Uint8Array; access: Int32Array; approval?: number },
): GrowthResult {
  const demand = computeDemand(s, undefined, opts.approval ?? 0);
  const slots = BASE_GROWTH_SLOTS + RANK_GROWTH_BONUS[opts.rank];
  let grown = 0;
  let declined = 0;
  const n = s.zoneType.length;

  for (let i = 0; i < n; i++) {
    if (s.zoneType[i] && s.zoneLevel[i] > 0 && (!opts.powered[i] || opts.access[i] < 0)) {
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
        if (s.zoneType[i] !== code || s.zoneLevel[i] >= maxLevel(s, i)) continue;
        if (opts.powered[i] && opts.access[i] >= 0) candidates.push(i);
      }
      for (const i of shuffle(candidates, opts.rand).slice(0, Math.ceil(slots * d))) {
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
