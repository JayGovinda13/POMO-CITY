// Câmara de vereadores: eleita a cada 4 anos (16 ciclos) pelos próprios moradores, propõe uma lei por
// ciclo e o prefeito aprova ou veta. Os vereadores são moradores de verdade (nome, idade, partido).

import { citizenProfile, citizensView, type CitizenView } from "./citizens";
import { CYCLES_PER_YEAR } from "./config";
import { LAWS, LAW_ERA, LAW_IDS, PARTIES, PARTY_IDS, newCouncil, type Bill, type CouncilState, type LawId, type PartyId } from "./laws";
import { ageYears } from "./people";
import { ORDINANCE_POLITICS, ORDINANCES, type OrdinanceId } from "./finance";
import { hasTech } from "./tech";
import { cityYear } from "./world";
import type { CityState } from "./types";

/** Mandato: 4 anos. */
/** Eleição extraordinária: só depois de 1 ano de mandato e com 15% de chance por ciclo de crise. */
export const EARLY_MIN_CYCLES = CYCLES_PER_YEAR;
export const EARLY_CHANCE = 0.15;
export const TERM_CYCLES = 4 * CYCLES_PER_YEAR;
/** Só há câmara em cidades com pelo menos esta população. */
export const MIN_COUNCIL_POPULATION = 30;
/** Propostas esperando decisão (as mais antigas são arquivadas). */
export const MAX_PENDING_BILLS = 3;

/** Fração da câmara que dá o golpe. */
export const COUP_SHARE = 2 / 3;

/** Cadeiras do Fascista e o total. */
export function fascistSeats(c: Pick<CouncilState, "members">): { fascist: number; total: number } {
  return { fascist: c.members.filter((m) => m.party === "fascista").length, total: c.members.length };
}

/** O Fascista tem 2/3 ou mais da câmara? Então dá o golpe e o jogo acaba. */
export function isCoup(c: Pick<CouncilState, "members">): boolean {
  const { fascist, total } = fascistSeats(c);
  return total >= 3 && fascist * 3 >= total * 2;
}

/** Número de cadeiras pela população. */
export const seatsFor = (population: number): number => (population < 150 ? 5 : population < 400 ? 7 : population < 1000 ? 9 : 11);

/** Ciclos que faltam para a próxima eleição. */
export const cyclesToElection = (s: Pick<CityState, "council" | "cyclesCompleted">): number =>
  s.council && s.council.members.length ? Math.max(0, s.council.electedAt + TERM_CYCLES - s.cyclesCompleted) : 0;

export { newCouncil };
export type { Bill, CouncilState, Councillor } from "./laws";

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

function note(c: CouncilState, cycle: number, text: string) {
  c.history.push({ cycle, text });
  if (c.history.length > 14) c.history.splice(0, c.history.length - 14);
}

// ───────────────────────── eleição ─────────────────────────

/** Indicadores da cidade (0..1) lidos dos moradores: o que a câmara enxerga e o que o eleitor sente. */
export interface Signals {
  unemployed: number;
  fatigue: number;
  poor: number;
  unsafe: number;
  polluted: number;
  nohospital: number;
  noincome: number;
  kids: number;
  fewkids: number;
  unhappy: number;
  deficit: number;
  strike: number;
}

const share = (views: CitizenView[], pred: (v: CitizenView) => boolean) => (views.length ? views.filter(pred).length / views.length : 0);

/** Lê os indicadores da cidade a partir dos moradores e do estado. */
export function signalsOf(views: CitizenView[], s: Pick<CityState, "money" | "strike">): Signals {
  const has = (v: CitizenView, t: string) => v.reasons.some((r) => r.text.startsWith(t));
  const adults = views.filter((v) => v.stage === "adulto");
  const retirees = views.filter((v) => v.stage === "aposentado");
  const kids = share(views, (v) => v.stage === "crianca");
  return {
    unemployed: adults.length ? adults.filter((v) => !v.job && !v.business).length / adults.length : 0,
    fatigue: share(views, (v) => has(v, "Jornada exaustiva") || has(v, "Pagamento por peça")),
    poor: share(views, (v) => v.wealth === "baixa"),
    unsafe: share(views, (v) => has(v, "Bairro perigoso")),
    polluted: share(views, (v) => has(v, "Ar poluído")),
    nohospital: share(views, (v) => has(v, "Sem hospital") || has(v, "Idoso sem hospital")),
    noincome: retirees.length ? retirees.filter((v) => has(v, "Aposentado(a) sem renda")).length / retirees.length : 0,
    kids,
    fewkids: 1 - Math.min(1, kids * 5),
    unhappy: share(views, (v) => v.mood === "triste"),
    deficit: s.money < 1000 ? 1 : 0,
    strike: s.strike?.share ?? 0,
  };
}

