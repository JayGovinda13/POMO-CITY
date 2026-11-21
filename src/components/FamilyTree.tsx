"use client";

import { familyOf, type FamilyMember } from "@/sim";
import { useGame } from "@/store/game";
import { Xmark } from "./icons";

/** Uma pessoa da árvore: nome, idade e se está viva. */
function Person({ m, you = false }: { m: FamilyMember; you?: boolean }) {
  return (
    <div
      className={`min-w-[7rem] border-2 px-2 py-1 text-center ${you ? "border-amber-400 bg-amber-950/40" : m.alive ? "border-zinc-600 bg-zinc-800" : "border-zinc-700 bg-zinc-900 text-zinc-500"}`}
      title={m.alive ? `${m.age} anos` : m.away ? "Mudou-se da cidade" : `Faleceu aos ${m.diedAt} anos`}
    >
      <p className="font-bold">
        {m.gender === "f" ? "♀" : "♂"} {m.name}
      </p>
      <p className="text-[10px]">{m.alive ? `${m.age} anos` : m.away ? "mudou-se" : `† aos ${m.diedAt}`}</p>
    </div>
  );
}

function Row({ title, people }: { title: string; people: FamilyMember[] }) {
  if (!people.length) return null;
  return (
    <div className="space-y-1">
      <p className="text-center text-[10px] uppercase tracking-wider text-zinc-400">{title}</p>
      <div className="flex flex-wrap justify-center gap-2">
        {people.map((p) => (
          <Person key={p.id} m={p} />
        ))}
      </div>
    </div>
  );
}

/** Árvore genealógica de um morador: avós → pais → ele(a) e o(a) parceiro(a) → filhos → netos. */
export function FamilyTreeModal({ id, onClose }: { id: number; onClose: () => void }) {
  const city = useGame((s) => s.city);
  const tree = city ? familyOf(city, id) : null;
  return (
    <div className="pointer-events-auto fixed inset-0 z-20 flex items-center justify-center bg-black/70 p-3">
      <section className="retro-panel flex max-h-[90dvh] w-full max-w-3xl flex-col text-xs">
        <header className="retro-title flex">
          Árvore genealógica{tree ? ` — ${tree.self.name}` : ""}
          <button type="button" className="ml-auto" aria-label="Fechar" onClick={onClose}>
            <Xmark />
          </button>
        </header>
        <div className="min-h-0 space-y-3 overflow-y-auto p-3">
          {!tree && <p className="text-zinc-400">Sem registros desta família.</p>}
          {tree && (
            <>
              <Row title="Avós" people={tree.grandparents} />
              <Row title="Pais" people={tree.parents} />
              <div className="space-y-1">
                <p className="text-center text-[10px] uppercase tracking-wider text-zinc-400">{tree.partner ? "Ele(a) e o(a) parceiro(a)" : "Ele(a)"}</p>
                <div className="flex flex-wrap justify-center gap-2">
                  <Person m={tree.self} you />
                  {tree.partner && <Person m={tree.partner} />}
                  {tree.siblings.map((p) => (
                    <Person key={p.id} m={p} />
                  ))}
                </div>
                {tree.siblings.length > 0 && <p className="text-center text-[10px] text-zinc-500">(à direita do(a) parceiro(a): irmãos)</p>}
              </div>
              <Row title="Filhos" people={tree.children} />
              <Row title="Netos" people={tree.grandchildren} />
              {!tree.parents.length && !tree.children.length && !tree.partner && !tree.siblings.length && (
                <p className="text-center text-zinc-400">Chegou sozinho(a) à cidade. A família começa aqui.</p>
              )}
              <p className="text-center text-zinc-500">Quem morreu aparece apagado, enquanto houver parentes vivos na cidade.</p>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
