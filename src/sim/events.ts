// Eventos aleatórios: a cada ciclo concluído há uma chance de algo acontecer na cidade.
// Alguns são instantâneos (mecenas, jazida, ratos), outros duram algumas estações (feira,
// greve, gripe) e há desafios com prazo (meta de população, de pesquisa) com prêmio.
// Tudo determinístico (seed + ciclo), como o resto da simulação.

import { addTo, getQty } from "./inventory";
import { RANKS, type CityState } from "./types";

export type EventId =
  | "feira"
  | "mecenas"
  | "jazida"
  | "festival"
  | "imigracao"
  | "gripe"
  | "greve"
  | "onda_calor"
  | "ratos"
  | "desafio_populacao"
  | "desafio_pesquisa";

export interface ActiveEvent {
  id: EventId;
  /** Ciclo (concluídos) em que começou. */
  start: number;
  /** Último ciclo em que ainda vale (inclusive). */
  until: number;
  /** Desafios: alvo a cumprir até `until`. */
  target?: number;
}

export interface EventNews {
  id: EventId;
  title: string;
  body: string;
  tone: "good" | "bad" | "neutral";
}

/** Efeitos dos eventos em andamento, lidos pelos sistemas do ciclo e pelo humor. */
export interface EventMods {
  tax: number;
  demandR: number;
  goods: number;
  /** Multiplicador da água produzida (onda de calor seca os poços). */
  water: number;
  mood: { text: string; delta: number }[];
}

const DEF: Record<EventId, { weight: number; duration: number; challenge?: boolean }> = {
  feira: { weight: 3, duration: 2 },
  mecenas: { weight: 2, duration: 0 },
  jazida: { weight: 2, duration: 0 },
  festival: { weight: 3, duration: 1 },
  imigracao: { weight: 2, duration: 2 },
  gripe: { weight: 2, duration: 2 },
  greve: { weight: 2, duration: 1 },
  onda_calor: { weight: 2, duration: 1 },
  ratos: { weight: 2, duration: 0 },
  desafio_populacao: { weight: 2, duration: 8, challenge: true },
  desafio_pesquisa: { weight: 1, duration: 6, challenge: true },
};

/** Chance de um evento novo por ciclo concluído. */
export const EVENT_CHANCE = 0.15;

const active = (s: Pick<CityState, "events" | "cyclesCompleted">) => (s.events ?? []).filter((e) => s.cyclesCompleted <= e.until);

export function eventMods(s: Pick<CityState, "events" | "cyclesCompleted">): EventMods {
  const m: EventMods = { tax: 0, demandR: 0, goods: 0, water: 1, mood: [] };
  for (const e of active(s)) {
    if (e.id === "feira") m.tax += 0.2;
    else if (e.id === "imigracao") m.demandR += 0.3;
    else if (e.id === "greve") {
      m.goods -= 0.5;
      m.mood.push({ text: "Greve na cidade", delta: -1 });
    } else if (e.id === "onda_calor") {
      m.water *= 0.75;
      m.mood.push({ text: "Onda de calor", delta: -1 });
    } else if (e.id === "gripe") m.mood.push({ text: "Surto de gripe", delta: -1 });
    else if (e.id === "festival") m.mood.push({ text: "Festival da cidade", delta: 1 });
  }
  return m;
}

/**
 * Sorteia e aplica os eventos do ciclo (muta `s`). Chamado no fim do ciclo, com o gerador do
 * ciclo. Também confere os desafios que venceram. Devolve as notícias para o relatório/jornal.
 */
