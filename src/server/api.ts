import "server-only";
import { NextResponse } from "next/server";
import { BREAK_SECONDS, BUILDINGS, LONG_BREAK_EVERY, LONG_BREAK_SECONDS, type BuildingType, type Command } from "@/sim";
import type { PlayerRecord } from "./repo";
import { ConflictError } from "./repo";
import { focusMs, getPlayerId, UnauthorizedError } from "./session";

export function snapshot(rec: PlayerRecord, extra: Record<string, unknown> = {}) {
  return NextResponse.json({
    state: rec.state,
    activeCycle: rec.activeCycle,
    serverNow: Date.now(),
    config: {
      focusSeconds: focusMs() / 1000,
      breakSeconds: BREAK_SECONDS,
      longBreakSeconds: LONG_BREAK_SECONDS,
      longBreakEvery: LONG_BREAK_EVERY,
    },
    ...extra,
  });
}

export const fail = (status: number, error: string, extra: Record<string, unknown> = {}) =>
  NextResponse.json({ error, ...extra }, { status });

const MAX_COMMANDS = 500;

/** Valida o formato da fila vinda do cliente; a validação de regras fica na simulação. */
export function parseCommands(raw: unknown): Command[] | null {
  if (raw === undefined) return [];
  if (!Array.isArray(raw) || raw.length > MAX_COMMANDS) return null;
  const out: Command[] = [];
  for (const c of raw) {
    if (!c || typeof c !== "object") return null;
    const { type, x, y, building } = c as Record<string, unknown>;
    if (typeof x !== "number" || typeof y !== "number") return null;
    if (type === "demolish") out.push({ type, x, y });
    else if (type === "build" && typeof building === "string" && Object.hasOwn(BUILDINGS, building)) {
      out.push({ type, building: building as BuildingType, x, y });
    } else return null;
  }
  return out;
}

/** Envolve uma rota: resolve o jogador e converte erros conhecidos em respostas HTTP. */
export function route(handler: (playerId: string, req: Request) => Promise<Response>) {
  return async (req: Request) => {
    try {
      return await handler(await getPlayerId(), req);
    } catch (e) {
      if (e instanceof UnauthorizedError) return fail(401, e.message);
      if (e instanceof ConflictError) return fail(503, e.message);
      console.error(e);
      return fail(500, "Erro interno");
    }
  };
}
