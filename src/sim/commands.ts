import { BUILDINGS, PIPE_COST, WIRE_COST, ZONES } from "./catalog";
import { MAX_ZONE_AREA } from "./config";
import { RESOURCE_IDS, payMaterials, quoteMaterials, validatePolicy } from "./economy";
import { BOND_VALUE, MAX_TAX, ORDINANCES, creditRating } from "./finance";
import { PLANS, repairCost } from "./insurance";
import { DIRS4 } from "./grid";
import { ZONE, type CityState, type Command, type ZoneCode } from "./types";
import { lockReason } from "./unlocks";
import { buildingAt, idx, inBounds } from "./world";

export type CommandResult = { ok: true; state: CityState } | { ok: false; error: string };

export const cloneState = (s: CityState): CityState => structuredClone(s);

const isInt = (v: unknown): v is number => Number.isInteger(v);

export interface ZoneArea {
  tiles: number[];
  cost: number;
}

/** Tiles que um comando de zoneamento realmente altera, e quanto custa. */
export function zoneArea(s: CityState, cmd: Extract<Command, { type: "zone" }>): ZoneArea | string {
  const { x0, y0, x1, y1 } = cmd;
  if (![x0, y0, x1, y1].every(isInt) || !inBounds(s, x0, y0) || !inBounds(s, x1, y1)) return "Fora do mapa";
  const [ax, bx] = [Math.min(x0, x1), Math.max(x0, x1)];
  const [ay, by] = [Math.min(y0, y1), Math.max(y0, y1)];
  if ((bx - ax + 1) * (by - ay + 1) > MAX_ZONE_AREA) return `Área máxima: ${MAX_ZONE_AREA} tiles`;

  const occupied = new Set(s.buildings.map((b) => idx(s, b.x, b.y)));
  const code: ZoneCode = cmd.zone === "none" ? ZONE.NONE : ZONE[cmd.zone];
  const density = cmd.dense ? 1 : 0;
  const tiles: number[] = [];
  let cost = 0;
  for (let y = ay; y <= by; y++)
    for (let x = ax; x <= bx; x++) {
      const i = idx(s, x, y);
      // Água, construções, linhas e lotes já desenvolvidos ficam de fora.
      if (s.terrain[i] !== 0 || occupied.has(i) || s.wires[i] || s.zoneLevel[i] > 0) continue;
      if (s.zoneType[i] === code && (code === ZONE.NONE || s.zoneDensity[i] === density)) continue;
      tiles.push(i);
      if (cmd.zone !== "none") cost += ZONES[cmd.zone].cost[density];
    }
  return { tiles, cost };
}