/**
 * Nível de crise da cidade (0..5): greve geral, caixa no vermelho, desastre recente, desemprego alto,
 * povo triste e bairros perigosos. Com 3 ou mais, o Fascista entra na disputa.
 */
export function crisisLevel(s: Pick<CityState, "money" | "strike" | "lastDisasterCycle" | "cyclesCompleted">, g: Signals): number {
  let n = 0;
  if (g.strike >= 0.2) n++;
  if (s.money < 0) n++;
  if (s.lastDisasterCycle !== null && s.cyclesCompleted - s.lastDisasterCycle <= 6) n++;
  if (g.unemployed >= 0.25) n++;
  if (g.unhappy >= 0.4) n++;
  if (g.unsafe >= 0.4) n++;
  return n;
}

/** Quanto a crise empurra o eleitor para o Fascista (0 = não há crise). */
export const crisisPull = (level: number): number => (level >= 3 ? 1 + (level - 3) * 0.6 : 0);

/** Partidos na urna: o Fascista só aparece na crise. */
export const ballot = (crisis: number): PartyId[] => PARTY_IDS.filter((p) => !PARTIES[p].crisisOnly || crisis > 0);

/** Para qual partido cada morador tende a votar: pesos pelo que vive, pelas necessidades da idade e pela crise. */
export function leaning(v: CitizenView, s: Pick<CityState, "council"> & Partial<Pick<CityState, "ordinances">>, crisis = 0): Record<PartyId, number> {
  // Na crise o Fascista já parte com algum apoio entre os descontentes em geral.
  const w: Record<PartyId, number> = { esquerda: 1, socialdemocrata: 1, centro: 1, liberal: 1, conservador: 1, fascista: 0.5 * crisis };
  const has = (t: string) => v.reasons.some((r) => r.text.startsWith(t));
  const unmet = v.needs.filter((n) => !n.met).length;
  // Dificuldade econômica: esquerda e social-democratas.
  if ((v.stage === "adulto" || v.group === "jovem") && !v.job && !v.business) {
    w.esquerda += 2;
    w.socialdemocrata += 1;
  }
  if (v.job && (v.job.category === "agro" || v.job.category === "industria" || v.job.category === "madeira" || v.job.category === "mineracao")) w.esquerda += 1;
  if (has("Jornada exaustiva") || has("Pagamento por peça")) {
    w.esquerda += 1.5;
    w.socialdemocrata += 0.5;
  }
  if (v.wealth === "baixa") w.esquerda += 0.6;
  if (has("Aposentado(a) sem renda")) {
    w.socialdemocrata += 2;
    w.esquerda += 1;
  }
  // Necessidades da idade que faltam: o bem-estar social ganha voto.
  w.socialdemocrata += unmet * 0.8;
  w.esquerda += unmet * 0.3;
  if (v.group === "crianca" || v.children > 0) {
    w.socialdemocrata += 1;
    w.conservador += 0.8;
  }
  if (v.group === "idoso") {
    w.socialdemocrata += 1.5;
    w.conservador += 0.8;
  }
  // Negócio próprio: o empreendedor vota à direita; o cooperado, à esquerda.
  if (v.business === "empreendedor") {
    w.liberal += 2.5;
    w.conservador += 1.2;
  } else if (v.business === "cooperado") {
    w.esquerda += 2.2;
    w.socialdemocrata += 1.2;
  }
  // Riqueza e negócios: liberais e conservadores.
  if (v.wealth === "alta") {
    w.liberal += 2;
    w.conservador += 1;
  } else if (v.wealth === "media") {
    w.liberal += 0.8;
    w.centro += 0.5;
  }
  if (v.job?.category === "comercio") w.liberal += 1;
  // Ar, parques e segurança.
  if (has("Ar poluído")) {
    w.socialdemocrata += 1.2;
    w.esquerda += 0.5;
  }
  if (has("Bairro perigoso")) {
    w.conservador += 2;
    w.fascista += 0.8 * crisis;
  }
  // Humor: quem está bem fica no centro e no governo; quem está mal procura os extremos.
  if (v.mood === "feliz") w.centro += 1.5;
  else if (v.mood === "ok") w.centro += 0.8;
  else {
    w.esquerda += 0.4;
    w.fascista += 1.2 * crisis;
  }
  if (!v.job && !v.business && v.stage === "adulto") w.fascista += 0.6 * crisis;
  // Prestígio: quem teve leis aprovadas pelo prefeito sai mais forte; quem foi vetado, mais fraco.
  for (const p of PARTY_IDS) w[p] += (s.council?.standing[p] ?? 0) * 0.25;
  // Decretos em vigor: quem os defende ganha um pouco de apoio enquanto durarem.
  for (const id of Object.keys(s.ordinances ?? {}) as OrdinanceId[]) {
    const pol = ORDINANCE_POLITICS[id];
    if (pol) w[pol.party] += 0.3;
  }
  if (!crisis) w.fascista = 0;
  return w;
}

