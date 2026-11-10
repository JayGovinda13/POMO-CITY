"use client";

import { useMemo, useState } from "react";
import {
  BOND_VALUE,
  DEFAULT_TAX,
  DEPARTMENT_NAMES,
  MAX_TAX,
  ORDINANCES,
  ORDINANCE_IDS,
  ZONES,
  annualInterest,
  cityValue,
  creditRating,
  debtOf,
  resolveCycle,
  yearOfCycle,
  type CityState,
  type CycleReport,
  type Department,
  type OrdinanceId,
  type ZoneKind,
} from "@/sim";
import { useGame } from "@/store/game";

type Tab = "impostos" | "decretos" | "titulos" | "caixa";

/** Botão "Orçamento" na barra superior. */
export function BudgetButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="retro-button" onClick={() => setOpen(true)} title="Impostos, verbas, decretos, títulos e livro-caixa">
        🏛 Orçamento
      </button>
      {open && <BudgetModal onClose={() => setOpen(false)} />}
    </>
  );
}

function BudgetModal({ onClose }: { onClose: () => void }) {
  const city = useGame((s) => s.city);
  const [tab, setTab] = useState<Tab>("impostos");
  if (!city) return null;
  const tabs: { id: Tab; label: string }[] = [
    { id: "impostos", label: "Impostos e verbas" },
    { id: "decretos", label: "Decretos" },
    { id: "titulos", label: "Títulos" },
    { id: "caixa", label: "Livro-caixa" },
  ];
  return (
    <div className="pointer-events-auto fixed inset-0 z-10 grid place-items-center bg-black/60 p-3">
      <section className="retro-panel flex max-h-[90dvh] w-full max-w-2xl flex-col text-xs">
        <header className="retro-title flex">
          Orçamento da prefeitura — caixa ${city.money}
          <button type="button" className="ml-auto" aria-label="Fechar" onClick={onClose}>
            ✕
          </button>
        </header>
        <div className="flex flex-wrap gap-1 p-2">
          {tabs.map((t) => (
            <button key={t.id} type="button" className={`retro-button ${tab === t.id ? "retro-button-active" : ""}`} onClick={() => setTab(t.id)}>
              {t.label}
            </button>
          ))}
        </div>
        <div className="min-h-0 overflow-y-auto p-3">
          {tab === "impostos" && <TaxesTab city={city} />}
          {tab === "decretos" && <OrdinancesTab city={city} />}
          {tab === "titulos" && <BondsTab city={city} />}
          {tab === "caixa" && <LedgerTab city={city} />}
        </div>
      </section>
    </div>
  );
}

const locked = () => useGame.getState().phase === "focus";

function Slider({ label, value, min, max, step, onChange, hint }: { label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void; hint?: string }) {
  return (
    <label className="flex items-center gap-2">
      <span className="w-44 shrink-0">{label}</span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="flex-1" />
      <span className="w-10 text-right tabular-nums">{value}%</span>
      {hint && <span className="w-28 text-zinc-400">{hint}</span>}
    </label>
  );
}

