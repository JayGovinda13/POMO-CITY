import "server-only";
import { NextResponse } from "next/server";
import {
  BREAK_SECONDS,
  BUILDINGS,
  LONG_BREAK_EVERY,
  LONG_BREAK_SECONDS,
  ZONES,
  type BuildingType,
  type Command,
  type ZoneKind,
} from "@/sim";
import type { PlayerRecord } from "./repo";
import { ConflictError } from "./repo";
import { focusMs, getPlayerId, UnauthorizedError } from "./session";

export function snapshot(rec: PlayerRecord, extra: Record<string, unknown> = {}) {
  return NextResponse.json({
    state: rec.state,
    activeCycle: rec.activeCycle,
    presence: rec.presence?.status ?? "exited",
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
  const num = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v);
  for (const c of raw) {
    if (!c || typeof c !== "object") return null;
    const r = c as Record<string, unknown>;
    if (r.type === "zone") {
      const zone = r.zone;
      if (![r.x0, r.y0, r.x1, r.y1].every(num)) return null;
      if (zone !== "none" && !(typeof zone === "string" && Object.hasOwn(ZONES, zone))) return null;
      out.push({
        type: "zone",
        zone: zone as ZoneKind | "none",
        dense: r.dense === true,
        x0: r.x0 as number,
        y0: r.y0 as number,
        x1: r.x1 as number,
        y1: r.y1 as number,
      });
      continue;
    }
    if (!num(r.x) || !num(r.y)) return null;
    if (r.type === "demolish" || r.type === "wire") out.push({ type: r.type, x: r.x, y: r.y });
    else if (r.type === "build" && typeof r.building === "string" && Object.hasOwn(BUILDINGS, r.building)) {
      out.push({ type: "build", building: r.building as BuildingType, x: r.x, y: r.y });
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
