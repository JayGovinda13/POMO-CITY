import { route } from "@/server/api";
import { withPlayer } from "@/server/repo";

/**
 * Aviso enviado pelo navegador (sendBeacon) quando a página é fechada.
 * Só marca o horário; a consequência é decidida na volta (ver settlePresence),
 * com tolerância para recarregamentos.
 */
export const POST = route((id) =>
  withPlayer(id, (rec) => {
    if (rec.presence?.status === "playing") rec.presence.leftAt = Date.now();
    return new Response(null, { status: 204 });
  }),
);
