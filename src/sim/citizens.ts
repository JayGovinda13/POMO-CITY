// Cidadãos individuais: cada morador tem nome, aparência, casa, emprego e humor.
//
// O estado guarda só os ids dos moradores (`citizens`). Todo o resto é DERIVADO de forma
// determinística — nome/aparência/temperamento vêm de (seed da cidade, id); casa, emprego e
// humor vêm do estado atual da cidade. Assim o JSON fica pequeno, cliente e servidor sempre
// concordam, e o emprego bate exatamente com a contratação da economia (status.ts).

import { BUILDINGS } from "./catalog";
import { REGION_BY_ID, weatherAt, type Continent } from "./climate";
import { foodSecure } from "./economy";
import { computePower } from "./power";
import { buildingStatus } from "./status";
import { ZONE, type BuildingType, type CityState } from "./types";
import { rng } from "./world";

export type Gender = "f" | "m";
export type Mood = "feliz" | "ok" | "triste";
export type JobCategory = "agro" | "madeira" | "mineracao" | "industria" | "comercio" | "energia" | "nenhum";

export interface Look {
  skin: number; // 0..3
  hair: number; // estilo 0..4
  hairColor: number; // 0..3
}

export interface CitizenProfile {
  id: number;
  name: string;
  gender: Gender;
  look: Look;
  /** Temperamento: −1 (rabugento), 0, +1 (otimista). */
  trait: -1 | 0 | 1;
}

export interface CitizenView extends CitizenProfile {
  home: { x: number; y: number } | null;
  job: { title: string; category: JobCategory; place: string; x: number; y: number } | null;
  mood: Mood;
  score: number;
  /** Motivos do humor, com sinal (+ bom, − ruim). */
  reasons: { text: string; delta: number }[];
}

// ───────────────────────── nomes por continente ─────────────────────────

type Pool = { f: string[]; m: string[]; last: string[] };

const POOLS: Record<Continent, Pool> = {
  "América do Sul": {
    f: ["Ana", "Beatriz", "Camila", "Daniela", "Fernanda", "Gabriela", "Helena", "Isabela", "Júlia", "Larissa", "Mariana", "Natália", "Patrícia", "Rafaela", "Sofia", "Valentina", "Luana", "Carolina"],
    m: ["André", "Bruno", "Carlos", "Diego", "Eduardo", "Felipe", "Gustavo", "Henrique", "João", "Lucas", "Mateus", "Nicolás", "Pedro", "Rafael", "Santiago", "Thiago", "Vinícius", "Joaquim"],
    last: ["Silva", "Santos", "Oliveira", "Souza", "Pereira", "Costa", "Rodrigues", "Almeida", "Nascimento", "Lima", "Araújo", "Fernandes", "Carvalho", "Gomes", "Martins", "Rocha", "Ribeiro", "González", "Ramírez", "Torres"],
  },
  "América Central e Norte": {
    f: ["Emily", "Olivia", "Ava", "Grace", "Chloe", "Lucía", "María", "Hannah", "Zoe", "Madison", "Camila", "Abigail", "Ximena", "Harper"],
    m: ["James", "Michael", "Daniel", "Ethan", "Noah", "Liam", "Mateo", "Diego", "Logan", "Carter", "Lucas", "Owen", "Emiliano", "Jackson"],
    last: ["Smith", "Johnson", "Brown", "Miller", "Davis", "García", "Martínez", "Hernández", "López", "Wilson", "Anderson", "Taylor", "Thomas", "Moore", "Flores", "Clark"],
  },
  Europa: {
    f: ["Emma", "Sofia", "Lena", "Clara", "Alice", "Marta", "Ingrid", "Freya", "Chiara", "Inês", "Elena", "Amélie", "Hanna", "Olga"],
    m: ["Luca", "Paul", "Hugo", "Leon", "Tomás", "Matteo", "Erik", "Lars", "Jonas", "Marco", "Pierre", "Viktor", "Nils", "Mikhail"],
    last: ["Müller", "Rossi", "Dubois", "Novak", "Kowalski", "Jensen", "Ferreira", "Moreau", "Schmidt", "Bianchi", "Larsen", "Ivanov", "Fischer", "Lindqvist", "Romano", "Costa"],
  },
  "África e Oriente Médio": {
    f: ["Amara", "Zainab", "Fatima", "Aisha", "Nia", "Layla", "Imani", "Yasmin", "Thandiwe", "Noura", "Adaeze", "Salma", "Zuri", "Mariam"],
    m: ["Kwame", "Omar", "Tunde", "Youssef", "Jabari", "Karim", "Musa", "Ahmed", "Sipho", "Chidi", "Hassan", "Kofi", "Tariq", "Bilal"],
    last: ["Okafor", "Mensah", "Haddad", "Diallo", "Nkosi", "Mahmoud", "Abebe", "Kamau", "Traoré", "Farouk", "Boateng", "Mbeki", "Saleh", "Ndiaye", "Adeyemi", "Nasser"],
  },
  Ásia: {
    f: ["Yuki", "Mei", "Aiko", "Priya", "Ananya", "Sakura", "Lin", "Hana", "Ji-woo", "Mai", "Saanvi", "Xiu", "Linh", "Nanami"],
    m: ["Haruto", "Wei", "Arjun", "Ren", "Minh", "Jun", "Rahul", "Kenji", "Hiroshi", "Tuan", "Ravi", "Hao", "Sora", "Dae-ho"],
    last: ["Tanaka", "Wang", "Kim", "Nguyen", "Sharma", "Sato", "Chen", "Park", "Patel", "Suzuki", "Li", "Tran", "Gupta", "Yamamoto", "Zhang", "Choi"],
  },
  Oceania: {
    f: ["Ruby", "Matilda", "Isla", "Mia", "Aroha", "Kiri", "Sienna", "Evie", "Charlotte", "Maia", "Harriet", "Willow"],
    m: ["Oliver", "Jack", "Cooper", "Mason", "Tane", "Nikau", "Hunter", "Archie", "Riley", "Lachlan", "Wiremu", "Flynn"],
    last: ["Williams", "Taylor", "Wilson", "Walker", "Ngata", "Te Rangi", "Kelly", "Ryan", "Murphy", "Harris", "Campbell", "Parata", "Thompson", "King"],
  },
};

