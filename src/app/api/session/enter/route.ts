import { route, snapshot } from "@/server/api";
import { withPlayer } from "@/server/repo";
import { settlePresence } from "@/server/presence";

/**
 * "Continuar": entra no jogo salvo (aplicando antes o que ficou pendente de uma saída sem menu).
 * Voltar a um jogo salvo recomeça a sequência: o primeiro ciclo da sessão sai com Rank D.
 */
export const POST = route((id) =>
  withPlayer(id, (rec, tx) => {
    const { disaster, report } = settlePresence(id, rec, Date.now(), tx);
    if (rec.presence.status !== "playing") {
      rec.presence = { status: "playing", leftAt: null, cyclesThisSession: 0 };
      // Sessão nova (não é recarregar a página): a sequência recomeça do primeiro ciclo.
      if (!rec.activeCycle) rec.state = { ...rec.state, streak: 0, streakFrozen: false, version: rec.state.version + 1 };
    }
    rec.presence.leftAt = null;
    return snapshot(rec, { disaster, report });
  }),
);
