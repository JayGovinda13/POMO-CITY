import { applyCommands } from "@/sim";
import { fail, parseCommands, route, snapshot } from "@/server/api";
import { withPlayer } from "@/server/repo";
import { settlePresence } from "@/server/presence";
import { focusMs } from "@/server/session";

/**
 * Início do ciclo de foco. Recebe a fila de comandos feita na pausa (offline-first),
 * revalida cada um contra o estado autoritativo e registra o horário de início no servidor.
 */
export const POST = route(async (id, req) => {
  const body = await req.json().catch(() => ({}));
  const commands = parseCommands(body?.commands);
  if (!commands) return fail(400, "Fila de comandos inválida");

  return withPlayer(id, (rec, tx) => {
    const { disaster, report } = settlePresence(id, rec, Date.now(), tx);
    if (disaster || report) return snapshot(rec, { disaster, report });
    if (rec.presence.status !== "playing") rec.presence = { status: "playing", leftAt: null, cyclesThisSession: 0 };
    if (rec.activeCycle) return fail(409, "Já existe um ciclo em andamento", { activeCycle: rec.activeCycle });
    const { state, rejected } = applyCommands(rec.state, commands);
    const now = Date.now();
    rec.state = state;
    rec.activeCycle = { startedAt: now, endsAt: now + focusMs() };
    return snapshot(rec, { rejected });
  });
});
