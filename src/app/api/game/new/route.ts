import { randomInt } from "node:crypto";
import { newGame } from "@/sim";
import { fail, route, snapshot } from "@/server/api";
import { repo, withPlayer } from "@/server/repo";
import { settlePresence } from "@/server/presence";

/** Novo jogo: cidade nova (região a escolher), começando do primeiro ciclo. A antiga sai do ranking. */
export const POST = route((id) =>
  withPlayer(id, (rec, tx) => {
    settlePresence(id, rec, Date.now(), tx);
    if (rec.activeCycle) return fail(409, "Só é possível começar outro jogo com o foco encerrado");
    rec.state = newGame(rec.state, randomInt(1, 2 ** 31 - 1), Date.now());
    rec.presence = { status: "playing", leftAt: null, cyclesThisSession: 0 };
    tx.afterCommit(() => repo().removeScore(id).catch((e) => console.error("leaderboard", e)));
    return snapshot(rec);
  }),
);
