import type { Requirement } from "./catalog";
import type { CityState } from "./types";
import { cityYear } from "./world";

/** null = liberado; caso contrário, o motivo do bloqueio. */
export function lockReason(req: Requirement | undefined, s: CityState): string | null {
  if (!req) return null;
  if (req.year !== undefined && cityYear(s) < req.year) return `Disponível em ${req.year}`;
  if (req.population !== undefined && s.population < req.population) {
    return `Requer ${req.population} habitantes`;
  }
  return null;
}

export const isUnlocked = (req: Requirement | undefined, s: CityState) => lockReason(req, s) === null;
