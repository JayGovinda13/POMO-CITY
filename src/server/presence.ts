import "server-only";
import { abandonCycle, applyDisaster, resolveCycle, type CycleReport, type DisasterReport } from "@/sim";
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
 * Celular bloqueado durante o foco: no telefone, bloquear a tela ou trocar de app dispara o mesmo
 * aviso de "página fechada". Quem volta até 15 minutos depois do fim do foco estava focando (é o
 * Pomodoro!): o ciclo conta normalmente. Quem demora mais que isso fechou o jogo no meio do foco.
 */
export const RETURN_AFTER_FOCUS_MS = 15 * 60 * 1000;

export interface PresenceOutcome {
  /** Desastre por ter fechado o jogo durante o foco. */
  disaster: DisasterReport | null;
  /** Ciclo concluído pelo servidor (o jogador voltou depois do fim do foco). */
  report: CycleReport | null;
}

/**
 * Resolve a volta de quem saiu sem o menu (muta `rec`). Regras:
 * - saiu durante a PAUSA → nada acontece (na pausa pode sair à vontade);
 * - saiu durante o FOCO e voltou antes do fim → segue o foco;
 * - saiu durante o foco e voltou até 15 min depois do fim → o ciclo é concluído normalmente;
 * - saiu durante o foco e só voltou depois disso → ciclo quebrado: a sequência cai e vem um desastre.
 */
export function settlePresence(playerId: string, rec: PlayerRecord, now: number, tx: TxContext): PresenceOutcome {
  rec.presence ??= { ...DEFAULT_PRESENCE };
  const p = rec.presence;
  const none: PresenceOutcome = { disaster: null, report: null };
  if (p.status !== "playing" || p.leftAt === null) return none;
  if (now - p.leftAt <= LEAVE_GRACE_MS) {
    p.leftAt = null; // recarregou a página: segue o jogo
    return none;
  }

  const cycle = rec.activeCycle;
  if (!cycle) {
    // Saiu na pausa: sem prejuízo. A sessão termina como se tivesse usado o menu.
    rec.presence = { ...DEFAULT_PRESENCE };
    return none;
  }

  if (now < cycle.endsAt) {
    // Voltou antes do fim do foco (desbloqueou o celular): o foco continua.
    p.leftAt = null;
    return none;
  }

  if (now <= cycle.endsAt + RETURN_AFTER_FOCUS_MS) {
    // O tempo de foco passou com o jogador longe da tela: o ciclo conta.
    const { state, report } = resolveCycle(rec.state, cycle.endsAt);
    rec.state = state;
    rec.activeCycle = null;
    p.leftAt = null;
    p.cyclesThisSession++;
    tx.afterCommit(() =>
      repo().logCycle(playerId, {
        startedAt: cycle.startedAt,
        endedAt: cycle.endsAt,
        outcome: "completed",
        rank: report.rank,
        streak: report.streak,
        rewarded: report.rewarded,
      }),
    );
    return { disaster: null, report };
  }

  // Fechou o jogo no meio do foco: o desastre vê a sequência que foi quebrada; depois ela cai.
  const broken = applyDisaster(rec.state, "normal", "closed_during_focus");
  rec.state = abandonCycle(broken.state);
  rec.activeCycle = null;
  const leftAt = p.leftAt;
  tx.afterCommit(() =>
    repo().logCycle(playerId, { startedAt: cycle.startedAt, endedAt: leftAt, outcome: "abandoned", streak: rec.state.streak }),
  );
  rec.presence = { ...DEFAULT_PRESENCE };
  return { disaster: broken.report, report: null };
}
