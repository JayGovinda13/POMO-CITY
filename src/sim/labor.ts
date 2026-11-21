// Trabalho e salário: jornada e forma de pagamento por setor, e a automação que troca empregos por
// máquinas. Inspirado no Livro 1 de O Capital (jornada de trabalho, salário por tempo e por peça,
// maquinaria e desemprego). Tudo determinístico, como o resto da simulação.

import type { BuildingType, CityState } from "./types";
import { techMods } from "./tech";

/** Setores com regras próprias de trabalho. */
export type Sector = "campo" | "oficina" | "fabrica";
export const SECTOR_IDS: Sector[] = ["campo", "oficina", "fabrica"];

export const SECTORS: Record<Sector, { name: string; description: string }> = {
  campo: { name: "Campo", description: "Fazendas, madeireiras e minas" },
  oficina: { name: "Oficinas", description: "Serraria e fundição" },
  fabrica: { name: "Fábricas", description: "Zonas industriais (bens de consumo)" },
};

/** Setor de cada construção de produção (a zona industrial é sempre "fabrica"). */
export const SECTOR_OF_BUILDING: Partial<Record<BuildingType, Sector>> = {
  farm: "campo",
  lumberyard: "campo",
  mine: "campo",
  sawmill: "oficina",
  smelter: "oficina",
};

export type Hours = 6 | 8 | 10 | 12;
export const HOURS_OPTIONS: Hours[] = [6, 8, 10, 12];
export type Pay = "tempo" | "peca";
export const PAY_NAMES: Record<Pay, string> = { tempo: "Por tempo", peca: "Por peça" };

export interface SectorRules {
  hours: Hours;
  pay: Pay;
}
export type LaborRules = Record<Sector, SectorRules>;

export const DEFAULT_LABOR: LaborRules = {
  campo: { hours: 8, pay: "tempo" },
  oficina: { hours: 8, pay: "tempo" },
  fabrica: { hours: 8, pay: "tempo" },
};

/** Regras do setor (saves antigos sem o campo usam o padrão). */
export const rulesOf = (s: Pick<CityState, "labor">, sector: Sector): SectorRules => s.labor?.[sector] ?? DEFAULT_LABOR[sector];

const HOURS_OUTPUT: Record<Hours, number> = { 6: 0.88, 8: 1, 10: 1.12, 12: 1.22 };
/** Quem é pago por peça produz mais (e é mais pressionado). */
const PIECE_OUTPUT = 1.08;
const HOURS_MOOD: Record<Hours, number> = { 6: 1, 8: 0, 10: -1, 12: -3 };
const PIECE_MOOD = -1;

/** Multiplicador da produção do setor (jornada × forma de pagamento). */
export function outputFactor(s: Pick<CityState, "labor">, sector: Sector): number {
  const r = rulesOf(s, sector);
  return HOURS_OUTPUT[r.hours] * (r.pay === "peca" ? PIECE_OUTPUT : 1);
}

/** Motivos de humor dos trabalhadores do setor (somam ao humor de cada um). */
export function laborMood(s: Pick<CityState, "labor">, sector: Sector): { text: string; delta: number }[] {
  const r = rulesOf(s, sector);
  const out: { text: string; delta: number }[] = [];
  if (HOURS_MOOD[r.hours] !== 0) {
    out.push({ text: r.hours < 8 ? "Jornada curta" : r.hours === 10 ? "Jornada longa" : "Jornada exaustiva", delta: HOURS_MOOD[r.hours] });
  }
  if (r.pay === "peca") out.push({ text: "Pagamento por peça (ritmo puxado)", delta: PIECE_MOOD });
  return out;
}

/** Desgaste do setor, de 0 (descansado) a 1 (exaustão): horas acima de 8 e pagamento por peça. */
export function sectorFatigue(s: Pick<CityState, "labor">, sector: Sector): number {
  const r = rulesOf(s, sector);
  return Math.min(1, Math.max(0, r.hours - 8) / 4 + (r.pay === "peca" ? 0.15 : 0));
}

// ───────────────────────── automação ─────────────────────────

/** Teto de empregos industriais que a automação elimina. */
export const MAX_DISPLACED = 0.55;
/** Educação (QE) acima de 40 ajuda a realocar quem perde o emprego: até metade do efeito. */
const EQ_BASE = 40;

/** Quanto da automação a educação da cidade consegue compensar (0..0,5). */
export const educationRelief = (s: Pick<CityState, "eq">): number => Math.min(0.5, Math.max(0, ((s.eq ?? EQ_BASE) - EQ_BASE) / 200));

/** Fração dos empregos industriais eliminada pelas máquinas (0..MAX_DISPLACED). */
export function displacedJobs(s: Pick<CityState, "techs" | "eq">): number {
  return Math.min(MAX_DISPLACED, techMods(s).automation * (1 - educationRelief(s)));
}

/** Fator dos empregos que sobram (1 = nenhuma automação). */
export const jobFactor = (s: Pick<CityState, "techs" | "eq">): number => 1 - displacedJobs(s);

/** Empregos de um lote industrial, já descontada a automação. */
export const industrialLotJobs = (s: Pick<CityState, "techs" | "eq">, level: number, perLevel: number): number =>
  Math.round(level * perLevel * jobFactor(s));
