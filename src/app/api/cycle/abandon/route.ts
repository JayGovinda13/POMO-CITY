import { abandonCycle } from "@/sim";
import { fail, route, snapshot } from "@/server/api";
import { repo, withPlayer } from "@/server/repo";

export const POST = route((id) =>
  withPlayer(id, (rec, tx) => {
    const cycle = rec.activeCycle;
    if (!cycle) return fail(400, "Nenhum ciclo em andamento");
    rec.state = abandonCycle(rec.state);
    rec.activeCycle = null;
    const now = Date.now();
    tx.afterCommit(() =>
      repo().logCycle(id, { startedAt: cycle.startedAt, endedAt: now, outcome: "abandoned", streak: rec.state.streak }),
    );
    return snapshot(rec);
  }),
);
