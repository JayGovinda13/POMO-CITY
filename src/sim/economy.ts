// Fase 3 — Economia de recursos.
// Os cidadãos e as obras consomem recursos. O que falta é comprado automaticamente no
// mercado externo (dá para jogar só com dinheiro), mas importar custa mais do que produzir.
// O excedente segue a política de cada recurso (estocar, vender…) e o estoque tem limite.

import { BUILDINGS, type MaterialCost } from "./catalog";
import { effectsOf, weatherAt } from "./climate";
import { addTo, getQty, invKey, rankIndex } from "./inventory";
import { RANKS, type CityState, type ClimateEffects, type Inventory, type Rank, type ResourceId } from "./types";

export const RESOURCE_IDS: ResourceId[] = ["food", "wood", "ore", "planks", "metal", "goods"];

export { RANK_YIELD, DEFAULT_POLICIES } from "./config";
import { FOOD_PER_RESIDENT, RANK_YIELD } from "./config";

/** O mercado externo só negocia até o Rank B: A e S vêm do foco ou de outros jogadores. */
export const MARKET_MAX_RANK: Rank = "B";
export const IMPORT_MARKUP = 1.25;
export const EXPORT_FACTOR = 0.8;

/** Preço base de 1 unidade Rank D. */
export const BASE_PRICE: Record<ResourceId, number> = { food: 3, wood: 2, ore: 3, planks: 5, metal: 8, goods: 6 };

const round2 = (v: number) => Math.round(v * 100) / 100;

/** Preço base na estação: comida encarece quando a colheita é ruim (inverno, seca). */
export function basePrice(res: ResourceId, effects: ClimateEffects): number {
  if (res !== "food") return BASE_PRICE[res];
  const factor = Math.max(0.8, Math.min(1.6, 1 + (1 - effects.farm) * 0.6));
  return round2(BASE_PRICE.food * factor);
}

export const importPrice = (res: ResourceId, rank: Rank, effects: ClimateEffects) =>
  round2(basePrice(res, effects) * IMPORT_MARKUP * RANK_YIELD[rank]);

/** O mercado externo paga no máximo o valor de B. */
export const exportPrice = (res: ResourceId, rank: Rank, effects: ClimateEffects) =>
  round2(basePrice(res, effects) * EXPORT_FACTOR * RANK_YIELD[rankIndex(rank) > rankIndex(MARKET_MAX_RANK) ? MARKET_MAX_RANK : rank]);

export const currentEffects = (s: CityState) => effectsOf(weatherAt(s));

// ───────────────────────── rendimento equivalente ─────────────────────────

/** Total disponível em unidades-equivalentes (D = 1) com rank >= minRank. */
export function equivalentAvailable(inv: Inventory, res: ResourceId, minRank: Rank = "D"): number {
  let sum = 0;
  for (let i = rankIndex(minRank); i < RANKS.length; i++) sum += getQty(inv, res, RANKS[i]) * RANK_YIELD[RANKS[i]];
  return round2(sum);
}

/**
 * Consome `need` unidades-equivalentes do estoque (muta `inv`). `prefer: "low"` gasta primeiro
 * os ranks baixos (poupa o premium). Retorna o que foi tirado e o que faltou.
 */
export function consumeEquivalent(
  inv: Inventory,
  res: ResourceId,
  need: number,
  opts: { minRank?: Rank; prefer?: "low" | "high" } = {},
): { taken: Partial<Record<Rank, number>>; shortfall: number } {
  const order = RANKS.slice(rankIndex(opts.minRank ?? "D"));
  if (opts.prefer === "high") order.reverse();
  const taken: Partial<Record<Rank, number>> = {};
  let left = need;
  for (const r of order) {
    if (left <= 1e-9) break;
    const have = getQty(inv, res, r);
    if (!have) continue;
    const units = Math.min(have, Math.ceil(left / RANK_YIELD[r] - 1e-9));
    const k = invKey(res, r);
    inv[k] = have - units;
    if (inv[k] === 0) delete inv[k];
    taken[r] = units;
    left -= units * RANK_YIELD[r];
  }
  return { taken, shortfall: Math.max(0, round2(left)) };
}

/** Rank mais barato que o mercado vende para um requisito mínimo (null se o mercado não vende). */
export function importRank(minRank: Rank = "D"): Rank | null {
  return rankIndex(minRank) <= rankIndex(MARKET_MAX_RANK) ? minRank : null;
}

/** Unidades e custo para cobrir `shortfall` unidades-equivalentes importando. */
export function importQuote(res: ResourceId, shortfall: number, minRank: Rank, effects: ClimateEffects) {
  const rank = importRank(minRank);
  if (!rank || shortfall <= 0) return { rank, units: 0, cost: 0 };
  const units = Math.ceil(shortfall / RANK_YIELD[rank] - 1e-9);
  return { rank, units, cost: Math.ceil(units * importPrice(res, rank, effects)) };
}

// ───────────────────────── materiais de obras ─────────────────────────

export interface MaterialsQuote {
  /** Custo extra em dinheiro para importar o que falta. */
  importCost: number;
  /** Materiais a importar (unidades). */
  imports: { res: ResourceId; rank: Rank; units: number }[];
  /** Motivo, se algo não pode ser importado (ex.: Rank S). */
  impossible: string | null;
}

