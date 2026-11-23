// Trabalho e salário: jornada e forma de pagamento por setor, e a automação que troca empregos por
// máquinas. Inspirado no Livro 1 de O Capital (jornada de trabalho, salário por tempo e por peça,
// maquinaria e desemprego). Tudo determinístico, como o resto da simulação.

import type { BuildingType, CityState } from "./types";
import { techMods } from "./tech";
import { educationProductivity } from "./strikes";
import { hasLaw } from "./laws";

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

/** O que as regras de trabalho leem da cidade. */
export type LaborCity = Pick<CityState, "labor" | "buildings" | "ordinances"> & Partial<Pick<CityState, "cyclesCompleted" | "eq" | "council">>;

/** Regras do setor (saves antigos sem o campo usam o padrão). */
export const rulesOf = (s: Pick<CityState, "labor">, sector: Sector): SectorRules => s.labor?.[sector] ?? DEFAULT_LABOR[sector];

/** Há fiscais de fábrica trabalhando? (Fiscalização do Trabalho que não foi danificada.) */
export const inspected = (s: Pick<CityState, "buildings"> & Partial<Pick<CityState, "cyclesCompleted" | "council">>): boolean =>
  hasLaw(s, "fiscalizacao") ||
  s.buildings.some((b) => b.type === "labor_office" && !b.damaged && (b.readyAt === undefined || (s.cyclesCompleted ?? 0) >= b.readyAt));

/** Decreto "Escola-fábrica" em vigor? */
export const schoolFactory = (s: Pick<CityState, "ordinances">): boolean => s.ordinances?.escola_fabrica !== undefined;

/** Produtividade de cada hora trabalhada: descansados rendem mais por hora (a jornada longa rende mais no total, mas cansa). */
const HOURS_OUTPUT: Record<Hours, number> = { 6: 1.08, 8: 1, 10: 1.1, 12: 1.18 };
/** Quem é pago por peça produz mais (e é mais pressionado). */
const PIECE_OUTPUT = 1.08;
const HOURS_MOOD: Record<Hours, number> = { 6: 1, 8: 0, 10: -1, 12: -3 };
const PIECE_MOOD = -1;

/**
 * Turnos: jornada curta exige mais gente para manter as máquinas funcionando o dia todo (6 h = 1,17× as vagas),
 * e jornada longa exige menos (12 h = 0,83×); o outro tanto é absorvido por ritmo e revezamento. É assim que reduzir a jornada combate o desemprego.
 */
export const shiftFactor = (s: Pick<CityState, "labor">, sector: Sector): number => 1 + (8 / rulesOf(s, sector).hours - 1) / 2;

/** Humor da cidade → produtividade: de −15% (todo mundo triste) a +15% (todo mundo feliz). `approval` vai de −1 a 1. */
export const moodOutput = (approval: number): number => 1 + Math.max(-1, Math.min(1, approval)) * 0.15;

/** Multiplicador da produção do setor (jornada × forma de pagamento). */
export function outputFactor(s: LaborCity, sector: Sector): number {
  const r = rulesOf(s, sector);
  const raw = HOURS_OUTPUT[r.hours] * (r.pay === "peca" ? PIECE_OUTPUT : 1);
  // Fiscais cortam pela metade o ganho de produção acima do normal (a jornada curta não muda).
  const f = raw > 1 && inspected(s) && (r.hours > 8 || r.pay === "peca") ? 1 + (raw - 1) / 2 : raw;
  // Aprendizes na escola-fábrica: a indústria perde 8% da produção.
  const school = sector === "fabrica" && schoolFactory(s) ? f * 0.92 : f;
  // Trabalhadores mais educados produzem mais (até +25%).
  return school * educationProductivity(s.eq);
}

/** Motivos de humor dos trabalhadores do setor (somam ao humor de cada um). */
export function laborMood(s: LaborCity, sector: Sector): { text: string; delta: number }[] {
  const r = rulesOf(s, sector);
  const out: { text: string; delta: number }[] = [];
  // Fiscais seguram o dano: os pesos negativos caem pela metade (o arredondamento é para o lado do zero).
  const shield = (d: number) => (d < 0 && inspected(s) ? Math.trunc(d / 2) : d);
  const hours = shield(HOURS_MOOD[r.hours]);
  if (hours !== 0) out.push({ text: r.hours < 8 ? "Jornada curta" : r.hours === 10 ? "Jornada longa" : "Jornada exaustiva", delta: hours });
  const piece = r.pay === "peca" ? shield(PIECE_MOOD) : 0;
  if (piece !== 0) out.push({ text: "Pagamento por peça (ritmo puxado)", delta: piece });
  return out;
}

/** Desgaste do setor, de 0 (descansado) a 1 (exaustão): horas acima de 8 e pagamento por peça. */
export function sectorFatigue(s: LaborCity, sector: Sector): number {
  const r = rulesOf(s, sector);
  const raw = Math.min(1, Math.max(0, r.hours - 8) / 4 + (r.pay === "peca" ? 0.15 : 0));
  return inspected(s) ? raw / 2 : raw;
}

// ───────────────────────── automação ─────────────────────────

/** Teto de empregos industriais que a automação elimina. */
export const MAX_DISPLACED = 0.55;
/** Educação (QE) acima de 40 ajuda a realocar quem perde o emprego: até metade do efeito. */
const EQ_BASE = 40;

/** Quanto da automação a educação da cidade consegue compensar (0..0,5). */
export const educationRelief = (s: Pick<CityState, "eq"> & Partial<Pick<CityState, "ordinances">>): number =>
  Math.min(0.5, Math.max(0, ((s.eq ?? EQ_BASE) - EQ_BASE) / 200) + (s.ordinances && schoolFactory({ ordinances: s.ordinances }) ? 0.1 : 0));

/** Fração dos empregos industriais eliminada pelas máquinas (0..MAX_DISPLACED). */
export function displacedJobs(s: Pick<CityState, "techs" | "eq"> & Partial<Pick<CityState, "ordinances">>): number {
  return Math.min(MAX_DISPLACED, techMods(s).automation * (1 - educationRelief(s)));
}

/** Fator dos empregos que sobram (1 = nenhuma automação). */
export const jobFactor = (s: Pick<CityState, "techs" | "eq"> & Partial<Pick<CityState, "ordinances">>): number => 1 - displacedJobs(s);

/** Empregos de um lote industrial, já descontada a automação. */
export const industrialLotJobs = (s: Pick<CityState, "techs" | "eq"> & Partial<Pick<CityState, "ordinances" | "labor">>, level: number, perLevel: number): number =>
  Math.round(level * perLevel * jobFactor(s) * shiftFactor({ labor: s.labor } as Pick<CityState, "labor">, "fabrica"));
