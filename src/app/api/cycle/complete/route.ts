import { resolveCycle } from "@/sim";
import { fail, route, snapshot } from "@/server/api";
import { repo, withPlayer } from "@/server/repo";
import { settlePresence } from "@/server/presence";
import { CLOCK_TOLERANCE_MS } from "@/server/session";
import { publishScore } from "@/server/leaderboard";

/** Conclusão do ciclo: só é aceita se o tempo medido PELO SERVIDOR realmente passou. */
export const POST = route((id) =>
  withPlayer(id, (rec, tx) => {
    const settled = settlePresence(id, rec, Date.now(), tx);
    if (settled.disaster) return snapshot(rec, { disaster: settled.disaster });
    // O servidor já concluiu o ciclo (o jogador voltou depois do fim do foco): devolve o relatório.
    if (settled.report) return snapshot(rec, { report: settled.report });
    const cycle = rec.activeCycle;
    if (!cycle) return fail(400, "Nenhum ciclo em andamento");
    const now = Date.now();
    if (now < cycle.endsAt - CLOCK_TOLERANCE_MS) {
      return fail(425, "O ciclo ainda não terminou", { remainingMs: cycle.endsAt - now });
    }
    const { state, report } = resolveCycle(rec.state, now);
    rec.state = state;
    rec.activeCycle = null;
    if (rec.presence.status === "playing") rec.presence.cyclesThisSession++;
    tx.afterCommit(() => publishScore(id, rec.state));
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
