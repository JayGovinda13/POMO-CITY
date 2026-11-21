"use client";

import { useMemo, useState } from "react";
import {
  HOURS_OPTIONS,
  PAY_NAMES,
  SECTOR_IDS,
  SECTORS,
  buildingStatus,
  cityFatigue,
  displacedJobs,
  educationRelief,
  inspected,
  schoolFactory,
  laborMood,
  laborStats,
  outputFactor,
  rulesOf,
  sectorWorkers,
  techMods,
  type Hours,
  type Pay,
  type Sector,
} from "@/sim";
import { useGame } from "@/store/game";
import { Hammer, Xmark } from "./icons";

/** Botão "Trabalho" na barra superior. */
export function LaborButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="retro-button" onClick={() => setOpen(true)} title="Trabalho: jornada, salário e automação" aria-label="Trabalho">
        <Hammer />
      </button>
      {open && <LaborModal onClose={() => setOpen(false)} />}
    </>
  );
}

const pct = (v: number) => `${v >= 1 ? "+" : "−"}${Math.abs(Math.round((v - 1) * 100))}%`;

function LaborModal({ onClose }: { onClose: () => void }) {
  const city = useGame((s) => s.city);
  const phase = useGame((s) => s.phase);
  const status = useMemo(() => (city ? buildingStatus(city) : null), [city]);
  if (!city || !status) return null;
  const locked = phase === "focus";
  const workers = sectorWorkers(city, status);
  const labor = laborStats(city, status);
  const fatigue = cityFatigue(city, status);
  const displaced = displacedJobs(city);
  const relief = educationRelief(city);
  const automation = techMods(city).automation;
  const set = (sector: Sector, patch: { hours?: Hours; pay?: Pay }) => useGame.getState().queue({ type: "labor", sector, ...patch });

  return (
    <div className="pointer-events-auto fixed inset-0 z-10 flex items-center justify-center bg-black/60 p-3">
      <section className="retro-panel flex max-h-[90dvh] w-full max-w-2xl flex-col text-xs">
        <header className="retro-title flex">
          Trabalho — jornada, salário e máquinas
          <button type="button" className="ml-auto" aria-label="Fechar" onClick={onClose}>
            <Xmark />
          </button>
        </header>
        <div className="min-h-0 space-y-3 overflow-y-auto p-3">
          <p className="text-zinc-400">
            Jornada longa e pagamento por peça aumentam a produção, mas cansam os trabalhadores: o humor cai, a vida média diminui e a greve fica mais provável.
            {locked && <span className="text-red-300"> Em foco: as mudanças só valem na pausa.</span>}
          </p>

          {SECTOR_IDS.map((sector) => {
            const r = rulesOf(city, sector);
            const mood = laborMood(city, sector).reduce((a, m) => a + m.delta, 0);
            return (
              <div key={sector} className="space-y-1 border border-zinc-700 p-2">
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <strong>{SECTORS[sector].name}</strong>
                  <span className="text-zinc-400">{SECTORS[sector].description}</span>
                  <span className="ml-auto tabular-nums text-zinc-300">{workers[sector]} trabalhadores</span>
                </div>
                <div className="flex flex-wrap items-center gap-1">
                  <span className="w-16 text-zinc-400">Jornada</span>
                  {HOURS_OPTIONS.map((h) => (
                    <button
                      key={h}
                      type="button"
                      className={`retro-button ${r.hours === h ? "retro-button-active" : ""}`}
                      disabled={locked}
                      onClick={() => set(sector, { hours: h })}
                      aria-pressed={r.hours === h}
                    >
                      {h} h
                    </button>
                  ))}
                </div>
                <div className="flex flex-wrap items-center gap-1">
                  <span className="w-16 text-zinc-400">Salário</span>
                  {(Object.keys(PAY_NAMES) as Pay[]).map((p) => (
                    <button
                      key={p}
                      type="button"
                      className={`retro-button ${r.pay === p ? "retro-button-active" : ""}`}
                      disabled={locked}
                      onClick={() => set(sector, { pay: p })}
                      aria-pressed={r.pay === p}
                    >
                      {PAY_NAMES[p]}
                    </button>
                  ))}
                </div>
                <p>
                  Produção <strong className={outputFactor(city, sector) >= 1 ? "text-emerald-300" : "text-amber-300"}>{pct(outputFactor(city, sector))}</strong> · humor dos
                  trabalhadores{" "}
                  <strong className={mood < 0 ? "text-red-300" : mood > 0 ? "text-emerald-300" : ""}>{mood > 0 ? `+${mood}` : mood}</strong>
                </p>
              </div>
            );
          })}

          <div className="space-y-1 border border-zinc-700 p-2">
            <strong>Fiscalização e escola-fábrica</strong>
            <p className={inspected(city) ? "text-emerald-300" : "text-zinc-400"}>
              {inspected(city)
                ? "Fiscais de fábrica ativos: humor e desgaste dos trabalhadores pela metade, mas o ganho de produção acima de 8 h também cai pela metade."
                : "Sem fiscalização. Construa a Fiscalização do Trabalho (Serviços, a partir de 60 moradores) para proteger os trabalhadores."}
            </p>
            <p className={schoolFactory(city) ? "text-emerald-300" : "text-zinc-400"}>
              {schoolFactory(city)
                ? "Escola-fábrica em vigor: QE alvo +10, mais gente realocada da automação, fábricas −8% de produção."
                : "Decreto Escola-fábrica (Orçamento → Decretos): sobe o QE e ajuda a absorver o desemprego da automação, ao custo de 8% da produção das fábricas."}
            </p>
          </div>

          <div className="space-y-1 border border-zinc-700 p-2">
            <strong>Desgaste da cidade</strong>
            <div className="h-2 bg-zinc-800">
              <div className={`h-2 ${fatigue > 0.5 ? "bg-red-400" : fatigue > 0.2 ? "bg-amber-400" : "bg-emerald-400"}`} style={{ width: `${Math.round(fatigue * 100)}%` }} />
            </div>
            <p className="text-zinc-400">
              {fatigue <= 0
                ? "Ninguém está sobrecarregado."
                : `Exaustão de ${Math.round(fatigue * 100)}%: a expectativa de vida cai até ${(fatigue * 6).toFixed(1)} anos e a greve fica mais provável.`}
            </p>
          </div>

          <div className="space-y-1 border border-zinc-700 p-2">
            <strong>Máquinas e empregos</strong>
            <p>
              Automação das tecnologias: <strong>{Math.round(automation * 100)}%</strong> dos empregos industriais. A educação da cidade realoca{" "}
              <strong>{Math.round(relief * 100)}%</strong> desse efeito.
            </p>
            <p>
              Empregos industriais eliminados: <strong className={displaced > 0 ? "text-amber-300" : ""}>{Math.round(displaced * 100)}%</strong> · desempregados agora:{" "}
              <strong className={labor.unemployed > 0 ? "text-amber-300" : ""}>{labor.unemployed}</strong>
            </p>
            <p className="text-zinc-400">As máquinas mantêm a produção com menos operários. Escolas e faculdades ajudam a cidade a absorver quem perde o emprego.</p>
          </div>
        </div>
      </section>
    </div>
  );
}
