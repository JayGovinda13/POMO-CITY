"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { applyCommand, applyCommands, type BuildingType, type CityState, type Command, type CycleReport } from "@/sim";

export type Tool = BuildingType | "demolish" | null;
export type Phase = "loading" | "idle" | "focus" | "break";

interface ServerConfig {
  focusSeconds: number;
  breakSeconds: number;
  longBreakSeconds: number;
  longBreakEvery: number;
}

interface ServerSnapshot {
  state: CityState;
  activeCycle: { startedAt: number; endsAt: number } | null;
  serverNow: number;
  config: ServerConfig;
  report?: CycleReport;
  rejected?: { index: number; command: Command; error: string }[];
  error?: string;
}

interface GameStore {
  /** Último estado autoritativo vindo do servidor. */
  serverState: CityState | null;
  /** Comandos da pausa ainda não enviados (persistidos localmente). */
  pending: Command[];
  /** serverState + pending: o que o jogador vê. */
  city: CityState | null;
  phase: Phase;
  /** Fim da fase atual, já convertido para o relógio local. */
  endsAt: number | null;
  /** Diferença relógio do servidor − relógio local. */
  clockSkew: number;
  config: ServerConfig | null;
  tool: Tool;
  report: CycleReport | null;
  toast: string | null;
  busy: boolean;

  load(): Promise<void>;
  setTool(tool: Tool): void;
  clickTile(x: number, y: number): void;
  startFocus(): Promise<void>;
  completeFocus(): Promise<void>;
  abandonFocus(): Promise<void>;
  skipBreak(): void;
  dismissReport(): void;
  showToast(msg: string): void;
}

async function call(path: string, body?: unknown): Promise<ServerSnapshot & { status: number }> {
  const res = await fetch(path, {
    method: body === undefined && path === "/api/city" ? "GET" : "POST",
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  return { ...(await res.json()), status: res.status };
}

function derive(serverState: CityState | null, pending: Command[]) {
  if (!serverState) return { city: null, pending };
  const { state, rejected } = applyCommands(serverState, pending);
  // Descarta da fila o que ficou inválido (ex.: estado do servidor mudou).
  const valid = rejected.length ? pending.filter((_, i) => !rejected.some((r) => r.index === i)) : pending;
  return { city: state, pending: valid };
}

export const useGame = create<GameStore>()(
  persist(
    (set, get) => {
      const accept = (snap: ServerSnapshot, pending: Command[] = get().pending) => {
        const clockSkew = snap.serverNow - Date.now();
        const phase: Phase = snap.activeCycle ? "focus" : get().phase === "focus" ? "idle" : get().phase;
        set({
          serverState: snap.state,
          config: snap.config,
          clockSkew,
          phase: phase === "loading" ? "idle" : phase,
          endsAt: snap.activeCycle ? snap.activeCycle.endsAt - clockSkew : phase === "break" ? get().endsAt : null,
          ...derive(snap.state, pending),
        });
      };

      return {
        serverState: null,
        pending: [],
        city: null,
        phase: "loading",
        endsAt: null,
        clockSkew: 0,
        config: null,
        tool: "road",
        report: null,
        toast: null,
        busy: false,

        async load() {
          try {
            const snap = await call("/api/city");
            accept(snap);
            const { phase, endsAt } = get();
            if (phase === "break" && endsAt && Date.now() > endsAt) set({ phase: "idle", endsAt: null });
          } catch {
            get().showToast("Sem conexão — jogando offline");
          }
        },

        setTool(tool) {
          set({ tool });
        },

        clickTile(x, y) {
          const { tool, city, phase, pending, serverState } = get();
          if (!city || !tool) return;
          if (phase === "focus") {
            get().showToast("Foco! A cidade só aceita obras na pausa.");
            return;
          }
          const cmd: Command = tool === "demolish" ? { type: "demolish", x, y } : { type: "build", building: tool, x, y };
          const r = applyCommand(city, cmd);
          if (!r.ok) {
            get().showToast(r.error);
            return;
          }
          // Desfazer obra ainda não sincronizada: remove o comando da fila em vez de enfileirar demolição.
          if (cmd.type === "demolish") {
            const i = pending.findLastIndex((c) => c.type === "build" && c.x === x && c.y === y);
            if (i >= 0) {
              const next = pending.filter((_, j) => j !== i);
              set(derive(serverState, next));
              return;
            }
          }
          set({ pending: [...pending, cmd], city: r.state });
        },

        async startFocus() {
          if (get().busy) return;
          set({ busy: true });
          try {
            const snap = await call("/api/cycle/start", { commands: get().pending });
            if (snap.status === 409) {
              const fresh = await call("/api/city");
              accept(fresh);
              return;
            }
            if (snap.error) throw new Error(snap.error);
            accept(snap, []);
            if (snap.rejected?.length) get().showToast(`${snap.rejected.length} obra(s) rejeitada(s) pelo servidor`);
            if (typeof Notification !== "undefined" && Notification.permission === "default") {
              Notification.requestPermission().catch(() => {});
            }
          } catch (e) {
            get().showToast((e as Error).message || "Falha ao iniciar o ciclo");
          } finally {
            set({ busy: false });
          }
        },

        async completeFocus() {
          if (get().busy) return;
          set({ busy: true });
          try {
            const snap = await call("/api/cycle/complete");
            if (snap.status === 425) return; // relógio local adiantado; tenta de novo no próximo tick
            if (snap.error) throw new Error(snap.error);
            const cfg = snap.config;
            const long = snap.state.cyclesCompleted % cfg.longBreakEvery === 0;
            accept(snap);
            set({
              phase: "break",
              endsAt: Date.now() + (long ? cfg.longBreakSeconds : cfg.breakSeconds) * 1000,
              report: snap.report ?? null,
            });
          } catch (e) {
            get().showToast((e as Error).message || "Falha ao concluir o ciclo");
          } finally {
            set({ busy: false });
          }
        },

        async abandonFocus() {
          if (get().busy) return;
          set({ busy: true });
          try {
            const snap = await call("/api/cycle/abandon");
            if (snap.error) throw new Error(snap.error);
            accept(snap);
            set({ phase: "idle", endsAt: null });
            get().showToast("Ciclo abandonado: a sequência caiu.");
          } catch (e) {
            get().showToast((e as Error).message);
          } finally {
            set({ busy: false });
          }
        },

        skipBreak() {
          set({ phase: "idle", endsAt: null });
        },

        dismissReport() {
          set({ report: null });
        },

        showToast(msg) {
          set({ toast: msg });
          setTimeout(() => {
            if (get().toast === msg) set({ toast: null });
          }, 2500);
        },
      };
    },
    {
      name: "pomo-city",
      version: 1,
      // Offline-first: só a fila da pausa e a fase ficam no navegador; o estado oficial vem do servidor.
      partialize: (s) => ({ pending: s.pending, phase: s.phase === "break" ? "break" : "idle", endsAt: s.phase === "break" ? s.endsAt : null, tool: s.tool }),
    },
  ),
);
