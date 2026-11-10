# POMO-CITY

City-builder isométrico em pixel art (estética anos 90) movido a ciclos Pomodoro.
O foco no mundo real gera o combustível da cidade: cada ciclo de 25 min concluído
extrai recursos, e a **sequência de ciclos sem abandono** define a pureza do lote (Ranks D → S).

## Rodando

```bash
npm install
npm run dev          # http://localhost:3000
npm test             # testes da simulação
```

Para testar rápido, encurte o foco: `FOCUS_SECONDS=10 npm run dev`.

Sem configuração, o jogo roda em **modo local**: cidades em `.data/` e identidade por cookie.

## Supabase (auth + banco)

1. Crie um projeto em [supabase.com](https://supabase.com).
2. **Authentication → Sign In / Providers**: ative *Allow anonymous sign-ins* (todo jogador começa como convidado).
3. **Authentication → URL Configuration**: adicione `http://localhost:3000/auth/callback` (e a URL de produção) em *Redirect URLs*.
4. Aplique a migração `supabase/migrations/20261109000000_cities.sql`, colando-a no **SQL Editor** ou rodando:
   ```bash
   npx supabase link --project-ref SEU-PROJETO && npx supabase db push
   ```
5. Copie `.env.example` para `.env.local` e preencha a URL, a *publishable key* e a *secret key* (**Project Settings → API Keys**).

Para rodar o Supabase local com Docker: `npx supabase start` (o `supabase/config.toml` já habilita o login anônimo).

**Modelo de segurança:** o navegador só consegue **ler** a própria cidade (RLS). Toda escrita passa pelas rotas da API, que usam a chave secreta depois de validar os comandos e o tempo do ciclo. Assim, nem o console nem a chave pública permitem forjar dinheiro ou Rank S. Cada ciclo concluído ou abandonado também é registrado em `cycle_log` para auditoria.

## Como jogar

0. Na tela inicial, **Continuar** ou **Novo jogo**. Ao fundar, escolha **sua região** (mesmo clima e
   estações que você vive) ou **outra parte do mundo**. Só o clima é usado; o mapa é fictício.

1. Na **pausa**, planeje a cidade:
   - **Estradas** ligadas à prefeitura.
   - **Zonas** Residencial, Comercial e Industrial: arraste para zonear uma área. Zonas densas liberam com 40 habitantes.
   - **Linhas de transmissão** e **usinas**. A prefeitura gera 12 MW; depois vêm a termelétrica (a madeira de Rank alto rende mais), a eólica e a hidrelétrica (a partir de 1902).
   - **Produção:** fazenda, madeireira, mina, serraria e fundição.
2. Clique em **Iniciar foco**. As obras feitas offline são enviadas e revalidadas pelo servidor; durante o foco a cidade fica só para leitura.
3. Ao fim do ciclo, **uma estação (3 meses) se passa**; 4 ciclos = 1 ano:
   - os lotes com estrada (a até 3 tiles), energia e demanda crescem sozinhos;
   - a extração usa o Rank do foco;
   - impostos e manutenção são cobrados.

Para sair, use **Menu → Sair** com o foco encerrado: a sequência fica guardada. Fechar o jogo
durante o foco (ou abandonar o foco) causa um **desastre**; fechar sem o menu depois de concluir
um foco causa um **desastre leve**.

O **foco acelera a cidade**: um Rank mais alto desenvolve mais lotes por ciclo.
O indicador **R/C/I** mostra que tipo de zona a cidade pede.

O roadmap completo de funcionalidades está em [`docs/ROADMAP.md`](docs/ROADMAP.md).

| Sequência | 1 | 2 | 3 | 4 | 5+ |
|-----------|---|---|---|---|----|
| Rank      | D | C | B | A | S  |

Abandonar um ciclo, ou ficar mais de 90 min sem concluir um, **reduz** a sequência em 2 (não zera).
Acima de 16 ciclos no dia, os ciclos contam mas não geram recompensa.

## Economia

Os moradores comem, usam lenha no frio e consomem bens; as obras e o crescimento dos prédios
consomem madeira, tábuas e metal. O que faltar a cidade **compra automaticamente** (dá para jogar
só com dinheiro), mas produzir sai mais barato. Recursos de Rank alto rendem mais (A = 1,3×,
S = 1,4×). Em **🏪 Mercado**, defina o que fazer com o excedente de cada recurso; armazéns e silos
ampliam o estoque.

## Orçamento

Em **🏛 Orçamento**: impostos por zona, verba de transportes e energia (estradas sem verba se
desgastam), decretos municipais, títulos (empréstimos com rating de crédito) e o livro-caixa com a
projeção exata do próximo ciclo.

## Controles

Arraste com o **botão direito** (ou use **✋ Mover**) para mover o mapa; roda do mouse = zoom. Na
primeira vez, o jogo oferece um **tutorial** (também em ☰ Menu).

## Cidadãos

Cada morador é um indivíduo com nome, retrato, casa, emprego e humor (😊 feliz, 😐 ok, ☹️ triste).
O humor depende de emprego, luz em casa, comida, desastres recentes, clima extremo e da sequência
de foco do prefeito. Veja todos em **👥** na barra superior, ou passe o mouse sobre um lote para ver
quem mora ou trabalha ali.

## Sprites (pxl)

Os sprites são código: `art/city.px.js` usa o [pxl](https://github.com/crsolver/claude-pxl) para gerar
`public/sprites/city.png` + `city.json`, carregados pelo Phaser e pelos retratos da HUD.

```bash
npm run art
```

O script procura o pxl em `~/.claude/skills/pxl-pixel-art` (ou na variável `PXL`).

## Arquitetura

```
src/sim/        Simulação TS pura e determinística (roda no cliente E no servidor)
  commands.ts   applyCommand: construir/demolir com validação
  cycle.ts      resolveCycle: extração → refino → comida/impostos → manutenção
src/server/     Persistência (repo.ts) e identidade anônima por cookie
src/app/api/    GET /city · POST /cycle/start · /cycle/complete · /cycle/abandon
src/store/      Zustand: estado do servidor + fila offline de comandos (localStorage)
src/game/       Phaser 3 (só renderização e input), carregado com next/dynamic ssr:false
src/components/ HUD retrô em React + Tailwind
```

- **Sincroniza ações, não estado:** o cliente envia a fila de comandos da pausa; o servidor os reaplica sobre o último estado válido e descarta os inválidos.
- **Timer anti-cheat:** o servidor grava `startedAt/endsAt` e recusa `/complete` antecipado (HTTP 425), início duplicado (409) e replay. No cliente, o relógio é sempre `endsAt − Date.now()`, imune ao throttling de abas.
- **Persistência:** `PlayerRepo` com duas implementações, Supabase/Postgres e arquivos locais. A gravação usa concorrência otimista (coluna `revision`): duas instâncias serverless processando o mesmo `/complete` nunca aplicam o ciclo em dobro.
- **Contas:** login anônimo automático no Supabase Auth. O convidado pode vincular um e-mail (link mágico) sem perder a cidade.

## Próximos passos

- [x] Supabase: auth anônima + e-mail, `PlayerRepo` em Postgres com RLS
- [ ] Mercado multiplayer com livro de ofertas por tipo/Rank e comerciante NPC
- [x] Fase 0 (preparação técnica) e Fase 1 (zoneamento + energia) do [roadmap](docs/ROADMAP.md)
- [ ] Fases 2–10 do roadmap (orçamento, água, serviços, transporte, eras…)
- [ ] Sprites pixel art no lugar das formas procedurais
- [ ] Galeria de arte e páginas públicas da cidade (SSR)
