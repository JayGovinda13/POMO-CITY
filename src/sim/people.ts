// Vida dos moradores: idade, faixa etária e quem trabalha. Só dados e contas simples (sem dependências
// pesadas), porque status/greves/serviços precisam saber quantos trabalham.

import { CYCLES_PER_YEAR } from "./config";
import type { CityState } from "./types";

/** Registro de vida de um morador (vivo, ou morto/ausente guardado para a árvore genealógica). */
export interface Life {
  /** Ciclo de nascimento (pode ser negativo: já nasceu antes da cidade). */
  born: number;
  gender?: "f" | "m";
  /** Ciclo da morte. */
  died?: number;
  /** Ciclo em que deixou a cidade. */
  left?: number;
  partner?: number;
  mother?: number;
  father?: number;
  /** Ciclo em que ficou viúvo(a). */
  widowed?: number;
  /** Previdência privada: poupança acumulada (ver pension.ts). */
  savings?: number;
}

export type Stage = "crianca" | "adulto" | "aposentado";

/** Idade em que começa a trabalhar. */
export const WORK_AGE = 16;
export const DEFAULT_RETIRE_AGE = 65;

export const retireAgeOf = (s: Partial<Pick<CityState, "pension">>): number => s.pension?.retireAge ?? DEFAULT_RETIRE_AGE;

/** Idade em anos (4 ciclos = 1 ano). */
export const ageYears = (life: Pick<Life, "born" | "died">, now: number): number => Math.max(0, ((life.died ?? now) - life.born) / CYCLES_PER_YEAR);

export const stageOf = (age: number, retireAge: number): Stage => (age < WORK_AGE ? "crianca" : age >= retireAge ? "aposentado" : "adulto");

/** Idade atual de um morador vivo (sem registro, conta como adulto de 30 anos). */
export function ageOfCitizen(s: Pick<CityState, "people" | "cyclesCompleted">, id: number): number {
  const l = s.people?.[id];
  return l ? ageYears(l, s.cyclesCompleted) : 30;
}

export interface Demographics {
  children: number;
  adults: number;
  retirees: number;
  /** Idade média dos moradores com registro. */
  avgAge: number;
}

/** Faixas etárias dos moradores vivos (quem não tem registro conta como adulto). */
export function demographics(s: Pick<CityState, "citizens" | "people" | "cyclesCompleted" | "pension" | "population">): Demographics {
  const retire = retireAgeOf(s);
  let children = 0;
  let retirees = 0;
  let known = 0;
  let sumAge = 0;
  for (const id of s.citizens ?? []) {
    const l = s.people?.[id];
    if (!l) continue;
    const a = ageYears(l, s.cyclesCompleted);
    known++;
    sumAge += a;
    const st = stageOf(a, retire);
    if (st === "crianca") children++;
    else if (st === "aposentado") retirees++;
  }
  const adults = Math.max(0, s.population - children - retirees);
  return { children, adults, retirees, avgAge: known ? Math.round((sumAge / known) * 10) / 10 : 0 };
}

/** População em idade de trabalhar (a população menos crianças e aposentados conhecidos). */
export function workingPopulation(s: Pick<CityState, "citizens" | "people" | "cyclesCompleted" | "pension" | "population">): number {
  if (!s.people || !s.citizens?.length) return s.population;
  const d = demographics(s);
  return Math.max(0, s.population - d.children - d.retirees);
}

/** Moradores que pagam imposto residencial: adultos inteiros e aposentados pela metade. */
export function taxableResidents(s: Pick<CityState, "citizens" | "people" | "cyclesCompleted" | "pension" | "population">): number {
  if (!s.people || !s.citizens?.length) return s.population;
  const d = demographics(s);
  return Math.max(0, s.population - d.children - d.retirees / 2);
}
