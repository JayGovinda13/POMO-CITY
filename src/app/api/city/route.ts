import { route, snapshot } from "@/server/api";
import { withPlayer } from "@/server/repo";
import { settlePresence } from "@/server/presence";

/** Estado da cidade. Se a última sessão terminou sem o menu, o desastre é aplicado aqui. */
export const GET = route((id) =>
  withPlayer(id, (rec, tx) => {
    const { disaster, report } = settlePresence(id, rec, Date.now(), tx);
    return snapshot(rec, { disaster, report });
  }),
);
