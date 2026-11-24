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

- Cidades novas têm mapa 100×100 (as já fundadas continuam com o tamanho em que nasceram), desenhado no editor da fundação: relevo, rio, lagos, mar e mata.
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
  festival, imigração, onda de calor, ratos) ou de um desafio com prazo e prêmio. Três eventos têm
  causa e só acontecem quando falta algo: **incêndio** sem bombeiros (lotes perdem níveis e prédios
  ficam danificados), **gripe e peste** sem hospital (moradores morrem ou se mudam) e **greve** quando
  a população está triste (mais provável quanto mais triste).
  São determinísticos (semente da cidade) e saem no jornal.
- **Ranking online** (🏆): as 50 cidades mais avançadas. Pontos = tecnologias + população + valor da
  cidade. **Só disputa a cidade que nunca sofreu catástrofe (ciclo quebrado)**: depois da primeira,
  ela sai do ranking para sempre — dá para continuar jogando, mas o recorde só vale em cidade nova.
  O ranking mostra apenas o nome da cidade e a região. No Supabase, exige a migration
  `supabase/migrations/20261112000000_leaderboard.sql`.

## Palácio da prefeitura, eras e ambiente vivo

- **Prefeitura de 3 quadrados**: um palácio inspirado no Palácio dos Bandeirantes (SP), em linha no
  eixo x (a prefeitura + duas alas `cityhall_wing`). Não pode ser demolido; a malha viária parte de
  qualquer um dos 3 tiles. Saves antigos ganham as alas na migração (v12) — o que estiver nos dois
  tiles vizinhos é removido.
- **Cada era libera 1 nível novo nas zonas densas**: nível 4 na Era Industrial, 5 na Elétrica (1930),
  6 na Atômica (1960), 7 na Digital (1990), 8 na Verde (2030) e 9 na Era do Futuro (2070), com
  prédios próprios de cada época (R, C e I). Zonas leves continuam até o nível 2.
- **Girar a câmera**: dois botões na barra de ferramentas giram a vista em passos de 90° (4 ângulos),
  mantendo o mesmo ponto do mapa no centro; estradas, barrancos, espuma e o palácio acompanham.
- **Passeio no foco**: durante o foco a câmera acompanha um **carro** ou um **pedestre** pelas ruas
  (zoom de rua, com um marcador amarelo sobre quem é seguido). O botão 🎥 ao lado do cronômetro alterna
  Carro → Pedestre → Livre; tocar, arrastar ou dar zoom no mapa solta a câmera. Ao fim do foco a câmera
  volta ao zoom de antes. A escolha fica salva.
- **Moradores com vida própria** (durante o foco): cada morador de verdade (até 160) tem casa, emprego,
  nome e profissão, e segue uma rotina pelas ruas: sai de casa, vai ao trabalho (a pé, ou de carro se a
  rota for longa), trabalha dentro do prédio, e depois volta para casa ou passeia no parque, praça,
  zoológico, estádio, museu, biblioteca ou comércio. Sem emprego, ele passeia e volta para casa.
  O passeio da câmera mostra uma legenda com o nome e o que a pessoa faz agora.
- **Animações de ambiente** (sempre ligadas): o vento passa em rajadas pelas copas das árvores, a
  água ondula (4 quadros) e o litoral ganhou faixa de areia com espuma que vai e volta.

## Confirmar obras

Em telas de toque o jogo começa com **"Confirmar obras"** ligado (no computador, desligado; dá para
mudar no menu ☰). Cada toque ou arrasto no mapa vira uma *proposta*, já visível na cidade, e uma barra
mostra o custo com **↶ Desfazer** (último toque), **✖ Cancelar** (tudo) e **✔ Confirmar**. Só depois de
confirmar a obra entra na fila do servidor. Pesquisa, orçamento e decretos continuam valendo na hora.
Propostas não confirmadas são descartadas quando o foco começa.

## Trabalho e salário (inspirado em *O Capital*, Livro 1)

