"use client";

import { useEffect, useState } from "react";
import { useGame } from "@/store/game";

const ASKED_KEY = "pomo-city:tutorial-asked";

function readAsked(): boolean {
  try {
    return localStorage.getItem(ASKED_KEY) === "1";
  } catch {
    return false;
  }
}
function markAsked() {
  try {
    localStorage.setItem(ASKED_KEY, "1");
  } catch {}
}

interface Step {
  title: string;
  body: React.ReactNode;
}

const STEPS: Step[] = [
  {
    title: "Bem-vindo ao POMO-CITY",
    body: (
      <>
        <p>
          Aqui a sua cidade cresce enquanto <strong>você foca na vida real</strong>. Cada ciclo de foco Pomodoro (25 min de trabalho ou
          estudo) faz a cidade viver <strong>uma estação</strong> (3 meses): ela produz, cobra impostos e cresce.
        </p>
        <p>Nas pausas, você vira prefeito: constrói, planeja e decide.</p>
      </>
    ),
  },
  {
    title: "O ciclo: foco e pausa",
    body: (
      <>
        <p>
          Quando a pausa acaba, o <strong>foco começa sozinho</strong> (ou clique em <strong>Focar agora</strong>) — vá trabalhar. Durante o foco a cidade fica só para olhar — obras ficam bloqueadas.
        </p>
        <p>
          Ao terminar, aparece o <strong>relatório do ciclo</strong> e começa a <strong>pausa</strong> (5 min, ou 20 min a cada 4 ciclos):
          a hora de gerenciar a cidade. O relógio é conferido pelo servidor, então não dá para adiantar.
        </p>
      </>
    ),
  },
  {
    title: "Sequência e Rank (D a S)",
    body: (
      <>
        <p>
          Ciclos seguidos sem abandonar formam a <strong>sequência</strong>, que define a pureza dos recursos do ciclo: D, C, B, A e
          até <strong>S</strong>. Recursos de Rank alto rendem mais (A = 1,3×, S = 1,4×) e algumas construções exigem Rank S.
        </p>
        <p>
          Foco e pausa se alternam <strong>sozinhos</strong>. Na pausa você pode sair quando quiser, sem prejuízo. Abandonar o foco ou
          fechar o jogo no meio dele causa um <strong>desastre</strong> (bloquear o celular e voltar até 15 min depois do fim do foco
          não conta). Ao voltar a um jogo salvo, a sequência recomeça do primeiro ciclo: recursos Rank D.
        </p>
      </>
    ),
  },
  {
    title: "Construindo a cidade",
    body: (
      <>
        <p>
          Faça <strong>estradas</strong> saindo da prefeitura e <strong>arraste</strong> para criar zonas: <strong>Residencial</strong>{" "}
          (moradia), <strong>Comercial</strong> e <strong>Industrial</strong> (empregos). Os prédios nascem sozinhos quando há demanda
          (barras R/C/I no topo), energia e estrada a até 3 tiles.
        </p>
        <p>
          Quanto melhor o seu foco (Rank), mais lotes crescem por ciclo. Fazendas, madeireiras e minas produzem recursos; serraria e
          fundição os refinam.
        </p>
      </>
    ),
  },
  {
    title: "Energia",
    body: (
      <p>
        A prefeitura gera 20 MW. Leve energia com <strong>linhas de transmissão</strong> (elas cruzam estradas) e construa usinas:
        eólica, termelétrica (queima madeira) e hidrelétrica (na água). Se faltar energia, há <strong>apagão</strong>: lotes sem luz
        declinam e construções operam a 50%. Use a visão <strong>Energia</strong> para conferir.
      </p>
    ),
  },
  {
    title: "Recursos e mercado",
    body: (
      <p>
        Moradores comem, usam lenha no frio e consomem bens; obras gastam madeira, tábuas e metal. O que faltar a cidade{" "}
        <strong>compra automaticamente</strong> — mas produzir sai mais barato. Em <strong>Mercado</strong> você decide o que fazer
        com o excedente; armazéns e silos aumentam o estoque.
      </p>
    ),
  },
  {
    title: "Orçamento",
    body: (
      <p>
        Em <strong>Orçamento</strong>: ajuste os <strong>impostos</strong> de cada zona (alto arrecada, mas espanta), a{" "}
        <strong>verba</strong> de transportes e energia (sem verba, estradas se desgastam), ative <strong>decretos</strong>, emita{" "}
        <strong>títulos</strong> (empréstimos) e veja no <strong>livro-caixa</strong> a projeção exata do próximo ciclo.
      </p>
    ),
  },
  {
    title: "Moradores, clima e estações",
    body: (
      <>
        <p>
          Cada morador (botão <strong>Moradores</strong>) tem nome, emprego e humor (😊 😐 ☹️). Emprego, luz, comida e o seu foco os deixam felizes;
          cidades felizes atraem mais gente.
        </p>
        <p>
          A cidade vive o clima da região escolhida: o painel <strong>Previsão</strong> mostra a próxima estação — inverno rende pouca
          colheita, seca derruba a hidrelétrica.
        </p>
      </>
    ),
  },
  {
    title: "Câmera e controles",
    body: (
      <p>
        Mova o mapa <strong>arrastando com o botão direito</strong> do mouse ou com a ferramenta <strong>✋ Mover</strong> (no celular,
        use ela). A <strong>roda do mouse</strong> dá zoom. Passe o mouse sobre qualquer lote para ver detalhes e quem mora ali. Bom foco!
      </p>
    ),
  },
];

