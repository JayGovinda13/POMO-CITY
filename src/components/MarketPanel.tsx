"use client";

import { useMemo, useState } from "react";
import {
  MARKET_MAX_RANK,
  POLICY_LABELS,
  RANKS,
  RESOURCES,
  RESOURCE_IDS,
  currentEffects,
  exportPrice,
  getQty,
  importPrice,
  tradeDiscount,
  ECO,
  ecoForecast,
  ecoState,
  stockOf,
  storageCapacity,
  validatePolicy,
  type PolicyMode,
  type ResourceId,
} from "@/sim";
import { useGame } from "@/store/game";
import { RankBadge } from "./ranks";
import { Shop, Xmark } from "./icons";

/** Botão "Mercado" na barra superior. */
export function MarketButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="retro-button" onClick={() => setOpen(true)} title="Mercado e estoque" aria-label="Mercado e estoque">
        <Shop />
      </button>
      {open && <MarketModal onClose={() => setOpen(false)} />}
    </>
  );
}

function MarketModal({ onClose }: { onClose: () => void }) {
  const city = useGame((s) => s.city);
  const phase = useGame((s) => s.phase);
  const effects = useMemo(() => (city ? currentEffects(city) : null), [city]);
  if (!city || !effects) return null;
  const capacity = storageCapacity(city);

  return (
    <div className="pointer-events-auto fixed inset-0 z-10 flex items-center justify-center bg-black/60 p-3">
      <section className="retro-panel flex max-h-[90dvh] w-full max-w-3xl flex-col text-xs">
        <header className="retro-title flex">
          Mercado e estoque
          <button type="button" className="ml-auto" aria-label="Fechar" onClick={onClose}>
            <Xmark />
          </button>
        </header>
        <div className="space-y-2 overflow-y-auto p-3">
          <p className="text-zinc-400">
            O que faltar para os moradores e para as obras é <strong>comprado automaticamente</strong>. Produzir na cidade sai
            mais barato. O mercado externo só negocia até o Rank {MARKET_MAX_RANK}: recursos A e S nunca são vendidos a ele
            pela política; eles valem mais no consumo e nas obras (A rende 1,3×, S 1,4×).
          </p>
          <div className="rounded border border-zinc-600 p-2">
            <p>
              Ciclo econômico: <strong className={ecoState(city).phase === "crise" ? "text-red-300" : ecoState(city).phase === "prosperidade" ? "text-emerald-300" : ""}>{ECO[ecoState(city).phase].name}</strong>{" "}
              <span className="text-zinc-400">(mais {ecoState(city).left} ciclo(s))</span>
            </p>
            <p className="text-zinc-400">{ECO[ecoState(city).phase].description}</p>
            <p className="text-zinc-500">
              Próximas fases: {ecoForecast(city).map((f) => `${ECO[f.phase].name} em ${f.startsIn} ciclos`).join(" → ")}. Tábuas, metal e bens valem {Math.round(ECO[ecoState(city).phase].price * 100)}% do preço normal; títulos emitidos em tempos bons saem mais baratos.
            </p>
          </div>
          <div className="overflow-x-auto">
            <p className="mb-1 text-zinc-400">
              Frete: <strong className={tradeDiscount(city) > 0 ? "text-emerald-300" : ""}>{Math.round(tradeDiscount(city) * 100)}%</strong> mais barato para importar e{" "}
              {Math.round((tradeDiscount(city) / 2) * 100)}% a mais ao vender. Porto, aeroporto, estações de trem e rodovias baixam o custo do comércio (máx. 30%).
              Estoque acima de $300 paga 1% por ciclo para ficar guardado.
            </p>
            <p className="mb-1 text-[10px] text-zinc-500 sm:hidden">← deslize a tabela para o lado →</p>
            <table className="w-full min-w-[40rem] border-collapse text-left [&_td]:pr-3 [&_th]:pr-3">
              <thead className="text-zinc-400">
                <tr>
                  <th className="py-1 font-normal">Recurso</th>
                  <th className="font-normal">Estoque</th>
                  <th className="font-normal">Compra (D)</th>
                  <th className="font-normal">Venda (D → {MARKET_MAX_RANK})</th>
                  <th className="font-normal">Excedente</th>
                </tr>
              </thead>
              <tbody>
                {RESOURCE_IDS.map((res) => (
                  <tr key={res} className="border-t border-zinc-700">
                    <td className="py-1">{RESOURCES[res].name}</td>
                    <td>
                      <span className={stockOf(city.inventory, res) >= capacity[res] ? "text-amber-300" : ""}>
                        {stockOf(city.inventory, res)}/{capacity[res]}
                      </span>
                      <RankList entries={RANKS.filter((r) => getQty(city.inventory, res, r) > 0).map((r) => [r, getQty(city.inventory, res, r)])} />
                    </td>
                    <td>${importPrice(res, "D", effects).toFixed(2)}</td>
                    <td>
                      ${exportPrice(res, "D", effects).toFixed(2)} → ${exportPrice(res, MARKET_MAX_RANK, effects).toFixed(2)}
                    </td>
                    <td>
                      <PolicyEditor resource={res} disabled={phase === "focus"} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-zinc-500">
            A venda acontece no fim de cada ciclo. "Excedente" = o que passar do consumo da última estação. Quando o estoque
            passa da capacidade, o excesso é vendido. Armazéns e silos ampliam a capacidade.
          </p>
          {phase === "focus" && <p className="text-red-300">Em foco: as políticas só mudam na pausa.</p>}
        </div>
      </section>
    </div>
  );
}

function PolicyEditor({ resource, disabled }: { resource: ResourceId; disabled: boolean }) {
  const policy = useGame((s) => s.city?.policies[resource]);
  const [mode, setMode] = useState<PolicyMode>(policy?.mode ?? "stock");
  const [value, setValue] = useState<number>(policy?.value ?? 0);
  if (!policy) return null;
  const dirty = mode !== policy.mode || value !== policy.value;
  const error = validatePolicy({ mode, value });

  return (
    <span className="flex flex-wrap items-center gap-1">
      <select
        className="border-2 border-zinc-600 bg-zinc-900 px-1"
        value={mode}
        disabled={disabled}
        onChange={(e) => {
          const m = e.target.value as PolicyMode;
          setMode(m);
          setValue(m === "sell_percent" ? 50 : m === "reserve" ? 2 : 0);
        }}
      >
        {(Object.keys(POLICY_LABELS) as PolicyMode[]).map((m) => (
          <option key={m} value={m}>
            {POLICY_LABELS[m]}
          </option>
        ))}
      </select>
      {(mode === "sell_percent" || mode === "reserve") && (
        <label className="flex items-center gap-1">
          <input
            type="number"
            className="w-14 border-2 border-zinc-600 bg-zinc-900 px-1"
            value={value}
            min={mode === "reserve" ? 1 : 0}
            max={mode === "reserve" ? 8 : 100}
            disabled={disabled}
            onChange={(e) => setValue(Number(e.target.value))}
          />
          {mode === "reserve" ? "estações" : "%"}
        </label>
      )}
      {dirty && (
        <button
          type="button"
          className="retro-button retro-button-primary"
          disabled={disabled || !!error}
          title={error ?? "Aplicar (sincroniza no próximo ciclo)"}
          onClick={() => useGame.getState().queue({ type: "policy", resource, mode, value })}
        >
          Aplicar
        </button>
      )}
    </span>
  );
}

/** Lista curta de quantidades por Rank (para o relatório). */
export function RankList({ entries }: { entries: [string, number][] }) {
  return (
    <span className="inline-flex flex-wrap gap-1">
      {entries.map(([rank, q]) => (
        <span key={rank} className="inline-flex items-center gap-0.5">
          <RankBadge rank={rank as (typeof RANKS)[number]} />
          {q}
        </span>
      ))}
    </span>
  );
}