function TaxesTab({ city }: { city: CityState }) {
  const [taxes, setTaxes] = useState(city.taxes);
  const [funding, setFunding] = useState(city.funding);
  const dirty = JSON.stringify(taxes) !== JSON.stringify(city.taxes) || JSON.stringify(funding) !== JSON.stringify(city.funding);
  const worn = city.buildings.filter((b) => b.type === "road" && (b.condition ?? 100) < 100).length;
  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <h3 className="text-zinc-400">Impostos por zona (padrão {DEFAULT_TAX}%)</h3>
        {(["R", "C", "I"] as ZoneKind[]).map((k) => (
          <Slider
            key={k}
            label={ZONES[k].name}
            value={taxes[k]}
            min={0}
            max={MAX_TAX}
            step={1}
            onChange={(v) => setTaxes({ ...taxes, [k]: v })}
            hint={taxes[k] > DEFAULT_TAX ? "↓ demanda" : taxes[k] < DEFAULT_TAX ? "↑ demanda" : ""}
          />
        ))}
        <p className="text-zinc-500">Imposto alto arrecada mais, mas espanta moradores, comércio ou indústria.</p>
      </div>
      <div className="space-y-1">
        <h3 className="text-zinc-400">Verba dos departamentos</h3>
        {(["transport", "energy"] as Department[]).map((d) => (
          <Slider key={d} label={DEPARTMENT_NAMES[d]} value={funding[d]} min={0} max={100} step={10} onChange={(v) => setFunding({ ...funding, [d]: v })} />
        ))}
        <p className="text-zinc-500">
          Verba menor reduz a manutenção paga. Estradas sem verba se desgastam e, danificadas, deixam de conectar; usinas geram
          menos. {worn > 0 && <span className="text-amber-300">{worn} trecho(s) de estrada com desgaste.</span>}
        </p>
      </div>
      <button
        type="button"
        className="retro-button retro-button-primary"
        disabled={!dirty || locked()}
        onClick={() => useGame.getState().queue({ type: "budget", taxes, funding })}
      >
        Aplicar (vale a partir do próximo ciclo)
      </button>
    </div>
  );
}

function OrdinancesTab({ city }: { city: CityState }) {
  const groups = [...new Set(ORDINANCE_IDS.map((id) => ORDINANCES[id].category))];
  return (
    <div className="space-y-3">
      {groups.map((g) => (
        <div key={g}>
          <h3 className="mb-1 text-zinc-400">{g}</h3>
          <ul className="space-y-1">
            {ORDINANCE_IDS.filter((id) => ORDINANCES[id].category === g).map((id) => (
              <OrdinanceRow key={id} id={id} city={city} />
            ))}
          </ul>
        </div>
      ))}
      <p className="text-zinc-500">Valores estimados por ciclo para a cidade de hoje; crescem com a população.</p>
    </div>
  );
}

function OrdinanceRow({ id, city }: { id: OrdinanceId; city: CityState }) {
  const def = ORDINANCES[id];
  const active = city.ordinances[id] !== undefined;
  const money = def.money(city);
  return (
    <li className="flex items-start gap-2 border-2 border-zinc-700 p-1">
      <input
        type="checkbox"
        className="mt-0.5"
        checked={active}
        disabled={locked()}
        aria-label={def.name}
        onChange={(e) => useGame.getState().queue({ type: "ordinance", id, active: e.target.checked })}
      />
      <span className="flex-1">
        <strong>{def.name}</strong>
        <span className="block text-zinc-400">{def.description}</span>
      </span>
      <span className={money >= 0 ? "text-emerald-300" : "text-red-300"}>
        {money >= 0 ? "+" : "−"}${Math.abs(money)}/ciclo
      </span>
    </li>
  );
}

