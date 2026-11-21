import { BUILDINGS, ZONES } from "./catalog";
import { UNPOWERED_EFFICIENCY } from "./config";
import { ZONE, type CityState } from "./types";
import { SECTOR_OF_BUILDING, industrialLotJobs, jobFactor } from "./labor";
import { isDown, wearFactor } from "./lifecycle";
import { activeWorkers } from "./strikes";
import { connectedRoads, isRoadConnected } from "./world";

export interface BuildingStatus {
  connected: boolean;
  staffed: number;
  required: number;
  /** false só quando a construção consome energia e está sem luz. */
  powered: boolean;
  /** 0..1 — fração de operação (estrada × trabalhadores × energia). */
  efficiency: number;
}

/**
 * Status de cada construção: conexão viária, trabalhadores (alocados por ordem de id)
 * e energia (se `powered` for informado; sem ele, a energia é ignorada).
 */
export function buildingStatus(s: CityState, powered?: Uint8Array): Map<number, BuildingStatus> {
  const network = connectedRoads(s);
  const out = new Map<number, BuildingStatus>();
  let freeWorkers = activeWorkers(s);
  const ordered = [...s.buildings].sort((a, b) => a.id - b.id);
  const jobs = jobFactor(s);
  for (const b of ordered) {
    const def = BUILDINGS[b.type];
    const connected = !def.needsRoad || isRoadConnected(s, b, network);
    // Máquinas (automação) dispensam parte dos operários das fábricas de produção; o resto produz igual.
    const required = def.workers > 0 && SECTOR_OF_BUILDING[b.type] ? Math.max(1, Math.ceil(def.workers * jobs)) : def.workers;
    let staffed = 0;
    // Construção danificada por desastre não opera nem contrata até ser reparada.
    if (connected && required > 0 && !isDown(b, s)) {
      staffed = Math.min(required, freeWorkers);
      freeWorkers -= staffed;
    }
    const needsPower = (def.powerUse ?? 0) > 0;
    const hasPower = !powered || !needsPower || powered[b.y * s.width + b.x] === 1;
    const staffRatio = required === 0 ? 1 : staffed / required;
    // Desgaste: máquinas velhas rendem menos até serem renovadas.
    const efficiency = !connected || isDown(b, s) ? 0 : staffRatio * (hasPower ? 1 : UNPOWERED_EFFICIENCY) * wearFactor(b, s);
    out.set(b.id, { connected, staffed, required, powered: hasPower, efficiency });
  }
  return out;
}

export interface LaborStats {
  /** Capacidade de moradia (lotes residenciais desenvolvidos). */
  housing: number;
  publicJobs: number;
  publicFilled: number;
  commercialJobs: number;
  industrialJobs: number;
  /** Empregos preenchidos em zonas C/I (comércio é preenchido primeiro). */
  zoneFilled: number;
  commercialFilled: number;
  industrialFilled: number;
  totalJobs: number;
  unemployed: number;
  /** Trabalhadores em greve (não contam como desempregados). */
  striking: number;
}

export function laborStats(s: CityState, status = buildingStatus(s)): LaborStats {
  let housing = 0;
  let commercialJobs = 0;
  let industrialJobs = 0;
  for (let i = 0; i < s.zoneType.length; i++) {
    const lvl = s.zoneLevel[i];
    if (!lvl) continue;
    if (s.zoneType[i] === ZONE.R) housing += lvl * ZONES.R.perLevel;
    else if (s.zoneType[i] === ZONE.C) commercialJobs += lvl * ZONES.C.perLevel;
    else if (s.zoneType[i] === ZONE.I) industrialJobs += industrialLotJobs(s, lvl, ZONES.I.perLevel);
  }
  for (const b of s.buildings) housing += BUILDINGS[b.type].housing ?? 0;

  let publicJobs = 0;
  let publicFilled = 0;
  for (const b of s.buildings) {
    const st = status.get(b.id);
    if (!st?.connected) continue;
    publicJobs += st.required;
    publicFilled += st.staffed;
  }
  const zoneJobs = commercialJobs + industrialJobs;
  const workers = activeWorkers(s);
  const zoneFilled = Math.min(zoneJobs, Math.max(0, workers - publicFilled));
  const commercialFilled = Math.min(commercialJobs, zoneFilled);
  return {
    housing,
    publicJobs,
    publicFilled,
    commercialJobs,
    industrialJobs,
    zoneFilled,
    commercialFilled,
    industrialFilled: zoneFilled - commercialFilled,
    totalJobs: publicJobs + zoneJobs,
    unemployed: Math.max(0, workers - publicFilled - zoneFilled),
    striking: Math.max(0, s.population - workers),
  };
}
