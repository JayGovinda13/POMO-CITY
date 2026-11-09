import { resolveCycle } from "@/sim";
import { fail, route, snapshot } from "@/server/api";
import { repo, withPlayer } from "@/server/repo";
import { CLOCK_TOLERANCE_MS } from "@/server/session";

/** Conclusão do ciclo: só é aceita se o tempo medido PELO SERVIDOR realmente passou. */
export const POST = route((id) =>
  withPlayer(id, (rec, tx) => {
    const cycle = rec.activeCycle;
    if (!cycle) return fail(400, "Nenhum ciclo em andamento");
    const now = Date.now();
    if (now < cycle.endsAt - CLOCK_TOLERANCE_MS) {
      return fail(425, "O ciclo ainda não terminou", { remainingMs: cycle.endsAt - now });
    }
    const { state, report } = resolveCycle(rec.state, now);
    rec.state = state;
    rec.activeCycle = null;
    tx.afterCommit(() =>
      repo().logCycle(id, {
        startedAt: cycle.startedAt,
        endedAt: now,
        outcome: "completed",
        rank: report.rank,
        streak: report.streak,
        rewarded: report.rewarded,
      }),
    );
    return snapshot(rec, { report });
  }),
);
