"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BIOMES,
  BUILDINGS,
  RANKS,
  RESOURCES,
  WIRE_COST,
  ZONE_KINDS,
  ZONES,
  buildingAt,
  buildingStatus,
  cityPeriodLabel,
  REGION_BY_ID,
  weatherAt,
  computeDemand,
  computePower,
  effectiveStreak,
  getQty,
  laborStats,
  lockReason,
  rankForStreak,
  roadAccess,
  type BuildCategory,
  type BuildingType,
  type ResourceId,
  type ZoneKind,
} from "@/sim";
import { parseZoneTool, useGame, type Overlay, type Tool } from "@/store/game";
import { bus } from "@/game/bus";
import { Panel } from "./Panel";
import { RankBadge, hex } from "./ranks";
import { Timer } from "./Timer";
import { CycleReportModal } from "./CycleReportModal";
import { AccountButton } from "./AccountButton";
import { GameMenu } from "./GameMenu";

const GROUPS: { title: string; category: BuildCategory }[] = [
  { title: "Energia", category: "energy" },
  { title: "Produção", category: "production" },
  { title: "Especial", category: "special" },
];

export function Hud() {
  const city = useGame((s) => s.city);
  const phase = useGame((s) => s.phase);
  const toast = useGame((s) => s.toast);
  const pending = useGame((s) => s.pending.length);
  const [hover, setHover] = useState<{ x: number; y: number } | null>(null);
  const [toolsOpen, setToolsOpen] = useState(() => typeof window === "undefined" || window.innerWidth >= 768);

  useEffect(() => {
    const offs = [
      bus.on("tile:click", ({ x, y }) => useGame.getState().clickTile(x, y)),
      bus.on("area:select", ({ x0, y0, x1, y1 }) => useGame.getState().selectArea(x0, y0, x1, y1)),
      bus.on("tile:hover", setHover),
    ];
    return () => offs.forEach((off) => off());
  }, []);

  const derived = useMemo(() => {
    if (!city) return null;
    const power = computePower(city);
    const status = buildingStatus(city, power.powered);
    const labor = laborStats(city, status);
    return {
      power,
      status,
      labor,
      demand: computeDemand(city, labor),
      access: roadAccess(city),
      weather: weatherAt(city),
    };
  }, [city]);

  if (!city || !derived) {
    return <div className="absolute inset-0 grid place-items-center text-sm">Carregando a cidade…</div>;
  }

  const { power, status, labor, demand, access, weather } = derived;
  const region = city.regionId ? REGION_BY_ID[city.regionId] : null;
  const nextRank = rankForStreak(effectiveStreak(city, Date.now()) + 1);
  const locked = phase === "focus";

  return (
    <div className="pointer-events-none absolute inset-0 flex flex-col gap-2 p-2 text-xs">
      {/* Barra superior */}
      <div className="retro-panel pointer-events-auto flex flex-wrap items-center gap-x-4 gap-y-1 px-2 py-1">
        <strong className="tracking-widest text-amber-300">POMO-CITY</strong>
        <span title="1 ciclo de foco = 1 estação (3 meses)">
          📅 {weather ? `${weather.season} · ` : ""}
          {cityPeriodLabel(city)}
        </span>
        <span>
          {region ? `${region.name} · ` : ""}
          {BIOMES[city.biome].name}
        </span>
        <span>💰 ${city.money}</span>
        <span title="População / moradia">
          👥 {city.population}/{labor.housing}
        </span>
        <span title="Empregos preenchidos / total · desempregados">
          💼 {labor.publicFilled + labor.zoneFilled}/{labor.totalJobs}
          {labor.unemployed > 0 && <span className="text-red-300"> ({labor.unemployed} sem emprego)</span>}
        </span>
        <PowerMeter used={power.supplied} demand={power.demand} capacity={power.capacity} />
        <DemandIndicator demand={demand} />
        <span className="flex items-center gap-1">
          Sequência {city.streak} · próximo lote <RankBadge rank={nextRank} />
        </span>
        <span>Ciclos hoje: {city.cyclesToday}</span>
        {pending > 0 && <span className="text-amber-300">{pending} obra(s) aguardando sincronia</span>}
        <AccountButton />
        <GameMenu />
      </div>

      <div className="flex min-h-0 flex-1 flex-col justify-between gap-2 md:flex-row">
        {/* Ferramentas */}
        <section className="retro-panel pointer-events-auto w-full self-start md:w-56">
          <button
            type="button"
            className="retro-title flex w-full items-center text-left"
            onClick={() => setToolsOpen((v) => !v)}
            aria-expanded={toolsOpen}
          >
            Construir <span className="ml-auto">{toolsOpen ? "▾" : "▸"}</span>
          </button>
          {toolsOpen && (
            <div className="max-h-[45dvh] space-y-2 overflow-y-auto p-2 md:max-h-[70dvh]">
              <ToolGroup title="Infraestrutura">
                <ToolButton tool="road" disabled={locked} label={BUILDINGS.road.name} cost={BUILDINGS.road.cost} color={BUILDINGS.road.color} />
                <ToolButton tool="wire" disabled={locked} label="Linha de transmissão" cost={WIRE_COST} color={0x3a2a1a} />
              </ToolGroup>
              <ZoneTools disabled={locked} population={city.population} />
              {GROUPS.map((g) => (
                <ToolGroup key={g.category} title={g.title}>
                  {(Object.keys(BUILDINGS) as BuildingType[])
                    .filter((t) => BUILDINGS[t].buildable && BUILDINGS[t].category === g.category)
                    .map((t) => {
                      const lock = lockReason(BUILDINGS[t].requires, city);
                      return (
                        <ToolButton
                          key={t}
                          tool={t}
                          disabled={locked || !!lock}
                          lock={lock}
                          label={BUILDINGS[t].name}
                          cost={BUILDINGS[t].cost}
                          color={BUILDINGS[t].color}
                        />
                      );
                    })}
                </ToolGroup>
              ))}
              <ToolButton tool="demolish" disabled={locked} label="🧨 Demolir" />
              <OverlayPicker />
              {locked && <p className="text-red-300">Em foco: obras bloqueadas.</p>}
            </div>
          )}
        </section>

        {/* Clima + armazém + inspeção */}
        <div className="flex w-full flex-col gap-2 md:w-60 md:self-start">
        {weather && <WeatherPanel weather={weather} focus={phase === "focus"} />}
        <Panel title="Armazém" className="w-full">
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
          {hover && (
            <TileInfo
              x={hover.x}
              y={hover.y}
              status={status}
              powered={power.powered}
              access={access}
            />
          )}
        </Panel>
        </div>
      </div>

      <Timer />

      {toast && (
        <div className="retro-panel pointer-events-auto absolute left-1/2 top-12 -translate-x-1/2 px-3 py-1">{toast}</div>
      )}
      <CycleReportModal />
    </div>
  );
}

