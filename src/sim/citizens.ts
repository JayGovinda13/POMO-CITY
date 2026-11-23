// Cidadãos individuais: cada morador tem nome, aparência, casa, emprego e humor.
//
// O estado guarda só os ids dos moradores (`citizens`). Todo o resto é DERIVADO de forma
// determinística — nome/aparência/temperamento vêm de (seed da cidade, id); casa, emprego e
// humor vêm do estado atual da cidade. Assim o JSON fica pequeno, cliente e servidor sempre
// concordam, e o emprego bate exatamente com a contratação da economia (status.ts).

import { BUILDINGS } from "./catalog";
import { REGION_BY_ID, weatherAt, type Continent } from "./climate";
import { foodSecure } from "./economy";
import { computeWater } from "./water";
import { ORDINANCES, ORDINANCE_IDS, isActive, rentPressure } from "./finance";
import { computePower } from "./power";
import { buildingStatus } from "./status";
import { computeServices, wealthOf, type WealthClass } from "./services";
import { TRIP_LIMIT_POPULATION, computeTraffic } from "./traffic";
import { eventMods } from "./events";
import { ecoState } from "./ecocycle";
import { BASE_PRICE, basePrice, currentEffects } from "./economy";
import { ZONE, type BuildingType, type CityState } from "./types";
import { rng } from "./world";
import { createArrivalLife } from "./demography";
import { hasPensionIncome } from "./pensionsystem";
import { lawMoods } from "./laws";
import { ageYears, retireAgeOf, stageOf, type Stage } from "./people";
import { UNMET_PENALTY, ageGroupOf, needsFor, type AgeGroup, type Need } from "./needs";
import { SECTOR_OF_BUILDING, industrialLotJobs, laborMood, type Sector } from "./labor";

export type Gender = "f" | "m";
export type Mood = "feliz" | "ok" | "triste";
export type JobCategory = "agro" | "madeira" | "mineracao" | "industria" | "comercio" | "energia" | "servicos" | "nenhum";

export interface Look {
  skin: number; // 0..3
  hair: number; // estilo 0..4
  hairColor: number; // 0..3
}

export interface CitizenProfile {
  id: number;
  name: string;
  /** Sobrenome (herdado do pai ou da mãe). */
  last: string;
  gender: Gender;
  look: Look;
  /** Temperamento: −1 (rabugento), 0, +1 (otimista). */
  trait: -1 | 0 | 1;
}

