"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { ensureSession } from "@/lib/supabase/client";
import {
  applyCommand,
  applyCommands,
  migrateState,
  type BuildingType,
  type CityState,
  type Command,
  type CycleReport,
  type DisasterReport,
  type ZoneKind,
} from "@/sim";

/** Ferramentas de zona: "zone-R-light", "zone-I-dense", "zone-none-light" (remover zona). */
export type ZoneTool = `zone-${ZoneKind | "none"}-${"light" | "dense"}`;
export type Tool = BuildingType | "demolish" | "wire" | ZoneTool | null;
export type Overlay = "none" | "power" | "zones";

export function parseZoneTool(tool: Tool): { zone: ZoneKind | "none"; dense: boolean } | null {
  if (!tool || !tool.startsWith("zone-")) return null;
  const [, zone, density] = tool.split("-");
  return { zone: zone as ZoneKind | "none", dense: density === "dense" };
}

/** Ferramentas que funcionam arrastando um retângulo (as demais "pintam" tile a tile). */
export const isAreaTool = (tool: Tool) => parseZoneTool(tool) !== null;
export type Phase = "loading" | "idle" | "focus" | "break";
/** Tela inicial (Continuar / Novo jogo) ou o jogo em si. */
export type Screen = "menu" | "game";

interface ServerConfig {
  focusSeconds: number;
  breakSeconds: number;
  longBreakSeconds: number;
  longBreakEvery: number;
}

interface ServerSnapshot {
  state: CityState;
  activeCycle: { startedAt: number; endsAt: number } | null;
  presence?: "playing" | "exited";
  disaster?: DisasterReport | null;
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
  overlay: Overlay;
  report: CycleReport | null;
  disaster: DisasterReport | null;
  screen: Screen;
  /** Presença registrada no servidor ("playing" = sessão aberta). */
  presence: "playing" | "exited";
  toast: string | null;
  busy: boolean;

  load(): Promise<void>;
  /** "Continuar": entra na cidade. */
  enter(): Promise<void>;
  /** "Sair" pelo menu (só sem foco): sincroniza as obras e guarda a sequência. */
  exit(): Promise<void>;
  /** "Novo jogo": cidade nova, mesma sequência de foco. */
  newGame(): Promise<void>;
  /** Fundação: escolhe a região climática da cidade. */
  chooseRegion(regionId: string): Promise<boolean>;
  dismissDisaster(): void;
  /** Troca de conta: descarta a fila local e recarrega a cidade do novo usuário. */
  reset(): Promise<void>;
  setTool(tool: Tool): void;
  setOverlay(overlay: Overlay): void;
  clickTile(x: number, y: number): void;
  selectArea(x0: number, y0: number, x1: number, y1: number): void;
  /** Aplica um comando localmente e o enfileira para o servidor. */
  queue(cmd: Command): boolean;
  startFocus(): Promise<void>;
  completeFocus(): Promise<void>;
  abandonFocus(): Promise<void>;
  skipBreak(): void;
  dismissReport(): void;
  showToast(msg: string): void;
}