/** Verifica se um comando é válido sem alterar o estado. */
export function validateCommand(s: CityState, cmd: Command): string | null {
  if (cmd.type === "zone") {
    if (cmd.zone !== "none" && !(cmd.zone in ZONES)) return "Zona inválida";
    if (cmd.dense && cmd.zone !== "none") {
      const lock = lockReason(ZONES[cmd.zone].denseRequires, s);
      if (lock) return `Zona densa: ${lock.toLowerCase()}`;
    }
    const area = zoneArea(s, cmd);
    if (typeof area === "string") return area;
    if (area.tiles.length === 0) return "Nada a zonear nessa área";
    if (s.money < area.cost) return "Dinheiro insuficiente";
    return null;
  }

  if (cmd.type === "policy") {
    if (!RESOURCE_IDS.includes(cmd.resource)) return "Recurso inválido";
    return validatePolicy({ mode: cmd.mode, value: cmd.value });
  }

  if (cmd.type === "budget") {
    for (const v of Object.values(cmd.taxes ?? {})) if (!isInt(v) || v < 0 || v > MAX_TAX) return `Impostos de 0 a ${MAX_TAX}%`;
    if (cmd.taxes && !["R", "C", "I"].every((k) => k in cmd.taxes!)) return "Impostos incompletos";
    for (const v of Object.values(cmd.funding ?? {})) if (!isInt(v) || v < 0 || v > 100) return "Verba de 0 a 100%";
    if (cmd.funding && !("transport" in cmd.funding && "energy" in cmd.funding)) return "Verbas incompletas";
    return null;
  }

  if (cmd.type === "ordinance") {
    if (!(cmd.id in ORDINANCES)) return "Decreto desconhecido";
    const active = s.ordinances[cmd.id] !== undefined;
    if (cmd.active === active) return cmd.active ? "Decreto já está em vigor" : "Decreto não está em vigor";
    return null;
  }

  if (cmd.type === "bond") {
    if (cmd.action === "issue") {
      const r = creditRating(s);
      if (s.bonds.length >= r.maxBonds) return `Rating ${r.rating}: o banco não empresta mais`;
      return null;
    }
    if (cmd.action === "repay") {
      if (!s.bonds.length) return "Não há títulos a pagar";
      if (s.money < s.bonds[0].principal) return `Precisa de $${s.bonds[0].principal} para quitar o título mais antigo`;
      return null;
    }
    return "Ação inválida";
  }

  if (cmd.type === "insurance") {
    if (cmd.plan !== "none" && !(cmd.plan in PLANS)) return "Plano inválido";
    if (cmd.plan === s.insurance.plan) return "Esse já é o plano atual";
    return null;
  }

  if (!isInt(cmd.x) || !isInt(cmd.y) || !inBounds(s, cmd.x, cmd.y)) return "Fora do mapa";

  if (cmd.type === "repair") {
    const b = buildingAt(s, cmd.x, cmd.y);
    if (!b?.damaged) return "Nada danificado aqui";
    const cost = repairCost(b.type);
    if (s.money < cost) return `Reparo custa $${cost}`;
    return null;
  }
  const i = idx(s, cmd.x, cmd.y);
  const here = buildingAt(s, cmd.x, cmd.y);

  if (cmd.type === "pipe") {
    // Canos ficam no subsolo: passam sob estradas, lotes e construções (Fase 6).
    if (s.terrain[i] !== 0) return "Canos não passam sob a água";
    if (s.pipes[i]) return "Já existe um cano aqui";
    if (s.money < PIPE_COST) return "Dinheiro insuficiente";
    return null;
  }

  if (cmd.type === "wire") {
    if (s.terrain[i] !== 0) return "Linhas não passam sobre a água";
    if (s.wires[i]) return "Já existe uma linha aqui";
    if (here && here.type !== "road") return "Linhas só cruzam estradas ou terreno livre";
    if (s.zoneLevel[i] > 0) return "Lote ocupado";
    if (s.money < WIRE_COST) return "Dinheiro insuficiente";
    return null;
  }

  if (cmd.type === "build") {
    const def = BUILDINGS[cmd.building];
    if (!def || !def.buildable) return "Construção inválida";
    const lock = lockReason(def.requires, s);
    if (lock) return lock;
    if (s.terrain[i] !== 0) return "Não dá para construir na água";
    if (here) return "Tile ocupado";
    if (s.zoneLevel[i] > 0) return "Lote já desenvolvido — demolir primeiro";
    if (s.wires[i] && cmd.building !== "road") return "Há uma linha de transmissão aqui";
    if (def.needsWaterAdjacent) {
      const touchesWater = DIRS4.some(([dx, dy]) => {
        const x = cmd.x + dx;
        const y = cmd.y + dy;
        return inBounds(s, x, y) && s.terrain[idx(s, x, y)] === 1;
      });
      if (!touchesWater) return "Precisa encostar na água";
    }
    // Materiais: do estoque; o que faltar é comprado no mercado externo (até o Rank B).
    const quote = quoteMaterials(s, def.materials);
    if (quote.impossible) return quote.impossible;
    if (s.money < def.cost + quote.importCost) {
      return quote.importCost
        ? `Dinheiro insuficiente ($${def.cost} + $${quote.importCost} de materiais importados)`
        : "Dinheiro insuficiente";
    }
    return null;
  }

  if (cmd.type === "demolish") {
    if (cmd.underground) return s.pipes[i] ? null : "Não há cano aqui";
    if (here?.type === "cityhall") return "A prefeitura não pode ser demolida";
    if (!here && !s.wires[i] && !s.zoneType[i]) return "Nada para demolir";
    return null;
  }
  return "Comando desconhecido";
}

