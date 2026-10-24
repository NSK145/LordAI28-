create table if not exists public.lord_voice_missions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  goal text not null check (char_length(goal) between 3 and 2000),
  title text not null check (char_length(title) between 1 and 120),
  status text not null default 'planned'
    check (status in ('planned', 'running', 'paused', 'completed', 'failed', 'cancelled')),
  steps jsonb not null default '[]'::jsonb,
  planner_model_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists lord_voice_missions_user_updated_idx
  on public.lord_voice_missions (user_id, updated_at desc);

alter table public.lord_voice_missions enable row level security;

drop policy if exists "Users manage their own LORD voice missions" on public.lord_voice_missions;
create policy "Users manage their own LORD voice missions"
  on public.lord_voice_missions
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

grant select, insert, update, delete on public.lord_voice_missions to authenticated;
