"use client";

import { useEffect, useState } from "react";
import {
  BIOMES,
  BUILDINGS,
  RANKS,
  RESOURCES,
  buildingAt,
  buildingStatus,
  effectiveStreak,
  getQty,
  housingCapacity,
  rankForStreak,
  type BuildingType,
  type ResourceId,
} from "@/sim";
import { useGame, type Tool } from "@/store/game";
import { bus } from "@/game/bus";
import { Panel } from "./Panel";
import { RankBadge, hex } from "./ranks";
import { Timer } from "./Timer";
import { CycleReportModal } from "./CycleReportModal";

const TOOL_ORDER: BuildingType[] = ["road", "house", "farm", "lumberyard", "mine", "sawmill", "smelter", "monument"];

export function Hud() {
  const city = useGame((s) => s.city);
  const phase = useGame((s) => s.phase);
  const toast = useGame((s) => s.toast);
  const pending = useGame((s) => s.pending.length);
  const [hover, setHover] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const off1 = bus.on("tile:click", ({ x, y }) => useGame.getState().clickTile(x, y));
    const off2 = bus.on("tile:hover", setHover);
    return () => {
      off1();
      off2();
    };
  }, []);

  if (!city) {
    return <div className="absolute inset-0 grid place-items-center text-sm">Carregando a cidade…</div>;
  }

  const status = buildingStatus(city);
  const cap = housingCapacity(city, status);
  const nextRank = rankForStreak(effectiveStreak(city, Date.now()) + 1);
  const hovered = hover ? buildingAt(city, hover.x, hover.y) : undefined;
  const hoveredStatus = hovered ? status.get(hovered.id) : undefined;

  return (
    <div className="pointer-events-none absolute inset-0 flex flex-col gap-2 p-2 text-xs">
      {/* Barra superior */}
      <div className="retro-panel pointer-events-auto flex flex-wrap items-center gap-x-4 gap-y-1 px-2 py-1">
        <strong className="tracking-widest text-amber-300">POMO-CITY</strong>
        <span>Bioma: {BIOMES[city.biome].name}</span>
        <span>💰 ${city.money}</span>
        <span>
          👥 {city.population}/{cap}
        </span>
        <span className="flex items-center gap-1">
          Sequência {city.streak} · próximo lote <RankBadge rank={nextRank} />
        </span>
        <span>Ciclos hoje: {city.cyclesToday}</span>
        {pending > 0 && <span className="text-amber-300">{pending} obra(s) aguardando sincronia</span>}
      </div>

      <div className="flex min-h-0 flex-1 flex-col justify-between gap-2 md:flex-row">
        {/* Ferramentas */}
        <Panel title="Construir" className="w-full md:w-52 md:self-start">
          <div className="grid grid-cols-3 gap-1 md:grid-cols-1">
            {TOOL_ORDER.map((t) => (
              <ToolButton key={t} tool={t} disabled={phase === "focus"}>
                <span className="inline-block h-2 w-2" style={{ background: hex(BUILDINGS[t].color) }} />
                <span className="flex-1 truncate text-left">{BUILDINGS[t].name}</span>
                <span className="hidden text-zinc-400 md:inline">${BUILDINGS[t].cost}</span>
              </ToolButton>
            ))}
            <ToolButton tool="demolish" disabled={phase === "focus"}>
              <span className="flex-1 text-left">🧨 Demolir</span>
            </ToolButton>
          </div>
          {phase === "focus" && <p className="mt-2 text-red-300">Em foco: obras bloqueadas.</p>}
        </Panel>

        {/* Inventário */}
        <Panel title="Armazém" className="w-full md:w-60 md:self-start">
          <table className="w-full border-collapse text-center">
            <thead>
              <tr>
                <th className="text-left font-normal text-zinc-400">Recurso</th>
                {RANKS.map((r) => (
                  <th key={r}>
                    <RankBadge rank={r} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(Object.keys(RESOURCES) as ResourceId[]).map((res) => (
                <tr key={res}>
                  <td className="text-left">{RESOURCES[res].name}</td>
                  {RANKS.map((r) => {
                    const q = getQty(city.inventory, res, r);
                    return (
                      <td key={r} className={q ? "" : "text-zinc-600"}>
                        {q}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          {hovered && (
            <div className="mt-2 border-t border-zinc-600 pt-2">
              <strong>{BUILDINGS[hovered.type].name}</strong>
              <p className="text-zinc-400">{BUILDINGS[hovered.type].description}</p>
              {hoveredStatus && BUILDINGS[hovered.type].needsRoad && !hoveredStatus.connected && (
                <p className="text-red-300">Sem estrada ligada à prefeitura</p>
              )}
              {hoveredStatus && hoveredStatus.required > 0 && (
                <p>
                  Trabalhadores: {hoveredStatus.staffed}/{hoveredStatus.required}
                </p>
              )}
            </div>
          )}
        </Panel>
      </div>

      <Timer />

      {toast && (
        <div className="retro-panel pointer-events-auto absolute left-1/2 top-12 -translate-x-1/2 px-3 py-1">{toast}</div>
      )}
      <CycleReportModal />
    </div>
  );
}

function ToolButton({ tool, disabled, children }: { tool: Tool; disabled: boolean; children: React.ReactNode }) {
  const selected = useGame((s) => s.tool === tool);
  const setTool = useGame((s) => s.setTool);
  const def = tool && tool !== "demolish" ? BUILDINGS[tool] : null;
  return (
    <button
      type="button"
      disabled={disabled}
      title={def ? `${def.description}\nCusto $${def.cost} · manutenção $${def.upkeep}/ciclo` : "Remove a construção"}
      onClick={() => setTool(tool)}
      className={`retro-button flex items-center gap-1 ${selected ? "retro-button-active" : ""}`}
    >
      {children}
    </button>
  );
}