const pick = <T>(arr: T[], r: () => number) => arr[Math.floor(r() * arr.length)];

/** Perfil fixo de um morador (não depende do estado além da seed e da região). */
export function citizenProfile(s: Pick<CityState, "seed" | "regionId">, id: number): CitizenProfile {
  const r = rng((s.seed ^ Math.imul(id, 0x9e3779b1) ^ 0xc17e) >>> 0);
  const region = s.regionId ? REGION_BY_ID[s.regionId] : undefined;
  const continents = Object.keys(POOLS) as Continent[];
  // Na região da cidade, a maioria dos nomes é local; ~1 em 6 vem de outro lugar (imigração).
  const continent = region && r() > 0.17 ? region.continent : pick(continents, r);
  const pool = POOLS[continent];
  const gender: Gender = r() < 0.5 ? "f" : "m";
  const name = `${pick(pool[gender], r)} ${pick(pool.last, r)}`;
  const look: Look = { skin: Math.floor(r() * 4), hair: Math.floor(r() * 5), hairColor: Math.floor(r() * 4) };
  const t = r();
  return { id, name, gender, look, trait: t < 0.25 ? -1 : t > 0.75 ? 1 : 0 };
}

// ───────────────────────── empregos ─────────────────────────

const g = (m: string, f: string) => ({ m, f });

const BUILDING_JOBS: Partial<Record<BuildingType, { title: { m: string; f: string }; category: JobCategory }>> = {
  farm: { title: g("Agricultor", "Agricultora"), category: "agro" },
  lumberyard: { title: g("Lenhador", "Lenhadora"), category: "madeira" },
  mine: { title: g("Mineiro", "Mineira"), category: "mineracao" },
  sawmill: { title: g("Marceneiro", "Marceneira"), category: "madeira" },
  smelter: { title: g("Fundidor", "Fundidora"), category: "industria" },
  thermal_plant: { title: g("Operador de usina", "Operadora de usina"), category: "energia" },
  hydro_plant: { title: g("Técnico da hidrelétrica", "Técnica da hidrelétrica"), category: "energia" },
};

const COMMERCE_TITLES = [g("Vendedor", "Vendedora"), g("Caixa", "Caixa"), g("Cozinheiro", "Cozinheira"), g("Gerente de loja", "Gerente de loja"), g("Barbeiro", "Cabeleireira"), g("Garçom", "Garçonete")];
const INDUSTRY_TITLES = [g("Operário", "Operária"), g("Soldador", "Soldadora"), g("Mecânico", "Mecânica"), g("Montador", "Montadora")];

interface Slot {
  x: number;
  y: number;
  place: string;
  category: JobCategory;
  title: (gender: Gender, k: number) => string;
}