/** Cadeiras por partido (método D'Hondt) a partir dos votos. */
function dhondt(votes: Record<PartyId, number>, seats: number): Record<PartyId, number> {
  const out: Record<PartyId, number> = { esquerda: 0, socialdemocrata: 0, centro: 0, liberal: 0, conservador: 0, fascista: 0 };
  for (let i = 0; i < seats; i++) {
    let best: PartyId = PARTY_IDS[0];
    let bestQ = -1;
    for (const p of PARTY_IDS) {
      const q = votes[p] / (out[p] + 1);
      if (q > bestQ) {
        bestQ = q;
        best = p;
      }
    }
    out[best]++;
  }
  return out;
}

export interface ElectionResult {
  seats: Record<PartyId, number>;
  votes: Record<PartyId, number>;
  members: { id: number; name: string; party: PartyId }[];
  /** Nível de crise na hora da eleição (3 ou mais: o Fascista disputa). */
  crisis: number;
}

/** Realiza a eleição: cada morador adulto vota; os mais votados de cada partido viram vereadores. */
export function holdElection(s: CityState, rand: () => number): ElectionResult | null {
  const all = citizensView(s);
  const views = all.filter((v) => v.stage !== "crianca");
  if (!views.length) return null;
  const level = crisisLevel(s, signalsOf(all, s));
  const crisis = crisisPull(level);
  const parties = ballot(crisis);
  const votes: Record<PartyId, number> = { esquerda: 0, socialdemocrata: 0, centro: 0, liberal: 0, conservador: 0, fascista: 0 };
  const byParty: Record<PartyId, CitizenView[]> = { esquerda: [], socialdemocrata: [], centro: [], liberal: [], conservador: [], fascista: [] };
  for (const v of views) {
    const w = leaning(v, s, crisis);
    // Cada eleitor decide pelo partido de maior peso, com uma pitada de acaso.
    let best: PartyId = parties[0];
    let bestW = -1;
    for (const p of parties) {
      const x = w[p] + rand() * 1.6;
      if (x > bestW) {
        bestW = x;
        best = p;
      }
    }
    votes[best]++;
    byParty[best].push(v);
  }
  const seatCount = Math.min(seatsFor(s.population), views.length);
  const seats = dhondt(votes, seatCount);
  const members: ElectionResult["members"] = [];
  const used = new Set<number>();
  for (const p of PARTY_IDS) {
    // Candidatos: adultos (18–70) que votam no partido; sorteia sem repetir.
    const pool = byParty[p].filter((v) => v.age >= 18 && v.age <= 70 && !used.has(v.id));
    for (let k = 0; k < seats[p]; k++) {
      let pick = pool.length ? pool.splice(Math.floor(rand() * pool.length), 1)[0] : undefined;
      if (!pick) {
        const rest = views.filter((v) => v.age >= 18 && v.age <= 70 && !used.has(v.id));
        pick = rest.length ? rest[Math.floor(rand() * rest.length)] : undefined;
      }
      if (!pick) continue;
      used.add(pick.id);
      members.push({ id: pick.id, name: pick.name, party: p });
    }
  }
  return { seats, votes, members, crisis: level };
}

