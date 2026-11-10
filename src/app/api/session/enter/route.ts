import { route, snapshot } from "@/server/api";
import { withPlayer } from "@/server/repo";
import { settlePresence } from "@/server/presence";

/** "Continuar": entra no jogo (aplicando antes o desastre de uma saída sem menu, se houver). */
export const POST = route((id) =>
  withPlayer(id, (rec, tx) => {
    const disaster = settlePresence(id, rec, Date.now(), tx);
    if (rec.presence.status !== "playing") rec.presence = { status: "playing", leftAt: null, cyclesThisSession: 0 };
    rec.presence.leftAt = null;
    return snapshot(rec, { disaster });
  }),
);
