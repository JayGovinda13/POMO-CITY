// Demografia: os moradores envelhecem, casam, têm filhos e morrem. Tudo determinístico (usa o gerador
// do ciclo) e ligado às mecânicas da cidade: filhos e aposentados não trabalham, ocupam moradia,
// pesam na saúde e nos impostos, e a morte e o nascimento mexem na população.

import { citizenProfile } from "./citizens";
import { CYCLES_PER_YEAR, START_LIFE } from "./config";
import { laborStats } from "./status";
import { WORK_AGE, ageYears, retireAgeOf, stageOf, type Life } from "./people";
import { rng } from "./world";
import { lawBirths } from "./laws";
import { techMods } from "./tech";
import type { CityState } from "./types";

/** Chance de morrer num ciclo, pela idade e pela expectativa de vida da cidade (calibrada: a idade média na morte ≈ a expectativa). */
export function deathChance(age: number, lifeExpectancy: number): number {
  const L = Math.max(30, lifeExpectancy) * 1.07;
  return Math.min(0.9, 0.0002 + 0.1 * (age / L) ** 16);
}

/** Idades dos moradores que chegam de fora: adultos jovens. */
const ARRIVAL_MIN = 18;
const ARRIVAL_SPAN = 25;

/** Cria o registro de vida de quem chega à cidade (adulto de 18 a 42 anos). */
export function createArrivalLife(s: Pick<CityState, "seed" | "regionId" | "cyclesCompleted" | "people">, id: number): Life {
  const r = rng((s.seed ^ Math.imul(id, 0x85ebca6b) ^ 0xa11e) >>> 0);
  const years = ARRIVAL_MIN + Math.floor(r() * ARRIVAL_SPAN);
  const born = s.cyclesCompleted - years * CYCLES_PER_YEAR - Math.floor(r() * CYCLES_PER_YEAR);
  return { born, gender: citizenProfile(s, id).gender };
}

/** Garante um registro de vida para cada morador (saves antigos e testes que preenchem a lista à mão). */
export function ensureLives(s: CityState): void {
  s.people ??= {};
  for (const id of s.citizens) if (!s.people[id]) s.people[id] = createArrivalLife(s, id);
}

const isLiving = (s: CityState, id: number): boolean => !!s.people[id] && s.people[id].died === undefined && s.people[id].left === undefined;

/** Parentesco próximo (pai, mãe, filho, irmão): não casam entre si. */
function related(s: CityState, a: number, b: number): boolean {
  const A = s.people[a];
  const B = s.people[b];
  if (!A || !B) return false;
  if (A.mother === b || A.father === b || B.mother === a || B.father === a) return true;
  return (!!A.mother && A.mother === B.mother) || (!!A.father && A.father === B.father);
}

export interface DemographyReport {
  births: number;
  deaths: number;
  marriages: number;
  /** Quem morreu neste ciclo (nome e idade), até 4. */
  obituaries: { name: string; age: number }[];
}

/**
 * Um ciclo de vida: mortes, casamentos e nascimentos. Muta `s` (população, lista de moradores e
 * registros). Os nascimentos precisam de moradia livre.
 */
export function demographyStep(s: CityState, rand: () => number): DemographyReport {
  const out: DemographyReport = { births: 0, deaths: 0, marriages: 0, obituaries: [] };
  if (!s.citizens.length) return out;
  ensureLives(s);
  const now = s.cyclesCompleted;
  const retire = retireAgeOf(s);
  const lifeExp = s.lifeExpectancy ?? START_LIFE;
  const ids = [...s.citizens].sort((a, b) => a - b);

  // ── Mortes ──
  const dead = new Set<number>();
  for (const id of ids) {
    const l = s.people[id];
    const age = ageYears(l, now);
    if (rand() < deathChance(age, lifeExp)) {
      dead.add(id);
      l.died = now;
      if (l.partner !== undefined) {
        const p = s.people[l.partner];
        if (p && p.died === undefined) {
          p.partner = undefined;
          p.widowed = now;
        }
      }
      out.deaths++;
      if (out.obituaries.length < 4) out.obituaries.push({ name: citizenProfile(s, id).name, age: Math.floor(age) });
    }
  }
  if (dead.size) {
    s.citizens = s.citizens.filter((id) => !dead.has(id));
    s.population = Math.max(0, s.population - dead.size);
  }

  // ── Casamentos: solteiros de 18 a 50 anos se juntam (idade parecida, sem parentesco) ──
  const singles = s.citizens
    .filter((id) => {
      const l = s.people[id];
      const a = ageYears(l, now);
      return l.partner === undefined && a >= 18 && a <= 50;
    })
    .sort((a, b) => a - b);
  for (let i = singles.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [singles[i], singles[j]] = [singles[j], singles[i]];
  }
  const taken = new Set<number>();
  for (let i = 0; i < singles.length; i++) {
    const a = singles[i];
    if (taken.has(a) || rand() >= 0.06) continue;
    const ageA = ageYears(s.people[a], now);
    const b = singles.slice(i + 1).find((x) => !taken.has(x) && Math.abs(ageYears(s.people[x], now) - ageA) <= 12 && !related(s, a, x));
    if (b === undefined) continue;
    s.people[a].partner = b;
    s.people[b].partner = a;
    delete s.people[a].widowed;
    delete s.people[b].widowed;
    taken.add(a);
    taken.add(b);
    out.marriages++;
  }

  // ── Nascimentos: casais férteis, enquanto houver moradia livre ──
  let free = laborStats(s).housing - s.population;
  const couples = s.citizens.filter((id) => {
    const l = s.people[id];
    return l.partner !== undefined && l.partner > id && isLiving(s, l.partner);
  });
  for (const id of couples) {
    if (free <= 0) break;
    const l = s.people[id];
    const p = s.people[l.partner!];
    const ageA = ageYears(l, now);
    const ageB = ageYears(p, now);
    const young = Math.min(ageA, ageB);
    if (young < 18 || young > 42) continue;
    if (rand() >= 0.035 * (1 + lawBirths(s) + techMods(s).births)) continue;
    const childId = s.nextCitizenId++;
    const gA = l.gender ?? "f";
    const mother = gA === "f" ? id : l.partner!;
    const father = mother === id ? l.partner! : id;
    const gender: "f" | "m" = rand() < 0.5 ? "f" : "m";
    s.people[childId] = { born: now, gender, mother, father };
    s.citizens.push(childId);
    s.population++;
    free--;
    out.births++;
  }

  pruneFamily(s);
  return out;
}