// ───────────────────────── propostas ─────────────────────────

/** Por que a lei ainda não faz sentido na época da cidade (null = pode ser proposta). */
export function lawEraLock(s: Pick<CityState, "cyclesCompleted" | "techs">, id: LawId): string | null {
  const e = LAW_ERA[id];
  if (!e) return null;
  const year = cityYear(s);
  if (year < e.year) return `Só a partir de ${e.year}`;
  if (e.tech && !hasTech(s, e.tech)) return `Exige a tecnologia ${e.tech}`;
  return null;
}

/** Leis que o partido ainda pode propor (nem em vigor, nem já na pauta, e que cabem na época). */
function available(s: CityState, party: PartyId): LawId[] {
  const c = s.council!;
  const taken = new Set<LawId>([...c.laws, ...c.bills.map((b) => b.law)]);
  return LAW_IDS.filter((id) => LAWS[id].party === party && !taken.has(id) && lawEraLock(s, id) === null);
}

/** Que indicadores da cidade cada lei responde (quanto mais alto o indicador, mais o partido a propõe). */
const ANSWERS: Partial<Record<LawId, keyof Signals>> = {
  jornada_8h: "fatigue",
  cooperativas_trabalhadores: "unemployed",
  fabricas_recuperadas: "unemployed",
  banco_cooperativo: "unemployed",
  microempreendedor: "unemployed",
  credito_pequenos_negocios: "unemployed",
  polo_startups: "unemployed",
  imposto_simplificado: "unemployed",
  feira_empreendedores: "unemployed",
  incubadora_municipal: "unemployed",
  microcredito_solidario: "unemployed",
  negocio_familiar: "unemployed",
  seguro_desemprego: "unemployed",
  moradia_publica: "poor",
  habitacao_social: "poor",
  restaurante_popular: "poor",
  grandes_fortunas: "poor",
  participacao_lucros: "fatigue",
  descanso_remunerado: "fatigue",
  creche_publica: "kids",
  escola_integral: "kids",
  licenca_parental: "fewkids",
  auxilio_casamento: "fewkids",
  vacinacao_massa: "nohospital",
  coleta_seletiva: "polluted",
  ciclovias: "polluted",
  reforco_policial: "unsafe",
  conselhos_bairro: "unsafe",
  protecao_propriedade: "unsafe",
  guarda_nacional: "unsafe",
  vigilancia_total: "unsafe",
  responsabilidade_fiscal: "deficit",
  privatizacao_servicos: "deficit",
  conciliacao_trabalhista: "strike",
  corporativismo_estado: "strike",
  salario_minimo: "poor",
  fiscalizacao: "fatigue",
  taxar_grandes_empresas: "poor",
  saude_universal: "nohospital",
  merenda_escolar: "kids",
  pensao_universal: "noincome",
  renda_basica: "poor",
  arborizacao: "polluted",
  taxa_carbono: "polluted",
  orcamento_participativo: "unhappy",
  parceria_publico_privada: "deficit",
  reforma_administrativa: "deficit",
  energia_limpa: "polluted",
  isencao_industria: "unemployed",
  desburocratizacao: "unemployed",
  livre_comercio: "deficit",
  toque_recolher: "unsafe",
  guarda_municipal: "unsafe",
  austeridade: "deficit",
  incentivo_familia: "fewkids",
  estado_de_excecao: "unsafe",
  proibicao_greves: "strike",
  milicia_urbana: "unsafe",
};

