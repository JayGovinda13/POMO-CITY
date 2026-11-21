// Quantos trabalhadores há em cada setor e o desgaste médio da cidade (jornada e pagamento).

import { buildingStatus, laborStats, type BuildingStatus } from "./status";
import { SECTOR_IDS, SECTOR_OF_BUILDING, sectorFatigue, type Sector } from "./labor";
import type { CityState } from "./types";

/** Trabalhadores empregados em cada setor. */
export function sectorWorkers(s: CityState, status: Map<number, BuildingStatus> = buildingStatus(s)): Record<Sector, number> {
  const out: Record<Sector, number> = { campo: 0, oficina: 0, fabrica: 0 };
  for (const b of s.buildings) {
    const sec = SECTOR_OF_BUILDING[b.type];
    if (sec) out[sec] += status.get(b.id)?.staffed ?? 0;
  }
  const labor = laborStats(s, status);
  out.fabrica = Math.max(0, labor.zoneFilled - labor.commercialJobs);
  return out;
}

/** Desgaste médio dos trabalhadores da cidade, de 0 a 1 (média por número de empregados). */
export function cityFatigue(s: CityState, status?: Map<number, BuildingStatus>): number {
  const w = sectorWorkers(s, status);
  const total = SECTOR_IDS.reduce((a, k) => a + w[k], 0);
  if (total <= 0) return 0;
  return SECTOR_IDS.reduce((a, k) => a + sectorFatigue(s, k) * w[k], 0) / total;
}