/** Aplica um comando, retornando um NOVO estado (o original não é alterado). */
export function applyCommand(s: CityState, cmd: Command): CommandResult {
  const error = validateCommand(s, cmd);
  if (error) return { ok: false, error };
  const next = cloneState(s);

  if (cmd.type === "policy") {
    next.policies = { ...next.policies, [cmd.resource]: { mode: cmd.mode, value: cmd.value } };
  } else if (cmd.type === "insurance") {
    // Contratar ou trocar de plano reinicia a carência; o bônus/malus acompanha a cidade.
    next.insurance = { ...next.insurance, plan: cmd.plan, since: next.cyclesCompleted };
  } else if (cmd.type === "repair") {
    const b = next.buildings.find((x) => x.x === cmd.x && x.y === cmd.y)!;
    next.money -= repairCost(b.type);
    delete b.damaged;
  } else if (cmd.type === "budget") {
    if (cmd.taxes) next.taxes = { R: cmd.taxes.R, C: cmd.taxes.C, I: cmd.taxes.I };
    if (cmd.funding) next.funding = { transport: cmd.funding.transport, energy: cmd.funding.energy };
  } else if (cmd.type === "ordinance") {
    if (cmd.active) next.ordinances = { ...next.ordinances, [cmd.id]: next.cyclesCompleted };
    else {
      const rest = { ...next.ordinances };
      delete rest[cmd.id];
      next.ordinances = rest;
    }
  } else if (cmd.type === "bond") {
    if (cmd.action === "issue") {
      // Juros travados no rating do momento da emissão.
      next.bonds = [...next.bonds, { id: next.nextBondId++, principal: BOND_VALUE, rate: creditRating(next).rate, issuedCycle: next.cyclesCompleted }];
      next.money += BOND_VALUE;
    } else {
      const [oldest, ...rest] = next.bonds;
      next.money -= oldest.principal;
      next.bonds = rest;
    }
  } else if (cmd.type === "zone") {
    const area = zoneArea(next, cmd) as ZoneArea;
    const code: ZoneCode = cmd.zone === "none" ? ZONE.NONE : ZONE[cmd.zone];
    for (const i of area.tiles) {
      next.zoneType[i] = code;
      next.zoneDensity[i] = code === ZONE.NONE ? 0 : cmd.dense ? 1 : 0;
      next.zoneLevel[i] = 0;
    }
    next.money -= area.cost;
  } else if (cmd.type === "pipe") {
    next.pipes[idx(next, cmd.x, cmd.y)] = 1;
    next.money -= PIPE_COST;
  } else if (cmd.type === "demolish" && cmd.underground) {
    next.pipes[idx(next, cmd.x, cmd.y)] = 0;
  } else if (cmd.type === "wire") {
    next.wires[idx(next, cmd.x, cmd.y)] = 1;
    next.money -= WIRE_COST;
  } else if (cmd.type === "build") {
    const def = BUILDINGS[cmd.building];
    const i = idx(next, cmd.x, cmd.y);
    next.money -= def.cost;
    // Gasta o mínimo de qualidade necessário (preserva o premium) e importa o que faltar.
    payMaterials(next, def.materials);
    // Obras públicas desfazem o zoneamento do tile (como no modelo clássico).
    next.zoneType[i] = ZONE.NONE;
    next.zoneDensity[i] = 0;
    next.buildings.push({ id: next.nextId++, type: cmd.building, x: cmd.x, y: cmd.y });
  } else {
    // Demolição em camadas: construção → prédio do lote → linha → zoneamento.
    const i = idx(next, cmd.x, cmd.y);
    const here = buildingAt(next, cmd.x, cmd.y);
    if (here) next.buildings = next.buildings.filter((b) => b !== here && !(b.x === cmd.x && b.y === cmd.y));
    else if (next.zoneLevel[i] > 0) next.zoneLevel[i] = 0;
    else if (next.wires[i]) next.wires[i] = 0;
    else {
      next.zoneType[i] = ZONE.NONE;
      next.zoneDensity[i] = 0;
    }
  }
  next.version++;
  return { ok: true, state: next };
}

/** Aplica uma fila de comandos; os inválidos são descartados e reportados. */
export function applyCommands(
  s: CityState,
  cmds: Command[],
): { state: CityState; rejected: { index: number; command: Command; error: string }[] } {
  let state = s;
  const rejected: { index: number; command: Command; error: string }[] = [];
  cmds.forEach((command, index) => {
    const r = applyCommand(state, command);
    if (r.ok) state = r.state;
    else rejected.push({ index, command, error: r.error });
  });
  return { state, rejected };
}
