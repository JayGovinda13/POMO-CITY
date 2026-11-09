import { resolveCycle } from "@/sim";
import { fail, snapshot } from "@/server/api";
import { repo, withPlayer } from "@/server/repo";
import { CLOCK_TOLERANCE_MS, getPlayerId } from "@/server/session";

/** Conclusão do ciclo: só é aceita se o tempo medido PELO SERVIDOR realmente passou. */
export async function POST() {
  const id = await getPlayerId();
  return withPlayer(id, async (rec) => {
    if (!rec.activeCycle) return fail(400, "Nenhum ciclo em andamento");
    const now = Date.now();
    if (now < rec.activeCycle.endsAt - CLOCK_TOLERANCE_MS) {
      return fail(425, "O ciclo ainda não terminou", { remainingMs: rec.activeCycle.endsAt - now });
    }
    const { state, report } = resolveCycle(rec.state, now);
    rec.state = state;
    rec.activeCycle = null;
    await repo.save(id, rec);
    return snapshot(rec, { report });
  });
}