function BondsTab({ city }: { city: CityState }) {
  const credit = creditRating(city);
  return (
    <div className="space-y-2">
      <p>
        Rating de crédito: <strong className="text-sm">{credit.rating}</strong> · valor da cidade ${cityValue(city)} · dívida ${debtOf(city)}
      </p>
      <p className="text-zinc-400">
        Cada título rende ${BOND_VALUE} na hora. Juros de {(credit.rate * 100).toFixed(0)}% ao ano para um título novo, cobrados no fim
        de cada ano (a cada 4 ciclos). Quanto mais dívida em relação ao valor da cidade, pior o rating e mais caros os juros.
      </p>
      {city.bonds.length > 0 && (
        <table className="w-full text-left">
          <thead className="text-zinc-400">
            <tr>
              <th className="font-normal">Título</th>
              <th className="font-normal">Valor</th>
              <th className="font-normal">Juros/ano</th>
              <th className="font-normal">Emitido em</th>
            </tr>
          </thead>
          <tbody>
            {city.bonds.map((b) => (
              <tr key={b.id}>
                <td>#{b.id}</td>
                <td>${b.principal}</td>
                <td>{(b.rate * 100).toFixed(0)}%</td>
                <td>{yearOfCycle(b.issuedCycle + (city.calendarOffset ?? 0))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <p>Juros do próximo ano: ${annualInterest(city)}</p>
      <div className="flex gap-2">
        <button
          type="button"
          className="retro-button retro-button-primary"
          disabled={locked() || city.bonds.length >= credit.maxBonds}
          onClick={() => useGame.getState().queue({ type: "bond", action: "issue" })}
        >
          Emitir título (+${BOND_VALUE})
        </button>
        <button
          type="button"
          className="retro-button"
          disabled={locked() || !city.bonds.length || city.money < (city.bonds[0]?.principal ?? Infinity)}
          onClick={() => useGame.getState().queue({ type: "bond", action: "repay" })}
        >
          Quitar o mais antigo
        </button>
      </div>
      {city.bonds.length >= credit.maxBonds && <p className="text-amber-300">Com rating {credit.rating}, o banco não empresta mais.</p>}
    </div>
  );
}

const FIN_ROWS: { key: keyof CycleReport["finance"]; label: string; sign: 1 | -1 }[] = [
  { key: "taxR", label: "Impostos residenciais", sign: 1 },
  { key: "taxC", label: "Impostos comerciais", sign: 1 },
  { key: "taxI", label: "Impostos industriais", sign: 1 },
  { key: "ordinanceRevenue", label: "Decretos (receita)", sign: 1 },
  { key: "sales", label: "Vendas ao mercado", sign: 1 },
  { key: "upkeepTransport", label: "Manutenção: transportes", sign: -1 },
  { key: "upkeepEnergy", label: "Manutenção: energia", sign: -1 },
  { key: "upkeepOther", label: "Manutenção: outros", sign: -1 },
  { key: "ordinanceCost", label: "Decretos (custo)", sign: -1 },
  { key: "imports", label: "Compras automáticas", sign: -1 },
  { key: "interest", label: "Juros dos títulos", sign: -1 },
];

function LedgerTab({ city }: { city: CityState }) {
  const last = useGame((s) => s.lastReport);
  // A simulação é determinística: a projeção é o próprio próximo ciclo, simulado com a cidade de agora.
  const projection = useMemo(() => resolveCycle(city, Date.now()).report, [city]);
  const cols = [
    { title: "Último ciclo", r: last },
    { title: "Próximo ciclo (projeção)", r: projection },
  ];
  return (
    <div className="space-y-2">
      <table className="w-full text-right">
        <thead className="text-zinc-400">
          <tr>
            <th className="text-left font-normal">Categoria</th>
            {cols.map((c) => (
              <th key={c.title} className="font-normal">
                {c.title}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {FIN_ROWS.map((row) => (
            <tr key={row.key}>
              <td className="text-left">{row.label}</td>
              {cols.map((c) => {
                const v = c.r?.finance?.[row.key] ?? 0;
                return (
                  <td key={c.title} className={v ? (row.sign > 0 ? "text-emerald-300" : "text-red-300") : "text-zinc-600"}>
                    {c.r ? `${row.sign > 0 ? "+" : "−"}$${v}` : "—"}
                  </td>
                );
              })}
            </tr>
          ))}
          <tr className="border-t border-zinc-600 font-bold">
            <td className="text-left">Saldo</td>
            {cols.map((c) => (
              <td key={c.title} className={(c.r?.netMoney ?? 0) >= 0 ? "text-emerald-300" : "text-red-300"}>
                {c.r ? `${c.r.netMoney >= 0 ? "+" : ""}$${c.r.netMoney}` : "—"}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
      <p className="text-zinc-500">
        A projeção é exata se nada mudar até o fim do próximo ciclo (obras, políticas e decretos pendentes já entram nela).
      </p>
    </div>
  );
}