export interface CitizenView extends CitizenProfile {
  /** Idade em anos e faixa etária (criança, adulto, aposentado). */
  age: number;
  stage: Stage;
  /** Faixa de idade e as necessidades dela (atendidas ou não). */
  group: AgeGroup;
  needs: Need[];
  /** Negócio próprio: empreendedor ou cooperado (só quem está sem vaga). */
  business: "empreendedor" | "cooperado" | null;
  /** Companheiro(a) vivo(a), se casado(a). */
  partner: { id: number; name: string } | null;
  /** Número de filhos vivos. */
  children: number;
  home: { x: number; y: number } | null;
  job: { title: string; category: JobCategory; place: string; x: number; y: number } | null;
  mood: Mood;
  score: number;
  /** Classe pelo valor do solo da casa (Fase 7). */
  wealth: WealthClass | null;
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
export function citizenProfile(s: Pick<CityState, "seed" | "regionId"> & Partial<Pick<CityState, "people">>, id: number): CitizenProfile {
  const r = rng((s.seed ^ Math.imul(id, 0x9e3779b1) ^ 0xc17e) >>> 0);
  const region = s.regionId ? REGION_BY_ID[s.regionId] : undefined;
  const continents = Object.keys(POOLS) as Continent[];
  // Na região da cidade, a maioria dos nomes é local; ~1 em 6 vem de outro lugar (imigração).
  const continent = region && r() > 0.17 ? region.continent : pick(continents, r);
  const pool = POOLS[continent];
  const drawn: Gender = r() < 0.5 ? "f" : "m";
  const life = s.people?.[id];
  // O registro de vida é a fonte do gênero; o sobrenome vem do pai (ou da mãe), como numa família.
  const gender: Gender = life?.gender ?? drawn;
  const first = pick(pool[gender], r);
  let last = pick(pool.last, r);
  const parent = life?.father ?? life?.mother;
  if (parent !== undefined && parent !== id) last = citizenProfile(s, parent).last;
  const name = `${first} ${last}`;
  const look: Look = { skin: Math.floor(r() * 4), hair: Math.floor(r() * 5), hairColor: Math.floor(r() * 4) };
  const t = r();
  return { id, name, last, gender, look, trait: t < 0.25 ? -1 : t > 0.75 ? 1 : 0 };
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
  police: { title: g("Policial", "Policial"), category: "servicos" },
  prison: { title: g("Agente penitenciário", "Agente penitenciária"), category: "servicos" },
  fire_station: { title: g("Bombeiro", "Bombeira"), category: "servicos" },
  hospital: { title: g("Médico", "Enfermeira"), category: "servicos" },
  clinic: { title: g("Enfermeiro", "Enfermeira"), category: "servicos" },
  labor_office: { title: g("Fiscal do trabalho", "Fiscal do trabalho"), category: "servicos" },
  school: { title: g("Professor", "Professora"), category: "servicos" },
  college: { title: g("Professor universitário", "Professora universitária"), category: "servicos" },
  library: { title: g("Bibliotecário", "Bibliotecária"), category: "servicos" },
  museum: { title: g("Curador", "Curadora"), category: "servicos" },
  zoo: { title: g("Tratador", "Tratadora"), category: "servicos" },
  stadium: { title: g("Funcionário do estádio", "Funcionária do estádio"), category: "servicos" },
  bus_stop: { title: g("Motorista de ônibus", "Motorista de ônibus"), category: "servicos" },
  train_station: { title: g("Maquinista", "Maquinista"), category: "servicos" },
  airport: { title: g("Controlador de voo", "Comissária de bordo"), category: "servicos" },
  seaport: { title: g("Estivador", "Estivadora"), category: "servicos" },
  university: { title: g("Pesquisador universitário", "Pesquisadora universitária"), category: "servicos" },
  worker_coop: { title: g("Cooperado", "Cooperada"), category: "industria" },
  incubator: { title: g("Mentor de startups", "Mentora de startups"), category: "servicos" },
  intermodal: { title: g("Operador de terminal", "Operadora de terminal"), category: "servicos" },
};

const COMMERCE_TITLES = [g("Vendedor", "Vendedora"), g("Caixa", "Caixa"), g("Cozinheiro", "Cozinheira"), g("Gerente de loja", "Gerente de loja"), g("Barbeiro", "Cabeleireira"), g("Garçom", "Garçonete")];
const INDUSTRY_TITLES = [g("Operário", "Operária"), g("Soldador", "Soldadora"), g("Mecânico", "Mecânica"), g("Montador", "Montadora")];

interface Slot {
  x: number;
  y: number;
  /** Setor de trabalho (jornada e pagamento), quando existe. */
  sector?: Sector;
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
      slots.push({ x: b.x, y: b.y, sector: SECTOR_OF_BUILDING[b.type], place: BUILDINGS[b.type].name, category: job.category, title: (gd) => job.title[gd] });
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
      const count = code === ZONE.I ? industrialLotJobs(s, s.zoneLevel[i], perLevel) : s.zoneLevel[i] * perLevel;
      for (let k = 0; k < count; k++) {
        slots.push({ x, y, sector: code === ZONE.I ? "fabrica" : undefined, place, category, title: (gd, kk) => titles[(i + kk) % titles.length][gd] });
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
  const water = computeWater(s, undefined, status);
  const traffic = computeTraffic(s);
  const moods = eventMods(s).mood;
  const ecoPhase = ecoState(s).phase;
  const foodFactor = basePrice("food", currentEffects(s)) / BASE_PRICE.food;
  const svc = computeServices(s, status, traffic);
  /** Há via congestionada a até 2 tiles da casa? */
  const jammed = (i: number) => {
    const x = i % s.width;
    const y = Math.floor(i / s.width);
    for (let dy = -2; dy <= 2; dy++)
      for (let dx = -2; dx <= 2; dx++) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx >= 0 && ny >= 0 && nx < s.width && ny < s.height && traffic.congested[ny * s.width + nx]) return true;
      }
    return false;
  };

  const homes: number[] = [];
  for (let i = 0; i < s.zoneType.length; i++) {
    if (s.zoneType[i] === ZONE.R) for (let k = 0; k < s.zoneLevel[i] * 4; k++) homes.push(i);
  }

  const retire = retireAgeOf(s);
  const kidsOf = new Map<number, number>();
  for (const l of Object.values(s.people ?? {})) {
    if (l.died !== undefined || l.left !== undefined) continue;
    for (const par of [l.mother, l.father]) if (par !== undefined) kidsOf.set(par, (kidsOf.get(par) ?? 0) + 1);
  }
  let workerRank = 0;
  let bizE = s.business?.entrepreneurs ?? 0;
  let bizC = s.business?.coops ?? 0;

