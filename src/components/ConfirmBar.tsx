"use client";

import { useMemo } from "react";
import { applyCommands } from "@/sim";
import { useGame } from "@/store/game";

/**
 * Barra "Confirmar obras": no modo de confirmação, o que o jogador toca ou arrasta no mapa fica como
 * proposta (já visível na cidade) até ele confirmar, desfazer o último toque ou cancelar tudo.
 */
export function ConfirmBar() {
  const draft = useGame((s) => s.draft);
  const city = useGame((s) => s.city);
  const serverState = useGame((s) => s.serverState);
  const pending = useGame((s) => s.pending);
  const { confirmDraft, cancelDraft, undoDraft } = useGame.getState();

  // Quanto a proposta custa: o caixa sem ela menos o caixa com ela.
  const cost = useMemo(() => {
    if (!draft.length || !serverState || !city) return 0;
    return Math.max(0, applyCommands(serverState, pending).state.money - city.money);
  }, [draft.length, serverState, pending, city]);

  if (!draft.length) return null;
  return (
    <div className="retro-panel pointer-events-auto mx-auto flex max-w-full flex-wrap items-center justify-center gap-2 px-2 py-1.5" role="group" aria-label="Confirmar obras">
      <span className="text-amber-200">
        {draft.length} {draft.length === 1 ? "toque" : "toques"} · ${cost}
      </span>
      <button type="button" className="retro-button" onClick={undoDraft} title="Desfaz o último toque" aria-label="Desfazer o último toque">
        ↶ Desfazer
      </button>
      <button type="button" className="retro-button" onClick={cancelDraft} title="Descarta tudo o que ainda não foi confirmado">
        ✖ Cancelar
      </button>
      <button type="button" className="retro-button retro-button-primary" onClick={confirmDraft}>
        ✔ Confirmar
      </button>
    </div>
  );
}
