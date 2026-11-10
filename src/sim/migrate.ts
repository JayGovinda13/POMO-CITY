import { CURRENT_SCHEMA_VERSION, ZONE, type CityState } from "./types";

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

  s.schemaVersion = CURRENT_SCHEMA_VERSION;
  return s;
}
