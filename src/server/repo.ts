import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
import { createCity, migrateState, type CityState, type Rank } from "@/sim";
import { supabaseEnabled } from "@/lib/supabase/env";
import { adminClient } from "@/lib/supabase/server";

export interface ActiveCycle {
  startedAt: number;
  endsAt: number;
}

/**
 * Presença do jogador. "exited" = saiu pelo menu (ou nunca entrou); "playing" = em jogo.
 * `leftAt` é marcado quando o navegador avisa que a página foi fechada sem sair pelo menu.
 */
export interface Presence {
  status: "playing" | "exited";
  leftAt: number | null;
  /** Ciclos concluídos desde que o jogador entrou (define o desastre leve ao fechar). */
  cyclesThisSession: number;
}

export const DEFAULT_PRESENCE: Presence = { status: "exited", leftAt: null, cyclesThisSession: 0 };

export interface PlayerRecord {
  state: CityState;
  activeCycle: ActiveCycle | null;
  presence: Presence;
}

export interface CycleLogEntry {
  startedAt: number;
  endedAt: number;
  outcome: "completed" | "abandoned";
  rank?: Rank;
  streak?: number;
  rewarded?: boolean;
}

/** Linha do ranking online (só dados do jogo, nada pessoal). */
export interface LeaderboardEntry {
  cityName: string;
  region: string | null;
  score: number;
  techs: number;
  population: number;
  year: number;
  era: string;
}

interface Loaded {
  record: PlayerRecord;
  revision: number;
}

/**
 * Persistência com concorrência otimista: `save` só grava se a revisão no banco
 * ainda for a que foi lida. Assim, duas instâncias serverless processando o mesmo
 * jogador (ex.: /complete enviado duas vezes) nunca aplicam o ciclo em dobro.
 */
export interface PlayerRepo {
  load(playerId: string): Promise<Loaded | null>;
  /** revision 0 = registro novo. Retorna false em caso de conflito. */
  save(playerId: string, record: PlayerRecord, revision: number): Promise<boolean>;
  logCycle(playerId: string, entry: CycleLogEntry): Promise<void>;
  /** Atualiza a linha da cidade no ranking. */
  publishScore(playerId: string, entry: LeaderboardEntry): Promise<void>;
  /** Tira a cidade do ranking (teve catástrofe). */
  removeScore(playerId: string): Promise<void>;
  /** As melhores cidades e a posição de um jogador (1 = primeiro; null = fora do ranking). */
  leaderboard(limit: number, playerId?: string): Promise<{ top: (LeaderboardEntry & { mine: boolean })[]; myRank: number | null; total: number }>;
}

// ───────────────────────── Supabase / Postgres ─────────────────────────

class SupabaseRepo implements PlayerRepo {
  async load(id: string): Promise<Loaded | null> {
    const { data, error } = await adminClient()
      .from("cities")
      .select("state, active_cycle, presence, revision")
      .eq("player_id", id)
      .maybeSingle();
    if (error) throw new Error(`cities.load: ${error.message}`);
    if (!data) return null;
    return {
      record: { state: data.state, activeCycle: data.active_cycle, presence: data.presence ?? { ...DEFAULT_PRESENCE } },
      revision: Number(data.revision),
    };
  }

  async save(id: string, record: PlayerRecord, revision: number): Promise<boolean> {
    const db = adminClient().from("cities");
    const row = {
      state: record.state,
      active_cycle: record.activeCycle,
      presence: record.presence,
      revision: revision + 1,
    };
    if (revision === 0) {
      const { error } = await db.insert({ player_id: id, ...row });
      if (error?.code === "23505") return false; // outra requisição criou a cidade antes
      if (error) throw new Error(`cities.insert: ${error.message}`);
      return true;
    }
    const { data, error } = await db
      .update({ ...row, updated_at: new Date().toISOString() })
      .eq("player_id", id)
      .eq("revision", revision)
      .select("player_id");
    if (error) throw new Error(`cities.update: ${error.message}`);
    return (data?.length ?? 0) > 0;
  }

  async logCycle(id: string, e: CycleLogEntry): Promise<void> {
    const { error } = await adminClient()
      .from("cycle_log")
      .insert({
        player_id: id,
        started_at: new Date(e.startedAt).toISOString(),
        ended_at: new Date(e.endedAt).toISOString(),
        outcome: e.outcome,
        rank: e.rank ?? null,
        streak: e.streak ?? null,
        rewarded: e.rewarded ?? null,
      });
    // O log é auditoria: uma falha aqui não deve desfazer um ciclo já gravado.
    if (error) console.error("cycle_log.insert", error.message);
  }

  async publishScore(id: string, e: LeaderboardEntry): Promise<void> {
    const { error } = await adminClient()
      .from("leaderboard")
      .upsert({
        player_id: id,
        city_name: e.cityName,
        region: e.region,
        score: e.score,
        techs: e.techs,
        population: e.population,
        year: e.year,
        era: e.era,
        updated_at: new Date().toISOString(),
      });
    // Ranking é vitrine: uma falha (ex.: tabela ainda não criada) não pode desfazer o ciclo.
    if (error) console.error("leaderboard.upsert", error.message);
  }

  async removeScore(id: string): Promise<void> {
    const { error } = await adminClient().from("leaderboard").delete().eq("player_id", id);
    if (error) console.error("leaderboard.delete", error.message);
  }

