alter table public.ai_games
  add column if not exists idempotency_key text
  check (idempotency_key is null or char_length(idempotency_key) between 1 and 200);

create unique index if not exists ai_games_user_idempotency_key_idx
  on public.ai_games (user_id, idempotency_key)
  where idempotency_key is not null;
