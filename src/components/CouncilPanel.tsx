"use client";

import { useState } from "react";
import { LAWS, PARTIES, lawCoop, lawEntrepreneur, lawFinance, PARTY_IDS, TERM_CYCLES, citizenProfile, cyclesToElection, ageOfCitizen, fascistSeats, type LawId, type PartyId } from "@/sim";
import { useGame } from "@/store/game";
import { Gavel, Xmark } from "./icons";

/** Botão "Câmara" na barra superior; o número é de projetos esperando decisão. */
export function CouncilButton() {
  const [open, setOpen] = useState(false);
  const pending = useGame((s) => s.city?.council?.bills.length ?? 0);
  return (
    <>
      <button
        type="button"
        className={`retro-button ${pending > 0 ? "text-amber-300" : ""}`}
        onClick={() => setOpen(true)}
        title={pending > 0 ? `Câmara de vereadores: ${pending} projeto(s) esperando sua decisão` : "Câmara de vereadores"}
        aria-label="Câmara de vereadores"
      >
        <Gavel />
        {pending > 0 && <span className="ml-0.5">{pending}</span>}
      </button>
      {open && <CouncilModal onClose={() => setOpen(false)} />}
    </>
  );
}

const Tag = ({ party }: { party: PartyId }) => (
  <span className="inline-block rounded-sm px-1 text-[10px] font-bold text-black" style={{ background: PARTIES[party].color }} title={PARTIES[party].name}>
    {PARTIES[party].short}
  </span>
);

