import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
import { createCity, type CityState } from "@/sim";

export interface ActiveCycle {
  startedAt: number;
  endsAt: number;
}

export interface PlayerRecord {
  state: CityState;
  activeCycle: ActiveCycle | null;
}

/**
 * Persistência atrás de uma interface: o MVP usa arquivos JSON em `.data/`
 * (bom para desenvolvimento local). A próxima etapa troca por Supabase/Postgres
 * sem mexer nas rotas.
 */
export interface PlayerRepo {
  get(playerId: string): Promise<PlayerRecord | null>;
  save(playerId: string, record: PlayerRecord): Promise<void>;
}

const DATA_DIR = path.join(process.cwd(), ".data", "players");
const SAFE_ID = /^[a-f0-9-]{36}$/;

class FileRepo implements PlayerRepo {
  private file(id: string) {
    if (!SAFE_ID.test(id)) throw new Error("invalid player id");
    return path.join(DATA_DIR, `${id}.json`);
  }
  async get(id: string) {
    try {
      return JSON.parse(await fs.readFile(this.file(id), "utf8")) as PlayerRecord;
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw e;
    }
  }
  async save(id: string, record: PlayerRecord) {
    await fs.mkdir(DATA_DIR, { recursive: true });
    const tmp = `${this.file(id)}.${process.pid}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(record));
    await fs.rename(tmp, this.file(id));
  }
}

export const repo: PlayerRepo = new FileRepo();

/** Serializa operações por jogador para evitar condições de corrida (duplo /complete etc.). */
const locks = new Map<string, Promise<unknown>>();
export async function withPlayer<T>(playerId: string, fn: (rec: PlayerRecord) => Promise<T> | T): Promise<T> {
  const prev = locks.get(playerId) ?? Promise.resolve();
  const run = prev.then(async () => {
    let rec = await repo.get(playerId);
    if (!rec) {
      const seed = parseInt(playerId.replace(/-/g, "").slice(0, 8), 16);
      rec = { state: createCity(seed, Date.now()), activeCycle: null };
      await repo.save(playerId, rec);
    }
    return fn(rec);
  });
  locks.set(
    playerId,
    run.catch(() => undefined),
  );
  return run;
}
