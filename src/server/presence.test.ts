import { describe, expect, it } from "vitest";
import { createCity } from "@/sim";
import { LEAVE_GRACE_MS, RETURN_AFTER_FOCUS_MS, settlePresence } from "./presence";
import type { PlayerRecord, TxContext } from "./repo";

const T0 = Date.UTC(2026, 10, 11, 10);
const FOCUS = 25 * 60 * 1000;
const tx: TxContext = { afterCommit: () => {} };

/** Jogador em foco que "fechou a página" (ou bloqueou o celular) no meio do ciclo. */
function leftDuringFocus(): PlayerRecord {
  const state = createCity(1, T0);
  state.streak = 4;
  return {
    state,
    activeCycle: { startedAt: T0, endsAt: T0 + FOCUS },
    presence: { status: "playing", leftAt: T0 + 60_000, cyclesThisSession: 1 },
  };
}

describe("presença: sair e voltar", () => {
  it("voltou antes do fim do foco: o foco continua", () => {
    const rec = leftDuringFocus();
    const r = settlePresence("p", rec, T0 + 10 * 60_000, tx);
    expect(r).toEqual({ disaster: null, report: null });
    expect(rec.activeCycle).not.toBeNull();
    expect(rec.presence.leftAt).toBeNull();
  });

  it("celular bloqueado até depois do fim: o ciclo conta (sem desastre, sem travar)", () => {
    const rec = leftDuringFocus();
    const r = settlePresence("p", rec, T0 + FOCUS + 5 * 60_000, tx);
    expect(r.disaster).toBeNull();
    expect(r.report?.streak).toBe(5);
    expect(rec.activeCycle).toBeNull();
    expect(rec.state.cyclesCompleted).toBe(1);
    expect(rec.presence.status).toBe("playing");
  });

  it("fechou no meio do foco e só voltou bem depois: desastre e a sequência cai", () => {
    const rec = leftDuringFocus();
    const r = settlePresence("p", rec, T0 + FOCUS + RETURN_AFTER_FOCUS_MS + 60_000, tx);
    expect(r.disaster).not.toBeNull();
    expect(rec.activeCycle).toBeNull();
    expect(rec.state.streak).toBeLessThan(4);
  });

  it("saiu na pausa: nunca prejudica a cidade", () => {
    const rec = leftDuringFocus();
    rec.activeCycle = null;
    const before = structuredClone(rec.state);
    const r = settlePresence("p", rec, T0 + 3 * 3_600_000, tx);
    expect(r).toEqual({ disaster: null, report: null });
    expect(rec.state).toEqual(before);
    expect(rec.presence.status).toBe("exited");
  });

  it("recarregar a página (volta dentro da tolerância) não muda nada", () => {
    const rec = leftDuringFocus();
    const r = settlePresence("p", rec, (rec.presence.leftAt ?? 0) + LEAVE_GRACE_MS - 1, tx);
    expect(r).toEqual({ disaster: null, report: null });
    expect(rec.activeCycle).not.toBeNull();
  });
});
