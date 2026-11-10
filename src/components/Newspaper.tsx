"use client";

import { useMemo } from "react";
import { generateNewspaper, type CityState, type CycleReport, type NewsStory } from "@/sim";
import { AdSlot } from "./AdSlot";
import { MOOD_ICON, Portrait } from "./Portrait";
import { RankBadge } from "./ranks";

const TONE: Record<NewsStory["tone"], string> = { good: "text-emerald-800", bad: "text-red-800", neutral: "text-stone-800" };

/** Edição do jornal no fim do ciclo: manchete, notícias, a fala de um morador e o resumo. */
export function NewspaperView({
  state,
  report,
  onDetails,
  onClose,
}: {
  state: CityState;
  report: CycleReport;
  onDetails: () => void;
  onClose: () => void;
}) {
  const paper = useMemo(() => generateNewspaper(state, report), [state, report]);

  return (
    <div className="pointer-events-auto absolute inset-0 z-10 grid place-items-center bg-black/60 p-3">
      <article
        className="max-h-[94dvh] w-full max-w-2xl overflow-y-auto border-4 border-stone-800 bg-[#f1e8d2] p-4 text-stone-900 shadow-[4px_4px_0_#000]"
        aria-label={`${paper.name}, ${paper.date}`}
      >
        {/* Cabeçalho */}
        <header className="border-b-4 border-double border-stone-800 pb-2 text-center">
          <h2 className="font-serif text-3xl font-black uppercase tracking-wider">{paper.name}</h2>
          <p className="mt-1 flex justify-between border-t border-stone-800 pt-1 text-[10px] uppercase tracking-widest">
            <span>Edição nº {paper.edition}</span>
            <span>{paper.date}</span>
            <span>Preço: 1 pomodoro</span>
          </p>
        </header>

        {/* Manchete */}
        <section className="border-b-2 border-stone-800 py-3 text-center">
          <h3 className={`font-serif text-2xl font-black leading-tight ${TONE[paper.headline.tone]}`}>{paper.headline.title}</h3>
          <p className="mt-1 font-serif text-sm italic">{paper.headline.body}</p>
        </section>

        <div className="grid gap-4 pt-3 md:grid-cols-[1fr_14rem]">
          {/* Notícias em colunas */}
          <div className="space-y-3 md:columns-2 md:gap-4">
            {paper.stories.map((s) => (
              <section key={s.title} className="break-inside-avoid border-b border-stone-400 pb-2">
                <h4 className={`font-serif text-sm font-bold leading-snug ${TONE[s.tone]}`}>{s.title}</h4>
                <p className="mt-0.5 text-xs leading-relaxed">{s.body}</p>
              </section>
            ))}
          </div>

          <aside className="space-y-3">
            {/* Resumo do ciclo */}
            <section className="border-2 border-stone-800 p-2 text-xs">
              <h4 className="mb-1 font-serif font-bold uppercase">Resumo da estação</h4>
              <p className="flex items-center gap-1">
                Lote: <RankBadge rank={report.rank} /> · 🔥 {report.streak}
              </p>
              <p>
                Saldo:{" "}
                <strong className={report.netMoney >= 0 ? "text-emerald-800" : "text-red-800"}>
                  {report.netMoney >= 0 ? "+" : "−"}${Math.abs(report.netMoney)}
                </strong>
              </p>
              <p>
                População: {report.populationBefore} → {report.populationAfter}
              </p>
              <p className={report.power.brownout ? "text-red-800" : ""}>
                Energia: {report.power.demand}/{report.power.capacity} MW
              </p>
              <button type="button" className="mt-1 underline" onClick={onDetails}>
                Ver balanço completo →
              </button>
            </section>

            {/* Fala do morador */}
            {paper.quote && (
              <figure className="border-2 border-stone-800 bg-[#e8dcc0] p-2 text-xs">
                <div className="flex items-center gap-2">
                  <span className="bg-[#2a2d4a] p-0.5">
                    <Portrait citizen={paper.quote.citizen} scale={2} />
                  </span>
                  <figcaption>
                    <strong>{paper.quote.citizen.name}</strong>
                    <span className="block text-stone-600">
                      {paper.quote.citizen.job?.title ?? (paper.quote.citizen.gender === "f" ? "Desempregada" : "Desempregado")}{" "}
                      {MOOD_ICON[paper.quote.citizen.mood]}
                    </span>
                  </figcaption>
                </div>
                <blockquote className="mt-1 font-serif italic">“{paper.quote.text}”</blockquote>
              </figure>
            )}

            {/* Anúncio (AdSense) — separado dos botões do jogo. */}
            <AdSlot placement="newspaper" className="border-t border-stone-400 pt-2" />
          </aside>
        </div>

        <footer className="mt-4 border-t-2 border-stone-800 pt-3">
          <button type="button" className="retro-button retro-button-primary w-full text-zinc-100" onClick={onClose}>
            Gerenciar a cidade
          </button>
        </footer>
      </article>
    </div>
  );
}
