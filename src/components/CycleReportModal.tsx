"use client";

import { QUARTER_MONTHS, RESOURCES, type Inventory, type ResourceId, type Rank } from "@/sim";
import { useGame } from "@/store/game";
import { RankBadge } from "./ranks";

function InvList({ inv, empty }: { inv: Inventory; empty: string }) {
  const entries = Object.entries(inv).filter(([, q]) => (q ?? 0) > 0);
  if (!entries.length) return <p className="text-zinc-500">{empty}</p>;
  return (
    <ul>
      {entries.map(([k, q]) => {
        const [res, rank] = k.split(":") as [ResourceId, Rank];
        return (
          <li key={k} className="flex items-center gap-1">
            <RankBadge rank={rank} /> {RESOURCES[res].name} × {q}
          </li>
        );
      })}
    </ul>
  );
}

export function CycleReportModal() {
  const report = useGame((s) => s.report);
  const dismiss = useGame((s) => s.dismissReport);
  if (!report) return null;

  return (
    <div className="pointer-events-auto absolute inset-0 grid place-items-center bg-black/50 p-4">
      <section className="retro-panel w-full max-w-sm">
        <header className="retro-title">Relatório do ciclo{report.year ? ` — ${QUARTER_MONTHS[report.quarter ?? 0]} ${report.year}` : ""}</header>
        <div className="space-y-2 p-3">
          <p className="flex items-center gap-2 text-sm">
            Pureza do lote: <RankBadge rank={report.rank} /> <span className="text-zinc-400">(sequência {report.streak})</span>
          </p>
          {!report.rewarded ? (
            <p className="text-amber-300">
              Limite diário de ciclos recompensados atingido. Descanse — amanhã a cidade volta a produzir.
            </p>
          ) : (
            <>
              <div>
                <h3 className="text-zinc-400">Produzido</h3>
                <InvList inv={report.produced} empty="Nada — verifique estradas e trabalhadores." />
              </div>
              <div>
                <h3 className="text-zinc-400">Consumido</h3>
                <InvList inv={report.consumed} empty="—" />
              </div>
              <div>
                <h3 className="text-zinc-400">Desperdício industrial</h3>
                <InvList inv={report.wasted} empty="Zero desperdício." />
              </div>
              <p>
                Impostos +${report.taxes} · Manutenção −${report.upkeep} ·{" "}
                <strong className={report.netMoney >= 0 ? "text-emerald-300" : "text-red-300"}>
                  Saldo {report.netMoney >= 0 ? "+" : ""}${report.netMoney}
                </strong>
              </p>
              <p>
                População {report.populationBefore} → {report.populationAfter}
                {report.starving && <span className="text-red-300"> · faltou comida!</span>}
              </p>
              {report.zones && (
                <p>
                  Lotes: <span className="text-emerald-300">+{report.zones.grown} cresceram</span>
                  {report.zones.declined > 0 && <span className="text-red-300"> · −{report.zones.declined} declinaram</span>}
                </p>
              )}
              {report.jobs && (
                <p>
                  Empregos {report.jobs.filled}/{report.jobs.total}
                  {report.jobs.unemployed > 0 && <span className="text-amber-300"> · {report.jobs.unemployed} sem emprego</span>}
                </p>
              )}
              {report.power && (
                <p className={report.power.brownout ? "text-red-300" : ""}>
                  ⚡ Consumo {report.power.demand} MW / capacidade {report.power.capacity} MW
                  {report.power.brownout && " — apagão! Construa usinas ou linhas."}
                </p>
              )}
            </>
          )}
          <button type="button" className="retro-button retro-button-primary w-full" onClick={dismiss}>
            Gerenciar a cidade
          </button>
        </div>
      </section>
    </div>
  );
}