function TileInfo({
  x,
  y,
  status,
  powered,
  access,
}: {
  x: number;
  y: number;
  status: ReturnType<typeof buildingStatus>;
  powered: Uint8Array;
  access: Int32Array;
}) {
  const city = useGame((s) => s.city)!;
  const i = y * city.width + x;
  const b = buildingAt(city, x, y);
  const zone = city.zoneType[i];
  if (!b && !zone && !city.wires[i]) return null;

  return (
    <div className="mt-2 space-y-0.5 border-t border-zinc-600 pt-2">
      {b ? (
        <>
          <strong>{BUILDINGS[b.type].name}</strong>
          <p className="text-zinc-400">{BUILDINGS[b.type].description}</p>
          {(() => {
            const st = status.get(b.id);
            if (!st) return null;
            return (
              <>
                {BUILDINGS[b.type].needsRoad && !st.connected && <p className="text-red-300">Sem estrada ligada à prefeitura</p>}
                {!st.powered && <p className="text-yellow-300">Sem energia: operando a 50%</p>}
                {st.required > 0 && (
                  <p>
                    Trabalhadores: {st.staffed}/{st.required}
                  </p>
                )}
              </>
            );
          })()}
        </>
      ) : zone ? (
        <>
          <strong>
            {ZONES[ZONE_KINDS[zone - 1]].name} {city.zoneDensity[i] ? "densa" : "leve"}
          </strong>
          <p>
            Nível {city.zoneLevel[i]}/{ZONES[ZONE_KINDS[zone - 1]].maxLevel[city.zoneDensity[i]]}
          </p>
          {!powered[i] && <p className="text-yellow-300">Sem energia</p>}
          {access[i] < 0 && <p className="text-red-300">Longe demais da estrada (máx. 3 tiles)</p>}
        </>
      ) : null}
      {city.wires[i] === 1 && <p className="text-zinc-400">Linha de transmissão</p>}
    </div>
  );
}

function ToolGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="mb-1 text-[10px] uppercase tracking-wider text-zinc-400">{title}</h3>
      <div className="grid grid-cols-2 gap-1 md:grid-cols-1">{children}</div>
    </div>
  );
}

function ZoneTools({ disabled, population }: { disabled: boolean; population: number }) {
  const tool = useGame((s) => s.tool);
  const current = parseZoneTool(tool);
  const [dense, setDense] = useState(current?.dense ?? false);
  const denseLock = population < ZONES.R.denseRequires.population! ? `Requer ${ZONES.R.denseRequires.population} habitantes` : null;
  const density = dense && !denseLock ? "dense" : "light";

  return (
    <div>
      <div className="mb-1 flex items-center gap-2">
        <h3 className="text-[10px] uppercase tracking-wider text-zinc-400">Zonas</h3>
        <label className="ml-auto flex items-center gap-1" title={denseLock ?? "Zonas densas crescem até o nível 4"}>
          <input
            type="checkbox"
            checked={dense && !denseLock}
            disabled={!!denseLock}
            onChange={(e) => {
              setDense(e.target.checked);
              if (current && current.zone !== "none") {
                useGame.getState().setTool(`zone-${current.zone}-${e.target.checked ? "dense" : "light"}`);
              }
            }}
          />
          densa
        </label>
      </div>
      <div className="grid grid-cols-2 gap-1 md:grid-cols-1">
        {(ZONE_KINDS as ZoneKind[]).map((z) => (
          <ToolButton
            key={z}
            tool={`zone-${z}-${density}`}
            disabled={disabled}
            label={`${ZONES[z].name}`}
            cost={ZONES[z].cost[density === "dense" ? 1 : 0]}
            costSuffix="/tile"
            color={ZONES[z].color}
          />
        ))}
        <ToolButton tool="zone-none-light" disabled={disabled} label="Remover zona" />
      </div>
      <p className="mt-1 text-[10px] text-zinc-500">Arraste para zonear uma área.</p>
    </div>
  );
}

function ToolButton({
  tool,
  disabled,
  label,
  cost,
  costSuffix = "",
  color,
  lock,
}: {
  tool: Tool;
  disabled: boolean;
  label: string;
  cost?: number;
  costSuffix?: string;
  color?: number;
  lock?: string | null;
}) {
  const selected = useGame((s) => s.tool === tool);
  const setTool = useGame((s) => s.setTool);
  const def = tool && tool in BUILDINGS ? BUILDINGS[tool as BuildingType] : null;
  const title = lock
    ? lock
    : def
      ? `${def.description}\nCusto $${def.cost} · manutenção $${def.upkeep}/ciclo`
      : label;
  return (
    <button
      type="button"
      disabled={disabled}
      title={title}
      onClick={() => setTool(tool)}
      className={`retro-button flex items-center gap-1 ${selected ? "retro-button-active" : ""}`}
    >
      {color !== undefined && <span className="inline-block h-2 w-2 shrink-0" style={{ background: hex(color) }} />}
      <span className="flex-1 truncate text-left">{lock ? `🔒 ${label}` : label}</span>
      {cost !== undefined && (
        <span className="hidden text-zinc-400 md:inline">
          ${cost}
          {costSuffix}
        </span>
      )}
    </button>
  );
}

