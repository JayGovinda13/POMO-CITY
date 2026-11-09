import "server-only";
import { cookies } from "next/headers";
import { randomUUID } from "node:crypto";
import { DEFAULT_FOCUS_SECONDS } from "@/sim";

const COOKIE = "pomo_player";

/** Identidade anônima por cookie httpOnly (UUID v4 aleatório, impossível de adivinhar). */
export async function getPlayerId(): Promise<string> {
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
