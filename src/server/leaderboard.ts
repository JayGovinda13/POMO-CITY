import "server-only";
import { rankEligible, advancementScore, cityDisplayName, cityValue, cityYear, currentEra, type CityState } from "@/sim";
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

/**
 * Publica a pontuação. Só entra no ranking a cidade fundada que nunca sofreu catástrofe
 * (ciclo quebrado): depois da primeira, ela sai do ranking e não volta mais.
 */
export async function publishScore(playerId: string, s: CityState): Promise<void> {
  if (!s.regionId) return;
  // O ranking é vitrine: nenhuma falha aqui pode atrapalhar o jogo.
  try {
    if (!rankEligible(s)) await repo().removeScore(playerId);
    else await repo().publishScore(playerId, leaderboardEntry(s));
  } catch (e) {
    console.error("leaderboard", e);
  }
}
