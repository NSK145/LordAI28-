create table if not exists public.lord_what_if_scenarios (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  scenario_group_id uuid not null,
  revision integer not null check (revision > 0),
  title text not null check (char_length(title) between 1 and 120),
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, scenario_group_id, revision)
);

create index if not exists lord_what_if_user_updated_idx
  on public.lord_what_if_scenarios (user_id, updated_at desc);

alter table public.lord_what_if_scenarios enable row level security;

create policy "Users can read own LORD What-If scenarios"
  on public.lord_what_if_scenarios for select
  using (auth.uid() = user_id);

create policy "Users can create own LORD What-If scenarios"
  on public.lord_what_if_scenarios for insert
  with check (auth.uid() = user_id);