/** Tira dos registros quem morreu ou saiu e não tem mais parente vivo por perto (mantém a árvore enxuta). */
export function pruneFamily(s: CityState): void {
  const keep = new Set<number>();
  const add = (id: number | undefined) => {
    if (id !== undefined && s.people[id]) keep.add(id);
  };
  for (const [key, l] of Object.entries(s.people)) {
    const id = Number(key);
    if (l.died !== undefined || l.left !== undefined) continue;
    add(id);
    add(l.partner);
    for (const par of [l.mother, l.father]) {
      add(par);
      if (par !== undefined && s.people[par]) {
        add(s.people[par].mother);
        add(s.people[par].father);
      }
    }
  }
  // Filhos (vivos ou mortos) de quem está vivo.
  for (const [key, l] of Object.entries(s.people)) {
    const id = Number(key);
    if ((l.mother !== undefined && isLiving(s, l.mother)) || (l.father !== undefined && isLiving(s, l.father))) add(id);
  }
  for (const key of Object.keys(s.people)) if (!keep.has(Number(key))) delete s.people[Number(key)];
}

// ───────────────────────── árvore genealógica ─────────────────────────

export interface FamilyMember {
  id: number;
  name: string;
  gender: "f" | "m";
  age: number;
  alive: boolean;
  /** Idade em que morreu (se morreu). */
  diedAt: number | null;
  /** Já saiu da cidade. */
  away: boolean;
}

export interface FamilyTree {
  self: FamilyMember;
  parents: FamilyMember[];
  grandparents: FamilyMember[];
  partner: FamilyMember | null;
  children: FamilyMember[];
  siblings: FamilyMember[];
  grandchildren: FamilyMember[];
}

function member(s: CityState, id: number): FamilyMember | null {
  const l = s.people?.[id];
  if (!l) return null;
  const prof = citizenProfile(s, id);
  const dead = l.died !== undefined;
  return {
    id,
    name: prof.name,
    gender: prof.gender,
    age: Math.floor(ageYears(l, s.cyclesCompleted)),
    alive: !dead && l.left === undefined,
    diedAt: dead ? Math.floor(ageYears(l, s.cyclesCompleted)) : null,
    away: l.left !== undefined,
  };
}

/** Árvore de um morador: pais, avós, parceiro(a), filhos, irmãos e netos que ainda estão nos registros. */
export function familyOf(s: CityState, id: number): FamilyTree | null {
  const self = member(s, id);
  if (!self) return null;
  const l = s.people[id];
  const list = (ids: (number | undefined)[]) => ids.map((x) => (x === undefined ? null : member(s, x))).filter((m): m is FamilyMember => !!m);
  const parentIds = [l.mother, l.father];
  const kidsOf = (pid: number) =>
    Object.entries(s.people)
      .filter(([, v]) => v.mother === pid || v.father === pid)
      .map(([k]) => Number(k))
      .sort((a, b) => a - b);
  const children = [...new Set(kidsOf(id))];
  const siblings = [...new Set(parentIds.filter((x): x is number => x !== undefined).flatMap(kidsOf))].filter((x) => x !== id);
  return {
    self,
    parents: list(parentIds),
    grandparents: list(parentIds.flatMap((p) => (p !== undefined && s.people[p] ? [s.people[p].mother, s.people[p].father] : []))),
    partner: l.partner !== undefined ? member(s, l.partner) : null,
    children: list(children),
    siblings: list(siblings),
    grandchildren: list([...new Set(children.flatMap(kidsOf))]),
  };
}

export { WORK_AGE, stageOf };
