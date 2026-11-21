"use client";

import { useState } from "react";
import { BENEFIT, DEFAULT_PENSION, PRIVATE_CONTRIBUTION, WAGE, demographics, retireAgeOf } from "@/sim";
import { useGame } from "@/store/game";
import { Hourglass, Xmark } from "./icons";

/** Botão "População e aposentadoria" na barra superior. */
export function PensionButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="retro-button" onClick={() => setOpen(true)} title="População, famílias e aposentadoria" aria-label="Aposentadoria">
        <Hourglass />
      </button>
      {open && <PensionModal onClose={() => setOpen(false)} />}
    </>
  );
}

const LEVELS: { id: 1 | 2 | 3; name: string }[] = [
  { id: 1, name: "Básico" },
  { id: 2, name: "Médio" },
  { id: 3, name: "Generoso" },
];

function PensionModal({ onClose }: { onClose: () => void }) {
  const city = useGame((s) => s.city);
  const phase = useGame((s) => s.phase);
  const report = useGame((s) => s.lastReport);
  if (!city) return null;
  const locked = phase === "focus";
  const p = city.pension ?? DEFAULT_PENSION;
  const d = demographics(city);
  const retire = retireAgeOf(city);
  const total = Math.max(1, d.children + d.adults + d.retirees);
  const set = (patch: { retireAge?: number; publicOn?: boolean; publicRate?: number; publicLevel?: 1 | 2 | 3; privateOn?: boolean; privateSubsidy?: number }) =>
    useGame.getState().queue({ type: "pension", ...patch });
  const dm = report?.demography;
  const pr = report?.pension;
  const bar = (n: number, color: string) => <div className={`h-3 ${color}`} style={{ width: `${(n / total) * 100}%` }} />;

  // Previsão: contribuição e benefícios com a população de agora.
  const employedGuess = d.adults;
  const projContrib = p.publicOn ? employedGuess * WAGE * (p.publicRate / 100) : 0;
  const projBenefit = p.publicOn ? d.retirees * BENEFIT[p.publicLevel] : 0;

  return (
    <div className="pointer-events-auto fixed inset-0 z-10 flex items-center justify-center bg-black/60 p-3">
      <section className="retro-panel flex max-h-[90dvh] w-full max-w-2xl flex-col text-xs">
        <header className="retro-title flex">
          População e aposentadoria
          <button type="button" className="ml-auto" aria-label="Fechar" onClick={onClose}>
            <Xmark />
          </button>
        </header>
        <div className="min-h-0 space-y-3 overflow-y-auto p-3">
          {locked && <p className="text-red-300">Em foco: as mudanças só valem na pausa.</p>}

          <div className="space-y-1 border border-zinc-700 p-2">
            <strong>Quem mora na cidade</strong>
            <div className="flex overflow-hidden border border-zinc-700">
              {bar(d.children, "bg-sky-400")}
              {bar(d.adults, "bg-emerald-400")}
              {bar(d.retirees, "bg-amber-400")}
            </div>
            <p>
              <span className="text-sky-300">Crianças {d.children}</span> · <span className="text-emerald-300">Adultos {d.adults}</span> ·{" "}
              <span className="text-amber-300">Aposentados {d.retirees}</span> · idade média {d.avgAge} anos
            </p>
            {dm && (
              <p className="text-zinc-400">
                Último ciclo: {dm.births} nascimento(s), {dm.deaths} morte(s), {dm.marriages} casamento(s).
              </p>
            )}
            <p className="text-zinc-400">Crianças e aposentados não ocupam vagas; aposentados pagam metade do imposto e pesam em dobro no hospital.</p>
          </div>

          <div className="space-y-1 border border-zinc-700 p-2">
            <strong>Idade de aposentar</strong>
            <div className="flex flex-wrap items-center gap-1">
              {[60, 62, 65, 67, 70].map((a) => (
                <button key={a} type="button" className={`retro-button ${retire === a ? "retro-button-active" : ""}`} disabled={locked} onClick={() => set({ retireAge: a })} aria-pressed={retire === a}>
                  {a} anos
                </button>
              ))}
            </div>
            <p className="text-zinc-400">Aposentar mais tarde põe mais gente para trabalhar; aposentar cedo aumenta o gasto com benefícios.</p>
          </div>

          <div className="space-y-1 border border-zinc-700 p-2">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={p.publicOn} disabled={locked} onChange={(e) => set({ publicOn: e.target.checked })} />
              <strong>Previdência pública</strong>
            </label>
            <p className="text-zinc-400">Os trabalhadores contribuem com uma parte do salário e a prefeitura paga um benefício a cada aposentado. Se o fundo não cobrir, o déficit sai do caixa.</p>
            {p.publicOn && (
              <>
                <label className="flex items-center gap-2">
                  <span className="w-40 shrink-0">Contribuição: {p.publicRate}%</span>
                  <input type="range" min={0} max={15} step={1} value={p.publicRate} disabled={locked} onChange={(e) => set({ publicRate: Number(e.target.value) })} className="flex-1" aria-label="Contribuição pública" />
                </label>
                <div className="flex flex-wrap items-center gap-1">
                  <span className="w-40 shrink-0">Benefício (${BENEFIT[p.publicLevel]}/aposentado)</span>
                  {LEVELS.map((l) => (
                    <button key={l.id} type="button" className={`retro-button ${p.publicLevel === l.id ? "retro-button-active" : ""}`} disabled={locked} onClick={() => set({ publicLevel: l.id })} aria-pressed={p.publicLevel === l.id}>
                      {l.name}
                    </button>
                  ))}
                </div>
                <p>
                  Fundo: <strong>${Math.round(p.fund)}</strong> · previsão por ciclo: arrecada ${Math.round(projContrib)}, paga ${Math.round(projBenefit)}{" "}
                  {projBenefit > projContrib + p.fund ? <span className="text-red-300">(déficit de ${Math.round(projBenefit - projContrib)} sai do caixa)</span> : <span className="text-emerald-300">(sustentável)</span>}
                </p>
              </>
            )}
          </div>

          <div className="space-y-1 border border-zinc-700 p-2">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={p.privateOn} disabled={locked} onChange={(e) => set({ privateOn: e.target.checked })} />
              <strong>Previdência privada (oferecida aos moradores)</strong>
            </label>
            <p className="text-zinc-400">
              Cada trabalhador pode aderir: poupa ${PRIVATE_CONTRIBUTION.toFixed(1)} por ciclo, com rendimento, e vive dessa poupança ao se aposentar, sem custo para a prefeitura. Você pode
              subsidiar parte do aporte.
            </p>
            {p.privateOn && (
              <label className="flex items-center gap-2">
                <span className="w-40 shrink-0">Subsídio da prefeitura: {p.privateSubsidy}%</span>
                <input type="range" min={0} max={100} step={10} value={p.privateSubsidy} disabled={locked} onChange={(e) => set({ privateSubsidy: Number(e.target.value) })} className="flex-1" aria-label="Subsídio privado" />
              </label>
            )}
          </div>

          <div className="space-y-1 border border-zinc-700 p-2">
            <strong>Situação dos aposentados</strong>
            {pr ? (
              <p>
                {pr.retirees} aposentado(s):{" "}
                <span className={pr.withoutIncome > 0 ? "text-red-300" : "text-emerald-300"}>{pr.withoutIncome} sem renda de aposentadoria</span>
                {pr.enrolled > 0 && <> · {pr.enrolled} trabalhadores na previdência privada</>}
                {pr.cost > 0 && <> · custo para o caixa neste ciclo: ${pr.cost}</>}
              </p>
            ) : (
              <p className="text-zinc-400">Complete um ciclo para ver o balanço da previdência.</p>
            )}
            <p className="text-zinc-400">Aposentado sem renda fica muito triste (−3 no humor); com aposentadoria garantida, fica contente (+1).</p>
          </div>
        </div>
      </section>
    </div>
  );
}
