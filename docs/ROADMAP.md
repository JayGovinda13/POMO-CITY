# POMO-CITY — Roadmap de funcionalidades

Este documento organiza em fases as mecânicas clássicas de city-builder que vamos
adaptar para o POMO-CITY. A referência de estudo foi o manual do SimCity 2000 (Maxis, 1993).

> **Originalidade.** Usamos o manual só como referência de *mecânicas de gênero*:
> zoneamento, energia, água, serviços e orçamento. Nomes, textos, arte, ícones e
> números do POMO-CITY são próprios. Não usamos marcas, personagens nem elementos
> visuais do jogo original.

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
3. **O lugar importa.** Ao fundar a cidade, o jogador escolhe a **própria localidade**
   (mesmo clima e mesmas estações) ou **outra parte do mundo**. As estações, o clima e o
   bioma vêm dessa escolha (Fase 2).
4. **Nunca punir a ausência.** Nada decai em tempo real. Desastres, envelhecimento e
   manutenção só acontecem quando ciclos são concluídos, e sempre podem ser mitigados.
5. **O servidor é a autoridade.** Toda regra nova vive em `src/sim` (TS puro e
   determinístico) e é revalidada pelo servidor. Aleatoriedade usa PRNG com seed.

## Visão geral

| Fase | Tema | Mecânicas do manual adaptadas | Status |
|------|------|-------------------------------|--------|
| 0 | Preparação técnica | — (fundação para as demais) | ✅ Concluída |
| 1 | Zoneamento e energia | Zonas R/C/I leve/densa, crescimento orgânico, indicador de demanda, usinas, linhas de transmissão, apagões | ✅ Concluída |
| 2 | Localização, clima e estações | Escolha do local no início, hemisfério e nome das estações, clima sazonal, bioma derivado do clima | ⏳ Próxima |
| 3 | Orçamento e finanças | Impostos por zona, financiamento de departamentos, títulos e rating, decretos municipais | ⏳ |
| 4 | Água | Bombas, poços, caixas d'água, tratamento, dessalinização, camada subterrânea | ⏳ |
| 5 | Serviços e qualidade de vida | Polícia, bombeiros, saúde, educação (QE), crime, poluição, valor do solo | ⏳ |
| 6 | Transporte avançado | Tráfego por geração de viagens, ônibus, trilhos, rodovias, portos | ⏳ |
| 7 | Terreno e paisagem | Altitude, árvores, água, pontes e túneis, editor de mapa | ⏳ |
| 8 | Eras, invenções e recompensas | Árvore tecnológica por ano, vida útil de usinas, marcos de população, megaestruturas | ⏳ |
| 9 | Informação | Gráficos históricos, jornal da cidade, ferramenta de consulta, mapas temáticos | ⏳ |
| 10 | Eventos | Desastres opcionais e mitigáveis, ligados ao clima da estação | ⏳ |
| 11 | Indústrias e vizinhos | Setores industriais com demanda nacional, impostos por setor, vizinhos = outros jogadores | ⏳ |

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

## Fase 2 — Localização, clima e estações

*Manual: Climate, Water (variação sazonal), Power (solar/eólica dependem do tempo).*

Objetivo: a cidade vive no mesmo lugar e nas mesmas estações que o jogador escolher.
Ela é jogada sobre o clima real daquela região.

### Fundar a cidade: escolher o lugar

- **"Minha localidade"**: usa a geolocalização do navegador (com permissão) ou o nome da
  cidade digitado. A cidade terá o mesmo clima e as mesmas estações que o jogador vive.
- **"Outra parte do mundo"**: escolha em um mapa-múndi ou em uma lista de regiões. Serve
  para jogar no inverno do outro hemisfério, no deserto ou na tundra.
- **Privacidade:**
  - a geolocalização é opcional;
  - só gravamos a coordenada arredondada (~1°, cerca de 100 km) e o perfil climático derivado;
  - nunca gravamos a posição exata.
- **Cidades já existentes:** no próximo acesso, o jogador escolhe o lugar uma única vez.
  A escolha define clima e hemisfério, e o mapa atual é mantido.

### Calendário e estações