/** Vagas na MESMA ordem da contratação da economia: construções por id, depois lotes C e I. */
function jobSlots(s: CityState, status = buildingStatus(s)): Slot[] {
  const slots: Slot[] = [];
  for (const b of [...s.buildings].sort((a, c) => a.id - c.id)) {
    const st = status.get(b.id);
    const job = BUILDING_JOBS[b.type];
    if (!st || !job) continue;
    for (let k = 0; k < st.staffed; k++) {
      slots.push({ x: b.x, y: b.y, place: BUILDINGS[b.type].name, category: job.category, title: (gd) => job.title[gd] });
    }
  }
  for (const [code, perLevel, titles, category, place] of [
    [ZONE.C, 3, COMMERCE_TITLES, "comercio", "Comércio"],
    [ZONE.I, 4, INDUSTRY_TITLES, "industria", "Indústria"],
  ] as const) {
    for (let i = 0; i < s.zoneType.length; i++) {
      if (s.zoneType[i] !== code || !s.zoneLevel[i]) continue;
      const x = i % s.width;
      const y = Math.floor(i / s.width);
      for (let k = 0; k < s.zoneLevel[i] * perLevel; k++) {
        slots.push({ x, y, place, category, title: (gd, kk) => titles[(i + kk) % titles.length][gd] });
      }
    }
  }
  return slots;
}

// ───────────────────────── humor ─────────────────────────

const moodOf = (score: number): Mood => (score >= 3 ? "feliz" : score >= 0 ? "ok" : "triste");

/**
 * Visão completa dos moradores: casa (lotes residenciais, em ordem), emprego (na ordem de
 * contratação) e humor com os motivos.
 */
export function citizensView(s: CityState): CitizenView[] {
  const power = computePower(s);
  const status = buildingStatus(s, power.powered);
  const slots = jobSlots(s, status);

  const homes: number[] = [];
  for (let i = 0; i < s.zoneType.length; i++) {
    if (s.zoneType[i] === ZONE.R) for (let k = 0; k < s.zoneLevel[i] * 4; k++) homes.push(i);
  }

  const fed = foodSecure(s);
  const recentDisaster = s.lastDisasterCycle !== null && s.cyclesCompleted - s.lastDisasterCycle <= 2;
  const weather = weatherAt(s);
  const harsh = weather && weather.effects.demand >= 1.3 ? (weather.temp < 12 ? "Frio intenso" : "Calor forte") : null;

  return s.citizens.map((id, n) => {
    const p = citizenProfile(s, id);
    const homeIdx = homes[n];
    const slot = slots[n];
    const reasons: CitizenView["reasons"] = [];
    if (slot) reasons.push({ text: "Tem emprego", delta: 2 });
    else reasons.push({ text: "Desempregado(a)", delta: -2 });
    if (homeIdx === undefined) reasons.push({ text: "Sem moradia", delta: -3 });
    else if (power.powered[homeIdx]) reasons.push({ text: "Casa com energia", delta: 1 });
    else reasons.push({ text: "Casa sem energia", delta: -2 });
    reasons.push(fed ? { text: "Comida na mesa", delta: 1 } : { text: "Falta comida (nem dá para comprar)", delta: -3 });
    if (recentDisaster) reasons.push({ text: "Desastre recente", delta: -2 });
    if (harsh) reasons.push({ text: harsh, delta: -1 });
    if (s.streak >= 3) reasons.push({ text: "Prefeitura focada", delta: 1 });
    if (p.trait) reasons.push({ text: p.trait > 0 ? "Otimista" : "Rabugento(a)", delta: p.trait });
    const score = reasons.reduce((acc, r) => acc + r.delta, 0);
    return {
      ...p,
      home: homeIdx === undefined ? null : { x: homeIdx % s.width, y: Math.floor(homeIdx / s.width) },
      job: slot ? { title: slot.title(p.gender, n), category: slot.category, place: slot.place, x: slot.x, y: slot.y } : null,
      mood: moodOf(score),
      score,
      reasons,
    };
  });
}

export interface MoodSummary {
  feliz: number;
  ok: number;
  triste: number;
  /** (felizes − tristes) / total, em [−1, 1]. */
  approval: number;
}

export function moodSummary(views: Pick<CitizenView, "mood">[]): MoodSummary {
  const out = { feliz: 0, ok: 0, triste: 0, approval: 0 };
  for (const v of views) out[v.mood]++;
  out.approval = views.length ? (out.feliz - out.triste) / views.length : 0;
  return out;
}

/**
 * Ajusta a lista de moradores ao tamanho da população (muta `s`):
 * chegam pessoas novas (ids novos) ou vão embora as mais tristes primeiro.
 */
export function syncCitizens(s: CityState): void {
  const target = Math.max(0, s.population);
  if (s.citizens.length < target) {
    while (s.citizens.length < target) s.citizens.push(s.nextCitizenId++);
    return;
  }
  if (s.citizens.length > target) {
    const views = citizensView(s);
    const leaving = new Set(
      [...views]
        .sort((a, b) => a.score - b.score || b.id - a.id)
        .slice(0, s.citizens.length - target)
        .map((v) => v.id),
    );
    s.citizens = s.citizens.filter((id) => !leaving.has(id));
  }
}
