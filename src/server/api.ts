import "server-only";
import { NextResponse } from "next/server";
import {
  BREAK_SECONDS,
  BUILDINGS,
  LONG_BREAK_EVERY,
  LONG_BREAK_SECONDS,
  ZONES,
  RESOURCE_IDS,
  ORDINANCES,
  TECHS,
  type OrdinanceId,
  type PolicyMode,
  type ResourceId,
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
    if (r.type === "budget") {
      const t = r.taxes as Record<string, unknown> | undefined;
      const f = r.funding as Record<string, unknown> | undefined;
      const taxes = t && [t.R, t.C, t.I].every(num) ? { R: t.R as number, C: t.C as number, I: t.I as number } : undefined;
      const depts = ["transport", "energy", "police", "fire", "health", "education"] as const;
      const funding: Partial<Record<(typeof depts)[number], number>> | undefined =
        f && Object.keys(f).length > 0 && Object.keys(f).every((k) => (depts as readonly string[]).includes(k) && num(f[k]))
          ? Object.fromEntries(Object.entries(f)) as Partial<Record<(typeof depts)[number], number>>
          : undefined;
      if ((t && !taxes) || (f && !funding) || (!taxes && !funding)) return null;
      out.push({ type: "budget", taxes, funding });
      continue;
    }
    if (r.type === "research") {
      if (r.tech !== null && (typeof r.tech !== "string" || !Object.hasOwn(TECHS, r.tech))) return null;
      out.push({ type: "research", tech: r.tech as string | null });
      continue;
    }
    if (r.type === "terraform") {
      if (!num(r.x) || !num(r.y)) return null;
      if (r.action !== "raise" && r.action !== "lower" && r.action !== "water" && r.action !== "land" && r.action !== "tree") return null;
      out.push({ type: "terraform", action: r.action, x: r.x, y: r.y });
      continue;
    }
    if (r.type === "rename") {
      if (typeof r.name !== "string" || r.name.length > 200) return null;
      out.push({ type: "rename", name: r.name });
      continue;
    }
    if (r.type === "ordinance") {
      if (typeof r.id !== "string" || !Object.hasOwn(ORDINANCES, r.id) || typeof r.active !== "boolean") return null;
      out.push({ type: "ordinance", id: r.id as OrdinanceId, active: r.active });
      continue;
    }
    if (r.type === "insurance") {
      if (r.plan !== "none" && r.plan !== "basico" && r.plan !== "completo") return null;
      out.push({ type: "insurance", plan: r.plan });
      continue;
    }
    if (r.type === "repair") {
      if (!num(r.x) || !num(r.y)) return null;
      out.push({ type: "repair", x: r.x, y: r.y });
      continue;
    }
    if (r.type === "bond") {
      if (r.action !== "issue" && r.action !== "repay") return null;
      out.push({ type: "bond", action: r.action });
      continue;
    }
    if (r.type === "policy") {
      if (typeof r.resource !== "string" || !RESOURCE_IDS.includes(r.resource as ResourceId)) return null;
      if (typeof r.mode !== "string" || typeof r.value !== "number" || !Number.isFinite(r.value)) return null;
      out.push({ type: "policy", resource: r.resource as ResourceId, mode: r.mode as PolicyMode, value: r.value });
      continue;
    }
    if (!num(r.x) || !num(r.y)) return null;
    if (r.type === "demolish") out.push({ type: "demolish", x: r.x, y: r.y, ...(r.underground === true ? { underground: true } : {}) });
    else if (r.type === "wire" || r.type === "pipe") out.push({ type: r.type, x: r.x, y: r.y });
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
      // O motivo vai junto (sem pilha): sem ele não dá para diagnosticar pelo celular.
      const detail = (e instanceof Error ? `${e.name}: ${e.message}` : String(e)).replace(/\s+/g, " ").slice(0, 240);
      return fail(500, `Erro interno — ${detail}`);
    }
  };
}