export function rollEvents(
  s: CityState,
  rand: () => number,
  info: { healthServed: number },
): EventNews[] {
  const news: EventNews[] = [];
  s.events ??= [];

  // Desafios: confere metas cumpridas ou vencidas.
  for (const e of [...s.events]) {
    if (!DEF[e.id].challenge || e.target === undefined) continue;
    const progress = e.id === "desafio_populacao" ? s.population : (s.techs?.length ?? 0);
    if (progress >= e.target) {
      const prize = e.id === "desafio_populacao" ? 400 + Math.round(e.target * 2) : 600;
      s.money += prize;
      news.push({ id: e.id, tone: "good", title: "Desafio cumprido!", body: `A meta foi alcançada antes do prazo: o governo premiou a cidade com $${prize}.` });
      s.events = s.events.filter((x) => x !== e);
    } else if (s.cyclesCompleted > e.until) {
      news.push({ id: e.id, tone: "bad", title: "Desafio não cumprido", body: "O prazo acabou sem a meta. O governo cancelou o prêmio — fica para a próxima." });
      s.events = s.events.filter((x) => x !== e);
    }
  }
  // Eventos que acabaram saem da lista.
  s.events = s.events.filter((e) => DEF[e.id].challenge || s.cyclesCompleted <= e.until);

  if (s.population < 20 || rand() >= EVENT_CHANCE) return news;

  const hasChallenge = s.events.some((e) => DEF[e.id].challenge);
  const pool = (Object.keys(DEF) as EventId[]).filter((id) => !(DEF[id].challenge && hasChallenge) && !s.events!.some((e) => e.id === id));
  const total = pool.reduce((a, id) => a + DEF[id].weight, 0);
  let x = rand() * total;
  const id = pool.find((p) => (x -= DEF[p].weight) <= 0) ?? pool[0];
  // Vale nas próximas `duration` estações (o evento é sorteado no fim do ciclo).
  const ev: ActiveEvent = { id, start: s.cyclesCompleted, until: s.cyclesCompleted + DEF[id].duration };

  switch (id) {
    case "feira":
      news.push({ id, tone: "good", title: "Feira comercial na praça", body: "Mascates de toda a região: o comércio arrecada 20% mais impostos nas próximas 2 estações." });
      break;
    case "mecenas": {
      const gift = 200 + Math.round(s.population * 1.5);
      s.money += gift;
      news.push({ id, tone: "good", title: "Mecenas doa à cidade", body: `Um benfeitor anônimo doou $${gift} à prefeitura.` });
      break;
    }
    case "jazida": {
      const qty = 20 + Math.round(rand() * 20);
      addTo(s.inventory, "ore", "B", qty);
      news.push({ id, tone: "good", title: "Descoberta uma jazida!", body: `Garimpeiros acharam ${qty} unidades de minério de qualidade B, já no estoque.` });
      break;
    }
    case "festival":
      s.money += 100;
      news.push({ id, tone: "good", title: "Festival anima a cidade", body: "Música e comida na rua: moradores mais felizes e $100 em barracas." });
      break;
    case "imigracao":
      news.push({ id, tone: "good", title: "Onda de imigrantes", body: "Famílias chegam atrás de trabalho: a procura por moradia sobe nas próximas 2 estações." });
      break;
    case "gripe": {
      // Hospitais seguram o surto; sem eles, parte da população vai embora.
      const loss = info.healthServed >= 0.6 ? 0 : Math.round(s.population * (0.08 - info.healthServed * 0.1));
      s.population = Math.max(0, s.population - loss);
      news.push({
        id,
        tone: "bad",
        title: "Surto de gripe",
        body: loss > 0 ? `Sem atendimento suficiente, ${loss} moradores deixaram a cidade. Hospitais evitam isso.` : "Os hospitais deram conta: ninguém precisou deixar a cidade.",
      });
      break;
    }
    case "greve":
      news.push({ id, tone: "bad", title: "Greve dos operários", body: "A indústria produz metade dos bens nesta estação. Moradores insatisfeitos." });
      break;
    case "onda_calor":
      news.push({ id, tone: "bad", title: "Onda de calor", body: "Poços e bombas rendem 25% menos nesta estação. Caixas d'água ajudam." });
      break;
    case "ratos": {
      let lost = 0;
      for (const r of RANKS) {
        const have = getQty(s.inventory, "food", r);
        const l = Math.floor(have * 0.2);
        if (l > 0) {
          s.inventory[`food:${r}`] = have - l;
          lost += l;
        }
      }
      news.push({ id, tone: "bad", title: "Praga de ratos nos armazéns", body: lost ? `Os ratos comeram ${lost} unidades de comida. Silos protegem o estoque.` : "Os armazéns estavam vazios: os ratos foram embora com fome." });
      break;
    }
    case "desafio_populacao":
      ev.target = Math.max(s.population + 40, Math.round(s.population * 1.3));
      news.push({ id, tone: "neutral", title: "Desafio do governo: crescer!", body: `Chegue a ${ev.target} moradores em ${DEF[id].duration} estações e ganhe um prêmio em dinheiro.` });
      break;
    case "desafio_pesquisa":
      ev.target = (s.techs?.length ?? 0) + 1;
      news.push({ id, tone: "neutral", title: "Desafio da academia", body: `Conclua uma nova tecnologia em ${DEF[id].duration} estações e ganhe $600.` });
      break;
  }
  if (DEF[id].duration > 0) s.events.push(ev);
  return news;
}

export const EVENT_LABEL: Record<EventId, string> = {
  feira: "Feira comercial",
  mecenas: "Mecenas",
  jazida: "Jazida",
  festival: "Festival",
  imigracao: "Imigração",
  gripe: "Surto de gripe",
  greve: "Greve",
  onda_calor: "Onda de calor",
  ratos: "Ratos",
  desafio_populacao: "Desafio: população",
  desafio_pesquisa: "Desafio: pesquisa",
};

/** Eventos em andamento (para mostrar na interface). */
export function activeEvents(s: Pick<CityState, "events" | "cyclesCompleted">): (ActiveEvent & { left: number })[] {
  return active(s).map((e) => ({ ...e, left: e.until - s.cyclesCompleted + 1 }));
}