Botão 🔨 na barra superior. Por setor (campo, oficinas e fábricas) o jogador escolhe a **jornada** (6, 8,
10 ou 12 h) e a **forma de pagamento** (por tempo ou por peça):
- Jornada longa e pagamento por peça **aumentam a produção** (de −12% a +32%), mas derrubam o **humor
  dos operários do setor**, aumentam o **desgaste da cidade** (a expectativa de vida cai até 6 anos) e
  tornam a **greve** mais provável. Jornada curta rende menos e anima.
- **Automação**: as tecnologias linha de montagem, contêineres, computadores, automação industrial e
  inteligência artificial **eliminam parte dos empregos industriais** (até 55%) mantendo a produção.
  A educação (QE acima de 40) realoca até metade do efeito; o resto vira desemprego.
- **Fiscalização do Trabalho** (prédio em Serviços, a partir de 60 moradores): os fiscais seguram o dano
  das jornadas longas e do pagamento por peça (humor e desgaste pela metade), mas o ganho de produção
  acima de 8 h também cai pela metade. Prédio danificado não fiscaliza.
- **Escola-fábrica** (decreto, Orçamento → Decretos): aprendizes dividem o dia entre a escola e a oficina:
  QE alvo +10 e mais gente realocada da automação (+10%), ao custo de 8% da produção das fábricas.
- **Greves por causa** (começo de cada ciclo): uma fração dos trabalhadores para quando **não há caminho
  até o emprego**, o **trânsito está parado sem transporte público**, falta **hospital**, **escola**,
  **segurança** ou **energia**, o **ar é poluído** ou a **jornada é exaustiva**. Os grevistas não preenchem
  vagas (máx. 70%). **Quanto mais educação, maior a chance de greve e maior a produtividade** (até +25%
  com QE 140). O painel de Trabalho mostra a greve prevista e as causas; o jornal e a barra (✊) avisam.
- Fora do escopo desta etapa: poder de compra como humor (precisa de preços que variem no mercado).

## Capital e tempo (inspirado em *O Capital*, Livro 2)

- **Obras longas:** construções caras levam ciclos para ficar prontas — usina hidrelétrica 1, solar e
  porto 2, aeroporto e usina nuclear 3, reator de fusão 4 (o tempo segue o custo). Em obra o prédio
  não opera nem contrata, aparece translúcido e o dinheiro fica **parado**: em vez de manutenção,
  paga juros de 2% do custo por ciclo.
- **Desgaste e renovação:** fazendas, madeireiras, minas, serraria, fundição, usinas e instalações de
  água têm vida útil (de 60 a 160 ciclos; 4 ciclos = 1 ano). Depois dela o rendimento cai até 50% em
  1,5× a vida útil. **Renovar** (clique na construção) custa 35% do preço e zera a idade. Saves antigos
  começam com tudo novo.
- **Custo de guardar:** o estoque que passa de um estoque de trabalho de $300 paga 1% do valor por
  ciclo (linha "Armazenagem" no livro-caixa). Quem produz só o necessário não paga nada.
- **Frete:** porto (8%), aeroporto (5%), até 2 estações de trem (3% cada) e rodovias (até 5%)
  baixam o preço de importar e sobem o de vender, até 20%. Aparece no painel do Mercado.

## Vida dos moradores (demografia e família)

Cada morador tem idade (4 ciclos = 1 ano), gênero, família e pode ser visto na lista de Moradores
(filtros Crianças e Aposentados) com o botão **🌳 Árvore genealógica**:
- **Chegam adultos de 18 a 42 anos.** Solteiros de 18 a 50 anos se casam (idade parecida, sem parentesco);
  casais de até 42 anos têm filhos (3,5% por ciclo) **se houver moradia livre**; os filhos herdam o
  sobrenome do pai. Morre-se pela idade e pela **expectativa de vida da cidade** (hospitais e poluição
  mexem nela); o parceiro fica viúvo (luto de 4 ciclos).
- **Efeito na cidade:** crianças (até 15 anos) e aposentados (65+) **não ocupam vagas** de trabalho, crianças
  não pagam imposto residencial e aposentados pagam a metade; aposentados **pesam em dobro** na demanda
  por hospital; nascimentos e mortes mexem na população; famílias unidas e o luto entram no humor.
