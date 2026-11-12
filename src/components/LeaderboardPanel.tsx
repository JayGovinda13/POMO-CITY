"use client";

import { useEffect, useState } from "react";
import { REGION_BY_ID, advancementScore, cityValue, rankEligible } from "@/sim";
import { useGame } from "@/store/game";
import { Trophy, Xmark } from "./icons";

interface Row {
  cityName: string;
  region: string | null;
  score: number;
  techs: number;
  population: number;
  year: number;
  era: string;
  mine: boolean;
}
interface Board {
  top: Row[];
  myRank: number | null;
  total: number;
}

/** Botão "Ranking" na barra superior. */
export function LeaderboardButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="retro-button" onClick={() => setOpen(true)} title="Ranking das cidades mais avançadas" aria-label="Ranking">
        <Trophy />
      </button>
      {open && <LeaderboardModal onClose={() => setOpen(false)} />}
    </>
  );
}

function LeaderboardModal({ onClose }: { onClose: () => void }) {
  const city = useGame((s) => s.city);
  const [board, setBoard] = useState<Board | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch("/api/leaderboard", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((b: Board) => alive && setBoard(b))
      .catch(() => alive && setError(true));
    return () => {
      alive = false;
    };
  }, []);

  const eligible = city ? rankEligible(city) : true;
  const myScore = city ? advancementScore(city, cityValue(city)) : 0;
  return (
    <div className="pointer-events-auto fixed inset-0 z-10 flex items-center justify-center bg-black/60 p-3">
      <section className="retro-panel flex max-h-[90dvh] w-full max-w-2xl flex-col text-xs">
        <header className="retro-title flex">
          Ranking — cidades mais avançadas
          <button type="button" className="ml-auto" aria-label="Fechar" onClick={onClose}>
            <Xmark />
          </button>
        </header>
        <div className="space-y-1 border-b border-zinc-700 p-2">
          {eligible ? (
            <p>
              Sua pontuação: <strong className="text-amber-300">{myScore.toLocaleString("pt-BR")}</strong>
              {board?.myRank ? (
                <>
                  {" "}
                  · posição <strong className="text-amber-300">{board.myRank}º</strong> de {board.total}
                </>
              ) : (
                " · conclua um ciclo de foco para entrar no ranking"
              )}
            </p>
          ) : (
            <p className="text-red-300">
              Esta cidade sofreu uma catástrofe (ciclo quebrado) e está fora do ranking. Você pode continuar jogando normalmente, mas ela não volta
              a pontuar. Só uma cidade nova, sem nenhum ciclo quebrado, disputa o recorde.
            </p>
          )}
          <p className="text-zinc-400">
            Pontos: tecnologias pesquisadas, população e valor da cidade. Só entram cidades que nunca quebraram um ciclo de foco. O ranking mostra
            apenas o nome da cidade e a região.
          </p>
        </div>
        <div className="min-h-0 overflow-y-auto p-2">
          {error && <p className="text-red-300">Não foi possível carregar o ranking agora.</p>}
          {!board && !error && <p>Carregando…</p>}
          {board && board.top.length === 0 && <p>Nenhuma cidade no ranking ainda. Seja a primeira!</p>}
          {board && board.top.length > 0 && (
            <table className="w-full border-collapse">
              <thead className="text-left text-zinc-400">
                <tr>
                  <th className="pr-2">#</th>
                  <th>Cidade</th>
                  <th className="hidden sm:table-cell">Era</th>
                  <th className="text-right">Tec.</th>
                  <th className="hidden text-right sm:table-cell">Pop.</th>
                  <th className="text-right">Pontos</th>
                </tr>
              </thead>
              <tbody>
                {board.top.map((r, i) => (
                  <tr key={i} className={r.mine ? "bg-amber-900/40 text-amber-200" : i % 2 ? "bg-zinc-800/40" : ""}>
                    <td className="pr-2 tabular-nums">{i + 1}</td>
                    <td className="max-w-[10rem] truncate">
                      {r.cityName}
                      {r.mine && " (você)"}
                      <span className="block text-zinc-500 sm:inline"> {r.region ? (REGION_BY_ID[r.region]?.name ?? "") : ""}</span>
                    </td>
                    <td className="hidden sm:table-cell">
                      {r.era} · {r.year}
                    </td>
                    <td className="text-right tabular-nums">{r.techs}</td>
                    <td className="hidden text-right tabular-nums sm:table-cell">{r.population}</td>
                    <td className="text-right tabular-nums">{r.score.toLocaleString("pt-BR")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  );
}
