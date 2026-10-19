create table if not exists public.ai_games (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  prompt text not null check (char_length(prompt) between 1 and 1200),
  spec jsonb not null,
  versions jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.ai_games enable row level security;
create policy "Users can read their own games" on public.ai_games for select using (auth.uid() = user_id);
create policy "Users can create their own games" on public.ai_games for insert with check (auth.uid() = user_id);
create policy "Users can update their own games" on public.ai_games for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users can delete their own games" on public.ai_games for delete using (auth.uid() = user_id);

create index if not exists ai_games_user_updated_idx on public.ai_games (user_id, updated_at desc);
create or replace function public.set_ai_games_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;
drop trigger if exists ai_games_updated_at on public.ai_games;
create trigger ai_games_updated_at before update on public.ai_games for each row execute function public.set_ai_games_updated_at();