- **Árvore genealógica:** avós, pais, irmãos, parceiro(a), filhos e netos; quem morreu aparece apagado
  enquanto houver parentes vivos na cidade (depois some dos registros).
- **Nas ruas** (durante o foco): crianças vão à escola mais próxima, aposentados só passeiam e têm cabelo branco.

## Aposentadoria (botão ⏳)

A prefeitura decide se oferece aposentadoria e como:
- **Idade de aposentar** (60 a 70): quem passa dela sai do trabalho.
- **Previdência pública**: os trabalhadores empregados contribuem com 0 a 15% de um salário de referência
  ($10/ciclo); a prefeitura paga um benefício a cada aposentado (básico $2, médio $4, generoso $6 por
  ciclo). O fundo acumula o que sobra; se faltar, o **déficit sai do caixa** (linha "Previdência" do
  livro-caixa). O painel mostra a previsão por ciclo.
- **Previdência privada** (oferecida aos moradores): cada trabalhador pode aderir (8% por ciclo), poupa
  $0,6/ciclo com rendimento de 1,5% e se aposenta vivendo da própria poupança, **sem custo para a
  prefeitura**; a prefeitura pode **subsidiar** de 0 a 100% do aporte (isso sai do caixa).
- **Humor:** aposentado com renda (benefício público ou poupança) +1; **sem renda −3**; contribuição acima
  de 10% pesa nos trabalhadores. Tudo vem desligado por padrão.

## Câmara de vereadores (botão do martelo)

A partir de 30 moradores a cidade elege uma **câmara de 5 a 11 vereadores** (pela população) para um mandato
de **4 anos (16 ciclos)**. Os vereadores são **moradores de verdade** (nome, idade e partido); quem morre ou se
muda é substituído por um suplente do mesmo partido.
- **Seis partidos, da esquerda para a direita:** **Esquerda Radical**, **Social Democrata**, **Centro**,
  **Liberal**, **Conservador** e o **Fascista**, que **só disputa a eleição em tempos de crise** (greve geral,
  caixa no vermelho, desastre recente, desemprego alto, povo triste ou bairros perigosos; com 3 ou mais sinais).
- **Eleição:** cada morador adulto vota pelo que vive e pelas **necessidades da idade** que faltam: desempregado e
  jornada exaustiva pesam na Esquerda; criança sem escola, idoso sem hospital ou renda, ar poluído, na Social
  Democracia; ricos e comércio, nos Liberais; bairro perigoso, nos Conservadores; quem está bem, no Centro; na
  crise, os descontentes e inseguros vão para o Fascista. As cadeiras saem por D'Hondt.
- **Cada partido propõe leis do próprio espectro** (uma por ciclo, sorteando o partido pelas cadeiras) e escolhe
  mais as leis que respondem ao que a cidade está passando (crime alto → leis de segurança, poluição → leis
  ambientais...). Você **aprova ou veta** na pausa; a pauta guarda até 3 projetos e arquiva o mais antigo.
  **25 leis** ligam a mecânicas que já existem: Esquerda (jornada de 8 h, salário mínimo, fiscalização,
  imposto sobre grandes empresas), Social Democrata (saúde universal, merenda, pensão universal, renda básica,
  arborização, taxa de carbono), Centro (orçamento participativo, parcerias público-privadas, reforma
  administrativa, energia limpa), Liberal (isenção industrial, jornada flexível, livre comércio,
  desburocratização), Conservador (toque de recolher, guarda municipal, austeridade, incentivo à família) e
  Fascista (estado de exceção, proibição de greves, milícia urbana). Leis em vigor podem ser **revogadas**.
- **Golpe e fim de jogo:** se o **Fascista conquistar 2/3 ou mais da câmara** numa eleição, ele dá o golpe: o jogo
  acaba (manchete no jornal, tela de fim de jogo e a cidade sai do ranking). Nenhum comando vale depois disso;
  só dá para começar uma nova cidade. O painel da Câmara avisa quando o Fascista tem cadeiras e quantas faltam.
- **Prestígio:** aprovar uma lei dá +1 ao partido, vetar ou revogar dá −1; quem tem prestígio ganha votos. Algumas
  leis têm **verba por ciclo** (linha "Leis municipais" do livro-caixa).

