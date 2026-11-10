// Desastres por ciclo quebrado (parte da Fase 5 antecipada).
// Ausência nunca dispara desastre; quebrar o compromisso sim:
//   - abandonar o foco, ou fechar o jogo durante o foco      → desastre
//   - fechar o jogo sem sair pelo menu depois de concluir um foco → desastre leve
// O tipo depende do tempo da estação; o sorteio usa seed (determinístico no servidor).

import { weatherAt } from "./climate";
import { addTo, getQty } from "./inventory";
import { RANKS, ZONE, type CityState, type Inventory, type ResourceId } from "./types";
import { rng } from "./world";

export type DisasterSeverity = "light" | "normal";
export type DisasterKind = "incendio" | "enchente" | "nevasca" | "tempestade" | "praga";
export type DisasterCause = "abandoned" | "closed_during_focus" | "closed_without_exit";

export const DISASTER_NAMES: Record<DisasterKind, string> = {
  incendio: "Incêndio",
  enchente: "Enchente",
  nevasca: "Nevasca",
  tempestade: "Tempestade",
  praga: "Praga na lavoura",
};

export const CAUSE_TEXT: Record<DisasterCause, string> = {
  abandoned: "O ciclo de foco foi abandonado.",
  closed_during_focus: "O jogo foi fechado durante o foco, sem sair pelo menu.",
  closed_without_exit: "O jogo foi fechado sem sair pelo menu.",
};

export interface DisasterReport {
  kind: DisasterKind;
  name: string;
  severity: DisasterSeverity;
  cause: DisasterCause;
  /** Lotes que perderam nível. */
  lotsDamaged: number;
  resourcesLost: Inventory;
  moneyLost: number;
}

/** Recurso estocado mais afetado por cada tipo de desastre. */
const STOCK_HIT: Record<DisasterKind, ResourceId> = {
  incendio: "wood",
  enchente: "food",
  nevasca: "food",
  tempestade: "planks",
  praga: "food",
};

const SEVERITY = {
  light: { lots: 2, levels: 1, stock: 0.1, money: 0.03, moneyCap: 100 },
  normal: { lots: 6, levels: 2, stock: 0.3, money: 0.1, moneyCap: 500 },
};

function pickKind(s: CityState, rand: () => number): DisasterKind {
  const w = weatherAt(s);
  if (w) {
    if (w.label === "Seca severa" || w.rain < 60) return "incendio";
    if (w.label === "Chuvas acima da média" || w.rain > 450) return "enchente";
    if (w.temp <= 2) return "nevasca";
  }
  const pool: DisasterKind[] = ["tempestade", "praga", "incendio"];
  return pool[Math.floor(rand() * pool.length)];
}

/** Aplica um desastre e devolve o novo estado (o original não é alterado). */
export function applyDisaster(
  s: CityState,
  severity: DisasterSeverity,
  cause: DisasterCause,
): { state: CityState; report: DisasterReport } {
  const next = structuredClone(s);
  const rand = rng((s.seed ^ Math.imul(s.disasterCount + 1, 0x2c1b3c6d) ^ Math.imul(s.cyclesCompleted + 7, 0x297a2d39)) >>> 0);
  const kind = pickKind(s, rand);
  const cfg = SEVERITY[severity];

  // Lotes desenvolvidos perdem níveis (enchente prefere lotes à beira d'água).
  const developed: number[] = [];
  for (let i = 0; i < next.zoneLevel.length; i++) if (next.zoneType[i] !== ZONE.NONE && next.zoneLevel[i] > 0) developed.push(i);
  const nearWater = (i: number) => {
    const x = i % next.width;
    const y = Math.floor(i / next.width);
    return [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ].some(([dx, dy]) => next.terrain[(y + dy) * next.width + (x + dx)] === 1);
  };
  for (let i = developed.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [developed[i], developed[j]] = [developed[j], developed[i]];
  }
  if (kind === "enchente") developed.sort((a, b) => Number(nearWater(b)) - Number(nearWater(a)));
  let lotsDamaged = 0;
  for (const i of developed.slice(0, cfg.lots)) {
    next.zoneLevel[i] = Math.max(0, next.zoneLevel[i] - cfg.levels);
    lotsDamaged++;
  }

  // Estoque atingido.
  const resourcesLost: Inventory = {};
  const res = STOCK_HIT[kind];
  for (const r of RANKS) {
    const have = getQty(next.inventory, res, r);
    const lost = Math.ceil(have * cfg.stock);
    if (lost <= 0) continue;
    next.inventory[`${res}:${r}`] = have - lost;
    if (next.inventory[`${res}:${r}`] === 0) delete next.inventory[`${res}:${r}`];
    addTo(resourcesLost, res, r, lost);
  }

  // Custo de limpeza e reparos.
  const moneyLost = Math.max(0, Math.min(cfg.moneyCap, Math.floor(Math.max(0, next.money) * cfg.money)));
  next.money -= moneyLost;
  next.disasterCount++;
  next.lastDisasterCycle = next.cyclesCompleted;
  next.version++;

  return {
    state: next,
    report: { kind, name: DISASTER_NAMES[kind], severity, cause, lotsDamaged, resourcesLost, moneyLost },
  };
}
