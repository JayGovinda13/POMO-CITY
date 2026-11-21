// Greves por causa: quando o trabalhador não chega ao emprego, o trânsito para a cidade e não há transporte
// público, faltam hospital, escola, segurança ou energia, uma fração dos trabalhadores cruza os braços.
// Quanto mais educada a população, mais ela reclama (greve mais provável) e mais produz.

import { computePower } from "./power";
import { computeServices } from "./services";
import { buildingStatus } from "./status";
import { computeTraffic, type TrafficResult } from "./traffic";
import { cityFatigue } from "./laborload";
import type { CityState } from "./types";

export interface StrikeCause {
  id: "caminho" | "transito" | "saude" | "escola" | "crime" | "poluicao" | "energia" | "jornada";
  text: string;
  /** Fração dos trabalhadores parada por esta causa (já com o efeito da educação). */
  share: number;
}

export interface StrikeState {
  /** Fração dos trabalhadores em greve (0..MAX_STRIKE). */
  share: number;
  causes: StrikeCause[];
}

export const NO_STRIKE: StrikeState = { share: 0, causes: [] };
export const MAX_STRIKE = 0.7;

/** Populações menores que isto não fazem greve (ninguém se organiza). */
const MIN_POPULATION = 20;

/** Educação alta reclama mais: 0,75× sem estudo até cerca de 2× com QE 150. */
export const educationStrikeFactor = (eq: number): number => 0.75 + Math.max(0, eq) / 120;

/** Educação alta produz mais: +25% com QE 140 (nada abaixo de 40). */
export const educationProductivity = (eq: number | undefined): number => 1 + Math.max(0, (eq ?? 40) - 40) / 400;

/** Trabalhadores que estão trabalhando (os grevistas ficam de fora). */
export const activeWorkers = (s: Pick<CityState, "population" | "strike">): number => Math.max(0, Math.floor(s.population * (1 - (s.strike?.share ?? 0))));

/**
 * Calcula a greve do ciclo a partir das condições atuais da cidade. Função pura: serve ao ciclo (que
 * grava o resultado) e à tela (que mostra o que vai acontecer se nada mudar).
 */
export function computeStrike(s: CityState, traffic: TrafficResult = computeTraffic(s)): StrikeState {
  if (s.population < MIN_POPULATION) return NO_STRIKE;
  const power = computePower(s);
  const status = buildingStatus(s, power.powered);
  const f = computeServices(s, status, traffic);
  const raw: StrikeCause[] = [];
  const add = (id: StrikeCause["id"], text: string, share: number) => {
    if (share > 0.002) raw.push({ id, text, share });
  };

  // 1) Sem caminho até o emprego: quem não chega não trabalha.
  add("caminho", "Sem caminho até o emprego", traffic.failedShare);
  // 2) Trânsito parado e nenhum transporte público.
  const hasTransit = traffic.transit.some((v) => v === 1);
  if (!hasTransit && traffic.congestionShare > 0.15) add("transito", "Trânsito parado e sem transporte público", Math.min(0.25, traffic.congestionShare * 0.6));
  // 3) Saúde, escola, segurança, ar e energia.
  if (s.population >= 60 && f.healthServed < 0.3) add("saude", "Sem hospital para os trabalhadores", ((0.3 - f.healthServed) / 0.3) * 0.1);
  if (s.population >= 80 && f.schoolServed < 0.5) add("escola", "Sem escolas para os filhos", ((0.5 - f.schoolServed) / 0.5) * 0.06);
  if (f.avg.crime > 45) add("crime", "Bairros perigosos", Math.min(0.1, ((f.avg.crime - 45) / 45) * 0.1));
  if (f.avg.pollution > 40) add("poluicao", "Ar poluído", Math.min(0.08, ((f.avg.pollution - 40) / 60) * 0.08));
  if (power.brownout && power.demand > 0) add("energia", "Apagões", Math.min(0.08, (1 - power.supplied / power.demand) * 0.16));
  // 4) Jornada longa e pagamento por peça (Trabalho).
  add("jornada", "Jornada exaustiva", cityFatigue(s, status) * 0.2);

  const k = educationStrikeFactor(s.eq ?? 40);
  let total = 0;
  const causes = raw.map((c) => ({ ...c, share: Math.round(c.share * k * 1000) / 1000 }));
  for (const c of causes) total += c.share;
  const share = Math.min(MAX_STRIKE, Math.round(total * 1000) / 1000);
  // Se passou do teto, reparte o teto proporcionalmente entre as causas.
  const scale = total > MAX_STRIKE ? MAX_STRIKE / total : 1;
  return { share, causes: causes.map((c) => ({ ...c, share: Math.round(c.share * scale * 1000) / 1000 })).sort((a, b) => b.share - a.share) };
}