## Necessidades de cada idade

Cada faixa precisa de coisas diferentes (painel ⏳): **crianças** de escola, lugar para brincar e segurança;
**jovens** (16–24) de estudo ou emprego, lazer e moradia; **adultos** de emprego, hospital, caminho até o
trabalho e segurança; **idosos** de hospital, renda de aposentadoria e praça. O que falta pesa no humor (criança
sem escola −1, idoso sem hospital −2, etc., só em cidades de 40 moradores ou mais) e no voto.

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

## Capital financeiro e solo (Livro 3)

- **Ciclo econômico decenal** (`src/sim/ecocycle.ts`): 40 ciclos (10 anos) em quatro fases de 10: *Estagnação*, *Prosperidade*, *Superprodução* e *Crise*. Cada fase mexe no preço de tábuas, metal e bens (×0,65 na crise, ×1,15 na prosperidade), nos juros dos títulos novos (−1 a +3 pontos) e na demanda de comércio e indústria. A fase inicial vem da semente da cidade e a previsão das próximas fases aparece no painel **Mercado**. Na crise os adultos e aposentados perdem humor ("Crise econômica"). Dica: emita títulos na prosperidade; os juros ficam travados na emissão.
- **Renda do solo (IPTU)**: novo controle em Orçamento → Impostos (0 a 10%). Rende sobre o valor da terra dos lotes residenciais (bairros valorizados rendem mais), mas acima de 2% o aluguel pesa: a demanda residencial cai e os moradores de baixa renda (e, acima de 6%, a classe média) ficam tristes ("Aluguel pesado"). O decreto **Habitação popular** troca isso por "Moradia popular" para quem tem pouco e divide o efeito na demanda por dois.
- **Poder de compra**: quando a comida encarece (colheita ruim) ≥30%, moradores de baixa renda ficam tristes ("Comida cara"); ≥50%, também a classe média.
- **Eleição extraordinária**: em crise grave (3 ou mais sinais, os mesmos que põem o Fascista na urna), depois de 1 ano de mandato, há 15% de chance por ciclo de o povo exigir novas eleições. A câmara é refeita antes dos 4 anos e o risco de golpe cresce.
- **Clique no morador**: com a ferramenta vazia (ou ✋ Mover), toque num morador andando pela rua para abrir a ficha dele, com a árvore genealógica.
- Não há indicador numérico da taxa de lucro; o efeito da queda tendencial aparece na crise do ciclo.

## Negócios próprios e banco de leis

- **Empreendedores (direita) e cooperativas (esquerda)**: leis votadas na câmara abrem esse caminho para moradores **sem vaga** e uma parte (15%) dos empregados, que viram autônomos. Leis de empreendedorismo (Liberal, Conservador, Centro e Social Democrata: *Microempreendedor individual*, *Crédito para pequenos negócios*, *Polo de startups*, *Imposto simplificado*, *Feira de empreendedores*, *Negócio de família*, *Incubadora municipal*, *Microcrédito solidário*…) criam empreendedores: pagam mais imposto (US$2,20 por ciclo) e aumentam a demanda de comércio, mas quebram fácil (7% por ciclo, o dobro na crise econômica). Leis de cooperativismo (Esquerda: *Cooperativas de trabalhadores*, *Fábricas recuperadas*, *Banco cooperativo*…) criam cooperados: rendem menos (US$1,2) e resistem melhor (4%), mas deixam os sócios mais felizes. As leis marcadas com 🏪 e 🤝 no painel da Câmara somam a força de cada caminho (`src/sim/business.ts`).
- **Quem vota em quem**: empreendedor vota Liberal/Conservador; cooperado vota Esquerda/Social Democrata. Assim as leis que o prefeito aprova mudam a base eleitoral e a câmara da próxima eleição.
- **120 leis** (eram 25): 20 por partido (o Fascista só aparece na crise), cada uma ligada a uma mecânica (trabalho, impostos, saúde, crime, família, comércio, pesquisa, poluição…).

## Decretos políticos

