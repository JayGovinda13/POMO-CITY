# POMO-CITY — Roadmap de funcionalidades

Este documento organiza em fases as mecânicas de city-builder que vamos adaptar para o
POMO-CITY. A referência de estudo foi o manual do SimCity 2000 (Maxis, 1993), somada às
decisões de design do projeto.

> **Originalidade.** Usamos o manual só como referência de *mecânicas de gênero*:
> zoneamento, energia, água, serviços e orçamento. Nomes, textos, arte, ícones e
> números do POMO-CITY são próprios. Não usamos marcas, personagens nem elementos
> visuais do jogo original, nem nomes oficiais de eventos reais.

## Princípios de adaptação

Toda mecânica importada passa por cinco filtros:

1. **O foco real é o combustível.** Cada sistema novo se conecta aos ciclos Pomodoro:
   o Rank do lote (D–S), a sequência de foco ou o total de ciclos. Uma mecânica que
   ignora o foco é decorativa.
2. **O tempo da cidade é o tempo de foco.** **1 ciclo concluído = 1 estação (3 meses)**,
   e 4 ciclos formam 1 ano. O calendário começa em 1900. As "invenções" do manual, que
   chegam com o passar dos anos, aqui chegam com o trabalho acumulado do jogador.
   - Ritmo de referência: com ~8 ciclos por dia, um ano da cidade passa em meio dia de
     trabalho, uma década em ~5 dias e um século em ~2 meses.
3. **O clima é real; o lugar, não.** Ao fundar a cidade, o jogador escolhe a **própria região**
   ou **outra parte do mundo**. Isso define o clima: temperatura média, época de chuvas e de
   seca, e as estações. O mapa é sempre fictício (Fase 2).
4. **Ausência nunca é punida; ciclo quebrado, sim.** Nada decai em tempo real: ficar dias sem
   jogar não custa nada. O que conta é **como a sessão termina**:
   - sair pelo **menu** (só com o foco encerrado) guarda a sequência e não causa nada;
   - **abandonar o foco** ou **fechar o jogo durante o foco** causa um desastre;
   - **fechar o jogo sem o menu depois de concluir um foco** causa um desastre leve.
   O seguro (Fase 5) e os serviços públicos amortecem esses desastres.
5. **O servidor é a autoridade.** Toda regra nova vive em `src/sim` (TS puro e
   determinístico) e é revalidada pelo servidor. Aleatoriedade usa PRNG com seed.

## Visão geral

| Fase | Tema | O que entra | Status |
|------|------|-------------|--------|
| 0 | Preparação técnica | Fundação para as demais | ✅ Concluída |
| 1 | Zoneamento e energia | Zonas R/C/I, crescimento orgânico, demanda, usinas, linhas, apagões | ✅ Concluída |
| 2 | Clima e estações | Escolha da região (só o clima), hemisfério, estações, chuvas e secas, bioma; menu e sessão | ✅ Concluída |
| 3 | Economia de recursos | Estoque, consumo dos cidadãos e das obras, compra e venda externa, valor por Rank, excedente | ✅ Concluída |
| 4 | Orçamento e finanças | Impostos por zona, financiamento de departamentos, títulos e rating, decretos | ✅ Concluída |
| 5 | Ciclos quebrados, desastres e seguro | Desastres causados por ciclos abandonados, seguro com carência | ✅ Concluída |
| 6 | Água | Bombas, poços, caixas d'água, tratamento, dessalinização, camada subterrânea | ✅ Concluída (dessalinização na Fase 9) |
| 7 | Serviços e qualidade de vida | Polícia, bombeiros, saúde, educação, lazer, estádio, turismo, crime, poluição, valor do solo | ✅ Concluída (marina na Fase 9, hotéis/turismo na Fase 12) |
| 8 | Transporte avançado | Tráfego, ônibus, trilhos, rodovias, portos | ✅ Concluída |
| 9 | Terreno e paisagem | Altitude, árvores, água, pontes e túneis, editor de mapa | ✅ Concluída (mapa 40×40) |
| 10 | Eras, invenções e recompensas | Árvore tecnológica por ano, vida útil de usinas, marcos de população | ⏳ |
| 11 | Informação | Gráficos, jornal da cidade, ferramenta de consulta, minimapa | ⏳ |
| 12 | Grandes eventos e metas | Eventos sorteados com anos de antecedência (ex.: uma copa) e metas para a cidade | ⏳ |
| 13 | Indústrias e vizinhos | Setores industriais, vizinhos = outros jogadores, mercado multiplayer | ⏳ |

As fases 2 em diante são delegadas uma a uma, conforme os pareceres sobre o desenvolvimento.

### Entregas fora das fases

