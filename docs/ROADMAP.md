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
   jogar não custa nada. Já **abandonar um ciclo que começou** pode causar um desastre na
   cidade (Fase 5). O seguro e os serviços públicos amortecem esses desastres.
5. **O servidor é a autoridade.** Toda regra nova vive em `src/sim` (TS puro e
   determinístico) e é revalidada pelo servidor. Aleatoriedade usa PRNG com seed.

## Visão geral

| Fase | Tema | O que entra | Status |
|------|------|-------------|--------|
| 0 | Preparação técnica | Fundação para as demais | ✅ Concluída |
| 1 | Zoneamento e energia | Zonas R/C/I, crescimento orgânico, demanda, usinas, linhas, apagões | ✅ Concluída |
| 2 | Clima e estações | Escolha da região (só o clima), hemisfério, estações, chuvas e secas, bioma | ⏳ Próxima |
| 3 | Economia de recursos | Estoque, consumo dos cidadãos e das obras, compra e venda externa, valor por Rank, excedente | ⏳ |
| 4 | Orçamento e finanças | Impostos por zona, financiamento de departamentos, títulos e rating, decretos | ⏳ |
| 5 | Ciclos quebrados, desastres e seguro | Desastres causados por ciclos abandonados, seguro com carência | ⏳ |
| 6 | Água | Bombas, poços, caixas d'água, tratamento, dessalinização, camada subterrânea | ⏳ |
| 7 | Serviços e qualidade de vida | Polícia, bombeiros, saúde, educação, lazer, estádio, turismo, crime, poluição, valor do solo | ⏳ |
| 8 | Transporte avançado | Tráfego, ônibus, trilhos, rodovias, portos | ⏳ |
| 9 | Terreno e paisagem | Altitude, árvores, água, pontes e túneis, editor de mapa | ⏳ |
| 10 | Eras, invenções e recompensas | Árvore tecnológica por ano, vida útil de usinas, marcos de população | ⏳ |
| 11 | Informação | Gráficos, jornal da cidade, ferramenta de consulta, minimapa | ⏳ |
| 12 | Grandes eventos e metas | Eventos sorteados com anos de antecedência (ex.: uma copa) e metas para a cidade | ⏳ |
| 13 | Indústrias e vizinhos | Setores industriais, vizinhos = outros jogadores, mercado multiplayer | ⏳ |

As fases 2 em diante são delegadas uma a uma, conforme os pareceres sobre o desenvolvimento.

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

## Fase 2 — Clima e estações

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

**Critérios de aceite:**
- fundar a cidade escolhendo a própria região ou outra;
- estações nomeadas conforme o hemisfério e o tipo de clima;
- clima sazonal afetando agricultura e energia, com testes;
- cidades antigas pedem a região uma vez;
- nenhuma coordenada é armazenada.

## Fase 3 — Economia de recursos

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
- **O mercado externo só negocia até o Rank B.** Recursos A e S precisam ser produzidos ou
  comprados de outros jogadores (Fase 13), o que preserva o valor do foco de alta qualidade.

### Valor e rendimento por Rank

| Rank | D | C | B | A | S |
|------|---|---|---|---|---|
| Valor de venda | 100% | 110% | 120% | 130% | 140%* |
| Rendimento | 1,0 | 1,1 | 1,2 | 1,3 | 1,4* |

- **"Rende o equivalente":** 1 unidade de comida A alimenta como 1,3 unidade de comida D,
  e 1 tábua A vale 1,3 tábua D numa obra. Em suma, foco de qualidade rende mais por unidade.
- \*O valor do Rank S não foi definido. A sugestão é 140%, seguindo a progressão de +10%.

### Excedente: vender ou estocar

- **Política por recurso**, definida na pausa:
  - estocar tudo;
  - vender tudo o que passar da demanda;
  - vender uma porcentagem do excedente;
  - manter uma reserva mínima (por exemplo, 2 estações de comida) e vender o resto.
- A venda acontece no fim do ciclo, e o relatório mostra o que foi produzido, consumido,
  comprado, vendido e estocado.

### Ajustes no que já existe

- O **desperdício industrial** por Rank (D 40% … S 0%) e a **eficiência da termelétrica** por
  Rank precisam ser harmonizados com o rendimento acima, para o Rank não contar duas vezes.
  Sugestão: manter o desperdício só no refino e usar o rendimento no consumo e nas obras.

**Critérios de aceite:**
- cidade jogável só com dinheiro (importação automática);
- produzir localmente reduz o gasto, com testes que comparam as duas cidades;
- valor e rendimento por Rank aplicados na venda, no consumo e nas obras;
- políticas de excedente e limite de estoque funcionando;
- relatório do ciclo com o balanço por recurso.

## Fase 4 — Orçamento e finanças

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

## Fase 5 — Ciclos quebrados, desastres e seguro

*Manual: Disasters.*

Objetivo: dar peso ao compromisso com o ciclo. **Abandonar um ciclo que começou pode causar um
desastre**, e o jogador pode se proteger com um **seguro** contratado com antecedência.

### Desastres por ciclo quebrado

- **Só o abandono dispara desastre.** Ficar sem jogar nunca dispara nada (princípio 4).
- **A chance cresce com quebras seguidas.** Por exemplo, 1ª quebra 30%, 2ª seguida 50%,
  3ª 70%; o contador zera após um ciclo concluído. O sorteio usa seed e é feito no servidor.
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
- **Carência:** a cobertura só começa depois de **N ciclos concluídos** desde a contratação
  (sugestão: 4 ciclos, ou seja, 1 ano). Isso impede contratar logo depois de prever uma
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

## Fase 6 — Água

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

## Fase 7 — Serviços e qualidade de vida

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

## Fase 8 — Transporte avançado

*Manual: Transportation, traffic model.*

- **Tráfego por geração de viagens** simplificada: cada lote procura destino em outro tipo de zona
  dentro de um tempo-limite. Estradas carregadas ficam congestionadas, poluem e reduzem a demanda.
- **Ônibus:** pares de pontos reduzem o tráfego nas vias atendidas.
- **Trilhos e estações:** carregam mais passageiros e ajudam a indústria pesada.
- **Rodovias com acessos:** comportam o dobro de carros e permitem viagens 3× mais longas.
- **Portos:** o aeroporto impulsiona o comércio a partir de certa população, e o porto marítimo
  impulsiona a indústria.

## Fase 9 — Terreno e paisagem

*Manual: Terrain/Landscape tools.*

- **Altitude** com rampas no isométrico, e pontes e túneis.
- **Árvores** aumentam o valor do solo. **Água** pode ser criada (caro, pago com Rank).
- **Editor de mapa antes de fundar a cidade:** rios, costa, lagos e floresta, combinando com o bioma
  derivado do clima. O mapa é sempre fictício (não reproduz um lugar real).

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

1. A fase (por exemplo, "Fase 2 — Clima e estações").
2. Ajustes de escopo ou pareceres sobre as fases anteriores.
3. As prioridades: o que é obrigatório e o que pode ficar para depois.

Cada fase entrega: regras em `src/sim` com testes; validação no servidor; HUD e overlay quando houver;
migração de estado se mudar o schema; e atualização deste documento.