- 1 ciclo = 1 estação. O **hemisfério** dá nome às estações: Jan–Mar é verão no Sul e
  inverno no Norte.
- **Regiões tropicais** usam as estações que existem de fato (chuvosa e seca) em vez de
  quatro estações temperadas.
- A cidade **começa na estação real atual** do local escolhido. Depois disso, o calendário
  avança uma estação por ciclo concluído.
- **Na pausa, a HUD mostra a próxima estação**, para planejar. Exemplo: "inverno chegando:
  estoque madeira para a termelétrica".

### Clima → simulação

- **Perfil climático por trimestre:** temperatura média, chuva, horas de sol e vento, a partir
  de normais climatológicas.
- **O tempo de cada ciclo é sorteado com seed** em torno da normal da estação: ano seco,
  inverno rigoroso etc. Cliente e servidor chegam ao mesmo resultado.
- **Efeitos:**
  - **Agricultura:** colheita forte na estação quente ou chuvosa, fraca no inverno ou na seca.
  - **Energia:** solar acompanha as horas de sol; eólica acompanha o vento; hidrelétrica
    acompanha a chuva (a seca reduz a geração).
  - **Consumo:** aquecimento em invernos frios e refrigeração em verões quentes aumentam a
    demanda de energia, o que torna os apagões sazonais.
  - **Água (Fase 4):** chuva e seca definem o abastecimento, e caixas d'água guardam excedente
    entre estações.

### Bioma derivado do clima

- O bioma deixa de ser sorteado e passa a vir do clima do local, numa classificação
  simplificada:
  - tropical úmido → floresta;
  - temperado → planície;
  - semiárido ou árido → **deserto** (novo);
  - frio ou polar → **tundra** (novo);
  - altitude → montanhas.
- Novos biomas ampliam a **produção assimétrica** e o comércio entre jogadores.
- **Litoral:** um local costeiro gera mapa com costa, e regiões com rios geram rios.

### Multiplayer

Jogadores em hemisférios opostos têm safras em épocas opostas. Isso cria **comércio sazonal**
natural: comida do Sul no inverno do Norte. É um gancho para o mercado da Fase 11.

### Decisões em aberto

1. **Fonte dos dados climáticos:**
   - (a) uma tabela própria embutida com ~40 regiões, sem dependência externa;
   - (b) um serviço de normais climáticas consultado na fundação, para qualquer coordenada.
   - Sugestão: começar com (a) e encaixar a localização do jogador na região mais próxima.
2. **Geografia real:** usar relevo e costa reais exige dados geográficos. Sugestão:
   - nesta fase, só parâmetros (costa sim ou não, rios, densidade de floresta);
   - a geografia real fica como opção da Fase 7.

**Critérios de aceite:**
- fundar a cidade com localização própria ou escolhida;
- estações nomeadas conforme o hemisfério;
- clima sazonal afetando agricultura e energia, com testes;
- cidades antigas pedem o local uma vez;
- nenhuma coordenada exata é armazenada.

## Fase 3 — Orçamento e finanças

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

## Fase 4 — Água

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
- **Ligação com o Rank:** a água tratada pode ter "pureza" e alimentar a saúde na Fase 5.

## Fase 5 — Serviços e qualidade de vida

*Manual: City Services, Education, Health, Crime, Pollution, Land Value.*

- **Campos espaciais** recalculados por ciclo com decaimento por distância: crime, poluição,
  valor do solo e cobertura de polícia e bombeiros.
- **Polícia:** reduz o crime em um raio. A prisão melhora a eficiência das delegacias quando o crime
  é alto.
- **Bombeiros:** reduzem o risco de incêndio e se preparam para a Fase 10.
- **Saúde:** o hospital atende até N habitantes. A expectativa de vida sobe ou cai devagar.
- **Educação (QE de 0 a 150):**
  - escola até 90, faculdade até 140;
  - bibliotecas e museus impedem a erosão do QE;
  - QE alto libera indústrias high-tech na Fase 11.
- **Lazer** (praças, parques, zoológico, estádio, marina): aumenta o valor do solo e a demanda residencial.
- O valor do solo passa a definir a riqueza dos moradores e os impostos.
- Overlays: crime, poluição, valor do solo e cobertura.

