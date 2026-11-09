import { applyCommands } from "@/sim";
import { fail, parseCommands, snapshot } from "@/server/api";
import { repo, withPlayer } from "@/server/repo";
import { focusMs, getPlayerId } from "@/server/session";

/**
 * Início do ciclo de foco. Recebe a fila de comandos feita na pausa (offline-first),
 * revalida cada um contra o estado autoritativo e registra o horário de início no servidor.
 */
export async function POST(req: Request) {
  const id = await getPlayerId();
  const body = await req.json().catch(() => ({}));
  const commands = parseCommands(body?.commands);
  if (!commands) return fail(400, "Fila de comandos inválida");

  return withPlayer(id, async (rec) => {
    if (rec.activeCycle) return fail(409, "Já existe um ciclo em andamento", { activeCycle: rec.activeCycle });
    const { state, rejected } = applyCommands(rec.state, commands);
    const now = Date.now();
    rec.state = state;
    rec.activeCycle = { startedAt: now, endsAt: now + focusMs() };
    await repo.save(id, rec);
    return snapshot(rec, { rejected });
  });
}
