# Balanceamento do POMO-CITY

Este documento explica como o equilíbrio do jogo é medido, o que foi encontrado e o que mudou.
O balanceamento é feito com dados, não com palpites.

## Como medir

```bash
npm run balance
```

O comando roda um **robô** (`scripts/balance/bot.ts`) que joga a cidade como um jogador
cuidadoso. Ele:

- abre ruas paralelas aos poucos;
- zoneia o residencial a oeste, o comércio a nordeste e a indústria a sudeste;
- constrói fazendas e serrarias pela previsão de recursos;
- constrói usinas quando a energia aperta e bombas quando a água aperta;
- constrói serviços pelo tamanho da cidade;
- repara o que um desastre quebrou;
- quando abandona um ciclo, sofre o desastre de verdade.

A saída é uma linha por ano da cidade, com:

- população e moradia;
- caixa, saldo, impostos, manutenção, compras e vendas;
- estoque de cada recurso;
- energia, água e desemprego;
- aprovação, QE, crime, poluição e valor do solo;
- trânsito e demanda R/C/I.

Cenários:

| Cenário | O que mede |
| --- | --- |
| Focado (6 ciclos/dia) | o ritmo esperado de quem usa o Pomodoro de verdade |
| Casual (3/dia, 10% de ciclos abandonados) | quem joga pouco e quebra ciclos, sofrendo os desastres |
| Fácil / Difícil | se as dificuldades se diferenciam |
| Inverno rigoroso (Moscou) | clima duro: aquecimento, lavoura fraca |
| Sem produção local | quanto custa depender só do mercado externo |

## O que foi encontrado e corrigido

### 1. "Apagão" falso

- **Problema:** uma única construção sem fio (isolada da rede) marcava *apagão* na cidade
  inteira e virava manchete no jornal.
- **Correção:** apagão agora significa uma rede **com usina** que não dá conta da demanda. Construção
  isolada aparece como "sem energia" no mapa e é contada em `disconnected`.

### 2. Um apagão curto derrubava meia cidade

- **Problema:** um lote sem energia perdia um nível todo ciclo. Faltar 0,9 MW levou a cidade de
  44 para 24 moradores numa estação.
- **Correção:** sem energia (ou sem água, se denso), o lote tem **1 chance em 3** de perder um nível
  por ciclo. Sem estrada, ele continua decaindo sempre.

### 3. Armadilha do caixa negativo

- **Problema:** com o caixa negativo, nenhum lote conseguia pagar o material para crescer. A cidade
  ficava presa (3 anos com 12 moradores no Difícil).
- **Correção:** o **1º nível de um lote leve** cresce mesmo sem material nem dinheiro: os moradores
  constroem por conta própria. Se houver material em estoque, ele ainda é consumido.

### 4. Energia apertada demais no começo

- **Problema:** com 60 moradores a cidade pedia 36 MW. A prefeitura dava 12 MW e a primeira
  termelétrica custa cerca de $710.
- **Correção:**
  - prefeitura: 12 → **20 MW**;
  - bomba d'água: consumo 3 → **1 MW**;
  - eólica: 6 → **8 MW**.

### 5. Dinheiro sobrando na cidade madura

- **Problema:** com 300 moradores, a cidade ganhava cerca de +$700 por estação, porque a manutenção
  era só 39% dos impostos.
- **Correção:**
  - imposto residencial: $3 → **$2,20** por morador (na alíquota padrão de 9%);
  - nova despesa **Administração**: $1 por morador acima de 60. É zero no começo e cresce com a
    cidade;
  - serviços com manutenção mais alta: delegacia 6 → 9, bombeiros 6 → 9, hospital 8 → 12,
    escola 4 → 5, faculdade 10 → 14, prisão 12 → 15.

### 6. Dificuldades parecidas demais

- **Problema:** o Difícil terminava igual ao Médio.
- **Correção:** a manutenção é multiplicada pela dificuldade: **0,85×** no Fácil, 1× no Médio e
  **1,25×** no Difícil.

## Resultado (robô, 60 ciclos = 15 anos)

| Cenário | 1902 | 1906 | Final | Manutenção / impostos no fim |
| --- | --- | --- | --- | --- |
| Fácil | 144 moradores | 268 | 312 | 58% |
| Médio (focado) | 116 | 216 | 304 | 52% |
| Difícil | 108 | 192 | 384* | 68% (caixa apertado até ~1912) |
| Casual (10% de quebras) | 100 | 144 | 316 | sete desastres, ~$700 de prejuízo cada |
| Moscou | 76 | 164 | 260 | compra $370–440 por estação (lenha e bens) |
| Sem produção local | 75 | 97 | ~90 | 32 ciclos de fome; compras de $5k |

\* A população final esbarra no traçado de ruas do robô (cerca de 300 a 380 lotes). O que importa é a
curva até lá.

**Leitura:**

- O começo é apertado: o caixa fica entre $100 e $600 nos primeiros anos.
- O meio rende o suficiente para crescer: +$300 a +$500 por estação.
- Produzir os próprios recursos faz enorme diferença: a cidade fica 3× maior e não passa fome. É
  o que o painel 📦 Recursos mostra para o jogador.
- Foco consistente acelera a cidade, mas quem joga menos não fica para trás para sempre.
- Abandonar ciclos dói: cada desastre custa em média 1,5 a 2 estações de lucro.

## Pontos para acompanhar

- **Apagões:** o robô ainda passa de 25 a 45 dos 60 ciclos com alguma rede apertada, porque
  constrói usinas de forma reativa. Um jogador atento sofre menos. Se os jogadores reclamarem,
  baixar `ZONES.*.powerPerLevel`.
- **Moscou:** a aprovação fica entre 30% e 60% por anos, por causa do frio e da lenha cara. É duro,
  mas recuperável.
- **Poluição:** a média chega a 50 quando as termelétricas ficam no centro. É uma consequência do
  posicionamento, não do número.
- **Seguro:** o prêmio está em 0,4% a 0,8% do valor da cidade por estação; o robô não o contrata.
  Vale um cenário específico quando as metas da Fase 12 existirem.
