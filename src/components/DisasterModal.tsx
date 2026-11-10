"use client";

import { CAUSE_TEXT, RESOURCES, type Rank, type ResourceId } from "@/sim";
import { useGame } from "@/store/game";
import { RankBadge } from "./ranks";

const ICON = { incendio: "🔥", enchente: "🌊", nevasca: "❄️", tempestade: "⛈️", praga: "🦗" } as const;

export function DisasterModal() {
  const d = useGame((s) => s.disaster);
  const dismiss = useGame((s) => s.dismissDisaster);
  if (!d) return null;
  const lost = Object.entries(d.resourcesLost).filter(([, q]) => (q ?? 0) > 0);

  return (
    <div className="pointer-events-auto fixed inset-0 z-20 grid place-items-center bg-black/60 p-4">
      <section className="retro-panel w-full max-w-sm" role="alertdialog" aria-labelledby="disaster-title">
        <header id="disaster-title" className="retro-title" style={{ background: "linear-gradient(90deg, #7a1d1d, #a8402a)" }}>
          {ICON[d.kind]} {d.name}
          {d.severity === "light" ? " (leve)" : ""}
        </header>
        <div className="space-y-2 p-3 text-xs">
          <p className="text-red-200">{CAUSE_TEXT[d.cause]}</p>
          <ul className="space-y-0.5">
            {d.lotsDamaged > 0 && <li>🏚 {d.lotsDamaged} lote(s) perderam nível</li>}
            {lost.map(([k, q]) => {
              const [res, rank] = k.split(":") as [ResourceId, Rank];
              return (
                <li key={k} className="flex items-center gap-1">
                  📦 Perdido: <RankBadge rank={rank} /> {RESOURCES[res].name} × {q}
                </li>
              );
            })}
            {d.moneyLost > 0 && <li>💸 Limpeza e reparos: −${d.moneyLost}</li>}
          </ul>
          <p className="text-zinc-400">
            Ciclos concluídos e saídas pelo menu nunca causam desastres. O seguro da cidade (em breve) vai amortecer
            esses prejuízos.
          </p>
          <button type="button" className="retro-button retro-button-primary w-full" onClick={dismiss}>
            Entendi
          </button>
        </div>
      </section>
    </div>
  );
}
