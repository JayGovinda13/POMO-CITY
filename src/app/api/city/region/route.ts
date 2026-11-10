import { foundCity } from "@/sim";
import { fail, route, snapshot } from "@/server/api";
import { withPlayer } from "@/server/repo";

/** Escolha da região climática (uma vez). Só o id da região é recebido — nunca coordenadas. */
export const POST = route(async (id, req) => {
  const body = await req.json().catch(() => ({}));
  const regionId = typeof body?.regionId === "string" ? body.regionId : "";
  return withPlayer(id, (rec) => {
    if (rec.activeCycle) return fail(409, "Encerre o foco antes");
    const r = foundCity(rec.state, regionId, Date.now());
    if (!r.ok) return fail(400, r.error);
    rec.state = r.state;
    return snapshot(rec);
  });
});
