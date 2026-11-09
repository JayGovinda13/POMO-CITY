import "server-only";
import { cookies } from "next/headers";
import { randomUUID } from "node:crypto";
import { DEFAULT_FOCUS_SECONDS } from "@/sim";
import { supabaseEnabled } from "@/lib/supabase/env";
import { sessionClient } from "@/lib/supabase/server";

const COOKIE = "pomo_player";

export class UnauthorizedError extends Error {}

/**
 * Com Supabase: o id do jogador é o id do usuário autenticado (anônimo ou com e-mail),
 * validado pelo servidor de Auth. Sem Supabase: cookie httpOnly com UUID aleatório.
 */
export async function getPlayerId(): Promise<string> {
  if (supabaseEnabled) {
    const sb = await sessionClient();
    const { data, error } = await sb.auth.getUser();
    if (error || !data.user) throw new UnauthorizedError("Sessão inválida");
    return data.user.id;
  }
  const jar = await cookies();
  const existing = jar.get(COOKIE)?.value;
  if (existing && /^[a-f0-9-]{36}$/.test(existing)) return existing;
  const id = randomUUID();
  jar.set(COOKIE, id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  return id;
}

export function focusMs(): number {
  const s = Number(process.env.FOCUS_SECONDS);
  return (Number.isFinite(s) && s > 0 ? s : DEFAULT_FOCUS_SECONDS) * 1000;
}

/** Folga de rede: aceita conclusão até 2 s antes do fim calculado no servidor. */
export const CLOCK_TOLERANCE_MS = 2000;
