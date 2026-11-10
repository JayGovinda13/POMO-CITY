"use client";

import { BIOMES, REGION_BY_ID, cityPeriodLabel, isPristine, weatherAt } from "@/sim";
import { useGame } from "@/store/game";
import { DisasterModal } from "./DisasterModal";
import { AdSlot } from "./AdSlot";
import { DonateButton } from "./DonateButton";
import { MusicButton } from "./Music";

/** Tela inicial: Continuar a cidade salva ou começar um novo jogo. */
export function TitleScreen() {
  const city = useGame((s) => s.serverState);
  const busy = useGame((s) => s.busy);
  const toast = useGame((s) => s.toast);
  const { enter, newGame } = useGame.getState();

  if (!city) {
    return <div className="grid h-dvh place-items-center text-sm">Carregando POMO-CITY…</div>;
  }

  const fresh = isPristine(city) && !city.regionId;
  const region = city.regionId ? REGION_BY_ID[city.regionId] : null;
  const weather = weatherAt(city);

  return (
    <main className="grid min-h-dvh place-items-center p-4">
      <section className="retro-panel w-full max-w-md">
        <header className="retro-title text-center text-lg tracking-[0.3em] text-amber-300">POMO-CITY</header>
        <div className="space-y-4 p-4 text-sm">
          <p className="text-center text-zinc-400">Sua cidade cresce enquanto você foca.</p>

          {!fresh && (
            <div className="space-y-1 border-2 border-zinc-700 bg-zinc-900/60 p-3">
              <p className="text-zinc-400">Cidade salva</p>
              <p>
                {region ? `${region.name} · ${BIOMES[city.biome].name}` : BIOMES[city.biome].name} — {cityPeriodLabel(city)}
                {weather && ` (${weather.season})`}
              </p>
              <p>
                👥 {city.population} · 💰 ${city.money} · 🔥 sequência {city.streak}
                {city.streakFrozen && <span className="text-emerald-300"> (guardada)</span>}
              </p>
            </div>
          )}

          <div className="space-y-2">
            <button
              type="button"
              className="retro-button retro-button-primary w-full py-2 text-base"
              disabled={busy}
              onClick={enter}
            >
              {fresh ? "▶ Começar" : "▶ Continuar"}
            </button>
            {!fresh && (
              <button
                type="button"
                className="retro-button w-full py-2"
                disabled={busy}
                onClick={() => {
                  if (confirm("Começar um novo jogo? A cidade atual será substituída. Sua sequência de foco é mantida.")) {
                    newGame();
                  }
                }}
              >
                ✚ Novo jogo
              </button>
            )}
          </div>

          <p className="text-[11px] leading-relaxed text-zinc-500">
            Para sair, use <strong>Menu → Sair</strong> com o foco encerrado: a sequência fica guardada. Fechar o jogo
            durante o foco quebra o ciclo e causa um desastre; fechar sem o menu depois de concluir um foco causa um
            desastre leve.
          </p>
          <MusicButton variant="full" />
          <DonateButton variant="full" />
          {toast && <p className="text-amber-300">{toast}</p>}
          {/* Anúncio na tela inicial, abaixo dos botões. */}
          <AdSlot placement="title" className="pt-2" />
          <p className="text-center text-[10px] text-zinc-500">
            <a className="underline" href="/privacidade">
              Privacidade e cookies
            </a>
          </p>
        </div>
      </section>
      <DisasterModal />
    </main>
  );
}
