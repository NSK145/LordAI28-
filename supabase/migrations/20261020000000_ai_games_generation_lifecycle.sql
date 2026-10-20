alter table public.ai_games
  alter column spec drop not null,
  add column if not exists status text not null default 'ready';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'ai_games_status_check'
      and conrelid = 'public.ai_games'::regclass
  ) then
    alter table public.ai_games
      add constraint ai_games_status_check
      check (status in ('pending', 'generating', 'ready', 'failed'));
  end if;
end $$;
