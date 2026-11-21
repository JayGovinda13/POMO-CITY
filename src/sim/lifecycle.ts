// Capital e tempo (Livro 2 de O Capital): obras grandes levam vários ciclos com o dinheiro parado,
// máquinas e usinas se desgastam e precisam ser renovadas, estoque custa guardar e o transporte
// barateia o comércio com o exterior.

import { BUILDINGS } from "./catalog";
import type { Building, BuildingType, CityState } from "./types";

// ───────────────────────── obras longas ─────────────────────────

/** Ciclos de obra de cada construção, pelo custo (casas, estradas e prédios pequenos são imediatos). */
export function buildCyclesOf(type: BuildingType): number {
  const c = BUILDINGS[type]?.cost ?? 0;
  return c >= 12_000 ? 4 : c >= 3_000 ? 3 : c >= 1_200 ? 2 : c >= 900 ? 1 : 0;
}

/** Em obra: ainda não opera (e não contrata) até o ciclo `readyAt`. */
export const underConstruction = (b: Pick<Building, "readyAt">, s: Pick<CityState, "cyclesCompleted">): boolean =>
  b.readyAt !== undefined && s.cyclesCompleted < b.readyAt;

/** Parada: danificada por desastre ou ainda em obra. */
export const isDown = (b: Pick<Building, "damaged" | "readyAt">, s: Pick<CityState, "cyclesCompleted">): boolean => !!b.damaged || underConstruction(b, s);

/** Ciclos que faltam para a obra ficar pronta. */
export const cyclesToReady = (b: Pick<Building, "readyAt">, s: Pick<CityState, "cyclesCompleted">): number =>
  b.readyAt === undefined ? 0 : Math.max(0, b.readyAt - s.cyclesCompleted);

/** Capital parado: durante a obra, o dinheiro já gasto rende juros (2% do custo por ciclo). */
export const CARRY_RATE = 0.02;
export const carryingCost = (type: BuildingType): number => Math.ceil((BUILDINGS[type]?.cost ?? 0) * CARRY_RATE);

// ───────────────────────── desgaste e renovação ─────────────────────────

/** Vida útil, em ciclos (4 ciclos = 1 ano), das construções que produzem ou geram energia e água. */
export const LIFE: Partial<Record<BuildingType, number>> = {
  farm: 80,
  lumberyard: 80,
  mine: 60,
  sawmill: 60,
  smelter: 60,
  thermal_plant: 80,
  wind_turbine: 60,
  hydro_plant: 120,
  solar_plant: 100,
  nuclear_plant: 120,
  fusion_plant: 160,
  water_pump: 80,
  water_treatment: 80,
  recycling_center: 80,
  desalination: 80,
};

/** Idade da construção em ciclos (saves antigos começam do zero). */
export const ageOf = (b: Pick<Building, "builtAt">, s: Pick<CityState, "cyclesCompleted">): number => Math.max(0, s.cyclesCompleted - (b.builtAt ?? s.cyclesCompleted));

/**
 * Rendimento pelo desgaste: 100% até o fim da vida útil; depois cai até 50% em 1,5× a vida útil.
 * Construções sem vida útil não se desgastam.
 */
export function wearFactor(b: Pick<Building, "type" | "builtAt">, s: Pick<CityState, "cyclesCompleted">): number {
  const life = LIFE[b.type];
  if (!life) return 1;
  const over = ageOf(b, s) - life;
  return over <= 0 ? 1 : 1 - Math.min(0.5, over / life);
}

/** Renovar custa 35% do preço da construção e zera a idade. */
export const renewCost = (type: BuildingType): number => Math.ceil((BUILDINGS[type]?.cost ?? 0) * 0.35);

// ───────────────────────── armazenagem ─────────────────────────

/**
 * Custo de guardar: 1% por ciclo do valor do estoque que passa de um estoque de trabalho de $300
 * (o que sobra parado encarece; quem produz só o necessário não paga nada).
 */
export const STORAGE_RATE = 0.01;
export const STORAGE_FREE_VALUE = 300;

/** Valor do estoque em dinheiro (preço base × rendimento do rank). */
export function stockValue(inventory: Record<string, number>, prices: Record<string, number>, yields: Record<string, number>): number {
  let v = 0;
  for (const [key, qty] of Object.entries(inventory)) {
    const [res, rank] = key.split(":");
    v += qty * (prices[res] ?? 0) * (yields[rank] ?? 1);
  }
  return v;
}

export const storageCostOf = (value: number): number => Math.floor(Math.max(0, value - STORAGE_FREE_VALUE) * STORAGE_RATE);
