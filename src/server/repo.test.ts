import { describe, expect, it } from "vitest";
import { resolveCycle } from "@/sim";
import { ConflictError, withPlayer, type PlayerRecord, type PlayerRepo } from "./repo";

const ID = "11111111-1111-4111-8111-111111111111";

/** Repo em memória com a mesma semântica de revisão do Postgres. */
class MemoryRepo implements PlayerRepo {
  row: { record: PlayerRecord; revision: number } | null = null;
  saves = 0;
  logs: unknown[] = [];
  /** Simula outra instância gravando entre o load e o save. */
  interfere = 0;
  async load() {
    return this.row ? structuredClone(this.row) : null;
  }
  async save(_id: string, record: PlayerRecord, revision: number) {
    if (this.interfere > 0 && this.row) {
      this.interfere--;
      this.row.revision++;
    }
    if ((this.row?.revision ?? 0) !== revision) return false;
    this.row = { record: structuredClone(record), revision: revision + 1 };
    this.saves++;
    return true;
  }
  async logCycle(_id: string, e: unknown) {
    this.logs.push(e);
  }
  async publishScore() {}
  async leaderboard() {
    return { top: [], myRank: null, total: 0 };
  }
}

describe("withPlayer", () => {
  it("cria a cidade na primeira leitura e não grava quando nada muda", async () => {
    const r = new MemoryRepo();
    await withPlayer(ID, () => null, r);
    expect(r.saves).toBe(1);
    await withPlayer(ID, () => null, r);
    expect(r.saves).toBe(1);
  });

  it("refaz a operação em caso de conflito e só roda afterCommit uma vez", async () => {
    const r = new MemoryRepo();
    await withPlayer(ID, () => null, r);
    r.interfere = 2;
    let runs = 0;
    await withPlayer(
      ID,
      (rec, tx) => {
        runs++;
        rec.state.money += 10;
        tx.afterCommit(async () => void r.logs.push("ok"));
      },
      r,
    );
    expect(runs).toBe(3);
    expect(r.logs).toEqual(["ok"]);
    expect(r.row!.record.state.money).toBe(1010);
  });

  it("desiste após conflitos demais", async () => {
    const r = new MemoryRepo();
    await withPlayer(ID, () => null, r);
    r.interfere = 99;
    await expect(withPlayer(ID, (rec) => void (rec.state.money += 1), r)).rejects.toBeInstanceOf(ConflictError);
  });

  it("dois /complete simultâneos resolvem o ciclo uma única vez", async () => {
    const r = new MemoryRepo();
    await withPlayer(ID, (rec) => void (rec.activeCycle = { startedAt: 0, endsAt: 1 }), r);
    const complete = () =>
      withPlayer(
        ID,
        (rec) => {
          if (!rec.activeCycle) return "rejeitado";
          rec.state = resolveCycle(rec.state, Date.now()).state;
          rec.activeCycle = null;
          return "ok";
        },
        r,
      );
    const results = await Promise.all([complete(), complete()]);
    expect(results.sort()).toEqual(["ok", "rejeitado"]);
    expect(r.row!.record.state.cyclesCompleted).toBe(1);
  });
});
