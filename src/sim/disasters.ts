// Desastres por ciclo quebrado (Fase 5).
// Ausência nunca dispara desastre; quebrar o compromisso sim:
//   - abandonar o foco, ou fechar o jogo durante o foco      → desastre
//   - fechar o jogo sem sair pelo menu depois de concluir um foco → desastre leve
// O tipo depende do tempo da estação; a gravidade cresce com quebras seguidas e com o tamanho
// da sequência quebrada. O sorteio usa seed (determinístico no servidor). O seguro indeniza.

import { BUILDINGS } from "./catalog";
import { weatherAt } from "./climate";
import { BASE_PRICE } from "./economy";
import { addTo, getQty } from "./inventory";
import { BONUS_MAX, isCovered, payoutFor, repairCost, waitingLeft } from "./insurance";
import { RANKS, ZONE, type CityState, type Inventory, type ResourceId } from "./types";
import { rng } from "./world";
import { computeServices, fireProtection } from "./services";

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
  /** Multiplicador da gravidade (quebras seguidas, sequência longa). */
  intensity: number;
  /** Lotes que perderam nível. */
  lotsDamaged: number;
  /** Lotes e construções salvos pelos bombeiros (Fase 7). */
  savedByFirefighters: number;
  /** Construções danificadas (param até o reparo). */
  buildingsDamaged: { type: keyof typeof BUILDINGS; x: number; y: number; repair: number }[];
  resourcesLost: Inventory;
  moneyLost: number;
  /** Valor total do prejuízo (lotes + estoque + limpeza + reparos). */
  damageValue: number;
  insurance: { covered: boolean; payout: number; waitingLeft: number; plan: CityState["insurance"]["plan"] };
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
  light: { lots: 2, levels: 1, stock: 0.1, money: 0.03, moneyCap: 100, buildings: 0 },
  normal: { lots: 6, levels: 2, stock: 0.3, money: 0.1, moneyCap: 500, buildings: 1 },
};

/** Valor de um nível de lote para o cálculo do prejuízo (o mesmo do valor da cidade). */
const LOT_LEVEL_VALUE = 60;

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

/**
 * Gravidade: cada ciclo quebrado seguido soma +50% (até 2×) e quebrar uma sequência de 5+
 * ciclos pesa mais 25%. O desastre leve (fechar sem o menu) não é ciclo quebrado.
 */
export function disasterIntensity(s: CityState, severity: DisasterSeverity): number {
  if (severity === "light") return 1;
  const repeat = Math.min(2, 1 + 0.5 * s.breaks);
  return Math.round(repeat * (s.streak >= 5 ? 1.25 : 1) * 100) / 100;
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
  const intensity = disasterIntensity(s, severity);
  const scaled = (v: number) => Math.round(v * intensity);
  // Bombeiros (Fase 7): no incêndio, lotes e prédios cobertos têm chance de escapar.
  const fireField = kind === "incendio" && s.buildings.some((b) => b.type === "fire_station") ? computeServices(s).fire : null;
  const saved = (i: number) => (fireField ? rand() < fireProtection(fireField[i]) : false);

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
    ].some(([dx, dy]) => {
      const t = next.terrain[(y + dy) * next.width + (x + dx)];
      return t === 1 || t === 2;
    });
  };
  for (let i = developed.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [developed[i], developed[j]] = [developed[j], developed[i]];
  }
  // Enchente (Fase 9): primeiro os lotes à beira d'água, e entre eles os mais baixos.
  const low = (i: number) => -(next.elevation?.[i] ?? 0);
  if (kind === "enchente") developed.sort((a, b) => Number(nearWater(b)) - Number(nearWater(a)) || low(b) - low(a));
  let lotsDamaged = 0;
  let lotLevelsLost = 0;
  let firefighters = 0;
  for (const i of developed.slice(0, scaled(cfg.lots))) {
    if (saved(i)) {
      firefighters++;
      continue;
    }
    const lost = Math.min(next.zoneLevel[i], cfg.levels);
    next.zoneLevel[i] -= lost;
    lotLevelsLost += lost;
    lotsDamaged++;
  }

  // Construções danificadas (só no desastre normal): param até o reparo.
  const candidates = next.buildings.filter((b) => !b.damaged && b.type !== "road" && b.type !== "cityhall");
  for (let i = candidates.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
  }
  const buildingsDamaged: DisasterReport["buildingsDamaged"] = [];
  for (const b of candidates.slice(0, scaled(cfg.buildings))) {
    if (saved(b.y * next.width + b.x)) {
      firefighters++;
      continue;
    }
    b.damaged = true;
    buildingsDamaged.push({ type: b.type, x: b.x, y: b.y, repair: repairCost(b.type) });
  }

  // Estoque atingido.
  const resourcesLost: Inventory = {};
  const res = STOCK_HIT[kind];
  let stockValue = 0;
  const share = Math.min(0.9, cfg.stock * intensity);
  for (const r of RANKS) {
    const have = getQty(next.inventory, res, r);
    const lost = Math.ceil(have * share);
    if (lost <= 0) continue;
    next.inventory[`${res}:${r}`] = have - lost;
    if (next.inventory[`${res}:${r}`] === 0) delete next.inventory[`${res}:${r}`];
    addTo(resourcesLost, res, r, lost);
    stockValue += lost * BASE_PRICE[res];
  }

  // Custo de limpeza.
  const moneyLost = Math.max(0, Math.min(scaled(cfg.moneyCap), Math.floor(Math.max(0, next.money) * cfg.money * intensity)));
  next.money -= moneyLost;

  // Prejuízo e seguro (a cobertura é avaliada antes de registrar o desastre).
  const damageValue = Math.round(
    lotLevelsLost * LOT_LEVEL_VALUE + stockValue + moneyLost + buildingsDamaged.reduce((acc, b) => acc + b.repair, 0),
  );
  const covered = isCovered(s);
  const payout = payoutFor(s, damageValue);
  if (payout > 0) {
    next.money += payout;
    next.insurance = {
      ...next.insurance,
      lastClaimCycle: next.cyclesCompleted,
      bonusMalus: Math.min(BONUS_MAX, Math.round((next.insurance.bonusMalus + 0.2) * 100) / 100),
    };
  }

  next.disasterCount++;
  next.lastDisasterCycle = next.cyclesCompleted;
  if (cause !== "closed_without_exit") next.breaks++;
  next.version++;

  return {
    state: next,
    report: {
      kind,
      name: DISASTER_NAMES[kind],
      severity,
      cause,
      intensity,
      lotsDamaged,
      savedByFirefighters: firefighters,
      buildingsDamaged,
      resourcesLost,
      moneyLost,
      damageValue,
      insurance: { covered, payout, waitingLeft: waitingLeft(s), plan: s.insurance.plan },
    },
  };
}
