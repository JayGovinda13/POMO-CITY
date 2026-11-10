"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  BIOMES,
  BUILDINGS,
  WIRE_COST,
  PIPE_COST,
  computeWater,
  ZONE_KINDS,
  ZONES,
  buildingAt,
  buildingStatus,
  cityPeriodLabel,
  REGION_BY_ID,
  weatherAt,
  computeDemand,
  repairCost,
  RESOURCE_NAMES,
  citizensView,
  moodSummary,
  computePower,
  laborStats,
  lockReason,
  roadAccess,
  computeServices,
  computeTraffic,
  RESOURCES,
  TERRAFORM,
  terraformCost,
  quoteMaterials,
  equivalentAvailable,
  type MaterialCost,
  type TerraformAction,
  MAX_TRIP,
  cityDisplayName,
  wealthOf,
  WEALTH_NAMES,
  type BuildCategory,
  type BuildingType,
  type ZoneKind,
} from "@/sim";
import { parseZoneTool, useGame, type Overlay, type Tool } from "@/store/game";
import { bus } from "@/game/bus";
import { Panel } from "./Panel";
import { hex } from "./ranks";
import { Timer } from "./Timer";
import { CycleReportModal } from "./CycleReportModal";
import { GameMenu } from "./GameMenu";
import { MarketButton } from "./MarketPanel";
import { BudgetButton } from "./BudgetPanel";
import { CitizensButton } from "./CitizensPanel";
import { DonateButton } from "./DonateButton";
import { Logo } from "./Logo";
import { ResourcesButton } from "./ResourcesButton";
import { MusicButton } from "./Music";
import { MOOD_ICON, Portrait } from "./Portrait";
import { ResourceIcon, Car, HomeSale, Industry, ShieldAlert, Calendar, City, Coins, DragHandGesture, Droplet, Eye, Farm, Flash, GraduationCap, Group, Heart, MapIcon, MapsGoStraight, Packages, SeaWaves, Shield, Tower, Train, Trash, Tree, WeatherIcon, Xmark } from "./icons";

type CategoryId = "vias" | "zonas" | "terreno" | BuildCategory | "view";

const CATEGORIES: { id: CategoryId; icon: ReactNode; title: string }[] = [
  { id: "vias", icon: <MapsGoStraight />, title: "Vias e energia elétrica" },
  { id: "zonas", icon: <City />, title: "Zonas" },
  { id: "transport", icon: <Train />, title: "Transporte (rodovias, trilhos, túneis, ônibus, portos)" },
  { id: "terreno", icon: <MapIcon />, title: "Terreno (relevo, água, árvores)" },
  { id: "energy", icon: <Flash />, title: "Usinas" },
  { id: "water", icon: <Droplet />, title: "Água" },
  { id: "services", icon: <Shield />, title: "Serviços (polícia, bombeiros, saúde, educação)" },
  { id: "leisure", icon: <Tree />, title: "Lazer (praças, parques, atrações)" },
  { id: "production", icon: <Farm />, title: "Produção" },
  { id: "storage", icon: <Packages />, title: "Armazenagem" },
  { id: "special", icon: <Tower />, title: "Especial" },
  { id: "view", icon: <Eye />, title: "Visualizar" },
];

/** Categoria da ferramenta selecionada (para destacar o ícone certo). */
function categoryOf(tool: Tool): CategoryId | null {
  if (!tool || tool === "pan" || tool === "demolish") return null;
  if (tool === "road" || tool === "wire") return "vias";
  if (tool === "pipe") return "water";
  if (tool.startsWith("zone-")) return "zonas";
  if (tool.startsWith("terra-")) return "terreno";
  return BUILDINGS[tool as BuildingType]?.category ?? null;
}

