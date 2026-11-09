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

## Como jogar (MVP)

1. Na **pausa**, construa: estradas ligadas à prefeitura, casas, fazendas, madeireiras, minas, serraria, fundição.
2. Clique em **Iniciar foco**. As obras feitas offline são enviadas e revalidadas pelo servidor; durante o foco a cidade fica só para leitura.
3. Ao fim do ciclo, o servidor resolve a produção e mostra o relatório: rank do lote, desperdício, impostos e manutenção.

| Sequência | 1 | 2 | 3 | 4 | 5+ |
|-----------|---|---|---|---|----|
| Rank      | D | C | B | A | S  |

Abandonar um ciclo, ou ficar mais de 90 min sem concluir um, **reduz** a sequência em 2 (não zera).
Acima de 16 ciclos no dia, os ciclos contam mas não geram recompensa.

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
- **Persistência:** o MVP salva em `.data/` (arquivos JSON), atrás da interface `PlayerRepo`. A próxima etapa é trocar por Supabase/Postgres (necessário em hospedagem serverless).

## Próximos passos

- [ ] Supabase: auth, `PlayerRepo` em Postgres
- [ ] Mercado multiplayer com livro de ofertas por tipo/Rank e comerciante NPC
- [ ] Energia, Tech Tree e mais biomas/recursos
- [ ] Sprites pixel art no lugar das formas procedurais
- [ ] Galeria de arte e páginas públicas da cidade (SSR)