/** Pergunta uma vez se o jogador quer o tutorial; o tutorial também abre pelo menu. */
export function Tutorial() {
  const city = useGame((s) => s.city);
  const open = useGame((s) => s.tutorialOpen);
  const setOpen = useGame((s) => s.setTutorialOpen);
  const [ask, setAsk] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    // Só pergunta depois de a cidade ter sido fundada (o seletor de região vem antes).
    if (city?.regionId && !readAsked()) setAsk(true);
  }, [city?.regionId]);

  useEffect(() => {
    if (open) setStep(0);
  }, [open]);

  if (ask && !open) {
    return (
      <div className="pointer-events-auto fixed inset-0 z-20 flex items-center justify-center bg-black/60 p-4">
        <section className="retro-panel w-full max-w-sm text-xs" role="dialog" aria-labelledby="tutorial-ask">
          <header id="tutorial-ask" className="retro-title">
            Primeira vez por aqui?
          </header>
          <div className="space-y-3 p-3">
            <p>Quer um tutorial rápido explicando o que é o POMO-CITY e como jogar?</p>
            <div className="flex gap-2">
              <button
                type="button"
                className="retro-button retro-button-primary flex-1"
                onClick={() => {
                  markAsked();
                  setAsk(false);
                  setOpen(true);
                }}
              >
                Sim, me mostre
              </button>
              <button
                type="button"
                className="retro-button flex-1"
                onClick={() => {
                  markAsked();
                  setAsk(false);
                }}
              >
                Não, obrigado
              </button>
            </div>
            <p className="text-zinc-500">Você pode abrir o tutorial depois no Menu.</p>
          </div>
        </section>
      </div>
    );
  }

  if (!open) return null;
  const s = STEPS[step];
  const last = step === STEPS.length - 1;
  return (
    <div className="pointer-events-auto fixed inset-0 z-20 flex items-center justify-center bg-black/60 p-4">
      <section className="retro-panel w-full max-w-md text-xs" role="dialog" aria-labelledby="tutorial-title">
        <header id="tutorial-title" className="retro-title flex">
          {s.title}
          <span className="ml-auto text-zinc-300">
            {step + 1}/{STEPS.length}
          </span>
        </header>
        <div className="space-y-2 p-3 leading-relaxed">
          {s.body}
          <div className="flex gap-2 pt-2">
            <button type="button" className="retro-button" onClick={() => setOpen(false)}>
              Pular
            </button>
            <button type="button" className="retro-button ml-auto" disabled={step === 0} onClick={() => setStep(step - 1)}>
              ◀ Anterior
            </button>
            <button
              type="button"
              className="retro-button retro-button-primary"
              onClick={() => (last ? setOpen(false) : setStep(step + 1))}
            >
              {last ? "Começar a jogar" : "Próximo ▶"}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