- **26 decretos** (eram 9), em 7 categorias: Finanças, Energia, Comunidade, Foco, Trabalho, Segurança e Saúde e educação. Os novos também têm efeitos numéricos (saúde, crime, poluição, pesquisa, manutenção, bens) que se somam aos das tecnologias e leis.
- **Cada decreto tem um partido que o defende** (e, às vezes, adversários). **Assinar** dá +1 de prestígio ao partido e −1 aos adversários; **revogar** faz o contrário (o aviso aparece em cada decreto, em Orçamento → Decretos, e o histórico da Câmara registra). O prestígio pesa nos votos da eleição, e os decretos em vigor dão um apoio extra (+0,3) enquanto durarem. Assinar e revogar logo em seguida zera o efeito.
- **100 leis** no total (19 Esquerda, 19 Social Democrata, 17 Centro, 17 Liberal, 16 Conservador e 12 Fascista). A tabela das decisões está em `src/sim/laws.ts` e a dos decretos em `src/sim/finance.ts` (`ORDINANCE_POLITICS`).

## Árvore de tecnologia ampliada

- **81 tecnologias** (eram 36) em 6 eras, de 1900 a 2100. As novas somam três efeitos que não existiam: **QE** (escolas, ensino secundário, universidade, ensino a distância, educação personalizada), **frete** (telégrafo, aviação, rodovias, satélites, comércio eletrônico, elevador orbital; leva o desconto de comércio de 20% para até 30%) e **nascimentos** (vacinas, previdência social, edição genômica, longevidade). As demais mexem em comida, energia, poluição, crime, saúde, pesquisa, manutenção e automação.
- No painel, os botões **Era atual / Todas / cada era** evitam a rolagem longa no celular, e dentro de cada era as tecnologias ficam em ordem de ano.

## Construções grandes (vários quadrados)

- O catálogo tem o campo `footprint` (lado do quadrado: 2 = 2×2, 3 = 3×3). A construção fica no canto de cima (menor x e y) e os outros tiles viram "partes" ligadas a ela (`of`); demolir, consertar ou renovar qualquer tile vale para o prédio inteiro. Só precisa de um tile encostado numa estrada ligada à prefeitura. O terreno precisa ser plano, de terra firme e livre (prévia vermelha quando não cabe).
- **Universidade (3×3)**: atende 900 moradores (como 3 faculdades) e rende +14 pontos de pesquisa por ciclo. Requer 200 habitantes e a tecnologia *Universidade pública*.
- **Cooperativa fabril (2×2)**: fábrica de bens (até 5 por ciclo, valendo os bônus de bens das tecnologias, leis e eventos) tocada pelos trabalhadores; pesa +0,5 no cooperativismo e reduz pela metade as quebras de cooperativas. Requer 120 habitantes.
- **Incubadora de empresas (2×2)**: +0,4 no empreendedorismo (funciona sem lei) e +2 de pesquisa. Requer 150 habitantes.
- **Terminal intermodal (3×3)**: frete 6% mais barato e +15% de demanda comercial e industrial. Requer 250 habitantes e a tecnologia *Contêineres*.
- **Posto médico (1×1)**: o irmão pequeno do hospital, em Serviços. Custa $200 (hospital: $600), 2 trabalhadores e manutenção $4; atende 45 moradores (hospital: 150) num raio de 3 (hospital: 5). Evita surtos de gripe, mas não segura a peste: para ela é preciso um hospital.
- Os sprites (`art/city.px.js`, função `bigSprite`) são gerados com pxl; o desenho é um só, escolhido no tile da frente da vista (funciona nas 4 rotações da câmera).

## Balanceamento

```bash
npm run balance
```

O comando roda um robô que joga 15 anos de cidade em vários cenários (focado, casual, fácil,
difícil, inverno rigoroso, sem produção local) e imprime a evolução ano a ano. Os achados e os
números ajustados estão em [docs/BALANCO.md](docs/BALANCO.md).

## Carros e moradores na rua

