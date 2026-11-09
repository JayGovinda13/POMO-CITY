import { BUILDINGS } from "./catalog";
import { take, totalAtLeast } from "./inventory";
import type { CityState, Command } from "./types";
import { buildingAt, idx, inBounds } from "./world";

export type CommandResult = { ok: true; state: CityState } | { ok: false; error: string };

export const cloneState = (s: CityState): CityState => structuredClone(s);

/** Verifica se um comando é válido sem alterar o estado. */
export function validateCommand(s: CityState, cmd: Command): string | null {
  if (!Number.isInteger(cmd.x) || !Number.isInteger(cmd.y) || !inBounds(s, cmd.x, cmd.y)) {
    return "Fora do mapa";
  }
  if (cmd.type === "build") {
    const def = BUILDINGS[cmd.building];
    if (!def || !def.buildable) return "Construção inválida";
    if (s.terrain[idx(s, cmd.x, cmd.y)] !== 0) return "Não dá para construir na água";
    if (buildingAt(s, cmd.x, cmd.y)) return "Tile ocupado";
    if (s.money < def.cost) return "Dinheiro insuficiente";
    for (const m of def.materials ?? []) {
      if (totalAtLeast(s.inventory, m.resource, m.minRank) < m.qty) {
        return `Requer ${m.qty}× ${m.resource} rank ${m.minRank}+`;
      }
    }
    return null;
  }
  if (cmd.type === "demolish") {
    const b = buildingAt(s, cmd.x, cmd.y);
    if (!b) return "Nada para demolir";
    if (b.type === "cityhall") return "A prefeitura não pode ser demolida";
    return null;
  }
  return "Comando desconhecido";
}

/** Aplica um comando, retornando um NOVO estado (o original não é alterado). */
export function applyCommand(s: CityState, cmd: Command): CommandResult {
  const error = validateCommand(s, cmd);
  if (error) return { ok: false, error };
  const next = cloneState(s);
  if (cmd.type === "build") {
    const def = BUILDINGS[cmd.building];
    next.money -= def.cost;
    for (const m of def.materials ?? []) {
      // Gasta o mínimo de qualidade necessário, preservando o excedente premium.
      take(next.inventory, m.resource, m.qty, { minRank: m.minRank, prefer: "low" });
    }
    next.buildings.push({ id: next.nextId++, type: cmd.building, x: cmd.x, y: cmd.y });
  } else {
    next.buildings = next.buildings.filter((b) => !(b.x === cmd.x && b.y === cmd.y));
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
