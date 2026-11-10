import "server-only";
import { abandonCycle, applyDisaster, type DisasterReport } from "@/sim";
import { DEFAULT_PRESENCE, repo, type PlayerRecord, type TxContext } from "./repo";

/**
 * Tolerância para recarregar a página ou perder a conexão: se o jogador volta em até
 * 2 minutos depois do aviso de fechamento, nada acontece.
 */
export const LEAVE_GRACE_MS = (() => {
  const v = Number(process.env.LEAVE_GRACE_SECONDS);
  return (Number.isFinite(v) && v >= 0 ? v : 120) * 1000;
})();

/**
 * Resolve uma saída sem o menu, se houver (muta `rec`):
 * - fechou durante o foco → o ciclo é quebrado (sequência cai) e acontece um desastre;
 * - fechou depois de concluir algum foco na sessão → desastre leve;
 * - só abriu e fechou, sem concluir foco → nada.
 * Ficar dias sem jogar nunca causa nada: o que conta é como a sessão terminou.
 */
export function settlePresence(playerId: string, rec: PlayerRecord, now: number, tx: TxContext): DisasterReport | null {
  rec.presence ??= { ...DEFAULT_PRESENCE };
  const p = rec.presence;
  if (p.status !== "playing" || p.leftAt === null) return null;
  if (now - p.leftAt <= LEAVE_GRACE_MS) {
    p.leftAt = null; // recarregou a página: segue o jogo
    return null;
  }

  let disaster: DisasterReport | null = null;
  const cycle = rec.activeCycle;
  if (cycle) {
    const broken = applyDisaster(abandonCycle(rec.state), "normal", "closed_during_focus");
    rec.state = broken.state;
    rec.activeCycle = null;
    disaster = broken.report;
    const leftAt = p.leftAt;
    tx.afterCommit(() =>
      repo().logCycle(playerId, { startedAt: cycle.startedAt, endedAt: leftAt, outcome: "abandoned", streak: rec.state.streak }),
    );
  } else if (p.cyclesThisSession > 0) {
    const light = applyDisaster(rec.state, "light", "closed_without_exit");
    rec.state = light.state;
    disaster = light.report;
  }
  rec.presence = { ...DEFAULT_PRESENCE };
  return disaster;
}
