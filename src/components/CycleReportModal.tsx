"use client";

import { useEffect, useState } from "react";
import { QUARTER_MONTHS, RESOURCES, type Inventory, type ResourceId, type Rank } from "@/sim";
import { useGame } from "@/store/game";
import { RankBadge } from "./ranks";
import { NewspaperView } from "./Newspaper";

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

/** Fim de ciclo: abre o jornal da cidade; o balanço completo fica a um clique. */
export function CycleReportModal() {
  const report = useGame((s) => s.report);
  const state = useGame((s) => s.serverState);
  const dismiss = useGame((s) => s.dismissReport);
  const [details, setDetails] = useState(false);
  useEffect(() => setDetails(false), [report]);
  if (!report) return null;
  if (!details && state) return <NewspaperView state={state} report={report} onDetails={() => setDetails(true)} onClose={dismiss} />;

  return (
    <div className="pointer-events-auto absolute inset-0 grid place-items-center bg-black/50 p-4">
      <section className="retro-panel max-h-[92dvh] w-full max-w-lg overflow-y-auto">
        <header className="retro-title flex">
          Balanço do ciclo{report.year ? ` — ${QUARTER_MONTHS[report.quarter ?? 0]} ${report.year}` : ""}
          {state && (
            <button type="button" className="ml-auto" onClick={() => setDetails(false)}>
              ◀ Jornal
            </button>
          )}
        </header>
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
              {report.ledger && Object.keys(report.ledger).length > 0 ? (
                <div className="overflow-x-auto">
                  <h3 className="text-zinc-400">Balanço por recurso</h3>
                  <table className="w-full text-right">
                    <thead className="text-zinc-400">
                      <tr>
                        <th className="text-left font-normal">Recurso</th>
                        <th className="font-normal" title="Produzido">+Prod.</th>
                        <th className="font-normal" title="Consumido (moradores, obras, fábricas)">−Cons.</th>
                        <th className="font-normal" title="Comprado no mercado externo">Comprou</th>
                        <th className="font-normal" title="Vendido (política ou excesso)">Vendeu</th>
                        <th className="font-normal" title="Estragado">Perdeu</th>
                        <th className="font-normal">Estoque</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(report.ledger).map(([res, l]) => (
                        <tr key={res}>
                          <td className="text-left">{RESOURCES[res as ResourceId].name}</td>
                          <td className="text-emerald-300">{l.produced || ""}</td>
                          <td>{l.consumed || ""}</td>
                          <td className="text-amber-300">{l.bought || ""}</td>
                          <td className="text-sky-300">{l.sold || ""}</td>
                          <td className="text-red-300">{l.lost || ""}</td>
                          <td className={l.stock >= l.capacity ? "text-amber-300" : ""}>
                            {l.stock}/{l.capacity}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div>
                  <h3 className="text-zinc-400">Consumido</h3>
                  <InvList inv={report.consumed} empty="—" />
                </div>
              )}
              {Object.keys(report.wasted ?? {}).length > 0 && (
                <div>
                  <h3 className="text-zinc-400">Desperdício industrial</h3>
                  <InvList inv={report.wasted} empty="Zero desperdício." />
                </div>
              )}
              <p>
                Impostos +${report.taxes} · Manutenção −${report.upkeep}
                {report.importCost > 0 && <span className="text-amber-300"> · Compras −${report.importCost}</span>}
                {report.salesRevenue > 0 && <span className="text-sky-300"> · Vendas +${report.salesRevenue}</span>} ·{" "}
                <strong className={report.netMoney >= 0 ? "text-emerald-300" : "text-red-300"}>
                  Saldo {report.netMoney >= 0 ? "+" : ""}${report.netMoney}
                </strong>
              </p>
              <p>
                População {report.populationBefore} → {report.populationAfter}
                {report.starving && <span className="text-red-300"> · faltou comida!</span>}
              </p>
              {report.citizens && (
                <p>
                  👥 {report.citizens.arrived > 0 && <span className="text-emerald-300">+{report.citizens.arrived} chegaram </span>}
                  {report.citizens.left > 0 && <span className="text-red-300">−{report.citizens.left} foram embora </span>}· 😊 {report.citizens.feliz} 😐{" "}
                  {report.citizens.ok} ☹️ {report.citizens.triste}
                </p>
              )}
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
              {report.weather && (
                <p>
                  🌦 {report.weather.season}: {report.weather.label} · {report.weather.temp}°C · {report.weather.rain} mm ·
                  lavoura {Math.round(report.weather.effects.farm * 100)}%
                </p>
              )}
              {report.water && (
                <p className={report.water.shortage ? "text-red-300" : ""}>
                  💧 Água: consumo {report.water.demand} / produção {report.water.produced}
                  {report.water.stored > 0 && ` + ${report.water.stored} nas caixas`}
                  {report.water.shortage && " — faltou água! Bombas, canos ou caixas d'água."}
                </p>
              )}
              {report.traffic && report.traffic.trips > 0 && (
                <p className={report.traffic.congested ? "text-amber-300" : ""}>
                  🚗 {report.traffic.trips} viagens · tempo médio {report.traffic.avgCommute}
                  {report.traffic.congested > 0 && ` · ${report.traffic.congested} trechos congestionados`}
                  {report.traffic.failed > 0 && ` · ${report.traffic.failed} sem emprego ao alcance`}
                  {(report.traffic.bus > 0 || report.traffic.rail > 0) && ` · 🚌 ${report.traffic.bus} · 🚆 ${report.traffic.rail}`}
                </p>
              )}
              {report.services && (
                <p>
                  🎓 QE {Math.round(report.services.eq)} · ❤️ vida {Math.round(report.services.lifeExpectancy)} anos · 🚨 crime{" "}
                  {Math.round(report.services.crime)} · 🏭 poluição {Math.round(report.services.pollution)} · 💎 solo{" "}
                  {Math.round(report.services.landValue)}
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
