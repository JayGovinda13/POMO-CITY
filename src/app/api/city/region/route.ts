import { foundCity } from "@/sim";
import { fail, route, snapshot } from "@/server/api";
import { withPlayer } from "@/server/repo";

/** Escolha da região climática (uma vez). Só o id da região é recebido — nunca coordenadas. */
export const POST = route(async (id, req) => {
  const body = await req.json().catch(() => ({}));
  const regionId = typeof body?.regionId === "string" ? body.regionId : "";
  const difficulty = typeof body?.difficulty === "string" ? body.difficulty : "medio";
  const name = typeof body?.name === "string" ? body.name.slice(0, 200) : undefined;
  return withPlayer(id, (rec) => {
    // A escolha é permitida mesmo durante o foco: cidades antigas recebem o seletor ao abrir,
    // e o clima só passa a valer a partir do tempo calculado no fim do ciclo.
    const r = foundCity(rec.state, regionId, Date.now(), difficulty, name, body?.map);
    if (!r.ok) return fail(400, r.error);
    rec.state = r.state;
    return snapshot(rec);
  });
});
