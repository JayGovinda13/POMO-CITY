"use client";

import { useState } from "react";
import { PARTIES, cityDisplayName, cityPeriodLabel, fascistSeats } from "@/sim";
import { useGame } from "@/store/game";

/** Fim de jogo: os fascistas conquistaram 2/3 da câmara e tomaram a prefeitura. */
export function GameOver() {
  const city = useGame((s) => s.city);
  const busy = useGame((s) => s.busy);
  // O jornal do ciclo (com a manchete do golpe) vem primeiro; o aviso de fim de jogo só depois de lido.
  const reading = useGame((s) => !!s.report);
  const [hidden, setHidden] = useState(false);
  if (!city?.ended || reading) return null;
  const { fascist, total } = fascistSeats(city.council);
  const years = Math.floor(city.ended.cycle / 4);
  if (hidden)
    return (
      <div className="pointer-events-auto fixed bottom-2 left-1/2 z-30 -translate-x-1/2">
        <button type="button" className="retro-button retro-button-primary" onClick={() => setHidden(false)}>
          ☠ Fim de jogo — ver o aviso
        </button>
      </div>
    );
  return (
    <div className="pointer-events-auto fixed inset-0 z-30 flex items-center justify-center bg-black/85 p-4" role="alertdialog" aria-labelledby="gameover-title">
      <section className="retro-panel w-full max-w-md text-center">
        <header id="gameover-title" className="retro-title text-red-300">
          GOLPE — FIM DE JOGO
        </header>
        <div className="space-y-3 p-4 text-sm">
          <p className="text-4xl">☠</p>
          <p>
            O <strong className="text-red-300">{PARTIES.fascista.name}</strong> conquistou <strong>{fascist} de {total} cadeiras</strong> da câmara de
            {" "}{cityDisplayName(city)} (mais de dois terços) e tomou a prefeitura.
          </p>
          <p className="text-zinc-300">Acabaram as eleições, as greves e a liberdade. A cidade deixa de ser sua.</p>
          <p className="text-zinc-400">
            Você governou até {cityPeriodLabel(city)}, com {city.population} moradores e {(city.techs ?? []).length} tecnologias.
          </p>
          <p className="text-zinc-500">Os fascistas só crescem em tempos de crise: greve geral, caixa no vermelho, desastres, desemprego, povo triste e bairros perigosos. Na próxima cidade, cuide disso antes da eleição.</p>
          <div className="flex flex-col gap-2 pt-1">
            <button type="button" className="retro-button retro-button-primary" disabled={busy} onClick={() => void useGame.getState().newGame()}>
              ✚ Começar uma nova cidade
            </button>
            <button type="button" className="retro-button" onClick={() => setHidden(true)}>
              Ver a cidade
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
