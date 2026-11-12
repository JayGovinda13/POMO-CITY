import { abandonCycle, applyDisaster } from "@/sim";
import { fail, route, snapshot } from "@/server/api";
import { repo, withPlayer } from "@/server/repo";
import { publishScore } from "@/server/leaderboard";

export const POST = route((id) =>
  withPlayer(id, (rec, tx) => {
    const cycle = rec.activeCycle;
    if (!cycle) return fail(400, "Nenhum ciclo em andamento");
    // Ciclo quebrado: a sequência cai e a cidade sofre um desastre.
    // O desastre vê a sequência que foi quebrada; depois a sequência cai.
    const broken = applyDisaster(rec.state, "normal", "abandoned");
    rec.state = abandonCycle(broken.state);
    rec.activeCycle = null;
    const now = Date.now();
    tx.afterCommit(() => publishScore(id, rec.state));
    tx.afterCommit(() =>
      repo().logCycle(id, { startedAt: cycle.startedAt, endedAt: now, outcome: "abandoned", streak: rec.state.streak }),
    );
    return snapshot(rec, { disaster: broken.report });
  }),
);
