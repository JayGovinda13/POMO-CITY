"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  BIOMES,
  BUILDINGS,
  FOOD_PER_RESIDENT,
  GOODS_MIN_POPULATION,
  GOODS_PER_INDUSTRY_JOB,
  GOODS_PER_RESIDENT,
  HEATING_WOOD_PER_RESIDENT,
  RANKS,
  RESOURCES,
  RESOURCE_IDS,
  BASE_PRICE,
  buildingStatus,
  computePower,
  currentEffects,
  getQty,
  importPrice,
  laborStats,
  stockOf,
  storageCapacity,
  weatherAt,
  type CityState,
  type ResourceId,
} from "@/sim";
import { useGame } from "@/store/game";
import { Packages } from "./icons";

export interface ResourceOutlook {
  res: ResourceId;
  stock: number;
  capacity: number;
  /** Produção estimada por estação (com os trabalhadores e a energia de agora). */
  produces: number;
  /** Consumo estimado por estação. */
  needs: number;
  net: number;
  /** Estações até acabar (Infinity = não acaba). */
  lasts: number;
  /** Preço de importação por unidade agora (sobe com o clima ruim). */
  importUnit: number;
  /** Quanto custa por estação comprar o que falta. */
  deficitCost: number;
  /** Valor do estoque a preço de mercado. */
  value: number;
}

/**
 * Previsão de cada recurso para a próxima estação: o que a cidade produz e consome com o que tem
 * hoje. Serve para o jogador sentir o valor dos recursos e o custo de não produzir numa crise.
 */
export function resourceOutlook(s: CityState): ResourceOutlook[] {
  const effects = currentEffects(s);
  const power = computePower(s, undefined, effects);
  const status = buildingStatus(s, power.powered);
  const biome = BIOMES[s.biome];
  const cap = storageCapacity(s);
  const weather = weatherAt(s);
  const produces: Record<ResourceId, number> = { food: 0, wood: 0, ore: 0, planks: 0, metal: 0, goods: 0 };
  const needs: Record<ResourceId, number> = { food: 0, wood: 0, ore: 0, planks: 0, metal: 0, goods: 0 };

  for (const b of s.buildings) {
    const def = BUILDINGS[b.type];
    const eff = status.get(b.id)?.efficiency ?? 0;
    if (def.produces && eff > 0) {
      const climate = def.produces.resource === "food" ? effects.farm : 1;
      produces[def.produces.resource] += def.produces.base * biome.yield[def.produces.resource] * eff * climate;
    }
    if (def.processes && eff > 0) {
      const inQty = Math.max(1, Math.floor(def.processes.inputQty * eff));
      needs[def.processes.input] += inQty;
      produces[def.processes.output] += (def.processes.outputQty * inQty) / def.processes.inputQty;
    }
    if (def.generates?.fuel && eff > 0) needs[def.generates.fuel.resource] += def.generates.fuel.qty;
  }
  const labor = laborStats(s, status);
  produces.goods += Math.max(0, labor.zoneFilled - labor.commercialJobs) * GOODS_PER_INDUSTRY_JOB;
  const pop = s.population;
  needs.food += pop * FOOD_PER_RESIDENT;
  if (pop >= GOODS_MIN_POPULATION) needs.goods += pop * GOODS_PER_RESIDENT;
  if (weather && weather.temp < 10) needs.wood += pop * HEATING_WOOD_PER_RESIDENT;

  return RESOURCE_IDS.map((res) => {
    const stock = stockOf(s.inventory, res);
    const p = Math.round(produces[res] * 10) / 10;
    const n = Math.round(needs[res] * 10) / 10;
    const net = Math.round((p - n) * 10) / 10;
    const importUnit = importPrice(res, "D", effects);
    return {
      res,
      stock,
      capacity: cap[res],
      produces: p,
      needs: n,
      net,
      lasts: net >= 0 ? Infinity : stock / -net,
      importUnit,
      deficitCost: net < 0 ? Math.ceil(Math.max(0, -net - 0) * importUnit) : 0,
      value: Math.round(stock * BASE_PRICE[res]),
    };
  });
}

const fmt = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(1));
const lastsLabel = (o: ResourceOutlook) => (o.lasts === Infinity ? "—" : o.lasts < 1 ? "acaba já" : `${Math.floor(o.lasts)} est.`);
const tone = (o: ResourceOutlook) => (o.net < 0 && o.lasts < 1 ? "text-red-300" : o.net < 0 && o.lasts < 3 ? "text-amber-300" : "");

