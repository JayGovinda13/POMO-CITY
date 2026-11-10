-- Presença do jogador: saída pelo menu x fechar o jogo (desastres por ciclo quebrado).
alter table public.cities
  add column presence jsonb not null default '{"status":"exited","leftAt":null,"cyclesThisSession":0}'::jsonb;