| Entrega | Onde |
|---------|------|
| **Visual 2,5D com sprites em pixel art** gerados com [pxl](https://github.com/crsolver/claude-pxl): terreno por bioma, água, estradas que se conectam (16 variações), vegetação decorativa, zonas por nível e densidade, prefeitura, produção, usinas, postes e cabos. Sombras projetadas proporcionais à altura de cada construção. | `art/city.px.js`, `npm run art`, `public/sprites/`, `CityScene.ts` |
| **Jornal da cidade** a cada ciclo (manchete por prioridade, notícias, fala de um morador, resumo e balanço completo) — antecipa parte da Fase 11. | `src/sim/newspaper.ts`, `Newspaper.tsx` |
| **Monetização:** AdSense (script, meta de verificação e `/ads.txt` por variável de ambiente; espaços na tela inicial e no jornal), botão de doação com Pix (BR Code) e link de cartão, política de privacidade. | `docs/MONETIZACAO.md`, `AdSlot.tsx`, `DonateButton.tsx`, `/privacidade` |
| **Cidadãos individuais:** cada morador tem nome (conforme o continente da região), retrato próprio (pele, cabelo, roupa da profissão, rosto pelo humor), casa, emprego e humor (triste, ok ou feliz) com os motivos. Quando a população cai, os mais tristes vão embora; a aprovação da cidade mexe na demanda residencial. | `src/sim/citizens.ts`, `CitizensPanel.tsx`, `Portrait.tsx` |

---

## Fase 0 — Preparação técnica ✅

Objetivo: preparar a base de código para receber dezenas de sistemas novos sem quebrar
as cidades já salvas.

| Entrega | Onde |
|---------|------|
| **Versionamento do estado** (`schemaVersion`) + migrações automáticas na leitura (cliente e servidor). Cidades antigas são atualizadas sem perda. | `src/sim/migrate.ts` |
| **Pipeline de sistemas:** o ciclo vira uma sequência ordenada de sistemas puros (energia → zonas → mudança → produção → refino → consumo/impostos → manutenção). Cada fase futura só acrescenta um sistema. | `src/sim/cycle.ts` |
| **Camadas por tile:** arrays paralelos (`zoneType`, `zoneDensity`, `zoneLevel`, `wires`) em vez de objetos por tile, para manter o JSON pequeno. | `src/sim/types.ts` |
| **Utilitários de grade:** BFS multi-origem com limite de distância, componentes conectados e vizinhança. Servem para energia, água, cobertura de serviços e acesso viário. | `src/sim/grid.ts` |
| **Calendário:** 1 ciclo = 1 trimestre (estação); 4 ciclos = 1 ano. A HUD mostra o trimestre ("Jan–Mar 1900"). O nome da estação chega na Fase 2, porque depende do hemisfério. | `src/sim/world.ts` |
| **Desbloqueios:** cada construção ou zona pode exigir ano ou população mínima (`requires`). O servidor rejeita o que ainda está bloqueado, e a HUD mostra quando libera. | `src/sim/unlocks.ts` |
| **Camadas de visualização (overlays)** no Phaser, alternadas pela HUD. | `src/game/CityScene.ts` |
| **Comandos de área** (retângulo arrastado), validados como uma unidade. | `src/sim/commands.ts` |

**Critérios de aceite:** cidades v1 carregam e são migradas; todos os testes antigos e novos passam;
build e e2e verdes.

---

## Fase 1 — Zoneamento e energia ✅

Objetivo: trocar a "casa construída à mão" pelo modelo clássico. O prefeito **zoneia** e a
cidade **cresce sozinha** quando há demanda, estrada e energia.

### Zoneamento (manual: *Residential/Commercial/Industrial Zones*, *Demand Indicator*)

- **Três tipos de zona:** Residencial (moradia), Comercial (empregos de serviço) e
  Industrial (empregos de fábrica). Cada uma tem densidade **leve** ($5/tile) ou **densa** ($10/tile).
  Zonas densas são liberadas a partir de 40 habitantes.
- O zoneamento é feito arrastando um retângulo. Zonear de novo com o mesmo tipo e densidade é grátis.
  Um tile já desenvolvido não pode ser rezoneado: primeiro é preciso demolir.
- **Crescimento orgânico:** a cada ciclo, os lotes elegíveis sobem de nível. Um lote é elegível se:
  - estiver a **até 3 tiles de uma estrada** ligada à prefeitura (regra do manual: só se constrói
    a até 3 tiles de um sistema de transporte);
  - estiver **energizado**;
  - o seu tipo tiver **demanda positiva**.
- **Níveis:** zona leve vai até o nível 2, densa até o 4. Cada nível dá moradia (R) ou empregos (C/I).
- **O foco acelera a cidade:** o número de lotes que se desenvolvem por ciclo cresce com o Rank do lote
  (D +0 … S +4). A integração com o Pomodoro aparece aqui.
- **Declínio:** um lote sem energia ou sem acesso viário perde um nível por ciclo, e demanda muito
  negativa também faz lotes perderem nível.
- **Indicador de demanda R/C/I** na HUD:
  - R sobe quando há mais empregos do que trabalhadores;
  - C acompanha a população (clientes);
  - I é forte em cidades pequenas (exportação), como descreve o manual.
- **Equilíbrio sugerido pelo manual:** tiles R ≈ tiles C + I; cidades pequenas precisam de mais indústria.

### Energia (manual: *Power*, *Power Plants*, brownouts)

- **Usinas:**
  - **Termelétrica:** queima madeira. A eficiência depende do **Rank do combustível**
    (madeira S rende 100%, D rende 60%), o que liga a qualidade dos recursos à rede elétrica.
  - **Eólica:** barata, limpa e de baixa potência.
  - **Hidrelétrica:** só funciona encostada na água, a partir de 1902 (8 ciclos).
  - A **prefeitura** tem um gerador de 12 MW para a cidade começar.
- **Linhas de transmissão** ($2/tile) podem cruzar estradas.
- **Condução de energia:** passa por linhas, construções e lotes zoneados adjacentes. Estradas sozinhas
  não conduzem.
- **Consumo:**
  - lotes desenvolvidos consomem por nível (R 0,5, C 0,75, I 1 MW por nível);
  - construções consomem o próprio valor (fazenda 1 MW … fundição 6 MW).
- **Apagão (brownout):** se o consumo passa da capacidade, quem está mais longe das usinas fica sem luz.
  - Lotes sem luz não crescem e declinam.
  - Construções sem luz operam a 50%.
- **Migração:** cidades antigas recebem a rede elétrica sob as ruas existentes, e as casas antigas
  viram lotes residenciais desenvolvidos.

### Interface

- Ferramentas agrupadas: Infraestrutura, Zonas, Energia, Produção, Especial.
- Barras de demanda R/C/I, medidor de MW (usado/capacidade) e o ano da cidade.
- Overlays de **Energia** (energizado/sem energia) e **Zonas**.
- O relatório do ciclo inclui energia, lotes que cresceram ou declinaram, empregos e desemprego.

**Critérios de aceite:**
- regras cobertas por testes (crescimento, regra dos 3 tiles, apagão, combustível por Rank,
  migração, desbloqueio);
- a cidade nova é lucrativa nos primeiros ciclos;
- a cidade migrada continua produzindo.

---

## Fase 2 — Clima e estações ✅

*Manual: Climate, Water (variação sazonal), Power (solar/eólica dependem do tempo).*

Objetivo: a cidade vive o **clima** da região escolhida pelo jogador (temperatura média,
época de chuvas e de seca, estações), num **mapa fictício**.

### Fundar a cidade: escolher a região

- **"Minha região"**: usa a geolocalização do navegador (com permissão) ou o nome da cidade
  digitado, e encaixa o jogador na região mais próxima da tabela de climas.
- **"Outra parte do mundo"**: escolha direta numa lista ou mapa-múndi das regiões da tabela.
  Serve para jogar no inverno do outro hemisfério, no deserto ou na tundra.
- **O lugar não é reproduzido.** Não há geografia real (costa, relevo ou ruas). Só o perfil
  climático é usado, e o mapa continua procedural.
- **Privacidade:** a geolocalização é opcional e serve só para escolher a região. Gravamos o
  **id da região climática**, nunca coordenadas.
- **Cidades já existentes:** no próximo acesso, o jogador escolhe a região uma única vez.
  O mapa atual é mantido.

### Tabela de climas (decisão: tabela própria)

- **~40 regiões** embutidas no código, sem dependência externa. Cada uma tem:
  - hemisfério e tipo de clima (tropical úmido, tropical com estação seca, semiárido,
    árido, temperado, continental frio, polar, altitude);
  - **por trimestre:** temperatura média, chuva, horas de sol, vento e um rótulo de estação
    ("verão", "estação chuvosa", "seca"…).
- Os valores vêm de normais climatológicas públicas, arredondados.

### Calendário e estações

- 1 ciclo = 1 estação. O **hemisfério** dá nome às estações: Jan–Mar é verão no Sul e
  inverno no Norte.
- **Regiões tropicais** usam as estações que existem de fato (chuvosa e seca) em vez de
  quatro estações temperadas.
- A cidade **começa na estação real atual** da região. Depois disso, o calendário avança
  uma estação por ciclo concluído.
- **Na pausa, a HUD mostra a próxima estação**, para planejar. Exemplo: "seca chegando:
  estoque comida e água".

### Clima → simulação

- **O tempo de cada ciclo é sorteado com seed** em torno da normal da estação: ano seco,
  inverno rigoroso etc. Cliente e servidor chegam ao mesmo resultado.
- **Efeitos:**
  - **Agricultura:** colheita forte na estação quente ou chuvosa, fraca no inverno ou na seca.
  - **Energia:** solar acompanha as horas de sol; eólica acompanha o vento; hidrelétrica
    acompanha a chuva (a seca reduz a geração).
  - **Consumo:** aquecimento em invernos frios e refrigeração em verões quentes aumentam a
    demanda de energia (e de lenha, na Fase 3).
  - **Água (Fase 6):** chuva e seca definem o abastecimento.
- **O bioma vem do clima** em vez de ser sorteado:
  - tropical úmido → floresta;
  - temperado → planície;
  - semiárido ou árido → **deserto** (novo);
  - frio ou polar → **tundra** (novo);
  - altitude → montanhas.
- O clima também ajusta o mapa procedural: regiões chuvosas geram mais lagos e rios, e as
  áridas geram menos.

### Multiplayer

Jogadores em hemisférios opostos têm safras em épocas opostas. Isso cria **comércio sazonal**
natural: comida do Sul no inverno do Norte. É um gancho para o mercado da Fase 13.

### Entregue

| Entrega | Onde |
|---------|------|
| **Tabela de 56 regiões** em 6 continentes, com normais por trimestre (°C, chuva, sol, vento), busca por nome ou cidade próxima e região mais próxima por coordenada | `src/sim/climate.ts` |
| **Fundação:** "Minha região" (localização do navegador, usada só no aparelho, ou cidade digitada) e "Outra parte do mundo" (lista por continente com prévia do clima). O servidor recebe só o id da região. | `src/components/RegionPicker.tsx`, `/api/city/region` |
| **Cidade nova:** bioma e quantidade de água vêm do clima; o calendário começa na estação real. **Cidade antiga:** mantém mapa, bioma e calendário. | `src/sim/founding.ts` |
| **Estações** pelo hemisfério; perto do Equador valem "estação chuvosa", "estação seca" e "transição" | `seasonName` |
| **Tempo de cada estação** sorteado com seed em torno da normal (seca severa, chuvas acima da média, onda de calor, frente fria). A previsão do próximo ciclo na HUD é exata. | `weatherAt` |
| **Efeitos:** colheita (temperatura e chuva), eólica (vento), hidrelétrica (chuva) e consumo de casas e comércio (aquecimento ou refrigeração) | `climateEffects`, `power.ts`, `cycle.ts` |
| **Biomas novos:** deserto e tundra | `catalog.ts` |
| **Menu e sessão** (pedido junto com esta fase): tela inicial com Continuar e Novo jogo; menu no jogo com Sair (guardando a sequência) e Novo jogo, os dois só com o foco encerrado | `TitleScreen`, `GameMenu`, `/api/session/*`, `/api/game/new` |
| **Desastres por saída indevida** (antecipados da Fase 5) | ver Fase 5 |

**Critérios de aceite:**
- fundar a cidade escolhendo a própria região ou outra;
- estações nomeadas conforme o hemisfério e o tipo de clima;
- clima sazonal afetando agricultura e energia, com testes;
- cidades antigas pedem a região uma vez;
- nenhuma coordenada é armazenada.

## Fase 3 — Economia de recursos ✅

Objetivo: **os cidadãos vivem dos recursos e as construções dependem deles**. Tudo pode ser
feito só com dinheiro (importando), mas produzir localmente sai mais barato. O excedente
pode ser vendido ou estocado.

### Estoque (armazenamento)

- **Capacidade limitada por recurso.** A prefeitura tem uma capacidade inicial, e
  **armazéns** e **silos** (novas construções) aumentam o limite.
- **Perdas:** comida estocada perde uma parte por estação. A perda é maior em climas quentes
  e úmidos, e menor com silos.
- **O estoque faz parte da estratégia:** guardar comida para a seca, madeira para o inverno
  e materiais para uma obra grande.

### Consumo: cidadãos e obras

- **Cesta por cidadão por estação:**
  - comida (já existe);
  - lenha ou energia para aquecimento no inverno frio (vem do clima, Fase 2);
  - bens de consumo, a partir de uma população mínima.
- **Construções consomem materiais**, além de dinheiro:
  - obras públicas: estradas com pedra ou madeira, usinas com metal e tábuas etc.;
  - **crescimento das zonas:** cada nível novo de um lote consome materiais (tábuas, metal).
- **Se falta o recurso, a cidade compra automaticamente** no mercado externo, pagando o
  preço de importação. Por isso **é possível jogar só com dinheiro**. Exemplo: uma cidade
  com fazendas precisa comprar menos comida para sustentar os cidadãos.

### Mercado externo (comerciante NPC)

- **Preço base** por recurso, que varia com a estação (comida mais cara no inverno e na seca).
- **Importar custa mais que exportar** (frete e intermediário), por exemplo +25% na compra e
  −20% na venda. Por isso produzir localmente é a forma de baratear a cidade.
- **O mercado externo só negocia até o Rank B** (confirmado). Recursos A e S precisam ser produzidos ou
  comprados de outros jogadores (Fase 13), o que preserva o valor do foco de alta qualidade.

### Valor e rendimento por Rank

| Rank | D | C | B | A | S |
|------|---|---|---|---|---|
| Valor de venda | 100% | 110% | 120% | 130% | 140%* |
| Rendimento | 1,0 | 1,1 | 1,2 | 1,3 | 1,4* |

- **"Rende o equivalente":** 1 unidade de comida A alimenta como 1,3 unidade de comida D,
  e 1 tábua A vale 1,3 tábua D numa obra. Em suma, foco de qualidade rende mais por unidade.
- \*Rank S = 140%, confirmado (progressão de +10%).

### Excedente: vender ou estocar

- **Política por recurso**, definida na pausa:
  - estocar tudo;
  - vender tudo o que passar da demanda;
  - vender uma porcentagem do excedente;
  - manter uma reserva mínima (por exemplo, 2 estações de comida) e vender o resto.
- A venda acontece no fim do ciclo, e o relatório mostra o que foi produzido, consumido,
  comprado, vendido e estocado.

### Ajustes no que já existe

- **Confirmado:** o Rank não conta duas vezes. O desperdício industrial por Rank fica só no
  refino, e o rendimento acima vale no consumo e nas obras. A eficiência da termelétrica por
  Rank passa a seguir o mesmo rendimento.

### Entregue

| Entrega | Onde |
|---------|------|
| **Rendimento e valor por Rank** (D 1,0 … S 1,4) no consumo, nas obras, na venda e no combustível da termelétrica (30 MW × rendimento). O desperdício fica só no refino. | `economy.ts`, `RANK_YIELD` |
| **Mercado externo:** preço base por recurso (comida varia com a colheita da estação), compra +25%, venda −20%, só até o Rank B. | `basePrice`, `importPrice`, `exportPrice` |
| **Obras consomem materiais** (estrada: 1 madeira; usinas: tábuas e metal…) e **cada nível novo de um lote** consome tábuas (e metal nas zonas C/I densas). O que falta é comprado na hora; sem dinheiro, o lote não cresce. | `catalog.ts`, `quoteMaterials`, `payMaterials` |
| **Os moradores vivem dos recursos:** comida (0,5), lenha no frio (0,25 abaixo de 10 °C) e **bens** (0,2 a partir de 30 moradores). A cidade compra o que faltar; só há fome quando nem o dinheiro alcança. | `economySystem` |
| **Bens:** recurso novo, fabricado pelas zonas industriais (0,5 por emprego ocupado). | `extractionSystem` |
| **Estoque com limite:** 100 por recurso na prefeitura, **Armazém** (+150 para não-alimentos) e **Silo** (+200 de comida e menos perda). Comida estraga a cada estação (mais no calor úmido). O excesso é vendido. | `storageCapacity`, `storageSystem` |
| **Políticas de excedente por recurso** (estocar, vender o excedente, vender %, manter reserva), definidas na pausa; A e S nunca vão para o mercado externo. | `MarketPanel.tsx`, comando `policy` |
| **Relatório com balanço por recurso** (produziu, consumiu, comprou, vendeu, perdeu, estoque) e as linhas de compras e vendas no saldo. | `CycleReportModal.tsx` |
| Correção: arrastar estrada/linha rápido não pula mais tiles. | `CityScene.ts` (`gridLine`) |

**Critérios de aceite:**
- cidade jogável só com dinheiro (importação automática);
- produzir localmente reduz o gasto, com testes que comparam as duas cidades;
- valor e rendimento por Rank aplicados na venda, no consumo e nas obras;
- políticas de excedente e limite de estoque funcionando;
- relatório do ciclo com o balanço por recurso.

## Fase 4 — Orçamento e finanças ✅

### Entregue

| Entrega | Onde |
|---------|------|
| **Impostos por zona** (R, C, I) de 0 a 20%, padrão 9% (= arrecadação anterior). Cada ponto acima do padrão tira 0,04 da demanda da zona; abaixo, soma. | `finance.ts`, `economySystem` |
| **Verbas** de Transportes e Energia (0–100%) reduzem a manutenção paga. Estradas sem verba integral se desgastam (−0,3 de conservação por ponto que falta, por ciclo) e, abaixo de 30, ficam danificadas e não conectam; com verba integral, recuperam 20/ciclo. Usinas geram de 50% (verba zero) a 100%. | `upkeepSystem`, `roadsSystem`, `power.ts` |
| **Títulos de $1.000** com juros travados na emissão (4% + spread do rating), cobrados no fim de cada ano; quitação do mais antigo para o mais novo. **Rating AAA–C** pela razão dívida/valor da cidade (caixa negativo derruba uma nota); o rating limita quantos títulos o banco aceita. | `creditRating`, comando `bond` |
| **7 decretos:** imposto sobre vendas, imposto de renda, jogos legalizados, conservação de energia (+15% em 4 ciclos), embelezamento (+humor, +demanda R), festival (+humor, +demanda C) e **prêmio de produtividade** (ligado ao foco: +15% de extração em ciclos A/S). | `ORDINANCES`, comando `ordinance` |
| **Livro-caixa** com o último ciclo e a **projeção exata do próximo** (a simulação determinística roda o ciclo de verdade sobre a cidade atual). | `BudgetPanel.tsx` |
| **Dificuldade** na fundação: Fácil ($2.000, indústria aquecida), Médio ($1.000), Difícil ($1.000 de um título a pagar, rating C e recessão). | `DIFFICULTY`, `foundCity` |
| Pedidos junto com esta fase: câmera só pelo mouse (sem WASD/setas) com a ferramenta **✋ Mover**; **tutorial** oferecido ao abrir a cidade (e no Menu). | `CityScene.ts`, `Tutorial.tsx` |
| Correção: cidade sem moradores não vende mais a comida inicial pela política de reserva. | `storageSystem` |


*Manual: Budget Window, Property Taxes, Bond Payments, City Ordinances.*

- **Impostos por zona:** taxa de 0% a 20% para R, C e I, ajustada na pausa. Impostos altos reduzem
  a demanda daquele tipo, e impostos baixos a estimulam.
- **Financiamento de departamentos** de 0% a 100% (transporte, energia, e depois serviços).
  Transporte subfinanciado degrada as estradas, que perdem capacidade e conexão.
- **Títulos municipais:** empréstimo de valor fixo com juros anuais (cobrados a cada 4 ciclos) que dependem do
  **rating de crédito (AAA a F)**, calculado pelo valor da cidade. São pagos do mais antigo para o
  mais novo.
- **Decretos**, ligados ao foco onde fizer sentido:
  - imposto sobre vendas (+receita, −comércio);
  - campanha de leitura (+educação);
  - conservação de energia (+15% de capacidade após alguns ciclos);
  - embelezamento (+valor do solo);
  - festival anual;
  - controle de poluição.
- **Livro-caixa** com receitas e despesas por categoria, além da projeção do próximo ciclo.
- Nível de dificuldade no início: dinheiro inicial e demanda externa (fácil, médio, difícil).

## Fase 5 — Ciclos quebrados, desastres e seguro ✅

### Entregue (seguro e desastres mais duros)

| Entrega | Onde |
|---------|------|
| **Seguro opcional** em 🏛 Orçamento → Seguro: Básico (50%, franquia $100, 0,4% do valor da cidade por estação) e Completo (90%, franquia $50, 0,8%). **Carência de 4 ciclos** concluídos; trocar de plano reinicia. Sem dinheiro para o prêmio, a apólice é cancelada (e o jornal noticia). | `insurance.ts`, `insuranceSystem`, `BudgetPanel.tsx` |
| **Bônus/malus:** −0,05 no multiplicador a cada ano sem sinistro (−0,07 com sequência de 8+), +0,2 a cada indenização; de ×0,6 a ×2. | `insuranceSystem`, `applyDisaster` |
| **Indenização automática** no momento do desastre: prejuízo (lotes, estoque, limpeza e reparos) − franquia × cobertura, mostrada na janela do desastre. | `applyDisaster`, `DisasterModal.tsx` |
| **Gravidade crescente:** cada ciclo quebrado seguido soma +50% (até 2×) e quebrar uma sequência de 5+ pesa +25%; concluir um ciclo zera a contagem. | `disasterIntensity`, `breaks` |
| **Construções danificadas** (desastre normal) param de operar até o **reparo** (30% do custo), pelo botão no lote ou na janela do desastre. | comando `repair`, `status.ts` |


*Manual: Disasters.*

Objetivo: dar peso ao compromisso com o ciclo. **Abandonar um ciclo que começou pode causar um
desastre**, e o jogador pode se proteger com um **seguro** contratado com antecedência.

### Já entregue (antecipado na Fase 2)

- **Saída pelo menu** (só com o foco encerrado): sincroniza as obras e **guarda a sequência**, que
  não decai até o próximo ciclo.
- **Fechar o jogo durante o foco:** o navegador avisa o servidor ao fechar a página. Na volta,
  o ciclo é **quebrado** (a sequência cai) e acontece um **desastre**.
- **Fechar sem o menu depois de concluir um foco:** **desastre leve** na volta.
- **Só abrir e fechar**, sem concluir foco, não causa nada.
- **Recarregar a página** não conta: há 2 minutos de tolerância (`LEAVE_GRACE_SECONDS`).
- **Abandonar o foco pelo botão** também causa um desastre.
- **Tipo de desastre** conforme a estação (incêndio na seca, enchente na chuva, nevasca no frio,
  tempestade ou praga). O desastre leve atinge 2 lotes, 10% de um estoque e até $100; o normal
  atinge 6 lotes, 30% de um estoque e até $500.
- **Limitação conhecida:** se o navegador for encerrado à força (sem o aviso de fechamento), a
  saída não é detectada e nada acontece. É uma falha a favor do jogador.

### Desastres por ciclo quebrado — próximos passos

- **Só o abandono e o fechamento indevido disparam desastre.** Ficar sem jogar nunca dispara
  nada (princípio 4).
- **A gravidade cresce com quebras seguidas** (hoje toda quebra causa um desastre de mesma
  intensidade); o contador zera após um ciclo concluído. O sorteio usa seed e é feito no servidor.
- **O tipo de desastre depende da estação e do clima** (Fase 2):
  - incêndio na seca;
  - enchente na estação chuvosa;
  - tempestade ou nevasca no inverno;
  - praga na lavoura (perda de comida estocada);
  - pane elétrica (usina parada por um ciclo).
- **Gravidade:**
  - reduzida pelos serviços (bombeiros na Fase 7, drenagem e caixas d'água na Fase 6);
  - maior para quem tinha uma sequência longa e a quebrou.
- **Danos possíveis:** lotes perdem níveis, construções ficam danificadas (inoperantes até
  reparo pago em dinheiro e materiais) e o estoque perde recursos.
- O relatório e o jornal (Fase 11) explicam o que aconteceu e por quê.

### Seguro da cidade

- **Opcional.** A cidade pode contratar ou não.
- **Prêmio por estação** (ciclo), proporcional ao valor da cidade (infraestrutura e estoque)
  e ao risco: histórico de quebras e cobertura de bombeiros.
- **Carência:** a cobertura só começa depois de **4 ciclos concluídos** (1 ano) desde a
  contratação (confirmado). Isso impede contratar logo depois de prever uma
  quebra. Cancelar e recontratar reinicia a carência.
- **Planos:**
  - **básico:** cobre 50% dos danos, com franquia;
  - **completo:** cobre 90% dos danos, com prêmio maior.
- **Indenização automática** no relatório do ciclo do sinistro.
- **Bônus e malus:** o prêmio cai a cada ano sem sinistro e com sequências longas de foco,
  e sobe após sinistros.
- **Sem dinheiro para o prêmio, a apólice fica suspensa.** Voltar a pagar exige nova carência.

**Critérios de aceite:**
- abandono → desastre sorteado com seed no servidor (replay impossível);
- ausência nunca dispara desastre;
- seguro com carência, franquia e cobertura testados;
- interface de contratação na pausa e relatório do sinistro.

## Fase 6 — Água ✅

### Entregue

| Entrega | Onde |
|---------|------|
| **Rede de água** como a de energia: passa por canos, construções e lotes zoneados vizinhos; estradas interrompem, a menos que um **cano** (subsolo, $3/tile) passe por baixo. Distribuição por proximidade das fontes; faltando água, os mais distantes ficam secos. | `water.ts` |
| **Fontes:** poço da prefeitura (20), **bomba** (25 como poço, 50 encostada em lago/rio; precisa de energia), **estação de tratamento** (recicla 30% do consumo da rede, até 40; desde 1903). A chuva da estação muda o rendimento das bombas (seca ~50%, estação chuvosa até 130%). | `catalog.ts`, `climateEffects.water` |
| **Caixa d'água** guarda a sobra (até 60) e cobre a falta nas estações secas. | `updateTowers` |
| **Efeitos:** lote **denso sem água não passa do nível 2** (e declina se estiver acima); **fazenda irrigada** segura a colheita (mínimo 85%) no inverno e na seca; "Água encanada" alegra os moradores; manchete "Torneiras secas" quando falta. | `zones.ts`, `extractionSystem`, `citizens.ts`, `newspaper.ts` |
| **Visão subterrânea 💧** (Visualizar → Água, ou ao escolher o cano): cidade translúcida, canos e tiles abastecidos/secos; demolir nessa visão remove canos. Medidor 💧 na barra. | `CityScene.ts`, `Hud.tsx` |
| **Dessalinização** fica para a Fase 9 (Terreno): os mapas atuais só têm água doce. | — |


*Manual: Water System.*

- **Bombas:**
  - longe da água funcionam como poço;
  - encostadas em água doce rendem 2×;
  - na costa salgada rendem como poço;
  - precisam de energia.
- **Caixas d'água** guardam excedente para os ciclos secos. **Estação de tratamento** reduz as faltas.
  **Dessalinização** é cara e rende 2× uma bomba de rio.
- **Encanamento** em uma camada subterrânea, com visão alternada no Phaser.
- **Sem água, a densidade fica limitada:** zonas densas não passam do nível 2.
- **Ligação com o Rank:** a água tratada pode ter "pureza" e alimentar a saúde na Fase 7.

## Fase 7 — Serviços e qualidade de vida ✅

*Manual: City Services, Education, Health, Crime, Pollution, Land Value.*

- **Campos espaciais** recalculados por ciclo com decaimento por distância: crime, poluição,
  valor do solo e cobertura de polícia e bombeiros.
- **Polícia:** reduz o crime em um raio. A prisão melhora a eficiência das delegacias quando o crime
  é alto.
- **Bombeiros:** reduzem a gravidade dos incêndios da Fase 5 (e baixam o prêmio do seguro).
- **Saúde:** o hospital atende até N habitantes. A expectativa de vida sobe ou cai devagar.
- **Educação (QE de 0 a 150):**
  - escola até 90, faculdade até 140;
  - bibliotecas e museus impedem a erosão do QE;
  - QE alto libera indústrias high-tech na Fase 13.
- **Lazer** (praças, parques, zoológico, estádio, marina): aumenta o valor do solo e a demanda residencial.
  O **estádio** e o **turismo** (hotéis e restaurantes como comércio especializado) servem às metas da Fase 12.
- O valor do solo passa a definir a riqueza dos moradores e os impostos.
- Overlays: crime, poluição, valor do solo e cobertura.

**Implementado (`src/sim/services.ts`):**

- 12 construções: delegacia, bombeiros, prisão (120 hab.), hospital, escola, faculdade (120 hab.),
  biblioteca, museu (1905), praça, parque, zoológico (80 hab.) e estádio (150 hab.).
- Poluição: usinas, mineração, serraria e fundição, indústria e estradas; praças e parques limpam.
- Crime: densidade, desemprego e tamanho da cidade; delegacias reduzem em raio de 8 tiles, prisão
  dá +30% com crime alto. Crime > 60 trava R e C; poluição > 55 trava R.
- Valor do solo: centro, água perto, serviços e lazer valorizam; poluição e crime desvalorizam.
  Os lotes mais valorizados crescem primeiro. Classe de renda (baixa/média/alta) muda o imposto
  residencial (×0,8 / ×1 / ×1,25).
- QE: escola leva até 90, faculdade até 140 (só para quem passou pela escola); sem escola o QE
  cai 10% da diferença por estação, 2% com biblioteca ou museu.
- Expectativa de vida: hospitais, poluição e QE definem o alvo; anda no máximo 1 ano por estação.
- Verbas novas: polícia, bombeiros, saúde e educação (efeito 50% com verba zero).
- Bombeiros: até 70% de chance de salvar cada lote/prédio no incêndio; prêmio do seguro até 25% menor.
- Moradores: "Bairro seguro/perigoso", "Ar poluído", "Parque perto de casa", "Escola no bairro",
  "Atendimento médico"; empregos de policial, bombeiro, médico, professor etc.
- Jornal: notícias de crime, poluição, educação e expectativa de vida. Schema v9.

## Fase 8 — Transporte avançado ✅

*Manual: Transportation, traffic model.*

- **Tráfego por geração de viagens** simplificada: cada lote procura destino em outro tipo de zona
  dentro de um tempo-limite. Estradas carregadas ficam congestionadas, poluem e reduzem a demanda.
- **Ônibus:** pares de pontos reduzem o tráfego nas vias atendidas.
- **Trilhos e estações:** carregam mais passageiros e ajudam a indústria pesada.
- **Rodovias com acessos:** comportam o dobro de carros e permitem viagens 3× mais longas.
- **Portos:** o aeroporto impulsiona o comércio a partir de certa população, e o porto marítimo
  impulsiona a indústria.

**Implementado (`src/sim/traffic.ts`):**

- Cada lote residencial procura o emprego mais perto: comércio, indústria ou construção com
  vagas (pontos e estações não contam como destino).
- Busca pelo caminho mais curto (Dijkstra), com limite de 14 quadras.
- Custo por tile: estrada 1, acesso 1, rodovia 1/3, estação 1, trilho 1/4.
- A rodovia só se liga à estrada pelo **acesso** e não dá acesso a lotes.
- Quem mora a até 3 tiles do trabalho vai a pé.
- Capacidade por tile: estrada 10 viagens, rodovia 20.
- Via congestionada:
  - polui até 7× mais;
  - derruba a demanda R e C;
  - deixa os moradores tristes ("Trânsito parado").
- Com 60+ habitantes, lote residencial sem emprego ao alcance não cresce ("Trabalho longe demais").
- Ônibus: com pelo menos 2 pontos, quem mora e trabalha perto de pontos (raio 4) tira 60% dos
  carros da rua.
- Trem: estações ligam estrada e trilho. Indústria a até 5 tiles de uma estação produz até 25%
  mais (frete).
- Aeroporto (200 hab.): +15% de demanda comercial. Porto (beira d'água, 60 hab.): +15% de demanda
  industrial.
- Visão 🚗 Trânsito, carga por tile no painel do tile, relatório, jornal e novos empregos
  (motorista, maquinista, estivador).

## Fase 9 — Terreno e paisagem ✅

*Manual: Terrain/Landscape tools.*

- **Altitude** com rampas no isométrico, e pontes e túneis.
- **Árvores** aumentam o valor do solo. **Água** pode ser criada (caro, pago com Rank).
- **Editor de mapa antes de fundar a cidade:** rios, costa, lagos e floresta, combinando com o bioma
  derivado do clima. O mapa é sempre fictício (não reproduz um lugar real).

**Implementado (`src/sim/terrain.ts`):**

- Cidades novas são **40×40**. As antigas mantêm o tamanho e ganham relevo plano e as árvores que
  já apareciam como decoração (schema v10).
- **Editor de mapa** na fundação:
  - relevo plano, com colinas ou montanhoso;
  - água: seco, lagos, rio, ou rio e lagos;
  - mar em qualquer lado, com **água salgada**;
  - mata de 0 a 3;
  - 🎲 para gerar outro mapa;
  - prévia ao vivo. A mesma seed e as mesmas opções geram o mesmo mapa no servidor.
- **Altitude** de 0 a 3:
  - terraços com paredões na visão isométrica;
  - morros escondem o que está atrás;
  - vias vencem 1 nível por **rampa** (desenhada no paredão);
  - 2 níveis ou mais só por **túnel**, construído em terreno de nível 2+;
  - morros valorizam o solo pela vista (+3 por nível).
- **Pontes:** estrada, rodovia e trilho atravessam a água, custando 4× em dinheiro e 2× em recursos.
- **Terraplanagem**, com desconto pelo Rank do foco (até −40% no S):
  - elevar e rebaixar;
  - criar água (só no nível 0);
  - aterrar água doce, gastando madeira;
  - plantar árvore.
- **Árvores:**
  - valorizam o solo e limpam o ar;
  - construir em cima, lote crescendo ou demolir a árvore rende 1 madeira.
- **Dessalinizadora** (encostada no mar, 80 de água, não depende da chuva) e **marina** (lazer à
  beira d'água).
- Enchentes atingem primeiro os lotes baixos à beira d'água.
- **Recursos visíveis:**
  - ícone 📦 na barra superior com o estoque de cada recurso;
  - ao clicar, a previsão da estação: produção, consumo, saldo, quantas estações o estoque dura,
    preço de importação e custo da falta por estação;
  - cada construção mostra o custo em recursos (vermelho quando falta) e quanto será importado;
  - ao construir com falta, um aviso mostra o que foi importado e por quanto.

## Fase 10 — Eras, invenções e recompensas

*Manual: Inventions timeline, Rewards, power plant aging.*

- **Árvore tecnológica por ano da cidade**, ou seja, por ciclos acumulados.
  - Exemplos: ônibus em ~1920, tratamento de água em ~1935, nuclear em ~1955, solar e
    dessalinização em ~1990, fusão em ~2050.
  - Com 4 ciclos por ano, 1920 chega após ~80 ciclos (~10 dias de foco) e 2050 após ~600.
    As datas podem ser comprimidas se o ritmo ficar lento demais.
  - Cada invenção sai no jornal (Fase 11).
- **Vida útil das usinas:** 50 anos, ou seja, 200 ciclos, com avisos antes do fim. Isso cria um
  planejamento de longo prazo.
- **Marcos de população** liberam construções especiais: residência do prefeito, nova prefeitura,
  monumento e megaestruturas habitacionais densas. Algumas exigem materiais de Rank S.

## Fase 11 — Informação

*Manual: Graphs, Map window, Newspapers, Query tool.*

- **Gráficos históricos** (1 ano, 10 anos e 100 anos, ou seja, 4, 40 e 400 ciclos) de população, empregos, poluição, crime, energia,
  água e finanças, a partir de snapshots no `cycle_log`.
- **Jornal da cidade a cada estação:** manchetes de invenções, marcos, opinião pública (as maiores
  queixas) e o clima da estação.
- **Ferramenta de consulta:** clique em um tile para ver nível, energia, água, valor e idade.
- **Minimapa** com camadas temáticas.

## Fase 12 — Grandes eventos e metas

Objetivo: dar objetivos de médio prazo. **Eventos sorteados** são anunciados com anos de
antecedência e trazem **metas** para a cidade cumprir até a data.

### Como funciona

- **Convite:** um evento é sorteado com seed e anunciado no jornal. Exemplo: "a cidade foi
  escolhida para sediar uma copa de futebol daqui a 6 anos", ou seja, 24 ciclos.
- **O jogador aceita ou recusa.** Recusar não tem custo; aceitar compromete a cidade com as metas.
- **Exemplos de metas:**
  - construir um **estádio**;
  - ter **N leitos de hotel** e **N restaurantes** (comércio especializado da Fase 7);
  - **melhorar o transporte**: capacidade de tráfego, ônibus ou metrô até o estádio (Fase 8);
  - energia de reserva, segurança e cobertura de saúde;
  - estoque de comida para os visitantes.
- **Progresso na HUD:** checklist de metas com contagem regressiva em estações.

### Resultado

- **Todas as metas cumpridas:**
  - boom de turismo (receita extra por alguns ciclos);
  - reputação maior (mais demanda residencial e comercial);
  - uma construção-troféu exclusiva.
- **Parcial:** recompensa proporcional.
- **Fracasso:** manchetes negativas e uma queda leve e temporária da demanda. Nunca é catastrófico.

### Catálogo inicial de eventos

Os nomes são próprios e genéricos (sem marcas de eventos reais):
- copa de futebol;
- jogos regionais;
- feira internacional;
- festival de música;
- visita de chefe de Estado;
- bienal de arte, ligada à galeria do POMO-CITY.

### Dependências

Estádio, hotéis e restaurantes (Fase 7), transporte (Fase 8) e jornal (Fase 11). A estrutura de
eventos e metas pode ser criada antes, com metas que usam só o que já existe.

**Critérios de aceite:**
- evento sorteado e anunciado com antecedência;
- aceitar ou recusar;
- metas verificadas a cada ciclo;
- recompensas e consequências aplicadas no prazo, com testes.

## Fase 13 — Indústrias e vizinhos

*Manual: Industry window, Neighbors, national demand.*

- **Setores industriais** (aço, alimentos, eletrônicos, petroquímica…) com **demanda nacional**
  variável por era, e impostos por setor para incentivar ou frear um setor.
- **Os vizinhos são os outros jogadores:** a demanda externa e o turismo vêm das cidades
  vizinhas. O **mercado multiplayer** (livro de ofertas por recurso e Rank) passa a dividir espaço
  com o mercado externo da Fase 3. Recursos Rank A e S, que o mercado externo não vende,
  só são obtidos produzindo ou comprando de outros jogadores.
- **Desafios:** cidade pré-montada, problema, meta e prazo em ciclos. São cenários adaptados como
  desafios semanais de foco.

---

## Como delegar uma fase

Ao iniciar uma fase, inclua no pedido:

1. A fase (por exemplo, "Fase 5 — Seguro da cidade").
2. Ajustes de escopo ou pareceres sobre as fases anteriores.
3. As prioridades: o que é obrigatório e o que pode ficar para depois.

Cada fase entrega: regras em `src/sim` com testes; validação no servidor; HUD e overlay quando houver;
migração de estado se mudar o schema; e atualização deste documento.
