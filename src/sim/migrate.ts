import { DEFAULT_POLICIES, START_EQ, START_LIFE } from "./config";
import { CURRENT_SCHEMA_VERSION, ZONE, type CityState } from "./types";
import { legacyTrees } from "./terrain";

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

  s.schemaVersion = CURRENT_SCHEMA_VERSION;
  return s;
}