Desenhados por quadro em `src/game/sprites2d.ts`. **Carros**: cinco modelos (sedã, hatch, van, picape e táxi com placa luminosa), com sombra no chão, rodas, capô, vidros, teto, faróis amarelos na frente e lanternas vermelhas atrás. **Moradores**: cerca de 8 px de altura, com sombra, pernas que alternam o passo, braços que balançam, tronco com sombra lateral, cabeça com cabelo e olho voltado para onde andam; adultos podem ter mochila, aposentados usam cabelo branco, postura curvada e bengala, e crianças são menores. **Trem**: locomotiva com cabine, caldeira, chaminé e farol, e vagões com janelas e rodas. (Corrigido: antes todos os moradores vestiam a mesma camisa vermelha.)

## Jornada, turnos e humor que produz

- **Humor → produção**: a aprovação da cidade (felizes − tristes) multiplica a produção de todas as fazendas, madeireiras, minas, serrarias, fundições, bens das fábricas e cooperativas, de **−15%** (todos tristes) a **+15%** (todos felizes).
- **Jornada → vagas**: cada setor exige trabalhadores em turnos (metade da razão `8 ÷ horas`, o resto é absorvido pelo ritmo): **6 h = +17% de vagas**, 10 h = −10%, 12 h = −17%. Com desempregados sobrando, a jornada curta os coloca para trabalhar (menos desemprego, mais impostos e humor); sem gente, os turnos ficam sem ninguém e a produção cai. Nas zonas industriais os bens também seguem os turnos, então a jornada curta não duplica a produção sozinha.
- **Produtividade por hora**: 6 h rende 1,08, 8 h 1,00, 10 h 1,10 e 12 h 1,18 (jornada longa rende mais no total, mas cansa, derruba o humor e aumenta a chance de greve). Fiscais só cortam o ganho da jornada longa e do pagamento por peça.
- O painel Trabalho mostra, por setor, a produção e as vagas, e o efeito do humor da cidade.

## Leis por época e decretos que economizam

- **Época das leis**: a câmara só propõe o que faz sentido para o ano da cidade (`LAW_ERA` em `src/sim/laws.ts`, com ano mínimo e, em alguns casos, a tecnologia exigida). Exemplos: *Jornada máxima de 8 horas* só a partir de 1915, *Salário mínimo* 1920, *Saúde universal* 1935, *Renda básica* 1960, *Governo digital* 1990 e a tecnologia Internet, *Polo de startups* 1995 e Internet, *Mercado de carbono* 2000, *Propaganda oficial* com Rádio, *Controle da imprensa* com Imprensa popular, *Estatização da energia* com Eletrificação. Leis de 1900 (guarda municipal, austeridade, toque de recolher, livre comércio…) valem desde o começo. Projetos já na pauta ou em vigor não somem.
- **Decretos da esquerda que baixam o custo**: *Taxação de lucros extraordinários* (arrecada por ciclo, esfria a indústria), *Compras públicas coletivas* (manutenção −5%) e *Auditoria popular das contas* (manutenção −3% e economia por ciclo), além dos que gastam (habitação popular, tarifa social, cozinhas comunitárias, feriado).

## Câmara plural e equilíbrio

- **Eleição plural**: cada eleitor sorteia o voto com chance proporcional ao peso de cada partido (softmax, `VOTE_TEMPERATURE = 3`), em vez de sempre escolher o de maior peso. Antes, um só partido levava quase todas as cadeiras; agora 3 a 4 partidos entram na câmara numa cidade comum. Na crise o eleitorado se polariza (a temperatura cai com o nível de crise), então o golpe fascista continua possível, mas deixou de ser automático.
- **Propostas proporcionais**: a cada ciclo, cada partido com cadeiras sorteia sozinho se propõe uma lei, com chance igual à sua fatia da câmara (no máximo 2 projetos novos por ciclo; se ninguém sortear, a câmara sorteia um por cadeiras). O jornal lista todos os projetos do ciclo.
- **Equilíbrio** (auditoria com o robô de balanceamento, incluindo 240 ciclos extras de política): a economia segue estável nos 6 cenários (sem caixa negativo, sem fome fora do cenário "só importa"); aprovar *todas* as leis esvazia o caixa (as leis com verba somam mais que os impostos), vetar todas deixa o caixa estável, e as greves de ~14% nas cidades do robô vêm só da falta de hospital. Ajuste novo: os ganhos de humor das leis e dos decretos têm **teto de +3** cada (antes empilhavam sem limite e a cidade ficava com 100% de aprovação).

