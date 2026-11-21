// Câmara de vereadores: eleita a cada 4 anos (16 ciclos) pelos próprios moradores, propõe uma lei por
// ciclo e o prefeito aprova ou veta. Os vereadores são moradores de verdade (nome, idade, partido).

import { citizenProfile, citizensView, type CitizenView } from "./citizens";
import { CYCLES_PER_YEAR } from "./config";
import { LAWS, LAW_IDS, PARTIES, PARTY_IDS, newCouncil, type Bill, type CouncilState, type LawId, type PartyId } from "./laws";
import { ageYears } from "./people";
import type { CityState } from "./types";

/** Mandato: 4 anos. */
export const TERM_CYCLES = 4 * CYCLES_PER_YEAR;
/** Só há câmara em cidades com pelo menos esta população. */
export const MIN_COUNCIL_POPULATION = 30;
/** Propostas esperando decisão (as mais antigas são arquivadas). */
export const MAX_PENDING_BILLS = 3;

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

/** Para qual partido cada morador tende a votar (pesos por interesses e situação). */
export function leaning(v: CitizenView, s: Pick<CityState, "council">): Record<PartyId, number> {
  const w: Record<PartyId, number> = { trabalho: 1, empresas: 1, verde: 1, social: 1, ordem: 1 };
  const has = (t: string) => v.reasons.some((r) => r.text.startsWith(t));
  if (v.stage === "adulto" && !v.job) w.trabalho += 2;
  if (v.job && (v.job.category === "agro" || v.job.category === "industria" || v.job.category === "madeira" || v.job.category === "mineracao")) w.trabalho += 1;
  if (has("Jornada exaustiva") || has("Pagamento por peça")) w.trabalho += 1.5;
  if (has("Aposentado(a) sem renda")) {
    w.social += 2;
    w.trabalho += 1;
  }
  if (v.wealth === "alta") w.empresas += 2;
  else if (v.wealth === "media") w.empresas += 0.8;
  if (v.job?.category === "comercio") w.empresas += 1;
  if (has("Ar poluído")) w.verde += 2;
  if (v.stage === "adulto" && v.age < 35) w.verde += 0.8;
  if (has("Parque")) w.verde += 0.5;
  if (v.children > 0) w.social += 1.2;
  if (v.stage === "aposentado") w.social += 1.5;
  if (has("Sem hospital")) w.social += 1.5;
  if (v.mood === "triste") w.social += 0.7;
  if (has("Bairro perigoso")) w.ordem += 2;
  if (v.wealth === "alta") w.ordem += 0.5;
  if (has("Trânsito parado") || has("Trabalho longe")) w.ordem += 0.5;
  // Prestígio: quem teve leis aprovadas pelo prefeito sai mais forte; quem foi vetado, mais fraco.
  for (const p of PARTY_IDS) w[p] += (s.council?.standing[p] ?? 0) * 0.25;
  return w;
}

/** Cadeiras por partido (método D'Hondt) a partir dos votos. */
function dhondt(votes: Record<PartyId, number>, seats: number): Record<PartyId, number> {
  const out: Record<PartyId, number> = { trabalho: 0, empresas: 0, verde: 0, social: 0, ordem: 0 };
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
}

/** Realiza a eleição: cada morador adulto vota; os mais votados de cada partido viram vereadores. */
export function holdElection(s: CityState, rand: () => number): ElectionResult | null {
  const views = citizensView(s).filter((v) => v.stage !== "crianca");
  if (!views.length) return null;
  const votes: Record<PartyId, number> = { trabalho: 0, empresas: 0, verde: 0, social: 0, ordem: 0 };
  const byParty: Record<PartyId, CitizenView[]> = { trabalho: [], empresas: [], verde: [], social: [], ordem: [] };
  for (const v of views) {
    const w = leaning(v, s);
    // Cada eleitor decide pelo partido de maior peso, com uma pitada de acaso.
    let best: PartyId = PARTY_IDS[0];
    let bestW = -1;
    for (const p of PARTY_IDS) {
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
    // Candidatos: adultos (16–70) que votam no partido; sorteia sem repetir.
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
  return { seats, votes, members };
}

// ───────────────────────── propostas ─────────────────────────

/** Leis que o partido ainda pode propor (nem em vigor, nem já na pauta). */
function available(s: CityState, party: PartyId): LawId[] {
  const c = s.council!;
  const taken = new Set<LawId>([...c.laws, ...c.bills.map((b) => b.law)]);
  return LAW_IDS.filter((id) => LAWS[id].party === party && !taken.has(id));
}

/** Sorteia o partido pelas cadeiras e uma lei dele; devolve null se não há nada novo a propor. */
function proposeBill(s: CityState, rand: () => number): Bill | null {
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
  const law = laws[Math.floor(rand() * laws.length)];
  const mine = c.members.filter((m) => m.party === party);
  const proposer = mine[Math.floor(rand() * mine.length)].id;
  return { id: c.nextBillId++, law, party, proposer, cycle: s.cyclesCompleted };
}

export interface CouncilReport {
  election?: { seats: Record<PartyId, number>; members: { name: string; party: PartyId }[] };
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
  const c = s.council;
  const now = s.cyclesCompleted;
  if (s.population < MIN_COUNCIL_POPULATION || !s.citizens.length) return out;

  const due = !c.members.length || now - c.electedAt >= TERM_CYCLES;
  if (due) {
    const r = holdElection(s, rand);
    if (r) {
      c.members = r.members.map((m) => ({ id: m.id, party: m.party }));
      c.electedAt = now;
      out.election = { seats: r.seats, members: r.members.map((m) => ({ name: m.name, party: m.party })) };
      const first = c.history.length === 0 && c.laws.length === 0;
      note(c, now, `${first ? "Primeira eleição" : "Eleição"}: ${PARTY_IDS.filter((p) => r.seats[p]).map((p) => `${PARTIES[p].short} ${r.seats[p]}`).join(", ")}`);
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
  const bill = proposeBill(s, rand);
  if (bill) {
    c.bills.push(bill);
    out.proposal = { id: bill.id, law: bill.law, party: bill.party, proposer: citizenProfile(s, bill.proposer).name };
  }
  return out;
}

// ───────────────────────── decisões do prefeito ─────────────────────────

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
