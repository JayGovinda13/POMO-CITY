import { annualRain, biomeOf, REGION_BY_ID } from "./climate";
import { ZONE, type CityState } from "./types";
import { createCity } from "./world";

/** Trimestre real (UTC) de um instante: 0 = Jan–Mar. */
export const realQuarter = (now: number) => Math.floor(new Date(now).getUTCMonth() / 3);

/** Cidade ainda intocada: só a prefeitura, nada zoneado e nenhum ciclo concluído. */
export function isPristine(s: CityState): boolean {
  return (
    s.cyclesCompleted === 0 &&
    s.buildings.every((b) => b.type === "cityhall") &&
    s.zoneType.every((z) => z === ZONE.NONE) &&
    s.wires.every((w) => w === 0)
  );
}

export type FoundResult = { ok: true; state: CityState } | { ok: false; error: string };

/**
 * Define a região climática da cidade (uma única vez).
 * - Cidade intocada: o mapa é gerado de novo com o bioma e a umidade do clima, e o
 *   calendário começa na estação real atual da região.
 * - Cidade já construída: mantém mapa, bioma e calendário; só passa a viver o clima.
 */
export function foundCity(s: CityState, regionId: string, now: number): FoundResult {
  const region = REGION_BY_ID[regionId];
  if (!region) return { ok: false, error: "Região desconhecida" };
  if (s.regionId) return { ok: false, error: "A região da cidade já foi escolhida" };

  if (!isPristine(s)) {
    return { ok: true, state: { ...structuredClone(s), regionId, version: s.version + 1 } };
  }
  const wetness = Math.max(0, Math.min(1, annualRain(region) / 2000));
  const fresh = createCity(s.seed, now, biomeOf(region), { wetness });
  return {
    ok: true,
    state: {
      ...fresh,
      // Progresso pessoal (foco) não pertence ao mapa: é preservado.
      streak: s.streak,
      streakFrozen: s.streakFrozen,
      lastCycleAt: s.lastCycleAt,
      dayKey: s.dayKey,
      cyclesToday: s.cyclesToday,
      regionId,
      calendarOffset: realQuarter(now),
      version: s.version + 1,
    },
  };
}

/**
 * Novo jogo: cidade nova (região a escolher), preservando a sequência de foco e o limite
 * diário — o foco é do jogador, não da cidade, e recomeçar não pode servir para burlar o limite.
 */
export function newGame(old: CityState, seed: number, now: number): CityState {
  const fresh = createCity(seed, now);
  return {
    ...fresh,
    streak: old.streak,
    streakFrozen: old.streakFrozen,
    lastCycleAt: old.lastCycleAt,
    dayKey: old.dayKey,
    cyclesToday: old.cyclesToday,
    version: old.version + 1,
  };
}