## Cenário de desemprego (balanceamento)

`scripts/balance/jobs.balance.ts` (roda junto com `npm run balance`, ~2,5 min no total) tira 80% dos lotes de comércio e indústria de uma cidade do robô, sem rezonear (o desemprego persiste: ~60 a 125 desempregados) e acompanha 60 ciclos (30 na versão em crise), em 4 cidades por política, sem greves para isolar o efeito. Resultado, contra a base (8 h, sem leis):

| Política | Normal | Em crise econômica |
|---|---|---|
| **Jornada 6 h** | desemprego −27%, impostos +5%, bens +4%, aprovação +4 pts, caixa −7% | desemprego −24%, caixa +6%, aprovação +3 pts |
| **Jornada 10 h** | desemprego −24% (menos vagas, mais saídas), impostos −8%, caixa +30% | caixa +25%, aprovação −8 pts |
| **Empreendedorismo** (3 leis) | impostos +22%, caixa +48%, aprovação +19 pts, 328 negócios quebrados | caixa +29%, 162 quebras (metade do normal em 30 ciclos) |
| **Cooperativas** (3 leis) | impostos +17%, aprovação +18 pts, caixa igual | caixa +8%, aprovação +17 pts, só 91 quebras |
| **6 h + as duas** | caixa +5%, aprovação +16 pts | caixa +27%, aprovação +16 pts |

Leitura: a jornada curta realmente reduz o desemprego sem derrubar a produção; empreendedorismo rende caixa (e quebra mais), cooperativas rendem humor e segurança. Na jornada longa o teste não mostra o custo real porque as greves estão desligadas (fadiga e greve são o contrapeso no jogo). Antes dos ajustes a jornada curta cortava a produção pela metade, as leis de negócio davam prejuízo e o bônus quase nunca aparecia (agora 15% dos empregados também podem virar autônomos). 

## Informações do prédio ao clicar

Com a ferramenta vazia ou **Mover**, um toque ou clique curto (sem arrastar) num tile **fixa** as informações dele no painel, com o botão **Reparar** estável (antes o painel só aparecia ao passar o mouse e sumia ao mover o mouse até o botão). Com uma ferramenta de obra, clicar numa construção que já existe também fixa. Fecha no **X** ou com **Esc**; no celular, o toque faz o mesmo.

## Leis equilibradas financeiramente

- Cada lei agora tem resultado financeiro claro: **positiva** (rende ou economiza: receita por ciclo com multas, taxas e contribuições, manutenção mais barata, mais arrecadação, imposto industrial maior, frete menor) ou **negativa** (custa uma verba por ciclo, encarece a manutenção ou reduz a receita). `lawFinanceScore(id)` estima o saldo em $ por ciclo numa cidade de 200 moradores e `lawFinance(id)` devolve `"positiva"` ou `"negativa"`; não há lei neutra. No painel da Câmara cada lei mostra a marca 💰 rende ou 💸 custa.
- **Todos os partidos têm 20 leis: 10 positivas e 10 negativas** (120 no total; eram 100, de 12 a 19 por partido, com muitas negativas na esquerda e na social-democracia e quase nenhuma positiva no fascismo). Para isso, 20 leis novas (por exemplo *Imposto sobre heranças*, *Pedágio urbano*, *Subsídio a empresas*, *Imposto predial*, *Banco do Estado*, *Confisco de bens*) e ajustes em outras: leis de custo que ganharam receita (restaurante popular, habitação social, seguro-desemprego, fundo de cultura, microcrédito) ou economia (vacinação, atenção básica), e leis sem efeito financeiro que ganharam um (fiscalização rende multas, salário mínimo aumenta a arrecadação, vigilância total custa uma verba). Um teste garante a igualdade.
- Leis que rendem têm custo negativo: a linha "Leis municipais (verbas e receitas)" do Livro-caixa pode ficar verde.

## Revisão da pixel art