  const fed = foodSecure(s);
  const recentDisaster = s.lastDisasterCycle !== null && s.cyclesCompleted - s.lastDisasterCycle <= 2;
  const weather = weatherAt(s);
  const harsh = weather && weather.effects.demand >= 1.3 ? (weather.temp < 12 ? "Frio intenso" : "Calor forte") : null;

  return s.citizens.map((id, n) => {
    const p = citizenProfile(s, id);
    const homeIdx = homes[n];
    const life = s.people?.[id];
    const age = life ? ageYears(life, s.cyclesCompleted) : 30;
    const stage = stageOf(age, retire);
    // Só quem está em idade de trabalhar disputa as vagas (na ordem da lista).
    const slot = stage === "adulto" ? slots[workerRank++] : undefined;
    const reasons: CitizenView["reasons"] = [];
    // Quem está sem vaga pode ter o próprio negócio (leis de empreendedorismo) ou uma cooperativa.
    let business: CitizenView["business"] = null;
    if (!slot && stage === "adulto") {
      if (bizE > 0) {
        bizE--;
        business = "empreendedor";
      } else if (bizC > 0) {
        bizC--;
        business = "cooperado";
      }
    }
    if (slot) reasons.push({ text: "Tem emprego", delta: 2 });
    else if (business === "empreendedor") reasons.push({ text: "Tem o próprio negócio", delta: 1 });
    else if (business === "cooperado") reasons.push({ text: "Sócio(a) de uma cooperativa", delta: 2 });
    else if (stage === "adulto") reasons.push({ text: "Desempregado(a)", delta: -2 });
    // Família: casal junto anima; luto pesa por 4 ciclos.
    if (life?.partner !== undefined && s.people[life.partner]?.died === undefined) reasons.push({ text: "Vive em família", delta: 1 });
    // Necessidades de cada idade: o que falta pesa no humor (escola para criança, hospital para idoso…).
    const group = ageGroupOf(age, retire);
    const at = homeIdx;
    const needs = needsFor(group, {
      hasHome: at !== undefined,
      school: at !== undefined && svc.school[at] > 0.2,
      leisure: at !== undefined && svc.leisure[at] > 0,
      safe: at !== undefined && svc.crime[at] <= 45,
      health: at !== undefined && svc.health[at] > 0,
      transport: !(at !== undefined && s.population >= TRIP_LIMIT_POPULATION && traffic.failed[at]),
      job: !!slot || business !== null,
      income: hasPensionIncome(s, id),
    });
    for (const n of needs) {
      // Só pesa em cidades que já têm serviços a oferecer (como o mal-estar por falta de hospital).
      // (Jovem empregado não sente falta de lazer no humor: só quem está sem ocupação.)
      const skip = group === "jovem" && !!slot;
      const pen = !n.met && !skip && s.population >= 40 ? UNMET_PENALTY[group]?.[n.id] : undefined;
      if (pen) reasons.push(pen);
    }
    // Leis municipais em vigor (humor de todos e dos trabalhadores).
    for (const m of lawMoods(s, !!slot)) reasons.push(m);
    // Aposentadoria: quem tem renda vive tranquilo; sem renda passa necessidade. Trabalhadores pagam a conta.
    if (stage === "aposentado") reasons.push(hasPensionIncome(s, id) ? { text: "Aposentadoria garantida", delta: 1 } : { text: "Aposentado(a) sem renda", delta: -3 });
    if (stage === "adulto" && s.pension?.publicOn && s.pension.publicRate > 10) reasons.push({ text: "Contribuição pesada para a previdência", delta: -1 });
    if (life?.widowed !== undefined && s.cyclesCompleted - life.widowed <= 4) reasons.push({ text: "Em luto", delta: -2 });
    // Jornada e forma de pagamento do setor em que trabalha.
    if (slot?.sector) for (const m of laborMood(s, slot.sector)) reasons.push(m);
    if (homeIdx === undefined) reasons.push({ text: "Sem moradia", delta: -3 });
    else if (power.powered[homeIdx]) reasons.push({ text: "Casa com energia", delta: 1 });
    else reasons.push({ text: "Casa sem energia", delta: -2 });
    if (homeIdx !== undefined && water.watered[homeIdx]) reasons.push({ text: "Água encanada", delta: 1 });
    // Qualidade de vida do bairro (Fase 7).
    if (homeIdx !== undefined) {
      if (svc.crime[homeIdx] > 45) reasons.push({ text: "Bairro perigoso", delta: -2 });
      else if (svc.police[homeIdx] > 0.3) reasons.push({ text: "Bairro seguro", delta: 1 });
      if (svc.pollution[homeIdx] > 40) reasons.push({ text: "Ar poluído", delta: -2 });
      if (svc.leisure[homeIdx] > 0) reasons.push({ text: "Parque perto de casa", delta: 1 });
      if (svc.school[homeIdx] > 0 && svc.schoolServed >= 0.8) reasons.push({ text: "Escola no bairro", delta: 1 });
      // Transporte (Fase 8).
      if (jammed(homeIdx)) reasons.push({ text: "Trânsito parado", delta: -1 });
      if (s.population >= TRIP_LIMIT_POPULATION && traffic.failed[homeIdx]) reasons.push({ text: "Trabalho longe demais", delta: -1 });
      if (traffic.transit[homeIdx]) reasons.push({ text: "Transporte público perto", delta: 1 });
    }
    if (s.population >= 40) {
      if (svc.healthServed >= 0.8) reasons.push({ text: "Atendimento médico", delta: 1 });
      else if (svc.healthServed < 0.3) reasons.push({ text: "Sem hospital por perto", delta: -1 });
    }
    reasons.push(fed ? { text: "Comida na mesa", delta: 1 } : { text: "Falta comida (nem dá para comprar)", delta: -3 });
    if (recentDisaster) reasons.push({ text: "Desastre recente", delta: -2 });
    if (harsh) reasons.push({ text: harsh, delta: -1 });
    if (s.streak >= 3) reasons.push({ text: "Prefeitura focada", delta: 1 });
    // Livro 3: aluguel (IPTU), crise e comida cara pesam mais para quem tem pouco.
    const wealth = homeIdx === undefined ? "media" : wealthOf(svc.landValue[homeIdx]);
    const rent = rentPressure(s);
    if (rent > 0 && homeIdx !== undefined) {
      if (isActive(s, "habitacao_popular") && wealth === "baixa") reasons.push({ text: "Moradia popular", delta: 1 });
      else if (wealth === "baixa" && rent >= 3) reasons.push({ text: "Aluguel pesado", delta: rent >= 6 ? -2 : -1 });
      else if (wealth === "media" && rent >= 6) reasons.push({ text: "Aluguel pesado", delta: -1 });
    }
    if (ecoPhase === "crise" && (stage === "adulto" || stage === "aposentado")) reasons.push({ text: "Crise econômica", delta: -1 });
    if (foodFactor >= 1.3 && wealth === "baixa") reasons.push({ text: "Comida cara", delta: -1 });
    else if (foodFactor >= 1.5 && wealth === "media") reasons.push({ text: "Comida cara", delta: -1 });
    // Decretos que mexem com o humor (Fase 4).
    // (Os decretos que animam também têm teto: no máximo +3 somados.)
    let decreeGain = 0;
    for (const oid of ORDINANCE_IDS) {
      const mood = ORDINANCES[oid].mood;
      if (!mood || !isActive(s, oid)) continue;
      if (mood.delta > 0) {
        const allowed = Math.min(mood.delta, 3 - decreeGain);
        if (allowed <= 0) continue;
        decreeGain += allowed;
        reasons.push({ text: mood.text, delta: allowed });
      } else reasons.push({ text: mood.text, delta: mood.delta });
    }
    if (isActive(s, "premio_produtividade") && s.streak >= 4) reasons.push({ text: "Prêmio de produtividade", delta: 1 });
    // Eventos em andamento (festival, greve, gripe, calor).
    for (const m of moods) reasons.push(m);
    if (p.trait) reasons.push({ text: p.trait > 0 ? "Otimista" : "Rabugento(a)", delta: p.trait });
    const score = reasons.reduce((acc, r) => acc + r.delta, 0);
    return {
      ...p,
      age: Math.floor(age),
      stage,
      group,
      needs,
      business,
      partner: life?.partner !== undefined && s.people[life.partner] ? { id: life.partner, name: citizenProfile(s, life.partner).name } : null,
      children: kidsOf.get(id) ?? 0,
      home: homeIdx === undefined ? null : { x: homeIdx % s.width, y: Math.floor(homeIdx / s.width) },
      job: slot ? { title: slot.title(p.gender, n), category: slot.category, place: slot.place, x: slot.x, y: slot.y } : null,
      mood: moodOf(score),
      score,
      wealth: homeIdx === undefined ? null : wealthOf(svc.landValue[homeIdx]),
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
  s.people ??= {};
  if (s.citizens.length < target) {
    while (s.citizens.length < target) {
      const id = s.nextCitizenId++;
      s.citizens.push(id);
      s.people[id] = createArrivalLife(s, id);
    }
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
    for (const id of leaving) {
      const l = s.people[id];
      if (!l) continue;
      l.left = s.cyclesCompleted;
      if (l.partner !== undefined && s.people[l.partner]) {
        s.people[l.partner].partner = undefined;
        l.partner = undefined;
      }
    }
  }
}
