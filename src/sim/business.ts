// Negócios próprios dos moradores: com leis de empreendedorismo (direita) parte de quem está sem emprego
// abre uma empresa; com leis de cooperativismo (esquerda) forma cooperativas. Empreendedores pagam mais
// imposto, mas quebram fácil (sobretudo na crise); cooperativas rendem menos, mas resistem melhor.

import { ecoState } from "./ecocycle";
import { isDown } from "./lifecycle";
import { lawCoop, lawEntrepreneur } from "./laws";
import type { CityState } from "./types";

export interface BusinessState {
  /** Moradores com negócio próprio. */
  entrepreneurs: number;
  /** Moradores em cooperativas. */
  coops: number;
}

export const newBusiness = (): BusinessState => ({ entrepreneurs: 0, coops: 0 });

/** Imposto por ciclo de cada negócio. */
export const TAX_ENTREPRENEUR = 2.2;
export const TAX_COOP = 1.2;
/** Chance base de quebrar por ciclo (dobra na crise econômica). */
export const FAIL_ENTREPRENEUR = 0.07;
export const FAIL_COOP = 0.04;

export interface BusinessReport {
  entrepreneurs: number;
  coops: number;
  opened: number;
  failed: number;
  /** Imposto arrecadado no ciclo. */
  tax: number;
}

/**
 * Um ciclo de negócios. `unemployed` = adultos sem vaga; só eles abrem negócio. Muta `s.business`.
 * Devolve o imposto arrecadado (já descontando a crise).
 */
/** Parte dos adultos empregados que também pode abrir negócio (autônomos e sócios). */
export const SIDE_BUSINESS_SHARE = 0.15;

export function businessStep(s: CityState, unemployed: number, rand: () => number, employed = 0): BusinessReport {
  s.business ??= newBusiness();
  const b = s.business;
  // Incubadoras e cooperativas fabris em operação reforçam o que as leis fazem (e funcionam sem lei).
  const running = (t: string) => s.buildings.filter((x) => x.type === t && !isDown(x, s)).length;
  const incubators = running("incubator");
  const coopPlants = running("worker_coop");
  const E = Math.min(2, lawEntrepreneur(s) + incubators * 0.4);
  const C = Math.min(2, lawCoop(s) + coopPlants * 0.5);
  const crise = ecoState(s).phase === "crise";

  // Quebras (e dissolução quando a lei foi revogada).
  const failE = Math.min(0.9, FAIL_ENTREPRENEUR * (crise ? 2 : 1) * (E > 0 ? 1 : 2));
  const failC = Math.min(0.9, FAIL_COOP * (crise ? 1.5 : 1) * (C > 0 ? 1 : 3) * (coopPlants > 0 ? 0.5 : 1));
  const lose = (n: number, p: number) => {
    let out = 0;
    for (let i = 0; i < n; i++) if (rand() < p) out++;
    return out;
  };
  const failedE = lose(b.entrepreneurs, failE);
  const failedC = lose(b.coops, failC);
  b.entrepreneurs -= failedE;
  b.coops -= failedC;

  // Aberturas: uma fração dos desempregados que ainda não têm negócio.
  // Quem pode ter negócio: os sem vaga e uma parte dos empregados (autônomos).
  const pool = unemployed + Math.floor(employed * SIDE_BUSINESS_SHARE);
  const free = Math.max(0, pool - b.entrepreneurs - b.coops);
  const openE = E > 0 ? Math.floor(free * Math.min(0.5, 0.12 * E) + rand()) : 0;
  const freeC = Math.max(0, free - openE);
  const openC = C > 0 ? Math.floor(freeC * Math.min(0.5, 0.1 * C) + rand()) : 0;
  b.entrepreneurs += Math.min(openE, free);
  b.coops += Math.min(openC, freeC);

  // O excesso sobre quem pode ter negócio fecha.
  let over = b.entrepreneurs + b.coops - pool;
  for (let k = 0; over > 0; k++) {
    // Fecha um de cada vez, alternando (o maior grupo primeiro).
    if (b.entrepreneurs >= b.coops ? b.entrepreneurs > 0 : b.coops === 0) b.entrepreneurs--;
    else b.coops--;
    over--;
  }

  const tax = Math.floor((b.entrepreneurs * TAX_ENTREPRENEUR + b.coops * TAX_COOP) * (crise ? 0.5 : 1));
  return { entrepreneurs: b.entrepreneurs, coops: b.coops, opened: openE + openC, failed: failedE + failedC, tax };
}

/** Quantos moradores têm negócio próprio (empreendedores + cooperados). */
export const businessCount = (s: Partial<Pick<CityState, "business">>): number => (s.business?.entrepreneurs ?? 0) + (s.business?.coops ?? 0);
