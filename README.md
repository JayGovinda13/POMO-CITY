# POMO-CITY

City-builder isométrico em pixel art (estética anos 90) movido a ciclos Pomodoro.
O foco no mundo real gera o combustível da cidade: cada ciclo de 25 min concluído
extrai recursos, e a **sequência de ciclos sem abandono** define a pureza do lote (Ranks D → S).

Criado por Juliano Amaral, Juba ou Jay Govinda. Jay Jay Sri Radhe!

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
   Dê um **nome à sua cidade** (dá para renomear depois em ☰ Menu → Renomear a cidade). O nome
   aparece na barra superior, na tela inicial e no jornal.

1. Na **pausa**, planeje a cidade:
   - **Estradas** ligadas à prefeitura.
   - **Zonas** Residencial, Comercial e Industrial: arraste para zonear uma área. Zonas densas liberam com 40 habitantes.
   - **Linhas de transmissão** e **usinas**. A prefeitura gera 20 MW; depois vêm a termelétrica (a madeira de Rank alto rende mais), a eólica e a hidrelétrica (a partir de 1902).
   - **Produção:** fazenda, madeireira, mina, serraria e fundição.
2. Quando a pausa acaba, o **foco começa sozinho** (ou clique em **Focar agora**). As obras da pausa são enviadas e revalidadas pelo servidor; durante o foco a cidade fica só para leitura.
3. Ao fim do ciclo, **uma estação (3 meses) se passa**; 4 ciclos = 1 ano:
   - os lotes com estrada (a até 3 tiles), energia e demanda crescem sozinhos;
   - a extração usa o Rank do foco;
   - impostos e manutenção são cobrados.

**Foco e pausa se alternam sozinhos.**

- Na **pausa** você pode sair quando quiser, sem prejuízo.
- **Abandonar o foco**, ou fechar o jogo no meio dele, causa um **desastre** e a sequência cai.
- **Bloquear o celular** durante o foco não conta como sair, desde que você volte até 15 minutos
  depois do fim do foco. O servidor conclui o ciclo normalmente.
- **Ao voltar a um jogo salvo** (Continuar), a sequência recomeça do primeiro ciclo: os recursos
  saem com Rank D.

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

## Recursos

- O ícone 📦 na barra superior mostra quanto há de cada recurso: 🌾 comida, 🪵 madeira,
  🪨 minério, 🪚 tábuas, ⚙️ metal e 🛍️ bens.
- Clicando nele, aparece a previsão da próxima estação:
  - quanto a cidade produz e consome de cada um;
  - por quantas estações o estoque aguenta;
  - quanto custaria importar o que falta.
- Cada construção mostra o custo em recursos: verde se há no estoque, vermelho se falta.
- O que falta é importado, e o preço sobe nas crises de clima. Produzir na cidade protege o caixa.

## Terreno (Fase 9)

- Cidades novas têm mapa 40×40, desenhado no editor da fundação: relevo, rio, lagos, mar e mata.
- Ferramentas ⛰️: elevar e rebaixar terreno, criar água, aterrar e plantar árvores. Ficam mais
  baratas com foco de Rank alto.
- Vias sobem 1 nível por rampa; para mais, use túnel.
- Sobre a água, vias viram ponte.
- Dessalinizadora no litoral e marina à beira d'água.

## Tecnologia, eventos e ranking

- **Árvore tecnológica (1900–2100)**: 36 tecnologias em 6 eras (Industrial, Elétrica, Atômica, Digital,
  Verde e Futuro). Cada ciclo de foco gera pontos de pesquisa (educação da população, escolas,
  faculdades, bibliotecas e museus, multiplicados pelo Rank). Cada tecnologia tem ano mínimo e
  pré-requisitos, dá bônus permanentes (comida, energia, impostos, saúde…) e algumas liberam
  construções: usina solar, usina nuclear, centro de reciclagem e reator de fusão. Botão ⚛ na barra.
- **Eventos aleatórios**: a cada ciclo há 15% de chance de um evento (feira, mecenas, jazida,
  festival, imigração, gripe, greve, onda de calor, ratos) ou de um desafio com prazo e prêmio.
  São determinísticos (semente da cidade) e saem no jornal.
- **Ranking online** (🏆): as 50 cidades mais avançadas. Pontos = tecnologias + população + valor da
  cidade. **Só disputa a cidade que nunca sofreu catástrofe (ciclo quebrado)**: depois da primeira,
  ela sai do ranking para sempre — dá para continuar jogando, mas o recorde só vale em cidade nova.
  O ranking mostra apenas o nome da cidade e a região. No Supabase, exige a migration
  `supabase/migrations/20261112000000_leaderboard.sql`.

## Orçamento

Em **🏛 Orçamento**: impostos por zona, verba de transportes e energia (estradas sem verba se
desgastam), decretos municipais, títulos (empréstimos com rating de crédito) e o livro-caixa com a
projeção exata do próximo ciclo.

## Controles

Arraste com o **botão direito** (ou use **✋ Mover**) para mover o mapa; roda do mouse = zoom. Na
primeira vez, o jogo oferece um **tutorial** (também em ☰ Menu).