/** Ícone 📦 na barra superior: estoque de cada recurso e, ao clicar, a previsão completa. */
export function ResourcesButton() {
  const city = useGame((s) => s.city);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const outlook = useMemo(() => (city ? resourceOutlook(city) : []), [city]);

  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("pointerdown", close);
    return () => window.removeEventListener("pointerdown", close);
  }, [open]);

  if (!city) return null;
  const weather = weatherAt(city);
  const effects = currentEffects(city);
  const crisis = outlook.filter((o) => o.net < 0);
  const totalDeficit = crisis.reduce((a, o) => a + o.deficitCost, 0);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        className="retro-button flex items-center gap-1.5"
        onClick={() => setOpen((o) => !o)}
        aria-label="Recursos"
        title="Estoque de recursos (clique para a previsão da estação)"
      >
        <Packages />
        {outlook.map((o) => (
          <span key={o.res} className={tone(o)} title={`${RESOURCES[o.res].name}: ${o.stock}/${o.capacity}`}>
            {RESOURCES[o.res].icon}
            {o.stock}
          </span>
        ))}
      </button>
      {open && (
        <div className="retro-panel absolute left-0 top-full z-50 mt-1 w-[min(92vw,34rem)] space-y-2 p-2 text-xs">
          <h3 className="text-[10px] uppercase tracking-wider text-zinc-400">Recursos — previsão da próxima estação</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-right">
              <thead className="text-zinc-400">
                <tr>
                  <th className="text-left font-normal">Recurso</th>
                  <th className="font-normal">Estoque</th>
                  <th className="font-normal" title="Produção estimada com os trabalhadores e a energia de agora">Produz</th>
                  <th className="font-normal" title="Consumo estimado: moradores, usinas e fábricas">Consome</th>
                  <th className="font-normal">Saldo</th>
                  <th className="font-normal" title="Quantas estações o estoque aguenta com esse saldo">Dura</th>
                  <th className="font-normal" title="Preço de compra no mercado externo agora (sobe com clima ruim)">Importar</th>
                </tr>
              </thead>
              <tbody>
                {outlook.map((o) => (
                  <tr key={o.res} className={tone(o)} title={RESOURCES[o.res].use}>
                    <td className="text-left">
                      {RESOURCES[o.res].icon} {RESOURCES[o.res].name}
                    </td>
                    <td>
                      {o.stock}
                      <span className="text-zinc-500">/{o.capacity}</span>
                    </td>
                    <td className="text-emerald-300">{o.produces ? `+${fmt(o.produces)}` : "0"}</td>
                    <td>{o.needs ? `−${fmt(o.needs)}` : "0"}</td>
                    <td>{o.net > 0 ? `+${fmt(o.net)}` : fmt(o.net)}</td>
                    <td>{lastsLabel(o)}</td>
                    <td>${o.importUnit}/un.</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-zinc-400">
            Qualidade em estoque:{" "}
            {outlook
              .filter((o) => o.stock > 0)
              .map((o) => `${RESOURCES[o.res].icon} ${RANKS.filter((r) => getQty(city.inventory, o.res, r) > 0).map((r) => `${r}×${getQty(city.inventory, o.res, r)}`).join(" ")}`)
              .join(" · ") || "vazio"}
          </p>
          {crisis.length > 0 ? (
            <div className="space-y-1 border-2 border-amber-700/60 bg-amber-950/30 p-2">
              <p className="text-amber-300">
                ⚠ A cidade consome mais do que produz em {crisis.map((o) => RESOURCES[o.res].name.toLowerCase()).join(", ")}. Quando o
                estoque acabar, a falta é comprada fora: cerca de <strong>${totalDeficit} por estação</strong>.
              </p>
              {crisis.map((o) => (
                <p key={o.res}>
                  {RESOURCES[o.res].icon} <strong>{RESOURCES[o.res].name}</strong>:{" "}
                  {o.lasts < 1 ? "o estoque não cobre esta estação" : `o estoque dura ~${Math.floor(o.lasts)} estação(ões)`}; faltam {fmt(-o.net)} por estação
                  (${o.deficitCost}).{" "}
                  {o.res === "food"
                    ? "Sem comida e sem dinheiro, vem a fome e os moradores vão embora."
                    : o.res === "goods"
                      ? "Sem bens, a cidade gasta caixa todo ciclo — indústria resolve."
                      : "Obras e fábricas vão comprar fora, mais caro que produzir aqui."}
                </p>
              ))}
            </div>
          ) : (
            <p className="text-emerald-300">✓ A cidade produz tudo o que consome nesta estação.</p>
          )}
          <p className="text-zinc-500">
            {weather
              ? `Clima agora: ${weather.label.toLowerCase()} — lavoura a ${Math.round(effects.farm * 100)}%. Em crise (seca, inverno), a produção cai e o preço de importação sobe: ter estoque e produção própria protege o caixa.`
              : "Ter estoque e produção própria protege o caixa nas crises."}{" "}
            Valor do estoque: ${outlook.reduce((a, o) => a + o.value, 0)}.
          </p>
        </div>
      )}
    </div>
  );
}