function OverlayPicker() {
  const overlay = useGame((s) => s.overlay);
  const setOverlay = useGame((s) => s.setOverlay);
  const options: { id: Overlay; label: string }[] = [
    { id: "none", label: "Normal" },
    { id: "power", label: "⚡ Energia" },
    { id: "zones", label: "Zonas" },
  ];
  return (
    <div>
      <h3 className="mb-1 text-[10px] uppercase tracking-wider text-zinc-400">Visualizar</h3>
      <div className="flex gap-1">
        {options.map((o) => (
          <button
            key={o.id}
            type="button"
            onClick={() => setOverlay(o.id)}
            className={`retro-button flex-1 ${overlay === o.id ? "retro-button-active" : ""}`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function PowerMeter({ used, demand, capacity }: { used: number; demand: number; capacity: number }) {
  const short = demand > capacity;
  return (
    <span title={`Consumo ${demand} MW · capacidade ${capacity} MW`} className={short ? "text-red-300" : ""}>
      ⚡ {used}/{capacity} MW{short && " — apagão!"}
    </span>
  );
}

/** Indicador de demanda R/C/I: barras para cima (demanda) ou para baixo (excesso). */
function DemandIndicator({ demand }: { demand: Record<ZoneKind, number> }) {
  return (
    <span className="flex items-end gap-0.5" title="Demanda por zonas (R/C/I)">
      {(ZONE_KINDS as ZoneKind[]).map((z) => {
        const v = demand[z];
        const h = Math.round(Math.abs(v) * 10);
        return (
          <span key={z} className="flex flex-col items-center">
            <span className="relative h-5 w-2 bg-zinc-800">
              <span
                className="absolute left-0 w-2"
                style={{
                  background: hex(ZONES[z].color),
                  height: `${h}px`,
                  bottom: v >= 0 ? "10px" : undefined,
                  top: v < 0 ? "10px" : undefined,
                  opacity: v >= 0 ? 1 : 0.5,
                }}
              />
            </span>
            <span className="text-[9px] leading-3">{z}</span>
          </span>
        );
      })}
    </span>
  );
}

const pct = (v: number) => `${Math.round(v * 100)}%`;

/** Previsão da estação que o próximo ciclo vai viver (o tempo é sorteado com seed: a previsão é exata). */
function WeatherPanel({ weather, focus }: { weather: NonNullable<ReturnType<typeof weatherAt>>; focus: boolean }) {
  const e = weather.effects;
  const tone = (v: number) => (v >= 1.05 ? "text-emerald-300" : v <= 0.8 ? "text-red-300" : "");
  return (
    <Panel title={focus ? "Clima deste ciclo" : "Previsão: próximo ciclo"} className="w-full">
      <p>
        <strong>{weather.season}</strong> · {weather.label}
      </p>
      <p className="text-zinc-300">
        🌡 {weather.temp}°C · 🌧 {weather.rain} mm · 💨 {weather.wind} m/s
      </p>
      <ul className="mt-1 grid grid-cols-2 gap-x-2">
        <li>
          Lavoura: <span className={tone(e.farm)}>{pct(e.farm)}</span>
        </li>
        <li>
          Eólica: <span className={tone(e.wind)}>{pct(e.wind)}</span>
        </li>
        <li>
          Hidrelétrica: <span className={tone(e.hydro)}>{pct(e.hydro)}</span>
        </li>
        <li title="Aquecimento ou refrigeração em casas e comércio">
          Consumo: <span className={e.demand > 1.05 ? "text-amber-300" : ""}>{pct(e.demand)}</span>
        </li>
      </ul>
    </Panel>
  );
}