export function Hud() {
  const city = useGame((s) => s.city);
  const phase = useGame((s) => s.phase);
  const toast = useGame((s) => s.toast);
  const [hover, setHover] = useState<{ x: number; y: number } | null>(null);

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
    const people = citizensView(city);
    const water = computeWater(city, undefined, status);
    const traffic = computeTraffic(city);
    const services = computeServices(city, status, traffic);
    return {
      services,
      traffic,
      power,
      status,
      labor,
      people,
      water,
      demand: computeDemand(city, labor, moodSummary(people).approval, services, traffic),
      access: roadAccess(city),
      weather: weatherAt(city),
    };
  }, [city]);

  if (!city || !derived) {
    return <div className="absolute inset-0 grid place-items-center text-sm">Carregando a cidade…</div>;
  }

  const { power, status, labor, demand, access, weather, people, water, services, traffic } = derived;
  const region = city.regionId ? REGION_BY_ID[city.regionId] : null;

  return (
    <div className="pointer-events-none absolute inset-0 flex flex-col gap-2 p-2 text-xs">
      {/* Barra superior: só o essencial; o resto fica nos ícones à direita. */}
      <div className="retro-panel pointer-events-auto flex flex-wrap items-center gap-x-3 gap-y-1 px-2 py-1">
        <strong className="flex items-center gap-1 tracking-widest text-amber-300" title="POMO-CITY">
          <Logo size={20} /> {cityDisplayName(city)}
        </strong>
        <span title={`${region ? `${region.name} · ` : ""}${BIOMES[city.biome].name} · 1 ciclo de foco = 1 estação`}>
          <Calendar /> {weather ? `${weather.season} · ` : ""}
          {cityPeriodLabel(city)}
        </span>
        {weather && <WeatherChip weather={weather} focus={phase === "focus"} />}
        <span title="Caixa da prefeitura">
          <Coins /> ${city.money}
        </span>
        <ResourcesButton />
        <span title={`Moradores / moradia · ${labor.publicFilled + labor.zoneFilled}/${labor.totalJobs} empregos ocupados${labor.unemployed ? ` · ${labor.unemployed} sem emprego` : ""}`}>
          <Group /> {city.population}/{labor.housing}
          {labor.unemployed > 0 && <span className="text-amber-300"> ({labor.unemployed} s/ emprego)</span>}
        </span>
        <PowerMeter used={power.supplied} demand={power.demand} capacity={power.capacity} />
        <span
          title={`Água: consumo ${water.demand} · produção ${water.produced}${water.stored ? ` + ${water.stored} nas caixas d'água` : ""}`}
          className={water.shortage ? "text-red-300" : ""}
        >
          <Droplet /> {water.supplied}/{Math.round(water.produced + water.stored)}
          {water.shortage && " — falta!"}
        </span>
        <span
          title={`Educação (QE ${Math.round(city.eq)}/150): escolas levam até 90, faculdades até 140.\nExpectativa de vida: ${Math.round(city.lifeExpectancy)} anos (hospitais).\nCrime médio ${Math.round(services.avg.crime)} · poluição ${Math.round(services.avg.pollution)} · valor do solo ${Math.round(services.avg.landValue)}`}
        >
          <GraduationCap /> {Math.round(city.eq)} · <Heart /> {Math.round(city.lifeExpectancy)}a
        </span>
        <DemandIndicator demand={demand} />
        <span className="ml-auto flex items-center gap-1">
          <CitizensButton />
          <MarketButton />
          <BudgetButton />
          <MusicButton />
          <DonateButton />
          <GameMenu />
        </span>
      </div>

      <div className="flex min-h-0 flex-1 items-start justify-between gap-2">
        <Toolbar locked={phase === "focus"} />
        {hover && (
          <div className="retro-panel pointer-events-auto w-56 p-2">
            <TileInfo x={hover.x} y={hover.y} status={status} powered={power.powered} access={access} people={people} watered={water.watered} services={services} traffic={traffic} />
          </div>
        )}
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
  people,
  watered,
  services,
  traffic,
}: {
  x: number;
  y: number;
  status: ReturnType<typeof buildingStatus>;
  powered: Uint8Array;
  access: Int32Array;
  people: ReturnType<typeof citizensView>;
  watered: Uint8Array;
  services: ReturnType<typeof computeServices>;
  traffic: ReturnType<typeof computeTraffic>;
}) {
  const city = useGame((s) => s.city)!;
  const i = y * city.width + x;
  const b = buildingAt(city, x, y);
  const zone = city.zoneType[i];
  if (!b && !zone && !city.wires[i] && !city.pipes[i] && !city.trees?.[i] && !city.elevation?.[i] && !city.terrain[i]) return null;

  return (
    <div className="space-y-0.5">
      {city.terrain[i] !== 0 && !b && <strong>{city.terrain[i] === 2 ? (
            <>
              <SeaWaves /> Mar (água salgada)
            </>
          ) : (
            <>
              <Droplet /> Água doce
            </>
          )}</strong>}
      {b ? (
        <>
          <strong>{BUILDINGS[b.type].name}</strong>
          <p className="text-zinc-400">{BUILDINGS[b.type].description}</p>
          {(() => {
            const st = status.get(b.id);
            if (!st) return null;
            return (
              <>
                {b.damaged && (
                  <div className="space-y-1">
                    <p className="text-red-300">🔧 Danificada por desastre: parada até o reparo.</p>
                    <button
                      type="button"
                      className="retro-button retro-button-primary w-full"
                      onClick={() => useGame.getState().queue({ type: "repair", x: b.x, y: b.y })}
                    >
                      Reparar (${repairCost(b.type)})
                    </button>
                  </div>
                )}
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
      {(city.elevation?.[i] ?? 0) > 0 && <p className="text-zinc-400">⛰️ Altitude {city.elevation[i]}</p>}
      {city.trees?.[i] === 1 && !b && <p className="text-emerald-300">🌳 Árvore (demolir rende 1 🪵)</p>}
      {city.wires[i] === 1 && <p className="text-zinc-400">Linha de transmissão</p>}
      {city.pipes[i] === 1 && <p className="text-zinc-400">Cano no subsolo</p>}
      {(b ? !BUILDINGS[b.type].linear && b.type !== "onramp" : city.zoneLevel[i] > 0) && (
        <p className={watered[i] ? "text-sky-300" : "text-zinc-500"}>{watered[i] ? (
            <>
              <Droplet /> Com água
            </>
          ) : (
            "Sem água encanada"
          )}</p>
      )}
      {(b ? !BUILDINGS[b.type].linear && b.type !== "onramp" : city.zoneLevel[i] > 0) && (
        <p className="text-zinc-300">
          <span className={services.crime[i] > 45 ? "text-red-300" : ""}>🚨 {Math.round(services.crime[i])}</span> ·{" "}
          <span className={services.pollution[i] > 40 ? "text-amber-300" : ""}>🏭 {Math.round(services.pollution[i])}</span> · 💎{" "}
          {Math.round(services.landValue[i])}
          {zone === 1 && city.zoneLevel[i] > 0 && <span className="text-zinc-400"> ({WEALTH_NAMES[wealthOf(services.landValue[i])]})</span>}
        </p>
      )}
      {traffic.capacity[i] > 0 && (
        <p className={traffic.congested[i] ? "text-red-300" : "text-zinc-300"}>
          🚗 Trânsito {Math.round(traffic.load[i])}/{traffic.capacity[i]}
          {traffic.congested[i] ? " — congestionado!" : ""}
        </p>
      )}
      {zone === 1 && city.zoneLevel[i] > 0 && traffic.failed[i] === 1 && (
        <p className="text-amber-300">Moradores não acham emprego a tempo (máx. {MAX_TRIP} quadras)</p>
      )}
      {b?.type === "water_tower" && <p className="text-sky-300">Caixa d'água: {Math.round(b.water ?? 0)}/60</p>}
      <PeopleHere label="Moradores" list={people.filter((p) => p.home?.x === x && p.home?.y === y)} />
      <PeopleHere label="Trabalham aqui" list={people.filter((p) => p.job?.x === x && p.job?.y === y)} />
    </div>
  );
}

function ZoneTools({ disabled, population, onPicked }: { disabled: boolean; population: number; onPicked?: () => void }) {
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
      <div className="grid grid-cols-1 gap-1">
        {(ZONE_KINDS as ZoneKind[]).map((z) => (
          <ToolButton
            key={z}
            tool={`zone-${z}-${density}`}
            disabled={disabled}
            label={`${ZONES[z].name}`}
            cost={ZONES[z].cost[density === "dense" ? 1 : 0]}
            costSuffix="/tile"
            color={ZONES[z].color}
            onPicked={onPicked}
          />
        ))}
        <ToolButton tool="zone-none-light" disabled={disabled} label="Remover zona" onPicked={onPicked} />
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
  onPicked,
  title: customTitle,
  materials: customMaterials,
}: {
  onPicked?: () => void;
  tool: Tool;
  disabled: boolean;
  label: string;
  cost?: number;
  costSuffix?: string;
  color?: number;
  lock?: string | null;
  title?: string;
  materials?: MaterialCost[];
}) {
  const selected = useGame((s) => s.tool === tool);
  const setTool = useGame((s) => s.setTool);
  const city = useGame((s) => s.city);
  const def = tool && tool in BUILDINGS ? BUILDINGS[tool as BuildingType] : null;
  // Custo em recursos (Fase 9): o que a obra gasta do estoque; o que faltar vira importação.
  const materials = customMaterials ?? def?.materials ?? [];
  const quote = city && materials.length ? quoteMaterials(city, materials) : null;
  const chips = materials.map((m) => {
    const have = city ? equivalentAvailable(city.inventory, m.resource, m.minRank) : 0;
    return { ...m, have, short: have < m.qty };
  });
  const mats = chips.length
    ? "\n\nRecursos por obra:\n" +
      chips
        .map(
          (m) =>
            `${RESOURCES[m.resource].icon} ${m.qty} ${RESOURCE_NAMES[m.resource]}${m.minRank && m.minRank !== "D" ? ` ${m.minRank}+` : ""} — tem ${m.have}${m.short ? ` (faltam ${m.qty - m.have})` : ""}`,
        )
        .join("\n") +
      (quote?.importCost ? `\nO que falta será importado por $${quote.importCost}.` : "\nTudo sai do estoque da cidade.")
    : "";
  const title = lock
    ? lock
    : def
      ? `${def.description}\nCusto $${def.cost} + recursos · manutenção $${def.upkeep}/ciclo${def.linear ? " · sobre a água vira ponte (4× $, 2× recursos)" : ""}${mats}`
      : `${customTitle ?? label}${mats}`;
  return (
    <button
      type="button"
      disabled={disabled}
      title={title}
      onClick={() => {
        setTool(tool);
        onPicked?.();
      }}
      className={`retro-button flex w-full items-center gap-1 ${selected ? "retro-button-active" : ""}`}
    >
      {color !== undefined && <span className="inline-block h-2 w-2 shrink-0" style={{ background: hex(color) }} />}
      <span className="flex min-w-0 flex-1 flex-col text-left">
        <span className="truncate">{lock ? `🔒 ${label}` : label}</span>
        {chips.length > 0 && (
          <span className="flex flex-wrap gap-x-1.5 text-[10px] leading-tight">
            {chips.map((m) => (
              <span key={m.resource} className={m.short ? "text-red-300" : "text-emerald-300"}>
                <ResourceIcon res={m.resource} colored={false} />
                {m.qty}
              </span>
            ))}
            {quote && quote.importCost > 0 && <span className="text-amber-300">+${quote.importCost} import.</span>}
          </span>
        )}
      </span>
      {cost !== undefined && (
        <span className="text-zinc-400">
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
  const options: { id: Overlay; label: ReactNode }[] = [
    { id: "none", label: "Normal" },
    { id: "power", label: <><Flash /> Energia</> },
    { id: "zones", label: "Zonas" },
    { id: "water", label: <><Droplet /> Água</> },
    { id: "crime", label: <><ShieldAlert /> Crime</> },
    { id: "pollution", label: <><Industry /> Poluição</> },
    { id: "landValue", label: <><HomeSale /> Valor</> },
    { id: "coverage", label: <><Shield /> Cobertura</> },
    { id: "traffic", label: <><Car /> Trânsito</> },
  ];
  return (
    <div>
      <h3 className="mb-1 text-[10px] uppercase tracking-wider text-zinc-400">Visualizar</h3>
      <div className="grid grid-cols-2 gap-1">
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
      <Flash /> {used}/{capacity} MW{short && " — apagão!"}
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

/** Retratos de quem mora ou trabalha no tile sob o cursor. */
function PeopleHere({ label, list }: { label: string; list: ReturnType<typeof citizensView> }) {
  if (!list.length) return null;
  return (
    <div>
      <p className="text-zinc-400">
        {label} ({list.length})
      </p>
      <div className="flex flex-wrap gap-1">
        {list.slice(0, 8).map((p) => (
          <span key={p.id} title={`${p.name} — ${p.job?.title ?? "sem emprego"} — ${MOOD_ICON[p.mood]}`}>
            <Portrait citizen={p} scale={1} />
          </span>
        ))}
        {list.length > 8 && <span className="self-center text-zinc-400">+{list.length - 8}</span>}
      </div>
    </div>
  );
}

/** Barra de ícones: cada categoria abre um mini-menu só quando clicada. */
function Toolbar({ locked }: { locked: boolean }) {
  const city = useGame((s) => s.city)!;
  const tool = useGame((s) => s.tool);
  const setTool = useGame((s) => s.setTool);
  const [open, setOpen] = useState<CategoryId | null>(null);
  const activeCat = categoryOf(tool);
  const close = () => setOpen(null);

  const iconBtn = (key: string, icon: ReactNode, title: string, active: boolean, onClick: () => void, disabled = false) => (
    <button
      key={key}
      type="button"
      title={title}
      aria-label={title}
      disabled={disabled}
      onClick={onClick}
      className={`retro-button grid h-9 w-9 place-items-center p-0 text-base ${active ? "retro-button-active" : ""}`}
    >
      {icon}
    </button>
  );

  return (
    <div className="pointer-events-auto relative flex items-start gap-1">
      <nav className="retro-panel flex flex-col gap-1 p-1" aria-label="Ferramentas">
        {iconBtn("pan", <DragHandGesture />, "Mover a câmera (arrastar)", tool === "pan", () => setTool("pan"))}
        {CATEGORIES.map((c) =>
          iconBtn(c.id, c.icon, c.title, open === c.id || (c.id !== "view" && activeCat === c.id), () => setOpen(open === c.id ? null : c.id), locked && c.id !== "view"),
        )}
        {iconBtn("demolish", <Trash />, "Demolir", tool === "demolish", () => setTool("demolish"), locked)}
      </nav>
      {open && (
        <section className="retro-panel w-56">
          <header className="retro-title flex">
            {CATEGORIES.find((c) => c.id === open)!.title}
            <button type="button" className="ml-auto" aria-label="Fechar" onClick={close}>
              <Xmark />
            </button>
          </header>
          <div className="max-h-[60dvh] space-y-1 overflow-y-auto p-2">
            {open === "vias" && (
              <>
                <ToolButton tool="road" disabled={locked} label={BUILDINGS.road.name} cost={BUILDINGS.road.cost} color={BUILDINGS.road.color} onPicked={close} />
                <ToolButton tool="wire" disabled={locked} label="Linha de transmissão" cost={WIRE_COST} color={0x3a2a1a} onPicked={close} />
              </>
            )}
            {open === "zonas" && <ZoneTools disabled={locked} population={city.population} onPicked={close} />}
            {open === "water" && (
              <ToolButton tool="pipe" disabled={locked} label="Cano (subsolo)" cost={PIPE_COST} color={0x4a7ab0} onPicked={close} />
            )}
            {open === "view" && <OverlayPicker />}
            {open === "terreno" && (
              <>
                <p className="text-[11px] text-zinc-400">Arraste para aplicar. Fica mais barato com foco de Rank alto (até −40% no S).</p>
                {(Object.keys(TERRAFORM) as TerraformAction[]).map((a) => (
                  <ToolButton
                    key={a}
                    tool={`terra-${a}`}
                    disabled={locked}
                    label={TERRAFORM[a].name}
                    cost={terraformCost(city, a)}
                    title={TERRAFORM[a].description}
                    materials={TERRAFORM[a].wood ? [{ resource: "wood", qty: TERRAFORM[a].wood! }] : undefined}
                    onPicked={close}
                  />
                ))}
              </>
            )}
            {open !== "vias" &&
              open !== "zonas" &&
              open !== "view" &&
              open !== "terreno" &&
              (Object.keys(BUILDINGS) as BuildingType[])
                .filter((t) => BUILDINGS[t].buildable && BUILDINGS[t].category === open)
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
                      onPicked={close}
                    />
                  );
                })}
          </div>
        </section>
      )}
    </div>
  );
}


/** Clima compacto na barra; clique abre a previsão completa. */
function WeatherChip({ weather, focus }: { weather: NonNullable<ReturnType<typeof weatherAt>>; focus: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="relative">
      <button type="button" className="retro-button px-1" onClick={() => setOpen((v) => !v)} title="Previsão da estação">
        <WeatherIcon weather={weather} /> {Math.round(weather.temp)}°C
      </button>
      {open && (
        <div className="absolute left-0 top-full z-10 mt-1 w-60">
          <WeatherPanel weather={weather} focus={focus} />
        </div>
      )}
    </span>
  );
}
