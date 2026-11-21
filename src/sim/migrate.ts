import { DEFAULT_POLICIES, START_EQ, START_LIFE } from "./config";
import { CURRENT_SCHEMA_VERSION, ZONE, type CityState } from "./types";
import { legacyTrees } from "./terrain";
import { placeHallWings } from "./world";
import { DEFAULT_LABOR } from "./labor";
import { DEFAULT_PENSION } from "./pension";
import { ensureLives } from "./demography";
import { LAWS, PARTIES, newCouncil, type LawId, type PartyId } from "./laws";

/**
 * Atualiza estados salvos em versões antigas para o formato atual.
 * Chamado na leitura (servidor e cliente); é idempotente.
 */
export function migrateState(raw: CityState): CityState {
  let s = raw as CityState & { schemaVersion?: number };
  const from = s.schemaVersion ?? 1;
  if (from >= CURRENT_SCHEMA_VERSION) return s;
  s = structuredClone(s);

  if (from < 2) {
    // v1 → v2: camadas de zoneamento e energia.
    const n = s.width * s.height;
    s.zoneType = new Array(n).fill(ZONE.NONE);
    s.zoneDensity = new Array(n).fill(0);
    s.zoneLevel = new Array(n).fill(0);
    s.wires = new Array(n).fill(0);
    // Casas construídas à mão viram lotes residenciais leves já desenvolvidos (8 moradores).
    for (const b of s.buildings) {
      if (b.type !== "house") continue;
      const i = b.y * s.width + b.x;
      s.zoneType[i] = ZONE.R;
      s.zoneLevel[i] = 2;
    }
    s.buildings = s.buildings.filter((b) => b.type !== "house");
    // A prefeitura instala a rede elétrica sob as ruas existentes, para nada parar de funcionar.
    for (const b of s.buildings) if (b.type === "road") s.wires[b.y * s.width + b.x] = 1;
  }

  if (from < 3) {
    // v2 → v3: região climática (escolhida no próximo acesso), calendário e sequência guardada.
    s.regionId = null;
    s.calendarOffset = 0;
    s.streakFrozen = false;
    s.disasterCount = 0;
  }

  if (from < 4) {
    // v3 → v4: moradores individuais (os atuais ganham ids 1..população).
    s.citizens = Array.from({ length: Math.max(0, s.population) }, (_, i) => i + 1);
    s.nextCitizenId = s.citizens.length + 1;
    s.lastDisasterCycle = null;
  }

  if (from < 5) {
    // v4 → v5: políticas de excedente (economia de recursos).
    s.policies = structuredClone(DEFAULT_POLICIES);
  }

  if (from < 6) {
    // v5 → v6: orçamento (impostos, verbas, títulos, decretos, dificuldade).
    s.taxes = { R: 9, C: 9, I: 9 };
    s.funding = { transport: 100, energy: 100, police: 100, fire: 100, health: 100, education: 100 };
    s.bonds = [];
    s.nextBondId = 1;
    s.ordinances = {};
    s.difficulty = "medio";
  }

  if (from < 7) {
    // v6 → v7: seguro da cidade e contador de ciclos quebrados.
    s.insurance = { plan: "none", since: 0, bonusMalus: 1, lastClaimCycle: null };
    s.breaks = 0;
  }

  if (from < 8) {
    // v7 → v8: camada subterrânea de canos (a prefeitura já tem um poço para começar).
    s.pipes = new Array(s.width * s.height).fill(0);
  }

  if (from < 9) {
    // v8 → v9: serviços (verbas novas, QE e expectativa de vida).
    s.funding = Object.assign({ police: 100, fire: 100, health: 100, education: 100 }, s.funding);
    s.eq = START_EQ;
    s.lifeExpectancy = START_LIFE;
  }

  if (from < 10) {
    // v9 → v10: relevo plano e as árvores que já apareciam como decoração viram camada real.
    s.elevation = new Array(s.width * s.height).fill(0);
    s.trees = legacyTrees(s);
    // Árvore não convive com construção ou lote desenvolvido.
    for (const b of s.buildings) s.trees[b.y * s.width + b.x] = 0;
    for (let i = 0; i < s.trees.length; i++) if (s.zoneType[i] || s.wires[i]) s.trees[i] = 0;
  }

  if (from < 11) {
    // v10 → v11: árvore de tecnologia e eventos aleatórios.
    s.techs = [];
    s.research = { target: null, progress: 0 };
    s.events = [];
  }

  if (from < 12) {
    // v11 → v12: a prefeitura virou um palácio de 3 tiles (ganha duas alas).
    placeHallWings(s);
  }

  if (from < 13) {
    // v12 → v13: jornada e pagamento por setor.
    s.labor = structuredClone(DEFAULT_LABOR);
  }

  if (from < 14) {
    // v13 → v14: desgaste e obras longas. As construções que já existem começam novas.
    for (const b of s.buildings) b.builtAt ??= s.cyclesCompleted;
  }

  if (from < 15) {
    // v14 → v15: greves por causa.
    s.strike = { share: 0, causes: [] };
  }

  if (from < 16) {
    // v15 → v16: moradores ganham idade e família; previdência desligada.
    s.pension = { ...DEFAULT_PENSION };
    s.people = {};
    ensureLives(s);
  }

  if (from < 17) {
    // v16 → v17: câmara de vereadores (a primeira eleição acontece no próximo ciclo).
    s.council = newCouncil();
  }

  if (from < 18) {
    // v17 → v18: seis partidos no espectro (esquerda → direita); as leis mudaram de partido.
    const c = s.council as unknown as { members: { id: number; party: string }[]; bills: { law: LawId; party: string }[]; standing: Record<string, number> };
    const MAP: Record<string, PartyId> = { trabalho: "esquerda", empresas: "liberal", verde: "socialdemocrata", social: "socialdemocrata", ordem: "conservador" };
    const fix = (p: string): PartyId => MAP[p] ?? (p in PARTIES ? (p as PartyId) : "centro");
    for (const m of c.members ?? []) m.party = fix(m.party);
    for (const b of c.bills ?? []) b.party = LAWS[b.law]?.party ?? fix(b.party);
    const standing: Record<PartyId, number> = { esquerda: 0, socialdemocrata: 0, centro: 0, liberal: 0, conservador: 0, fascista: 0 };
    for (const [k, v] of Object.entries(c.standing ?? {})) standing[fix(k)] = Math.max(-5, Math.min(5, standing[fix(k)] + v));
    c.standing = standing;
    // Leis em vigor que ficaram sem lei correspondente (não deve ocorrer) são descartadas.
    s.council.laws = (s.council.laws ?? []).filter((l) => l in LAWS);
  }

  if (from < 19) {
    // v18 → v19: fim de jogo por golpe.
    s.ended = null;
  }

  s.schemaVersion = CURRENT_SCHEMA_VERSION;
  return s;
}