## Jornal, anúncios e doações

A cada ciclo concluído sai uma edição do **jornal da cidade** (manchete, notícias, a fala de um
morador e o resumo da estação). O jogo está pronto para **Google AdSense** (tela inicial e jornal)
e tem um botão **💝 Apoiar** com **Pix** (QR Code gerado no navegador) e link de doação por cartão.
Tudo é ativado por variáveis de ambiente: veja [`docs/MONETIZACAO.md`](docs/MONETIZACAO.md).

## Cidadãos

Cada morador é um indivíduo com nome, retrato, casa, emprego e humor (😊 feliz, 😐 ok, ☹️ triste).
O humor depende de emprego, luz em casa, comida, desastres recentes, clima extremo e da sequência
de foco do prefeito. Veja todos em **👥** na barra superior, ou passe o mouse sobre um lote para ver
quem mora ou trabalha ali.

## Trilha sonora 16 bits

São 48 músicas originais: 8 de cada estação (Jazz, Bossa Nova, Tango, Salsa, Música Árabe e
Música Indiana). Tudo é sintetizado na hora com Web Audio, sem nenhum arquivo de áudio. O som
imita o chip dos consoles dos anos 90: ondas de pulso, piano elétrico em FM, percussão de ruído
filtrado e eco.

| Gênero | Faixas |
| --- | --- |
| Jazz | Café da Prefeitura · Blues do Pedágio · Hora do Rush · Neblina no Viaduto · Prefeito Distraído · Bonde das Seis · Lâmpadas de Gás · Ponte Levadiça |
| Bossa Nova | Garoa de Setembro · Varanda ao Entardecer · Mar de Prédios · Café com Chuva · Feira de Domingo · Sombra do Coqueiro · Bonde Azul · Luz de Poste |
| Tango | Bandoneón do Porto · Calle del Reloj · Último Bonde · Garoa Portenha · Milonga da Fábrica · Esquina Escura · Lua no Cais · Fole e Ferrugem |
| Salsa | Noite no Mercado · Mercado de Peixe · Ladeira do Sol · Calor de Janeiro · Rumba da Obra · Prefeitura en Clave · Noche de Feria · Guaguancó do Porto |
| Música Árabe | Café no Souk · Lanternas de Latão · Areia na Avenida · Minarete ao Pôr do Sol · Caravana da Periferia · Jardim de Tâmaras · Noite no Bazar · Dança do Mercado |
| Música Indiana | Monção no Bairro · Chá de Gengibre · Riquixá da Prefeitura · Templo de Pedra · Pipas no Telhado · Lua de Diwali · Feira de Especiarias · Rio Sagrado |

**Como as faixas são feitas**

- Cada faixa tem harmonia própria (16 compassos), andamento e tonalidade.
- A 1ª faixa de cada gênero tem melodia escrita à mão. As outras são compostas de forma
  determinística, então soam sempre iguais:
  - forma A–A'–B–A'';
  - notas do acorde nos tempos fortes;
  - movimento por grau;
  - cadência na tônica.
- O acompanhamento segue o ritmo de cada gênero: baixo caminhante e condução no prato no jazz,
  batida de violão na bossa, marcato e síncopa 3-3-2 no tango, tumbao, montuno e clave 2-3 na
  salsa. Algumas faixas usam outro solista ou uma variação da batida.
- **Música Árabe:**
  - maqamat Hijaz, Rast, Bayati, Nahawand, Kurd, Ajam e Saba, com quartos de tom de verdade;
  - alaúde (oud), ney ou violino sobre bordão;
  - darbuka (doum/tek) e riq nos ritmos maqsum, baladi e saidi.
- **Música Indiana:**
  - ragas Yaman, Kafi, Khamaj, Bhairav, Desh, Bhairavi, Todi e Marwa;
  - cítara (sitar) ou bansuri sobre o bordão da tanpura;
  - tabla (bayan e dayan afinado na tônica) nos talas teental e keherwa.

**Botão 🎵** (barra superior e tela inicial)

- **📻 Rádio**: todas as 48 faixas em ordem aleatória, uma volta cada. Nenhuma repete até todas
  tocarem.
- **Gênero**: as 8 faixas daquele gênero, em sequência.
- **Faixa da lista**: repete só aquela faixa.
- No modo Gênero, a faixa muda a cada duas voltas.
- Também ajusta o volume e pode silenciar a música durante o foco.
- A música começa no primeiro clique, por causa da política de autoplay do navegador.

Código em `src/audio/`: `synth.ts` (instrumentos), `tracks.ts` (catálogo, compositor e
acompanhamentos) e `player.ts` (agendador).

## Balanceamento

```bash
npm run balance
```

O comando roda um robô que joga 15 anos de cidade em vários cenários (focado, casual, fácil,
difícil, inverno rigoroso, sem produção local) e imprime a evolução ano a ano. Os achados e os
números ajustados estão em [docs/BALANCO.md](docs/BALANCO.md).

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