/** Peso da lei na pauta: 1 + 4× o indicador que ela resolve (o partido propõe o que o momento pede). */
export const relevance = (law: LawId, g: Signals): number => 1 + 4 * (ANSWERS[law] ? g[ANSWERS[law]!] : 0);

/** Sorteia o partido pelas cadeiras e uma lei do espectro dele, favorecendo o que a cidade precisa. */
function proposeBill(s: CityState, rand: () => number, g: Signals): Bill | null {
  const c = s.council!;
  const parties = PARTY_IDS.filter((p) => c.members.some((m) => m.party === p) && available(s, p).length);
  if (!parties.length) return null;
  const weights = parties.map((p) => c.members.filter((m) => m.party === p).length);
  let x = rand() * weights.reduce((a, b) => a + b, 0);
  let party = parties[parties.length - 1];
  for (let i = 0; i < parties.length; i++) {
    x -= weights[i];
    if (x <= 0) {
      party = parties[i];
      break;
    }
  }
  const laws = available(s, party);
  const lw = laws.map((l) => relevance(l, g));
  let y = rand() * lw.reduce((a, b) => a + b, 0);
  let law = laws[laws.length - 1];
  for (let i = 0; i < laws.length; i++) {
    y -= lw[i];
    if (y <= 0) {
      law = laws[i];
      break;
    }
  }
  const mine = c.members.filter((m) => m.party === party);
  const proposer = mine[Math.floor(rand() * mine.length)].id;
  return { id: c.nextBillId++, law, party, proposer, cycle: s.cyclesCompleted };
}

export interface CouncilReport {
  /** O Fascista conquistou 2/3 da câmara: golpe e fim de jogo. */
  coup?: boolean;
  election?: { seats: Record<PartyId, number>; members: { name: string; party: PartyId }[]; crisis: number; extraordinary?: boolean };
  /** Lei proposta neste ciclo. */
  proposal?: { id: number; law: LawId; party: PartyId; proposer: string };
  /** Propostas arquivadas por falta de decisão. */
  expired: number;
  /** Vereadores que morreram ou se mudaram e foram substituídos. */
  replaced: number;
}

/**
 * Um ciclo da câmara: eleição (na primeira vez e a cada 16 ciclos), substituição de vereadores que
 * saíram da cidade e uma nova proposta de lei.
 */
export function councilStep(s: CityState, rand: () => number): CouncilReport {
  const out: CouncilReport = { expired: 0, replaced: 0 };
  s.council ??= newCouncil();
  if (s.ended) return out;
  const c = s.council;
  const now = s.cyclesCompleted;
  if (s.population < MIN_COUNCIL_POPULATION || !s.citizens.length) return out;

  const termOver = !c.members.length || now - c.electedAt >= TERM_CYCLES;
  // Eleição extraordinária: em crise grave, depois de um ano de mandato, o povo pode exigir novas urnas.
  let early = false;
  if (!termOver && now - c.electedAt >= EARLY_MIN_CYCLES) {
    early = crisisLevel(s, signalsOf(citizensView(s), s)) >= 3 && rand() < EARLY_CHANCE;
  }
  const due = termOver || early;
  if (due) {
    const r = holdElection(s, rand);
    if (r) {
      c.members = r.members.map((m) => ({ id: m.id, party: m.party }));
      c.electedAt = now;
      out.election = { seats: r.seats, members: r.members.map((m) => ({ name: m.name, party: m.party })), crisis: r.crisis, extraordinary: early || undefined };
      const first = c.history.length === 0 && c.laws.length === 0;
      if (isCoup(c)) {
        // Dois terços da câmara: os fascistas tomam a prefeitura e o jogo termina.
        s.ended = { cause: "golpe", cycle: now };
        out.coup = true;
        note(c, now, "GOLPE: o Fascista tem 2/3 da câmara e toma o poder");
      }
      note(c, now, `${first ? "Primeira eleição" : early ? "Eleição extraordinária" : "Eleição"}${r.crisis >= 3 ? " (em crise)" : ""}: ${PARTY_IDS.filter((p) => r.seats[p]).map((p) => `${PARTIES[p].short} ${r.seats[p]}`).join(", ")}`);
    }
    return out;
  }

  // Vereador que morreu ou se mudou é substituído por um suplente do mesmo partido.
  const alive = new Set(s.citizens);
  for (const m of c.members) {
    if (alive.has(m.id)) continue;
    const taken = new Set(c.members.map((x) => x.id));
    const pool = s.citizens.filter((id) => !taken.has(id) && s.people[id] && ageYears(s.people[id], now) >= 18 && ageYears(s.people[id], now) <= 70);
    if (pool.length) {
      m.id = pool[Math.floor(rand() * pool.length)];
      out.replaced++;
    }
  }

  // Propostas sem decisão: ficam na pauta até o limite; as mais antigas são arquivadas.
  while (c.bills.length >= MAX_PENDING_BILLS) {
    const old = c.bills.shift()!;
    out.expired++;
    note(c, now, `Arquivada sem decisão: ${LAWS[old.law].name}`);
  }
  const bill = proposeBill(s, rand, signalsOf(citizensView(s), s));
  if (bill) {
    c.bills.push(bill);
    out.proposal = { id: bill.id, law: bill.law, party: bill.party, proposer: citizenProfile(s, bill.proposer).name };
  }
  return out;
}

