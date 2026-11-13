import { annualRain, biomeOf, REGION_BY_ID } from "./climate";
import { BOND_VALUE, DIFFICULTY, creditRating, type Difficulty } from "./finance";
import { ZONE, type CityState } from "./types";
import { createCity, isHall } from "./world";
import { MAP_SIZE } from "./config";
import { COAST_NAMES, RELIEF_NAMES, WATER_NAMES, defaultMapOptions, type MapOptions } from "./terrain";
import type { BiomeId } from "./types";

/** Valida as opções do editor vindas do cliente (o que for inválido usa o padrão do bioma). */
export function sanitizeMapOptions(raw: unknown, biome: BiomeId, wetness: number): MapOptions {
  const d = defaultMapOptions(biome, wetness);
  if (!raw || typeof raw !== "object") return d;
  const o = raw as Record<string, unknown>;
  return {
    relief: typeof o.relief === "string" && o.relief in RELIEF_NAMES ? (o.relief as MapOptions["relief"]) : d.relief,
    water: typeof o.water === "string" && o.water in WATER_NAMES ? (o.water as MapOptions["water"]) : d.water,
    coast: typeof o.coast === "string" && o.coast in COAST_NAMES ? (o.coast as MapOptions["coast"]) : d.coast,
    forest: o.forest === 0 || o.forest === 1 || o.forest === 2 || o.forest === 3 ? o.forest : d.forest,
    variant: typeof o.variant === "number" && Number.isInteger(o.variant) && o.variant >= 0 && o.variant < 1e6 ? o.variant : 0,
  };
}

/** Trimestre real (UTC) de um instante: 0 = Jan–Mar. */
export const realQuarter = (now: number) => Math.floor(new Date(now).getUTCMonth() / 3);

/** Cidade ainda intocada: só a prefeitura, nada zoneado e nenhum ciclo concluído. */
export function isPristine(s: CityState): boolean {
  return (
    s.cyclesCompleted === 0 &&
    s.buildings.every(isHall) &&
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
export const CITY_NAME_MAX = 28;

/** Limpa o nome digitado: sem caracteres de controle, espaços colapsados, até 28 letras. null = vazio. */
export function sanitizeCityName(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const name = raw
    .normalize("NFC")
    .replace(/[\p{C}<>]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
  return name ? [...name].slice(0, CITY_NAME_MAX).join("").trim() : null;
}

/** Nome para exibir: o escolhido pelo jogador ou, sem nome, o da região. */
export function cityDisplayName(s: Pick<CityState, "name" | "regionId">): string {
  if (s.name) return s.name;
  const region = s.regionId ? REGION_BY_ID[s.regionId] : null;
  return region ? region.name.replace(/\s*\(.*\)$/, "") : "Cidade sem nome";
}

export function foundCity(
  s: CityState,
  regionId: string,
  now: number,
  difficulty: Difficulty = "medio",
  rawName?: unknown,
  map?: MapOptions,
): FoundResult {
  const name = sanitizeCityName(rawName);
  const region = REGION_BY_ID[regionId];
  if (!region) return { ok: false, error: "Região desconhecida" };
  if (s.regionId) return { ok: false, error: "A região da cidade já foi escolhida" };
  if (!(difficulty in DIFFICULTY)) return { ok: false, error: "Dificuldade inválida" };

  if (!isPristine(s)) {
    return { ok: true, state: { ...structuredClone(s), regionId, ...(name ? { name } : {}), version: s.version + 1 } };
  }
  const wetness = Math.max(0, Math.min(1, annualRain(region) / 2000));
  // Fase 9: mapa 40×40 com relevo, água e mata do editor (padrão: pelo bioma e pela chuva).
  const biome = biomeOf(region);
  const fresh = createCity(s.seed, now, biome, { wetness, size: MAP_SIZE, map: sanitizeMapOptions(map, biome, wetness) });
  // Dificuldade (Fase 4): dinheiro inicial e, no difícil, um título já emitido.
  const d = DIFFICULTY[difficulty];
  fresh.difficulty = difficulty;
  fresh.money = d.money;
  for (let k = 0; k < d.bonds; k++) {
    fresh.bonds.push({ id: fresh.nextBondId++, principal: BOND_VALUE, rate: creditRating(fresh).rate + 0.02, issuedCycle: 0 });
    fresh.money += BOND_VALUE;
  }
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
      ...(name ? { name } : {}),
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
