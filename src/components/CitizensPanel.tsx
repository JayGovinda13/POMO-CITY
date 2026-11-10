"use client";

import { useMemo, useState } from "react";
import { WEALTH_NAMES, citizensView, moodSummary, type CitizenView, type Mood } from "@/sim";
import { useGame } from "@/store/game";
import { MOOD_ICON, Portrait } from "./Portrait";

type Filter = "todos" | Mood | "sem emprego";

/** Botão da barra superior com o humor da cidade; abre a lista de moradores. */
export function CitizensButton() {
  const city = useGame((s) => s.city);
  const [open, setOpen] = useState(false);
  const views = useMemo(() => (city ? citizensView(city) : []), [city]);
  const m = moodSummary(views);
  if (!city) return null;
  return (
    <>
      <button
        type="button"
        className="retro-button"
        onClick={() => setOpen(true)}
        title={`Moradores: ${MOOD_ICON.feliz} ${m.feliz} felizes · ${MOOD_ICON.ok} ${m.ok} ok · ${MOOD_ICON.triste} ${m.triste} tristes`}
        aria-label="Moradores"
      >
        {m.triste > m.feliz ? MOOD_ICON.triste : m.feliz > 0 ? MOOD_ICON.feliz : MOOD_ICON.ok} {views.length}
      </button>
      {open && <CitizensModal views={views} onClose={() => setOpen(false)} />}
    </>
  );
}

function CitizensModal({ views, onClose }: { views: CitizenView[]; onClose: () => void }) {
  const [filter, setFilter] = useState<Filter>("todos");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<CitizenView | null>(null);
  const m = moodSummary(views);

  const list = views.filter((v) => {
    if (filter === "sem emprego" ? v.job : filter !== "todos" && v.mood !== filter) return false;
    return !query || v.name.toLowerCase().includes(query.toLowerCase()) || v.job?.title.toLowerCase().includes(query.toLowerCase());
  });

  return (
    <div className="pointer-events-auto fixed inset-0 z-10 grid place-items-center bg-black/60 p-3">
      <section className="retro-panel flex max-h-[90dvh] w-full max-w-3xl flex-col text-xs">
        <header className="retro-title flex">
          Moradores — {views.length}
          <button type="button" className="ml-auto" aria-label="Fechar" onClick={onClose}>
            ✕
          </button>
        </header>
        <div className="flex flex-wrap items-center gap-2 p-2">
          <span>
            Aprovação: <strong className={m.approval >= 0 ? "text-emerald-300" : "text-red-300"}>{Math.round(m.approval * 100)}%</strong>
          </span>
          {(["todos", "feliz", "ok", "triste", "sem emprego"] as Filter[]).map((f) => (
            <button key={f} type="button" className={`retro-button ${filter === f ? "retro-button-active" : ""}`} onClick={() => setFilter(f)}>
              {f === "todos" ? "Todos" : f === "sem emprego" ? "Sem emprego" : `${MOOD_ICON[f]} ${f}`}
            </button>
          ))}
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar nome ou profissão"
            className="ml-auto w-48 border-2 border-zinc-600 bg-zinc-900 px-2 py-1"
          />
        </div>
        <div className="grid min-h-0 flex-1 gap-2 overflow-hidden p-2 md:grid-cols-[1fr_16rem]">
          <ul className="min-h-0 space-y-1 overflow-y-auto pr-1">
            {list.length === 0 && <li className="text-zinc-500">Ninguém por aqui ainda. Zoneie áreas residenciais para a cidade crescer.</li>}
            {list.map((v) => (
              <li key={v.id}>
                <button
                  type="button"
                  onClick={() => setSelected(v)}
                  className={`flex w-full items-center gap-2 border-2 px-1 py-0.5 text-left ${selected?.id === v.id ? "border-amber-400 bg-zinc-800" : "border-transparent hover:bg-zinc-800"}`}
                >
                  <Portrait citizen={v} scale={2} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-bold">{v.name}</span>
                    <span className="block truncate text-zinc-400">{v.job ? `${v.job.title} · ${v.job.place}` : v.gender === "f" ? "Desempregada" : "Desempregado"}</span>
                  </span>
                  <span title={v.mood}>{MOOD_ICON[v.mood]}</span>
                </button>
              </li>
            ))}
          </ul>
          <aside className="border-2 border-zinc-700 bg-zinc-900/60 p-2">
            {selected ? <CitizenCard citizen={selected} /> : <p className="text-zinc-500">Clique em alguém para ver os detalhes.</p>}
          </aside>
        </div>
      </section>
    </div>
  );
}

export function CitizenCard({ citizen: v }: { citizen: CitizenView }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Portrait citizen={v} scale={4} />
        <div>
          <p className="text-sm font-bold">{v.name}</p>
          <p className="text-zinc-300">
            {MOOD_ICON[v.mood]} {v.mood === "feliz" ? "Feliz" : v.mood === "ok" ? "Ok" : "Triste"}
          </p>
        </div>
      </div>
      <p>💼 {v.job ? `${v.job.title} — ${v.job.place} (${v.job.x}, ${v.job.y})` : v.gender === "f" ? "Desempregada" : "Desempregado"}</p>
      <p>
        🏠 {v.home ? `Mora no lote (${v.home.x}, ${v.home.y})` : "Sem moradia"}
        {v.wealth && <span className="text-zinc-400"> · {WEALTH_NAMES[v.wealth]}</span>}
      </p>
      <div>
        <p className="text-zinc-400">Por que está assim:</p>
        <ul>
          {v.reasons.map((r) => (
            <li key={r.text} className={r.delta > 0 ? "text-emerald-300" : "text-red-300"}>
              {r.delta > 0 ? "+" : "−"}
              {Math.abs(r.delta)} {r.text}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
