"use client";

import { BUILDINGS, CAUSE_TEXT, RESOURCES, type Rank, type ResourceId } from "@/sim";
import { useGame } from "@/store/game";
import { RankBadge } from "./ranks";

const ICON = { incendio: "🔥", enchente: "🌊", nevasca: "❄️", tempestade: "⛈️", praga: "🦗" } as const;

export function DisasterModal() {
  const d = useGame((s) => s.disaster);
  const dismiss = useGame((s) => s.dismissDisaster);
  if (!d) return null;
  const lost = Object.entries(d.resourcesLost).filter(([, q]) => (q ?? 0) > 0);

  return (
    <div className="pointer-events-auto fixed inset-0 z-20 flex items-center justify-center bg-black/60 p-4">
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
            {d.buildingsDamaged?.map((b) => (
              <li key={`${b.x},${b.y}`} className="flex items-center gap-2">
                <span className="flex-1">
                  🔧 {BUILDINGS[b.type].name} danificada em ({b.x}, {b.y}) — parada até o reparo
                </span>
                <RepairButton x={b.x} y={b.y} cost={b.repair} />
              </li>
            ))}
            {d.moneyLost > 0 && <li>💸 Limpeza: −${d.moneyLost}</li>}
          </ul>
          {d.intensity > 1 && (
            <p className="text-amber-300">Gravidade ×{d.intensity}: ciclos quebrados seguidos e sequências longas pesam mais.</p>
          )}
          {d.insurance && (
            <p className="border-t border-zinc-600 pt-2">
              Prejuízo estimado: ${d.damageValue}.{" "}
              {d.insurance.payout > 0 ? (
                <span className="text-emerald-300">🛡 O seguro pagou ${d.insurance.payout}.</span>
              ) : d.insurance.plan === "none" ? (
                <span className="text-zinc-400">Sem seguro — contrate um em Orçamento → Seguro.</span>
              ) : d.insurance.waitingLeft > 0 ? (
                <span className="text-amber-300">Seguro em carência (faltavam {d.insurance.waitingLeft} ciclos): sem indenização.</span>
              ) : (
                <span className="text-zinc-400">O prejuízo ficou abaixo da franquia.</span>
              )}
            </p>
          )}
          <p className="text-zinc-400">Ciclos concluídos e saídas pelo menu nunca causam desastres.</p>
          <button type="button" className="retro-button retro-button-primary w-full" onClick={dismiss}>
            Entendi
          </button>
        </div>
      </section>
    </div>
  );
}

/** Reparo direto da janela do desastre (entra na fila como as obras da pausa). */
function RepairButton({ x, y, cost }: { x: number; y: number; cost: number }) {
  const damaged = useGame((s) => s.city?.buildings.some((b) => b.x === x && b.y === y && b.damaged) ?? false);
  const focus = useGame((s) => s.phase === "focus");
  if (!damaged) return <span className="text-emerald-300">✓ reparada</span>;
  return (
    <button
      type="button"
      className="retro-button shrink-0"
      disabled={focus}
      title={focus ? "Reparos só na pausa" : undefined}
      onClick={() => useGame.getState().queue({ type: "repair", x, y })}
    >
      Reparar ${cost}
    </button>
  );
}