## Fase 6 — Transporte avançado

*Manual: Transportation, traffic model.*

- **Tráfego por geração de viagens** simplificada: cada lote procura destino em outro tipo de zona
  dentro de um tempo-limite. Estradas carregadas ficam congestionadas, poluem e reduzem a demanda.
- **Ônibus:** pares de pontos reduzem o tráfego nas vias atendidas.
- **Trilhos e estações:** carregam mais passageiros e ajudam a indústria pesada.
- **Rodovias com acessos:** comportam o dobro de carros e permitem viagens 3× mais longas.
- **Portos:** o aeroporto impulsiona o comércio a partir de certa população, e o porto marítimo
  impulsiona a indústria.

## Fase 7 — Terreno e paisagem

*Manual: Terrain/Landscape tools.*

- **Altitude** com rampas no isométrico, e pontes e túneis.
- **Árvores** aumentam o valor do solo. **Água** pode ser criada (caro, pago com Rank).
- **Editor de mapa antes de fundar a cidade:** rios, costa, lagos e floresta, combinando com os biomas
  existentes.

## Fase 8 — Eras, invenções e recompensas

*Manual: Inventions timeline, Rewards, power plant aging.*

- **Árvore tecnológica por ano da cidade**, ou seja, por ciclos acumulados.
  - Exemplos: ônibus em ~1920, tratamento de água em ~1935, nuclear em ~1955, solar e
    dessalinização em ~1990, fusão em ~2050.
  - Com 4 ciclos por ano, 1920 chega após ~80 ciclos (~10 dias de foco) e 2050 após ~600.
    As datas podem ser comprimidas se o ritmo ficar lento demais.
  - Cada invenção sai no jornal (Fase 9).
- **Vida útil das usinas:** 50 anos, ou seja, 200 ciclos, com avisos antes do fim. Isso cria um
  planejamento de longo prazo.
- **Marcos de população** liberam construções especiais: residência do prefeito, nova prefeitura,
  monumento e megaestruturas habitacionais densas. Algumas exigem materiais de Rank S.

## Fase 9 — Informação

*Manual: Graphs, Map window, Newspapers, Query tool.*

- **Gráficos históricos** (1 ano, 10 anos e 100 anos, ou seja, 4, 40 e 400 ciclos) de população, empregos, poluição, crime, energia,
  água e finanças, a partir de snapshots no `cycle_log`.
- **Jornal da cidade a cada estação:** manchetes de invenções, marcos, opinião pública (as maiores
  queixas) e o clima da estação.
- **Ferramenta de consulta:** clique em um tile para ver nível, energia, água, valor e idade.
- **Minimapa** com camadas temáticas.

## Fase 10 — Eventos

*Manual: Disasters.*

- **Eventos negativos ligados ao clima da estação:** incêndio na seca, enchente na estação
  chuvosa, tempestade.
- São sempre **opcionais** (configuração) e **mitigáveis** pela infraestrutura (bombeiros,
  drenagem, caixas d'água).
- Nunca são disparados por ausência. A gravidade cai com a sequência de foco, o que
  recompensa a constância.

## Fase 11 — Indústrias e vizinhos

*Manual: Industry window, Neighbors, national demand.*

- **Setores industriais** (aço, alimentos, eletrônicos, petroquímica…) com **demanda nacional**
  variável por era, e impostos por setor para incentivar ou frear um setor.
- **Os vizinhos são os outros jogadores:** a demanda externa e o turismo vêm das cidades reais
  vizinhas. Isso prepara o **mercado multiplayer** (livro de ofertas por recurso e Rank).
- **Desafios:** cidade pré-montada, problema, meta e prazo em ciclos. São cenários adaptados como
  desafios semanais de foco.

---

## Como delegar uma fase

Ao iniciar uma fase, inclua no pedido:

1. A fase (por exemplo, "Fase 2 — Localização, clima e estações").
2. Ajustes de escopo ou pareceres sobre as fases anteriores.
3. As prioridades: o que é obrigatório e o que pode ficar para depois.

Cada fase entrega: regras em `src/sim` com testes; validação no servidor; HUD e overlay quando houver;
migração de estado se mudar o schema; e atualização deste documento.
