"use client";

import { useState } from "react";
import {
  BUILDINGS,
  ERAS,
  rankForStreak,
  TECHS,
  TECH_IDS,
  cityYear,
  currentEra,
  hasTech,
  researchPerCycle,
  techLock,
  type CityState,
} from "@/sim";
import { useGame } from "@/store/game";
import { Atom, Check, Lock, Xmark } from "./icons";

/** Botão "Tecnologia" na barra superior. */
export function TechButton() {
  const [open, setOpen] = useState(false);
  const researching = useGame((s) => !!s.city?.research?.target);
  const idle = useGame((s) => !!s.city && !s.city.research?.target && TECH_IDS.some((id) => techLock(s.city!, id) === null));
  return (
    <>
      <button
        type="button"
        className={`retro-button ${idle ? "text-amber-300" : ""}`}
        onClick={() => setOpen(true)}
        title={researching ? "Tecnologia" : idle ? "Tecnologia — escolha o que pesquisar!" : "Tecnologia"}
        aria-label="Tecnologia"
      >
        <Atom />
      </button>
      {open && <TechModal onClose={() => setOpen(false)} />}
    </>
  );
}

function TechModal({ onClose }: { onClose: () => void }) {
  const city = useGame((s) => s.city);
  if (!city) return null;
  const year = cityYear(city);
  const era = currentEra(city);
  const target = city.research?.target ?? null;
  const progress = Math.floor(city.research?.progress ?? 0);
  const perCycle = researchPerCycle(city, rankForStreak(city.streak + 1));
  const t = target ? TECHS[target] : null;
  return (
    <div className="pointer-events-auto fixed inset-0 z-10 flex items-center justify-center bg-black/60 p-3">
      <section className="retro-panel flex max-h-[90dvh] w-full max-w-3xl flex-col text-xs">
        <header className="retro-title flex">
          Árvore tecnológica — {era.name} · ano {year}
          <button type="button" className="ml-auto" aria-label="Fechar" onClick={onClose}>
            <Xmark />
          </button>
        </header>
        <div className="space-y-1 border-b border-zinc-700 p-2">
          <p>
            Pesquisa: <strong className="text-amber-300">+{Math.round(perCycle)} pts</strong> por ciclo de foco (educação, escolas, faculdades,
            bibliotecas e museus; Rank alto rende mais) · {(city.techs ?? []).length}/{TECH_IDS.length} tecnologias
          </p>
          {t ? (
            <div>
              <div className="flex justify-between">
                <span>
                  Pesquisando: <strong>{t.name}</strong>
                </span>
                <span className="tabular-nums">
                  {Math.min(progress, t.cost)}/{t.cost} pts
                  {perCycle > 0 && progress < t.cost ? ` · ~${Math.ceil((t.cost - progress) / perCycle)} ciclos` : ""}
                </span>
              </div>
              <div className="h-2 bg-zinc-800">
                <div className="h-2 bg-amber-400" style={{ width: `${Math.min(100, (progress / t.cost) * 100)}%` }} />
              </div>
            </div>
          ) : (
            <p className="text-amber-300">
              Nenhuma pesquisa em andamento{progress > 0 ? ` — ${progress} pts guardados` : ""}. Escolha uma tecnologia disponível.
            </p>
          )}
        </div>
        <div className="min-h-0 space-y-3 overflow-y-auto p-2">
          {ERAS.map((e, i) => {
            const until = ERAS[i + 1]?.from;
            const ids = TECH_IDS.filter((id) => TECHS[id].era === e.id);
            return (
              <div key={e.id}>
                <h3 className={`mb-1 ${year >= e.from ? "text-amber-300" : "text-zinc-500"}`}>
                  {e.name} · {e.from}
                  {until ? `–${until - 1}` : "+"}
                </h3>
                <div className="grid grid-cols-1 gap-1 sm:grid-cols-2 md:grid-cols-3">
                  {ids.map((id) => (
                    <TechCard key={id} id={id} city={city} target={target} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function TechCard({ id, city, target }: { id: string; city: CityState; target: string | null }) {
  const t = TECHS[id];
  const done = hasTech(city, id);
  const lock = done ? null : techLock(city, id);
  const active = target === id;
  const cls = done
    ? "border-emerald-700 bg-emerald-950/40"
    : active
      ? "border-amber-400 bg-amber-950/40"
      : lock
        ? "border-zinc-700 opacity-60"
        : "border-sky-600 hover:bg-sky-950/40";
  return (
    <button
      type="button"
      disabled={done || !!lock}
      onClick={() => useGame.getState().queue({ type: "research", tech: active ? null : id })}
      className={`border p-1.5 text-left ${cls}`}
      title={active ? "Clique para parar esta pesquisa (o progresso fica guardado)" : (lock ?? "Clique para pesquisar")}
    >
      <div className="flex items-center gap-1">
        {done ? <Check /> : lock ? <Lock /> : <Atom />}
        <strong className="min-w-0 flex-1 truncate">{t.name}</strong>
        <span className="tabular-nums text-zinc-400">{done ? "" : `${t.cost} pts`}</span>
      </div>
      <p className="text-zinc-300">{t.description}</p>
      {t.unlocks?.length ? <p className="text-sky-300">Libera: {t.unlocks.map((b) => BUILDINGS[b].name).join(", ")}</p> : null}
      {active && <p className="text-amber-300">Em pesquisa</p>}
      {!done && lock && <p className="text-zinc-400">{lock}</p>}
    </button>
  );
}
