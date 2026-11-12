import "server-only";
import { advancementScore, cityDisplayName, cityValue, cityYear, currentEra, type CityState } from "@/sim";
import { repo, type LeaderboardEntry } from "./repo";

/** Linha do ranking a partir do estado da cidade. */
export function leaderboardEntry(s: CityState): LeaderboardEntry {
  return {
    cityName: cityDisplayName(s),
    region: s.regionId,
    score: advancementScore(s, cityValue(s)),
    techs: s.techs?.length ?? 0,
    population: s.population,
    year: cityYear(s),
    era: currentEra(s).name,
  };
}

/** Publica a pontuação (só cidades fundadas aparecem no ranking). */
export async function publishScore(playerId: string, s: CityState): Promise<void> {
  if (!s.regionId) return;
  await repo().publishScore(playerId, leaderboardEntry(s));
}