// ───────────────────────── decisões do prefeito ─────────────────────────

/**
 * Assinar um decreto dá +1 de prestígio ao partido que o defende e −1 aos adversários; revogar faz o
 * contrário. O prestígio pesa nos votos da próxima eleição.
 */
export function ordinanceFavor(s: CityState, id: OrdinanceId, signed: boolean): void {
  const pol = ORDINANCE_POLITICS[id];
  const c = s.council;
  if (!pol || !c) return;
  const d = signed ? 1 : -1;
  c.standing[pol.party] = clamp(c.standing[pol.party] + d, -5, 5);
  for (const foe of pol.foes ?? []) c.standing[foe] = clamp(c.standing[foe] - d, -5, 5);
  const foes = (pol.foes ?? []).map((f) => PARTIES[f].short).join("/");
  note(c, s.cyclesCompleted, `Decreto ${signed ? "assinado" : "revogado"}: ${ORDINANCES[id].name} (${PARTIES[pol.party].short} ${d > 0 ? "+" : "−"}1${foes ? `, ${foes} ${d > 0 ? "−" : "+"}1` : ""})`);
}

/** Aprova ou veta uma proposta (muta `s`). Devolve erro em texto, ou null se deu certo. */
export function decideBill(s: CityState, id: number, approve: boolean): string | null {
  const c = s.council;
  const i = c?.bills.findIndex((b) => b.id === id) ?? -1;
  if (!c || i < 0) return "Esta proposta não está mais na pauta";
  const [bill] = c.bills.splice(i, 1);
  const def = LAWS[bill.law];
  if (approve) {
    c.laws.push(bill.law);
    c.standing[bill.party] = clamp(c.standing[bill.party] + 1, -5, 5);
    // Jornada máxima: todos os setores voltam a, no máximo, 8 horas.
    if (def.hoursCap && s.labor) {
      for (const k of Object.keys(s.labor) as (keyof typeof s.labor)[]) if (s.labor[k].hours > def.hoursCap) s.labor[k] = { ...s.labor[k], hours: def.hoursCap };
    }
    note(c, s.cyclesCompleted, `Aprovada: ${def.name}`);
  } else {
    c.standing[bill.party] = clamp(c.standing[bill.party] - 1, -5, 5);
    note(c, s.cyclesCompleted, `Vetada: ${def.name}`);
  }
  return null;
}

/** Revoga uma lei em vigor (o partido que a propôs perde prestígio). */
export function repealLaw(s: CityState, law: LawId): string | null {
  const c = s.council;
  if (!c || !c.laws.includes(law)) return "Esta lei não está em vigor";
  c.laws = c.laws.filter((l) => l !== law);
  c.standing[LAWS[law].party] = clamp(c.standing[LAWS[law].party] - 1, -5, 5);
  note(c, s.cyclesCompleted, `Revogada: ${LAWS[law].name}`);
  return null;
}
