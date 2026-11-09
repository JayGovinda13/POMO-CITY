import { abandonCycle } from "@/sim";
import { fail, snapshot } from "@/server/api";
import { repo, withPlayer } from "@/server/repo";
import { getPlayerId } from "@/server/session";

export async function POST() {
  const id = await getPlayerId();
  return withPlayer(id, async (rec) => {
    if (!rec.activeCycle) return fail(400, "Nenhum ciclo em andamento");
    rec.state = abandonCycle(rec.state);
    rec.activeCycle = null;
    await repo.save(id, rec);
    return snapshot(rec);
  });
}