function CouncilModal({ onClose }: { onClose: () => void }) {
  const city = useGame((s) => s.city);
  const phase = useGame((s) => s.phase);
  const [showAll, setShowAll] = useState(false);
  if (!city) return null;
  const c = city.council;
  const locked = phase === "focus";
  const left = cyclesToElection(city);
  const fa = fascistSeats(c);
  const coupAt = Math.ceil((fa.total * 2) / 3);
  const seats = Object.fromEntries(PARTY_IDS.map((p) => [p, c.members.filter((m) => m.party === p).length])) as Record<PartyId, number>;
  const decide = (id: number, approve: boolean) => useGame.getState().queue({ type: "bill", id, approve });
  const repeal = (law: LawId) => useGame.getState().queue({ type: "repeal", law });

  return (
    <div className="pointer-events-auto fixed inset-0 z-10 flex items-center justify-center bg-black/60 p-3">
      <section className="retro-panel flex max-h-[90dvh] w-full max-w-3xl flex-col text-xs">
        <header className="retro-title flex">
          Câmara de vereadores
          <button type="button" className="ml-auto" aria-label="Fechar" onClick={onClose}>
            <Xmark />
          </button>
        </header>
        <div className="min-h-0 space-y-3 overflow-y-auto p-3">
          {locked && <p className="text-red-300">Em foco: as decisões só valem na pausa.</p>}

          {fa.fascist > 0 && (
            <p className={`border p-2 ${fa.fascist * 2 >= fa.total ? "border-red-500 bg-red-950/50 text-red-200" : "border-amber-600 text-amber-200"}`} role="alert">
              ☠ O Fascista tem <strong>{fa.fascist} de {fa.total}</strong> cadeiras. Com <strong>{coupAt}</strong> (dois terços), dá o golpe e o jogo acaba. Reduza a crise antes da próxima eleição
              (em {left} ciclo(s)).
            </p>
          )}
          <div className="space-y-1 border border-zinc-700 p-2">
            <strong>Negócios dos moradores</strong>
            <p>
              🏪 <strong>{city.business?.entrepreneurs ?? 0}</strong> empreendedores<span className="hidden sm:inline"> (imposto, mas quebram fácil; a direita os apoia)</span> · 🤝{" "}
              <strong>{city.business?.coops ?? 0}</strong> cooperados<span className="hidden sm:inline"> (rendem menos, resistem à crise; a esquerda os apoia)</span>
            </p>
            <p className="hidden text-zinc-400 sm:block">
              Abrem negócio os moradores sem vaga e uma parte dos empregados (autônomos). Força das leis em vigor: empreendedorismo {lawEntrepreneur(city).toFixed(1)} · cooperativismo {lawCoop(city).toFixed(1)}. Leis
              marcadas com 🏪 ou 🤝 aumentam esses números.
            </p>
          </div>
          {c.members.length === 0 ? (
            <p className="text-zinc-400">A cidade ainda é pequena demais para ter câmara. Com 30 moradores acontece a primeira eleição.</p>
          ) : (
            <div className="space-y-1 border border-zinc-700 p-2">
              <strong>Vereadores eleitos</strong>
              <p className="text-zinc-400">
                Mandato de 4 anos ({TERM_CYCLES} ciclos): próxima eleição em <strong className="text-amber-300">{left}</strong> ciclo(s). Os vereadores são moradores da cidade e votam pelas
                condições em que vivem.
              </p>
              <p className="flex justify-between text-[10px] uppercase tracking-wider text-zinc-500">
                <span>← esquerda</span>
                <span>direita →</span>
              </p>
              <div className="flex overflow-hidden border border-zinc-700">
                {PARTY_IDS.filter((p) => seats[p] > 0).map((p) => (
                  <div key={p} className="h-3" style={{ width: `${(seats[p] / c.members.length) * 100}%`, background: PARTIES[p].color }} title={`${PARTIES[p].name}: ${seats[p]} cadeira(s)`} />
                ))}
              </div>
              <ul className="grid gap-x-3 sm:grid-cols-2">
                {c.members.map((m) => (
                  <li key={m.id} className="flex items-center gap-1">
                    <Tag party={m.party} />
                    <span className="truncate">{citizenProfile(city, m.id).name}</span>
                    <span className="text-zinc-500">{Math.floor(ageOfCitizen(city, m.id))} anos</span>
                  </li>
                ))}
              </ul>
              <p className="text-zinc-400">
                {PARTY_IDS.filter((p) => seats[p] > 0)
                  .map((p) => `${PARTIES[p].short} ${seats[p]}`)
                  .join(" · ")}
              </p>
            </div>
          )}

          <div className="space-y-1 border border-zinc-700 p-2">
            <strong>Projetos de lei ({c.bills.length})</strong>
            {c.bills.length === 0 && <p className="text-zinc-400">Nenhum projeto na pauta. A câmara propõe uma lei nova a cada ciclo.</p>}
            {c.bills.map((b) => (
              <div key={b.id} className="space-y-1 border border-zinc-600 bg-zinc-900/50 p-2">
                <p>
                  <Tag party={b.party} /> <strong>{LAWS[b.law].name}</strong> <FinChip id={b.law} />{LAWS[b.law].entrepreneur ? " 🏪" : ""}{LAWS[b.law].coop ? " 🤝" : ""}
                </p>
                <p className="text-zinc-300">{LAWS[b.law].description}</p>
                <p className="text-zinc-500">
                  Proposto por {citizenProfile(city, b.proposer).name} · ciclo {b.cycle}
                </p>
                <div className="flex gap-1 [&>button]:flex-1 sm:[&>button]:flex-none">
                  <button type="button" className="retro-button retro-button-primary" disabled={locked} onClick={() => decide(b.id, true)}>
                    ✔ Aprovar
                  </button>
                  <button type="button" className="retro-button" disabled={locked} onClick={() => decide(b.id, false)}>
                    ✖ Vetar
                  </button>
                </div>
              </div>
            ))}
            {c.bills.length >= 3 && <p className="text-amber-300">A pauta está cheia: o projeto mais antigo é arquivado quando chegar outro.</p>}
          </div>

          <div className="space-y-1 border border-zinc-700 p-2">
            <strong>Leis em vigor ({c.laws.length})</strong>
            {c.laws.length === 0 && <p className="text-zinc-400">Nenhuma lei aprovada ainda.</p>}
            {c.laws.map((id) => (
              <div key={id} className="flex flex-col gap-1 border-t border-zinc-800 pt-1 sm:flex-row sm:items-start sm:gap-2 sm:border-0 sm:pt-0">
                <div className="min-w-0 flex-1">
                  <p>
                    <Tag party={LAWS[id].party} /> <strong>{LAWS[id].name}</strong> <FinChip id={id} />{LAWS[id].entrepreneur ? " 🏪" : ""}{LAWS[id].coop ? " 🤝" : ""}
                  </p>
                  <p className="text-zinc-400">{LAWS[id].description}</p>
                </div>
                <button type="button" className="retro-button shrink-0 self-start" disabled={locked} onClick={() => repeal(id)} title="Revoga a lei (o partido perde prestígio)">
                  Revogar
                </button>
              </div>
            ))}
          </div>

          <div className="space-y-1 border border-zinc-700 p-2">
            <strong>Partidos e prestígio com o prefeito</strong>
            {PARTY_IDS.filter((p) => !PARTIES[p].crisisOnly || seats[p] > 0 || c.standing[p] !== 0).map((p) => (
              <p key={p}>
                <Tag party={p} /> {PARTIES[p].name}: <span className={c.standing[p] > 0 ? "text-emerald-300" : c.standing[p] < 0 ? "text-red-300" : ""}>{c.standing[p] > 0 ? "+" : ""}{c.standing[p]}</span>
                <span className="text-zinc-500"> — {PARTIES[p].ideology}</span>
              </p>
            ))}
            <p className="text-zinc-400">
              O <strong>Fascista</strong> só disputa a eleição em tempos de crise (greve geral, caixa no vermelho, desastre, desemprego, povo triste ou bairros perigosos). Cada partido propõe
              leis do próprio espectro, favorecendo o que a cidade está precisando.
            </p>
            <p className="text-zinc-400">Lei aprovada dá +1 de prestígio ao partido; veto ou revogação dá −1. Quem tem prestígio ganha votos na eleição.</p>
          </div>

          <div className="space-y-1 border border-zinc-700 p-2">
            <button type="button" className="retro-button" onClick={() => setShowAll((v) => !v)}>
              {showAll ? "Esconder" : "Ver"} histórico
            </button>
            {showAll && (
              <ul className="space-y-0.5">
                {[...c.history].reverse().map((h, i) => (
                  <li key={i} className="text-zinc-300">
                    <span className="text-zinc-500">ciclo {h.cycle}</span> — {h.text}
                  </li>
                ))}
                {c.history.length === 0 && <li className="text-zinc-500">Sem registros.</li>}
              </ul>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

/** Marca de resultado financeiro da lei: rende/economiza ou custa/reduz a receita. */
function FinChip({ id }: { id: LawId }) {
  const pos = lawFinance(id) === "positiva";
  return (
    <span
      className={`border px-1 text-[10px] ${pos ? "border-emerald-700 text-emerald-300" : "border-red-800 text-red-300"}`}
      title={pos ? "Financeiramente positiva: rende ou economiza dinheiro" : "Financeiramente negativa: custa dinheiro ou reduz a receita"}
    >
      {pos ? "💰 rende" : "💸 custa"}
    </span>
  );
}