Passada de refinamento nos sprites: as **quatro construções grandes** ganharam texturas (fiadas de tijolo, lajes, janelas com luz variada, cornijas, quinas claras), jardins e detalhes (universidade com alas de tijolo, pórtico de colunas, torre e relógio; cooperativa com dentes de serra, claraboias, chaminé e letreiro; incubadora com torre de vidro, teto-jardim e painéis solares; terminal com contêineres corrugados, vagão e pórtico amarelo). Os prédios "cubo" ganharam silhueta própria: **polícia** (torre de rádio, escudo, viatura), **hospital** (torre com heliponto e ala baixa com pronto-socorro e ambulância), **posto médico** (marquise, cruz, banco), **fiscalização do trabalho** (pavimento recuado com bandeira, relógio de ponto e quadro de avisos), **biblioteca** (colunas, janelas arqueadas, escadaria e cúpula de vidro), **escola** (torre do sino, pátio com escorregador e balanço), **faculdade** (torre do relógio com duas faces e fiadas de tijolo), **estação de trem** (plataforma coberta e trilho) e **bombeiros** (torre de treino, letreiro, sirene e viatura). **Terceira rodada:** zoológico (cerca nos quatro lados, girafa, elefante, patinhos e tenda), praça (piso em xadrez, chafariz de duas bacias, bancos e postes), parque (caminho sinuoso com ponte, piquenique e bancos), marina (píer com estacas, veleiros e capitania), aeroporto (torre com cabine, pista com cabeceira, avião e biruta), porto (navio atracado com contêineres e guindaste), hidrelétrica (casa de máquinas e barragem com comportas e cachoeira), usina solar (painéis com células e inversor), fundição (duas chaminés, forno com arco e escória), reciclagem (símbolo, esteira e caçambas coloridas) e mina (torre de extração e vagonete cheio). **Segunda rodada:** o **terreno** ganhou manchas pontilhadas de dois tons, florzinhas na planície e folhas e cogumelo na floresta; a **água** tem manchas de profundidade fixas sob os reflexos animados; as **estradas** têm asfalto com remendos e grãos, meio-fio com sombra, faixa de retenção nos cruzamentos e bueiro nas retas (e a rodovia deixou de ter pontinhos soltos no cruzamento); os **retratos** têm nariz, sombra sob o queixo, orelhas e detalhes por ofício (gravata, crachá, faixa refletiva, suspensórios, xadrez da madeira, lanterna de mineiro). Também ganharam mais vida a **madeireira** (toras empilhadas de lado, toco com machado, cabana com chaminé), o **armazém** (tábuas com travessas, portão de correr, ventilação, caixotes e empilhadeira), a **serraria** (esteira de toras, serra circular na fachada, chaminé e serragem) e a **estação de tratamento de água** (tanques com borda, claraboia, canos e casa de controle). Também receberam acabamento: **residencial densa** níveis 3 e 4 (lajes, soleira, toldo e terraço), **comercial densa** (toldo e porta no térreo, equipamentos no terraço), **museu** (escadaria, colunas com capitel e frontão com medalhão), **estádio** (assentos e refletores acesos), **ponto de ônibus** (ônibus parado) e **prisão** (guaritas).

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
- **Humor e produção também meio a meio.** Em cada partido, 10 das 20 leis deixam a cidade **mais feliz** e 10 **mais triste** (`lawMoodScore`/`lawHappiness`), e 10 **aumentam** e 10 **reduzem a produção** (`lawProductionScore`/`lawProduction`, soma dos modificadores de comida, madeira, minério, refino, bens e energia). Leis que não tinham esses efeitos ganharam ±1 de humor para todos e ±3% de bens; no Fascista, *Economia de guerra*, *Rearmamento* e *Proibição de greves* ganharam um lado positivo (fervor patriótico, orgulho nacional, ordem nas ruas). O humor das leis tem teto +3 e piso −4 por grupo (`LAW_MOOD_CAP`/`LAW_MOOD_FLOOR`). A Câmara mostra as marcas 💰/💸, 😊/☹️ e 📈/📉 em cada lei; testes garantem 10/10 nos três eixos.
