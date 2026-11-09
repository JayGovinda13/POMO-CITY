-- POMO-CITY: estado autoritativo de cada cidade + histórico de ciclos (auditoria anti-cheat).
-- Toda escrita acontece no servidor (chave secreta). O navegador só pode LER a própria cidade:
-- se o cliente pudesse escrever via RLS, bastaria o console para forjar dinheiro ou Rank S.

create table public.cities (
  player_id    uuid primary key references auth.users (id) on delete cascade,
  state        jsonb       not null,
  active_cycle jsonb,
  -- Controle de concorrência otimista: cada gravação exige a revisão lida.
  revision     bigint      not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table public.cycle_log (
  id          bigint generated always as identity primary key,
  player_id   uuid        not null references auth.users (id) on delete cascade,
  started_at  timestamptz not null,
  ended_at    timestamptz not null,
  outcome     text        not null check (outcome in ('completed', 'abandoned')),
  rank        text        check (rank in ('D', 'C', 'B', 'A', 'S')),
  streak      int,
  rewarded    boolean
);

create index cycle_log_player_idx on public.cycle_log (player_id, ended_at desc);

alter table public.cities    enable row level security;
alter table public.cycle_log enable row level security;

create policy "dono lê a própria cidade" on public.cities
  for select to authenticated using ((select auth.uid()) = player_id);

create policy "dono lê o próprio histórico" on public.cycle_log
  for select to authenticated using ((select auth.uid()) = player_id);

-- Sem políticas de insert/update/delete: só a service role (servidor) escreve.
revoke insert, update, delete on public.cities, public.cycle_log from anon, authenticated;
