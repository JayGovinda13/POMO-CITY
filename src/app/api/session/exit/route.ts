import { applyCommands } from "@/sim";
import { fail, parseCommands, route, snapshot } from "@/server/api";
import { DEFAULT_PRESENCE, withPlayer } from "@/server/repo";
import { settlePresence } from "@/server/presence";

/**
 * "Sair" pelo menu: só com o foco encerrado (na pausa). As obras da pausa são sincronizadas.
 * Ao voltar (Continuar), a sequência recomeça do primeiro ciclo.
 */
export const POST = route(async (id, req) => {
  const body = await req.json().catch(() => ({}));
  const commands = parseCommands(body?.commands);
  if (!commands) return fail(400, "Fila de comandos inválida");
  return withPlayer(id, (rec, tx) => {
    settlePresence(id, rec, Date.now(), tx);
    if (rec.activeCycle) return fail(409, "Só é possível sair com o foco encerrado");
    const { state, rejected } = applyCommands(rec.state, commands);
    rec.state = { ...state, version: state.version + 1 };
    rec.presence = { ...DEFAULT_PRESENCE };
    return snapshot(rec, { rejected });
  });
});