  async leaderboard(limit: number, playerId?: string) {
    const db = adminClient().from("leaderboard");
    const { data, error, count } = await db
      .select("player_id, city_name, region, score, techs, population, year, era", { count: "exact" })
      .order("score", { ascending: false })
      .limit(limit);
    if (error) throw new Error(`leaderboard.select: ${error.message}`);
    const rows = (data ?? []).map((r) => ({
      cityName: r.city_name,
      region: r.region,
      score: Number(r.score),
      techs: r.techs,
      population: r.population,
      year: r.year,
      era: r.era,
      mine: r.player_id === playerId,
    }));
    let myRank: number | null = null;
    if (playerId) {
      const idx = rows.findIndex((r) => r.mine);
      if (idx >= 0) myRank = idx + 1;
      else {
        const { data: me } = await adminClient().from("leaderboard").select("score").eq("player_id", playerId).maybeSingle();
        if (me) {
          const { count: above } = await adminClient()
            .from("leaderboard")
            .select("player_id", { count: "exact", head: true })
            .gt("score", me.score);
          myRank = (above ?? 0) + 1;
        }
      }
    }
    return { top: rows, myRank, total: count ?? rows.length };
  }
}

// ──────────────── Arquivos locais (desenvolvimento sem Supabase) ────────────────

const DATA_DIR = path.join(process.cwd(), ".data", "players");
const SAFE_ID = /^[a-f0-9-]{36}$/;

class FileRepo implements PlayerRepo {
  private file(id: string) {
    if (!SAFE_ID.test(id)) throw new Error("invalid player id");
    return path.join(DATA_DIR, `${id}.json`);
  }
  async load(id: string): Promise<Loaded | null> {
    try {
      const raw = JSON.parse(await fs.readFile(this.file(id), "utf8"));
      return {
        record: { state: raw.state, activeCycle: raw.activeCycle, presence: raw.presence ?? { ...DEFAULT_PRESENCE } },
        revision: raw.revision ?? 1,
      };
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw e;
    }
  }
  async save(id: string, record: PlayerRecord, revision: number) {
    const current = await this.load(id);
    if ((current?.revision ?? 0) !== revision) return false;
    await fs.mkdir(DATA_DIR, { recursive: true });
    const tmp = `${this.file(id)}.${process.pid}.tmp`;
    await fs.writeFile(tmp, JSON.stringify({ ...record, revision: revision + 1 }));
    await fs.rename(tmp, this.file(id));
    return true;
  }
  async logCycle() {}

  private get boardFile() {
    return path.join(process.cwd(), ".data", "leaderboard.json");
  }
  private async readBoard(): Promise<Record<string, LeaderboardEntry>> {
    try {
      return JSON.parse(await fs.readFile(this.boardFile, "utf8"));
    } catch {
      return {};
    }
  }
  async publishScore(id: string, e: LeaderboardEntry) {
    const board = await this.readBoard();
    board[id] = e;
    await fs.mkdir(path.dirname(this.boardFile), { recursive: true });
    await fs.writeFile(this.boardFile, JSON.stringify(board));
  }
  async removeScore(id: string) {
    const board = await this.readBoard();
    if (!(id in board)) return;
    delete board[id];
    await fs.writeFile(this.boardFile, JSON.stringify(board));
  }
  async leaderboard(limit: number, playerId?: string) {
    const board = await this.readBoard();
    const all = Object.entries(board)
      .map(([id, e]) => ({ ...e, mine: id === playerId }))
      .sort((a, b) => b.score - a.score);
    const idx = all.findIndex((r) => r.mine);
    return { top: all.slice(0, limit), myRank: idx >= 0 ? idx + 1 : null, total: all.length };
  }
}

let repoInstance: PlayerRepo | null = null;
export function repo(): PlayerRepo {
  repoInstance ??= supabaseEnabled ? new SupabaseRepo() : new FileRepo();
  return repoInstance;
}

// ───────────────────────── Transação por jogador ─────────────────────────

export interface TxContext {
  /** Executa depois que o novo estado foi gravado com sucesso. */
  afterCommit(fn: () => Promise<void>): void;
}

export class ConflictError extends Error {}

const MAX_ATTEMPTS = 4;
/** Fila por jogador dentro da mesma instância (evita conflitos desnecessários). */
const locks = new Map<string, Promise<unknown>>();

/**
 * Lê o registro, roda `fn` (que pode alterá-lo) e grava se algo mudou.
 * Em caso de conflito com outra instância, relê e tenta de novo.
 */
export async function withPlayer<T>(
  playerId: string,
  fn: (rec: PlayerRecord, tx: TxContext) => Promise<T> | T,
  r: PlayerRepo = repo(),
): Promise<T> {
  const run = (locks.get(playerId) ?? Promise.resolve()).then(async () => {
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const loaded = await r.load(playerId);
      const revision = loaded?.revision ?? 0;
      const rec: PlayerRecord = loaded?.record ?? {
        state: createCity(parseInt(playerId.replace(/-/g, "").slice(0, 8), 16), Date.now()),
        activeCycle: null,
        presence: { ...DEFAULT_PRESENCE },
      };
      const before = loaded ? JSON.stringify(rec) : "";
      // Cidades salvas em formatos antigos são atualizadas na leitura (e gravadas se mudarem).
      rec.state = migrateState(rec.state);
      const hooks: (() => Promise<void>)[] = [];
      const result = await fn(rec, { afterCommit: (h) => hooks.push(h) });
      if (JSON.stringify(rec) === before) return result;
      if (!(await r.save(playerId, rec, revision))) continue;
      for (const h of hooks) await h();
      return result;
    }
    throw new ConflictError("Muitas alterações simultâneas — tente de novo");
  });
  locks.set(
    playerId,
    run.catch(() => undefined),
  );
  return run;
}
