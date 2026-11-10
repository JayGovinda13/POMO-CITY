"use client";

import { useState } from "react";
import { useGame } from "@/store/game";

/** Menu do jogo: sair guardando a sequência ou começar um novo jogo (só com o foco encerrado). */
export function GameMenu() {
  const [open, setOpen] = useState(false);
  const phase = useGame((s) => s.phase);
  const busy = useGame((s) => s.busy);
  const { exit, newGame } = useGame.getState();
  const locked = phase === "focus";

  return (
    <>
      <button type="button" className="retro-button" onClick={() => setOpen(true)}>
        ☰ Menu
      </button>
      {open && (
        <div className="pointer-events-auto fixed inset-0 z-10 grid place-items-center bg-black/50 p-4">
          <section className="retro-panel w-full max-w-xs">
            <header className="retro-title flex">
              Menu
              <button type="button" className="ml-auto" aria-label="Fechar" onClick={() => setOpen(false)}>
                ✕
              </button>
            </header>
            <div className="space-y-2 p-3 text-xs">
              {locked && <p className="text-red-300">Em foco: só é possível sair ou recomeçar com o foco encerrado.</p>}
              <button
                type="button"
                className="retro-button retro-button-primary w-full"
                disabled={locked || busy}
                onClick={async () => {
                  await exit();
                  setOpen(false);
                }}
              >
                ⏏ Sair e guardar a sequência
              </button>
              <button
                type="button"
                className="retro-button w-full"
                disabled={locked || busy}
                onClick={async () => {
                  if (!confirm("Começar um novo jogo? A cidade atual será substituída. Sua sequência de foco é mantida.")) return;
                  await newGame();
                  setOpen(false);
                }}
              >
                ✚ Novo jogo
              </button>
              <button type="button" className="retro-button w-full" onClick={() => setOpen(false)}>
                Voltar à cidade
              </button>
              <p className="text-[11px] text-zinc-500">
                Fechar o jogo sem sair por aqui causa desastre: normal durante o foco, leve depois de concluir um foco.
              </p>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
