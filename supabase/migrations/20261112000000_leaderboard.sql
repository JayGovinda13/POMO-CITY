-- Ranking online das cidades mais avançadas (árvore de tecnologia, população e valor).
-- Só dados do jogo: nome da cidade, região climática e números. Nada pessoal.
-- Escrita só pelo servidor (chave secreta), depois de cada ciclo concluído; leitura pública.

create table public.leaderboard (
  player_id   uuid primary key references auth.users (id) on delete cascade,
  city_name   text        not null,
  region      text,
  score       bigint      not null default 0,
  techs       int         not null default 0,
  population  int         not null default 0,
  year        int         not null default 1900,
  era         text,
  updated_at  timestamptz not null default now()
);

create index leaderboard_score_idx on public.leaderboard (score desc);

alter table public.leaderboard enable row level security;

create policy "ranking é público" on public.leaderboard
  for select to anon, authenticated using (true);

-- Sem políticas de escrita: só a service role (servidor) grava.
revoke insert, update, delete on public.leaderboard from anon, authenticated;
