import { RANKS, type Inventory, type InventoryKey, type Rank, type ResourceId } from "./types";

export const invKey = (resource: ResourceId, rank: Rank): InventoryKey => `${resource}:${rank}`;
export const rankIndex = (rank: Rank) => RANKS.indexOf(rank);

export function getQty(inv: Inventory, resource: ResourceId, rank: Rank): number {
  return inv[invKey(resource, rank)] ?? 0;
}

export function addTo(inv: Inventory, resource: ResourceId, rank: Rank, qty: number): void {
  if (qty <= 0) return;
  const k = invKey(resource, rank);
  inv[k] = (inv[k] ?? 0) + qty;
}

/** Quantidade total disponível com rank >= minRank. */
export function totalAtLeast(inv: Inventory, resource: ResourceId, minRank: Rank = "D"): number {
  let sum = 0;
  for (let i = rankIndex(minRank); i < RANKS.length; i++) sum += getQty(inv, resource, RANKS[i]);
  return sum;
}

/**
 * Retira `qty` unidades com rank >= minRank. `prefer` define a ordem:
 * "low" gasta primeiro os ranks baixos (poupa o premium), "high" o contrário.
 * Retorna as unidades retiradas por rank, ou null se não houver o suficiente.
 */
export function take(
  inv: Inventory,
  resource: ResourceId,
  qty: number,
  opts: { minRank?: Rank; prefer?: "low" | "high" } = {},
): Partial<Record<Rank, number>> | null {
  const minRank = opts.minRank ?? "D";
  if (totalAtLeast(inv, resource, minRank) < qty) return null;
  const order = RANKS.slice(rankIndex(minRank));
  if (opts.prefer === "high") order.reverse();
  const taken: Partial<Record<Rank, number>> = {};
  let left = qty;
  for (const r of order) {
    if (left <= 0) break;
    const have = getQty(inv, resource, r);
    const t = Math.min(have, left);
    if (t > 0) {
      const k = invKey(resource, r);
      inv[k] = have - t;
      if (inv[k] === 0) delete inv[k];
      taken[r] = t;
      left -= t;
    }
  }
  return taken;
}

/** Rank médio ponderado (arredondado para baixo) de um lote retirado. */
export function averageRank(taken: Partial<Record<Rank, number>>): Rank {
  let units = 0;
  let weighted = 0;
  for (const r of RANKS) {
    const q = taken[r] ?? 0;
    units += q;
    weighted += q * rankIndex(r);
  }
  if (units === 0) return "D";
  return RANKS[Math.floor(weighted / units)];
}

export const minRank = (a: Rank, b: Rank): Rank => (rankIndex(a) <= rankIndex(b) ? a : b);