async function call(path: string, body?: unknown, retried = false): Promise<ServerSnapshot & { status: number }> {
  await ensureSession();
  const res = await fetch(path, {
    method: path === "/api/city" ? "GET" : "POST",
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  // Sessão expirada/removida: cria outra e tenta uma vez mais.
  if (res.status === 401 && !retried) return call(path, body, true);
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
        snap.state = migrateState(snap.state);
        if (snap.disaster) set({ disaster: snap.disaster });
        if (snap.presence) set({ presence: snap.presence });
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
        overlay: "none",
        report: null,
        disaster: null,
        screen: "menu",
        presence: "exited",
        toast: null,
        busy: false,

        async load() {
          try {
            const snap = await call("/api/city");
            accept(snap);
            // Recarregou a página no meio de uma sessão: volta direto para a cidade.
            if (snap.presence === "playing" && !snap.disaster) set({ screen: "game" });
            const { phase, endsAt } = get();
            if (phase === "break" && endsAt && Date.now() > endsAt) set({ phase: "idle", endsAt: null });
          } catch (e) {
            get().showToast((e as Error).message || "Sem conexão — jogando offline");
          }
        },

        async enter() {
          const snap = await call("/api/session/enter");
          if (snap.error) return get().showToast(snap.error);
          accept(snap);
          set({ screen: "game" });
        },

        async exit() {
          if (get().phase === "focus") return get().showToast("Só é possível sair com o foco encerrado.");
          set({ busy: true });
          try {
            const snap = await call("/api/session/exit", { commands: get().pending });
            if (snap.error) return get().showToast(snap.error);
            accept(snap, []);
            set({ screen: "menu", phase: "idle", endsAt: null, report: null });
          } finally {
            set({ busy: false });
          }
        },

        async newGame() {
          if (get().phase === "focus") return get().showToast("Encerre o foco antes de começar outro jogo.");
          set({ busy: true });
          try {
            const snap = await call("/api/game/new");
            if (snap.error) return get().showToast(snap.error);
            accept(snap, []);
            set({ screen: "game", phase: "idle", endsAt: null, report: null });
          } finally {
            set({ busy: false });
          }
        },

        async chooseRegion(regionId) {
          set({ busy: true });
          try {
            const snap = await call("/api/city/region", { regionId });
            if (snap.error) {
              get().showToast(snap.error);
              return false;
            }
            accept(snap, []);
            return true;
          } finally {
            set({ busy: false });
          }
        },

        dismissDisaster() {
          set({ disaster: null });
        },

        async reset() {
          set({ serverState: null, city: null, pending: [], phase: "loading", endsAt: null, report: null });
          await get().load();
        },

        setTool(tool) {
          set({ tool });
        },

        setOverlay(overlay) {
          set({ overlay });
        },

        queue(cmd) {
          const { city, phase } = get();
          if (!city) return false;
          if (phase === "focus") {
            get().showToast("Foco! A cidade só aceita obras na pausa.");
            return false;
          }
          const r = applyCommand(city, cmd);
          if (!r.ok) {
            get().showToast(r.error);
            return false;
          }
          set({ pending: [...get().pending, cmd], city: r.state });
          return true;
        },

        clickTile(x, y) {
          const { tool, pending, serverState, city } = get();
          if (!tool || isAreaTool(tool)) return;
          if (tool === "demolish") {
            // Desfazer obra ainda não sincronizada: remove o comando da fila em vez de enfileirar demolição.
            const i = pending.findLastIndex((c) => c.type === "build" && c.x === x && c.y === y);
            const stillThere = city?.buildings.some((b) => b.x === x && b.y === y);
            if (i >= 0 && stillThere) {
              set(derive(serverState, pending.filter((_, j) => j !== i)));
              return;
            }
            get().queue({ type: "demolish", x, y });
            return;
          }
          if (tool === "wire") get().queue({ type: "wire", x, y });
          else get().queue({ type: "build", building: tool as BuildingType, x, y });
        },

        selectArea(x0, y0, x1, y1) {
          const z = parseZoneTool(get().tool);
          if (z) get().queue({ type: "zone", zone: z.zone, dense: z.dense, x0, y0, x1, y1 });
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
      version: 2,
      // v1 → v2: a ferramenta "casa" deixou de existir (agora é zona residencial).
      migrate: (persisted) => {
        const p = (persisted ?? {}) as Record<string, unknown>;
        return { ...p, tool: p.tool === "house" ? "zone-R-light" : p.tool } as never;
      },
      // Offline-first: só a fila da pausa e a fase ficam no navegador; o estado oficial vem do servidor.
      partialize: (s) => ({
        pending: s.pending,
        phase: s.phase === "break" ? "break" : "idle",
        endsAt: s.phase === "break" ? s.endsAt : null,
        tool: s.tool,
        overlay: s.overlay,
      }),
    },
  ),
);