export function quoteMaterials(s: CityState, materials: MaterialCost[] | undefined, effects = currentEffects(s)): MaterialsQuote {
  const out: MaterialsQuote = { importCost: 0, imports: [], impossible: null };
  for (const m of materials ?? []) {
    const minRank = m.minRank ?? "D";
    const missing = Math.max(0, m.qty - equivalentAvailable(s.inventory, m.resource, minRank));
    if (missing <= 0) continue;
    const q = importQuote(m.resource, missing, minRank, effects);
    if (!q.rank) {
      out.impossible = `Requer ${m.qty} ${RESOURCE_NAMES[m.resource]} rank ${minRank}+ (o mercado externo só vende até ${MARKET_MAX_RANK})`;
      continue;
    }
    out.importCost += q.cost;
    out.imports.push({ res: m.resource, rank: q.rank, units: q.units });
  }
  return out;
}

/** Paga os materiais (estoque primeiro, depois importação). Muta `s`. Supõe que a cotação foi validada. */
export function payMaterials(
  s: CityState,
  materials: MaterialCost[] | undefined,
  effects = currentEffects(s),
  record?: { consumed: Inventory; bought: Inventory },
): number {
  let cost = 0;
  for (const m of materials ?? []) {
    const minRank = m.minRank ?? "D";
    // Gasta o mínimo de qualidade necessário, preservando o excedente premium.
    const { taken, shortfall } = consumeEquivalent(s.inventory, m.resource, m.qty, { minRank, prefer: "low" });
    if (record) for (const r of RANKS) addTo(record.consumed, m.resource, r, taken[r] ?? 0);
    if (shortfall > 0) {
      const q = importQuote(m.resource, shortfall, minRank, effects);
      if (!q.rank) continue;
      cost += q.cost;
      if (record) {
        addTo(record.bought, m.resource, q.rank, q.units);
        addTo(record.consumed, m.resource, q.rank, q.units);
      }
    }
  }
  s.money -= cost;
  return cost;
}

// ───────────────────────── estoque ─────────────────────────

export const BASE_STORAGE = 100;

/** Capacidade de estoque por recurso (todas as qualidades somadas). */
export function storageCapacity(s: CityState): Record<ResourceId, number> {
  const cap = Object.fromEntries(RESOURCE_IDS.map((r) => [r, BASE_STORAGE])) as Record<ResourceId, number>;
  for (const b of s.buildings) {
    const st = BUILDINGS[b.type].storage;
    if (!st) continue;
    for (const [res, add] of Object.entries(st)) cap[res as ResourceId] += add!;
  }
  return cap;
}

export const stockOf = (inv: Inventory, res: ResourceId) => RANKS.reduce((acc, r) => acc + getQty(inv, res, r), 0);

// ───────────────────────── políticas de excedente ─────────────────────────

export type PolicyMode = "stock" | "sell_surplus" | "sell_percent" | "reserve";

export interface Policy {
  mode: PolicyMode;
  /** sell_percent: 0..100 · reserve: estações de reserva (1..8). */
  value: number;
}

export const POLICY_LABELS: Record<PolicyMode, string> = {
  stock: "Estocar tudo",
  sell_surplus: "Vender o excedente",
  sell_percent: "Vender % do excedente",
  reserve: "Manter reserva e vender o resto",
};


export const RESOURCE_NAMES: Record<ResourceId, string> = {
  food: "comida",
  wood: "madeira",
  ore: "minério",
  planks: "tábuas",
  metal: "metal",
  goods: "bens",
};

export function validatePolicy(p: Policy): string | null {
  if (!(p.mode in POLICY_LABELS)) return "Política inválida";
  if (!Number.isFinite(p.value)) return "Valor inválido";
  if (p.mode === "sell_percent" && (p.value < 0 || p.value > 100)) return "Use de 0 a 100%";
  if (p.mode === "reserve" && (p.value < 1 || p.value > 8)) return "Reserva de 1 a 8 estações";
  return null;
}

/** Vende `units` (ranks D..B primeiro, do mais barato ao mais caro). Muta `inv`. */
export function sellUnits(
  inv: Inventory,
  res: ResourceId,
  units: number,
  effects: ClimateEffects,
  opts: { allowPremium?: boolean } = {},
): { sold: Partial<Record<Rank, number>>; revenue: number } {
  const ranks = opts.allowPremium ? RANKS : RANKS.slice(0, rankIndex(MARKET_MAX_RANK) + 1);
  const sold: Partial<Record<Rank, number>> = {};
  let left = Math.floor(units);
  let revenue = 0;
  for (const r of ranks) {
    if (left <= 0) break;
    const have = getQty(inv, res, r);
    const n = Math.min(have, left);
    if (!n) continue;
    const k = invKey(res, r);
    inv[k] = have - n;
    if (inv[k] === 0) delete inv[k];
    sold[r] = n;
    left -= n;
    revenue += n * exportPrice(res, r, effects);
  }
  return { sold, revenue: Math.floor(revenue) };
}

/** Quantas unidades a política manda vender, dada a demanda do último ciclo (em unidades). */
export function unitsToSell(policy: Policy, sellable: number, demand: number): number {
  switch (policy.mode) {
    case "stock":
      return 0;
    case "sell_surplus":
      return Math.max(0, sellable - Math.ceil(demand));
    case "sell_percent":
      return Math.floor((Math.max(0, sellable - Math.ceil(demand)) * policy.value) / 100);
    case "reserve":
      return Math.max(0, sellable - Math.ceil(demand * policy.value));
  }
}

/** Comida garantida no próximo ciclo: em estoque ou com dinheiro para comprar. */
export function foodSecure(s: CityState): boolean {
  const missing = s.citizens.length * FOOD_PER_RESIDENT - equivalentAvailable(s.inventory, "food");
  if (missing <= 0) return true;
  return s.money >= importQuote("food", missing, "D", currentEffects(s)).cost;
}
